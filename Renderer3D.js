
import * as THREE from 'three';

// --- Constants ---

// Camera Configuration
const CAMERA_FOV = 60;
const CAMERA_NEAR = 10;
const CAMERA_FAR = 3500; // Adjusted for potentially larger fixed world
const CAMERA_HEIGHT_OFFSET = 950;
const CAMERA_DISTANCE_OFFSET = 300;
const CAMERA_LERP_FACTOR = 0.08;

// Instancing & Particle Limits
const MAX_PLAYER_BULLETS = 500; const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150; const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000; const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80; const MAX_SMOKE_PARTICLES = 60;

// Entity Visual Properties (Sizes, Radii, etc.)
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
const BOUNDARY_WALL_HEIGHT = 60; const BOUNDARY_WALL_DEPTH = 20;

// Particle Physics & Appearance
const AMMO_CASING_RADIUS = 0.6; const AMMO_CASING_LENGTH = 3.5;
const AMMO_CASING_GRAVITY = 980; const AMMO_CASING_BOUNCE = 0.3; const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500; const HIT_SPARK_BASE_LIFE = 0.2; const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150; const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.7; const FLAME_RAND_LIFE = 0.6; const FLAME_VEL_Y = 75; const FLAME_VEL_SPREAD = 25; const FLAME_SIZE_START = 18; const FLAME_SIZE_END = 10;
const SMOKE_BASE_LIFE = 2.5; const SMOKE_RAND_LIFE = 1.5; const SMOKE_VEL_Y = 40; const SMOKE_VEL_SPREAD = 15; const SMOKE_SIZE_START = 25; const SMOKE_SIZE_END = 60; const SMOKE_OPACITY_START = 0.35; const SMOKE_OPACITY_END = 0.0;
const RAIN_SPEED_Y = -500; const RAIN_SPEED_Y_RAND = -200; const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40; const DUST_SPEED_Y = 8; const DUST_OPACITY = 0.15;

// Misc Timing & State
const FADE_OUT_DURATION = 0.35;
const PLAYER_STATUS_ALIVE = 'alive'; const PLAYER_STATUS_DOWN = 'down'; const PLAYER_STATUS_DEAD = 'dead';

// Y-Offsets (Origin at feet on ground plane)
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS; const Y_OFFSET_ENEMY_BODY = 0;
const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7; const Y_OFFSET_BULLET = 10;
const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS; const Y_OFFSET_SNAKE = SNAKE_RADIUS;
const Y_OFFSET_CASING = AMMO_CASING_RADIUS; const Y_OFFSET_BOUNDARY = BOUNDARY_WALL_HEIGHT / 2;

// --- Module Scope Variables ---
let renderer, scene, camera, clock;
let ambientLight, directionalLight, muzzleFlashLight;
let domContainer;
let currentCanvasWidth = 0; let currentCanvasHeight = 0;
let worldWidth = 0; // Set during init from main.js
let worldHeight = 0; // Set during init from main.js

// Scene Objects
let groundPlane = null; let boundariesGroup = null;
const playerGroupMap = {}; const enemyGroupMap = {}; const powerupGroupMap = {};

// Instanced Meshes & Particles
let playerBulletMesh = null; let playerBulletMatrices = [];
let enemyBulletMesh = null;  let enemyBulletMatrices = [];
let ammoCasingMesh = null;   let activeAmmoCasings = [];
let hitSparkSystem = null; let rainSystem = null; let dustSystem = null;
let campfireSystem = null; let snakeMesh = null;

// Effects
let screenShakeOffset = new THREE.Vector3(0, 0, 0); let shakeMagnitude = 0; let shakeEndTime = 0;

// Shared Resources
const sharedGeometries = {}; const sharedMaterials = {};
const powerupGeometries = {}; const loadedAssets = {};

// Reusable THREE objects
const _dummyObject = new THREE.Object3D(); const _matrix = new THREE.Matrix4(); const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion(); const _scale = new THREE.Vector3(1, 1, 1); const _color = new THREE.Color();
const _vector3 = new THREE.Vector3(); const _vector3_B = new THREE.Vector3(); // Extra vector for mapping
const _cameraTargetWorldPos = new THREE.Vector3(); const _cameraDesiredPos = new THREE.Vector3();
const _worldCenter = new THREE.Vector3(); // Store world center based on fixed dimensions

// --- Coordinate Mapping Utilities ---

/**
 * Maps server coordinates (origin top-left, Y down) to renderer world coordinates
 * (origin bottom-left, Z up / "into screen"). Populates the targetVector.
 */
function mapServerToWorld(serverX, serverY, targetVector) {
    if (!targetVector) {
        console.warn("mapServerToWorld: targetVector is undefined");
        return; // Or create a new vector? Better to require it.
    }
    targetVector.x = serverX;
    targetVector.y = 0; // Assume ground plane
    targetVector.z = worldHeight - serverY; // Invert Y and shift origin
}

/**
 * Maps renderer world coordinates (XZ plane, origin bottom-left) back to
 * server coordinates (origin top-left, Y down).
 */
function mapWorldToServer(worldVector) {
    if (!worldVector) return { x: 0, y: 0 };
    return {
        x: worldVector.x,
        y: worldHeight - worldVector.z // Invert Z and shift origin
    };
}


// --- Internal Helper Functions ---
function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; }

function _createAssets() { /* ... unchanged from v3.4 ... */
    console.log("Renderer: Creating assets..."); try { const flameCanvas = document.createElement('canvas'); flameCanvas.width = 64; flameCanvas.height = 64; const flameCtx = flameCanvas.getContext('2d'); if (!flameCtx) throw new Error("Failed 2D context: flame"); const flameGradient = flameCtx.createRadialGradient(32, 32, 0, 32, 32, 32); flameGradient.addColorStop(0,'rgba(255,220,150,1)'); flameGradient.addColorStop(0.4,'rgba(255,150,0,0.8)'); flameGradient.addColorStop(1,'rgba(200,0,0,0)'); flameCtx.fillStyle = flameGradient; flameCtx.fillRect(0, 0, 64, 64); loadedAssets.flameTexture = new THREE.CanvasTexture(flameCanvas); loadedAssets.flameTexture.name = "FlameTexture"; const smokeCanvas = document.createElement('canvas'); smokeCanvas.width = 64; smokeCanvas.height = 64; const smokeCtx = smokeCanvas.getContext('2d'); if (!smokeCtx) throw new Error("Failed 2D context: smoke"); const smokeGradient = smokeCtx.createRadialGradient(32, 32, 0, 32, 32, 32); smokeGradient.addColorStop(0, 'rgba(200, 200, 200, 0.7)'); smokeGradient.addColorStop(0.6, 'rgba(150, 150, 150, 0.3)'); smokeGradient.addColorStop(1, 'rgba(100, 100, 100, 0)'); smokeCtx.fillStyle = smokeGradient; smokeCtx.fillRect(0, 0, 64, 64); loadedAssets.smokeTexture = new THREE.CanvasTexture(smokeCanvas); loadedAssets.smokeTexture.name = "SmokeTexture"; } catch (error) { console.error("Renderer Error creating procedural textures:", error); }
 }
