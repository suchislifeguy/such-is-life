// renderer.js

const Renderer = (() => {
    console.log("--- Renderer.js: Initializing ---");
  
    let mainCtx = null;
    let canvasWidth = 1600;
    let canvasHeight = 900;
  
    // ... (Keep offscreen canvas, transition state, etc.) ...
    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d", { alpha: false });
    let isBackgroundReady = false;
    let currentBackgroundIsNight = null;
    let isTransitioningBackground = false;
    let transitionStartTime = 0;
    const BACKGROUND_FADE_DURATION_MS = 1000;
    const oldOffscreenCanvas = document.createElement("canvas");
    const oldOffscreenCtx = oldOffscreenCanvas.getContext("2d", { alpha: false });
    const hazeCanvas = document.createElement("canvas");
    const hazeCtx = hazeCanvas.getContext("2d", { willReadFrequently: true });
  
  
    // --- Internal Constants ---
    // *** FIX: Define playerColor BEFORE healthBarLow uses it ***
    const playerColor = "#DC143C"; // Define player color first
  
    const dayBaseColor = "#8FBC8F";
    const nightBaseColor = "#3E2723";
    const fontFamily = "'Courier New', monospace";
    const damageTextColor = "#FFFFFF";
    const damageTextCritColor = "#FFD700";
    const damageTextFontSize = 14;
    const damageTextCritFontSize = 18;
    // const playerColor = "#DC143C"; // Moved up
    const otherPlayerColor = "#4682B4";
    const dustyPlayerSelfColor = "#8B4513";
    const dustyPlayerOtherColor = "#556B2F";
    const enemyTorsoChaserColor = "#2F4F4F";
    const enemyTorsoShooterColor = "#4682B4";
    const enemyTorsoGiantColor = "#6B4226";
    const enemySkinColor = "#D2B48C";
    const enemyCoatColor = "#8B4513";
    const enemyBootColor = "#222222";
    const enemyCapColor = "#111111";
    const enemyHitFlashColor = "rgba(255, 255, 255, 0.7)";
    const bulletPlayerColor = "#ffed4a";
    const bulletEnemyColor = "#ff0000";
    const healthBarBg = "#444";
    const healthBarHigh = "#66bb6a";
    const healthBarMedium = "#FFD700";
    const healthBarLow = playerColor; // Now playerColor is defined
    const armorBarColor = "#9e9e9e";
    const powerupHealthColor = "#81c784";
    const powerupGunColor = "#442848";
    const powerupSpeedColor = "#3edef3";
    const powerupArmorColor = armorBarColor; // Reuse armorBarColor
    const powerupShotgunColor = "#FFA500";
    const powerupSlugColor = "#A0522D";
    const powerupRapidColor = "#FFFF00";
    const powerupScoreColor = healthBarMedium; // Reuse healthBarMedium
    const powerupDefaultColor = "#888";
    const playerSpeechBubbleColor = "#d0d8d7";
    const playerSpeechBubbleBg = "rgba(0, 0, 0, 0.7)";
    const playerSpeechBubbleOutline = "rgba(200, 200, 200, 0.5)";
    const enemySpeechBubbleColor = "#FFAAAA";
    const enemySpeechBubbleBg = "rgba(70, 0, 0, 0.7)";
    const enemySpeechBubbleOutline = "rgba(200, 150, 150, 0.5)";
    const campfireAuraColor = "rgba(255, 165, 0, 0.15)";
    const campfireStickColor = "#8B4513";
    const campfireFlameOuterColor = "rgba(255, 165, 0, 0.6)";
    const campfireFlameInnerColor = "rgba(255, 255, 0, 0.7)";
    const muzzleFlashColor = "rgba(255, 220, 50, 0.9)";
    const snakeLineColor = "#261a0d";
    const snakeBiteTintColor = "rgba(0, 200, 50, 0.15)";
    const ironHelmetColor = "#3d3d3d";
    const ironHelmetHighlight = "#666666";
    const ironHelmetShadow = "#1a1a1a";
    const beltColor = "#412a19";
    const bootColor = "#241c1c";
    const backgroundShadowColor = "rgba(0,0,0,0.3)";
    const simpleChestPlateColor = "#777777";
    const chestPlateHighlight = "#999999";
    const slitColor = "#000000";
    const gunColor = "#444444";
    const sparkColors = [ "rgba(255, 100, 0, 0.8)", "rgba(255, 165, 0, 0.9)", "rgba(255, 220, 50, 0.7)", ];
    const IDLE_BOB_SPEED_DIVISOR = 600;
    const IDLE_BOB_AMPLITUDE = 3;
    const DAMAGE_VIGNETTE_HEALTH_THRESHOLD = 30;
    const TEMP_FREEZING_CLIENT = 0.0;
    const TEMP_COLD_CLIENT = 10.0;
    const TEMP_HOT_CLIENT = 35.0;
    const TEMP_SCORCHING_CLIENT = 40.0;
    const MAX_TINT_ALPHA = 0.25;
    const RAIN_COLOR = "rgba(170, 190, 230, 0.6)";
    const RAIN_DROPS = 150;
    const RAIN_LENGTH = 15;
    const RAIN_SPEED_X = 1;
    const RAIN_SPEED_Y = 12;
    const HEAT_HAZE_START_TEMP = 28.0;
    const HEAT_HAZE_MAX_TEMP = 45.0;
    const HEAT_HAZE_MAX_OFFSET = 4;
    const HEAT_HAZE_SPEED = 0.004;
    const HEAT_HAZE_WAVELENGTH = 0.02;
    const HEAT_HAZE_LAYERS_MAX = 5;
    const HEAT_HAZE_BASE_ALPHA = 0.03;
  
    let currentShakeMagnitude = 0;
    let shakeEndTime = 0;
  
    // --- (Keep ALL helper functions: drawRoundedRect, generateBackground, updateGeneratedBackground, etc...) ---
    // --- ... No changes needed inside the helper functions themselves for this fix ... ---
    function drawRoundedRect(ctx, x, y, width, height, radius) { if (width < 2 * radius) radius = width / 2; if (height < 2 * radius) radius = height / 2; ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath(); }
    function generateBackground(ctx, targetIsNight, width, height) { console.log(`[Renderer] generateBackground called. TargetNight: ${targetIsNight}`); const baseColor = targetIsNight ? nightBaseColor : dayBaseColor; ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height); if (!targetIsNight) { const np=100,nt=150; for(let i=0;i<np;i++){ const x=Math.random()*width,y=Math.random()*height,r=Math.random()*40+15,c=`rgba(${(101+Math.random()*20-10).toFixed(0)},${(67+Math.random()*20-10).toFixed(0)},${(33+Math.random()*20-10).toFixed(0)},${(Math.random()*0.25+0.20).toFixed(2)})`; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); } ctx.lineWidth=3; ctx.strokeStyle='rgba(34,139,34,0.6)'; for(let i=0;i<nt;i++){ const x=Math.random()*width,y=Math.random()*height; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()*6-3),y-(Math.random()*6+5)); ctx.stroke(); } } else { const np=60,ns=150; for(let i=0;i<np;i++){ const x=Math.random()*width,y=Math.random()*height,r=Math.random()*50+20,a=Math.random()*0.15+0.1; ctx.fillStyle=`rgba(5,2,2,${a.toFixed(2)})`; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); } ctx.fillStyle='rgba(255,255,240,0.8)'; for(let i=0;i<ns;i++){ const sx=Math.random()*width,sy=Math.random()*height,sr=Math.random()*1.5+0.5; ctx.fillRect(sx,sy,sr,sr); } } ctx.canvas.dataset.isNight = targetIsNight; console.log(`[Renderer] generateBackground finished. Stored isNight: ${ctx.canvas.dataset.isNight}`); return targetIsNight; }
    function updateGeneratedBackground(targetIsNight, targetCanvasWidth, targetCanvasHeight) { canvasWidth = targetCanvasWidth; canvasHeight = targetCanvasHeight; if ( offscreenCanvas.width !== canvasWidth || offscreenCanvas.height !== canvasHeight ) { offscreenCanvas.width = canvasWidth; offscreenCanvas.height = canvasHeight; oldOffscreenCanvas.width = canvasWidth; oldOffscreenCanvas.height = canvasHeight; hazeCanvas.width = canvasWidth; hazeCanvas.height = canvasHeight; isBackgroundReady = false; currentBackgroundIsNight = null; isTransitioningBackground = false; } if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) { return; } if (isTransitioningBackground && targetIsNight === (offscreenCanvas.dataset.isNight === 'true')) { return; } if (isBackgroundReady) { oldOffscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight); oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0); isTransitioningBackground = true; transitionStartTime = performance.now(); generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight); currentBackgroundIsNight = targetIsNight; } else { generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight); currentBackgroundIsNight = targetIsNight; isBackgroundReady = true; isTransitioningBackground = false; } }
    function drawDamageTexts(ctx, damageTexts) { if(!damageTexts) return; const now=performance.now(),pd=250,pmsi=4; ctx.textAlign='center'; ctx.textBaseline='bottom'; Object.values(damageTexts).forEach(dt=>{ if(!dt) return; const x=dt.x??0,y=dt.y??0,t=dt.text??'?',ic=dt.is_crit??false,st=dt.spawn_time?dt.spawn_time*1000:now,ts=now-st; let cfs=ic?damageTextCritFontSize:damageTextFontSize,cfc=ic?damageTextCritColor:damageTextColor; if(ic&&ts<pd){ const pp=Math.sin((ts/pd)*Math.PI); cfs+=pp*pmsi; } ctx.font=`bold ${Math.round(cfs)}px ${fontFamily}`; ctx.fillStyle=cfc; ctx.fillText(t,x,y); }); }
    function drawCampfire(ctx, campfireData, width, height) { if(!campfireData||!campfireData.active) return; const x=campfireData.x??width/2,y=campfireData.y??height/2,r=campfireData.radius??0; if(r<=0) return; const sw=20,sh=4,fw=15,fh=25; ctx.save(); ctx.fillStyle=campfireAuraColor; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); const soy=5; ctx.fillStyle=campfireStickColor; ctx.translate(x,y+soy); ctx.rotate(Math.PI/5); ctx.fillRect(-sw/2,-sh/2,sw,sh); ctx.rotate(-Math.PI/5); ctx.rotate(-Math.PI/6); ctx.fillRect(-sw/2,-sh/2,sw,sh); ctx.rotate(Math.PI/6); ctx.translate(-x,-(y+soy)); const foy=-10,fcx=x,fcy=y+foy; ctx.fillStyle=campfireFlameOuterColor; ctx.beginPath(); ctx.ellipse(fcx,fcy,fw/2,fh/2,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle=campfireFlameInnerColor; ctx.beginPath(); ctx.ellipse(fcx,fcy-3,fw/3,fh/3,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }

    function drawDamageVignette(ctx, intensity, width, height) { if(intensity<=0) return; ctx.save(); const or=Math.sqrt(width**2+height**2)/2,g=ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,or),ra=0.4*intensity; g.addColorStop(0,'rgba(255,0,0,0)'); g.addColorStop(0.75,'rgba(255,0,0,0)'); g.addColorStop(1,`rgba(255,0,0,${ra.toFixed(2)})`); ctx.fillStyle=g; ctx.fillRect(0,0,width,height); ctx.restore(); }
    function drawTemperatureTint(ctx, temperature, width, height) { let tcs=null, a=0.0; const tfc=TEMP_FREEZING_CLIENT, tcc=TEMP_COLD_CLIENT, thc=TEMP_HOT_CLIENT, tsc=TEMP_SCORCHING_CLIENT, mta=MAX_TINT_ALPHA; if(temperature===null || typeof temperature === 'undefined'){ return; } if(temperature<=tfc){ tcs='rgba(100,150,255,A)'; a=mta*Math.min(1.0,(tfc-temperature+5)/5.0); } else if(temperature<=tcc){ tcs='rgba(150,180,255,A)'; a=mta*((tcc-temperature)/(tcc-tfc)); } else if(temperature>=tsc){ tcs='rgba(255,100,0,A)'; a=mta*Math.min(1.0,(temperature-tsc+5)/5.0); } else if(temperature>=thc){ tcs='rgba(255,150,50,A)'; a=mta*((temperature-thc)/(tsc-thc)); } a=Math.max(0,Math.min(mta,a)); if(tcs&&a>0.01){ ctx.globalAlpha=1.0; ctx.fillStyle=tcs.replace('A',a.toFixed(2)); ctx.fillRect(0,0,width,height); ctx.globalAlpha=1.0; } }
    function drawEnemySpeechBubbles(ctx, enemiesToRender, activeEnemyBubblesRef) { if(!activeEnemyBubblesRef) return; const now=performance.now(),bf='italic 11px '+fontFamily,cr=4,tp=3,bo=20; ctx.font=bf; ctx.textAlign='center'; ctx.textBaseline='bottom'; const etr=[]; for(const eid in activeEnemyBubblesRef){ const b=activeEnemyBubblesRef[eid]; if(now>=b.endTime){etr.push(eid);continue;} const e=enemiesToRender?.[eid]; if(e&&e.health>0){ const edx=e.x,edy=e.y,eh=e.height??40,by=edy-eh/2-bo,tm=ctx.measureText(b.text),tw=tm.width,bw=tw+tp*2,afh=11,bh=afh+tp*2,bx=edx-bw/2,bby=by-bh; ctx.fillStyle=enemySpeechBubbleBg; drawRoundedRect(ctx,bx,bby,bw,bh,cr); ctx.fill(); ctx.strokeStyle=enemySpeechBubbleOutline; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle=enemySpeechBubbleColor; ctx.fillText(b.text,edx,by-tp); } else {etr.push(eid);} } etr.forEach(id=>{ if (activeEnemyBubblesRef) delete activeEnemyBubblesRef[id]; }); }
    function drawSpeechBubbles(ctx, playersToRender, activeSpeechBubblesRef, appStateRef) { if(!activeSpeechBubblesRef || !appStateRef) return; const now=performance.now(),bf='bold 12px '+fontFamily,cr=5,tp=4,bo=30; ctx.font=bf; ctx.textAlign='center'; ctx.textBaseline='bottom'; const ptr=[]; for(const pid in activeSpeechBubblesRef){ const b=activeSpeechBubblesRef[pid]; if(now>=b.endTime){ptr.push(pid);continue;} const p=playersToRender?.[pid]; if(p&&p.player_status!=='dead'&&p.health>0){ const pdx=(pid===appStateRef.localPlayerId)?appStateRef.renderedPlayerPos.x:p.x,pdy=(pid===appStateRef.localPlayerId)?appStateRef.renderedPlayerPos.y:p.y,ph=p.height??48,by=pdy-ph/2-bo,tm=ctx.measureText(b.text),tw=tm.width,bw=tw+tp*2,afh=12,bh=afh+tp*2,bx=pdx-bw/2,bby=by-bh; ctx.fillStyle=playerSpeechBubbleBg; drawRoundedRect(ctx,bx,bby,bw,bh,cr); ctx.fill(); ctx.strokeStyle=playerSpeechBubbleOutline; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle=playerSpeechBubbleColor; ctx.fillText(b.text,pdx,by-tp); } else {ptr.push(pid);} } ptr.forEach(id=>{ if (activeSpeechBubblesRef) delete activeSpeechBubblesRef[id]; }); }
    function drawSnake(ctx, snakeRef) { if(!snakeRef||!snakeRef.isActiveFromServer||!snakeRef.segments||snakeRef.segments.length<2) return; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=snakeLineColor; ctx.lineWidth=snakeRef.lineWidth; ctx.beginPath(); ctx.moveTo(snakeRef.segments[snakeRef.segments.length-1].x,snakeRef.segments[snakeRef.segments.length-1].y); for(let i=snakeRef.segments.length-2;i>=1;i--){ const s=snakeRef.segments[i],ns=snakeRef.segments[i-1]; if(!s||!ns) continue; const xc=(s.x+ns.x)/2,yc=(s.y+ns.y)/2; ctx.quadraticCurveTo(s.x,s.y,xc,yc); } if(snakeRef.segments.length>0){ const h=snakeRef.segments[0]; if(snakeRef.segments.length>1){ const n=snakeRef.segments[1],xc=(n.x+h.x)/2,yc=(n.y+h.y)/2; ctx.quadraticCurveTo(n.x,n.y,xc,yc); } ctx.lineTo(h.x,h.y); } ctx.stroke(); }
    function drawHealthBar(ctx, x, y, width, currentHealth, maxHealth) { if(maxHealth<=0) return; const bh=5,yo=-(width/2+27),bw=Math.max(20,width*0.8),cw=Math.max(0,(currentHealth/maxHealth)*bw),hp=currentHealth/maxHealth,bx=x-bw/2,by=y+yo; ctx.fillStyle=healthBarBg; ctx.fillRect(bx,by,bw,bh); let bc=healthBarLow; if(hp>0.66) bc=healthBarHigh; else if(hp>0.33) bc=healthBarMedium; ctx.fillStyle=bc; ctx.fillRect(bx,by,cw,bh); }
    function drawArmorBar(ctx, x, y, width, currentArmor) { const ma=100; if(currentArmor<=0) return; const abh=4,hbh=5,bs=1,hbyo=-(width/2+27),hbty=y+hbyo,abty=hbty+hbh+bs,bw=Math.max(20,width*0.8),cw=Math.max(0,(currentArmor/ma)*bw),bx=x-bw/2,by=abty; ctx.fillStyle=healthBarBg; ctx.fillRect(bx,by,bw,abh); ctx.fillStyle=armorBarColor; ctx.fillRect(bx,by,cw,abh); }
    function drawEnemyRect(ctx, x, y, w, h, type, enemyState) {
        const currentW = w;
        const currentH = h;
        const tc = type === 'shooter' ? enemyTorsoShooterColor : (type === 'giant' ? enemyTorsoGiantColor : enemyTorsoChaserColor);
        const bo = (type !== 'giant') ? Math.sin(performance.now() / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;
    
        const ns = performance.now(); // Use performance.now for consistency
        const se = enemyState?.effects?.snake_bite_slow;
        // Check if effect exists and hasn't expired (assuming expires_at is seconds from server)
        const isb = se && typeof se.expires_at === 'number' && ns < (se.expires_at * 1000);
    
        // ... (rest of the definitions like hr, bheight, etc.) ...
        const hr=currentH*0.18,bheight=currentH*0.5,clb=currentH*0.15,btw=currentW*0.9,bbw=currentW*0.7,cow=currentW*1.1,aw=currentW*0.2,al=currentH*0.4,capH=hr*0.8,capW=hr*2.2,bos=currentW*0.15,bss=currentW*0.3;
        const hcy=y-currentH/2+hr+bo,bty=hcy+hr*0.8,bby=bty+bheight,coty=bty+bheight*0.1,coby=bby+clb,aty=bty+bheight*0.05,caty=hcy-hr,booy=coby+2;
    
        ctx.save();
        // ... (drawing code for enemy body: coat, torso, arms, skin, cap, boots) ...
        ctx.fillStyle=enemyCoatColor; ctx.fillRect(x-cow/2,coty,cow,coby-coty);
        ctx.fillStyle=tc; ctx.beginPath(); ctx.moveTo(x-btw/2,bty); ctx.lineTo(x+btw/2,bty); ctx.lineTo(x+bbw/2,bby); ctx.lineTo(x-bbw/2,bby); ctx.closePath(); ctx.fill();
        ctx.fillStyle=enemyCoatColor; ctx.fillRect(x-btw/2-aw,aty,aw,al); ctx.fillRect(x+btw/2,aty,aw,al);
        ctx.fillStyle=enemySkinColor; ctx.beginPath(); ctx.arc(x,hcy,hr,0,Math.PI*2); ctx.fill();
        if(type!=='giant'){ ctx.fillStyle=enemyCapColor; ctx.fillRect(x-capW/2,caty,capW,capH); }
        ctx.fillStyle=enemyBootColor; ctx.fillRect(x-bss-bos/2,booy,bos,bos); ctx.fillRect(x+bss-bos/2,booy,bos,bos);
  
        if (isb) {
            const auraRadius = Math.max(currentW * 0.6, 15);
            const auraY = y + currentH * 0.5 + bo - 5; // Position near the base
            const auraLineWidth = 3;
            const auraColor = "rgba(0, 255, 50, 0.7)";
    
            const pulseSpeed = 0.004;
            const pulseMagnitude = 2;
            const pulseOffset = Math.sin(ns * pulseSpeed) * pulseMagnitude;
    
            ctx.lineWidth = auraLineWidth;
            ctx.strokeStyle = auraColor;
            ctx.beginPath();
            ctx.arc(x, auraY, auraRadius + pulseOffset, 0, Math.PI * 2);
            ctx.stroke();
        }
    
        // ... (code for hit flash) ...
        if(enemyState?.hit_flash_this_tick){ ctx.fillStyle=enemyHitFlashColor; const fm=2; ctx.fillRect(x-currentW/2-fm,y-currentH/2-fm+bo,currentW+fm*2,currentH+fm*2); }
    
        ctx.restore();
      }
    

    
    function drawPlayerCharacter( ctx, x, y, w, h, isSelf, playerState, aimDx, aimDy ) {
        const jh=playerState?.hit_flash_this_tick??false;
        const ii=(playerState?.input_vector?.dx??0)===0&&(playerState?.input_vector?.dy??0)===0;
        const t=performance.now();
        const bo=ii?Math.sin(t/IDLE_BOB_SPEED_DIVISOR)*IDLE_BOB_AMPLITUDE:0;
    
        // --- Check for player snake bite effect ---
        const playerSnakeEffect = playerState?.effects?.snake_bite_slow;
        // Ensure effect exists, is object, has number timestamp, and hasn't expired
        const isPlayerBitten = playerSnakeEffect &&
                               typeof playerSnakeEffect === 'object' &&
                               typeof playerSnakeEffect.expires_at === 'number' &&
                               t < (playerSnakeEffect.expires_at * 1000);    
        // ... (definitions for hh, hw, sly, etc. remain) ...
        const hh=h*0.3,hw=w*0.95,slh=hh*0.15,slw=hw*0.8,ngh=h*0.06,spw=w*1.25,sph=h*0.1,chestPlateHeight=h*0.3,cpw=w*0.9,aw=w*0.2,al=h*0.4,bh=h*0.05,ph=h*0.35,boh=h*0.1,bow=w*0.32,bos=w*0.4;
        const to=h*0.5,hty=y-to+bo,hby=hty+hh,sly=hty+hh*0.4,ngty=hby-3,ngby=ngty+ngh,sty=ngby-2,sby=sty+sph,cpty=sty+sph*0.15,aty=sty+sph*0.2,bey=cpty+chestPlateHeight+bh*0.1,pty=bey+bh*0.4,pby=pty+ph,boty=pby-5,boby=boty+boh;
        const dc=isSelf?dustyPlayerSelfColor:dustyPlayerOtherColor;
    
        ctx.save();
        // ... (drawing code for player shadow, legs, boots, belt, chestplate, arms, helmet, slit) ...
        ctx.beginPath(); const sy=boby+1; ctx.ellipse(x,sy,w*0.45,h*0.05,0,0,Math.PI*2); ctx.fillStyle=backgroundShadowColor; ctx.fill();
        ctx.fillStyle=dc; const lw=w*0.4; ctx.fillRect(x-w*0.45,pty,lw,ph); ctx.fillRect(x+w*0.05,pty,lw,ph);
        ctx.fillStyle=bootColor; if(!ii){const sd=250,sp=Math.floor(t/sd)%2;if(sp===0){ ctx.fillRect(x-bos-bow/2,boty-2,bow,boh); ctx.fillRect(x+bos-bow/2,boty,bow,boh);}else{ ctx.fillRect(x-bos-bow/2,boty,bow,boh); ctx.fillRect(x+bos-bow/2,boty-2,bow,boh);}}else{ ctx.fillRect(x-bos-bow/2,boty,bow,boh); ctx.fillRect(x+bos-bow/2,boty,bow,boh);}
        ctx.fillStyle=beltColor; ctx.fillRect(x-w*0.65,bey-bh/2,w*1.3,bh);
        ctx.fillStyle=simpleChestPlateColor; ctx.fillRect(x-cpw/2,cpty,cpw,chestPlateHeight);
        ctx.fillStyle=chestPlateHighlight; ctx.fillRect(x-cpw/2+5,cpty+5,cpw-10,3);
        ctx.fillStyle=ironHelmetColor; ctx.fillRect(x-spw/2,sty,spw,sph);
        ctx.fillStyle=ironHelmetHighlight; ctx.fillRect(x-spw/2+3,sty+2,spw-6,2);
        ctx.fillStyle=dc; ctx.fillRect(x-spw*0.45,aty,aw,al); ctx.fillRect(x+spw*0.45-aw,aty,aw,al);
        ctx.fillStyle=ironHelmetColor; ctx.fillRect(x-hw*0.4,ngty,hw*0.8,ngh);
        ctx.fillStyle=ironHelmetColor; ctx.fillRect(x-hw/2,hty,hw,hh);
        ctx.fillStyle=ironHelmetHighlight; ctx.fillRect(x-hw/2,hty,hw,3);
        ctx.fillStyle=ironHelmetShadow; ctx.fillRect(x-hw/2+1,hty+3,hw-2,2);
        ctx.fillStyle=slitColor; ctx.fillRect(x-slw/2,sly,slw,slh);
    
        // ... (code for drawing gun) ...
        if(isSelf&&(aimDx!==0||aimDy!==0)){ /* ... gun drawing ... */ }
    
        if (isPlayerBitten) {
            const auraRadius = Math.max(w * 0.6, 18);
            const auraY = y + h * 0.5 + bo - 6; // Position near the base
            const auraLineWidth = 3.5;
            const auraColor = "rgba(0, 255, 50, 0.75)";
    
            const pulseSpeed = 0.004;
            const pulseMagnitude = 2.5;
            const pulseOffset = Math.sin(t * pulseSpeed) * pulseMagnitude;
    
            // No need for save/restore if only changing lineWidth/strokeStyle
            const originalLineWidth = ctx.lineWidth;
            const originalStrokeStyle = ctx.strokeStyle;
            ctx.lineWidth = auraLineWidth;
            ctx.strokeStyle = auraColor;
            ctx.beginPath();
            ctx.arc(x, auraY, auraRadius + pulseOffset, 0, Math.PI * 2);
            ctx.stroke();
            // Restore previous styles
            ctx.lineWidth = originalLineWidth;
            ctx.strokeStyle = originalStrokeStyle;
        }
    
        if(jh){/* ... spark drawing ... */}
    
        ctx.restore(); // Matches the ctx.save() at the beginning
    }
    function drawPlayers(ctx, players, appStateRef, localPlayerMuzzleFlashRef) { if(!players || !appStateRef) return; Object.values(players).forEach(p=>{ if(!p||p.player_status==='dead') return; const is=p.id===appStateRef.localPlayerId,ps=p.player_status||'alive',dx=is?appStateRef.renderedPlayerPos.x:p.x,dy=is?appStateRef.renderedPlayerPos.y:p.y,w=p.width??48,h=p.height??48,mh=p.max_health??100,ca=p.armor??0,id=(ps==='down'),a=id?0.4:1.0; ctx.save(); ctx.globalAlpha=a; const adx=is?localPlayerMuzzleFlashRef?.aimDx:0,ady=is?localPlayerMuzzleFlashRef?.aimDy:0; drawPlayerCharacter(ctx,dx,dy,w,h,is,p,adx,ady); ctx.restore(); if(ps==='alive'){ drawHealthBar(ctx,dx,dy,w,p.health,mh); if(ca>0) drawArmorBar(ctx,dx,dy,w,ca); } }); }
    function drawEnemies(ctx, enemies, activeEnemyBubblesRef) { if(!enemies) return; const now=performance.now()/1000,fd=0.3; Object.values(enemies).forEach(e=>{ if(!e) return; const w=e.width??20,h=e.height??40,mh=e.max_health??50; let a=1.0,sd=true,id=false; if(e.health<=0&&e.death_timestamp){ id=true; const el=now-e.death_timestamp; if(el<fd) a=0.4; else sd=false; } if(sd){ ctx.save(); ctx.globalAlpha=a; drawEnemyRect(ctx,e.x,e.y,w,h,e.type,e); ctx.restore(); } if(!id&&e.health>0&&sd){ drawHealthBar(ctx,e.x,e.y,w,e.health,mh); } }); }
    function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy) {
        const numPoints = 5; // Number of points in the star
        const outerRadiusBase = 18;
        const outerRadiusVariance = 6;
        const innerRadiusBase = 7;
        const innerRadiusVariance = 3;
        const glowRadius = 35;
        const glowColor = "rgba(255, 200, 50, 0.3)";
        const flashColor = "rgba(255, 230, 100, 0.95)";
        const offsetDistance = 12; // How far from player center the flash originates
    
        const flashX = playerX + aimDx * offsetDistance;
        const flashY = playerY + aimDy * offsetDistance;
        const angle = Math.atan2(aimDy, aimDx); // Base angle
    
        ctx.save();
        ctx.translate(flashX, flashY);
        ctx.rotate(angle); // Rotate the whole flash to match aim direction
    
        // 1. Draw the Glow behind
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        glowGradient.addColorStop(0, glowColor);
        glowGradient.addColorStop(1, "rgba(255, 200, 50, 0)");
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();
    
        // 2. Draw the Starburst
        ctx.fillStyle = flashColor;
        ctx.beginPath();
        for (let i = 0; i < numPoints * 2; i++) {
            const radius = (i % 2 === 0)
                ? outerRadiusBase + Math.random() * outerRadiusVariance
                : innerRadiusBase + Math.random() * innerRadiusVariance;
            const pointAngle = (i / (numPoints * 2)) * (Math.PI * 2) - Math.PI / 2; // Offset to point 'up' initially
            const px = Math.cos(pointAngle) * radius;
            const py = Math.sin(pointAngle) * radius;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
    
        ctx.restore();
    }
    
    // --- MODIFIED: drawBulletCircle (Adds trail logic) ---
    function drawBulletCircle(ctx, bullet, trailLengthFactor = 0.8, trailBaseAlpha = 0.6) {
        const { x, y, vx = 0, vy = 0, radius: r = 4, owner_type } = bullet;
        const isPlayerBullet = owner_type === 'player';
        const color = isPlayerBullet ? bulletPlayerColor : bulletEnemyColor;
        const speed = Math.sqrt(vx * vx + vy * vy);
    
        // Trail calculations
        const trailLength = r * 2 * trailLengthFactor * Math.min(1, speed / 100); // Scale trail with speed, capped
        let startX = x, startY = y;
        if (speed > 1) {
            startX = x - (vx / speed) * trailLength;
            startY = y - (vy / speed) * trailLength;
        }
    
        // Draw Trail (gradient line)
        if (trailLength > 1 && speed > 1) {
            try {
                const gradient = ctx.createLinearGradient(startX, startY, x, y);
                // Parse base color to set alpha for trail start
                let trailStartColor = color; // Default if parse fails
                if (color.startsWith('#')) { // Basic hex handling
                     let alphaHex = Math.round(trailBaseAlpha * 255).toString(16).padStart(2, '0');
                     trailStartColor = color + alphaHex; // Append alpha hex
                } else if (color.startsWith('rgb')) { // Basic rgb/rgba handling
                     trailStartColor = color.replace(/rgb/i, 'rgba').replace(')', `, ${trailBaseAlpha})`);
                }
                gradient.addColorStop(0, trailStartColor); // Faded start
                gradient.addColorStop(1, color);           // Solid end (at bullet position)
    
                ctx.strokeStyle = gradient;
                ctx.lineWidth = r * 0.8; // Trail slightly thinner than bullet
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(x, y);
                ctx.stroke();
            } catch (e) {
                // Fallback if gradient fails (e.g., invalid color format)
                ctx.strokeStyle = color;
                ctx.lineWidth = r * 0.8;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    
        // Draw Bullet Head
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    
        // Reset lineCap if changed
        ctx.lineCap = 'butt';
    }
    
    // --- MODIFIED: drawShapedBullet (Adds trail logic) ---
    function drawShapedBullet(ctx, bullet, trailLengthFactor = 1.0, trailBaseAlpha = 0.7) {
        const { x, y, vx = 0, vy = 0, radius: r = 4, owner_type } = bullet;
        const isPlayerBullet = owner_type === 'player';
        const color = isPlayerBullet ? bulletPlayerColor : bulletEnemyColor;
        const speed = Math.sqrt(vx * vx + vy * vy);
    
        // Bullet shape parameters (relative to radius)
        const baseLength = 8, baseWidth = 4;
        const scaleFactor = r / 4; // Use radius to scale base shape
        const shapeLength = baseLength * scaleFactor;
        const shapeWidth = baseWidth * scaleFactor;
    
        // Trail calculations
        const trailLength = shapeLength * trailLengthFactor * Math.min(1, speed / 150); // Scale trail with speed, capped
        let startX = x, startY = y;
        if (speed > 1) {
            startX = x - (vx / speed) * trailLength;
            startY = y - (vy / speed) * trailLength;
        }
    
        // Draw Trail (gradient line)
        if (trailLength > 1 && speed > 1) {
             try {
                const gradient = ctx.createLinearGradient(startX, startY, x, y);
                let trailStartColor = color; // Default if parse fails
                if (color.startsWith('#')) {
                     let alphaHex = Math.round(trailBaseAlpha * 255).toString(16).padStart(2, '0');
                     trailStartColor = color + alphaHex;
                } else if (color.startsWith('rgb')) {
                     trailStartColor = color.replace(/rgb/i, 'rgba').replace(')', `, ${trailBaseAlpha})`);
                }
                gradient.addColorStop(0, trailStartColor); // Faded start
                gradient.addColorStop(1, color);           // Solid end
    
                ctx.strokeStyle = gradient;
                ctx.lineWidth = shapeWidth * 0.6; // Trail slightly thinner than bullet body
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(x, y);
                ctx.stroke();
            } catch(e) {
                 // Fallback
                ctx.strokeStyle = color;
                ctx.lineWidth = shapeWidth * 0.6;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }
    
        // Draw Bullet Head (rotated rect with triangle nose)
        const angle = Math.atan2(vy, vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        // Main body
        ctx.fillRect(-shapeLength / 2, -shapeWidth / 2, shapeLength, shapeWidth);
        // Nose cone
        const noseLength = shapeLength * 0.4;
        ctx.beginPath();
        ctx.moveTo(shapeLength / 2, 0);
        ctx.lineTo(shapeLength / 2 - noseLength, -shapeWidth / 2);
        ctx.lineTo(shapeLength / 2 - noseLength, shapeWidth / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    
        // Reset lineCap if changed
        ctx.lineCap = 'butt';
    }
    
    // --- MODIFIED: drawBullets ---
    function drawBullets(ctx, bullets) {
        if (!bullets) return;
    
        Object.values(bullets).forEach(b => {
            if (!b) return;
            const bt = b.bullet_type || 'standard';
            const ot = b.owner_type;
            const hv = Math.abs(b.vx ?? 0) > 0.01 || Math.abs(b.vy ?? 0) > 0.01; // Has velocity
    
            // Choose drawing function and trail parameters based on type
            if (bt === 'ammo_heavy_slug') {
                if (hv) {
                    drawShapedBullet(ctx, b, 0.6, 0.8); // Shorter, thicker trail? (adjust alpha)
                } else {
                    drawBulletCircle(ctx, b, 0.4, 0.8); // Shorter trail if somehow static
                }
            } else if (bt === 'ammo_shotgun') {
                 // Shotgun pellets are circles with shorter trails
                drawBulletCircle(ctx, b, 0.5, 0.5); // Shorter, fainter trails
            } else if (bt === 'ammo_rapid_fire' || bt === 'standard' || bt === 'standard_enemy') {
                if (hv) {
                    drawShapedBullet(ctx, b, 1.0, 0.7); // Standard trail
                } else {
                    // Draw static bullet as circle without trail maybe?
                    drawBulletCircle(ctx, b, 0, 0); // No trail if no velocity
                }
            } else {
                // Default fallback: circle with standard trail
                drawBulletCircle(ctx, b, 0.8, 0.6);
            }
        });
    }
    function drawPowerupSquare(ctx, x, y, size, type) { let fc=powerupDefaultColor,s='?'; if(type==='health'){s='+';fc=powerupHealthColor;} else if(type==='gun_upgrade'){s='G';fc=powerupGunColor;} else if(type==='speed_boost'){s='S';fc=powerupSpeedColor;} else if(type==='armor'){s='#';fc=powerupArmorColor;} else if(type==='ammo_shotgun'){s='::';fc=powerupShotgunColor;} else if(type==='ammo_heavy_slug'){s='■';fc=powerupSlugColor;} else if(type==='ammo_rapid_fire'){s='>';fc=powerupRapidColor;} else if(type==='bonus_score'){s='$';fc=powerupScoreColor;} ctx.fillStyle=fc; ctx.fillRect(x-size/2,y-size/2,size,size); ctx.fillStyle='#000'; let fs=Math.round(size*0.7); ctx.font=`bold ${fs}px ${fontFamily}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(s,x,y+(size*0.05)); }
    function drawPowerups(ctx, powerups) { if(!powerups) return; Object.values(powerups).forEach(p=>{ if(!p) return; const s=p.size??20; drawPowerupSquare(ctx,p.x,p.y,s,p.type); }); }
  
    function triggerShake(magnitude, durationMs) { const now=performance.now(),net=now+durationMs; if(magnitude>=currentShakeMagnitude||net>=shakeEndTime){ currentShakeMagnitude=Math.max(magnitude,currentShakeMagnitude); shakeEndTime=Math.max(net,shakeEndTime); } }
  
    // --- Main Render Function ---
    function drawGame( ctx, appState, stateToRender, localPlayerMuzzleFlashRef, width, height ) {
      if (!mainCtx) mainCtx = ctx;
      if (!ctx || !appState) { console.error("drawGame missing context or appState!"); return; }
  
      const now = performance.now();
      canvasWidth = width; canvasHeight = height;
  
      let shakeApplied = false, shakeOffsetX = 0, shakeOffsetY = 0;
      // Shake Calculation
      if (currentShakeMagnitude > 0 && now < shakeEndTime) {
          shakeApplied = true;
          const timeRemaining = shakeEndTime - now;
          const durationMsFallback = 300;
          const initialDuration = Math.max(1, shakeEndTime - (now - timeRemaining)); // Use timeRemaining if duration calc is odd
          let currentMag = currentShakeMagnitude * (timeRemaining / initialDuration);
          currentMag = Math.max(0, currentMag);
  
          if (currentMag > 0.5) {
              const shakeAngle = Math.random() * Math.PI * 2;
              shakeOffsetX = Math.cos(shakeAngle) * currentMag;
              shakeOffsetY = Math.sin(shakeAngle) * currentMag;
          } else { currentShakeMagnitude = 0; shakeEndTime = 0; shakeApplied = false; }
      } else if (currentShakeMagnitude > 0) { currentShakeMagnitude = 0; shakeEndTime = 0; }
  
      // 1. Draw Background
      ctx.globalAlpha = 1.0;
      if (!isBackgroundReady) {
        ctx.fillStyle = dayBaseColor; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        if (appState?.serverState && currentBackgroundIsNight === null) {
          updateGeneratedBackground(appState.serverState.is_night, canvasWidth, canvasHeight);
        }
      } else if (isTransitioningBackground) {
        const elapsed = now - transitionStartTime; const progress = Math.min(1.0, elapsed / BACKGROUND_FADE_DURATION_MS);
        ctx.globalAlpha = 1.0; ctx.drawImage(oldOffscreenCanvas, 0, 0);
        ctx.globalAlpha = progress; ctx.drawImage(offscreenCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
        if (progress >= 1.0) { isTransitioningBackground = false; }
      } else {
        ctx.drawImage(offscreenCanvas, 0, 0);
      }
  
      // --- Heat Haze Logic ---
      const currentTempForEffect = appState?.currentTemp;
      if (currentTempForEffect !== null && typeof currentTempForEffect !== 'undefined' && currentTempForEffect >= HEAT_HAZE_START_TEMP) {
          const hazeIntensity = Math.max(0, Math.min(1, (currentTempForEffect - HEAT_HAZE_START_TEMP) / (HEAT_HAZE_MAX_TEMP - HEAT_HAZE_START_TEMP)));
          if (hazeIntensity > 0.01) {
               if(hazeCanvas.width !== canvasWidth || hazeCanvas.height !== canvasHeight) { hazeCanvas.width = canvasWidth; hazeCanvas.height = canvasHeight; }
               hazeCtx.clearRect(0, 0, canvasWidth, canvasHeight); hazeCtx.drawImage(ctx.canvas, 0, 0);
               const numLayers = 1 + Math.floor(hazeIntensity * (HEAT_HAZE_LAYERS_MAX - 1));
               const baseAlpha = HEAT_HAZE_BASE_ALPHA * hazeIntensity;
               for (let i = 0; i < numLayers; i++) {
                   const timeFactor = now * HEAT_HAZE_SPEED; const layerOffsetFactor = i * 0.8;
                   const verticalOffset = (Math.sin(timeFactor + layerOffsetFactor) * HEAT_HAZE_MAX_OFFSET * hazeIntensity) - (i * 0.3 * hazeIntensity);
                   const layerAlpha = baseAlpha * (1 - (i / (numLayers * 1.5)));
                   ctx.globalAlpha = Math.max(0, Math.min(1, layerAlpha));
                   ctx.drawImage(hazeCanvas, 0, 0, canvasWidth, canvasHeight, 0, verticalOffset, canvasWidth, canvasHeight );
               }
               ctx.globalAlpha = 1.0;
          }
      }
  
      // 2. Apply Shake Transform
      if (shakeApplied) { ctx.save(); ctx.translate(shakeOffsetX, shakeOffsetY); }
  
      // 3. Draw Game World Elements
      if (!stateToRender) { if (shakeApplied) ctx.restore(); return; }
      drawCampfire(ctx, stateToRender.campfire, canvasWidth, canvasHeight);
      if (typeof snake !== 'undefined') drawSnake(ctx, snake);
      drawPowerups(ctx, stateToRender.powerups);
      drawBullets(ctx, stateToRender.bullets);
      if (typeof activeEnemyBubbles !== 'undefined') drawEnemies(ctx, stateToRender.enemies, activeEnemyBubbles);
      if (typeof activeSpeechBubbles !== 'undefined' && appState) drawPlayers(ctx, stateToRender.players, appState, localPlayerMuzzleFlashRef);
      if (typeof activeSpeechBubbles !== 'undefined' && appState) drawSpeechBubbles(ctx, stateToRender.players, activeSpeechBubbles, appState);
      if (typeof activeEnemyBubbles !== 'undefined') drawEnemySpeechBubbles(ctx, stateToRender.enemies, activeEnemyBubbles);
      drawDamageTexts(ctx, stateToRender.damage_texts);
      let shouldDrawMuzzleFlash = localPlayerMuzzleFlashRef?.active && (now < localPlayerMuzzleFlashRef?.endTime);
      if (shouldDrawMuzzleFlash) { drawMuzzleFlash(ctx, appState.renderedPlayerPos.x, appState.renderedPlayerPos.y, localPlayerMuzzleFlashRef.aimDx, localPlayerMuzzleFlashRef.aimDy); }
      else if (localPlayerMuzzleFlashRef?.active) { localPlayerMuzzleFlashRef.active = false; }
  
      // 4. Restore Shake Transform
      if (shakeApplied) { ctx.restore(); }
  
      // 5. Draw Overlays
      ctx.globalAlpha = 1.0;
      if (appState?.isRaining) {
          ctx.strokeStyle = RAIN_COLOR; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = 0; i < RAIN_DROPS; i++) {
               const rainX = ( (i * 137) + (now * 0.05) ) % (canvasWidth + 100) - 50;
               const rainY = ( (i * 271) + (now * 0.3) ) % canvasHeight;
               const endX = rainX + RAIN_SPEED_X; const endY = rainY + RAIN_SPEED_Y;
               ctx.moveTo(rainX, rainY); ctx.lineTo(endX, endY);
          }
          ctx.stroke();
      } else if (appState?.isDustStorm) {
          ctx.fillStyle = 'rgba(180, 140, 90, 0.2)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      if (appState) drawTemperatureTint(ctx, appState.currentTemp, canvasWidth, canvasHeight);
      const localPlayerState = stateToRender.players?.[appState?.localPlayerId];
      if (localPlayerState && localPlayerState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD) { const vi = 1.0 - (localPlayerState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD); drawDamageVignette(ctx, vi, canvasWidth, canvasHeight); }
  
      ctx.globalAlpha = 1.0;
    } // --- End drawGame ---
  
    return { drawGame, triggerShake, updateGeneratedBackground };
  
  })(); // End Renderer module IIFE
  
  console.log("--- Renderer.js: Executed. Renderer object defined?", typeof Renderer);
