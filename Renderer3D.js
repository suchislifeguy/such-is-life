// Renderer3D.js v3.3 - PARTIAL ROLLBACK FOR DEBUGGING
// Reverts the fixed world size logic back to dynamic scaling based on canvas size.
// Keeps boundary/campfire enhancements for now.

import * as THREE from 'three';

// --- Constants ---
// REMOVED: WORLD_WIDTH, WORLD_HEIGHT
// const WORLD_WIDTH = 2000;
// const WORLD_HEIGHT = 1500;
const DEFAULT_GAME_WIDTH = 1600; // Keep defaults for initial setup
const DEFAULT_GAME_HEIGHT = 900;
const CAMERA_FOV = 60;
const CAMERA_NEAR = 10;
// const CAMERA_FAR = 3500; // Revert FAR distance if needed, or keep increased
const CAMERA_FAR = 2500; // Reverted FAR
const CAMERA_HEIGHT_OFFSET = 950;
const CAMERA_DISTANCE_OFFSET = 300;
const CAMERA_LERP_FACTOR = 0.08;
const GROUND_MARGIN = 1.2; // *** RE-ADDED GROUND_MARGIN ***

// ... (Other constants remain largely the same: Instancing, Entity Props, Particles etc.) ...
const BOUNDARY_WALL_HEIGHT = 60;
const BOUNDARY_WALL_DEPTH = 20;
const Y_OFFSET_BOUNDARY = BOUNDARY_WALL_HEIGHT / 2;


// --- Module Scope Variables ---
let renderer, scene, camera, clock;
let ambientLight, directionalLight;
let domContainer;
let currentCanvasWidth = DEFAULT_GAME_WIDTH; // Now represents the *base* canvas size for world scaling
let currentCanvasHeight = DEFAULT_GAME_HEIGHT;
// REMOVED worldWidth, worldHeight as separate fixed vars
// let worldWidth = WORLD_WIDTH;
// let worldHeight = WORLD_HEIGHT;

// Scene Objects
let groundPlane = null;
let boundariesGroup = null; // Keep boundaries, but their positioning will adapt
const playerGroupMap = {};
const enemyGroupMap = {};
const powerupGroupMap = {};
// ... (Rest of module scope variables: Instanced Meshes, Particles, Effects, Shared Resources, Reusable Objects) ...
// REMOVED _worldCenter as it's less relevant now
// const _worldCenter = new THREE.Vector3();


// --- Internal Helper Functions ---
// ... (lerp, _createAssets, _createGeometries, _createMaterials - mostly unchanged) ...
// NOTE: _createGeometries still defines groundPlane and boundaryWall geometry using base size 1

/** Creates shared materials. */
function _createMaterials() {
    // ... (Materials definition exactly as in v3.2 - includes sharedMaterials.boundary) ...
    console.log("Renderer: Creating materials...");
    sharedMaterials.playerBody = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.2, name: "PlayerBody" });
    sharedMaterials.playerHead = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: "PlayerHead" });
    sharedMaterials.playerGun = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: "PlayerGun" });
    sharedMaterials.playerDown = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6, metalness: 0.1, emissive: 0xccab00, emissiveIntensity: 0.5, name: "PlayerDown" });
    sharedMaterials.playerDead = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.0, name: "PlayerDead" });
    sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, metalness: 0.2, emissive: 0x331122, emissiveIntensity: 0.3, name: "PlayerSelfBody" });
    const enemyStandardProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemyStandardProps, name: "EnemyChaserBody" });
    sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemyStandardProps, name: "EnemyShooterBody" });
    sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 1.0, name: "EnemyGiantBody" });
    sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({ color: 0xBC8F8F, roughness: 0.7, name: "EnemyHead" });
    sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.6, metalness: 0.6, name: "EnemyGun" });
    sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: "PlayerBullet" });
    sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff4500, name: "EnemyBullet" });
    sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: "AmmoCasing" });
    sharedMaterials.powerupBase = { roughness: 0.6, metalness: 0.1, name: "PowerupDefault" };
    sharedMaterials.powerups = {
        health: new THREE.MeshStandardMaterial({ color: 0x81c784, ...sharedMaterials.powerupBase, name: "PowerupHealth" }),
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x6a0dad, emissive: 0x330044, emissiveIntensity: 0.4, ...sharedMaterials.powerupBase, name: "PowerupGun" }),
        speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3, ...sharedMaterials.powerupBase, name: "PowerupSpeed" }),
        armor: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3, ...sharedMaterials.powerupBase, name: "PowerupArmor" }),
        ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500, ...sharedMaterials.powerupBase, name: "PowerupShotgun" }),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D, ...sharedMaterials.powerupBase, name: "PowerupSlug" }),
        ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00, emissive: 0x555500, emissiveIntensity: 0.5, ...sharedMaterials.powerupBase, name: "PowerupRapid" }),
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.6, roughness: 0.4, ...sharedMaterials.powerupBase, name: "PowerupScore" }),
        default: new THREE.MeshStandardMaterial({ color: 0x888888, ...sharedMaterials.powerupBase })
    };
    sharedMaterials.groundDay = new THREE.MeshStandardMaterial({ color: 0x788a77, roughness: 0.9, metalness: 0.05, name: "GroundDay" });
    sharedMaterials.groundNight = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.85, metalness: 0.1, name: "GroundNight" });
    sharedMaterials.log = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: "Log" });
    sharedMaterials.boundary = new THREE.MeshStandardMaterial({ color: 0x4d443d, roughness: 0.8, metalness: 0.1, name: "BoundaryWall" });
    sharedMaterials.snake = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide, name: "Snake" });
    sharedMaterials.hitSpark = new THREE.PointsMaterial({ size: 10, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "HitSpark" });
    sharedMaterials.rainLine = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: "RainLine" });
    sharedMaterials.dustMote = new THREE.PointsMaterial({ size: 50, color: 0xd2b48c, transparent: true, opacity: DUST_OPACITY, sizeAttenuation: true, depthWrite: false, name: "DustMote" });
    sharedMaterials.flame = new THREE.PointsMaterial({ size: 18, vertexColors: true, map: loadedAssets.flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "Flame" });
    sharedMaterials.smoke = new THREE.PointsMaterial({ size: 25, vertexColors: false, color: 0xaaaaaa, map: loadedAssets.smokeTexture, transparent: true, opacity: 0.35, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, name: "Smoke" });

}

