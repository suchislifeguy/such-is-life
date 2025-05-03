// Renderer3D.js
import * as THREE from 'three';
// #TODO: Import necessary addons later (e.g., OrbitControls for debugging, GLTFLoader, EffectComposer, ShaderPass, etc.)

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing ---");

    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600;
    let gameHeight = 900;

    // Dictionaries to hold game object representations
    const playerMeshes = {};
    const enemyMeshes = {};
    const bulletMeshes = {};
    const powerupMeshes = {};
    let groundPlane = null;
    // #TODO: Representation for the snake
    // #TODO: Representation for the campfire

    // Effect related state
    let screenShakeOffset = new THREE.Vector3(0, 0, 0);
    let shakeMagnitude = 0;
    let shakeEndTime = 0;

    // --- Materials (Define upfront) ---
    // Using MeshStandardMaterial for PBR properties (reacts to light)
    const playerMaterial = new THREE.MeshStandardMaterial({
        color: 0xDC143C, // Crimson Red
        roughness: 0.6,
        metalness: 0.2,
    });
    const enemyChaserMaterial = new THREE.MeshStandardMaterial({
        color: 0x18315f, // Uniform Blue
        roughness: 0.7,
        metalness: 0.1,
    });
    const enemyShooterMaterial = new THREE.MeshStandardMaterial({
        color: 0x556B2F, // Dark Olive Green (Example)
        roughness: 0.7,
        metalness: 0.1,
    });
    const enemyGiantMaterial = new THREE.MeshStandardMaterial({
        color: 0xa00000, // Dark Red
        roughness: 0.5,
        metalness: 0.3,
    });
    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a }); // Yellow - Basic for visibility
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red - Basic for visibility
    const powerupMaterials = { // Cache materials by type
        default: new THREE.MeshStandardMaterial({ color: 0x888888 }),
        health: new THREE.MeshStandardMaterial({ color: 0x81c784 }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x442848 }),
        speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3 }),
        armor: new THREE.MeshStandardMaterial({ color: 0x9e9e9e }),
        ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500 }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D }),
        ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00 }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700 }),
    };
    const groundDayMaterial = new THREE.MeshStandardMaterial({ color: 0x8FBC8F, roughness: 0.8, metalness: 0.1 });
    const groundNightMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8, metalness: 0.1 });

    // --- Geometries (Define common ones upfront) ---
    // Adjust segments for performance vs quality tradeoff
    const playerGeometry = new THREE.CapsuleGeometry(PLAYER_DEFAULTS.width / 2, PLAYER_DEFAULTS.height - PLAYER_DEFAULTS.width, 4, 8);
    const enemyChaserGeometry = new THREE.BoxGeometry(ENEMY_DEFAULTS.width, ENEMY_DEFAULTS.height, ENEMY_DEFAULTS.width * 0.7);
    const enemyShooterGeometry = new THREE.CylinderGeometry(ENEMY_DEFAULTS.width*0.6, ENEMY_DEFAULTS.width*0.6, ENEMY_DEFAULTS.height, 8); // Example different shape
    const enemyGiantGeometry = new THREE.BoxGeometry(ENEMY_DEFAULTS.width * 2.5, ENEMY_DEFAULTS.height * 2.5, ENEMY_DEFAULTS.width * 0.7 * 2.5); // Scaled box
    const bulletGeometry = new THREE.SphereGeometry(BULLET_DEFAULTS.radius, 6, 6); // Low poly sphere
    const powerupGeometry = new THREE.BoxGeometry(POWERUP_DEFAULTS.size, POWERUP_DEFAULTS.size, POWERUP_DEFAULTS.size);


    // Constants for mesh positioning
    const PLAYER_MESH_Y_OFFSET = PLAYER_DEFAULTS.height / 2;
    const ENEMY_MESH_Y_OFFSET = ENEMY_DEFAULTS.height / 2;
    const GIANT_MESH_Y_OFFSET = ENEMY_DEFAULTS.height * 2.5 / 2; // Adjust for giant size
    const BULLET_MESH_Y_OFFSET = BULLET_DEFAULTS.radius;
    const POWERUP_MESH_Y_OFFSET = POWERUP_DEFAULTS.size / 2 + 1; // Slightly above ground


    function init(containerElement) {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(gameWidth, gameHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerElement.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a2a28); // Use dark background

        const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 2000);
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        camera.rotation.x = -Math.PI / 2;
        scene.add(camera); // Add camera to scene BEFORE adding lights if lights target camera

        ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(150, 300, 200);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 50;
        directionalLight.shadow.camera.far = 700;
        directionalLight.shadow.camera.left = -gameWidth / 1.5;
        directionalLight.shadow.camera.right = gameWidth / 1.5;
        directionalLight.shadow.camera.top = gameHeight / 1.5;
        directionalLight.shadow.camera.bottom = -gameHeight / 1.5;
        scene.add(directionalLight);
        // No need to add target if it stays at 0,0,0 unless you move it

        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth * 1.5, gameHeight * 1.5);
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial); // Start with day material
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);

        window.addEventListener('resize', updateSize);
        updateSize();

        console.log("--- Renderer3D initialization complete ---");
        return true;
    }

    function updateSize() {
        // Use dimensions from appState which should be updated by server messages
        const currentWidth = appState.canvasWidth || gameWidth;
        const currentHeight = appState.canvasHeight || gameHeight;

        renderer.setSize(currentWidth, currentHeight);

        const aspect = currentWidth / currentHeight;
        const frustumSize = currentHeight; // Base frustum on height
        camera.left = frustumSize * aspect / - 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / - 2;
        camera.position.set(currentWidth / 2, 1000, currentHeight / 2); // Center camera view
        camera.updateProjectionMatrix();

        console.log(`Renderer resized logic ran. Target: ${currentWidth}x${currentHeight}`);
    }

    // --- Fleshed Out Creation Functions ---
    function createPlayerMesh(playerData) {
        // Using predefined geometry and material
        const mesh = new THREE.Mesh(playerGeometry, playerMaterial);
        mesh.castShadow = true;
        mesh.position.set(playerData.x, PLAYER_MESH_Y_OFFSET, playerData.y); // Y is up
        mesh.userData.gameId = playerData.id;
        // #TODO: Could clone material here if needing unique player colors later
        return mesh;
    }

    function createEnemyMesh(enemyData) {
        let mesh;
        if (enemyData.type === 'giant') {
            mesh = new THREE.Mesh(enemyGiantGeometry, enemyGiantMaterial);
            mesh.position.set(enemyData.x, GIANT_MESH_Y_OFFSET, playerData.y); // Use specific offset
        } else if (enemyData.type === 'shooter') {
            mesh = new THREE.Mesh(enemyShooterGeometry, enemyShooterMaterial);
            mesh.position.set(enemyData.x, ENEMY_MESH_Y_OFFSET, enemyData.y);
        } else { // Default chaser
            mesh = new THREE.Mesh(enemyChaserGeometry, enemyChaserMaterial);
            mesh.position.set(enemyData.x, ENEMY_MESH_Y_OFFSET, enemyData.y);
        }
        mesh.castShadow = true;
        mesh.userData.gameId = enemyData.id;
        return mesh;
    }

    function createBulletMesh(bulletData) {
        const material = bulletData.owner_type === 'player' ? bulletPlayerMaterial : bulletEnemyMaterial;
        const mesh = new THREE.Mesh(bulletGeometry, material);
        mesh.position.set(bulletData.x, BULLET_MESH_Y_OFFSET, bulletData.y);
        mesh.userData.gameId = bulletData.id;
        // Bullets generally don't cast shadows
        return mesh;
    }

    function createPowerupMesh(powerupData) {
        const material = powerupMaterials[powerupData.type] || powerupMaterials.default;
        const mesh = new THREE.Mesh(powerupGeometry, material);
        mesh.position.set(powerupData.x, POWERUP_MESH_Y_OFFSET, powerupData.y);
        mesh.castShadow = true;
        mesh.userData.gameId = powerupData.id;
        // Add rotation animation in render loop if desired
        mesh.userData.isPowerup = true; // Flag for animation
        return mesh;
    }

    // --- Entity Update Logic with Disposal ---
    function updateMeshes(state, meshDict, createFn, defaultYOffset) {
        const activeIds = new Set();

        // Add/Update Meshes
        if (state) {
            for (const id in state) {
                const data = state[id];
                // Simple check to skip potentially invalid data early
                if (typeof data.x !== 'number' || typeof data.y !== 'number') continue;

                activeIds.add(id);
                let mesh = meshDict[id];

                if (!mesh) { // Create
                    mesh = createFn(data); // Use the appropriate creation function
                    if (mesh) { // Ensure mesh was created successfully
                        meshDict[id] = mesh;
                        scene.add(mesh);
                    }
                } else { // Update
                    let yPos = defaultYOffset;
                    // Determine correct Y offset based on type/size if needed
                    if (mesh.userData.isPowerup) yPos = POWERUP_MESH_Y_OFFSET;
                    else if (data.type === 'giant') yPos = GIANT_MESH_Y_OFFSET; // Example specific check
                    else if(mesh.geometry.parameters.height) yPos = mesh.geometry.parameters.height / 2; // Capsule/Box etc.
                    else if(mesh.geometry.parameters.radius) yPos = mesh.geometry.parameters.radius; // Sphere

                    mesh.position.set(data.x, yPos, data.y); // Game Y is scene Z

                     // --- Fading Out Dead Enemies ---
                     if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) {
                        const fadeDuration = 0.3; // seconds
                        const timeSinceDeath = (performance.now() / 1000) - data.death_timestamp;
                        const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration));

                        if (opacity <= 0.01) {
                            // Mark for removal below instead of making invisible
                        } else {
                            mesh.material.opacity = opacity;
                            mesh.material.transparent = true; // Enable transparency
                        }
                    } else if (mesh.material.transparent) {
                        // Reset opacity if enemy somehow revived or state is wrong
                        mesh.material.opacity = 1.0;
                        mesh.material.transparent = false;
                    }
                     // --- End Fading ---

                    // Powerup Rotation Example
                    if (mesh.userData.isPowerup) {
                        mesh.rotation.y += 0.01; // Simple rotation
                        mesh.rotation.x += 0.005;
                    }
                }
            }
        }

        // Remove Meshes for inactive entities
        for (const id in meshDict) {
            if (!activeIds.has(id)) {
                const meshToRemove = meshDict[id];
                if (meshToRemove) {
                    scene.remove(meshToRemove);
                    // --- Dispose Resources ---
                    if (meshToRemove.geometry) {
                        meshToRemove.geometry.dispose();
                    }
                    if (meshToRemove.material) {
                        // If materials are shared/cloned, disposal needs care.
                        // If cloned per mesh, safe to dispose. If shared, don't.
                        // Assuming materials are cloned or unique for now:
                        if (Array.isArray(meshToRemove.material)) {
                            meshToRemove.material.forEach(m => m.dispose());
                        } else {
                            meshToRemove.material.dispose();
                        }
                    }
                    // --- End Disposal ---
                }
                delete meshDict[id];
            }
        }
    }

    function updatePlayerAiming(appState) {
        if (!appState || !appState.localPlayerId || !appState.localPlayerAimState) return;
        const playerMesh = playerMeshes[appState.localPlayerId];
        if (playerMesh) {
            const aimDx = appState.localPlayerAimState.lastAimDx;
            const aimDy = appState.localPlayerAimState.lastAimDy; // This is game Y, which maps to scene Z
            const angle = Math.atan2(aimDx, aimDy); // atan2(X, Z) for Y rotation
            playerMesh.rotation.y = angle;
        }
    }

    // --- Day/Night Visual Update ---
    function updateEnvironment(isNight) {
        const dayLightIntensity = 1.0;
        const nightLightIntensity = 0.4;
        const dayAmbientIntensity = 0.6;
        const nightAmbientIntensity = 0.2;
        const dayDirColor = 0xffffff;
        const nightDirColor = 0xaaaaff; // Bluish moon
        const dayAmbColor = 0xffffff;
        const nightAmbColor = 0x444488; // Dark blue ambient

        // Smooth transitions could be added later using a lerp factor
        ambientLight.intensity = isNight ? nightAmbientIntensity : dayAmbientIntensity;
        ambientLight.color.setHex(isNight ? nightAmbColor : dayAmbColor);

        directionalLight.intensity = isNight ? nightLightIntensity : dayLightIntensity;
        directionalLight.color.setHex(isNight ? nightDirColor : dayDirColor);

        // Update ground material
        groundPlane.material = isNight ? groundNightMaterial : groundDayMaterial;

        // #TODO: Update scene.fog
        // Example:
        // if (isNight) {
        //     scene.fog = new THREE.FogExp2(0x050a15, 0.0015);
        // } else {
        //     scene.fog = null; // Or a lighter day fog
        // }
    }


    // --- Main Render Function ---
    function renderScene(stateToRender, appState) {
        if (!renderer || !scene || !camera || !stateToRender || !appState) {
            return;
        }
        const now = performance.now();

        // --- Update Camera Shake ---
        if (shakeMagnitude > 0 && now < shakeEndTime) {
             const timeRemaining = shakeEndTime - now;
             const initialDuration = shakeEndTime - (now - timeRemaining); // Estimate duration
             const currentMag = shakeMagnitude * Math.max(0, timeRemaining / (initialDuration || 1));
             const shakeAngle = Math.random() * Math.PI * 2;
             screenShakeOffset.x = Math.cos(shakeAngle) * currentMag;
             screenShakeOffset.z = Math.sin(shakeAngle) * currentMag;
        } else {
             shakeMagnitude = 0;
             screenShakeOffset.set(0, 0, 0);
        }
        // Apply shake relative to the *current* center (in case canvas size changed)
        camera.position.set(
            appState.canvasWidth / 2 + screenShakeOffset.x,
            1000,
            appState.canvasHeight / 2 + screenShakeOffset.z
        );
        // No need to call updateMatrixWorld manually, render does it.

        // --- Update Environment Visuals (Day/Night) ---
        updateEnvironment(stateToRender.is_night);

        // --- Sync Game Objects with Meshes ---
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, PLAYER_MESH_Y_OFFSET);
        updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, ENEMY_MESH_Y_OFFSET); // Uses specific offsets inside create/update now
        updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, BULLET_MESH_Y_OFFSET);
        updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, POWERUP_MESH_Y_OFFSET);

        // Update local player aiming rotation
        updatePlayerAiming(appState);

        // #TODO: Update Snake object/mesh
        // #TODO: Update Campfire object/mesh/particles

        // #TODO: Update UI elements (Health bars, damage text, speech bubbles via Sprites or HTML)

        // --- Update Particles & Effects ---
        // #TODO: Muzzle Flash (e.g., toggle a PointLight visibility/intensity based on localPlayerMuzzleFlash)
        // #TODO: Hit Sparks (e.g., manage a THREE.Points system based on activeBloodSparkEffects)
        // #TODO: Ammo Casings (Create/update THREE.InstancedMesh or individual meshes based on activeAmmoCasings)
        // #TODO: Rain/Dust (Manage THREE.Points particle systems)

        // --- Render ---
        renderer.render(scene, camera);
        // #TODO: composer.render(); // If using post-processing
    }

    function triggerShake(magnitude, durationMs) {
        const now = performance.now();
        const newEndTime = now + durationMs;
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(magnitude, shakeMagnitude);
            shakeEndTime = Math.max(newEndTime, shakeEndTime);
        }
    }

    function cleanup() {
        console.log("--- Renderer3D Cleanup ---");
        window.removeEventListener('resize', updateSize);

        // Remove all objects from the scene
        while(scene.children.length > 0){
            const child = scene.children[0];
            scene.remove(child);
            // Attempt to dispose geometry/material if applicable
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                 if (Array.isArray(child.material)) {
                     child.material.forEach(m => m.dispose());
                 } else {
                     child.material.dispose();
                 }
            }
            // #TODO: Dispose textures if loaded
        }

        // Dispose renderer
        if (renderer) {
            renderer.dispose();
            if (renderer.domElement?.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer = null;
        }
        scene = null; camera = null; groundPlane = null;
        ambientLight = null; directionalLight = null;

        // Clear mesh dictionaries (references are gone, objects disposed above)
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]);
        Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]);
        Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]);
        Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);

        console.log("Renderer3D resources released.");
    }

    return {
        init,
        renderScene,
        updateSize,
        triggerShake,
        cleanup
    };

})();

export default Renderer3D;
