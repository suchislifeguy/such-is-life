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
  const hazeCanvas = document.createElement("canvas");
  const hazeCtx = hazeCanvas.getContext("2d", { willReadFrequently: true });

  // --- Style & Gameplay Constants ---
  const playerColor = "#DC143C";
  const dayBaseColor = "#8FBC8F";
  const fontFamily = "'Courier New', monospace";
  const damageTextColor = "#FFFFFF";
  const damageTextCritColor = "#FFD700";
  const damageTextFontSize = 14;
  const damageTextCritFontSize = 18;
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
  const ironHelmetColor = "#3d3d3d";
  const ironHelmetHighlight = "#666666";
  const ironHelmetShadow = "#1a1a1a";
  const beltColor = "#412a19";
  const bootColor = "#241c1c";
  const backgroundShadowColor = "rgba(0,0,0,0.3)";
  const simpleChestPlateColor = "#777777";
  const chestPlateHighlight = "#999999";
  const slitColor = "#000000"; // For player helmet

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
  const HEAT_HAZE_START_TEMP_RENDERER = 28.0;
  const HEAT_HAZE_MAX_TEMP_RENDERER = 45.0;
  const HEAT_HAZE_MAX_OFFSET = 4;
  const HEAT_HAZE_SPEED = 0.004;
  const HEAT_HAZE_LAYERS_MAX = 5;
  const HEAT_HAZE_BASE_ALPHA = 0.03;

  let currentShakeMagnitude = 0;
  let shakeEndTime = 0;

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
          ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
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
        if (randColor < 0.1) strokeColor = textureStrokeEmerald;
        else if (randColor < 0.55) strokeColor = textureStrokeLight;
        else strokeColor = textureStrokeDark;
        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    } else { // Night Background
      const baseNightColor = "#080808";
      const nebulaeColors = [[180, 180, 190, 0.05], [200, 80, 80, 0.04], [160, 160, 160, 0.06], [210, 100, 100, 0.035]];
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
        const colorData = nebulaeColors[Math.floor(Math.random() * nebulaeColors.length)];
        const [r, g, bVal, baseAlpha] = colorData;
        try {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${bVal}, ${Math.min(0.1, baseAlpha * 1.5).toFixed(2)})`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${bVal}, ${baseAlpha.toFixed(2)})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${bVal}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        } catch (e) { console.error("Failed to create nebula gradient:", e); }
      }
      const drawStars = (count, minSize, maxSize, minAlpha, maxAlpha, colorVariance = 0) => {
        for (let i = 0; i < count; i++) {
          const sx = Math.random() * width;
          const sy = Math.random() * height;
          const size = Math.random() * (maxSize - minSize) + minSize;
          const alpha = Math.random() * (maxAlpha - minAlpha) + minAlpha;
          let r = 255, gVal = 255, bVal = 255;
          if (colorVariance > 0 && Math.random() < 0.3) {
            const variance = Math.random() * colorVariance;
            if (Math.random() < 0.7) { // More likely to shift towards blue/cooler
                bVal -= variance;
            } else { // Shift towards yellow/warmer
                r -= variance / 2; gVal -= variance / 2;
            }
            r = Math.max(0, Math.min(255, r)); gVal = Math.max(0, Math.min(255, gVal)); bVal = Math.max(0, Math.min(255, bVal));
          }
          ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(gVal)}, ${Math.round(bVal)}, ${alpha.toFixed(2)})`;
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
    ctx.canvas.dataset.isNight = String(targetIsNight); // Store for reference
  }

  function updateGeneratedBackground(targetIsNight, targetCanvasWidth, targetCanvasHeight) {
    canvasWidth = targetCanvasWidth;
    canvasHeight = targetCanvasHeight;

    if (offscreenCanvas.width !== canvasWidth || offscreenCanvas.height !== canvasHeight) {
      offscreenCanvas.width = canvasWidth;
      offscreenCanvas.height = canvasHeight;
      oldOffscreenCanvas.width = canvasWidth;
      oldOffscreenCanvas.height = canvasHeight;
      hazeCanvas.width = canvasWidth;
      hazeCanvas.height = canvasHeight;
      isBackgroundReady = false;
      currentBackgroundIsNight = null; // Force regeneration on resize
      isTransitioningBackground = false;
    }

    // If already correct and not transitioning, or transitioning to the current target, do nothing.
    if ((targetIsNight === currentBackgroundIsNight && isBackgroundReady && !isTransitioningBackground) ||
        (isTransitioningBackground && targetIsNight === (offscreenCanvas.dataset.isNight === "true"))) {
      return;
    }

    if (isBackgroundReady) { // Start transition if background was previously ready
      oldOffscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0);
      isTransitioningBackground = true;
      transitionStartTime = performance.now();
      generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight);
      currentBackgroundIsNight = targetIsNight; // New offscreen canvas matches target
    } else { // First time generation or after resize
      generateBackground(offscreenCtx, targetIsNight, canvasWidth, canvasHeight);
      currentBackgroundIsNight = targetIsNight;
      isBackgroundReady = true;
      isTransitioningBackground = false;
    }
  }

  function drawDamageTexts(ctx, damageTexts) {
    if (!damageTexts) return;
    const now = performance.now();
    const pulseDuration = 250; // ms for crit pulse
    const pulseMaxSizeIncrease = 4; // pixels
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    Object.values(damageTexts).forEach((dt) => {
      if (!dt) return;
      const x = dt.x ?? 0, y = dt.y ?? 0, text = dt.text ?? "?";
      const isCrit = dt.is_crit ?? false;
      const spawnTime = dt.spawn_time ? dt.spawn_time * 1000 : now;
      const timeSinceSpawn = now - spawnTime;

      let currentFontSize = isCrit ? damageTextCritFontSize : damageTextFontSize;
      let currentFontColor = isCrit ? damageTextCritColor : damageTextColor;

      if (isCrit && timeSinceSpawn < pulseDuration) {
        const pulseProgress = Math.sin((timeSinceSpawn / pulseDuration) * Math.PI);
        currentFontSize += pulseProgress * pulseMaxSizeIncrease;
      }

      ctx.font = `bold ${Math.round(currentFontSize)}px ${fontFamily}`;
      ctx.fillStyle = currentFontColor;
      ctx.fillText(text, x, y);
    });
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
      const gradient = ctx.createRadialGradient(x, logBaseY, 0, x, logBaseY, currentGlowRadius);
      gradient.addColorStop(0, `rgba(255, 165, 0, ${0.35 + glowPulse * 2})`);
      gradient.addColorStop(0.6, "rgba(255, 165, 0, 0.1)");
      gradient.addColorStop(1, "rgba(255, 165, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, logBaseY, currentGlowRadius, 0, Math.PI * 2);
      ctx.fill();
    } catch (e) { console.error("Failed to create campfire gradient:", e); }

    ctx.fillStyle = campfireStickColor;
    ctx.translate(x, logBaseY);
    ctx.rotate(Math.PI / 6);
    ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-stickWidth / 2 + 2, 0); ctx.lineTo(stickWidth / 2 - 2, 0); ctx.stroke();
    ctx.rotate(-Math.PI / 6);
    ctx.rotate(-Math.PI / 5);
    ctx.fillRect(-stickWidth / 2, -stickHeight / 2, stickWidth, stickHeight);
    ctx.beginPath(); ctx.moveTo(-stickWidth / 2 + 2, 0); ctx.lineTo(stickWidth / 2 - 2, 0); ctx.stroke();
    ctx.rotate(Math.PI / 5);
    ctx.translate(-x, -logBaseY);

    const flameColors = [
      { color: `rgba(255, 100, 0, ${0.5 + Math.sin(timeSlow * 1.1 + 1) * 0.1})`, baseHeight: 45, widthFactor: 1.0 },
      { color: `rgba(255, 165, 0, ${0.6 + Math.sin(timeSlow * 0.9 + 2) * 0.15})`, baseHeight: 35, widthFactor: 0.7 },
      { color: `rgba(255, 255, 180, ${0.7 + Math.sin(timeSlow * 1.3 + 3) * 0.2})`, baseHeight: 25, widthFactor: 0.4 },
    ];

    for (let layer = 0; layer < flameColors.length; layer++) {
      const layerData = flameColors[layer];
      ctx.fillStyle = layerData.color;
      for (let i = 0; i < numFlames; i++) {
        const flameOffsetX = (i - (numFlames - 1) / 2) * (flameBaseWidth / numFlames) * 0.8;
        const uniqueTimeOffset = i * 1.57;
        const flickerHeight = Math.sin(timeSlow * (1.0 + i * 0.1) + uniqueTimeOffset) * heightMagnitude + 1.0;
        const flickerWidth = Math.sin(timeSlow * (0.8 + i * 0.15) - uniqueTimeOffset) * widthMagnitude + 1.0;
        const currentHeight = layerData.baseHeight * flickerHeight * (1.0 - layer * 0.1);
        const currentWidth = (flameBaseWidth * layerData.widthFactor * flickerWidth) / numFlames;
        const swayX1 = Math.sin(timeSlow * 1.2 + uniqueTimeOffset + i) * curveMagnitude;
        const swayY1 = Math.sin(timeSlow * 1.4 + uniqueTimeOffset + i + 1) * curveMagnitude * 0.5;
        const swayX2 = Math.sin(timeSlow * 1.3 - uniqueTimeOffset + i + 2) * curveMagnitude;
        const swayY2 = Math.sin(timeSlow * 1.5 - uniqueTimeOffset + i + 3) * curveMagnitude * 0.5;
        const startX = x + flameOffsetX;
        const startY = logBaseY - stickHeight / 2;
        const tipY = startY - currentHeight;
        const midY1 = startY - currentHeight * 0.33;
        const midY2 = startY - currentHeight * 0.66;
        ctx.beginPath();
        ctx.moveTo(startX - currentWidth / 2, startY);
        ctx.bezierCurveTo(startX - currentWidth / 2 + swayX1, midY2 + swayY1, startX + swayX2, midY1 + swayY2, startX, tipY);
        ctx.bezierCurveTo(startX - swayX2, midY1 + swayY2, startX + currentWidth / 2 - swayX1, midY2 + swayY1, startX + currentWidth / 2, startY);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawDamageVignette(ctx, intensity, width, height) {
    if (intensity <= 0) return;
    ctx.save();
    const outerRadius = Math.sqrt(width ** 2 + height ** 2) / 2;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, outerRadius);
    const clampedAlpha = Math.min(1.0, Math.max(0.0, 0.4 * intensity));
    gradient.addColorStop(0, "rgba(255,0,0,0)");
    gradient.addColorStop(0.75, "rgba(255,0,0,0)");
    gradient.addColorStop(1, `rgba(255,0,0,${clampedAlpha.toFixed(2)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawTemperatureTint(ctx, temperature, width, height) {
    let tintColorSpec = null;
    let alpha = 0.0;

    if (temperature === null || typeof temperature === "undefined") return;

    if (temperature <= TEMP_FREEZING_CLIENT) {
      tintColorSpec = "rgba(100,150,255,A)"; // Blueish for freezing
      alpha = MAX_TINT_ALPHA * Math.min(1.0, (TEMP_FREEZING_CLIENT - temperature + 5) / 5.0);
    } else if (temperature <= TEMP_COLD_CLIENT) {
      tintColorSpec = "rgba(150,180,255,A)"; // Lighter blue for cold
      alpha = MAX_TINT_ALPHA * ((TEMP_COLD_CLIENT - temperature) / (TEMP_COLD_CLIENT - TEMP_FREEZING_CLIENT));
    } else if (temperature >= TEMP_SCORCHING_CLIENT) {
      tintColorSpec = "rgba(255,100,0,A)"; // Orange/Red for scorching
      alpha = MAX_TINT_ALPHA * Math.min(1.0, (temperature - TEMP_SCORCHING_CLIENT + 5) / 5.0);
    } else if (temperature >= TEMP_HOT_CLIENT) {
      tintColorSpec = "rgba(255,150,50,A)"; // Orange for hot
      alpha = MAX_TINT_ALPHA * ((temperature - TEMP_HOT_CLIENT) / (TEMP_SCORCHING_CLIENT - TEMP_HOT_CLIENT));
    }

    alpha = Math.max(0, Math.min(MAX_TINT_ALPHA, alpha)); // Clamp alpha

    if (tintColorSpec && alpha > 0.01) {
      ctx.fillStyle = tintColorSpec.replace("A", alpha.toFixed(2));
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawSpeechBubbles(ctx, entitiesToRender, entityType, activeBubblesMapRef, appStateRef) {
    if (!activeBubblesMapRef || !appStateRef) return;
    const now = performance.now();
    const isPlayerType = entityType === 'player';
    const bubbleFont = isPlayerType ? "bold 14px " + fontFamily : "italic 13px " + fontFamily;
    const cornerRadius = isPlayerType ? 6 : 5;
    const textPadding = isPlayerType ? 6 : 5;
    const bubbleOffsetY = isPlayerType ? 35 : 25;
    const bubbleBg = isPlayerType ? playerSpeechBubbleBg : enemySpeechBubbleBg;
    const bubbleColor = isPlayerType ? playerSpeechBubbleColor : enemySpeechBubbleColor;
    const shadowColor = "rgba(0, 0, 0, 0.6)";
    const shadowOffsetX = 2, shadowOffsetY = 2, shadowBlur = 5;

    ctx.font = bubbleFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const expiredBubbleIds = [];
    for (const entityId in activeBubblesMapRef) {
      const bubbleData = activeBubblesMapRef[entityId];
      if (now >= bubbleData.endTime) {
        expiredBubbleIds.push(entityId);
        continue;
      }

      const entity = entitiesToRender?.[entityId];
      let entityX, entityY, entityHeight, isValidEntity = false;

      if (isPlayerType && entity && entity.player_status !== 'dead' && entity.health > 0) {
        entityX = (entityId === appStateRef.localPlayerId) ? appStateRef.renderedPlayerPos.x : entity.x;
        entityY = (entityId === appStateRef.localPlayerId) ? appStateRef.renderedPlayerPos.y : entity.y;
        entityHeight = entity.height ?? 48;
        isValidEntity = true;
      } else if (!isPlayerType && entity && entity.health > 0 && !entity.death_timestamp) {
        entityX = entity.x;
        entityY = entity.y;
        entityHeight = entity.height ?? 40;
        isValidEntity = true;
      }

      if (isValidEntity) {
        const bubbleTargetY = entityY - entityHeight / 2 - bubbleOffsetY;
        const textMetrics = ctx.measureText(bubbleData.text);
        const textWidth = textMetrics.width;
        const bubbleHeight = (isPlayerType ? 14 : 13) + textPadding * 2;
        const bubbleWidth = textWidth + textPadding * 2;
        const bubbleX = entityX - bubbleWidth / 2;
        const bubbleDrawY = bubbleTargetY - bubbleHeight;

        ctx.save();
        ctx.shadowColor = shadowColor; ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX; ctx.shadowOffsetY = shadowOffsetY;
        ctx.fillStyle = bubbleBg;
        drawRoundedRect(ctx, bubbleX, bubbleDrawY, bubbleWidth, bubbleHeight, cornerRadius);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = bubbleColor;
        ctx.fillText(bubbleData.text, entityX, bubbleTargetY - textPadding);
      } else {
        expiredBubbleIds.push(entityId); // Entity no longer valid for bubble
      }
    }
    expiredBubbleIds.forEach(id => { if (activeBubblesMapRef) delete activeBubblesMapRef[id]; });
  }

  function drawHealthBar(ctx, x, y, width, currentHealth, maxHealth) {
    if (maxHealth <= 0) return;
    const barHeight = 5;
    const yOffset = -(width / 2 + 27); // Position above character
    const barWidth = Math.max(20, width * 0.8);
    const currentBarWidth = Math.max(0, (currentHealth / maxHealth) * barWidth);
    const healthPercentage = currentHealth / maxHealth;
    const barX = x - barWidth / 2;
    const barY = y + yOffset;

    ctx.fillStyle = healthBarBg;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    let barColor = healthBarLow;
    if (healthPercentage > 0.66) barColor = healthBarHigh;
    else if (healthPercentage > 0.33) barColor = healthBarMedium;

    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, currentBarWidth, barHeight);
  }

  function drawArmorBar(ctx, x, y, width, currentArmor) {
    const maxArmor = 100; // Assuming max armor is 100
    if (currentArmor <= 0) return;
    const armorBarHeight = 4;
    const healthBarHeight = 5; // From drawHealthBar
    const barSpacing = 1;
    const healthBarYOffset = -(width / 2 + 27);
    const healthBarTopY = y + healthBarYOffset;
    const armorBarTopY = healthBarTopY + healthBarHeight + barSpacing;
    const barWidth = Math.max(20, width * 0.8);
    const currentBarWidth = Math.max(0, (currentArmor / maxArmor) * barWidth);
    const barX = x - barWidth / 2;

    ctx.fillStyle = healthBarBg; // Use same background for consistency
    ctx.fillRect(barX, armorBarTopY, barWidth, armorBarHeight);
    ctx.fillStyle = armorBarColor;
    ctx.fillRect(barX, armorBarTopY, currentBarWidth, armorBarHeight);
  }

  function drawEnemyRect(ctx, x, y, w, h, type, enemyState, activeBloodSparkEffectsRef, clientNowTime) {
    const currentW = w;
    const currentH = h;
    const t = clientNowTime;
    const bobOffset = (type !== 'giant') ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;
    const attackState = (type === 'giant' && enemyState?.attack_state) ? enemyState.attack_state : "idle";
    const enemyId = enemyState?.id;
    const showBloodSparks = enemyId && activeBloodSparkEffectsRef?.[enemyId] && t < activeBloodSparkEffectsRef[enemyId];

    ctx.save();

    if (type === "giant") {
      const bodyWidth = currentW * 0.85, bodyHeight = currentH * 0.7;
      const bodyTopY = y - currentH * 0.4, bodyBottomY = bodyTopY + bodyHeight;
      const legHeight = currentH * 0.25, legWidth = currentW * 0.2, legSpacing = currentW * 0.2;
      const legTopY = bodyBottomY;
      const bootHeight = currentH * 0.1, bootWidth = legWidth * 1.2, bootTopY = legTopY + legHeight;
      const headRadius = currentW * 0.2, headCenterY = bodyTopY - headRadius * 0.5;
      const armShoulderWidth = currentW * 0.18, armWristWidth = currentW * 0.14, armLength = currentH * 0.55;
      const shoulderY = bodyTopY + bodyHeight * 0.15, shoulderXOffset = bodyWidth / 2;

      ctx.fillStyle = enemyBootColor; // Legs are boot color for simplicity
      ctx.fillRect(x - legSpacing - legWidth / 2, legTopY, legWidth, legHeight);
      ctx.fillRect(x + legSpacing - legWidth / 2, legTopY, legWidth, legHeight);
      ctx.fillStyle = enemyBootColor; // Boots
      ctx.fillRect(x - legSpacing - bootWidth / 2, bootTopY, bootWidth, bootHeight);
      ctx.fillRect(x + legSpacing - bootWidth / 2, bootTopY, bootWidth, bootHeight);

      ctx.fillStyle = enemyGiantRed; // Body
      ctx.fillRect(x - bodyWidth / 2, bodyTopY, bodyWidth, bodyHeight);
      if (attackState === 'winding_up') {
          ctx.fillStyle = "rgba(255, 255, 100, 0.15)"; // Wind-up glow
          ctx.fillRect(x - bodyWidth / 2, bodyTopY, bodyWidth, bodyHeight);
      }

      ctx.fillStyle = beltColor; // Belt
      ctx.fillRect(x - bodyWidth / 2, bodyTopY + bodyHeight * 0.7, bodyWidth, bodyHeight * 0.08);

      ctx.fillStyle = enemyGiantRed; // Arms
      if (attackState === 'winding_up' || attackState === 'attacking') {
          const windUpAngle = -Math.PI / 6; const raisedOffsetY = -armLength * 0.1;
          ctx.save(); ctx.translate(x - shoulderXOffset, shoulderY + raisedOffsetY); ctx.rotate(windUpAngle);
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(armShoulderWidth,0); ctx.lineTo(armShoulderWidth*0.7, armLength); ctx.lineTo(armWristWidth*0.3, armLength); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.save(); ctx.translate(x + shoulderXOffset, shoulderY + raisedOffsetY); ctx.rotate(-windUpAngle);
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-armShoulderWidth,0); ctx.lineTo(-armShoulderWidth*0.7, armLength); ctx.lineTo(-armWristWidth*0.3, armLength); ctx.closePath(); ctx.fill();
          ctx.restore();
      } else {
          const armBottomY = shoulderY + armLength;
          ctx.beginPath(); ctx.moveTo(x - shoulderXOffset, shoulderY); ctx.lineTo(x - shoulderXOffset - armShoulderWidth, shoulderY); ctx.lineTo(x - shoulderXOffset - armWristWidth, armBottomY); ctx.lineTo(x - shoulderXOffset - armWristWidth * 0.5, armBottomY); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x + shoulderXOffset, shoulderY); ctx.lineTo(x + shoulderXOffset + armShoulderWidth, shoulderY); ctx.lineTo(x + shoulderXOffset + armWristWidth, armBottomY); ctx.lineTo(x + shoulderXOffset + armWristWidth * 0.5, armBottomY); ctx.closePath(); ctx.fill();
      }

      ctx.fillStyle = enemySkinColor; // Head
      ctx.beginPath(); ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2); ctx.fill();
      const beardWidth = headRadius * 1.6, beardHeight = headRadius * 1.0, beardTopY = headCenterY + headRadius * 0.2;
      ctx.fillStyle = enemyCapColor; // Beard
      ctx.fillRect(x - beardWidth / 2, beardTopY, beardWidth, beardHeight);

      ctx.strokeStyle = "#000000"; ctx.lineWidth = 3; ctx.beginPath(); // Eyebrows
      const giantBrowLength = headRadius * 0.7, giantBrowY = headCenterY - headRadius * 0.4, giantBrowXOffset = headRadius * 0.4;
      ctx.moveTo(x - giantBrowXOffset - giantBrowLength/2, giantBrowY + giantBrowLength/4); ctx.lineTo(x - giantBrowXOffset + giantBrowLength/2, giantBrowY - giantBrowLength/4);
      ctx.moveTo(x + giantBrowXOffset - giantBrowLength/2, giantBrowY - giantBrowLength/4); ctx.lineTo(x + giantBrowXOffset + giantBrowLength/2, giantBrowY + giantBrowLength/4);
      ctx.stroke();
    } else { // Standard Enemy (Chaser or Shooter)
      const headRadius = currentH * 0.16;
      const coatShoulderWidth = currentW * 1.1, coatHemWidth = currentW * 0.9;
      const torsoShoulderWidth = currentW * 0.9, torsoHemWidth = currentW * 0.7;
      const coatTopY = y - currentH * 0.35 + bobOffset, coatBottomY = y + currentH * 0.25 + bobOffset;
      const coatHeight = coatBottomY - coatTopY;
      const headCenterY = coatTopY - headRadius * 0.6;
      const armWidth = currentW * 0.2, armHeight = currentH * 0.45, armOffsetY = coatTopY + coatHeight * 0.1;
      const trouserHeight = currentH * 0.2, trouserWidth = currentW * 0.25, trouserTopY = coatBottomY;
      const legSpacing = currentW * 0.15;
      const bootHeight = currentH * 0.12, bootWidth = currentW * 0.3, bootTopY = trouserTopY + trouserHeight;
      const hatBrimWidth = headRadius * 3.5, hatBrimHeight = headRadius * 0.6;
      const hatCrownRadiusH = headRadius * 1.5, hatCrownRadiusV = headRadius * 1.1;
      const hatCenterY = headCenterY - headRadius * 1.0;
      const stepCycle = 400, stepPhase = Math.floor(t / stepCycle) % 2;

      ctx.fillStyle = enemyBootColor; // Trousers (use boot color for simplicity)
      const leftLegX = x - legSpacing; ctx.fillRect(leftLegX - trouserWidth / 2, trouserTopY, trouserWidth, trouserHeight);
      const rightLegX = x + legSpacing; ctx.fillRect(rightLegX - trouserWidth / 2, trouserTopY, trouserWidth, trouserHeight);
      ctx.fillStyle = enemyBootColor; // Boots
      if (stepPhase === 0) {
          ctx.fillRect(leftLegX - bootWidth / 2, bootTopY - 2, bootWidth, bootHeight);
          ctx.fillRect(rightLegX - bootWidth / 2, bootTopY, bootWidth, bootHeight);
      } else {
          ctx.fillRect(leftLegX - bootWidth / 2, bootTopY, bootWidth, bootHeight);
          ctx.fillRect(rightLegX - bootWidth / 2, bootTopY - 2, bootWidth, bootHeight);
      }

      ctx.fillStyle = enemyCoatColor; // Coat
      ctx.beginPath(); ctx.moveTo(x - coatShoulderWidth / 2, coatTopY); ctx.lineTo(x + coatShoulderWidth / 2, coatTopY); ctx.lineTo(x + coatHemWidth / 2, coatBottomY); ctx.lineTo(x - coatHemWidth / 2, coatBottomY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = enemyCoatColor; // Arms
      ctx.fillRect(x - coatShoulderWidth*0.45 - armWidth/2, armOffsetY, armWidth, armHeight);
      ctx.fillRect(x + coatShoulderWidth*0.45 - armWidth/2, armOffsetY, armWidth, armHeight);
      ctx.fillStyle = enemyUniformBlue; // Torso/Uniform
      ctx.beginPath(); ctx.moveTo(x - torsoShoulderWidth / 2, coatTopY); ctx.lineTo(x + torsoShoulderWidth / 2, coatTopY); ctx.lineTo(x + torsoHemWidth / 2, coatBottomY); ctx.lineTo(x - torsoHemWidth / 2, coatBottomY); ctx.closePath(); ctx.fill();

      ctx.fillStyle = enemySkinColor; // Head
      ctx.beginPath(); ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#000000"; ctx.lineWidth = 2; ctx.beginPath(); // Eyebrows
      const browLength = headRadius * 0.5, browY = headCenterY - headRadius * 0.3, browXOffset = headRadius * 0.3;
      ctx.moveTo(x - browXOffset - browLength/2, browY - browLength/3); ctx.lineTo(x - browXOffset + browLength/2, browY + browLength/3);
      ctx.moveTo(x + browXOffset - browLength/2, browY + browLength/3); ctx.lineTo(x + browXOffset + browLength/2, browY - browLength/3);
      ctx.stroke();

      ctx.fillStyle = enemyCapColor; // Hat
      ctx.beginPath(); ctx.ellipse(x, hatCenterY + hatCrownRadiusV * 0.7, hatBrimWidth / 2, hatBrimHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, hatCenterY, hatCrownRadiusH / 2, hatCrownRadiusV, 0, 0, Math.PI * 2); ctx.fill();

      if (type === "shooter") { // Shooter Gun
          const gunBarrelLength = w * 1.2, gunBarrelThickness = 3;
          const gunStockLength = w * 0.5, gunStockThickness = 5;
          const gunColorBarrel = "#555555", gunColorStock = "#7a4a2a";
          ctx.save();
          const gunAngle = Math.PI / 10; // Simple fixed angle for now
          const gunCenterY = y + bobOffset, gunCenterX = x;
          ctx.translate(gunCenterX, gunCenterY); ctx.rotate(gunAngle);
          ctx.fillStyle = gunColorStock; ctx.fillRect(-gunStockLength*0.8, -gunStockThickness/2, gunStockLength, gunStockThickness);
          ctx.fillStyle = gunColorBarrel; ctx.fillRect(-gunStockLength*0.2, -gunBarrelThickness/2, gunBarrelLength, gunBarrelThickness);
          ctx.restore();
      }
    }

    if (showBloodSparks) { // Blood Sparks
        ctx.save();
        const numSparks = 2 + Math.floor(Math.random() * 5);
        const sparkColors = ["rgba(180,0,0,0.8)", "rgba(220,20,20,0.7)", "rgba(150,0,0,0.6)"];
        const sparkCenterY = y + ((type !== 'giant') ? bobOffset : 0);
        for (let i = 0; i < numSparks; i++) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkRadius = Math.random() * currentW * 0.3;
            const sparkX = x + Math.cos(sparkAngle) * sparkRadius;
            const sparkY = sparkCenterY + Math.sin(sparkAngle) * sparkRadius * 0.5 - currentH * 0.1;
            const sparkSize = 2 + Math.random() * 3;
            ctx.fillStyle = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            ctx.beginPath(); ctx.arc(sparkX, sparkY, sparkSize / 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
  }

  function drawPlayerCharacter(ctx, x, y, w, h, isSelf, playerState, aimDx, aimDy, pushbackAnimState) {
    const t = performance.now();
    const isIdle = (playerState?.input_vector?.dx ?? 0) === 0 && (playerState?.input_vector?.dy ?? 0) === 0;
    const bobOffset = isIdle ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;

    // Dimensions
    const headHeight = h * 0.28, headWidth = w * 0.9;
    const neckHeight = h * 0.05;
    const torsoHeight = h * 0.35, torsoUpperWidth = w * 0.95, torsoLowerWidth = w * 0.8;
    const beltHeight = h * 0.06;
    const legHeight = h * 0.32, legUpperWidth = w * 0.4, legLowerWidth = w * 0.3;
    const bootShaftHeight = h * 0.1, bootSoleHeight = h * 0.04, bootWidth = w * 0.35;
    const armWidth = w * 0.22, armLength = h * 0.42;
    const shoulderPadRadius = w * 0.3;

    // Y Positions
    const headTopY = y - h * 0.5 + bobOffset;
    const headBottomY = headTopY + headHeight;
    const torsoTopY = headBottomY + neckHeight; // Neck is between head and torso
    const torsoBottomY = torsoTopY + torsoHeight;
    const beltTopY = torsoBottomY - beltHeight * 0.3; // Belt overlaps torso slightly
    const legTopY = beltTopY + beltHeight * 0.8; // Legs start under belt overlap
    const legBottomY = legTopY + legHeight;
    const bootTopY = legBottomY; // Boots start where legs end
    const bootShaftBottomY = bootTopY + bootShaftHeight;
    const bootSoleTopY = bootShaftBottomY;
    const bootBottomY = bootSoleTopY + bootSoleHeight;

    const shoulderCenterY = torsoTopY + torsoHeight * 0.15;
    const shoulderOffsetX = torsoUpperWidth * 0.5;
    const armTopY = shoulderCenterY + shoulderPadRadius * 0.3;

    const playerBodyColor = isSelf ? dustyPlayerSelfColor : dustyPlayerOtherColor;
    const bootSoleColor = "#1a1a1a";

    ctx.save();
    // Shadow
    ctx.beginPath(); ctx.ellipse(x, bootBottomY + 2, w * 0.5, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = backgroundShadowColor; ctx.fill();

    const drawBoot = (bootX, currentBootTopY) => {
        const shaftTopY = currentBootTopY;
        const shaftBottomY = shaftTopY + bootShaftHeight;
        const soleTopY = shaftBottomY;
        ctx.fillStyle = bootColor;
        ctx.fillRect(bootX - bootWidth / 2, shaftTopY, bootWidth, bootShaftHeight);
        ctx.fillStyle = bootSoleColor;
        const soleWidth = bootWidth * 1.05;
        ctx.fillRect(bootX - soleWidth / 2, soleTopY, soleWidth, bootSoleHeight);
        const heelWidth = bootWidth * 0.6, heelHeight = bootSoleHeight * 0.8;
        ctx.fillRect(bootX - heelWidth * 0.1, soleTopY + bootSoleHeight - heelHeight, heelWidth, heelHeight);
    };

    const isPushbackAnimating = pushbackAnimState?.active && t < pushbackAnimState?.endTime;
    ctx.fillStyle = playerBodyColor;

    if (isPushbackAnimating) {
        const kickAngle = -Math.PI / 4.5;
        const supportLegX = x + w * 0.15;
        const kickLegX = x - w * 0.15;
        const kickLegVisualLength = legHeight * 1.05; // Make kicking leg appear longer
        // Support Leg
        ctx.beginPath(); ctx.moveTo(supportLegX - legUpperWidth/2, legTopY); ctx.lineTo(supportLegX + legUpperWidth/2, legTopY); ctx.lineTo(supportLegX + legLowerWidth/2, legBottomY); ctx.lineTo(supportLegX - legLowerWidth/2, legBottomY); ctx.closePath(); ctx.fill();
        drawBoot(supportLegX, bootTopY);
        // Kicking Leg (Rotated)
        ctx.save(); ctx.translate(kickLegX, legTopY + legHeight * 0.1); ctx.rotate(kickAngle);
        ctx.fillStyle = playerBodyColor;
        ctx.beginPath(); ctx.moveTo(-legUpperWidth/2, 0); ctx.lineTo(legUpperWidth/2, 0); ctx.lineTo(legLowerWidth/2, kickLegVisualLength); ctx.lineTo(-legLowerWidth/2, kickLegVisualLength); ctx.closePath(); ctx.fill();
        // Draw boot at the end of the rotated leg
        const kickBootXRelative = 0; // Boot X relative to rotated leg's end
        const kickBootYRelative = kickLegVisualLength; // Boot Y relative to rotated leg's end
        drawBoot(kickBootXRelative, kickBootYRelative - bootShaftHeight); // Adjust Y to place boot correctly
        ctx.restore();
    } else { // Normal Stance/Walking
        const leftLegX = x - w * 0.2; const rightLegX = x + w * 0.2;
        let leftBootYOffset = 0, rightBootYOffset = 0;
        if (!isIdle) { // Walking animation
            const walkCycleTime = 400; const phase = (t % walkCycleTime) / walkCycleTime;
            const liftAmount = -2; // How much boots lift
            if (phase < 0.5) leftBootYOffset = Math.sin(phase * 2 * Math.PI) * liftAmount;
            else rightBootYOffset = Math.sin((phase - 0.5) * 2 * Math.PI) * liftAmount;
        }
        ctx.beginPath(); ctx.moveTo(leftLegX - legUpperWidth/2, legTopY); ctx.lineTo(leftLegX + legUpperWidth/2, legTopY); ctx.lineTo(leftLegX + legLowerWidth/2, legBottomY); ctx.lineTo(leftLegX - legLowerWidth/2, legBottomY); ctx.closePath(); ctx.fill();
        drawBoot(leftLegX, bootTopY + leftBootYOffset);
        ctx.beginPath(); ctx.moveTo(rightLegX - legUpperWidth/2, legTopY); ctx.lineTo(rightLegX + legUpperWidth/2, legTopY); ctx.lineTo(rightLegX + legLowerWidth/2, legBottomY); ctx.lineTo(rightLegX - legLowerWidth/2, legBottomY); ctx.closePath(); ctx.fill();
        drawBoot(rightLegX, bootTopY + rightBootYOffset);
    }

    ctx.fillStyle = playerBodyColor; // Torso
    ctx.beginPath(); ctx.moveTo(x - torsoUpperWidth/2, torsoTopY); ctx.lineTo(x + torsoUpperWidth/2, torsoTopY); ctx.lineTo(x + torsoLowerWidth/2, torsoBottomY); ctx.lineTo(x - torsoLowerWidth/2, torsoBottomY); ctx.closePath(); ctx.fill();

    // Arms
    const armPitXLeft = x - torsoUpperWidth * 0.45; const armPitXRight = x + torsoUpperWidth * 0.45;
    const wristXLeft = x - (torsoUpperWidth*0.45 + armWidth*0.3); const wristXRight = x + (torsoUpperWidth*0.45 + armWidth*0.3);
    const armBottomY = armTopY + armLength;
    ctx.beginPath(); ctx.moveTo(armPitXLeft, armTopY); ctx.lineTo(armPitXLeft + armWidth, armTopY); ctx.lineTo(wristXRight - armWidth, armBottomY); ctx.lineTo(wristXLeft, armBottomY); ctx.closePath(); ctx.fill(); // Left arm (from viewer's perspective)
    ctx.beginPath(); ctx.moveTo(armPitXRight - armWidth, armTopY); ctx.lineTo(armPitXRight, armTopY); ctx.lineTo(wristXRight, armBottomY); ctx.lineTo(wristXRight - armWidth*0.7, armBottomY); ctx.closePath(); ctx.fill(); // Right arm

    ctx.fillStyle = beltColor; // Belt
    ctx.fillRect(x - torsoLowerWidth*0.55, beltTopY, torsoLowerWidth*1.1, beltHeight);
    ctx.fillStyle = "#b0a080"; // Belt Buckle
    const buckleWidth = w*0.25, buckleHeight = beltHeight*0.8;
    ctx.fillRect(x - buckleWidth/2, beltTopY + (beltHeight-buckleHeight)/2, buckleWidth, buckleHeight);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; // Buckle Highlight
    ctx.fillRect(x - buckleWidth/2 + 2, beltTopY + (beltHeight-buckleHeight)/2 + 2, buckleWidth-4, 2);

    // Chest Plate
    const plateWidth = torsoUpperWidth*0.9, plateHeight = torsoHeight*0.9;
    const plateTopY = torsoTopY + torsoHeight*0.05, plateBottomY = plateTopY + plateHeight;
    ctx.fillStyle = simpleChestPlateColor;
    ctx.beginPath(); ctx.moveTo(x-plateWidth/2, plateTopY); ctx.lineTo(x+plateWidth/2, plateTopY); ctx.lineTo(x+plateWidth*0.4, plateBottomY); ctx.lineTo(x-plateWidth*0.4, plateBottomY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = chestPlateHighlight; ctx.fillRect(x-plateWidth/2+4, plateTopY+4, plateWidth-8, 3);
    ctx.fillStyle = ironHelmetShadow; ctx.fillRect(x-plateWidth/2+5, plateTopY+7, plateWidth-10, 2); // Shadow under highlight

    // Shoulders
    ctx.fillStyle = simpleChestPlateColor;
    ctx.beginPath(); ctx.arc(x-shoulderOffsetX, shoulderCenterY, shoulderPadRadius, Math.PI*1.1, Math.PI*1.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = chestPlateHighlight;
    ctx.beginPath(); ctx.arc(x-shoulderOffsetX, shoulderCenterY-2, shoulderPadRadius*0.8, Math.PI*1.2, Math.PI*1.8); ctx.arc(x-shoulderOffsetX, shoulderCenterY, shoulderPadRadius*0.9, Math.PI*1.8, Math.PI*1.2, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = simpleChestPlateColor;
    ctx.beginPath(); ctx.arc(x+shoulderOffsetX, shoulderCenterY, shoulderPadRadius, Math.PI*0.1, Math.PI*0.9, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = chestPlateHighlight;
    ctx.beginPath(); ctx.arc(x+shoulderOffsetX, shoulderCenterY-2, shoulderPadRadius*0.8, Math.PI*0.2, Math.PI*0.8, true); ctx.arc(x+shoulderOffsetX, shoulderCenterY, shoulderPadRadius*0.9, Math.PI*0.8, Math.PI*0.2, false); ctx.closePath(); ctx.fill();

    // Helmet
    ctx.fillStyle = ironHelmetColor;
    ctx.fillRect(x - headWidth/2, headTopY, headWidth, headHeight);
    const curveRadius = headWidth * 0.1; // For rounded top corners
    ctx.beginPath(); ctx.moveTo(x - headWidth/2, headTopY + curveRadius); ctx.lineTo(x - headWidth/2, headTopY); ctx.lineTo(x + headWidth/2, headTopY); ctx.lineTo(x + headWidth/2, headTopY + curveRadius);
    ctx.arcTo(x + headWidth/2, headTopY, x + headWidth/2 - curveRadius, headTopY, curveRadius);
    ctx.arcTo(x - headWidth/2, headTopY, x - headWidth/2, headTopY + curveRadius, curveRadius);
    ctx.fill();
    ctx.fillStyle = ironHelmetColor; // Neck guard part
    ctx.fillRect(x - headWidth*0.4, headBottomY - neckHeight*0.5, headWidth*0.8, neckHeight*1.2);
    ctx.fillStyle = ironHelmetHighlight; // Helmet Highlight
    ctx.fillRect(x - headWidth/2 + 3, headTopY + 3, headWidth - 6, 2);
    const rivetRadius = 1.5; // Rivets
    ctx.beginPath(); ctx.arc(x - headWidth*0.4, headBottomY-neckHeight*0.2, rivetRadius,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + headWidth*0.4, headBottomY-neckHeight*0.2, rivetRadius,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, headTopY + headHeight*0.85, rivetRadius,0,Math.PI*2); ctx.fill(); // Center bottom rivet
    ctx.fillStyle = slitColor; // Eye Slit
    const slitHeight = headHeight * 0.12, slitWidth = headWidth * 0.8, slitY = headTopY + headHeight * 0.45;
    ctx.fillRect(x - slitWidth/2, slitY, slitWidth, slitHeight);

    // Gun
    let shouldDrawGun = false, gunDrawAngle = 0;
    if (isPushbackAnimating) {
        shouldDrawGun = true; gunDrawAngle = -Math.PI / 2; // Pointing up during pushback
    } else if (aimDx !== 0 || aimDy !== 0) { // Only aim if there's a direction
        shouldDrawGun = true; gunDrawAngle = Math.atan2(aimDy, aimDx);
    }

    if (shouldDrawGun) {
        const gunLevel = playerState?.gun ?? 1;
        const baseBarrelLength = 18, barrelLengthIncrease = 2;
        const barrelLength = baseBarrelLength + (gunLevel - 1) * barrelLengthIncrease;
        const barrelThickness = 3 + (gunLevel - 1) * 0.2;
        const stockLength = 8 + (gunLevel - 1) * 0.5, stockThickness = 5 + (gunLevel - 1) * 0.3;
        const stockColor = "#8B4513", barrelColor = "#444444";
        const gunOriginYOffset = armTopY + armLength * 0.4;
        const gunOriginXOffset = w * 0.1; // Offset from player center

        ctx.save();
        ctx.translate(x + gunOriginXOffset, gunOriginYOffset); // Position gun relative to player body
        ctx.rotate(gunDrawAngle);
        ctx.fillStyle = stockColor;
        ctx.fillRect(-stockLength - 2, -stockThickness/2, stockLength, stockThickness); // Stock behind origin
        ctx.fillStyle = barrelColor;
        ctx.fillRect(0, -barrelThickness/2, barrelLength, barrelThickness); // Barrel in front of origin
        ctx.restore();
    }
    ctx.restore();
  }

  function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy) {
    const numPoints = 5;
    const outerRadiusBase = 9, outerRadiusVariance = 3;
    const innerRadiusBase = 4, innerRadiusVariance = 1.5;
    const glowRadius = 25, glowColor = "rgba(255, 200, 50, 0.25)";
    const flashColor = "rgba(255, 230, 100, 0.95)";
    const offsetDistance = 30; // How far from player center the flash appears
    const flashX = playerX + aimDx * offsetDistance;
    const flashY = playerY + aimDy * offsetDistance;
    const angle = Math.atan2(aimDy, aimDx); // Angle of the gun barrel

    ctx.save();
    ctx.translate(flashX, flashY);
    ctx.rotate(angle); // Rotate the flash to match gun direction

    const glowGradient = ctx.createRadialGradient(0,0,0, 0,0,glowRadius);
    glowGradient.addColorStop(0, glowColor);
    glowGradient.addColorStop(1, "rgba(255, 200, 50, 0)");
    ctx.fillStyle = glowGradient;
    ctx.beginPath(); ctx.arc(0,0,glowRadius,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = flashColor;
    ctx.beginPath();
    for (let i = 0; i < numPoints * 2; i++) {
      const radius = (i % 2 === 0) ? (outerRadiusBase + Math.random() * outerRadiusVariance) : (innerRadiusBase + Math.random() * innerRadiusVariance);
      const pointAngle = (i / (numPoints * 2)) * (Math.PI * 2) - Math.PI / 2; // Offset to make a point aim forward
      const px = Math.cos(pointAngle) * radius;
      const py = Math.sin(pointAngle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBulletCircle(ctx, bullet, trailLengthFactor = 0.8, trailBaseAlpha = 0.6) {
    const { x, y, vx = 0, vy = 0, radius: r = 4, owner_type } = bullet;
    const color = (owner_type === "player") ? bulletPlayerColor : bulletEnemyColor;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const trailLength = r * 2 * trailLengthFactor * Math.min(1, speed / 100);
    let startX = x, startY = y;
    if (speed > 1) { startX = x - (vx / speed) * trailLength; startY = y - (vy / speed) * trailLength; }

    if (trailLength > 1 && speed > 1) {
        try {
            const gradient = ctx.createLinearGradient(startX, startY, x, y);
            let trailStartColor = color;
            if (color.startsWith('#')) {
                trailStartColor = color + Math.round(trailBaseAlpha * 255).toString(16).padStart(2, '0');
            } else if (color.startsWith('rgb')) {
                trailStartColor = color.replace(/rgb/i, 'rgba').replace(')', `, ${trailBaseAlpha})`);
            }
            gradient.addColorStop(0, trailStartColor);
            gradient.addColorStop(1, color);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = r * 0.8; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke();
        } catch (e) { /* Fallback or error logging */ }
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = "butt"; // Reset lineCap
  }

  function drawShapedBullet(ctx, bullet, trailLengthFactor = 1.0, trailBaseAlpha = 0.7) {
    const { x, y, vx = 0, vy = 0, radius: r = 4, owner_type } = bullet;
    const color = (owner_type === "player") ? bulletPlayerColor : bulletEnemyColor;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const baseLength = 8, baseWidth = 4;
    const scaleFactor = r / 4; // Scale shape based on logical radius
    const shapeLength = baseLength * scaleFactor;
    const shapeWidth = baseWidth * scaleFactor;
    const trailLength = shapeLength * trailLengthFactor * Math.min(1, speed / 150);
    let startX = x, startY = y;
    if (speed > 1) { startX = x - (vx / speed) * trailLength; startY = y - (vy / speed) * trailLength; }

    if (trailLength > 1 && speed > 1) {
        try {
            const gradient = ctx.createLinearGradient(startX, startY, x, y);
            let trailStartColor = color;
             if (color.startsWith('#')) {
                trailStartColor = color + Math.round(trailBaseAlpha * 255).toString(16).padStart(2, '0');
            } else if (color.startsWith('rgb')) {
                trailStartColor = color.replace(/rgb/i, 'rgba').replace(')', `, ${trailBaseAlpha})`);
            }
            gradient.addColorStop(0, trailStartColor);
            gradient.addColorStop(1, color);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = shapeWidth * 0.6; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke();
        } catch (e) { /* Fallback or error logging */ }
    }
    const angle = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-shapeLength/2, -shapeWidth/2, shapeLength, shapeWidth); // Main body
    const noseLength = shapeLength * 0.4; // Pointed nose
    ctx.beginPath(); ctx.moveTo(shapeLength/2, 0); ctx.lineTo(shapeLength/2 - noseLength, -shapeWidth/2); ctx.lineTo(shapeLength/2 - noseLength, shapeWidth/2); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.lineCap = "butt";
  }

  function drawBullets(ctx, bullets) {
    if (!bullets) return;
    Object.values(bullets).forEach((b) => {
      if (!b) return;
      const bulletType = b.bullet_type || "standard";
      const hasVelocity = Math.abs(b.vx ?? 0) > 0.01 || Math.abs(b.vy ?? 0) > 0.01;

      if (bulletType === "ammo_heavy_slug") {
        if (hasVelocity) drawShapedBullet(ctx, b, 0.6, 0.8);
        else drawBulletCircle(ctx, b, 0.4, 0.8); // Static heavy slug
      } else if (bulletType === "ammo_shotgun") {
        drawBulletCircle(ctx, b, 0.5, 0.5); // Shotgun pellets are circles
      } else { // Standard, rapid_fire, standard_enemy
        if (hasVelocity) drawShapedBullet(ctx, b, 1.0, 0.7);
        else drawBulletCircle(ctx, b, 0, 0); // Static standard bullet
      }
    });
  }

  function drawPowerupSquare(ctx, x, y, size, type) {
    let baseColor = powerupDefaultColor, symbol = "?", symbolColor = "#FFFFFF", symbolSizeFactor = 0.7;
    if (type === "health") { symbol = "+"; baseColor = powerupHealthColor; }
    else if (type === "gun_upgrade") { symbol = "▲"; baseColor = powerupGunColor; symbolColor = "#FFFF00"; symbolSizeFactor = 0.6; }
    else if (type === "speed_boost") { symbol = "»"; baseColor = powerupSpeedColor; symbolSizeFactor = 0.8; }
    else if (type === "armor") { symbol = "■"; baseColor = powerupArmorColor; symbolColor = "#DDDDDD"; symbolSizeFactor = 0.5; }
    else if (type === "ammo_shotgun") { symbol = "::"; baseColor = powerupShotgunColor; symbolSizeFactor = 0.6; }
    else if (type === "ammo_heavy_slug") { symbol = "●"; baseColor = powerupSlugColor; symbolColor = "#FFEBCD"; symbolSizeFactor = 0.5; }
    else if (type === "ammo_rapid_fire") { symbol = ">"; baseColor = powerupRapidColor; symbolColor = "#333333"; symbolSizeFactor = 0.6; }
    else if (type === "bonus_score") { symbol = "$"; baseColor = powerupScoreColor; }

    const t = performance.now();
    const pulseFactor = Math.sin(t * 0.002);
    const currentSize = size * (1 + pulseFactor * 0.08);
    const currentAlpha = 0.85 + pulseFactor * 0.15;

    ctx.save();
    ctx.globalAlpha = currentAlpha;
    const glowRadius = currentSize * 0.7;
    const glowColor = baseColor.replace('rgb', 'rgba').replace(')', `, 0.3)`);
    try {
        const gradient = ctx.createRadialGradient(x, y, currentSize*0.3, x,y,glowRadius);
        gradient.addColorStop(0, glowColor);
        gradient.addColorStop(1, baseColor.replace('rgb','rgba').replace(')',', 0.0)'));
        ctx.fillStyle = gradient;
        ctx.fillRect(x-glowRadius, y-glowRadius, glowRadius*2, glowRadius*2);
    } catch(e) {/*ignore gradient error*/}

    ctx.fillStyle = baseColor;
    drawRoundedRect(ctx, x - currentSize/2, y - currentSize/2, currentSize, currentSize, currentSize * 0.15);
    ctx.fill();

    ctx.fillStyle = symbolColor;
    let fontSize = Math.max(8, Math.round(currentSize * symbolSizeFactor));
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 2; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
    ctx.fillText(symbol, x, y + currentSize * 0.03); // Slight Y offset for better centering
    ctx.restore();
  }

  function drawPowerups(ctx, powerups) {
    if (!powerups) return;
    Object.values(powerups).forEach((p) => {
      if (!p) return;
      drawPowerupSquare(ctx, p.x, p.y, p.size ?? 20, p.type);
    });
  }

  function triggerShake(magnitude, durationMs) {
    const now = performance.now();
    const newEndTime = now + durationMs;
    if (magnitude >= currentShakeMagnitude || newEndTime >= shakeEndTime) { // Use >= for newEndTime
      currentShakeMagnitude = Math.max(magnitude, currentShakeMagnitude); // Keep stronger or new shake
      shakeEndTime = Math.max(newEndTime, shakeEndTime); // Extend duration if new one is longer
    }
  }

  // Added drawPlayers function
  function drawPlayers(ctx, players, appState, localPlayerMuzzleFlashRef, localPlayerPushbackAnimState) {
    if (!players || !appState) return;
    Object.values(players).forEach(p => {
        if (!p) return;
        const isSelf = p.id === appState.localPlayerId;
        let xToDraw = p.x;
        let yToDraw = p.y;

        if (isSelf) { // Use renderedPlayerPos for the local player for smoothness
            xToDraw = appState.renderedPlayerPos.x;
            yToDraw = appState.renderedPlayerPos.y;
        }

        if (p.player_status === 'dead') return; // Don't draw dead players

        // Determine aimDx, aimDy
        let currentAimDx = 0;
        let currentAimDy = -1; // Default aim up
        if (isSelf && appState.localPlayerAimState) {
            currentAimDx = appState.localPlayerAimState.lastAimDx;
            currentAimDy = appState.localPlayerAimState.lastAimDy;
        } else if (!isSelf && typeof p.aim_dx === 'number' && typeof p.aim_dy === 'number') { // Server provides aim for others
            currentAimDx = p.aim_dx;
            currentAimDy = p.aim_dy;
        }


        drawPlayerCharacter(ctx, xToDraw, yToDraw, p.width, p.height, isSelf, p,
                            currentAimDx, currentAimDy,
                            isSelf ? localPlayerPushbackAnimState : null); // Only pass pushback for self

        if (p.player_status !== 'dead') {
            drawHealthBar(ctx, xToDraw, yToDraw, p.width, p.health, p.max_health);
            if (p.armor > 0) {
                drawArmorBar(ctx, xToDraw, yToDraw, p.width, p.armor);
            }
        }
    });
  }

  // Modified drawEnemies to pass down activeBloodSparkEffectsRef
  function drawEnemies(ctx, enemies, activeEnemyBubblesRef, activeBloodSparkEffectsRef) {
    if (!enemies) return;
    const nowServerTime = performance.now() / 1000; // For server-based timestamps like death_timestamp
    const clientNowTime = performance.now();      // For client-side effects timing

    const fadeDuration = 0.3; // seconds

    Object.values(enemies).forEach(e => {
        if (!e) return;
        const width = e.width ?? 20, height = e.height ?? 40, maxHealth = e.max_health ?? 50;
        let alpha = 1.0, shouldDraw = true, isDead = false;

        if (e.health <= 0 && e.death_timestamp) {
            isDead = true;
            const elapsedSinceDeath = nowServerTime - e.death_timestamp;
            if (elapsedSinceDeath < fadeDuration) {
                alpha = Math.max(0.1, 1.0 - (elapsedSinceDeath / fadeDuration) * 0.9);
            } else {
                shouldDraw = false; // Don't draw if fully faded
            }
        }

        if (shouldDraw) {
            ctx.save();
            ctx.globalAlpha = alpha;
            drawEnemyRect(ctx, e.x, e.y, width, height, e.type, e, activeBloodSparkEffectsRef, clientNowTime);
            ctx.restore();
        }

        if (!isDead && e.health > 0 && shouldDraw) { // Only draw health bar if alive and visible
            drawHealthBar(ctx, e.x, e.y, width, e.health, maxHealth);
        }
    });
  }


  // --- Main Render Function ---
  // Signature expects: ctx, appState, stateToRender, muzzleFlash, pushbackAnim, bloodSparks, playerSpeech, enemySpeech, width, height
  function drawGame(
    ctx,
    appState, // Full client app state from main.js
    stateToRender, // Interpolated state
    localPlayerMuzzleFlashState, // Specific to local player
    localPlayerPushbackAnimState, // Specific to local player
    activeBloodSparkEffects, // Map of { entityId: endTime } for sparks
    activePlayerSpeechBubbles, // Map of { playerId: {text, endTime} }
    activeEnemySpeechBubbles,  // Map of { enemyId: {text, endTime} }
    width,
    height
  ) {
    if (!mainCtx) mainCtx = ctx; // Set main context on first call
    if (!ctx || !appState || !stateToRender) {
      console.error("drawGame missing critical parameters!");
      return;
    }

    const now = performance.now();
    canvasWidth = (typeof width === "number" && isFinite(width)) ? width : 1600;
    canvasHeight = (typeof height === "number" && isFinite(height)) ? height : 900;

    let shakeApplied = false, shakeOffsetX = 0, shakeOffsetY = 0;
    if (currentShakeMagnitude > 0 && now < shakeEndTime) {
      shakeApplied = true;
      const timeRemaining = shakeEndTime - now;
      const initialDuration = Math.max(1, shakeEndTime - (now - timeRemaining)); // Avoid division by zero
      let currentMag = currentShakeMagnitude * (timeRemaining / initialDuration);
      currentMag = Math.max(0, currentMag);
      if (currentMag > 0.5) {
        shakeOffsetX = (Math.random() - 0.5) * 2 * currentMag;
        shakeOffsetY = (Math.random() - 0.5) * 2 * currentMag;
      } else { currentShakeMagnitude = 0; shakeEndTime = 0; shakeApplied = false;}
    } else if (currentShakeMagnitude > 0) { currentShakeMagnitude = 0; shakeEndTime = 0; }


    ctx.globalAlpha = 1.0;
    if (!isBackgroundReady) {
      ctx.fillStyle = dayBaseColor; // Simple fallback
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      if (appState?.serverState && currentBackgroundIsNight === null) { // Initial background gen
        updateGeneratedBackground(appState.serverState.is_night, canvasWidth, canvasHeight);
      }
    } else if (isTransitioningBackground) {
      const elapsed = now - transitionStartTime;
      const progress = Math.min(1.0, elapsed / BACKGROUND_FADE_DURATION_MS);
      ctx.globalAlpha = 1.0; ctx.drawImage(oldOffscreenCanvas, 0, 0);
      ctx.globalAlpha = progress; ctx.drawImage(offscreenCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
      if (progress >= 1.0) isTransitioningBackground = false;
    } else {
      ctx.drawImage(offscreenCanvas, 0, 0);
    }

    // Heat Haze
    const currentTemp = appState?.currentTemp;
    if (currentTemp !== null && typeof currentTemp !== "undefined" && currentTemp >= HEAT_HAZE_START_TEMP_RENDERER) {
        const hazeIntensity = Math.max(0, Math.min(1, (currentTemp - HEAT_HAZE_START_TEMP_RENDERER) / (HEAT_HAZE_MAX_TEMP_RENDERER - HEAT_HAZE_START_TEMP_RENDERER)));
        if (hazeIntensity > 0.01) {
            if (hazeCanvas.width !== canvasWidth || hazeCanvas.height !== canvasHeight) {
                hazeCanvas.width = canvasWidth; hazeCanvas.height = canvasHeight;
            }
            if (ctx.canvas) { // Ensure main canvas is available
                hazeCtx.clearRect(0, 0, canvasWidth, canvasHeight);
                hazeCtx.drawImage(ctx.canvas, 0, 0); // Copy current frame to haze canvas

                const numLayers = 1 + Math.floor(hazeIntensity * (HEAT_HAZE_LAYERS_MAX - 1));
                const baseAlpha = HEAT_HAZE_BASE_ALPHA * hazeIntensity;

                for (let i = 0; i < numLayers; i++) {
                    const timeFactor = now * HEAT_HAZE_SPEED;
                    const layerOffsetFactor = i * 0.8;
                    const verticalOffset = Math.sin(timeFactor + layerOffsetFactor) * HEAT_HAZE_MAX_OFFSET * hazeIntensity - i * 0.3 * hazeIntensity;
                    const layerAlpha = baseAlpha * (1 - i / (numLayers * 1.5));
                    ctx.globalAlpha = Math.max(0, Math.min(1, layerAlpha));
                    ctx.drawImage(hazeCanvas, 0, 0, canvasWidth, canvasHeight, 0, verticalOffset, canvasWidth, canvasHeight);
                }
                ctx.globalAlpha = 1.0;
            }
        }
    }

    if (shakeApplied) { ctx.save(); ctx.translate(shakeOffsetX, shakeOffsetY); }

    // Draw Game World Elements
    drawCampfire(ctx, stateToRender.campfire, canvasWidth, canvasHeight);
    drawPowerups(ctx, stateToRender.powerups);
    drawBullets(ctx, stateToRender.bullets);
    drawEnemies(ctx, stateToRender.enemies, activeEnemySpeechBubbles, activeBloodSparkEffects);
    drawPlayers(ctx, stateToRender.players, appState, localPlayerMuzzleFlashState, localPlayerPushbackAnimState);
    drawSpeechBubbles(ctx, stateToRender.players, 'player', activePlayerSpeechBubbles, appState);
    drawSpeechBubbles(ctx, stateToRender.enemies, 'enemy', activeEnemySpeechBubbles, appState);
    drawDamageTexts(ctx, stateToRender.damage_texts);

    let shouldDrawMuzzleFlash = localPlayerMuzzleFlashState?.active && now < localPlayerMuzzleFlashState?.endTime;
    if (shouldDrawMuzzleFlash) {
      drawMuzzleFlash(ctx, appState.renderedPlayerPos.x, appState.renderedPlayerPos.y, localPlayerMuzzleFlashState.aimDx, localPlayerMuzzleFlashState.aimDy);
    } else if (localPlayerMuzzleFlashState?.active) {
      localPlayerMuzzleFlashState.active = false; // Reset flag if time expired
    }

    if (shakeApplied) { ctx.restore(); }

    // Overlays
    ctx.globalAlpha = 1.0;
    if (appState?.isRaining) {
      const rainSpeedY = 12, rainSpeedX = 1;
      ctx.strokeStyle = RAIN_COLOR; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < RAIN_DROPS; i++) {
        const rainX = ((i * 137 + now * 0.05) % (canvasWidth + 100)) - 50;
        const rainY = ((i * 271 + now * 0.3) % canvasHeight);
        ctx.moveTo(rainX, rainY); ctx.lineTo(rainX + rainSpeedX, rainY + rainSpeedY);
      }
      ctx.stroke();
    } else if (appState?.isDustStorm) {
      ctx.fillStyle = "rgba(229, 169, 96, 0.2)";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    if (appState) drawTemperatureTint(ctx, appState.currentTemp, canvasWidth, canvasHeight);
    const localPState = stateToRender.players?.[appState?.localPlayerId];
    if (localPState && localPState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD) {
      const vignetteIntensity = 1.0 - (localPState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD);
      drawDamageVignette(ctx, vignetteIntensity, canvasWidth, canvasHeight);
    }
    ctx.globalAlpha = 1.0; // Final alpha reset
  }

  return {
    drawGame,
    triggerShake,
    updateGeneratedBackground
    // Expose other necessary functions if main.js needs them directly.
  };
})();
