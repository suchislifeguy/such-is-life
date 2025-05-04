// Renderer3D.js
// Final Version: Advanced renderer for Kelly Gang Survival.
// Includes: Instancing, Particle Effects, Detailed Models, Environment Effects.

import * as THREE from 'three';

// --- Utility Functions ---
/** Linearly interpolates between two values. */
function lerp(start, end, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return start + (end - start) * t;
}

// --- Constants ---
const DEFAULT_GAME_WIDTH = 1600; const DEFAULT_GAME_HEIGHT = 900;
const CAMERA_FOV = 60; const CAMERA_NEAR = 10; const CAMERA_FAR = 2500;
const CAMERA_BASE_Y = 950; const CAMERA_ANGLE = -Math.PI / 2.7; const CAMERA_LERP_FACTOR = 0.08;
const GROUND_MARGIN = 1.2;
const MAX_PLAYER_BULLETS = 500; const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150; const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000; const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80;
const PLAYER_CAPSULE_RADIUS = 12; const PLAYER_CAPSULE_HEIGHT = 24;
const PLAYER_TOTAL_HEIGHT = PLAYER_CAPSULE_HEIGHT + PLAYER_CAPSULE_RADIUS * 2;
const PLAYER_HEAD_RADIUS = 10; const PLAYER_GUN_LENGTH = 25; const PLAYER_GUN_RADIUS = 2;
const ENEMY_CHASER_WIDTH = 20; const ENEMY_CHASER_HEIGHT = 40; const ENEMY_CHASER_DEPTH = 14;
const ENEMY_SHOOTER_RADIUS = 12; const ENEMY_SHOOTER_HEIGHT = 45;
const ENEMY_GUN_LENGTH = 25; const ENEMY_GUN_RADIUS = 2.5; const ENEMY_GIANT_MULTIPLIER = 2.5;
const ENEMY_HEAD_RADIUS = 8; const POWERUP_BASE_SIZE = 18;
const BULLET_BASE_RADIUS = 2.5; const BULLET_LENGTH = 15;
const CAMPFIRE_LOG_RADIUS = 5; const CAMPFIRE_LOG_LENGTH = 40; const CAMPFIRE_BASE_RADIUS = 25;
const SNAKE_VISUAL_SEGMENTS = 40; const SNAKE_RADIUS = 6;
const AMMO_CASING_RADIUS = 0.6; const AMMO_CASING_LENGTH = 3.5;
const AMMO_CASING_GRAVITY = 980; const AMMO_CASING_BOUNCE = 0.3; const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500; const HIT_SPARK_BASE_LIFE = 0.2; const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150; const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.6; const FLAME_RAND_LIFE = 0.5; const FLAME_VEL_Y = 60; const FLAME_VEL_SPREAD = 25;
const RAIN_SPEED_Y = -500; const RAIN_SPEED_Y_RAND = -200; const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40; const DUST_SPEED_Y = 8; const DUST_OPACITY = 0.15;
const FADE_OUT_DURATION = 0.35;
const PLAYER_STATUS_ALIVE = 'alive'; const PLAYER_STATUS_DOWN = 'down'; const PLAYER_STATUS_DEAD = 'dead';
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS; const Y_OFFSET_ENEMY_BODY = 0; const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7;
const Y_OFFSET_BULLET = 10; const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS; const Y_OFFSET_SNAKE = SNAKE_RADIUS; const Y_OFFSET_CASING = AMMO_CASING_RADIUS;

// --- Module Scope Variables ---
let renderer, scene, camera, clock;
let ambientLight, directionalLight;
let domContainer;
let gameWidth = DEFAULT_GAME_WIDTH; let gameHeight = DEFAULT_GAME_HEIGHT;
let groundPlane = null;
const playerGroupMap = {}; const enemyGroupMap = {}; const powerupGroupMap = {};
let playerBulletMesh = null; let playerBulletMatrices = [];
let enemyBulletMesh = null;  let enemyBulletMatrices = [];
let ammoCasingMesh = null;   let activeAmmoCasings = [];
let hitSparkSystem = null;   let rainSystem = null;       let dustSystem = null;
let campfireSystem = null;   let snakeMesh = null;
let muzzleFlashLight = null;
let screenShakeOffset = new THREE.Vector3(0, 0, 0);
let shakeMagnitude = 0; let shakeEndTime = 0;
let cameraTargetPos = new THREE.Vector3(gameWidth / 2, 0, gameHeight / 2);
const sharedGeometries = {}; const sharedMaterials = {}; const powerupGeometries = {}; const loadedAssets = {};
const _dummyObject = new THREE.Object3D(); const _matrix = new THREE.Matrix4(); const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion(); const _scale = new THREE.Vector3(1, 1, 1); const _color = new THREE.Color();
const _vector3 = new THREE.Vector3();

// --- Initialization Functions ---

function _createAssets() { /* ...  ... */
    try {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext('2d'); if (!context) throw new Error("Failed context");
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0,'rgba(255,220,150,1)'); gradient.addColorStop(0.4,'rgba(255,150,0,0.8)'); gradient.addColorStop(1,'rgba(200,0,0,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
        loadedAssets.flameTexture = new THREE.CanvasTexture(canvas); loadedAssets.flameTexture.name = "FlameTexture";
    } catch (error) { console.error("Error creating flame texture:", error); }
 }
