// Renderer3D.js
import * as THREE from 'three';
// #TODO: Import necessary addons later (e.g., OrbitControls for debugging, GLTFLoader, EffectComposer, ShaderPass, etc.)
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing ---");

    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600; // Default, will be updated
    let gameHeight = 900; // Default, will be updated

    // Dictionaries to hold game object representations
    const playerMeshes = {};
    const enemyMeshes = {};
    const bulletMeshes = {};
    const powerupMeshes = {};
    let groundPlane = null;
    let snakeObject = null; // #TODO: Representation for the snake
    let campfireObject = null; // #TODO: Representation for the campfire

    // Effect related state
    let screenShakeOffset = new THREE.Vector3(0, 0, 0); // Applied to camera position
    let shakeMagnitude = 0;
    let shakeEndTime = 0;

    // Cache frequently used materials/geometries if needed
    // #TODO: Define materials based on constants
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C }); // Example Crimson
    const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x18315f }); // Example Uniform Blue
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x8FBC8F, side: THREE.DoubleSide }); // Example Day Green

    // Constants for game dimensions (match backend if possible)
    const PLAYER_MESH_HEIGHT = 4.8; // Scaled based on dimensions
    const ENEMY_MESH_HEIGHT = 4.0;

    function init(containerElement) {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) {
            console.error("Renderer3D init failed: No container element provided.");
            return false;
        }

        // --- Renderer Setup ---
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        // Size will be set initially based on defaults or appState if available
        renderer.setSize(gameWidth, gameHeight);
        renderer.shadowMap.enabled = true; // Enable shadows
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
        containerElement.appendChild(renderer.domElement);
        console.log("Renderer created and appended.");

        // --- Scene Setup ---
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x333333); // Dark grey background fallback

        // --- Camera Setup (Orthographic for Top-Down) ---
        const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight; // Use height as the base size
        camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, // left
            frustumSize * aspect / 2,  // right
            frustumSize / 2,           // top
            frustumSize / -2,          // bottom
            1,                         // near
            2000                       // far - increased to see ground from high up
        );
        // Position camera high above the center, looking straight down
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2); // Positioned above center of game world
        camera.rotation.x = -Math.PI / 2; // Look straight down (negative 90 degrees)
        camera.updateProjectionMatrix();
        scene.add(camera);
        console.log("Orthographic Camera created.");

        // --- Lighting Setup ---
        ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
        scene.add(ambientLight);

        directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(150, 300, 200); // Position light source
        directionalLight.castShadow = true;
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048; // Higher resolution for better shadows
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 50;
        directionalLight.shadow.camera.far = 700;
        // Adjust shadow camera bounds to cover the play area
        directionalLight.shadow.camera.left = -gameWidth / 1.5;
        directionalLight.shadow.camera.right = gameWidth / 1.5;
        directionalLight.shadow.camera.top = gameHeight / 1.5;
        directionalLight.shadow.camera.bottom = -gameHeight / 1.5;

        scene.add(directionalLight);
        scene.add(directionalLight.target); // Target defaults to 0,0,0 which is fine for now
        console.log("Lighting setup complete.");

        // --- Ground Plane Setup ---
        const groundGeometry = new THREE.PlaneGeometry(gameWidth * 1.5, gameHeight * 1.5); // Make slightly larger than viewport
        groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        groundPlane.rotation.x = -Math.PI / 2; // Rotate plane to be horizontal
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2); // Center the plane
        groundPlane.receiveShadow = true; // Allow ground to receive shadows
        scene.add(groundPlane);
        console.log("Ground plane created.");

        // #TODO: Initialize post-processing effects (EffectComposer) here if needed

        // Add resize listener
        window.addEventListener('resize', updateSize);
        updateSize(); // Call once initially

        console.log("--- Renderer3D initialization complete ---");
        return true; // Indicate success
    }

    function updateSize() {
        // Use appState dimensions if available, otherwise defaults
        const currentWidth = window.innerWidth; // Or get from a specific container
        const currentHeight = window.innerHeight; // Or get from a specific container

        // Calculate the best fit dimensions maintaining aspect ratio
        const targetAspect = gameWidth / gameHeight;
        let newCanvasWidth = currentWidth;
        let newCanvasHeight = currentWidth / targetAspect;

        if (newCanvasHeight > currentHeight) {
            newCanvasHeight = currentHeight;
            newCanvasWidth = currentHeight * targetAspect;
        }

        // Update renderer size
        renderer.setSize(newCanvasWidth, newCanvasHeight);

        // Update camera aspect ratio and projection matrix for Orthographic
        const aspect = newCanvasWidth / newCanvasHeight;
        const frustumSize = gameHeight; // Keep frustum height constant
        camera.left = frustumSize * aspect / - 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / - 2;
        camera.updateProjectionMatrix();

        // Center the camera view over the game world origin
        // This might need adjustment based on how you handle world coordinates vs view
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);

        console.log(`Renderer resized to: ${newCanvasWidth}x${newCanvasHeight}`);
    }

    // --- Entity Creation Placeholders ---
    function createPlayerMesh(playerData) {
        // #TODO: Replace with actual model loading later (GLTFLoader)
        const geometry = new THREE.CapsuleGeometry(playerData.width / 2, playerData.height - playerData.width, 4, 8);
        // Use unique material per player? Or tint base material? Start simple.
        const material = playerMaterial.clone(); // Clone to allow potential unique changes later
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.position.set(playerData.x, PLAYER_MESH_HEIGHT / 2, playerData.y); // Y is up in THREE.js
        mesh.userData.gameId = playerData.id; // Store game ID
        return mesh;
    }

    function createEnemyMesh(enemyData) {
        // #TODO: Replace with actual model loading later
        // #TODO: Different geometry/material based on enemyData.type (chaser, shooter, giant)
        const geometry = new THREE.BoxGeometry(enemyData.width, ENEMY_MESH_HEIGHT, enemyData.width * 0.7); // Example box
        const material = enemyMaterial.clone();
        if (enemyData.type === 'giant') { // Example: Giant variation
            geometry.scale(2.5, 2.5, 2.5); // Scale up geometry for giant
            material.color.set(0xa00000); // Red color for giant
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.position.set(enemyData.x, ENEMY_MESH_HEIGHT / 2, enemyData.y); // Y is up
        mesh.userData.gameId = enemyData.id;
        return mesh;
    }

    function createBulletMesh(bulletData) {
        // #TODO: Customize based on bulletData.bullet_type
        const geometry = new THREE.SphereGeometry(bulletData.radius, 8, 8);
        const material = new THREE.MeshBasicMaterial({ // Basic material, doesn't need light
            color: bulletData.owner_type === 'player' ? 0xffed4a : 0xff0000
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(bulletData.x, bulletData.radius, bulletData.y); // Position slightly above ground
        mesh.userData.gameId = bulletData.id;
        // Bullets typically don't cast shadows for performance
        return mesh;
    }

    function createPowerupMesh(powerupData) {
        // #TODO: Different geometry/texture/color based on powerupData.type
        const geometry = new THREE.BoxGeometry(powerupData.size, powerupData.size, powerupData.size);
        const material = new THREE.MeshStandardMaterial({ color: 0x888888 }); // Default grey
        // Example type handling:
        if (powerupData.type === 'health') material.color.set(0x81c784);
        else if (powerupData.type === 'ammo_shotgun') material.color.set(0xFFA500);
        // ... add other types
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(powerupData.x, powerupData.size / 2 + 1, powerupData.y); // Slightly above ground
        mesh.castShadow = true;
        mesh.userData.gameId = powerupData.id;
        return mesh;
    }

    // --- Entity Update Logic ---
    function updateMeshes(state, meshDict, createFn, defaultHeight) {
        const activeIds = new Set();
        if (state) {
            for (const id in state) {
                const data = state[id];
                activeIds.add(id);
                let mesh = meshDict[id];
                if (!mesh) {
                    // Create mesh if it doesn't exist
                    mesh = createFn(data);
                    meshDict[id] = mesh;
                    scene.add(mesh);
                } else {
                    // Update existing mesh position (and potentially rotation, scale, etc.)
                    const yPos = mesh.geometry.parameters.height ? mesh.geometry.parameters.height / 2 : defaultHeight / 2;
                    mesh.position.set(data.x, yPos + (data.zOffset || 0), data.y); // Use Z for game Y
                    // #TODO: Add rotation updates (e.g., player aiming)
                    // #TODO: Update visibility/material based on state (e.g., fading out dead enemies)
                }
            }
        }
        // Remove meshes for entities no longer in the state
        for (const id in meshDict) {
            if (!activeIds.has(id)) {
                const meshToRemove = meshDict[id];
                scene.remove(meshToRemove);
                // #TODO: Dispose geometry and material to free memory
                // meshToRemove.geometry.dispose();
                // meshToRemove.material.dispose();
                delete meshDict[id];
            }
        }
    }

    function updatePlayerAiming(appState) {
        if (!appState || !appState.localPlayerId || !appState.localPlayerAimState) return;
        const playerMesh = playerMeshes[appState.localPlayerId];
        if (playerMesh) {
            const aimDx = appState.localPlayerAimState.lastAimDx;
            const aimDy = appState.localPlayerAimState.lastAimDy;
            // Calculate angle based on aim vector (assuming Z is forward)
            const angle = Math.atan2(aimDx, aimDy); // atan2(x, z) for Y-axis rotation
            playerMesh.rotation.y = angle;
        }
    }


    // --- Main Render Function ---
    function renderScene(stateToRender, appState) {
        if (!renderer || !scene || !camera || !stateToRender || !appState) {
            // console.warn("renderScene called before initialization or with missing state.");
            return;
        }

        const now = performance.now();

        // --- Update Camera (Screen Shake) ---
        if (shakeMagnitude > 0 && now < shakeEndTime) {
             const timeRemaining = shakeEndTime - now;
             // Use a simple linear decay for now
             const currentMag = shakeMagnitude * Math.max(0, timeRemaining / (shakeEndTime - (now - timeRemaining))); // Approx initial duration needed
             const shakeAngle = Math.random() * Math.PI * 2;
             screenShakeOffset.x = Math.cos(shakeAngle) * currentMag;
             screenShakeOffset.z = Math.sin(shakeAngle) * currentMag; // Shake on XZ plane
        } else {
             shakeMagnitude = 0;
             screenShakeOffset.set(0, 0, 0);
        }
        // Apply shake relative to the base camera position
        camera.position.set(
            gameWidth / 2 + screenShakeOffset.x,
            1000, // Keep Y position constant
            gameHeight / 2 + screenShakeOffset.z
        );
        camera.updateMatrixWorld(); // Update camera matrices after position change

        // --- Update Lighting (Day/Night) ---
        // #TODO: Smoothly transition light colors/intensities based on stateToRender.is_night
        const isNight = stateToRender.is_night;
        ambientLight.intensity = isNight ? 0.2 : 0.6;
        directionalLight.intensity = isNight ? 0.4 : 1.0;
        // #TODO: Change light colors for night (e.g., bluish ambient, pale moon directional)
        // #TODO: Optionally move directional light position for 'moon' effect

        // --- Update Ground ---
        // #TODO: Update ground texture/material based on is_night
        // Example: groundMaterial.map = isNight ? nightTexture : dayTexture; groundMaterial.needsUpdate = true;

        // --- Sync Game Objects with Meshes ---
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, PLAYER_MESH_HEIGHT);
        updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, ENEMY_MESH_HEIGHT);
        updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, 1); // Default height guess for bullets
        updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, 10); // Default height guess

        // Update player aiming based on client-side input state
        updatePlayerAiming(appState);

        // #TODO: Update Snake object/mesh based on snake data in main.js
        // #TODO: Update Campfire object/mesh/particles based on stateToRender.campfire

        // #TODO: Update UI elements (Sprites or HTML overlays)
        // - Health bars, damage text, speech bubbles

        // #TODO: Update Particles (muzzle flash, hit sparks, casings, rain, dust)

        // --- Render the Scene ---
        renderer.render(scene, camera);

        // #TODO: Render post-processing effects using EffectComposer if implemented
        // composer.render();
    }

    // --- Effect Triggers ---
    function triggerShake(magnitude, durationMs) {
        const now = performance.now();
        const newEndTime = now + durationMs;
        // Combine shakes: Use max magnitude and longest duration
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(magnitude, shakeMagnitude);
            shakeEndTime = Math.max(newEndTime, shakeEndTime);
            // console.log(`Triggering shake: Mag=${shakeMagnitude.toFixed(1)}, EndTime=${shakeEndTime.toFixed(0)}`);
        }
    }

    // #TODO: Add functions to trigger other effects (muzzle flash, particles)


    // --- Cleanup ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup ---");
        window.removeEventListener('resize', updateSize);
        // #TODO: Dispose all geometries, materials, textures
        // #TODO: Remove all objects from the scene explicitly
        // #TODO: Stop any ongoing animations or effect updates
        if (renderer) {
            renderer.dispose();
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer = null;
        }
        scene = null;
        camera = null;
        // Clear mesh dictionaries
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]);
        Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]);
        Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]);
        Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);

        console.log("Renderer3D resources released.");
    }


    // --- Exported Module ---
    return {
        init,
        renderScene,
        updateSize, // Expose if main.js needs to trigger resize manually
        triggerShake,
        cleanup
        // #TODO: Export functions for triggering other effects as needed
    };

})();

// Make it available globally or ensure main.js imports it correctly
// Example for global exposure (if not using modules strictly):
// window.Renderer3D = Renderer3D;

export default Renderer3D; // Use export default if main.js imports it as a module
