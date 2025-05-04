import * as THREE from 'three';

// --- Utility Function ---
function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

const Renderer3D = (() => {
    console.log("--- Renderer3D.js Rewrite (Attempt 2 - FINAL): Initializing ---");

    let scene, camera, renderer;
    let ambientLight, directionalLight, muzzleFlashLight;
    let gameWidth = 1600, gameHeight = 900;

    const playerMeshes = {};
    const enemyMeshes = {};
    const bulletMeshes = {};
    const powerupMeshes = {};
    let groundPlane = null;
    let campfireGroup = null;
    let snakeMesh = null;
    let snakeCurvePoints = [];

    let hitSparkParticles = null; let hitSparkGeometry = null; let sparkData = [];
    let rainLines = null; let rainGeometry = null; let rainData = [];
    let dustParticles = null; let dustGeometry = null; let dustData = [];
    let flameParticles = null; let flameGeometry = null; let flameData = [];
    let ammoCasingMesh = null;
    let dummyObject = new THREE.Object3D();

    const MAX_SPARKS = 150; const MAX_RAIN_DROPS = 600; const MAX_DUST_MOTES = 400;
    const MAX_CASINGS = 75; const MAX_FLAMES = 60;

    let screenShakeOffset = new THREE.Vector3(0, 0, 0);
    let shakeMagnitude = 0; let shakeEndTime = 0;
    let cameraTargetPos = new THREE.Vector3(gameWidth / 2, 0, gameHeight / 2);
    const cameraLerpFactor = 0.08;

    const loadedAssets = { flameTexture: createFlameTexture(), };

    const DEF_PLAYER_WIDTH = 25; const DEF_PLAYER_HEIGHT = 48; const DEF_PLAYER_HEAD_RADIUS = 8;
    const DEF_ENEMY_WIDTH = 20; const DEF_ENEMY_HEIGHT = 40; const DEF_ENEMY_HEAD_RADIUS = 6;
    const DEF_GIANT_MULTIPLIER = 2.5; const DEF_BULLET_RADIUS = 4;
    const DEF_POWERUP_SIZE = 15; const DEF_SNAKE_SEGMENTS = 64; const DEF_SNAKE_RADIUS = 4;
    const DEF_LOG_RADIUS = 4; const DEF_LOG_LENGTH = 35; const DEF_CASING_RADIUS = 0.5; const DEF_CASING_LENGTH = 3;
    const DEF_GUN_LENGTH = 20; const DEF_GUN_RADIUS = 1.5;
    const SPARK_BASE_LIFE = 0.18; const SPARK_RAND_LIFE = 0.15;

    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.2, name: 'PlayerMat' });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: 'HeadMat' });
    const enemySharedProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    const enemyChaserMaterial = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemySharedProps, name: 'EnemyChaserMat' });
    const enemyShooterMaterial = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemySharedProps, name: 'EnemyShooterMat' });
    const enemyGiantMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 1.0, name: 'EnemyGiantMat' });
    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: 'BulletPlayerMat' });
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff4500, name: 'BulletEnemyMat' });
    const powerupMaterials = {
        default: new THREE.MeshStandardMaterial({ color: 0x888888, name: 'PUMat_Def' }), health: new THREE.MeshStandardMaterial({ color: 0x81c784, name: 'PUMat_HP' }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x6a0dad, emissive: 0x110011, name: 'PUMat_Gun' }), speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3, name: 'PUMat_Spd' }),
        armor: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, name: 'PUMat_Arm' }), ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500, name: 'PUMat_Shot' }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D, name: 'PUMat_Slug' }), ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00, emissive: 0x333300, name: 'PUMat_Rap' }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.6, name: 'PUMat_Sco' }),
    };
    const groundDayMaterial = new THREE.MeshStandardMaterial({ color: 0x7a8c79, roughness: 0.85, metalness: 0.05, name: 'GroundDayMat' });
    const groundNightMaterial = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8, metalness: 0.1, name: 'GroundNightMat' });
    const snakeMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, name: 'SnakeMat' });
    const logMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: 'LogMat' });
    const sparkMaterial = new THREE.PointsMaterial({ size: 9, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'SparkMat' });
    const rainMaterial = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: 'RainMat' });
    const dustMaterial = new THREE.PointsMaterial({ size: 45, color: 0xd2b48c, transparent: true, opacity: 0.1, sizeAttenuation: true, depthWrite: false, name: 'DustMat' });
    const casingMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: 'CasingMat' });
    const flameMaterial = new THREE.PointsMaterial({ size: 15, vertexColors: true, map: loadedAssets.flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'FlameMat' });
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: 'GunMat' });

    const playerBodyGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8); playerBodyGeometry.name = "PlayerBodyGeo";
    const headGeometry = new THREE.SphereGeometry(1, 12, 8); headGeometry.name = "HeadGeo";
    const enemyChaserGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH, DEF_ENEMY_HEIGHT, DEF_ENEMY_WIDTH * 0.7); enemyChaserGeometry.name = "EnemyChaserGeo";
    const enemyShooterGeometry = new THREE.CylinderGeometry(DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_WIDTH*0.6, DEF_ENEMY_HEIGHT, 8); enemyShooterGeometry.name = "EnemyShooterGeo";
    const enemyGunGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * 0.3, DEF_ENEMY_WIDTH * 0.3, DEF_ENEMY_WIDTH * 1.5); enemyGunGeometry.name = "EnemyGunGeo";
    const enemyGiantGeometry = new THREE.BoxGeometry(DEF_ENEMY_WIDTH * DEF_GIANT_MULTIPLIER, DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER, DEF_ENEMY_WIDTH * 0.7 * DEF_GIANT_MULTIPLIER); enemyGiantGeometry.name = "EnemyGiantGeo";
    const bulletGeometry = new THREE.SphereGeometry(DEF_BULLET_RADIUS, 6, 6); bulletGeometry.name = "BulletGeo";
    const powerupBoxGeometry = new THREE.BoxGeometry(DEF_POWERUP_SIZE, DEF_POWERUP_SIZE, DEF_POWERUP_SIZE); powerupBoxGeometry.name = "PGeo_Box";
    const powerupHealthGeo = new THREE.TorusGeometry(DEF_POWERUP_SIZE * 0.4, DEF_POWERUP_SIZE * 0.15, 8, 16); powerupHealthGeo.name = "PGeo_HP";
    const powerupGunGeo = new THREE.ConeGeometry(DEF_POWERUP_SIZE * 0.5, DEF_POWERUP_SIZE, 4); powerupGunGeo.name = "PGeo_Gun";
    const powerupSpeedGeo = new THREE.CylinderGeometry(DEF_POWERUP_SIZE*0.7, DEF_POWERUP_SIZE*0.7, DEF_POWERUP_SIZE*0.3, 16); powerupSpeedGeo.name = "PGeo_Spd";
    const powerupArmorGeo = new THREE.OctahedronGeometry(DEF_POWERUP_SIZE * 0.6, 0); powerupArmorGeo.name = "PGeo_Arm";
    const powerupShotgunGeo = new THREE.BoxGeometry(DEF_POWERUP_SIZE*0.8, DEF_POWERUP_SIZE*0.8, DEF_POWERUP_SIZE*0.8); powerupShotgunGeo.name = "PGeo_Shot";
    const powerupSlugGeo = new THREE.SphereGeometry(DEF_POWERUP_SIZE * 0.6, 12, 8); powerupSlugGeo.name = "PGeo_Slug";
    const powerupRapidGeo = new THREE.TorusGeometry(DEF_POWERUP_SIZE * 0.4, DEF_POWERUP_SIZE * 0.1, 6, 12); powerupRapidGeo.name = "PGeo_Rap";
    const powerupScoreGeo = new THREE.CylinderGeometry(DEF_POWERUP_SIZE*0.4, DEF_POWERUP_SIZE*0.4, DEF_POWERUP_SIZE*0.5, 12); powerupScoreGeo.name = "PGeo_Sco";
    const logGeometry = new THREE.CylinderGeometry(DEF_LOG_RADIUS, DEF_LOG_RADIUS, DEF_LOG_LENGTH, 6); logGeometry.name = "LogGeo";
    const casingGeometry = new THREE.CylinderGeometry(DEF_CASING_RADIUS, DEF_CASING_RADIUS, DEF_CASING_LENGTH, 6); casingGeometry.name = "CasingGeo";
    const groundGeometryPlane = new THREE.PlaneGeometry(1, 1); groundGeometryPlane.name = "GroundGeo";
    const gunGeometry = new THREE.CylinderGeometry(DEF_GUN_RADIUS, DEF_GUN_RADIUS * 0.8, DEF_GUN_LENGTH, 8); gunGeometry.name = "GunGeo";

    const PLAYER_Y_OFFSET = 0; const PLAYER_BODY_Y_OFFSET = DEF_PLAYER_HEIGHT / 2;
    const ENEMY_Y_OFFSET = DEF_ENEMY_HEIGHT / 2; const GIANT_Y_OFFSET = (DEF_ENEMY_HEIGHT * DEF_GIANT_MULTIPLIER) / 2;
    const BULLET_Y_OFFSET = DEF_BULLET_RADIUS; const POWERUP_Y_OFFSET = DEF_POWERUP_SIZE * 0.8;
    const CAMPFIRE_LOG_Y_OFFSET = DEF_LOG_RADIUS; const FLAME_PARTICLE_Y_OFFSET = DEF_LOG_RADIUS + 2;

    function createFlameTexture() {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const context = canvas.getContext('2d'); const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255, 220, 150, 1)'); gradient.addColorStop(0.4, 'rgba(255, 150, 0, 0.8)'); gradient.addColorStop(1, 'rgba(200, 0, 0, 0)'); context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); const texture = new THREE.CanvasTexture(canvas); texture.name = "FlameTexture"; return texture;
    }

    function init(containerElement, initialWidth, initialHeight) {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }
        gameWidth = initialWidth || 1600; gameHeight = initialHeight || 900;
        cameraTargetPos.set(gameWidth / 2, 0, gameHeight / 2);
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(gameWidth, gameHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
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
            directionalLight.position.set(gameWidth * 0.2, 300, gameHeight * 0.3);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 50;
            directionalLight.shadow.camera.far = 700;
            directionalLight.shadow.camera.left = -gameWidth;
            directionalLight.shadow.camera.right = gameWidth;
            directionalLight.shadow.camera.top = gameHeight;
            directionalLight.shadow.camera.bottom = -gameHeight;
            scene.add(directionalLight);
            scene.add(directionalLight.target);

            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.5);
            muzzleFlashLight.castShadow = false;
            scene.add(muzzleFlashLight);

            groundPlane = new THREE.Mesh(groundGeometryPlane, groundDayMaterial);
            groundPlane.scale.set(gameWidth * 1.1, gameHeight * 1.1, 1);
            groundPlane.rotation.x = -Math.PI / 2;
            groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
            groundPlane.receiveShadow = true;
            groundPlane.name = "GroundPlane";
            scene.add(groundPlane);

            initParticles();
            initCampfire();
            initSnake();

            window.addEventListener('resize', handleResize);
            handleResize();

        } catch (error) {
            console.error("!!! CRITICAL ERROR during Renderer3D Init !!!", error);
            if (containerElement) containerElement.innerHTML = "<p style='color:red; text-align: center;'>Error initializing 3D graphics.</p>";
            return false;
        }
        console.log("--- Renderer3D initialization complete ---");
        return true;
    }

    function initParticles() {
        hitSparkGeometry = new THREE.BufferGeometry(); hitSparkGeometry.name = "SparkGeo"; const sparkPositions = new Float32Array(MAX_SPARKS * 3); const sparkColors = new Float32Array(MAX_SPARKS * 3); const sparkAlphas = new Float32Array(MAX_SPARKS); sparkData = []; for(let i = 0; i < MAX_SPARKS; i++) { sparkData.push({ position: new THREE.Vector3(0,-1000,0), velocity: new THREE.Vector3(), color: new THREE.Color(1,1,1), alpha: 0.0, life: 0 }); sparkAlphas[i] = 0.0; sparkPositions[i*3+1] = -1000; } hitSparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3)); hitSparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3)); hitSparkGeometry.setAttribute('alpha', new THREE.BufferAttribute(sparkAlphas, 1)); hitSparkParticles = new THREE.Points(hitSparkGeometry, sparkMaterial); hitSparkParticles.name = "HitSparks"; scene.add(hitSparkParticles);
        rainGeometry = new THREE.BufferGeometry(); rainGeometry.name = "RainGeo"; const rainPositions = new Float32Array(MAX_RAIN_DROPS * 6); rainData = []; for (let i = 0; i < MAX_RAIN_DROPS; i++) { rainData.push({ position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, gameHeight*1.5 , Math.random()*gameHeight*1.2-gameHeight*0.1), velocity: new THREE.Vector3(15 + Math.random()*8, -400 - Math.random()*150, 0) }); } rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)); rainLines = new THREE.LineSegments(rainGeometry, rainMaterial); rainLines.name = "Rain"; rainLines.visible = false; scene.add(rainLines);
        dustGeometry = new THREE.BufferGeometry(); dustGeometry.name = "DustGeo"; const dustPositions = new Float32Array(MAX_DUST_MOTES * 3); dustData = []; for (let i = 0; i < MAX_DUST_MOTES; i++) { dustData.push({ position: new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1, Math.random()*50 + 5 , Math.random()*gameHeight*1.2-gameHeight*0.1), velocity: new THREE.Vector3((Math.random()-0.5)*50, Math.random()*5, (Math.random()-0.5)*50), rotation: Math.random() * Math.PI * 2 }); dustPositions[i*3+1] = -1000; } dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3)); dustParticles = new THREE.Points(dustGeometry, dustMaterial); dustParticles.name = "Dust"; dustParticles.visible = false; scene.add(dustParticles);
        ammoCasingMesh = new THREE.InstancedMesh(casingGeometry, casingMaterial, MAX_CASINGS); ammoCasingMesh.name = "AmmoCasings"; ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; scene.add(ammoCasingMesh);
    }

    function initCampfire() {
        campfireGroup = new THREE.Group(); campfireGroup.name = "CampfireGroup"; const log1 = new THREE.Mesh(logGeometry, logMaterial); log1.rotation.set(0, Math.PI / 10, Math.PI / 6); log1.castShadow = true; log1.name = "Log1"; log1.position.set(-DEF_LOG_LENGTH*0.1, CAMPFIRE_LOG_Y_OFFSET, -DEF_LOG_LENGTH*0.2); const log2 = new THREE.Mesh(logGeometry, logMaterial); log2.rotation.set(0, -Math.PI / 8, -Math.PI / 5); log2.castShadow = true; log2.name = "Log2"; log2.position.set(DEF_LOG_LENGTH*0.15, CAMPFIRE_LOG_Y_OFFSET, DEF_LOG_LENGTH*0.1); campfireGroup.add(log1); campfireGroup.add(log2); const glowLight = new THREE.PointLight(0xffa500, 0, 150, 1.8); glowLight.position.y = FLAME_PARTICLE_Y_OFFSET + 5; glowLight.name = "CampfireGlow"; campfireGroup.add(glowLight); campfireGroup.userData.glowLight = glowLight; flameGeometry = new THREE.BufferGeometry(); flameGeometry.name = "FlameGeo"; const flamePositions = new Float32Array(MAX_FLAMES * 3); const flameColors = new Float32Array(MAX_FLAMES * 3); const flameAlphas = new Float32Array(MAX_FLAMES); flameData = []; for(let i=0; i < MAX_FLAMES; i++) { flameData.push({ position: new THREE.Vector3(0,-1000,0), velocity: new THREE.Vector3(), color: new THREE.Color(1,1,1), alpha: 0.0, life: 0, baseLife: 0.5 + Math.random()*0.4 }); flamePositions[i*3+1]=-1000; flameAlphas[i]=0.0; } flameGeometry.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3)); flameGeometry.setAttribute('color', new THREE.BufferAttribute(flameColors, 3)); flameGeometry.setAttribute('alpha', new THREE.BufferAttribute(flameAlphas, 1)); flameParticles = new THREE.Points(flameGeometry, flameMaterial); flameParticles.name = "Flames"; campfireGroup.add(flameParticles); campfireGroup.userData.flameParticles = flameParticles; campfireGroup.visible = false; scene.add(campfireGroup);
    }

    function initSnake() {
        const initialCurve = new THREE.LineCurve3(new THREE.Vector3(0, DEF_SNAKE_RADIUS, 0), new THREE.Vector3(1, DEF_SNAKE_RADIUS, 0));
        const snakeGeometry = new THREE.TubeGeometry(initialCurve, DEF_SNAKE_SEGMENTS, DEF_SNAKE_RADIUS, 5, false);
        snakeGeometry.name = "SnakeGeo";
        snakeMesh = new THREE.Mesh(snakeGeometry, snakeMaterial);
        snakeMesh.name = "Snake";
        snakeMesh.castShadow = true;
        snakeMesh.visible = false;
        scene.add(snakeMesh);
    }

    function handleResize() {
        if (!renderer || !camera) return;
        renderer.setSize(gameWidth, gameHeight);
        const aspect = gameWidth / gameHeight;
        const frustumSize = gameHeight;
        camera.left = frustumSize * aspect / -2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.position.set(cameraTargetPos.x, 1000, cameraTargetPos.z);
        camera.lookAt(cameraTargetPos.x, 0, cameraTargetPos.z);
        camera.updateProjectionMatrix();
        console.log(`Renderer resized: ${gameWidth}x${gameHeight}. Camera updated.`);
    }

    function createPlayerMesh(playerData) {
        const playerGroup = new THREE.Group(); playerGroup.name = `Player_${playerData.id.substring(0,4)}`;
        const bodyMat = playerMaterial.clone(); bodyMat.name = `PMat_${playerData.id.substring(0,4)}`;
        const bodyMesh = new THREE.Mesh(playerBodyGeometry, bodyMat); bodyMesh.castShadow = true; bodyMesh.position.y = PLAYER_BODY_Y_OFFSET; bodyMesh.name = "PBody"; playerGroup.add(bodyMesh);
        const headMesh = new THREE.Mesh(headGeometry, headMaterial.clone()); headMesh.scale.setScalar(DEF_PLAYER_HEAD_RADIUS); headMesh.position.y = PLAYER_BODY_Y_OFFSET + (DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH)/2 + DEF_PLAYER_HEAD_RADIUS*0.8; headMesh.castShadow = true; headMesh.name = "PHead"; playerGroup.add(headMesh);
        const gunMesh = new THREE.Mesh(gunGeometry, gunMaterial.clone()); gunMesh.position.set(0, PLAYER_BODY_Y_OFFSET * 0.8, DEF_PLAYER_WIDTH * 0.5); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; gunMesh.name = "PGun"; playerGroup.add(gunMesh);
        playerGroup.position.set(playerData.x, PLAYER_Y_OFFSET, playerData.y); playerGroup.userData.gameId = playerData.id; playerGroup.userData.bodyMesh = bodyMesh; playerGroup.userData.headMesh = headMesh; playerGroup.userData.gunMesh = gunMesh;
        return playerGroup;
    }

    function createEnemyMesh(enemyData){
        const enemyGroup = new THREE.Group(); enemyGroup.name = `Enemy_${enemyData.type}_${enemyData.id.substring(0,4)}`;
        let bodyMesh, headMesh, yOffset=ENEMY_Y_OFFSET, bodyMat, headScale = DEF_ENEMY_HEAD_RADIUS;
        const enemyHeadMat = headMaterial.clone();
        if(enemyData.type==='giant'){ bodyMat=enemyGiantMaterial.clone(); bodyMesh=new THREE.Mesh(enemyGiantGeometry,bodyMat); yOffset=GIANT_Y_OFFSET; headScale = DEF_ENEMY_HEAD_RADIUS * DEF_GIANT_MULTIPLIER * 0.8; }
        else if(enemyData.type==='shooter'){ bodyMat=enemyShooterMaterial.clone(); bodyMesh=new THREE.Mesh(enemyShooterGeometry,bodyMat); const enemyGun = new THREE.Mesh(enemyGunGeometry, gunMaterial.clone()); enemyGun.position.set(0, yOffset * 0.6, DEF_ENEMY_WIDTH * 0.6); enemyGun.rotation.x = Math.PI / 2; enemyGun.castShadow = true; enemyGun.name="EGun"; enemyGroup.add(enemyGun); }
        else{ bodyMat=enemyChaserMaterial.clone(); bodyMesh=new THREE.Mesh(enemyChaserGeometry,bodyMat); }
        bodyMesh.castShadow=true; bodyMesh.receiveShadow=true; bodyMesh.position.y = yOffset; bodyMesh.name = "EBody";
        headMesh = new THREE.Mesh(headGeometry, enemyHeadMat); headMesh.scale.setScalar(headScale); headMesh.castShadow = true; headMesh.name = "EHead"; headMesh.position.y = yOffset + (bodyMesh.geometry.parameters.height || DEF_ENEMY_HEIGHT)/2 + headScale * 0.7;
        enemyGroup.add(bodyMesh); enemyGroup.add(headMesh);
        enemyGroup.position.set(enemyData.x, 0, enemyData.y); enemyGroup.userData.gameId=enemyData.id; enemyGroup.userData.type=enemyData.type; enemyGroup.userData.bodyMesh = bodyMesh;
        return enemyGroup;
    }

    function createBulletMesh(bulletData){
        const mat = bulletData.owner_type==='player' ? bulletPlayerMaterial : bulletEnemyMaterial;
        const mesh = new THREE.Mesh(bulletGeometry, mat);
        mesh.position.set(bulletData.x, BULLET_Y_OFFSET, bulletData.y);
        mesh.userData.gameId = bulletData.id;
        mesh.name = `Bullet_${bulletData.id.substring(0,4)}`;
        return mesh;
    }

    function createPowerupMesh(powerupData){
        const powerupGroup = new THREE.Group(); powerupGroup.name = `Powerup_${powerupData.type}_${powerupData.id.substring(0,4)}`;
        const mat = (powerupMaterials[powerupData.type] || powerupMaterials.default).clone();
        let iconGeo;
        switch(powerupData.type) {
             case 'health': iconGeo = powerupHealthGeo; break; case 'gun_upgrade': iconGeo = powerupGunGeo; break;
             case 'speed_boost': iconGeo = powerupSpeedGeo; break; case 'armor': iconGeo = powerupArmorGeo; break;
             case 'ammo_shotgun': iconGeo = powerupShotgunGeo; break; case 'ammo_heavy_slug': iconGeo = powerupSlugGeo; break;
             case 'ammo_rapid_fire': iconGeo = powerupRapidGeo; break; case 'bonus_score': iconGeo = powerupScoreGeo; break;
             default: iconGeo = powerupBoxGeometry;
        }
        const iconMesh = new THREE.Mesh(iconGeo, mat); iconMesh.castShadow = true; iconMesh.receiveShadow = true; iconMesh.position.y = POWERUP_Y_OFFSET; iconMesh.rotation.set(Math.PI / 6, 0, Math.PI / 6);
        powerupGroup.add(iconMesh); powerupGroup.position.set(powerupData.x, 0, powerupData.y); powerupGroup.userData.gameId=powerupData.id; powerupGroup.userData.isPowerup=true; powerupGroup.userData.iconMesh = iconMesh;
        return powerupGroup;
    }

    function updateMeshes(state, meshDict, createFn, defaultYPosFn, localEffects, appState) {
        const activeIds = new Set();
        if (state) {
            for (const id in state) {
                const data = state[id]; if (typeof data.x !== 'number' || typeof data.y !== 'number') continue; activeIds.add(id);
                let obj = meshDict[id]; let isNew = false;
                if (!obj) { obj = createFn(data); if (obj) { meshDict[id] = obj; scene.add(obj); isNew = true; } else { continue; } }
                const yOffset = defaultYPosFn(data);
                obj.position.set(data.x, yOffset, data.y);
                const bodyMesh = (obj instanceof THREE.Group) ? obj.userData.bodyMesh : obj;
                const iconMesh = (obj instanceof THREE.Group && obj.userData.isPowerup) ? obj.userData.iconMesh : null;
                if (bodyMesh && bodyMesh.material && !isNew) {
                    const fadeDuration = 0.4; const now = performance.now();
                    if (meshDict === enemyMeshes && data.health <= 0 && data.death_timestamp) {
                        const timeSinceDeath = (now/1000) - data.death_timestamp;
                        const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration));
                        const isVisible = opacity > 0.01;
                        obj.visible = isVisible;
                        obj.children.forEach(c => { if(c.material) { c.material.opacity = opacity; c.material.needsUpdate = true; } c.visible = isVisible; });
                    } else if (obj.visible === false || (bodyMesh.material.opacity < 1.0 && bodyMesh.material.opacity > 0)) {
                        obj.visible = true;
                        obj.children.forEach(c => { if(c.material) { c.material.opacity = 1.0; c.material.needsUpdate = true; } c.visible = true; });
                    }
                    const snakeEffect = data.effects?.snake_bite_slow;
                    const isBitten = snakeEffect && now < snakeEffect.expires_at * 1000;
                    const isPushback = meshDict === playerMeshes && id === appState?.localPlayerId && localEffects?.pushbackAnim?.active;
                    let emissiveColor = 0x000000; let emissiveIntensity = 0;
                    if(isPushback) { const pushbackProgress = Math.max(0,(localEffects.pushbackAnim.endTime-now)/localEffects.pushbackAnim.duration); emissiveIntensity = Math.sin(pushbackProgress*Math.PI)*0.8; emissiveColor = 0x66ccff; }
                    else if (isBitten) { emissiveIntensity = 0.4 + Math.sin(now * 0.005) * 0.3; emissiveColor = 0x00ff00; }
                    if(bodyMesh.material.emissive) { bodyMesh.material.emissive.setHex(emissiveColor); bodyMesh.material.emissiveIntensity = emissiveIntensity; }
                }
                if (iconMesh) { iconMesh.rotation.y += 0.02; iconMesh.position.y = POWERUP_Y_OFFSET + Math.sin(performance.now() * 0.002) * 3; }
                if (meshDict === playerMeshes && obj.userData?.gunMesh) { const aimDx = data.id === appState?.localPlayerId ? appState.localPlayerAimState.lastAimDx : 0; const aimDy = data.id === appState?.localPlayerId ? appState.localPlayerAimState.lastAimDy : -1; obj.rotation.y = Math.atan2(aimDx, aimDy); }
                else if (meshDict === enemyMeshes && obj.userData?.type === 'shooter') { const targetPlayer = appState?.serverState?.players?.[data.target_player_id]; if (targetPlayer) { const aimTargetX = targetPlayer.x; const aimTargetZ = targetPlayer.y; obj.rotation.y = Math.atan2(aimTargetX - data.x, aimTargetZ - data.y); } }
            }
        }
        for (const id in meshDict) { if (!activeIds.has(id)) { const objToRemove = meshDict[id]; if (objToRemove) { scene.remove(objToRemove); disposeObject3D(objToRemove); } delete meshDict[id]; } }
    }

    function disposeObject3D(obj) {
        if (!obj) return;
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose()); else if (obj.material.dispose) obj.material.dispose(); } }
        else if (obj instanceof THREE.InstancedMesh) { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose()); else if (obj.material.dispose) obj.material.dispose(); } }
        while(obj.children.length > 0) { disposeObject3D(obj.children[0]); obj.remove(obj.children[0]); }
    }

    function getYOffsetForEntity(entityData) { if (entityData.radius) return BULLET_Y_OFFSET; return 0; }

    function updateEnvironment(isNight) { const dayLightIntensity=1.0, nightLightIntensity=0.45; const dayAmbientIntensity=0.6, nightAmbientIntensity=0.3; const dayDirColor=0xffffff, nightDirColor=0xc0d0ff; const dayAmbColor=0xffffff, nightAmbColor=0x556699; ambientLight.intensity = isNight ? nightAmbientIntensity : dayAmbientIntensity; ambientLight.color.setHex(isNight ? nightAmbColor : dayAmbColor); directionalLight.intensity = isNight ? nightLightIntensity : dayLightIntensity; directionalLight.color.setHex(isNight ? nightDirColor : dayDirColor); groundPlane.material = isNight ? groundNightMaterial : groundDayMaterial; scene.fog = isNight ? new THREE.FogExp2(0x081020, 0.001) : null; }

    function updateMuzzleFlash(appState, flashState) { if (!muzzleFlashLight || !appState?.localPlayerId) return; const playerGroup = playerMeshes[appState.localPlayerId]; if (!playerGroup || !playerGroup.userData.gunMesh) return; const now = performance.now(); if (flashState.active && now < flashState.endTime) { muzzleFlashLight.intensity = 4.0 + Math.random() * 3.0; const offsetDistance = DEF_GUN_LENGTH * 0.7; const gunMesh = playerGroup.userData.gunMesh; const worldPos = new THREE.Vector3(); gunMesh.getWorldPosition(worldPos); const aimDirection = new THREE.Vector3(appState.localPlayerAimState.lastAimDx, 0, appState.localPlayerAimState.lastAimDy); worldPos.addScaledVector(aimDirection, offsetDistance); muzzleFlashLight.position.copy(worldPos); } else { muzzleFlashLight.intensity = 0; if (flashState.active) flashState.active = false; } }

    function updateHitSparks(activeSparkEffects, deltaTime) { if (!hitSparkParticles || !hitSparkGeometry) return; const positions = hitSparkGeometry.attributes.position.array; const colors = hitSparkGeometry.attributes.color.array; const alphas = hitSparkGeometry.attributes.alpha.array; let needsUpdate = false; let firstInactiveIndex = 0; const now = performance.now(); for (const enemyId in activeSparkEffects) { const effectEndTime = activeSparkEffects[enemyId]; const enemyMesh = enemyMeshes[enemyId]; if (now < effectEndTime && enemyMesh) { const sparksToSpawn = 4 + Math.floor(Math.random() * 5); const enemyPos = enemyMesh.position; const enemyYOffset = (enemyMesh.userData?.type === 'giant' ? GIANT_Y_OFFSET : ENEMY_Y_OFFSET); for (let i = 0; i < sparksToSpawn; i++) { let foundSlot = false; for (let j = firstInactiveIndex; j < MAX_SPARKS; j++) { const p = sparkData[j]; if (p.life <= 0) { p.position.copy(enemyPos); p.position.y = enemyYOffset * (0.2 + Math.random() * 0.8); const angle = Math.random() * Math.PI * 2; const speed = 120 + Math.random() * 90; p.velocity.set(Math.cos(angle)*speed, (Math.random()-0.3)*speed*0.6, Math.sin(angle)*speed); p.color.setRGB(1, Math.random()*0.4, 0); p.alpha = 1.0; p.life = SPARK_BASE_LIFE + Math.random() * SPARK_RAND_LIFE; firstInactiveIndex = j + 1; foundSlot = true; break; } } if (!foundSlot) break; } delete activeSparkEffects[enemyId]; } else if (now >= effectEndTime) { delete activeSparkEffects[enemyId]; } } for (let i = 0; i < MAX_SPARKS; i++) { const p = sparkData[i]; if (p.life > 0) { p.life -= deltaTime; if (p.life <= 0) { p.alpha = 0.0; alphas[i] = 0.0; positions[i * 3 + 1] = -1000; } else { p.position.addScaledVector(p.velocity, deltaTime); p.velocity.y -= 250 * deltaTime; p.alpha = Math.max(0, (p.life / (SPARK_BASE_LIFE + SPARK_RAND_LIFE)) * 1.2); alphas[i] = p.alpha; positions[i*3] = p.position.x; positions[i*3+1] = p.position.y; positions[i*3+2] = p.position.z; colors[i*3] = p.color.r; colors[i*3+1] = p.color.g; colors[i*3+2] = p.color.b; } needsUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0; positions[i * 3 + 1] = -1000; needsUpdate = true; } } if (needsUpdate) { hitSparkGeometry.attributes.position.needsUpdate = true; hitSparkGeometry.attributes.color.needsUpdate = true; hitSparkGeometry.attributes.alpha.needsUpdate = true; } hitSparkParticles.visible = needsUpdate; }

    function updateAmmoCasings(activeCasings) { if (!ammoCasingMesh) return; let visibleCount = 0; for(let i=0; i<activeCasings.length && i<MAX_CASINGS; i++){ const casing = activeCasings[i]; dummyObject.position.set(casing.x, DEF_CASING_LENGTH/2 + 0.5, casing.y); dummyObject.rotation.set(Math.PI/2 + (Math.random()-0.5)*0.4, casing.rotation, (Math.random()-0.5)*0.4); dummyObject.updateMatrix(); ammoCasingMesh.setMatrixAt(i, dummyObject.matrix); visibleCount++; } ammoCasingMesh.count = visibleCount; ammoCasingMesh.instanceMatrix.needsUpdate = true; }

    function updateWeatherParticles(appState, deltaTime) { if (!appState) return; if (rainLines && rainGeometry) { rainLines.visible = appState.isRaining; if (appState.isRaining) { const positions = rainGeometry.attributes.position.array; const rainSpeed = 450; const streakLengthFactor = 0.04; for (let i = 0; i < MAX_RAIN_DROPS; i++) { const p = rainData[i]; p.position.y -= rainSpeed * deltaTime; if (p.position.y < -20) { p.position.x = Math.random()*gameWidth*1.2 - gameWidth*0.1; p.position.y = gameHeight*1.2 + Math.random() * 100; p.position.z = Math.random()*gameHeight*1.2 - gameHeight*0.1; } const endY = p.position.y - rainSpeed * streakLengthFactor; const idx = i * 6; positions[idx + 0] = p.position.x; positions[idx + 1] = p.position.y; positions[idx + 2] = p.position.z; positions[idx + 3] = p.position.x; positions[idx + 4] = endY; positions[idx + 5] = p.position.z; } rainGeometry.attributes.position.needsUpdate = true; } } if (dustParticles && dustGeometry) { dustParticles.visible = appState.isDustStorm; if (appState.isDustStorm) { const positions = dustGeometry.attributes.position.array; for (let i = 0; i < MAX_DUST_MOTES; i++) { const p = dustData[i]; p.position.addScaledVector(p.velocity, deltaTime); p.velocity.x += (Math.random()-0.5)*50*deltaTime; p.velocity.z += (Math.random()-0.5)*50*deltaTime; p.position.y = Math.max(1, Math.min(50, p.position.y + (Math.random()-0.5)*10*deltaTime)); if(p.position.x<-gameWidth*0.1) p.position.x += gameWidth*1.2; if(p.position.x>gameWidth*1.1) p.position.x -= gameWidth*1.2; if(p.position.z<-gameHeight*0.1) p.position.z += gameHeight*1.2; if(p.position.z>gameHeight*1.1) p.position.z -= gameHeight*1.2; positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; } dustGeometry.attributes.position.needsUpdate = true; } } }

    function updateSnake(snakeData) {
        if (!snakeMesh || !snakeData || !snakeMesh.geometry) return;
        snakeMesh.visible = snakeData.isActiveFromServer;
        if(snakeData.isActiveFromServer && snakeData.segments && snakeData.segments.length > 1){
             snakeCurvePoints = snakeData.segments.map(seg => new THREE.Vector3(seg.x, DEF_SNAKE_RADIUS, seg.y));
             if (snakeCurvePoints.length >= 2) {
                 const curve = new THREE.CatmullRomCurve3(snakeCurvePoints);
                 const tubeGeometry = snakeMesh.geometry;
                 const positions = tubeGeometry.attributes.position.array;
                 const P = new THREE.Vector3();
                 const N = new THREE.Vector3();
                 const B = new THREE.Vector3();
                 const vertex = new THREE.Vector3();
                 const normal = new THREE.Vector3();
                 const frames = curve.computeFrenetFrames(DEF_SNAKE_SEGMENTS, false);
                 const segments = tubeGeometry.parameters.tubularSegments || DEF_SNAKE_SEGMENTS;
                 const radiusSegments = tubeGeometry.parameters.radialSegments || 5;
                 let vertexIndex = 0;

                 for ( let i = 0; i <= segments; i ++ ) {
                     curve.getPointAt(i / segments, P);
                     const frameNormal = frames.normals[ i ];
                     const frameBinormal = frames.binormals[ i ];
                     for ( let j = 0; j <= radiusSegments; j ++ ) {
                         const v = j / radiusSegments * Math.PI * 2;
                         const sin = Math.sin( v );
                         const cos = - Math.cos( v );
                         normal.x = ( cos * frameNormal.x + sin * frameBinormal.x );
                         normal.y = ( cos * frameNormal.y + sin * frameBinormal.y );
                         normal.z = ( cos * frameNormal.z + sin * frameBinormal.z );
                         normal.normalize();
                         vertex.copy(P).addScaledVector(normal, DEF_SNAKE_RADIUS);
                         positions[vertexIndex++] = vertex.x;
                         positions[vertexIndex++] = vertex.y;
                         positions[vertexIndex++] = vertex.z;
                     }
                 }
                 tubeGeometry.attributes.position.needsUpdate = true;
                 tubeGeometry.computeVertexNormals();
             } else {
                  snakeMesh.visible = false;
             }
        } else {
            snakeMesh.visible = false;
        }
    }

    function updateCampfire(campfireData, deltaTime) {
        if (!campfireGroup || !campfireData) return;
        campfireGroup.visible = campfireData.active;
        if (campfireData.active) {
            campfireGroup.position.set(campfireData.x, 0, campfireData.y);
            const glowLight = campfireGroup.userData.glowLight;
            if (glowLight) glowLight.intensity = 1.8 + Math.sin(performance.now() * 0.0025) * 0.6;
            if (flameParticles && flameGeometry) {
                 const positions = flameGeometry.attributes.position.array; const colors = flameGeometry.attributes.color.array; const alphas = flameGeometry.attributes.alpha.array; let needsUpdate = false; let firstInactiveFlame = 0;
                 for(let i=0; i < MAX_FLAMES; i++) {
                     const p = flameData[i];
                     if (p.life <= 0 && Math.random() < 0.2 && i >= firstInactiveFlame) { p.position.set((Math.random()-0.5)*15, FLAME_PARTICLE_Y_OFFSET, (Math.random()-0.5)*15); p.velocity.set((Math.random()-0.5)*18, 50 + Math.random()*30, (Math.random()-0.5)*18); p.life = p.baseLife; p.alpha = 0.8 + Math.random()*0.2; p.color.setHSL(0.08 + Math.random()*0.04, 1.0, 0.6 + Math.random()*0.1); firstInactiveFlame = i + 1; }
                     if (p.life > 0) { p.life -= deltaTime;
                         if (p.life <= 0) { p.alpha=0; alphas[i] = 0.0; positions[i*3+1]=-1000;}
                         else { p.position.addScaledVector(p.velocity, deltaTime); p.velocity.y += (Math.random()-0.45)*60*deltaTime; p.velocity.x *= 0.96; p.velocity.z *= 0.96; p.alpha = Math.max(0, (p.life / p.baseLife) * 1.1); p.color.lerp(new THREE.Color(1.0, 0.1, 0), deltaTime * 1.3); alphas[i]=p.alpha; positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; }
                         needsUpdate = true;
                     } else if (alphas[i] > 0) { alphas[i] = 0.0; positions[i*3+1]=-1000; needsUpdate = true; }
                 }
                 if (needsUpdate) { flameGeometry.attributes.position.needsUpdate=true; flameGeometry.attributes.color.needsUpdate=true; flameGeometry.attributes.alpha.needsUpdate=true; }
            }
        }
    }

    function getScreenPosition(worldPosition, cameraRef, rendererRef) {
        try { const vector = worldPosition.clone(); vector.project(cameraRef); if (!rendererRef || !rendererRef.domElement) return { x: 0, y: 0 }; const widthHalf = rendererRef.domElement.width / 2; const heightHalf = rendererRef.domElement.height / 2; const screenX = Math.round((vector.x * widthHalf) + widthHalf); const screenY = Math.round(-(vector.y * heightHalf) + heightHalf); return{ x: screenX, y: screenY }; }
        catch (e) { console.error("Error getScreenPosition:", e); return { x: 0, y: 0 }; }
    }

    function renderScene(stateToRender, appState, localEffects, deltaTime = 0.016) {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) return;
        let dimensionsChanged = false;
        if (appState.canvasWidth && appState.canvasHeight && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) { gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight; dimensionsChanged = true; cameraTargetPos.x = gameWidth / 2; cameraTargetPos.z = gameHeight / 2; }
        if (dimensionsChanged) handleResize();
        const now = performance.now();
        if (appState.localPlayerId && playerMeshes[appState.localPlayerId]) { cameraTargetPos.x = lerp(cameraTargetPos.x, appState.renderedPlayerPos.x, cameraLerpFactor); cameraTargetPos.z = lerp(cameraTargetPos.z, appState.renderedPlayerPos.y, cameraLerpFactor); }
        if (shakeMagnitude > 0 && now < shakeEndTime) { const timeRemaining = shakeEndTime - now; const initialDurationEst = Math.max(1, shakeEndTime - (now - timeRemaining)); const currentMag = shakeMagnitude * Math.max(0, timeRemaining / initialDurationEst); const shakeAngle = Math.random() * Math.PI * 2; screenShakeOffset.x = Math.cos(shakeAngle) * currentMag; screenShakeOffset.z = Math.sin(shakeAngle) * currentMag; }
        else { shakeMagnitude = 0; screenShakeOffset.set(0, 0, 0); }
        const finalCamX = cameraTargetPos.x + screenShakeOffset.x; const finalCamZ = cameraTargetPos.z + screenShakeOffset.z; camera.position.set(finalCamX, 1000, finalCamZ); camera.lookAt(finalCamX, 0, finalCamZ);
        updateEnvironment(stateToRender.is_night); updateMuzzleFlash(appState, localEffects.muzzleFlash); updateHitSparks(localEffects.activeBloodSparkEffects, deltaTime); updateAmmoCasings(localEffects.activeAmmoCasings); updateWeatherParticles(appState, deltaTime); updateSnake(localEffects.snake); updateCampfire(stateToRender.campfire, deltaTime);
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, (d) => PLAYER_Y_OFFSET, localEffects, appState); updateMeshes(stateToRender.enemies, enemyMeshes, createEnemyMesh, (d) => (d.type === 'giant' ? GIANT_Y_OFFSET : ENEMY_Y_OFFSET), localEffects, appState); updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, getYOffsetForEntity, localEffects, appState); updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, (d) => 0, localEffects, appState);
        const uiPositions = {};
        const calculateUIPos = (meshDict, stateDict, yOffsetValFn) => { for (const id in meshDict) { const obj = meshDict[id]; const data = stateDict?.[id]; if (obj && data && obj.visible !== false) { const actualMesh = (obj instanceof THREE.Group) ? obj.userData.bodyMesh || obj.userData.iconMesh : obj; if (!actualMesh) continue; const worldPos = obj.position.clone(); worldPos.y = yOffsetValFn(data, actualMesh); const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } } };
        const getPlayerHeadY = (d,m) => PLAYER_BODY_Y_OFFSET + DEF_PLAYER_HEAD_RADIUS*1.5; const getEnemyHeadY = (d,m) => (d.type === 'giant' ? GIANT_Y_OFFSET : ENEMY_Y_OFFSET) + (d.type === 'giant' ? DEF_ENEMY_HEAD_RADIUS * DEF_GIANT_MULTIPLIER : DEF_ENEMY_HEAD_RADIUS)*1.5; const getPowerupTopY = (d,m) => POWERUP_Y_OFFSET + DEF_POWERUP_SIZE * 0.5;
        calculateUIPos(playerMeshes, stateToRender.players, getPlayerHeadY); calculateUIPos(enemyMeshes, stateToRender.enemies, getEnemyHeadY); calculateUIPos(powerupMeshes, stateToRender.powerups, getPowerupTopY);
        if (stateToRender.damage_texts) { for (const id in stateToRender.damage_texts) { const dt = stateToRender.damage_texts[id]; const worldPos = new THREE.Vector3(dt.x, PLAYER_BODY_Y_OFFSET, dt.y); const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } }
        appState.uiPositions = uiPositions;
        try { renderer.render(scene, camera); }
        catch (e) { console.error("!!! RENDER ERROR !!!", e); if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; console.error("Stopped loop due to render error.");} }
    }

    function triggerShake(magnitude, durationMs) { const now = performance.now(); const newEndTime = now + durationMs; if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) { shakeMagnitude = Math.max(magnitude, shakeMagnitude); shakeEndTime = Math.max(newEndTime, shakeEndTime); } }

    function cleanup() {
        console.log("--- Renderer3D Cleanup ---"); window.removeEventListener('resize', handleResize);
        if(hitSparkGeometry) hitSparkGeometry.dispose(); if(rainGeometry) rainGeometry.dispose(); if(dustGeometry) dustGeometry.dispose(); if(flameGeometry) flameGeometry.dispose();
        if(sparkMaterial) sparkMaterial.dispose(); if(rainMaterial) rainMaterial.dispose(); if(dustMaterial) dustMaterial.dispose(); if(flameMaterial) { flameMaterial.map?.dispose(); flameMaterial.dispose(); }
        scene?.remove(ammoCasingMesh); scene?.remove(snakeMesh); scene?.remove(campfireGroup); scene?.remove(hitSparkParticles); scene?.remove(rainLines); scene?.remove(dustParticles);
        if(snakeMesh?.geometry) snakeMesh.geometry.dispose();
        while(scene?.children.length > 0) { const child = scene.children[0]; scene.remove(child); disposeObject3D(child); }
        playerBodyGeometry.dispose(); headGeometry.dispose(); enemyChaserGeometry.dispose(); enemyShooterGeometry.dispose(); enemyGiantGeometry.dispose(); enemyGunGeometry.dispose(); bulletGeometry.dispose(); powerupBoxGeometry.dispose(); powerupHealthGeo.dispose(); powerupGunGeo.dispose(); powerupSpeedGeo.dispose(); powerupArmorGeo.dispose(); powerupShotgunGeo.dispose(); powerupSlugGeo.dispose(); powerupRapidGeo.dispose(); powerupScoreGeo.dispose(); logGeometry.dispose(); casingGeometry.dispose(); groundGeometryPlane.dispose(); gunGeometry.dispose();
        Object.values(powerupMaterials).forEach(m => m.dispose()); playerMaterial.dispose(); enemyChaserMaterial.dispose(); enemyShooterMaterial.dispose(); enemyGiantMaterial.dispose(); bulletPlayerMaterial.dispose(); bulletEnemyMaterial.dispose(); snakeMaterial.dispose(); logMaterial.dispose(); casingMaterial.dispose(); gunMaterial.dispose(); headMaterial.dispose();
        groundDayMaterial.dispose(); groundNightMaterial.dispose(); loadedAssets.flameTexture?.dispose();
        if (renderer) { renderer.dispose(); renderer.forceContextLoss(); if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer = null; log("Renderer disposed.");}
        scene = null; camera = null; groundPlane = null; ambientLight = null; directionalLight = null; muzzleFlashLight = null; campfireGroup = null; snakeMesh = null; flameParticles = null; hitSparkParticles = null; rainLines = null; dustParticles = null; ammoCasingMesh = null;
        Object.keys(playerMeshes).forEach(id => delete playerMeshes[id]); Object.keys(enemyMeshes).forEach(id => delete enemyMeshes[id]); Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]); Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);
        sparkData = []; rainData = []; dustData = []; flameData = []; snakeCurvePoints = [];
        console.log("Renderer3D resources released.");
    }

    function getCamera() { return camera; }
    function getGroundPlane() { return groundPlane; }

    return { init, renderScene, triggerShake, cleanup, getCamera, getGroundPlane };

})();

export default Renderer3D;