function _createGeometries() { /* ...  ... */
    sharedGeometries.playerBody = new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HEIGHT, 4, 12);
    sharedGeometries.head = new THREE.SphereGeometry(1, 12, 8);
    sharedGeometries.playerGun = new THREE.CylinderGeometry(PLAYER_GUN_RADIUS, PLAYER_GUN_RADIUS * 0.8, PLAYER_GUN_LENGTH, 8);
    sharedGeometries.enemyChaserBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH, ENEMY_CHASER_HEIGHT, ENEMY_CHASER_DEPTH);
    sharedGeometries.enemyShooterBody = new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_HEIGHT, 10);
    sharedGeometries.enemyGiantBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_DEPTH * ENEMY_GIANT_MULTIPLIER);
    sharedGeometries.enemyGun = new THREE.CylinderGeometry(ENEMY_GUN_RADIUS, ENEMY_GUN_RADIUS * 0.7, ENEMY_GUN_LENGTH, 8);
    sharedGeometries.bullet = new THREE.CylinderGeometry(BULLET_BASE_RADIUS, BULLET_BASE_RADIUS*0.8, BULLET_LENGTH, 8);
    sharedGeometries.bullet.rotateX(Math.PI / 2);
    sharedGeometries.ammoCasing = new THREE.CylinderGeometry(AMMO_CASING_RADIUS, AMMO_CASING_RADIUS, AMMO_CASING_LENGTH, 6);
    const ps = POWERUP_BASE_SIZE;
    powerupGeometries.health=new THREE.TorusGeometry(ps*0.4,ps*0.15,8,16); powerupGeometries.gun_upgrade=new THREE.ConeGeometry(ps*0.45,ps*0.9,4);
    powerupGeometries.speed_boost=new THREE.CylinderGeometry(ps*0.6,ps*0.6,ps*0.25,16); powerupGeometries.armor=new THREE.OctahedronGeometry(ps*0.6,0);
    powerupGeometries.ammo_shotgun=new THREE.BoxGeometry(ps*0.8,ps*0.8,ps*0.8); powerupGeometries.ammo_heavy_slug=new THREE.SphereGeometry(ps*0.6,12,8);
    powerupGeometries.ammo_rapid_fire=new THREE.TorusGeometry(ps*0.4,ps*0.1,6,12); powerupGeometries.bonus_score=new THREE.CylinderGeometry(ps*0.35,ps*0.35,ps*0.5,12);
    powerupGeometries.default=new THREE.BoxGeometry(ps*0.9,ps*0.9,ps*0.9);
    sharedGeometries.log = new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_LENGTH, 6);
    sharedGeometries.groundPlane = new THREE.PlaneGeometry(1, 1);
 }
