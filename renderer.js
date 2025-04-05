function generateBackground(ctx, targetIsNight, width, height) {
    console.log(`[Renderer] generateBackground v2 called. TargetNight: ${targetIsNight}`);
    ctx.clearRect(0, 0, width, height); // Start fresh

    if (!targetIsNight) {
        // --- Day View (Looking Down - Enhanced Ground) ---
        const dayBaseColor = "#6B8E23"; // Olive green base
        const dirtColor1 = "rgba(139, 69, 19, 0.25)"; // Sienna brown patch (slightly less transparent)
        const dirtColor2 = "rgba(160, 82, 45, 0.18)"; // Lighter sienna (slightly less transparent)
        const grassHighlight = "rgba(173, 255, 47, 0.06)"; // Fainter green-yellow highlights
        const numPatches = 70; // Adjusted count
        const numHighlights = 120; // Adjusted count

        // Base ground color
        ctx.fillStyle = dayBaseColor;
        ctx.fillRect(0, 0, width, height);

        // Dirt Patches (Large, soft ellipses)
        for (let i = 0; i < numPatches; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radiusX = Math.random() * 90 + 45; // Slightly wider range
            const radiusY = Math.random() * 70 + 35; // Slightly wider range
            const color = Math.random() < 0.5 ? dirtColor1 : dirtColor2;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(x, y, radiusX, radiusY, Math.random() * Math.PI, 0, Math.PI * 2); // Random rotation added
            ctx.fill();
        }

        // Grass Highlights (Subtle texture - small arcs)
        ctx.lineWidth = 1; // Thin lines
        for (let i = 0; i < numHighlights; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const length = Math.random() * 5 + 3; // Short blades
            const angle = Math.random() * Math.PI * 2;

            ctx.strokeStyle = grassHighlight; // Use strokeStyle for lines
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
            ctx.stroke();
        }

    } else {
        // --- Night View (Looking Up - Galactic Sky) ---
        const baseNightColor = "#04060C"; // Even darker base
        const nebulaeColors = [
            // Format: [red, green, blue, baseAlpha] - safer than string manipulation
            [148, 0, 211, 0.07], // Dark Violet
            [75, 0, 130, 0.09],  // Indigo
            [0, 100, 180, 0.06], // Deeper Sky Blue
            [200, 20, 100, 0.05]  // Muted Pink
        ];
        const numNebulae = 12; // Slightly more nebulae
        const numDustStars = 1800;
        const numMidStars = 450;
        const numHeroStars = 60;

        // 1. Base Sky Color
        ctx.fillStyle = baseNightColor;
        ctx.fillRect(0, 0, width, height);

        // 2. Nebulae / Gas Clouds (Soft Gradients)
        for (let i = 0; i < numNebulae; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * (width * 0.35) + (width * 0.1); // Slightly larger max size
            const colorData = nebulaeColors[Math.floor(Math.random() * nebulaeColors.length)];
            const [r, g, b, baseAlpha] = colorData;

            try {
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                // Define colors with specific alpha values directly
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${Math.min(0.15, baseAlpha * 1.5).toFixed(2)})`); // Brighter core
                gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${baseAlpha.toFixed(2)})`);           // Main color
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);                                   // Fade to transparent

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            } catch (e) { console.error("Failed to create nebula gradient:", e); }
        }

        // --- Star Fields ---
        // Helper function to draw stars using fillRect for performance
        const drawStars = (count, minSize, maxSize, minAlpha, maxAlpha, colorVariance = 0) => {
            for (let i = 0; i < count; i++) {
                const sx = Math.random() * width;
                const sy = Math.random() * height;
                const size = Math.random() * (maxSize - minSize) + minSize;
                const alpha = Math.random() * (maxAlpha - minAlpha) + minAlpha;

                let r = 255, g = 255, b = 255; // Default white
                if (colorVariance > 0 && Math.random() < 0.35) { // Slightly higher chance for color
                    // Skew towards blue/yellow subtly
                    const variance = Math.random() * colorVariance;
                    if (Math.random() < 0.5) { // Yellow shift
                        b -= variance;
                    } else { // Blue shift
                        r -= variance * 0.7; // Less reduction in red for blue shift
                        g -= variance * 0.7;
                    }
                    r = Math.max(0, Math.min(255, r));
                    g = Math.max(0, Math.min(255, g));
                    b = Math.max(0, Math.min(255, b));
                }

                // Optimized: Set fillStyle only once per star if possible, constructing the rgba string
                ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(2)})`;
                ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
            }
        };

        // 3. Distant Dust Layer (Faint, numerous)
        drawStars(numDustStars, 0.4, 0.9, 0.08, 0.35); // Fainter alpha range

        // 4. Mid Stars Layer (Brighter, less numerous)
        drawStars(numMidStars, 0.7, 1.6, 0.25, 0.75, 35); // Added color variance

        // 5. Hero Stars Layer (Brightest, sparsest, most color)
        drawStars(numHeroStars, 1.4, 2.6, 0.55, 1.0, 65); // More color variance

    } // End Night View

    // Store the state on the canvas element itself for the transition logic
    ctx.canvas.dataset.isNight = String(targetIsNight);
    console.log(`[Renderer] generateBackground v2 finished. Stored isNight: ${ctx.canvas.dataset.isNight}`);
    return targetIsNight; // Return the state we just generated
}
