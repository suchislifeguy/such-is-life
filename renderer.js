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
  const ironHelmetHighlight = "#666666";``
  const ironHelmetShadow = "#1a1a1a";
  const beltColor = "#412a19";
  const bootColor = "#241c1c";
  const backgroundShadowColor = "rgba(0,0,0,0.3)";
  const simpleChestPlateColor = "#777777";
  const chestPlateHighlight = "#999999";
  const slitColor = "#000000";
  const ironArmorColor = "#4a4a4a"; 
  const ironArmorHighlight = "#777777";
  const ironArmorShadow = "#2a2a2a";
  const darkClothingColor = "#3a2d27"; 


  const IDLE_BOB_SPEED_DIVISOR = 600;
  const IDLE_BOB_AMPLITUDE = 3;
  const DAMAGE_VIGNETTE_HEALTH_THRESHOLD = 30;
  const TEMP_FREEZING_CLIENT = 0.0;
  const TEMP_COLD_CLIENT = 10.0;
  const TEMP_HOT_CLIENT = 33.0;
  const TEMP_SCORCHING_CLIENT = 36.0;
  const MAX_TINT_ALPHA = 0.25;
  const RAIN_COLOR = "rgba(170, 190, 230, 0.6)";
  const RAIN_DROPS = 150;

  // --- Heat Haze Constants (EXTREME TEST VALUES) ---
  const HEAT_HAZE_START_TEMP = 25.0;      // Haze starts almost immediately
  const HEAT_HAZE_MAX_TEMP = 31.0;        // Haze reaches max intensity very quickly
  const HEAT_HAZE_MAX_INTENSITY = 1.0;    // Keep max intensity at 1
  const HEAT_HAZE_VERTICAL_EXTENT = .6;  // Affect almost the entire screen height
  const HEAT_HAZE_NUM_STRIPS = 10;        // FEWER strips (potentially less lag, chunkier effect)
  const HEAT_HAZE_WAVE_SPEED_X = 0.002;  // Faster horizontal movement
  const HEAT_HAZE_WAVE_FREQ_X1 = 0.01;    // LOWER frequency = LARGER waves horizontally
  const HEAT_HAZE_WAVE_FREQ_X2 = 0.03;    // LOWER frequency = LARGER waves horizontally
  const HEAT_HAZE_WAVE_AMP_X = 50.0;      // *** EXTREME horizontal offset ***
  const HEAT_HAZE_WAVE_SPEED_Y = 0.0015;  // Faster vertical movement
  const HEAT_HAZE_WAVE_FREQ_Y1 = 0.01;    // LOWER frequency = LARGER waves vertically
  const HEAT_HAZE_WAVE_FREQ_Y2 = 0.025;   // LOWER frequency = LARGER waves vertically
  const HEAT_HAZE_WAVE_AMP_Y = 50.0;      // *** EXTREME vertical offset ***
  const HEAT_HAZE_STRIP_ALPHA = 0.75;     // *** MUCH higher alpha (will look bad, but visible) ***
  // --- End Heat Haze Constants ---

  let currentShakeMagnitude = 0;
  let shakeEndTime = 0;
  let shakeApplied = false,
    shakeOffsetX = 0,
    shakeOffsetY = 0;


  /**
   * Draws a heat haze distortion effect over the lower part of the canvas.
   * Assumes the background/scene has already been drawn to the context.
   * @param {CanvasRenderingContext2D} ctx - The rendering context.
   * @param {number} temperature - Current game temperature in Celsius.
   * @param {number} width - Canvas width.
   * @param {number} height - Canvas height.
   * @param {number} time - Current time (e.g., performance.now()) for animation.
   */


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
    if (!appState) return; // Guard against missing appState
    // Check if canvas dimensions have changed or don't match appState
    if (
      offscreenCanvas.width !== appState.canvasWidth ||
      offscreenCanvas.height !== appState.canvasHeight
    ) {
      offscreenCanvas.width = appState.canvasWidth;
      offscreenCanvas.height = appState.canvasHeight;
      oldOffscreenCanvas.width = appState.canvasWidth;
      oldOffscreenCanvas.height = appState.canvasHeight;
      // Ensure hazeCanvas lines are GONE from here

      isBackgroundReady = false;
      currentBackgroundIsNight = null;
      isTransitioningBackground = false;
    }
    // ... (rest of the transition logic remains the same) ...
    if (targetIsNight === currentBackgroundIsNight && isBackgroundReady) return;
    if (isTransitioningBackground && targetIsNight === (offscreenCanvas.dataset.isNight === "true")) return;

    if (isBackgroundReady) {
      oldOffscreenCtx.clearRect(0, 0, appState.canvasWidth, appState.canvasHeight);
      oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0);
      isTransitioningBackground = true;
      transitionStartTime = performance.now();
      generateBackground(offscreenCtx, targetIsNight, appState.canvasWidth, appState.canvasHeight);
      currentBackgroundIsNight = targetIsNight;
    } else {
      generateBackground(offscreenCtx, targetIsNight, appState.canvasWidth, appState.canvasHeight);
      currentBackgroundIsNight = targetIsNight;
      isBackgroundReady = true;
      isTransitioningBackground = false;
    }
  }

  function drawHeatHaze(ctx, temperature, width, height, time) {
    let intensity = 0.0;
    if (temperature >= HEAT_HAZE_START_TEMP) {
      intensity = (temperature - HEAT_HAZE_START_TEMP) / (HEAT_HAZE_MAX_TEMP - HEAT_HAZE_START_TEMP);
      intensity = Math.max(0.0, Math.min(HEAT_HAZE_MAX_INTENSITY, intensity));
    }
    if (intensity <= 0.01 || width <= 0 || height <= 0) return;
    const stripHeight = Math.ceil(height * HEAT_HAZE_VERTICAL_EXTENT / HEAT_HAZE_NUM_STRIPS);
    const startY = height * (1.0 - HEAT_HAZE_VERTICAL_EXTENT);
    if (stripHeight <= 0) return;
    const originalAlpha = ctx.globalAlpha;
    for (let i = 0; i < HEAT_HAZE_NUM_STRIPS; i++) {
      const currentStripY = startY + i * stripHeight;
      const stripTopY = Math.max(0, currentStripY);
      const actualStripHeight = Math.min(stripHeight, height - stripTopY);
      if (actualStripHeight <= 0) continue;
      const verticalProgress = (currentStripY - startY) / (height * HEAT_HAZE_VERTICAL_EXTENT);
      const falloffFactor = Math.max(0, Math.min(1.0, 1.0 - verticalProgress));
      const timeOffsetX = time * HEAT_HAZE_WAVE_SPEED_X;
      const offsetX1 = Math.sin(stripTopY * HEAT_HAZE_WAVE_FREQ_X1 + timeOffsetX);
      const offsetX2 = Math.sin(stripTopY * HEAT_HAZE_WAVE_FREQ_X2 - timeOffsetX * 0.7);
      const totalOffsetX = (offsetX1 + offsetX2) * 0.5 * HEAT_HAZE_WAVE_AMP_X * intensity * falloffFactor;
      const timeOffsetY = time * HEAT_HAZE_WAVE_SPEED_Y;
      const offsetY1 = Math.sin(stripTopY * HEAT_HAZE_WAVE_FREQ_Y1 + timeOffsetY);
      const offsetY2 = Math.sin(stripTopY * HEAT_HAZE_WAVE_FREQ_Y2 - timeOffsetY * 1.3);
      const totalOffsetY = (offsetY1 + offsetY2) * 0.5 * HEAT_HAZE_WAVE_AMP_Y * intensity * falloffFactor;
      ctx.globalAlpha = HEAT_HAZE_STRIP_ALPHA * intensity * falloffFactor;
      try {
        ctx.drawImage(ctx.canvas, 0, stripTopY, width, actualStripHeight, totalOffsetX, stripTopY + totalOffsetY, width, actualStripHeight);
      } catch (e) {
        console.error("Error drawing heat haze strip:", e);
        ctx.globalAlpha = originalAlpha;
        return;
      }
    }
    ctx.globalAlpha = originalAlpha;
  }

  // Draws floating damage numbers, handling crits and pulsing
  function drawDamageTexts(ctx, damageTexts) {
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
        color: `rgba(255, 165, 0, ${0.6 + Math.sin(timeSlow * 0.9 + 2) * 0.15
          })`,
        baseHeight: 35,
        widthFactor: 0.7,
      },
      {
        color: `rgba(255, 255, 180, ${0.7 + Math.sin(timeSlow * 1.3 + 3) * 0.2
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

  function drawEnemySpeechBubbles(ctx, enemiesToRender, activeEnemyBubbles) { // <-- Parameter name is now `activeEnemyBubbles`
    if (!activeEnemyBubbles) return; // <-- Use `activeEnemyBubbles` here as well
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
    for (const enemyId in activeEnemyBubbles) { // <-- Use `activeEnemyBubbles` here
      const bubbleData = activeEnemyBubbles[enemyId]; // <-- Use `activeEnemyBubbles` here
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
      if (activeEnemyBubbles) delete activeEnemyBubbles[id]; // <-- Use `activeEnemyBubbles` here
    });
  }
  // --- Add drawSpeechBubbles function with offset parameters (Optional) ---
  function drawSpeechBubbles(ctx, playersToRender, activeSpeechBubbles, appState,
    offsetX = 0, offsetY = 0) { // Add offsets
    if (!activeSpeechBubbles || !appState) return;
    const now = performance.now();
    const bubbleFont = "bold 14px " + fontFamily;
    // ... (rest of bubble constants/setup) ...
    const textPadding = 6; const cornerRadius = 6; const bubbleOffsetY = 35;
    const bubbleBg = playerSpeechBubbleBg; const bubbleColor = playerSpeechBubbleColor;
    const shadowColor = "rgba(0, 0, 0, 0.6)"; const shadowOffsetX = 2;
    const shadowOffsetY = 2; const shadowBlur = 5;
    ctx.font = bubbleFont; ctx.textAlign = "center"; ctx.textBaseline = "bottom";

    const expiredBubbleIds = [];
    for (const playerId in activeSpeechBubbles) {
      const bubbleData = activeSpeechBubbles[playerId];
      if (now >= bubbleData.endTime) { expiredBubbleIds.push(playerId); continue; }

      const player = playersToRender?.[playerId];
      if (player && player.player_status !== "dead" && player.health > 0) {
        const isSelf = playerId === appState.localPlayerId;
        let playerX = isSelf ? appState.renderedPlayerPos.x : player.x;
        let playerY = isSelf ? appState.renderedPlayerPos.y : player.y;

        // --- Apply Offset ONLY to Self ---
        if (isSelf) {
          playerX += offsetX;
          playerY += offsetY;
        }

        const playerHeight = player.height ?? PLAYER_DEFAULTS.height;
        const bubbleTargetY = playerY - playerHeight / 2 - bubbleOffsetY;
        const textMetrics = ctx.measureText(bubbleData.text);
        const textWidth = textMetrics.width;
        const bubbleHeight = 14 + textPadding * 2;
        const bubbleWidth = textWidth + textPadding * 2;
        const bubbleX = playerX - bubbleWidth / 2;
        const bubbleDrawY = bubbleTargetY - bubbleHeight;

        ctx.save();
        ctx.shadowColor = shadowColor; ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX; ctx.shadowOffsetY = shadowOffsetY;
        ctx.fillStyle = bubbleBg;
        if (typeof drawRoundedRect === "function") {
          drawRoundedRect(ctx, bubbleX, bubbleDrawY, bubbleWidth, bubbleHeight, cornerRadius);
          ctx.fill();
        } else { ctx.fillRect(bubbleX, bubbleDrawY, bubbleWidth, bubbleHeight); }
        ctx.restore();

        ctx.fillStyle = bubbleColor;
        ctx.fillText(bubbleData.text, playerX, bubbleTargetY - textPadding);

      } else { expiredBubbleIds.push(playerId); }
    }
    expiredBubbleIds.forEach((id) => { if (activeSpeechBubbles) delete activeSpeechBubbles[id]; });
  }

  function drawSnake(ctx, snake) {
    if (
      !snake ||
      !snake.isActiveFromServer ||
      !snake.segments ||
      snake.segments.length < 2
    )
      return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = snakeLineColor;
    ctx.lineWidth = snake.lineWidth ?? 3; // Add default width
    ctx.beginPath();
    ctx.moveTo(
      snake.segments[snake.segments.length - 1].x,
      snake.segments[snake.segments.length - 1].y
    );
    for (let i = snake.segments.length - 2; i >= 1; i--) {
      const s = snake.segments[i],
        ns = snake.segments[i - 1];
      if (!s || !ns) continue;
      const xc = (s.x + ns.x) / 2,
        yc = (s.y + ns.y) / 2;
      ctx.quadraticCurveTo(s.x, s.y, xc, yc);
    }
    if (snake.segments.length > 0) {
      const h = snake.segments[0];
      if (snake.segments.length > 1) {
        const n = snake.segments[1],
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
    activeBloodSparkEffects,
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
      activeBloodSparkEffects?.[enemyId] &&
      t < activeBloodSparkEffects[enemyId];

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
        const sparkRadius = Math.random() * currentW * 2;
        const sparkX = x + Math.cos(sparkAngle) * sparkRadius;
        const sparkY =
          sparkCenterY +
          Math.sin(sparkAngle) * sparkRadius * 0.9 -
          currentH * 0.2;
        const sparkSize = 3 + Math.random() * 4;
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
    x, y, // Final draw position
    w, h, isSelf, playerState,
    aimDx, aimDy, // Received aim vector
    pushbackAnimState
) {
    const t = performance.now();
    const now = t;
    const ii = (playerState?.input_vector?.dx ?? 0) === 0 && (playerState?.input_vector?.dy ?? 0) === 0;
    const bo = ii ? Math.sin(t / IDLE_BOB_SPEED_DIVISOR) * IDLE_BOB_AMPLITUDE : 0;
    const isPushbackAnimating = pushbackAnimState?.active && now < pushbackAnimState?.endTime;
    const isPlayerBitten = playerState?.effects?.snake_bite_slow && now < (playerState.effects.snake_bite_slow.expires_at * 1000);

    // --- Visual Constants & Dimensions ---
    const ironArmorColor = "#4a4a4a"; const ironArmorHighlight = "#777777"; const ironArmorShadow = "#2a2a2a";
    const ironHelmetColor = "#3d3d3d"; const ironHelmetHighlight = "#666666"; const ironHelmetShadow = "#1a1a1a";
    const darkClothingColor = "#3a2d27"; const slitColor = "#000000"; const bootColor = "#241c1c";
    const helmetHeight = h * 0.26; const helmetWidth = w * 0.85; const plateTopMargin = h * 0.04;
    const torsoArmorHeight = h * 0.45; const torsoArmorWidth = w * 1.1;
    const shoulderPadHeight = h * 0.18; const shoulderPadWidth = w * 0.45;
    const legHeight = h * 0.35; const legWidth = w * 0.35;
    const bootHeight = h * 0.15; const bootWidth = w * 0.4;
    // Y Positions
    const helmetTopY = y - h * 0.5 + bo; const helmetBottomY = helmetTopY + helmetHeight;
    const plateTopY = helmetBottomY + plateTopMargin; const plateBottomY = plateTopY + torsoArmorHeight;
    const legTopY = plateBottomY - torsoArmorHeight * 0.1; const legBottomY = legTopY + legHeight;
    const bootTopY = legBottomY;
    // Shoulder/Arm
    const shoulderCenterY = plateTopY + torsoArmorHeight * 0.15; const shoulderOffsetX = torsoArmorWidth * 0.4;

    ctx.save(); // SAVE 1: Before drawing player

    // 1. Shadow
    ctx.beginPath(); ctx.ellipse(x, legBottomY + bootHeight + 2, w * 0.55, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fillStyle = backgroundShadowColor; ctx.fill();

    // 2. Legs & Boots (Added Pushback Logic Back)
    ctx.fillStyle = darkClothingColor; // Trousers color

    // --- RE-ADDED PUSHBACK LEG DRAWING ---
    if (isPushbackAnimating) {
        const kickAngle = Math.PI / 6; // Angle for the kicking leg
        const supportLegX = x + w * 0.15; // Supporting leg slightly offset
        const kickLegX = x - w * 0.15; // Kicking leg starts slightly offset
        const kickLegVisualLength = legHeight * 1.2; // Slightly extend kicking leg visually

        // Draw Supporting Leg (Standing firm)
        ctx.fillRect(supportLegX - legWidth / 2, legTopY, legWidth, legHeight);
        // Draw Supporting Boot
        ctx.fillStyle = bootColor;
        ctx.fillRect(supportLegX - bootWidth / 2, bootTopY, bootWidth, bootHeight);
        ctx.fillStyle = ironArmorHighlight; // Boot highlight/sole
        ctx.fillRect(supportLegX - bootWidth / 2, bootTopY + bootHeight - 4, bootWidth, 4);

        // Draw Kicking Leg (Rotated)
        ctx.save(); // Save before rotating for kicking leg
        ctx.translate(kickLegX, legTopY + legHeight * 0.1); // Pivot point for kick rotation
        ctx.rotate(kickAngle);
        // Draw the leg itself (relative to pivot)
        ctx.fillStyle = darkClothingColor;
        ctx.fillRect(-legWidth / 2, 0, legWidth, kickLegVisualLength); // Draw rotated leg
        // Draw the boot attached to the rotated leg
        ctx.fillStyle = bootColor;
        ctx.fillRect(-bootWidth / 2, kickLegVisualLength, bootWidth, bootHeight); // Boot at end of leg
        ctx.fillStyle = ironArmorHighlight; // Boot highlight/sole
        ctx.fillRect(-bootWidth / 2, kickLegVisualLength + bootHeight - 4, bootWidth, 4);
        ctx.restore(); // Restore after drawing kicking leg

    } else { // --- REGULAR WALKING / IDLE LEGS ---
        const leftLegX = x - w * 0.3;
        const rightLegX = x + w * 0.3;
        let leftYOffset = 0;
        let rightYOffset = 0;
        if (!ii) { // Simple walk bob if not idle
            const walkCycleTime = 300;
            const phase = (t % walkCycleTime) / walkCycleTime;
            const liftAmount = -3;
            leftYOffset = Math.max(0, Math.sin(phase * Math.PI * 2)) * liftAmount;
            rightYOffset = Math.max(0, Math.sin((phase + 0.5) * Math.PI * 2)) * liftAmount;
        }
        // Draw Legs
        ctx.fillStyle = darkClothingColor;
        ctx.fillRect(leftLegX - legWidth / 2, legTopY + leftYOffset, legWidth, legHeight);
        ctx.fillRect(rightLegX - legWidth / 2, legTopY + rightYOffset, legWidth, legHeight);
        // Draw Boots
        ctx.fillStyle = bootColor;
        ctx.fillRect(leftLegX - bootWidth / 2, bootTopY + leftYOffset, bootWidth, bootHeight);
        ctx.fillRect(rightLegX - bootWidth / 2, bootTopY + rightYOffset, bootWidth, bootHeight);
        // Boot highlight/sole line
        ctx.fillStyle = ironArmorHighlight;
        ctx.fillRect(leftLegX - bootWidth / 2, bootTopY + bootHeight - 4 + leftYOffset, bootWidth, 4);
        ctx.fillRect(rightLegX - bootWidth / 2, bootTopY + bootHeight - 4 + rightYOffset, bootWidth, 4);
    }
    // --- END Legs & Boots section ---

    // 3. Torso Armor (Chest Plate) - Draw AFTER legs
    // ... (Keep torso armor drawing logic) ...
    ctx.fillStyle = ironArmorColor; ctx.fillRect(x - torsoArmorWidth / 2, plateTopY, torsoArmorWidth, torsoArmorHeight);
    ctx.fillStyle = ironArmorHighlight; ctx.fillRect(x - torsoArmorWidth / 2 + 4, plateTopY + 4, torsoArmorWidth - 8, 5);
    ctx.fillStyle = ironArmorShadow; ctx.fillRect(x - torsoArmorWidth / 2 + 4, plateTopY + 9, torsoArmorWidth - 8, 4);
    // Rivets...

    // 4. Shoulder Pads - Draw OVER chest plate edges
    // ... (Keep shoulder pad drawing logic) ...
    ctx.fillStyle = ironArmorColor; ctx.beginPath(); ctx.ellipse(x - shoulderOffsetX, shoulderCenterY, shoulderPadWidth / 2, shoulderPadHeight / 2, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ironArmorHighlight; ctx.beginPath(); ctx.ellipse(x - shoulderOffsetX, shoulderCenterY - 2, shoulderPadWidth / 2 * 0.8, shoulderPadHeight / 2 * 0.7, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
    ctx.fillStyle = ironArmorColor; ctx.beginPath(); ctx.ellipse(x + shoulderOffsetX, shoulderCenterY, shoulderPadWidth / 2, shoulderPadHeight / 2, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ironArmorHighlight; ctx.beginPath(); ctx.ellipse(x + shoulderOffsetX, shoulderCenterY - 2, shoulderPadWidth / 2 * 0.8, shoulderPadHeight / 2 * 0.7, 0, Math.PI * 0.1, Math.PI * 0.9, true); ctx.fill();

    // 5. Helmet - Draw OVER shoulder pads/chest plate top
    // ... (Keep helmet drawing logic) ...
    ctx.fillStyle = ironHelmetColor; ctx.fillRect(x - helmetWidth / 2, helmetTopY, helmetWidth, helmetHeight);
    ctx.fillStyle = ironHelmetHighlight; ctx.fillRect(x - helmetWidth / 2 + 3, helmetTopY + 3, helmetWidth - 6, 3);
    ctx.fillStyle = slitColor; const slitY = helmetTopY + helmetHeight * 0.45; const slitHeight = helmetHeight * 0.1;
    ctx.fillRect(x - helmetWidth * 0.4, slitY, helmetWidth * 0.8, slitHeight);


    // 6. Gun Logic & Drawing (Using Stored Aim)
    let shouldDrawGun = false;
    let gunDrawAngle = -Math.PI / 2; // Default idle aim (up)
    let gunDrawMode = "idle";

    if (isPushbackAnimating) {
        shouldDrawGun = true;
        gunDrawMode = "pushback";
        gunDrawAngle = -Math.PI / 2; // Point gun down/forward during pushback
    } else if (isSelf && (aimDx !== 0 || aimDy !== 0)) {
        // Use the stored aim direction passed in
        shouldDrawGun = true;
        gunDrawMode = "aiming";
        gunDrawAngle = Math.atan2(aimDy, aimDx);
    } else if (isSelf) {
        // Local player, idle state (aimDx/Dy is 0)
        shouldDrawGun = true; // Draw idle gun
        gunDrawMode = "idle";
        gunDrawAngle = -Math.PI / 2; // Keep default idle aim (up)
    }

    if (shouldDrawGun) {
        // ... (Keep gun drawing logic: calculate dimensions, pivot, save, translate, rotate, fillRects, restore) ...
        const gunLevel = playerState?.gun ?? 1;
        const baseBarrelLength = 22; const barrelLengthIncrease = 2.5; const barrelLength = baseBarrelLength + (gunLevel - 1) * barrelLengthIncrease;
        const barrelThickness = 4 + (gunLevel - 1) * 0.3; const stockLength = 10 + (gunLevel - 1) * 0.6;
        const stockThickness = 6 + (gunLevel - 1) * 0.4;
        const stockColor = "#6F4E37"; const barrelColor = "#5A5A5A";
        const gunPivotX = x; const gunPivotY = plateTopY + torsoArmorHeight * 0.4 + bo;

        ctx.save(); // SAVE 2: Gun transform
        ctx.translate(gunPivotX, gunPivotY);
        ctx.rotate(gunDrawAngle);
        // Barrel
        ctx.fillStyle = barrelColor; ctx.fillRect(0, -barrelThickness / 2, barrelLength, barrelThickness);
        // Stock
        ctx.fillStyle = stockColor; ctx.fillRect(-stockLength, -stockThickness / 2, stockLength, stockThickness);
        // Sight
        ctx.fillStyle = "#333333"; ctx.fillRect(barrelLength * 0.7, -barrelThickness / 2 - 2, 4, 2);
        ctx.restore(); // RESTORE 2: Gun transform
    }

    // 7. Effects (Snake Bite - Keep as is)
    if (isPlayerBitten) {
      const footY = legBottomY + bootHeight; // Bottom of boots
      const numParticles = 8; const particleBaseSize = 4; const particleSpeedY = -60; const particleLifetimeMs = 600;
      ctx.save();
      for (let i = 0; i < numParticles; i++) {
        const effectStartTime = playerSnakeEffect.expires_at * 1000 - (typeof SNAKE_BITE_DURATION !== 'undefined' ? SNAKE_BITE_DURATION : 8.0) * 1000; // Need SNAKE_BITE_DURATION const accessible
        const timeSinceEffectStart = Math.max(0, now - effectStartTime);
        const particleSimulatedAge = (timeSinceEffectStart + (particleLifetimeMs / numParticles) * i) % particleLifetimeMs;
        const particleProgress = particleSimulatedAge / particleLifetimeMs;
        if (particleProgress < 0 || particleProgress >= 1) continue;
        const particleX = x + (Math.random() - 0.5) * w * 0.7;
        const particleY = footY + particleSpeedY * (particleSimulatedAge / 1000);
        const particleSize = particleBaseSize * (1.0 - particleProgress * 0.5) * (0.8 + Math.random() * 0.4);
        const alpha = 0.8 * (1.0 - particleProgress) * (0.7 + Math.random() * 0.3);
        const green = 180 + Math.floor(75 * particleProgress);
        const yellow = 200 * (1.0 - particleProgress);
        ctx.fillStyle = `rgba(${Math.floor(yellow)}, ${green}, 50, ${alpha.toFixed(2)})`;
        ctx.fillRect( particleX - particleSize / 2, particleY - particleSize / 2, particleSize, particleSize );
      }
      ctx.restore();
    }

    ctx.restore(); // Restore context state from the very start of the function

  }

  function drawPlayers(
    ctx, players, appState, localPlayerMuzzleFlash, localPlayerPushbackAnim,
    // --- OFFSET PARAMETERS ---
    offsetX = 0, offsetY = 0,
    // --- NEW: Local Player Aim Parameters ---
    localAimDx = 0, localAimDy = -1 // Default aim up if not provided
) {
    if (!players || !appState) return;
    // console.log(`[drawPlayers] Received localAimDx: ${localAimDx.toFixed(2)}, localAimDy: ${localAimDy.toFixed(2)}`); // Log received aim

    Object.values(players).forEach(p => {
        if (!p || p.player_status === 'dead') return;

        const isSelf = p.id === appState.localPlayerId;
        const ps = p.player_status || 'alive';
        let dx = isSelf ? appState.renderedPlayerPos.x : p.x;
        let dy = isSelf ? appState.renderedPlayerPos.y : p.y;
        const w = p.width ?? PLAYER_DEFAULTS.width; // Assume PLAYER_DEFAULTS is accessible or define it
        const h = p.height ?? PLAYER_DEFAULTS.height;
        const mh = p.max_health ?? PLAYER_DEFAULTS.max_health;
        const ca = p.armor ?? 0;
        const isDown = (ps === 'down');
        const alpha = isDown ? 0.4 : 1.0;

        let drawX = dx;
        let drawY = dy;
        if (isSelf) {
            drawX += offsetX;
            drawY += offsetY;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        const pushbackState = isSelf ? localPlayerPushbackAnim : null;

        // Determine aimDx/aimDy to pass down based on whether it's the local player
        const aimDxForDraw = isSelf ? localAimDx : 0;
        const aimDyForDraw = isSelf ? localAimDy : 0;

        // if (isSelf) { // Log only for self
        //     console.log(`  [drawPlayers -> drawPlayerCharacter] Passing aim: dx=${aimDxForDraw.toFixed(2)}, dy=${aimDyForDraw.toFixed(2)} for PID ${p.id}`);
        // }

        drawPlayerCharacter(ctx, drawX, drawY, w, h, isSelf, p, aimDxForDraw, aimDyForDraw, pushbackState);

        ctx.restore();

        if (ps === 'alive') {
            drawHealthBar(ctx, drawX, drawY, w, p.health, mh);
            if (ca > 0) drawArmorBar(ctx, drawX, drawY, w, ca);
        }
    });
}
  function drawEnemies(
    ctx,
    enemies,
    activeBloodSparkEffects
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
          activeBloodSparkEffects,
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
    } catch (e) { }
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

  /**
   * Triggers or extends a screen shake effect.
   * @param {number} magnitude - Strength of the shake.
   * @param {number} durationMs - How long the shake should last in milliseconds.
   */
  function triggerShake(magnitude, durationMs) {
    // Ensure module-level shake variables exist
    if (typeof currentShakeMagnitude === 'undefined' || typeof shakeEndTime === 'undefined') {
      console.error("triggerShake called before shake state variables are initialized.");
      return;
    }
    const now = performance.now();
    const newEndTime = now + durationMs;
    // Apply if new shake is stronger or lasts longer than current one
    if (magnitude >= currentShakeMagnitude || newEndTime >= shakeEndTime) {
      currentShakeMagnitude = Math.max(magnitude, currentShakeMagnitude); // Use the stronger magnitude
      shakeEndTime = Math.max(newEndTime, shakeEndTime); // Extend to the later end time
    }
  }
  // --- END triggerShake definition ---

  //---function drawGame ---
  function drawGame(
    ctx, appState, stateToRender,
    localPlayerMuzzleFlash, localPlayerPushbackAnim,
    activeBloodSparkEffects, activeEnemyBubbles,
    currentMousePos // Still passed in, maybe useful for UI later
) {
    // --- Initial Checks & Setup ---
    if (!ctx || !appState) {
        console.error("drawGame missing context or appState!");
        return;
    }
    const now = performance.now();
    const width = appState.canvasWidth;
    const height = appState.canvasHeight;
    if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
        console.error(`drawGame called with invalid dimensions: ${width}x${height}`);
        return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1.0;

    // --- 1. Calculate Player Shake Offset ---
    let shakeOffsetX = 0, shakeOffsetY = 0;
    if (typeof currentShakeMagnitude !== 'undefined' && typeof shakeEndTime !== 'undefined') {
        if (currentShakeMagnitude > 0 && now < shakeEndTime) {
            const timeRemaining = shakeEndTime - now;
            const initialDuration = Math.max(1, (shakeEndTime > now ? shakeEndTime - (now - timeRemaining) : 1));
            let currentMag = currentShakeMagnitude * (timeRemaining / initialDuration);
            currentMag = Math.max(0, currentMag);
            if (currentMag > 0.5) {
                const shakeAngle = Math.random() * Math.PI * 2;
                shakeOffsetX = Math.cos(shakeAngle) * currentMag;
                shakeOffsetY = Math.sin(shakeAngle) * currentMag;
            } else { currentShakeMagnitude = 0; }
        } else if (currentShakeMagnitude > 0) { currentShakeMagnitude = 0; }
    }
    // --- End Shake Calculation ---

    // --- Get Gun Aim Direction from Stored State ---
    // This direction should have been calculated relative to the player in handleShooting
    // and stored in appState.
    const storedAim = appState.localPlayerAimState || { lastAimDx: 0, lastAimDy: -1 }; // Default aim up if not set yet
    const gunAimDx = storedAim.lastAimDx;
    const gunAimDy = storedAim.lastAimDy;
    // console.log(`[drawGame] Using Stored Aim for Gun: dx=${gunAimDx.toFixed(2)}, dy=${gunAimDy.toFixed(2)}`); // Optional Debug

    // --- Draw Static Background (NO camera translation) ---
    if (typeof isBackgroundReady !== 'undefined' && isBackgroundReady) {
        if (typeof isTransitioningBackground !== 'undefined' && isTransitioningBackground) {
            const elapsed = now - (typeof transitionStartTime !== 'undefined' ? transitionStartTime : now);
            const progress = Math.min(1.0, elapsed / BACKGROUND_FADE_DURATION_MS);
            ctx.globalAlpha = 1.0;
            if (typeof oldOffscreenCanvas !== 'undefined') { try { ctx.drawImage(oldOffscreenCanvas, 0, 0, width, height); } catch(e) { console.error("BG Draw Error (Trans Old):", e); }}
            ctx.globalAlpha = progress;
            if (typeof offscreenCanvas !== 'undefined') { try { ctx.drawImage(offscreenCanvas, 0, 0, width, height); } catch(e) { console.error("BG Draw Error (Trans New):", e); }}
            ctx.globalAlpha = 1.0;
            if (progress >= 1.0) { isTransitioningBackground = false; }
        } else {
             if (typeof offscreenCanvas !== 'undefined') { try { ctx.drawImage(offscreenCanvas, 0, 0, width, height); } catch(e) { console.error("BG Draw Error (Static):", e); }}
             else { console.warn("[drawGame] Background ready but offscreenCanvas undefined."); }
        }
    } else {
        // Fallback background color
        ctx.fillStyle = typeof dayBaseColor !== 'undefined' ? dayBaseColor : "#8FBC8F";
        ctx.fillRect(0, 0, width, height);
    }
    // --- End Background Drawing ---

    // --- Draw Heat Haze ---
    if (appState && typeof appState.currentTemp === 'number') {
        // Make sure drawHeatHaze is defined and accessible
        if (typeof drawHeatHaze === 'function') {
            drawHeatHaze(ctx, appState.currentTemp, width, height, now);
        } else { console.warn("drawHeatHaze function not found."); }
    }
    // --- End Heat Haze ---

    // --- Draw Dynamic World Elements (Campfire, Snake, Powerups) ---
    // Drawn at their absolute coordinates (screen = world in this setup)
    if (stateToRender) {
        if (typeof drawCampfire === 'function') drawCampfire(ctx, stateToRender.campfire, width, height);
        // Ensure snake object and needed properties exist
        if (typeof snake !== 'undefined' && stateToRender.snake_state?.active && snake.segments && typeof drawSnake === 'function') {
            drawSnake(ctx, snake);
        }
        if (typeof drawPowerups === 'function') drawPowerups(ctx, stateToRender.powerups);
    }
    // --- End Background Elements ---

    // --- Draw Main Gameplay Elements ---
    if (stateToRender) {
        if (typeof drawBullets === 'function') drawBullets(ctx, stateToRender.bullets);
        if (typeof drawEnemies === 'function') drawEnemies(ctx, stateToRender.enemies, activeBloodSparkEffects);

        // Enemy Speech Bubbles
        const activeEnemyBubblesObj = activeEnemyBubbles || {}; // Ensure object exists
        if (stateToRender.enemies && typeof drawEnemySpeechBubbles === 'function') {
            drawEnemySpeechBubbles(ctx, stateToRender.enemies, activeEnemyBubblesObj);
        }

        // Draw Players - Pass the STORED gun aim direction
        if (appState && stateToRender.players && typeof drawPlayers === 'function') {
            drawPlayers(
                ctx, stateToRender.players, appState,
                localPlayerMuzzleFlash, localPlayerPushbackAnim,
                shakeOffsetX, shakeOffsetY,
                gunAimDx, gunAimDy // Pass the direction from appState.localPlayerAimState
            );

            // Player Speech Bubbles
            const activeSpeechBubblesObj = (typeof activeSpeechBubbles !== 'undefined') ? activeSpeechBubbles : {};
            if (typeof drawSpeechBubbles === 'function') {
                 drawSpeechBubbles(ctx, stateToRender.players, activeSpeechBubblesObj, appState, shakeOffsetX, shakeOffsetY);
            }
        } else if (!appState || !stateToRender.players) {
             console.warn("[drawGame] Skipping player draw: Missing appState or stateToRender.players");
        } else if (typeof drawPlayers !== 'function') {
             console.error("[drawGame] Skipping player draw: drawPlayers function not found!");
        }


        if (typeof drawDamageTexts === 'function') drawDamageTexts(ctx, stateToRender.damage_texts);

        // Draw Muzzle Flash - Uses its OWN stored direction (localPlayerMuzzleFlash.aimDx/Dy)
        let shouldDrawMuzzleFlash = localPlayerMuzzleFlash?.active && now < localPlayerMuzzleFlash?.endTime;
        if (shouldDrawMuzzleFlash && typeof appState.renderedPlayerPos !== 'undefined' && localPlayerMuzzleFlash.aimDx !== undefined) {
            // Ensure drawMuzzleFlash function exists
             if (typeof drawMuzzleFlash === 'function') {
                drawMuzzleFlash(
                    ctx,
                    appState.renderedPlayerPos.x + shakeOffsetX, // Position based on player render pos + shake
                    appState.renderedPlayerPos.y + shakeOffsetY,
                    localPlayerMuzzleFlash.aimDx, // Direction from the flash state itself
                    localPlayerMuzzleFlash.aimDy
                );
             } else { console.warn("drawMuzzleFlash function not found."); }
        } else if (localPlayerMuzzleFlash?.active) {
            localPlayerMuzzleFlash.active = false; // Deactivate if expired
        }
    } else {
        console.warn("drawGame called with no stateToRender, skipping entity drawing.");
    }
    // --- End Main Gameplay Elements ---

    // --- Draw Overlays (Rain, Dust, Tint, Vignette) ---
    ctx.globalAlpha = 1.0; // Ensure alpha is reset before overlays
    if (appState?.isRaining && typeof RAIN_COLOR !== 'undefined' && typeof RAIN_DROPS !== 'undefined') {
        const RAIN_SPEED_Y = 12; const RAIN_SPEED_X = 1;
        ctx.strokeStyle = RAIN_COLOR; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < RAIN_DROPS; i++) {
            const rainX = ((i * 137 + now * 0.05) % (width + 100)) - 50; // Example rain calc
            const rainY = (i * 271 + now * 0.3) % height;
            const endX = rainX + RAIN_SPEED_X; const endY = rainY + RAIN_SPEED_Y;
            ctx.moveTo(rainX, rainY); ctx.lineTo(endX, endY);
        }
        ctx.stroke();
    } else if (appState?.isDustStorm) {
        ctx.fillStyle = "rgba(229, 169, 96, 0.2)"; ctx.fillRect(0, 0, width, height);
    }

    if (appState && typeof drawTemperatureTint === 'function') drawTemperatureTint(ctx, appState.currentTemp, width, height);

    const currentPlayerState = stateToRender?.players?.[appState?.localPlayerId];
    if (currentPlayerState && typeof currentPlayerState.health === 'number' && typeof drawDamageVignette === 'function') {
         const healthThreshold = typeof DAMAGE_VIGNETTE_HEALTH_THRESHOLD !== 'undefined' ? DAMAGE_VIGNETTE_HEALTH_THRESHOLD : 30;
         if (currentPlayerState.health < healthThreshold) {
             const intensity = 1.0 - Math.max(0, currentPlayerState.health) / healthThreshold;
             drawDamageVignette(ctx, intensity, width, height);
         }
    }
    // --- End Overlays ---

    // --- Draw Particles (Ammo Casings) ---
    // Ensure activeAmmoCasings is defined (likely globally in main.js)
    if (typeof activeAmmoCasings !== 'undefined' && Array.isArray(activeAmmoCasings)) {
        // It's generally better to update physics in the main game loop, not here.
        // Filtering expired casings here is acceptable.
        activeAmmoCasings = activeAmmoCasings.filter(casing => (now - casing.spawnTime) < casing.lifetime);

        if (activeAmmoCasings.length > 0) {
            ctx.save();
            activeAmmoCasings.forEach(casing => {
                // Calculate alpha based on remaining lifetime
                const lifeLeft = casing.lifetime - (now - casing.spawnTime);
                const fadeDuration = 200;
                const alpha = (lifeLeft < fadeDuration) ? Math.max(0, lifeLeft / fadeDuration) * 0.9 : 0.9;

                let casingColor = casing.color || "rgba(218, 165, 32, 0.9)";
                // Apply calculated alpha
                if (casingColor.startsWith('rgba')) { casingColor = casingColor.replace(/[\d\.]+\)$/g, `${alpha.toFixed(2)})`); }
                 else if (casingColor.startsWith('#')) { /* Optional: convert hex to rgba */ }
                ctx.fillStyle = casingColor;

                // Draw rotated rectangle at casing's current x, y, rotation
                // Assumes x, y, rotation are updated elsewhere (e.g., main game loop)
                ctx.translate(casing.x, casing.y);
                ctx.rotate(casing.rotation);
                ctx.fillRect(-casing.width / 2, -casing.height / 2, casing.width, casing.height);
                // Undo transforms for this specific casing before drawing the next one
                ctx.rotate(-casing.rotation);
                ctx.translate(-casing.x, -casing.y);
            });
            ctx.restore(); // Restore after drawing all casings
        }
    }
    // --- End Particles ---

    ctx.globalAlpha = 1.0; // Final reset before function ends

} // --- End of function drawGame ---

  // --- Exported Renderer Module ---

  return {
    drawGame,                 // Export the main drawing function
    triggerShake,             // Export the shake function
    updateGeneratedBackground // Export the background update function
    // Add other functions you need to export here, like drawPlayers if called externally
  };

})(); // --- End of Renderer module IIFE ---

// Final log to confirm execution
console.log(
  "--- Renderer.js: Executed. Renderer object defined?",
  typeof Renderer
);
