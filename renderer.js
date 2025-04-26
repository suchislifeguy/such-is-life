// renderer.js

// Restore global access for the Renderer object as in the original structure
// by assigning the returned object to window.Renderer.
window.Renderer = (() => {
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
    const beltColor = "#412a19"; // Fixed: Added missing closing quote
    const beltBuckleColor = "#b0a080";
    const bootColor = "#241c1c";
    const bootSoleColor = "#1a1a1a";
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
    const SNAKE_BITE_DURATION = 8.0;

    // --- New Heat Haze Constants (from Phase 1) ---
    const HEAT_HAZE_WAVE_COUNT = 10;
    const HEAT_HAZE_WAVE_HEIGHT_MAX = 80;
    const HEAT_HAZE_WAVE_SPEED_BASE = 0.0005;
    const HEAT_HAZE_WAVE_OFFSET_MAX = 15;
    const HEAT_HAZE_WAVE_ALPHA_BASE = 0.02;
    const HEAT_HAZE_COLOR = "rgba(255, 180, 0, A)";
    // --- End New Heat Haze Constants ---

    // --- New Colors for Shading/Detail ---
    const playerBodyHighlight = "rgba(180, 100, 30, 0.2)";
    const playerBodyShadow = "rgba(50, 20, 5, 0.2)";
    const enemySkinHighlight = "rgba(255, 230, 200, 0.3)";
    const enemySkinShadow = "rgba(100, 80, 60, 0.3)";
    const enemyCoatHighlight = "rgba(180, 100, 30, 0.2)";
    const enemyCoatShadow = "rgba(50, 20, 5, 0.2)";
    const enemyUniformHighlight = "rgba(80, 120, 180, 0.3)";
    const enemyUniformShadow = "rgba(10, 20, 40, 0.3)";
    const bulletTrailGlow = "rgba(255, 255, 0, 0.1)";
    const muzzleFlashGlowCore = "rgba(255, 255, 200, 0.5)";
    // --- End New Colors ---


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

    function updateGeneratedBackground(
      targetIsNight,
      targetCanvasWidth,
      targetCanvasHeight
    ) {
      canvasWidth = targetCanvasWidth;
      canvasHeight = targetCanvasHeight;
      if (
        offscreenCanvas.width !== canvasWidth ||
        offscreenCanvas.height !== canvasHeight
      ) {
        offscreenCanvas.width = canvasWidth;
        offscreenCanvas.height = canvasHeight;
        oldOffscreenCanvas.width = canvasWidth;
        oldOffscreenCanvas.height = canvasHeight;
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
        oldOffscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        oldOffscreenCtx.drawImage(offscreenCanvas, 0, 0);
        isTransitioningBackground = true;
        transitionStartTime = performance.now();
        generateBackground(
          offscreenCtx,
          targetIsNight,
          canvasWidth,
          canvasHeight
        );
        currentBackgroundIsNight = targetIsNight;
      } else {
        generateBackground(
          offscreenCtx,
          targetIsNight,
          canvasWidth,
          canvasHeight
        );
        currentBackgroundIsNight = targetIsNight;
        isBackgroundReady = true;
        isTransitioningBackground = false;
      }
    }

    function drawDamageTexts(ctx, damageTexts) {
      if (!damageTexts) return;
      const now = performance.now(),
        pd = 250, // Peak duration in ms
        td = 1000; // Total duration in ms
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      Object.values(damageTexts).forEach((dt) => {
        if (!dt) return;
        const x = dt.x ?? 0,
          y = dt.y ?? 0,
          txt = dt.text ?? "?",
          ic = dt.is_crit ?? false,
          st = dt.spawn_time ? dt.spawn_time * 1000 : now,
          ts = now - st; // Time since spawn
        if (ts > td) return; // Text has expired

        let cfs = ic ? damageTextCritFontSize : damageTextFontSize,
          cfc = ic ? damageTextCritColor : damageTextColor;
        let alpha = 1.0;
        let yOffset = 0;

        // Animation: Scale up slightly then fade/move up
        if (ts < pd) {
            const progress = ts / pd;
            const scaleFactor = 1.0 + Math.sin(progress * Math.PI) * 0.5; // Ease-in/out scaling
            cfs *= scaleFactor;
        } else {
            const fadeProgress = (ts - pd) / (td - pd);
            alpha = Math.max(0, 1.0 - fadeProgress); // Fade out
            yOffset = -fadeProgress * 20; // Move up
        }

        ctx.font = `bold ${Math.round(cfs)}px ${fontFamily}`;
        ctx.fillStyle = cfc;
        ctx.globalAlpha = alpha; // Apply fading

        ctx.fillText(txt, x, y + yOffset);

        ctx.globalAlpha = 1.0; // Restore alpha
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

    function drawDamageVignette(ctx, intensity, width, height) {
      if (intensity <= 0) return;
      ctx.save();
      const or = Math.sqrt(width ** 2 + height ** 2) / 2;
      const g = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        or
      );
      const ra = Math.min(1.0, Math.max(0.0, 0.4 * intensity)); // Clamped alpha
      g.addColorStop(0, "rgba(255,0,0,0)");
      g.addColorStop(0.75, "rgba(255,0,0,0)");
      g.addColorStop(1, `rgba(255,0,0,${ra.toFixed(2)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    function drawTemperatureTint(ctx, temperature, width, height) {
      let tcs = null,
        a = 0.0;
      const tfc = TEMP_FREEZING_CLIENT,
        tcc = TEMP_COLD_CLIENT,
        thc = TEMP_HOT_CLIENT,
        tsc = TEMP_SCORCHING_CLIENT,
        mta = MAX_TINT_ALPHA;
      if (temperature === null || typeof temperature === "undefined") {
        return;
      }
      if (temperature <= tfc) {
        tcs = "rgba(100,150,255,A)";
        a = mta * Math.min(1.0, (tfc - temperature + 5) / 5.0);
      } else if (temperature <= tcc) {
        tcs = "rgba(150,180,255,A)";
        a = mta * ((tcc - temperature) / (tcc - tfc));
      } else if (temperature >= tsc) {
        tcs = "rgba(255,100,0,A)";
        a = mta * Math.min(1.0, (temperature - tsc + 5) / 5.0);
      } else if (temperature >= thc) {
        tcs = "rgba(255,150,50,A)";
        a = mta * ((temperature - thc) / (tsc - thc));
      }
      a = Math.max(0, Math.min(mta, a));
      if (tcs && a > 0.01) {
        ctx.fillStyle = tcs.replace("A", a.toFixed(2));
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

    // --- REVISED drawEnemyRect (Fixed variable definitions, Enhanced Shapes, Shading, Animations) ---
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
      const isHit = enemyState?.is_hit; // Assume is_hit flag exists

      ctx.save();

      // Apply hit flash effect
      if (isHit) {
          ctx.filter = 'brightness(1.5) saturate(1.5)'; // Simple flash effect
      }


      // --- Giant Drawing (Enhanced) ---
      if (type === "giant") {
        const giantBodyWidth = currentW * 0.85;
        const giantBodyHeight = currentH * 0.7;
        const giantBodyTopY = y - currentH * 0.4;
        const giantBodyBottomY = giantBodyTopY + giantBodyHeight;

        const giantLegHeight = currentH * 0.25;
        const giantLegWidth = currentW * 0.2;
        const giantLegSpacing = currentW * 0.2;
        const giantLegTopY = giantBodyBottomY;

        const giantBootHeight = currentH * 0.1;
        const giantBootWidth = giantLegWidth * 1.2;
        const giantBootTopY = giantLegTopY + giantLegHeight;

        const giantHeadRadius = currentW * 0.2;
        const giantHeadCenterY = giantBodyTopY - giantHeadRadius * 0.5;

        const giantShakoHeight = giantHeadRadius * 1.5;
        const giantShakoWidth = giantHeadRadius * 1.8;
        const giantShakoBaseY = giantHeadCenterY - giantHeadRadius * 0.8;
        const giantShakoPeakHeight = giantShakoHeight * 0.2;
        const giantShakoPeakWidth = giantShakoWidth * 1.1;

        const giantArmShoulderWidth = currentW * 0.18;
        const giantArmWristWidth = currentW * 0.14;
        const giantArmLength = currentH * 0.55;
        const giantShoulderY = giantBodyTopY + giantBodyHeight * 0.15;
        const giantShoulderXOffset = giantBodyWidth / 2;

        const giantBeardWidth = giantHeadRadius * 1.6;
        const giantBeardHeight = giantHeadRadius * 1.0;
        const giantBeardTopY = giantHeadCenterY + giantHeadRadius * 0.2;

        const giantBrowLength = giantHeadRadius * 0.7;
        const giantBrowY = giantHeadCenterY - giantHeadRadius * 0.4;
        const giantBrowXOffset = giantHeadRadius * 0.4;


        // Legs & Boots
        ctx.fillStyle = bootColor; // Use bootColor constant
        ctx.fillRect(x - giantLegSpacing - giantLegWidth / 2, giantLegTopY, giantLegWidth, giantLegHeight);
        ctx.fillRect(x + giantLegSpacing - giantLegWidth / 2, giantLegTopY, giantLegWidth, giantLegHeight);
        ctx.fillStyle = bootColor; // Use bootColor constant
        ctx.fillRect(
          x - giantLegSpacing - giantBootWidth / 2,
          giantBootTopY,
          giantBootWidth,
          giantBootHeight
        );
        ctx.fillRect(
          x + giantLegSpacing - giantBootWidth / 2,
          giantBootTopY,
          giantBootWidth,
          giantBootHeight
        );

        // Body (More shaped)
        ctx.fillStyle = enemyGiantRed;
        ctx.beginPath();
        ctx.moveTo(x - giantBodyWidth / 2, giantBodyTopY);
        ctx.quadraticCurveTo(x - giantBodyWidth * 0.6, giantBodyTopY + giantBodyHeight * 0.3, x - giantBodyWidth / 2, giantBodyBottomY);
        ctx.lineTo(x + giantBodyWidth / 2, giantBodyBottomY);
        ctx.quadraticCurveTo(x + giantBodyWidth * 0.6, giantBodyTopY + giantBodyHeight * 0.3, x + giantBodyWidth / 2, giantBodyTopY);
        ctx.closePath();
        ctx.fill();

        // Body Highlight/Shadow
        ctx.fillStyle = enemyUniformHighlight;
        ctx.beginPath();
        ctx.moveTo(x - giantBodyWidth / 2 + giantBodyWidth * 0.1, giantBodyTopY + giantBodyHeight * 0.1);
        ctx.quadraticCurveTo(x - giantBodyWidth * 0.5, giantBodyTopY + giantBodyHeight * 0.3, x - giantBodyWidth / 2 + giantBodyWidth * 0.1, giantBodyBottomY - giantBodyHeight * 0.1);
        ctx.lineTo(x + giantBodyWidth / 2 - giantBodyWidth * 0.1, giantBodyBottomY - giantBodyHeight * 0.1);
        ctx.quadraticCurveTo(x + giantBodyWidth * 0.5, giantBodyTopY + giantBodyHeight * 0.3, x + giantBodyWidth / 2 - giantBodyWidth * 0.1, giantBodyTopY + giantBodyHeight * 0.1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = enemyUniformShadow;
         ctx.beginPath();
        ctx.moveTo(x - giantBodyWidth / 2 + giantBodyWidth * 0.2, giantBodyTopY + giantBodyHeight * 0.2);
        ctx.quadraticCurveTo(x - giantBodyWidth * 0.4, giantBodyTopY + giantBodyHeight * 0.4, x - giantBodyWidth / 2 + giantBodyWidth * 0.2, giantBodyBottomY - giantBodyHeight * 0.2);
        ctx.lineTo(x + giantBodyWidth / 2 - giantBodyWidth * 0.2, giantBodyBottomY - giantBodyHeight * 0.2);
        ctx.quadraticCurveTo(x + giantBodyWidth * 0.4, giantBodyTopY + giantBodyHeight * 0.4, x + giantBodyWidth / 2 - giantBodyWidth * 0.2, giantBodyTopY + giantBodyHeight * 0.2);
        ctx.closePath();
        ctx.fill();


        if (attackState === "winding_up") {
          ctx.fillStyle = "rgba(255, 255, 100, 0.15)";
           ctx.beginPath(); // Redraw the body shape for the tint
            ctx.moveTo(x - giantBodyWidth / 2, giantBodyTopY);
            ctx.quadraticCurveTo(x - giantBodyWidth * 0.6, giantBodyTopY + giantBodyHeight * 0.3, x - giantBodyWidth / 2, giantBodyBottomY);
            ctx.lineTo(x + giantBodyWidth / 2, giantBodyBottomY);
            ctx.quadraticCurveTo(x + giantBodyWidth * 0.6, giantBodyTopY + giantBodyHeight * 0.3, x + giantBodyWidth / 2, giantBodyTopY);
            ctx.closePath();
           ctx.fill();
        }
        // Belt
        ctx.fillStyle = beltColor;
        ctx.fillRect(
          x - giantBodyWidth / 2,
          giantBodyTopY + giantBodyHeight * 0.7,
          giantBodyWidth,
          giantBodyHeight * 0.08
        );
        // Arms (More shaped, animated)
        ctx.fillStyle = enemyGiantRed;
        const drawGiantArm = (armCtx, shoulderX, shoulderY, windUp) => {
             armCtx.beginPath();
             armCtx.moveTo(0, 0); // Shoulder joint
             const elbowX = windUp ? giantArmShoulderWidth * 0.5 : giantArmShoulderWidth * 0.8;
             const elbowY = windUp ? giantArmLength * 0.5 : giantArmLength * 0.2;
             const wristX = windUp ? giantArmWristWidth * 0.3 : giantArmWristWidth * 0.5;
             const wristY = giantArmLength;
             armCtx.quadraticCurveTo(elbowX, elbowY, wristX, wristY);
             armCtx.lineTo(wristX + giantArmWristWidth * 0.5, wristY); // Wrist width
             armCtx.quadraticCurveTo(elbowX + giantArmShoulderWidth * 0.2, elbowY, giantArmShoulderWidth, 0); // Back to shoulder width
             armCtx.closePath();
             armCtx.fill();

             // Arm Shading
             armCtx.fillStyle = enemyUniformHighlight;
             armCtx.beginPath();
             armCtx.moveTo(giantArmShoulderWidth * 0.1, giantArmLength * 0.1);
             armCtx.quadraticCurveTo(elbowX * 0.8, elbowY * 0.8, wristX * 0.8, wristY * 0.8);
             armCtx.lineTo(wristX * 0.8 + giantArmWristWidth * 0.3, wristY * 0.8);
             armCtx.quadraticCurveTo(elbowX * 0.8 + giantArmShoulderWidth * 0.1, elbowY * 0.8, giantArmShoulderWidth * 0.8, giantArmLength * 0.1);
             armCtx.closePath();
             armCtx.fill();

             armCtx.fillStyle = enemyUniformShadow;
             armCtx.beginPath();
             armCtx.moveTo(giantArmShoulderWidth * 0.3, giantArmLength * 0.3);
             armCtx.quadraticCurveTo(elbowX * 1.2, elbowY * 1.2, wristX * 1.2, wristY * 1.2);
             armCtx.lineTo(wristX * 1.2 + giantArmWristWidth * 0.1, wristY * 1.2);
             armCtx.quadraticCurveTo(elbowX * 1.2 + giantArmShoulderWidth * 0.05, elbowY * 1.2, giantArmShoulderWidth * 0.6, giantArmLength * 0.3);
             armCtx.closePath();
             armCtx.fill();
        };

        const windUpAngle = -Math.PI / 6;
        const raisedOffsetY = -giantArmLength * 0.1;

        ctx.save();
        ctx.translate(x - giantShoulderXOffset, giantShoulderY + (attackState === "winding_up" ? raisedOffsetY : 0));
        ctx.rotate(attackState === "winding_up" ? windUpAngle : Math.PI / 10); // Slightly angled down when idle
        drawGiantArm(ctx, 0, 0, attackState === "winding_up");
        ctx.restore();

        ctx.save();
        ctx.translate(x + giantShoulderXOffset, giantShoulderY + (attackState === "winding_up" ? raisedOffsetY : 0));
        ctx.rotate(attackState === "winding_up" ? -windUpAngle : -Math.PI / 10); // Slightly angled down when idle
        ctx.scale(-1, 1); // Flip horizontally for the right arm
        drawGiantArm(ctx, 0, 0, attackState === "winding_up");
        ctx.restore();


        // Head & Face (More shaped)
        ctx.fillStyle = enemySkinColor;
        ctx.beginPath();
        ctx.arc(x, giantHeadCenterY, giantHeadRadius, 0, Math.PI * 2);
        ctx.fill();

        // Head Shading
        ctx.fillStyle = enemySkinHighlight;
        ctx.beginPath();
        ctx.arc(x - giantHeadRadius * 0.3, giantHeadCenterY - giantHeadRadius * 0.3, giantHeadRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
         ctx.fillStyle = enemySkinShadow;
        ctx.beginPath();
        ctx.arc(x + giantHeadRadius * 0.3, giantHeadCenterY + giantHeadRadius * 0.3, giantHeadRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();


        ctx.fillStyle = enemyCapColor; // Using CapColor for beard
        ctx.fillRect(x - giantBeardWidth / 2, giantBeardTopY, giantBeardWidth, giantBeardHeight);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.beginPath();
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
        // Shako Hat (More shaped)
        ctx.fillStyle = enemyCapColor;
        ctx.beginPath();
        ctx.moveTo(x - giantShakoWidth / 2, giantShakoBaseY - giantShakoHeight);
        ctx.lineTo(x + giantShakoWidth / 2, giantShakoBaseY - giantShakoHeight);
        ctx.lineTo(x + giantShakoWidth * 0.8, giantShakoBaseY);
        ctx.lineTo(x - giantShakoWidth * 0.8, giantShakoBaseY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = enemyCapColor; // Peak
        ctx.beginPath();
        ctx.moveTo(x - giantShakoPeakWidth / 2, giantShakoBaseY - giantShakoHeight);
        ctx.lineTo(x + giantShakoPeakWidth / 2, giantShakoBaseY - giantShakoHeight);
        ctx.lineTo(x + giantShakoPeakWidth * 0.8, giantShakoBaseY - giantShakoHeight - giantShakoPeakHeight);
        ctx.lineTo(x - giantShakoPeakWidth * 0.8, giantShakoBaseY - giantShakoHeight - giantShakoPeakHeight);
        ctx.closePath();
        ctx.fill();


      }
      // --- Standard Enemy (Enhanced Shapes, Shading, Animations) ---
      else {
        const standardHeadRadius = currentH * 0.16;
        const standardCoatShoulderWidth = currentW * 1.1;
        const standardCoatHemWidth = currentW * 0.9;
        const standardTorsoShoulderWidth = currentW * 0.9;
        const standardTorsoHemWidth = currentW * 0.7;
        const standardCoatTopY = y - currentH * 0.35 + bobOffset;
        const standardCoatBottomY = y + currentH * 0.25 + bobOffset;
        const standardCoatHeight = standardCoatBottomY - standardCoatTopY;
        const standardHeadCenterY = standardCoatTopY - standardHeadRadius * 0.6;
        const standardArmWidth = currentW * 0.2;
        const standardArmHeight = currentH * 0.45;
        const standardArmOffsetY = standardCoatTopY + standardCoatHeight * 0.1;
        const standardTrouserHeight = currentH * 0.2;
        const standardTrouserWidth = currentW * 0.25;
        const standardTrouserTopY = standardCoatBottomY;
        const standardLegSpacing = currentW * 0.15;
        const standardBootHeight = currentH * 0.12;
        const standardBootWidth = currentW * 0.3;
        const standardBootTopY = standardTrouserTopY + standardTrouserHeight;
        const standardHatBrimWidth = standardHeadRadius * 3.5;
        const standardHatBrimHeight = standardHeadRadius * 0.6;
        const standardHatCrownRadiusH = standardHeadRadius * 1.5;
        const standardHatCrownRadiusV = standardHeadRadius * 1.1;
        const standardHatCenterY = standardHeadCenterY - standardHeadRadius * 1.0;
        const stepCycle = 400;
        const stepPhase = Math.floor(t / stepCycle) % 2;
        const walkLift = 2; // Pixels to lift foot during walk

        const standardBrowLength = standardHeadRadius * 0.5;
        const standardBrowY = standardHeadCenterY - standardHeadRadius * 0.3;
        const standardBrowXOffset = standardHeadRadius * 0.3;


        // Trousers & Boots
        ctx.fillStyle = enemyBootColor;
        const leftLegX = x - standardLegSpacing;
        const rightLegX = x + standardLegSpacing;
        let leftBootYOffset = 0;
        let rightBootYOffset = 0;

        if (enemyState?.is_moving) { // Assume is_moving flag exists
             if (stepPhase === 0) {
                leftBootYOffset = -walkLift;
             } else {
                rightBootYOffset = -walkLift;
             }
        }

        // Draw Legs (Simple Rects for now, can enhance later)
        ctx.fillRect(leftLegX - standardTrouserWidth / 2, standardTrouserTopY, standardTrouserWidth, standardTrouserHeight);
        ctx.fillRect(rightLegX - standardTrouserWidth / 2, standardTrouserTopY, standardTrouserWidth, standardTrouserHeight);

        // Draw Boots (Simple Rects for now, can enhance later)
        ctx.fillStyle = bootColor;
        ctx.fillRect(leftLegX - standardBootWidth / 2, standardBootTopY + leftBootYOffset, standardBootWidth, standardBootHeight);
        ctx.fillRect(rightLegX - standardBootWidth / 2, standardBootTopY + rightBootYOffset, standardBootWidth, standardBootHeight);


        // Coats/Arms/Torso (More shaped)
        ctx.fillStyle = enemyCoatColor;
        ctx.beginPath();
        ctx.moveTo(x - standardCoatShoulderWidth / 2, standardCoatTopY);
        ctx.quadraticCurveTo(x - standardCoatShoulderWidth * 0.8, standardCoatTopY + standardCoatHeight * 0.3, x - standardCoatHemWidth / 2, standardCoatBottomY);
        ctx.lineTo(x + standardCoatHemWidth / 2, standardCoatBottomY);
        ctx.quadraticCurveTo(x + standardCoatShoulderWidth * 0.8, standardCoatTopY + standardCoatHeight * 0.3, x + standardCoatShoulderWidth / 2, standardCoatTopY);
        ctx.closePath();
        ctx.fill();

         // Coat Shading
        ctx.fillStyle = enemyCoatHighlight;
        ctx.beginPath();
        ctx.moveTo(x - standardCoatShoulderWidth / 2 + standardCoatShoulderWidth * 0.1, standardCoatTopY + standardCoatHeight * 0.05);
        ctx.quadraticCurveTo(x - standardCoatShoulderWidth * 0.7, standardCoatTopY + standardCoatHeight * 0.3, x - standardCoatHemWidth / 2 + standardCoatHemWidth * 0.1, standardCoatBottomY - standardCoatHeight * 0.05);
        ctx.lineTo(x + standardCoatHemWidth / 2 - standardCoatHemWidth * 0.1, standardCoatBottomY - standardCoatHeight * 0.05);
        ctx.quadraticCurveTo(x + standardCoatShoulderWidth * 0.7, standardCoatTopY + standardCoatHeight * 0.3, x + standardCoatShoulderWidth / 2 - standardCoatShoulderWidth * 0.1, standardCoatTopY + standardCoatHeight * 0.05);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = enemyCoatShadow;
        ctx.beginPath();
        ctx.moveTo(x - standardCoatShoulderWidth / 2 + standardCoatShoulderWidth * 0.2, standardCoatTopY + standardCoatHeight * 0.1);
        ctx.quadraticCurveTo(x - standardCoatShoulderWidth * 0.6, standardCoatTopY + standardCoatHeight * 0.4, x - standardCoatHemWidth / 2 + standardCoatHemWidth * 0.2, standardCoatBottomY - standardCoatHeight * 0.1);
        ctx.lineTo(x + standardCoatHemWidth / 2 - standardCoatHemWidth * 0.2, standardCoatBottomY - standardCoatHeight * 0.1);
        ctx.quadraticCurveTo(x + standardCoatShoulderWidth * 0.6, standardCoatTopY + standardCoatHeight * 0.4, x + standardCoatShoulderWidth / 2 - standardCoatShoulderWidth * 0.2, standardCoatTopY + standardCoatHeight * 0.1);
        ctx.closePath();
        ctx.fill();


        // Arms (Simple Rects for now, can enhance later)
        ctx.fillStyle = enemyCoatColor;
        ctx.fillRect(
          x - standardCoatShoulderWidth * 0.45 - standardArmWidth / 2,
          standardArmOffsetY,
          standardArmWidth,
          standardArmHeight
        );
        ctx.fillRect(
          x + standardCoatShoulderWidth * 0.45 - standardArmWidth / 2,
          standardArmOffsetY,
          standardArmWidth,
          standardArmHeight
        );

        // Torso (More shaped)
        ctx.fillStyle = enemyUniformBlue;
        ctx.beginPath();
        ctx.moveTo(x - standardTorsoShoulderWidth / 2, standardCoatTopY); // Adjusted Y to standardCoatTopY
        ctx.quadraticCurveTo(x - standardTorsoShoulderWidth * 0.7, standardCoatTopY + standardTorsoHeight * 0.3, x - standardTorsoHemWidth / 2, standardCoatBottomY);
        ctx.lineTo(x + standardTorsoHemWidth / 2, standardCoatBottomY);
        ctx.quadraticCurveTo(x + standardTorsoShoulderWidth * 0.7, standardCoatTopY + standardTorsoHeight * 0.3, x + standardTorsoShoulderWidth / 2, standardCoatTopY);
        ctx.closePath();
        ctx.fill();

        // Torso Shading
        ctx.fillStyle = enemyUniformHighlight;
        ctx.beginPath();
        ctx.moveTo(x - standardTorsoShoulderWidth / 2 + standardTorsoShoulderWidth * 0.1, standardCoatTopY + standardTorsoHeight * 0.05);
        ctx.quadraticCurveTo(x - standardTorsoShoulderWidth * 0.6, standardCoatTopY + standardTorsoHeight * 0.3, x - standardTorsoHemWidth / 2 + standardTorsoHemWidth * 0.1, standardCoatBottomY - standardTorsoHeight * 0.05);
        ctx.lineTo(x + standardTorsoHemWidth / 2 - standardTorsoHemWidth * 0.1, standardCoatBottomY - standardTorsoHeight * 0.05);
        ctx.quadraticCurveTo(x + standardTorsoShoulderWidth * 0.6, standardCoatTopY + standardTorsoHeight * 0.3, x + standardTorsoShoulderWidth / 2 - standardTorsoShoulderWidth * 0.1, standardCoatTopY + standardTorsoHeight * 0.05);
        ctx.closePath();
        ctx.fill();

         ctx.fillStyle = enemyUniformShadow;
        ctx.beginPath();
        ctx.moveTo(x - standardTorsoShoulderWidth / 2 + standardTorsoShoulderWidth * 0.2, standardCoatTopY + standardTorsoHeight * 0.1);
        ctx.quadraticCurveTo(x - standardTorsoShoulderWidth * 0.5, standardCoatTopY + standardTorsoHeight * 0.4, x - standardTorsoHemWidth / 2 + standardTorsoHemWidth * 0.2, standardCoatBottomY - standardTorsoHeight * 0.1);
        ctx.lineTo(x + standardTorsoHemWidth / 2 - standardTorsoHemWidth * 0.2, standardCoatBottomY - standardTorsoHeight * 0.1);
        ctx.quadraticCurveTo(x + standardTorsoShoulderWidth * 0.5, standardCoatTopY + standardTorsoHeight * 0.4, x + standardTorsoShoulderWidth / 2 - standardTorsoShoulderWidth * 0.2, standardCoatTopY + standardTorsoHeight * 0.1);
        ctx.closePath();
        ctx.fill();


        // Head & Face (More shaped)
        ctx.fillStyle = enemySkinColor;
        ctx.beginPath();
        ctx.arc(x, standardHeadCenterY, standardHeadRadius, 0, Math.PI * 2);
        ctx.fill();

        // Head Shading
        ctx.fillStyle = enemySkinHighlight;
        ctx.beginPath();
        ctx.arc(x - standardHeadRadius * 0.3, standardHeadCenterY - standardHeadRadius * 0.3, standardHeadRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();
         ctx.fillStyle = enemySkinShadow;
        ctx.beginPath();
        ctx.arc(x + standardHeadRadius * 0.3, standardHeadCenterY + standardHeadRadius * 0.3, standardHeadRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();


        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - standardBrowXOffset - standardBrowLength / 2, standardBrowY - standardBrowLength / 3);
        ctx.lineTo(x - standardBrowXOffset + standardBrowLength / 2, standardBrowY + standardBrowLength / 3);
        ctx.moveTo(x + standardBrowXOffset - standardBrowLength / 2, standardBrowY + standardBrowLength / 3);
        ctx.lineTo(x + standardBrowXOffset + standardBrowLength / 2, standardBrowY - standardBrowLength / 3);
        ctx.stroke();
        // Hat (More shaped)
        ctx.fillStyle = enemyCapColor;
        ctx.beginPath(); // Brim
        ctx.ellipse(
          x,
          standardHatCenterY + standardHatCrownRadiusV * 0.7,
          standardHatBrimWidth / 2,
          standardHatBrimHeight / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath(); // Crown
        ctx.ellipse(
          x,
          standardHatCenterY,
          standardHatCrownRadiusH / 2,
          standardHatCrownRadiusV,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Shooter Gun (Slightly more detailed)
        if (type === "shooter") {
          const gunBarrelLength = w * 1.2;
          const gunBarrelThickness = 3;
          const gunStockLength = w * 0.5;
          const gunStockThickness = 5;
          const gunColorBarrel = "#555555";
          const gunColorStock = "#7a4a2a";
          ctx.save();
          const gunAngle = Math.PI / 10; // Static angle for now
          const gunCenterY = y + bobOffset;
          const gunCenterX = x;
          ctx.translate(gunCenterX, gunCenterY);
          ctx.rotate(gunAngle);

          // Draw Stock
          ctx.fillStyle = gunColorStock;
          ctx.beginPath();
          ctx.moveTo(-gunStockLength - 2, -gunStockThickness / 2);
          ctx.lineTo(0, -gunStockThickness / 2);
          ctx.lineTo(5, gunStockThickness / 2); // Slight angle
          ctx.lineTo(-gunStockLength - 2, gunStockThickness / 2);
          ctx.closePath();
          ctx.fill();

          // Draw Barrel
          ctx.fillStyle = gunColorBarrel;
          ctx.fillRect(0, -gunBarrelThickness / 2, gunBarrelLength, gunBarrelThickness);

          // Simple sight
          ctx.fillStyle = "#333";
          ctx.fillRect(gunBarrelLength * 0.8, -gunBarrelThickness / 2 - 2, 4, 2);


          ctx.restore();
        }
      }

      // --- Common Effects ---
      // Snake Bite
      if (isSnakeBitten) {
        let footY;
        if (type === "giant") {
          const giantBodyHeight = currentH * 0.7;
          const giantLegHeight = currentH * 0.25;
          const giantBootHeight = currentH * 0.1;
          const giantBodyTopY = y - currentH * 0.4;
          footY = giantBodyTopY + giantBodyHeight + giantLegHeight + giantBootHeight;
        } else {
          const standardCoatBottomY = y + currentH * 0.25 + bobOffset;
          const standardTrouserHeight = currentH * 0.2;
          const standardBootHeight = currentH * 0.12;
          footY = standardCoatBottomY + standardTrouserHeight + standardBootHeight;
        }
        const numParticles = 10; // Increased particles
        const particleBaseSize = 4; // Increased size
        const particleSpeedY = -70; // Faster
        const particleSpeedX = 20; // Horizontal spread
        const particleLifetimeMs = 800; // Longer lifetime
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; // Blend particles

        for (let i = 0; i < numParticles; i++) {
          const effectStartTime =
            snakeEffect.expires_at * 1000 - SNAKE_BITE_DURATION * 1000;
          const timeSinceEffectStart = Math.max(0, t - effectStartTime);
          const particleSimulatedAge =
            (timeSinceEffectStart + (particleLifetimeMs / numParticles) * i * 1.5) % // Stagger spawn
            particleLifetimeMs;
          const particleProgress = particleSimulatedAge / particleLifetimeMs;
          if (particleProgress < 0 || particleProgress >= 1) continue;

          const initialOffsetX = (Math.random() - 0.5) * currentW * 0.8;
          const initialOffsetY = (Math.random() - 0.5) * currentH * 0.2;

          const particleX = x + initialOffsetX + particleSpeedX * (particleProgress - 0.5); // Add horizontal movement
          const particleY = footY + initialOffsetY + particleSpeedY * (particleSimulatedAge / 1000);

          const particleSize =
            particleBaseSize *
            (1.0 - particleProgress * 0.7) * // Shrink more over time
            (0.8 + Math.random() * 0.4);
          const alpha =
            0.9 * (1.0 - particleProgress) * (0.7 + Math.random() * 0.3); // Fade out

          const green = 180 + Math.floor(75 * particleProgress);
          const yellow = 220 * (1.0 - particleProgress); // More yellow initially
          const blue = 50 + Math.floor(50 * particleProgress); // Add a touch of blue

          ctx.fillStyle = `rgba(${Math.floor(
            yellow
          )}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
          ctx.fillRect(
            particleX - particleSize / 2,
            particleY - particleSize / 2,
            particleSize,
            particleSize
          );
        }
        ctx.restore();
      }
      // Blood Sparks (Enhanced)
      if (showBloodSparks) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; // Blend sparks
        const numSparks = 5 + Math.floor(Math.random() * 8); // More sparks
        const sparkColors = [
          "rgba(255, 50, 50, 0.9)", // Brighter red
          "rgba(255, 100, 0, 0.8)", // Orange-ish
          "rgba(200, 0, 0, 0.7)",
          "rgba(255, 150, 150, 0.6)", // Pinkish highlight
        ];
        const sparkCenterY = y + (type !== "giant" ? bobOffset : 0) - currentH * 0.3; // Sparks higher up
        const sparkMaxDistance = currentW * 0.6; // Sparks spread wider

        for (let i = 0; i < numSparks; i++) {
          const sparkAngle = Math.random() * Math.PI * 2;
          const sparkDistance = Math.random() * sparkMaxDistance;
          const sparkX = x + Math.cos(sparkAngle) * sparkDistance;
          const sparkY = sparkCenterY + Math.sin(sparkAngle) * sparkDistance * 0.6; // Vertical compression
          const sparkSize = 3 + Math.random() * 4; // Larger sparks
          const sparkAlpha = 0.5 + Math.random() * 0.5; // Vary alpha

          ctx.fillStyle =
            sparkColors[Math.floor(Math.random() * sparkColors.length)];
          ctx.globalAlpha = sparkAlpha;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, sparkSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Restore hit flash filter
      if (isHit) {
          ctx.filter = 'none';
      }

      ctx.restore(); // Restore context from start of function
    }

    // --- REVISED drawPlayerCharacter (Enhanced Shapes, Shading, Animations, Fixed Gun Aim) ---
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
      const isHit = playerState?.is_hit; // Assume is_hit flag exists

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
      const shoulderOffsetX = torsoUpperWidth * 0.4; // Adjusted offset slightly
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
      const beltColor = "#412a19"; // Corrected: Ensure this is defined
      const beltBuckleColor = "#b0a080";
      const bootColor = "#241c1c";
      const bootSoleColor = "#1a1a1a";
      const playerBodyHighlightColor = playerBodyHighlight;
      const playerBodyShadowColor = playerBodyShadow;

      ctx.save();

       // Apply hit flash effect
      if (isHit) {
          ctx.filter = 'brightness(1.5) saturate(1.5)'; // Simple flash effect
      }


      // Shadow
      ctx.beginPath();
      ctx.ellipse(x, bootBottomY + 2, w * 0.5, h * 0.06, 0, 0, Math.PI * 2);
      ctx.fillStyle = backgroundShadowColor;
      ctx.fill();

      // Boot Helper (More shaped)
      const drawBoot = (bootCtx, bootX, bootTopYCoord, isKick = false, kickAngle = 0) => {
        bootCtx.save();
        if (isKick) {
          bootCtx.translate(bootX, bootTopYCoord);
          bootCtx.rotate(kickAngle);
          bootX = 0; bootTopYCoord = 0; // Translate origin
        }
        const shaftTopY = bootTopYCoord;
        const shaftBottomY = shaftTopY + bootShaftHeight;
        const soleTopY = shaftBottomY;
        const soleBottomY = soleTopY + bootSoleHeight;

        // Shaft
        bootCtx.fillStyle = bootColor;
        bootCtx.beginPath();
        bootCtx.moveTo(bootX - bootWidth / 2, shaftTopY);
        bootCtx.lineTo(bootX + bootWidth / 2, shaftTopY);
        bootCtx.lineTo(bootX + bootWidth * 0.4, shaftBottomY); // Slight taper
        bootCtx.lineTo(bootX - bootWidth * 0.4, shaftBottomY);
        bootCtx.closePath();
        bootCtx.fill();

        // Sole
        bootCtx.fillStyle = bootSoleColor;
        const soleWidth = bootWidth * 1.1;
        bootCtx.beginPath();
        bootCtx.moveTo(bootX - soleWidth / 2, soleTopY);
        bootCtx.lineTo(bootX + soleWidth / 2, soleTopY);
        bootCtx.lineTo(bootX + soleWidth * 0.4, soleBottomY); // Slight angle
        bootCtx.lineTo(bootX - soleWidth * 0.4, soleBottomY);
        bootCtx.closePath();
        bootCtx.fill();


        // Heel
        bootCtx.fillStyle = bootSoleColor;
        const heelWidth = bootWidth * 0.6;
        const heelHeight = bootSoleHeight * 0.8;
         bootCtx.beginPath();
         bootCtx.moveTo(bootX - heelWidth * 0.1, soleBottomY - heelHeight);
         bootCtx.lineTo(bootX + heelWidth * 0.9, soleBottomY - heelHeight);
         bootCtx.lineTo(bootX + heelWidth * 0.8, soleBottomY);
         bootCtx.lineTo(bootX, soleBottomY);
         bootCtx.closePath();
         bootCtx.fill();

        if (isKick) {
          bootCtx.restore();
        }
      };

      // Legs & Boots (More shaped, animated walk cycle)
      const isPushbackAnimating =
        pushbackAnimState?.active && now < pushbackAnimState?.endTime;
      ctx.fillStyle = playerBodyColor;

      const leftLegX = x - w * 0.2;
      const rightLegX = x + w * 0.2;
      let leftLegYOffset = 0;
      let rightLegYOffset = 0;
      const walkCycleTime = 400;
      const phase = (t % walkCycleTime) / walkCycleTime;
      const liftAmount = 2; // Pixels to lift foot

      if (!ii && !isPushbackAnimating) { // Walking animation
         if (phase < 0.5) {
            leftLegYOffset = -Math.sin(phase * 2 * Math.PI) * liftAmount;
         } else {
            rightLegYOffset = -Math.sin((phase - 0.5) * 2 * Math.PI) * liftAmount;
         }
      }


      if (isPushbackAnimating) {
        const kickAngle = -Math.PI / 4.5;
        const supportLegX = x + w * 0.15;
        const kickLegX = x - w * 0.15;
        const kickLegVisualLength = legHeight * 1.05;

        // Support Leg (More shaped)
        ctx.beginPath();
        ctx.moveTo(supportLegX - legUpperWidth / 2, legTopY);
        ctx.quadraticCurveTo(supportLegX - legUpperWidth * 0.6, legTopY + legHeight * 0.3, supportLegX - legLowerWidth / 2, legBottomY);
        ctx.lineTo(supportLegX + legLowerWidth / 2, legBottomY);
        ctx.quadraticCurveTo(supportLegX + legUpperWidth * 0.6, legTopY + legHeight * 0.3, supportLegX + legUpperWidth / 2, legTopY);
        ctx.closePath();
        ctx.fill();
        drawBoot(ctx, supportLegX, bootTopY);

        // Kick Leg (More shaped, rotated)
        ctx.save();
        ctx.translate(kickLegX, legTopY + legHeight * 0.1);
        ctx.rotate(kickAngle);
        ctx.fillStyle = playerBodyColor;
        ctx.beginPath();
        ctx.moveTo(-legUpperWidth / 2, 0);
        ctx.quadraticCurveTo(-legUpperWidth * 0.6, kickLegVisualLength * 0.3, -legLowerWidth / 2, kickLegVisualLength);
        ctx.lineTo(legLowerWidth / 2, kickLegVisualLength);
        ctx.quadraticCurveTo(legUpperWidth * 0.6, kickLegVisualLength * 0.3, legUpperWidth / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        const kickEndX = kickLegX + Math.sin(kickAngle) * kickLegVisualLength;
        const kickEndY = legTopY + legHeight * 0.1 + Math.cos(kickAngle) * kickLegVisualLength;
        drawBoot(ctx, kickEndX, kickEndY - bootShaftHeight, false);

      } else { // Idle or Walking
        // Left Leg (More shaped)
        ctx.beginPath();
        ctx.moveTo(leftLegX - legUpperWidth / 2, legTopY + leftLegYOffset);
        ctx.quadraticCurveTo(leftLegX - legUpperWidth * 0.6, legTopY + legHeight * 0.3 + leftLegYOffset, leftLegX - legLowerWidth / 2, legBottomY + leftLegYOffset);
        ctx.lineTo(leftLegX + legLowerWidth / 2, legBottomY + leftLegYOffset);
        ctx.quadraticCurveTo(leftLegX + legUpperWidth * 0.6, legTopY + legHeight * 0.3 + leftLegYOffset, leftLegX + legUpperWidth / 2, legTopY + leftLegYOffset);
        ctx.closePath();
        ctx.fill();
        drawBoot(ctx, leftLegX, bootTopY + leftLegYOffset);

        // Right Leg (More shaped)
        ctx.beginPath();
        ctx.moveTo(rightLegX - legUpperWidth / 2, legTopY + rightLegYOffset);
        ctx.quadraticCurveTo(rightLegX - legUpperWidth * 0.6, legTopY + legHeight * 0.3 + rightLegYOffset, rightLegX - legLowerWidth / 2, legBottomY + rightLegYOffset);
        ctx.lineTo(rightLegX + legLowerWidth / 2, legBottomY + rightLegYOffset);
        ctx.quadraticCurveTo(rightLegX + legUpperWidth * 0.6, legTopY + legHeight * 0.3 + rightLegYOffset, rightLegX + legUpperWidth / 2, legTopY + rightLegYOffset);
        ctx.closePath();
        ctx.fill();
        drawBoot(ctx, rightLegX, bootTopY + rightLegYOffset);
      }


      // Torso (More shaped)
      ctx.fillStyle = playerBodyColor;
      ctx.beginPath();
      ctx.moveTo(x - torsoUpperWidth / 2, torsoTopY);
      ctx.quadraticCurveTo(x - torsoUpperWidth * 0.6, torsoTopY + torsoHeight * 0.3, x - torsoLowerWidth / 2, torsoBottomY);
      ctx.lineTo(x + torsoLowerWidth / 2, torsoBottomY);
      ctx.quadraticCurveTo(x + torsoUpperWidth * 0.6, torsoTopY + torsoHeight * 0.3, x + torsoUpperWidth / 2, torsoTopY);
      ctx.closePath();
      ctx.fill();

      // Torso Shading
      ctx.fillStyle = playerBodyHighlightColor;
      ctx.beginPath();
      ctx.moveTo(x - torsoUpperWidth / 2 + torsoUpperWidth * 0.1, torsoTopY + torsoHeight * 0.05);
      ctx.quadraticCurveTo(x - torsoUpperWidth * 0.5, torsoTopY + torsoHeight * 0.3, x - torsoLowerWidth / 2 + torsoLowerWidth * 0.1, torsoBottomY - torsoHeight * 0.05);
      ctx.lineTo(x + torsoLowerWidth / 2 - torsoLowerWidth * 0.1, torsoBottomY - torsoHeight * 0.05);
      ctx.quadraticCurveTo(x + torsoUpperWidth * 0.5, torsoTopY + torsoHeight * 0.3, x + torsoUpperWidth / 2 - torsoUpperWidth * 0.1, torsoTopY + torsoHeight * 0.05);
      ctx.closePath();
      ctx.fill();

       ctx.fillStyle = playerBodyShadowColor;
      ctx.beginPath();
      ctx.moveTo(x - torsoUpperWidth / 2 + torsoUpperWidth * 0.2, torsoTopY + torsoHeight * 0.1);
      ctx.quadraticCurveTo(x - torsoUpperWidth * 0.4, torsoTopY + torsoHeight * 0.4, x - torsoLowerWidth / 2 + torsoLowerWidth * 0.2, torsoBottomY - torsoHeight * 0.1);
      ctx.lineTo(x + torsoLowerWidth / 2 - torsoLowerWidth * 0.2, torsoBottomY - torsoHeight * 0.1);
      ctx.quadraticCurveTo(x + torsoUpperWidth * 0.4, torsoTopY + torsoHeight * 0.4, x + torsoUpperWidth / 2 - torsoUpperWidth * 0.2, torsoTopY + torsoHeight * 0.1);
      ctx.closePath();
      ctx.fill();


      // Arms (More shaped)
       const drawArm = (armCtx, shoulderX, shoulderY) => {
            armCtx.beginPath();
            armCtx.moveTo(0, 0); // Shoulder joint
            const elbowX = armWidth * 0.8;
            const elbowY = armLength * 0.3;
            const wristX = armWidth * 0.5;
            const wristY = armLength;
            armCtx.quadraticCurveTo(elbowX, elbowY, wristX, wristY);
            armCtx.lineTo(wristX + armWidth * 0.5, wristY); // Wrist width
            armCtx.quadraticCurveTo(elbowX + armWidth * 0.2, elbowY, armWidth, 0); // Back to shoulder width
            armCtx.closePath();
            armCtx.fill();

             // Arm Shading
             armCtx.fillStyle = playerBodyHighlightColor;
             armCtx.beginPath();
             armCtx.moveTo(armWidth * 0.1, armLength * 0.1);
             armCtx.quadraticCurveTo(elbowX * 0.8, elbowY * 0.8, wristX * 0.8, wristY * 0.8);
             armCtx.lineTo(wristX * 0.8 + armWidth * 0.3, wristY * 0.8);
             armCtx.quadraticCurveTo(elbowX * 0.8 + armWidth * 0.1, elbowY * 0.8, armWidth * 0.8, armLength * 0.1);
             armCtx.closePath();
             armCtx.fill();

             armCtx.fillStyle = playerBodyShadowColor;
             armCtx.beginPath();
             armCtx.moveTo(armWidth * 0.3, armLength * 0.3);
             armCtx.quadraticCurveTo(elbowX * 1.2, elbowY * 1.2, wristX * 1.2, wristY * 1.2);
             armCtx.lineTo(wristX * 1.2 + armWidth * 0.1, wristY * 1.2);
             armCtx.quadraticCurveTo(elbowX * 1.2 + armWidth * 0.05, elbowY * 1.2, armWidth * 0.6, armLength * 0.3);
             armCtx.closePath();
             armCtx.fill();
       };

       ctx.save();
       ctx.translate(x - shoulderOffsetX, armTopY);
       drawArm(ctx, 0, 0);
       ctx.restore();

       ctx.save();
       ctx.translate(x + shoulderOffsetX, armTopY);
       ctx.scale(-1, 1); // Flip horizontally for the right arm
       drawArm(ctx, 0, 0);
       ctx.restore();


      // Belt (Slightly more detailed buckle)
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
      const buckleX = x - buckleWidth / 2;
      const buckleY = beltTopY + (beltHeight - buckleHeight) / 2;
      ctx.fillRect(
        buckleX,
        buckleY,
        buckleWidth,
        buckleHeight
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; // Highlight
      ctx.fillRect(buckleX + 2, buckleY + 2, buckleWidth - 4, 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // Shadow
      ctx.fillRect(buckcleX + 2, buckleY + buckleHeight - 4, buckleWidth - 4, 2);


      // Chest Plate (More shaped)
      const plateWidth = torsoUpperWidth * 0.9;
      const plateHeight = torsoHeight * 0.9;
      const plateTopY = torsoTopY + torsoHeight * 0.05;
      const plateBottomY = plateTopY + plateHeight;
      ctx.fillStyle = armorColor;
      ctx.beginPath();
      ctx.moveTo(x - plateWidth / 2, plateTopY);
      ctx.quadraticCurveTo(x - plateWidth * 0.6, plateTopY + plateHeight * 0.3, x - plateWidth * 0.4, plateBottomY);
      ctx.lineTo(x + plateWidth * 0.4, plateBottomY);
      ctx.quadraticCurveTo(x + plateWidth * 0.6, plateTopY + plateHeight * 0.3, x + plateWidth / 2, plateTopY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = armorHighlight; // Highlight
      ctx.beginPath();
      ctx.moveTo(x - plateWidth / 2 + 4, plateTopY + 4);
      ctx.quadraticCurveTo(x - plateWidth * 0.5, plateTopY + plateHeight * 0.3, x - plateWidth * 0.3, plateBottomY - 4);
      ctx.lineTo(x + plateWidth * 0.3, plateBottomY - 4);
      ctx.quadraticCurveTo(x + plateWidth * 0.5, plateTopY + plateHeight * 0.3, x + plateWidth / 2 - 4, plateTopY + 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = armorShadow; // Shadow
      ctx.beginPath();
      ctx.moveTo(x - plateWidth / 2 + 6, plateTopY + 6);
      ctx.quadraticCurveTo(x - plateWidth * 0.4, plateTopY + plateHeight * 0.4, x - plateWidth * 0.2, plateBottomY - 6);
      ctx.lineTo(x + plateWidth * 0.2, plateBottomY - 6);
      ctx.quadraticCurveTo(x + plateWidth * 0.4, plateTopY + plateHeight * 0.4, x + plateWidth / 2 - 6, plateTopY + 6);
      ctx.closePath();
      ctx.fill();


      // Shoulders (More shaped)
      ctx.fillStyle = armorColor;
      ctx.beginPath(); // Left Shoulder
      ctx.arc(
        x - shoulderOffsetX,
        shoulderCenterY,
        shoulderPadRadius,
        Math.PI * 1.1,
        Math.PI * 1.9
      );
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = armorHighlight; // Left Highlight
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
      ctx.beginPath(); // Right Shoulder
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

      ctx.fillStyle = armorHighlight; // Right Highlight
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


      // Helmet (More shaped)
      ctx.fillStyle = helmetColor;
      ctx.beginPath();
      ctx.moveTo(x - headWidth / 2, headTopY + headHeight * 0.1);
      ctx.quadraticCurveTo(x - headWidth * 0.6, headTopY + headHeight * 0.4, x - headWidth / 2, headBottomY);
      ctx.lineTo(x + headWidth / 2, headBottomY);
      ctx.quadraticCurveTo(x + headWidth * 0.6, headTopY + headHeight * 0.4, x + headWidth / 2, headTopY + headHeight * 0.1);
      ctx.quadraticCurveTo(x + headWidth * 0.5, headTopY, x, headTopY); // Top curve
      ctx.quadraticCurveTo(x - headWidth * 0.5, headTopY, x - headWidth / 2, headTopY + headHeight * 0.1);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = helmetColor; // Neck guard
      ctx.fillRect(
        x - headWidth * 0.4,
        headBottomY - neckHeight * 0.5,
        headWidth * 0.8,
        neckHeight * 1.2
      );

      ctx.fillStyle = armorHighlight; // Helmet Highlight
      ctx.beginPath();
      ctx.moveTo(x - headWidth / 2 + 3, headTopY + headHeight * 0.1 + 3);
      ctx.quadraticCurveTo(x - headWidth * 0.5, headTopY + headHeight * 0.4, x - headWidth / 2 + 3, headBottomY - 3);
      ctx.lineTo(x + headWidth / 2 - 3, headBottomY - 3);
      ctx.quadraticCurveTo(x + headWidth * 0.5, headTopY + headHeight * 0.4, x + headWidth / 2 - 3, headTopY + headHeight * 0.1 + 3);
      ctx.quadraticCurveTo(x + headWidth * 0.4, headTopY + 3, x, headTopY + 3); // Top curve
      ctx.quadraticCurveTo(x - headWidth * 0.4, headTopY + 3, x - headWidth / 2 + 3, headTopY + headHeight * 0.1 + 3);
      ctx.closePath();
      ctx.fill();

      const rivetRadius = 1.5; // Rivets
      ctx.fillStyle = armorHighlight;
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

      ctx.fillStyle = slitColor; // Visor Slit
      const slitHeight = headHeight * 0.12;
      const slitWidth = headWidth * 0.8;
      const slitY = headTopY + headHeight * 0.45;
      ctx.fillRect(x - slitWidth / 2, slitY, slitWidth, slitHeight);

      // Gun (More detailed based on level, animated aiming)
      let shouldDrawGun = false;
      let gunDrawAngle = 0;
      let gunOriginXOffset = w * 0.1;
      let gunOriginYOffset = armTopY + armLength * 0.4;

      if (isPushbackAnimating) {
        shouldDrawGun = true;
        gunDrawAngle = -Math.PI / 2; // Gun points down during pushback
        gunOriginXOffset = w * 0.05;
      } else if (isSelf && (aimDx !== 0 || aimDy !== 0)) { // Restore original logic: only draw if local player is aiming
        shouldDrawGun = true;
        gunDrawAngle = Math.atan2(aimDy, aimDx); // Fixed: Corrected Math.atan2 arguments
      }
      // For other players, assume no gun drawn unless specific state indicates it
      else {
           shouldDrawGun = false;
      }


      if (shouldDrawGun) {
        const gunLevel = playerState?.gun ?? 1;
        const baseBarrelLength = 18;
        const barrelLengthIncrease = 3; // More increase
        const barrelLength = baseBarrelLength + (gunLevel - 1) * barrelLengthIncrease;
        const barrelThickness = 3 + (gunLevel - 1) * 0.3; // More thickness
        const stockLength = 8 + (gunLevel - 1) * 0.8; // More length
        const stockThickness = 5 + (gunLevel - 1) * 0.4; // More thickness
        const stockColor = "#8B4513";
        const barrelColor = "#444444";
        const sightColor = "#333";

        ctx.save();
        ctx.translate(x + gunOriginXOffset, gunOriginYOffset);
        ctx.rotate(gunDrawAngle);

        // Draw Stock (More shaped)
        ctx.fillStyle = stockColor;
        ctx.beginPath();
        ctx.moveTo(-stockLength - 2, -stockThickness / 2);
        ctx.lineTo(0, -stockThickness / 2);
        ctx.quadraticCurveTo(stockLength * 0.2, 0, 0, stockThickness / 2); // Curved end
        ctx.lineTo(-stockLength - 2, stockThickness / 2);
        ctx.closePath();
        ctx.fill();

        // Draw Barrel
        ctx.fillStyle = barrelColor;
        ctx.fillRect(0, -barrelThickness / 2, barrelLength, barrelThickness);

        // Draw Sight (More prominent)
        const sightLength = barrelLength * 0.2;
        const sightHeight = barrelThickness * 0.8;
        ctx.fillStyle = sightColor;
        ctx.fillRect(barrelLength * 0.7, -barrelThickness / 2 - sightHeight, sightLength, sightHeight);
        ctx.fillRect(barrelLength * 0.7 + sightLength * 0.8, -barrelThickness / 2 - sightHeight, sightLength * 0.2, sightHeight * 0.5); // Front post


        ctx.restore();
      }


      // Effects
      if (isPlayerBitten) {
        const footY = bootBottomY;
        const numParticles = 12; // More particles
        const particleBaseSize = 5; // Larger
        const particleSpeedY = -80; // Faster rise
        const particleSpeedX = 30; // Wider spread
        const particleLifetimeMs = 1000; // Longer lifetime
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; // Blend particles

        for (let i = 0; i < numParticles; i++) {
          const effectStartTime =
            playerSnakeEffect.expires_at * 1000 - SNAKE_BITE_DURATION * 1000;
          const timeSinceEffectStart = Math.max(0, now - effectStartTime);
          const particleSimulatedAge =
            (timeSinceEffectStart + (particleLifetimeMs / numParticles) * i * 1.2) % // Stagger spawn
            particleLifetimeMs;
          const particleProgress = particleSimulatedAge / particleLifetimeMs;
          if (particleProgress < 0 || particleProgress >= 1) continue;

          const initialOffsetX = (Math.random() - 0.5) * w * 0.8;
          const initialOffsetY = (Math.random() - 0.5) * h * 0.1;

          const particleX = x + initialOffsetX + particleSpeedX * (particleProgress - 0.5);
          const particleY = footY + initialOffsetY + particleSpeedY * (particleSimulatedAge / 1000);

          const particleSize =
            particleBaseSize *
            (1.0 - particleProgress * 0.7) * // Shrink more
            (0.8 + Math.random() * 0.4);
          const alpha =
            0.9 * (1.0 - particleProgress) * (0.7 + Math.random() * 0.3); // Fade out

          const green = 180 + Math.floor(75 * particleProgress);
          const yellow = 220 * (1.0 - particleProgress);
          const blue = 50 + Math.floor(50 * particleProgress);

          ctx.fillStyle = `rgba(${Math.floor(
            yellow
          )}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
          ctx.fillRect(
            particleX - particleSize / 2,
            particleY - particleSize / 2,
            particleSize,
            particleSize
          );
        }
        ctx.restore();
      }

      // Restore hit flash filter
      if (isHit) {
          ctx.filter = 'none';
      }

      ctx.restore(); // Restore context state from the very start of the function
    }

    function drawPlayers(
      ctx,
      players,
      appState,
      localPlayerMuzzleFlashRef,
      localPlayerPushbackAnimState
    ) {
      if (!players || !appState) return;
      const now = performance.now() / 1000; // Server time for fade check
      const clientNow = performance.now(); // Client time for effects
      const fd = 0.3; // Fade duration
      const localPlayer = players[appState.localPlayerId];

      Object.values(players).forEach((p) => {
        if (!p) return;
        const w = p.width ?? 20,
          h = p.height ?? 48,
          mh = p.max_health ?? 100,
          ma = p.max_armor ?? 100;
        const isSelf = p.id === appState.localPlayerId;
        let px = p.x,
          py = p.y;
        let a = 1.0,
          sd = true,
          id = false;

        // Use rendered position for local player for smooth movement
        if (isSelf && appState.renderedPlayerPos) {
          px = appState.renderedPlayerPos.x;
          py = appState.renderedPlayerPos.y;
        }

        if (p.player_status === "dead" && p.death_timestamp) {
          id = true;
          const el = now - p.death_timestamp;
          if (el < fd) a = Math.max(0.1, 1.0 - (el / fd) * 0.9); // Smoother fade
          else sd = false; // Don't draw if faded
        }

        if (sd) {
          ctx.save();
          ctx.globalAlpha = a;
          drawPlayerCharacter(
            ctx,
            px,
            py,
            w,
            h,
            isSelf,
            p, // Pass player state
            isSelf ? appState.aimDx : 0, // Pass aim direction for local player
            isSelf ? appState.aimDy : 0,
            isSelf ? localPlayerPushbackAnimState : null // Pass pushback state for local player
          );
          ctx.restore();
        }

        if (!id && p.health > 0 && sd) {
          drawHealthBar(ctx, px, py, w, p.health, mh);
          if (p.armor > 0) {
            drawArmorBar(ctx, px, py, w, p.armor);
          }
        }
      });
    }


    function drawEnemies(
      ctx,
      enemies,
      activeEnemyBubblesRef,
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
            e, // Pass enemy state
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

    // --- REVISED drawMuzzleFlash (More detailed) ---
    function drawMuzzleFlash(ctx, playerX, playerY, aimDx, aimDy) {
      const numPoints = 8; // More points for starburst
      const outerRadiusBase = 12; // Larger
      const outerRadiusVariance = 5;
      const innerRadiusBase = 5; // Larger
      const innerRadiusVariance = 2;
      const glowRadius = 35; // Larger glow
      const glowColor = muzzleFlashGlowCore; // Use new glow color constant
      const flashColor = "rgba(255, 230, 100, 0.95)";
      const coreColor = "rgba(255, 255, 255, 1.0)"; // Bright white core
      const offsetDistance = 35; // Further offset
      const flashX = playerX + aimDx * offsetDistance;
      const flashY = playerY + aimDy * offsetDistance;
      const angle = Math.atan2(aimDy, aimDx);

      ctx.save();
      ctx.translate(flashX, flashY);
      ctx.rotate(angle);
      ctx.globalCompositeOperation = 'lighter'; // Blend for glow effect

      // Draw Glow
      try {
        const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        glowGradient.addColorStop(0, glowColor);
        glowGradient.addColorStop(1, "rgba(255, 200, 50, 0)");
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      } catch (e) {
         // Fallback if gradient fails
         ctx.fillStyle = glowColor;
         ctx.beginPath();
         ctx.arc(0, 0, glowRadius * 0.5, 0, Math.PI * 2);
         ctx.fill();
      }


      // Draw Flash Starburst
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

      // Draw Bright Core
      const coreRadius = innerRadiusBase * 0.8;
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
      ctx.fill();


      ctx.restore(); // Restore globalCompositeOperation and transform
    }

    // --- REVISED drawBulletCircle (Enhanced Trail) ---
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
      const trailLength = r * 3 * trailLengthFactor * Math.min(1, speed / 150); // Longer trail
      let startX = x,
        startY = y;
      if (speed > 1) {
        startX = x - (vx / speed) * trailLength;
        startY = y - (vy / speed) * trailLength;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // Blend trail

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
          gradient.addColorStop(0.8, color); // Fade to full color near bullet
          gradient.addColorStop(1, color);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = r * 1.2; // Thicker trail
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();

           // Add subtle glow trail
           const glowGradient = ctx.createLinearGradient(startX, startY, x, y);
           glowGradient.addColorStop(0, bulletTrailGlow.replace("A", (trailBaseAlpha * 0.5).toFixed(2)));
           glowGradient.addColorStop(1, bulletTrailGlow.replace("A", "0"));
           ctx.strokeStyle = glowGradient;
           ctx.lineWidth = r * 2; // Wider glow trail
           ctx.stroke();


        } catch (e) {
           // Fallback trail
          ctx.strokeStyle = color;
          ctx.lineWidth = r * 0.8;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }

      // Draw Bullet Core
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // Restore globalCompositeOperation
      ctx.lineCap = "butt"; // Restore line cap
    }

     // --- REVISED drawShapedBullet (Enhanced Shape, Trail, Glow) ---
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
      const baseLength = 10, // Longer base
        baseWidth = 5; // Wider base
      const scaleFactor = r / 4;
      const shapeLength = baseLength * scaleFactor;
      const shapeWidth = baseWidth * scaleFactor;
      const trailLength =
        shapeLength * trailLengthFactor * Math.min(1, speed / 150); // Longer trail
      let startX = x,
        startY = y;
      if (speed > 1) {
        startX = x - (vx / speed) * trailLength;
        startY = y - (vy / speed) * trailLength;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // Blend trail/glow

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
            gradient.addColorStop(0.8, color);
            gradient.addColorStop(1, color);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = shapeWidth * 0.8; // Thicker trail
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Add subtle glow trail
            const glowGradient = ctx.createLinearGradient(startX, startY, x, y);
            glowGradient.addColorStop(0, bulletTrailGlow.replace("A", (trailBaseAlpha * 0.6).toFixed(2)));
            glowGradient.addColorStop(1, bulletTrailGlow.replace("A", "0"));
            ctx.strokeStyle = glowGradient;
            ctx.lineWidth = shapeWidth * 1.5; // Wider glow trail
            ctx.stroke();

         } catch(e) {
             // Fallback trail
             ctx.strokeStyle = color;
             ctx.lineWidth = shapeWidth * 0.6;
             ctx.beginPath();
             ctx.moveTo(startX, startY);
             ctx.lineTo(x, y);
             ctx.stroke();
         }
      }

      // Draw Bullet Shape (More streamlined)
      const angle = Math.atan2(vy, vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-shapeLength / 2, -shapeWidth / 2);
      ctx.lineTo(shapeLength / 2, 0); // Pointed front
      ctx.lineTo(-shapeLength / 2, shapeWidth / 2);
      ctx.quadraticCurveTo(-shapeLength / 2 + shapeLength * 0.2, 0, -shapeLength / 2, -shapeWidth / 2); // Rounded back
      ctx.closePath();
      ctx.fill();

      ctx.restore(); // Restore shape transform

      ctx.restore(); // Restore globalCompositeOperation
      ctx.lineCap = "butt"; // Restore line cap
    }


    function drawBullets(ctx, bullets) {
      if (!bullets) return;
      Object.values(bullets).forEach((b) => {
        if (!b) return;
        const bt = b.bullet_type || "standard";
        const hv = Math.abs(b.vx ?? 0) > 0.01 || Math.abs(b.vy ?? 0) > 0.01;
        if (bt === "ammo_heavy_slug") {
          // Heavy slug uses shaped bullet
          drawShapedBullet(ctx, b, 0.8, 0.9); // Longer, more opaque trail
        } else if (bt === "ammo_shotgun") {
          // Shotgun pellets are simple circles
          drawBulletCircle(ctx, b, 0.4, 0.6); // Shorter, less opaque trail
        } else if (
          bt === "ammo_rapid_fire"
        ) {
          // Rapid fire uses shaped bullet with prominent trail
           drawShapedBullet(ctx, b, 1.2, 0.7); // Long, bright trail
        }
         else if (bt === "standard" || bt === "standard_enemy")
        {
           // Standard bullets use shaped bullet
           drawShapedBullet(ctx, b, 1.0, 0.7); // Standard trail
        }
        else {
          // Default fallback to circle
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

    // --- NEW: Draw Heat Haze Effect (Performance Optimized - from Phase 1) ---
    function drawHeatHazeEffect(ctx, intensity, width, height, now) {
        if (intensity <= 0.01) return;

        const maxOffset = HEAT_HAZE_WAVE_OFFSET_MAX * intensity;
        const waveHeight = HEAT_HAZE_WAVE_HEIGHT_MAX * intensity;
        const baseAlpha = HEAT_HAZE_WAVE_ALPHA_BASE * intensity;
        const timeFactor = now * HEAT_HAZE_WAVE_SPEED_BASE;

        ctx.save();
        ctx.fillStyle = HEAT_HAZE_COLOR.replace("A", baseAlpha.toFixed(3));
        ctx.globalCompositeOperation = 'lighter'; // Optional: blend for glowing effect

        for (let i = 0; i < HEAT_HAZE_WAVE_COUNT; i++) {
            const offsetX = Math.sin(timeFactor * (1.0 + i * 0.1) + i * 0.5) * maxOffset * (0.5 + Math.random() * 0.5);
            const offsetY = Math.cos(timeFactor * (0.8 + i * 0.15) + i * 0.7) * maxOffset * 0.3 * (0.5 + Math.random() * 0.5);
            const waveY = height - waveHeight + (i / HEAT_HAZE_WAVE_COUNT) * waveHeight * 0.8;
            const waveWidth = width * (0.8 + Math.random() * 0.4); // Vary width slightly

            ctx.beginPath();
            // Simple wavy shape - adjust control points for desired wave
            const cp1x = offsetX + waveWidth * 0.2 + Math.sin(timeFactor * 1.2 + i * 0.3) * maxOffset * 0.5;
            const cp1y = waveY + waveHeight * 0.5 + Math.cos(timeFactor * 1.3 + i * 0.4) * maxOffset * 0.5;
            const cp2x = offsetX + waveWidth * 0.8 + Math.sin(timeFactor * 1.4 + i * 0.5) * maxOffset * 0.5;
            const cp2y = waveY + waveHeight * 0.5 + Math.cos(timeFactor * 1.5 + i * 0.6) * maxOffset * 0.5;

            ctx.moveTo(offsetX - waveWidth / 2, waveY + offsetY);
            ctx.bezierCurveTo(
                offsetX - waveWidth / 2 + cp1x, cp1y + offsetY,
                offsetX + waveWidth / 2 - cp2x, cp2y + offsetY,
                offsetX + waveWidth / 2, waveY + offsetY
            );
            ctx.lineTo(offsetX + waveWidth / 2, height);
            ctx.lineTo(offsetX - waveWidth / 2, height);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }


    // --- Main Render Function --- V7 --- Updated Signature ---
    function drawGame(
      ctx,
      appState,
      stateToRender,
      localPlayerMuzzleFlashRef,
      localPlayerPushbackAnimState,
      activeBloodSparkEffectsRef,
      activeSpeechBubbles,
      activeEnemyBubbles,
      snake,
      width,
      height
    ) {
      if (!mainCtx) mainCtx = ctx;
      if (!ctx || !appState) {
        console.error("drawGame missing context or appState!");
        return;
      }
      const now = performance.now();
      canvasWidth = typeof width === "number" && isFinite(width) ? width : 1600; // Use fallback
      canvasHeight =
        typeof height === "number" && isFinite(height) ? height : 900; // Use fallback
      if (!isFinite(canvasWidth) || !isFinite(canvasHeight)) {
        console.error("drawGame received invalid width/height:", width, height);
        return;
      }

      let shakeApplied = false,
        shakeOffsetX = 0,
        shakeOffsetY = 0;
      if (currentShakeMagnitude > 0 && now < shakeEndTime) {
        shakeApplied = true;
        const timeRemaining = shakeEndTime - now;
        const initialDuration = Math.max(1, shakeEndTime - (now - timeRemaining));
        let currentMag = currentShakeMagnitude * (timeRemaining / initialDuration);
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

      // Background
      ctx.globalAlpha = 1.0;
      if (!isBackgroundReady) {
        ctx.fillStyle = dayBaseColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        if (appState?.serverState && currentBackgroundIsNight === null) {
          updateGeneratedBackground(
            appState.serverState.is_night,
            canvasWidth,
            canvasHeight
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

      // Apply Shake Transform
      if (shakeApplied) {
        ctx.save();
        ctx.translate(shakeOffsetX, shakeOffsetY);
      }

      // Draw Game World Elements
      if (!stateToRender) {
        if (shakeApplied) ctx.restore();
        return;
      }

      drawCampfire(ctx, stateToRender.campfire, canvasWidth, canvasHeight);
      drawSnake(ctx, snake);
      drawPowerups(ctx, stateToRender.powerups);
      drawBullets(ctx, stateToRender.bullets);

      drawEnemies(
        ctx,
        stateToRender.enemies,
        activeEnemyBubbles,
        activeBloodSparkEffectsRef
      );

      drawPlayers(
        ctx,
        stateToRender.players,
        appState,
        localPlayerMuzzleFlashRef,
        localPlayerPushbackAnimState
      );

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

      // Restore Shake Transform
      if (shakeApplied) {
        ctx.restore();
      }

      // --- Draw Heat Haze (Performance Optimized) ---
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
        drawHeatHazeEffect(ctx, hazeIntensity, canvasWidth, canvasHeight, now);
      }
      // --- End Heat Haze ---


      // Draw Overlays (Rain, Dust, Tint, Vignette)
      ctx.globalAlpha = 1.0;
      if (appState?.isRaining) {
        const RAIN_SPEED_Y = 12;
        const RAIN_SPEED_X = 1;
        ctx.strokeStyle = RAIN_COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < RAIN_DROPS; i++) {
          const rainX = ((i * 137 + now * 0.05) % (canvasWidth + 100)) - 50;
          const rainY = (i * 271 + now * 0.3) % canvasHeight;
          const endX = rainX + RAIN_SPEED_X;
          const endY = rainY + RAIN_SPEED_Y;
          ctx.moveTo(rainX, rainY);
          ctx.lineTo(endX, endY);
        }
        ctx.stroke();
      } else if (appState?.isDustStorm) {
        ctx.fillStyle = "rgba(229, 169, 96, 0.2)";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      if (appState)
        drawTemperatureTint(ctx, appState.currentTemp, canvasWidth, canvasHeight);
      const localPlayerState = stateToRender.players?.[appState?.localPlayerId];
      if (
        localPlayerState &&
        localPlayerState.health < DAMAGE_VIGNETTE_HEALTH_THRESHOLD
      ) {
        const vi =
          1.0 - localPlayerState.health / DAMAGE_VIGNETTE_HEALTH_THRESHOLD;
        drawDamageVignette(ctx, vi, canvasWidth, canvasHeight);
      }

      ctx.globalAlpha = 1.0;
    } // --- End drawGame ---

    return { drawGame, triggerShake, updateGeneratedBackground };
  })(); // End Renderer module IIFE

  console.log(
    "--- Renderer.js: Executed. Renderer object defined?",
    typeof window.Renderer
  );
