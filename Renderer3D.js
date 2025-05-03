// Renderer3D.js
import * as THREE from 'three';
// #TODO: Import OrbitControls for debugging if needed: import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// #TODO: Import loaders (GLTFLoader) when using models
// #TODO: Import postprocessing modules (EffectComposer, passes) when adding effects

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing ---");

    // --- Core THREE.js Components ---
    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600; // Default, will be updated by appState
    let gameHeight = 900; // Default, will be updated by appState

    // --- Game Object Representations ---
    const playerMeshes = {};
    const enemyMeshes = {};
    const bulletMeshes = {};
    const powerupMeshes = {};
    let groundPlane = null;
    let muzzleFlashLight = null; // For muzzle flash effect
    // #TODO: Snake object/mesh
    // #TODO: Campfire object/mesh/particles

    // --- Effect State ---
    let screenShakeOffset = new THREE.Vector3(0, 0, 0);
    let shakeMagnitude = 0;
    let shakeEndTime = 0;

    // --- Internal Constants for Default Geometry ---
    // Define dimensions needed for creating base geometries locally
    const DEF_PLAYER_WIDTH = 25;
    const DEF_PLAYER_HEIGHT = 48;
    const DEF_ENEMY_WIDTH = 20;
    const DEF_ENEMY_HEIGHT = 40;
    const DEF_GIANT_MULTIPLIER = 2.5;
    const DEF_BULLET_RADIUS = 4;
    const DEF_POWERUP_SIZE = 20;

    // --- Materials ---
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.6, metalness: 0.2 });
    const enemyChaserMaterial = new THREE.MeshStandardMaterial({ color: 0x18315f, roughness: 0.7, metalness: 0.1 });
    const enemyShooterMaterial = new THREE.MeshStandardMaterial({ color: 0x556B2F, roughness: 0.7, metalness: 0.1 });
    const enemyGiantMaterial = new THREE.MeshStandardMaterial({ color: 0xa00000, roughness: 0.5, metalness: 0.3 });
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

    // --- Geometries (Created using local default constants) ---
    const playerGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8);
    const enemyChaserGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH, DEF_ENEMY_HEIGHT, DEF_ENEMY_WIDTH * 0.7);
    const enemyShooterGeometry = new THREE.CylinderGeometry(DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_HEIGHT, 8);
    const enemyGiantGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * DEF_GIANT_MULTIPLIER, DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER, DEF_ENEMY_WIDTH * 0.7 * DEF_GIANT_MULTIPLIER);
    const bulletGeometry = new THREE.SphereGeometry(DEF_BULLET_RADIUS, 6, 6);
    const powerupGeometry = new THREE.BoxGeometry(DEF_POWERUP_SIZE, DEF_POWERUP_SIZE, DEF_POWERUP_SIZE);

    // --- Mesh Positioning Offsets (Calculated from local constants) ---
    const PLAYER_MESH_Y_OFFSET = DEF_PLAYER_HEIGHT / 2;
    const ENEMY_MESH_Y_OFFSET = DEF_ENEMY_HEIGHT / 2;
    const GIANT_MESH_Y_OFFSET = (DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER) / 2;
    const BULLET_MESH_Y_OFFSET = DEF_BULLET_RADIUS;
    const POWERUP_MESH_Y_OFFSET = DEF_POWERUP_SIZE / 2 + 1;

    // --- Initialization ---
    function init(containerElement, initialWidth, initialHeight) {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }

        gameWidth = initialWidth || 1600; // Use passed initial dimensions
        gameHeight = initialHeight || 900;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(gameWidth, gameHeight);
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

        // Muzzle Flash Light (initially off)
        muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.5); // Color, Intensity (0), Distance, Decay
        muzzleFlashLight.castShadow = false; // Performance
        scene.add(muzzleFlashLight);

        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth * 1.5, gameHeight * 1.5);
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);

        window.addEventListener('resize', handleResize); // Changed name for clarity
        handleResize(); // Call once initially

        console.log("--- Renderer3D initialization complete ---");
        return true;
    }

    function handleResize() {
        // Use dimensions from appState (updated by server) or fall back
        const currentWidth = appState?.canvasWidth || gameWidth;
        const currentHeight = appState?.canvasHeight || gameHeight;

        // Update internal dimensions used for camera centering etc.
        gameWidth = currentWidth;
        gameHeight = currentHeight;

        renderer.setSize(currentWidth, currentHeight);

        const aspect = currentWidth / currentHeight;
        const frustumSize = currentHeight;
        camera.left = frustumSize * aspect / - 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / - 2;
        camera.position.set(currentWidth / 2, 1000, currentHeight / 2);
        camera.updateProjectionMatrix();

        console.log(`Renderer resized to: ${currentWidth}x${currentHeight}`);
    }

    // --- Entity Creation Functions ---
    function createPlayerMesh(playerData) {
        const mesh = new THREE.Mesh(playerGeometry, playerMaterial);
        mesh.castShadow = true;
        mesh.position.set(playerData.x, PLAYER_MESH_Y_OFFSET, playerData.y);
        mesh.userData.gameId = playerData.id;
        return mesh;
    }

    function createEnemyMesh(enemyData) {
        let mesh;
        let yOffset = ENEMY_MESH_Y_OFFSET; // Default
        if (enemyData.type === 'giant') {
            mesh = new THREE.Mesh(enemyGiantGeometry, enemyGiantMaterial.clone()); // Clone material
            yOffset = GIANT_MESH_Y_OFFSET;
        } else if (enemyData.type === 'shooter') {
            mesh = new THREE.Mesh(enemyShooterGeometry, enemyShooterMaterial.clone()); // Clone material
        } else {
            mesh = new THREE.Mesh(enemyChaserGeometry, enemyChaserMaterial.clone()); // Clone material
        }
        mesh.castShadow = true;
        mesh.position.set(enemyData.x, yOffset, enemyData.y);
        mesh.userData.gameId = enemyData.id;
        mesh.userData.type = enemyData.type; // Store type for updates
        mesh.material.transparent = true; // Allow opacity changes for fading
        mesh.material.opacity = 1.0;
        return mesh;
    }

    function createBulletMesh(bulletData) {
        const material = bulletData.owner_type === 'player' ? bulletPlayerMaterial : bulletEnemyMaterial;
        const mesh = new THREE.Mesh(bulletGeometry, material);
        mesh.position.set(bulletData.x, BULLET_MESH_Y_OFFSET, bulletData.y);
        mesh.userData.gameId = bulletData.id;
        return mesh;
    }

    function createPowerupMesh(powerupData) {
        const material = (powerupMaterials[powerupData.type] || powerupMaterials.default).clone(); // Clone
        const mesh = new THREE.Mesh(powerupGeometry, material);
        mesh.position.set(powerupData.x, POWERUP_MESH_Y_OFFSET, powerupData.y);
        mesh.castShadow = true;
        mesh.userData.gameId = powerupData.id;
        mesh.userData.isPowerup = true; // Flag for animation
        return mesh;
    }

    // --- Entity Update Logic with Disposal ---
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
                    const yPos = defaultYOffsetFn(data); // Calculate Y offset dynamically
                    mesh.position.set(data.x, yPos, data.y);

                    // Fading Out Dead Enemies
                    if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) {
                        const fadeDuration = 0.3;
                        const timeSinceDeath = (performance.now() / 1000) - data.death_timestamp;
                        const opacity = Math.max(0.01, 1.0 - (timeSinceDeath / fadeDuration)); // Fade but keep slightly visible
                        mesh.material.opacity = opacity;
                        mesh.visible = opacity > 0.01; // Hide when fully faded
                    } else if (mesh.material.opacity < 1.0) {
                        mesh.material.opacity = 1.0; // Reset if alive
                        mesh.visible = true;
                    }

                    // Powerup Rotation
                    if (mesh.userData.isPowerup) {
                        mesh.rotation.y += 0.01; mesh.rotation.x += 0.005;
                    }
                }
            }
        }

        // Remove Inactive Meshes & Dispose
        for (const id in meshDict) {
            if (!activeIds.has(id)) {
                const meshToRemove = meshDict[id];
                if (meshToRemove) {
                    scene.remove(meshToRemove);
                    if (meshToRemove.geometry) meshToRemove.geometry.dispose();
                    if (meshToRemove.material) {
                        if (Array.isArray(meshToRemove.material)) {
                            meshToRemove.material.forEach(m => m.dispose());
                        } else {
                            meshToRemove.material.dispose();
                        }
                    }
                }
                delete meshDict[id];
            }
        }
    }

    // Function to determine Y offset based on entity data
    function getYOffset(entityData) {
        if (entityData.type === 'giant') return GIANT_MESH_Y_OFFSET;
        // Add checks for other entity types if they have different base heights
        if (entityData.radius) return BULLET_MESH_Y_OFFSET; // Bullets use radius
        if (entityData.size) return POWERUP_MESH_Y_OFFSET; // Powerups use size
        if (entityData.height && entityData.width) { // Players/Enemies use height/width
             // Find matching default height if type not specific
             return (playerMeshes[entityData.id]) ? PLAYER_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET;
        }
        // Fallback
        return 5;
    }

    function updatePlayerAiming(appState) {
        if (!appState?.localPlayerId || !appState.localPlayerAimState) return;
        const playerMesh = playerMeshes[appState.localPlayerId];
        if (playerMesh) {
            const aimDx = appState.localPlayerAimState.lastAimDx;
            const aimDy = appState.localPlayerAimState.lastAimDy;
            const angle = Math.atan2(aimDx, aimDy); // Y rotation based on X, Z(gameY)
            playerMesh.rotation.y = angle;
        }
    }

    function updateEnvironment(isNight) {
        const dayLightIntensity = 1.0, nightLightIntensity = 0.3;
        const dayAmbientIntensity = 0.6, nightAmbientIntensity = 0.15;
        const dayDirColor = 0xffffff, nightDirColor = 0xaaaaff;
        const dayAmbColor = 0xffffff, nightAmbColor = 0x444488;

        // #TODO: Add lerping for smooth transitions
        ambientLight.intensity = isNight ? nightAmbientIntensity : dayAmbientIntensity;
        ambientLight.color.setHex(isNight ? nightAmbColor : dayAmbColor);
        directionalLight.intensity = isNight ? nightLightIntensity : dayLightIntensity;
        directionalLight.color.setHex(isNight ? nightDirColor : dayDirColor);
        groundPlane.material = isNight ? groundNightMaterial : groundDayMaterial;

        // #TODO: Fog update
    }

    // --- Update Muzzle Flash Effect ---
    function updateMuzzleFlash(appState, flashState) {
        if (!muzzleFlashLight || !appState?.localPlayerId) return;
        const playerMesh = playerMeshes[appState.localPlayerId];
        if (!playerMesh) return;

        const now = performance.now();
        if (flashState.active && now < flashState.endTime) {
            muzzleFlashLight.intensity = 3.0 + Math.random() * 2.0; // Flicker intensity
            // Position the light slightly in front of the player in the aim direction
            const offsetDistance = DEF_PLAYER_WIDTH * 0.8;
            const aimAngle = playerMesh.rotation.y; // Get current player aim angle
            muzzleFlashLight.position.set(
                playerMesh.position.x + Math.sin(aimAngle) * offsetDistance, // Use sin for X based on Y rot
                playerMesh.position.y + PLAYER_MESH_Y_OFFSET * 0.6, // Height near barrel
                playerMesh.position.z + Math.cos(aimAngle) * offsetDistance  // Use cos for Z based on Y rot
            );
        } else {
            muzzleFlashLight.intensity = 0; // Turn off
            if (flashState.active) flashState.active = false; // Deactivate state if ended
        }
    }

    // --- Main Render Function ---
    function renderScene(stateToRender, appState, localEffects) { // Pass local effects state
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) {
            return;
        }
        const now = performance.now();

        // Update Camera Shake
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

        // #TODO: Update Pushback Animation (e.g., slightly move player mesh backward/forward based on localEffects.pushbackAnim)
        // #TODO: Update Snake mesh
        // #TODO: Update Campfire visuals
        // #TODO: Update UI elements (Sprites/HTML)
        // #TODO: Update Particles (Hit Sparks, Casings, Rain, Dust)

        renderer.render(scene, camera);
        // #TODO: composer.render();
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
        window.removeEventListener('resize', handleResize);
        while(scene?.children.length > 0){ // Check if scene exists
            const child = scene.children[0];
            scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                 if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                 else child.material.dispose();
            }
        }
        // Dispose cached materials/geometries explicitly
        playerGeometry.dispose(); enemyChaserGeometry.dispose(); enemyShooterGeometry.dispose();
        enemyGiantGeometry.dispose(); bulletGeometry.dispose(); powerupGeometry.dispose();
        playerMaterial.dispose(); enemyChaserMaterial.dispose(); enemyShooterMaterial.dispose();
        enemyGiantMaterial.dispose(); bulletPlayerMaterial.dispose(); bulletEnemyMaterial.dispose();
        Object.values(powerupMaterials).forEach(m => m.dispose());
        groundDayMaterial.dispose(); groundNightMaterial.dispose();

        if (renderer) {
            renderer.dispose();
            if (renderer.domElement?.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
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

    return {
        init,
        renderScene,
        // updateSize is handled internally by handleResize now
        triggerShake,
        cleanup
    };

})();

export default Renderer3D;