/** Sets up instanced meshes and particle systems. */
function _initParticlesAndInstances() {
    // ... (Exactly the same particle/instance setup as v3.2) ...
     if (!scene) { console.error("Renderer: Scene not ready for particle/instance init."); return; }
    console.log("Renderer: Initializing particles and instanced meshes...");
    playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS);
    playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); playerBulletMesh.count = 0; playerBulletMesh.name = "PlayerBullets"; scene.add(playerBulletMesh); playerBulletMatrices = playerBulletMesh.instanceMatrix.array;
    enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS);
    enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); enemyBulletMesh.count = 0; enemyBulletMesh.name = "EnemyBullets"; scene.add(enemyBulletMesh); enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array;
    ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS);
    ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; ammoCasingMesh.name = "AmmoCasings"; scene.add(ammoCasingMesh); activeAmmoCasings = [];
    const sparkGeo = new THREE.BufferGeometry();
    const sparkP = new Float32Array(MAX_HIT_SPARKS * 3); const sparkC = new Float32Array(MAX_HIT_SPARKS * 3); const sparkA = new Float32Array(MAX_HIT_SPARKS);
    const sparkData = [];
    for (let i = 0; i < MAX_HIT_SPARKS; i++) { sparkP[i * 3 + 1] = -1e4; sparkA[i] = 0; sparkData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), a: 0.0, l: 0 }); }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkP, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkC, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkA, 1).setUsage(THREE.DynamicDrawUsage));
    hitSparkSystem = { particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark), geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData };
    hitSparkSystem.particles.name = "HitSparks"; hitSparkSystem.particles.visible = false;
    scene.add(hitSparkSystem.particles);
    const rainGeo = new THREE.BufferGeometry();
    const rainP = new Float32Array(MAX_RAIN_DROPS * 6);
    const rainData = [];
    // Initialize rain positions based on DEFAULT world size initially
    const initialRainWidth = DEFAULT_GAME_WIDTH * GROUND_MARGIN;
    const initialRainHeight = DEFAULT_GAME_HEIGHT * GROUND_MARGIN;
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const x = Math.random() * initialRainWidth - (initialRainWidth/2 - DEFAULT_GAME_WIDTH/2); // Center around default canvas
        const y = Math.random() * 1000 + 800;
        const z = Math.random() * initialRainHeight - (initialRainHeight/2 - DEFAULT_GAME_HEIGHT/2); // Center around default canvas
        rainP[i * 6 + 1] = -1e4; rainP[i * 6 + 4] = -1e4;
        rainData.push({ x: x, y: y, z: z, s: RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND });
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3).setUsage(THREE.DynamicDrawUsage));
    rainSystem = { lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine), geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData };
    rainSystem.lines.visible = false; rainSystem.lines.name = "RainLines"; scene.add(rainSystem.lines);
    const dustGeo = new THREE.BufferGeometry();
    const dustP = new Float32Array(MAX_DUST_MOTES * 3);
    const dustData = [];
     // Initialize dust positions based on DEFAULT world size initially
    for (let i = 0; i < MAX_DUST_MOTES; i++) {
        dustP[i * 3 + 1] = -1e4;
        dustData.push({
            p: new THREE.Vector3(Math.random() * DEFAULT_GAME_WIDTH, Math.random() * 80 + 5, Math.random() * DEFAULT_GAME_HEIGHT), // Relative to default canvas
            v: new THREE.Vector3((Math.random() - 0.5) * DUST_SPEED_XZ, (Math.random() - 0.5) * DUST_SPEED_Y, (Math.random() - 0.5) * DUST_SPEED_XZ)
        });
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustP, 3).setUsage(THREE.DynamicDrawUsage));
    dustSystem = { particles: new THREE.Points(dustGeo, sharedMaterials.dustMote), geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData };
    dustSystem.particles.visible = false; dustSystem.particles.name = "DustParticles"; scene.add(dustSystem.particles);
}

/** Creates the campfire object group. */
function _initCampfire() {
    // ... (Exactly the same campfire setup as v3.2 - includes smoke) ...
    if (!scene) { console.error("Renderer: Scene not ready for campfire init."); return; }
    console.log("Renderer: Initializing campfire...");
    const group = new THREE.Group(); group.name = "CampfireGroup";
    const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log1.rotation.set(0, Math.PI / 10, Math.PI / 6); log1.castShadow = true; log1.position.set(-CAMPFIRE_LOG_LENGTH * 0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH * 0.2);
    const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log2.rotation.set(0, -Math.PI / 8, -Math.PI / 5); log2.castShadow = true; log2.position.set(CAMPFIRE_LOG_LENGTH * 0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH * 0.1);
    group.add(log1); group.add(log2);
    const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0);
    glowLight.position.y = Y_OFFSET_CAMPFIRE + 15; glowLight.castShadow = true;
    glowLight.shadow.mapSize.width = 512; glowLight.shadow.mapSize.height = 512; glowLight.shadow.bias = -0.01; group.add(glowLight);
    const flameGeo = new THREE.BufferGeometry();
    const flameP = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameC = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameS = new Float32Array(MAX_FLAME_PARTICLES);
    const flameData = [];
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { flameP[i * 3 + 1] = -1e4; flameS[i] = 0; flameData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), l: 0, bl: 0.7 + Math.random() * 0.6, s: 18 }); } // Used constants directly
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flameP, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameC, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('size', new THREE.BufferAttribute(flameS, 1).setUsage(THREE.DynamicDrawUsage));
    const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame); flameParticles.name = "CampfireFlames"; flameParticles.visible = false; group.add(flameParticles);
    const smokeGeo = new THREE.BufferGeometry();
    const smokeP = new Float32Array(MAX_SMOKE_PARTICLES * 3); const smokeA = new Float32Array(MAX_SMOKE_PARTICLES); const smokeS = new Float32Array(MAX_SMOKE_PARTICLES);
    const smokeData = [];
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) { smokeP[i * 3 + 1] = -1e4; smokeA[i] = 0; smokeS[i] = 0; smokeData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), a: 0.0, l: 0, bl: 2.5 + Math.random() * 1.5, s: 25 }); } // Used constants directly
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeP, 3).setUsage(THREE.DynamicDrawUsage));
    smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(smokeA, 1).setUsage(THREE.DynamicDrawUsage));
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeS, 1).setUsage(THREE.DynamicDrawUsage));
    const smokeParticles = new THREE.Points(smokeGeo, sharedMaterials.smoke); smokeParticles.name = "CampfireSmoke"; smokeParticles.visible = false; group.add(smokeParticles);
    campfireSystem = { group: group, flameParticles: flameParticles, flameGeometry: flameGeo, flameMaterial: sharedMaterials.flame, flameData: flameData, smokeParticles: smokeParticles, smokeGeometry: smokeGeo, smokeMaterial: sharedMaterials.smoke, smokeData: smokeData, glowLight: glowLight };
    group.visible = false;
    scene.add(group);
}

/** Creates the visual boundary meshes. Needs position/scale updated in resize. */
function _createBoundaries() {
    if (!scene) { console.error("Renderer: Scene not ready for boundaries init."); return; }
    console.log("Renderer: Creating boundaries (will be positioned/scaled in resize)...");
    boundariesGroup = new THREE.Group(); boundariesGroup.name = "Boundaries";
    const wallMaterial = sharedMaterials.boundary;
    const wallGeometry = sharedGeometries.boundaryWall; // Unit geometry

    // Create meshes but don't set position/scale here
    const wallTop = new THREE.Mesh(wallGeometry, wallMaterial); wallTop.name="WallTop";
    wallTop.castShadow = true; wallTop.receiveShadow = true;
    const wallBottom = new THREE.Mesh(wallGeometry, wallMaterial); wallBottom.name="WallBottom";
    wallBottom.castShadow = true; wallBottom.receiveShadow = true;
    const wallLeft = new THREE.Mesh(wallGeometry, wallMaterial); wallLeft.name="WallLeft";
    wallLeft.rotation.y = Math.PI / 2; // Pre-rotate
    wallLeft.castShadow = true; wallLeft.receiveShadow = true;
    const wallRight = new THREE.Mesh(wallGeometry, wallMaterial); wallRight.name="WallRight";
    wallRight.rotation.y = Math.PI / 2; // Pre-rotate
    wallRight.castShadow = true; wallRight.receiveShadow = true;

    boundariesGroup.add(wallTop, wallBottom, wallLeft, wallRight);
    scene.add(boundariesGroup);
}

