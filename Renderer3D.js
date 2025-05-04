// Renderer3D.js - FINAL COMPLETE VERSION (Procedural Characters)
import * as THREE from 'three';
// Import BufferGeometryUtils if needed for merging later (optimization, not used initially)
// import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing Final Procedural ---");

    // --- Core THREE.js Components ---
    let scene, camera, renderer, ambientLight, directionalLight;
    let gameWidth = 1600, gameHeight = 900;

    // --- Game Object Representations ---
    // Now store Groups instead of single Meshes for characters
    const playerGroups = {}; const enemyGroups = {};
    const bulletMeshes = {}; const powerupMeshes = {}; // These remain single meshes
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

    // --- Internal Constants (Dimensions for procedural drawing) ---
    const PLAYER_WIDTH = 25; const PLAYER_HEIGHT = 48; const PLAYER_ARMOR_THICKNESS = 3;
    const ENEMY_WIDTH = 20; const ENEMY_HEIGHT = 40; const ENEMY_HEAD_RADIUS = 6;
    const GIANT_MULTIPLIER = 2.5; const BULLET_RADIUS = 4;
    const POWERUP_SIZE = 20; const SNAKE_SEGMENTS = 50; const SNAKE_RADIUS = 3;
    const IDLE_BOB_SPEED = 0.005; const IDLE_BOB_AMOUNT = 0.5;

    // --- Materials ---
    // Define base materials - clones will be used for parts to allow unique properties if needed
    const matPlayerBody = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6, metalness: 0.4, name: 'PlayerBodyMat' }); // Iron Armor
    const matPlayerHelmet = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.5, metalness: 0.5, name: 'PlayerHelmetMat' }); // Iron Helmet
    const matPlayerLimbs = new THREE.MeshStandardMaterial({ color: 0x3a2d27, roughness: 0.8, metalness: 0.1, name: 'PlayerLimbMat' }); // Dark Clothing
    const matPlayerBoots = new THREE.MeshStandardMaterial({ color: 0x241c1c, roughness: 0.7, metalness: 0.1, name: 'PlayerBootMat' });
    const matPlayerSlit = new THREE.MeshBasicMaterial({ color: 0x000000, name: 'PlayerSlitMat' }); // Basic black

    const matEnemyUniform = new THREE.MeshStandardMaterial({ color: 0x18315f, roughness: 0.7, metalness: 0.1, name: 'EnemyUniformMat' });
    const matEnemyCoat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, metalness: 0.1, name: 'EnemyCoatMat' });
    const matEnemySkin = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.8, metalness: 0.1, name: 'EnemySkinMat' });
    const matEnemyBoot = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.1, name: 'EnemyBootMat' });
    const matEnemyCap = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.1, name: 'EnemyCapMat' });
    const matEnemyGiant = new THREE.MeshStandardMaterial({ color: 0xa00000, roughness: 0.5, metalness: 0.3, name: 'EnemyGiantMat' });
    const matEnemyBelt = new THREE.MeshStandardMaterial({ color: 0x412a19, roughness: 0.8, name: 'EnemyBeltMat' });

    const bulletPlayerMaterial = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: 'BulletPlayerMat' });
    const bulletEnemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, name: 'BulletEnemyMat' });
    const powerupMaterials = { /* Unchanged */
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
    const flameTexture = createFlameTexture(); flameTexture.name = "FlameTexture";
    const flameMaterial = new THREE.PointsMaterial({ size: 12, vertexColors: true, map: flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: 'FlameMat' });


    // --- Geometries --- (Using simple primitives)
    const bulletGeometry = new THREE.SphereGeometry(BULLET_RADIUS, 6, 6); bulletGeometry.name = "BulletGeo";
    const powerupGeometry = new THREE.BoxGeometry(POWERUP_SIZE, POWERUP_SIZE, POWERUP_SIZE); powerupGeometry.name = "PowerupGeo";
    const logGeometry = new THREE.CylinderGeometry(4, 4, 35, 6); logGeometry.name = "LogGeo";
    const casingGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 6); casingGeometry.name = "CasingGeo";
    // Character geometries defined within creation functions

    // --- Particle Data Storage ---
    const sparkData = []; const rainData = []; const dustData = []; const flameData = [];

    // --- Texture Helper ---
    function createFlameTexture() { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const context = canvas.getContext('2d'); const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255, 220, 150, 1)'); gradient.addColorStop(0.4, 'rgba(255, 150, 0, 0.8)'); gradient.addColorStop(1, 'rgba(200, 0, 0, 0)'); context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); const texture = new THREE.CanvasTexture(canvas); texture.name = "FlameTexture"; return texture; }

    // --- Initialization ---
    function init(containerElement, initialWidth, initialHeight) {
        console.log("--- Renderer3D.init() Final Procedural ---");
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

    // Particle/Instancing Inits (Unchanged from previous correct version)
    function initSparkParticles() { hitSparkGeometry=new THREE.BufferGeometry(); hitSparkGeometry.name="SparkGeo"; const pA=new Float32Array(MAX_SPARKS*3); const cA=new Float32Array(MAX_SPARKS*3); const aA=new Float32Array(MAX_SPARKS); sparkData.length=0; for(let i=0;i<MAX_SPARKS;i++){sparkData.push({position:new THREE.Vector3(0,-1000,0),velocity:new THREE.Vector3(),color:new THREE.Color(0xff0000),alpha:0.0,life:0});aA[i]=0.0;pA[i*3+1]=-1000;} hitSparkGeometry.setAttribute('position',new THREE.BufferAttribute(pA,3)); hitSparkGeometry.setAttribute('color',new THREE.BufferAttribute(cA,3)); hitSparkGeometry.setAttribute('alpha',new THREE.BufferAttribute(aA,1)); hitSparkParticles=new THREE.Points(hitSparkGeometry,sparkMaterial); hitSparkParticles.name="HitSparks"; hitSparkParticles.visible=true; scene.add(hitSparkParticles);}
    function initWeatherParticles() { rainGeometry=new THREE.BufferGeometry(); rainGeometry.name="RainGeo"; const rP=new Float32Array(MAX_RAIN_DROPS*3); rainData.length=0; for(let i=0;i<MAX_RAIN_DROPS;i++){rainData.push({position:new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1,Math.random()*gameHeight*1.5+gameHeight*0.5,Math.random()*gameHeight*1.2-gameHeight*0.1),velocity:new THREE.Vector3(10+Math.random()*5,-300-Math.random()*100,0)}); rP[i*3+1]=-1000;} rainGeometry.setAttribute('position',new THREE.BufferAttribute(rP,3)); rainParticles=new THREE.Points(rainGeometry,rainMaterial); rainParticles.name="Rain"; rainParticles.visible=false; scene.add(rainParticles); dustGeometry=new THREE.BufferGeometry(); dustGeometry.name="DustGeo"; const dP=new Float32Array(MAX_DUST_MOTES*3); dustData.length=0; for(let i=0;i<MAX_DUST_MOTES;i++){dustData.push({position:new THREE.Vector3(Math.random()*gameWidth*1.2-gameWidth*0.1,Math.random()*50+5,Math.random()*gameHeight*1.2-gameHeight*0.1),velocity:new THREE.Vector3((Math.random()-0.5)*50,Math.random()*5,(Math.random()-0.5)*50),rotation:Math.random()*Math.PI*2}); dP[i*3+1]=-1000;} dustGeometry.setAttribute('position',new THREE.BufferAttribute(dP,3)); dustParticles=new THREE.Points(dustGeometry,dustMaterial); dustParticles.name="Dust"; dustParticles.visible=false; scene.add(dustParticles);}
    function initAmmoCasings() { ammoCasingMesh=new THREE.InstancedMesh(casingGeometry,casingMaterial,MAX_CASINGS); ammoCasingMesh.name="AmmoCasings"; ammoCasingMesh.castShadow=true; ammoCasingMesh.count=0; scene.add(ammoCasingMesh); }
    function initCampfire() { campfireGroup=new THREE.Group(); campfireGroup.name="CampfireGroup"; const log1=new THREE.Mesh(logGeometry,logMaterial); log1.rotation.z=Math.PI/6; log1.rotation.y=Math.PI/10; log1.castShadow=true; log1.name="Log1"; const log2=new THREE.Mesh(logGeometry,logMaterial); log2.rotation.z=-Math.PI/5; log2.rotation.y=-Math.PI/8; log2.castShadow=true; log2.name="Log2"; campfireGroup.add(log1); campfireGroup.add(log2); const glowLight=new THREE.PointLight(0xffa500,0,150,1.8); glowLight.position.y=FLAME_PARTICLE_Y_OFFSET+5; glowLight.name="CampfireGlow"; campfireGroup.add(glowLight); campfireGroup.userData.glowLight=glowLight; flameGeometry=new THREE.BufferGeometry(); flameGeometry.name="FlameGeo"; const fP=new Float32Array(MAX_FLAMES*3); const fC=new Float32Array(MAX_FLAMES*3); const fA=new Float32Array(MAX_FLAMES); flameData.length=0; for(let i=0;i<MAX_FLAMES;i++){flameData.push({position:new THREE.Vector3(0,-1000,0),velocity:new THREE.Vector3(),color:new THREE.Color(1,1,1),alpha:0.0,life:0,baseLife:0.5+Math.random()*0.4}); fP[i*3+1]=-1000; fA[i]=0.0;} flameGeometry.setAttribute('position',new THREE.BufferAttribute(fP,3)); flameGeometry.setAttribute('color',new THREE.BufferAttribute(fC,3)); flameGeometry.setAttribute('alpha',new THREE.BufferAttribute(fA,1)); flameParticles=new THREE.Points(flameGeometry,flameMaterial); flameParticles.name="Flames"; campfireGroup.add(flameParticles); campfireGroup.userData.flameParticles=flameParticles; campfireGroup.visible=false; scene.add(campfireGroup);}
    function initSnake() { const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,5,0),new THREE.Vector3(10,5,0)]); const snakeGeometry=new THREE.TubeGeometry(curve,DEF_SNAKE_SEGMENTS,SNAKE_RADIUS,5,false); snakeGeometry.name="SnakeGeo"; snakeMesh=new THREE.Mesh(snakeGeometry,snakeMaterial); snakeMesh.name="Snake"; snakeMesh.castShadow=true; snakeMesh.visible=false; scene.add(snakeMesh);}

    // --- Resize Handler ---
    function handleResize() { if (!renderer || !camera) return; renderer.setSize(gameWidth, gameHeight); const aspect = gameWidth / gameHeight; const frustumSize = gameHeight; camera.left = frustumSize * aspect / -2; camera.right = frustumSize * aspect / 2; camera.top = frustumSize / 2; camera.bottom = frustumSize / -2; camera.position.set(gameWidth / 2, 1000, gameHeight / 2); camera.lookAt(gameWidth / 2, 0, gameHeight / 2); camera.updateProjectionMatrix(); console.log(`Renderer resized to: ${gameWidth}x${gameHeight}`); }

    // --- Procedural Entity Creation ---
    function createPlayerGroup(playerData) {
        const group = new THREE.Group();
        group.name = `PlayerGroup_${playerData.id.substring(0,4)}`;

        const torsoHeight = PLAYER_HEIGHT * 0.45;
        const torsoWidth = PLAYER_WIDTH * 1.1;
        const helmetHeight = PLAYER_HEIGHT * 0.26;
        const helmetWidth = PLAYER_WIDTH * 0.85;
        const legHeight = PLAYER_HEIGHT * 0.35;
        const legWidth = PLAYER_WIDTH * 0.35;
        const bootHeight = PLAYER_HEIGHT * 0.15;
        const bootWidth = PLAYER_WIDTH * 0.4;
        const shoulderPadHeight = PLAYER_HEIGHT * 0.18;
        const shoulderPadWidth = PLAYER_WIDTH * 0.45;

        // Torso (Armor Plate)
        const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, PLAYER_ARMOR_THICKNESS * 3); // Give some depth
        const torso = new THREE.Mesh(torsoGeo, matPlayerBody.clone());
        torso.position.y = legHeight + bootHeight + torsoHeight / 2;
        torso.castShadow = true; torso.receiveShadow = true; torso.name = "Torso";
        group.add(torso);

        // Helmet
        const helmetGeo = new THREE.BoxGeometry(helmetWidth, helmetHeight, helmetWidth * 0.9); // Slightly less deep
        const helmet = new THREE.Mesh(helmetGeo, matPlayerHelmet.clone());
        helmet.position.y = torso.position.y + torsoHeight / 2 + helmetHeight / 2 - 2; // Position above torso
        helmet.castShadow = true; helmet.name = "Helmet";
        group.add(helmet);
        // Helmet Slit (Overlay)
        const slitHeight = helmetHeight * 0.1;
        const slitGeo = new THREE.PlaneGeometry(helmetWidth * 0.8, slitHeight);
        const slit = new THREE.Mesh(slitGeo, matPlayerSlit);
        slit.position.y = helmet.position.y - helmetHeight * 0.05; // Center vertically
        slit.position.z = helmetWidth * 0.9 / 2 + 0.1; // Position slightly in front
        helmet.add(slit); // Add slit to helmet for easier positioning relative to helmet

        // Legs (Simple Cylinders)
        const legGeo = new THREE.CylinderGeometry(legWidth/2, legWidth/2, legHeight, 6);
        const leftLeg = new THREE.Mesh(legGeo, matPlayerLimbs.clone());
        leftLeg.position.set(-PLAYER_WIDTH * 0.3, bootHeight + legHeight / 2, 0);
        leftLeg.castShadow = true; leftLeg.name = "LeftLeg";
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, matPlayerLimbs.clone());
        rightLeg.position.set(PLAYER_WIDTH * 0.3, bootHeight + legHeight / 2, 0);
        rightLeg.castShadow = true; rightLeg.name = "RightLeg";
        group.add(rightLeg);

        // Boots (Slightly larger Cylinders)
        const bootGeo = new THREE.CylinderGeometry(bootWidth/2, bootWidth/2, bootHeight, 6);
        const leftBoot = new THREE.Mesh(bootGeo, matPlayerBoots.clone());
        leftBoot.position.set(-PLAYER_WIDTH * 0.3, bootHeight / 2, 0);
        leftBoot.castShadow = true; leftBoot.name = "LeftBoot";
        group.add(leftBoot);
        const rightBoot = new THREE.Mesh(bootGeo, matPlayerBoots.clone());
        rightBoot.position.set(PLAYER_WIDTH * 0.3, bootHeight / 2, 0);
        rightBoot.castShadow = true; rightBoot.name = "RightBoot";
        group.add(rightBoot);

        // Shoulder Pads (Half Cylinders - Approximation)
        const shoulderGeo = new THREE.CylinderGeometry(shoulderPadWidth/2, shoulderPadWidth/2, shoulderPadHeight, 8, 1, true, 0, Math.PI); // Open ended, half circle
        const leftShoulder = new THREE.Mesh(shoulderGeo, matPlayerBody.clone());
        leftShoulder.rotation.z = Math.PI / 2; // Rotate to cover shoulder
        leftShoulder.position.set(-torsoWidth/2 - shoulderPadWidth*0.1, torso.position.y + torsoHeight*0.35, 0);
        leftShoulder.castShadow = true; leftShoulder.name = "LeftShoulder";
        group.add(leftShoulder);
        const rightShoulder = new THREE.Mesh(shoulderGeo, matPlayerBody.clone());
        rightShoulder.rotation.z = -Math.PI / 2; // Rotate other way
        rightShoulder.position.set(torsoWidth/2 + shoulderPadWidth*0.1, torso.position.y + torsoHeight*0.35, 0);
        rightShoulder.castShadow = true; rightShoulder.name = "RightShoulder";
        group.add(rightShoulder);

        // Position the entire group
        group.position.set(playerData.x, 0, playerData.y); // Group origin at feet (Y=0)
        group.userData.gameId = playerData.id;
        group.userData.bobOffset = 0; // For idle animation

        // Store references for animation if needed later
        group.userData.leftLeg = leftLeg;
        group.userData.rightLeg = rightLeg;

        return group;
    }

    function createEnemyGroup(enemyData) {
        const group = new THREE.Group();
        group.name = `EnemyGroup_${enemyData.type}_${enemyData.id.substring(0,4)}`;
        const scale = enemyData.type === 'giant' ? GIANT_MULTIPLIER : 1;
        const eHeight = ENEMY_HEIGHT * scale;
        const eWidth = ENEMY_WIDTH * scale;
        const headRadius = ENEMY_HEAD_RADIUS * scale;

        const torsoHeight = eHeight * 0.5;
        const torsoWidth = eWidth * 0.8;
        const legHeight = eHeight * 0.35;
        const legWidth = eWidth * 0.25;
        const bootHeight = eHeight * 0.15;
        const bootWidth = legWidth * 1.2;
        const armHeight = torsoHeight * 0.9;
        const armWidth = legWidth * 0.8;

        // Choose materials based on type
        let torsoMat = enemyData.type === 'giant' ? matEnemyGiant.clone() : matEnemyUniform.clone();
        let limbMat = enemyData.type === 'giant' ? matEnemyGiant.clone() : matEnemyCoat.clone(); // Giantlimbs same as body
        let headMat = matEnemySkin.clone();
        let hatMat = matEnemyCap.clone();
        let bootMat = matEnemyBoot.clone();

        // Torso
        const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoWidth * 0.6);
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.y = legHeight + bootHeight + torsoHeight / 2;
        torso.castShadow = true; torso.name = "Torso";
        group.add(torso);

        // Head (Sphere)
        const headGeo = new THREE.SphereGeometry(headRadius, 8, 6);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = torso.position.y + torsoHeight / 2 + headRadius * 0.8;
        head.castShadow = true; head.name = "Head";
        group.add(head);

        // Hat (Cylinder)
        const hatHeight = headRadius * 1.2 * (enemyData.type === 'giant' ? 1.5 : 1);
        const hatRadius = headRadius * (enemyData.type === 'giant' ? 1.4 : 1.3);
        const hatGeo = new THREE.CylinderGeometry(hatRadius * 0.8, hatRadius, hatHeight, 8);
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = head.position.y + headRadius * 0.6 + hatHeight / 2;
        hat.castShadow = true; hat.name = "Hat";
        group.add(hat);

        // Legs
        const legGeo = new THREE.CylinderGeometry(legWidth/2, legWidth/2, legHeight, 5);
        const leftLeg = new THREE.Mesh(legGeo, limbMat); // Use coat/limb material
        leftLeg.position.set(-eWidth * 0.2, bootHeight + legHeight / 2, 0);
        leftLeg.castShadow = true; leftLeg.name = "LeftLeg";
        group.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, limbMat.clone()); // Clone if needed
        rightLeg.position.set(eWidth * 0.2, bootHeight + legHeight / 2, 0);
        rightLeg.castShadow = true; rightLeg.name = "RightLeg";
        group.add(rightLeg);

        // Boots
        const bootGeo = new THREE.CylinderGeometry(bootWidth/2, bootWidth/2, bootHeight, 5);
        const leftBoot = new THREE.Mesh(bootGeo, bootMat);
        leftBoot.position.set(-eWidth * 0.2, bootHeight / 2, 0);
        leftBoot.castShadow = true; leftBoot.name = "LeftBoot";
        group.add(leftBoot);
        const rightBoot = new THREE.Mesh(bootGeo, bootMat.clone());
        rightBoot.position.set(eWidth * 0.2, bootHeight / 2, 0);
        rightBoot.castShadow = true; rightBoot.name = "RightBoot";
        group.add(rightBoot);

        // Arms
        const armGeo = new THREE.CylinderGeometry(armWidth/2, armWidth/2, armHeight, 5);
        const leftArm = new THREE.Mesh(armGeo, limbMat.clone());
        leftArm.position.set(-torsoWidth / 2 - armWidth / 2, torso.position.y, 0);
        leftArm.castShadow = true; leftArm.name = "LeftArm";
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, limbMat.clone());
        rightArm.position.set(torsoWidth / 2 + armWidth / 2, torso.position.y, 0);
        rightArm.castShadow = true; rightArm.name = "RightArm";
        group.add(rightArm);

        // Giant Belt
        if (enemyData.type === 'giant') {
            const beltHeight = torsoHeight * 0.08;
            const beltGeo = new THREE.BoxGeometry(torsoWidth * 1.05, beltHeight, torsoWidth * 0.6 * 1.05);
            const belt = new THREE.Mesh(beltGeo, matEnemyBelt);
            belt.position.y = torso.position.y - torsoHeight * 0.5 + torsoHeight * 0.7 + beltHeight / 2; // Position on torso
            group.add(belt);
        }

        // Set group position (origin at feet) and store data
        group.position.set(enemyData.x, 0, enemyData.y);
        group.userData.gameId = enemyData.id;
        group.userData.type = enemyData.type;
        group.userData.bobOffset = 0; // For idle animation
        group.userData.leftLeg = leftLeg; // Store for animation
        group.userData.rightLeg = rightLeg;
        group.userData.leftArm = leftArm;
        group.userData.rightArm = rightArm;

        // Initial material opacity for fading
        group.traverse(child => { if(child.material) child.material.opacity = 1.0; });

        return group;
    }

    // --- Entity Update & Disposal (Modified for Groups) ---
    function updateMeshes(state, groupDict, createFn, localEffects, appState) {
        const activeIds = new Set();
        const now = performance.now();
        if (state) {
            for (const id in state) {
                const data = state[id]; if (typeof data.x !== 'number' || typeof data.y !== 'number') continue; activeIds.add(id);
                let group = groupDict[id];
                if (!group) { group = createFn(data); if (group) { groupDict[id] = group; scene.add(group); } }
                else {
                    // Update Group Position (origin at feet)
                    group.position.set(data.x, 0, data.y);

                    // --- Idle Bob Animation ---
                    let bob = 0;
                    if (groupDict === playerGroups || (groupDict === enemyGroups && group.userData.type !== 'giant')) { // Only bob non-giants
                        // Check if moving (simplified check)
                         const isMoving = (groupDict === playerGroups && appState?.localPlayerId === id && (appState.localPlayerAimState.lastAimDx !== 0 || appState.localPlayerAimState.lastAimDy !== 0)) ||
                                         (groupDict === enemyGroups /* Add enemy moving condition based on state? */);
                         if (!isMoving) {
                             bob = Math.sin(now * IDLE_BOB_SPEED) * IDLE_BOB_AMOUNT;
                             group.position.y = bob; // Apply bob directly to group's Y
                         } else {
                              group.position.y = 0; // Reset bob when moving
                         }
                         group.userData.bobOffset = bob; // Store for other calculations if needed
                    }


                    // --- Enemy Fading ---
                    if (groupDict === enemyGroups && data.health <= 0 && data.death_timestamp) {
                        const fadeDuration = 0.3; const timeSinceDeath = (now/1000) - data.death_timestamp;
                        const opacity = Math.max(0, 1.0 - (timeSinceDeath / fadeDuration));
                        group.visible = opacity > 0.001;
                        group.traverse(child => { if(child.material) child.material.opacity = opacity; });
                    } else if (!group.visible || group.children[0]?.material.opacity < 1.0) { // Check first child's material opacity
                        group.visible = true;
                        group.traverse(child => { if(child.material) child.material.opacity = 1.0; });
                    }

                    // --- Powerup Rotation ---
                    if (group.userData.isPowerup) { group.rotation.y += 0.01; group.rotation.x += 0.005; }

                    // --- Aiming Rotation (Player Only) ---
                    if (groupDict === playerGroups && id === appState?.localPlayerId) {
                         updatePlayerAiming(appState, group); // Pass the group
                    }

                    // --- Pushback Visual Cue (Local Player Only) ---
                    if (groupDict === playerGroups && id === appState?.localPlayerId && localEffects?.pushbackAnim?.active) {
                         const pushbackProgress = Math.max(0,(localEffects.pushbackAnim.endTime-now)/localEffects.pushbackAnim.duration);
                         const intensity = Math.sin(pushbackProgress*Math.PI)*0.6;
                         group.traverse(child => { if(child.material && child.material.emissive) { child.material.emissive.setHex(0x66ccff); child.material.emissiveIntensity=intensity; }});
                    } else {
                        // Check if emissive needs resetting (do this less often maybe)
                         const torso = group.getObjectByName("Torso"); // Example check
                         if(torso && torso.material.emissiveIntensity > 0) {
                            group.traverse(child => { if(child.material && child.material.emissive) child.material.emissiveIntensity = 0; });
                         }
                    }

                    // --- Basic Walk/Attack Animation (Procedural) ---
                    // Apply simple rotations based on state
                    const leftLeg = group.userData.leftLeg;
                    const rightLeg = group.userData.rightLeg;
                    const leftArm = group.userData.leftArm; // Assumes enemies have arms stored
                    const rightArm = group.userData.rightArm;
                    const isMoving = group.position.y === 0 && group.userData.bobOffset === 0; // Simple check if not bobbing

                    if (isMoving && leftLeg && rightLeg) {
                        const walkCycle = now * 0.008; // Speed of walk cycle
                        leftLeg.rotation.x = Math.sin(walkCycle) * 0.4;
                        rightLeg.rotation.x = Math.sin(walkCycle + Math.PI) * 0.4;
                    } else if (leftLeg && rightLeg){
                        leftLeg.rotation.x = 0; // Reset leg rotation when idle
                        rightLeg.rotation.x = 0;
                    }

                    // Giant Attack Windup/Attack
                    if (group.userData.type === 'giant' && leftArm && rightArm) {
                         if (data.attack_state === 'winding_up' || data.attack_state === 'attacking') {
                             leftArm.rotation.z = Math.PI / 4; // Raise arms
                             rightArm.rotation.z = -Math.PI / 4;
                             leftArm.rotation.x = -Math.PI / 6; // Forward slightly
                             rightArm.rotation.x = -Math.PI / 6;
                         } else {
                              leftArm.rotation.set(0,0,0); // Reset arm rotation
                              rightArm.rotation.set(0,0,0);
                         }
                    } else if (leftArm && rightArm) { // Reset other enemy arms
                         leftArm.rotation.set(0,0,0);
                         rightArm.rotation.set(0,0,0);
                    }

                }
            }
        }
        // Remove & Dispose Groups
        for (const id in groupDict) { if (!activeIds.has(id)) { const groupToRemove = groupDict[id]; if (groupToRemove) { scene.remove(groupToRemove); groupToRemove.traverse(child => { if (child.geometry) child.geometry.dispose(); if (child.material) { if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); } }); } delete groupDict[id]; } }
    }

    // No longer need getYOffset - positioning is handled by group structure
    function updatePlayerAiming(appState, group) { // Accept group directly
        if (!appState?.localPlayerId || !appState.localPlayerAimState || !group) return;
        const aimDx = appState.localPlayerAimState.lastAimDx; const aimDy = appState.localPlayerAimState.lastAimDy;
        const angle = Math.atan2(aimDx, aimDy);
        group.rotation.y = angle; // Rotate the entire group
    }

    // --- Environment Update ---
    function updateEnvironment(isNight) { const dayLightIntensity=1.0, nightLightIntensity=0.3; const dayAmbientIntensity=0.6, nightAmbientIntensity=0.15; const dayDirColor=0xffffff, nightDirColor=0xaaaaff; const dayAmbColor=0xffffff, nightAmbColor=0x444488; ambientLight.intensity=isNight?nightAmbientIntensity:dayAmbientIntensity; ambientLight.color.setHex(isNight?nightAmbColor:dayAmbColor); directionalLight.intensity=isNight?nightLightIntensity:dayLightIntensity; directionalLight.color.setHex(isNight?nightDirColor:dayDirColor); groundPlane.material=isNight?groundNightMaterial:groundDayMaterial; }

    // --- Effect Updates ---
    function updateMuzzleFlash(appState, flashState) { if (!muzzleFlashLight || !appState?.localPlayerId) return; const playerGroup = playerGroups[appState.localPlayerId]; if (!playerGroup) return; const now = performance.now(); if (flashState.active && now < flashState.endTime) { muzzleFlashLight.intensity = 3.0 + Math.random() * 2.0; const offsetDistance = PLAYER_WIDTH * 0.8; const aimAngle = playerGroup.rotation.y; const playerWorldPos = playerGroup.position; muzzleFlashLight.position.set( playerWorldPos.x + Math.sin(aimAngle) * offsetDistance, PLAYER_MESH_Y_OFFSET * 1.1, playerWorldPos.z + Math.cos(aimAngle) * offsetDistance ); } else { muzzleFlashLight.intensity = 0; if (flashState.active) flashState.active = false; } }
    function updateHitSparks(activeSparkEffects, deltaTime) { if (!hitSparkParticles||!hitSparkGeometry) return; const positions=hitSparkGeometry.attributes.position.array; const colors=hitSparkGeometry.attributes.color.array; const alphas=hitSparkGeometry.attributes.alpha.array; let visibleSparks=false; let firstInactiveIndex=0; const now = performance.now(); for(const enemyId in activeSparkEffects){ const effectEndTime=activeSparkEffects[enemyId]; const enemyGroup=enemyGroups[enemyId]; if(now < effectEndTime && enemyGroup){ const sparksToSpawn=3+Math.floor(Math.random()*4); const enemyPos=enemyGroup.position; for(let i=0;i<sparksToSpawn;i++){ let foundSlot=false; for(let j=firstInactiveIndex; j < MAX_SPARKS; j++){ const p=sparkData[j]; if(p.life<=0){ p.position.copy(enemyPos); const yOffset = (enemyGroup.userData.type === 'giant') ? GIANT_MESH_Y_OFFSET : ENEMY_MESH_Y_OFFSET; p.position.y+=Math.random()*yOffset*1.5; const angle=Math.random()*Math.PI*2; const speed=100+Math.random()*80; p.velocity.set(Math.cos(angle)*speed,(Math.random()-0.3)*speed*0.5,Math.sin(angle)*speed); p.color.setRGB(1,Math.random()*0.5,0); p.alpha=0.9+Math.random()*0.1; p.life=0.2+Math.random()*0.3; firstInactiveIndex=j+1; foundSlot=true; break;}} if (!foundSlot) break; } delete activeSparkEffects[enemyId]; } } let aliveCount=0; for(let i=0;i<MAX_SPARKS;i++){ const p=sparkData[i]; if(p.life>0){ p.life-=deltaTime; if(p.life<=0){p.alpha=0; p.position.y = -1000; } else { p.position.addScaledVector(p.velocity,deltaTime); p.velocity.y-=200*deltaTime; p.alpha=Math.max(0,p.alpha-deltaTime*2.5); aliveCount++; } positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; alphas[i]=p.alpha; } else { if(alphas[i]>0) alphas[i]=0; } } if(aliveCount>0){ hitSparkGeometry.attributes.position.needsUpdate=true; hitSparkGeometry.attributes.color.needsUpdate=true; hitSparkGeometry.attributes.alpha.needsUpdate=true; visibleSparks=true; } hitSparkParticles.visible=visibleSparks; }
    function updateAmmoCasings(activeCasings) { if (!ammoCasingMesh) return; const dummy=new THREE.Object3D(); let visibleCount=0; for(let i=0; i<activeCasings.length && i<MAX_CASINGS; i++){ const casing=activeCasings[i]; dummy.position.set(casing.x,casing.height/2+0.5,casing.y); dummy.rotation.set(Math.PI/2 + (Math.random()-0.5)*0.5, casing.rotation, (Math.random()-0.5)*0.5); dummy.updateMatrix(); ammoCasingMesh.setMatrixAt(i,dummy.matrix); visibleCount++; } ammoCasingMesh.count=visibleCount; ammoCasingMesh.instanceMatrix.needsUpdate=true; }
    function updateWeatherParticles(appState, deltaTime) { if(!appState)return; if(rainParticles&&rainGeometry){ rainParticles.visible=appState.isRaining; if(appState.isRaining){const positions=rainGeometry.attributes.position.array; for(let i=0;i<MAX_RAIN_DROPS;i++){ const p=rainData[i]; p.position.addScaledVector(p.velocity,deltaTime); if(p.position.y<-10){ p.position.x=Math.random()*gameWidth*1.2-gameWidth*0.1; p.position.y=gameHeight*1.5; p.position.z=Math.random()*gameHeight*1.2-gameHeight*0.1;} positions[i*3]=p.position.x;positions[i*3+1]=p.position.y;positions[i*3+2]=p.position.z;} rainGeometry.attributes.position.needsUpdate=true;}} if(dustParticles&&dustGeometry){ dustParticles.visible=appState.isDustStorm; if(appState.isDustStorm){const positions=dustGeometry.attributes.position.array; for(let i=0;i<MAX_DUST_MOTES;i++){ const p=dustData[i]; p.position.addScaledVector(p.velocity,deltaTime); p.velocity.x+=(Math.random()-0.5)*50*deltaTime; p.velocity.z+=(Math.random()-0.5)*50*deltaTime; p.position.y=Math.max(1,Math.min(50,p.position.y+(Math.random()-0.5)*10*deltaTime)); if(p.position.x<-gameWidth*0.1)p.position.x+=gameWidth*1.2; if(p.position.x>gameWidth*1.1)p.position.x-=gameWidth*1.2; if(p.position.z<-gameHeight*0.1)p.position.z+=gameHeight*1.2; if(p.position.z>gameHeight*1.1)p.position.z-=gameHeight*1.2; positions[i*3]=p.position.x;positions[i*3+1]=p.position.y;positions[i*3+2]=p.position.z;} dustGeometry.attributes.position.needsUpdate=true;}}}

    // --- Specific Object Updates ---
    function updateSnake(snakeData) { if (!snakeMesh||!snakeData) return; snakeMesh.visible=snakeData.isActiveFromServer; if(snakeData.isActiveFromServer&&snakeData.segments&&snakeData.segments.length>1){ const curvePoints=snakeData.segments.map(seg=>new THREE.Vector3(seg.x,SNAKE_RADIUS,seg.y)); if (curvePoints.length >= 2) { const curve=new THREE.CatmullRomCurve3(curvePoints); const newGeometry=new THREE.TubeGeometry(curve,DEF_SNAKE_SEGMENTS,SNAKE_RADIUS,5,false); newGeometry.name = "SnakeGeo_Updated"; snakeMesh.geometry.dispose(); snakeMesh.geometry=newGeometry; } else { snakeMesh.visible = false; } } else { snakeMesh.visible = false; } }
    function updateCampfire(campfireData, deltaTime) { if (!campfireGroup || !campfireData) return; campfireGroup.visible = campfireData.active; if (campfireData.active) { campfireGroup.position.set(campfireData.x, 0, campfireData.y); const glowLight = campfireGroup.userData.glowLight; if (glowLight) glowLight.intensity = 1.5 + Math.sin(performance.now() * 0.002) * 0.5; if (flameParticles && flameGeometry) { const positions = flameGeometry.attributes.position.array; const colors = flameGeometry.attributes.color.array; const alphas = flameGeometry.attributes.alpha.array; let aliveCount = 0; let firstInactiveFlame = 0; for(let i=0; i < MAX_FLAMES; i++) { const p = flameData[i]; if (p.life <= 0 && Math.random() < 0.15 && i >= firstInactiveFlame) { p.position.set((Math.random()-0.5)*15, FLAME_PARTICLE_Y_OFFSET, (Math.random()-0.5)*15); p.velocity.set((Math.random()-0.5)*15, 45 + Math.random()*25, (Math.random()-0.5)*15); p.life = p.baseLife; p.alpha = 0.8 + Math.random()*0.2; p.color.setHSL(0.1, 1.0, 0.6 + Math.random()*0.1); firstInactiveFlame = i + 1; } if (p.life > 0) { p.life -= deltaTime; if (p.life <= 0) { p.alpha=0; p.position.y=-1000; } else { p.position.addScaledVector(p.velocity, deltaTime); p.velocity.y += (Math.random()-0.45)*60*deltaTime; p.alpha = Math.max(0, (p.life / p.baseLife) * 0.9); p.color.lerp(new THREE.Color(0.9, 0.2, 0), deltaTime * 1.1); aliveCount++; } positions[i*3]=p.position.x; positions[i*3+1]=p.position.y; positions[i*3+2]=p.position.z; colors[i*3]=p.color.r; colors[i*3+1]=p.color.g; colors[i*3+2]=p.color.b; alphas[i]=p.alpha; } else { if (alphas[i] > 0) alphas[i] = 0.0; } } if (aliveCount > 0) { flameGeometry.attributes.position.needsUpdate=true; flameGeometry.attributes.color.needsUpdate=true; flameGeometry.attributes.alpha.needsUpdate=true; } } } }

    // --- Screen Position Calculation ---
    function getScreenPosition(worldPosition, cameraRef, rendererRef) { if (!rendererRef || !rendererRef.domElement) return { x: 0, y: 0 }; const vector=worldPosition.clone(); vector.project(cameraRef); const screenX=Math.round((vector.x+1)*rendererRef.domElement.width/2); const screenY=Math.round((-vector.y+1)*rendererRef.domElement.height/2); return{x:screenX,y:screenY}; }

    // --- Main Render Function ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) { return; }
        let dimensionsChanged = false; if (appState.canvasWidth && appState.canvasHeight && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) { gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight; dimensionsChanged = true; } if (dimensionsChanged) handleResize();
        const now = performance.now(); const deltaTime = appState.lastLoopTime ? Math.min(0.1, (now - appState.lastLoopTime) / 1000) : 0.016;

        if (shakeMagnitude > 0 && now < shakeEndTime) { const timeRemaining=shakeEndTime-now; const initialDurationEst=Math.max(1,shakeEndTime-(now-timeRemaining)); const currentMag=shakeMagnitude*Math.max(0,timeRemaining/initialDurationEst); const shakeAngle=Math.random()*Math.PI*2; screenShakeOffset.x=Math.cos(shakeAngle)*currentMag; screenShakeOffset.z=Math.sin(shakeAngle)*currentMag; } else { shakeMagnitude = 0; screenShakeOffset.set(0, 0, 0); }
        camera.position.set( gameWidth / 2 + screenShakeOffset.x, 1000, gameHeight / 2 + screenShakeOffset.z );

        updateEnvironment(stateToRender.is_night); updateMuzzleFlash(appState, localEffects.muzzleFlash); updateHitSparks(localEffects.activeBloodSparkEffects, deltaTime); updateAmmoCasings(localEffects.activeAmmoCasings); updateWeatherParticles(appState, deltaTime); updateSnake(localEffects.snake); updateCampfire(stateToRender.campfire, deltaTime);
        // Pass defaultYOffsetFn (now implicit via group structure), localEffects, and appState to updateMeshes
        updateMeshes(stateToRender.players, playerGroups, createPlayerGroup, localEffects, appState); // Use playerGroups
        updateMeshes(stateToRender.enemies, enemyGroups, createEnemyGroup, localEffects, appState); // Use enemyGroups
        updateMeshes(stateToRender.bullets, bulletMeshes, createBulletMesh, localEffects, appState); // Bullets still single mesh
        updateMeshes(stateToRender.powerups, powerupMeshes, createPowerupMesh, localEffects, appState); // Powerups still single mesh
        updatePlayerAiming(appState); // Aiming rotates the player group

        const uiPositions = {}; const calculateUIPos = (groupDict, stateDict, yOffset) => { for (const id in groupDict) { const group = groupDict[id]; if (group && stateDict?.[id] && group.visible) { const worldPos = group.position.clone(); worldPos.y += yOffset * 1.1; const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } } };
        calculateUIPos(playerGroups, stateToRender.players, PLAYER_HEIGHT); // Use PLAYER_HEIGHT for offset calc
        calculateUIPos(enemyGroups, stateToRender.enemies, (data) => data.type === 'giant' ? ENEMY_HEIGHT * GIANT_MULTIPLIER : ENEMY_HEIGHT); // Dynamic offset based on type
        if (stateToRender.damage_texts) { for (const id in stateToRender.damage_texts) { const dt = stateToRender.damage_texts[id]; const worldPos = new THREE.Vector3(dt.x, PLAYER_HEIGHT / 2, dt.y); const screenPos = getScreenPosition(worldPos, camera, renderer); uiPositions[id] = { screenX: screenPos.x, screenY: screenPos.y }; } }
        appState.uiPositions = uiPositions;

        try { renderer.render(scene, camera); }
        catch (e) { console.error("Render Error:", e); if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; console.error("Stopped loop.");} }
    }

    // --- Effect Triggers ---
    function triggerShake(magnitude, durationMs) { const now=performance.now(); const newEndTime=now+durationMs; if(magnitude>=shakeMagnitude||newEndTime>shakeEndTime){shakeMagnitude=Math.max(magnitude,shakeMagnitude); shakeEndTime=Math.max(newEndTime,shakeEndTime);} }

    // --- Cleanup ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup Final ---"); window.removeEventListener('resize', handleResize);
        if(hitSparkGeometry)hitSparkGeometry.dispose(); if(rainGeometry)rainGeometry.dispose(); if(dustGeometry)dustGeometry.dispose(); if(flameGeometry)flameGeometry.dispose();
        if(sparkMaterial)sparkMaterial.dispose(); if(rainMaterial)rainMaterial.dispose(); if(dustMaterial)dustMaterial.dispose(); if(flameMaterial){flameMaterial.map?.dispose(); flameMaterial.dispose();}
        scene?.remove(ammoCasingMesh); ammoCasingMesh=null; scene?.remove(snakeMesh); if(snakeMesh?.geometry)snakeMesh.geometry.dispose(); snakeMesh=null; scene?.remove(campfireGroup); campfireGroup=null;
        while(scene?.children.length > 0){ const child = scene.children[0]; scene.remove(child); if(child instanceof THREE.Group){ child.traverse(subChild => { if(subChild.geometry) subChild.geometry.dispose(); if(subChild.material){ if(Array.isArray(subChild.material))subChild.material.forEach(m => m.dispose()); else if(subChild.material.dispose) subChild.material.dispose(); } }); } else { if(child.geometry) child.geometry.dispose(); if(child.material){if(Array.isArray(child.material))child.material.forEach(m => m.dispose()); else if(child.material.dispose) child.material.dispose();} if(child instanceof THREE.Light && child.dispose)child.dispose();} }
        // Dispose base geometries
        playerGeometry?.dispose(); enemyChaserGeometry?.dispose(); enemyShooterGeometry?.dispose(); enemyGiantGeometry?.dispose(); bulletGeometry?.dispose(); powerupGeometry?.dispose(); logGeometry?.dispose(); casingGeometry?.dispose(); groundGeometryPlane?.dispose();
        // Dispose base materials
        Object.values(powerupMaterials).forEach(m => m?.dispose()); playerMaterialBase?.dispose(); enemyChaserMaterialBase?.dispose(); enemyShooterMaterialBase?.dispose(); enemyGiantMaterialBase?.dispose(); bulletPlayerMaterial?.dispose(); bulletEnemyMaterial?.dispose(); snakeMaterial?.dispose(); logMaterial?.dispose(); casingMaterial?.dispose(); groundDayMaterial?.dispose(); groundNightMaterial?.dispose(); flameTexture?.dispose();
        if (renderer) { renderer.dispose(); if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer = null; }
        scene = null; camera = null; groundPlane = null; ambientLight = null; directionalLight = null; muzzleFlashLight = null; flameParticles = null; hitSparkParticles = null; rainParticles = null; dustParticles = null;
        Object.keys(playerGroups).forEach(id => delete playerGroups[id]); Object.keys(enemyGroups).forEach(id => delete enemyGroups[id]); Object.keys(bulletMeshes).forEach(id => delete bulletMeshes[id]); Object.keys(powerupMeshes).forEach(id => delete powerupMeshes[id]);
        sparkData.length = 0; rainData.length = 0; dustData.length = 0; flameData.length = 0;
        console.log("Renderer3D resources released.");
    }

    return { init, renderScene, triggerShake, cleanup };

})();

export default Renderer3D;
