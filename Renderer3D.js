// Renderer3D.js - FINAL CORRECTED (Definitions Fixed)
import * as THREE from 'three';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing Final Corrected ---");

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
    let rainLines = null; let rainGeometry = null; // Rain uses lines
    let dustParticles = null; let dustGeometry = null;
    let ammoCasingMesh = null; let flameGeometry = null;

    const MAX_SPARKS = 100; const MAX_RAIN_DROPS = 500; const MAX_DUST_MOTES = 300;
    const MAX_CASINGS = 100; const MAX_FLAMES = 50;

    // --- Internal Constants ---
    const DEF_PLAYER_WIDTH = 25; const DEF_PLAYER_HEIGHT = 48; const DEF_PLAYER_HEAD_RADIUS = 8;
    const DEF_ENEMY_WIDTH = 20; const DEF_ENEMY_HEIGHT = 40; const DEF_ENEMY_HEAD_RADIUS = 6;
    const DEF_GIANT_MULTIPLIER = 2.5; const DEF_BULLET_RADIUS = 4;
    const DEF_POWERUP_SIZE = 15; const DEF_SNAKE_SEGMENTS = 30;
    const DEF_SNAKE_RADIUS = 4; const DEF_LOG_RADIUS = 4; const DEF_LOG_LENGTH = 35;
    const DEF_CASING_RADIUS = 0.5; const DEF_CASING_LENGTH = 3;
    const DEF_GUN_LENGTH = 20; const DEF_GUN_RADIUS = 1.5;

    // --- Materials ---
    const playerMaterialBase = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.3, name: 'PlayerMatBase' });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: 'HeadMat' });
    const enemySharedMaterialProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    const enemyChaserMaterialBase = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemySharedMaterialProps, name: 'EnemyChaserMatBase' });
    const enemyShooterMaterialBase = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemySharedMaterialProps, name: 'EnemyShooterMatBase' });
    const enemyGiantMaterialBase = new THREE.MeshStandardMaterial({ color: 0xa00000, roughness: 0.5, metalness: 0.3, transparent: true, opacity: 1.0, name: 'EnemyGiantMatBase' });
    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: 'BulletPlayerMat' });
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, name: 'BulletEnemyMat' });
    const powerupMaterials = { /* Cloned on use */
        default: new THREE.MeshStandardMaterial({ color: 0x888888, name: 'PowerupDefaultMat' }), health: new THREE.MeshStandardMaterial({ color: 0x81c784, name: 'PowerupHealthMat' }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x6a0dad, emissive: 0x110011, name: 'PowerupGunMat' }),
        speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3, name: 'PowerupSpeedMat' }),
        armor: new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.7, name: 'PowerupArmorMat' }),
        ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500, name: 'PowerupShotgunMat' }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D, name: 'PowerupSlugMat' }),
        ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00, emissive: 0x333300, name: 'PowerupRapidMat' }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.6, name: 'PowerupScoreMat' }),
    };
    const groundDayMaterial = new THREE.MeshStandardMaterial({ color: 0x7a8c79, roughness: 0.85, metalness: 0.05, name: 'GroundDayMat' });
    const groundNightMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8, metalness: 0.1, name: 'GroundNightMat' });
    const snakeMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, name: 'SnakeMat' });
    const logMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: 'LogMat' });
    const sparkMaterial = new THREE.PointsMaterial({ size: 9, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'SparkMat' });
    const rainMaterial = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: 'RainMat' });
    const dustMaterial = new THREE.PointsMaterial({ size: 45, color: 0xd2b48c, transparent: true, opacity: 0.1, sizeAttenuation: true, depthWrite: false, name: 'DustMat' });
    const casingMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: 'CasingMat' });
    const flameTexture = createFlameTexture();
    const flameMaterial = new THREE.PointsMaterial({ size: 15, vertexColors: true, map: flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'FlameMat' });
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: 'GunMat' });

    // --- Geometries (DEFINED AT MODULE SCOPE) ---
    const playerBodyGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8); playerBodyGeometry.name = "PlayerBodyGeo";
    const headGeometry = new THREE.SphereGeometry(1, 12, 8); headGeometry.name = "HeadGeo"; // Scaled per use
    const enemyChaserGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH, DEF_ENEMY_HEIGHT, DEF_ENEMY_WIDTH * 0.7); enemyChaserGeometry.name = "EnemyChaserGeo";
    const enemyShooterGeometry = new THREE.CylinderGeometry(DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_HEIGHT, 8); enemyShooterGeometry.name = "EnemyShooterGeo";
    const enemyGunGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * 0.3, DEF_ENEMY_WIDTH * 0.3, DEF_ENEMY_WIDTH * 1.5); enemyGunGeometry.name = "EnemyGunGeo";
    const enemyGiantGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * DEF_GIANT_MULTIPLIER, DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER, DEF_ENEMY_WIDTH * 0.7 * DEF_GIANT_MULTIPLIER); enemyGiantGeometry.name = "EnemyGiantGeo";
    const bulletGeometry = new THREE.SphereGeometry(DEF_BULLET_RADIUS, 6, 6); bulletGeometry.name = "BulletGeo";
    // Powerup Geometries (Defined here!)
    const powerupBoxGeometry = new THREE.BoxGeometry(DEF_POWERUP_SIZE, DEF_POWERUP_SIZE, DEF_POWERUP_SIZE); powerupBoxGeometry.name = "PowerupBoxGeo";
    const powerupHealthGeo = new THREE.TorusGeometry(DEF_POWERUP_SIZE * 0.4, DEF_POWERUP_SIZE * 0.15, 8, 16); powerupHealthGeo.name = "PowerupHealthGeo";
    const powerupGunGeo = new THREE.ConeGeometry(DEF_POWERUP_SIZE * 0.5, DEF_POWERUP_SIZE, 4); powerupGunGeo.name = "PowerupGunGeo";
    const powerupSpeedGeo = new THREE.CylinderGeometry(DEF_POWERUP_SIZE*0.7, DEF_POWERUP_SIZE*0.7, DEF_POWERUP_SIZE*0.3, 16); powerupSpeedGeo.name = "PowerupSpeedGeo"; // Changed to Disk
    const powerupArmorGeo = new THREE.OctahedronGeometry(DEF_POWERUP_SIZE * 0.6, 0); powerupArmorGeo.name = "PowerupArmorGeo";
    const powerupShotgunGeo = new THREE.BoxGeometry(DEF_POWERUP_SIZE*0.8, DEF_POWERUP_SIZE*0.8, DEF_POWERUP_SIZE*0.8); powerupShotgunGeo.name = "PowerupShotgunGeo"; // Keep as box for now
    const powerupSlugGeo = new THREE.SphereGeometry(DEF_POWERUP_SIZE * 0.6, 12, 8); powerupSlugGeo.name = "PowerupSlugGeo";
    const powerupRapidGeo = new THREE.TorusGeometry(DEF_POWERUP_SIZE * 0.4, DEF_POWERUP_SIZE * 0.1, 6, 12); powerupRapidGeo.name = "PowerupRapidGeo";
    const powerupScoreGeo = new THREE.CylinderGeometry(DEF_POWERUP_SIZE*0.4, DEF_POWERUP_SIZE*0.4, DEF_POWERUP_SIZE*0.5, 12); powerupScoreGeo.name = "PowerupScoreGeo";
    // Other Geometries
    const logGeometry = new THREE.CylinderGeometry(DEF_LOG_RADIUS, DEF_LOG_RADIUS, DEF_LOG_LENGTH, 6); logGeometry.name = "LogGeo";
    const casingGeometry = new THREE.CylinderGeometry(DEF_CASING_RADIUS, DEF_CASING_RADIUS, DEF_CASING_LENGTH, 6); casingGeometry.name = "CasingGeo";
    const groundGeometryPlane = new THREE.PlaneGeometry(1, 1); groundGeometryPlane.name = "GroundGeo";
    const gunGeometry = new THREE.CylinderGeometry(DEF_GUN_RADIUS, DEF_GUN_RADIUS * 0.8, DEF_GUN_LENGTH, 8); gunGeometry.name = "GunGeo";

    // --- Mesh Positioning Offsets ---
    const PLAYER_Y_OFFSET = 0; // Group at Y=0, body positioned inside
    const PLAYER_BODY_Y_OFFSET = DEF_PLAYER_HEIGHT / 2; // Body relative to group
    const ENEMY_Y_OFFSET = DEF_ENEMY_HEIGHT / 2; // Enemy mesh pivot at base
    const GIANT_Y_OFFSET = (DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER) / 2;
    const BULLET_Y_OFFSET = DEF_BULLET_RADIUS; const POWERUP_Y_OFFSET = DEF_POWERUP_SIZE * 0.8;
    const CAMPFIRE_LOG_Y_OFFSET = DEF_LOG_RADIUS; const FLAME_PARTICLE_Y_OFFSET = DEF_LOG_RADIUS + 2;

    // --- Particle Data Storage ---
    const sparkData = []; const rainData = []; const dustData = []; const flameData = [];

    // --- Texture Helper ---
    function createFlameTexture() { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const context = canvas.getContext('2d'); const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255, 220, 150, 1)'); gradient.addColorStop(0.4, 'rgba(255, 150, 0, 0.8)'); gradient.addColorStop(1, 'rgba(200, 0, 0, 0)'); context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); const texture = new THREE.CanvasTexture(canvas); texture.name = "FlameTexture"; return texture; }

    // --- Initialization ---
    function init(containerElement, initialWidth, initialHeight) {
        console.log("--- Renderer3D.init() Final Revised ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }
        gameWidth = initialWidth || 1600; gameHeight = initialHeight || 900;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(gameWidth, gameHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; containerElement.appendChild(renderer.domElement);
            scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2a28);
            const aspect = gameWidth / gameHeight; const frustumSize = gameHeight; camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 2000); camera.position.set(gameWidth / 2, 1000, gameHeight / 2); camera.rotation.x = -Math.PI / 2; scene.add(camera);
            ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); directionalLight.position.set(gameWidth * 0.2, 300, gameHeight * 0.3); directionalLight.castShadow = true; directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048; directionalLight.shadow.camera.near = 50; directionalLight.shadow.camera.far = 700; directionalLight.shadow.camera.left = -gameWidth / 1.5; directionalLight.shadow.camera.right = gameWidth / 1.5; directionalLight.shadow.camera.top = gameHeight / 1.5; directionalLight.shadow.camera.bottom = -gameHeight / 1.5; scene.add(directionalLight); scene.add(directionalLight.target);
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.5); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);
            groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial); groundPlane.scale.set(gameWidth * 1.1, gameHeight * 1.1, 1); groundPlane.rotation.x = -Math.PI / 2; groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2); groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane"; scene.add(groundPlane);
            initSparkParticles(); initWeatherParticles(); initAmmoCasings(); initCampfire(); initSnake();
            window.addEventListener('resize', handleResize); handleResize();
        } catch (error) { console.error("!!! CRITICAL ERROR during Renderer3D Init !!!", error); if (containerElement) containerElement.innerHTML = "<p style='color:red; text-align: center;'>Error initializing 3D graphics.</p>"; return false; }
        console.log("--- Renderer3D initialization complete ---"); return true;
    }

    function initSparkParticles() {
        hitSparkGeometry = new THREE.BufferGeometry(); hitSparkGeometry.name = "SparkGeo"; const positions = new Float32Array(MAX_SPARKS * 3); const colors = new Float32Array(MAX_SPARKS * 3); const alphas = new Float32Array(MAX_SPARKS); sparkData.length = 0;
        for(let i = 0; i < MAX_SPARKS; i++) { sparkData.push({ position: new THREE.Vector3(0,-1000,0), velocity: new THREE.Vector3(), color: new THREE.Color(0xff0000), alpha: 0.0, life: 0 }); alphas[i] = 0.0; positions[i*3+1] = -1000; }
        hitSparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); hitSparkGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); hitSparkGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        hitSparkParticles = new THREE.Points(hitSparkGeometry, sparkMaterial); hitSparkParticles.name = "HitSparks"; hitSparkParticles.visible = true; scene.add(hitSparkParticles);
    }
    function initWeatherParticles() {
        rainGeometry = new THREE.BufferGeometry(); rainGeometry.name = "RainGeo"; const rainPositions = new Float32Array(MAX_RAIN_DROPS * 6); rainData.length = 0;
        for (let i = 0; i < MAX_RAIN_DROPS; i++) { rainData.push({ position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, gameHeight*1.5 , Math.random()*gameHeight*1.2-gameHeight*0.1), velocity: new THREE.Vector3(15 + Math.random()*8, -400 - Math.random()*150, 0) }); } // Init offscreen Y handled later
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)); rainLines = new THREE.LineSegments(rainGeometry, rainMaterial); rainLines.name = "Rain"; rainLines.visible = false; scene.add(rainLines);
        dustGeometry = new THREE.BufferGeometry(); dustGeometry.name = "DustGeo"; const dustPositions = new Float32Array(MAX_DUST_MOTES * 3); dustData.length = 0;
        for (let i = 0; i < MAX_DUST_MOTES; i++) { dustData.push({ position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, Math.random()*50 + 5 , Math.random()*gameHeight*1.2-gameHeight*0.1), velocity: new THREE.Vector3((Math.random()-0.5)*50, Math.random()*5, (Math.random()-0.5)*50), rotation: Math.random() * Math.PI * 2 }); dustPositions[i*3+1] = -1000; }
        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3)); dustParticles = new THREE.Points(dustGeometry, dustMaterial); dustParticles.name = "Dust"; dustParticles.visible = false; scene.add(dustParticles);
    }
    function initAmmoCasings() { ammoCasingMesh = new THREE.InstancedMesh(casingGeometry, casingMaterial, MAX_CASINGS); ammoCasingMesh.name = "AmmoCasings"; ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; scene.add(ammoCasingMesh); }
    function initCampfire() {
        campfireGroup = new THREE.Group(); campfireGroup.name = "CampfireGroup"; const log1 = new THREE.Mesh(logGeometry, logMaterial); log1.rotation.z = Math.PI / 6; log1.rotation.y = Math.PI / 10; log1.castShadow = true; log1.name = "Log1"; log1.position.y = CAMPFIRE_LOG_Y_OFFSET;
        const log2 = new THREE.Mesh(logGeometry, logMaterial); log2.rotation.z = -Math.PI / 5; log2.rotation.y = -Math.PI / 8; log2.castShadow = true; log2.name = "Log2"; log2.position.y = CAMPFIRE_LOG_Y_OFFSET; campfireGroup.add(log1); campfireGroup.add(log2);
        const glowLight = new THREE.PointLight(0xffa500, 0, 150, 1.8); glowLight.position.y = FLAME_PARTICLE_Y_OFFSET + 5; glowLight.name = "CampfireGlow"; campfireGroup.add(glowLight); campfireGroup.userData.glowLight = glowLight;
        flameGeometry = new THREE.BufferGeometry(); flameGeometry.name = "FlameGeo"; const flamePositions = new Float32Array(MAX_FLAMES * 3); const flameColors = new Float32Array(MAX_FLAMES * 3); const flameAlphas = new Float32Array(MAX_FLAMES); flameData.length = 0;
        for(let i=0; i < MAX_FLAMES; i++) { flameData.push({ position: new THREE.Vector3(0,-1000,0), velocity: new THREE.Vector3(), color: new THREE.Color(1,1,1), alpha: 0.0, life: 0, baseLife: 0.5 + Math.random()*0.4 }); flamePositions[i*3+1]=-1000; flameAlphas[i]=0.0; }
        flameGeometry.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3)); flameGeometry.setAttribute('color', new THREE.BufferAttribute(flameColors, 3)); flameGeometry.setAttribute('alpha', new THREE.BufferAttribute(flameAlphas, 1));
        flameParticles = new THREE.Points(flameGeometry, flameMaterial); flameParticles.name = "Flames"; campfireGroup.add(flameParticles); campfireGroup.userData.flameParticles = flameParticles;
        campfireGroup.visible = false; scene.add(campfireGroup);
    }
    function initSnake() { const curve = new THREE.CatmullRomCurve3( [ new THREE.Vector3(0,DEF_SNAKE_RADIUS,0), new THREE.Vector3(10,DEF_SNAKE_RADIUS,0)] ); const snakeGeometry = new THREE.TubeGeometry(curve, DEF_SNAKE_SEGMENTS, DEF_SNAKE_RADIUS, 5, false); snakeGeometry.name = "SnakeGeo"; snakeMesh = new THREE.Mesh(snakeGeometry, snakeMaterial); snakeMesh.name = "Snake"; snakeMesh.castShadow = true; snakeMesh.visible = false; scene.add(snakeMesh); }

    // --- Resize Handler ---
    function handleResize() { if (!renderer || !camera) return; renderer.setSize(gameWidth, gameHeight); const aspect = gameWidth / gameHeight; const frustumSize = gameHeight; camera.left = frustumSize * aspect / -2; camera.right = frustumSize * aspect / 2; camera.top = frustumSize / 2; camera.bottom = frustumSize / -2; camera.position.set(gameWidth / 2, 1000, gameHeight / 2); camera.lookAt(gameWidth / 2, 0, gameHeight / 2); camera.updateProjectionMatrix(); console.log(`Renderer resized to: ${gameWidth}x${gameHeight}`); }

    // --- Entity Creation Functions ---
    function createPlayerMesh(playerData) {
        const playerGroup = new THREE.Group(); playerGroup.name = `PlayerGroup_${playerData.id.substring(0,4)}`;
        const bodyMat = playerMaterialBase.clone(); bodyMat.name = `PlayerMat_${playerData.id.substring(0,4)}`;
        const bodyMesh = new THREE.Mesh(playerBodyGeometry, bodyMat); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.position.y = PLAYER_BODY_Y_OFFSET; bodyMesh.name = "PlayerBody"; playerGroup.add(bodyMesh);
        const headMesh = new THREE.Mesh(headGeometry, headMaterial.clone()); headMesh.scale.setScalar(DEF_PLAYER_HEAD_RADIUS); headMesh.position.y = DEF_PLAYER_HEIGHT * 0.95; headMesh.castShadow = true; headMesh.name = "PlayerHead"; playerGroup.add(headMesh);
        const gunMesh = new THREE.Mesh(gunGeometry, gunMaterial); gunMesh.position.set(0, PLAYER_BODY_Y_OFFSET * 0.8, DEF_PLAYER_WIDTH * 0.5); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; gunMesh.name = "PlayerGun"; playerGroup.add(gunMesh);
        playerGroup.position.set(playerData.x, PLAYER_Y_OFFSET, playerData.y); // Set group base position
        playerGroup.userData.gameId = playerData.id; playerGroup.userData.bodyMesh = bodyMesh; playerGroup.userData.headMesh = headMesh; playerGroup.userData.gunMesh = gunMesh;
        return playerGroup;
    }
    function createEnemyMesh(enemyData){
        const enemyGroup = new THREE.Group(); enemyGroup.name = `EnemyGroup_${enemyData.type}_${enemyData.id.substring(0,4)}`;
        let bodyMesh, yOffset=ENEMY_Y_OFFSET, bodyMat;
        const headScale = (enemyData.type === 'giant') ? DEF_ENEMY_HEAD_RADIUS * DEF_GIANT_MULTIPLIER * 0.8 : DEF_ENEMY_HEAD_RADIUS;
        const headMesh = new THREE.Mesh(headGeometry, headMaterial.clone()); headMesh.scale.setScalar(headScale); headMesh.castShadow = true; headMesh.name = "EnemyHead";

        if(enemyData.type==='giant'){ bodyMat=enemyGiantMaterialBase.clone(); bodyMesh=new THREE.Mesh(enemyGiantGeometry,bodyMat); yOffset=GIANT_Y_OFFSET; }
        else if(enemyData.type==='shooter'){ bodyMat=enemyShooterMaterialBase.clone(); bodyMesh=new THREE.Mesh(enemyShooterGeometry,bodyMat); const enemyGun = new THREE.Mesh(enemyGunGeometry, gunMaterial); enemyGun.position.set(0, yOffset * 0.6, DEF_ENEMY_WIDTH * 0.6); enemyGun.rotation.x = Math.PI / 2; enemyGun.castShadow = true; enemyGun.name="EnemyGun"; enemyGroup.add(enemyGun); }
        else{ bodyMat=enemyChaserMaterialBase.clone(); bodyMesh=new THREE.Mesh(enemyChaserGeometry,bodyMat); }
        bodyMesh.castShadow=true; bodyMesh.receiveShadow=true; bodyMesh.position.y = yOffset; bodyMesh.name = "EnemyBody";
        headMesh.position.y = yOffset * 1.8 + (enemyData.type === 'giant' ? 10 : 0); // Position head relative to body top, higher for giant

        enemyGroup.add(bodyMesh); enemyGroup.add(headMesh);
        enemyGroup.position.set(enemyData.x, 0, enemyData.y); // Group at Y=0
        enemyGroup.userData.gameId=enemyData.id; enemyGroup.userData.type=enemyData.type;
        enemyGroup.userData.bodyMesh = bodyMesh; // Reference main body mesh
        return enemyGroup;
    }
    function createBulletMesh(bulletData){ const mat=bulletData.owner_type==='player'?bulletPlayerMaterial:bulletEnemyMaterial; const m=new THREE.Mesh(bulletGeometry,mat); m.position.set(bulletData.x,BULLET_Y_OFFSET,bulletData.y); m.userData.gameId=bulletData.id; m.name = `Bullet_${bulletData.id.substring(0,4)}`; return m; }
    function createPowerupMesh(powerupData){
        const powerupGroup = new THREE.Group(); powerupGroup.name = `PowerupGroup_${powerupData.type}_${powerupData.id.substring(0,4)}`;
        const mat=(powerupMaterials[powerupData.type]||powerupMaterials.default).clone();
        let iconGeo;
        // Select geometry based on type
        switch(powerupData.type) {
             case 'health': iconGeo = powerupHealthGeo; break;
             case 'gun_upgrade': iconGeo = powerupGunGeo; break;
             case 'speed_boost': iconGeo = powerupSpeedGeo; break;
             case 'armor': iconGeo = powerupArmorGeo; break;
             case 'ammo_shotgun': iconGeo = powerupShotgunGeo; break;
             case 'ammo_heavy_slug': iconGeo = powerupSlugGeo; break;
             case 'ammo_rapid_fire': iconGeo = powerupRapidGeo; break;
             case 'bonus_score': iconGeo = powerupScoreGeo; break;
             default: iconGeo = powerupBoxGeometry;
        }
        const iconMesh = new THREE.Mesh(iconGeo, mat);
        iconMesh.castShadow = true; iconMesh.receiveShadow = true;
        iconMesh.position.y = POWERUP_Y_OFFSET; // Icon floats
        iconMesh.rotation.x = Math.PI / 6; // Angle slightly forward
        iconMesh.rotation.z = Math.PI / 6;
        powerupGroup.add(iconMesh);
        powerupGroup.position.set(powerupData.x, 0, powerupData.y); // Group base at Y=0
        powerupGroup.userData.gameId=powerupData.id; powerupGroup.userData.isPowerup=true;
        powerupGroup.userData.iconMesh = iconMesh;
        return powerupGroup;
    }

    // --- Entity Update & Disposal ---
    function updateMeshes(state, meshDict, createFn, defaultYPosFn, localEffects, appState) {
        const activeIds = new Set();
        if (state) {
            for (const id in state) {
                const data = state[id]; if (typeof data.x !== 'number' || typeof data.y !== 'number') continue; activeIds.add(id);
                let obj = meshDict[id];
                if (!obj) { obj = createFn(data); if (obj) { meshDict[id] = obj; scene.add(obj); } }
                else {
                    obj.position.set(data.x, 0, data.y); // Update group/mesh base position
                    const actualMesh = (obj instanceof THREE.Group) ? obj.userData.bodyMesh || obj.userData.iconMesh : obj;
                    if (!actualMesh || !actualMesh.material) continue;

                    // Enemy Fading
                    if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) { const fadeDuration = 0.4; const timeSinceDeath = (performance.now()/1000) - data.death_timestamp; const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration)); actualMesh.material.opacity = opacity; obj.children.forEach(c => {if(c.material) c.material.opacity = opacity}); actualMesh.visible = opacity > 0.001; obj.children.forEach(c => {c.visible = opacity > 0.001});} // Fade all children too
                    else if (!actualMesh.visible || (actualMesh.material.opacity < 1.0 && actualMesh.material.opacity > 0)) { actualMesh.material.opacity = 1.0; actualMesh.visible = true; obj.children.forEach(c => {if(c.material) c.material.opacity = 1.0; c.visible = true}); } // Reset visibility/opacity

                    // Powerup Animation
                    if (obj.userData.isPowerup && obj.userData.iconMesh) { obj.userData.iconMesh.rotation.y += 0.02; obj.userData.iconMesh.position.y = POWERUP_Y_OFFSET + Math.sin(performance.now() * 0.002) * 3; }

                    // Player Effects & Aiming
                    if (meshDict === playerMeshes && id === appState?.localPlayerId) {
                         const bodyMesh = actualMesh;
                         if (localEffects?.pushbackAnim?.active) { const pushbackProgress = Math.max(0,(localEffects.pushbackAnim.endTime-performance.now())/localEffects.pushbackAnim.duration); const intensity = Math.sin(pushbackProgress*Math.PI)*0.8; bodyMesh.material.emissive.setHex(0x66ccff); bodyMesh.material.emissiveIntensity=intensity; }
                         else if (bodyMesh.material.emissiveIntensity > 0) { bodyMesh.material.emissiveIntensity = 0; }
                         updatePlayerAiming(appState, obj); // Aim the group
                    }
                }
            }
        }
        // Remove & Dispose
        for (const id in meshDict) { if (!activeIds.has(id)) { const objToRemove = meshDict[id]; if (objToRemove) { console.log(`Cleanup: Removing ${objToRemove.name || id}`); scene.remove(objToRemove); disposeObject3D(objToRemove); } delete meshDict[id]; } }
    }
    // Dispose Helper
    function disposeObject3D(obj) { if (!obj) return; if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose()); else if(obj.material.dispose) obj.material.dispose(); } if (obj.texture) obj.texture.dispose(); while(obj.children.length > 0) { disposeObject3D(obj.children[0]); obj.remove(obj.children[0]); } }
    // Get Y offset (Only needed for non-grouped meshes like bullets)
    function getYOffset(entityData) { if (entityData.radius) return BULLET_Y_OFFSET; return 0; }
    // Player Aiming
    function updatePlayerAiming(appState, playerObject) { if (!appState?.localPlayerId || !appState.mouseWorldPosition || !playerObject) return; const targetPos = appState.mouseWorldPosition; playerObject.lookAt(targetPos.x, 0, targetPos.z); }

    // --- Environment Update ---
    function updateEnvironment(isNight) {
        const dayLightIntensity=1.0, nightLightIntensity=0.45; // Brighter night
        const dayAmbientIntensity=0.6, nightAmbientIntensity=0.3; // Brighter ambient night
        const dayDirColor=0xffffff, nightDirColor=0xc0d0ff; const dayAmbColor=0xffffff, nightAmbColor=0x556699;
        ambientLight.intensity=isNight?nightAmbientIntensity:dayAmbientIntensity; ambientLight.color.setHex(isNight?nightAmbColor:dayAmbColor);
        directionalLight.intensity=isNight?nightLightIntensity:dayLightIntensity; directionalLight.color.setHex(isNight?nightDirColor:dayDirColor);
        groundPlane.material=isNight?groundNightMaterial:groundDayMaterial;
        if (isNight) { scene.fog = new THREE.FogExp2(0x081020, 0.001); } else { scene.fog = null; }
    }

    // --- Effect Updates ---
    function updateMuzzleFlash(appState, flashState) {
        if (!muzzleFlashLight || !appState?.localPlayerId) return; const playerGroup = playerMeshes[appState.localPlayerId]; if (!playerGroup || !playerGroup.userData.gunMesh) return; const now = performance.now();
        if (flashState.active && now < flashState.endTime) {
            muzzleFlashLight.intensity = 4.0 + Math.random() * 3.0; const offsetDistance = DEF_GUN_LENGTH * 0.7; const gunMesh = playerGroup.userData.gunMesh;
            const worldPos = new THREE.Vector3(); const worldQuat = new THREE.Quaternion(); gunMesh.getWorldPosition(worldPos); gunMesh.getWorldQuaternion(worldQuat);
            const forward = new THREE.Vector3(0,0,1).applyQuaternion(worldQuat); worldPos.addScaledVector(forward, offsetDistance);
            muzzleFlashLight.position.copy(worldPos);
        } else { muzzleFlashLight.intensity = 0; if (flashState.active) flashState.active = false; }
    }
    function updateHitSparks(activeSparkEffects, deltaTime) {
        if (!hitSparkParticles||!hitSparkGeometry) return; const positions=hitSparkGeometry.attributes.position.array; const colors=hitSparkGeometry.attributes.color.array; const alphas=hitSparkGeometry.attributes.alpha.array; let visibleSparks=false; let firstInactiveIndex=0;
        const now = performance.now();
        for(const enemyId in activeSparkEffects){ const effectEndTime=activeSparkEffects[enemyId]; const enemyMesh=enemyMeshes[enemyId]; if(now < effectEndTime && enemyMesh){ const sparksToSpawn=4+Math.floor(Math.random()*5); const enemyPos=enemyMesh.position; const enemyYOffset = (enemyMesh.userData?.type === 'giant' ? GIANT_Y_OFFSET : ENEMY_Y_OFFSET); for(let i=0;i<sparksToSpawn;i++){ let foundSlot=false; for(let j=firstInactiveIndex; j < MAX_SPARKS; j++){ const p=sparkData[j]; if(p.life<=0){ p.position.copy(enemyPos); p.position.y=enemyYOffset * (0.2 + Math.random()*0.8); const angle=Math.random()*Math.PI*2; const speed=120+Math.random()*90; p.velocity.set(Math.cos(angle)*speed,(Math.random()-0.3)*speed*0.6,Math.sin(angle)*speed); p.color.setRGB(1,Math.random()*0.4,0); p.alpha=1.0; p.life=0.25+Math.random()*0.3; firstInactiveIndex=j+1; foundSlot=true; break;}} if (!foundSlot) break; } delete activeSparkEffects[enemyId]; } }
        let aliveCount=0; for(let i=0;i<MAX_SPARKS;i++){ const p=sparkData[i]; if(p.life>0){ p.life-=deltaTime; if(p.life<=0){p.alpha=0; p.position.y = -1000; } else { p.position.addScaledVector(p.velocity,deltaTime); p.velocity.y-=250*deltaTime; p.alpha=Math.max(0, p.life / (0.25+0.3)); aliveCount++; } positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; alphas[i]=p.alpha; } else { if(alphas[i]>0) alphas[i]=0; } }
        if(aliveCount>0){ hitSparkGeometry.attributes.position.needsUpdate=true; hitSparkGeometry.attributes.color.needsUpdate=true; hitSparkGeometry.attributes.alpha.needsUpdate=true; visibleSparks=true; } hitSparkParticles.visible=visibleSparks;
    }
    function updateAmmoCasings(activeCasings) {
        if (!ammoCasingMesh) return; const dummy=new THREE.Object3D(); let visibleCount=0;
        for(let i=0; i<activeCasings.length && i<MAX_CASINGS; i++){ const casing=activeCasings[i]; dummy.position.set(casing.x,DEF_CASING_LENGTH/2+0.5,casing.y); dummy.rotation.set(Math.PI/2 + (Math.random()-0.5)*1.2, casing.rotation, (Math.random()-0.5)*1.2); dummy.updateMatrix(); ammoCasingMesh.setMatrixAt(i,dummy.matrix); visibleCount++; }
        ammoCasingMesh.count=visibleCount; ammoCasingMesh.instanceMatrix.needsUpdate=true;
    }
    function updateWeatherParticles(appState, deltaTime) {
        if(!appState)return;
        if(rainLines && rainGeometry){ rainLines.visible = appState.isRaining; if(appState.isRaining){const positions=rainGeometry.attributes.position.array; const rainSpeed = 450; const streakLengthFactor = 0.04; for(let i=0; i<MAX_RAIN_DROPS; i++){ const p = rainData[i]; p.position.y -= rainSpeed * deltaTime; if(p.position.y < -20){ p.position.x = Math.random()*gameWidth*1.2 - gameWidth*0.1; p.position.y = gameHeight*1.2 + Math.random() * 100; p.position.z = Math.random()*gameHeight*1.2 - gameHeight*0.1;} const endY = p.position.y - rainSpeed * streakLengthFactor; positions[(i*6) + 0] = p.position.x; positions[(i*6) + 1] = p.position.y; positions[(i*6) + 2] = p.position.z; positions[(i*6) + 3] = p.position.x; positions[(i*6) + 4] = endY; positions[(i*6) + 5] = p.position.z;} rainGeometry.attributes.position.needsUpdate=true;}}
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
        if (!campfireGroup || !campfireData) return; campfireGroup.visible = campfireData.active;
        if (campfireData.active) {
            campfireGroup.position.set(campfireData.x, 0, campfireData.y); const glowLight = campfireGroup.userData.glowLight; if (glowLight) glowLight.intensity = 1.8 + Math.sin(performance.now() * 0.0025) * 0.6;
            if (flameParticles && flameGeometry) {
                 const positions = flameGeometry.attributes.position.array; const colors = flameGeometry.attributes.color.array; const alphas = flameGeometry.attributes.alpha.array; let aliveCount = 0; let firstInactiveFlame = 0;
                 for(let i=0; i < MAX_FLAMES; i++) { const p = flameData[i]; if (p.life <= 0 && Math.random() < 0.2 && i >= firstInactiveFlame) { p.position.set((Math.random()-0.5)*15, FLAME_PARTICLE_Y_OFFSET, (Math.random()-0.5)*15); p.velocity.set((Math.random()-0.5)*18, 50 + Math.random()*30, (Math.random()-0.5)*18); p.life = p.baseLife; p.alpha = 0.8 + Math.random()*0.2; p.color.setHSL(0.08 + Math.random()*0.04, 1.0, 0.6 + Math.random()*0.1); firstInactiveFlame = i + 1; } if (p.life > 0) { p.life -= deltaTime; if (p.life <= 0) { p.alpha=0; p.position.y=-1000; } else { p.position.addScaledVector(p.velocity, deltaTime); p.velocity.y += (Math.random()-0.45)*60*deltaTime; p.velocity.x *= 0.96; p.velocity.z *= 0.96; p.alpha = Math.max(0, (p.life / p.baseLife) * 1.1); p.color.lerp(new THREE.Color(1.0, 0.1, 0), deltaTime * 1.3); aliveCount++; } positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; alphas[i]=p.alpha; } else { if (alphas[i] > 0) alphas[i] = 0.0; } }
                 if (aliveCount > 0) { flameGeometry.attributes.position.needsUpdate=true; flameGeometry.attributes.color.needsUpdate=true; flameGeometry.attributes.alpha.needsUpdate=true; }
            }
        }
    }

    // --- Screen Position Calculation ---
    function getScreenPosition(worldPosition, cameraRef, rendererRef) { try { const vector=worldPosition.clone(); vector.project(cameraRef); if (!rendererRef || !rendererRef.domElement) return { x: 0, y: 0 }; const screenX=Math.round((vector.x+1)*rendererRef.domElement.width/2); const screenY=Math.round((-vector.y+1)*rendererRef.domElement.height/2); return{x:screenX,y:screenY}; } catch (e) { console.error("Error getScreenPosition:", e, "WorldPos:", worldPosition); return { x: 0, y: 0 }; } }

    // --- Main Render Function ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) return;
        let dimensionsChanged = false; if (appState.canvasWidth && appState.canvasHeight && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) { gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight; dimensionsChanged = true; } if (dimensionsChanged) handleResize();
        const now = performance.now(); const deltaTime = appState.lastLoopTime ? Math.min(0.1, (now - appState.lastLoopTime) / 1000) : 0.016;

        if (shakeMagnitude > 0 && now < shakeEndTime) { const timeRemaining=shakeEndTime-now; const initialDurationEst=Math.max(1,shakeEndTime-(now-timeRemaining)); const currentMag=shakeMagnitude*Math.max(0,timeRemaining/initialDurationEst); const shakeAngle=Math.random()*Math.PI*2; screenShakeOffset.x=Math.cos(shakeAngle)*currentMag; screenShakeOffset.z=Math.sin(shakeAngle)*currentMag; } else { shakeMagnitude = 0; screenShakeOffset.set(0, 0, 0); }
        camera.position.set( gameWidth / 2 + screenShakeOffset.x, 1000, gameHeight / 2 + screenShakeOffset.z ); camera.lookAt(gameWidth / 2 + screenShakeOffset.x, 0, gameHeight / 2 + screenShakeOffset.z );

        updateEnvironment(stateToRender.is_night); updateMuzzleFlash(appState, localEffects.muzzleFlash); updateHitSparks(localEffects.activeBloodSparkEffects, deltaTime); updateAmmoCasings(localEffects.activeAmmoCasings); updateWeatherParticles(appState, deltaTime); updateSnake(localEffects.snake); updateCampfire(stateToRender.campfire, deltaTime);
        // Define Y position function for mesh updates (Groups are at Y=0, others calculated)
        const getYPos = (data) => (data.radius ? BULLET_Y_OFFSET : 0); // Bullets need specific Y, groups are at 0
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, (d)=>0, localEffects, appState);
        updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, (d)=>0, localEffects, appState);
        updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, getYPos, localEffects, appState);
        updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, (d)=>0, localEffects, appState);

        const uiPositions = {}; const calculateUIPos = (meshDict, stateDict, yOffsetVal) => { for (const id in meshDict) { const obj = meshDict[id]; if (obj && stateDict?.[id] && obj.visible !== false) { const worldPos = obj.position.clone(); worldPos.y = yOffsetVal; const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } } };
        // Calculate UI positions based on the *visual height* of the models
        calculateUIPos(playerMeshes, stateToRender.players, PLAYER_BODY_Y_OFFSET + DEF_PLAYER_HEAD_RADIUS*1.5); // Above player head
        calculateUIPos(enemyMeshes, stateToRender.enemies, (d) => (d.type === 'giant' ? GIANT_Y_OFFSET : ENEMY_Y_OFFSET) + (d.type === 'giant' ? DEF_ENEMY_HEAD_RADIUS * DEF_GIANT_MULTIPLIER : DEF_ENEMY_HEAD_RADIUS)*1.5); // Above enemy head
        if (stateToRender.damage_texts) { for (const id in stateToRender.damage_texts) { const dt = stateToRender.damage_texts[id]; const worldPos = new THREE.Vector3(dt.x, PLAYER_BODY_Y_OFFSET, dt.y); const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } }
        appState.uiPositions = uiPositions;

        try { renderer.render(scene, camera); }
        catch (e) { console.error("!!! RENDER ERROR !!!", e); if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; console.error("Stopped loop.");} }
    }

    // --- Effect Triggers ---
    function triggerShake(magnitude, durationMs) { const now=performance.now(); const newEndTime=now+durationMs; if(magnitude>=shakeMagnitude||newEndTime>shakeEndTime){shakeMagnitude=Math.max(magnitude,shakeMagnitude); shakeEndTime=Math.max(newEndTime,shakeEndTime);} }

    // --- Cleanup ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup Final Complete ---"); window.removeEventListener('resize', handleResize);
        if(hitSparkGeometry)hitSparkGeometry.dispose(); if(rainGeometry)rainGeometry.dispose(); if(dustGeometry)dustGeometry.dispose(); if(flameGeometry)flameGeometry.dispose();
        if(sparkMaterial)sparkMaterial.dispose(); if(rainMaterial)rainMaterial.dispose(); if(dustMaterial)dustMaterial.dispose(); if(flameMaterial){flameMaterial.map?.dispose(); flameMaterial.dispose();}
        scene?.remove(ammoCasingMesh); ammoCasingMesh=null; scene?.remove(snakeMesh); if(snakeMesh?.geometry)snakeMesh.geometry.dispose(); snakeMesh=null; scene?.remove(campfireGroup); campfireGroup=null;
        while(scene?.children.length > 0){ const child = scene.children[0]; scene.remove(child); disposeObject3D(child); }
        playerBodyGeometry.dispose(); headGeometry.dispose(); enemyChaserGeometry.dispose(); enemyShooterGeometry.dispose(); enemyGiantGeometry.dispose(); enemyGunGeometry.dispose(); bulletGeometry.dispose(); powerupBoxGeometry.dispose(); powerupSphereGeometry.dispose(); powerupConeGeometry.dispose(); powerupDiskGeometry.dispose(); powerupArmorGeo.dispose(); powerupShotgunGeo.dispose(); powerupSlugGeo.dispose(); powerupRapidGeo.dispose(); powerupScoreGeo.dispose(); logGeometry.dispose(); casingGeometry.dispose(); groundGeometryPlane.dispose(); gunGeometry.dispose();
        Object.values(powerupMaterials).forEach(m => m.dispose()); playerMaterialBase.dispose(); enemyChaserMaterialBase.dispose(); enemyShooterMaterialBase.dispose(); enemyGiantMaterialBase.dispose(); bulletPlayerMaterial.dispose(); bulletEnemyMaterial.dispose(); snakeMaterial.dispose(); logMaterial.dispose(); casingMaterial.dispose(); gunMaterial.dispose(); headMaterial.dispose();
        groundDayMaterial.dispose(); groundNightMaterial.dispose(); flameTexture.dispose();
        if (renderer) { renderer.dispose(); if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer = null; }
        scene = null; camera = null; groundPlane = null; ambientLight = null; directionalLight = null; muzzleFlashLight = null; flameParticles = null; hitSparkParticles = null; rainParticles = null; dustParticles = null;
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]); Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]); Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]); Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);
        sparkData.length = 0; rainData.length = 0; dustData.length = 0; flameData.length = 0;
        console.log("Renderer3D resources released.");
    }

    // --- Getters needed by main.js for raycasting ---
    function getCamera() { return camera; }
    function getGroundPlane() { return groundPlane; }

    return { init, renderScene, triggerShake, cleanup, getCamera, getGroundPlane };

})();

export default Renderer3D;