/** Creates the snake mesh. */
function _initSnake() {
    // ... (Exactly the same as v3.2) ...
    if (!scene) { console.error("Renderer: Scene not ready for snake init."); return; }
    console.log("Renderer: Initializing snake mesh...");
    const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0));
    const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false);
    snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake);
    snakeMesh.castShadow = true; snakeMesh.visible = false;
    snakeMesh.name = "Snake";
    scene.add(snakeMesh);
}

/** Creates a player group. */
function _createPlayerGroup(playerData, isSelf) {
    // ... (Exactly the same as v3.2) ...
    const group = new THREE.Group(); group.name = `PlayerGroup_${playerData.id}`;
    const bodyMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
    const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat);
    bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2; group.add(bodyMesh);
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead);
    headMesh.scale.setScalar(PLAYER_HEAD_RADIUS); headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; headMesh.castShadow = true; group.add(headMesh);
    const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun);
    gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh);
    group.position.set(playerData.x, 0, playerData.y);
    group.userData = { gameId: playerData.id, isPlayer: true, isSelf: isSelf, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentBodyMatRef: bodyMat, dyingStartTime: null };
    return group;
}

/** Creates an enemy group. */
function _createEnemyGroup(enemyData) {
    // ... (Exactly the same as v3.2) ...
     const group = new THREE.Group(); group.name = `EnemyGroup_${enemyData.id}`;
    let bodyGeo, bodyMatRef, headScale, yBodyOffset, gunMesh = null;
    const enemyHeight = enemyData.height || ENEMY_CHASER_HEIGHT;
    switch (enemyData.type) {
        case 'shooter': bodyGeo = sharedGeometries.enemyShooterBody; bodyMatRef = sharedMaterials.enemyShooterBody; headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2; gunMesh = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun); gunMesh.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh); break;
        case 'giant': bodyGeo = sharedGeometries.enemyGiantBody; bodyMatRef = sharedMaterials.enemyGiantBody; headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8; yBodyOffset = enemyHeight / 2; break;
        case 'chaser': default: bodyGeo = sharedGeometries.enemyChaserBody; bodyMatRef = sharedMaterials.enemyChaserBody; headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2; break;
    }
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMatRef);
    bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset; group.add(bodyMesh);
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead);
    headMesh.scale.setScalar(headScale); headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; headMesh.castShadow = true; group.add(headMesh);
    group.position.set(enemyData.x, 0, enemyData.y);
    group.userData = { gameId: enemyData.id, isEnemy: true, type: enemyData.type, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentBodyMatRef: bodyMatRef, dyingStartTime: null, health: enemyData.health };
    return group;
}

/** Creates a powerup group. */
function _createPowerupGroup(powerupData) {
    // ... (Exactly the same as v3.2) ...
     const group = new THREE.Group(); group.name = `PowerupGroup_${powerupData.id}`;
    const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default;
    const material = (sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default);
    if (!material) { console.error(`Renderer Error: Could not find material for powerup type: ${powerupData.type}`); return null; }
    const iconMesh = new THREE.Mesh(geometry, material);
    iconMesh.castShadow = true; iconMesh.position.y = Y_OFFSET_POWERUP; iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); group.add(iconMesh);
    group.position.set(powerupData.x, 0, powerupData.y);
    group.userData = { gameId: powerupData.id, isPowerup: true, iconMesh: iconMesh };
    return group;
}

/** Disposes textures associated with a material. */
function _disposeMaterialTextures(material) {
    // ... (Exactly the same as v3.2) ...
    if (!material) return;
    const textures = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'displacementMap', 'envMap'];
    textures.forEach(prop => { if (material[prop] && material[prop] instanceof THREE.Texture) { if (Object.values(loadedAssets).includes(material[prop])) { material[prop].dispose(); } } });
}

/** Disposes geometries and non-shared materials of an object and its children. */
function _disposeObject3D(obj) {
    // ... (Exactly the same as v3.2) ...
    if (!obj) return;
    obj.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
            child.geometry?.dispose();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(m => {
                if (m) {
                    let isShared = Object.values(sharedMaterials).includes(m);
                    if (!isShared && sharedMaterials.powerups) { isShared = Object.values(sharedMaterials.powerups).includes(m); }
                    if (!isShared) { _disposeMaterialTextures(m); m.dispose(); }
                }
            });
        }
    });
}

/** Handles removal logic, including fade-out for enemies. */
function _handleObjectRemoval(obj, id, objectMap) {
    // ... (Exactly the same as v3.2 - includes material cloning for fade) ...
    if (!obj || !scene || !clock) return;
    const userData = obj.userData; const isEnemy = userData?.isEnemy; const wasAlive = !userData?.dyingStartTime && (userData?.health === undefined || userData?.health > 0);
    if (isEnemy && wasAlive && !userData.dyingStartTime) {
        userData.dyingStartTime = clock.elapsedTime; userData.health = 0;
        obj.traverse(child => { if (child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((mat, index) => { let isShared = Object.values(sharedMaterials).includes(mat); if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(mat); if (isShared) { const clonedMat = mat.clone(); clonedMat.transparent = true; clonedMat.needsUpdate = true; if (Array.isArray(child.material)) child.material[index] = clonedMat; else child.material = clonedMat; } else { mat.transparent = true; mat.needsUpdate = true; } }); } });
    } else if (isEnemy && userData.dyingStartTime) {
        const timeElapsed = clock.elapsedTime - userData.dyingStartTime; const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION); const opacity = 1.0 - fadeProgress;
        obj.traverse(child => { if (child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(m => { m.opacity = opacity; }); } });
        if (fadeProgress >= 1.0) { scene.remove(obj); _disposeObject3D(obj); delete objectMap[id]; }
    } else { scene.remove(obj); _disposeObject3D(obj); delete objectMap[id]; }
}

/** Synchronizes scene objects based on server state. */
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) {
    // ... (Exactly the same as v3.2 - includes logic to reset dying state) ...
    if (!scene || !clock) return; const activeIds = new Set();
    if (state) { for (const id in state) { const data = state[id]; if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue; activeIds.add(id); let obj = objectMap[id]; const isSelf = isSelfFn ? isSelfFn(id) : false; if (!obj) { obj = createFn(data, isSelf); if (obj) { objectMap[id] = obj; scene.add(obj); updateFn(obj, data, 0, isSelf); } } else { if (obj.userData?.dyingStartTime) { obj.userData.dyingStartTime = null; obj.visible = true; obj.traverse(child => { if (child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((mat, index) => { let isShared = Object.values(sharedMaterials).includes(mat); if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(mat); if (!isShared) mat.dispose(); let correctSharedMat = null; if(obj.userData.isPlayer) correctSharedMat = obj.userData.isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; else if(obj.userData.isEnemy) correctSharedMat = obj.userData.currentBodyMatRef; if(correctSharedMat && child === obj.userData.bodyMesh) { if (Array.isArray(child.material)) child.material[index] = correctSharedMat; else child.material = correctSharedMat; } mat.opacity = 1.0; mat.transparent = false; mat.needsUpdate = true; }); } }); } updateFn(obj, data, clock.deltaTime, isSelf); } } }
    for (const id in objectMap) { if (!activeIds.has(id)) { _handleObjectRemoval(objectMap[id], id, objectMap); } }
}

