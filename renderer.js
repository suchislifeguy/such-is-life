// renderer.js

const Renderer = (() => {
    console.log("--- Renderer.js: Initializing ---");
  
    let mainCtx = null;
    let canvasWidth = 1600;
    let canvasHeight = 900;
  
    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d", { alpha: false });
    let isBackgroundReady = false;
    let currentBackgroundIsNight = null;
  
    let isTransitioningBackground = false;
    let transitionStartTime = 0;
    const BACKGROUND_FADE_DURATION_MS = 1000;
    const oldOffscreenCanvas = document.createElement("canvas");
    const oldOffscreenCtx = oldOffscreenCanvas.getContext("2d", { alpha: false });
  
    // --- Internal Constants ---
    const dayBaseColor = "#8FBC8F";
    const nightBaseColor = "#3E2723";
    const fontFamily = "'Courier New', monospace";
    const damageTextColor = "#FFFFFF";
    const damageTextCritColor = "#FFD700";
    const damageTextFontSize = 14;
    const damageTextCritFontSize = 18;
    const playerColor = "#DC143C";
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
    const healthBarLow = playerColor;
    const armorBarColor = "#9e9e9e";
    const powerupHealthColor = "#81c784";
    const powerupGunColor = "#442848";
    const powerupSpeedColor = "#3edef3";
    const powerupArmorColor = armorBarColor;
    const powerupShotgunColor = "#FFA500";
    const powerupSlugColor = "#A0522D";
    const powerupRapidColor = "#FFFF00";
    const powerupScoreColor = healthBarMedium;
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
    const sparkColors = [
      "rgba(255, 100, 0, 0.8)",
      "rgba(255, 165, 0, 0.9)",
      "rgba(255, 220, 50, 0.7)",
    ];
    const IDLE_BOB_SPEED_DIVISOR = 600;
    const IDLE_BOB_AMPLITUDE = 3;
    const DAMAGE_VIGNETTE_HEALTH_THRESHOLD = 30;
    const TEMP_FREEZING_CLIENT = 0.0;
    const TEMP_COLD_CLIENT = 10.0;
    const TEMP_HOT_CLIENT = 35.0;
    const TEMP_SCORCHING_CLIENT = 40.0;
    const MAX_TINT_ALPHA = 0.25;
  
    let currentShakeMagnitude = 0;
    let shakeEndTime = 0;
  
    function drawRoundedRect(ctx, x, y, width, height, radius) {
      if (width < 2 * radius) radius = width / 2;
      if (height < 2 * radius) radius = height / 2;
      ctx.beginPath(); ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }
  
    function generateBackground(ctx, targetIsNight, width, height) {
      console.log(`[Renderer] generateBackground called. TargetNight: ${targetIsNight}`);
      const baseColor = targetIsNight ? nightBaseColor : dayBaseColor;
      ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);
      if (!targetIsNight) { const np=100,nt=150; for(let i=0;i<np;i++){ const x=Math.random()*width,y=Math.random()*height,r=Math.random()*40+15,c=`rgba(${(101+Math.random()*20-10).toFixed(0)},${(67+Math.random()*20-10).toFixed(0)},${(33+Math.random()*20-10).toFixed(0)},${(Math.random()*0.25+0.20).toFixed(2)})`; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); } ctx.lineWidth=3; ctx.strokeStyle='rgba(34,139,34,0.6)'; for(let i=0;i<nt;i++){ const x=Math.random()*width,y=Math.random()*height; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()*6-3),y-(Math.random()*6+5)); ctx.stroke(); } }
      else { const np=60,ns=150; for(let i=0;i<np;i++){ const x=Math.random()*width,y=Math.random()*height,r=Math.random()*50+20,a=Math.random()*0.15+0.1; ctx.fillStyle=`rgba(5,2,2,${a.toFixed(2)})`; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); } ctx.fillStyle='rgba(255,255,240,0.8)'; for(let i=0;i<ns;i++){ const sx=Math.random()*width,sy=Math.random()*height,sr=Math.random()*1.5+0.5; ctx.fillRect(sx,sy,sr,sr); } }
      ctx.canvas.dataset.isNight = targetIsNight;
      console.log(`[Renderer] generateBackground finished. Stored isNight: ${ctx.canvas.dataset.isNight}`);
      return targetIsNight;
    }
  
// renderer.js

