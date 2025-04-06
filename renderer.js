// renderer.js

const Renderer = (() => {
    console.log("--- Renderer.js: Initializing ---");
  
    let mainCtx = null;
  
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
  
    // --- Constants ---
    const playerColor = "#DC143C";
    const dayBaseColor = "#8FBC8F";
    const nightBaseColor = "#3E2723";
    const fontFamily = "'Courier New', monospace";
    const damageTextColor = "#FFFFFF";
    const damageTextCritColor = "#FFD700";
    const damageTextFontSize = 14;
    const damageTextCritFontSize = 18;
    const otherPlayerColor = "#4682B4";
    const dustyPlayerSelfColor = "#8B4513";
    const dustyPlayerOtherColor = "#556B2F";
    const enemyUniformBlue = "#18315f";
    const enemyGiantRed = "#a00000";
    const enemySkinColor = "#D2B48C";
    const enemyCoatColor = "#8B4513";
    const enemyBootColor = "#222222";
    const enemyCapColor = "#111111";
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
    const enemySpeechBubbleColor = "#FFAAAA";
    const enemySpeechBubbleBg = "rgba(70, 0, 0, 0.7)";
    const campfireStickColor = "#8B4513";
    const snakeLineColor = "#261a0d";
    const ironHelmetColor = "#3d3d3d";
    const ironHelmetHighlight = "#666666";
    const ironHelmetShadow = "#1a1a1a";
    const beltColor = "#412a19";
    const bootColor = "#241c1c";
    const backgroundShadowColor = "rgba(0,0,0,0.3)";
    const simpleChestPlateColor = "#777777";
    const chestPlateHighlight = "#999999";
    const slitColor = "#000000";
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
    const HEAT_HAZE_START_TEMP = 28.0;
    const HEAT_HAZE_MAX_TEMP = 45.0;
    const SNAKE_BITE_DURATION = 8.0; // Added missing constant
  
    let currentShakeMagnitude = 0;
    let shakeEndTime = 0;
    let shakeApplied = false,
    shakeOffsetX = 0,
    shakeOffsetY = 0;
  
    function drawRoundedRect(ctx, x, y, width, height, radius) {
      if (width < 2 * radius) radius = width / 2;
      if (height < 2 * radius) radius = height / 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }
  
    function generateBackground(ctx, targetIsNight, width, height) {
        ctx.clearRect(0, 0, width, height);
        if (!targetIsNight) {
          const dayBaseColor = "#949A80";
          const dirtColor1 = "rgba(76, 103, 41, 0.2)";
          const dirtColor2 = "rgba(143, 121, 55, 0.2)";
          const textureStrokeDark = "rgba(59, 112, 67, 0.3)";
          const textureStrokeLight = "rgba(135, 150, 110, 0.25)";
          const textureStrokeEmerald = "rgba(19, 226, 112, 0.15)";
          const numDirtPatches = 40;
          const numTextureStrokes = 2500;
          ctx.fillStyle = dayBaseColor;
          ctx.fillRect(0, 0, width, height);
          for (let i = 0; i < numDirtPatches; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const avgRadius = Math.random() * 100 + 50;
            const points = 5 + Math.floor(Math.random() * 4);
            const color = Math.random() < 0.5 ? dirtColor1 : dirtColor2;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x + avgRadius * Math.cos(0), y + avgRadius * Math.sin(0));
            for (let j = 1; j <= points; j++) {
              const angle = (j / points) * Math.PI * 2;
              const radius = avgRadius * (0.7 + Math.random() * 0.6);
              ctx.lineTo(
                x + radius * Math.cos(angle),
                y + radius * Math.sin(angle)
              );
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.lineWidth = 1.5;
          ctx.lineCap = "round";
          for (let i = 0; i < numTextureStrokes; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const length = Math.random() * 5 + 2;
            const angle = Math.random() * Math.PI * 2;
            let strokeColor;
            const randColor = Math.random();
            if (randColor < 0.1) {
              strokeColor = textureStrokeEmerald;
            } else if (randColor < 0.55) {
              strokeColor = textureStrokeLight;
            } else {
              strokeColor = textureStrokeDark;
            }
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
            ctx.stroke();
          }
          ctx.lineCap = "butt";
        } else {
          const baseNightColor = "#080808";
          const nebulaeColors = [
            [180, 180, 190, 0.05],
            [200, 80, 80, 0.04],
            [160, 160, 160, 0.06],
            [210, 100, 100, 0.035],
          ];
          const darkCloudColor = "rgba(8, 8, 8, 0.18)";
          const numNebulae = 10;
          const numDarkClouds = 20;
          const numDustStars = 2000;
          const numMidStars = 500;
          const numHeroStars = 70;
          ctx.fillStyle = baseNightColor;
          ctx.fillRect(0, 0, width, height);
          for (let i = 0; i < numNebulae; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * (width * 0.4) + width * 0.15;
            const colorData =
              nebulaeColors[Math.floor(Math.random() * nebulaeColors.length)];
            const [r, g, b, baseAlpha] = colorData;
            try {
              const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
              gradient.addColorStop(
                0,
                `rgba(${r}, ${g}, ${b}, ${Math.min(0.1, baseAlpha * 1.5).toFixed(
                  2
                )})`
              );
              gradient.addColorStop(
                0.5,
                `rgba(${r}, ${g}, ${b}, ${baseAlpha.toFixed(2)})`
              );
              gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            } catch (e) {
              console.error("Failed to create nebula gradient:", e);
            }
          }
          const drawStars = (
            count,
            minSize,
            maxSize,
            minAlpha,
            maxAlpha,
            colorVariance = 0
          ) => {
            for (let i = 0; i < count; i++) {
              const sx = Math.random() * width;
              const sy = Math.random() * height;
              const size = Math.random() * (maxSize - minSize) + minSize;
              const alpha = Math.random() * (maxAlpha - minAlpha) + minAlpha;
              let r = 255,
                g = 255,
                b = 255;
              if (colorVariance > 0 && Math.random() < 0.3) {
                const variance = Math.random() * colorVariance;
                if (Math.random() < 0.7) {
                  b -= variance;
                  r = Math.max(0, Math.min(255, r));
                  g = Math.max(0, Math.min(255, g));
                  b = Math.max(0, Math.min(255, b));
                }
              }
              ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(
                g
              )}, ${Math.round(b)}, ${alpha.toFixed(2)})`;
              ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
            }
          };
          drawStars(numDustStars, 0.4, 0.9, 0.06, 0.3);
          drawStars(numMidStars, 0.7, 1.6, 0.2, 0.7, 25);
          drawStars(numHeroStars, 1.4, 2.6, 0.5, 1.0, 40);
          for (let i = 0; i < numDarkClouds; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radiusX = Math.random() * (width * 0.3) + width * 0.12;
            const radiusY = Math.random() * (height * 0.25) + height * 0.1;
            const rotation = Math.random() * Math.PI;
            ctx.fillStyle = darkCloudColor;
            ctx.beginPath();
            ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.canvas.dataset.isNight = String(targetIsNight);
        return targetIsNight;
      }
      
      function updateGeneratedBackground(targetIsNight) {
        if (
          offscreenCanvas.width !== appState.canvasWidth ||
          offscreenCanvas.height !== appState.canvasHeight
        ) {
          offscreenCanvas.width = appState.canvasWidth;
          offscreenCanvas.height = appState.canvasHeight;
          oldOffscreenCanvas.width = appState.canvasWidth;
          oldOffscreenCanvas.height = appState.canvasHeight;
          hazeCanvas.width = appState.canvasWidth;
          hazeCanvas.height = appState.canvasHeight;
          isBackgroundReady = false;
          currentBackgroundIsNight = null;
          isTransitioningBackground = false;
        }
        if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) {
          return;
        }
        if (
          isTransitioningBackground &&
          targetIsNight === (offscreenCanvas.dataset.isNight === "true")
        ) {
          return;
        }
        if (isBackgroundReady) {
          oldOffscreenCtx.clearRect(0, 0, appState.canvasWidth, appState.canvasHeight);
          oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0);
          isTransitioningBackground = true;
          transitionStartTime = performance.now();
          generateBackground(
            offscreenCtx,
            targetIsNight,
            appState.canvasWidth,
            appState.canvasHeight
          );
          currentBackgroundIsNight = targetIsNight;
        } else {
          generateBackground(
            offscreenCtx,
            targetIsNight,
            appState.canvasWidth,
            appState.canvasHeight
          );
          currentBackgroundIsNight = targetIsNight;
          isBackgroundReady = true;
          isTransitioningBackground = false;
        }
     }
  
    function drawCampfire(ctx, campfireData, width, height) {
      if (!campfireData || !campfireData.active) return;
      const now = performance.now();
      const x = campfireData.x ?? width / 2;
      const y = campfireData.y ?? height / 2;
      const baseRadius = campfireData.radius ?? 0;
      if (baseRadius <= 0) return;
      const stickWidth = 35;
      const stickHeight = 8;
      const stickColor = "#5a3a1e";
      const stickYOffset = 6;
      const logBaseY = y + stickYOffset;
      const flameBaseWidth = stickWidth * 0.8;
      const numFlames = 4;
      const timeSlow = now * 0.0015;
      const heightMagnitude = 0.6;
      const widthMagnitude = 0.3;
      const curveMagnitude = 5;
      ctx.save();
      const glowRadius = baseRadius * 1.1;
      const glowPulse = Math.sin(now * 0.001) * 0.05;
      const currentGlowRadius = glowRadius * (1 + glowPulse);
      try {
        const gradient = ctx.createRadialGradient(
          x,
          logBaseY,
          0,
          x,
          logBaseY,
          currentGlowRadius
        );
        gradient.addColorStop(0, `rgba(255, 165, 0, ${0.35 + glowPulse * 2})`);
        gradient.addColorStop(0.6, "rgba(255, 165, 0, 0.1)");
        gradient.addColorStop(1, "rgba(255, 165, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, logBaseY, currentGlowRadius, 0, Math.PI * 2);
        ctx.fill();
      } catch (e) {
        console.error("Failed to create campfire gradient:", e);
      }
      ctx.fillStyle = stickColor;
      ctx.translate(x, logBaseY);
      ctx.rotate(Math.PI / 6);
      ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-stickWidth / 2 + 2, 0);
      ctx.lineTo(stickWidth / 2 - 2, 0);
      ctx.stroke();
      ctx.rotate(-Math.PI / 6);
      ctx.rotate(-Math.PI / 5);
      ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
      ctx.beginPath();
      ctx.moveTo(-stickWidth / 2 + 2, 0);
      ctx.lineTo(stickWidth / 2 - 2, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 5);
      ctx.translate(-x, -logBaseY);
      const flameColors = [
        {
          color: `rgba(255, 100, 0, ${0.5 + Math.sin(timeSlow * 1.1 + 1) * 0.1})`,
          baseHeight: 45,
          widthFactor: 1.0,
        },
        {
          color: `rgba(255, 165, 0, ${
            0.6 + Math.sin(timeSlow * 0.9 + 2) * 0.15
          })`,
          baseHeight: 35,
          widthFactor: 0.7,
        },
        {
          color: `rgba(255, 255, 180, ${
            0.7 + Math.sin(timeSlow * 1.3 + 3) * 0.2
          })`,
          baseHeight: 25,
          widthFactor: 0.4,
        },
      ];
      for (let layer = 0; layer < flameColors.length; layer++) {
        const layerData = flameColors[layer];
        ctx.fillStyle = layerData.color;
        for (let i = 0; i < numFlames; i++) {
          const flameOffsetX =
            (i - (numFlames - 1) / 2) * (flameBaseWidth / numFlames) * 0.8;
          const uniqueTimeOffset = i * 1.57;
          const flickerHeight =
            Math.sin(timeSlow * (1.0 + i * 0.1) + uniqueTimeOffset) *
              heightMagnitude +
            1.0;
          const flickerWidth =
            Math.sin(timeSlow * (0.8 + i * 0.15) - uniqueTimeOffset) *
              widthMagnitude +
            1.0;
          const currentHeight =
            layerData.baseHeight * flickerHeight * (1.0 - layer * 0.1);
          const currentWidth =
            (flameBaseWidth * layerData.widthFactor * flickerWidth) / numFlames;
          const swayX1 =
            Math.sin(timeSlow * 1.2 + uniqueTimeOffset + i) * curveMagnitude;
          const swayY1 =
            Math.sin(timeSlow * 1.4 + uniqueTimeOffset + i + 1) *
            curveMagnitude *
            0.5;
          const swayX2 =
            Math.sin(timeSlow * 1.3 - uniqueTimeOffset + i + 2) * curveMagnitude;
          const swayY2 =
            Math.sin(timeSlow * 1.5 - uniqueTimeOffset + i + 3) *
            curveMagnitude *
            0.5;
          const startX = x + flameOffsetX;
          const startY = logBaseY - stickHeight / 2;
          const tipY = startY - currentHeight;
          const midY1 = startY - currentHeight * 0.33;
          const midY2 = startY - currentHeight * 0.66;
          ctx.beginPath();
          ctx.moveTo(startX - currentWidth / 2, startY);
          ctx.bezierCurveTo(
            startX - currentWidth / 2 + swayX1,
            midY2 + swayY1,
            startX + swayX2,
            midY1 + swayY2,
            startX,
            tipY
          );
          ctx.bezierCurveTo(
            startX - swayX2,
            midY1 + swayY2,
            startX + currentWidth / 2 - swayX1,
            midY2 + swayY1,
            startX + currentWidth / 2,
            startY
          );
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  
    function drawDamageVignette(ctx, intensity, width, height) { // Added width, height params
        if (intensity <= 0) return; // No vignette if intensity is zero or negative
    
        ctx.save(); // Save current context state
    
        // Calculate the radius for the gradient based on canvas diagonal
        // Use the passed width and height parameters
        const outerRadius = Math.sqrt(width ** 2 + height ** 2) / 2;
    
        // Create a radial gradient centered on the canvas
        // Use the passed width and height parameters
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,           // Inner circle (center, radius 0)
            width / 2, height / 2, outerRadius  // Outer circle (center, calculated radius)
        );
    
        // Clamp the calculated alpha based on intensity
        // Ensure alpha is between 0.0 and 0.4 (or adjust max as needed)
        const vignetteAlpha = Math.min(0.4, Math.max(0.0, 0.4 * intensity));
    
        // Define gradient color stops
        gradient.addColorStop(0, "rgba(255,0,0,0)");     // Center is fully transparent red
        gradient.addColorStop(0.75, "rgba(255,0,0,0)");  // Stays transparent until 75% of the radius
        gradient.addColorStop(1, `rgba(255,0,0,${vignetteAlpha.toFixed(2)})`); // Fades to red at the edges
    
        // Apply the gradient fill
        ctx.fillStyle = gradient;
        // Use the passed width and height parameters to fill the entire canvas
        ctx.fillRect(0, 0, width, height);
    
        ctx.restore(); // Restore context state
    }
  
    function drawTemperatureTint(ctx, temperature, width, height) { // Added width, height params
        let tcs = null, a = 0.0;
        const tfc = TEMP_FREEZING_CLIENT, tcc = TEMP_COLD_CLIENT,
              thc = TEMP_HOT_CLIENT, tsc = TEMP_SCORCHING_CLIENT,
              mta = MAX_TINT_ALPHA;
    
        if (temperature === null || typeof temperature === 'undefined') {
            return; // Exit if temperature is invalid
        }
    
        // Determine tint color and base alpha based on temperature ranges
        if (temperature <= tfc) {
            tcs = "rgba(100,150,255,A)"; // Freezing blue
            a = mta * Math.min(1.0, (tfc - temperature + 5) / 5.0);
        } else if (temperature <= tcc) {
            tcs = "rgba(150,180,255,A)"; // Cold blue
            a = mta * ((tcc - temperature) / (tcc - tfc));
        } else if (temperature >= tsc) {
            tcs = "rgba(255,100,0,A)";   // Scorching orange
            a = mta * Math.min(1.0, (temperature - tsc + 5) / 5.0);
        } else if (temperature >= thc) {
            tcs = "rgba(255,150,50,A)";   // Hot orange
            a = mta * ((temperature - thc) / (tsc - thc));
        }
    
        // Clamp alpha and apply fill if needed
        a = Math.max(0, Math.min(mta, a)); // Ensure alpha is between 0 and MAX_TINT_ALPHA
        if (tcs && a > 0.01) { // Only draw if there's a noticeable tint
            ctx.fillStyle = tcs.replace("A", a.toFixed(2));
            // Use the passed width and height parameters to fill the entire canvas
            ctx.fillRect(0, 0, width, height);
        }
    }
  
    function drawEnemySpeechBubbles(ctx, enemiesToRender, activeEnemyBubblesRef) {
      if (!activeEnemyBubblesRef) return;
      const now = performance.now();
      const bubbleFont = "italic 13px " + fontFamily;
      const cornerRadius = 5;
      const textPadding = 5;
      const bubbleOffsetY = 25;
      const bubbleBg = enemySpeechBubbleBg;
      const bubbleColor = enemySpeechBubbleColor;
      const shadowColor = "rgba(0, 0, 0, 0.5)";
      const shadowOffsetX = 2;
      const shadowOffsetY = 2;
      const shadowBlur = 4;
      ctx.font = bubbleFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const expiredBubbleIds = [];
      for (const enemyId in activeEnemyBubblesRef) {
        const bubbleData = activeEnemyBubblesRef[enemyId];
        if (now >= bubbleData.endTime) {
          expiredBubbleIds.push(enemyId);
          continue;
        }
        const enemy = enemiesToRender?.[enemyId];
        if (enemy && enemy.health > 0 && !enemy.death_timestamp) {
          const enemyX = enemy.x;
          const enemyY = enemy.y;
          const enemyHeight = enemy.height ?? 40;
          const bubbleTargetY = enemyY - enemyHeight / 2 - bubbleOffsetY;
          const textMetrics = ctx.measureText(bubbleData.text);
          const textWidth = textMetrics.width;
          const bubbleHeight = 13 + textPadding * 2;
          const bubbleWidth = textWidth + textPadding * 2;
          const bubbleX = enemyX - bubbleWidth / 2;
          const bubbleDrawY = bubbleTargetY - bubbleHeight;
          ctx.save();
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetX = shadowOffsetX;
          ctx.shadowOffsetY = shadowOffsetY;
          ctx.fillStyle = bubbleBg;
          if (typeof drawRoundedRect === "function") {
            drawRoundedRect(
              ctx,
              bubbleX,
              bubbleDrawY,
              bubbleWidth,
              bubbleHeight,
              cornerRadius
            );
            ctx.fill();
          } else {
            ctx.fillRect(bubbleX, bubbleDrawY, bubbleWidth, bubbleHeight);
          }
          ctx.restore();
          ctx.fillStyle = bubbleColor;
          ctx.fillText(bubbleData.text, enemyX, bubbleTargetY - textPadding);
        } else {
          expiredBubbleIds.push(enemyId);
        }
      }
      expiredBubbleIds.forEach((id) => {
        if (activeEnemyBubblesRef) delete activeEnemyBubblesRef[id];
      });
    }
  
    function drawSpeechBubbles(
      ctx,
      playersToRender,
      activeSpeechBubblesRef,
      appStateRef
    ) {
      if (!activeSpeechBubblesRef || !appStateRef) return;
      const now = performance.now();
      const bubbleFont = "bold 14px " + fontFamily;
      const cornerRadius = 6;
      const textPadding = 6;
      const bubbleOffsetY = 35;
      const bubbleBg = playerSpeechBubbleBg;
      const bubbleColor = playerSpeechBubbleColor;
      const shadowColor = "rgba(0, 0, 0, 0.6)";
      const shadowOffsetX = 2;
      const shadowOffsetY = 2;
      const shadowBlur = 5;
      ctx.font = bubbleFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const expiredBubbleIds = [];
      for (const playerId in activeSpeechBubblesRef) {
        const bubbleData = activeSpeechBubblesRef[playerId];
        if (now >= bubbleData.endTime) {
          expiredBubbleIds.push(playerId);
          continue;
        }
        const player = playersToRender?.[playerId];
        if (player && player.player_status !== "dead" && player.health > 0) {
          const playerX =
            playerId === appStateRef.localPlayerId
              ? appStateRef.renderedPlayerPos.x
              : player.x;
          const playerY =
            playerId === appStateRef.localPlayerId
              ? appStateRef.renderedPlayerPos.y
              : player.y;
          const playerHeight = player.height ?? 48; // Use hardcoded default if needed
          const bubbleTargetY = playerY - playerHeight / 2 - bubbleOffsetY;
          const textMetrics = ctx.measureText(bubbleData.text);
          const textWidth = textMetrics.width;
          const bubbleHeight = 14 + textPadding * 2;
          const bubbleWidth = textWidth + textPadding * 2;
          const bubbleX = playerX - bubbleWidth / 2;
          const bubbleDrawY = bubbleTargetY - bubbleHeight;
          ctx.save();
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetX = shadowOffsetX;
          ctx.shadowOffsetY = shadowOffsetY;
          ctx.fillStyle = bubbleBg;
          if (typeof drawRoundedRect === "function") {
            drawRoundedRect(
              ctx,
              bubbleX,
              bubbleDrawY,
              bubbleWidth,
              bubbleHeight,
              cornerRadius
            );
            ctx.fill();
          } else {
            ctx.fillRect(bubbleX, bubbleDrawY, bubbleWidth, bubbleHeight);
          }
          ctx.restore();
          ctx.fillStyle = bubbleColor;
          ctx.fillText(bubbleData.text, playerX, bubbleTargetY - textPadding);
        } else {
          expiredBubbleIds.push(playerId);
        }
      }
      expiredBubbleIds.forEach((id) => {
        if (activeSpeechBubblesRef) delete activeSpeechBubblesRef[id];
      });
    }
  
    function drawSnake(ctx, snakeRef) {
      if (
        !snakeRef ||
        !snakeRef.isActiveFromServer ||
        !snakeRef.segments ||
        snakeRef.segments.length < 2
      )
        return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = snakeLineColor;
      ctx.lineWidth = snakeRef.lineWidth ?? 3; // Add default width
      ctx.beginPath();
      ctx.moveTo(
        snakeRef.segments[snakeRef.segments.length - 1].x,
        snakeRef.segments[snakeRef.segments.length - 1].y
      );
      for (let i = snakeRef.segments.length - 2; i >= 1; i--) {
        const s = snakeRef.segments[i],
          ns = snakeRef.segments[i - 1];
        if (!s || !ns) continue;
        const xc = (s.x + ns.x) / 2,
          yc = (s.y + ns.y) / 2;
        ctx.quadraticCurveTo(s.x, s.y, xc, yc);
      }
      if (snakeRef.segments.length > 0) {
        const h = snakeRef.segments[0];
        if (snakeRef.segments.length > 1) {
          const n = snakeRef.segments[1],
            xc = (n.x + h.x) / 2,
            yc = (n.y + h.y) / 2;
          ctx.quadraticCurveTo(n.x, n.y, xc, yc);
        }
        ctx.lineTo(h.x, h.y);
      }
      ctx.stroke();
    }
  
    function drawHealthBar(ctx, x, y, width, currentHealth, maxHealth) {
      if (maxHealth <= 0) return;
      const bh = 5,
        yo = -(width / 2 + 27),
        bw = Math.max(20, width * 0.8);
      const cw = Math.max(0, (currentHealth / maxHealth) * bw),
        hp = currentHealth / maxHealth,
        bx = x - bw / 2,
        by = y + yo;
      ctx.fillStyle = healthBarBg;
      ctx.fillRect(bx, by, bw, bh);
      let bc = healthBarLow;
      if (hp > 0.66) bc = healthBarHigh;
      else if (hp > 0.33) bc = healthBarMedium;
      ctx.fillStyle = bc;
      ctx.fillRect(bx, by, cw, bh);
    }
  
    function drawArmorBar(ctx, x, y, width, currentArmor) {
      const ma = 100;
      if (currentArmor <= 0) return;
      const abh = 4,
        hbh = 5,
        bs = 1,
        hbyo = -(width / 2 + 27);
      const hbty = y + hbyo,
        abty = hbty + hbh + bs,
        bw = Math.max(20, width * 0.8),
        cw = Math.max(0, (currentArmor / ma) * bw),
        bx = x - bw / 2,
        by = abty;
      ctx.fillStyle = healthBarBg;
      ctx.fillRect(bx, by, bw, abh);
      ctx.fillStyle = armorBarColor;
      ctx.fillRect(bx, by, cw, abh);
    }
  
    // --- REVISED V7: drawEnemyRect (Uses Client Spark State) ---
    function drawEnemyRect(
      ctx,
      x,
      y,
      w,
      h,
      type,
      enemyState,
      activeBloodSparkEffectsRef,
      clientNowTime
    ) {
      const currentW = w;
      const currentH = h;
      const t = clientNowTime; // Use passed client time
      const bobOffset =
        type !== "giant"
          ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE
          : 0;
      const nowSeconds = t / 1000.0;
      const snakeEffect = enemyState?.effects?.snake_bite_slow;
      const isSnakeBitten =
        snakeEffect &&
        typeof snakeEffect.expires_at === "number" &&
        nowSeconds < snakeEffect.expires_at;
      const attackState =
        type === "giant" && enemyState?.attack_state
          ? enemyState.attack_state
          : "idle";
      const enemyId = enemyState?.id;
      const showBloodSparks =
        enemyId &&
        activeBloodSparkEffectsRef?.[enemyId] &&
        t < activeBloodSparkEffectsRef[enemyId];
  
      ctx.save();
  
      // --- Giant Drawing ---
      if (type === "giant") {
        const bodyWidth = currentW * 0.85;
        const bodyHeight = currentH * 0.7;
        const bodyTopY = y - currentH * 0.4;
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
        const shakoHeight = headRadius * 1.5;
        const shakoWidth = headRadius * 1.8;
        const shakoBaseY = headCenterY - headRadius * 0.8;
        const shakoPeakHeight = shakoHeight * 0.2;
        const shakoPeakWidth = shakoWidth * 1.1;
        const armShoulderWidth = currentW * 0.18;
        const armWristWidth = currentW * 0.14;
        const armLength = currentH * 0.55;
        const shoulderY = bodyTopY + bodyHeight * 0.15;
        const shoulderXOffset = bodyWidth / 2;
  
        // Legs & Boots
        ctx.fillStyle = enemyBootColor;
        ctx.fillRect(x - legSpacing - legWidth / 2, legTopY, legWidth, legHeight);
        ctx.fillRect(x + legSpacing - legWidth / 2, legTopY, legWidth, legHeight);
        ctx.fillStyle = enemyBootColor;
        ctx.fillRect(
          x - legSpacing - bootWidth / 2,
          bootTopY,
          bootWidth,
          bootHeight
        );
        ctx.fillRect(
          x + legSpacing - bootWidth / 2,
          bootTopY,
          bootWidth,
          bootHeight
        );
        // Body
        ctx.fillStyle = enemyGiantRed;
        ctx.fillRect(x - bodyWidth / 2, bodyTopY, bodyWidth, bodyHeight);
        if (attackState === "winding_up") {
          ctx.fillStyle = "rgba(255, 255, 100, 0.15)";
          ctx.fillRect(x - bodyWidth / 2, bodyTopY, bodyWidth, bodyHeight);
        }
        // Belt
        ctx.fillStyle = beltColor;
        ctx.fillRect(
          x - bodyWidth / 2,
          bodyTopY + bodyHeight * 0.7,
          bodyWidth,
          bodyHeight * 0.08
        );
        // Arms
        ctx.fillStyle = enemyGiantRed;
        if (attackState === "winding_up" || attackState === "attacking") {
          const windUpAngle = -Math.PI / 6;
          const raisedOffsetY = -armLength * 0.1;
          ctx.save();
          ctx.translate(x - shoulderXOffset, shoulderY + raisedOffsetY);
          ctx.rotate(windUpAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(armShoulderWidth, 0);
          ctx.lineTo(armShoulderWidth * 0.7, armLength);
          ctx.lineTo(armWristWidth * 0.3, armLength);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.translate(x + shoulderXOffset, shoulderY + raisedOffsetY);
          ctx.rotate(-windUpAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-armShoulderWidth, 0);
          ctx.lineTo(-armShoulderWidth * 0.7, armLength);
          ctx.lineTo(-armWristWidth * 0.3, armLength);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const armBottomY = shoulderY + armLength;
          ctx.beginPath();
          ctx.moveTo(x - shoulderXOffset, shoulderY);
          ctx.lineTo(x - shoulderXOffset - armShoulderWidth, shoulderY);
          ctx.lineTo(x - shoulderXOffset - armWristWidth, armBottomY);
          ctx.lineTo(x - shoulderXOffset - armWristWidth * 0.5, armBottomY);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x + shoulderXOffset, shoulderY);
          ctx.lineTo(x + shoulderXOffset + armShoulderWidth, shoulderY);
          ctx.lineTo(x + shoulderXOffset + armWristWidth, armBottomY);
          ctx.lineTo(x + shoulderXOffset + armWristWidth * 0.5, armBottomY);
          ctx.closePath();
          ctx.fill();
        }
        // Head & Face
        ctx.fillStyle = enemySkinColor;
        ctx.beginPath();
        ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        const beardWidth = headRadius * 1.6;
        const beardHeight = headRadius * 1.0;
        const beardTopY = headCenterY + headRadius * 0.2;
        ctx.fillStyle = enemyCapColor;
        ctx.fillRect(x - beardWidth / 2, beardTopY, beardWidth, beardHeight);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        const giantBrowLength = headRadius * 0.7;
        const giantBrowY = headCenterY - headRadius * 0.4;
        const giantBrowXOffset = headRadius * 0.4;
        ctx.moveTo(
          x - giantBrowXOffset - giantBrowLength / 2,
          giantBrowY + giantBrowLength / 4
        );
        ctx.lineTo(
          x - giantBrowXOffset + giantBrowLength / 2,
          giantBrowY - giantBrowLength / 4
        );
        ctx.moveTo(
          x + giantBrowXOffset - giantBrowLength / 2,
          giantBrowY - giantBrowLength / 4
        );
        ctx.lineTo(
          x + giantBrowXOffset + giantBrowLength / 2,
          giantBrowY + giantBrowLength / 4
        );
        ctx.stroke();
        // Shako Hat
        ctx.fillStyle = enemyCapColor;
        ctx.fillRect(
          x - shakoWidth / 2,
          shakoBaseY - shakoHeight,
          shakoWidth,
          shakoHeight
        );
        ctx.beginPath();
        ctx.moveTo(x - shakoPeakWidth / 2, shakoBaseY);
        ctx.lineTo(x + shakoPeakWidth / 2, shakoBaseY);
        ctx.lineTo(x + shakoWidth / 2, shakoBaseY - shakoPeakHeight);
        ctx.lineTo(x - shakoWidth / 2, shakoBaseY - shakoPeakHeight);
        ctx.closePath();
        ctx.fill();
      }
      // --- Standard Enemy ---
      else {
        const headRadius = currentH * 0.16;
        const coatShoulderWidth = currentW * 1.1;
        const coatHemWidth = currentW * 0.9;
        const torsoShoulderWidth = currentW * 0.9;
        const torsoHemWidth = currentW * 0.7;
        const coatTopY = y - currentH * 0.35 + bobOffset;
        const coatBottomY = y + currentH * 0.25 + bobOffset;
        const coatHeight = coatBottomY - coatTopY;
        const headCenterY = coatTopY - headRadius * 0.6;
        const armWidth = currentW * 0.2;
        const armHeight = currentH * 0.45;
        const armOffsetY = coatTopY + coatHeight * 0.1;
        const trouserHeight = currentH * 0.2;
        const trouserWidth = currentW * 0.25;
        const trouserTopY = coatBottomY;
        const legSpacing = currentW * 0.15;
        const bootHeight = currentH * 0.12;
        const bootWidth = currentW * 0.3;
        const bootTopY = trouserTopY + trouserHeight;
        const hatBrimWidth = headRadius * 3.5;
        const hatBrimHeight = headRadius * 0.6;
        const hatCrownRadiusH = headRadius * 1.5;
        const hatCrownRadiusV = headRadius * 1.1;
        const hatCenterY = headCenterY - headRadius * 1.0;
        const stepCycle = 400;
        const stepPhase = Math.floor(t / stepCycle) % 2;
        // Trousers & Boots
        ctx.fillStyle = enemyBootColor;
        const leftLegX = x - legSpacing;
        ctx.fillRect(
          leftLegX - trouserWidth / 2,
          trouserTopY,
          trouserWidth,
          trouserHeight
        );
        const rightLegX = x + legSpacing;
        ctx.fillRect(
          rightLegX - trouserWidth / 2,
          trouserTopY,
          trouserWidth,
          trouserHeight
        );
        ctx.fillStyle = enemyBootColor;
        if (stepPhase === 0) {
          ctx.fillRect(
            leftLegX - bootWidth / 2,
            bootTopY - 2,
            bootWidth,
            bootHeight
          );
          ctx.fillRect(
            rightLegX - bootWidth / 2,
            bootTopY,
            bootWidth,
            bootHeight
          );
        } else {
          ctx.fillRect(leftLegX - bootWidth / 2, bootTopY, bootWidth, bootHeight);
          ctx.fillRect(
            rightLegX - bootWidth / 2,
            bootTopY - 2,
            bootWidth,
            bootHeight
          );
        }
        // Coats/Arms/Torso
        ctx.fillStyle = enemyCoatColor;
        ctx.beginPath();
        ctx.moveTo(x - coatShoulderWidth / 2, coatTopY);
        ctx.lineTo(x + coatShoulderWidth / 2, coatTopY);
        ctx.lineTo(x + coatHemWidth / 2, coatBottomY);
        ctx.lineTo(x - coatHemWidth / 2, coatBottomY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = enemyCoatColor;
        ctx.fillRect(
          x - coatShoulderWidth * 0.45 - armWidth / 2,
          armOffsetY,
          armWidth,
          armHeight
        );
        ctx.fillRect(
          x + coatShoulderWidth * 0.45 - armWidth / 2,
          armOffsetY,
          armWidth,
          armHeight
        );
        ctx.fillStyle = enemyUniformBlue;
        ctx.beginPath();
        ctx.moveTo(x - torsoShoulderWidth / 2, coatTopY);
        ctx.lineTo(x + torsoShoulderWidth / 2, coatTopY);
        ctx.lineTo(x + torsoHemWidth / 2, coatBottomY);
        ctx.lineTo(x - torsoHemWidth / 2, coatBottomY);
        ctx.closePath();
        ctx.fill();
        // Head & Face
        ctx.fillStyle = enemySkinColor;
        ctx.beginPath();
        ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const browLength = headRadius * 0.5;
        const browY = headCenterY - headRadius * 0.3;
        const browXOffset = headRadius * 0.3;
        ctx.moveTo(x - browXOffset - browLength / 2, browY - browLength / 3);
        ctx.lineTo(x - browXOffset + browLength / 2, browY + browLength / 3);
        ctx.moveTo(x + browXOffset - browLength / 2, browY + browLength / 3);
        ctx.lineTo(x + browXOffset + browLength / 2, browY - browLength / 3);
        ctx.stroke();
        // Hat
        ctx.fillStyle = enemyCapColor;
        ctx.beginPath();
        ctx.ellipse(
          x,
          hatCenterY + hatCrownRadiusV * 0.7,
          hatBrimWidth / 2,
          hatBrimHeight / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(
          x,
          hatCenterY,
          hatCrownRadiusH / 2,
          hatCrownRadiusV,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        // Shooter Gun
        if (type === "shooter") {
          const gunBarrelLength = w * 1.2;
          const gunBarrelThickness = 3;
          const gunStockLength = w * 0.5;
          const gunStockThickness = 5;
          const gunColorBarrel = "#555555";
          const gunColorStock = "#7a4a2a";
          ctx.save();
          const gunAngle = Math.PI / 10;
          const gunCenterY = y + bobOffset;
          const gunCenterX = x;
          ctx.translate(gunCenterX, gunCenterY);
          ctx.rotate(gunAngle);
          ctx.fillStyle = gunColorStock;
          ctx.fillRect(
            -gunStockLength * 0.8,
            -gunStockThickness / 2,
            gunStockLength,
            gunStockThickness
          );
          ctx.fillStyle = gunColorBarrel;
          ctx.fillRect(
            -gunStockLength * 0.2,
            -gunBarrelThickness / 2,
            gunBarrelLength,
            gunBarrelThickness
          );
          ctx.restore();
        }
      }
  
      // --- Common Effects ---
      // Snake Bite
      if (isSnakeBitten) {
        let footY;
        if (type === "giant") {
          const bodyHeight = currentH * 0.7;
          const legHeight = currentH * 0.25;
          const bootHeight = currentH * 0.1;
          const bodyTopY = y - currentH * 0.4;
          footY = bodyTopY + bodyHeight + legHeight + bootHeight;
        } else {
          const coatBottomY = y + currentH * 0.25 + bobOffset;
          const trouserHeight = currentH * 0.2;
          const bootHeight = currentH * 0.12;
          footY = coatBottomY + trouserHeight + bootHeight;
        }
        const numParticles = 6;
        const particleBaseSize = 3;
        const particleSpeedY = -50;
        const particleLifetimeMs = 550;
        ctx.save();
        for (let i = 0; i < numParticles; i++) {
          const effectStartTime =
            snakeEffect.expires_at * 1000 - SNAKE_BITE_DURATION * 1000;
          const timeSinceEffectStart = Math.max(0, t - effectStartTime);
          const particleSimulatedAge =
            (timeSinceEffectStart + (particleLifetimeMs / numParticles) * i) %
            particleLifetimeMs;
          const particleProgress = particleSimulatedAge / particleLifetimeMs;
          if (particleProgress < 0 || particleProgress >= 1) continue;
          const particleX = x + (Math.random() - 0.5) * currentW * 0.6;
          const particleY =
            footY + particleSpeedY * (particleSimulatedAge / 1000);
          const particleSize =
            particleBaseSize *
            (1.0 - particleProgress * 0.5) *
            (0.8 + Math.random() * 0.4);
          const alpha =
            0.7 * (1.0 - particleProgress) * (0.7 + Math.random() * 0.3);
          const green = 180 + Math.floor(75 * particleProgress);
          const yellow = 180 * (1.0 - particleProgress);
          ctx.fillStyle = `rgba(${Math.floor(
            yellow
          )}, ${green}, 50, ${alpha.toFixed(2)})`;
          ctx.fillRect(
            particleX - particleSize / 2,
            particleY - particleSize / 2,
            particleSize,
            particleSize
          );
        }
        ctx.restore();
      }
      // Blood Sparks
      if (showBloodSparks) {
        ctx.save();
        const numSparks = 2 + Math.floor(Math.random() * 5);
        const sparkColors = [
          "rgba(180, 0, 0, 0.8)",
          "rgba(220, 20, 20, 0.7)",
          "rgba(150, 0, 0, 0.6)",
        ];
        const sparkCenterY = y + (type !== "giant" ? bobOffset : 0);
        for (let i = 0; i < numSparks; i++) {
          const sparkAngle = Math.random() * Math.PI * 2;
          const sparkRadius = Math.random() * currentW * 0.3;
          const sparkX = x + Math.cos(sparkAngle) * sparkRadius;
          const sparkY =
            sparkCenterY +
            Math.sin(sparkAngle) * sparkRadius * 0.5 -
            currentH * 0.1;
          const sparkSize = 2 + Math.random() * 3;
          ctx.fillStyle =
            sparkColors[Math.floor(Math.random() * sparkColors.length)];
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, sparkSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore(); // Restore context from start of function
    }
  
    function drawPlayerCharacter(
      ctx,
      x,
      y,
      w,
      h,
      isSelf,
      playerState,
      aimDx,
      aimDy,
      pushbackAnimState
    ) {
      const t = performance.now();
      const now = t;
      const ii =
        (playerState?.input_vector?.dx ?? 0) === 0 &&
        (playerState?.input_vector?.dy ?? 0) === 0;
      const bo = ii
        ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE
        : 0;
      const playerSnakeEffect = playerState?.effects?.snake_bite_slow;
      const isPlayerBitten =
        playerSnakeEffect &&
        typeof playerSnakeEffect === "object" &&
        typeof playerSnakeEffect.expires_at === "number" &&
        now < playerSnakeEffect.expires_at * 1000;
      // Dimensions
      const headHeight = h * 0.28;
      const headWidth = w * 0.9;
      const neckHeight = h * 0.05;
      const torsoHeight = h * 0.35;
      const torsoUpperWidth = w * 0.95;
      const torsoLowerWidth = w * 0.8;
      const beltHeight = h * 0.06;
      const legHeight = h * 0.32;
      const legUpperWidth = w * 0.4;
      const legLowerWidth = w * 0.3;
      const bootShaftHeight = h * 0.1;
      const bootSoleHeight = h * 0.04;
      const bootWidth = w * 0.35;
      const armWidth = w * 0.22;
      const armLength = h * 0.42;
      const shoulderPadRadius = w * 0.3;
      // Y Positions
      const headTopY = y - h * 0.5 + bo;
      const headBottomY = headTopY + headHeight;
      const neckTopY = headBottomY;
      const neckBottomY = neckTopY + neckHeight;
      const torsoTopY = neckBottomY;
      const torsoBottomY = torsoTopY + torsoHeight;
      const beltTopY = torsoBottomY - beltHeight * 0.3;
      const beltBottomY = beltTopY + beltHeight;
      const legTopY = beltBottomY - beltHeight * 0.2;
      const legBottomY = legTopY + legHeight;
      const bootTopY = legBottomY - bootShaftHeight * 0.1;
      const bootShaftBottomY = bootTopY + bootShaftHeight;
      const bootSoleTopY = bootShaftBottomY;
      const bootBottomY = bootSoleTopY + bootSoleHeight;
      // Arm/Shoulder Positions
      const shoulderCenterY = torsoTopY + torsoHeight * 0.15;
      const shoulderOffsetX = torsoUpperWidth * 0.5;
      const armTopY = shoulderCenterY + shoulderPadRadius * 0.3;
      // Colors
      const playerBodyColor = isSelf
        ? dustyPlayerSelfColor
        : dustyPlayerOtherColor;
      const helmetColor = ironHelmetColor;
      const armorColor = simpleChestPlateColor;
      const armorHighlight = chestPlateHighlight;
      const armorShadow = ironHelmetShadow;
      const slitColor = "#000000";
      const beltColor = "#412a19";
      const beltBuckleColor = "#b0a080";
      const bootColor = "#241c1c";
      const bootSoleColor = "#1a1a1a";
      ctx.save();
      // Shadow
      ctx.beginPath();
      ctx.ellipse(x, bootBottomY + 2, w * 0.5, h * 0.06, 0, 0, Math.PI * 2);
      ctx.fillStyle = backgroundShadowColor;
      ctx.fill();
      // Boot Helper
      const drawBoot = (bootX, bootTopYCoord, isKick = false, kickAngle = 0) => {
        ctx.save();
        if (isKick) {
          ctx.translate(bootX, bootTopYCoord);
          ctx.rotate(kickAngle);
          bootTopYCoord = 0;
        }
        const shaftTopY = bootTopYCoord;
        const shaftBottomY = shaftTopY + bootShaftHeight;
        const soleTopY = shaftBottomY;
        const soleBottomY = soleTopY + bootSoleHeight;
        ctx.fillStyle = bootColor;
        ctx.fillRect(
          bootX - bootWidth / 2,
          shaftTopY,
          bootWidth,
          bootShaftHeight
        );
        ctx.fillStyle = bootSoleColor;
        const soleWidth = bootWidth * 1.05;
        ctx.fillRect(bootX - soleWidth / 2, soleTopY, soleWidth, bootSoleHeight);
        ctx.fillStyle = bootSoleColor;
        const heelWidth = bootWidth * 0.6;
        const heelHeight = bootSoleHeight * 0.8;
        ctx.fillRect(
          bootX - heelWidth * 0.1,
          soleBottomY - heelHeight,
          heelWidth,
          heelHeight
        );
        if (isKick) {
          ctx.restore();
        }
      };
      // Legs & Boots
      const isPushbackAnimating =
        pushbackAnimState?.active && now < pushbackAnimState?.endTime;
      ctx.fillStyle = playerBodyColor;
      if (isPushbackAnimating) {
        const kickAngle = -Math.PI / 4.5;
        const supportLegX = x + w * 0.15;
        const kickLegX = x - w * 0.15;
        const kickLegVisualLength = legHeight * 1.05;
        ctx.beginPath();
        ctx.moveTo(supportLegX - legUpperWidth / 2, legTopY);
        ctx.lineTo(supportLegX + legUpperWidth / 2, legTopY);
        ctx.lineTo(supportLegX + legLowerWidth / 2, legBottomY);
        ctx.lineTo(supportLegX - legLowerWidth / 2, legBottomY);
        ctx.closePath();
        ctx.fill();
        drawBoot(supportLegX, bootTopY);
        ctx.save();
        ctx.translate(kickLegX, legTopY + legHeight * 0.1);
        ctx.rotate(kickAngle);
        ctx.fillStyle = playerBodyColor;
        ctx.beginPath();
        ctx.moveTo(-legUpperWidth / 2, 0);
        ctx.lineTo(legUpperWidth / 2, 0);
        ctx.lineTo(legLowerWidth / 2, kickLegVisualLength);
        ctx.lineTo(-legLowerWidth / 2, kickLegVisualLength);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const kickEndX = kickLegX + Math.sin(kickAngle) * kickLegVisualLength;
        const kickEndY =
          legTopY + legHeight * 0.1 + Math.cos(kickAngle) * kickLegVisualLength;
        drawBoot(kickEndX, kickEndY - bootShaftHeight, false);
      } else {
        const leftLegX = x - w * 0.2;
        const rightLegX = x + w * 0.2;
        let leftBootYOffset = 0;
        let rightBootYOffset = 0;
        if (!ii) {
          const walkCycleTime = 400;
          const phase = (t % walkCycleTime) / walkCycleTime;
          const liftAmount = -2;
          if (phase < 0.5) {
            leftBootYOffset = Math.sin(phase * 2 * Math.PI) * liftAmount;
          } else {
            rightBootYOffset = Math.sin((phase - 0.5) * 2 * Math.PI) * liftAmount;
          }
        }
        ctx.beginPath();
        ctx.moveTo(leftLegX - legUpperWidth / 2, legTopY);
        ctx.lineTo(leftLegX + legUpperWidth / 2, legTopY);
        ctx.lineTo(leftLegX + legLowerWidth / 2, legBottomY);
        ctx.lineTo(leftLegX - legLowerWidth / 2, legBottomY);
        ctx.closePath();
        ctx.fill();
        drawBoot(leftLegX, bootTopY + leftBootYOffset);
        ctx.beginPath();
        ctx.moveTo(rightLegX - legUpperWidth / 2, legTopY);
        ctx.lineTo(rightLegX + legUpperWidth / 2, legTopY);
        ctx.lineTo(rightLegX + legLowerWidth / 2, legBottomY);
        ctx.lineTo(rightLegX - legLowerWidth / 2, legBottomY);
        ctx.closePath();
        ctx.fill();
        drawBoot(rightLegX, bootTopY + rightBootYOffset);
      }
      // Torso
      ctx.fillStyle = playerBodyColor;
      ctx.beginPath();
      ctx.moveTo(x - torsoUpperWidth / 2, torsoTopY);
      ctx.lineTo(x + torsoUpperWidth / 2, torsoTopY);
      ctx.lineTo(x + torsoLowerWidth / 2, torsoBottomY);
      ctx.lineTo(x - torsoLowerWidth / 2, torsoBottomY);
      ctx.closePath();
      ctx.fill();
      // Arms
      const armPitXLeft = x - torsoUpperWidth * 0.45;
      const armPitXRight = x + torsoUpperWidth * 0.45;
      const wristXLeft = x - (torsoUpperWidth * 0.45 + armWidth * 0.3);
      const wristXRight = x + (torsoUpperWidth * 0.45 + armWidth * 0.3);
      const armBottomY = armTopY + armLength;
      ctx.beginPath();
      ctx.moveTo(armPitXLeft, armTopY);
      ctx.lineTo(armPitXLeft + armWidth, armTopY);
      ctx.lineTo(wristXRight - armWidth, armBottomY);
      ctx.lineTo(wristXLeft, armBottomY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(armPitXRight - armWidth, armTopY);
      ctx.lineTo(armPitXRight, armTopY);
      ctx.lineTo(wristXRight, armBottomY);
      ctx.lineTo(wristXRight - armWidth * 0.7, armBottomY);
      ctx.closePath();
      ctx.fill();
      // Belt
      ctx.fillStyle = beltColor;
      ctx.fillRect(
        x - torsoLowerWidth * 0.55,
        beltTopY,
        torsoLowerWidth * 1.1,
        beltHeight
      );
      ctx.fillStyle = beltBuckleColor;
      const buckleWidth = w * 0.25;
      const buckleHeight = beltHeight * 0.8;
      ctx.fillRect(
        x - buckleWidth / 2,
        beltTopY + (beltHeight - buckleHeight) / 2,
        buckleWidth,
        buckleHeight
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(
        x - buckleWidth / 2 + 2,
        beltTopY + (beltHeight - buckleHeight) / 2 + 2,
        buckleWidth - 4,
        2
      );
      // Chest Plate
      const plateWidth = torsoUpperWidth * 0.9;
      const plateHeight = torsoHeight * 0.9;
      const plateTopY = torsoTopY + torsoHeight * 0.05;
      const plateBottomY = plateTopY + plateHeight;
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.moveTo(x - plateWidth / 2, plateTopY);
      ctx.lineTo(x + plateWidth / 2, plateTopY);
      ctx.lineTo(x + plateWidth * 0.4, plateBottomY);
      ctx.lineTo(x - plateWidth * 0.4, plateBottomY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = armorHighlight;
      ctx.fillRect(x - plateWidth / 2 + 4, plateTopY + 4, plateWidth - 8, 3);
      ctx.fillStyle = armorShadow;
      ctx.fillRect(x - plateWidth / 2 + 5, plateTopY + 7, plateWidth - 10, 2);
      // Shoulders
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.arc(
        x - shoulderOffsetX,
        shoulderCenterY,
        shoulderPadRadius,
        Math.PI * 1.1,
        Math.PI * 1.9
      );
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = armorHighlight;
      ctx.beginPath();
      ctx.arc(
        x - shoulderOffsetX,
        shoulderCenterY - 2,
        shoulderPadRadius * 0.8,
        Math.PI * 1.2,
        Math.PI * 1.8
      );
      ctx.arc(
        x - shoulderOffsetX,
        shoulderCenterY,
        shoulderPadRadius * 0.9,
        Math.PI * 1.8,
        Math.PI * 1.2,
        true
      );
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.arc(
        x + shoulderOffsetX,
        shoulderCenterY,
        shoulderPadRadius,
        Math.PI * 0.1,
        Math.PI * 0.9,
        true
      );
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = armorHighlight;
      ctx.beginPath();
      ctx.arc(
        x + shoulderOffsetX,
        shoulderCenterY - 2,
        shoulderPadRadius * 0.8,
        Math.PI * 0.2,
        Math.PI * 0.8,
        true
      );
      ctx.arc(
        x + shoulderOffsetX,
        shoulderCenterY,
        shoulderPadRadius * 0.9,
        Math.PI * 0.8,
        Math.PI * 0.2,
        false
      );
      ctx.closePath();
      ctx.fill();
      // Helmet
      ctx.fillStyle = helmetColor;
      ctx.fillRect(x - headWidth / 2, headTopY, headWidth, headHeight);
      const curveRadius = headWidth * 0.1;
      ctx.beginPath();
      ctx.moveTo(x - headWidth / 2, headTopY + curveRadius);
      ctx.lineTo(x - headWidth / 2, headTopY);
      ctx.lineTo(x + headWidth / 2, headTopY);
      ctx.lineTo(x + headWidth / 2, headTopY + curveRadius);
      ctx.arcTo(
        x + headWidth / 2,
        headTopY,
        x + headWidth / 2 - curveRadius,
        headTopY,
        curveRadius
      );
      ctx.arcTo(
        x - headWidth / 2,
        headTopY,
        x - headWidth / 2,
        headTopY + curveRadius,
        curveRadius
      );
      ctx.fill();
      ctx.fillStyle = helmetColor;
      ctx.fillRect(
        x - headWidth * 0.4,
        headBottomY - neckHeight * 0.5,
        headWidth * 0.8,
        neckHeight * 1.2
      );
      ctx.fillStyle = armorHighlight;
      ctx.fillRect(x - headWidth / 2 + 3, headTopY + 3, headWidth - 6, 2);
      const rivetRadius = 1.5;
      ctx.beginPath();
      ctx.arc(
        x - headWidth * 0.4,
        headBottomY - neckHeight * 0.2,
        rivetRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        x + headWidth * 0.4,
        headBottomY - neckHeight * 0.2,
        rivetRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, headTopY + headHeight * 0.85, rivetRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = slitColor;
      const slitHeight = headHeight * 0.12;
      const slitWidth = headWidth * 0.8;
      const slitY = headTopY + headHeight * 0.45;
      ctx.fillRect(x - slitWidth / 2, slitY, slitWidth, slitHeight);
      // Gun
      let shouldDrawGun = false;
      let gunDrawAngle = 0;
      let gunDrawMode = "aiming";
      if (isPushbackAnimating) {
        shouldDrawGun = true;
        gunDrawMode = "pushback";
        gunDrawAngle = -Math.PI / 2;
      } else if (isSelf && (aimDx !== 0 || aimDy !== 0)) {
        shouldDrawGun = true;
        gunDrawMode = "aiming";
        gunDrawAngle = Math.atan2(aimDy, aimDx);
      }
      if (shouldDrawGun) {
        const gunLevel = playerState?.gun ?? 1;
        const baseBarrelLength = 18;
        const barrelLengthIncrease = 2;
        const barrelLength =
          baseBarrelLength + (gunLevel - 1) * barrelLengthIncrease;
        const barrelThickness = 3 + (gunLevel - 1) * 0.2;
        const stockLength = 8 + (gunLevel - 1) * 0.5;
        const stockThickness = 5 + (gunLevel - 1) * 0.3;
        const stockColor = "#8B4513";
        const barrelColor = "#444444";
        const gunOriginYOffset = armTopY + armLength * 0.4;
        const gunOriginXOffset = gunDrawMode === "pushback" ? w * 0.05 : w * 0.1;
        ctx.save();
        ctx.translate(x + gunOriginXOffset, gunOriginYOffset);
        ctx.rotate(gunDrawAngle);
        ctx.fillStyle = stockColor;
        ctx.fillRect(
          -stockLength - 2,
          -stockThickness / 2,
          stockLength,
          stockThickness
        );
        ctx.fillStyle = barrelColor;
        ctx.fillRect(0, -barrelThickness / 2, barrelLength, barrelThickness);
        ctx.restore();
      }
      // Effects
      if (isPlayerBitten) {
        const footY = bootBottomY;
        const numParticles = 8;
        const particleBaseSize = 4;
        const particleSpeedY = -60;
        const particleLifetimeMs = 600;
        ctx.save();
        for (let i = 0; i < numParticles; i++) {
          const effectStartTime =
            playerSnakeEffect.expires_at * 1000 - SNAKE_BITE_DURATION * 1000;
          const timeSinceEffectStart = Math.max(0, now - effectStartTime);
          const particleSimulatedAge =
            (timeSinceEffectStart + (particleLifetimeMs / numParticles) * i) %
            particleLifetimeMs;
          const particleProgress = particleSimulatedAge / particleLifetimeMs;
          if (particleProgress < 0 || particleProgress >= 1) continue;
          const particleX = x + (Math.random() - 0.5) * w * 0.7;
          const particleY =
            footY + particleSpeedY * (particleSimulatedAge / 1000);
          const particleSize =
            particleBaseSize *
            (1.0 - particleProgress * 0.5) *
            (0.8 + Math.random() * 0.4);
          const alpha =
            0.8 * (1.0 - particleProgress) * (0.7 + Math.random() * 0.3);
          const green = 180 + Math.floor(75 * particleProgress);
          const yellow = 200 * (1.0 - particleProgress);
          ctx.fillStyle = `rgba(${Math.floor(
            yellow
          )}, ${green}, 50, ${alpha.toFixed(2)})`;
          ctx.fillRect(
            particleX - particleSize / 2,
            particleY - particleSize / 2,
            particleSize,
            particleSize
          );
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
    
            // Get aim direction and pushback state ONLY for the local player
            const adx=is?localPlayerMuzzleFlashRef?.aimDx:0;
            const ady=is?localPlayerMuzzleFlashRef?.aimDy:0;
            const pushbackState = is ? localPlayerPushbackAnimStateRef : null;
    
            // Call the function to draw the actual character (V2)
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
    // --- V2: Added activeBloodSparkEffectsRef parameter ---
    function drawEnemies(
      ctx,
      enemies,
      activeBloodSparkEffectsRef
    ) {
      if (!enemies) return;
      const now = performance.now() / 1000; // Server time for fade check
      const clientNow = performance.now(); // Client time for effects
      const fd = 0.3; // Fade duration
  
      Object.values(enemies).forEach((e) => {
        if (!e) return;
        const w = e.width ?? 20,
          h = e.height ?? 40,
          mh = e.max_health ?? 50;
        let a = 1.0,
          sd = true,
          id = false;
        if (e.health <= 0 && e.death_timestamp) {
          id = true;
          const el = now - e.death_timestamp;
          if (el < fd) a = Math.max(0.1, 1.0 - (el / fd) * 0.9);
          // Smoother fade
          else sd = false; // Don't draw if faded
        }
        if (sd) {
          ctx.save();
          ctx.globalAlpha = a;
          drawEnemyRect(
            ctx,
            e.x,
            e.y,
            w,
            h,
            e.type,
            e,
            activeBloodSparkEffectsRef,
            clientNow
          ); // Pass client time & spark map
          ctx.restore();
        }
        if (!id && e.health > 0 && sd) {
          drawHealthBar(ctx, e.x, e.y, w, e.health, mh);
        }
      });
    }
  
    function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy) {
      const numPoints = 5;
      const outerRadiusBase = 9;
      const outerRadiusVariance = 3;
      const innerRadiusBase = 4;
      const innerRadiusVariance = 1.5;
      const glowRadius = 25;
      const glowColor = "rgba(255, 200, 50, 0.25)";
      const flashColor = "rgba(255, 230, 100, 0.95)";
      const offsetDistance = 30;
      const flashX = playerX + aimDx * offsetDistance;
      const flashY = playerY + aimDy * offsetDistance;
      const angle = Math.atan2(aimDy, aimDx);
      ctx.save();
      ctx.translate(flashX, flashY);
      ctx.rotate(angle);
      const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
      glowGradient.addColorStop(0, glowColor);
      glowGradient.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flashColor;
      ctx.beginPath();
      for (let i = 0; i < numPoints * 2; i++) {
        const radius =
          i % 2 === 0
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
  
    function drawBulletCircle(
      ctx,
      bullet,
      trailLengthFactor = 0.8,
      trailBaseAlpha = 0.6
    ) {
      const { x, y, vx = 0, vy = 0, radius: r = 4, owner_type } = bullet;
      const isPlayerBullet = owner_type === "player";
      const color = isPlayerBullet ? bulletPlayerColor : bulletEnemyColor;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const trailLength = r * 2 * trailLengthFactor * Math.min(1, speed / 100);
      let startX = x,
        startY = y;
      if (speed > 1) {
        startX = x - (vx / speed) * trailLength;
        startY = y - (vy / speed) * trailLength;
      }
      if (trailLength > 1 && speed > 1) {
        try {
          const gradient = ctx.createLinearGradient(startX, startY, x, y);
          let trailStartColor = color;
          if (color.startsWith("#")) {
            let alphaHex = Math.round(trailBaseAlpha * 255)
              .toString(16)
              .padStart(2, "0");
            trailStartColor = color + alphaHex;
          } else if (color.startsWith("rgb")) {
            trailStartColor = color
              .replace(/rgb/i, "rgba")
              .replace(")", `, ${trailBaseAlpha})`);
          }
          gradient.addColorStop(0, trailStartColor);
          gradient.addColorStop(1, color);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = r * 0.8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        } catch (e) {
          ctx.strokeStyle = color;
          ctx.lineWidth = r * 0.8;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = "butt";
    }
  
    function drawShapedBullet(
      ctx,
      bullet,
      trailLengthFactor = 1.0,
      trailBaseAlpha = 0.7
    ) {
      const { x, y, vx = 0, vy = 0, radius: r = 4, owner_type } = bullet;
      const isPlayerBullet = owner_type === "player";
      const color = isPlayerBullet ? bulletPlayerColor : bulletEnemyColor;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const baseLength = 8,
        baseWidth = 4;
      const scaleFactor = r / 4;
      const shapeLength = baseLength * scaleFactor;
      const shapeWidth = baseWidth * scaleFactor;
      const trailLength =
        shapeLength * trailLengthFactor * Math.min(1, speed / 150);
      let startX = x,
        startY = y;
      if (speed > 1) {
        startX = x - (vx / speed) * trailLength;
        startY = y - (vy / speed) * trailLength;
      }
      if (trailLength > 1 && speed > 1) {
        try {
          const gradient = ctx.createLinearGradient(startX, startY, x, y);
          let trailStartColor = color;
          if (color.startsWith("#")) {
            let alphaHex = Math.round(trailBaseAlpha * 255)
              .toString(16)
              .padStart(2, "0");
            trailStartColor = color + alphaHex;
          } else if (color.startsWith("rgb")) {
            trailStartColor = color
              .replace(/rgb/i, "rgba")
              .replace(")", `, ${trailBaseAlpha})`);
          }
          gradient.addColorStop(0, trailStartColor);
          gradient.addColorStop(1, color);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = shapeWidth * 0.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        } catch (e) {
          ctx.strokeStyle = color;
          ctx.lineWidth = shapeWidth * 0.6;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      const angle = Math.atan2(vy, vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.fillRect(-shapeLength / 2, -shapeWidth / 2, shapeLength, shapeWidth);
      const noseLength = shapeLength * 0.4;
      ctx.beginPath();
      ctx.moveTo(shapeLength / 2, 0);
      ctx.lineTo(shapeLength / 2 - noseLength, -shapeWidth / 2);
      ctx.lineTo(shapeLength / 2 - noseLength, shapeWidth / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.lineCap = "butt";
    }
  
    function drawBullets(ctx, bullets) {
      if (!bullets) return;
      Object.values(bullets).forEach((b) => {
        if (!b) return;
        const bt = b.bullet_type || "standard";
        const hv = Math.abs(b.vx ?? 0) > 0.01 || Math.abs(b.vy ?? 0) > 0.01;
        if (bt === "ammo_heavy_slug") {
          if (hv) {
            drawShapedBullet(ctx, b, 0.6, 0.8);
          } else {
            drawBulletCircle(ctx, b, 0.4, 0.8);
          }
        } else if (bt === "ammo_shotgun") {
          drawBulletCircle(ctx, b, 0.5, 0.5);
        } else if (
          bt === "ammo_rapid_fire" ||
          bt === "standard" ||
          bt === "standard_enemy"
        ) {
          if (hv) {
            drawShapedBullet(ctx, b, 1.0, 0.7);
          } else {
            drawBulletCircle(ctx, b, 0, 0);
          }
        } else {
          drawBulletCircle(ctx, b, 0.8, 0.6);
        }
      });
    }
  
    function drawPowerupSquare(ctx, x, y, size, type) {
      let baseColor = powerupDefaultColor;
      let symbol = "?";
      let symbolColor = "#FFFFFF";
      let symbolSizeFactor = 0.7;
      if (type === "health") {
        symbol = "+";
        baseColor = powerupHealthColor;
        symbolColor = "#FFFFFF";
      } else if (type === "gun_upgrade") {
        symbol = "▲";
        baseColor = powerupGunColor;
        symbolColor = "#FFFF00";
        symbolSizeFactor = 0.6;
      } else if (type === "speed_boost") {
        symbol = "»";
        baseColor = powerupSpeedColor;
        symbolColor = "#FFFFFF";
        symbolSizeFactor = 0.8;
      } else if (type === "armor") {
        symbol = "■";
        baseColor = powerupArmorColor;
        symbolColor = "#DDDDDD";
        symbolSizeFactor = 0.5;
      } else if (type === "ammo_shotgun") {
        symbol = "::";
        baseColor = powerupShotgunColor;
        symbolColor = "#FFFFFF";
        symbolSizeFactor = 0.6;
      } else if (type === "ammo_heavy_slug") {
        symbol = "●";
        baseColor = powerupSlugColor;
        symbolColor = "#FFEBCD";
        symbolSizeFactor = 0.5;
      } else if (type === "ammo_rapid_fire") {
        symbol = ">";
        baseColor = powerupRapidColor;
        symbolColor = "#333333";
        symbolSizeFactor = 0.6;
      } else if (type === "bonus_score") {
        symbol = "$";
        baseColor = powerupScoreColor;
        symbolColor = "#FFFFFF";
      }
      const t = performance.now();
      const pulseSpeed = 0.002;
      const pulseSizeAmount = 0.08;
      const pulseAlphaAmount = 0.15;
      const pulseFactor = Math.sin(t * pulseSpeed);
      const currentSize = size * (1 + pulseFactor * pulseSizeAmount);
      const currentAlpha = 0.85 + pulseFactor * pulseAlphaAmount;
      ctx.save();
      ctx.globalAlpha = currentAlpha;
      const glowRadius = currentSize * 0.7;
      const glowColor = baseColor.replace("rgb", "rgba").replace(")", `, 0.3)`);
      try {
        const gradient = ctx.createRadialGradient(
          x,
          y,
          currentSize * 0.3,
          x,
          y,
          glowRadius
        );
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(
          1,
          baseColor.replace("rgb", "rgba").replace(")", `, 0.0)`)
        );
        ctx.fillStyle = gradient;
        ctx.fillRect(
          x - glowRadius,
          y - glowRadius,
          glowRadius * 2,
          glowRadius * 2
        );
      } catch (e) {}
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      if (typeof drawRoundedRect === "function") {
        drawRoundedRect(
          ctx,
          x - currentSize / 2,
          y - currentSize / 2,
          currentSize,
          currentSize,
          currentSize * 0.15
        );
      } else {
        ctx.rect(
          x - currentSize / 2,
          y - currentSize / 2,
          currentSize,
          currentSize
        );
      }
      ctx.fill();
      ctx.fillStyle = symbolColor;
      let fs = Math.round(currentSize * symbolSizeFactor);
      fs = Math.max(8, fs);
      ctx.font = `bold ${fs}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(symbol, x, y + currentSize * 0.03);
      ctx.restore();
    }
  
    function drawPowerups(ctx, powerups) {
      if (!powerups) return;
      Object.values(powerups).forEach((p) => {
        if (!p) return;
        const s = p.size ?? 20;
        drawPowerupSquare(ctx, p.x, p.y, s, p.type);
      });
    }
  
    function triggerShake(magnitude, durationMs) {
      const now = performance.now(),
        net = now + durationMs;
      if (magnitude >= currentShakeMagnitude || net >= shakeEndTime) {
        currentShakeMagnitude = Math.max(magnitude, currentShakeMagnitude);
        shakeEndTime = Math.max(net, shakeEndTime);
      }
    }
  
    // --- Main Render Function --- V3 --- Correct Signature ---
    function drawGame(
        ctx,
        appState,
        stateToRender,
        localPlayerMuzzleFlashRef,
        localPlayerPushbackAnimState,
        activeBloodSparkEffectsRef,
        activeEnemyBubbles
      ) {
        if (!mainCtx) mainCtx = ctx;
        if (!ctx || !appState) {
          console.error("drawGame missing context or appState!");
          return;
        }
        const now = performance.now();
      
        let shakeApplied = false,
          shakeOffsetX = 0,
          shakeOffsetY = 0;
        if (currentShakeMagnitude > 0 && now < shakeEndTime) {
          shakeApplied = true;
          const timeRemaining = shakeEndTime - now;
          const initialDuration = Math.max(1, shakeEndTime - (now - timeRemaining));
          let currentMag =
            currentShakeMagnitude * (timeRemaining / initialDuration);
          currentMag = Math.max(0, currentMag);
          if (currentMag > 0.5) {
            const shakeAngle = Math.random() * Math.PI * 2;
            shakeOffsetX = Math.cos(shakeAngle) * currentMag;
            shakeOffsetY = Math.sin(shakeAngle) * currentMag;
          } else {
            currentShakeMagnitude = 0;
            shakeEndTime = 0;
            shakeApplied = false;
          }
        } else if (currentShakeMagnitude > 0) {
          currentShakeMagnitude = 0;
          shakeEndTime = 0;
        }
      
        ctx.globalAlpha = 1.0;
        if (!isBackgroundReady) {
          ctx.fillStyle = dayBaseColor;
          ctx.fillRect(0, 0, appState.canvasWidth, appState.canvasHeight);
          if (appState?.serverState && currentBackgroundIsNight === null) {
            updateGeneratedBackground(
              appState.serverState.is_night
            );
          }
        } else if (isTransitioningBackground) {
          const elapsed = now - transitionStartTime;
          const progress = Math.min(1.0, elapsed / BACKGROUND_FADE_DURATION_MS);
          ctx.globalAlpha = 1.0;
          ctx.drawImage(oldOffscreenCanvas, 0, 0);
          ctx.globalAlpha = progress;
          ctx.drawImage(offscreenCanvas, 0, 0);
          ctx.globalAlpha = 1.0;
          if (progress >= 1.0) {
            isTransitioningBackground = false;
          }
        } else {
          ctx.drawImage(offscreenCanvas, 0, 0);
        }
      
        const currentTempForEffect = appState?.currentTemp;
        if (
          currentTempForEffect !== null &&
          typeof currentTempForEffect !== "undefined" &&
          currentTempForEffect >= HEAT_HAZE_START_TEMP
        ) {
          const hazeIntensity = Math.max(
            0,
            Math.min(
              1,
              (currentTempForEffect - HEAT_HAZE_START_TEMP) /
                (HEAT_HAZE_MAX_TEMP - HEAT_HAZE_START_TEMP)
            )
          );
          if (hazeIntensity > 0.01) {
            if (
                typeof hazeCanvas !== 'undefined' &&
                typeof hazeCtx !== 'undefined' &&
                isFinite(appState.canvasWidth) && appState.canvasWidth > 0 &&
                isFinite(appState.canvasHeight) && appState.canvasHeight > 0
               )
            {
                if (
                  hazeCanvas.width !== appState.canvasWidth ||
                  hazeCanvas.height !== appState.canvasHeight
                ) {
                  hazeCanvas.width = appState.canvasWidth;
                  hazeCanvas.height = appState.canvasHeight;
                }
                hazeCtx.clearRect(0, 0, appState.canvasWidth, appState.canvasHeight);
                if (ctx.canvas) {
                    hazeCtx.drawImage(ctx.canvas, 0, 0);
                } else {
                    console.error("Heat Haze: Main context canvas missing.");
                    return;
                }
      
                const numLayers =
                  1 + Math.floor(hazeIntensity * (HEAT_HAZE_LAYERS_MAX - 1));
                const baseAlpha = HEAT_HAZE_BASE_ALPHA * hazeIntensity;
                for (let i = 0; i < numLayers; i++) {
                  const timeFactor = now * HEAT_HAZE_SPEED;
                  const layerOffsetFactor = i * 0.8;
                  const verticalOffset =
                    Math.sin(timeFactor + layerOffsetFactor) *
                      HEAT_HAZE_MAX_OFFSET *
                      hazeIntensity -
                    i * 0.3 * hazeIntensity;
                  const layerAlpha = baseAlpha * (1 - i / (numLayers * 1.5));
                  ctx.globalAlpha = Math.max(0, Math.min(1, layerAlpha));
                  ctx.drawImage(
                    hazeCanvas,
                    0,
                    0,
                    appState.canvasWidth,
                    appState.canvasHeight,
                    0,
                    verticalOffset,
                    appState.canvasWidth,
                    appState.canvasHeight
                  );
                }
                ctx.globalAlpha = 1.0;
            } else {
                 console.error("Heat Haze: Skipping due to invalid canvas/dimensions.");
            }
          }
        }
      
        if (shakeApplied) {
          ctx.save();
          ctx.translate(shakeOffsetX, shakeOffsetY);
        }
      
        if (!stateToRender) {
          if (shakeApplied) ctx.restore();
          return;
        }
        drawCampfire(ctx, stateToRender.campfire, appState.canvasWidth, appState.canvasHeight);
        if (typeof snake !== "undefined") drawSnake(ctx, snake);
        drawPowerups(ctx, stateToRender.powerups);
        drawBullets(ctx, stateToRender.bullets);
      
          drawEnemies(
            ctx,
            stateToRender.enemies,
            activeEnemyBubbles,
            activeBloodSparkEffectsRef
          );
          if (typeof activeSpeechBubbles !== "undefined" && appState)
            drawPlayers(
              ctx,
              stateToRender.players,
              appState,
              localPlayerMuzzleFlashRef,
              localPlayerPushbackAnimState
            );
          if (typeof activeSpeechBubbles !== "undefined" && appState)
            drawSpeechBubbles(
              ctx,
              stateToRender.players,
              activeSpeechBubbles,
              appState
            );
          drawEnemySpeechBubbles(ctx, stateToRender.enemies, activeEnemyBubbles);
          drawDamageTexts(ctx, stateToRender.damage_texts);
          let shouldDrawMuzzleFlash =
            localPlayerMuzzleFlashRef?.active &&
            now < localPlayerMuzzleFlashRef?.endTime;
          if (shouldDrawMuzzleFlash) {
            drawMuzzleFlash(
              ctx,
              appState.renderedPlayerPos.x,
              appState.renderedPlayerPos.y,
              localPlayerMuzzleFlashRef.aimDx,
              localPlayerMuzzleFlashRef.aimDy
            );
          } else if (localPlayerMuzzleFlashRef?.active) {
            localPlayerMuzzleFlashRef.active = false;
          }
      
        if (shakeApplied) {
          ctx.restore();
        }
      
        ctx.globalAlpha = 1.0;
        if (appState?.isRaining) {
          const RAIN_SPEED_Y = 12;
          const RAIN_SPEED_X = 1;
          ctx.strokeStyle = RAIN_COLOR;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < RAIN_DROPS; i++) {
            const rainX = ((i * 137 + now * 0.05) % (appState.canvasWidth + 100)) - 50;
            const rainY = (i * 271 + now * 0.3) % appState.canvasHeight;
            const endX = rainX + RAIN_SPEED_X;
            const endY = rainY + RAIN_SPEED_Y;
            ctx.moveTo(rainX, rainY);
            ctx.lineTo(endX, endY);
          }
          ctx.stroke();
        } else if (appState?.isDustStorm) {
          ctx.fillStyle = "rgba(229, 169, 96, 0.2)";
          ctx.fillRect(0, 0, appState.canvasWidth, appState.canvasHeight);
        }
        if (appState)
          drawTemperatureTint(ctx, appState.currentTemp, appState.canvasWidth, appState.canvasHeight);
        const localPlayerState = stateToRender.players?.[appState?.localPlayerId];
        if (
          localPlayerState &&
          localPlayerState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD
        ) {
          const vi =
            1.0 - localPlayerState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD;
          drawDamageVignette(ctx, vi, appState.canvasWidth, appState.canvasHeight);
        }
      
        ctx.globalAlpha = 1.0;
      }
  
    return { drawGame, triggerShake, updateGeneratedBackground };
  })(); // End Renderer module IIFE
  
  console.log(
    "--- Renderer.js: Executed. Renderer object defined?",
    typeof Renderer
  );
  