/** Updates a player group's position, rotation, and visual state. */
function _updatePlayerGroup(group, playerData, deltaTime, isSelf) {
    // ... (Exactly the same as v3.2) ...
     if (!group?.userData) return; group.position.x = playerData.x; group.position.z = playerData.y; const userData = group.userData; const bodyMesh = userData.bodyMesh; let targetMatRef = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; let shouldBeVisible = true;
    switch (playerData.player_status) { case PLAYER_STATUS_DOWN: targetMatRef = sharedMaterials.playerDown; break; case PLAYER_STATUS_DEAD: shouldBeVisible = false; userData.dyingStartTime = null; break; case PLAYER_STATUS_ALIVE: default: break; }
    group.visible = shouldBeVisible; if (bodyMesh && userData.currentBodyMatRef !== targetMatRef && shouldBeVisible) { userData.currentBodyMatRef = targetMatRef; bodyMesh.material = targetMatRef; }
    if (shouldBeVisible && isSelf && window.appState?.localPlayerAimState) { const { lastAimDx, lastAimDy } = window.appState.localPlayerAimState; group.rotation.y = Math.atan2(lastAimDx, lastAimDy); }
    else if (shouldBeVisible && !isSelf && playerData.aim_dx !== undefined && playerData.aim_dy !== undefined) { group.rotation.y = Math.atan2(playerData.aim_dx, playerData.aim_dy); }
}

/** Updates an enemy group's position, rotation, and visual state. */
function _updateEnemyGroup(group, enemyData, deltaTime) {
    // ... (Exactly the same as v3.2) ...
    if (!group?.userData || group.userData.dyingStartTime || !clock) return; group.position.x = enemyData.x; group.position.z = enemyData.y; group.userData.health = enemyData.health; const gunMesh = group.userData.gunMesh;
    if (enemyData.type === 'shooter' && gunMesh && enemyData.aim_dx !== undefined && enemyData.aim_dy !== undefined) { group.rotation.y = Math.atan2(enemyData.aim_dx, enemyData.aim_dy); } const bodyMesh = group.userData.bodyMesh;
    if (bodyMesh && enemyData.type === 'giant') { const isWindingUp = enemyData.attack_state === 'winding_up'; const scaleTarget = isWindingUp ? 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05 : 1.0; bodyMesh.scale.lerp(_vector3.set(scaleTarget, scaleTarget, scaleTarget), 0.2); }
}

/** Updates a powerup group's animation. */
function _updatePowerupGroup(group, powerupData, deltaTime) {
    // ... (Exactly the same as v3.2) ...
     if (!group?.userData || !clock) return; group.position.x = powerupData.x; group.position.z = powerupData.y; const iconMesh = group.userData.iconMesh;
    if (iconMesh) { const bobOffset = (parseInt(group.userData.gameId, 16) % 100) / 100.0 * Math.PI * 2; iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + bobOffset) * 4; iconMesh.rotation.y += 0.015; }
}

/** Updates an instanced mesh based on the state object. */
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) {
    // ... (Exactly the same as v3.2) ...
    if (!mesh) return; if (!state || Object.keys(state).length === 0) { mesh.count = 0; mesh.instanceMatrix.needsUpdate = true; return; } let visibleCount = 0; const maxCount = matrices.length / 16;
    for (const id in state) { if (visibleCount >= maxCount) { console.warn(`Renderer: Exceeded max instances (${maxCount}) for mesh ${mesh.name}.`); break; } const data = state[id]; if (isBullet) { const isPlayerBullet = data.owner_type === 'player'; if (mesh === playerBulletMesh && !isPlayerBullet) continue; if (mesh === enemyBulletMesh && isPlayerBullet) continue; } if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue; _position.set(data.x, yOffset, data.y); if (isBullet && data.vx !== undefined && data.vy !== undefined && (data.vx !== 0 || data.vy !== 0)) { const angle = Math.atan2(data.vx, data.vy); _quaternion.setFromEuler(new THREE.Euler(0, angle, 0)); } else { _quaternion.identity(); } _scale.set(1, 1, 1); _matrix.compose(_position, _quaternion, _scale); mesh.setMatrixAt(visibleCount, _matrix); visibleCount++; }
    mesh.count = visibleCount; mesh.instanceMatrix.needsUpdate = true;
}

/** Updates physics and position for active ammo casings. */
function _updateActiveCasings(deltaTime) {
    // ... (Exactly the same as v3.2) ...
     if (!ammoCasingMesh || !clock) return; if (activeAmmoCasings.length === 0) { if (ammoCasingMesh.count > 0) { ammoCasingMesh.count = 0; ammoCasingMesh.instanceMatrix.needsUpdate = true; } return; } const now = clock.elapsedTime; let needsUpdate = false;
    activeAmmoCasings = activeAmmoCasings.filter(casing => { if (now > casing.endTime) return false; casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime; casing.position.addScaledVector(casing.velocity, deltaTime); casing.rotation += casing.rotationSpeed * deltaTime; if (casing.position.y <= Y_OFFSET_CASING) { casing.position.y = Y_OFFSET_CASING; casing.velocity.y *= -AMMO_CASING_BOUNCE; casing.velocity.x *= (1.0 - AMMO_CASING_DRAG); casing.velocity.z *= (1.0 - AMMO_CASING_DRAG); casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0); if (Math.abs(casing.velocity.y) < 5) casing.velocity.y = 0; if(Math.abs(casing.rotationSpeed) < 0.1) casing.rotationSpeed = 0; } return true; });
    let visibleCount = 0; const maxCount = ammoCasingMesh.instanceMatrix.array.length / 16; for (let i = 0; i < activeAmmoCasings.length; i++) { if (visibleCount >= maxCount) break; const casing = activeAmmoCasings[i]; _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0)); _matrix.compose(casing.position, _quaternion, _scale); ammoCasingMesh.setMatrixAt(visibleCount, _matrix); visibleCount++; needsUpdate = true; }
    if (ammoCasingMesh.count !== visibleCount) { ammoCasingMesh.count = visibleCount; needsUpdate = true; } if (needsUpdate) { ammoCasingMesh.instanceMatrix.needsUpdate = true; }
}