function _createMaterials() { /* ...  ... */
    sharedMaterials.playerBody = new THREE.MeshStandardMaterial({color:0xDC143C, roughness:0.5, metalness:0.2, name:"PlayerBody"});
    sharedMaterials.playerHead = new THREE.MeshStandardMaterial({color:0xD2B48C, roughness:0.7, name:"PlayerHead"});
    sharedMaterials.playerGun = new THREE.MeshStandardMaterial({color:0x444444, roughness:0.5, metalness:0.7, name:"PlayerGun"});
    sharedMaterials.playerDown = new THREE.MeshStandardMaterial({color:0xFFD700, roughness:0.6, metalness:0.1, emissive:0xccab00, emissiveIntensity:0.5, name:"PlayerDown"});
    sharedMaterials.playerDead = new THREE.MeshStandardMaterial({color:0x555555, roughness:0.8, metalness:0.0, name:"PlayerDead"});
    sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({color:0xff69b4, roughness:0.5, metalness:0.2, emissive:0x331122, emissiveIntensity:0.3, name:"PlayerSelfBody"});
    const enemyStandardProps = {roughness:0.7, metalness:0.1, transparent:true, opacity:1.0};
    sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({color:0x18315f, ...enemyStandardProps, name:"EnemyChaserBody"});
    sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({color:0x556B2F, ...enemyStandardProps, name:"EnemyShooterBody"});
    sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({color:0x8B0000, roughness:0.6, metalness:0.2, transparent:true, opacity:1.0, name:"EnemyGiantBody"});
    sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({color:0xBC8F8F, roughness:0.7, name:"EnemyHead"});
    sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({color:0x505050, roughness:0.6, metalness:0.6, name:"EnemyGun"});
    sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({color:0xffed4a, name:"PlayerBullet"});
    sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({color:0xff4500, name:"EnemyBullet"});
    sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({color:0xdaa520, roughness:0.4, metalness:0.6, name:"AmmoCasing"});
    sharedMaterials.powerupBase = {roughness:0.6, metalness:0.1, name:"PowerupDefault"};
    sharedMaterials.powerups = {
        health: new THREE.MeshStandardMaterial({color:0x81c784,...sharedMaterials.powerupBase,name:"PowerupHealth"}), gun_upgrade: new THREE.MeshStandardMaterial({color:0x6a0dad,emissive:0x330044,emissiveIntensity:0.4,...sharedMaterials.powerupBase,name:"PowerupGun"}),
        speed_boost: new THREE.MeshStandardMaterial({color:0x3edef3,...sharedMaterials.powerupBase,name:"PowerupSpeed"}), armor: new THREE.MeshStandardMaterial({color:0xaaaaaa,metalness:0.8,roughness:0.3,...sharedMaterials.powerupBase,name:"PowerupArmor"}),
        ammo_shotgun: new THREE.MeshStandardMaterial({color:0xFFa500,...sharedMaterials.powerupBase,name:"PowerupShotgun"}), ammo_heavy_slug: new THREE.MeshStandardMaterial({color:0xA0522D,...sharedMaterials.powerupBase,name:"PowerupSlug"}),
        ammo_rapid_fire: new THREE.MeshStandardMaterial({color:0xFFFF00,emissive:0x555500,emissiveIntensity:0.5,...sharedMaterials.powerupBase,name:"PowerupRapid"}), bonus_score: new THREE.MeshStandardMaterial({color:0xFFD700,metalness:0.6,roughness:0.4,...sharedMaterials.powerupBase,name:"PowerupScore"}),
        default: new THREE.MeshStandardMaterial({color:0x888888,...sharedMaterials.powerupBase})
    };
    sharedMaterials.groundDay = new THREE.MeshStandardMaterial({color:0x788a77, roughness:0.9, metalness:0.05, name:"GroundDay"});
    sharedMaterials.groundNight = new THREE.MeshStandardMaterial({color:0x4E342E, roughness:0.85, metalness:0.1, name:"GroundNight"});
    sharedMaterials.log = new THREE.MeshStandardMaterial({color:0x5a3a1e, roughness:0.9, name:"Log"});
    sharedMaterials.snake = new THREE.MeshStandardMaterial({color:0x3a5311, roughness:0.4, metalness:0.1, side:THREE.DoubleSide, name:"Snake"});
    sharedMaterials.hitSpark = new THREE.PointsMaterial({size:10, vertexColors:true, transparent:true, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending, name:"HitSpark"});
    sharedMaterials.rainLine = new THREE.LineBasicMaterial({color:0x88aaff, transparent:true, opacity:0.4, blending:THREE.AdditiveBlending, name:"RainLine"});
    sharedMaterials.dustMote = new THREE.PointsMaterial({size:50, color:0xd2b48c, transparent:true, opacity:DUST_OPACITY, sizeAttenuation:true, depthWrite:false, name:"DustMote"});
    sharedMaterials.flame = new THREE.PointsMaterial({size:18, vertexColors:true, map:loadedAssets.flameTexture, transparent:true, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending, name:"Flame"});
}
function _initParticlesAndInstances() { /* ...  ... */
    if (!scene) return;
    playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS); playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); playerBulletMesh.count = 0; playerBulletMesh.name = "PlayerBullets"; scene.add(playerBulletMesh); playerBulletMatrices = playerBulletMesh.instanceMatrix.array;
    enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS); enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); enemyBulletMesh.count = 0; enemyBulletMesh.name = "EnemyBullets"; scene.add(enemyBulletMesh); enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array;
    ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS); ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; ammoCasingMesh.name = "AmmoCasings"; scene.add(ammoCasingMesh); activeAmmoCasings = [];
    const sparkGeo = new THREE.BufferGeometry(); const sparkP = new Float32Array(MAX_HIT_SPARKS * 3); const sparkC = new Float32Array(MAX_HIT_SPARKS * 3); const sparkA = new Float32Array(MAX_HIT_SPARKS); const sparkData = []; for (let i = 0; i < MAX_HIT_SPARKS; i++) { sparkP[i * 3 + 1] = -1e4; sparkA[i] = 0; sparkData.push({ p: new THREE.Vector3(0,-1e4,0), v: new THREE.Vector3(), c: new THREE.Color(1,1,1), a: 0.0, l: 0 }); } sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkP, 3).setUsage(THREE.DynamicDrawUsage)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkC, 3).setUsage(THREE.DynamicDrawUsage)); sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkA, 1).setUsage(THREE.DynamicDrawUsage)); hitSparkSystem = { particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark), geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData }; hitSparkSystem.particles.name = "HitSparks"; scene.add(hitSparkSystem.particles);
    const rainGeo = new THREE.BufferGeometry(); const rainP = new Float32Array(MAX_RAIN_DROPS * 6); const rainData = []; for (let i = 0; i < MAX_RAIN_DROPS; i++) { const x = Math.random()*gameWidth*GROUND_MARGIN - (gameWidth*(GROUND_MARGIN-1)/2); const y = Math.random()*1000+800; const z = Math.random()*gameHeight*GROUND_MARGIN - (gameHeight*(GROUND_MARGIN-1)/2); rainP[i*6+1] = -1e4; rainP[i*6+4] = -1e4; rainData.push({ x:x, y:y, z:z, s: RAIN_SPEED_Y + Math.random()*RAIN_SPEED_Y_RAND }); } rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3).setUsage(THREE.DynamicDrawUsage)); rainSystem = { lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine), geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData }; rainSystem.lines.visible = false; rainSystem.lines.name = "RainLines"; scene.add(rainSystem.lines);
    const dustGeo = new THREE.BufferGeometry(); const dustP = new Float32Array(MAX_DUST_MOTES * 3); const dustData = []; for (let i = 0; i < MAX_DUST_MOTES; i++) { dustP[i * 3 + 1] = -1e4; dustData.push({ p: new THREE.Vector3(Math.random()*gameWidth, Math.random()*80+5, Math.random()*gameHeight), v: new THREE.Vector3((Math.random()-0.5)*DUST_SPEED_XZ, (Math.random()-0.5)*DUST_SPEED_Y, (Math.random()-0.5)*DUST_SPEED_XZ) }); } dustGeo.setAttribute('position', new THREE.BufferAttribute(dustP, 3).setUsage(THREE.DynamicDrawUsage)); dustSystem = { particles: new THREE.Points(dustGeo, sharedMaterials.dustMote), geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData }; dustSystem.particles.visible = false; dustSystem.particles.name = "DustParticles"; scene.add(dustSystem.particles);
}
function _initCampfire() { /* ...  ... */
    if (!scene) return; campfireSystem = {}; const group = new THREE.Group(); group.name = "CampfireGroup";
    const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log); log1.rotation.set(0, Math.PI/10, Math.PI/6); log1.castShadow = true; log1.position.set(-CAMPFIRE_LOG_LENGTH*0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH*0.2);
    const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log); log2.rotation.set(0, -Math.PI/8, -Math.PI/5); log2.castShadow = true; log2.position.set(CAMPFIRE_LOG_LENGTH*0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH*0.1);
    group.add(log1); group.add(log2);
    const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0); glowLight.position.y = Y_OFFSET_CAMPFIRE + 15; glowLight.castShadow = true; glowLight.shadow.mapSize.width = 512; glowLight.shadow.mapSize.height = 512; glowLight.shadow.bias = -0.01; group.add(glowLight);
    const flameGeo = new THREE.BufferGeometry(); const flameP = new Float32Array(MAX_FLAME_PARTICLES*3); const flameC = new Float32Array(MAX_FLAME_PARTICLES*3); const flameA = new Float32Array(MAX_FLAME_PARTICLES); const flameData = []; for (let i=0; i<MAX_FLAME_PARTICLES; i++) { flameP[i*3+1]=-1e4; flameA[i]=0; flameData.push({ p:new THREE.Vector3(0,-1e4,0), v:new THREE.Vector3(), c:new THREE.Color(1,1,1), a:0.0, l:0, bl:FLAME_BASE_LIFE + Math.random()*FLAME_RAND_LIFE }); }
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flameP, 3).setUsage(THREE.DynamicDrawUsage)); flameGeo.setAttribute('color', new THREE.BufferAttribute(flameC, 3).setUsage(THREE.DynamicDrawUsage)); flameGeo.setAttribute('alpha', new THREE.BufferAttribute(flameA, 1).setUsage(THREE.DynamicDrawUsage));
    const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame); flameParticles.name = "CampfireFlames"; group.add(flameParticles); group.visible = false;
    campfireSystem = { group: group, particles: flameParticles, geometry: flameGeo, material: sharedMaterials.flame, glowLight: glowLight, data: flameData };
    scene.add(group);
 }
