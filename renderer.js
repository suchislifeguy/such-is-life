function generateBackground(ctx, targetIsNight, width, height) {
    console.log(`[Renderer] generateBackground REVISED called. TargetNight: ${targetIsNight}`);
    ctx.clearRect(0, 0, width, height); // Start fresh

    if (!targetIsNight) {
        // --- Day View (Looking Down - Enhanced Ground) ---
        const dayBaseColor = "#6B8E23"; // More olive green base
        const dirtColor1 = "rgba(139, 69, 19, 0.3)"; // Sienna brown patch
        const dirtColor2 = "rgba(160, 82, 45, 0.2)"; // Lighter sienna
        const grassHighlight = "rgba(173, 255, 47, 0.08)"; // Faint green-yellow highlights
        const numPatches = 80; // Fewer, larger patches
        const numHighlights = 150;

        // Base ground color
        ctx.fillStyle = dayBaseColor;
        ctx.fillRect(0, 0, width, height);

        // Add subtle texture variation with noise (optional, can be slow)
        /*
        // Example using simple random noise - replace with better noise if needed
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const randomFactor = (Math.random() - 0.5) * 15; // Subtle variation
            data[i] = Math.max(0, Math.min(255, data[i] + randomFactor));     // Red
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + randomFactor)); // Green
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + randomFactor)); // Blue
        }
        ctx.putImageData(imageData, 0, 0);
        */

        // Dirt Patches (Larger, softer)
        for (let i = 0; i < numPatches; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radiusX = Math.random() * 80 + 40; // Larger radius
            const radiusY = Math.random() * 60 + 30;
            const color = Math.random() < 0.5 ? dirtColor1 : dirtColor2;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(x, y, radiusX, radiusY, Math.random() * Math.PI * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Grass Highlights (Subtle texture)
        for (let i = 0; i < numHighlights; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * 10 + 5;
            ctx.fillStyle = grassHighlight;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Could add very subtle edge darkening/vignette here if desired later

    } else {
        // --- Night View (Looking Up - Galactic Sky) ---
        const baseNightColor = "#050810"; // Very dark blue/black
        const nebulaeColors = [
            "rgba(148, 0, 211, 0.06)", // Dark Violet
            "rgba(75, 0, 130, 0.08)",  // Indigo
            "rgba(0, 191, 255, 0.05)", // Deep Sky Blue
            "rgba(255, 20, 147, 0.04)"  // Deep Pink
        ];
        const numNebulae = 10;
        const numDustStars = 1500;
        const numMidStars = 400;
        const numHeroStars = 50;

        // 1. Base Sky Color
        ctx.fillStyle = baseNightColor;
        ctx.fillRect(0, 0, width, height);

        // 2. Nebulae / Gas Clouds (Soft Gradients)
        for (let i = 0; i < numNebulae; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * (width * 0.3) + (width * 0.1); // Large radius
            const color = nebulaeColors[Math.floor(Math.random() * nebulaeColors.length)];

            try {
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, color.replace(/[\d\.]+\)$/g, '0.1)')); // Slightly brighter core
                gradient.addColorStop(0.4, color); // Main color
                gradient.addColorStop(1, color.replace(/[\d\.]+\)$/g, '0)')); // Fade to transparent

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            } catch (e) { console.error("Failed to create nebula gradient:", e); }
        }

        // --- Star Fields ---
        // Function to draw a star batch
        const drawStars = (count, minSize, maxSize, minAlpha, maxAlpha, colorVariance = 0) => {
            ctx.fillStyle = `rgba(255, 255, 255, ${maxAlpha})`; // Default white base
            for (let i = 0; i < count; i++) {
                const sx = Math.random() * width;
                const sy = Math.random() * height;
                const size = Math.random() * (maxSize - minSize) + minSize;
                const alpha = Math.random() * (maxAlpha - minAlpha) + minAlpha;

                let starColor = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
                if (colorVariance > 0 && Math.random() < 0.3) { // Add slight color to some stars
                    const r = 255 - Math.random() * colorVariance;
                    const g = 255 - Math.random() * colorVariance;
                    const b = 255; // Keep blue high for cool tint
                    starColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(2)})`;
                }
                ctx.fillStyle = starColor;

                // Use simple rects for performance, circles are slightly slower in large numbers
                ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
            }
        };

        // 3. Distant Dust Layer
        drawStars(numDustStars, 0.5, 1.0, 0.1, 0.4);

        // 4. Mid Stars Layer
        drawStars(numMidStars, 0.8, 1.8, 0.3, 0.8, 30); // Add slight color variance (shift towards blue/yellow)

        // 5. Hero Stars Layer (Slightly larger, brighter, more color)
        drawStars(numHeroStars, 1.5, 2.8, 0.6, 1.0, 60); // More color variance

        // // Optional: Add subtle glow to hero stars (can impact performance)
        // ctx.shadowBlur = 5;
        // ctx.shadowColor = "rgba(200, 200, 255, 0.5)";
        // drawStars(numHeroStars, 1.5, 2.8, 0.6, 1.0, 60); // Draw again with shadow
        // ctx.shadowBlur = 0; // Reset shadow

    }

    // Store the state on the canvas element itself for the transition logic
    ctx.canvas.dataset.isNight = String(targetIsNight);
    console.log(`[Renderer] generateBackground REVISED finished. Stored isNight: ${ctx.canvas.dataset.isNight}`);
    return targetIsNight; // Return the state we just generated
}