/** Spawns a single visual ammo casing particle. */
function _spawnAmmoCasing(spawnPos, ejectVec) {
    // ... (Exactly the same as v3.2) ...
    if (!ammoCasingMesh || !clock || activeAmmoCasings.length >= MAX_AMMO_CASINGS) return; const now = clock.elapsedTime; const life = 1.5 + Math.random() * 1.0; const ejectAngle = Math.atan2(ejectVec.z, ejectVec.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5; const ejectSpeed = 150 + Math.random() * 80; const upSpeed = 50 + Math.random() * 40; const rotationSpeed = (Math.random() - 0.5) * 20; const spawnOffsetX = Math.cos(ejectAngle) * 5; const spawnOffsetZ = Math.sin(ejectAngle) * 5; const spawnY = spawnPos.y + PLAYER_TOTAL_HEIGHT * 0.6; activeAmmoCasings.push({ position: new THREE.Vector3(spawnPos.x + spawnOffsetX, spawnY, spawnPos.z + spawnOffsetZ ), velocity: new THREE.Vector3( Math.cos(ejectAngle) * ejectSpeed, upSpeed, Math.sin(ejectAngle) * ejectSpeed ), rotation: Math.random() * Math.PI * 2, rotationSpeed: rotationSpeed, startTime: now, endTime: now + life });
}

/** Updates hit spark particle system. */
function _updateHitSparks(deltaTime) {
    // ... (Exactly the same as v3.2) ...
     if (!hitSparkSystem || !clock) return; const positions = hitSparkSystem.geometry.attributes.position.array; const colors = hitSparkSystem.geometry.attributes.color.array; const alphas = hitSparkSystem.geometry.attributes.alpha.array; const data = hitSparkSystem.data; let needsGeomUpdate = false; let activeCount = 0;
    for (let i = 0; i < MAX_HIT_SPARKS; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; activeCount++; if (p.l <= 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; } else { p.v.y -= HIT_SPARK_GRAVITY * deltaTime; p.p.addScaledVector(p.v, deltaTime); p.a = Math.min(1.0, Math.max(0, (p.l / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5)); alphas[i] = p.a; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b; } needsGeomUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true; } }
    if (needsGeomUpdate) { hitSparkSystem.geometry.attributes.position.needsUpdate = true; hitSparkSystem.geometry.attributes.color.needsUpdate = true; hitSparkSystem.geometry.attributes.alpha.needsUpdate = true; } hitSparkSystem.particles.visible = activeCount > 0;
}

/** Triggers a burst of hit sparks at a given position. */
function _triggerHitSparks(position, count = 5) {
    // ... (Exactly the same as v3.2) ...
    if (!hitSparkSystem || !clock) return; const data = hitSparkSystem.data; let spawned = 0; for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) { if (data[i].l <= 0) { const p = data[i]; p.p.copy(position); const angle = Math.random() * Math.PI * 2; const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD; p.v.set(Math.cos(angle) * Math.cos(spreadAngle) * speed, Math.sin(spreadAngle) * speed * 1.5 + 30, Math.sin(angle) * Math.cos(spreadAngle) * speed); p.c.setRGB(1, 0.2 + Math.random() * 0.3, 0); p.a = 1.0; p.l = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE; spawned++; } } if (spawned > 0) hitSparkSystem.particles.visible = true;
}

/** Updates rain particle system - uses dynamic world size now. */
function _updateRain(deltaTime) {
    if (!rainSystem || !rainSystem.lines.visible) { return; }
    const positions = rainSystem.geometry.attributes.position.array;
    const data = rainSystem.data;
    let needsUpdate = false;
    // Use the *effective* world size based on canvas + margin for rain area
    const currentWorldWidth = currentCanvasWidth * GROUND_MARGIN;
    const currentWorldHeight = currentCanvasHeight * GROUND_MARGIN;
    const worldOriginX = currentCanvasWidth / 2 - currentWorldWidth / 2;
    const worldOriginZ = currentCanvasHeight / 2 - currentWorldHeight / 2;

    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const p = data[i];
        p.y += p.s * deltaTime;
        // If drop goes below ground, reset position to top within current dynamic world bounds
        if (p.y < -50) {
            p.x = Math.random() * currentWorldWidth + worldOriginX;
            p.y = Math.random() * 500 + 1000; // Reset high above
            p.z = Math.random() * currentWorldHeight + worldOriginZ;
            p.s = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND; // Reset speed
        }
        const idx = i * 6;
        positions[idx + 0] = p.x; positions[idx + 1] = p.y; positions[idx + 2] = p.z;
        positions[idx + 3] = p.x; positions[idx + 4] = p.y - RAIN_STREAK_LENGTH; positions[idx + 5] = p.z;
        needsUpdate = true;
    }
    if (needsUpdate) rainSystem.geometry.attributes.position.needsUpdate = true;
}

/** Updates dust mote particle system - uses dynamic world size now. */
function _updateDust(deltaTime) {
     if (!dustSystem || !dustSystem.particles.visible || !camera) { return; }
     const positions = dustSystem.geometry.attributes.position.array;
     const data = dustSystem.data;
     let needsUpdate = false;
     // Use the *effective* world size based on canvas + margin for dust area
     const currentWorldWidth = currentCanvasWidth * GROUND_MARGIN;
     const currentWorldHeight = currentCanvasHeight * GROUND_MARGIN;
     const worldOriginX = currentCanvasWidth / 2 - currentWorldWidth / 2;
     const worldOriginZ = currentCanvasHeight / 2 - currentWorldHeight / 2;

     for (let i = 0; i < MAX_DUST_MOTES; i++) {
         const p = data[i];
         p.p.addScaledVector(p.v, deltaTime);
         // Wrap around dynamic world boundaries
         if (p.p.x < worldOriginX) p.p.x += currentWorldWidth;
         else if (p.p.x > worldOriginX + currentWorldWidth) p.p.x -= currentWorldWidth;
         if (p.p.z < worldOriginZ) p.p.z += currentWorldHeight;
         else if (p.p.z > worldOriginZ + currentWorldHeight) p.p.z -= currentWorldHeight;
         // Clamp Y
         p.p.y += (Math.random() - 0.5) * DUST_SPEED_Y * deltaTime;
         p.p.y = Math.max(5, Math.min(80, p.p.y));
         positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z;
         needsUpdate = true;
     }
     if (needsUpdate) dustSystem.geometry.attributes.position.needsUpdate = true;
}

/** Updates flame particle system. */
function _updateCampfireFlames(deltaTime) {
    // ... (Exactly the same as v3.2) ...
     if (!campfireSystem || !campfireSystem.group.visible || !clock) return; const positions = campfireSystem.flameGeometry.attributes.position.array; const colors = campfireSystem.flameGeometry.attributes.color.array; const sizes = campfireSystem.flameGeometry.attributes.size.array; const data = campfireSystem.flameData; let needsGeomUpdate = false; let activeCount = 0;
    const spawnRate = 150; const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random())); let spawned = 0; for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) { if (data[i].l <= 0) { const p = data[i]; const angle = Math.random() * Math.PI * 2; const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.8; p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 2, Math.sin(angle) * radius); p.v.set((Math.random() - 0.5) * FLAME_VEL_SPREAD, FLAME_VEL_Y + Math.random() * 30, (Math.random() - 0.5) * FLAME_VEL_SPREAD); p.l = p.bl; p.s = FLAME_SIZE_START; p.c.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); spawned++; } }
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; activeCount++; if (p.l <= 0) { sizes[i] = 0; positions[i * 3 + 1] = -10000; } else { p.v.y += (Math.random() - 0.4) * 20 * deltaTime; p.v.x *= 0.97; p.v.z *= 0.97; p.p.addScaledVector(p.v, deltaTime); const lifeRatio = Math.max(0, p.l / p.bl); p.s = lerp(FLAME_SIZE_END, FLAME_SIZE_START, lifeRatio); p.c.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); sizes[i] = p.s; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b; } needsGeomUpdate = true; } else if (sizes[i] > 0) { sizes[i] = 0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true; } }
    if (needsGeomUpdate) { campfireSystem.flameGeometry.attributes.position.needsUpdate = true; campfireSystem.flameGeometry.attributes.color.needsUpdate = true; campfireSystem.flameGeometry.attributes.size.needsUpdate = true; } campfireSystem.flameParticles.visible = activeCount > 0;
}