function _createGeometries() { /* ... unchanged from v3.4 ... */
    console.log("Renderer: Creating geometries..."); sharedGeometries.playerBody = new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HEIGHT, 4, 12); sharedGeometries.head = new THREE.SphereGeometry(1, 12, 8); sharedGeometries.playerGun = new THREE.CylinderGeometry(PLAYER_GUN_RADIUS, PLAYER_GUN_RADIUS * 0.8, PLAYER_GUN_LENGTH, 8); sharedGeometries.enemyChaserBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH, ENEMY_CHASER_HEIGHT, ENEMY_CHASER_DEPTH); sharedGeometries.enemyShooterBody = new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_HEIGHT, 10); sharedGeometries.enemyGiantBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_DEPTH * ENEMY_GIANT_MULTIPLIER); sharedGeometries.enemyGun = new THREE.CylinderGeometry(ENEMY_GUN_RADIUS, ENEMY_GUN_RADIUS * 0.7, ENEMY_GUN_LENGTH, 8); sharedGeometries.bullet = new THREE.CylinderGeometry(BULLET_BASE_RADIUS, BULLET_BASE_RADIUS * 0.8, BULLET_LENGTH, 8); sharedGeometries.bullet.rotateX(Math.PI / 2); sharedGeometries.ammoCasing = new THREE.CylinderGeometry(AMMO_CASING_RADIUS, AMMO_CASING_RADIUS, AMMO_CASING_LENGTH, 6); sharedGeometries.log = new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_LENGTH, 6); sharedGeometries.groundPlane = new THREE.PlaneGeometry(1, 1); sharedGeometries.boundaryWall = new THREE.BoxGeometry(1, BOUNDARY_WALL_HEIGHT, BOUNDARY_WALL_DEPTH); const ps = POWERUP_BASE_SIZE; powerupGeometries.health = new THREE.TorusGeometry(ps * 0.4, ps * 0.15, 8, 16); powerupGeometries.gun_upgrade = new THREE.ConeGeometry(ps * 0.45, ps * 0.9, 4); powerupGeometries.speed_boost = new THREE.CylinderGeometry(ps * 0.6, ps * 0.6, ps * 0.25, 16); powerupGeometries.armor = new THREE.OctahedronGeometry(ps * 0.6, 0); powerupGeometries.ammo_shotgun = new THREE.BoxGeometry(ps * 0.8, ps * 0.8, ps * 0.8); powerupGeometries.ammo_heavy_slug = new THREE.SphereGeometry(ps * 0.6, 12, 8); powerupGeometries.ammo_rapid_fire = new THREE.TorusGeometry(ps * 0.4, ps * 0.1, 6, 12); powerupGeometries.bonus_score = new THREE.CylinderGeometry(ps * 0.35, ps * 0.35, ps * 0.5, 12); powerupGeometries.default = new THREE.BoxGeometry(ps * 0.9, ps * 0.9, ps * 0.9);
 }
function _createMaterials() { /* ... unchanged from v3.4 ... */
    console.log("Renderer: Creating materials..."); sharedMaterials.playerBody = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.2, name: "PlayerBody" }); sharedMaterials.playerHead = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: "PlayerHead" }); sharedMaterials.playerGun = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: "PlayerGun" }); sharedMaterials.playerDown = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6, metalness: 0.1, emissive: 0xccab00, emissiveIntensity: 0.5, name: "PlayerDown" }); sharedMaterials.playerDead = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.0, name: "PlayerDead" }); sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, metalness: 0.2, emissive: 0x331122, emissiveIntensity: 0.3, name: "PlayerSelfBody" }); const enemyStandardProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 }; sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemyStandardProps, name: "EnemyChaserBody" }); sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemyStandardProps, name: "EnemyShooterBody" }); sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 1.0, name: "EnemyGiantBody" }); sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({ color: 0xBC8F8F, roughness: 0.7, name: "EnemyHead" }); sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.6, metalness: 0.6, name: "EnemyGun" }); sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: "PlayerBullet" }); sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff4500, name: "EnemyBullet" }); sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: "AmmoCasing" }); sharedMaterials.powerupBase = { roughness: 0.6, metalness: 0.1, name: "PowerupDefault" }; sharedMaterials.powerups = { health: new THREE.MeshStandardMaterial({ color: 0x81c784, ...sharedMaterials.powerupBase, name: "PowerupHealth" }), gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x6a0dad, emissive: 0x330044, emissiveIntensity: 0.4, ...sharedMaterials.powerupBase, name: "PowerupGun" }), speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3, ...sharedMaterials.powerupBase, name: "PowerupSpeed" }), armor: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3, ...sharedMaterials.powerupBase, name: "PowerupArmor" }), ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500, ...sharedMaterials.powerupBase, name: "PowerupShotgun" }), ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D, ...sharedMaterials.powerupBase, name: "PowerupSlug" }), ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00, emissive: 0x555500, emissiveIntensity: 0.5, ...sharedMaterials.powerupBase, name: "PowerupRapid" }), bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.6, roughness: 0.4, ...sharedMaterials.powerupBase, name: "PowerupScore" }), default: new THREE.MeshStandardMaterial({ color: 0x888888, ...sharedMaterials.powerupBase }) }; sharedMaterials.groundDay = new THREE.MeshStandardMaterial({ color: 0x788a77, roughness: 0.9, metalness: 0.05, name: "GroundDay" }); sharedMaterials.groundNight = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.85, metalness: 0.1, name: "GroundNight" }); sharedMaterials.log = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: "Log" }); sharedMaterials.boundary = new THREE.MeshStandardMaterial({ color: 0x4d443d, roughness: 0.8, metalness: 0.1, name: "BoundaryWall" }); sharedMaterials.snake = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide, name: "Snake" }); sharedMaterials.hitSpark = new THREE.PointsMaterial({ size: 10, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "HitSpark" }); sharedMaterials.rainLine = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: "RainLine" }); sharedMaterials.dustMote = new THREE.PointsMaterial({ size: 50, color: 0xd2b48c, transparent: true, opacity: DUST_OPACITY, sizeAttenuation: true, depthWrite: false, name: "DustMote" }); sharedMaterials.flame = new THREE.PointsMaterial({ size: FLAME_SIZE_START, vertexColors: true, map: loadedAssets.flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "Flame" }); sharedMaterials.smoke = new THREE.PointsMaterial({ size: SMOKE_SIZE_START, vertexColors: false, color: 0xaaaaaa, map: loadedAssets.smokeTexture, transparent: true, opacity: SMOKE_OPACITY_START, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, name: "Smoke" });
}
function _initParticlesAndInstances() { /* ... unchanged from v3.4 ... */
    if (!scene) { console.error("Renderer: Scene not ready for particle/instance init."); return; } console.log("Renderer: Initializing particles and instanced meshes..."); playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS); playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); playerBulletMesh.count = 0; playerBulletMesh.name = "PlayerBullets"; scene.add(playerBulletMesh); playerBulletMatrices = playerBulletMesh.instanceMatrix.array; enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS); enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); enemyBulletMesh.count = 0; enemyBulletMesh.name = "EnemyBullets"; scene.add(enemyBulletMesh); enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array; ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS); ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; ammoCasingMesh.name = "AmmoCasings"; scene.add(ammoCasingMesh); activeAmmoCasings = []; const sparkGeo = new THREE.BufferGeometry(); const sparkP = new Float32Array(MAX_HIT_SPARKS * 3); const sparkC = new Float32Array(MAX_HIT_SPARKS * 3); const sparkA = new Float32Array(MAX_HIT_SPARKS); const sparkData = []; for (let i = 0; i < MAX_HIT_SPARKS; i++) { sparkP[i * 3 + 1] = -1e4; sparkA[i] = 0; sparkData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), a: 0.0, l: 0 }); } sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkP, 3).setUsage(THREE.DynamicDrawUsage)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkC, 3).setUsage(THREE.DynamicDrawUsage)); sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkA, 1).setUsage(THREE.DynamicDrawUsage)); hitSparkSystem = { particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark), geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData }; hitSparkSystem.particles.name = "HitSparks"; hitSparkSystem.particles.visible = false; scene.add(hitSparkSystem.particles); const rainGeo = new THREE.BufferGeometry(); const rainP = new Float32Array(MAX_RAIN_DROPS * 6); const rainData = []; for (let i = 0; i < MAX_RAIN_DROPS; i++) { const x = Math.random() * worldWidth; const y = Math.random() * 1000 + 800; const z = Math.random() * worldHeight; rainP[i * 6 + 1] = -1e4; rainP[i * 6 + 4] = -1e4; rainData.push({ x: x, y: y, z: z, s: RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND }); } rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3).setUsage(THREE.DynamicDrawUsage)); rainSystem = { lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine), geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData }; rainSystem.lines.visible = false; rainSystem.lines.name = "RainLines"; scene.add(rainSystem.lines); const dustGeo = new THREE.BufferGeometry(); const dustP = new Float32Array(MAX_DUST_MOTES * 3); const dustData = []; for (let i = 0; i < MAX_DUST_MOTES; i++) { dustP[i * 3 + 1] = -1e4; dustData.push({ p: new THREE.Vector3(Math.random() * worldWidth, Math.random() * 80 + 5, Math.random() * worldHeight), v: new THREE.Vector3((Math.random() - 0.5) * DUST_SPEED_XZ, (Math.random() - 0.5) * DUST_SPEED_Y, (Math.random() - 0.5) * DUST_SPEED_XZ) }); } dustGeo.setAttribute('position', new THREE.BufferAttribute(dustP, 3).setUsage(THREE.DynamicDrawUsage)); dustSystem = { particles: new THREE.Points(dustGeo, sharedMaterials.dustMote), geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData }; dustSystem.particles.visible = false; dustSystem.particles.name = "DustParticles"; scene.add(dustSystem.particles);
 }