// --- Keep all the code above this function the same ---
// ... constants, state vars, helpers ...

function updateGeneratedBackground(targetIsNight, targetCanvasWidth, targetCanvasHeight) {
    // --- Logging removed for clarity, but useful for debugging ---
    // console.log(`[Renderer] updateGeneratedBackground request. TargetNight: ${targetIsNight}, CurrentNight: ${currentBackgroundIsNight}, Ready: ${isBackgroundReady}, Transitioning: ${isTransitioningBackground}`);

    // Update dimensions and potentially reset state if size changed
    canvasWidth = targetCanvasWidth; canvasHeight = targetCanvasHeight;
    if ( offscreenCanvas.width !== canvasWidth || offscreenCanvas.height !== canvasHeight ) {
        offscreenCanvas.width = canvasWidth; offscreenCanvas.height = canvasHeight;
        oldOffscreenCanvas.width = canvasWidth; oldOffscreenCanvas.height = canvasHeight;
        isBackgroundReady = false; currentBackgroundIsNight = null; isTransitioningBackground = false;
        // console.log("[Renderer] Canvas size changed, resetting background state.");
    }

    // --- Core Logic: Check if an update is actually needed ---
    // If the target state is the same as the currently known state, AND the background is ready (not mid-first-generation)
    // AND we are not currently transitioning (to avoid issues if called rapidly during fade)
    if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) {
         // console.log("[Renderer] Background update skipped (already correct state and ready).");
         return; // No change needed
    }
    // --- Prevent starting a new transition if one is already in progress for the *same target* ---
     if (isTransitioningBackground && targetIsNight === (offscreenCanvas.dataset.isNight === 'true')) {
         // console.log("[Renderer] Background update skipped (already transitioning to this state).");
         return;
     }


    // console.log(`[Renderer] Background change needed or first generation. Target: ${targetIsNight}`);

    // --- Perform the update ---
    if (isBackgroundReady) {
        // --- Start Transition ---
        // console.log("[Renderer] Saving current background and starting transition.");
        oldOffscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0); // Save current visual
        isTransitioningBackground = true;
        transitionStartTime = performance.now();
        // Generate the *new* background onto the offscreen canvas
        generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight);
        // --- *** IMMEDIATE STATE UPDATE (for Transition) *** ---
        currentBackgroundIsNight = targetIsNight; // Update logical state NOW
        // isBackgroundReady remains true
        // isTransitioningBackground was set true above

    } else {
        // --- First Generation (No Transition) ---
        // console.log("[Renderer] First background generation or regeneration.");
        // Generate the background
        generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight);
        // --- *** IMMEDIATE STATE UPDATE (for First Gen) *** ---
        currentBackgroundIsNight = targetIsNight; // Update logical state NOW
        isBackgroundReady = true;
        isTransitioningBackground = false; // Ensure transition is off

    }

    // --- Logging the final state after update logic ---
    // console.log(`[Renderer] Background state updated: CurrentNight=${currentBackgroundIsNight}, Ready=${isBackgroundReady}, Transitioning=${isTransitioningBackground}`);

} // --- End updateGeneratedBackground ---