/** Updates smoke particle system. */
function _updateCampfireSmoke(deltaTime) {
    // ... (Exactly the same as v3.2) ...
    if (!campfireSystem || !campfireSystem.group.visible || !clock) return; const positions = campfireSystem.smokeGeometry.attributes.position.array; const alphas = campfireSystem.smokeGeometry.attributes.alpha.array; const sizes = campfireSystem.smokeGeometry.attributes.size.array; const data = campfireSystem.smokeData; let needsGeomUpdate = false; let activeCount = 0;
    const spawnRate = 80; const numToSpawn = Math.floor(spawnRate * deltaTime * (0.6 + Math.random())); let spawned = 0; for (let i = 0; i < MAX_SMOKE_PARTICLES && spawned < numToSpawn; i++) { if (data[i].l <= 0) { const p = data[i]; const angle = Math.random() * Math.PI * 2; const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.6; p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 5, Math.sin(angle) * radius); p.v.set((Math.random() - 0.5) * SMOKE_VEL_SPREAD, SMOKE_VEL_Y + Math.random() * 15, (Math.random() - 0.5) * SMOKE_VEL_SPREAD); p.l = p.bl; p.s = SMOKE_SIZE_START; p.a = SMOKE_OPACITY_START * (0.8 + Math.random() * 0.4); spawned++; } }
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; activeCount++; if (p.l <= 0) { alphas[i] = 0.0; sizes[i] = 0; positions[i * 3 + 1] = -10000; } else { p.v.y += (Math.random() - 0.45) * 5 * deltaTime; p.v.x += (Math.random() - 0.5) * 8 * deltaTime; p.v.z += (Math.random() - 0.5) * 8 * deltaTime; p.v.multiplyScalar(0.98); p.p.addScaledVector(p.v, deltaTime); const lifeRatio = Math.max(0, p.l / p.bl); p.s = lerp(SMOKE_SIZE_END, SMOKE_SIZE_START, lifeRatio); p.a = lerp(SMOKE_OPACITY_END, SMOKE_OPACITY_START, lifeRatio * lifeRatio); sizes[i] = p.s; alphas[i] = p.a; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; } needsGeomUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0.0; sizes[i] = 0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true; } }
    if (needsGeomUpdate) { campfireSystem.smokeGeometry.attributes.position.needsUpdate = true; campfireSystem.smokeGeometry.attributes.alpha.needsUpdate = true; campfireSystem.smokeGeometry.attributes.size.needsUpdate = true; } campfireSystem.smokeParticles.visible = activeCount > 0;
}

/** Updates the entire campfire system. */
function _updateCampfire(deltaTime) {
    // ... (Exactly the same as v3.2) ...
     if (!campfireSystem || !clock) return; const cfData = window.appState?.serverState?.campfire; const isActive = cfData?.active ?? false; campfireSystem.group.visible = isActive;
    if (isActive) { campfireSystem.group.position.set(cfData.x, 0, cfData.y); if (campfireSystem.glowLight) { campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0 + Math.random()*0.5) * 0.8; } _updateCampfireFlames(deltaTime); _updateCampfireSmoke(deltaTime); }
    else { campfireSystem.flameParticles.visible = false; campfireSystem.smokeParticles.visible = false; if (campfireSystem.glowLight) campfireSystem.glowLight.intensity = 0; }
}

/** Updates the snake mesh geometry. */
function _updateSnake(snakeData) {
    // ... (Exactly the same as v3.2 - still inefficient) ...
    if (!snakeMesh) { return; } const isActive = snakeData?.active ?? false; snakeMesh.visible = isActive; if (isActive && snakeData.segments && snakeData.segments.length > 1) { const points = snakeData.segments.map(seg => _vector3.set(seg.x, Y_OFFSET_SNAKE, seg.y) ); if (points.length >= 2) { try { const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1); const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2); if(tubePoints.length >= 2) { const newGeometry = new THREE.TubeGeometry( new THREE.CatmullRomCurve3(tubePoints), tubePoints.length - 1, SNAKE_RADIUS, 6, false ); snakeMesh.geometry.dispose(); snakeMesh.geometry = newGeometry; snakeMesh.visible = true; } else snakeMesh.visible = false; } catch(e) { console.error("Renderer Error updating snake geometry:", e); snakeMesh.visible = false; } } else snakeMesh.visible = false; } else { snakeMesh.visible = false; }
}

/** Updates lighting, fog, and weather effects. */
function _updateEnvironment(isNight, isRaining, isDustStorm) {
    // ... (Exactly the same as v3.2) ...
     if (!scene || !ambientLight || !directionalLight || !groundPlane || !clock) return; const dayAI = 0.7, nightAI = 0.45; const dayDI = 1.2, nightDI = 0.7; const dayAC = 0xffffff, nightAC = 0x7080a0; const dayDC = 0xffffff, nightDC = 0xa0b0ff; const dayFogC = 0xc0d0e0, dayFogD = 0.0003; const nightFogC = 0x04060a, nightFogD = 0.0008; const dustFogC = 0xb09070, dustFogD = 0.0015; const targetAI = isNight ? nightAI : dayAI; const targetDI = isNight ? nightDI : dayDI; const targetAC = isNight ? nightAC : dayAC; const targetDC = isNight ? nightDC : dayDC; const targetGM = isNight ? sharedMaterials.groundNight : sharedMaterials.groundDay; let targetFD, targetFC; if(isDustStorm){targetFD=dustFogD;targetFC=dustFogC;}else if(isNight){targetFD=nightFogD;targetFC=nightFogC;}else{targetFD=dayFogD;targetFC=dayFogC;} const lerpA=0.05; ambientLight.intensity=lerp(ambientLight.intensity, targetAI, lerpA); directionalLight.intensity=lerp(directionalLight.intensity, targetDI, lerpA); ambientLight.color.lerp(_color.setHex(targetAC), lerpA); directionalLight.color.lerp(_color.setHex(targetDC), lerpA); if (groundPlane.material !== targetGM) groundPlane.material = targetGM; if (!scene.fog) scene.fog = new THREE.FogExp2(targetFC, targetFD); else { scene.fog.color.lerp(_color.setHex(targetFC), lerpA); scene.fog.density = lerp(scene.fog.density, targetFD, lerpA); } if (!scene.background || !(scene.background instanceof THREE.Color)) scene.background = new THREE.Color(); scene.background.lerp(_color.setHex(targetFC), lerpA); if (rainSystem?.lines) rainSystem.lines.visible = isRaining; if (dustSystem?.particles) dustSystem.particles.visible = isDustStorm;
}

/** Updates the muzzle flash light effect. */
function _updateMuzzleFlash(localEffects, playerGroup) {
    // ... (Exactly the same as v3.2) ...
    if (!muzzleFlashLight || !clock) return; const flashState = localEffects?.muzzleFlash; const nowMs = clock.elapsedTime * 1000; if (flashState?.active && nowMs < flashState.endTime && playerGroup) { muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; const gunMesh = playerGroup.userData.gunMesh; if (gunMesh) { _vector3.set(0, 0, PLAYER_GUN_LENGTH / 2 + 5); gunMesh.localToWorld(_vector3); muzzleFlashLight.position.copy(_vector3); } else { muzzleFlashLight.intensity = 0; } } else { muzzleFlashLight.intensity = 0; if (flashState) flashState.active = false; }
}

/** Projects a 3D world position to 2D screen coordinates. */
function _projectToScreen(worldPosition) {
    // ... (Exactly the same as v3.2) ...
    if (!camera || !renderer?.domElement || !domContainer) return null; try { _vector3.copy(worldPosition); _vector3.project(camera); if (_vector3.z > 1.0) return null; const rect = domContainer.getBoundingClientRect(); const widthHalf = rect.width / 2; const heightHalf = rect.height / 2; const screenX = Math.round((_vector3.x * widthHalf) + widthHalf); const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); return { screenX, screenY }; } catch (e) { console.warn("Renderer: _projectToScreen error:", e); return null; }
}