function _initSnake() { /* ...  ... */
    if (!scene) return; const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0)); const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false);
    snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake); snakeMesh.castShadow = true; snakeMesh.visible = false; snakeMesh.name = "Snake"; scene.add(snakeMesh);
}

// --- Object Creation ---
function _createPlayerGroup(playerData, isSelf) {
    const group = new THREE.Group(); group.name = `PlayerGroup_${playerData.id}`;
    const bodyMat = isSelf ? sharedMaterials.playerSelfBody.clone() : sharedMaterials.playerBody.clone(); const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat); bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_CAPSULE_RADIUS; group.add(bodyMesh);
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead.clone()); headMesh.scale.setScalar(PLAYER_HEAD_RADIUS); headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; headMesh.castShadow = true; group.add(headMesh);
    const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun.clone()); gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh);
    group.position.set(playerData.x, 0, playerData.y);
    group.userData = { gameId: playerData.id, isPlayer: true, isSelf: isSelf, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentMat: bodyMat, dyingStartTime: null }; return group;
}
function _createEnemyGroup(enemyData) {
    const group = new THREE.Group(); group.name = `EnemyGroup_${enemyData.id}`; let bodyGeo, bodyMat, headScale, yBodyOffset; const enemyHeight = enemyData.height || ENEMY_CHASER_HEIGHT;
    switch (enemyData.type) { case 'shooter': bodyGeo = sharedGeometries.enemyShooterBody; bodyMat = sharedMaterials.enemyShooterBody.clone(); headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2; const enemyGun = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun.clone()); enemyGun.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8); enemyGun.rotation.x = Math.PI / 2; enemyGun.castShadow = true; group.add(enemyGun); group.userData.gunMesh = enemyGun; break; case 'giant': bodyGeo = sharedGeometries.enemyGiantBody; bodyMat = sharedMaterials.enemyGiantBody.clone(); headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8; yBodyOffset = enemyHeight / 2; break; case 'chaser': default: bodyGeo = sharedGeometries.enemyChaserBody; bodyMat = sharedMaterials.enemyChaserBody.clone(); headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2; break; }
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat); bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset; group.add(bodyMesh);
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead.clone()); headMesh.scale.setScalar(headScale); headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; headMesh.castShadow = true; group.add(headMesh);
    group.position.set(enemyData.x, 0, enemyData.y);
    group.userData = { gameId: enemyData.id, isEnemy: true, type: enemyData.type, bodyMesh: bodyMesh, headMesh: headMesh, currentMat: bodyMat, dyingStartTime: null, health: enemyData.health }; return group;
}
function _createPowerupGroup(powerupData) {
    const group = new THREE.Group(); group.name = `PowerupGroup_${powerupData.id}`; const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default; const material = (sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default)?.clone(); if (!material) return null;
    const iconMesh = new THREE.Mesh(geometry, material); iconMesh.castShadow = true; iconMesh.position.y = Y_OFFSET_POWERUP; iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); group.add(iconMesh); group.position.set(powerupData.x, 0, powerupData.y);
    group.userData = { gameId: powerupData.id, isPowerup: true, iconMesh: iconMesh }; return group;
}

// --- Disposal / Removal ---
function _disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (child.material) {
                 const materials = Array.isArray(child.material) ? child.material : [child.material];
                 materials.forEach(m => {
                     let isShared = Object.values(sharedMaterials).includes(m) || Object.values(sharedMaterials.powerups).includes(m);
                     if (m && !isShared) m.dispose();
                 });
            }
        }
    });
}
function _disposeAndRemoveObject(obj, id, objectMap) {
    if (!obj || !scene) return;
    scene.remove(obj);
    _disposeObject3D(obj);
    delete objectMap[id];
}
function _handleObjectRemoval(obj, id, objectMap) {
    if (!obj || !clock) return;
    const isEnemy = obj.userData?.isEnemy;
    const wasAlive = !obj.userData?.dyingStartTime && (obj.userData?.health === undefined || obj.userData?.health > 0);
    if (isEnemy && wasAlive && !obj.userData.dyingStartTime) {
        obj.userData.dyingStartTime = clock.elapsedTime; obj.userData.health = 0;
        obj.traverse(child => { if (child.material) child.material.transparent = true; });
    } else if (isEnemy && obj.userData.dyingStartTime) {
        const timeElapsed = clock.elapsedTime - obj.userData.dyingStartTime;
        const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION);
        const opacity = 1.0 - fadeProgress;
        obj.traverse(child => { if (child.material) child.material.opacity = opacity; });
        if (fadeProgress >= 1.0) _disposeAndRemoveObject(obj, id, objectMap);
    } else { _disposeAndRemoveObject(obj, id, objectMap); }
}