// --- drawGame Function (No changes needed here from the previous version) ---
// It correctly handles drawing based on isBackgroundReady and isTransitioningBackground
function drawGame(ctx, appState, stateToRender, localPlayerMuzzleFlashRef, width, height) {
     if (!mainCtx) mainCtx = ctx;
     if (!ctx) { console.error("drawGame called without valid context!"); return; }

     const now = performance.now();
     canvasWidth = width; canvasHeight = height;

     let shakeApplied = false, shakeOffsetX = 0, shakeOffsetY = 0;
     // Shake Calculation ...
     if (currentShakeMagnitude > 0 && now < shakeEndTime) { shakeApplied = true; const tr = shakeEndTime - now; const id = shakeEndTime - (shakeEndTime - currentShakeMagnitude > 0 ? (shakeEndTime - (currentShakeMagnitude * 1000)) : 0); let cm = currentShakeMagnitude; if(id>0) cm=currentShakeMagnitude*(tr/id); if(cm>0.5){ const sa=Math.random()*Math.PI*2; shakeOffsetX=Math.cos(sa)*cm; shakeOffsetY=Math.sin(sa)*cm; } else { currentShakeMagnitude = 0; } } else if (currentShakeMagnitude > 0 && now >= shakeEndTime) { currentShakeMagnitude = 0; shakeEndTime = 0; }


     // 1. Draw Background
     ctx.globalAlpha = 1.0;
     if (!isBackgroundReady) {
         ctx.fillStyle = dayBaseColor; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
         if (appState?.serverState && currentBackgroundIsNight === null) {
             console.warn("drawGame: Background wasn't ready, forcing initial generation.");
             updateGeneratedBackground(appState.serverState.is_night, canvasWidth, canvasHeight);
         }
     } else if (isTransitioningBackground) {
         const elapsed = now - transitionStartTime;
         const progress = Math.min(1.0, elapsed / BACKGROUND_FADE_DURATION_MS);
         ctx.globalAlpha = 1.0; ctx.drawImage(oldOffscreenCanvas, 0, 0);
         ctx.globalAlpha = progress; ctx.drawImage(offscreenCanvas, 0, 0);
         ctx.globalAlpha = 1.0;
         if (progress >= 1.0) {
             isTransitioningBackground = false;
             // No state update needed here anymore
             // console.log("[Renderer] Background transition complete (visual).");
         }
     } else {
         ctx.drawImage(offscreenCanvas, 0, 0);
     }

     // 2. Apply Shake Transform
     if (shakeApplied) { ctx.save(); ctx.translate(shakeOffsetX, shakeOffsetY); }

     // 3. Draw Game World Elements
     if (!stateToRender) { if (shakeApplied) ctx.restore(); return; }
     // ... (Calls to drawCampfire, drawSnake, drawPowerups, etc.) ...
     drawCampfire(ctx, stateToRender.campfire, canvasWidth, canvasHeight); if (typeof snake !== 'undefined') drawSnake(ctx, snake); drawPowerups(ctx, stateToRender.powerups); drawBullets(ctx, stateToRender.bullets); if (typeof activeEnemyBubbles !== 'undefined') drawEnemies(ctx, stateToRender.enemies, activeEnemyBubbles); if (typeof activeSpeechBubbles !== 'undefined' && appState) drawPlayers(ctx, stateToRender.players, appState, localPlayerMuzzleFlashRef); if (typeof activeSpeechBubbles !== 'undefined' && appState) drawSpeechBubbles(ctx, stateToRender.players, activeSpeechBubbles, appState); if (typeof activeEnemyBubbles !== 'undefined') drawEnemySpeechBubbles(ctx, stateToRender.enemies, activeEnemyBubbles); drawDamageTexts(ctx, stateToRender.damage_texts); let shouldDrawMuzzleFlash = localPlayerMuzzleFlashRef?.active && (now < localPlayerMuzzleFlashRef?.endTime); if (shouldDrawMuzzleFlash) { drawMuzzleFlash(ctx, appState.renderedPlayerPos.x, appState.renderedPlayerPos.y, localPlayerMuzzleFlashRef.aimDx, localPlayerMuzzleFlashRef.aimDy); } else if (localPlayerMuzzleFlashRef?.active) { localPlayerMuzzleFlashRef.active = false; }


     // 4. Restore Shake Transform
     if (shakeApplied) { ctx.restore(); }

     // 5. Draw Overlays
     // ... (Vignette, Tint, Rain/Dust logic) ...
     ctx.globalAlpha = 1.0; const localPlayerState = stateToRender.players?.[appState?.localPlayerId]; if (localPlayerState && localPlayerState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD) { const vi = 1.0 - (localPlayerState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD); drawDamageVignette(ctx, vi, canvasWidth, canvasHeight); } if (appState) drawTemperatureTint(ctx, appState.currentTemp, canvasWidth, canvasHeight); if (appState?.isRaining) { ctx.fillStyle = 'rgba(50, 80, 150, 0.15)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); } else if (appState?.isDustStorm) { ctx.fillStyle = 'rgba(180, 140, 90, 0.2)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); }


     ctx.globalAlpha = 1.0; // Final reset
 } // --- End drawGame function ---

// --- (Keep triggerShake and other helper functions) ---
// ...

return { drawGame, triggerShake, updateGeneratedBackground };

})(); // End Renderer module IIFE

// --- (Keep console log at the end) ---
// console.log( /* ... */ );
  
  console.log(
    "--- Renderer.js: Executed. Renderer object defined?",
    typeof Renderer  
  );
