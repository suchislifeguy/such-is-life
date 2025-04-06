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
  
    function drawRoundedRect(ctx, x, y, width, height, radius) { if (width < 2 * radius) radius = width / 2; if (height < 2 * radius) radius = height / 2; ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath(); }


    function generateBackground(ctx, targetIsNight, width, height) {
        console.log(`[Renderer] generateBackground v5 called. TargetNight: ${targetIsNight}`);
        ctx.clearRect(0, 0, width, height); // Start fresh
    
        if (!targetIsNight) {
            // --- Day View (Looking Down - Structured Earthy Ground) ---
            const dayBaseColor = "#949A80"; // More Greyish-Green Base
            const dirtColor1 = "rgba(76, 103, 41, 0.2)"; // Slightly more opaque Earthy Brown 1
            const dirtColor2 = "rgba(143, 121, 55, 0.2)";  // Slightly more opaque Earthy Brown 2
            // Texture Stroke Colors:
            const textureStrokeDark = "rgba(59, 112, 67, 0.3)";    // Darker Dusty Green Stroke
            const textureStrokeLight = "rgba(135, 150, 110, 0.25)"; // Lighter Dusty Green Stroke
            const textureStrokeEmerald = "rgba(19, 226, 112, 0.15)";// Subtle Emerald Stroke (lower alpha)
    
            const numDirtPatches = 40; // Fewer, more defined patches
            const numTextureStrokes = 2500; // Fewer elements needed for strokes vs fills
    
            // 1. Base ground color
            ctx.fillStyle = dayBaseColor;
            ctx.fillRect(0, 0, width, height);
    
            // 2. Irregular Dirt Patches (Polygons - under texture)
            for (let i = 0; i < numDirtPatches; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const avgRadius = Math.random() * 100 + 50; // Average size
                const points = 5 + Math.floor(Math.random() * 4); // 5-8 points for irregularity
                const color = Math.random() < 0.5 ? dirtColor1 : dirtColor2;
    
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(x + avgRadius * Math.cos(0), y + avgRadius * Math.sin(0));
                for (let j = 1; j <= points; j++) {
                    const angle = (j / points) * Math.PI * 2;
                    // Add randomness to radius for each point
                    const radius = avgRadius * (0.7 + Math.random() * 0.6);
                    ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
                }
                ctx.closePath();
                ctx.fill();
            }
    
            // 3. Ground Texture using Strokes (Organic feel)
            ctx.lineWidth = 1.5; // Slightly thicker strokes
            ctx.lineCap = 'round'; // Softer ends
    
            for (let i = 0; i < numTextureStrokes; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const length = Math.random() * 5 + 2; // Short strokes
                const angle = Math.random() * Math.PI * 2; // Random direction
    
                // Choose texture color, giving emerald a lower chance
                let strokeColor;
                const randColor = Math.random();
                if (randColor < 0.10) { // ~10% chance for emerald touch
                    strokeColor = textureStrokeEmerald;
                } else if (randColor < 0.55) { // ~45% chance for lighter dusty
                    strokeColor = textureStrokeLight;
                } else { // ~45% chance for darker dusty
                    strokeColor = textureStrokeDark;
                }
    
                ctx.strokeStyle = strokeColor;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                ctx.stroke();
            }
            ctx.lineCap = 'butt'; // Reset lineCap
    
        } else {
            // --- Night View (Looking Up - Aggressively Neutral Dark Sky) ---
            const baseNightColor = "#080808"; // Near Black / Very Dark Grey Base
            const nebulaeColors = [
                // Removed blue/purple, using faint greys & reds
                [180, 180, 190, 0.05], // Faint Grey/White Cloud
                [200, 80, 80, 0.04],  // Faint Hydrogen-Alpha Red Cloud
                [160, 160, 160, 0.06], // Slightly Brighter Grey Cloud
                [210, 100, 100, 0.035] // Fainter Red Cloud
            ];
            const darkCloudColor = "rgba(8, 8, 8, 0.18)"; // Dark grey clouds, slightly more opaque
            const numNebulae = 10; // Fewer nebulae now they aren't the main color source
            const numDarkClouds = 20; // More dark clouds
            const numDustStars = 2000; // More dust
            const numMidStars = 500;
            const numHeroStars = 70;
    
            // 1. Base Sky Color (Very Neutral)
            ctx.fillStyle = baseNightColor;
            ctx.fillRect(0, 0, width, height);
    
            // 2. Nebulae / Gas Clouds (Faint Greys/Reds)
            for (let i = 0; i < numNebulae; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const radius = Math.random() * (width * 0.4) + (width * 0.15); // Can be large
                const colorData = nebulaeColors[Math.floor(Math.random() * nebulaeColors.length)];
                const [r, g, b, baseAlpha] = colorData;
                try {
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.min(0.1, baseAlpha * 1.5).toFixed(2)})`); // Faint core
                    gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${baseAlpha.toFixed(2)})`); // Main color
                    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`); // Fade out
                    ctx.fillStyle = gradient;
                    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
                } catch (e) { console.error("Failed to create nebula gradient:", e); }
            }
    
            // --- Star Fields --- (Helper function remains the same)
            const drawStars = (count, minSize, maxSize, minAlpha, maxAlpha, colorVariance = 0) => {
                for (let i = 0; i < count; i++) {
                    const sx = Math.random() * width;
                    const sy = Math.random() * height;
                    const size = Math.random() * (maxSize - minSize) + minSize;
                    const alpha = Math.random() * (maxAlpha - minAlpha) + minAlpha;
                    let r = 255, g = 255, b = 255;
                    if (colorVariance > 0 && Math.random() < 0.3) { // Reduced chance for color variance
                        const variance = Math.random() * colorVariance;
                        // Focus variance more on yellow/white, less pure blue
                         if (Math.random() < 0.7) { // 70% yellow/white shift
                            b -= variance;
                            r = Math.max(0, Math.min(255, r));
                            g = Math.max(0, Math.min(255, g));
                            b = Math.max(0, Math.min(255, b));
                        }
                        // Keep pure blue shift minimal or non-existent
                        // else { // Optional: very faint blue shift
                        //     r -= variance * 0.3;
                        //     g -= variance * 0.3;
                        // }
                    }
                    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(2)})`;
                    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
                }
            };
            // 3. Draw Star Layers (Increased dust count)
            drawStars(numDustStars, 0.4, 0.9, 0.06, 0.30); // Even fainter dust base alpha
            drawStars(numMidStars, 0.7, 1.6, 0.20, 0.70, 25); // Less color variance
            drawStars(numHeroStars, 1.4, 2.6, 0.50, 1.0, 40); // Less color variance
    
            // 4. Draw Dark Space Clouds (Neutral Dark Grey)
            for (let i = 0; i < numDarkClouds; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const radiusX = Math.random() * (width * 0.3) + (width * 0.12);
                const radiusY = Math.random() * (height * 0.25) + (height * 0.1);
                const rotation = Math.random() * Math.PI;
                ctx.fillStyle = darkCloudColor; // Neutral dark grey/black cloud color
                ctx.beginPath();
                ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
                ctx.fill();
            }
    
        } // End Night View
    
        // Store the state on the canvas element itself for the transition logic
        ctx.canvas.dataset.isNight = String(targetIsNight);
        console.log(`[Renderer] generateBackground v5 finished. Stored isNight: ${ctx.canvas.dataset.isNight}`);
        return targetIsNight; // Return the state we just generated
    }



    function updateGeneratedBackground(targetIsNight, targetCanvasWidth, targetCanvasHeight) { canvasWidth = targetCanvasWidth; canvasHeight = targetCanvasHeight; if ( offscreenCanvas.width !== canvasWidth || offscreenCanvas.height !== canvasHeight ) { offscreenCanvas.width = canvasWidth; offscreenCanvas.height = canvasHeight; oldOffscreenCanvas.width = canvasWidth; oldOffscreenCanvas.height = canvasHeight; hazeCanvas.width = canvasWidth; hazeCanvas.height = canvasHeight; isBackgroundReady = false; currentBackgroundIsNight = null; isTransitioningBackground = false; } if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) { return; } if (isTransitioningBackground && targetIsNight === (offscreenCanvas.dataset.isNight === 'true')) { return; } if (isBackgroundReady) { oldOffscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight); oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0); isTransitioningBackground = true; transitionStartTime = performance.now(); generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight); currentBackgroundIsNight = targetIsNight; } else { generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight); currentBackgroundIsNight = targetIsNight; isBackgroundReady = true; isTransitioningBackground = false; } }
    function drawDamageTexts(ctx, damageTexts) { if(!damageTexts) return; const now=performance.now(),pd=250,pmsi=4; ctx.textAlign='center'; ctx.textBaseline='bottom'; Object.values(damageTexts).forEach(dt=>{ if(!dt) return; const x=dt.x??0,y=dt.y??0,t=dt.text??'?',ic=dt.is_crit??false,st=dt.spawn_time?dt.spawn_time*1000:now,ts=now-st; let cfs=ic?damageTextCritFontSize:damageTextFontSize,cfc=ic?damageTextCritColor:damageTextColor; if(ic&&ts<pd){ const pp=Math.sin((ts/pd)*Math.PI); cfs+=pp*pmsi; } ctx.font=`bold ${Math.round(cfs)}px ${fontFamily}`; ctx.fillStyle=cfc; ctx.fillText(t,x,y); }); }

    function drawCampfire(ctx, campfireData, width, height) {
        if (!campfireData || !campfireData.active) return; // Only draw if active (server controls this via is_night)

        const now = performance.now();
        const x = campfireData.x ?? width / 2;
        const y = campfireData.y ?? height / 2;
        const baseRadius = campfireData.radius ?? 0; // Used for glow radius
        if (baseRadius <= 0) return;

        // Stick properties
        const stickWidth = 35;
        const stickHeight = 8;
        const stickColor = "#5a3a1e"; // Slightly darker, less red
        const stickYOffset = 6; // How far sticks sit below the logical 'y'
        const logBaseY = y + stickYOffset;

        // Flame base properties
        const flameBaseWidth = stickWidth * 0.8; // Flames originate from log area
        const numFlames = 4; // Draw multiple distinct flame shapes

        // Flicker parameters
        const timeSlow = now * 0.0015; // Slower base time for flicker
        const heightMagnitude = 0.6; // How much height changes (%)
        const widthMagnitude = 0.3; // How much width changes (%)
        const curveMagnitude = 5;   // How much control points sway

        ctx.save();

        // 1. Draw Radial Glow (Vignette Style) on the ground first
        const glowRadius = baseRadius * 1.1; // Slightly larger than logical radius
        const glowPulse = Math.sin(now * 0.001) * 0.05; // Subtle pulse
        const currentGlowRadius = glowRadius * (1 + glowPulse);
        try {
            const gradient = ctx.createRadialGradient(x, logBaseY, 0, x, logBaseY, currentGlowRadius);
            gradient.addColorStop(0, `rgba(255, 165, 0, ${0.35 + glowPulse * 2})`); // Inner color pulses alpha slightly
            gradient.addColorStop(0.6, "rgba(255, 165, 0, 0.1)");
            gradient.addColorStop(1, "rgba(255, 165, 0, 0)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, logBaseY, currentGlowRadius, 0, Math.PI * 2);
            ctx.fill();
        } catch (e) { console.error("Failed to create campfire gradient:", e)}


        // 2. Draw Logs/Sticks (on top of glow)
        ctx.fillStyle = stickColor;
        ctx.translate(x, logBaseY); // Translate to base of logs
        // Draw two crossed logs slightly overlapping
        ctx.rotate(Math.PI / 6);
        ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
        // Add simple grain lines
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(-stickWidth/2 + 2, 0); ctx.lineTo(stickWidth/2 - 2, 0); ctx.stroke();
        ctx.rotate(-Math.PI / 6); // Rotate back

        ctx.rotate(-Math.PI / 5);
        ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
        // Add simple grain lines
        ctx.beginPath(); ctx.moveTo(-stickWidth/2 + 2, 0); ctx.lineTo(stickWidth/2 - 2, 0); ctx.stroke();
        ctx.rotate(Math.PI / 5); // Rotate back
        ctx.translate(-x, -logBaseY); // Reset translation


        // 3. Draw Flickering Flames (Using Curves)
        const flameColors = [
            { // Outer layer
                color: `rgba(255, 100, 0, ${0.5 + Math.sin(timeSlow * 1.1 + 1) * 0.1})`, // Orange-Red base
                baseHeight: 45,
                widthFactor: 1.0
            },
            { // Mid layer
                color: `rgba(255, 165, 0, ${0.6 + Math.sin(timeSlow * 0.9 + 2) * 0.15})`, // Orange-Yellow base
                baseHeight: 35,
                widthFactor: 0.7
            },
            { // Core layer
                color: `rgba(255, 255, 180, ${0.7 + Math.sin(timeSlow * 1.3 + 3) * 0.2})`, // Pale Yellow base
                baseHeight: 25,
                widthFactor: 0.4
            }
        ];

        for (let layer = 0; layer < flameColors.length; layer++) {
            const layerData = flameColors[layer];
            ctx.fillStyle = layerData.color;

            for (let i = 0; i < numFlames; i++) {
                // Base position offset for each flame instance
                const flameOffsetX = (i - (numFlames - 1) / 2) * (flameBaseWidth / numFlames) * 0.8;
                const uniqueTimeOffset = i * 1.57; // Use index for phase offset

                // Calculate dynamic properties for this flame instance
                const flickerHeight = Math.sin(timeSlow * (1.0 + i * 0.1) + uniqueTimeOffset) * heightMagnitude + 1.0; // Additive flicker + base 1.0
                const flickerWidth = Math.sin(timeSlow * (0.8 + i * 0.15) - uniqueTimeOffset) * widthMagnitude + 1.0;
                const currentHeight = layerData.baseHeight * flickerHeight * (1.0 - layer * 0.1); // Inner flames slightly shorter base
                const currentWidth = (flameBaseWidth * layerData.widthFactor * flickerWidth) / numFlames;

                // Control point sway - makes the flame curve and waver
                const swayX1 = Math.sin(timeSlow * 1.2 + uniqueTimeOffset + i) * curveMagnitude;
                const swayY1 = Math.sin(timeSlow * 1.4 + uniqueTimeOffset + i + 1) * curveMagnitude * 0.5; // Less Y sway
                const swayX2 = Math.sin(timeSlow * 1.3 - uniqueTimeOffset + i + 2) * curveMagnitude;
                const swayY2 = Math.sin(timeSlow * 1.5 - uniqueTimeOffset + i + 3) * curveMagnitude * 0.5;

                const startX = x + flameOffsetX;
                const startY = logBaseY - stickHeight / 2; // Start slightly above logs
                const tipY = startY - currentHeight;
                const midY1 = startY - currentHeight * 0.33;
                const midY2 = startY - currentHeight * 0.66;

                // Draw flame shape using bezier curve
                ctx.beginPath();
                ctx.moveTo(startX - currentWidth / 2, startY); // Bottom left corner
                // Curve up the left side
                ctx.bezierCurveTo(
                    startX - currentWidth / 2 + swayX1, midY2 + swayY1, // Control point 1
                    startX + swayX2, midY1 + swayY2,                   // Control point 2
                    startX, tipY                                       // Tip
                );
                // Curve down the right side
                ctx.bezierCurveTo(
                    startX - swayX2, midY1 + swayY2,                   // Control point 3 (mirrored sway)
                    startX + currentWidth / 2 - swayX1, midY2 + swayY1, // Control point 4 (mirrored sway)
                    startX + currentWidth / 2, startY                  // Bottom right corner
                );
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function drawDamageVignette(ctx, intensity, width, height) { if(intensity<=0) return; ctx.save(); const or=Math.sqrt(width**2+height**2)/2,g=ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,or),ra=0.4*intensity; g.addColorStop(0,'rgba(255,0,0,0)'); g.addColorStop(0.75,'rgba(255,0,0,0)'); g.addColorStop(1,`rgba(255,0,0,${ra.toFixed(2)})`); ctx.fillStyle=g; ctx.fillRect(0,0,width,height); ctx.restore(); }
    function drawTemperatureTint(ctx, temperature, width, height) { let tcs=null, a=0.0; const tfc=TEMP_FREEZING_CLIENT, tcc=TEMP_COLD_CLIENT, thc=TEMP_HOT_CLIENT, tsc=TEMP_SCORCHING_CLIENT, mta=MAX_TINT_ALPHA; if(temperature===null || typeof temperature === 'undefined'){ return; } if(temperature<=tfc){ tcs='rgba(100,150,255,A)'; a=mta*Math.min(1.0,(tfc-temperature+5)/5.0); } else if(temperature<=tcc){ tcs='rgba(150,180,255,A)'; a=mta*((tcc-temperature)/(tcc-tfc)); } else if(temperature>=tsc){ tcs='rgba(255,100,0,A)'; a=mta*Math.min(1.0,(temperature-tsc+5)/5.0); } else if(temperature>=thc){ tcs='rgba(255,150,50,A)'; a=mta*((temperature-thc)/(tsc-thc)); } a=Math.max(0,Math.min(mta,a)); if(tcs&&a>0.01){ ctx.globalAlpha=1.0; ctx.fillStyle=tcs.replace('A',a.toFixed(2)); ctx.fillRect(0,0,width,height); ctx.globalAlpha=1.0; } }
    function drawEnemySpeechBubbles(ctx, enemiesToRender, activeEnemyBubblesRef) { if(!activeEnemyBubblesRef) return; const now=performance.now(),bf='italic 11px '+fontFamily,cr=4,tp=3,bo=20; ctx.font=bf; ctx.textAlign='center'; ctx.textBaseline='bottom'; const etr=[]; for(const eid in activeEnemyBubblesRef){ const b=activeEnemyBubblesRef[eid]; if(now>=b.endTime){etr.push(eid);continue;} const e=enemiesToRender?.[eid]; if(e&&e.health>0){ const edx=e.x,edy=e.y,eh=e.height??40,by=edy-eh/2-bo,tm=ctx.measureText(b.text),tw=tm.width,bw=tw+tp*2,afh=11,bh=afh+tp*2,bx=edx-bw/2,bby=by-bh; ctx.fillStyle=enemySpeechBubbleBg; drawRoundedRect(ctx,bx,bby,bw,bh,cr); ctx.fill(); ctx.strokeStyle=enemySpeechBubbleOutline; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle=enemySpeechBubbleColor; ctx.fillText(b.text,edx,by-tp); } else {etr.push(eid);} } etr.forEach(id=>{ if (activeEnemyBubblesRef) delete activeEnemyBubblesRef[id]; }); }
    function drawSpeechBubbles(ctx, playersToRender, activeSpeechBubblesRef, appStateRef) { if(!activeSpeechBubblesRef || !appStateRef) return; const now=performance.now(),bf='bold 12px '+fontFamily,cr=5,tp=4,bo=30; ctx.font=bf; ctx.textAlign='center'; ctx.textBaseline='bottom'; const ptr=[]; for(const pid in activeSpeechBubblesRef){ const b=activeSpeechBubblesRef[pid]; if(now>=b.endTime){ptr.push(pid);continue;} const p=playersToRender?.[pid]; if(p&&p.player_status!=='dead'&&p.health>0){ const pdx=(pid===appStateRef.localPlayerId)?appStateRef.renderedPlayerPos.x:p.x,pdy=(pid===appStateRef.localPlayerId)?appStateRef.renderedPlayerPos.y:p.y,ph=p.height,by=pdy-ph/2-bo,tm=ctx.measureText(b.text),tw=tm.width,bw=tw+tp*2,afh=12,bh=afh+tp*2,bx=pdx-bw/2,bby=by-bh; ctx.fillStyle=playerSpeechBubbleBg; drawRoundedRect(ctx,bx,bby,bw,bh,cr); ctx.fill(); ctx.strokeStyle=playerSpeechBubbleOutline; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle=playerSpeechBubbleColor; ctx.fillText(b.text,pdx,by-tp); } else {ptr.push(pid);} } ptr.forEach(id=>{ if (activeSpeechBubblesRef) delete activeSpeechBubblesRef[id]; }); }
    function drawSnake(ctx, snakeRef) { if(!snakeRef||!snakeRef.isActiveFromServer||!snakeRef.segments||snakeRef.segments.length<2) return; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=snakeLineColor; ctx.lineWidth=snakeRef.lineWidth; ctx.beginPath(); ctx.moveTo(snakeRef.segments[snakeRef.segments.length-1].x,snakeRef.segments[snakeRef.segments.length-1].y); for(let i=snakeRef.segments.length-2;i>=1;i--){ const s=snakeRef.segments[i],ns=snakeRef.segments[i-1]; if(!s||!ns) continue; const xc=(s.x+ns.x)/2,yc=(s.y+ns.y)/2; ctx.quadraticCurveTo(s.x,s.y,xc,yc); } if(snakeRef.segments.length>0){ const h=snakeRef.segments[0]; if(snakeRef.segments.length>1){ const n=snakeRef.segments[1],xc=(n.x+h.x)/2,yc=(n.y+h.y)/2; ctx.quadraticCurveTo(n.x,n.y,xc,yc); } ctx.lineTo(h.x,h.y); } ctx.stroke(); }
    function drawHealthBar(ctx, x, y, width, currentHealth, maxHealth) { if(maxHealth<=0) return; const bh=5,yo=-(width/2+27),bw=Math.max(20,width*0.8),cw=Math.max(0,(currentHealth/maxHealth)*bw),hp=currentHealth/maxHealth,bx=x-bw/2,by=y+yo; ctx.fillStyle=healthBarBg; ctx.fillRect(bx,by,bw,bh); let bc=healthBarLow; if(hp>0.66) bc=healthBarHigh; else if(hp>0.33) bc=healthBarMedium; ctx.fillStyle=bc; ctx.fillRect(bx,by,cw,bh); }
    function drawArmorBar(ctx, x, y, width, currentArmor) { const ma=100; if(currentArmor<=0) return; const abh=4,hbh=5,bs=1,hbyo=-(width/2+27),hbty=y+hbyo,abty=hbty+hbh+bs,bw=Math.max(20,width*0.8),cw=Math.max(0,(currentArmor/ma)*bw),bx=x-bw/2,by=abty; ctx.fillStyle=healthBarBg; ctx.fillRect(bx,by,bw,abh); ctx.fillStyle=armorBarColor; ctx.fillRect(bx,by,cw,abh); }

    // --- Add near other color constants ---
    const enemyUniformBlue = "#18315f"; // Navy Blue for standard torso
    const enemyGiantRed = "#a00000";   // Red Coat for Giant

    // --- REVISED V3: drawEnemyRect (incorporating all feedback) ---
    function drawEnemyRect(ctx, x, y, w, h, type, enemyState) {
        const currentW = w;
        const currentH = h;
        const t = performance.now(); // Time for animations

        // Determine bobbing (only for standard enemies)
        const bobOffset = (type !== 'giant') ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;

        // --- Effect Checks ---
        const nowSeconds = t / 1000.0;
        const snakeEffect = enemyState?.effects?.snake_bite_slow;
        const isSnakeBitten = snakeEffect && typeof snakeEffect.expires_at === 'number' && nowSeconds < snakeEffect.expires_at;
        const isHitFlashing = enemyState?.hit_flash_this_tick ?? false;

        ctx.save(); // Save context at the start

        // ========================================
        // --- Giant Specific Drawing Logic ---
        // ========================================
        if (type === 'giant') {
            // Giant proportions (relative to its larger w/h)
            const bodyWidth = currentW * 0.85;
            const bodyHeight = currentH * 0.7;
            const bodyTopY = y - currentH * 0.4; // No bob offset for giant
            const bodyBottomY = bodyTopY + bodyHeight;

            const legHeight = currentH * 0.25;
            const legWidth = currentW * 0.2;
            const legSpacing = currentW * 0.2;
            const legTopY = bodyBottomY;

            const bootHeight = currentH * 0.1;
            const bootWidth = legWidth * 1.2;
            const bootTopY = legTopY + legHeight;

            const headRadius = currentW * 0.2;
            const headCenterY = bodyTopY - headRadius * 0.5;

            // Shako Hat properties
            const shakoHeight = headRadius * 1.5;
            const shakoWidth = headRadius * 1.8;
            const shakoBaseY = headCenterY - headRadius * 0.8;
            const shakoPeakHeight = shakoHeight * 0.2;
            const shakoPeakWidth = shakoWidth * 1.1;

            // 1. Draw Legs & Boots (Static, Large)
            ctx.fillStyle = enemyBootColor; // Dark trousers/legs part
            ctx.fillRect(x - legSpacing - legWidth / 2, legTopY, legWidth, legHeight); // Left
            ctx.fillRect(x + legSpacing - legWidth / 2, legTopY, legWidth, legHeight); // Right
            ctx.fillStyle = enemyBootColor; // Dark boots
            ctx.fillRect(x - legSpacing - bootWidth / 2, bootTopY, bootWidth, bootHeight); // Left
            ctx.fillRect(x + legSpacing - bootWidth / 2, bootTopY, bootWidth, bootHeight); // Right

            // 2. Draw Main Body (Red Coat)
            ctx.fillStyle = enemyGiantRed; // *** USE RED COAT COLOR ***
            ctx.fillRect(x - bodyWidth / 2, bodyTopY, bodyWidth, bodyHeight);
            // Belt
            ctx.fillStyle = beltColor;
            ctx.fillRect(x - bodyWidth / 2, bodyTopY + bodyHeight * 0.7, bodyWidth, bodyHeight * 0.08);

            // 3. Draw Arms (Simple Red Rects)
            ctx.fillStyle = enemyGiantRed; // Red sleeves
            const armWidth = currentW * 0.18;
            const armHeight = currentH * 0.5;
            const armOffsetY = bodyTopY + bodyHeight * 0.1;
            ctx.fillRect(x - bodyWidth / 2 - armWidth, armOffsetY, armWidth, armHeight); // Left
            ctx.fillRect(x + bodyWidth / 2, armOffsetY, armWidth, armHeight);          // Right

            // 4. Draw Head
            ctx.fillStyle = enemySkinColor;
            ctx.beginPath();
            ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
            ctx.fill();

            // --- NEW: Giant Facial Features ---
            // Beard (Simple dark shape below head center)
            const beardWidth = headRadius * 1.6;
            const beardHeight = headRadius * 1.0;
            const beardTopY = headCenterY + headRadius * 0.2;
            ctx.fillStyle = enemyCapColor; // Use hat color for beard
            ctx.fillRect(x - beardWidth / 2, beardTopY, beardWidth, beardHeight);
            // Angry Eyebrows (Thicker and lower than standard enemy)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3; // Thicker brows
            ctx.beginPath();
            const giantBrowLength = headRadius * 0.7;
            const giantBrowY = headCenterY - headRadius * 0.4; // Lower on face
            const giantBrowXOffset = headRadius * 0.4;
            // Steeper angle for anger
            ctx.moveTo(x - giantBrowXOffset - giantBrowLength / 2, giantBrowY + giantBrowLength / 4); // Inner point lower
            ctx.lineTo(x - giantBrowXOffset + giantBrowLength / 2, giantBrowY - giantBrowLength / 4); // Outer point higher
            ctx.moveTo(x + giantBrowXOffset - giantBrowLength / 2, giantBrowY - giantBrowLength / 4); // Inner point higher
            ctx.lineTo(x + giantBrowXOffset + giantBrowLength / 2, giantBrowY + giantBrowLength / 4); // Outer point lower
            ctx.stroke();
            // --- End Giant Facial Features ---

            // 5. Draw Shako Hat
            ctx.fillStyle = enemyCapColor; // Black base
            ctx.fillRect(x - shakoWidth / 2, shakoBaseY - shakoHeight, shakoWidth, shakoHeight); // Cylinder
            ctx.beginPath(); // Peak/Brim
            ctx.moveTo(x - shakoPeakWidth / 2, shakoBaseY);
            ctx.lineTo(x + shakoPeakWidth / 2, shakoBaseY);
            ctx.lineTo(x + shakoWidth / 2, shakoBaseY - shakoPeakHeight);
            ctx.lineTo(x - shakoWidth / 2, shakoBaseY - shakoPeakHeight);
            ctx.closePath();
            ctx.fill();

        }
        // =================================================
        // --- Standard Enemy Drawing (Chaser/Shooter) ---
        // =================================================
        else {
            // Proportions
            const headRadius = currentH * 0.16;
            const coatShoulderWidth = currentW * 1.1; // Brown coat layer width at top
            const coatHemWidth = currentW * 0.9;      // Brown coat layer width at bottom
            const torsoShoulderWidth = currentW * 0.9; // Blue torso layer width at top
            const torsoHemWidth = currentW * 0.7;     // Blue torso layer width at bottom

            // Y positions use bobOffset
            const coatTopY = y - currentH * 0.35 + bobOffset;
            const coatBottomY = y + currentH * 0.25 + bobOffset;
            const coatHeight = coatBottomY - coatTopY;
            const headCenterY = coatTopY - headRadius * 0.6; // Adjusted head Y

            const armWidth = currentW * 0.2;
            const armHeight = currentH * 0.45;
            const armOffsetY = coatTopY + coatHeight * 0.1;

            const trouserHeight = currentH * 0.20;
            const trouserWidth = currentW * 0.25;
            const trouserTopY = coatBottomY; // Trousers start below coat hem
            const legSpacing = currentW * 0.15;

            const bootHeight = currentH * 0.12;
            const bootWidth = currentW * 0.30;
            const bootTopY = trouserTopY + trouserHeight;

            // Hat properties (Slouch Hat - Wider & Higher)
            const hatBrimWidth = headRadius * 3.5; // Wider brim
            const hatBrimHeight = headRadius * 0.6; // Thicker brim
            const hatCrownRadiusH = headRadius * 1.5; // Wider crown
            const hatCrownRadiusV = headRadius * 1.1; // Taller crown
            const hatCenterY = headCenterY - headRadius * 1.0; // Higher on head

            // Animation state for boots
            const stepCycle = 400;
            const stepPhase = Math.floor(t / stepCycle) % 2;

            // --- Draw Layers: Back to Front ---

            // 1. Draw Trousers & Animated Boots FIRST (Furthest back)
            ctx.fillStyle = enemyBootColor; // Dark trousers
            const leftLegX = x - legSpacing;
            ctx.fillRect(leftLegX - trouserWidth / 2, trouserTopY, trouserWidth, trouserHeight);
            const rightLegX = x + legSpacing;
            ctx.fillRect(rightLegX - trouserWidth / 2, trouserTopY, trouserWidth, trouserHeight);

            ctx.fillStyle = enemyBootColor; // Dark boots
            if (stepPhase === 0) { // Left foot forward animation
                ctx.fillRect(leftLegX - bootWidth / 2, bootTopY - 2, bootWidth, bootHeight);
                ctx.fillRect(rightLegX - bootWidth / 2, bootTopY, bootWidth, bootHeight);
            } else { // Right foot forward animation
                ctx.fillRect(leftLegX - bootWidth / 2, bootTopY, bootWidth, bootHeight);
                ctx.fillRect(rightLegX - bootWidth / 2, bootTopY - 2, bootWidth, bootHeight);
            }

            // 2. Draw Brown Base Coat Layer (Underneath blue torso)
            ctx.fillStyle = enemyCoatColor; // Brown coat
            ctx.beginPath();
            ctx.moveTo(x - coatShoulderWidth / 2, coatTopY); // Top left wide
            ctx.lineTo(x + coatShoulderWidth / 2, coatTopY); // Top right wide
            ctx.lineTo(x + coatHemWidth / 2, coatBottomY);   // Bottom right narrow
            ctx.lineTo(x - coatHemWidth / 2, coatBottomY);   // Bottom left narrow
            ctx.closePath();
            ctx.fill();

            // 3. Draw Brown Arms (Over brown coat, under blue torso)
            ctx.fillStyle = enemyCoatColor;
            ctx.fillRect(x - coatShoulderWidth * 0.45 - armWidth / 2, armOffsetY, armWidth, armHeight); // Left Arm
            ctx.fillRect(x + coatShoulderWidth * 0.45 - armWidth / 2, armOffsetY, armWidth, armHeight); // Right Arm

            // 4. Draw Blue Torso Layer (Over brown coat/arms)
            ctx.fillStyle = enemyUniformBlue; // *** USE NAVY BLUE ***
            ctx.beginPath();
            ctx.moveTo(x - torsoShoulderWidth / 2, coatTopY);   // Top left (narrower than coat)
            ctx.lineTo(x + torsoShoulderWidth / 2, coatTopY);   // Top right
            ctx.lineTo(x + torsoHemWidth / 2, coatBottomY);     // Bottom right (narrower than coat)
            ctx.lineTo(x - torsoHemWidth / 2, coatBottomY);     // Bottom left
            ctx.closePath();
            ctx.fill();

            // 5. Draw Head
            ctx.fillStyle = enemySkinColor;
            ctx.beginPath();
            ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
            ctx.fill();

            // 6. Draw Angry Eyebrows
            ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.beginPath();
            const browLength = headRadius * 0.5;
            const browY = headCenterY - headRadius * 0.3;
            const browXOffset = headRadius * 0.3;
            ctx.moveTo(x - browXOffset - browLength / 2, browY - browLength / 3); // Left \
            ctx.lineTo(x - browXOffset + browLength / 2, browY + browLength / 3);
            ctx.moveTo(x + browXOffset - browLength / 2, browY + browLength / 3); // Right /
            ctx.lineTo(x + browXOffset + browLength / 2, browY - browLength / 3);
            ctx.stroke();

            // 7. Draw Hat (Slouch Hat - Wider & Higher)
            ctx.fillStyle = enemyCapColor; // Dark hat color
            ctx.beginPath(); // Brim
            ctx.ellipse(x, hatCenterY + hatCrownRadiusV * 0.7, hatBrimWidth / 2, hatBrimHeight / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath(); // Crown
            ctx.ellipse(x, hatCenterY, hatCrownRadiusH / 2, hatCrownRadiusV, 0, 0, Math.PI * 2);
            ctx.fill();

            // 8. Conditionally Draw Gun for Shooters (Over torso/arms)
            if (type === 'shooter') {
                const gunBarrelLength = w * 1.2; const gunBarrelThickness = 3;
                const gunStockLength = w * 0.5; const gunStockThickness = 5;
                const gunColorBarrel = "#555555"; const gunColorStock = "#7a4a2a";
                ctx.save();
                const gunAngle = Math.PI / 10;
                const gunCenterY = y + bobOffset; const gunCenterX = x; // Position relative to bobbing center
                ctx.translate(gunCenterX, gunCenterY); ctx.rotate(gunAngle);
                ctx.fillStyle = gunColorStock;
                ctx.fillRect(-gunStockLength * 0.8, -gunStockThickness / 2, gunStockLength, gunStockThickness);
                ctx.fillStyle = gunColorBarrel;
                ctx.fillRect(-gunStockLength * 0.2, -gunBarrelThickness / 2, gunBarrelLength, gunBarrelThickness);
                ctx.restore();
            }
        } // --- End Standard Enemy Drawing ---


        // ===============================================
        // --- Draw Effects Over Everything (Common) ---
        // ===============================================

        // Snake Bite Aura (Circular, Pulsing)
        if (isSnakeBitten) {
            const auraRadius = Math.max(currentW * 0.6, 15);
            // Aura Y position accounts for bob only on standard enemies
            const auraBaseY = y + currentH * 0.45 + ((type !== 'giant') ? bobOffset : 0); // Adjusted base Y slightly higher
            const auraLineWidth = 3;
            const auraColor = "rgba(0, 255, 50, 0.7)";
            const pulseSpeed = 0.004; const pulseMagnitude = 2;
            const pulseOffset = Math.sin(t * pulseSpeed) * pulseMagnitude;

            const originalLineWidth = ctx.lineWidth; const originalStrokeStyle = ctx.strokeStyle;
            ctx.lineWidth = auraLineWidth; ctx.strokeStyle = auraColor;
            ctx.beginPath(); ctx.arc(x, auraBaseY, auraRadius + pulseOffset, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = originalLineWidth; ctx.strokeStyle = originalStrokeStyle;
        }

        // Hit Flash
        if (isHitFlashing) {
            ctx.fillStyle = enemyHitFlashColor; const fm = 2;
            // Flash Y center accounts for bob only on standard enemies
            const flashYCenter = y + ((type !== 'giant') ? bobOffset : 0);
            ctx.fillRect(x - currentW / 2 - fm, flashYCenter - currentH / 2 - fm, currentW + fm * 2, currentH + fm * 2);
        }

        ctx.restore(); // Restore context from the very start
    }

    function drawPlayerCharacter( ctx, x, y, w, h, isSelf, playerState, aimDx, aimDy, pushbackAnimState ) {
        const jh = playerState?.hit_flash_this_tick ?? false; // Just Hit flag
        const t = performance.now();
        const now = t; // Use 'now' consistently with how pushbackAnimState is checked
        const ii = (playerState?.input_vector?.dx ?? 0) === 0 && (playerState?.input_vector?.dy ?? 0) === 0; // Is Idle
        const bo = ii ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0; // Idle bob offset

        // Player snake bite effect check
        const playerSnakeEffect = playerState?.effects?.snake_bite_slow;
        const isPlayerBitten = playerSnakeEffect && typeof playerSnakeEffect === 'object' &&
                            typeof playerSnakeEffect.expires_at === 'number' &&
                            now < (playerSnakeEffect.expires_at * 1000);

        // --- Refined Dimension Calculations ---
        // Proportions (adjust as needed)
        const headHeight = h * 0.28;
        const headWidth = w * 0.9;
        const neckHeight = h * 0.05;
        const torsoHeight = h * 0.35;
        const torsoUpperWidth = w * 0.95;
        const torsoLowerWidth = w * 0.8;
        const beltHeight = h * 0.06;
        const legHeight = h * 0.32; // Remaining height for legs
        const legUpperWidth = w * 0.4;
        const legLowerWidth = w * 0.3;
        const bootShaftHeight = h * 0.10; // Part covering ankle
        const bootSoleHeight = h * 0.04;
        const bootWidth = w * 0.35;
        const armWidth = w * 0.22;
        const armLength = h * 0.42;
        const shoulderPadRadius = w * 0.3;

        // Y Positions (Top Down) - Incorporating Bob Offset
        const headTopY = y - h * 0.5 + bo; // Top of the helmet
        const headBottomY = headTopY + headHeight;
        const neckTopY = headBottomY;
        const neckBottomY = neckTopY + neckHeight;
        const torsoTopY = neckBottomY;
        const torsoBottomY = torsoTopY + torsoHeight;
        const beltTopY = torsoBottomY - beltHeight * 0.3; // Belt slightly overlaps torso bottom
        const beltBottomY = beltTopY + beltHeight;
        const legTopY = beltBottomY - beltHeight * 0.2; // Legs start slightly under belt overlap
        const legBottomY = legTopY + legHeight;
        const bootTopY = legBottomY - bootShaftHeight * 0.1; // Boots start slightly above leg bottom
        const bootShaftBottomY = bootTopY + bootShaftHeight;
        const bootSoleTopY = bootShaftBottomY;
        const bootBottomY = bootSoleTopY + bootSoleHeight; // Absolute bottom

        // Arm/Shoulder Positions
        const shoulderCenterY = torsoTopY + torsoHeight * 0.15;
        const shoulderOffsetX = torsoUpperWidth * 0.5; // Relative to player X center
        const armTopY = shoulderCenterY + shoulderPadRadius * 0.3; // Arms start under pads

        // Colors (assuming these vars exist from earlier in the file)
        const playerBodyColor = isSelf ? dustyPlayerSelfColor : dustyPlayerOtherColor; // Base fabric color
        const helmetColor = ironHelmetColor; // Defined earlier
        const armorColor = simpleChestPlateColor; // Defined earlier
        const armorHighlight = chestPlateHighlight; // Defined earlier
        const armorShadow = ironHelmetShadow; // Reuse for consistency
        const slitColor = '#000000'; // Keep black
        const beltColor = '#412a19'; // Existing belt color
        const beltBuckleColor = '#b0a080'; // Dull metallic
        const bootColor = '#241c1c'; // Existing boot color
        const bootSoleColor = '#1a1a1a'; // Darker sole

        ctx.save(); // Save context state before drawing player

        // --- 1. Draw Shadow ---
        ctx.beginPath();
        // Use the calculated bootBottomY variable for shadow placement
        ctx.ellipse(x, bootBottomY + 2, w * 0.5, h * 0.06, 0, 0, Math.PI * 2);
        ctx.fillStyle = backgroundShadowColor; // Defined earlier
        ctx.fill();

        // --- Helper Function for Boots --- (Reduces repetition)
        const drawBoot = (bootX, bootTopYCoord, isKick = false, kickAngle = 0) => {
            ctx.save();
            if (isKick) {
                ctx.translate(bootX, bootTopYCoord); // Translate to pivot point (ankle area)
                ctx.rotate(kickAngle);
                 // Adjust Y because rotation is around the top of the boot now
                bootTopYCoord = 0;
            }

            const shaftTopY = bootTopYCoord;
            const shaftBottomY = shaftTopY + bootShaftHeight;
            const soleTopY = shaftBottomY;
            const soleBottomY = soleTopY + bootSoleHeight;

            // Boot Shaft
            ctx.fillStyle = bootColor;
            ctx.fillRect(bootX - bootWidth / 2, shaftTopY, bootWidth, bootShaftHeight);
            // Boot Sole (slightly wider)
            ctx.fillStyle = bootSoleColor;
            const soleWidth = bootWidth * 1.05;
            ctx.fillRect(bootX - soleWidth / 2, soleTopY, soleWidth, bootSoleHeight);
            // Subtle Heel
            ctx.fillStyle = bootSoleColor;
            const heelWidth = bootWidth * 0.6;
            const heelHeight = bootSoleHeight * 0.8;
            ctx.fillRect(bootX - heelWidth*0.1 , soleBottomY - heelHeight, heelWidth, heelHeight); // Offset heel slightly back

            if (isKick) {
                ctx.restore(); // Restore rotation and translation
            }
        };

        // --- 2. Draw Legs & Boots (Conditional Animation) ---
        const isPushbackAnimating = pushbackAnimState?.active && now < pushbackAnimState?.endTime;

        ctx.fillStyle = playerBodyColor; // Trouser color

        if (isPushbackAnimating) {
            // --- Pushback Animation Pose ---
            const kickAngle = -Math.PI / 4.5; // More dynamic kick angle
            const supportLegX = x + w * 0.15; // Supporting leg further back
            const kickLegX = x - w * 0.15; // Kicking leg pivot point
            const kickLegVisualLength = legHeight * 1.05; // Slightly extend kicking leg visually

            // Draw Supporting Leg (Tapered)
            ctx.beginPath();
            ctx.moveTo(supportLegX - legUpperWidth / 2, legTopY); // Top Left
            ctx.lineTo(supportLegX + legUpperWidth / 2, legTopY); // Top Right
            ctx.lineTo(supportLegX + legLowerWidth / 2, legBottomY); // Bottom Right
            ctx.lineTo(supportLegX - legLowerWidth / 2, legBottomY); // Bottom Left
            ctx.closePath();
            ctx.fill();
            drawBoot(supportLegX, bootTopY); // Supporting boot

            // Draw Kicking Leg (Rotated) - Draw trouser then boot
            ctx.save();
            ctx.translate(kickLegX, legTopY + legHeight * 0.1); // Pivot higher up near hip
            ctx.rotate(kickAngle);
            // Rotated Tapered Trouser
            ctx.fillStyle = playerBodyColor;
            ctx.beginPath();
            ctx.moveTo(-legUpperWidth / 2, 0); // Top Left at pivot
            ctx.lineTo(legUpperWidth / 2, 0); // Top Right at pivot
            ctx.lineTo(legLowerWidth / 2, kickLegVisualLength); // Bottom Right further out
            ctx.lineTo(-legLowerWidth / 2, kickLegVisualLength); // Bottom Left further out
            ctx.closePath();
            ctx.fill();
            ctx.restore(); // Restore rotation to draw boot correctly positioned relative to leg end

            // Draw Kicking Boot (Needs calculated position after rotation)
            // Calculate end point of the rotated leg centerline to position the boot
             const kickEndX = kickLegX + Math.sin(kickAngle) * kickLegVisualLength; // Use sin for X displacement from vertical kick
             const kickEndY = (legTopY + legHeight * 0.1) + Math.cos(kickAngle) * kickLegVisualLength; // Use cos for Y displacement from pivot
            drawBoot(kickEndX, kickEndY - bootShaftHeight, false); // Draw boot at the end point

        } else {
            // --- Standard Walking/Idle Animation ---
            const leftLegX = x - w * 0.2;
            const rightLegX = x + w * 0.2;
            let leftBootYOffset = 0;
            let rightBootYOffset = 0;

            if (!ii) { // Walking animation - subtle foot lift
                const walkCycleTime = 400; // ms per step cycle
                const phase = (t % walkCycleTime) / walkCycleTime; // 0 to 1
                const liftAmount = -2; // How high foot lifts
                if (phase < 0.5) { // Left foot lifts
                    leftBootYOffset = Math.sin(phase * 2 * Math.PI) * liftAmount;
                } else { // Right foot lifts
                    rightBootYOffset = Math.sin((phase - 0.5) * 2 * Math.PI) * liftAmount;
                }
            }

            // Left Leg (Tapered)
            ctx.beginPath();
            ctx.moveTo(leftLegX - legUpperWidth / 2, legTopY); ctx.lineTo(leftLegX + legUpperWidth / 2, legTopY);
            ctx.lineTo(leftLegX + legLowerWidth / 2, legBottomY); ctx.lineTo(leftLegX - legLowerWidth / 2, legBottomY);
            ctx.closePath(); ctx.fill();
            drawBoot(leftLegX, bootTopY + leftBootYOffset); // Left boot with walk offset

            // Right Leg (Tapered)
            ctx.beginPath();
            ctx.moveTo(rightLegX - legUpperWidth / 2, legTopY); ctx.lineTo(rightLegX + legUpperWidth / 2, legTopY);
            ctx.lineTo(rightLegX + legLowerWidth / 2, legBottomY); ctx.lineTo(rightLegX - legLowerWidth / 2, legBottomY);
            ctx.closePath(); ctx.fill();
            drawBoot(rightLegX, bootTopY + rightBootYOffset); // Right boot with walk offset
        }

        // --- 3. Draw Base Torso --- (Under armor)
        ctx.fillStyle = playerBodyColor;
        ctx.beginPath();
        ctx.moveTo(x - torsoUpperWidth / 2, torsoTopY); // Top Left
        ctx.lineTo(x + torsoUpperWidth / 2, torsoTopY); // Top Right
        ctx.lineTo(x + torsoLowerWidth / 2, torsoBottomY); // Bottom Right (tapered)
        ctx.lineTo(x - torsoLowerWidth / 2, torsoBottomY); // Bottom Left (tapered)
        ctx.closePath();
        ctx.fill();

        // --- 4. Draw Arms --- (Slight Taper)
        const armPitXLeft = x - torsoUpperWidth * 0.45;
        const armPitXRight = x + torsoUpperWidth * 0.45;
        const wristXLeft = x - (torsoUpperWidth * 0.45 + armWidth * 0.3); // Slightly narrower wrist
        const wristXRight = x + (torsoUpperWidth * 0.45 + armWidth * 0.3);
        const armBottomY = armTopY + armLength;

        // Left Arm
        ctx.beginPath();
        ctx.moveTo(armPitXLeft, armTopY); ctx.lineTo(armPitXLeft + armWidth, armTopY); // Top edge
        ctx.lineTo(wristXRight - armWidth, armBottomY); ctx.lineTo(wristXLeft, armBottomY); // Bottom edge (tapered)
        ctx.closePath(); ctx.fill();
        // Right Arm
        ctx.beginPath();
        ctx.moveTo(armPitXRight - armWidth, armTopY); ctx.lineTo(armPitXRight, armTopY); // Top edge
        ctx.lineTo(wristXRight, armBottomY); ctx.lineTo(wristXRight - armWidth * 0.7, armBottomY); // Bottom edge (tapered) - Adjust taper if needed
        ctx.closePath(); ctx.fill();


        // --- 5. Draw Belt and Buckle ---
        ctx.fillStyle = beltColor;
        ctx.fillRect(x - torsoLowerWidth * 0.55, beltTopY, torsoLowerWidth * 1.1, beltHeight); // Belt slightly wider than torso bottom
        // Buckle
        ctx.fillStyle = beltBuckleColor;
        const buckleWidth = w * 0.25;
        const buckleHeight = beltHeight * 0.8;
        ctx.fillRect(x - buckleWidth / 2, beltTopY + (beltHeight - buckleHeight) / 2, buckleWidth, buckleHeight);
        // Buckle Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x - buckleWidth / 2 + 2, beltTopY + (beltHeight - buckleHeight) / 2 + 2, buckleWidth - 4, 2);

        // --- 6. Draw Chest Plate --- (Shaped)
        const plateWidth = torsoUpperWidth * 0.9;
        const plateHeight = torsoHeight * 0.9;
        const plateTopY = torsoTopY + torsoHeight * 0.05;
        const plateBottomY = plateTopY + plateHeight;
        ctx.fillStyle = armorColor;
        ctx.beginPath();
        ctx.moveTo(x - plateWidth / 2, plateTopY); // Top Left
        ctx.lineTo(x + plateWidth / 2, plateTopY); // Top Right
        ctx.lineTo(x + plateWidth * 0.4, plateBottomY); // Bottom Right Angled
        ctx.lineTo(x - plateWidth * 0.4, plateBottomY); // Bottom Left Angled
        ctx.closePath();
        ctx.fill();
        // Highlight / Shadow
        ctx.fillStyle = armorHighlight;
        ctx.fillRect(x - plateWidth / 2 + 4, plateTopY + 4, plateWidth - 8, 3); // Top Highlight
        ctx.fillStyle = armorShadow;
        ctx.fillRect(x - plateWidth / 2 + 5, plateTopY + 7, plateWidth - 10, 2); // Shadow below


        // --- 7. Draw Shoulder Pauldrons --- (Rounded)
        ctx.fillStyle = armorColor;
        // Left Pauldron
        ctx.beginPath();
        ctx.arc(x - shoulderOffsetX, shoulderCenterY, shoulderPadRadius, Math.PI * 1.1, Math.PI * 1.9); // Upper arc
        ctx.closePath(); // Close path to fill correctly
        ctx.fill();
         ctx.fillStyle = armorHighlight; // Highlight
        ctx.beginPath();
        ctx.arc(x - shoulderOffsetX, shoulderCenterY -2, shoulderPadRadius * 0.8, Math.PI * 1.2, Math.PI * 1.8);
        ctx.arc(x - shoulderOffsetX, shoulderCenterY, shoulderPadRadius * 0.9, Math.PI * 1.8, Math.PI * 1.2, true); // Inner arc slight offset
        ctx.closePath();
        ctx.fill();


        // Right Pauldron
        ctx.fillStyle = armorColor;
        ctx.beginPath();
        ctx.arc(x + shoulderOffsetX, shoulderCenterY, shoulderPadRadius, Math.PI * 0.1, Math.PI * 0.9, true); // Flipped arc
         ctx.closePath();
        ctx.fill();
        ctx.fillStyle = armorHighlight; // Highlight
        ctx.beginPath();
        ctx.arc(x + shoulderOffsetX, shoulderCenterY - 2, shoulderPadRadius*0.8, Math.PI * 0.2, Math.PI*0.8, true);
        ctx.arc(x + shoulderOffsetX, shoulderCenterY, shoulderPadRadius*0.9, Math.PI * 0.8, Math.PI*0.2, false);
        ctx.closePath();
        ctx.fill();


        // --- 8. Draw Helmet --- (Refined Bucket)
        // Main Bucket
        ctx.fillStyle = helmetColor;
        ctx.fillRect(x - headWidth / 2, headTopY, headWidth, headHeight);
        // Rounded Top Edge
        const curveRadius = headWidth * 0.1;
        ctx.beginPath();
        ctx.moveTo(x - headWidth / 2, headTopY + curveRadius);
        ctx.lineTo(x - headWidth / 2, headTopY);
        ctx.lineTo(x + headWidth / 2, headTopY);
        ctx.lineTo(x + headWidth / 2, headTopY + curveRadius);
        ctx.arcTo(x + headWidth/2, headTopY, x + headWidth/2 - curveRadius, headTopY, curveRadius); // Top right corner
        ctx.arcTo(x - headWidth/2, headTopY, x - headWidth/2, headTopY + curveRadius, curveRadius); // Top left corner
        ctx.fill(); // Fill the rounded top part

        // Neck Guard part (below main bucket)
        ctx.fillStyle = helmetColor;
        ctx.fillRect(x - headWidth * 0.4, headBottomY - neckHeight * 0.5, headWidth * 0.8, neckHeight * 1.2);

        // Highlights / Rivets
        ctx.fillStyle = armorHighlight;
        ctx.fillRect(x - headWidth / 2 + 3, headTopY + 3, headWidth - 6, 2); // Top highlight line
        // Rivets
        const rivetRadius = 1.5;
        ctx.beginPath(); ctx.arc(x - headWidth * 0.4, headBottomY - neckHeight*0.2, rivetRadius, 0, Math.PI*2); ctx.fill(); // Left rivet
        ctx.beginPath(); ctx.arc(x + headWidth * 0.4, headBottomY - neckHeight*0.2, rivetRadius, 0, Math.PI*2); ctx.fill(); // Right rivet
        ctx.beginPath(); ctx.arc(x, headTopY + headHeight * 0.85, rivetRadius, 0, Math.PI*2); ctx.fill(); // Forehead rivet?

        // Eye Slit
        ctx.fillStyle = slitColor;
        const slitHeight = headHeight * 0.12;
        const slitWidth = headWidth * 0.8;
        const slitY = headTopY + headHeight * 0.45;
        ctx.fillRect(x - slitWidth / 2, slitY, slitWidth, slitHeight);


        // --- 9. Draw Gun --- (Conditional based on aim or pushback)
         // (Using the previously corrected logic)
        let shouldDrawGun = false;
        let gunDrawAngle = 0;
        let gunDrawMode = 'aiming'; // 'aiming' or 'pushback'

        if (isPushbackAnimating) {
            shouldDrawGun = true;
            gunDrawMode = 'pushback';
            gunDrawAngle = -Math.PI / 2; // Straight out right during pushback kick
        } else if (isSelf && (aimDx !== 0 || aimDy !== 0)) {
            shouldDrawGun = true;
            gunDrawMode = 'aiming';
            gunDrawAngle = Math.atan2(aimDy, aimDx);
        }

        if (shouldDrawGun) {
            const gunLevel = playerState?.gun ?? 1;
            const baseBarrelLength = 18;
            const barrelLengthIncrease = 2;
            const barrelLength = baseBarrelLength + (gunLevel - 1) * barrelLengthIncrease;
            const barrelThickness = 3 + (gunLevel - 1) * 0.2;
            const stockLength = 8 + (gunLevel - 1) * 0.5;
            const stockThickness = 5 + (gunLevel - 1) * 0.3;
            const stockColor = "#8B4513";
            const barrelColor = "#444444";

            const gunOriginYOffset = armTopY + armLength * 0.4; // Relative Y position for gun pivot
            const gunOriginXOffset = (gunDrawMode === 'pushback') ? w * 0.05 : w * 0.1; // Adjust X pivot slightly

            ctx.save();
            ctx.translate(x + gunOriginXOffset, gunOriginYOffset);
            ctx.rotate(gunDrawAngle);
            ctx.fillStyle = stockColor;
            ctx.fillRect(-stockLength - 2, -stockThickness / 2, stockLength, stockThickness);
            ctx.fillStyle = barrelColor;
            ctx.fillRect(0, -barrelThickness / 2, barrelLength, barrelThickness);
            ctx.restore();
        }

        // --- 10. Draw Effects ---

        // Snake Bite Particles (Using the previously added code)
        if (isPlayerBitten) {
            const footY = bootBottomY; // Use calculated boot bottom
            const numParticles = 8;
            const particleBaseSize = 4;
            const particleSpeedY = -60;
            const particleLifetimeMs = 600;

            ctx.save(); // Already saved at function start, maybe not needed? Check balancing.
            for (let i = 0; i < numParticles; i++) {
                const effectStartTime = (playerSnakeEffect.expires_at * 1000) - (SNAKE_BITE_DURATION * 1000);
                const timeSinceEffectStart = Math.max(0, now - effectStartTime);
                const particleSimulatedAge = (timeSinceEffectStart + (particleLifetimeMs / numParticles) * i) % particleLifetimeMs;
                const particleProgress = particleSimulatedAge / particleLifetimeMs;

                if (particleProgress < 0 || particleProgress >= 1) continue;

                const particleX = x + (Math.random() - 0.5) * w * 0.7;
                const particleY = footY + (particleSpeedY * (particleSimulatedAge / 1000));
                const particleSize = particleBaseSize * (1.0 - particleProgress * 0.5) * (0.8 + Math.random() * 0.4);
                const alpha = 0.8 * (1.0 - particleProgress) * (0.7 + Math.random() * 0.3);
                const green = 180 + Math.floor(75 * particleProgress);
                const yellow = 200 * (1.0 - particleProgress);
                ctx.fillStyle = `rgba(${Math.floor(yellow)}, ${green}, 50, ${alpha.toFixed(2)})`;
                ctx.fillRect(particleX - particleSize / 2, particleY - particleSize / 2, particleSize, particleSize);
            }
            ctx.restore(); // Balance the save for particles
        }

        // Hit Sparks (Using the previously added code)
        if (jh) {
            ctx.save();
            const numSparks = 15 + Math.random() * 10;
             const sparkColors = [ // Re-declare here or make global if used elsewhere often
                "rgba(255, 100, 0, 0.8)",
                "rgba(255, 165, 0, 0.9)",
                "rgba(255, 220, 50, 0.7)",
            ];
            for (let i = 0; i < numSparks; i++) {
                const sparkAngle = Math.random() * Math.PI * 2;
                const sparkRadius = Math.random() * w * 0.8 + w * 0.2;
                // Sparks centered roughly on torso/head area
                const sparkX = x + Math.cos(sparkAngle) * sparkRadius;
                const sparkY = y + Math.sin(sparkAngle) * sparkRadius * 0.7 - h * 0.1 + bo; // Use bob offset
                const sparkSize = Math.random() * 3.5 + 1.5;
                ctx.fillStyle = sparkColors[Math.floor(Math.random() * sparkColors.length)];
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, sparkSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }


        ctx.restore(); // Restore context state from the very start of the function
    }

    function drawPlayers(ctx, players, appStateRef, localPlayerMuzzleFlashRef, localPlayerPushbackAnimStateRef) {
        if(!players || !appStateRef) return;
        Object.values(players).forEach(p=>{
            if(!p||p.player_status==='dead') return;
            const is=p.id===appStateRef.localPlayerId;
            const ps=p.player_status||'alive';
            const dx=is?appStateRef.renderedPlayerPos.x:p.x;
            const dy=is?appStateRef.renderedPlayerPos.y:p.y;
            const w=p.width??20; // Use player default width from server/constants
            const h=p.height??48;// Use player default height from server/constants
            const mh=p.max_health??100;
            const ca=p.armor??0;
            const id=(ps==='down'); // isDown flag

            // Set alpha based on player status (down or alive)
            const a=id?0.4:1.0;
            ctx.save(); // Save before applying alpha
            ctx.globalAlpha=a; // Apply alpha for drawing the player character

            // --- Shadow drawing is REMOVED from here - Handled inside drawPlayerCharacter ---

            // Get aim direction and pushback state ONLY for the local player
            const adx=is?localPlayerMuzzleFlashRef?.aimDx:0;
            const ady=is?localPlayerMuzzleFlashRef?.aimDy:0;
            const pushbackState = is ? localPlayerPushbackAnimStateRef : null;

            // Call the (refactored V2) function to draw the actual character
            // This function now draws its own shadow internally
            drawPlayerCharacter(ctx, dx, dy, w, h, is, p, adx, ady, pushbackState);

            ctx.restore(); // Restore alpha setting

            // Draw UI elements (health/armor) on top, unaffected by the alpha change
            if(ps==='alive'){
                drawHealthBar(ctx, dx, dy, w, p.health, mh);
                if(ca > 0) drawArmorBar(ctx, dx, dy, w, ca);
            }
        });
    }

    function drawEnemies(ctx, enemies, activeEnemyBubblesRef) { if(!enemies) return; const now=performance.now()/1000,fd=0.3; Object.values(enemies).forEach(e=>{ if(!e) return; const w=e.width??20,h=e.height??40,mh=e.max_health??50; let a=1.0,sd=true,id=false; if(e.health<=0&&e.death_timestamp){ id=true; const el=now-e.death_timestamp; if(el<fd) a=0.4; else sd=false; } if(sd){ ctx.save(); ctx.globalAlpha=a; drawEnemyRect(ctx,e.x,e.y,w,h,e.type,e); ctx.restore(); } if(!id&&e.health>0&&sd){ drawHealthBar(ctx,e.x,e.y,w,e.health,mh); } }); }


    function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy) {
        // Original Radii: outerBase=18, outerVar=6, innerBase=7, innerVar=3
        // Reduced Radii (approx 50%):
        const numPoints = 5;
        const outerRadiusBase = 9;      // Reduced from 18
        const outerRadiusVariance = 3;  // Reduced from 6
        const innerRadiusBase = 4;      // Reduced from 7
        const innerRadiusVariance = 1.5;// Reduced from 3

        // Glow size can also be reduced slightly, or kept similar for effect
        const glowRadius = 25; // Reduced from 35, adjust as needed
        const glowColor = "rgba(255, 200, 50, 0.25)"; // Maybe slightly fainter glow

        // Flash color remains intense
        const flashColor = "rgba(255, 230, 100, 0.95)";

        // Increased distance from player center
        const offsetDistance = 30; // Increased from 12

        const flashX = playerX + aimDx * offsetDistance;
        const flashY = playerY + aimDy * offsetDistance;
        const angle = Math.atan2(aimDy, aimDx);

        ctx.save();
        ctx.translate(flashX, flashY);
        ctx.rotate(angle);

        // 1. Draw the Glow (Possibly smaller radius now)
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        glowGradient.addColorStop(0, glowColor);
        glowGradient.addColorStop(1, "rgba(255, 200, 50, 0)");
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Draw the Smaller Starburst
        ctx.fillStyle = flashColor;
        ctx.beginPath();
        for (let i = 0; i < numPoints * 2; i++) {
            const radius = (i % 2 === 0)
                ? outerRadiusBase + Math.random() * outerRadiusVariance
                : innerRadiusBase + Math.random() * innerRadiusVariance;
            const pointAngle = (i / (numPoints * 2)) * (Math.PI * 2) - Math.PI / 2;
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
    function drawGame( ctx, appState, stateToRender, localPlayerMuzzleFlashRef, localPlayerPushbackAnimState, width, height ) {
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
        // --- MODIFIED CALL to drawPlayers --- Pass pushback state
        if (typeof activeSpeechBubbles !== 'undefined' && appState) drawPlayers(ctx, stateToRender.players, appState, localPlayerMuzzleFlashRef, localPlayerPushbackAnimState);
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
            ctx.fillStyle = 'rgba(229, 169, 96, 0.2)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }
        if (appState) drawTemperatureTint(ctx, appState.currentTemp, canvasWidth, canvasHeight);
        const localPlayerState = stateToRender.players?.[appState?.localPlayerId];
        if (localPlayerState && localPlayerState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD) { const vi = 1.0 - (localPlayerState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD); drawDamageVignette(ctx, vi, canvasWidth, canvasHeight); }
  
        ctx.globalAlpha = 1.0;
      } // --- End drawGame ---
  
      return { drawGame, triggerShake, updateGeneratedBackground };
  
  })(); // End Renderer module IIFE
  
  console.log("--- Renderer.js: Executed. Renderer object defined?", typeof Renderer);
