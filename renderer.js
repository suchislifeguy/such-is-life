
                // renderer.js

        // --- Rendering Module ---
        const Renderer = (() => {
            console.log("--- Renderer.js: Starting execution ---");

            // --- Offscreen Canvas for Background Rendering ---
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 1600;
            offscreenCanvas.height = 900;
            const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false }); // Optimize for no transparency
            let isBackgroundReady = false;           // Has the initial background been drawn?
            let currentBackgroundIsNight = null;     // Tracks state of offscreenCanvas (null, true=night, false=day)

            // --- Background Transition State ---
            let isTransitioningBackground = false;   // Is fade animation active?
            let transitionStartTime = 0;             // Timestamp when transition started
            const BACKGROUND_FADE_DURATION_MS = 1000;// Duration of the fade effect
            const oldOffscreenCanvas = document.createElement('canvas'); // Stores previous background for fading
            oldOffscreenCanvas.width = 1600;
            oldOffscreenCanvas.height = 900;
            const oldOffscreenCtx = oldOffscreenCanvas.getContext('2d', { alpha: false });

            // --- Base Background Colors ---
            const dayBaseColor = '#8FBC8F';    // Base color for daytime background generation
            const nightBaseColor = '#3E2723';  // Base color for nighttime background generation

            // --- Cached CSS Variables for Drawing Performance ---
            const fontFamily = "'Courier New', monospace";            // Damage Text Styles
            const damageTextColor = '#FFFFFF';
            const damageTextCritColor = '#FFD700';
            const damageTextFontSize = 14;
            const damageTextCritFontSize = 18;
            // Player Colors (Health bars use these too)
            const playerColor = '#DC143C';
            const otherPlayerColor = '#4682B4';
            // Player Character Drawing Colors (could be CSS vars if more dynamic theming needed)
            const playerHeadColor = '#D2B48C';      const playerHelmetColor = '#CCCCCC';
            const playerSlitColor = '#222222';      const playerCoatColor = '#8B4513';
            const playerBootColor = '#222222';      const playerGunColor = '#444444';
            const playerTorsoSelfColor = '#A00000'; const playerTorsoOtherColor = '#004488';
            const dustyPlayerSelfColor = '#8B4513';   // Specific brown/dusty look for local player
            const dustyPlayerOtherColor = '#556B2F';  // Specific green/dusty look for other players
            // Enemy Character Drawing Colors
            const enemySkinColor = '#D2B48C';       const enemyCoatColor = '#8B4513';
            const enemyTorsoChaserColor = '#2F4F4F';const enemyTorsoShooterColor = '#4682B4';
            const enemyTorsoGiantColor = '#6B4226';
            const enemyBootColor = '#222222';       const enemyCapColor = '#111111';
            const enemyHitFlashColor = 'rgba(255, 255, 255, 0.7)'; // Visual effect on hit
            // Bullet Colors
            const bulletPlayerColor = '#ffed4a';
            const bulletEnemyColor = '#ff0000'; // Note: CSS uses #ff0000, using grey here?
            // Health & Armor Bar Colors
            const healthBarBg = '#444';
            const healthBarHigh = '#66bb6a';
            const healthBarMedium = '#FFD700';
            const healthBarLow = '#DC143C'; // Use cached playerColor
            const armorBarColor = '#9e9e9e';
            // Powerup Colors (Mapped by type in drawPowerupSquare)
            const powerupHealthColor = '#81c784';
            const powerupGunColor = '#442848';
            const powerupSpeedColor = '#3edef3';
            const powerupArmorColor = '#9e9e9e'; // Reuse armor bar color
            const powerupShotgunColor = '#FFA500'; const powerupSlugColor = '#A0522D';
            const powerupRapidColor = '#FFFF00'; const powerupScoreColor = '#FFD700';
            const powerupDefaultColor = '#888'; // Fallback for unknown types
            // Speech Bubble Colors
            const playerSpeechBubbleColor = '#d0d8d7';
            const playerSpeechBubbleBg = 'rgba(0, 0, 0, 0.7)';
            const playerSpeechBubbleOutline = 'rgba(200, 200, 200, 0.5)';
            const enemySpeechBubbleColor = '#FFAAAA';
            const enemySpeechBubbleBg = 'rgba(70, 0, 0, 0.7)';
            const enemySpeechBubbleOutline = 'rgba(200, 150, 150, 0.5)';
            // Campfire Colors
            const campfireAuraColor = 'rgba(255, 165, 0, 0.15)';
            const campfireStickColor = '#8B4513';
            const campfireFlameOuterColor = 'rgba(255, 165, 0, 0.6)';
            const campfireFlameInnerColor = 'rgba(255, 255, 0, 0.7)';
            // Muzzle Flash Color
            const muzzleFlashColor = 'rgba(255, 220, 50, 0.9)';
            // Idle Animation Parameters
            const IDLE_BOB_SPEED = 600; // Divisor for time (higher = slower bob)
            const IDLE_BOB_AMPLITUDE = 3; // Max pixel offset for bobbing

            // --- Screen Shake State ---
            let currentShakeMagnitude = 0;    // Current intensity of the shake
            let shakeEndTime = 0;             // Timestamp when shake effect should end

            // Helper to draw rounded rectangles (used for speech bubbles)
            function drawRoundedRect(ctx, x, y, width, height, radius) {
                if (width < 2 * radius) radius = width / 2; if (height < 2 * radius) radius = height / 2;
                ctx.beginPath(); ctx.moveTo(x + radius, y);
                ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius);
                ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius);
                ctx.closePath();
            }

            // --- Drawing Functions ---

            // Draws floating damage numbers, handling crits and pulsing
            function drawDamageTexts(ctx, damageTexts, fontFamily, damageTextColor, damageTextCritColor, damageTextFontSize, damageTextCritFontSize) {
                if (!damageTexts) return;
                const now = performance.now();
                const pulseDuration = 250; const pulseMaxSizeIncrease = 4; // Crit pulse effect params
                ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';

                Object.values(damageTexts).forEach(dmgText => {
                    if (!dmgText) return;
                    const x = dmgText.x ?? 0; const y = dmgText.y ?? 0;
                    const text = dmgText.text ?? '?'; const isCrit = dmgText.is_crit ?? false;
                    const spawnTime = dmgText.spawn_time ? dmgText.spawn_time * 1000 : now; // Server sends seconds
                    const timeSinceSpawn = now - spawnTime;
                    let currentFontSize = isCrit ? damageTextCritFontSize : damageTextFontSize;
                    let currentFillColor = isCrit ? damageTextCritColor : damageTextColor;

                    // Apply crit pulse effect
                    if (isCrit && timeSinceSpawn < pulseDuration) {
                        const pulseProgress = Math.sin((timeSinceSpawn / pulseDuration) * Math.PI); // 0 -> 1 -> 0 wave
                        currentFontSize += pulseProgress * pulseMaxSizeIncrease;
                    }
                    ctx.font = `bold ${Math.round(currentFontSize)}px ${fontFamily}`;
                    ctx.fillStyle = currentFillColor;
                    ctx.fillText(text, x, y);
                });
            }

            // Draws the campfire visual effect (aura, sticks, flame)
            function drawCampfire(ctx, campfireData, CANVAS_WIDTH, CANVAS_HEIGHT, campfireAuraColor, campfireStickColor, campfireFlameOuterColor, campfireFlameInnerColor) {
                if (!campfireData || !campfireData.active) return; // Only draw if active (night)
                const x = campfireData.x ?? CANVAS_WIDTH / 2; const y = campfireData.y ?? CANVAS_HEIGHT / 2;
                const radius = campfireData.radius ?? 0; if (radius <= 0) return;
                const stickWidth = 20; const stickHeight = 4; const flameWidth = 15; const flameHeight = 25;

                ctx.save();
                // Aura
                ctx.fillStyle = campfireAuraColor; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
                // Sticks (rotated slightly)
                const stickOffsetY = 5; ctx.fillStyle = campfireStickColor;
                ctx.translate(x, y + stickOffsetY);
                ctx.rotate(Math.PI / 5); ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight); ctx.rotate(-Math.PI / 5);
                ctx.rotate(-Math.PI / 6); ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight); ctx.rotate(Math.PI / 6);
                ctx.translate(-x, -(y + stickOffsetY));
                // Flame (layered ellipses)
                const flameOffsetY = -10; const flameCenterX = x; const flameCenterY = y + flameOffsetY;
                ctx.fillStyle = campfireFlameOuterColor; ctx.beginPath(); ctx.ellipse(flameCenterX, flameCenterY, flameWidth / 2, flameHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = campfireFlameInnerColor; ctx.beginPath(); ctx.ellipse(flameCenterX, flameCenterY - 3, flameWidth / 3, flameHeight / 3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            // Draws the muzzle flash effect at the end of the player's gun
            function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy, muzzleFlashColor) {
                const flashSizeBase = 10; const flashSizeVariation = 5; const offsetDistance = 12;
                const flashX = playerX + aimDx * offsetDistance; const flashY = playerY + aimDy * offsetDistance;
                const flashSize = flashSizeBase + Math.random() * flashSizeVariation;
                ctx.fillStyle = muzzleFlashColor; ctx.beginPath(); ctx.arc(flashX, flashY, flashSize / 2, 0, Math.PI * 2); ctx.fill();
            }

            // Draws a red vignette effect around the screen edges when player health is low
            function drawDamageVignette(ctx, intensity, CANVAS_WIDTH, CANVAS_HEIGHT) {
                if (intensity <= 0) return;
                ctx.save();
                const outerRadius = Math.sqrt(CANVAS_WIDTH**2 + CANVAS_HEIGHT**2) / 2; // Diagonal radius
                const gradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, outerRadius);
                const redAlpha = 0.4 * intensity; // Max 40% opacity red
                gradient.addColorStop(0, 'rgba(255, 0, 0, 0)'); // Transparent center
                gradient.addColorStop(0.75, 'rgba(255, 0, 0, 0)'); // Transparent out to 75%
                gradient.addColorStop(1, `rgba(255, 0, 0, ${redAlpha.toFixed(2)})`); // Fade to red at edge
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.restore();
            }

            // Draws active speech bubbles for enemies based on server state
            function drawEnemySpeechBubbles(ctx, enemiesToRender, activeEnemyBubbles, fontFamily, enemySpeechBubbleBg, enemySpeechBubbleOutline, enemySpeechBubbleColor, ENEMY_DEFAULTS) {
                const now = performance.now();
                const bubbleFont = 'italic 11px ' + fontFamily;
                const cornerRadius = 4; const textPadding = 3; const bubbleOffset = 20; // Positioning constants
                ctx.font = bubbleFont; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                const enemyIdsToRemove = []; // Track bubbles that expired or whose owner disappeared

                for (const enemyId in activeEnemyBubbles) {
                    const bubble = activeEnemyBubbles[enemyId];
                    if (now >= bubble.endTime) { enemyIdsToRemove.push(enemyId); continue; } // Expired
                    const enemy = enemiesToRender?.[enemyId]; // Find corresponding enemy in current state
                    if (enemy && enemy.health > 0) { // Only draw if enemy exists and is alive
                        const enemyDrawX = enemy.x; const enemyDrawY = enemy.y;
                        const enemyHeight = enemy.height ?? ENEMY_DEFAULTS.height;
                        const bubbleY = enemyDrawY - (enemyHeight / 2) - bubbleOffset; // Position above enemy
                        const textMetrics = ctx.measureText(bubble.text);
                        const textWidth = textMetrics.width; const boxWidth = textWidth + textPadding * 2;
                        const approxFontHeight = 11; const boxHeight = approxFontHeight + textPadding * 2;
                        const boxX = enemyDrawX - boxWidth / 2; const boxY = bubbleY - boxHeight;

                        ctx.fillStyle = enemySpeechBubbleBg; drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); ctx.fill();
                        ctx.strokeStyle = enemySpeechBubbleOutline; ctx.lineWidth = 1; ctx.stroke();
                        ctx.fillStyle = enemySpeechBubbleColor; ctx.fillText(bubble.text, enemyDrawX, bubbleY - textPadding);
                    } else { enemyIdsToRemove.push(enemyId); } // Remove if enemy no longer valid
                }
                enemyIdsToRemove.forEach(id => { delete activeEnemyBubbles[id]; }); // Clean up expired/invalid bubbles
            }

            // Draws active speech bubbles for players (e.g., from chat)
            function drawSpeechBubbles(ctx, playersToRender, activeSpeechBubbles, fontFamily, playerSpeechBubbleBg, playerSpeechBubbleOutline, playerSpeechBubbleColor, PLAYER_DEFAULTS, appState) {
                const now = performance.now();
                const bubbleFont = 'bold 12px ' + fontFamily;
                const cornerRadius = 5; const textPadding = 4; const bubbleOffset = 30;
                ctx.font = bubbleFont; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                const playerIdsToRemove = [];

                for (const playerId in activeSpeechBubbles) {
                    const bubble = activeSpeechBubbles[playerId];
                    if (now >= bubble.endTime) { playerIdsToRemove.push(playerId); continue; }
                    const player = playersToRender?.[playerId];
                    // Only draw if player exists and is not dead
                    if (player && player.player_status !== 'dead' && player.health > 0) {
                        // Use interpolated/predicted position for smoothness
                        const playerDrawX = (playerId === appState.localPlayerId) ? appState.renderedPlayerPos.x : player.x;
                        const playerDrawY = (playerId === appState.localPlayerId) ? appState.renderedPlayerPos.y : player.y;
                        const playerHeight = player.height ?? PLAYER_DEFAULTS.height;
                        const bubbleY = playerDrawY - (playerHeight / 2) - bubbleOffset;
                        const textMetrics = ctx.measureText(bubble.text);
                        const textWidth = textMetrics.width; const boxWidth = textWidth + textPadding * 2;
                        const approxFontHeight = 12; const boxHeight = approxFontHeight + textPadding * 2;
                        const boxX = playerDrawX - boxWidth / 2; const boxY = bubbleY - boxHeight;

                        ctx.fillStyle = playerSpeechBubbleBg; drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, cornerRadius); ctx.fill();
                        ctx.strokeStyle = playerSpeechBubbleOutline; ctx.lineWidth = 1; ctx.stroke();
                        ctx.fillStyle = playerSpeechBubbleColor; ctx.fillText(bubble.text, playerDrawX, bubbleY - textPadding);
                    } else { playerIdsToRemove.push(playerId); } // Remove if player invalid
                }
                playerIdsToRemove.forEach(id => { delete activeSpeechBubbles[id]; });
            }

            function drawSnake(ctx, snake) {
                // Draw based on snake.isActiveFromServer flag, controlled by server state
                if (!snake.isActiveFromServer || !snake.segments || snake.segments.length < 2) return; // Need at least 2 points to draw a line

                const snakeLineColor = '#261a0d';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = snakeLineColor;
                ctx.lineWidth = snake.lineWidth; // Use snake.lineWidth defined in the snake object
                ctx.beginPath();

                // Start drawing from the tail segment
                ctx.moveTo(snake.segments[snake.segments.length - 1].x, snake.segments[snake.segments.length - 1].y);

                // Draw lines smoothly through the segments (e.g., using quadratic curves)
                for (let i = snake.segments.length - 2; i >= 1; i--) {
                    const seg = snake.segments[i];
                    const nextSeg = snake.segments[i - 1];
                    if (!seg || !nextSeg) continue;
                    // Calculate midpoint for curve control point
                    const xc = (seg.x + nextSeg.x) / 2;
                    const yc = (seg.y + nextSeg.y) / 2;
                    ctx.quadraticCurveTo(seg.x, seg.y, xc, yc);
                }
                // Curve/Line to the head segment
                if (snake.segments.length > 0) {
                    const head = snake.segments[0];
                    if (snake.segments.length > 1) {
                        const neck = snake.segments[1];
                        // Curve from neck towards midpoint between neck and head for smoother connection
                        const xc = (neck.x + head.x) / 2;
                        const yc = (neck.y + head.y) / 2;
                        ctx.quadraticCurveTo(neck.x, neck.y, xc, yc);
                    }
                    // Ensure final line goes exactly to the head
                    ctx.lineTo(head.x, head.y);
                }

                ctx.stroke();
            }

            // Iterates through players and calls drawPlayerCharacter for each alive/downed player
            function drawPlayers(ctx, players, appState, PLAYER_DEFAULTS, playerColor, otherPlayerColor, localPlayerMuzzleFlash) {
                 if (!players) return;
                 Object.values(players).forEach(player => {
                     if (!player || player.player_status === 'dead') return; // Skip dead players
                     const isSelf = player.id === appState.localPlayerId;
                     const playerStatus = player.player_status || 'alive';
                     // Use smoothed render position for local player, direct server pos for others (handled by interpolation later)
                     const drawX = isSelf ? appState.renderedPlayerPos.x : player.x;
                     const drawY = isSelf ? appState.renderedPlayerPos.y : player.y;
                     const width = player.width ?? PLAYER_DEFAULTS.width;
                     const height = player.height ?? PLAYER_DEFAULTS.height;
                     const maxHealth = player.max_health ?? PLAYER_DEFAULTS.max_health;
                     const currentArmor = player.armor ?? 0;
                     let isDown = (playerStatus === 'down');
                     let alpha = isDown ? 0.4 : 1.0; // Fade downed players

                     ctx.save(); ctx.globalAlpha = alpha;
                     // Aim direction needed for drawing the gun correctly for local player
                     const aimDx = isSelf ? localPlayerMuzzleFlash.aimDx : 0;
                     const aimDy = isSelf ? localPlayerMuzzleFlash.aimDy : 0;
                     drawPlayerCharacter(ctx, drawX, drawY, width, height, isSelf, player, aimDx, aimDy);
                     ctx.restore();

                     // Draw health/armor bars only if player is alive
                     if (playerStatus === 'alive') {
                         drawHealthBar(ctx, drawX, drawY, width, player.health, maxHealth, healthBarBg, healthBarHigh, healthBarMedium, healthBarLow);
                         if (currentArmor > 0) drawArmorBar(ctx, drawX, drawY, width, currentArmor, healthBarBg, armorBarColor);
                     }
                 });
             }

            // Generates the static background details onto the offscreen canvas
            function generateBackground(offscreenCtx, targetIsNight, CANVAS_WIDTH, CANVAS_HEIGHT) { // <-- NEW SIGNATURE
                log(`[Renderer] Generating background for ${targetIsNight ? 'Night' : 'Day'}`);
                // Ensure this line uses the INTERNAL constants, which it likely already does:
                const baseColor = targetIsNight ? nightBaseColor : dayBaseColor;
                offscreenCtx.fillStyle = baseColor;
                offscreenCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Base fill

                if (!targetIsNight) { // Day Details
                    const numPatches = 100; const numTufts = 150;
                    for (let i = 0; i < numPatches; i++) { // Dirt patches
                        const x = Math.random()*CANVAS_WIDTH; const y = Math.random()*CANVAS_HEIGHT;
                        const radius = Math.random()*40+15; const r = 101+Math.random()*20-10;
                        const g = 67+Math.random()*20-10; const b = 33+Math.random()*20-10;
                        const alpha = Math.random()*0.25+0.20;
                        offscreenCtx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${alpha.toFixed(2)})`;
                        offscreenCtx.beginPath(); offscreenCtx.arc(x, y, radius, 0, Math.PI*2); offscreenCtx.fill();
                    }
                    offscreenCtx.lineWidth = 3; offscreenCtx.strokeStyle = 'rgba(34, 139, 34, 0.6)';
                    for (let i = 0; i < numTufts; i++) { // Grass tufts
                        const x = Math.random()*CANVAS_WIDTH; const y = Math.random()*CANVAS_HEIGHT;
                        offscreenCtx.beginPath(); offscreenCtx.moveTo(x, y);
                        offscreenCtx.lineTo(x+(Math.random()*6-3), y-(Math.random()*6+5)); offscreenCtx.stroke();
                    }
                } else { // Night Details
                    const numPatches = 60; const numStars = 150;
                    for (let i = 0; i < numPatches; i++) { // Dark patches
                        const x = Math.random()*CANVAS_WIDTH; const y = Math.random()*CANVAS_HEIGHT;
                        const radius = Math.random()*50+20; const alpha = Math.random()*0.15+0.1;
                        offscreenCtx.fillStyle = `rgba(5, 2, 2, ${alpha.toFixed(2)})`;
                        offscreenCtx.beginPath(); offscreenCtx.arc(x, y, radius, 0, Math.PI*2); offscreenCtx.fill();
                    }
                    offscreenCtx.fillStyle = 'rgba(255, 255, 240, 0.8)';
                    for (let i = 0; i < numStars; i++) { // Stars
                        const starX = Math.random()*CANVAS_WIDTH; const starY = Math.random()*CANVAS_HEIGHT;
                        const starR = Math.random()*1.5+0.5; offscreenCtx.fillRect(starX, starY, starR, starR);
                    }
                }
                log("[Renderer] Background generation complete.");
                return targetIsNight; // Update state tracker
            }

            // Called externally (e.g., by UI module) to trigger background regeneration/transition
            function updateGeneratedBackground(targetIsNight, CANVAS_WIDTH, CANVAS_HEIGHT) { // <-- NEW SIGNATURE (Removed color params)
                // No change needed inside the function, it should already use the internal consts
                if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) return;
                log(`[Renderer] Request to update background to ${targetIsNight ? 'Night' : 'Day'}.`);
            
                if (isBackgroundReady) {
                    // ... existing transition logic ...
                    // Make sure the call to generateBackground inside here is ALSO updated if needed
                    generateBackground(offscreenCtx, targetIsNight, CANVAS_WIDTH, CANVAS_HEIGHT); // Pass only needed args
                } else {
                    // ... existing first generation logic ...
                    // Make sure the call to generateBackground inside here is ALSO updated if needed
                    currentBackgroundIsNight = generateBackground(offscreenCtx, targetIsNight, CANVAS_WIDTH, CANVAS_HEIGHT); // Pass only needed args
                    // ...
                }
            }

             // Draws the detailed player character sprite
             function drawPlayerCharacter(ctx, x, y, w, h, isSelf, playerState, aimDx, aimDy) {
                 // Color Definitions (Specific to player sprite)
                 const ironHelmetColor = '#3d3d3d'; const ironHelmetHighlight = '#666666'; const ironHelmetShadow = '#1a1a1a';
                 const beltColor = '#412a19'; const bootColor = '#241c1c'; const backgroundShadowColor = 'rgba(0,0,0,0.3)';
                 const simpleChestPlateColor = '#777777'; const chestPlateHighlight = '#999999';
                 const slitColor = '#000000'; const gunColor = '#444444';
                 const sparkColors = ['rgba(255, 100, 0, 0.8)', 'rgba(255, 165, 0, 0.9)', 'rgba(255, 220, 50, 0.7)']; // Hit sparks

                 // State / Animation variables
                 const justHit = playerState?.hit_flash_this_tick ?? false;
                 const isIdle = (playerState?.input_vector?.dx ?? 0) === 0 && (playerState?.input_vector?.dy ?? 0) === 0;
                 const isMoving = !isIdle;
                 const time = performance.now(); // For animations
                 const bobOffset = isIdle ? Math.sin(time / IDLE_BOB_SPEED) * IDLE_BOB_AMPLITUDE : 0; // Idle bobbing

                 const nowSeconds = time / 1000.0;
                 const snakeEffect = playerState?.effects?.snake_bite_slow;
                 const isSnakeBitten = snakeEffect && nowSeconds < snakeEffect.expires_at;

                 // Dimensions (relative to w/h)
                 const helmetHeight = h*0.30; const helmetWidth = w*0.95; const slitHeight = helmetHeight*0.15;
                 const slitWidth = helmetWidth*0.8; const neckGuardHeight = h*0.06; const shoulderPlateWidth = w*1.25;
                 const shoulderPlateHeight = h*0.10; const chestPlateHeight = h*0.30; const chestPlateWidth = w*0.9;
                 const armWidth = w*0.2; const armLength = h*0.4; const beltHeight = h*0.05; const pantsHeight = h*0.35;
                 const bootHeight = h*0.10; const bootWidth = w*0.32; const bootSpacing = w*0.4;

                 // Y Position Calculation (Top-down from center y)
                 const topOffset = h*0.5; const helmetTopY = y-topOffset+bobOffset; const helmetBottomY = helmetTopY+helmetHeight;
                 const slitY = helmetTopY+helmetHeight*0.4; const neckGuardTopY = helmetBottomY-3;
                 const neckGuardBottomY = neckGuardTopY+neckGuardHeight; const shoulderTopY = neckGuardBottomY-2;
                 const shoulderBottomY = shoulderTopY+shoulderPlateHeight; const chestPlateTopY = shoulderTopY+shoulderPlateHeight*0.15;
                 const armTopY = shoulderTopY+shoulderPlateHeight*0.2; const beltY = chestPlateTopY+chestPlateHeight+beltHeight*0.1; // Adjusted belt pos
                 const pantsTopY = beltY+beltHeight*0.4; const pantsBottomY = pantsTopY+pantsHeight;
                 const bootTopY = pantsBottomY-5; const bootBottomY = bootTopY+bootHeight;

                 // Use distinct colors for self vs others
                 const distinguishingColor = isSelf ? '#8B4513' : '#556B2F';

                 ctx.save(); // Start drawing layers

                 // 1. Shadow (underneath everything)
                 ctx.beginPath(); const shadowY = bootBottomY+1;
                 ctx.ellipse(x, shadowY, w*0.45, h*0.05, 0, 0, Math.PI*2); ctx.fillStyle = backgroundShadowColor; ctx.fill();

                 // 2. Pants (using the distinguishing color)
                 ctx.fillStyle = distinguishingColor; const legWidth = w*0.4;
                 ctx.fillRect(x-w*0.45, pantsTopY, legWidth, pantsHeight); ctx.fillRect(x+w*0.05, pantsTopY, legWidth, pantsHeight);

                 // 3. Boots (with stepping animation if moving)
                 ctx.fillStyle = bootColor;
                 if (isMoving) {
                     const stepDuration = 250; const stepPhase = Math.floor(time / stepDuration) % 2;
                     if (stepPhase === 0) { // Left steps
                         ctx.fillRect(x-bootSpacing-bootWidth/2, bootTopY-2, bootWidth, bootHeight); ctx.fillRect(x+bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight);
                     } else { // Right steps
                         ctx.fillRect(x-bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight); ctx.fillRect(x+bootSpacing-bootWidth/2, bootTopY-2, bootWidth, bootHeight);
                     }
                 } else { // Idle stance
                     ctx.fillRect(x-bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight); ctx.fillRect(x+bootSpacing-bootWidth/2, bootTopY, bootWidth, bootHeight);
                 }

                 // 4. Belt
                 ctx.fillStyle = beltColor; ctx.fillRect(x-w*0.65, beltY-beltHeight/2, w*1.3, beltHeight);

                 // 5. Chest Plate
                 ctx.fillStyle = simpleChestPlateColor; ctx.fillRect(x-chestPlateWidth/2, chestPlateTopY, chestPlateWidth, chestPlateHeight);
                 ctx.fillStyle = chestPlateHighlight; ctx.fillRect(x-chestPlateWidth/2+5, chestPlateTopY+5, chestPlateWidth-10, 3); // Highlight

                 // 6. Shoulder Plates
                 ctx.fillStyle = ironHelmetColor; ctx.fillRect(x-shoulderPlateWidth/2, shoulderTopY, shoulderPlateWidth, shoulderPlateHeight);
                 ctx.fillStyle = ironHelmetHighlight; ctx.fillRect(x-shoulderPlateWidth/2+3, shoulderTopY+2, shoulderPlateWidth-6, 2); // Highlight

                 // 7. Arms (using distinguishing color)
                 ctx.fillStyle = distinguishingColor;
                 ctx.fillRect(x-shoulderPlateWidth*0.45, armTopY, armWidth, armLength); ctx.fillRect(x+shoulderPlateWidth*0.45-armWidth, armTopY, armWidth, armLength);

                 // 8. Neck Guard
                 ctx.fillStyle = ironHelmetColor; ctx.fillRect(x-helmetWidth*0.4, neckGuardTopY, helmetWidth*0.8, neckGuardHeight);

                 // 9. Helmet
                 ctx.fillStyle = ironHelmetColor; ctx.fillRect(x-helmetWidth/2, helmetTopY, helmetWidth, helmetHeight);
                 ctx.fillStyle = ironHelmetHighlight; ctx.fillRect(x-helmetWidth/2, helmetTopY, helmetWidth, 3); // Top Highlight
                 ctx.fillStyle = ironHelmetShadow; ctx.fillRect(x-helmetWidth/2+1, helmetTopY+3, helmetWidth-2, 2); // Shadow below highlight

                 // 10. Slit
                 ctx.fillStyle = slitColor; ctx.fillRect(x-slitWidth/2, slitY, slitWidth, slitHeight);

                 // 11. Gun (only for local player, pointing towards aim direction)
                 if (isSelf && (aimDx !== 0 || aimDy !== 0)) { // Check aim direction is non-zero
                    const gunLevel = playerState?.gun ?? 1; const gunLengthBase = 12;
                    const gunLengthBonus = (gunLevel-1)*3; const gunLength = gunLengthBase+gunLengthBonus;
                    const gunThickness = 5+(gunLevel-1)*0.5; const gunOriginY = armTopY+armLength*0.4;
                    const gunOriginXOffset = w*0.1; // Offset from center
                    ctx.save(); ctx.translate(x, gunOriginY);
                    const angle = Math.atan2(aimDy, aimDx); ctx.rotate(angle);
                    ctx.fillStyle = gunColor; ctx.fillRect(gunOriginXOffset, -gunThickness/2, gunLength, gunThickness);
                    ctx.restore();
                }

                // 12. Hit Feedback (Sparks only, flash removed)
                if (justHit) {
                    ctx.save(); // Draw sparks relative to player center
                    const numSparks = 15 + Math.random() * 10;
                    for (let i = 0; i < numSparks; i++) {
                        const angle = Math.random() * Math.PI * 2; const radius = Math.random()*w*0.8 + w*0.2;
                        const particleX = x + Math.cos(angle)*radius; const particleY = y + Math.sin(angle)*radius*0.7 - h*0.1; // Slight upward bias
                        const particleSize = Math.random()*3.5 + 1.5;
                        ctx.fillStyle = sparkColors[Math.floor(Math.random() * sparkColors.length)]; // Random spark color
                        ctx.beginPath(); ctx.arc(particleX, particleY, particleSize/2, 0, Math.PI*2); ctx.fill();
                    }
                    ctx.restore();
                }
                ctx.restore(); // Restore initial context save
            }

           // Iterates through enemies and calls drawEnemyRect for each non-faded one
           function drawEnemies(ctx, enemies, ENEMY_DEFAULTS, ENEMY_TYPE_SHOOTER, enemyTorsoShooterColor, enemyTorsoGiantColor, enemyTorsoChaserColor, enemySkinColor, enemyCoatColor, enemyCapColor, enemyBootColor, enemyHitFlashColor, activeEnemyBubbles) {
               if (!enemies) return;
               const now = performance.now() / 1000; // Use seconds for comparison with server timestamps
               const FADE_DURATION = 0.3; // Seconds enemy corpse is visible

               Object.values(enemies).forEach(enemy => {
                   if (!enemy) return;
                   const width = enemy.width ?? ENEMY_DEFAULTS.width; const height = enemy.height ?? ENEMY_DEFAULTS.height;
                   const maxHealth = enemy.max_health ?? ENEMY_DEFAULTS.max_health;
                   let alpha = 1.0; let shouldDraw = true; let isDying = false;

                   // Handle death fading
                   if (enemy.health <= 0 && enemy.death_timestamp) {
                       isDying = true; const elapsed = now - enemy.death_timestamp;
                       if (elapsed < FADE_DURATION) alpha = 0.4; // Partially faded
                       else shouldDraw = false; // Fully faded, don't draw
                   }

                   if (shouldDraw) {
                       ctx.save(); ctx.globalAlpha = alpha; // Apply fade alpha
                       drawEnemyRect(ctx, enemy.x, enemy.y, width, height, enemy.type, enemy);
                       ctx.restore();
                   }
                   // Draw health bar only if alive and should be drawn
                   if (!isDying && enemy.health > 0 && shouldDraw) {
                        drawHealthBar(ctx, enemy.x, enemy.y, width, enemy.health, maxHealth, healthBarBg, healthBarHigh, healthBarMedium, healthBarLow);
                   }
               });
           }

           // Draws a single enemy rectangle/sprite
           function drawEnemyRect(ctx, x, y, w, h, type, enemyState) {
               // Use dimensions passed from enemyState (w, h arguments)
               const currentW = w;
               const currentH = h;

               // Determine torso color based on type
               const torsoColor = type === 'shooter' ? '#4682B4' : (type === 'giant' ? '#6B4226' : '#2F4F4F');
               // Giants don't bob
               const bobOffset = (type !== 'giant') ? Math.sin(performance.now() / 600) * 3 : 0;
               // Define tint color
               const snakeBiteTintColor = 'rgba(0, 200, 50, 0.15)';

               // Check for active snake bite slow effect from server state
               const nowSeconds = performance.now() / 1000.0;
               const snakeEffect = enemyState?.effects?.snake_bite_slow;
               const isSnakeBitten = snakeEffect && nowSeconds < snakeEffect.expires_at;

               // Geometry scaled by currentW, currentH
               const headRadius = currentH * 0.18;
               const bodyHeight = currentH * 0.5;
               const coatLengthBonus = currentH * 0.15;
               const bodyWidthTop = currentW * 0.9;
               const bodyWidthBottom = currentW * 0.7;
               const coatWidth = currentW * 1.1;
               const armWidth = currentW * 0.2;
               const armLength = currentH * 0.4;
               const capHeight = headRadius * 0.8; // Used only if not giant
               const capWidth = headRadius * 2.2; // Used only if not giant
               const bootSize = currentW * 0.15; // Scale boots with width
               const bootSpacing = currentW * 0.3;

               // Y Positions calculated using currentH and bobOffset
               const headCenterY = y - (currentH / 2) + headRadius + bobOffset;
               const bodyTopY = headCenterY + headRadius * 0.8;
               const bodyBottomY = bodyTopY + bodyHeight;
               const coatTopY = bodyTopY + bodyHeight * 0.1;
               const coatBottomY = bodyBottomY + coatLengthBonus;
               const armTopY = bodyTopY + bodyHeight * 0.05;
               const capTopY = headCenterY - headRadius; // Used only if not giant
               const bootOffsetY = coatBottomY + 2;

               ctx.save();

               // Draw base layers using calculated dimensions
               ctx.fillStyle = '#8B4513';
               ctx.fillRect(x - coatWidth / 2, coatTopY, coatWidth, coatBottomY - coatTopY);
               ctx.fillStyle = torsoColor;
               ctx.beginPath();
               ctx.moveTo(x - bodyWidthTop / 2, bodyTopY);
               ctx.lineTo(x + bodyWidthTop / 2, bodyTopY);
               ctx.lineTo(x + bodyWidthBottom / 2, bodyBottomY);
               ctx.lineTo(x - bodyWidthBottom / 2, bodyBottomY);
               ctx.closePath();
               ctx.fill();
               ctx.fillStyle = '#8B4513';
               ctx.fillRect(x - bodyWidthTop / 2 - armWidth, armTopY, armWidth, armLength);
               ctx.fillRect(x + bodyWidthTop / 2, armTopY, armWidth, armLength);
               ctx.fillStyle = '#D2B48C';
               ctx.beginPath();
               ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
               ctx.fill();
               // Only draw cap if not a giant
               if (type !== 'giant') {
                   ctx.fillStyle = '#111111';
                   ctx.fillRect(x - capWidth / 2, capTopY, capWidth, capHeight);
               }
               ctx.fillStyle = '#222222';
               ctx.fillRect(x - bootSpacing - bootSize / 2, bootOffsetY, bootSize, bootSize);
               ctx.fillRect(x + bootSpacing - bootSize / 2, bootOffsetY, bootSize, bootSize);

               // Apply Snake Bite Tint Overlay if active
               if (isSnakeBitten) {
                   ctx.fillStyle = snakeBiteTintColor;
                   ctx.fillRect(x - currentW * 0.5, y - currentH * 0.5 + bobOffset, currentW, currentH);
               }

               // Apply Hit Flash overlay if active
               if (enemyState?.hit_flash_this_tick) {
                   ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                   const flashMargin = 2;
                   // Ensure flash covers the potentially larger enemy
                   ctx.fillRect(x - currentW / 2 - flashMargin, y - currentH / 2 - flashMargin + bobOffset, currentW + flashMargin * 2, currentH + flashMargin * 2);
               }

               ctx.restore();
           }

           // Iterates through bullets and calls appropriate drawing function
           function drawBullets(ctx, bullets, BULLET_DEFAULTS, bulletPlayerColor, bulletEnemyColor) {
               if (!bullets) return;
               Object.values(bullets).forEach(bullet => {
                   if (!bullet) return;
                   const x = bullet.x ?? 0; const y = bullet.y ?? 0; const vx = bullet.vx ?? 0; const vy = bullet.vy ?? 0;
                   const radius = bullet.radius ?? BULLET_DEFAULTS.radius;
                   const bulletType = bullet.bullet_type || 'standard'; const ownerType = bullet.owner_type;
                   const hasVelocity = Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01;

                   // Choose drawing style based on type and velocity
                   if (bulletType === 'ammo_heavy_slug' || bulletType === 'standard' || bulletType === 'ammo_rapid_fire' || bulletType === 'standard_enemy') {
                       hasVelocity ? drawShapedBullet(ctx, bullet, bulletPlayerColor, bulletEnemyColor) : drawBulletCircle(ctx, x, y, radius, ownerType === 'player', bulletPlayerColor, bulletEnemyColor);
                   } else if (bulletType === 'ammo_shotgun') {
                       drawBulletCircle(ctx, x, y, radius, ownerType === 'player', bulletPlayerColor, bulletEnemyColor); // Shotgun pellets are circles
                   } else {
                       drawBulletCircle(ctx, x, y, radius, ownerType === 'player', bulletPlayerColor, bulletEnemyColor); // Default to circle
                   }
               });
           }

           // Draws a simple circle for a bullet
           function drawBulletCircle(ctx, x, y, r, isPlayerBullet, bulletPlayerColor, bulletEnemyColor) {
               ctx.fillStyle = isPlayerBullet ? bulletPlayerColor : bulletEnemyColor;
               ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
           }

           // Draws a directional, shaped bullet (rectangle with nose cone)
           function drawShapedBullet(ctx, bullet, bulletPlayerColor, bulletEnemyColor) {
               const x = bullet.x; const y = bullet.y; const vx = bullet.vx; const vy = bullet.vy;
               const ownerType = bullet.owner_type; const radius = bullet.radius || 4;
               const baseLength = 8; const baseWidth = 4; const scaleFactor = radius / 4; // Scale based on radius
               const length = baseLength*scaleFactor; const width = baseWidth*scaleFactor;
               const color = (ownerType === 'player') ? bulletPlayerColor : bulletEnemyColor;
               const angle = Math.atan2(vy, vx); // Calculate angle from velocity

               ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
               ctx.fillStyle = color;
               ctx.fillRect(-length/2, -width/2, length, width); // Main body
               const noseLength = length*0.4; // Nose cone part
               ctx.beginPath(); ctx.moveTo(length/2, 0); ctx.lineTo(length/2-noseLength, -width/2);
               ctx.lineTo(length/2-noseLength, width/2); ctx.closePath(); ctx.fill();
               ctx.restore();
           }

           // Iterates through powerups and calls drawPowerupSquare
           function drawPowerups(ctx, powerups, POWERUP_DEFAULTS) {
               if (!powerups) return;
               Object.values(powerups).forEach(powerup => {
                   if (!powerup) return;
                   const size = powerup.size ?? POWERUP_DEFAULTS.size;
                   drawPowerupSquare(ctx, powerup.x, powerup.y, size, powerup.type);
               });
           }

           // Draws a single powerup square with a symbol indicating its type
           function drawPowerupSquare(ctx, x, y, size, type) {
                let fillColor = '#888'; let symbol = '?'; // Defaults
                // Map type to symbol and color
                if (type === 'health') { symbol = '+'; fillColor = '#81c784'; }
                else if (type === 'gun_upgrade') { symbol = 'G'; fillColor = '#442848'; }
                else if (type === 'speed_boost') { symbol = 'S'; fillColor = '#3edef3'; }
                else if (type === 'armor') { symbol = '#'; fillColor = '#9e9e9e'; }
                else if (type === 'ammo_shotgun') { symbol = '::'; fillColor = '#FFA500'; }
                else if (type === 'ammo_heavy_slug') { symbol = '■'; fillColor = '#A0522D'; }
                else if (type === 'ammo_rapid_fire') { symbol = '>'; fillColor = '#FFFF00'; }
                else if (type === 'bonus_score') { symbol = '$'; fillColor = '#FFD700'; }

                ctx.fillStyle = fillColor; ctx.fillRect(x - size/2, y - size/2, size, size); // Draw square
                ctx.fillStyle = '#000'; // Symbol color
                let fontSize = Math.round(size*0.7); ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(symbol, x, y+(size*0.05)); // Draw symbol (slight Y offset for centering)
           }

           // Draws a health bar above an entity
           function drawHealthBar(ctx, x, y, width, currentHealth, maxHealth, healthBarBg, healthBarHigh, healthBarMedium, healthBarLow) {
               if (maxHealth <= 0) return;
               const barHeight = 5; const yOffset = -((width/2) + 27); // Position above entity
               const barWidth = Math.max(20, width*0.8); // Scale with entity width
               const currentWidth = Math.max(0, (currentHealth/maxHealth)*barWidth);
               const healthPercentage = currentHealth / maxHealth;
               const barX = x - barWidth/2; const barY = y + yOffset;

               ctx.fillStyle = healthBarBg; ctx.fillRect(barX, barY, barWidth, barHeight); // Background
               // Determine color based on health percentage
               let barColor = healthBarLow;
               if (healthPercentage > 0.66) barColor = healthBarHigh;
               else if (healthPercentage > 0.33) barColor = healthBarMedium;
               ctx.fillStyle = barColor; ctx.fillRect(barX, barY, currentWidth, barHeight); // Foreground (current health)
           }

           // Draws an armor bar below the health bar
           function drawArmorBar(ctx, x, y, width, currentArmor, healthBarBg, armorBarColor) {
               const maxArmor = 100; if (currentArmor <= 0) return;
               const armorBarHeight = 4; const healthBarHeight = 5; const barSpacing = 1;
               const healthBarYOffset = -((width/2) + 30); // Position based on entity width
               const healthBarTopY = y + healthBarYOffset;
               const armorBarTopY = healthBarTopY + healthBarHeight + barSpacing; // Position below health bar
               const barWidth = Math.max(20, width*0.8);
               const currentWidth = Math.max(0, (currentArmor / maxArmor)*barWidth);
               const barX = x - barWidth/2; const barY = armorBarTopY;

               ctx.fillStyle = healthBarBg; ctx.fillRect(barX, barY, barWidth, armorBarHeight); // Background
               ctx.fillStyle = armorBarColor; ctx.fillRect(barX, barY, currentWidth, armorBarHeight); // Foreground
           }

           // Main rendering function called each frame by the game loop
           function drawGame(ctx, appState, Game, shakeApplied, shakeOffsetX, shakeOffsetY, CANVAS_WIDTH, CANVAS_HEIGHT, currentShakeMagnitude, localPlayerMuzzleFlash, dayBaseColor, nightBaseColor, IDLE_BOB_SPEED, IDLE_BOB_AMPLITUDE, stateToRender) {

               const now = performance.now();

               // 1. Draw Background (from offscreen canvas, handles transitions)
               if (!isBackgroundReady) { // Fallback if first background not generated yet
                    ctx.fillStyle = dayBaseColor; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
               } else if (isTransitioningBackground) { // Handle fade effect
                    const elapsed = now - transitionStartTime;
                    const progress = Math.min(1.0, elapsed / 1000);
                    ctx.globalAlpha = 1.0; ctx.drawImage(oldOffscreenCanvas, 0, 0); // Draw old bg
                    ctx.globalAlpha = progress; ctx.drawImage(offscreenCanvas, 0, 0); // Draw new bg fading in
                    ctx.globalAlpha = 1.0; // Reset alpha for other drawing
                    if (progress >= 1.0) { isTransitioningBackground = false; } // End transition
               } else { // Normal: Draw current background
                    ctx.drawImage(offscreenCanvas, 0, 0);
               }

           let snakeCopy = {...snake};
          drawSnake(ctx, snakeCopy);
               // 3. Get Interpolated State to Render
               // Ensure stateToRender is properly calculated based on the game mode
               if (appState.mode === 'singleplayer') { // SP uses direct state
                   //stateToRender = appState.serverState;
                   const spPlayer = stateToRender?.players[appState.localPlayerId];
                   if (spPlayer) { appState.renderedPlayerPos.x = spPlayer.x; appState.renderedPlayerPos.y = spPlayer.y; }
               } else { // MP uses interpolated state for smoothness
                   //stateToRender = Game.getInterpolatedState(now); // Requires Game module reference
               }

               // 4. Guard Clause: Don't draw if essential state is missing
               if (!stateToRender || !appState.localPlayerId || !stateToRender.players) {
                   if (shakeApplied) { ctx.restore(); } // Restore shake transform if applied before returning
                   return;
               }

               // 5. Check for Local Muzzle Flash
               let shouldDrawMuzzleFlash = localPlayerMuzzleFlash.active && (now < localPlayerMuzzleFlash.endTime);
               if (!shouldDrawMuzzleFlash && localPlayerMuzzleFlash.active) { localPlayerMuzzleFlash.active = false; }

               // 6. Draw Game Entities (Order Matters for Layering)
               // Drawn with shake transform applied if active
               drawCampfire(ctx, stateToRender.campfire, CANVAS_WIDTH, CANVAS_HEIGHT, campfireAuraColor, campfireStickColor, campfireFlameOuterColor, campfireFlameInnerColor);
               if (shouldDrawMuzzleFlash) { drawMuzzleFlash(ctx, appState.renderedPlayerPos.x, appState.renderedPlayerPos.y, localPlayerMuzzleFlash.aimDx, localPlayerMuzzleFlash.aimDy, muzzleFlashColor); }
               drawPowerups(ctx, stateToRender.powerups, POWERUP_DEFAULTS);
               drawBullets(ctx, stateToRender.bullets, BULLET_DEFAULTS, bulletPlayerColor, bulletEnemyColor);
               drawEnemies(ctx, stateToRender.enemies, ENEMY_DEFAULTS, ENEMY_TYPE_SHOOTER, enemyTorsoShooterColor, enemyTorsoGiantColor, enemyTorsoChaserColor, enemySkinColor, enemyCoatColor, enemyCapColor, enemyBootColor, enemyHitFlashColor, activeEnemyBubbles);
               drawPlayers(ctx, stateToRender.players, appState, PLAYER_DEFAULTS, playerColor, otherPlayerColor, localPlayerMuzzleFlash);
               drawSpeechBubbles(ctx, stateToRender.players, activeSpeechBubbles, fontFamily, playerSpeechBubbleBg, playerSpeechBubbleOutline, playerSpeechBubbleColor, PLAYER_DEFAULTS, appState);
               drawEnemySpeechBubbles(ctx, stateToRender.enemies, activeEnemyBubbles, fontFamily, enemySpeechBubbleBg, enemySpeechBubbleOutline, enemySpeechBubbleColor, ENEMY_DEFAULTS);
               drawDamageTexts(ctx, stateToRender.damage_texts, fontFamily, damageTextColor, damageTextCritColor, damageTextFontSize, damageTextCritFontSize);

           }
                function triggerShake(magnitude, durationMs) {
               const now = performance.now();
               const newEndTime = now + durationMs;
               // Apply if new shake is stronger or lasts longer than current one
               if (magnitude >= currentShakeMagnitude || newEndTime >= shakeEndTime) {
                    currentShakeMagnitude = Math.max(magnitude, currentShakeMagnitude);
                    shakeEndTime = Math.max(newEndTime, shakeEndTime);
               }
           }
           

                function drawDamageVignette(intensity) {
                    if (intensity <= 0) return;
                    ctx.save();
                    const outerRadius = Math.sqrt(1600**2 + 900**2) / 2; // Diagonal radius
                    const gradient = ctx.createRadialGradient(1600 / 2, 900 / 2, 0, 1600 / 2, 900 / 2, outerRadius);
                    const redAlpha = 0.4 * intensity; // Max 40% opacity red
                    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)'); // Transparent center
                    gradient.addColorStop(0.75, 'rgba(255, 0, 0, 0)'); // Transparent out to 75%
                    gradient.addColorStop(1, `rgba(255, 0, 0, ${redAlpha.toFixed(2)})`); // Fade to red at edge
                    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1600, 900);
                    ctx.restore();
                }

           function generateBackground(targetIsNight) {
               log(`[Renderer] Generating background for ${targetIsNight ? 'Night' : 'Day'}`);
               const baseColor = targetIsNight ? '#3E2723' : '#8FBC8F';
               offscreenCtx.fillStyle = baseColor;
               offscreenCtx.fillRect(0, 0, 1600, 900); // Base fill

               if (!targetIsNight) { // Day Details
                   const numPatches = 100; const numTufts = 150;
                   for (let i = 0; i < numPatches; i++) { // Dirt patches
                       const x = Math.random()*1600; const y = Math.random()*900;
                       const radius = Math.random()*40+15; const r = 101+Math.random()*20-10;
                       const g = 67+Math.random()*20-10; const b = 33+Math.random()*20-10;
                       const alpha = Math.random()*0.25+0.20;
                       offscreenCtx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${alpha.toFixed(2)})`;
                       offscreenCtx.beginPath(); offscreenCtx.arc(x, y, radius, 0, Math.PI*2); offscreenCtx.fill();
                   }
                   offscreenCtx.lineWidth = 3; offscreenCtx.strokeStyle = 'rgba(34, 139, 34, 0.6)';
                   for (let i = 0; i < numTufts; i++) { // Grass tufts
                       const x = Math.random()*1600; const y = Math.random()*900;
                       offscreenCtx.beginPath(); offscreenCtx.moveTo(x, y);
                       offscreenCtx.lineTo(x+(Math.random()*6-3), y-(Math.random()*6+5)); offscreenCtx.stroke();
                   }
               } else { // Night Details
                   const numPatches = 60; const numStars = 150;
                   for (let i = 0; i < numPatches; i++) { // Dark patches
                       const x = Math.random()*1600; const y = Math.random()*900;
                       const radius = Math.random()*50+20; const alpha = Math.random()*0.15+0.1;
                       offscreenCtx.fillStyle = `rgba(5, 2, 2, ${alpha.toFixed(2)})`;
                       offscreenCtx.beginPath(); offscreenCtx.arc(x, y, radius, 0, Math.PI*2); offscreenCtx.fill();
                   }
                   offscreenCtx.fillStyle = 'rgba(255, 255, 240, 0.8)';
                   for (let i = 0; i < numStars; i++) { // Stars
                       const starX = Math.random()*1600; const starY = Math.random()*900;
                       const starR = Math.random()*1.5+0.5; offscreenCtx.fillRect(starX, starY, starR, starR);
                   }
               }
               log("[Renderer] Background generation complete.");
               return targetIsNight; // Update state tracker
           }
                    
           function updateGeneratedBackground(targetIsNight) {
               // No change needed if background is already correct and ready
               if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) return;
               log(`[Renderer] Request to update background to ${targetIsNight ? 'Night' : 'Day'}.`);

               if (isBackgroundReady) { // Start transition if a previous background exists
                   log("[Renderer] Starting background transition...");
                   isTransitioningBackground = true; transitionStartTime = performance.now();
                   // Copy current background to the 'old' canvas for fading
                   oldOffscreenCtx.clearRect(0, 0, 1600, 900);
                   oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0);
                   // Generate the new background onto the main offscreen canvas
                   generateBackground(targetIsNight);
               } else { // First time: generate directly, no transition
                   log("[Renderer] First background generation.");
                   currentBackgroundIsNight = generateBackground(targetIsNight);
                   isBackgroundReady = true; log("[Renderer] isBackgroundReady set to true.");
               }
           }
             function drawEnemySpeechBubbles(enemiesToRender) {
               const now = performance.now();
               const bubbleFont = 'italic 11px ' + "'Courier New', monospace";
               const cornerRadius = 4; const textPadding = 3; const bubbleOffset = 20; // Positioning constants
               ctx.font = bubbleFont; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
               const enemyIdsToRemove = []; // Track bubbles that expired or whose owner disappeared

               for (const enemyId in activeEnemyBubbles) {
                   const bubble = activeEnemyBubbles[enemyId];
                   if (now >= bubble.endTime) { enemyIdsToRemove.push(enemyId); continue; } // Expired
                   const enemy = enemiesToRender?.[enemyId]; // Find corresponding enemy in current state
                   if (enemy && enemy.health > 0) { // Only draw if enemy exists and is alive
                       const enemyDrawX = enemy.x; const enemyDrawY = enemy.y;
                       const enemyHeight = enemy.height ?? 40;
                       const bubbleY = enemyDrawY - (enemyHeight / 2) - bubbleOffset; // Position above enemy
                       const textMetrics = ctx.measureText(bubble.text);
                       const textWidth = textMetrics.width; const boxWidth = textWidth + textPadding * 2;
                       const approxFontHeight = 11; const boxHeight = approxFontHeight + textPadding * 2;
                       const boxX = enemyDrawX - boxWidth / 2; const boxY = bubbleY - boxHeight;

                       ctx.fillStyle = 'rgba(70, 0, 0, 0.7)'; drawRoundedRect(boxX, boxY, boxWidth, boxHeight, cornerRadius); ctx.fill();
                       ctx.strokeStyle = 'rgba(200, 150, 150, 0.5)'; ctx.lineWidth = 1; ctx.stroke();
                       ctx.fillStyle = '#FFAAAA'; ctx.fillText(bubble.text, enemyDrawX, bubbleY - textPadding);
                   } else { enemyIdsToRemove.push(enemyId); } // Remove if enemy no longer valid
               }
               enemyIdsToRemove.forEach(id => { delete activeEnemyBubbles[id]; }); // Clean up expired/invalid bubbles
           }
             function drawDamageTexts(damageTexts) {
               if (!damageTexts) return;
               const now = performance.now();
               const pulseDuration = 250; const pulseMaxSizeIncrease = 4; // Crit pulse effect params
               ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';

               Object.values(damageTexts).forEach(dmgText => {
                   if (!dmgText) return;
                   const x = dmgText.x ?? 0; const y = dmgText.y ?? 0;
                   const text = dmgText.text ?? '?'; const isCrit = dmgText.is_crit ?? false;
                   const spawnTime = dmgText.spawn_time ? dmgText.spawn_time * 1000 : now; // Server sends seconds
                   const timeSinceSpawn = now - spawnTime;
                   let currentFontSize = isCrit ? 18 : 14;
                   let currentFillColor = isCrit ? '#FFD700' : '#FFFFFF';

                   // Apply crit pulse effect
                   if (isCrit && timeSinceSpawn < pulseDuration) {
                       const pulseProgress = Math.sin((timeSinceSpawn / pulseDuration) * Math.PI); // 0 -> 1 -> 0 wave
                       currentFontSize += pulseProgress * pulseMaxSizeIncrease;
                   }
                   ctx.font = `bold ${Math.round(currentFontSize)}px 'Courier New', monospace`;
                   ctx.fillStyle = currentFillColor;
                   ctx.fillText(text, x, y);
               });
           }

            // Expose public functions of the Renderer module
            return {
                drawGame,                  // Main render loop function
                triggerShake,              // Function to initiate screen shake
                updateGeneratedBackground,  // Function to trigger background changes/transitions
                drawPlayers, // Add drawPlayers to what we are returning from the rendering to access
                 drawEnemySpeechBubbles,
                  drawDamageTexts

            };
       })(); // End Renderer module IIFE
       console.log("--- Renderer.js: Renderer object defined?", typeof Renderer);