// --- Update Logic ---
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) {
    if (!scene || !clock) return;
    const activeIds = new Set();
    if (state) {
        for (const id in state) {
            const data = state[id];
            if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;
            activeIds.add(id);
            let obj = objectMap[id];
            if (!obj) {
                const isSelf = isSelfFn ? isSelfFn(id) : false;
                obj = createFn(data, isSelf);
                if (obj) {
                    objectMap[id] = obj; scene.add(obj); updateFn(obj, data, 0, isSelf);
                } else continue;
            } else {
                const isSelf = obj.userData?.isSelf ?? (isSelfFn ? isSelfFn(id) : false);
                if (obj.userData?.dyingStartTime) { obj.userData.dyingStartTime = null; obj.visible = true; obj.traverse(child => { if (child.material) { child.material.opacity = 1.0; child.material.transparent = false; child.material.needsUpdate = true; } }); }
                updateFn(obj, data, clock.deltaTime, isSelf);
            }
        }
    }
    for (const id in objectMap) { if (!activeIds.has(id)) _handleObjectRemoval(objectMap[id], id, objectMap); }
}
function _updatePlayerGroup(group, playerData, deltaTime, isSelf) {
    if (!group?.userData) return;
    group.position.x = playerData.x; group.position.z = playerData.y;
    const bodyMesh = group.userData.bodyMesh; let targetMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
    if (playerData.player_status === PLAYER_STATUS_DOWN) targetMat = sharedMaterials.playerDown;
    else if (playerData.player_status === PLAYER_STATUS_DEAD) { group.visible = false; group.userData.dyingStartTime = null; return; } else group.visible = true;
    if (group.userData.currentMat !== targetMat) { group.userData.currentMat = targetMat; if (bodyMesh) bodyMesh.material = targetMat.clone(); }
    if (isSelf && window.appState?.localPlayerAimState) { const {lastAimDx, lastAimDy} = window.appState.localPlayerAimState; group.rotation.y = Math.atan2(lastAimDx, lastAimDy); }
}
function _updateEnemyGroup(group, enemyData, deltaTime) {
    if (!group?.userData || group.userData.dyingStartTime || !clock) return;
    group.position.x = enemyData.x; group.position.z = enemyData.y; group.userData.health = enemyData.health;
    const gunMesh = group.userData.gunMesh;
    if (enemyData.type === 'shooter' && window.appState?.serverState?.players) { const targetPlayer = window.appState.serverState.players[enemyData.target_player_id]; if (targetPlayer) group.rotation.y = Math.atan2(targetPlayer.x - enemyData.x, targetPlayer.y - enemyData.y); }
    const bodyMesh = group.userData.bodyMesh;
    if (bodyMesh && enemyData.type === 'giant') { const scaleTarget = (enemyData.attack_state === 'winding_up') ? 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05 : 1.0; bodyMesh.scale.lerp(_vector3.set(scaleTarget, scaleTarget, scaleTarget), 0.2); }
}
function _updatePowerupGroup(group, powerupData, deltaTime) {
     if (!group?.userData || !clock) return;
     group.position.x = powerupData.x; group.position.z = powerupData.y;
     const iconMesh = group.userData.iconMesh; if (iconMesh) { iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + group.id * 0.5) * 4; iconMesh.rotation.y += 0.015; iconMesh.rotation.x += 0.005; iconMesh.rotation.z += 0.003; }
}
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) {
    if (!mesh || !state) { if (mesh) mesh.count = 0; return; }
    let visibleCount = 0; const maxCount = matrices.length / 16;
    for (const id in state) {
        if (visibleCount >= maxCount) break;
        const data = state[id];
        const isPlayerBullet = data.owner_type === 'player';
        if (mesh === playerBulletMesh && !isPlayerBullet) continue;
        if (mesh === enemyBulletMesh && isPlayerBullet) continue;
        if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;
        _position.set(data.x, yOffset, data.y);
        if (isBullet && data.vx !== undefined && data.vy !== undefined && (data.vx !== 0 || data.vy !== 0)) {
            const angle = Math.atan2(data.vx, data.vy); _quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
        } else { _quaternion.identity(); }
         _scale.set(1, 1, 1); _matrix.compose(_position, _quaternion, _scale); _matrix.toArray(matrices, visibleCount * 16); visibleCount++;
    }
    mesh.count = visibleCount; mesh.instanceMatrix.needsUpdate = true;
}
function _updateActiveCasings(deltaTime) {
    if (!ammoCasingMesh || !clock) return;
    const now = clock.elapsedTime;
    activeAmmoCasings = activeAmmoCasings.filter(casing => {
        if (now > casing.endTime) return false;
        casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime; casing.position.addScaledVector(casing.velocity, deltaTime); casing.rotation += casing.rotationSpeed * deltaTime;
        if (casing.position.y <= Y_OFFSET_CASING) { casing.position.y = Y_OFFSET_CASING; casing.velocity.y *= -AMMO_CASING_BOUNCE; casing.velocity.x *= (1.0 - AMMO_CASING_DRAG); casing.velocity.z *= (1.0 - AMMO_CASING_DRAG); casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0); if (Math.abs(casing.velocity.y) < 5) casing.velocity.y = 0; if(Math.abs(casing.rotationSpeed) < 0.1) casing.rotationSpeed = 0; }
        return true;
    });
    let visibleCount = 0;
    for (let i = 0; i < activeAmmoCasings.length && i < MAX_AMMO_CASINGS; i++) { const casing = activeAmmoCasings[i]; _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0)); _matrix.compose(casing.position, _quaternion, _scale); ammoCasingMesh.setMatrixAt(i, _matrix); visibleCount++; }
    ammoCasingMesh.count = visibleCount; ammoCasingMesh.instanceMatrix.needsUpdate = true;
}
function _spawnAmmoCasing(spawnPos, ejectVec) {
    if (!ammoCasingMesh || activeAmmoCasings.length >= MAX_AMMO_CASINGS || !clock) return;
    const now = clock.elapsedTime; const life = 1.5 + Math.random() * 1.0; const ejectAngle = Math.atan2(ejectVec.z, ejectVec.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5; const ejectSpeed = 150 + Math.random() * 80; const upSpeed = 50 + Math.random() * 40; const rotationSpeed = (Math.random() - 0.5) * 20;
    activeAmmoCasings.push({ position: new THREE.Vector3(spawnPos.x + Math.cos(ejectAngle) * 5, spawnPos.y + PLAYER_TOTAL_HEIGHT * 0.6, spawnPos.z + Math.sin(ejectAngle) * 5), velocity: new THREE.Vector3(Math.cos(ejectAngle) * ejectSpeed, upSpeed, Math.sin(ejectAngle) * ejectSpeed), rotation: Math.random() * Math.PI * 2, rotationSpeed: rotationSpeed, startTime: now, endTime: now + life });
}
function _updateHitSparks(deltaTime) {
    if (!hitSparkSystem || !clock) return;
    const positions = hitSparkSystem.geometry.attributes.position.array; const colors = hitSparkSystem.geometry.attributes.color.array; const alphas = hitSparkSystem.geometry.attributes.alpha.array; const data = hitSparkSystem.data; let needsUpdate = false; let activeCount = 0;
    for (let i = 0; i < MAX_HIT_SPARKS; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; if (p.l <= 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; } else { p.v.y -= HIT_SPARK_GRAVITY * deltaTime; p.p.addScaledVector(p.v, deltaTime); p.a = Math.min(1.0, Math.max(0, (p.l / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5)); alphas[i] = p.a; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b; activeCount++; } needsUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; needsUpdate = true; } }
    if (needsUpdate) { hitSparkSystem.geometry.attributes.position.needsUpdate = true; hitSparkSystem.geometry.attributes.color.needsUpdate = true; hitSparkSystem.geometry.attributes.alpha.needsUpdate = true; hitSparkSystem.particles.visible = activeCount > 0; }
}
function _triggerHitSparks(position, count = 5) {
    if (!hitSparkSystem || !clock) return; const data = hitSparkSystem.data; let spawned = 0;
    for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) { if (data[i].l <= 0) { const p = data[i]; p.p.copy(position); const angle = Math.random() * Math.PI * 2; const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD; p.v.set(Math.cos(angle) * Math.cos(spreadAngle) * speed, Math.sin(spreadAngle) * speed * 1.5 + 30, Math.sin(angle) * Math.cos(spreadAngle) * speed); p.c.setRGB(1, 0.2 + Math.random() * 0.3, 0); p.a = 1.0; p.l = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE; spawned++; } }
}
function _updateRain(deltaTime) {
    if (!rainSystem || !rainSystem.lines.visible) return; const positions = rainSystem.geometry.attributes.position.array; const data = rainSystem.data; let needsUpdate = false;
    for (let i = 0; i < MAX_RAIN_DROPS; i++) { const p = data[i]; p.y += p.s * deltaTime; if (p.y < -50) { p.x = Math.random() * gameWidth * GROUND_MARGIN - (gameWidth * (GROUND_MARGIN - 1) / 2); p.y = Math.random() * 500 + 1000; p.z = Math.random() * gameHeight * GROUND_MARGIN - (gameHeight * (GROUND_MARGIN - 1) / 2); p.s = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND; } const idx = i * 6; positions[idx+0]=p.x; positions[idx+1]=p.y; positions[idx+2]=p.z; positions[idx+3]=p.x; positions[idx+4]=p.y - RAIN_STREAK_LENGTH; positions[idx+5]=p.z; needsUpdate = true; } if (needsUpdate) rainSystem.geometry.attributes.position.needsUpdate = true;
}
function _updateDust(deltaTime) {
     if (!dustSystem || !dustSystem.particles.visible || !camera) return; const positions = dustSystem.geometry.attributes.position.array; const data = dustSystem.data; let needsUpdate = false; const camPos = camera.position; const maxDistSq = 1200 * 1200;
     for (let i = 0; i < MAX_DUST_MOTES; i++) { const p = data[i]; p.p.addScaledVector(p.v, deltaTime); const halfW = gameWidth/2; const halfH = gameHeight/2; const marginW = gameWidth*(GROUND_MARGIN-1)/2; const marginH = gameHeight*(GROUND_MARGIN-1)/2; const worldWidth = gameWidth*GROUND_MARGIN; const worldHeight = gameHeight*GROUND_MARGIN; if(p.p.x<halfW-marginW) p.p.x+=worldWidth; else if(p.p.x>halfW+worldWidth-marginW) p.p.x-=worldWidth; if(p.p.z<halfH-marginH) p.p.z+=worldHeight; else if(p.p.z>halfH+worldHeight-marginH) p.p.z-=worldHeight; p.p.y += (Math.random()-0.5)*DUST_SPEED_Y*deltaTime; p.p.y=Math.max(5,Math.min(80, p.p.y)); positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; needsUpdate = true; } if (needsUpdate) dustSystem.geometry.attributes.position.needsUpdate = true;
}
function _updateCampfire(deltaTime) {
    if (!campfireSystem || !campfireSystem.group.visible || !clock) return; const positions = campfireSystem.geometry.attributes.position.array; const colors = campfireSystem.geometry.attributes.color.array; const alphas = campfireSystem.geometry.attributes.alpha.array; const data = campfireSystem.data; let needsUpdate = false; let activeCount = 0; const spawnRate = 150; const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random())); let spawned = 0;
    for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) { if (data[i].l <= 0) { const p = data[i]; const angle = Math.random() * Math.PI * 2; const radius = Math.random() * CAMPFIRE_BASE_RADIUS; p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 2, Math.sin(angle) * radius); p.v.set((Math.random() - 0.5) * FLAME_VEL_SPREAD, FLAME_VEL_Y + Math.random() * 30, (Math.random() - 0.5) * FLAME_VEL_SPREAD); p.l = p.bl; p.a = 0.7 + Math.random() * 0.3; p.c.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); spawned++; } }
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; if (p.l <= 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; } else { p.v.y += (Math.random() - 0.4) * 20 * deltaTime; p.v.x *= 0.97; p.v.z *= 0.97; p.p.addScaledVector(p.v, deltaTime); p.a = Math.max(0, (p.l / p.bl) * 1.2); p.c.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); alphas[i] = p.a; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b; activeCount++; } needsUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; needsUpdate = true; } }
    if (needsUpdate) { campfireSystem.geometry.attributes.position.needsUpdate = true; campfireSystem.geometry.attributes.color.needsUpdate = true; campfireSystem.geometry.attributes.alpha.needsUpdate = true; }
    if (campfireSystem.glowLight) campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0) * 0.8;
    if(campfireSystem.group && window.appState?.serverState?.campfire) { const cfData = window.appState.serverState.campfire; campfireSystem.group.position.set(cfData.x, 0, cfData.y); campfireSystem.group.visible = cfData.active; } else if (campfireSystem.group) { campfireSystem.group.visible = false; }
}
function _updateSnake(snakeData) {
    if (!snakeMesh || !snakeData) { if(snakeMesh) snakeMesh.visible = false; return; } const isActive = snakeData?.isActiveFromServer ?? false; snakeMesh.visible = isActive;
    if (isActive && snakeData.segments && snakeData.segments.length > 1) { const points = snakeData.segments.map(seg => _vector3.set(seg.x, Y_OFFSET_SNAKE, seg.y)); if (points.length >= 2) { try { const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1); const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2); if(tubePoints.length >= 2) { const newGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tubePoints), tubePoints.length - 1, SNAKE_RADIUS, 6, false); snakeMesh.geometry.dispose(); snakeMesh.geometry = newGeometry; snakeMesh.visible = true; } else snakeMesh.visible = false; } catch(e) { console.error("Error updating snake geometry:", e); snakeMesh.visible = false; } } else snakeMesh.visible = false; }
}
function _updateCamera(deltaTime) {
    if (!camera || !clock) return; const targetX = cameraTargetPos.x; const targetZ = cameraTargetPos.z; _vector3.set(targetX, CAMERA_BASE_Y, targetZ); camera.position.lerp(_vector3, CAMERA_LERP_FACTOR);
    if (shakeMagnitude > 0 && clock.elapsedTime < shakeEndTime) { const timeRemaining = shakeEndTime - clock.elapsedTime; const decayFactor = Math.pow(Math.max(0, timeRemaining / (shakeEndTime - (clock.elapsedTime-deltaTime))), 2); const currentMag = shakeMagnitude * decayFactor; const shakeAngle = Math.random() * Math.PI * 2; screenShakeOffset.set(Math.cos(shakeAngle)*currentMag, (Math.random()-0.5)*currentMag*0.5, Math.sin(shakeAngle)*currentMag); camera.position.add(screenShakeOffset); } else shakeMagnitude = 0;
    _vector3.set(targetX, 0, targetZ); camera.lookAt(_vector3);
}
function _updateEnvironment(isNight, isRaining, isDustStorm) {
     if (!scene || !ambientLight || !directionalLight || !groundPlane || !clock) return;
     const dayAI=0.7, nightAI=0.45; const dayDI=1.2, nightDI=0.7; const dayAC=0xffffff, nightAC=0x7080a0; const dayDC=0xffffff, nightDC=0xa0b0ff; const dayFogC=0xc0d0e0, dayFogD=0.0003; const nightFogC=0x04060a, nightFogD=0.0008; const dustFogC=0xb09070, dustFogD=0.0015;
     const targetAI=isNight?nightAI:dayAI; const targetDI=isNight?nightDI:dayDI; const targetAC=isNight?nightAC:dayAC; const targetDC=isNight?nightDC:dayDC; const targetGM=isNight?sharedMaterials.groundNight:sharedMaterials.groundDay;
     let targetFD, targetFC; if(isDustStorm){targetFD=dustFogD;targetFC=dustFogC;}else if(isNight){targetFD=nightFogD;targetFC=nightFogC;}else{targetFD=dayFogD;targetFC=dayFogC;}
     const lerpA=0.05; ambientLight.intensity=lerp(ambientLight.intensity, targetAI, lerpA); directionalLight.intensity=lerp(directionalLight.intensity, targetDI, lerpA); ambientLight.color.lerp(_color.setHex(targetAC), lerpA); directionalLight.color.lerp(_color.setHex(targetDC), lerpA);
     if (groundPlane.material !== targetGM) groundPlane.material = targetGM;
     if (!scene.fog) scene.fog = new THREE.FogExp2(targetFC, targetFD); else { scene.fog.color.lerp(_color.setHex(targetFC), lerpA); scene.fog.density = lerp(scene.fog.density, targetFD, lerpA); }
     if(!scene.background || !(scene.background instanceof THREE.Color)) scene.background = new THREE.Color(); scene.background.lerp(_color.setHex(targetFC), lerpA);
     if (rainSystem) rainSystem.l.visible = isRaining; if (dustSystem) dustSystem.p.visible = isDustStorm;
}
function _updateMuzzleFlash(localEffects, playerGroup) {
    if (!muzzleFlashLight || !clock) return; const flashState = localEffects?.muzzleFlash; const now = clock.elapsedTime * 1000;
    if (flashState?.active && now < flashState.endTime && playerGroup && playerGroup.userData.gunMesh) { muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; const gunMesh = playerGroup.userData.gunMesh; _vector3.set(0, PLAYER_GUN_LENGTH / 2 + 5, 0); gunMesh.localToWorld(_vector3); muzzleFlashLight.position.copy(_vector3); }
    else { muzzleFlashLight.intensity = 0; if (flashState) flashState.active = false; }
}