function _initCampfire() { /* ... unchanged from v3.4 ... */
    if (!scene) { console.error("Renderer: Scene not ready for campfire init."); return; } console.log("Renderer: Initializing campfire..."); const group = new THREE.Group(); group.name = "CampfireGroup"; const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log); log1.rotation.set(0, Math.PI / 10, Math.PI / 6); log1.castShadow = true; log1.position.set(-CAMPFIRE_LOG_LENGTH * 0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH * 0.2); const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log); log2.rotation.set(0, -Math.PI / 8, -Math.PI / 5); log2.castShadow = true; log2.position.set(CAMPFIRE_LOG_LENGTH * 0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH * 0.1); group.add(log1); group.add(log2); const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0); glowLight.position.y = Y_OFFSET_CAMPFIRE + 15; glowLight.castShadow = true; glowLight.shadow.mapSize.width = 512; glowLight.shadow.mapSize.height = 512; glowLight.shadow.bias = -0.01; group.add(glowLight); const flameGeo = new THREE.BufferGeometry(); const flameP = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameC = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameS = new Float32Array(MAX_FLAME_PARTICLES); const flameData = []; for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { flameP[i * 3 + 1] = -1e4; flameS[i] = 0; flameData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), l: 0, bl: FLAME_BASE_LIFE + Math.random() * FLAME_RAND_LIFE, s: FLAME_SIZE_START }); } flameGeo.setAttribute('position', new THREE.BufferAttribute(flameP, 3).setUsage(THREE.DynamicDrawUsage)); flameGeo.setAttribute('color', new THREE.BufferAttribute(flameC, 3).setUsage(THREE.DynamicDrawUsage)); flameGeo.setAttribute('size', new THREE.BufferAttribute(flameS, 1).setUsage(THREE.DynamicDrawUsage)); const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame); flameParticles.name = "CampfireFlames"; flameParticles.visible = false; group.add(flameParticles); const smokeGeo = new THREE.BufferGeometry(); const smokeP = new Float32Array(MAX_SMOKE_PARTICLES * 3); const smokeA = new Float32Array(MAX_SMOKE_PARTICLES); const smokeS = new Float32Array(MAX_SMOKE_PARTICLES); const smokeData = []; for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) { smokeP[i * 3 + 1] = -1e4; smokeA[i] = 0; smokeS[i] = 0; smokeData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), a: 0.0, l: 0, bl: SMOKE_BASE_LIFE + Math.random() * SMOKE_RAND_LIFE, s: SMOKE_SIZE_START }); } smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeP, 3).setUsage(THREE.DynamicDrawUsage)); smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(smokeA, 1).setUsage(THREE.DynamicDrawUsage)); smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeS, 1).setUsage(THREE.DynamicDrawUsage)); const smokeParticles = new THREE.Points(smokeGeo, sharedMaterials.smoke); smokeParticles.name = "CampfireSmoke"; smokeParticles.visible = false; group.add(smokeParticles); campfireSystem = { group: group, flameParticles: flameParticles, flameGeometry: flameGeo, flameMaterial: sharedMaterials.flame, flameData: flameData, smokeParticles: smokeParticles, smokeGeometry: smokeGeo, smokeMaterial: sharedMaterials.smoke, smokeData: smokeData, glowLight: glowLight }; group.visible = false; scene.add(group);
 }