/** Updates camera position and applies screen shake - uses dynamic world center now. */
function _updateCamera(deltaTime, localPlayerGroup) {
    if (!camera || !clock) return;
    // 1. Determine Target Position
    let targetX, targetZ;
    if (localPlayerGroup && localPlayerGroup.visible) { targetX = localPlayerGroup.position.x; targetZ = localPlayerGroup.position.z; }
    else { targetX = currentCanvasWidth / 2; targetZ = currentCanvasHeight / 2; } // Target center of dynamic canvas size
    _cameraTargetWorldPos.set(targetX, 0, targetZ);

    // 2. Calculate Desired Camera Position
    _cameraDesiredPos.set(targetX, CAMERA_HEIGHT_OFFSET, targetZ + CAMERA_DISTANCE_OFFSET);

    // 3. Smoothly Interpolate Camera Position
    camera.position.lerp(_cameraDesiredPos, CAMERA_LERP_FACTOR);

    // 4. Apply Screen Shake
    const nowMs = clock.elapsedTime * 1000; if (shakeMagnitude > 0 && nowMs < shakeEndTime) { const timeRemaining = shakeEndTime - nowMs; const totalDuration = shakeEndTime - (nowMs - deltaTime * 1000); const decayFactor = totalDuration > 0 ? Math.pow(Math.max(0, timeRemaining / totalDuration), 2) : 0; const currentMag = shakeMagnitude * decayFactor; const shakeAngle = Math.random() * Math.PI * 2; screenShakeOffset.set(Math.cos(shakeAngle) * currentMag, (Math.random() - 0.5) * currentMag * 0.5, Math.sin(shakeAngle) * currentMag); camera.position.add(screenShakeOffset); } else { shakeMagnitude = 0; }

    // 5. Set LookAt Target
    camera.lookAt(_cameraTargetWorldPos);
}


