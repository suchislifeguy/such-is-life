// Renderer3D.js
import * as THREE from 'three';
// Potential future imports:
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing Final ---");

    // --- Core THREE.js Components ---
    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600, gameHeight = 900;

    // --- Game Object Representations ---
    const playerMeshes = {}; const enemyMeshes = {};
    const bulletMeshes = {}; const powerupMeshes = {};
    let groundPlane = null; let muzzleFlashLight = null;
    let campfireGroup = null; let snakeMesh = null;

    // --- Effects Objects ---
    let screenShakeOffset = new THREE.Vector3(0, 0, 0);
    let shakeMagnitude = 0; let shakeEndTime = 0;

    // Particles & Instancing
    let hitSparkParticles = null; let hitSparkGeometry = null;
    let rainParticles = null; let rainGeometry = null;
    let dustParticles = null; let dustGeometry = null;
    let ammoCasingMesh = null; // InstancedMesh

    const MAX_SPARKS = 100; const MAX_RAIN_DROPS = 500; const MAX_DUST_MOTES = 300;
    const MAX_CASINGS = 100;

    // --- Internal Constants ---
    const DEF_PLAYER_WIDTH = 25; const DEF_PLAYER_HEIGHT = 48;
    const DEF_ENEMY_WIDTH = 20; const DEF_ENEMY_HEIGHT = 40;
    const DEF_GIANT_MULTIPLIER = 2.5; const DEF_BULLET_RADIUS = 4;
    const DEF_POWERUP_SIZE = 20; const DEF_SNAKE_SEGMENTS = 50; // Visual segments
    const DEF_SNAKE_RADIUS = 3;

    // --- Materials ---
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.6, metalness: 0.2 });
    const enemySharedMaterialProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    const enemyChaserMaterial = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemySharedMaterialProps });
    const enemyShooterMaterial = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemySharedMaterialProps });
    const enemyGiantMaterial = new THREE.MeshStandardMaterial({ color: 0xa00000, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 1.0 });
    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a });
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const powerupMaterials = { /* ...as before... */
        default: new THREE.MeshStandardMaterial({ color: 0x888888 }), health: new THREE.MeshStandardMaterial({ color: 0x81c784 }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x442848 }), speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3 }),
        armor: new THREE.MeshStandardMaterial({ color: 0x9e9e9e }), ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500 }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D }), ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00 }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700 }),
    };
    const groundDayMaterial = new THREE.MeshStandardMaterial({ color: 0x8FBC8F, roughness: 0.8, metalness: 0.1 });
    const groundNightMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8, metalness: 0.1 });
    const snakeMaterial = new THREE.MeshStandardMaterial({ color: 0x261a0d, roughness: 0.4, metalness: 0.2 });
    const logMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
    // Particle Materials
    const sparkMaterial = new THREE.PointsMaterial({ size: 8, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const rainMaterial = new THREE.PointsMaterial({ size: 10, color: 0xaabbff, transparent: true, opacity: 0.6, sizeAttenuation: true, depthWrite: false });
    const dustMaterial = new THREE.PointsMaterial({ size: 40, color: 0xe5a960, transparent: true, opacity: 0.15, sizeAttenuation: true, depthWrite: false });
    const casingMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6 }); // Brass


    // --- Geometries ---
    const playerGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8);
    const enemyChaserGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH, DEF_ENEMY_HEIGHT, DEF_ENEMY_WIDTH * 0.7);
    const enemyShooterGeometry = new THREE.CylinderGeometry(DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_HEIGHT, 8);
    const enemyGiantGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * DEF_GIANT_MULTIPLIER, DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER, DEF_ENEMY_WIDTH * 0.7 * DEF_GIANT_MULTIPLIER);
    const bulletGeometry = new THREE.SphereGeometry(DEF_BULLET_RADIUS, 6, 6);
    const powerupGeometry = new THREE.BoxGeometry(DEF_POWERUP_SIZE, DEF_POWERUP_SIZE, DEF_POWERUP_SIZE);
    const logGeometry = new THREE.CylinderGeometry(4, 4, 35, 6);
    const casingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 6); // Simple casing shape


    // --- Mesh Positioning Offsets ---
    const PLAYER_MESH_Y_OFFSET = DEF_PLAYER_HEIGHT / 2;
    const ENEMY_MESH_Y_OFFSET = DEF_ENEMY_HEIGHT / 2;
    const GIANT_MESH_Y_OFFSET = (DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER) / 2;
    const BULLET_MESH_Y_OFFSET = DEF_BULLET_RADIUS;
    const POWERUP_MESH_Y_OFFSET = DEF_POWERUP_SIZE / 2 + 1;
    const CAMPFIRE_LOG_Y_OFFSET = 4;
    const FLAME_PARTICLE_Y_OFFSET = 6;

    // --- Particle Data Storage ---
    const sparkData = []; // { position: Vector3, velocity: Vector3, color: Color, alpha: float, life: float }
    const rainData = []; // { position: Vector3, velocity: Vector3 }
    const dustData = []; // { position: Vector3, velocity: Vector3, rotation: float }

    // --- Initialization ---
    function init(containerElement) {
        console.log("--- Renderer3D.init() Final ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }

        // --- Basic Setup ---
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

        // --- Lighting ---
        ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
        directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(150, 300, 200); directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 50; directionalLight.shadow.camera.far = 700;
        directionalLight.shadow.camera.left = -gameWidth * 1.2; directionalLight.shadow.camera.right = gameWidth * 1.2; // Expand shadow area slightly
        directionalLight.shadow.camera.top = gameHeight * 1.2; directionalLight.shadow.camera.bottom = -gameHeight * 1.2;
        scene.add(directionalLight);

        // --- Muzzle Flash ---
        muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.5); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);

        // --- Ground ---
        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth * 1.5, gameHeight * 1.5);
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial);
        groundPlane.rotation.x = -Math.PI / 2; groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
        groundPlane.receiveShadow = true; scene.add(groundPlane);

        // --- Initialize Particle Systems ---
        initSparkParticles();
        initWeatherParticles();

        // --- Initialize Instanced Mesh for Casings ---
        initAmmoCasings();

        // --- Initialize Placeholder Objects ---
        initCampfire();
        initSnake();

        window.addEventListener('resize', handleResize);

        console.log("--- Renderer3D initialization complete ---");
        return true;
    }

    function initSparkParticles() {
        hitSparkGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(MAX_SPARKS * 3);
        const colors = new Float32Array(MAX_SPARKS * 3);
        const alphas = new Float32Array(MAX_SPARKS); // Store alpha per particle

        for(let i = 0; i < MAX_SPARKS; i++) {
            sparkData.push({
                 position: new THREE.Vector3(0,-1000,0), // Start inactive below ground
                 velocity: new THREE.Vector3(),
                 color: new THREE.Color(0xff0000),
                 alpha: 0.0, life: 0
             });
             alphas[i] = 0.0; // Init alpha attribute
        }

        hitSparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        hitSparkGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        hitSparkGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1)); // Custom attribute for alpha

        hitSparkParticles = new THREE.Points(hitSparkGeometry, sparkMaterial);
        hitSparkParticles.visible = false; // Start hidden
        scene.add(hitSparkParticles);
    }

    function initWeatherParticles() {
        // Rain
        rainGeometry = new THREE.BufferGeometry();
        const rainPositions = new Float32Array(MAX_RAIN_DROPS * 3);
        for (let i = 0; i < MAX_RAIN_DROPS; i++) {
             rainData.push({
                 position: new THREE.Vector3(Math.random()*gameWidth, Math.random()*gameHeight*1.5 + gameHeight*0.5 , Math.random()*gameHeight), // Start above view
                 velocity: new THREE.Vector3(10 + Math.random()*5, -300 - Math.random()*100, 0) // Downward angled slightly
             });
             rainPositions[i*3] = rainData[i].position.x;
             rainPositions[i*3+1] = rainData[i].position.y; // THREE.js Y is height
             rainPositions[i*3+2] = rainData[i].position.z; // Game Y is scene Z
        }
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        rainParticles = new THREE.Points(rainGeometry, rainMaterial);
        rainParticles.visible = false;
        scene.add(rainParticles);

        // Dust (Similar setup, different velocities/material)
        dustGeometry = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(MAX_DUST_MOTES * 3);
        for (let i = 0; i < MAX_DUST_MOTES; i++) {
            dustData.push({
                position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, Math.random()*50 + 5 , Math.random()*gameHeight*1.2-gameHeight*0.1), // Near ground, wider area
                velocity: new THREE.Vector3((Math.random()-0.5)*50, Math.random()*5, (Math.random()-0.5)*50), // Swirling
                rotation: Math.random() * Math.PI * 2
            });
            // Initialize positions (Z is game Y)
             dustPositions[i * 3] = dustData[i].position.x;
             dustPositions[i * 3 + 1] = dustData[i].position.y; // Height
             dustPositions[i * 3 + 2] = dustData[i].position.z;
        }
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        dustParticles.visible = false;
        scene.add(dustParticles);
    }

    function initAmmoCasings() {
        // Use a simple cylinder for casings
        ammoCasingMesh = new THREE.InstancedMesh(casingGeometry, casingMaterial, MAX_CASINGS);
        ammoCasingMesh.castShadow = true; // Optional, can impact performance
        scene.add(ammoCasingMesh);
    }

    function initCampfire() {
        campfireGroup = new THREE.Group();
        // Create logs
        const log1 = new THREE.Mesh(logGeometry, logMaterial);
        log1.rotation.z = Math.PI / 6; log1.rotation.y = Math.PI / 10; log1.castShadow = true;
        const log2 = new THREE.Mesh(logGeometry, logMaterial);
        log2.rotation.z = -Math.PI / 5; log2.rotation.y = -Math.PI / 8; log2.castShadow = true;
        campfireGroup.add(log1); campfireGroup.add(log2);

        // Add point light for glow
        const glowLight = new THREE.PointLight(0xffa500, 0, 150, 1.8);
        glowLight.position.y = FLAME_PARTICLE_Y_OFFSET + 5;
        campfireGroup.add(glowLight);
        campfireGroup.userData.glowLight = glowLight; // Store reference

        // #TODO: Initialize flame particle system similar to sparks
        // const flameGeometry = new THREE.BufferGeometry(); ...
        // const flameMaterial = new THREE.PointsMaterial({...}); ...
        // const flameParticles = new THREE.Points(flameGeometry, flameMaterial);
        // campfireGroup.add(flameParticles);
        // campfireGroup.userData.flameParticles = flameParticles;

        campfireGroup.visible = false; // Start hidden
        scene.add(campfireGroup);
    }

    function initSnake() {
        // Create initial tube geometry with dummy points
        const curve = new THREE.CatmullRomCurve3( [ new THREE.Vector3(0,5,0), new THREE.Vector3(10,5,0)] );
        const snakeGeometry = new THREE.TubeGeometry(curve, DEF_SNAKE_SEGMENTS, DEF_SNAKE_RADIUS, 5, false); // Segments, radius, radialSegments, closed
        snakeMesh = new THREE.Mesh(snakeGeometry, snakeMaterial);
        snakeMesh.castShadow = true;
        snakeMesh.visible = false;
        scene.add(snakeMesh);
    }

    // --- Resize Handler ---
    function handleResize() { /* ... as before ... */
        renderer.setSize(gameWidth, gameHeight); const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight; camera.left = frustumSize * aspect / -2; camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2; camera.bottom = frustumSize / -2;
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2); camera.updateProjectionMatrix();
        console.log(`Renderer resized to: ${gameWidth}x${gameHeight}`);
     }

    // --- Entity Creation Functions --- (mostly unchanged, ensure cloning)
    function createPlayerMesh(playerData) { /* ... as before, use cloned material */
        const mesh = new THREE.Mesh(playerGeometry, playerMaterial.clone());
        mesh.castShadow = true; mesh.position.set(playerData.x, PLAYER_MESH_Y_OFFSET, playerData.y);
        mesh.userData.gameId = playerData.id; return mesh;
     }
    function createEnemyMesh(enemyData) { /* ... as before, use cloned material */
        let mesh; let yOffset = ENEMY_MESH_Y_OFFSET; let mat;
        if (enemyData.type === 'giant') { mat = enemyGiantMaterial.clone(); mesh = new THREE.Mesh(enemyGiantGeometry, mat); yOffset = GIANT_MESH_Y_OFFSET; }
        else if (enemyData.type === 'shooter') { mat = enemyShooterMaterial.clone(); mesh = new THREE.Mesh(enemyShooterGeometry, mat); }
        else { mat = enemyChaserMaterial.clone(); mesh = new THREE.Mesh(enemyChaserGeometry, mat); }
        mesh.castShadow = true; mesh.position.set(enemyData.x, yOffset, enemyData.y);
        mesh.userData.gameId = enemyData.id; mesh.userData.type = enemyData.type;
        mesh.material.opacity = 1.0; return mesh;
     }
    function createBulletMesh(bulletData) { /* ... as before ... */
        const material = bulletData.owner_type === 'player' ? bulletPlayerMaterial : bulletEnemyMaterial;
        const mesh = new THREE.Mesh(bulletGeometry, material.clone()); // Clone basic materials too for safety
        mesh.position.set(bulletData.x, BULLET_MESH_Y_OFFSET, bulletData.y);
        mesh.userData.gameId = bulletData.id; return mesh;
     }
    function createPowerupMesh(powerupData) { /* ... as before, use cloned material */
        const material = (powerupMaterials[powerupData.type] || powerupMaterials.default).clone();
        const mesh = new THREE.Mesh(powerupGeometry, material);
        mesh.position.set(powerupData.x, POWERUP_MESH_Y_OFFSET, powerupData.y);
        mesh.castShadow = true; mesh.userData.gameId = powerupData.id;
        mesh.userData.isPowerup = true; return mesh;
     }

    // --- Entity Update & Disposal --- (Added pushback visual cue)
    function updateMeshes(state, meshDict, createFn, defaultYOffsetFn, localEffects) {
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

                    // --- Fading Out Dead Enemies ---
                    if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) {
                        const fadeDuration = 0.3; const timeSinceDeath = (performance.now() / 1000) - data.death_timestamp;
                        const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration));
                        mesh.material.opacity = opacity; mesh.visible = opacity > 0.001;
                    } else if (!mesh.visible || mesh.material.opacity < 1.0) {
                        mesh.material.opacity = 1.0; mesh.visible = true;
                    }

                    // --- Powerup Rotation ---
                    if (mesh.userData.isPowerup) { mesh.rotation.y += 0.01; mesh.rotation.x += 0.005; }

                    // --- Pushback Visual Cue (Local Player Only) ---
                    if (meshDict === playerMeshes && id === appState?.localPlayerId && localEffects?.pushbackAnim?.active) {
                        // Example: Add a temporary emissive color
                        const pushbackProgress = (localEffects.pushbackAnim.endTime - performance.now()) / localEffects.pushbackAnim.duration;
                        const intensity = Math.sin(pushbackProgress * Math.PI) * 0.5; // Pulse effect
                        mesh.material.emissive.setHex(0x44aaff); // Blueish glow
                        mesh.material.emissiveIntensity = intensity;
                    } else if (mesh.material.emissiveIntensity > 0) {
                        mesh.material.emissiveIntensity = 0; // Turn off glow
                    }
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
    function getYOffset(entityData) { /* ... as before ... */
        if (entityData.type === 'giant') return GIANT_MESH_Y_OFFSET;
        if (entityData.radius) return BULLET_MESH_Y_OFFSET;
        if (entityData.size) return POWERUP_MESH_Y_OFFSET;
        if (entityData.height && entityData.width) {
             const player = playerMeshes[entityData.id];
             return player ? PLAYER_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET;
        }
        return 5;
    }
    function updatePlayerAiming(appState) { /* ... as before ... */
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
    function updateEnvironment(isNight) { /* ... as before ... */
        const dayLightIntensity = 1.0, nightLightIntensity = 0.3; const dayAmbientIntensity = 0.6, nightAmbientIntensity = 0.15;
        const dayDirColor = 0xffffff, nightDirColor = 0xaaaaff; const dayAmbColor = 0xffffff, nightAmbColor = 0x444488;
        ambientLight.intensity = isNight ? nightAmbientIntensity : dayAmbientIntensity; ambientLight.color.setHex(isNight ? nightAmbColor : dayAmbColor);
        directionalLight.intensity = isNight ? nightLightIntensity : dayLightIntensity; directionalLight.color.setHex(isNight ? nightDirColor : dayDirColor);
        groundPlane.material = isNight ? groundNightMaterial : groundDayMaterial;
    }

    // --- Effect Updates ---
    function updateMuzzleFlash(appState, flashState) { /* ... as before ... */
        if (!muzzleFlashLight || !appState?.localPlayerId) return; const playerMesh = playerMeshes[appState.localPlayerId]; if (!playerMesh) return;
        const now = performance.now();
        if (flashState.active && now < flashState.endTime) {
            muzzleFlashLight.intensity = 3.0 + Math.random() * 2.0; const offsetDistance = DEF_PLAYER_WIDTH * 0.8; const aimAngle = playerMesh.rotation.y;
            muzzleFlashLight.position.set( playerMesh.position.x + Math.sin(aimAngle) * offsetDistance, playerMesh.position.y + PLAYER_MESH_Y_OFFSET * 0.6, playerMesh.position.z + Math.cos(aimAngle) * offsetDistance );
        } else { muzzleFlashLight.intensity = 0; if (flashState.active) flashState.active = false; }
    }

    function updateHitSparks(activeSparkEffects, deltaTime) {
        if (!hitSparkParticles || !hitSparkGeometry) return;

        const positions = hitSparkGeometry.attributes.position.array;
        const colors = hitSparkGeometry.attributes.color.array;
        const alphas = hitSparkGeometry.attributes.alpha.array;
        let visibleSparks = false;
        let particleIndex = 0; // Track which spark particle we are activating

        // Check for new sparks to trigger
        for (const enemyId in activeSparkEffects) {
            const effectEndTime = activeSparkEffects[enemyId];
            const enemyMesh = enemyMeshes[enemyId];
            if (performance.now() < effectEndTime && enemyMesh && particleIndex < MAX_SPARKS) {
                // Trigger a burst of sparks for this effect
                const sparksToSpawn = 3 + Math.floor(Math.random() * 4);
                const enemyPos = enemyMesh.position;
                for (let i = 0; i < sparksToSpawn && particleIndex < MAX_SPARKS; i++) {
                    const p = sparkData[particleIndex];
                    if (p.life <= 0) { // Find an inactive particle
                        p.position.copy(enemyPos);
                        p.position.y += Math.random() * ENEMY_MESH_Y_OFFSET * 1.5; // Spawn around body height
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 100 + Math.random() * 80;
                        p.velocity.set(Math.cos(angle) * speed, (Math.random() - 0.3) * speed * 0.5, Math.sin(angle) * speed);
                        p.color.setRGB(1, Math.random() * 0.5, 0); // Red/Orange
                        p.alpha = 0.9 + Math.random() * 0.1;
                        p.life = 0.2 + Math.random() * 0.3; // Lifetime in seconds
                        particleIndex++;
                    }
                }
                // Mark effect as processed for this frame to prevent re-triggering immediately
                // (Ideally main.js handles the activeBloodSparkEffects state management)
            }
        }

        // Update existing active sparks
        let aliveCount = 0;
        for (let i = 0; i < MAX_SPARKS; i++) {
            const p = sparkData[i];
            if (p.life > 0) {
                p.life -= deltaTime;
                if (p.life <= 0) {
                    p.alpha = 0;
                } else {
                    p.position.addScaledVector(p.velocity, deltaTime);
                    p.velocity.y -= 200 * deltaTime; // Gravity
                    p.alpha = Math.max(0, p.alpha - deltaTime * 2.5); // Fade out
                    aliveCount++;
                }
                // Update buffer attributes
                positions[i * 3] = p.position.x;
                positions[i * 3 + 1] = p.position.y;
                positions[i * 3 + 2] = p.position.z;
                colors[i * 3] = p.color.r;
                colors[i * 3 + 1] = p.color.g;
                colors[i * 3 + 2] = p.color.b;
                alphas[i] = p.alpha;
            } else {
                // Ensure hidden particles are truly hidden
                 if (alphas[i] > 0) alphas[i] = 0;
            }
        }

        // Update geometry attributes if particles were alive
        if (aliveCount > 0 || hitSparkParticles.visible) {
             hitSparkGeometry.attributes.position.needsUpdate = true;
             hitSparkGeometry.attributes.color.needsUpdate = true;
             hitSparkGeometry.attributes.alpha.needsUpdate = true;
             visibleSparks = true;
        }
        hitSparkParticles.visible = visibleSparks;
    }

    function updateAmmoCasings(activeCasings) {
        if (!ammoCasingMesh) return;
        const dummy = new THREE.Object3D(); // Used to set matrix for each instance
        let visibleCount = 0;
        for (let i = 0; i < activeCasings.length && i < MAX_CASINGS; i++) {
            const casing = activeCasings[i];
            // Position (Game Y is Scene Z), add small Y offset
            dummy.position.set(casing.x, casing.height / 2 + 0.5, casing.y);
            // Rotation - THREE.js uses complex rotation order, simplify for now
            // Apply calculated rotation around its local Y axis primarily
            dummy.rotation.set(Math.random()*0.5, casing.rotation, Math.random()*0.5); // Add some tumble
            dummy.updateMatrix();
            ammoCasingMesh.setMatrixAt(i, dummy.matrix);
            visibleCount++;
        }
        ammoCasingMesh.count = visibleCount; // Only render active instances
        ammoCasingMesh.instanceMatrix.needsUpdate = true;
    }

    function updateWeatherParticles(appState, deltaTime) {
        if (!appState) return;
        // Rain
        if (rainParticles && rainGeometry) {
            rainParticles.visible = appState.isRaining;
            if (appState.isRaining) {
                 const positions = rainGeometry.attributes.position.array;
                 for (let i = 0; i < MAX_RAIN_DROPS; i++) {
                     const p = rainData[i];
                     p.position.addScaledVector(p.velocity, deltaTime);
                     // Recycle drops that fall below ground
                     if (p.position.y < -10) {
                         p.position.x = Math.random() * gameWidth;
                         p.position.y = gameHeight * 1.2; // Start above again
                         p.position.z = Math.random() * gameHeight;
                     }
                     positions[i * 3] = p.position.x;
                     positions[i * 3 + 1] = p.position.y;
                     positions[i * 3 + 2] = p.position.z;
                 }
                 rainGeometry.attributes.position.needsUpdate = true;
            }
        }
        // Dust
        if (dustParticles && dustGeometry) {
             dustParticles.visible = appState.isDustStorm;
             if (appState.isDustStorm) {
                 const positions = dustGeometry.attributes.position.array;
                 for (let i = 0; i < MAX_DUST_MOTES; i++) {
                     const p = dustData[i];
                     p.position.addScaledVector(p.velocity, deltaTime);
                     p.velocity.x += (Math.random() - 0.5) * 50 * deltaTime; // Random walk/swirl
                     p.velocity.z += (Math.random() - 0.5) * 50 * deltaTime;
                     // Keep near ground
                     p.position.y = Math.max(1, Math.min(50, p.position.y + (Math.random() - 0.5) * 10 * deltaTime));
                     // Wrap around screen edges
                     if (p.position.x < -gameWidth*0.1) p.position.x += gameWidth*1.2;
                     if (p.position.x > gameWidth*1.1) p.position.x -= gameWidth*1.2;
                     if (p.position.z < -gameHeight*0.1) p.position.z += gameHeight*1.2;
                     if (p.position.z > gameHeight*1.1) p.position.z -= gameHeight*1.2;

                     positions[i*3] = p.position.x;
                     positions[i*3+1] = p.position.y;
                     positions[i*3+2] = p.position.z;
                 }
                 dustGeometry.attributes.position.needsUpdate = true;
             }
        }
    }

    // --- Specific Object Updates ---
    function updateSnake(snakeData) {
        if (!snakeMesh || !snakeData) return;
        snakeMesh.visible = snakeData.isActiveFromServer;
        if (snakeData.isActiveFromServer && snakeData.segments && snakeData.segments.length > 1) {
            // Convert 2D snake segments (x, gameY) to 3D points (x, fixed_height, gameY)
            const curvePoints = snakeData.segments.map(seg => new THREE.Vector3(seg.x, DEF_SNAKE_RADIUS, seg.y));
            const curve = new THREE.CatmullRomCurve3(curvePoints);
            // Update the existing geometry's path
            const newGeometry = new THREE.TubeGeometry(curve, DEF_SNAKE_SEGMENTS, DEF_SNAKE_RADIUS, 5, false);
            snakeMesh.geometry.dispose(); // Dispose old geometry
            snakeMesh.geometry = newGeometry; // Assign new geometry
        }
    }

    function updateCampfire(campfireData) {
        if (!campfireGroup || !campfireData) return;
        campfireGroup.visible = campfireData.active;
        if (campfireData.active) {
            campfireGroup.position.set(campfireData.x, CAMPFIRE_LOG_Y_OFFSET, campfireData.y);
            // Update glow light
            const glowLight = campfireGroup.userData.glowLight;
            if (glowLight) {
                glowLight.intensity = 1.5 + Math.sin(performance.now() * 0.002) * 0.5; // Pulsing intensity
            }
            // #TODO: Update flame particle system animation
        }
    }

    // --- Screen Position Calculation ---
    function getScreenPosition(worldPosition, cameraRef, rendererRef) {
        const vector = worldPosition.clone();
        vector.project(cameraRef);
        const screenX = Math.round((vector.x + 1) * rendererRef.domElement.width / 2);
        const screenY = Math.round((-vector.y + 1) * rendererRef.domElement.height / 2);
        return { x: screenX, y: screenY };
    }

    // --- Main Render Function ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) return;

        // Update Internal Dimensions & Check Resize
        let dimensionsChanged = false;
        if (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight) {
            gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight;
            dimensionsChanged = true; console.log(`Renderer internal dimensions updated: ${gameWidth}x${gameHeight}`);
        }
        if (dimensionsChanged) handleResize();

        const now = performance.now();
        const deltaTime = appState.lastLoopTime ? Math.min(0.1, (now - appState.lastLoopTime) / 1000) : 0.016; // Use delta from main loop if available

        // Update Camera Shake
        if (shakeMagnitude > 0 && now < shakeEndTime) {
            const timeRemaining = shakeEndTime - now; const initialDurationEst = Math.max(1, shakeEndTime - (now - timeRemaining));
            const currentMag = shakeMagnitude * Math.max(0, timeRemaining / initialDurationEst);
            const shakeAngle = Math.random() * Math.PI * 2; screenShakeOffset.x = Math.cos(shakeAngle) * currentMag; screenShakeOffset.z = Math.sin(shakeAngle) * currentMag;
        } else { shakeMagnitude = 0; screenShakeOffset.set(0, 0, 0); }
        camera.position.set( gameWidth / 2 + screenShakeOffset.x, 1000, gameHeight / 2 + screenShakeOffset.z );

        // Update Environment, Effects, Objects
        updateEnvironment(stateToRender.is_night);
        updateMuzzleFlash(appState, localEffects.muzzleFlash);
        updateHitSparks(localEffects.activeBloodSparkEffects, deltaTime); // Pass effect state and delta
        updateAmmoCasings(localEffects.activeAmmoCasings); // Pass effect state
        updateWeatherParticles(appState, deltaTime); // Pass app state and delta
        updateSnake(localEffects.snake); // Pass snake state
        updateCampfire(stateToRender.campfire); // Pass campfire state

        // Sync Game Object Meshes (Pass localEffects for pushback cue)
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, (d) => PLAYER_MESH_Y_OFFSET, localEffects);
        updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, (d) => d.type === 'giant' ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET, localEffects);
        updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, (d) => BULLET_MESH_Y_OFFSET, localEffects);
        updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, (d) => POWERUP_MESH_Y_OFFSET, localEffects);

        // Update Player Aiming
        updatePlayerAiming(appState);

        // Calculate UI Positions for HTML Overlay
        const uiPositions = {};
        const calculateUIPos = (meshDict, stateDict, yOffsetFn) => {
            for (const id in meshDict) {
                const mesh = meshDict[id];
                if (mesh && stateDict[id] && mesh.visible) {
                     const worldPos = mesh.position.clone(); worldPos.y += yOffsetFn(stateDict[id]) * 1.1;
                     const screenPos = getScreenPosition(worldPos, camera, renderer);
                     uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y };
                 }
            }
        };
        calculateUIPos(playerMeshes, stateToRender.players, (d) => PLAYER_MESH_Y_OFFSET);
        calculateUIPos(enemyMeshes, stateToRender.enemies, (d) => d.type === 'giant' ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET);
        // Damage texts need slightly different handling as they aren't tied to a mesh
        if (stateToRender.damage_texts) {
            for (const id in stateToRender.damage_texts) {
                 const dt = stateToRender.damage_texts[id];
                 // Use the text's world position directly
                 const worldPos = new THREE.Vector3(dt.x, PLAYER_MESH_Y_OFFSET, dt.y); // Use average entity height
                 const screenPos = getScreenPosition(worldPos, camera, renderer);
                 uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y };
             }
        }
        appState.uiPositions = uiPositions; // Store for main.js

        // --- Render ---
        renderer.render(scene, camera);
    }

    // --- Effect Triggers ---
    function triggerShake(magnitude, durationMs) { /* ... as before ... */
        const now = performance.now(); const newEndTime = now + durationMs;
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) { shakeMagnitude = Math.max(magnitude, shakeMagnitude); shakeEndTime = Math.max(newEndTime, shakeEndTime); }
    }

    // --- Cleanup ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup ---");
        window.removeEventListener('resize', handleResize);
        // Dispose Particle Systems
        if (hitSparkGeometry) hitSparkGeometry.dispose();
        if (rainGeometry) rainGeometry.dispose();
        if (dustGeometry) dustGeometry.dispose();
        if (sparkMaterial) sparkMaterial.dispose();
        if (rainMaterial) rainMaterial.dispose();
        if (dustMaterial) dustMaterial.dispose();
        hitSparkParticles = null; rainParticles = null; dustParticles = null;
        // Dispose Instanced Mesh
        if (ammoCasingMesh) { scene.remove(ammoCasingMesh); ammoCasingMesh = null; } // Already disposed geometry/material below
        // Dispose Specific Objects
        if (snakeMesh) { scene.remove(snakeMesh); if (snakeMesh.geometry) snakeMesh.geometry.dispose(); snakeMesh = null; }
        if (campfireGroup) { scene.remove(campfireGroup); /* Children disposed below */ campfireGroup = null; }
        // Dispose Scene Children & Cached Geometries/Materials
        while(scene?.children.length > 0){ const child = scene.children[0]; scene.remove(child); if (child.geometry) child.geometry.dispose(); if (child.material) { if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); } }
        playerGeometry.dispose(); enemyChaserGeometry.dispose(); enemyShooterGeometry.dispose(); enemyGiantGeometry.dispose(); bulletGeometry.dispose(); powerupGeometry.dispose(); logGeometry.dispose(); casingGeometry.dispose();
        Object.values(powerupMaterials).forEach(m => m.dispose()); playerMaterial.dispose(); enemyChaserMaterial.dispose(); enemyShooterMaterial.dispose(); enemyGiantMaterial.dispose(); bulletPlayerMaterial.dispose(); bulletEnemyMaterial.dispose(); snakeMaterial.dispose(); logMaterial.dispose(); casingMaterial.dispose();
        groundDayMaterial.dispose(); groundNightMaterial.dispose();
        // Dispose Renderer
        if (renderer) { renderer.dispose(); if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer = null; }
        scene = null; camera = null; groundPlane = null; ambientLight = null; directionalLight = null; muzzleFlashLight = null;
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]); Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]);
        Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]); Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);
        console.log("Renderer3D resources released.");
    }

    return { init, renderScene, triggerShake, cleanup };

})();

export default Renderer3D;