function _createBoundaries() { // Uses fixed world dimensions
    if (!scene) { console.error("Renderer: Scene not ready for boundaries init."); return; }
    console.log(`Renderer: Creating boundaries for world size ${worldWidth}x${worldHeight}...`);
    boundariesGroup = new THREE.Group(); boundariesGroup.name = "Boundaries";
    const wallMaterial = sharedMaterials.boundary; const wallGeometry = sharedGeometries.boundaryWall;

    const wallTop = new THREE.Mesh(wallGeometry, wallMaterial); wallTop.name="WallTop";
    wallTop.scale.x = worldWidth + BOUNDARY_WALL_DEPTH; // Cover full width + overlap
    wallTop.position.set(worldWidth / 2, Y_OFFSET_BOUNDARY, worldHeight + BOUNDARY_WALL_DEPTH / 2);
    wallTop.castShadow = true; wallTop.receiveShadow = true;

    const wallBottom = new THREE.Mesh(wallGeometry, wallMaterial); wallBottom.name="WallBottom";
    wallBottom.scale.x = worldWidth + BOUNDARY_WALL_DEPTH;
    wallBottom.position.set(worldWidth / 2, Y_OFFSET_BOUNDARY, -BOUNDARY_WALL_DEPTH / 2);
    wallBottom.castShadow = true; wallBottom.receiveShadow = true;

    const wallLeft = new THREE.Mesh(wallGeometry, wallMaterial); wallLeft.name="WallLeft";
    wallLeft.scale.x = worldHeight + BOUNDARY_WALL_DEPTH; // Cover full height + overlap
    wallLeft.rotation.y = Math.PI / 2;
    wallLeft.position.set(-BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldHeight / 2);
    wallLeft.castShadow = true; wallLeft.receiveShadow = true;

    const wallRight = new THREE.Mesh(wallGeometry, wallMaterial); wallRight.name="WallRight";
    wallRight.scale.x = worldHeight + BOUNDARY_WALL_DEPTH;
    wallRight.rotation.y = Math.PI / 2;
    wallRight.position.set(worldWidth + BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldHeight / 2);
    wallRight.castShadow = true; wallRight.receiveShadow = true;

    boundariesGroup.add(wallTop, wallBottom, wallLeft, wallRight);
    scene.add(boundariesGroup);
}
function _initSnake() { /* ... unchanged from v3.4 ... */
    if (!scene) { console.error("Renderer: Scene not ready for snake init."); return; } console.log("Renderer: Initializing snake mesh..."); const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0)); const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false); snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake); snakeMesh.castShadow = true; snakeMesh.visible = false; snakeMesh.name = "Snake"; scene.add(snakeMesh);
}
function _createPlayerGroup(playerData, isSelf) { // Uses mapping
    const group = new THREE.Group(); group.name = `PlayerGroup_${playerData.id}`; const bodyMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat); bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2; group.add(bodyMesh); const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead); headMesh.scale.setScalar(PLAYER_HEAD_RADIUS); headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; headMesh.castShadow = true; group.add(headMesh); const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun); gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh);
    mapServerToWorld(playerData.x, playerData.y, group.position); // Set initial position using mapping
    group.userData = { gameId: playerData.id, isPlayer: true, isSelf: isSelf, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentBodyMatRef: bodyMat, dyingStartTime: null }; return group;
}
function _createEnemyGroup(enemyData) { // Uses mapping
     const group = new THREE.Group(); group.name = `EnemyGroup_${enemyData.id}`; let bodyGeo, bodyMatRef, headScale, yBodyOffset, gunMesh = null; const enemyHeight = enemyData.height || ENEMY_CHASER_HEIGHT; switch (enemyData.type) { case 'shooter': bodyGeo = sharedGeometries.enemyShooterBody; bodyMatRef = sharedMaterials.enemyShooterBody; headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2; gunMesh = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun); gunMesh.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh); break; case 'giant': bodyGeo = sharedGeometries.enemyGiantBody; bodyMatRef = sharedMaterials.enemyGiantBody; headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8; yBodyOffset = enemyHeight / 2; break; case 'chaser': default: bodyGeo = sharedGeometries.enemyChaserBody; bodyMatRef = sharedMaterials.enemyChaserBody; headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2; break; } const bodyMesh = new THREE.Mesh(bodyGeo, bodyMatRef); bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset; group.add(bodyMesh); const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead); headMesh.scale.setScalar(headScale); headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; headMesh.castShadow = true; group.add(headMesh);
     mapServerToWorld(enemyData.x, enemyData.y, group.position); // Set initial position using mapping
     group.userData = { gameId: enemyData.id, isEnemy: true, type: enemyData.type, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentBodyMatRef: bodyMatRef, dyingStartTime: null, health: enemyData.health }; return group;
}
function _createPowerupGroup(powerupData) { // Uses mapping
     const group = new THREE.Group(); group.name = `PowerupGroup_${powerupData.id}`; const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default; const material = (sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default); if (!material) { console.error(`Renderer Error: Could not find material for powerup type: ${powerupData.type}`); return null; } const iconMesh = new THREE.Mesh(geometry, material); iconMesh.castShadow = true; iconMesh.position.y = Y_OFFSET_POWERUP; iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); group.add(iconMesh);
     mapServerToWorld(powerupData.x, powerupData.y, group.position); // Set initial position using mapping
     group.userData = { gameId: powerupData.id, isPowerup: true, iconMesh: iconMesh }; return group;
}
function _disposeMaterialTextures(material) { /* ... unchanged ... */ if (!material) return; const textures = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'displacementMap', 'envMap']; textures.forEach(prop => { if (material[prop] && material[prop] instanceof THREE.Texture) { if (Object.values(loadedAssets).includes(material[prop])) { material[prop].dispose(); } } }); }
function _disposeObject3D(obj) { /* ... unchanged ... */ if (!obj) return; obj.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) { child.geometry?.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(m => { if (m) { let isShared = Object.values(sharedMaterials).includes(m); if (!isShared && sharedMaterials.powerups) { isShared = Object.values(sharedMaterials.powerups).includes(m); } if (!isShared) { _disposeMaterialTextures(m); m.dispose(); } } }); } }); }
function _handleObjectRemoval(obj, id, objectMap) { /* ... unchanged ... */ if (!obj || !scene || !clock) return; const userData = obj.userData; const isEnemy = userData?.isEnemy; const wasAlive = !userData?.dyingStartTime && (userData?.health === undefined || userData?.health > 0); if (isEnemy && wasAlive && !userData.dyingStartTime) { userData.dyingStartTime = clock.elapsedTime; userData.health = 0; obj.traverse(child => { if (child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((mat, index) => { let isShared = Object.values(sharedMaterials).includes(mat); if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(mat); if (isShared) { const clonedMat = mat.clone(); clonedMat.transparent = true; clonedMat.needsUpdate = true; if (Array.isArray(child.material)) child.material[index] = clonedMat; else child.material = clonedMat; } else { mat.transparent = true; mat.needsUpdate = true; } }); } }); } else if (isEnemy && userData.dyingStartTime) { const timeElapsed = clock.elapsedTime - userData.dyingStartTime; const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION); const opacity = 1.0 - fadeProgress; obj.traverse(child => { if (child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(m => { m.opacity = opacity; }); } }); if (fadeProgress >= 1.0) { scene.remove(obj); _disposeObject3D(obj); delete objectMap[id]; } } else { scene.remove(obj); _disposeObject3D(obj); delete objectMap[id]; } }
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) { /* ... unchanged ... */ if (!scene || !clock) return; const activeIds = new Set(); if (state) { for (const id in state) { const data = state[id]; if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue; activeIds.add(id); let obj = objectMap[id]; const isSelf = isSelfFn ? isSelfFn(id) : false; if (!obj) { obj = createFn(data, isSelf); if (obj) { objectMap[id] = obj; scene.add(obj); updateFn(obj, data, 0, isSelf); } } else { if (obj.userData?.dyingStartTime) { obj.userData.dyingStartTime = null; obj.visible = true; obj.traverse(child => { if (child.material) { const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((mat, index) => { let isShared = Object.values(sharedMaterials).includes(mat); if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(mat); if (!isShared) mat.dispose(); let correctSharedMat = null; if(obj.userData.isPlayer) correctSharedMat = obj.userData.isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; else if(obj.userData.isEnemy) correctSharedMat = obj.userData.currentBodyMatRef; if(correctSharedMat && child === obj.userData.bodyMesh) { if (Array.isArray(child.material)) child.material[index] = correctSharedMat; else child.material = correctSharedMat; } mat.opacity = 1.0; mat.transparent = false; mat.needsUpdate = true; }); } }); } updateFn(obj, data, clock.deltaTime, isSelf); } } } for (const id in objectMap) { if (!activeIds.has(id)) { _handleObjectRemoval(objectMap[id], id, objectMap); } } }
function _updatePlayerGroup(group, playerData, deltaTime, isSelf) { // Uses mapping
     if (!group?.userData) return;
     mapServerToWorld(playerData.x, playerData.y, group.position); // Update position using mapping
     const userData = group.userData; const bodyMesh = userData.bodyMesh; let targetMatRef = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; let shouldBeVisible = true; switch (playerData.player_status) { case PLAYER_STATUS_DOWN: targetMatRef = sharedMaterials.playerDown; break; case PLAYER_STATUS_DEAD: shouldBeVisible = false; userData.dyingStartTime = null; break; case PLAYER_STATUS_ALIVE: default: break; } group.visible = shouldBeVisible; if (bodyMesh && userData.currentBodyMatRef !== targetMatRef && shouldBeVisible) { userData.currentBodyMatRef = targetMatRef; bodyMesh.material = targetMatRef; } if (shouldBeVisible && isSelf && window.appState?.localPlayerAimState) { const { lastAimDx, lastAimDy } = window.appState.localPlayerAimState; group.rotation.y = Math.atan2(lastAimDx, lastAimDy); } else if (shouldBeVisible && !isSelf && playerData.aim_dx !== undefined && playerData.aim_dy !== undefined) { group.rotation.y = Math.atan2(playerData.aim_dx, playerData.aim_dy); }
}
function _updateEnemyGroup(group, enemyData, deltaTime) { // Uses mapping
    if (!group?.userData || group.userData.dyingStartTime || !clock) return;
    mapServerToWorld(enemyData.x, enemyData.y, group.position); // Update position using mapping
    group.userData.health = enemyData.health; const gunMesh = group.userData.gunMesh; if (enemyData.type === 'shooter' && gunMesh && enemyData.aim_dx !== undefined && enemyData.aim_dy !== undefined) { group.rotation.y = Math.atan2(enemyData.aim_dx, enemyData.aim_dy); } const bodyMesh = group.userData.bodyMesh; if (bodyMesh && enemyData.type === 'giant') { const isWindingUp = enemyData.attack_state === 'winding_up'; const scaleTarget = isWindingUp ? 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05 : 1.0; bodyMesh.scale.lerp(_vector3.set(scaleTarget, scaleTarget, scaleTarget), 0.2); }
}
function _updatePowerupGroup(group, powerupData, deltaTime) { // Uses mapping
     if (!group?.userData || !clock) return;
     mapServerToWorld(powerupData.x, powerupData.y, group.position); // Update position using mapping
     const iconMesh = group.userData.iconMesh; if (iconMesh) { const bobOffset = (parseInt(group.userData.gameId, 16) % 100) / 100.0 * Math.PI * 2; iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + bobOffset) * 4; iconMesh.rotation.y += 0.015; }
}
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) { // Uses mapping
    if (!mesh) return; if (!state || Object.keys(state).length === 0) { mesh.count = 0; mesh.instanceMatrix.needsUpdate = true; return; } let visibleCount = 0; const maxCount = matrices.length / 16;
    for (const id in state) { if (visibleCount >= maxCount) { console.warn(`Renderer: Exceeded max instances (${maxCount}) for mesh ${mesh.name}.`); break; } const data = state[id]; if (isBullet) { const isPlayerBullet = data.owner_type === 'player'; if (mesh === playerBulletMesh && !isPlayerBullet) continue; if (mesh === enemyBulletMesh && isPlayerBullet) continue; } if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;
    mapServerToWorld(data.x, data.y, _position); // Get world position using mapping
    _position.y = yOffset; // Apply vertical offset
    if (isBullet && data.vx !== undefined && data.vy !== undefined && (data.vx !== 0 || data.vy !== 0)) { const angle = Math.atan2(data.vx, data.vy); _quaternion.setFromEuler(new THREE.Euler(0, angle, 0)); } else { _quaternion.identity(); } _scale.set(1, 1, 1); _matrix.compose(_position, _quaternion, _scale); mesh.setMatrixAt(visibleCount, _matrix); visibleCount++; } mesh.count = visibleCount; mesh.instanceMatrix.needsUpdate = true;
}
function _updateActiveCasings(deltaTime) { /* ... unchanged ... */ if (!ammoCasingMesh || !clock) return; if (activeAmmoCasings.length === 0) { if (ammoCasingMesh.count > 0) { ammoCasingMesh.count = 0; ammoCasingMesh.instanceMatrix.needsUpdate = true; } return; } const now = clock.elapsedTime; let needsUpdate = false; activeAmmoCasings = activeAmmoCasings.filter(casing => { if (now > casing.endTime) return false; casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime; casing.position.addScaledVector(casing.velocity, deltaTime); casing.rotation += casing.rotationSpeed * deltaTime; if (casing.position.y <= Y_OFFSET_CASING) { casing.position.y = Y_OFFSET_CASING; casing.velocity.y *= -AMMO_CASING_BOUNCE; casing.velocity.x *= (1.0 - AMMO_CASING_DRAG); casing.velocity.z *= (1.0 - AMMO_CASING_DRAG); casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0); if (Math.abs(casing.velocity.y) < 5) casing.velocity.y = 0; if(Math.abs(casing.rotationSpeed) < 0.1) casing.rotationSpeed = 0; } return true; }); let visibleCount = 0; const maxCount = ammoCasingMesh.instanceMatrix.array.length / 16; for (let i = 0; i < activeAmmoCasings.length; i++) { if (visibleCount >= maxCount) break; const casing = activeAmmoCasings[i]; _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0)); _matrix.compose(casing.position, _quaternion, _scale); ammoCasingMesh.setMatrixAt(visibleCount, _matrix); visibleCount++; needsUpdate = true; } if (ammoCasingMesh.count !== visibleCount) { ammoCasingMesh.count = visibleCount; needsUpdate = true; } if (needsUpdate) { ammoCasingMesh.instanceMatrix.needsUpdate = true; } }
function _spawnAmmoCasing(position, ejectVector) { // Input position is server-style x,y
    if (!ammoCasingMesh || !clock || activeAmmoCasings.length >= MAX_AMMO_CASINGS) return; const now = clock.elapsedTime; const life = 1.5 + Math.random() * 1.0; const ejectAngle = Math.atan2(ejectVector.z, ejectVector.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5; const ejectSpeed = 150 + Math.random() * 80; const upSpeed = 50 + Math.random() * 40; const rotationSpeed = (Math.random() - 0.5) * 20;
    mapServerToWorld(position.x, position.y, _vector3_B); // Convert spawn center to world coords
    const spawnOffsetX = Math.cos(ejectAngle) * 5; const spawnOffsetZ = Math.sin(ejectAngle) * 5; const spawnY = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT * 0.6; // Approx gun height in world
    activeAmmoCasings.push({ position: new THREE.Vector3(_vector3_B.x + spawnOffsetX, spawnY, _vector3_B.z + spawnOffsetZ ), velocity: new THREE.Vector3( Math.cos(ejectAngle) * ejectSpeed, upSpeed, Math.sin(ejectAngle) * ejectSpeed ), rotation: Math.random() * Math.PI * 2, rotationSpeed: rotationSpeed, startTime: now, endTime: now + life });
}
function _updateHitSparks(deltaTime) { /* ... unchanged ... */ if (!hitSparkSystem || !clock) return; const positions = hitSparkSystem.geometry.attributes.position.array; const colors = hitSparkSystem.geometry.attributes.color.array; const alphas = hitSparkSystem.geometry.attributes.alpha.array; const data = hitSparkSystem.data; let needsGeomUpdate = false; let activeCount = 0; for (let i = 0; i < MAX_HIT_SPARKS; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; activeCount++; if (p.l <= 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; } else { p.v.y -= HIT_SPARK_GRAVITY * deltaTime; p.p.addScaledVector(p.v, deltaTime); p.a = Math.min(1.0, Math.max(0, (p.l / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5)); alphas[i] = p.a; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b; } needsGeomUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0.0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true; } } if (needsGeomUpdate) { hitSparkSystem.geometry.attributes.position.needsUpdate = true; hitSparkSystem.geometry.attributes.color.needsUpdate = true; hitSparkSystem.geometry.attributes.alpha.needsUpdate = true; } hitSparkSystem.particles.visible = activeCount > 0; }
function _triggerHitSparks(position, count = 5) { // Input position is world coords
    if (!hitSparkSystem || !clock) return; const data = hitSparkSystem.data; let spawned = 0; for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) { if (data[i].l <= 0) { const p = data[i]; p.p.copy(position); const angle = Math.random() * Math.PI * 2; const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD; p.v.set(Math.cos(angle) * Math.cos(spreadAngle) * speed, Math.sin(spreadAngle) * speed * 1.5 + 30, Math.sin(angle) * Math.cos(spreadAngle) * speed); p.c.setRGB(1, 0.2 + Math.random() * 0.3, 0); p.a = 1.0; p.l = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE; spawned++; } } if (spawned > 0) hitSparkSystem.particles.visible = true;
}
function _updateRain(deltaTime) { // Uses fixed world size
    if (!rainSystem || !rainSystem.lines.visible) { return; } const positions = rainSystem.geometry.attributes.position.array; const data = rainSystem.data; let needsUpdate = false; for (let i = 0; i < MAX_RAIN_DROPS; i++) { const p = data[i]; p.y += p.s * deltaTime; if (p.y < -50) { p.x = Math.random() * worldWidth; p.y = Math.random() * 500 + 1000; p.z = Math.random() * worldHeight; p.s = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND; } const idx = i * 6; positions[idx + 0] = p.x; positions[idx + 1] = p.y; positions[idx + 2] = p.z; positions[idx + 3] = p.x; positions[idx + 4] = p.y - RAIN_STREAK_LENGTH; positions[idx + 5] = p.z; needsUpdate = true; } if (needsUpdate) rainSystem.geometry.attributes.position.needsUpdate = true;
}
function _updateDust(deltaTime) { // Uses fixed world size
     if (!dustSystem || !dustSystem.particles.visible || !camera) { return; } const positions = dustSystem.geometry.attributes.position.array; const data = dustSystem.data; let needsUpdate = false; for (let i = 0; i < MAX_DUST_MOTES; i++) { const p = data[i]; p.p.addScaledVector(p.v, deltaTime); if (p.p.x < 0) p.p.x += worldWidth; else if (p.p.x > worldWidth) p.p.x -= worldWidth; if (p.p.z < 0) p.p.z += worldHeight; else if (p.p.z > worldHeight) p.p.z -= worldHeight; p.p.y += (Math.random() - 0.5) * DUST_SPEED_Y * deltaTime; p.p.y = Math.max(5, Math.min(80, p.p.y)); positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z; needsUpdate = true; } if (needsUpdate) dustSystem.geometry.attributes.position.needsUpdate = true;
}
function _updateCampfireFlames(deltaTime) { /* ... unchanged ... */ if (!campfireSystem || !campfireSystem.group.visible || !clock) return; const positions = campfireSystem.flameGeometry.attributes.position.array; const colors = campfireSystem.flameGeometry.attributes.color.array; const sizes = campfireSystem.flameGeometry.attributes.size.array; const data = campfireSystem.flameData; let needsGeomUpdate = false; let activeCount = 0; const spawnRate = 150; const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random())); let spawned = 0; for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) { if (data[i].l <= 0) { const p = data[i]; const angle = Math.random() * Math.PI * 2; const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.8; p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 2, Math.sin(angle) * radius); p.v.set((Math.random() - 0.5) * FLAME_VEL_SPREAD, FLAME_VEL_Y + Math.random() * 30, (Math.random() - 0.5) * FLAME_VEL_SPREAD); p.l = p.bl; p.s = FLAME_SIZE_START; p.c.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); spawned++; } } for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; activeCount++; if (p.l <= 0) { sizes[i] = 0; positions[i * 3 + 1] = -10000; } else { p.v.y += (Math.random() - 0.4) * 20 * deltaTime; p.v.x *= 0.97; p.v.z *= 0.97; p.p.addScaledVector(p.v, deltaTime); const lifeRatio = Math.max(0, p.l / p.bl); p.s = lerp(FLAME_SIZE_END, FLAME_SIZE_START, lifeRatio); p.c.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); sizes[i] = p.s; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b; } needsGeomUpdate = true; } else if (sizes[i] > 0) { sizes[i] = 0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true; } } if (needsGeomUpdate) { campfireSystem.flameGeometry.attributes.position.needsUpdate = true; campfireSystem.flameGeometry.attributes.color.needsUpdate = true; campfireSystem.flameGeometry.attributes.size.needsUpdate = true; } campfireSystem.flameParticles.visible = activeCount > 0; }
function _updateCampfireSmoke(deltaTime) { /* ... unchanged ... */ if (!campfireSystem || !campfireSystem.group.visible || !clock) return; const positions = campfireSystem.smokeGeometry.attributes.position.array; const alphas = campfireSystem.smokeGeometry.attributes.alpha.array; const sizes = campfireSystem.smokeGeometry.attributes.size.array; const data = campfireSystem.smokeData; let needsGeomUpdate = false; let activeCount = 0; const spawnRate = 80; const numToSpawn = Math.floor(spawnRate * deltaTime * (0.6 + Math.random())); let spawned = 0; for (let i = 0; i < MAX_SMOKE_PARTICLES && spawned < numToSpawn; i++) { if (data[i].l <= 0) { const p = data[i]; const angle = Math.random() * Math.PI * 2; const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.6; p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 5, Math.sin(angle) * radius); p.v.set((Math.random() - 0.5) * SMOKE_VEL_SPREAD, SMOKE_VEL_Y + Math.random() * 15, (Math.random() - 0.5) * SMOKE_VEL_SPREAD); p.l = p.bl; p.s = SMOKE_SIZE_START; p.a = SMOKE_OPACITY_START * (0.8 + Math.random() * 0.4); spawned++; } } for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) { const p = data[i]; if (p.l > 0) { p.l -= deltaTime; activeCount++; if (p.l <= 0) { alphas[i] = 0.0; sizes[i] = 0; positions[i * 3 + 1] = -10000; } else { p.v.y += (Math.random() - 0.45) * 5 * deltaTime; p.v.x += (Math.random() - 0.5) * 8 * deltaTime; p.v.z += (Math.random() - 0.5) * 8 * deltaTime; p.v.multiplyScalar(0.98); p.p.addScaledVector(p.v, deltaTime); const lifeRatio = Math.max(0, p.l / p.bl); p.s = lerp(SMOKE_SIZE_END, SMOKE_SIZE_START, lifeRatio); p.a = lerp(SMOKE_OPACITY_END, SMOKE_OPACITY_START, lifeRatio * lifeRatio); sizes[i] = p.s; alphas[i] = p.a; positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z; } needsGeomUpdate = true; } else if (alphas[i] > 0) { alphas[i] = 0.0; sizes[i] = 0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true; } } if (needsGeomUpdate) { campfireSystem.smokeGeometry.attributes.position.needsUpdate = true; campfireSystem.smokeGeometry.attributes.alpha.needsUpdate = true; campfireSystem.smokeGeometry.attributes.size.needsUpdate = true; } campfireSystem.smokeParticles.visible = activeCount > 0; }
function _updateCampfire(deltaTime) { // Uses mapping
    if (!campfireSystem || !clock) return; const cfData = window.appState?.serverState?.campfire; const isActive = cfData?.active ?? false; campfireSystem.group.visible = isActive; if (isActive) {
    mapServerToWorld(cfData.x, cfData.y, campfireSystem.group.position); // Update position using mapping
    if (campfireSystem.glowLight) { campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0 + Math.random()*0.5) * 0.8; } _updateCampfireFlames(deltaTime); _updateCampfireSmoke(deltaTime); } else { campfireSystem.flameParticles.visible = false; campfireSystem.smokeParticles.visible = false; if (campfireSystem.glowLight) campfireSystem.glowLight.intensity = 0; }
}
function _updateSnake(snakeData) { // Uses mapping
    if (!snakeMesh) { return; } const isActive = snakeData?.active ?? false; snakeMesh.visible = isActive; if (isActive && snakeData.segments && snakeData.segments.length > 1) {
    const points = snakeData.segments.map(seg => { mapServerToWorld(seg.x, seg.y, _vector3_B); return _vector3_B.clone().setY(Y_OFFSET_SNAKE); }); // Map each segment
    if (points.length >= 2) { try { const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1); const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2); if(tubePoints.length >= 2) { const newGeometry = new THREE.TubeGeometry( new THREE.CatmullRomCurve3(tubePoints), tubePoints.length - 1, SNAKE_RADIUS, 6, false ); snakeMesh.geometry.dispose(); snakeMesh.geometry = newGeometry; snakeMesh.visible = true; } else snakeMesh.visible = false; } catch(e) { console.error("Renderer Error updating snake geometry:", e); snakeMesh.visible = false; } } else snakeMesh.visible = false; } else { snakeMesh.visible = false; }
}
function _updateEnvironment(isNight, isRaining, isDustStorm) { /* ... unchanged ... */ if (!scene || !ambientLight || !directionalLight || !groundPlane || !clock) return; const dayAI = 0.7, nightAI = 0.45; const dayDI = 1.2, nightDI = 0.7; const dayAC = 0xffffff, nightAC = 0x7080a0; const dayDC = 0xffffff, nightDC = 0xa0b0ff; const dayFogC = 0xc0d0e0, dayFogD = 0.0003; const nightFogC = 0x04060a, nightFogD = 0.0008; const dustFogC = 0xb09070, dustFogD = 0.0015; const targetAI = isNight ? nightAI : dayAI; const targetDI = isNight ? nightDI : dayDI; const targetAC = isNight ? nightAC : dayAC; const targetDC = isNight ? nightDC : dayDC; const targetGM = isNight ? sharedMaterials.groundNight : sharedMaterials.groundDay; let targetFD, targetFC; if(isDustStorm){targetFD=dustFogD;targetFC=dustFogC;}else if(isNight){targetFD=nightFogD;targetFC=nightFogC;}else{targetFD=dayFogD;targetFC=dayFogC;} const lerpA=0.05; ambientLight.intensity=lerp(ambientLight.intensity, targetAI, lerpA); directionalLight.intensity=lerp(directionalLight.intensity, targetDI, lerpA); ambientLight.color.lerp(_color.setHex(targetAC), lerpA); directionalLight.color.lerp(_color.setHex(targetDC), lerpA); if (groundPlane.material !== targetGM) groundPlane.material = targetGM; if (!scene.fog) scene.fog = new THREE.FogExp2(targetFC, targetFD); else { scene.fog.color.lerp(_color.setHex(targetFC), lerpA); scene.fog.density = lerp(scene.fog.density, targetFD, lerpA); } if (!scene.background || !(scene.background instanceof THREE.Color)) scene.background = new THREE.Color(); scene.background.lerp(_color.setHex(targetFC), lerpA); if (rainSystem?.lines) rainSystem.lines.visible = isRaining; if (dustSystem?.particles) dustSystem.particles.visible = isDustStorm; }
function _updateMuzzleFlash(localEffects, playerGroup) { /* ... unchanged ... */ if (!muzzleFlashLight || !clock) return; const flashState = localEffects?.muzzleFlash; const nowMs = clock.elapsedTime * 1000; if (flashState?.active && nowMs < flashState.endTime && playerGroup) { muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; const gunMesh = playerGroup.userData.gunMesh; if (gunMesh) { _vector3.set(0, 0, PLAYER_GUN_LENGTH / 2 + 5); gunMesh.localToWorld(_vector3); muzzleFlashLight.position.copy(_vector3); } else { muzzleFlashLight.intensity = 0; } } else { muzzleFlashLight.intensity = 0; if (flashState) flashState.active = false; } }
function _projectToScreen(worldPosition) { /* ... unchanged ... */ if (!camera || !renderer?.domElement || !domContainer) return null; try { _vector3.copy(worldPosition); _vector3.project(camera); if (_vector3.z > 1.0) return null; const rect = domContainer.getBoundingClientRect(); const widthHalf = rect.width / 2; const heightHalf = rect.height / 2; const screenX = Math.round((_vector3.x * widthHalf) + widthHalf); const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); return { screenX, screenY }; } catch (e) { console.warn("Renderer: _projectToScreen error:", e); return null; } }
function _updateCamera(deltaTime, localPlayerGroup) { // Uses localPlayerGroup world position
    if (!camera || !clock) return; let targetX, targetZ;
    if (localPlayerGroup && localPlayerGroup.visible) { // Use the group's world position (already mapped)
        targetX = localPlayerGroup.position.x; targetZ = localPlayerGroup.position.z;
    } else { targetX = worldWidth / 2; targetZ = worldHeight / 2; } // Fallback to fixed world center
    _cameraTargetWorldPos.set(targetX, 0, targetZ); _cameraDesiredPos.set(targetX, CAMERA_HEIGHT_OFFSET, targetZ + CAMERA_DISTANCE_OFFSET); camera.position.lerp(_cameraDesiredPos, CAMERA_LERP_FACTOR); const nowMs = clock.elapsedTime * 1000; if (shakeMagnitude > 0 && nowMs < shakeEndTime) { const timeRemaining = shakeEndTime - nowMs; const totalDuration = shakeEndTime - (nowMs - deltaTime * 1000); const decayFactor = totalDuration > 0 ? Math.pow(Math.max(0, timeRemaining / totalDuration), 2) : 0; const currentMag = shakeMagnitude * decayFactor; const shakeAngle = Math.random() * Math.PI * 2; screenShakeOffset.set(Math.cos(shakeAngle) * currentMag, (Math.random() - 0.5) * currentMag * 0.5, Math.sin(shakeAngle) * currentMag); camera.position.add(screenShakeOffset); } else { shakeMagnitude = 0; } camera.lookAt(_cameraTargetWorldPos);
}

