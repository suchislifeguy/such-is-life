// Renderer3D.js - FINAL DEFINITIVE VERSION
import * as THREE from 'three';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing Final DEFINITIVE ---");

    // --- Core THREE.js Components ---
    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600, gameHeight = 900;

    // --- Game Object Representations ---
    const playerMeshes = {}; const enemyMeshes = {};
    const bulletMeshes = {}; const powerupMeshes = {};
    let groundPlane = null; let muzzleFlashLight = null;
    let campfireGroup = null; let snakeMesh = null;
    let flameParticles = null;

    // --- Effects Objects ---
    let screenShakeOffset = new THREE.Vector3(0, 0, 0);
    let shakeMagnitude = 0; let shakeEndTime = 0;

    // --- Particles & Instancing ---
    let hitSparkParticles = null; let hitSparkGeometry = null;
    let rainParticles = null; let rainGeometry = null;
    let dustParticles = null; let dustGeometry = null;
    let ammoCasingMesh = null; let flameGeometry = null;

    const MAX_SPARKS = 100; const MAX_RAIN_DROPS = 500; const MAX_DUST_MOTES = 300;
    const MAX_CASINGS = 100; const MAX_FLAMES = 50;

    // --- Internal Constants ---
    const DEF_PLAYER_WIDTH = 25; const DEF_PLAYER_HEIGHT = 48;
    const DEF_ENEMY_WIDTH = 20; const DEF_ENEMY_HEIGHT = 40;
    const DEF_GIANT_MULTIPLIER = 2.5; const DEF_BULLET_RADIUS = 4;
    const DEF_POWERUP_SIZE = 20; const DEF_SNAKE_SEGMENTS = 50;
    const DEF_SNAKE_RADIUS = 3;

    // --- Materials ---
    const playerMaterialBase = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.6, metalness: 0.2, name: 'PlayerMatBase' });
    const enemySharedMaterialProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    const enemyChaserMaterialBase = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemySharedMaterialProps, name: 'EnemyChaserMatBase' });
    const enemyShooterMaterialBase = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemySharedMaterialProps, name: 'EnemyShooterMatBase' });
    const enemyGiantMaterialBase = new THREE.MeshStandardMaterial({ color: 0xa00000, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 1.0, name: 'EnemyGiantMatBase' });
    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: 'BulletPlayerMat' });
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, name: 'BulletEnemyMat' });
    const powerupMaterials = {
        default: new THREE.MeshStandardMaterial({ color: 0x888888, name: 'PowerupDefaultMat' }), health: new THREE.MeshStandardMaterial({ color: 0x81c784, name: 'PowerupHealthMat' }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x442848, name: 'PowerupGunMat' }), speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3, name: 'PowerupSpeedMat' }),
        armor: new THREE.MeshStandardMaterial({ color: 0x9e9e9e, name: 'PowerupArmorMat' }), ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500, name: 'PowerupShotgunMat' }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D, name: 'PowerupSlugMat' }), ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00, name: 'PowerupRapidMat' }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700, name: 'PowerupScoreMat' }),
    };
    const groundDayMaterial = new THREE.MeshStandardMaterial({ color: 0x8FBC8F, roughness: 0.8, metalness: 0.1, name: 'GroundDayMat' });
    const groundNightMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8, metalness: 0.1, name: 'GroundNightMat' });
    const snakeMaterial = new THREE.MeshStandardMaterial({ color: 0x261a0d, roughness: 0.4, metalness: 0.2, name: 'SnakeMat' });
    const logMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: 'LogMat' });
    const sparkMaterial = new THREE.PointsMaterial({ size: 8, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'SparkMat' });
    const rainMaterial = new THREE.PointsMaterial({ size: 10, color: 0xaabbff, transparent: true, opacity: 0.6, sizeAttenuation: true, depthWrite: false, name: 'RainMat' });
    const dustMaterial = new THREE.PointsMaterial({ size: 40, color: 0xe5a960, transparent: true, opacity: 0.15, sizeAttenuation: true, depthWrite: false, name: 'DustMat' });
    const casingMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: 'CasingMat' });
    const flameTexture = createFlameTexture();
    const flameMaterial = new THREE.PointsMaterial({ size: 12, vertexColors: true, map: flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'FlameMat' });

    // --- Geometries ---
    const playerGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8); playerGeometry.name = "PlayerGeo";
    const enemyChaserGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH, DEF_ENEMY_HEIGHT, DEF_ENEMY_WIDTH * 0.7); enemyChaserGeometry.name = "EnemyChaserGeo";
    const enemyShooterGeometry = new THREE.CylinderGeometry(DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_HEIGHT, 8); enemyShooterGeometry.name = "EnemyShooterGeo";
    const enemyGiantGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * DEF_GIANT_MULTIPLIER, DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER, DEF_ENEMY_WIDTH * 0.7 * DEF_GIANT_MULTIPLIER); enemyGiantGeometry.name = "EnemyGiantGeo";
    const bulletGeometry = new THREE.SphereGeometry(DEF_BULLET_RADIUS, 6, 6); bulletGeometry.name = "BulletGeo";
    const powerupGeometry = new THREE.BoxGeometry(DEF_POWERUP_SIZE, DEF_POWERUP_SIZE, DEF_POWERUP_SIZE); powerupGeometry.name = "PowerupGeo";
    const logGeometry = new THREE.CylinderGeometry(4, 4, 35, 6); logGeometry.name = "LogGeo";
    const casingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 6); casingGeometry.name = "CasingGeo";

    // --- Mesh Positioning Offsets ---
    const PLAYER_MESH_Y_OFFSET = DEF_PLAYER_HEIGHT / 2; const ENEMY_MESH_Y_OFFSET = DEF_ENEMY_HEIGHT / 2;
    const GIANT_MESH_Y_OFFSET = (DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER) / 2;
    const BULLET_MESH_Y_OFFSET = DEF_BULLET_RADIUS; const POWERUP_MESH_Y_OFFSET = DEF_POWERUP_SIZE / 2 + 1;
    const CAMPFIRE_LOG_Y_OFFSET = 4; const FLAME_PARTICLE_Y_OFFSET = 6;

    // --- Particle Data Storage ---
    const sparkData = []; const rainData = []; const dustData = []; const flameData = [];

    // --- Texture Helper ---
    function createFlameTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255, 220, 150, 1)'); gradient.addColorStop(0.4, 'rgba(255, 150, 0, 0.8)'); gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); const texture = new THREE.CanvasTexture(canvas); texture.name = "FlameTexture"; return texture;
    }

    // --- Initialization ---
    function init(containerElement, initialWidth, initialHeight) {
        console.log("--- Renderer3D.init() Final Complete ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }
        gameWidth = initialWidth || 1600; gameHeight = initialHeight || 900;

        renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(gameWidth, gameHeight);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; containerElement.appendChild(renderer.domElement);

        scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2a28);
        const aspect = gameWidth / gameHeight; const frustumSize = gameHeight;
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 2000);
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2); camera.rotation.x = -Math.PI / 2; scene.add(camera);

        ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
        directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); directionalLight.position.set(150, 300, 200); directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048; directionalLight.shadow.camera.near = 50; directionalLight.shadow.camera.far = 700;
        directionalLight.shadow.camera.left = -gameWidth * 1.2; directionalLight.shadow.camera.right = gameWidth * 1.2; directionalLight.shadow.camera.top = gameHeight * 1.2; directionalLight.shadow.camera.bottom = -gameHeight * 1.2;
        scene.add(directionalLight);

        muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.5); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);

        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth * 1.5, gameHeight * 1.5); groundGeometryPlane.name = "GroundGeo";
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial); groundPlane.rotation.x = -Math.PI / 2; groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
        groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane"; scene.add(groundPlane);

        initSparkParticles(); initWeatherParticles(); initAmmoCasings(); initCampfire(); initSnake();
        window.addEventListener('resize', handleResize);
        handleResize(); // Call once after setup
        console.log("--- Renderer3D initialization complete ---");
        return true;
    }

    function initSparkParticles() {
        hitSparkGeometry = new THREE.BufferGeometry(); hitSparkGeometry.name = "SparkGeo"; const positions = new Float32Array(MAX_SPARKS * 3); const colors = new Float32Array(MAX_SPARKS * 3); const alphas = new Float32Array(MAX_SPARKS); sparkData.length = 0;
        for(let i = 0; i < MAX_SPARKS; i++) { sparkData.push({ position: new THREE.Vector3(0,-1000,0), velocity: new THREE.Vector3(), color: new THREE.Color(0xff0000), alpha: 0.0, life: 0 }); alphas[i] = 0.0; positions[i*3+1] = -1000; }
        hitSparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); hitSparkGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); hitSparkGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        hitSparkParticles = new THREE.Points(hitSparkGeometry, sparkMaterial); hitSparkParticles.name = "HitSparks"; hitSparkParticles.visible = true; scene.add(hitSparkParticles);
    }
    function initWeatherParticles() {
        rainGeometry = new THREE.BufferGeometry(); rainGeometry.name = "RainGeo"; const rainPositions = new Float32Array(MAX_RAIN_DROPS * 3); rainData.length = 0;
        for (let i = 0; i < MAX_RAIN_DROPS; i++) { rainData.push({ position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, Math.random()*gameHeight*1.5 + gameHeight*0.5 , Math.random()*gameHeight*1.2-gameHeight*0.1), velocity: new THREE.Vector3(10 + Math.random()*5, -300 - Math.random()*100, 0) }); rainPositions[i*3+1] = -1000; }
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)); rainParticles = new THREE.Points(rainGeometry, rainMaterial); rainParticles.name = "Rain"; rainParticles.visible = false; scene.add(rainParticles);
        dustGeometry = new THREE.BufferGeometry(); dustGeometry.name = "DustGeo"; const dustPositions = new Float32Array(MAX_DUST_MOTES * 3); dustData.length = 0;
        for (let i = 0; i < MAX_DUST_MOTES; i++) { dustData.push({ position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, Math.random()*50 + 5 , Math.random()*gameHeight*1.2-gameHeight*0.1), velocity: new THREE.Vector3((Math.random()-0.5)*50, Math.random()*5, (Math.random()-0.5)*50), rotation: Math.random() * Math.PI * 2 }); dustPositions[i*3+1] = -1000; }
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3)); dustParticles = new THREE.Points(dustGeometry, dustMaterial); dustParticles.name = "Dust"; dustParticles.visible = false; scene.add(dustParticles);
    }
    function initAmmoCasings() { ammoCasingMesh = new THREE.InstancedMesh(casingGeometry, casingMaterial, MAX_CASINGS); ammoCasingMesh.name = "AmmoCasings"; ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; scene.add(ammoCasingMesh); }
    function initCampfire() {
        campfireGroup = new THREE.Group(); campfireGroup.name = "CampfireGroup"; const log1 = new THREE.Mesh(logGeometry, logMaterial); log1.rotation.z = Math.PI / 6; log1.rotation.y = Math.PI / 10; log1.castShadow = true; log1.name = "Log1";
        const log2 = new THREE.Mesh(logGeometry, logMaterial); log2.rotation.z = -Math.PI / 5; log2.rotation.y = -Math.PI / 8; log2.castShadow = true; log2.name = "Log2"; campfireGroup.add(log1); campfireGroup.add(log2);
        const glowLight = new THREE.PointLight(0xffa500, 0, 150, 1.8); glowLight.position.y = FLAME_PARTICLE_Y_OFFSET + 5; glowLight.name = "CampfireGlow"; campfireGroup.add(glowLight); campfireGroup.userData.glowLight = glowLight;
        flameGeometry = new THREE.BufferGeometry(); flameGeometry.name = "FlameGeo"; const flamePositions = new Float32Array(MAX_FLAMES * 3); const flameColors = new Float32Array(MAX_FLAMES * 3); const flameAlphas = new Float32Array(MAX_FLAMES); flameData.length = 0;
        for(let i=0; i < MAX_FLAMES; i++) { flameData.push({ position: new THREE.Vector3(0,-1000,0), velocity: new THREE.Vector3(), color: new THREE.Color(1,1,1), alpha: 0.0, life: 0, baseLife: 0.5 + Math.random()*0.4 }); flamePositions[i*3+1]=-1000; flameAlphas[i]=0.0; }
        flameGeometry.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3)); flameGeometry.setAttribute('color', new THREE.BufferAttribute(flameColors, 3)); flameGeometry.setAttribute('alpha', new THREE.BufferAttribute(flameAlphas, 1));
        flameParticles = new THREE.Points(flameGeometry, flameMaterial); flameParticles.name = "Flames"; campfireGroup.add(flameParticles); campfireGroup.userData.flameParticles = flameParticles;
        campfireGroup.visible = false; scene.add(campfireGroup);
    }
    function initSnake() { const curve = new THREE.CatmullRomCurve3( [ new THREE.Vector3(0,5,0), new THREE.Vector3(10,5,0)] ); const snakeGeometry = new THREE.TubeGeometry(curve, DEF_SNAKE_SEGMENTS, DEF_SNAKE_RADIUS, 5, false); snakeGeometry.name = "SnakeGeo"; snakeMesh = new THREE.Mesh(snakeGeometry, snakeMaterial); snakeMesh.name = "Snake"; snakeMesh.castShadow = true; snakeMesh.visible = false; scene.add(snakeMesh); }

    // --- Resize Handler ---
    function handleResize() {
        if (!renderer || !camera) return;
        renderer.setSize(gameWidth, gameHeight); const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight; camera.left = frustumSize * aspect / -2; camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2; camera.bottom = frustumSize / -2;
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        camera.lookAt(gameWidth / 2, 0, gameHeight / 2);
        camera.updateProjectionMatrix();
        console.log(`Renderer resized to: ${gameWidth}x${gameHeight}`);
     }

    // --- Entity Creation Functions ---
    function createPlayerMesh(playerData) { const m=new THREE.Mesh(playerGeometry,playerMaterialBase.clone()); m.castShadow=true; m.position.set(playerData.x,PLAYER_MESH_Y_OFFSET,playerData.y); m.userData.gameId=playerData.id; m.name = `Player_${playerData.id.substring(0,4)}`; return m; }
    function createEnemyMesh(enemyData){ let m,yO=ENEMY_MESH_Y_OFFSET,mat; if(enemyData.type==='giant'){mat=enemyGiantMaterialBase.clone();m=new THREE.Mesh(enemyGiantGeometry,mat);yO=GIANT_MESH_Y_OFFSET;}else if(enemyData.type==='shooter'){mat=enemyShooterMaterialBase.clone();m=new THREE.Mesh(enemyShooterGeometry,mat);}else{mat=enemyChaserMaterialBase.clone();m=new THREE.Mesh(enemyChaserGeometry,mat);} m.castShadow=true;m.position.set(enemyData.x,yO,enemyData.y);m.userData.gameId=enemyData.id;m.userData.type=enemyData.type;m.material.opacity=1.0; m.name = `Enemy_${enemyData.type}_${enemyData.id.substring(0,4)}`; return m; }
    function createBulletMesh(bulletData){ const mat=bulletData.owner_type==='player'?bulletPlayerMaterial:bulletEnemyMaterial; const m=new THREE.Mesh(bulletGeometry,mat); m.position.set(bulletData.x,BULLET_MESH_Y_OFFSET,bulletData.y); m.userData.gameId=bulletData.id; m.name = `Bullet_${bulletData.id.substring(0,4)}`; return m; }
    function createPowerupMesh(powerupData){ const mat=(powerupMaterials[powerupData.type]||powerupMaterials.default).clone(); const m=new THREE.Mesh(powerupGeometry,mat); m.position.set(powerupData.x,POWERUP_MESH_Y_OFFSET,powerupData.y); m.castShadow=true;m.userData.gameId=powerupData.id; m.userData.isPowerup=true; m.name = `Powerup_${powerupData.type}_${powerupData.id.substring(0,4)}`; return m; }

    // --- Entity Update & Disposal ---
    function updateMeshes(state, meshDict, createFn, defaultYOffsetFn, localEffects, appState) {
        const activeIds = new Set();
        if (state) {
            for (const id in state) {
                const data = state[id]; if (typeof data.x !== 'number' || typeof data.y !== 'number') continue; activeIds.add(id);
                let mesh = meshDict[id];
                if (!mesh) { mesh = createFn(data); if (mesh) { meshDict[id] = mesh; scene.add(mesh); } }
                else {
                    const yPos = defaultYOffsetFn(data); mesh.position.set(data.x, yPos, data.y);
                    if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) { const fadeDuration = 0.3; const timeSinceDeath = (performance.now()/1000) - data.death_timestamp; const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration)); mesh.material.opacity = opacity; mesh.visible = opacity > 0.001; }
                    else if (!mesh.visible || (mesh.material.opacity < 1.0 && mesh.material.opacity > 0)) { mesh.material.opacity = 1.0; mesh.visible = true; }
                    if (mesh.userData.isPowerup) { mesh.rotation.y += 0.01; mesh.rotation.x += 0.005; }
                    if (meshDict === playerMeshes && id === appState?.localPlayerId && localEffects?.pushbackAnim?.active) { const pushbackProgress = Math.max(0,(localEffects.pushbackAnim.endTime-performance.now())/localEffects.pushbackAnim.duration); const intensity = Math.sin(pushbackProgress*Math.PI)*0.6; mesh.material.emissive.setHex(0x66ccff); mesh.material.emissiveIntensity=intensity; }
                    else if (mesh.material.emissiveIntensity > 0) { mesh.material.emissiveIntensity = 0; }
                }
            }
        }
        for (const id in meshDict) { if (!activeIds.has(id)) { const meshToRemove = meshDict[id]; if (meshToRemove) { scene.remove(meshToRemove); if (meshToRemove.geometry) meshToRemove.geometry.dispose(); if (meshToRemove.material) { if (Array.isArray(meshToRemove.material)) meshToRemove.material.forEach(m => m.dispose()); else meshToRemove.material.dispose(); } } delete meshDict[id]; } }
    }
    function getYOffset(entityData) { if (entityData.type === 'giant') return GIANT_MESH_Y_OFFSET; if (entityData.radius) return BULLET_MESH_Y_OFFSET; if (entityData.size) return POWERUP_MESH_Y_OFFSET; if (entityData.height && entityData.width) { const player = playerMeshes[entityData.id]; return player ? PLAYER_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET;} return 5; }
    function updatePlayerAiming(appState) { if (!appState?.localPlayerId || !appState.localPlayerAimState) return; const playerMesh = playerMeshes[appState.localPlayerId]; if (playerMesh) { const aimDx = appState.localPlayerAimState.lastAimDx; const aimDy = appState.localPlayerAimState.lastAimDy; const angle = Math.atan2(aimDx, aimDy); playerMesh.rotation.y = angle; } }

    // --- Environment Update ---
    function updateEnvironment(isNight) {
        const dayLightIntensity=1.0, nightLightIntensity=0.3; const dayAmbientIntensity=0.6, nightAmbientIntensity=0.15;
        const dayDirColor=0xffffff, nightDirColor=0xaaaaff; const dayAmbColor=0xffffff, nightAmbColor=0x444488;
        ambientLight.intensity=isNight?nightAmbientIntensity:dayAmbientIntensity; ambientLight.color.setHex(isNight?nightAmbColor:dayAmbColor);
        directionalLight.intensity=isNight?nightLightIntensity:dayLightIntensity; directionalLight.color.setHex(isNight?nightDirColor:dayDirColor);
        groundPlane.material=isNight?groundNightMaterial:groundDayMaterial;
    }

    // --- Effect Updates ---
    function updateMuzzleFlash(appState, flashState) {
        if (!muzzleFlashLight || !appState?.localPlayerId) return; const playerMesh = playerMeshes[appState.localPlayerId]; if (!playerMesh) return;
        const now = performance.now();
        if (flashState.active && now < flashState.endTime) {
            muzzleFlashLight.intensity = 3.0 + Math.random() * 2.0; const offsetDistance = DEF_PLAYER_WIDTH * 0.8; const aimAngle = playerMesh.rotation.y;
            muzzleFlashLight.position.set( playerMesh.position.x + Math.sin(aimAngle) * offsetDistance, playerMesh.position.y + PLAYER_MESH_Y_OFFSET * 0.6, playerMesh.position.z + Math.cos(aimAngle) * offsetDistance );
        } else { muzzleFlashLight.intensity = 0; if (flashState.active) flashState.active = false; }
    }
    function updateHitSparks(activeSparkEffects, deltaTime) {
        if (!hitSparkParticles||!hitSparkGeometry) return; const positions=hitSparkGeometry.attributes.position.array; const colors=hitSparkGeometry.attributes.color.array; const alphas=hitSparkGeometry.attributes.alpha.array; let visibleSparks=false; let firstInactiveIndex=0;
        const now = performance.now();
        for(const enemyId in activeSparkEffects){ const effectEndTime=activeSparkEffects[enemyId]; const enemyMesh=enemyMeshes[enemyId]; if(now < effectEndTime && enemyMesh){ const sparksToSpawn=3+Math.floor(Math.random()*4); const enemyPos=enemyMesh.position; for(let i=0;i<sparksToSpawn;i++){ let foundSlot=false; for(let j=firstInactiveIndex; j < MAX_SPARKS; j++){ const p=sparkData[j]; if(p.life<=0){ p.position.copy(enemyPos); p.position.y+=Math.random()*ENEMY_MESH_Y_OFFSET*1.5; const angle=Math.random()*Math.PI*2; const speed=100+Math.random()*80; p.velocity.set(Math.cos(angle)*speed,(Math.random()-0.3)*speed*0.5,Math.sin(angle)*speed); p.color.setRGB(1,Math.random()*0.5,0); p.alpha=0.9+Math.random()*0.1; p.life=0.2+Math.random()*0.3; firstInactiveIndex=j+1; foundSlot=true; break;}} if (!foundSlot) break; } delete activeSparkEffects[enemyId]; } }
        let aliveCount=0; for(let i=0;i<MAX_SPARKS;i++){ const p=sparkData[i]; if(p.life>0){ p.life-=deltaTime; if(p.life<=0){p.alpha=0; p.position.y = -1000; } else { p.position.addScaledVector(p.velocity,deltaTime); p.velocity.y-=200*deltaTime; p.alpha=Math.max(0,p.alpha-deltaTime*2.5); aliveCount++; } positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; alphas[i]=p.alpha; } else { if(alphas[i]>0) alphas[i]=0; } }
        if(aliveCount>0){ hitSparkGeometry.attributes.position.needsUpdate=true; hitSparkGeometry.attributes.color.needsUpdate=true; hitSparkGeometry.attributes.alpha.needsUpdate=true; visibleSparks=true; } hitSparkParticles.visible=visibleSparks;
    }
    function updateAmmoCasings(activeCasings) {
        if (!ammoCasingMesh) return; const dummy=new THREE.Object3D(); let visibleCount=0;
        for(let i=0; i<activeCasings.length && i<MAX_CASINGS; i++){ const casing=activeCasings[i]; dummy.position.set(casing.x,casing.height/2+0.5,casing.y); dummy.rotation.set(Math.PI/2 + (Math.random()-0.5)*0.5, casing.rotation, (Math.random()-0.5)*0.5); dummy.updateMatrix(); ammoCasingMesh.setMatrixAt(i,dummy.matrix); visibleCount++; }
        ammoCasingMesh.count=visibleCount; ammoCasingMesh.instanceMatrix.needsUpdate=true;
    }
    function updateWeatherParticles(appState, deltaTime) {
        if(!appState)return;
        if(rainParticles&&rainGeometry){ rainParticles.visible=appState.isRaining; if(appState.isRaining){const positions=rainGeometry.attributes.position.array; for(let i=0;i<MAX_RAIN_DROPS;i++){ const p=rainData[i]; p.position.addScaledVector(p.velocity,deltaTime); if(p.position.y<-10){ p.position.x=Math.random()*gameWidth*1.2-gameWidth*0.1; p.position.y=gameHeight*1.5; p.position.z=Math.random()*gameHeight*1.2-gameHeight*0.1;} positions[i*3]=p.position.x;positions[i*3+1]=p.position.y;positions[i*3+2]=p.position.z;} rainGeometry.attributes.position.needsUpdate=true;}}
        if(dustParticles&&dustGeometry){ dustParticles.visible=appState.isDustStorm; if(appState.isDustStorm){const positions=dustGeometry.attributes.position.array; for(let i=0;i<MAX_DUST_MOTES;i++){ const p=dustData[i]; p.position.addScaledVector(p.velocity,deltaTime); p.velocity.x+=(Math.random()-0.5)*50*deltaTime; p.velocity.z+=(Math.random()-0.5)*50*deltaTime; p.position.y=Math.max(1,Math.min(50,p.position.y+(Math.random()-0.5)*10*deltaTime)); if(p.position.x<-gameWidth*0.1)p.position.x+=gameWidth*1.2; if(p.position.x>gameWidth*1.1)p.position.x-=gameWidth*1.2; if(p.position.z<-gameHeight*0.1)p.position.z+=gameHeight*1.2; if(p.position.z>gameHeight*1.1)p.position.z-=gameHeight*1.2; positions[i*3]=p.position.x;positions[i*3+1]=p.position.y;positions[i*3+2]=p.position.z;} dustGeometry.attributes.position.needsUpdate=true;}}
    }

    // --- Specific Object Updates ---
    function updateSnake(snakeData) {
        if (!snakeMesh||!snakeData) return; snakeMesh.visible=snakeData.isActiveFromServer;
        if(snakeData.isActiveFromServer&&snakeData.segments&&snakeData.segments.length>1){
            const curvePoints=snakeData.segments.map(seg=>new THREE.Vector3(seg.x,DEF_SNAKE_RADIUS,seg.y));
            if (curvePoints.length >= 2) { const curve=new THREE.CatmullRomCurve3(curvePoints); const newGeometry=new THREE.TubeGeometry(curve,DEF_SNAKE_SEGMENTS,DEF_SNAKE_RADIUS,5,false); newGeometry.name = "SnakeGeo_Updated"; snakeMesh.geometry.dispose(); snakeMesh.geometry=newGeometry; } else { snakeMesh.visible = false; }
        } else { snakeMesh.visible = false; }
    }
    function updateCampfire(campfireData, deltaTime) {
        if (!campfireGroup || !campfireData) return;
        campfireGroup.visible = campfireData.active;
        if (campfireData.active) {
            campfireGroup.position.set(campfireData.x, 0, campfireData.y);
            const glowLight = campfireGroup.userData.glowLight; if (glowLight) glowLight.intensity = 1.5 + Math.sin(performance.now() * 0.002) * 0.5;
            if (flameParticles && flameGeometry) {
                 const positions = flameGeometry.attributes.position.array; const colors = flameGeometry.attributes.color.array; const alphas = flameGeometry.attributes.alpha.array; let aliveCount = 0; let firstInactiveFlame = 0;
                 for(let i=0; i < MAX_FLAMES; i++) { const p = flameData[i]; if (p.life <= 0 && Math.random() < 0.15 && i >= firstInactiveFlame) { p.position.set((Math.random()-0.5)*15, FLAME_PARTICLE_Y_OFFSET, (Math.random()-0.5)*15); p.velocity.set((Math.random()-0.5)*15, 45 + Math.random()*25, (Math.random()-0.5)*15); p.life = p.baseLife; p.alpha = 0.8 + Math.random()*0.2; p.color.setHSL(0.1, 1.0, 0.6 + Math.random()*0.1); firstInactiveFlame = i + 1; } if (p.life > 0) { p.life -= deltaTime; if (p.life <= 0) { p.alpha=0; p.position.y=-1000; } else { p.position.addScaledVector(p.velocity, deltaTime); p.velocity.y += (Math.random()-0.45)*60*deltaTime; p.alpha = Math.max(0, (p.life / p.baseLife) * 0.9); p.color.lerp(new THREE.Color(0.9, 0.2, 0), deltaTime * 1.1); aliveCount++; } positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; alphas[i]=p.alpha; } else { if (alphas[i] > 0) alphas[i] = 0.0; } }
                 if (aliveCount > 0) { flameGeometry.attributes.position.needsUpdate=true; flameGeometry.attributes.color.needsUpdate=true; flameGeometry.attributes.alpha.needsUpdate=true; }
            }
        }
    }

    // --- Screen Position Calculation ---
    function getScreenPosition(worldPosition, cameraRef, rendererRef) {
        const vector=worldPosition.clone(); vector.project(cameraRef);
        // Make sure renderer has been initialized and has a domElement
        if (!rendererRef || !rendererRef.domElement) return { x: 0, y: 0 };
        const screenX=Math.round((vector.x+1)*rendererRef.domElement.width/2);
        const screenY=Math.round((-vector.y+1)*rendererRef.domElement.height/2);
        return{x:screenX,y:screenY};
    }

    // --- Main Render Function ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) { return; }
        let dimensionsChanged = false; if (appState.canvasWidth && appState.canvasHeight && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) { gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight; dimensionsChanged = true; } if (dimensionsChanged) handleResize();
        const now = performance.now(); const deltaTime = appState.lastLoopTime ? Math.min(0.1, (now - appState.lastLoopTime) / 1000) : 0.016;

        if (shakeMagnitude > 0 && now < shakeEndTime) { const timeRemaining=shakeEndTime-now; const initialDurationEst=Math.max(1,shakeEndTime-(now-timeRemaining)); const currentMag=shakeMagnitude*Math.max(0,timeRemaining/initialDurationEst); const shakeAngle=Math.random()*Math.PI*2; screenShakeOffset.x=Math.cos(shakeAngle)*currentMag; screenShakeOffset.z=Math.sin(shakeAngle)*currentMag; } else { shakeMagnitude = 0; screenShakeOffset.set(0, 0, 0); }
        camera.position.set( gameWidth / 2 + screenShakeOffset.x, 1000, gameHeight / 2 + screenShakeOffset.z );

        updateEnvironment(stateToRender.is_night); updateMuzzleFlash(appState, localEffects.muzzleFlash); updateHitSparks(localEffects.activeBloodSparkEffects, deltaTime); updateAmmoCasings(localEffects.activeAmmoCasings); updateWeatherParticles(appState, deltaTime); updateSnake(localEffects.snake); updateCampfire(stateToRender.campfire, deltaTime);
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, (d) => PLAYER_MESH_Y_OFFSET, localEffects, appState); updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, (d) => d.type === 'giant' ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET, localEffects, appState); updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, (d) => BULLET_MESH_Y_OFFSET, localEffects, appState); updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, (d) => POWERUP_MESH_Y_OFFSET, localEffects, appState);
        updatePlayerAiming(appState);

        const uiPositions = {}; const calculateUIPos = (meshDict, stateDict, yOffsetFn) => { for (const id in meshDict) { const mesh = meshDict[id]; if (mesh && stateDict?.[id] && mesh.visible) { const worldPos = mesh.position.clone(); worldPos.y += yOffsetFn(stateDict[id]) * 1.1; const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } } };
        calculateUIPos(playerMeshes, stateToRender.players, (d) => PLAYER_MESH_Y_OFFSET); calculateUIPos(enemyMeshes, stateToRender.enemies, (d) => d.type === 'giant' ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET);
        if (stateToRender.damage_texts) { for (const id in stateToRender.damage_texts) { const dt = stateToRender.damage_texts[id]; const worldPos = new THREE.Vector3(dt.x, PLAYER_MESH_Y_OFFSET, dt.y); const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } }
        appState.uiPositions = uiPositions;

        try {
             renderer.render(scene, camera);
        } catch (e) {
            console.error("Critical error during renderer.render():", e);
            // Consider stopping the game loop if render fails catastrophically
             if (appState.animationFrameId) {
                  cancelAnimationFrame(appState.animationFrameId);
                  appState.animationFrameId = null;
             }
        }
    }

    // --- Effect Triggers ---
    function triggerShake(magnitude, durationMs) { const now=performance.now(); const newEndTime=now+durationMs; if(magnitude>=shakeMagnitude||newEndTime>shakeEndTime){shakeMagnitude=Math.max(magnitude,shakeMagnitude); shakeEndTime=Math.max(newEndTime,shakeEndTime);} }

    // --- Cleanup ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup Final ---"); window.removeEventListener('resize', handleResize);
        if(hitSparkGeometry)hitSparkGeometry.dispose(); if(rainGeometry)rainGeometry.dispose(); if(dustGeometry)dustGeometry.dispose(); if(flameGeometry)flameGeometry.dispose();
        if(sparkMaterial)sparkMaterial.dispose(); if(rainMaterial)rainMaterial.dispose(); if(dustMaterial)dustMaterial.dispose(); if(flameMaterial){flameMaterial.map?.dispose(); flameMaterial.dispose();}
        scene?.remove(ammoCasingMesh); ammoCasingMesh=null; scene?.remove(snakeMesh); if(snakeMesh?.geometry)snakeMesh.geometry.dispose(); snakeMesh=null; scene?.remove(campfireGroup); campfireGroup=null;
        while(scene?.children.length > 0){ const child = scene.children[0]; scene.remove(child); if(child.geometry) child.geometry.dispose(); if(child.material){if(Array.isArray(child.material))child.material.forEach(m => m.dispose()); else if(child.material.dispose)child.material.dispose();} if(child instanceof THREE.Light && child.dispose)child.dispose();}
        playerGeometry.dispose(); enemyChaserGeometry.dispose(); enemyShooterGeometry.dispose(); enemyGiantGeometry.dispose(); bulletGeometry.dispose(); powerupGeometry.dispose(); logGeometry.dispose(); casingGeometry.dispose();
        Object.values(powerupMaterials).forEach(m => m.dispose()); playerMaterialBase.dispose(); enemyChaserMaterialBase.dispose(); enemyShooterMaterialBase.dispose(); enemyGiantMaterialBase.dispose(); bulletPlayerMaterial.dispose(); bulletEnemyMaterial.dispose(); snakeMaterial.dispose(); logMaterial.dispose(); casingMaterial.dispose();
        groundDayMaterial.dispose(); groundNightMaterial.dispose(); flameTexture.dispose(); // Dispose the flame texture map
        if (renderer) { renderer.dispose(); if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer = null; }
        scene = null; camera = null; groundPlane = null; ambientLight = null; directionalLight = null; muzzleFlashLight = null; flameParticles = null; hitSparkParticles = null; rainParticles = null; dustParticles = null;
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]); Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]); Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]); Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);
        sparkData.length = 0; rainData.length = 0; dustData.length = 0; flameData.length = 0;
        console.log("Renderer3D resources released.");
    }

    return { init, renderScene, triggerShake, cleanup };

})();

export default Renderer3D;