/** Projects a 3D world position to 2D screen coordinates. */
function _projectToScreen(worldPosition) { // Internal helper defined before public API
    if (!camera || !renderer?.domElement) return null;
    try {
        _vector3.copy(worldPosition);
        _vector3.project(camera); // Project into NDC (-1 to 1)
        const widthHalf = renderer.domElement.width / 2;
        const heightHalf = renderer.domElement.height / 2;
        const screenX = Math.round((_vector3.x * widthHalf) + widthHalf);
        const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); // Y is inverted
        if (_vector3.z > 1.0) return null; // Check if behind camera
        return { screenX, screenY };
    } catch (e) { return null; }
}


// --- Public API --- (Defined AFTER all helper functions)
const Renderer3D = {
    init: (containerElement, initialWidth, initialHeight) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;
        gameWidth = initialWidth || DEFAULT_GAME_WIDTH; gameHeight = initialHeight || DEFAULT_GAME_HEIGHT;
        cameraTargetPos.set(gameWidth / 2, 0, gameHeight / 2);
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(gameWidth, gameHeight);
            renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
            domContainer.appendChild(renderer.domElement);
            scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2a28);
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, gameWidth / gameHeight, CAMERA_NEAR, CAMERA_FAR);
            camera.position.set(gameWidth / 2, CAMERA_BASE_Y, gameHeight / 2 + 300); camera.rotation.x = CAMERA_ANGLE; scene.add(camera);
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); directionalLight.position.set(gameWidth * 0.3, 400, gameHeight * 0.4); directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048; const shadowCamSizeX = gameWidth * GROUND_MARGIN * 0.55; const shadowCamSizeZ = gameHeight * GROUND_MARGIN * 0.55;
            directionalLight.shadow.camera.left = -shadowCamSizeX; directionalLight.shadow.camera.right = shadowCamSizeX; directionalLight.shadow.camera.top = shadowCamSizeZ; directionalLight.shadow.camera.bottom = -shadowCamSizeZ;
            directionalLight.shadow.camera.near = 50; directionalLight.shadow.camera.far = 1000; directionalLight.shadow.bias = -0.002;
            directionalLight.target.position.set(gameWidth / 2, 0, gameHeight / 2); scene.add(directionalLight); scene.add(directionalLight.target);
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);
            _createAssets(); _createGeometries(); _createMaterials();
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.scale.set(gameWidth * GROUND_MARGIN, gameHeight * GROUND_MARGIN, 1); groundPlane.rotation.x = -Math.PI / 2; groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
            groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane"; scene.add(groundPlane);
            _initParticlesAndInstances(); _initCampfire(); _initSnake();
            renderer.setViewport(0, 0, gameWidth, gameHeight); renderer.setScissor(0, 0, gameWidth, gameHeight); renderer.setScissorTest(false);
            clock = new THREE.Clock();
        } catch (error) { console.error("Renderer Init Error:", error); Renderer3D.cleanup(); return false; }
        console.log("--- Renderer3D initialization complete ---"); return true;
    },
     handleContainerResize: () => {
        if (!renderer || !camera || !domContainer) return;
        const newWidth = domContainer.clientWidth; const newHeight = domContainer.clientHeight;
        renderer.setSize(newWidth, newHeight); camera.aspect = newWidth / newHeight; camera.updateProjectionMatrix(); renderer.setViewport(0, 0, newWidth, newHeight); renderer.setScissor(0, 0, newWidth, newHeight);
    },
    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) return;
        const deltaTime = clock.getDelta();
        if (appState.canvasWidth && appState.canvasHeight && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) { gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight; cameraTargetPos.x = gameWidth / 2; cameraTargetPos.z = gameHeight / 2; if (groundPlane) groundPlane.scale.set(gameWidth * GROUND_MARGIN, gameHeight * GROUND_MARGIN, 1); }
        _updateCamera(deltaTime);
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateActiveCasings(deltaTime);
        _updateHitSparks(deltaTime);
        _updateRain(deltaTime);
        _updateDust(deltaTime);
        _updateCampfire(deltaTime);
        _updateSnake(localEffects.snake);
        _updateMuzzleFlash(localEffects, playerGroupMap[appState.localPlayerId]);
        const uiPositions = {};
        const projectEntity = (objMap, stateMap, yOffsetFn) => { for (const id in objMap) { const obj = objMap[id]; const data = stateMap?.[id]; if (obj?.visible && data) { const worldPos = obj.position.clone(); worldPos.y = yOffsetFn(data, obj); const screenPos = _projectToScreen(worldPos); if(screenPos) uiPositions[id] = screenPos; } } }; // Use internal helper
        const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y + PLAYER_HEAD_RADIUS * 1.5 || PLAYER_TOTAL_HEIGHT; const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y + (d.type==='giant' ? ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER : ENEMY_HEAD_RADIUS)*1.2 || ENEMY_CHASER_HEIGHT; const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y + POWERUP_BASE_SIZE * 0.5 || Y_OFFSET_POWERUP;
        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY); projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY); projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);
        if (stateToRender.damage_texts) { for (const id in stateToRender.damage_texts) { const dt = stateToRender.damage_texts[id]; const worldPos = _vector3.set(dt.x, PLAYER_TOTAL_HEIGHT * 0.8, dt.y); const screenPos = _projectToScreen(worldPos); if(screenPos) uiPositions[id] = screenPos; } } // Use internal helper
        appState.uiPositions = uiPositions;
        try { renderer.render(scene, camera); } catch (e) { console.error("!!! RENDER ERROR !!!", e); if (window.appState?.animationFrameId) { cancelAnimationFrame(window.appState.animationFrameId); window.appState.animationFrameId = null; console.error("!!! Animation loop stopped due to render error. !!!"); } }
    },
    triggerShake: (magnitude, durationMs) => { if (!clock) return; const now = clock.elapsedTime * 1000; const newEndTime = now + durationMs; if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) { shakeMagnitude = Math.max(0.1, magnitude); shakeEndTime = Math.max(newEndTime, shakeEndTime); } },
    spawnVisualAmmoCasing: (position, ejectVector) => { if (!clock) return; _spawnAmmoCasing(position, ejectVector); },
    triggerVisualHitSparks: (position, count = 5) => { if (!clock) return; _triggerHitSparks(position, count); },
    projectToScreen: (worldPosition) => { // Public method calls internal helper
        return _projectToScreen(worldPosition);
    },
    cleanup: () => {
        console.log("--- Renderer3D Cleanup ---");
        [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(system => { if (system) { if(system.particles) scene?.remove(system.particles); if(system.lines) scene?.remove(system.lines); if(system.group) scene?.remove(system.group); system.geometry?.dispose(); system.material?.dispose(); }});
        hitSparkSystem = null; rainSystem = null; dustSystem = null; campfireSystem = null;
        [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(mesh => { if (mesh) { scene?.remove(mesh); mesh.geometry?.dispose(); mesh.material?.dispose(); } });
        playerBulletMesh = null; enemyBulletMesh = null; ammoCasingMesh = null;
        if (snakeMesh) { scene?.remove(snakeMesh); snakeMesh.geometry?.dispose(); snakeMesh = null; }
        [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(objectMap => { for (const id in objectMap) _disposeAndRemoveObject(objectMap[id], id, objectMap); });
        Object.values(sharedGeometries).forEach(geo => geo?.dispose()); Object.values(sharedMaterials).forEach(mat => { if (mat instanceof THREE.Material) mat.dispose(); });
        if (sharedMaterials.powerups) { Object.values(sharedMaterials.powerups).forEach(mat => { if (mat instanceof THREE.Material) mat.dispose(); });}
        Object.values(powerupGeometries).forEach(geo => geo?.dispose()); Object.values(loadedAssets).forEach(asset => asset?.dispose());
        Object.keys(sharedGeometries).forEach(k=>delete sharedGeometries[k]); Object.keys(sharedMaterials).forEach(k=>delete sharedMaterials[k]); Object.keys(powerupGeometries).forEach(k=>delete powerupGeometries[k]); Object.keys(loadedAssets).forEach(k=>delete loadedAssets[k]);
        if (groundPlane) { scene?.remove(groundPlane); groundPlane = null; }
        if(scene) { if(ambientLight) scene.remove(ambientLight); if(directionalLight) scene.remove(directionalLight); if(directionalLight?.target) scene.remove(directionalLight.target); if(muzzleFlashLight) scene.remove(muzzleFlashLight); }
        ambientLight = null; directionalLight = null; muzzleFlashLight = null;
        if (renderer) { renderer.dispose(); renderer.forceContextLoss(); if (renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer = null; console.log("Renderer disposed."); }
        scene = null; camera = null; clock = null; domContainer = null;
        playerBulletMatrices = []; enemyBulletMatrices = []; activeAmmoCasings = [];
        shakeMagnitude = 0; shakeEndTime = 0;
        console.log("Renderer3D resources released.");
    },
    getCamera: () => camera,
    getGroundPlane: () => groundPlane,
};


export default Renderer3D;