// --- Public API ---
const Renderer3D = {
    init: (containerElement, initialWorldWidth, initialWorldHeight) => { // Accepts fixed world size
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;
        worldWidth = initialWorldWidth || DEFAULT_WORLD_WIDTH; // Use passed in or default
        worldHeight = initialWorldHeight || DEFAULT_WORLD_HEIGHT;
        _worldCenter.set(worldWidth / 2, 0, worldHeight / 2);
        currentCanvasWidth = domContainer.clientWidth || worldWidth; // Initial canvas size
        currentCanvasHeight = domContainer.clientHeight || worldHeight;

        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(currentCanvasWidth, currentCanvasHeight);
            renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
            domContainer.appendChild(renderer.domElement);
            scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2a28);
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, currentCanvasWidth / currentCanvasHeight, CAMERA_NEAR, CAMERA_FAR);
            camera.position.set(_worldCenter.x, CAMERA_HEIGHT_OFFSET, _worldCenter.z + CAMERA_DISTANCE_OFFSET);
            camera.lookAt(_worldCenter); scene.add(camera);
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(_worldCenter.x + worldWidth * 0.1, 400, _worldCenter.z + worldHeight * 0.2); // Position relative to fixed world center
            directionalLight.castShadow = true; directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048; directionalLight.shadow.bias = -0.002;
            const shadowCamSizeX = worldWidth * 0.6; const shadowCamSizeZ = worldHeight * 0.6; directionalLight.shadow.camera.near = 150; directionalLight.shadow.camera.far = 800; directionalLight.shadow.camera.left = -shadowCamSizeX; directionalLight.shadow.camera.right = shadowCamSizeX; directionalLight.shadow.camera.top = shadowCamSizeZ; directionalLight.shadow.camera.bottom = -shadowCamSizeZ; // Set shadow bounds based on fixed world
            directionalLight.target.position.copy(_worldCenter); scene.add(directionalLight); scene.add(directionalLight.target);
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);
            _createAssets(); _createGeometries(); _createMaterials();
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.scale.set(worldWidth, worldHeight, 1); // Scale to fixed world size
            groundPlane.rotation.x = -Math.PI / 2; groundPlane.position.copy(_worldCenter); // Center it
            groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane"; scene.add(groundPlane);
            _createBoundaries(); // Creates boundaries based on fixed world size
            _initParticlesAndInstances(); // Uses fixed world size for initial placement
            _initCampfire(); _initSnake(); clock = new THREE.Clock();
            Renderer3D.handleContainerResize(); // Initial resize only adjusts viewport/aspect
            setTimeout(() => Renderer3D.handleContainerResize(), 150);
        } catch (error) { console.error("Renderer Init Error:", error); Renderer3D.cleanup(); return false; }
        console.log("--- Renderer3D initialization complete ---"); return true;
    },
    handleContainerResize: () => { // Only updates aspect/viewport now
        if (!renderer || !camera || !domContainer) return;
        const newWidth = domContainer.clientWidth; const newHeight = domContainer.clientHeight;
        if (newWidth <= 0 || newHeight <= 0 || (newWidth === currentCanvasWidth && newHeight === currentCanvasHeight)) { return; }
        currentCanvasWidth = newWidth; currentCanvasHeight = newHeight;
        renderer.setSize(newWidth, newHeight); renderer.setViewport(0, 0, newWidth, newHeight); renderer.setScissor(0, 0, newWidth, newHeight); renderer.setScissorTest(true);
        camera.aspect = newWidth / newHeight; camera.updateProjectionMatrix(); camera.clearViewOffset();
        // console.log(`Renderer: Resize Handled - Canvas: ${currentCanvasWidth}x${currentCanvasHeight}`); // Keep for debug if needed
        if (window.appState) { window.appState.canvasWidth = currentCanvasWidth; window.appState.canvasHeight = currentCanvasHeight; }
    },
    renderScene: (stateToRender, appState, localEffects) => { // stateToRender uses server coords
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) { return; }
        const deltaTime = clock.getDelta();
        // Update world size from appState ONLY if it differs (unlikely now but good practice)
        if (appState.worldWidth !== worldWidth || appState.worldHeight !== worldHeight) {
             console.warn(`World dimensions changed in appState! Renderer might need re-init or update logic.`);
             // #TODO: Potentially update ground scale, boundary positions etc. here if world size CAN change mid-game
        }
        const localPlayerGroup = appState.localPlayerId ? playerGroupMap[appState.localPlayerId] : null;
        _updateCamera(deltaTime, localPlayerGroup); // Follows the group's world position
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateActiveCasings(deltaTime); _updateHitSparks(deltaTime); _updateRain(deltaTime); _updateDust(deltaTime); _updateCampfire(deltaTime); _updateSnake(stateToRender.snake_state); _updateMuzzleFlash(localEffects, localPlayerGroup);
        const uiPositions = {}; const projectEntity = (objMap, stateMap, yOffsetFn) => { for(const id in objMap){const o=objMap[id],d=stateMap?.[id];if(o?.visible&&d){const w=o.position.clone();w.y=yOffsetFn(d,o);const s=_projectToScreen(w);if(s)uiPositions[id]=s}} }; const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y+PLAYER_HEAD_RADIUS*1.5||PLAYER_TOTAL_HEIGHT; const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y+(d.type==='giant'?ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER:ENEMY_HEAD_RADIUS)*1.2||ENEMY_CHASER_HEIGHT; const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y+POWERUP_BASE_SIZE*.5||Y_OFFSET_POWERUP; projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY); projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY); projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);
        if (stateToRender.damage_texts) { for(const id in stateToRender.damage_texts){ const dt=stateToRender.damage_texts[id]; mapServerToWorld(dt.x, dt.y, _vector3_B); _vector3_B.y = PLAYER_TOTAL_HEIGHT * 0.8; const s=_projectToScreen(_vector3_B); if(s)uiPositions[id]=s} } // Map damage text coords
        appState.uiPositions = uiPositions;
        try { renderer.setScissorTest(true); renderer.render(scene, camera); } catch (e) { console.error("!!! RENDER ERROR !!!", e); if (window.appState?.animationFrameId) { cancelAnimationFrame(window.appState.animationFrameId); window.appState.animationFrameId = null; console.error("!!! Animation loop stopped due to render error. !!!"); } }
    },
    triggerShake: (magnitude, durationMs) => { if (!clock) return; const nowMs = clock.elapsedTime * 1000; const newEndTime = nowMs + durationMs; if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) { shakeMagnitude = Math.max(0.1, magnitude); shakeEndTime = Math.max(nowMs, newEndTime); } },
    spawnVisualAmmoCasing: (position, ejectVector) => { if (!clock) return; _spawnAmmoCasing(position, ejectVector); }, // Expects server-style position
    triggerVisualHitSparks: (position, count = 5) => { if (!clock) return; _triggerHitSparks(position, count); }, // Expects world position
    projectToScreen: (worldPosition) => { return _projectToScreen(worldPosition); },
    mapServerToWorld: (serverX, serverY, targetVector = _vector3_B) => { mapServerToWorld(serverX, serverY, targetVector); return targetVector; }, // Expose mapping utility
    mapWorldToServer: (worldVector) => mapWorldToServer(worldVector), // Expose mapping utility
    cleanup: () => { /* ... unchanged cleanup logic from v3.4 ... */ console.log("--- Renderer3D Cleanup ---"); try { [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(system => { if (system) { if (system.particles) scene?.remove(system.particles); if (system.lines) scene?.remove(system.lines); if (system.group) scene?.remove(system.group); system.geometry?.dispose(); if(system.flameGeometry) system.flameGeometry.dispose(); if(system.smokeGeometry) system.smokeGeometry.dispose(); _disposeMaterialTextures(system.material); system.material?.dispose(); if(system.flameMaterial){_disposeMaterialTextures(system.flameMaterial); system.flameMaterial.dispose();} if(system.smokeMaterial){_disposeMaterialTextures(system.smokeMaterial); system.smokeMaterial.dispose();}} }); } catch(e){error("Cleanup particles error:",e);} hitSparkSystem=null;rainSystem=null;dustSystem=null;campfireSystem=null; try { [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(mesh => { if (mesh) { scene?.remove(mesh); mesh.geometry?.dispose(); } }); } catch(e){error("Cleanup instanced mesh error:",e);} playerBulletMesh=null;enemyBulletMesh=null;ammoCasingMesh=null; try { if(snakeMesh){scene?.remove(snakeMesh);snakeMesh.geometry?.dispose();snakeMesh=null} } catch(e){error("Cleanup snake error:",e);} try { if(boundariesGroup){scene?.remove(boundariesGroup);_disposeObject3D(boundariesGroup);boundariesGroup=null;} } catch(e){error("Cleanup boundaries error:",e);} try { [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(objectMap => { for (const id in objectMap) { _handleObjectRemoval(objectMap[id], id, objectMap); } }); } catch(e){error("Cleanup dynamic objects error:",e);} try { Object.values(sharedGeometries).forEach(g => g?.dispose()); Object.values(powerupGeometries).forEach(g => g?.dispose()); Object.values(sharedMaterials).forEach(m => { if (m instanceof THREE.Material) { _disposeMaterialTextures(m); m.dispose(); } }); if (sharedMaterials.powerups) Object.values(sharedMaterials.powerups).forEach(m => { if (m instanceof THREE.Material) { _disposeMaterialTextures(m); m.dispose(); } }); Object.values(loadedAssets).forEach(a => a?.dispose()); } catch(e){error("Cleanup shared resources error:",e);} Object.keys(sharedGeometries).forEach(k=>delete sharedGeometries[k]); Object.keys(sharedMaterials).forEach(k=>{if(k!=='powerups')delete sharedMaterials[k];else delete sharedMaterials.powerups;}); Object.keys(powerupGeometries).forEach(k=>delete powerupGeometries[k]); Object.keys(loadedAssets).forEach(k=>delete loadedAssets[k]); try { if(groundPlane){scene?.remove(groundPlane);_disposeObject3D(groundPlane);groundPlane=null} } catch(e){error("Cleanup ground error:",e);} try { if (scene) { if (ambientLight) scene.remove(ambientLight); if (directionalLight) scene.remove(directionalLight); if (directionalLight?.target) scene.remove(directionalLight.target); if (muzzleFlashLight) scene.remove(muzzleFlashLight); } } catch(e){error("Cleanup lights error:",e);} ambientLight=null;directionalLight=null;muzzleFlashLight=null; try { if(renderer){console.log("Renderer: Disposing WebGL context...");renderer.dispose();if(renderer.domElement?.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);renderer=null;console.log("Renderer disposed.")} } catch(e){error("Cleanup renderer error:",e);} scene=null;camera=null;clock=null;domContainer=null;playerBulletMatrices=[];enemyBulletMatrices=[];activeAmmoCasings=[];shakeMagnitude=0;shakeEndTime=0; console.log("Renderer3D resources released."); },
    getCamera: () => camera, getGroundPlane: () => groundPlane, getScene: () => scene,
};
export default Renderer3D;