// --- Public API ---
const Renderer3D = {
    /** Initializes the THREE.js renderer, scene, camera, lights, and essential objects. */
    init: (containerElement /* REMOVED initialWorldWidth/Height */ ) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;

        // Use default canvas sizes initially, updated by resize handler
        currentCanvasWidth = domContainer.clientWidth || DEFAULT_GAME_WIDTH;
        currentCanvasHeight = domContainer.clientHeight || DEFAULT_GAME_HEIGHT;
        // Removed fixed worldWidth/Height setting here

        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(currentCanvasWidth, currentCanvasHeight); // Use current canvas size
            renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
            domContainer.appendChild(renderer.domElement);

            scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2a28);

            camera = new THREE.PerspectiveCamera(CAMERA_FOV, currentCanvasWidth / currentCanvasHeight, CAMERA_NEAR, CAMERA_FAR);
            // Initial camera position relative to initial canvas center
            const initialTargetX = currentCanvasWidth / 2; const initialTargetZ = currentCanvasHeight / 2;
            camera.position.set(initialTargetX, CAMERA_HEIGHT_OFFSET, initialTargetZ + CAMERA_DISTANCE_OFFSET);
            camera.lookAt(initialTargetX, 0, initialTargetZ);
            scene.add(camera);

            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            // Position light relative to initial canvas center
            directionalLight.position.set(initialTargetX + currentCanvasWidth * 0.1, 400, initialTargetZ + currentCanvasHeight * 0.2);
            directionalLight.castShadow = true; directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048; directionalLight.shadow.bias = -0.002;
            // *** Shadow camera bounds will be updated in handleContainerResize ***
            directionalLight.target.position.set(initialTargetX, 0, initialTargetZ); // Target initial center
            scene.add(directionalLight); scene.add(directionalLight.target);

            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);

            _createAssets(); _createGeometries(); _createMaterials();

            // Create Ground Plane - will be scaled in handleContainerResize
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.rotation.x = -Math.PI / 2; groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane";
            scene.add(groundPlane);

            // Create Boundaries - will be positioned/scaled in handleContainerResize
            _createBoundaries();

            _initParticlesAndInstances(); _initCampfire(); _initSnake();
            clock = new THREE.Clock();

            Renderer3D.handleContainerResize(); // Initial resize to set scales/positions
            setTimeout(() => Renderer3D.handleContainerResize(), 150);

        } catch (error) { console.error("Renderer Init Error:", error); Renderer3D.cleanup(); return false; }
        console.log("--- Renderer3D initialization complete ---"); return true;
    },

    /** Handles resizing - UPDATED to scale world elements */
    handleContainerResize: () => {
        if (!renderer || !camera || !domContainer) return;
        const newWidth = domContainer.clientWidth; const newHeight = domContainer.clientHeight;
        if (newWidth <= 0 || newHeight <= 0 || (newWidth === currentCanvasWidth && newHeight === currentCanvasHeight)) { return; }

        currentCanvasWidth = newWidth; currentCanvasHeight = newHeight;
        const worldCenterX = currentCanvasWidth / 2;
        const worldCenterZ = currentCanvasHeight / 2;
        const effectiveWorldWidth = currentCanvasWidth * GROUND_MARGIN;
        const effectiveWorldHeight = currentCanvasHeight * GROUND_MARGIN;

        // Update Renderer and Camera
        renderer.setSize(newWidth, newHeight); renderer.setViewport(0, 0, newWidth, newHeight); renderer.setScissor(0, 0, newWidth, newHeight); renderer.setScissorTest(true);
        camera.aspect = newWidth / newHeight; camera.updateProjectionMatrix(); camera.clearViewOffset();

        // --- RE-ADDED DYNAMIC SCALING ---
        // Update Ground Plane
        if (groundPlane) {
             groundPlane.scale.set(effectiveWorldWidth, effectiveWorldHeight, 1);
             groundPlane.position.set(worldCenterX, 0, worldCenterZ); // Center it
        }
        // Update Light Target
        if (directionalLight?.target) { directionalLight.target.position.set(worldCenterX, 0, worldCenterZ); }
        // Update Shadow Camera Bounds
        if (directionalLight?.shadow?.camera) {
            const sX = effectiveWorldWidth * 0.55; // Scale shadow area with ground
            const sZ = effectiveWorldHeight * 0.55;
            directionalLight.shadow.camera.left = -sX; directionalLight.shadow.camera.right = sX;
            directionalLight.shadow.camera.top = sZ; directionalLight.shadow.camera.bottom = -sZ;
            directionalLight.shadow.camera.updateProjectionMatrix();
        }
        // Update Boundary Positions & Scales
        if (boundariesGroup) {
            const wallTop = boundariesGroup.getObjectByName("WallTop");
            const wallBottom = boundariesGroup.getObjectByName("WallBottom");
            const wallLeft = boundariesGroup.getObjectByName("WallLeft");
            const wallRight = boundariesGroup.getObjectByName("WallRight");

            if(wallTop) {
                wallTop.scale.x = effectiveWorldWidth + BOUNDARY_WALL_DEPTH * 2;
                wallTop.position.set(worldCenterX, Y_OFFSET_BOUNDARY, worldCenterZ + effectiveWorldHeight / 2 + BOUNDARY_WALL_DEPTH / 2);
            }
             if(wallBottom) {
                wallBottom.scale.x = effectiveWorldWidth + BOUNDARY_WALL_DEPTH * 2;
                wallBottom.position.set(worldCenterX, Y_OFFSET_BOUNDARY, worldCenterZ - effectiveWorldHeight / 2 - BOUNDARY_WALL_DEPTH / 2);
            }
             if(wallLeft) {
                 wallLeft.scale.x = effectiveWorldHeight; // Length is world height
                 wallLeft.position.set(worldCenterX - effectiveWorldWidth / 2 - BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldCenterZ);
            }
             if(wallRight) {
                 wallRight.scale.x = effectiveWorldHeight;
                 wallRight.position.set(worldCenterX + effectiveWorldWidth / 2 + BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldCenterZ);
            }
        }
        // --- END RE-ADDED DYNAMIC SCALING ---

        console.log(`Renderer: Resize Handled - Canvas: ${currentCanvasWidth}x${currentCanvasHeight}`);
        if (window.appState) { window.appState.canvasWidth = currentCanvasWidth; window.appState.canvasHeight = currentCanvasHeight; }
    },

    /** Main render loop function. */
    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) { return; }
        const deltaTime = clock.getDelta();
        const localPlayerGroup = appState.localPlayerId ? playerGroupMap[appState.localPlayerId] : null;

        // --- World size update check - REMOVED fixed world logic ---
        // if (stateToRender.world_width && stateToRender.world_height && ...)

        // --- Updates ---
        _updateCamera(deltaTime, localPlayerGroup); // Camera now uses currentCanvasWidth/Height for centering if needed
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateActiveCasings(deltaTime); _updateHitSparks(deltaTime);
        _updateRain(deltaTime); // Uses current dynamic world size
        _updateDust(deltaTime); // Uses current dynamic world size
        _updateCampfire(deltaTime); // Position based on server coords
        _updateSnake(stateToRender.snake_state); // Position based on server coords
        _updateMuzzleFlash(localEffects, localPlayerGroup);

        // --- UI Position Calculation --- (No change needed here)
        const uiPositions = {};
        const projectEntity = (objMap, stateMap, yOffsetFn) => { for(const id in objMap){const o=objMap[id],d=stateMap?.[id];if(o?.visible&&d){const w=o.position.clone();w.y=yOffsetFn(d,o);const s=_projectToScreen(w);if(s)uiPositions[id]=s}} };
        const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y+PLAYER_HEAD_RADIUS*1.5||PLAYER_TOTAL_HEIGHT; const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y+(d.type==='giant'?ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER:ENEMY_HEAD_RADIUS)*1.2||ENEMY_CHASER_HEIGHT; const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y+POWERUP_BASE_SIZE*.5||Y_OFFSET_POWERUP;
        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY); projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY); projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);
        if (stateToRender.damage_texts) { for(const id in stateToRender.damage_texts){const dt=stateToRender.damage_texts[id],w=_vector3.set(dt.x,PLAYER_TOTAL_HEIGHT*.8,dt.y),s=_projectToScreen(w);if(s)uiPositions[id]=s} }
        appState.uiPositions = uiPositions;

        // --- Render ---
        try { renderer.setScissorTest(true); renderer.render(scene, camera); }
        catch (e) { console.error("!!! RENDER ERROR !!!", e); if (window.appState?.animationFrameId) { cancelAnimationFrame(window.appState.animationFrameId); window.appState.animationFrameId = null; console.error("!!! Animation loop stopped due to render error. !!!"); } }
    },

    /** Triggers a camera shake effect. */
    triggerShake: (magnitude, durationMs) => {
        // ... (Exactly the same as v3.2) ...
         if (!clock) return; const nowMs = clock.elapsedTime * 1000; const newEndTime = nowMs + durationMs; if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) { shakeMagnitude = Math.max(0.1, magnitude); shakeEndTime = Math.max(nowMs, newEndTime); }
    },
    /** Spawns a visual ammo casing particle effect. */
    spawnVisualAmmoCasing: (position, ejectVector) => {
        // ... (Exactly the same as v3.2) ...
         if (!clock) return; _spawnAmmoCasing(position, ejectVector);
    },
    /** Triggers a visual hit spark effect. */
    triggerVisualHitSparks: (position, count = 5) => {
        // ... (Exactly the same as v3.2) ...
         if (!clock) return; _triggerHitSparks(position, count);
    },
    /** Projects a 3D world position to 2D screen coordinates. */
    projectToScreen: (worldPosition) => {
        // ... (Exactly the same as v3.2) ...
        return _projectToScreen(worldPosition);
    },
    /** Cleans up all THREE.js resources. */
    cleanup: () => {
        // ... (Exactly the same as v3.2 - ensure boundariesGroup is included) ...
        console.log("--- Renderer3D Cleanup ---");
        [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(s=>{if(s){if(s.particles)scene?.remove(s.particles);if(s.lines)scene?.remove(s.lines);if(s.group)scene?.remove(s.group);s.geometry?.dispose();if(s.flameGeometry) s.flameGeometry.dispose(); if(s.smokeGeometry) s.smokeGeometry.dispose(); _disposeMaterialTextures(s.material);s.material?.dispose(); if(s.flameMaterial){_disposeMaterialTextures(s.flameMaterial); s.flameMaterial.dispose();} if(s.smokeMaterial){_disposeMaterialTextures(s.smokeMaterial); s.smokeMaterial.dispose();}}}); hitSparkSystem=null;rainSystem=null;dustSystem=null;campfireSystem=null;
        [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(m=>{if(m){scene?.remove(m);m.geometry?.dispose()}}); playerBulletMesh=null;enemyBulletMesh=null;ammoCasingMesh=null;
        if(snakeMesh){scene?.remove(snakeMesh);snakeMesh.geometry?.dispose();snakeMesh=null}
        if(boundariesGroup){scene?.remove(boundariesGroup);_disposeObject3D(boundariesGroup);boundariesGroup=null;} // Cleanup boundaries
        [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(o=>{for(const id in o)_handleObjectRemoval(o[id],id,o)});
        Object.values(sharedGeometries).forEach(g=>g?.dispose()); Object.values(powerupGeometries).forEach(g=>g?.dispose()); Object.values(sharedMaterials).forEach(m=>{if(m instanceof THREE.Material)_disposeMaterialTextures(m),m.dispose()}); if(sharedMaterials.powerups)Object.values(sharedMaterials.powerups).forEach(m=>{if(m instanceof THREE.Material)_disposeMaterialTextures(m),m.dispose()}); Object.values(loadedAssets).forEach(a=>a?.dispose());
        Object.keys(sharedGeometries).forEach(k=>delete sharedGeometries[k]); Object.keys(sharedMaterials).forEach(k=>{if(k!=='powerups')delete sharedMaterials[k];else delete sharedMaterials.powerups}); Object.keys(powerupGeometries).forEach(k=>delete powerupGeometries[k]); Object.keys(loadedAssets).forEach(k=>delete loadedAssets[k]);
        if(groundPlane){scene?.remove(groundPlane);_disposeObject3D(groundPlane);groundPlane=null}
        if(scene){if(ambientLight)scene.remove(ambientLight);if(directionalLight)scene.remove(directionalLight);if(directionalLight?.target)scene.remove(directionalLight.target);if(muzzleFlashLight)scene.remove(muzzleFlashLight)}ambientLight=null;directionalLight=null;muzzleFlashLight=null;
        if(renderer){console.log("Renderer: Disposing WebGL context...");renderer.dispose();if(renderer.domElement?.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);renderer=null;console.log("Renderer disposed.")}
        scene=null;camera=null;clock=null;domContainer=null;playerBulletMatrices=[];enemyBulletMatrices=[];activeAmmoCasings=[];shakeMagnitude=0;shakeEndTime=0; // Reset relevant state vars
        console.log("Renderer3D resources released.");
    },

    // --- Getters ---
    getCamera: () => camera,
    getGroundPlane: () => groundPlane,
    getScene: () => scene,
};

export default Renderer3D;
