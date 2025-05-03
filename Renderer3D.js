// Renderer3D.js
import * as THREE from 'three';
// #TODO: Import OrbitControls for debugging if needed: import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// #TODO: Import loaders (GLTFLoader) when using models
// #TODO: Import postprocessing modules (EffectComposer, passes) when adding effects

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing ---");

    // --- Core THREE.js Components ---
    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600; // Default, will be updated
    let gameHeight = 900; // Default, will be updated

    // --- Game Object Representations ---
    const playerMeshes = {};
    const enemyMeshes = {};
    const bulletMeshes = {};
    const powerupMeshes = {};
    let groundPlane = null;
    let muzzleFlashLight = null;
    // #TODO: Snake object/mesh
    // #TODO: Campfire object/mesh/particles

    // --- Effect State ---
    let screenShakeOffset = new THREE.Vector3(0, 0, 0);
    let shakeMagnitude = 0;
    let shakeEndTime = 0;

    // --- Internal Constants ---
    const DEF_PLAYER_WIDTH = 25; const DEF_PLAYER_HEIGHT = 48;
    const DEF_ENEMY_WIDTH = 20; const DEF_ENEMY_HEIGHT = 40;
    const DEF_GIANT_MULTIPLIER = 2.5; const DEF_BULLET_RADIUS = 4;
    const DEF_POWERUP_SIZE = 20;

    // --- Materials ---
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.6, metalness: 0.2 });
    const enemyChaserMaterial = new THREE.MeshStandardMaterial({ color: 0x18315f, roughness: 0.7, metalness: 0.1, transparent: true }); // Enable transparency for fade
    const enemyShooterMaterial = new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness: 0.7, metalness: 0.1, transparent: true });
    const enemyGiantMaterial = new THREE.MeshStandardMaterial({ color: 0xa00000, roughness: 0.5, metalness: 0.3, transparent: true });
    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a });
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const powerupMaterials = {
        default: new THREE.MeshStandardMaterial({ color: 0x888888 }), health: new THREE.MeshStandardMaterial({ color: 0x81c784 }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x442848 }), speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3 }),
        armor: new THREE.MeshStandardMaterial({ color: 0x9e9e9e }), ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500 }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D }), ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00 }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700 }),
    };
    const groundDayMaterial = new THREE.MeshStandardMaterial({ color: 0x8FBC8F, roughness: 0.8, metalness: 0.1 });
    const groundNightMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8, metalness: 0.1 });

    // --- Geometries ---
    const playerGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8);
    const enemyChaserGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH, DEF_ENEMY_HEIGHT, DEF_ENEMY_WIDTH * 0.7);
    const enemyShooterGeometry = new THREE.CylinderGeometry(DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_HEIGHT, 8);
    const enemyGiantGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * DEF_GIANT_MULTIPLIER, DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER, DEF_ENEMY_WIDTH * 0.7 * DEF_GIANT_MULTIPLIER);
    const bulletGeometry = new THREE.SphereGeometry(DEF_BULLET_RADIUS, 6, 6);
    const powerupGeometry = new THREE.BoxGeometry(DEF_POWERUP_SIZE, DEF_POWERUP_SIZE, DEF_POWERUP_SIZE);

    // --- Mesh Positioning Offsets ---
    const PLAYER_MESH_Y_OFFSET = DEF_PLAYER_HEIGHT / 2;
    const ENEMY_MESH_Y_OFFSET = DEF_ENEMY_HEIGHT / 2;
    const GIANT_MESH_Y_OFFSET = (DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER) / 2;
    const BULLET_MESH_Y_OFFSET = DEF_BULLET_RADIUS;
    const POWERUP_MESH_Y_OFFSET = DEF_POWERUP_SIZE / 2 + 1;

    // --- Initialization ---
    function init(containerElement) { // Removed width/height params, reads from internal gameWidth/Height
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(gameWidth, gameHeight); // Use initial defaults
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerElement.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a2a28);

        const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 2000);
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        camera.rotation.x = -Math.PI / 2;
        scene.add(camera);

        ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(150, 300, 200);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 50; directionalLight.shadow.camera.far = 700;
        directionalLight.shadow.camera.left = -gameWidth / 1.5; directionalLight.shadow.camera.right = gameWidth / 1.5;
        directionalLight.shadow.camera.top = gameHeight / 1.5; directionalLight.shadow.camera.bottom = -gameHeight / 1.5;
        scene.add(directionalLight);

        muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.5);
        muzzleFlashLight.castShadow = false;
        scene.add(muzzleFlashLight);

        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth * 1.5, gameHeight * 1.5);
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);

        window.addEventListener('resize', handleResize);
        // Don't call handleResize() here, wait for first renderScene to get dimensions from appState

        console.log("--- Renderer3D initialization complete ---");
        return true;
    }

    // --- Resize Handler ---
    function handleResize() {
        // Uses module-level gameWidth/Height which are updated in renderScene
        renderer.setSize(gameWidth, gameHeight);
        const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight;
        camera.left = frustumSize * aspect / - 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / - 2;
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2); // Re-center camera based on new dimensions
        camera.updateProjectionMatrix();
        console.log(`Renderer resized to: ${gameWidth}x${gameHeight}`);
    }

    // --- Entity Creation --- (Mostly unchanged, ensure cloning)
    function createPlayerMesh(playerData) {
        const mesh = new THREE.Mesh(playerGeometry, playerMaterial.clone()); // Clone material for safety
        mesh.castShadow = true;
        mesh.position.set(playerData.x, PLAYER_MESH_Y_OFFSET, playerData.y);
        mesh.userData.gameId = playerData.id;
        return mesh;
    }
    function createEnemyMesh(enemyData) {
        let mesh; let yOffset = ENEMY_MESH_Y_OFFSET; let mat;
        if (enemyData.type === 'giant') { mat = enemyGiantMaterial.clone(); mesh = new THREE.Mesh(enemyGiantGeometry, mat); yOffset = GIANT_MESH_Y_OFFSET; }
        else if (enemyData.type === 'shooter') { mat = enemyShooterMaterial.clone(); mesh = new THREE.Mesh(enemyShooterGeometry, mat); }
        else { mat = enemyChaserMaterial.clone(); mesh = new THREE.Mesh(enemyChaserGeometry, mat); }
        mesh.castShadow = true; mesh.position.set(enemyData.x, yOffset, enemyData.y);
        mesh.userData.gameId = enemyData.id; mesh.userData.type = enemyData.type;
        mat.opacity = 1.0; // Ensure opacity starts at 1
        return mesh;
    }
    function createBulletMesh(bulletData) { /* ... unchanged ... */
        const material = bulletData.owner_type === 'player' ? bulletPlayerMaterial : bulletEnemyMaterial;
        const mesh = new THREE.Mesh(bulletGeometry, material);
        mesh.position.set(bulletData.x, BULLET_MESH_Y_OFFSET, bulletData.y);
        mesh.userData.gameId = bulletData.id;
        return mesh;
     }
    function createPowerupMesh(powerupData) { /* ... unchanged ... */
        const material = (powerupMaterials[powerupData.type] || powerupMaterials.default).clone();
        const mesh = new THREE.Mesh(powerupGeometry, material);
        mesh.position.set(powerupData.x, POWERUP_MESH_Y_OFFSET, powerupData.y);
        mesh.castShadow = true;
        mesh.userData.gameId = powerupData.id;
        mesh.userData.isPowerup = true;
        return mesh;
     }

    // --- Entity Update & Disposal ---
    function updateMeshes(state, meshDict, createFn, defaultYOffsetFn) {
        const activeIds = new Set();
        if (state) {
            for (const id in state) {
                const data = state[id];
                if (typeof data.x !== 'number' || typeof data.y !== 'number') continue;
                activeIds.add(id);
                let mesh = meshDict[id];
                if (!mesh) {
                    mesh = createFn(data);
                    if (mesh) { meshDict[id] = mesh; scene.add(mesh); }
                } else {
                    const yPos = defaultYOffsetFn(data);
                    mesh.position.set(data.x, yPos, data.y);

                    if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) {
                        const fadeDuration = 0.3;
                        const timeSinceDeath = (performance.now() / 1000) - data.death_timestamp;
                        const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration)); // Fade to 0
                        mesh.material.opacity = opacity;
                        mesh.visible = opacity > 0.001; // Hide when practically invisible
                    } else if (!mesh.visible || mesh.material.opacity < 1.0) { // Reset if needed
                        mesh.material.opacity = 1.0;
                        mesh.visible = true;
                    }
                    if (mesh.userData.isPowerup) { mesh.rotation.y += 0.01; mesh.rotation.x += 0.005; }
                }
            }
        }
        // Remove & Dispose
        for (const id in meshDict) {
            if (!activeIds.has(id)) {
                const meshToRemove = meshDict[id];
                if (meshToRemove) {
                    scene.remove(meshToRemove);
                    if (meshToRemove.geometry) meshToRemove.geometry.dispose();
                    if (meshToRemove.material) {
                        if (Array.isArray(meshToRemove.material)) meshToRemove.material.forEach(m => m.dispose());
                        else meshToRemove.material.dispose();
                    }
                }
                delete meshDict[id];
            }
        }
    }
    function getYOffset(entityData) { /* ... unchanged ... */
        if (entityData.type === 'giant') return GIANT_MESH_Y_OFFSET;
        if (entityData.radius) return BULLET_MESH_Y_OFFSET;
        if (entityData.size) return POWERUP_MESH_Y_OFFSET;
        if (entityData.height && entityData.width) {
             const player = playerMeshes[entityData.id]; // Check if it's a player
             return player ? PLAYER_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET;
        }
        return 5; // Fallback
    }
    function updatePlayerAiming(appState) { /* ... unchanged ... */
        if (!appState?.localPlayerId || !appState.localPlayerAimState) return;
        const playerMesh = playerMeshes[appState.localPlayerId];
        if (playerMesh) {
            const aimDx = appState.localPlayerAimState.lastAimDx;
            const aimDy = appState.localPlayerAimState.lastAimDy;
            const angle = Math.atan2(aimDx, aimDy);
            playerMesh.rotation.y = angle;
        }
     }

    // --- Environment Update ---
    function updateEnvironment(isNight) { /* ... unchanged ... */
        const dayLightIntensity = 1.0, nightLightIntensity = 0.3;
        const dayAmbientIntensity = 0.6, nightAmbientIntensity = 0.15;
        const dayDirColor = 0xffffff, nightDirColor = 0xaaaaff;
        const dayAmbColor = 0xffffff, nightAmbColor = 0x444488;
        ambientLight.intensity = isNight ? nightAmbientIntensity : dayAmbientIntensity;
        ambientLight.color.setHex(isNight ? nightAmbColor : dayAmbColor);
        directionalLight.intensity = isNight ? nightLightIntensity : dayLightIntensity;
        directionalLight.color.setHex(isNight ? nightDirColor : dayDirColor);
        groundPlane.material = isNight ? groundNightMaterial : groundDayMaterial;
     }

    // --- Muzzle Flash Update ---
    function updateMuzzleFlash(appState, flashState) { /* ... unchanged ... */
        if (!muzzleFlashLight || !appState?.localPlayerId) return;
        const playerMesh = playerMeshes[appState.localPlayerId];
        if (!playerMesh) return;
        const now = performance.now();
        if (flashState.active && now < flashState.endTime) {
            muzzleFlashLight.intensity = 3.0 + Math.random() * 2.0;
            const offsetDistance = DEF_PLAYER_WIDTH * 0.8;
            const aimAngle = playerMesh.rotation.y;
            muzzleFlashLight.position.set(
                playerMesh.position.x + Math.sin(aimAngle) * offsetDistance,
                playerMesh.position.y + PLAYER_MESH_Y_OFFSET * 0.6,
                playerMesh.position.z + Math.cos(aimAngle) * offsetDistance
            );
        } else {
            muzzleFlashLight.intensity = 0;
            if (flashState.active) flashState.active = false;
        }
    }

    // --- Function to get screen coordinates for HTML overlays ---
    function getScreenPosition(worldPosition, camera, renderer) {
        const vector = worldPosition.clone();
        vector.project(camera); // Project 3D point to normalized device coordinates (-1 to +1)

        // Convert normalized device coordinates to screen coordinates
        const screenX = Math.round((vector.x + 1) * renderer.domElement.width / 2);
        const screenY = Math.round((-vector.y + 1) * renderer.domElement.height / 2);

        return { x: screenX, y: screenY };
    }

    // --- Main Render Function ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) return;

        // --- Update Internal Dimensions & Check Resize ---
        let dimensionsChanged = false;
        if (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight) {
            gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight;
            dimensionsChanged = true;
            console.log(`Renderer internal dimensions updated to: ${gameWidth}x${gameHeight}`);
        }
        if (dimensionsChanged) handleResize(); // Update renderer & camera if needed
        // --- End Dimension Update ---

        const now = performance.now();

        // --- Update Camera Shake ---
        if (shakeMagnitude > 0 && now < shakeEndTime) {
             const timeRemaining = shakeEndTime - now;
             const initialDurationEst = Math.max(1, shakeEndTime - (now - timeRemaining));
             const currentMag = shakeMagnitude * Math.max(0, timeRemaining / initialDurationEst);
             const shakeAngle = Math.random() * Math.PI * 2;
             screenShakeOffset.x = Math.cos(shakeAngle) * currentMag;
             screenShakeOffset.z = Math.sin(shakeAngle) * currentMag;
        } else {
             shakeMagnitude = 0; screenShakeOffset.set(0, 0, 0);
        }
        camera.position.set( gameWidth / 2 + screenShakeOffset.x, 1000, gameHeight / 2 + screenShakeOffset.z );

        // Update Environment (Day/Night)
        updateEnvironment(stateToRender.is_night);

        // Sync Game Objects with Meshes
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, (d) => PLAYER_MESH_Y_OFFSET);
        updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, (d) => d.type === 'giant' ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET);
        updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, (d) => BULLET_MESH_Y_OFFSET);
        updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, (d) => POWERUP_MESH_Y_OFFSET);

        // Update local player aiming rotation
        updatePlayerAiming(appState);

        // Update Muzzle Flash based on local state passed from main.js
        updateMuzzleFlash(appState, localEffects.muzzleFlash);

        // #TODO: Update Pushback Animation visual cue on the player mesh
        // #TODO: Update Snake mesh visual based on 'snake' object in main.js
        // #TODO: Update Campfire visuals

        // --- UI Element Positioning (Example: Prepare data for main.js) ---
        // The actual DOM manipulation will happen in main.js, but we calculate positions here.
        const uiElementPositions = {};
        // Example for players (health bars, speech bubbles)
        for (const id in playerMeshes) {
            const mesh = playerMeshes[id];
            if (mesh && stateToRender.players[id]) { // Check if player still exists in state
                 const worldPos = mesh.position.clone();
                 worldPos.y += PLAYER_MESH_Y_OFFSET * 1.1; // Position slightly above head
                 const screenPos = getScreenPosition(worldPos, camera, renderer);
                 uiElementPositions[id] = { screenX: screenPos.x, screenY: screenPos.y, type: 'player' };
             }
        }
        // Example for enemies
        for (const id in enemyMeshes) {
             const mesh = enemyMeshes[id];
             if (mesh && stateToRender.enemies[id] && mesh.visible) { // Check if enemy exists and is visible
                 const worldPos = mesh.position.clone();
                 const yOffset = (mesh.userData.type === 'giant') ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET;
                 worldPos.y += yOffset * 1.1; // Position slightly above head
                 const screenPos = getScreenPosition(worldPos, camera, renderer);
                 uiElementPositions[id] = { screenX: screenPos.x, screenY: screenPos.y, type: 'enemy' };
             }
        }
        // Store calculated positions for main.js to use
        // This prevents main.js needing direct access to THREE objects
        appState.uiPositions = uiElementPositions;
        // --- End UI Positioning Data Prep ---


        // #TODO: Update Particles (Hit Sparks, Casings, Rain, Dust)

        // --- Render ---
        renderer.render(scene, camera);
    }

    // --- Effect Triggers ---
    function triggerShake(magnitude, durationMs) { /* ... unchanged ... */
        const now = performance.now();
        const newEndTime = now + durationMs;
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(magnitude, shakeMagnitude);
            shakeEndTime = Math.max(newEndTime, shakeEndTime);
        }
     }

    // --- Cleanup ---
    function cleanup() { /* ... unchanged ... */
        console.log("--- Renderer3D Cleanup ---");
        window.removeEventListener('resize', handleResize);
        while(scene?.children.length > 0){
            const child = scene.children[0];
            scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                 if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                 else child.material.dispose();
            }
        }
        playerGeometry.dispose(); enemyChaserGeometry.dispose(); enemyShooterGeometry.dispose();
        enemyGiantGeometry.dispose(); bulletGeometry.dispose(); powerupGeometry.dispose();
        Object.values(powerupMaterials).forEach(m => m.dispose()); // Dispose cached powerup mats
        playerMaterial.dispose(); enemyChaserMaterial.dispose(); enemyShooterMaterial.dispose(); // Dispose base enemy mats
        enemyGiantMaterial.dispose(); bulletPlayerMaterial.dispose(); bulletEnemyMaterial.dispose();
        groundDayMaterial.dispose(); groundNightMaterial.dispose();

        if (renderer) {
            renderer.dispose();
            if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            renderer = null;
        }
        scene = null; camera = null; groundPlane = null;
        ambientLight = null; directionalLight = null; muzzleFlashLight = null;
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]);
        Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]);
        Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]);
        Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);
        console.log("Renderer3D resources released.");
     }

    // --- Export ---
    return {
        init,
        renderScene,
        // handleResize is internal now
        triggerShake,
        cleanup
    };

})();

export default Renderer3D;
