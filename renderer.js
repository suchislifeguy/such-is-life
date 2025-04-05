// renderer.js

const Renderer = (() => {

    // --- Offscreen Canvas for Background Rendering ---
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1600; // Assuming fixed size, could be dynamic if needed
    offscreenCanvas.height = 900;
    const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
    let isBackgroundReady = false;
    let currentBackgroundIsNight = null;

    // --- Background Transition State ---
    let isTransitioningBackground = false;
    let transitionStartTime = 0;
    const BACKGROUND_FADE_DURATION_MS = 1000;
    const oldOffscreenCanvas = document.createElement('canvas');
    oldOffscreenCanvas.width = offscreenCanvas.width;
    oldOffscreenCanvas.height = offscreenCanvas.height;
    const oldOffscreenCtx = oldOffscreenCanvas.getContext('2d', { alpha: false });

    // --- Base Background Colors ---
    const dayBaseColor = '#8FBC8F';
    const nightBaseColor = '#3E2723';

    // --- Cached CSS Variables & Internal Style Constants ---
    // It's often better to rely on CSS variables where possible for theming,
    // but caching them or using JS constants can be slightly faster if static.
    // We'll use JS constants here as defined in the original file.
    const fontFamily = "'Courier New', monospace";
    const damageTextColor = '#FFFFFF';
    const damageTextCritColor = '#FFD700'; // Matches --accent-gold potentially
    const damageTextFontSize = 14;
    const damageTextCritFontSize = 18;
    const playerColor = '#DC143C'; // Matches --player-color
    const otherPlayerColor = '#4682B4'; // Matches --other-player-color
    const playerHeadColor = '#D2B48C'; const playerHelmetColor = '#CCCCCC'; // Example internal detail colors
    const playerSlitColor = '#222222'; const playerCoatColor = '#8B4513';
    const playerBootColor = '#222222'; const playerGunColor = '#444444';
    const dustyPlayerSelfColor = '#8B4513';
    const dustyPlayerOtherColor = '#556B2F';
    const enemySkinColor = '#D2B48C'; const enemyCoatColor = '#8B4513';
    const enemyTorsoChaserColor = '#2F4F4F'; const enemyTorsoShooterColor = '#4682B4'; // Matches --other-player-color?
    const enemyTorsoGiantColor = '#6B4226';
    const enemyBootColor = '#222222'; const enemyCapColor = '#111111';
    const enemyHitFlashColor = 'rgba(255, 255, 255, 0.7)';
    const bulletPlayerColor = '#ffed4a'; // Matches --bullet-player-color
    const bulletEnemyColor = '#ff0000'; // Matches --bullet-enemy-color
    const healthBarBg = '#444'; // Matches --health-bar-bg
    const healthBarHigh = '#66bb6a'; // Matches --health-bar-high
    const healthBarMedium = '#FFD700'; // Matches --accent-gold
    const healthBarLow = playerColor; // Use player color for low health
    const armorBarColor = '#9e9e9e'; // Matches --powerup-armor
    const powerupHealthColor = '#81c784'; const powerupGunColor = '#442848';
    const powerupSpeedColor = '#3edef3'; const powerupArmorColor = armorBarColor; // Reuse
    const powerupShotgunColor = '#FFA500'; const powerupSlugColor = '#A0522D';
    const powerupRapidColor = '#FFFF00'; const powerupScoreColor = healthBarMedium; // Reuse
    const powerupDefaultColor = '#888';
    const playerSpeechBubbleColor = '#d0d8d7'; // Matches --dark-text
    const playerSpeechBubbleBg = 'rgba(0, 0, 0, 0.7)';
    const playerSpeechBubbleOutline = 'rgba(200, 200, 200, 0.5)';
    const enemySpeechBubbleColor = '#FFAAAA'; const enemySpeechBubbleBg = 'rgba(70, 0, 0, 0.7)';
    const enemySpeechBubbleOutline = 'rgba(200, 150, 150, 0.5)';
    const campfireAuraColor = 'rgba(255, 165, 0, 0.15)'; // Matches --campfire-aura-color
    const campfireStickColor = '#8B4513'; const campfireFlameOuterColor = 'rgba(255, 165, 0, 0.6)';
    const campfireFlameInnerColor = 'rgba(255, 255, 0, 0.7)';
    const muzzleFlashColor = 'rgba(255, 220, 50, 0.9)';
    const snakeLineColor = '#261a0d';
    const snakeBiteTintColor = 'rgba(0, 200, 50, 0.15)';
    const ironHelmetColor = '#3d3d3d'; const ironHelmetHighlight = '#666666'; const ironHelmetShadow = '#1a1a1a';
    const beltColor = '#412a19'; const bootColor = '#241c1c'; const backgroundShadowColor = 'rgba(0,0,0,0.3)';
    const simpleChestPlateColor = '#777777'; const chestPlateHighlight = '#999999';
    const slitColor = '#000000'; const gunColor = '#444444';
    const sparkColors = ['rgba(255, 100, 0, 0.8)', 'rgba(255, 165, 0, 0.9)', 'rgba(255, 220, 50, 0.7)'];

    // --- Animation & Effect Parameters ---
    const IDLE_BOB_SPEED_DIVISOR = 600;
    const IDLE_BOB_AMPLITUDE = 3;
    const DAMAGE_VIGNETTE_HEALTH_THRESHOLD = 30; // Health below which vignette appears
    const SNAKE_BITE_SLOW_MODIFIER = 0.5; // Used for tinting check

    // --- Screen Shake State (Internalized) ---
    let currentShakeMagnitude = 0;
    let shakeEndTime = 0;

    // --- Constants Passed from Main Scope (via drawGame call) ---
    // Defined here just for clarity, their values come from arguments
    let CANVAS_WIDTH = 1600;
    let CANVAS_HEIGHT = 900;
    // Temperature thresholds also needed for tinting
    let TEMP_FREEZING_CLIENT = 0.0;
    let TEMP_COLD_CLIENT = 10.0;
    let TEMP_HOT_CLIENT = 35.0;
    let TEMP_SCORCHING_CLIENT = 40.0;
    let MAX_TINT_ALPHA = 0.25;


    // --- Helper: Draw Rounded Rect ---
    function drawRoundedRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2; if (height < 2 * radius) radius = height / 2;
        ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius); ctx.closePath();
    }

    // --- Background Generation ---
    function generateBackground(ctx, targetIsNight, width, height) {
        // Removed color args, uses internal constants
        const baseColor = targetIsNight ? nightBaseColor : dayBaseColor;
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);

        if (!targetIsNight) { // Day Details
            const numPatches = 100; const numTufts = 150;
            for (let i = 0; i < numPatches; i++) { const x = Math.random()*width; const y = Math.random()*height; const radius = Math.random()*40+15; const r = 101+Math.random()*20-10; const g = 67+Math.random()*20-10; const b = 33+Math.random()*20-10; const alpha = Math.random()*0.25+0.20; ctx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${alpha.toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fill(); }
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(34, 139, 34, 0.6)';
            for (let i = 0; i < numTufts; i++) { const x = Math.random()*width; const y = Math.random()*height; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+(Math.random()*6-3), y-(Math.random()*6+5)); ctx.stroke(); }
        } else { // Night Details
            const numPatches = 60; const numStars = 150;
            for (let i = 0; i < numPatches; i++) { const x = Math.random()*width; const y = Math.random()*height; const radius = Math.random()*50+20; const alpha = Math.random()*0.15+0.1; ctx.fillStyle = `rgba(5, 2, 2, ${alpha.toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fill(); }
            ctx.fillStyle = 'rgba(255, 255, 240, 0.8)';
            for (let i = 0; i < numStars; i++) { const starX = Math.random()*width; const starY = Math.random()*height; const starR = Math.random()*1.5+0.5; ctx.fillRect(starX, starY, starR, starR); }
        }
        return targetIsNight; // Return the state set
    }

    function updateGeneratedBackground(targetIsNight, targetCanvasWidth, targetCanvasHeight) {
        // Removed color args
        CANVAS_WIDTH = targetCanvasWidth; // Update internal dimensions if needed
        CANVAS_HEIGHT = targetCanvasHeight;
        offscreenCanvas.width = CANVAS_WIDTH;
        offscreenCanvas.height = CANVAS_HEIGHT;
        oldOffscreenCanvas.width = CANVAS_WIDTH;
        oldOffscreenCanvas.height = CANVAS_HEIGHT;


        if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) return;

        if (isBackgroundReady) {
            isTransitioningBackground = true; transitionStartTime = performance.now();
            oldOffscreenCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0);
            // Call generateBackground without color args
            currentBackgroundIsNight = generateBackground(offscreenCtx, targetIsNight, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            // Call generateBackground without color args
            currentBackgroundIsNight = generateBackground(offscreenCtx, targetIsNight, CANVAS_WIDTH, CANVAS_HEIGHT);
            isBackgroundReady = true;
        }
    }

    // --- Drawing Functions (Using Internal Constants) ---

    function drawDamageTexts(ctx, damageTexts) {
        if (!damageTexts) return;
        const now = performance.now();
        const pulseDuration = 250; const pulseMaxSizeIncrease = 4;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        Object.values(damageTexts).forEach(dmgText => {
            if (!dmgText) return;
            const x = dmgText.x ?? 0; const y = dmgText.y ?? 0;
            const text = dmgText.text ?? '?'; const isCrit = dmgText.is_crit ?? false;
            const spawnTime = dmgText.spawn_time ? dmgText.spawn_time * 1000 : now;
            const timeSinceSpawn = now - spawnTime;
            let currentFontSize = isCrit ? damageTextCritFontSize : damageTextFontSize;
            let currentFillColor = isCrit ? damageTextCritColor : damageTextColor;
            if (isCrit && timeSinceSpawn < pulseDuration) { const pulseProgress = Math.sin((timeSinceSpawn / pulseDuration) * Math.PI); currentFontSize += pulseProgress * pulseMaxSizeIncrease; }
            ctx.font = `bold ${Math.round(currentFontSize)}px ${fontFamily}`; ctx.fillStyle = currentFillColor; ctx.fillText(text, x, y);
        });
    }

    function drawCampfire(ctx, campfireData, width, height) {
        if (!campfireData || !campfireData.active) return;
        const x = campfireData.x ?? width / 2; const y = campfireData.y ?? height / 2;
        const radius = campfireData.radius ?? 0; if (radius <= 0) return;
        const stickWidth = 20; const stickHeight = 4; const flameWidth = 15; const flameHeight = 25;
        ctx.save();
        ctx.fillStyle = campfireAuraColor; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
        const stickOffsetY = 5; ctx.fillStyle = campfireStickColor; ctx.translate(x, y + stickOffsetY);
        ctx.rotate(Math.PI / 5); ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight); ctx.rotate(-Math.PI / 5);
        ctx.rotate(-Math.PI / 6); ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight); ctx.rotate(Math.PI / 6);
        ctx.translate(-x, -(y + stickOffsetY));
        const flameOffsetY = -10; const flameCenterX = x; const flameCenterY = y + flameOffsetY;
        ctx.fillStyle = campfireFlameOuterColor; ctx.beginPath(); ctx.ellipse(flameCenterX, flameCenterY, flameWidth / 2, flameHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = campfireFlameInnerColor; ctx.beginPath(); ctx.ellipse(flameCenterX, flameCenterY - 3, flameWidth / 3, flameHeight / 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy) {
        const flashSizeBase = 10; const flashSizeVariation = 5; const offsetDistance = 12;
        const flashX = playerX + aimDx * offsetDistance; const flashY = playerY + aimDy * offsetDistance;
        const flashSize = flashSizeBase + Math.random() * flashSizeVariation;
        ctx.fillStyle = muzzleFlashColor; ctx.beginPath(); ctx.arc(flashX, flashY, flashSize / 2, 0, Math.PI * 2); ctx.fill();
    }

    function drawDamageVignette(ctx, intensity, width, height) {
        if (intensity <= 0) return;
        ctx.save();
        const outerRadius = Math.sqrt(width**2 + height**2) / 2;
        const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, outerRadius);
        const redAlpha = 0.4 * intensity;
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0)'); gradient.addColorStop(0.75, 'rgba(255, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(255, 0, 0, ${redAlpha.toFixed(2)})`);
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

     function drawTemperatureTint(ctx, temperature, width, height) {
        let tintColorStr = null;
        let alpha = 0.0;
        // Update thresholds if needed
        TEMP_FREEZING_CLIENT = 0.0; TEMP_COLD_CLIENT = 10.0; TEMP_HOT_CLIENT = 35.0; TEMP_SCORCHING_CLIENT = 40.0; MAX_TINT_ALPHA = 0.25;

        if (temperature <= TEMP_FREEZING_CLIENT) { tintColorStr = 'rgba(100, 150, 255, A)'; alpha = MAX_TINT_ALPHA; }
        else if (temperature <= TEMP_COLD_CLIENT) { tintColorStr = 'rgba(150, 180, 255, A)'; alpha = MAX_TINT_ALPHA * ((TEMP_COLD_CLIENT - temperature) / (TEMP_COLD_CLIENT - TEMP_FREEZING_CLIENT)); }
        else if (temperature >= TEMP_SCORCHING_CLIENT) { tintColorStr = 'rgba(255, 100, 0, A)'; alpha = MAX_TINT_ALPHA; }
        else if (temperature >= TEMP_HOT_CLIENT) { tintColorStr = 'rgba(255, 150, 50, A)'; alpha = MAX_TINT_ALPHA * ((temperature - TEMP_HOT_CLIENT) / (TEMP_SCORCHING_CLIENT - TEMP_HOT_CLIENT)); }

        if (tintColorStr && alpha > 0.01) {
            ctx.fillStyle = tintColorStr.replace('A', alpha.toFixed(2));
            ctx.fillRect(0, 0, width, height);
        }
    }

    // Uses global activeEnemyBubbles (managed in index.html)
    function drawEnemySpeechBubbles(ctx, enemiesToRender, activeEnemyBubblesRef) {
        const now = performance.now(); const bubbleFont = 'italic 11px ' + fontFamily;
        const cornerRadius = 4; const textPadding = 3; const bubbleOffset = 20;
        ctx.font = bubbleFont; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const enemyIdsToRemove = [];
        for (const enemyId in activeEnemyBubblesRef) {
            const bubble = activeEnemyBubblesRef[enemyId];
            if (now >= bubble.endTime) { enemyIdsToRemove.push(enemyId); continue; }
            const enemy = enemiesToRender?.[enemyId];
            if (enemy && enemy.health > 0) {
                const enemyDrawX = enemy.x; const enemyDrawY = enemy.y; const enemyHeight = enemy.height ?? 40; // Use ENEMY_DEFAULTS if needed
                const bubbleY = enemyDrawY - (enemyHeight / 2) - bubbleOffset; const textMetrics = ctx.measureText(bubble.text);
                const textWidth = textMetrics.width; const boxWidth = textWidth + textPadding * 2; const approxFontHeight = 11; const boxHeight = approxFontHeight + textPadding * 2;
                const boxX = enemyDrawX - boxWidth / 2; const boxY = bubbleY - boxHeight;
                ctx.fillStyle = enemySpeechBubbleBg; drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); ctx.fill();
                ctx.strokeStyle = enemySpeechBubbleOutline; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = enemySpeechBubbleColor; ctx.fillText(bubble.text, enemyDrawX, bubbleY - textPadding);
            } else { enemyIdsToRemove.push(enemyId); }
        }
        enemyIdsToRemove.forEach(id => { delete activeEnemyBubblesRef[id]; });
    }

    // Uses global activeSpeechBubbles (managed in index.html)
    function drawSpeechBubbles(ctx, playersToRender, activeSpeechBubblesRef, appStateRef) {
        const now = performance.now(); const bubbleFont = 'bold 12px ' + fontFamily;
        const cornerRadius = 5; const textPadding = 4; const bubbleOffset = 30;
        ctx.font = bubbleFont; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const playerIdsToRemove = [];
        for (const playerId in activeSpeechBubblesRef) {
            const bubble = activeSpeechBubblesRef[playerId];
            if (now >= bubble.endTime) { playerIdsToRemove.push(playerId); continue; }
            const player = playersToRender?.[playerId];
            if (player && player.player_status !== 'dead' && player.health > 0) {
                const playerDrawX = (playerId === appStateRef.localPlayerId) ? appStateRef.renderedPlayerPos.x : player.x;
                const playerDrawY = (playerId === appStateRef.localPlayerId) ? appStateRef.renderedPlayerPos.y : player.y;
                const playerHeight = player.height ?? 48; // Use PLAYER_DEFAULTS if needed
                const bubbleY = playerDrawY - (playerHeight / 2) - bubbleOffset; const textMetrics = ctx.measureText(bubble.text);
                const textWidth = textMetrics.width; const boxWidth = textWidth + textPadding * 2; const approxFontHeight = 12; const boxHeight = approxFontHeight + textPadding * 2;
                const boxX = playerDrawX - boxWidth / 2; const boxY = bubbleY - boxHeight;
                ctx.fillStyle = playerSpeechBubbleBg; drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); ctx.fill();
                ctx.strokeStyle = playerSpeechBubbleOutline; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = playerSpeechBubbleColor; ctx.fillText(bubble.text, playerDrawX, bubbleY - textPadding);
            } else { playerIdsToRemove.push(playerId); }
        }
        playerIdsToRemove.forEach(id => { delete activeSpeechBubblesRef[id]; });
    }

    // Uses global snake object (managed in index.html)
    function drawSnake(ctx, snakeRef) {
        if (!snakeRef.isActiveFromServer || !snakeRef.segments || snakeRef.segments.length < 2) return;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = snakeLineColor;
        ctx.lineWidth = snakeRef.lineWidth; ctx.beginPath();
        ctx.moveTo(snakeRef.segments[snakeRef.segments.length - 1].x, snakeRef.segments[snakeRef.segments.length - 1].y);
        for (let i = snakeRef.segments.length - 2; i >= 1; i--) {
            const seg = snakeRef.segments[i]; const nextSeg = snakeRef.segments[i - 1]; if (!seg || !nextSeg) continue;
            const xc = (seg.x + nextSeg.x) / 2; const yc = (seg.y + nextSeg.y) / 2; ctx.quadraticCurveTo(seg.x, seg.y, xc, yc);
        }
        if (snakeRef.segments.length > 0) { const head = snakeRef.segments[0]; if (snakeRef.segments.length > 1) { const neck = snakeRef.segments[1]; const xc = (neck.x + head.x) / 2; const yc = (neck.y + head.y) / 2; ctx.quadraticCurveTo(neck.x, neck.y, xc, yc); } ctx.lineTo(head.x, head.y); }
        ctx.stroke();
    }

    // Removed color args, uses internal constants
    function drawHealthBar(ctx, x, y, width, currentHealth, maxHealth) {
        if (maxHealth <= 0) return; const barHeight = 5; const yOffset = -((width/2) + 27);
        const barWidth = Math.max(20, width*0.8); const currentWidth = Math.max(0, (currentHealth/maxHealth)*barWidth);
        const healthPercentage = currentHealth / maxHealth; const barX = x - barWidth/2; const barY = y + yOffset;
        ctx.fillStyle = healthBarBg; ctx.fillRect(barX, barY, barWidth, barHeight);
        let barColor = healthBarLow; if (healthPercentage > 0.66) barColor = healthBarHigh; else if (healthPercentage > 0.33) barColor = healthBarMedium;
        ctx.fillStyle = barColor; ctx.fillRect(barX, barY, currentWidth, barHeight);
    }

    // Removed color args, uses internal constants
    function drawArmorBar(ctx, x, y, width, currentArmor) {
        const maxArmor = 100; if (currentArmor <= 0) return;
        const armorBarHeight = 4; const healthBarHeight = 5; const barSpacing = 1;
        const healthBarYOffset = -((width/2) + 27); const healthBarTopY = y + healthBarYOffset; // Corrected offset
        const armorBarTopY = healthBarTopY + healthBarHeight + barSpacing;
        const barWidth = Math.max(20, width*0.8); const currentWidth = Math.max(0, (currentArmor / maxArmor)*barWidth);
        const barX = x - barWidth/2; const barY = armorBarTopY;
        ctx.fillStyle = healthBarBg; ctx.fillRect(barX, barY, barWidth, armorBarHeight);
        ctx.fillStyle = armorBarColor; ctx.fillRect(barX, barY, currentWidth, armorBarHeight);
    }

    // Removed color args, uses internal constants
    function drawPlayerCharacter(ctx, x, y, w, h, isSelf, playerState, aimDx, aimDy) {
        // Internal color definitions reused or defined here
        const time = performance.now(); const nowSeconds = time / 1000.0;
        const justHit = playerState?.hit_flash_this_tick ?? false;
        const isIdle = (playerState?.input_vector?.dx ?? 0) === 0 && (playerState?.input_vector?.dy ?? 0) === 0;
        const bobOffset = isIdle ? Math.sin(time / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;
        const snakeEffect = playerState?.effects?.snake_bite_slow;
        const isSnakeBitten = snakeEffect && nowSeconds < snakeEffect.expires_at; // Unused visually here, but available

        const helmetHeight = h*0.30; const helmetWidth = w*0.95; const slitHeight = helmetHeight*0.15;
        const slitWidth = helmetWidth*0.8; const neckGuardHeight = h*0.06; const shoulderPlateWidth = w*1.25;
        const shoulderPlateHeight = h*0.10; const chestPlateHeight = h*0.30; const chestPlateWidth = w*0.9;
        const armWidth = w*0.2; const armLength = h*0.4; const beltHeight = h*0.05; const pantsHeight = h*0.35;
        const bootHeight = h*0.10; const bootWidth = w*0.32; const bootSpacing = w*0.4;
        const topOffset = h*0.5; const helmetTopY = y-topOffset+bobOffset; const helmetBottomY = helmetTopY+helmetHeight;
        const slitY = helmetTopY+helmetHeight*0.4; const neckGuardTopY = helmetBottomY-3; const neckGuardBottomY = neckGuardTopY+neckGuardHeight;
        const shoulderTopY = neckGuardBottomY-2; const shoulderBottomY = shoulderTopY+shoulderPlateHeight; const chestPlateTopY = shoulderTopY+shoulderPlateHeight*0.15;
        const armTopY = shoulderTopY+shoulderPlateHeight*0.2; const beltY = chestPlateTopY+chestPlateHeight+beltHeight*0.1;
        const pantsTopY = beltY+beltHeight*0.4; const pantsBottomY = pantsTopY+pantsHeight; const bootTopY = pantsBottomY-5; const bootBottomY = bootTopY+bootHeight;
        const distinguishingColor = isSelf ? dustyPlayerSelfColor : dustyPlayerOtherColor; // Using specific colors

        ctx.save();
        ctx.beginPath(); const shadowY = bootBottomY+1; ctx.ellipse(x, shadowY, w*0.45, h*0.05, 0, 0, Math.PI*2); ctx.fillStyle = backgroundShadowColor; ctx.fill();
        ctx.fillStyle = distinguishingColor; const legWidth = w*0.4; ctx.fillRect(x-w*0.45, pantsTopY, legWidth, pantsHeight); ctx.fillRect(x+w*0.05, pantsTopY, legWidth, pantsHeight);
        ctx.fillStyle = bootColor;
        if (!isIdle) { const stepDuration = 250; const stepPhase = Math.floor(time / stepDuration) % 2; if (stepPhase === 0) { ctx.fillRect(x-bootSpacing-bootWidth/2, bootTopY-2, bootWidth, bootHeight); ctx.fillRect(x+bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight); } else { ctx.fillRect(x-bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight); ctx.fillRect(x+bootSpacing-bootWidth/2, bootTopY-2, bootWidth, bootHeight); } }
        else { ctx.fillRect(x-bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight); ctx.fillRect(x+bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight); }
        ctx.fillStyle = beltColor; ctx.fillRect(x-w*0.65, beltY-beltHeight/2, w*1.3, beltHeight);
        ctx.fillStyle = simpleChestPlateColor; ctx.fillRect(x-chestPlateWidth/2, chestPlateTopY, chestPlateWidth, chestPlateHeight);
        ctx.fillStyle = chestPlateHighlight; ctx.fillRect(x-chestPlateWidth/2+5, chestPlateTopY+5, chestPlateWidth-10, 3);
        ctx.fillStyle = ironHelmetColor; ctx.fillRect(x-shoulderPlateWidth/2, shoulderTopY, shoulderPlateWidth, shoulderPlateHeight);
        ctx.fillStyle = ironHelmetHighlight; ctx.fillRect(x-shoulderPlateWidth/2+3, shoulderTopY+2, shoulderPlateWidth-6, 2);
        ctx.fillStyle = distinguishingColor; ctx.fillRect(x-shoulderPlateWidth*0.45, armTopY, armWidth, armLength); ctx.fillRect(x+shoulderPlateWidth*0.45-armWidth, armTopY, armWidth, armLength);
        ctx.fillStyle = ironHelmetColor; ctx.fillRect(x-helmetWidth*0.4, neckGuardTopY, helmetWidth*0.8, neckGuardHeight);
        ctx.fillStyle = ironHelmetColor; ctx.fillRect(x-helmetWidth/2, helmetTopY, helmetWidth, helmetHeight);
        ctx.fillStyle = ironHelmetHighlight; ctx.fillRect(x-helmetWidth/2, helmetTopY, helmetWidth, 3);
        ctx.fillStyle = ironHelmetShadow; ctx.fillRect(x-helmetWidth/2+1, helmetTopY+3, helmetWidth-2, 2);
        ctx.fillStyle = slitColor; ctx.fillRect(x-slitWidth/2, slitY, slitWidth, slitHeight);
        if (isSelf && (aimDx !== 0 || aimDy !== 0)) { const gunLevel = playerState?.gun ?? 1; const gunLengthBase = 12; const gunLengthBonus = (gunLevel-1)*3; const gunLength = gunLengthBase+gunLengthBonus; const gunThickness = 5+(gunLevel-1)*0.5; const gunOriginY = armTopY+armLength*0.4; const gunOriginXOffset = w*0.1; ctx.save(); ctx.translate(x, gunOriginY); const angle = Math.atan2(aimDy, aimDx); ctx.rotate(angle); ctx.fillStyle = gunColor; ctx.fillRect(gunOriginXOffset, -gunThickness/2, gunLength, gunThickness); ctx.restore(); }
        if (justHit) { ctx.save(); const numSparks = 15 + Math.random() * 10; for (let i = 0; i < numSparks; i++) { const angle = Math.random() * Math.PI * 2; const radius = Math.random()*w*0.8 + w*0.2; const particleX = x + Math.cos(angle)*radius; const particleY = y + Math.sin(angle)*radius*0.7 - h*0.1; const particleSize = Math.random()*3.5 + 1.5; ctx.fillStyle = sparkColors[Math.floor(Math.random() * sparkColors.length)]; ctx.beginPath(); ctx.arc(particleX, particleY, particleSize/2, 0, Math.PI*2); ctx.fill(); } ctx.restore(); }
        ctx.restore();
    }

    function drawPlayers(ctx, players, appStateRef, localPlayerMuzzleFlashRef) {
         if (!players) return;
         Object.values(players).forEach(player => {
             if (!player || player.player_status === 'dead') return;
             const isSelf = player.id === appStateRef.localPlayerId;
             const playerStatus = player.player_status || 'alive';
             const drawX = isSelf ? appStateRef.renderedPlayerPos.x : player.x;
             const drawY = isSelf ? appStateRef.renderedPlayerPos.y : player.y;
             const width = player.width ?? 48; // Use PLAYER_DEFAULTS if needed
             const height = player.height ?? 48;
             const maxHealth = player.max_health ?? 100;
             const currentArmor = player.armor ?? 0;
             let isDown = (playerStatus === 'down'); let alpha = isDown ? 0.4 : 1.0;
             ctx.save(); ctx.globalAlpha = alpha;
             const aimDx = isSelf ? localPlayerMuzzleFlashRef.aimDx : 0; const aimDy = isSelf ? localPlayerMuzzleFlashRef.aimDy : 0;
             drawPlayerCharacter(ctx, drawX, drawY, width, height, isSelf, player, aimDx, aimDy); // Uses internal colors
             ctx.restore();
             if (playerStatus === 'alive') {
                 drawHealthBar(ctx, drawX, drawY, width, player.health, maxHealth); // Uses internal colors
                 if (currentArmor > 0) drawArmorBar(ctx, drawX, drawY, width, currentArmor); // Uses internal colors
             }
         });
     }

    // Removed color args, uses internal constants
    function drawEnemyRect(ctx, x, y, w, h, type, enemyState) {
        const currentW = w; const currentH = h;
        const torsoColor = type === 'shooter' ? enemyTorsoShooterColor : (type === 'giant' ? enemyTorsoGiantColor : enemyTorsoChaserColor);
        const bobOffset = (type !== 'giant') ? Math.sin(performance.now() / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;
        const nowSeconds = performance.now() / 1000.0;
        const snakeEffect = enemyState?.effects?.snake_bite_slow;
        const isSnakeBitten = snakeEffect && nowSeconds < snakeEffect.expires_at;
        const headRadius = currentH * 0.18; const bodyHeight = currentH * 0.5; const coatLengthBonus = currentH * 0.15;
        const bodyWidthTop = currentW * 0.9; const bodyWidthBottom = currentW * 0.7; const coatWidth = currentW * 1.1;
        const armWidth = currentW * 0.2; const armLength = currentH * 0.4; const capHeight = headRadius * 0.8; const capWidth = headRadius * 2.2;
        const bootSize = currentW * 0.15; const bootSpacing = currentW * 0.3;
        const headCenterY = y - (currentH / 2) + headRadius + bobOffset; const bodyTopY = headCenterY + headRadius * 0.8;
        const bodyBottomY = bodyTopY + bodyHeight; const coatTopY = bodyTopY + bodyHeight * 0.1; const coatBottomY = bodyBottomY + coatLengthBonus;
        const armTopY = bodyTopY + bodyHeight * 0.05; const capTopY = headCenterY - headRadius; const bootOffsetY = coatBottomY + 2;
        ctx.save();
        ctx.fillStyle = enemyCoatColor; ctx.fillRect(x - coatWidth / 2, coatTopY, coatWidth, coatBottomY - coatTopY);
        ctx.fillStyle = torsoColor; ctx.beginPath(); ctx.moveTo(x - bodyWidthTop / 2, bodyTopY); ctx.lineTo(x + bodyWidthTop / 2, bodyTopY); ctx.lineTo(x + bodyWidthBottom / 2, bodyBottomY); ctx.lineTo(x - bodyWidthBottom / 2, bodyBottomY); ctx.closePath(); ctx.fill();
        ctx.fillStyle = enemyCoatColor; ctx.fillRect(x - bodyWidthTop / 2 - armWidth, armTopY, armWidth, armLength); ctx.fillRect(x + bodyWidthTop / 2, armTopY, armWidth, armLength);
        ctx.fillStyle = enemySkinColor; ctx.beginPath(); ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2); ctx.fill();
        if (type !== 'giant') { ctx.fillStyle = enemyCapColor; ctx.fillRect(x - capWidth / 2, capTopY, capWidth, capHeight); }
        ctx.fillStyle = enemyBootColor; ctx.fillRect(x - bootSpacing - bootSize / 2, bootOffsetY, bootSize, bootSize); ctx.fillRect(x + bootSpacing - bootSize / 2, bootOffsetY, bootSize, bootSize);
        if (isSnakeBitten) { ctx.fillStyle = snakeBiteTintColor; ctx.fillRect(x - currentW * 0.5, y - currentH * 0.5 + bobOffset, currentW, currentH); }
        if (enemyState?.hit_flash_this_tick) { ctx.fillStyle = enemyHitFlashColor; const flashMargin = 2; ctx.fillRect(x - currentW / 2 - flashMargin, y - currentH / 2 - flashMargin + bobOffset, currentW + flashMargin * 2, currentH + flashMargin * 2); }
        ctx.restore();
    }

    // Uses global activeEnemyBubbles reference
    function drawEnemies(ctx, enemies, activeEnemyBubblesRef) {
        if (!enemies) return;
        const now = performance.now() / 1000; const FADE_DURATION = 0.3;
        Object.values(enemies).forEach(enemy => {
            if (!enemy) return; const width = enemy.width ?? 20; const height = enemy.height ?? 40; const maxHealth = enemy.max_health ?? 50;
            let alpha = 1.0; let shouldDraw = true; let isDying = false;
            if (enemy.health <= 0 && enemy.death_timestamp) { isDying = true; const elapsed = now - enemy.death_timestamp; if (elapsed < FADE_DURATION) alpha = 0.4; else shouldDraw = false; }
            if (shouldDraw) { ctx.save(); ctx.globalAlpha = alpha; drawEnemyRect(ctx, enemy.x, enemy.y, width, height, enemy.type, enemy); ctx.restore(); } // Uses internal colors
            if (!isDying && enemy.health > 0 && shouldDraw) { drawHealthBar(ctx, enemy.x, enemy.y, width, enemy.health, maxHealth); } // Uses internal colors
        });
    }

    function drawBulletCircle(ctx, x, y, r, isPlayerBullet) { ctx.fillStyle = isPlayerBullet ? bulletPlayerColor : bulletEnemyColor; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
    function drawShapedBullet(ctx, bullet) {
        const x = bullet.x; const y = bullet.y; const vx = bullet.vx; const vy = bullet.vy; const ownerType = bullet.owner_type; const radius = bullet.radius || 4;
        const baseLength = 8; const baseWidth = 4; const scaleFactor = radius / 4; const length = baseLength*scaleFactor; const width = baseWidth*scaleFactor;
        const color = (ownerType === 'player') ? bulletPlayerColor : bulletEnemyColor; const angle = Math.atan2(vy, vx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color; ctx.fillRect(-length/2, -width/2, length, width);
        const noseLength = length*0.4; ctx.beginPath(); ctx.moveTo(length/2, 0); ctx.lineTo(length/2-noseLength, -width/2); ctx.lineTo(length/2-noseLength, width/2); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    function drawBullets(ctx, bullets) {
        if (!bullets) return;
        Object.values(bullets).forEach(bullet => {
            if (!bullet) return; const x = bullet.x ?? 0; const y = bullet.y ?? 0; const vx = bullet.vx ?? 0; const vy = bullet.vy ?? 0; const radius = bullet.radius ?? 4;
            const bulletType = bullet.bullet_type || 'standard'; const ownerType = bullet.owner_type; const hasVelocity = Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01;
            if (bulletType === 'ammo_heavy_slug' || bulletType === 'standard' || bulletType === 'ammo_rapid_fire' || bulletType === 'standard_enemy') { hasVelocity ? drawShapedBullet(ctx, bullet) : drawBulletCircle(ctx, x, y, radius, ownerType === 'player'); }
            else if (bulletType === 'ammo_shotgun') { drawBulletCircle(ctx, x, y, radius, ownerType === 'player'); }
            else { drawBulletCircle(ctx, x, y, radius, ownerType === 'player'); }
        });
    }

    function drawPowerupSquare(ctx, x, y, size, type) {
        let fillColor = powerupDefaultColor; let symbol = '?';
        if (type === 'health') { symbol = '+'; fillColor = powerupHealthColor; }
        else if (type === 'gun_upgrade') { symbol = 'G'; fillColor = powerupGunColor; }
        else if (type === 'speed_boost') { symbol = 'S'; fillColor = powerupSpeedColor; }
        else if (type === 'armor') { symbol = '#'; fillColor = powerupArmorColor; }
        else if (type === 'ammo_shotgun') { symbol = '::'; fillColor = powerupShotgunColor; }
        else if (type === 'ammo_heavy_slug') { symbol = '■'; fillColor = powerupSlugColor; }
        else if (type === 'ammo_rapid_fire') { symbol = '>'; fillColor = powerupRapidColor; }
        else if (type === 'bonus_score') { symbol = '$'; fillColor = powerupScoreColor; }
        ctx.fillStyle = fillColor; ctx.fillRect(x - size/2, y - size/2, size, size);
        ctx.fillStyle = '#000'; let fontSize = Math.round(size*0.7); ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, x, y+(size*0.05));
    }
    function drawPowerups(ctx, powerups) { if (!powerups) return; Object.values(powerups).forEach(powerup => { if (!powerup) return; const size = powerup.size ?? 20; drawPowerupSquare(ctx, powerup.x, powerup.y, size, powerup.type); }); }

    // --- Shake Trigger ---
    function triggerShake(magnitude, durationMs) {
       const now = performance.now(); const newEndTime = now + durationMs;
       if (magnitude >= currentShakeMagnitude || newEndTime >= shakeEndTime) { currentShakeMagnitude = Math.max(magnitude, currentShakeMagnitude); shakeEndTime = Math.max(newEndTime, shakeEndTime); }
   }

    // --- Main Render Function ---
    // Signature simplified, assumes Renderer manages shake state internally
    function drawGame(ctx, appState, stateToRender, localPlayerMuzzleFlashRef, canvasWidth, canvasHeight) {
        const now = performance.now();
        CANVAS_WIDTH = canvasWidth; // Update internal knowledge of size
        CANVAS_HEIGHT = canvasHeight;
        let shakeApplied = false; let shakeOffsetX = 0; let shakeOffsetY = 0;

        // Check and apply internal shake state
        if (currentShakeMagnitude > 0 && now < shakeEndTime) {
            shakeApplied = true;
            const timeRemaining = shakeEndTime - now;
            const initialDuration = shakeEndTime - (shakeEndTime - currentShakeMagnitude > 0 ? (shakeEndTime - (currentShakeMagnitude * 1000)) : 0); // Rough estimate of original duration
            let currentMag = currentShakeMagnitude;
            // Simple linear decay example - adjust if needed
            if (initialDuration > 0) { currentMag = currentShakeMagnitude * (timeRemaining / initialDuration); }
            if (currentMag > 0.5) { // Only apply if magnitude is noticeable
                const shakeAngle = Math.random() * Math.PI * 2;
                shakeOffsetX = Math.cos(shakeAngle) * currentMag;
                shakeOffsetY = Math.sin(shakeAngle) * currentMag;
            } else {
                currentShakeMagnitude = 0; // Stop shake if magnitude gets too small
            }
        } else if (currentShakeMagnitude > 0 && now >= shakeEndTime) {
             currentShakeMagnitude = 0; // Reset magnitude if time expired
             shakeEndTime = 0;
        }

        // --- FIX: Ensure Background is Drawn Correctly ---
        // 1. Draw Background (from offscreen canvas, handles transitions)
        ctx.globalAlpha = 1.0; // Reset alpha before drawing background
        if (!isBackgroundReady) {
            // Fallback: Draw base color if offscreen isn't ready yet
            ctx.fillStyle = dayBaseColor; // Use internal constant
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
             // Attempt to generate initial background if somehow missed
             if (appState.serverState && currentBackgroundIsNight === null) {
                console.warn("Background wasn't ready, attempting initial generation in drawGame.");
                updateGeneratedBackground(appState.serverState.is_night, CANVAS_WIDTH, CANVAS_HEIGHT);
             }
        } else if (isTransitioningBackground) {
            // Handle fade effect
            const elapsed = now - transitionStartTime;
            const progress = Math.min(1.0, elapsed / BACKGROUND_FADE_DURATION_MS);
            ctx.globalAlpha = 1.0;
            ctx.drawImage(oldOffscreenCanvas, 0, 0); // Draw old bg fully opaque
            ctx.globalAlpha = progress;
            ctx.drawImage(offscreenCanvas, 0, 0); // Draw new bg fading in
            ctx.globalAlpha = 1.0; // Reset alpha
            if (progress >= 1.0) {
                isTransitioningBackground = false;
                // Update internal state tracker AFTER transition completes
                 currentBackgroundIsNight = offscreenCanvas.dataset.isNight === 'true'; // Assuming this was set during generation
                 log("[Renderer] Background transition complete.");
            }
        } else {
            // Normal: Draw current generated background
            ctx.globalAlpha = 1.0;
            ctx.drawImage(offscreenCanvas, 0, 0);
        }
        // --- End Background Fix ---


        // 2. Apply Shake Transform
        if (shakeApplied) { ctx.save(); ctx.translate(shakeOffsetX, shakeOffsetY); }

        // --- Draw Game World Elements (Under Shake) ---
        if (!stateToRender) { if (shakeApplied) ctx.restore(); return; } // Guard clause

        // Need access to globals from index.html: snake, activeSpeechBubbles, activeEnemyBubbles
        // Pass them or ensure Renderer has access if they become part of appState later.
        // Assuming access to global 'snake' object here:
        drawCampfire(ctx, stateToRender.campfire, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (typeof snake !== 'undefined') drawSnake(ctx, snake); // Check if snake exists globally

        drawPowerups(ctx, stateToRender.powerups);
        drawBullets(ctx, stateToRender.bullets);

        // Pass necessary global state refs to drawing functions
        if (typeof activeEnemyBubbles !== 'undefined') drawEnemies(ctx, stateToRender.enemies, activeEnemyBubbles);
        if (typeof activeSpeechBubbles !== 'undefined') drawPlayers(ctx, stateToRender.players, appState, localPlayerMuzzleFlashRef); // Includes health/armor
        if (typeof activeSpeechBubbles !== 'undefined') drawSpeechBubbles(ctx, stateToRender.players, activeSpeechBubbles, appState);
        if (typeof activeEnemyBubbles !== 'undefined') drawEnemySpeechBubbles(ctx, stateToRender.enemies, activeEnemyBubbles);

        drawDamageTexts(ctx, stateToRender.damage_texts);

        // Muzzle flash
        let shouldDrawMuzzleFlash = localPlayerMuzzleFlashRef.active && (now < localPlayerMuzzleFlashRef.endTime);
        if (shouldDrawMuzzleFlash) { drawMuzzleFlash(ctx, appState.renderedPlayerPos.x, appState.renderedPlayerPos.y, localPlayerMuzzleFlashRef.aimDx, localPlayerMuzzleFlashRef.aimDy); }
        else if (localPlayerMuzzleFlashRef.active) { localPlayerMuzzleFlashRef.active = false; }

        // 3. Restore Shake Transform
        if (shakeApplied) { ctx.restore(); }

        // --- Draw Overlays (Not Affected by Shake) ---
        const localPlayerState = stateToRender.players?.[appState.localPlayerId];
        // Vignette
        if (localPlayerState && localPlayerState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD) { const vignetteIntensity = 1.0 - (localPlayerState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD); drawDamageVignette(ctx, vignetteIntensity, CANVAS_WIDTH, CANVAS_HEIGHT); }
        // Temperature Tint
        drawTemperatureTint(ctx, appState.currentTemp, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Rain/Dust Overlays (Optional visual additions)
         if (appState.isRaining) {
             ctx.fillStyle = 'rgba(50, 80, 150, 0.15)'; // Slightly reduced alpha
             ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
         } else if (appState.isDustStorm) {
             ctx.fillStyle = 'rgba(180, 140, 90, 0.2)'; // Slightly reduced alpha
             ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
         }

        ctx.globalAlpha = 1.0; // Final safety alpha reset
    } // --- End drawGame function ---

    // Expose public functions
    return {
        drawGame,
        triggerShake,
        updateGeneratedBackground
        // Expose internal draw functions ONLY if absolutely needed externally (unlikely)
        // drawPlayers, drawEnemies, etc. are typically internal implementation details.
    };
})(); // End Renderer module IIFE

// Log completion (optional)
console.log("--- Renderer.js: Executed. Renderer object defined?", typeof Renderer);
