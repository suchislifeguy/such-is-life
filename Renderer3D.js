// Renderer3D.js
// Rewritten Version: Advanced renderer for Kelly Gang Survival.
// Focus on robust resizing, camera alignment, and resource management.
// Includes: Instancing, Particle Effects, Detailed Models, Environment Effects.
// HashCode Fix Applied. Added Dimension Logging + clearViewOffset.

import * as THREE from 'three';

// --- Utility Functions ---
/** Linearly interpolates between two values. */
function lerp(start, end, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return start + (end - start) * t;
}

// --- Constants ---
// Initial default dimensions, primarily for fallback before first resize.
const DEFAULT_GAME_WIDTH = 1600; const DEFAULT_GAME_HEIGHT = 900;
const CAMERA_FOV = 60; const CAMERA_NEAR = 10; const CAMERA_FAR = 2500;
const CAMERA_BASE_Y = 950; const CAMERA_ANGLE = -Math.PI / 2.7; const CAMERA_LERP_FACTOR = 0.08;
const GROUND_MARGIN = 1.2; // How much larger the ground plane is than the logical game area

// Instancing & Particle Limits
const MAX_PLAYER_BULLETS = 500; const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150; const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000; const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80;

// Entity Visual Properties
const PLAYER_CAPSULE_RADIUS = 12; const PLAYER_CAPSULE_HEIGHT = 24;
const PLAYER_TOTAL_HEIGHT = PLAYER_CAPSULE_HEIGHT + PLAYER_CAPSULE_RADIUS * 2; // Approx visual height
const PLAYER_HEAD_RADIUS = 10; const PLAYER_GUN_LENGTH = 25; const PLAYER_GUN_RADIUS = 2;
const ENEMY_CHASER_WIDTH = 20; const ENEMY_CHASER_HEIGHT = 40; const ENEMY_CHASER_DEPTH = 14;
const ENEMY_SHOOTER_RADIUS = 12; const ENEMY_SHOOTER_HEIGHT = 45;
const ENEMY_GUN_LENGTH = 25; const ENEMY_GUN_RADIUS = 2.5; const ENEMY_GIANT_MULTIPLIER = 2.5;
const ENEMY_HEAD_RADIUS = 8; const POWERUP_BASE_SIZE = 18;
const BULLET_BASE_RADIUS = 2.5; const BULLET_LENGTH = 15;
const CAMPFIRE_LOG_RADIUS = 5; const CAMPFIRE_LOG_LENGTH = 40; const CAMPFIRE_BASE_RADIUS = 25;
const SNAKE_VISUAL_SEGMENTS = 40; const SNAKE_RADIUS = 6;

// Particle Physics & Appearance
const AMMO_CASING_RADIUS = 0.6; const AMMO_CASING_LENGTH = 3.5;
const AMMO_CASING_GRAVITY = 980; const AMMO_CASING_BOUNCE = 0.3; const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500; const HIT_SPARK_BASE_LIFE = 0.2; const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150; const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.6; const FLAME_RAND_LIFE = 0.5; const FLAME_VEL_Y = 60; const FLAME_VEL_SPREAD = 25;
const RAIN_SPEED_Y = -500; const RAIN_SPEED_Y_RAND = -200; const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40; const DUST_SPEED_Y = 8; const DUST_OPACITY = 0.15;

// Misc Timing & State
const FADE_OUT_DURATION = 0.35; // Seconds for enemies/objects to fade on removal
const PLAYER_STATUS_ALIVE = 'alive'; const PLAYER_STATUS_DOWN = 'down'; const PLAYER_STATUS_DEAD = 'dead';

// Y-Offsets for placing objects correctly on the ground plane
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS; // Base of capsule touches ground
const Y_OFFSET_ENEMY_BODY = 0; // Assuming enemy origin is at their base
const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7; // Center vertically
const Y_OFFSET_BULLET = 10; // Visual height above ground for bullets
const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS; // Bottom of logs touch ground
const Y_OFFSET_SNAKE = SNAKE_RADIUS; // Center of snake tube height
const Y_OFFSET_CASING = AMMO_CASING_RADIUS; // Bottom of casing touches ground

// --- Module Scope Variables ---
let renderer, scene, camera, clock;
let ambientLight, directionalLight;
let domContainer; // The HTML element containing the canvas
// --- Dynamic Dimensions ---
// These are updated ONLY by handleContainerResize to reflect the actual canvas size
let gameWidth = DEFAULT_GAME_WIDTH;
let gameHeight = DEFAULT_GAME_HEIGHT;
// The desired center point for the camera view, calculated from gameWidth/gameHeight
let cameraTargetPos = new THREE.Vector3(DEFAULT_GAME_WIDTH / 2, 0, DEFAULT_GAME_HEIGHT / 2);
// --- Scene Objects ---
let groundPlane = null;
const playerGroupMap = {}; // { id: THREE.Group }
const enemyGroupMap = {}; // { id: THREE.Group }
const powerupGroupMap = {}; // { id: THREE.Group }
// Instanced Meshes
let playerBulletMesh = null; let playerBulletMatrices = [];
let enemyBulletMesh = null; let enemyBulletMatrices = [];
let ammoCasingMesh = null; let activeAmmoCasings = []; // { position, velocity, rotation, rotationSpeed, startTime, endTime }
// Particle Systems
let hitSparkSystem = null; // { particles, geometry, material, data: [{ p, v, c, a, l }] }
let rainSystem = null; // { lines, geometry, material, data: [{ x, y, z, s }] }
let dustSystem = null; // { particles, geometry, material, data: [{ p, v }] }
let campfireSystem = null; // { group, particles, geometry, material, glowLight, data: [{ p, v, c, a, l, bl }] }
let snakeMesh = null; // The visual tube mesh for the snake
// Effects
let muzzleFlashLight = null;
let screenShakeOffset = new THREE.Vector3(0, 0, 0); // Current camera offset due to shake
let shakeMagnitude = 0; // Max intensity of current shake
let shakeEndTime = 0; // Timestamp (ms) when shake effect should end
// Shared Resources (populated by _create* functions)
const sharedGeometries = {};
const sharedMaterials = {};
const powerupGeometries = {};
const loadedAssets = {}; // For textures, etc.
// Reusable THREE objects to avoid allocations in loops
const _dummyObject = new THREE.Object3D(); // For getMatrixAt/setMatrixAt
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();
const _vector3 = new THREE.Vector3(); // General purpose temporary vector

// --- Internal Helper Functions Defined First ---

// Creates procedural assets like textures if needed
function _createAssets() {
    console.log("Renderer: Creating assets...");
    try {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext('2d'); if (!context) throw new Error("Failed to get 2D context for flame texture");
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0,'rgba(255,220,150,1)'); gradient.addColorStop(0.4,'rgba(255,150,0,0.8)'); gradient.addColorStop(1,'rgba(200,0,0,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
        loadedAssets.flameTexture = new THREE.CanvasTexture(canvas); loadedAssets.flameTexture.name = "FlameTexture";
    } catch (error) { console.error("Renderer Error creating flame texture:", error); }
}

// Creates shared geometries to be reused by multiple meshes/instances
function _createGeometries() {
    console.log("Renderer: Creating geometries...");
    // Player
    sharedGeometries.playerBody = new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HEIGHT, 4, 12);
    sharedGeometries.head = new THREE.SphereGeometry(1, 12, 8); // Base sphere, scaled later
    sharedGeometries.playerGun = new THREE.CylinderGeometry(PLAYER_GUN_RADIUS, PLAYER_GUN_RADIUS * 0.8, PLAYER_GUN_LENGTH, 8);
    // Enemies
    sharedGeometries.enemyChaserBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH, ENEMY_CHASER_HEIGHT, ENEMY_CHASER_DEPTH);
    sharedGeometries.enemyShooterBody = new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_HEIGHT, 10);
    sharedGeometries.enemyGiantBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_DEPTH * ENEMY_GIANT_MULTIPLIER);
    sharedGeometries.enemyGun = new THREE.CylinderGeometry(ENEMY_GUN_RADIUS, ENEMY_GUN_RADIUS * 0.7, ENEMY_GUN_LENGTH, 8);
    // Bullets & Casings
    sharedGeometries.bullet = new THREE.CylinderGeometry(BULLET_BASE_RADIUS, BULLET_BASE_RADIUS*0.8, BULLET_LENGTH, 8);
    sharedGeometries.bullet.rotateX(Math.PI / 2); // Align with Z forward
    sharedGeometries.ammoCasing = new THREE.CylinderGeometry(AMMO_CASING_RADIUS, AMMO_CASING_RADIUS, AMMO_CASING_LENGTH, 6);
    // Powerups (specific geometries per type)
    const ps = POWERUP_BASE_SIZE; // Alias for readability
    powerupGeometries.health = new THREE.TorusGeometry(ps * 0.4, ps * 0.15, 8, 16);
    powerupGeometries.gun_upgrade = new THREE.ConeGeometry(ps * 0.45, ps * 0.9, 4);
    powerupGeometries.speed_boost = new THREE.CylinderGeometry(ps * 0.6, ps * 0.6, ps * 0.25, 16);
    powerupGeometries.armor = new THREE.OctahedronGeometry(ps * 0.6, 0);
    powerupGeometries.ammo_shotgun = new THREE.BoxGeometry(ps * 0.8, ps * 0.8, ps * 0.8);
    powerupGeometries.ammo_heavy_slug = new THREE.SphereGeometry(ps * 0.6, 12, 8);
    powerupGeometries.ammo_rapid_fire = new THREE.TorusGeometry(ps * 0.4, ps * 0.1, 6, 12);
    powerupGeometries.bonus_score = new THREE.CylinderGeometry(ps * 0.35, ps * 0.35, ps * 0.5, 12);
    powerupGeometries.default = new THREE.BoxGeometry(ps * 0.9, ps * 0.9, ps * 0.9);
    // Environment
    sharedGeometries.log = new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_LENGTH, 6);
    sharedGeometries.groundPlane = new THREE.PlaneGeometry(1, 1); // Scaled later
}

// Creates shared materials
function _createMaterials() {
    console.log("Renderer: Creating materials...");
    // Player Materials
    sharedMaterials.playerBody = new THREE.MeshStandardMaterial({color:0xDC143C, roughness:0.5, metalness:0.2, name:"PlayerBody"});
    sharedMaterials.playerHead = new THREE.MeshStandardMaterial({color:0xD2B48C, roughness:0.7, name:"PlayerHead"});
    sharedMaterials.playerGun = new THREE.MeshStandardMaterial({color:0x444444, roughness:0.5, metalness:0.7, name:"PlayerGun"});
    sharedMaterials.playerDown = new THREE.MeshStandardMaterial({color:0xFFD700, roughness:0.6, metalness:0.1, emissive:0xccab00, emissiveIntensity:0.5, name:"PlayerDown"});
    sharedMaterials.playerDead = new THREE.MeshStandardMaterial({color:0x555555, roughness:0.8, metalness:0.0, name:"PlayerDead"});
    sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({color:0xff69b4, roughness:0.5, metalness:0.2, emissive:0x331122, emissiveIntensity:0.3, name:"PlayerSelfBody"}); // Differentiate local player

    // Enemy Materials
    const enemyStandardProps = {roughness:0.7, metalness:0.1, transparent:true, opacity:1.0}; // Base for standard enemies, allows fade out
    sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({color:0x18315f, ...enemyStandardProps, name:"EnemyChaserBody"});
    sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({color:0x556B2F, ...enemyStandardProps, name:"EnemyShooterBody"});
    sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({color:0x8B0000, roughness:0.6, metalness:0.2, transparent:true, opacity:1.0, name:"EnemyGiantBody"});
    sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({color:0xBC8F8F, roughness:0.7, name:"EnemyHead"});
    sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({color:0x505050, roughness:0.6, metalness:0.6, name:"EnemyGun"});

    // Bullet & Casing Materials
    sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({color:0xffed4a, name:"PlayerBullet"}); // Basic for visibility
    sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({color:0xff4500, name:"EnemyBullet"});
    sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({color:0xdaa520, roughness:0.4, metalness:0.6, name:"AmmoCasing"});

    // Powerup Materials
    sharedMaterials.powerupBase = {roughness:0.6, metalness:0.1, name:"PowerupDefault"}; // Base properties
    sharedMaterials.powerups = {
        health: new THREE.MeshStandardMaterial({color:0x81c784, ...sharedMaterials.powerupBase, name:"PowerupHealth"}),
        gun_upgrade: new THREE.MeshStandardMaterial({color:0x6a0dad, emissive:0x330044, emissiveIntensity:0.4, ...sharedMaterials.powerupBase, name:"PowerupGun"}),
        speed_boost: new THREE.MeshStandardMaterial({color:0x3edef3, ...sharedMaterials.powerupBase, name:"PowerupSpeed"}),
        armor: new THREE.MeshStandardMaterial({color:0xaaaaaa, metalness:0.8, roughness:0.3, ...sharedMaterials.powerupBase, name:"PowerupArmor"}),
        ammo_shotgun: new THREE.MeshStandardMaterial({color:0xFFa500, ...sharedMaterials.powerupBase, name:"PowerupShotgun"}),
        ammo_heavy_slug: new THREE.MeshStandardMaterial({color:0xA0522D, ...sharedMaterials.powerupBase, name:"PowerupSlug"}),
        ammo_rapid_fire: new THREE.MeshStandardMaterial({color:0xFFFF00, emissive:0x555500, emissiveIntensity:0.5, ...sharedMaterials.powerupBase, name:"PowerupRapid"}),
        bonus_score: new THREE.MeshStandardMaterial({color:0xFFD700, metalness:0.6, roughness:0.4, ...sharedMaterials.powerupBase, name:"PowerupScore"}),
        default: new THREE.MeshStandardMaterial({color:0x888888, ...sharedMaterials.powerupBase})
    };

    // Environment Materials
    sharedMaterials.groundDay = new THREE.MeshStandardMaterial({color:0x788a77, roughness:0.9, metalness:0.05, name:"GroundDay"});
    sharedMaterials.groundNight = new THREE.MeshStandardMaterial({color:0x4E342E, roughness:0.85, metalness:0.1, name:"GroundNight"});
    sharedMaterials.log = new THREE.MeshStandardMaterial({color:0x5a3a1e, roughness:0.9, name:"Log"});
    sharedMaterials.snake = new THREE.MeshStandardMaterial({color:0x3a5311, roughness:0.4, metalness:0.1, side:THREE.DoubleSide, name:"Snake"}); // Double side for tubes

    // Particle Materials
    sharedMaterials.hitSpark = new THREE.PointsMaterial({size:10, vertexColors:true, transparent:true, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending, name:"HitSpark"});
    sharedMaterials.rainLine = new THREE.LineBasicMaterial({color:0x88aaff, transparent:true, opacity:0.4, blending:THREE.AdditiveBlending, name:"RainLine"});
    sharedMaterials.dustMote = new THREE.PointsMaterial({size:50, color:0xd2b48c, transparent:true, opacity:DUST_OPACITY, sizeAttenuation:true, depthWrite:false, name:"DustMote"});
    sharedMaterials.flame = new THREE.PointsMaterial({size:18, vertexColors:true, map:loadedAssets.flameTexture, transparent:true, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending, name:"Flame"});
}

// Initializes instanced meshes and particle system geometries/buffers
function _initParticlesAndInstances() {
    if (!scene) { console.error("Renderer: Scene not ready for particle/instance init."); return; }
    console.log("Renderer: Initializing particles and instanced meshes...");

    // Bullets (Instanced)
    playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS);
    playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); playerBulletMesh.count = 0; playerBulletMesh.name = "PlayerBullets"; scene.add(playerBulletMesh); playerBulletMatrices = playerBulletMesh.instanceMatrix.array;

    enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS);
    enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); enemyBulletMesh.count = 0; enemyBulletMesh.name = "EnemyBullets"; scene.add(enemyBulletMesh); enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array;

    // Ammo Casings (Instanced)
    ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS);
    ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; ammoCasingMesh.name = "AmmoCasings"; scene.add(ammoCasingMesh); activeAmmoCasings = []; // Reset active list

    // Hit Sparks (Points)
    const sparkGeo = new THREE.BufferGeometry();
    const sparkP = new Float32Array(MAX_HIT_SPARKS * 3); // Position (x, y, z)
    const sparkC = new Float32Array(MAX_HIT_SPARKS * 3); // Color (r, g, b)
    const sparkA = new Float32Array(MAX_HIT_SPARKS); // Alpha
    const sparkData = []; // Holds simulation state { p: Vector3, v: Vector3, c: Color, a: float, l: float (lifetime) }
    for (let i = 0; i < MAX_HIT_SPARKS; i++) { sparkP[i * 3 + 1] = -1e4; sparkA[i] = 0; sparkData.push({ p: new THREE.Vector3(0,-1e4,0), v: new THREE.Vector3(), c: new THREE.Color(1,1,1), a: 0.0, l: 0 }); }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkP, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkC, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkA, 1).setUsage(THREE.DynamicDrawUsage));
    hitSparkSystem = { particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark), geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData };
    hitSparkSystem.particles.name = "HitSparks"; hitSparkSystem.particles.visible = false; // Start invisible
    scene.add(hitSparkSystem.particles);

    // Rain (LineSegments)
    const rainGeo = new THREE.BufferGeometry();
    const rainP = new Float32Array(MAX_RAIN_DROPS * 6); // 2 points per line (start, end) * 3 coords
    const rainData = []; // Holds simulation state { x, y, z, s (speedY) }
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        // Initial spawn position uses default dimensions, will adjust in update if game dimensions change
        const x = Math.random()*DEFAULT_GAME_WIDTH*GROUND_MARGIN - (DEFAULT_GAME_WIDTH*(GROUND_MARGIN-1)/2);
        const y = Math.random()*1000+800;
        const z = Math.random()*DEFAULT_GAME_HEIGHT*GROUND_MARGIN - (DEFAULT_GAME_HEIGHT*(GROUND_MARGIN-1)/2);
        rainP[i*6+1] = -1e4; rainP[i*6+4] = -1e4; // Initialize off-screen
        rainData.push({ x:x, y:y, z:z, s: RAIN_SPEED_Y + Math.random()*RAIN_SPEED_Y_RAND });
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3).setUsage(THREE.DynamicDrawUsage));
    rainSystem = { lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine), geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData };
    rainSystem.lines.visible = false; rainSystem.lines.name = "RainLines"; scene.add(rainSystem.lines);

    // Dust Motes (Points)
    const dustGeo = new THREE.BufferGeometry();
    const dustP = new Float32Array(MAX_DUST_MOTES * 3); // Position (x, y, z)
    const dustData = []; // Holds simulation state { p: Vector3, v: Vector3 }
    for (let i = 0; i < MAX_DUST_MOTES; i++) {
        // Initial spawn uses defaults, will adjust in update
        dustP[i * 3 + 1] = -1e4; // Initialize off-screen
        dustData.push({
            p: new THREE.Vector3(Math.random()*DEFAULT_GAME_WIDTH, Math.random()*80+5, Math.random()*DEFAULT_GAME_HEIGHT),
            v: new THREE.Vector3((Math.random()-0.5)*DUST_SPEED_XZ, (Math.random()-0.5)*DUST_SPEED_Y, (Math.random()-0.5)*DUST_SPEED_XZ)
        });
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustP, 3).setUsage(THREE.DynamicDrawUsage));
    dustSystem = { particles: new THREE.Points(dustGeo, sharedMaterials.dustMote), geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData };
    dustSystem.particles.visible = false; dustSystem.particles.name = "DustParticles"; scene.add(dustSystem.particles);
}

// Initializes the campfire object group and its particle system
function _initCampfire() {
    if (!scene) { console.error("Renderer: Scene not ready for campfire init."); return; }
    console.log("Renderer: Initializing campfire...");
    const group = new THREE.Group(); group.name = "CampfireGroup";

    // Logs
    const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log1.rotation.set(0, Math.PI/10, Math.PI/6); log1.castShadow = true; log1.position.set(-CAMPFIRE_LOG_LENGTH*0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH*0.2);
    const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log2.rotation.set(0, -Math.PI/8, -Math.PI/5); log2.castShadow = true; log2.position.set(CAMPFIRE_LOG_LENGTH*0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH*0.1);
    group.add(log1); group.add(log2);

    // Light
    const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0); // Intensity starts at 0
    glowLight.position.y = Y_OFFSET_CAMPFIRE + 15; glowLight.castShadow = true;
    glowLight.shadow.mapSize.width = 512; glowLight.shadow.mapSize.height = 512; glowLight.shadow.bias = -0.01; group.add(glowLight);

    // Flames (Points)
    const flameGeo = new THREE.BufferGeometry();
    const flameP = new Float32Array(MAX_FLAME_PARTICLES*3); const flameC = new Float32Array(MAX_FLAME_PARTICLES*3); const flameA = new Float32Array(MAX_FLAME_PARTICLES);
    const flameData = []; // Holds simulation state { p, v, c, a, l, bl (base life) }
    for (let i=0; i<MAX_FLAME_PARTICLES; i++) { flameP[i*3+1]=-1e4; flameA[i]=0; flameData.push({ p:new THREE.Vector3(0,-1e4,0), v:new THREE.Vector3(), c:new THREE.Color(1,1,1), a:0.0, l:0, bl:FLAME_BASE_LIFE + Math.random()*FLAME_RAND_LIFE }); }
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flameP, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameC, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('alpha', new THREE.BufferAttribute(flameA, 1).setUsage(THREE.DynamicDrawUsage));
    const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame); flameParticles.name = "CampfireFlames"; flameParticles.visible = false; group.add(flameParticles);

    // Store system references
    campfireSystem = { group: group, particles: flameParticles, geometry: flameGeo, material: sharedMaterials.flame, glowLight: glowLight, data: flameData };
    group.visible = false; // Start campfire group invisible
    scene.add(group);
}

// Initializes the snake mesh (TubeGeometry)
function _initSnake() {
    if (!scene) { console.error("Renderer: Scene not ready for snake init."); return; }
    console.log("Renderer: Initializing snake mesh...");
    // Create a dummy curve initially, it will be replaced in the update
    const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0));
    const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false);
    snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake);
    snakeMesh.castShadow = true; snakeMesh.visible = false; // Start invisible
    snakeMesh.name = "Snake";
    scene.add(snakeMesh);
}

// --- Object Creation ---
function _createPlayerGroup(playerData, isSelf) {
    const group = new THREE.Group();
    group.name = `PlayerGroup_${playerData.id}`;

    // Choose body material based on whether it's the local player
    const bodyMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
    // NOTE: Cloning materials here. This allows individual opacity/color changes later if needed,
    // but could be optimized if only the base sharedMaterial reference needs swapping.
    const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat.clone());
    bodyMesh.castShadow = true;
    bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2; // Center capsule vertically on offset
    group.add(bodyMesh);

    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead.clone());
    headMesh.scale.setScalar(PLAYER_HEAD_RADIUS);
    headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; // Position above body
    headMesh.castShadow = true;
    group.add(headMesh);

    const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun.clone());
    gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8); // Position relative to body center
    gunMesh.rotation.x = Math.PI / 2; // Point gun forward (along Z)
    gunMesh.castShadow = true;
    group.add(gunMesh);

    // Initial position (will be updated)
    group.position.set(playerData.x, 0, playerData.y);

    // Store references and state in userData for easy access
    group.userData = {
        gameId: playerData.id,
        isPlayer: true,
        isSelf: isSelf,
        bodyMesh: bodyMesh,
        headMesh: headMesh,
        gunMesh: gunMesh,
        currentBodyMatRef: bodyMat, // Store reference to the original shared material
        dyingStartTime: null // Track fade-out animation
    };
    return group;
}

function _createEnemyGroup(enemyData) {
    const group = new THREE.Group();
    group.name = `EnemyGroup_${enemyData.id}`;
    let bodyGeo, bodyMat, headScale, yBodyOffset, gunMesh = null;
    const enemyHeight = enemyData.height || ENEMY_CHASER_HEIGHT; // Use specific or default height

    // Select geometry and material based on type
    switch (enemyData.type) {
        case 'shooter':
            bodyGeo = sharedGeometries.enemyShooterBody;
            bodyMat = sharedMaterials.enemyShooterBody; // Reference shared material
            headScale = ENEMY_HEAD_RADIUS;
            yBodyOffset = enemyHeight / 2;
            // Add gun specific to shooter
            gunMesh = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun.clone());
            gunMesh.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8);
            gunMesh.rotation.x = Math.PI / 2;
            gunMesh.castShadow = true;
            group.add(gunMesh);
            break;
        case 'giant':
            bodyGeo = sharedGeometries.enemyGiantBody;
            bodyMat = sharedMaterials.enemyGiantBody; // Reference shared material
            headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8;
            yBodyOffset = enemyHeight / 2;
            break;
        case 'chaser':
        default:
            bodyGeo = sharedGeometries.enemyChaserBody;
            bodyMat = sharedMaterials.enemyChaserBody; // Reference shared material
            headScale = ENEMY_HEAD_RADIUS;
            yBodyOffset = enemyHeight / 2;
            break;
    }

    // Create body mesh with CLONED material to allow independent opacity changes
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat.clone());
    bodyMesh.castShadow = true;
    bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset; // Position based on offset and height
    group.add(bodyMesh);

    // Create head mesh
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead.clone());
    headMesh.scale.setScalar(headScale);
    headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; // Position above body
    headMesh.castShadow = true;
    group.add(headMesh);

    group.position.set(enemyData.x, 0, enemyData.y);

    group.userData = {
        gameId: enemyData.id,
        isEnemy: true,
        type: enemyData.type,
        bodyMesh: bodyMesh,
        headMesh: headMesh,
        gunMesh: gunMesh, // Store gun reference if it exists
        currentBodyMatRef: bodyMat, // Store reference to original shared material
        dyingStartTime: null, // For fade-out
        health: enemyData.health // Store initial health if needed
    };
    return group;
}

function _createPowerupGroup(powerupData) {
    const group = new THREE.Group();
    group.name = `PowerupGroup_${powerupData.id}`;
    const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default;
    const material = (sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default); // Reference shared material

    if (!material) {
        console.error(`Renderer Error: Could not find material for powerup type: ${powerupData.type}`);
        return null; // Don't create group if material is missing
    }

    // Clone material for potential individual effects (though less likely needed for powerups)
    const iconMesh = new THREE.Mesh(geometry, material.clone());
    iconMesh.castShadow = true;
    iconMesh.position.y = Y_OFFSET_POWERUP; // Set vertical position
    iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); // Slight tilt
    group.add(iconMesh);
    group.position.set(powerupData.x, 0, powerupData.y);

    group.userData = {
        gameId: powerupData.id,
        isPowerup: true,
        iconMesh: iconMesh
    };
    return group;
}

// --- Disposal / Removal ---
// Helper to dispose textures of a material
function _disposeMaterialTextures(material) {
    if (!material) return;
    const textures = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'displacementMap', 'envMap'];
    textures.forEach(prop => {
        if (material[prop] && material[prop] instanceof THREE.Texture) {
             // console.debug(`Disposing texture: ${material[prop].name || 'unnamed'} on material ${material.name}`);
            material[prop].dispose();
        }
    });
}

// Disposes geometry and materials (including textures) of an object and its children
function _disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
            child.geometry?.dispose();
            // console.debug(`Disposed geometry for ${child.name || 'unnamed object'}`);

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(m => {
                if (m) {
                    // Check if it's one of OUR shared materials before disposing
                    let isShared = Object.values(sharedMaterials).includes(m) || Object.values(sharedMaterials.powerups).includes(m);
                    if (!isShared) {
                        // console.debug(`Disposing material: ${m.name || 'unnamed'} (and its textures)`);
                        _disposeMaterialTextures(m);
                        m.dispose();
                    } else {
                        // console.debug(`Skipping disposal of shared material: ${m.name}`);
                    }
                }
            });
        } else if (child instanceof THREE.PointLight && child !== muzzleFlashLight && child !== campfireSystem?.glowLight) {
            // Dispose non-global lights if any were added dynamically
            // child.dispose?.(); // PointLight doesn't have a dispose method
        }
    });
     // console.debug(`Finished dispose traverse for ${obj.name}`);
}

// Removes object from scene and disposes it
function _disposeAndRemoveObject(obj, id, objectMap) {
    if (!obj || !scene) return;
    // console.log(`Disposing and removing object: ${obj.name} (ID: ${id})`);
    scene.remove(obj);
    _disposeObject3D(obj);
    delete objectMap[id];
}

// Handles object removal, including fade-out animation for enemies
function _handleObjectRemoval(obj, id, objectMap) {
    if (!obj || !clock) return;

    const userData = obj.userData;
    const isEnemy = userData?.isEnemy;
    const wasAlive = !userData?.dyingStartTime && (userData?.health === undefined || userData?.health > 0);

    // If it's an enemy that *was* alive and hasn't started dying yet, start the fade
    if (isEnemy && wasAlive && !userData.dyingStartTime) {
        // console.log(`Starting fade out for enemy: ${id}`);
        userData.dyingStartTime = clock.elapsedTime;
        userData.health = 0; // Mark as logically dead
        // Make materials transparent for fade
        obj.traverse(child => {
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(m => { m.transparent = true; m.needsUpdate = true; });
            }
        });
    }
    // If it's an enemy already fading out
    else if (isEnemy && userData.dyingStartTime) {
        const timeElapsed = clock.elapsedTime - userData.dyingStartTime;
        const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION);
        const opacity = 1.0 - fadeProgress;

        // Update opacity
        obj.traverse(child => {
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(m => { m.opacity = opacity; });
            }
        });

        // If fade complete, dispose and remove
        if (fadeProgress >= 1.0) {
            _disposeAndRemoveObject(obj, id, objectMap);
        }
    }
    // Otherwise (not an enemy, or already dead/marked for immediate removal), dispose directly
    else {
        _disposeAndRemoveObject(obj, id, objectMap);
    }
}

// --- Update Logic ---

// Generic function to synchronize scene objects with state data
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) {
    if (!scene || !clock) return;
    const activeIds = new Set();

    // Add/Update existing objects
    if (state) {
        for (const id in state) {
            const data = state[id];
            // Basic validation: ensure positional data exists
            if (typeof data?.x !== 'number' || typeof data?.y !== 'number') {
                 // console.warn(`Skipping sync for ID ${id}: Missing positional data.`);
                 continue; // Skip invalid entries
            }
            activeIds.add(id);
            let obj = objectMap[id];

            if (!obj) { // Object doesn't exist, create it
                const isSelf = isSelfFn ? isSelfFn(id) : false;
                obj = createFn(data, isSelf);
                if (obj) {
                    objectMap[id] = obj;
                    scene.add(obj);
                    updateFn(obj, data, 0, isSelf); // Initial update
                } // else { console.error(`Failed to create object for ID ${id}`); }
            } else { // Object exists, update it
                const isSelf = obj.userData?.isSelf ?? (isSelfFn ? isSelfFn(id) : false);
                // If object was fading out, reset its state
                if (obj.userData?.dyingStartTime) {
                    obj.userData.dyingStartTime = null;
                    obj.visible = true;
                    obj.traverse(child => {
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            // Reset opacity and transparency (assuming original material wasn't transparent)
                            materials.forEach(m => { m.opacity = 1.0; m.transparent = false; m.needsUpdate = true; });
                        }
                    });
                    // console.log(`Object ${id} re-activated (was fading).`);
                }
                updateFn(obj, data, clock.deltaTime, isSelf);
            }
        }
    }

    // Remove objects that are no longer in the state
    for (const id in objectMap) {
        if (!activeIds.has(id)) {
            _handleObjectRemoval(objectMap[id], id, objectMap);
        }
    }
}

function _updatePlayerGroup(group, playerData, deltaTime, isSelf) {
    if (!group?.userData) return;

    group.position.x = playerData.x;
    group.position.z = playerData.y; // Map Y from game state to Z in 3D world

    const userData = group.userData;
    const bodyMesh = userData.bodyMesh;
    let targetMatRef = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; // Base material

    // Determine target material based on player status
    switch (playerData.player_status) {
        case PLAYER_STATUS_DOWN:
            targetMatRef = sharedMaterials.playerDown;
            group.visible = true; // Downed players are visible
            break;
        case PLAYER_STATUS_DEAD:
            // Dead players are typically invisible or handled by game logic (e.g., respawn)
            group.visible = false;
            userData.dyingStartTime = null; // Ensure no fade animation interferes
            return; // Stop further updates for dead players
        case PLAYER_STATUS_ALIVE:
        default:
            group.visible = true;
            // targetMatRef remains the default (alive) material
            break;
    }

    // Swap material only if it changed
    if (bodyMesh && userData.currentBodyMatRef !== targetMatRef) {
        userData.currentBodyMatRef = targetMatRef;
        bodyMesh.material = targetMatRef.clone(); // Apply cloned material
        bodyMesh.material.needsUpdate = true;
        // console.log(`Player ${playerData.id} status changed, updated material to ${targetMatRef.name}`);
    }

    // Update rotation based on aim direction (only for local player for now)
    if (isSelf && window.appState?.localPlayerAimState) {
        const { lastAimDx, lastAimDy } = window.appState.localPlayerAimState;
        // Aim direction dx/dy corresponds to world X/Z
        group.rotation.y = Math.atan2(lastAimDx, lastAimDy);
    } else if (!isSelf) {
        // TODO: Optionally rotate remote players based on their server-sent aim/velocity?
    }
}

function _updateEnemyGroup(group, enemyData, deltaTime) {
    if (!group?.userData || group.userData.dyingStartTime || !clock) return; // Skip if fading out

    group.position.x = enemyData.x;
    group.position.z = enemyData.y; // Map Y to Z
    group.userData.health = enemyData.health; // Update health cache

    const gunMesh = group.userData.gunMesh;

    // Rotate shooter towards target player
    if (enemyData.type === 'shooter' && gunMesh && window.appState?.serverState?.players) {
        const targetPlayer = window.appState.serverState.players[enemyData.target_player_id];
        if (targetPlayer) {
            // Calculate direction from enemy to player in world coords
            const dx = targetPlayer.x - enemyData.x;
            const dz = targetPlayer.y - enemyData.y; // Game Y is world Z
            group.rotation.y = Math.atan2(dx, dz); // Rotate the whole group
        }
    } else if (enemyData.type === 'chaser' || enemyData.type === 'giant') {
        // Optionally rotate based on velocity if provided by server state?
        // Example: if (enemyData.vx && enemyData.vy) group.rotation.y = Math.atan2(enemyData.vx, enemyData.vy);
    }


    // Giant specific animation (pulsing scale during windup)
    const bodyMesh = group.userData.bodyMesh;
    if (bodyMesh && enemyData.type === 'giant') {
        const isWindingUp = enemyData.attack_state === 'winding_up';
        // Use a sine wave based on elapsed time for pulsing effect
        const scaleTarget = isWindingUp ? 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05 : 1.0;
        // Smoothly interpolate towards the target scale
        bodyMesh.scale.lerp(_vector3.set(scaleTarget, scaleTarget, scaleTarget), 0.2);
    }
}

function _updatePowerupGroup(group, powerupData, deltaTime) {
     if (!group?.userData || !clock) return;

     // Update position
     group.position.x = powerupData.x;
     group.position.z = powerupData.y; // Map Y to Z

     // Add simple animation (bobbing and rotating)
     const iconMesh = group.userData.iconMesh;
     if (iconMesh) {
         // Bobbing effect based on time and unique object ID (use the number directly)
         iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + group.id) * 4; // CORRECTED: Use numeric ID
         // Slow rotation
         iconMesh.rotation.y += 0.015;
         iconMesh.rotation.x += 0.005;
         iconMesh.rotation.z += 0.003;
     }
}

// Updates an InstancedMesh based on game state data
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) {
    if (!mesh) return; // Safety check
    if (!state || Object.keys(state).length === 0) {
        mesh.count = 0; // No data, hide all instances
        mesh.instanceMatrix.needsUpdate = true;
        return;
    }

    let visibleCount = 0;
    const maxCount = matrices.length / 16; // Max instances based on buffer size

    for (const id in state) {
        if (visibleCount >= maxCount) {
             console.warn(`Renderer: Exceeded max instances (${maxCount}) for mesh ${mesh.name}. Some objects may not be drawn.`);
             break;
        }
        const data = state[id];

        // Filter bullets by owner type if necessary (for player/enemy bullet meshes)
        if (isBullet) {
            const isPlayerBullet = data.owner_type === 'player';
            if (mesh === playerBulletMesh && !isPlayerBullet) continue;
            if (mesh === enemyBulletMesh && isPlayerBullet) continue;
        }

        // Basic data validation
        if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;

        // Set position
        _position.set(data.x, yOffset, data.y); // Game Y maps to World Z

        // Set rotation (only for bullets based on velocity)
        if (isBullet && data.vx !== undefined && data.vy !== undefined && (data.vx !== 0 || data.vy !== 0)) {
            const angle = Math.atan2(data.vx, data.vy); // Angle in XZ plane
            _quaternion.setFromEuler(new THREE.Euler(0, angle, 0)); // Rotate around Y axis
        } else {
            _quaternion.identity(); // No rotation for non-bullets or zero velocity bullets
        }

        // Set scale (always 1 for now)
        _scale.set(1, 1, 1);

        // Compose matrix and set it for the instance
        _matrix.compose(_position, _quaternion, _scale);
        mesh.setMatrixAt(visibleCount, _matrix); // Use mesh's method

        visibleCount++;
    }

    mesh.count = visibleCount; // Update visible count
    mesh.instanceMatrix.needsUpdate = true; // Tell THREE.js to update the buffer
}

// Simulates physics for active ammo casings
function _updateActiveCasings(deltaTime) {
    if (!ammoCasingMesh || !clock) return;
    if (activeAmmoCasings.length === 0) { // Optimization: Skip if no casings
        if (ammoCasingMesh.count > 0) { // Ensure mesh count is 0 if no active casings
             ammoCasingMesh.count = 0;
             ammoCasingMesh.instanceMatrix.needsUpdate = true;
        }
        return;
    }

    const now = clock.elapsedTime;
    let needsUpdate = false;

    // Filter and update casings
    activeAmmoCasings = activeAmmoCasings.filter(casing => {
        if (now > casing.endTime) return false; // Remove expired

        // Simple physics simulation
        casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime; // Apply gravity
        casing.position.addScaledVector(casing.velocity, deltaTime); // Update position
        casing.rotation += casing.rotationSpeed * deltaTime; // Update rotation

        // Ground collision and bounce
        if (casing.position.y <= Y_OFFSET_CASING) {
            casing.position.y = Y_OFFSET_CASING; // Clamp to ground
            casing.velocity.y *= -AMMO_CASING_BOUNCE; // Reverse and dampen vertical velocity
            // Apply drag on bounce
            casing.velocity.x *= (1.0 - AMMO_CASING_DRAG);
            casing.velocity.z *= (1.0 - AMMO_CASING_DRAG);
            casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0); // Slow down rotation
            // Stop bouncing/rotating if velocity/speed is very low
            if (Math.abs(casing.velocity.y) < 5) casing.velocity.y = 0;
            if(Math.abs(casing.rotationSpeed) < 0.1) casing.rotationSpeed = 0;
        }
        return true; // Keep active casing
    });

    // Update InstancedMesh matrices
    let visibleCount = 0;
    const maxCount = ammoCasingMesh.instanceMatrix.array.length / 16;
    for (let i = 0; i < activeAmmoCasings.length; i++) {
        if (visibleCount >= maxCount) break;
        const casing = activeAmmoCasings[i];
        // Rotate casing around its local Y axis (which aligns with world Y after initial PI/2 rotation)
        _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0)); // Apply base rotation and spin
        _matrix.compose(casing.position, _quaternion, _scale);
        ammoCasingMesh.setMatrixAt(visibleCount, _matrix);
        visibleCount++;
        needsUpdate = true;
    }

    if (ammoCasingMesh.count !== visibleCount) {
         ammoCasingMesh.count = visibleCount;
         needsUpdate = true; // Need update if count changes
    }

    if (needsUpdate) {
        ammoCasingMesh.instanceMatrix.needsUpdate = true;
    }
}

// Spawns a new ammo casing visual effect
function _spawnAmmoCasing(spawnPos, ejectVec) {
    if (!ammoCasingMesh || !clock || activeAmmoCasings.length >= MAX_AMMO_CASINGS) return;

    const now = clock.elapsedTime;
    const life = 1.5 + Math.random() * 1.0; // Random lifetime

    // Calculate ejection direction (perpendicular to aim, with randomness)
    const ejectAngle = Math.atan2(ejectVec.z, ejectVec.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
    const ejectSpeed = 150 + Math.random() * 80; // Horizontal speed
    const upSpeed = 50 + Math.random() * 40; // Initial upward speed
    const rotationSpeed = (Math.random() - 0.5) * 20; // Random spin

    // Create casing data
    activeAmmoCasings.push({
        position: new THREE.Vector3( // Start near player gun, slightly offset
            spawnPos.x + Math.cos(ejectAngle) * 5,
            spawnPos.y + PLAYER_TOTAL_HEIGHT * 0.6, // Approximate gun height
            spawnPos.z + Math.sin(ejectAngle) * 5
        ),
        velocity: new THREE.Vector3( // Initial velocity
            Math.cos(ejectAngle) * ejectSpeed,
            upSpeed,
            Math.sin(ejectAngle) * ejectSpeed
        ),
        rotation: Math.random() * Math.PI * 2, // Initial random rotation
        rotationSpeed: rotationSpeed,
        startTime: now,
        endTime: now + life
    });
}

// Updates the hit spark particle system
function _updateHitSparks(deltaTime) {
    if (!hitSparkSystem || !clock) return;

    const positions = hitSparkSystem.geometry.attributes.position.array;
    const colors = hitSparkSystem.geometry.attributes.color.array;
    const alphas = hitSparkSystem.geometry.attributes.alpha.array;
    const data = hitSparkSystem.data;
    let needsGeomUpdate = false;
    let activeCount = 0;

    for (let i = 0; i < MAX_HIT_SPARKS; i++) {
        const p = data[i];
        if (p.l > 0) { // If particle is alive
            p.l -= deltaTime; // Decrease lifetime
            activeCount++;

            if (p.l <= 0) { // Particle just died
                alphas[i] = 0.0;
                positions[i * 3 + 1] = -10000; // Move off-screen vertically
            } else { // Particle still alive, update physics
                p.v.y -= HIT_SPARK_GRAVITY * deltaTime; // Gravity
                p.p.addScaledVector(p.v, deltaTime); // Update position
                // Fade out alpha based on remaining life
                p.a = Math.min(1.0, Math.max(0, (p.l / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5));
                alphas[i] = p.a;
                // Update buffer attributes
                positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z;
                colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b;
            }
            needsGeomUpdate = true; // Mark buffers for update
        } else if (alphas[i] > 0) { // Ensure dead particles are fully hidden
            alphas[i] = 0.0;
            positions[i * 3 + 1] = -10000;
            needsGeomUpdate = true;
        }
    }

    // Only update buffers if something changed
    if (needsGeomUpdate) {
        hitSparkSystem.geometry.attributes.position.needsUpdate = true;
        hitSparkSystem.geometry.attributes.color.needsUpdate = true;
        hitSparkSystem.geometry.attributes.alpha.needsUpdate = true;
    }

    // Toggle visibility based on active count
    hitSparkSystem.particles.visible = activeCount > 0;
}

// Triggers new hit sparks at a given position
function _triggerHitSparks(position, count = 5) {
    if (!hitSparkSystem || !clock) return;
    const data = hitSparkSystem.data;
    let spawned = 0;

    // Find inactive particles in the pool and activate them
    for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) {
        if (data[i].l <= 0) { // Find a dead particle
            const p = data[i];
            p.p.copy(position); // Set starting position

            // Calculate random initial velocity
            const angle = Math.random() * Math.PI * 2; // Random horizontal direction
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; // Random vertical spread
            const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD;
            p.v.set(
                Math.cos(angle) * Math.cos(spreadAngle) * speed, // X velocity
                Math.sin(spreadAngle) * speed * 1.5 + 30, // Y velocity (initial upward kick)
                Math.sin(angle) * Math.cos(spreadAngle) * speed // Z velocity
            );

            p.c.setRGB(1, 0.2 + Math.random() * 0.3, 0); // Set color (orangey-yellow)
            p.a = 1.0; // Start fully opaque
            p.l = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE; // Set lifetime
            spawned++;
        }
    }
     if (spawned > 0) hitSparkSystem.particles.visible = true; // Ensure visible if spawning
}

// Updates the rain particle system
function _updateRain(deltaTime) {
    if (!rainSystem || !rainSystem.lines.visible) { // Optimization: Skip if not visible
         return;
    }
    const positions = rainSystem.geometry.attributes.position.array;
    const data = rainSystem.data;
    let needsUpdate = false;

    // Use current game dimensions for wrapping/spawning
    const currentWidth = gameWidth * GROUND_MARGIN;
    const currentHeight = gameHeight * GROUND_MARGIN;
    const widthOffset = (gameWidth * (GROUND_MARGIN - 1)) / 2;
    const heightOffset = (gameHeight * (GROUND_MARGIN - 1)) / 2;


    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const p = data[i];
        p.y += p.s * deltaTime; // Update vertical position based on speed

        // If drop goes below ground, reset its position to the top
        if (p.y < -50) {
            p.x = Math.random() * currentWidth - widthOffset; // Use current width for range
            p.y = Math.random() * 500 + 1000; // Reset Y position high up
            p.z = Math.random() * currentHeight - heightOffset; // Use current height for range
            p.s = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND; // Reset speed
        }

        // Update buffer positions for the line segment (top and bottom points)
        const idx = i * 6;
        positions[idx+0]=p.x; positions[idx+1]=p.y; positions[idx+2]=p.z; // Top point
        positions[idx+3]=p.x; positions[idx+4]=p.y - RAIN_STREAK_LENGTH; positions[idx+5]=p.z; // Bottom point (creates streak)
        needsUpdate = true;
    }
    if (needsUpdate) {
        rainSystem.geometry.attributes.position.needsUpdate = true;
    }
}

// Updates the dust mote particle system
function _updateDust(deltaTime) {
     if (!dustSystem || !dustSystem.particles.visible || !camera) { // Optimization: Skip if not visible
        return;
     }
     const positions = dustSystem.geometry.attributes.position.array;
     const data = dustSystem.data;
     let needsUpdate = false;

     // Use current game dimensions for wrapping logic
    const worldWidth = gameWidth * GROUND_MARGIN;
    const worldHeight = gameHeight * GROUND_MARGIN;
    const halfW = gameWidth / 2; // Center X of logical area
    const halfH = gameHeight / 2; // Center Z of logical area
    const marginW = (gameWidth * (GROUND_MARGIN - 1)) / 2; // Margin X
    const marginH = (gameHeight * (GROUND_MARGIN - 1)) / 2; // Margin Z

     for (let i = 0; i < MAX_DUST_MOTES; i++) {
         const p = data[i];
         p.p.addScaledVector(p.v, deltaTime); // Update position based on velocity

         // Wrapping logic (if particle goes outside GROUND_MARGIN area)
         // Compare against world boundaries relative to center
         if(p.p.x < halfW - marginW) p.p.x += worldWidth; // Wrap left to right
         else if(p.p.x > halfW + worldWidth - marginW) p.p.x -= worldWidth; // Wrap right to left
         if(p.p.z < halfH - marginH) p.p.z += worldHeight; // Wrap top to bottom
         else if(p.p.z > halfH + worldHeight - marginH) p.p.z -= worldHeight; // Wrap bottom to top

         // Random vertical drift and clamping
         p.p.y += (Math.random()-0.5)*DUST_SPEED_Y*deltaTime;
         p.p.y = Math.max(5,Math.min(80, p.p.y)); // Clamp Y between 5 and 80

         // Update buffer positions
         positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z;
         needsUpdate = true;
     }
     if (needsUpdate) {
         dustSystem.geometry.attributes.position.needsUpdate = true;
     }
}

// Updates the campfire particle system
function _updateCampfire(deltaTime) {
    if (!campfireSystem || !campfireSystem.group.visible || !clock) { // Optimization: Skip if not visible
         return;
    }
    const positions = campfireSystem.geometry.attributes.position.array;
    const colors = campfireSystem.geometry.attributes.color.array;
    const alphas = campfireSystem.geometry.attributes.alpha.array;
    const data = campfireSystem.data;
    let needsGeomUpdate = false;
    let activeCount = 0;

    // Spawn new particles based on deltaTime
    const spawnRate = 150; // Particles per second
    const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random())); // Add randomness to spawn rate
    let spawned = 0;
    for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) {
        if (data[i].l <= 0) { // Find a dead particle
            const p = data[i];
            // Spawn within the base radius
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * CAMPFIRE_BASE_RADIUS;
            p.p.set(
                Math.cos(angle) * radius,
                Y_OFFSET_CAMPFIRE + 2, // Start slightly above ground
                Math.sin(angle) * radius
            );
            // Initial velocity (upwards with spread)
            p.v.set(
                (Math.random() - 0.5) * FLAME_VEL_SPREAD,
                FLAME_VEL_Y + Math.random() * 30,
                (Math.random() - 0.5) * FLAME_VEL_SPREAD
            );
            p.l = p.bl; // Reset lifetime to its base random value
            p.a = 0.7 + Math.random() * 0.3; // Initial alpha
            p.c.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); // Initial color (yellow/orange)
            spawned++;
        }
    }

    // Update existing particles
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        const p = data[i];
        if (p.l > 0) { // If particle is alive
            p.l -= deltaTime;
            activeCount++;

            if (p.l <= 0) { // Particle just died
                alphas[i] = 0.0;
                positions[i * 3 + 1] = -10000;
            } else { // Particle still alive, update physics and appearance
                p.v.y += (Math.random() - 0.4) * 20 * deltaTime; // Add slight upward flutter/drift
                p.v.x *= 0.97; p.v.z *= 0.97; // Horizontal drag
                p.p.addScaledVector(p.v, deltaTime);
                p.a = Math.max(0, (p.l / p.bl) * 1.2); // Fade alpha based on lifetime (slight linger)
                p.c.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); // Lerp color towards red/embers
                // Update buffers
                alphas[i] = p.a;
                positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z;
                colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b;
            }
            needsGeomUpdate = true;
        } else if (alphas[i] > 0) { // Ensure dead particles are hidden
            alphas[i] = 0.0;
            positions[i * 3 + 1] = -10000;
            needsGeomUpdate = true;
        }
    }

    if (needsGeomUpdate) {
        campfireSystem.geometry.attributes.position.needsUpdate = true;
        campfireSystem.geometry.attributes.color.needsUpdate = true;
        campfireSystem.geometry.attributes.alpha.needsUpdate = true;
    }

    // Update light intensity for flicker effect
    if (campfireSystem.glowLight) {
        campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0) * 0.8;
    }

    // Update campfire group position and visibility based on server state
    if(campfireSystem.group && window.appState?.serverState?.campfire) {
        const cfData = window.appState.serverState.campfire;
        campfireSystem.group.position.set(cfData.x, 0, cfData.y); // Game Y -> World Z
        campfireSystem.group.visible = cfData.active;
        campfireSystem.particles.visible = cfData.active; // Sync particle visibility too
    } else if (campfireSystem.group) {
        campfireSystem.group.visible = false; // Hide if no server data
        campfireSystem.particles.visible = false;
    }
}

// Updates the snake mesh geometry based on server data
function _updateSnake(snakeData) {
    if (!snakeMesh) { return; } // Skip if mesh not initialized

    const isActive = snakeData?.active ?? false; // Check 'active' field from server
    snakeMesh.visible = isActive;

    if (isActive && snakeData.segments && snakeData.segments.length > 1) {
        // Convert server segments (x, gameY) to 3D points (x, fixedY, worldZ)
        const points = snakeData.segments.map(seg =>
            _vector3.set(seg.x, Y_OFFSET_SNAKE, seg.y) // Use fixed Y offset, map game Y to world Z
        );

        if (points.length >= 2) {
            try {
                // Create a smooth curve through the server points
                const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
                // Get points along the curve for the tube geometry (more points than logical segments)
                const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2);

                if(tubePoints.length >= 2) {
                    // Create new tube geometry based on the curve
                    const newGeometry = new THREE.TubeGeometry(
                        new THREE.CatmullRomCurve3(tubePoints), // Use refined curve points
                        tubePoints.length - 1, // Segments for tube geometry
                        SNAKE_RADIUS, // Radius of the tube
                        6, // Radial segments (controls roundness)
                        false // Not closed
                    );
                    // Dispose old geometry and assign new one
                    snakeMesh.geometry.dispose();
                    snakeMesh.geometry = newGeometry;
                    snakeMesh.visible = true; // Ensure visible if geometry updated
                } else {
                    // Not enough points generated from curve, hide the snake
                    snakeMesh.visible = false;
                }
            } catch(e) {
                console.error("Renderer Error updating snake geometry:", e);
                snakeMesh.visible = false; // Hide on error
            }
        } else {
             // Not enough segments data from server
            snakeMesh.visible = false;
        }
    } else {
        // Server says snake is inactive or data is missing
        snakeMesh.visible = false;
    }
}

// Updates camera position (lerping towards target) and applies screen shake
function _updateCamera(deltaTime) {
    if (!camera || !clock) return;

    // Target position is now updated by handleContainerResize based on actual dimensions
    const targetX = cameraTargetPos.x;
    const targetZ = cameraTargetPos.z;

    // --- DEBUG LOG ---
    // console.log(`UpdateCamera Using - Width: ${gameWidth.toFixed(0)}, Height: ${gameHeight.toFixed(0)}, TargetPos: (${targetX.toFixed(0)}, ${targetZ.toFixed(0)})`);

    // Smoothly interpolate camera position towards the target
    // Target Y (CAMERA_BASE_Y) and Z offset remain constant relative to target X/Z
    _vector3.set(targetX, CAMERA_BASE_Y, targetZ + 300); // Camera follows target XZ, fixed height/offset
    camera.position.lerp(_vector3, CAMERA_LERP_FACTOR);

    // Apply screen shake if active
    const nowMs = clock.elapsedTime * 1000;
    if (shakeMagnitude > 0 && nowMs < shakeEndTime) {
        const timeRemaining = shakeEndTime - nowMs;
        // Calculate decay factor (e.g., quadratic decay)
        // Ensure no division by zero if deltaTime is somehow 0
        const totalDuration = shakeEndTime - (nowMs - deltaTime * 1000);
        const decayFactor = totalDuration > 0 ? Math.pow(Math.max(0, timeRemaining / totalDuration), 2) : 0;
        const currentMag = shakeMagnitude * decayFactor;

        // Apply random offset
        const shakeAngle = Math.random() * Math.PI * 2;
        screenShakeOffset.set(
            Math.cos(shakeAngle) * currentMag, // Shake in X
            (Math.random() - 0.5) * currentMag * 0.5, // Smaller vertical shake
            Math.sin(shakeAngle) * currentMag // Shake in Z
        );
        camera.position.add(screenShakeOffset); // Add temporary offset
    } else {
        shakeMagnitude = 0; // Reset shake if expired
    }

    // Always look at the center of the logical game area on the ground plane
    const lookAtTarget = _vector3.set(targetX, 0, targetZ); // Look at target XZ on the ground (Y=0)
    camera.lookAt(lookAtTarget);

    // --- DEBUG LOG ---
    // console.log(`UpdateCamera Result - Cam Pos: (${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)}), LookAt: (${lookAtTarget.x.toFixed(0)}, ${lookAtTarget.z.toFixed(0)})`);

}

// Updates environment lighting, fog, and background based on game state
function _updateEnvironment(isNight, isRaining, isDustStorm) {
     if (!scene || !ambientLight || !directionalLight || !groundPlane || !clock) return;

     // Define target values for day/night/weather
     const dayAmbientIntensity=0.7, nightAmbientIntensity=0.45;
     const dayDirectionalIntensity=1.2, nightDirectionalIntensity=0.7;
     const dayAmbientColor=0xffffff, nightAmbientColor=0x7080a0; // Cooler night ambient
     const dayDirectionalColor=0xffffff, nightDirectionalColor=0xa0b0ff; // Bluish night directional
     const dayFogColor=0xc0d0e0, dayFogDensity=0.0003; // Light blueish day fog
     const nightFogColor=0x04060a, nightFogDensity=0.0008; // Dark blue/black night fog
     const dustFogColor=0xb09070, dustFogDensity=0.0015; // Brownish dust fog

     // Determine target values based on current state
     const targetAmbientIntensity = isNight ? nightAmbientIntensity : dayAmbientIntensity;
     const targetDirectionalIntensity = isNight ? nightDirectionalIntensity : dayDirectionalIntensity;
     const targetAmbientColor = isNight ? nightAmbientColor : dayAmbientColor;
     const targetDirectionalColor = isNight ? nightDirectionalColor : dayDirectionalColor;
     const targetGroundMaterial = isNight ? sharedMaterials.groundNight : sharedMaterials.groundDay;

     let targetFogDensity, targetFogColorHex;
     if(isDustStorm){
        targetFogDensity = dustFogDensity;
        targetFogColorHex = dustFogColor;
     } else if(isNight) {
        targetFogDensity = nightFogDensity;
        targetFogColorHex = nightFogColor;
     } else { // Day
        targetFogDensity = dayFogDensity;
        targetFogColorHex = dayFogColor;
     }

     // Smoothly interpolate current values towards targets
     const lerpAmount = 0.05; // Controls transition speed
     ambientLight.intensity = lerp(ambientLight.intensity, targetAmbientIntensity, lerpAmount);
     directionalLight.intensity = lerp(directionalLight.intensity, targetDirectionalIntensity, lerpAmount);
     ambientLight.color.lerp(_color.setHex(targetAmbientColor), lerpAmount);
     directionalLight.color.lerp(_color.setHex(targetDirectionalColor), lerpAmount);

     // Swap ground material instantly (lerping texture/color might be complex)
     if (groundPlane.material !== targetGroundMaterial) {
         groundPlane.material = targetGroundMaterial;
     }

     // Update fog
     if (!scene.fog) {
         scene.fog = new THREE.FogExp2(targetFogColorHex, targetFogDensity);
     } else {
         scene.fog.color.lerp(_color.setHex(targetFogColorHex), lerpAmount);
         scene.fog.density = lerp(scene.fog.density, targetFogDensity, lerpAmount);
     }

     // Update background color to match fog
     if (!scene.background || !(scene.background instanceof THREE.Color)) {
         scene.background = new THREE.Color(); // Initialize if needed
     }
     scene.background.lerp(_color.setHex(targetFogColorHex), lerpAmount);

     // Update particle system visibility
     if (rainSystem?.lines) rainSystem.lines.visible = isRaining;
     if (dustSystem?.particles) dustSystem.particles.visible = isDustStorm;
}

// Updates the muzzle flash point light effect
function _updateMuzzleFlash(localEffects, playerGroup) {
    if (!muzzleFlashLight || !clock) return;

    const flashState = localEffects?.muzzleFlash;
    const nowMs = clock.elapsedTime * 1000;

    // Check if flash is active and player group exists
    if (flashState?.active && nowMs < flashState.endTime && playerGroup) {
        muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; // Random intensity flicker

        // Position light at the gun's muzzle
        const gunMesh = playerGroup.userData.gunMesh;
        if (gunMesh) {
             // Position relative to gun mesh origin (adjust Z offset based on gun length)
            _vector3.set(0, 0, PLAYER_GUN_LENGTH / 2 + 5); // Forward along gun's local Z
            gunMesh.localToWorld(_vector3); // Convert local position to world space
            muzzleFlashLight.position.copy(_vector3);
        } else {
             muzzleFlashLight.intensity = 0; // Hide if gun mesh missing
        }
    }
    else { // Flash inactive or expired
        muzzleFlashLight.intensity = 0;
        if (flashState) flashState.active = false; // Ensure state is marked inactive
    }
}

/** Projects a 3D world position to 2D screen coordinates relative to the canvas. */
function _projectToScreen(worldPosition) {
    if (!camera || !renderer?.domElement || !domContainer) return null;

    try {
        // Use a temporary vector to avoid modifying the original
        _vector3.copy(worldPosition);
        // Project the world position into normalized device coordinates (NDC) [-1, 1]
        _vector3.project(camera);

        // Convert NDC to screen coordinates relative to the renderer's canvas
        const rect = domContainer.getBoundingClientRect(); // Get canvas position and size
        const widthHalf = rect.width / 2;
        const heightHalf = rect.height / 2;

        // Calculate screen coordinates (origin is top-left)
        const screenX = Math.round((_vector3.x * widthHalf) + widthHalf);
        const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); // Y is inverted

        // Check if the point is behind the camera (z > 1 in NDC)
        if (_vector3.z > 1.0) {
            return null; // Don't show points behind the camera
        }

        // Check if the point is outside the canvas bounds (optional, but good for culling)
         // if (screenX < 0 || screenX > rect.width || screenY < 0 || screenY > rect.height) {
         //     return null;
         // }

        return { screenX, screenY };
    } catch (e) {
        // console.error("Renderer Error during projection:", e);
        return null;
    }
}


// --- Public API ---
const Renderer3D = {
    /** Initializes the 3D renderer, scene, camera, and essential components. */
    init: (containerElement, initialWidth, initialHeight) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;

        // Use provided initial dimensions as fallback, but resize will override
        gameWidth = initialWidth || DEFAULT_GAME_WIDTH;
        gameHeight = initialHeight || DEFAULT_GAME_HEIGHT;
        cameraTargetPos.set(gameWidth / 2, 0, gameHeight / 2);

        try {
            // 1. Renderer Setup
            renderer = new THREE.WebGLRenderer({
                 antialias: true,
                 alpha: false, // Assuming opaque background is desired
                 // powerPreference: "high-performance" // Optional: Request high performance GPU
             });
            renderer.setPixelRatio(window.devicePixelRatio);
            // NOTE: Initial size is set by handleContainerResize later
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
            renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space
            domContainer.appendChild(renderer.domElement); // Add canvas to DOM

            // 2. Scene Setup
            scene = new THREE.Scene();
            // Initial background color, will be updated by _updateEnvironment
            scene.background = new THREE.Color(0x1a2a28);

            // 3. Camera Setup
            // Initialize with default aspect, handleContainerResize will correct it
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, DEFAULT_GAME_WIDTH / DEFAULT_GAME_HEIGHT, CAMERA_NEAR, CAMERA_FAR);
            // Set initial position based on defaults, will lerp towards calculated target
            camera.position.set(gameWidth / 2, CAMERA_BASE_Y, gameHeight / 2 + 300);
            camera.rotation.x = CAMERA_ANGLE; // Set initial downward angle
            scene.add(camera);

            // 4. Lighting Setup
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Initial day value
            scene.add(ambientLight);

            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Initial day value
            directionalLight.position.set(gameWidth * 0.3, 400, gameHeight * 0.4); // Position light source
            directionalLight.castShadow = true;
            // Configure shadow map quality and range
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            // Shadow camera bounds are set/updated in handleContainerResize
            directionalLight.shadow.bias = -0.002; // Adjust to prevent shadow acne
            // Set initial target (will be updated on resize)
            directionalLight.target.position.set(gameWidth / 2, 0, gameHeight / 2);
            scene.add(directionalLight);
            scene.add(directionalLight.target); // Target needs to be added explicitly

            // Muzzle Flash Light (Point Light)
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8); // Orangeish, Intensity 0 initially
            muzzleFlashLight.castShadow = false; // No shadows needed for this effect
            scene.add(muzzleFlashLight);

            // 5. Asset Creation
            _createAssets();
            _createGeometries();
            _createMaterials();

            // 6. Ground Plane
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.rotation.x = -Math.PI / 2; // Rotate flat on XZ plane
            groundPlane.receiveShadow = true; // Allow ground to receive shadows
            groundPlane.name = "GroundPlane";
            // Note: Scale and position are set by handleContainerResize
            scene.add(groundPlane);

            // 7. Initialize Particles & Instances & Other Systems
            _initParticlesAndInstances();
            _initCampfire();
            _initSnake();

            // 8. Clock
            clock = new THREE.Clock();

            // 9. Initial Resize and Scissor setup
            // Call resize handler to set correct initial size, aspect, viewport, scissor, etc.
            Renderer3D.handleContainerResize();
            // Schedule another resize shortly after to catch potential layout shifts
            setTimeout(() => {
                // console.log("Running delayed initial resize...");
                Renderer3D.handleContainerResize();
            }, 150);


        } catch (error) {
            console.error("Renderer Init Error:", error);
            Renderer3D.cleanup(); // Attempt cleanup on failure
            return false;
        }
        console.log("--- Renderer3D initialization complete ---");
        return true;
    },

    /** Handles resizing of the container element, updating renderer and camera. */
    handleContainerResize: () => {
        if (!renderer || !camera || !domContainer) return;
        const newWidth = domContainer.clientWidth;
        const newHeight = domContainer.clientHeight;

        // Prevent zero dimensions which cause errors
        if (newWidth <= 0 || newHeight <= 0) {
             console.warn("handleContainerResize: Invalid dimensions (<=0). Skipping update.");
             return;
        }

        // --- 1. Update Renderer Output ---
        renderer.setSize(newWidth, newHeight);

        // --- 2. Update Camera Projection ---
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix(); // Essential after changing aspect
        camera.clearViewOffset();         // <<< --- ADDED: Explicitly clear any view offset

        // --- 3. Update Viewport & Scissor ---
        // Ensure drawing occurs only within the canvas bounds
        renderer.setViewport(0, 0, newWidth, newHeight);
        renderer.setScissor(0, 0, newWidth, newHeight);
        renderer.setScissorTest(true); // Enable scissor test

        // --- 4. Update Internal Logical Dimensions & Camera Target ---
        // Make the logical game dimensions match the actual render dimensions
        gameWidth = newWidth;
        gameHeight = newHeight;
        cameraTargetPos.x = gameWidth / 2;
        cameraTargetPos.z = gameHeight / 2; // Game Y maps to World Z
        // --- DEBUG LOG ---
        console.log(`>>> Resize Set - Width: ${gameWidth.toFixed(0)}, Height: ${gameHeight.toFixed(0)}, TargetPos: (${cameraTargetPos.x.toFixed(0)}, ${cameraTargetPos.z.toFixed(0)})`);


        // --- 5. Update World Elements Dependent on Logical Dimensions ---
        if (groundPlane) {
            groundPlane.scale.set(gameWidth * GROUND_MARGIN, gameHeight * GROUND_MARGIN, 1);
            groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2); // Recenter ground
        }
        if (directionalLight?.target) {
            directionalLight.target.position.set(gameWidth / 2, 0, gameHeight / 2); // Update light target
        }
        if (directionalLight?.shadow?.camera) { // Update shadow camera frustum
            const shadowCamSizeX = gameWidth * GROUND_MARGIN * 0.55; // Base size on new dimensions
            const shadowCamSizeZ = gameHeight * GROUND_MARGIN * 0.55;
            directionalLight.shadow.camera.left = -shadowCamSizeX;
            directionalLight.shadow.camera.right = shadowCamSizeX;
            directionalLight.shadow.camera.top = shadowCamSizeZ; // Use Z for top/bottom in world space
            directionalLight.shadow.camera.bottom = -shadowCamSizeZ;
            directionalLight.shadow.camera.updateProjectionMatrix(); // Essential after changing bounds
        }

        // --- 6. Update Particle System Boundaries (if necessary) ---
        // Example: If rain/dust spawn logic needs updated bounds
        // (The current _updateRain/_updateDust reads gameWidth/Height directly, so no explicit update needed here)

         // --- 7. Update AppState (Optional but recommended) ---
         // Let the main application know the current canvas size
         if (window.appState) {
            window.appState.canvasWidth = newWidth;
            window.appState.canvasHeight = newHeight;
        }
    },

    /** Renders a single frame based on the provided game state. */
    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) {
             console.warn("RenderScene skipped: Prerequisites not met.");
             return;
        }
        const deltaTime = clock.getDelta();

        // --- 1. Update Camera ---
        // Position/LookAt now based on dimensions updated by handleContainerResize
        _updateCamera(deltaTime);

        // --- 2. Update Environment ---
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);

        // --- 3. Synchronize Scene Graph with Game State ---
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);

        // --- 4. Update Instanced Meshes & Particle Systems ---
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateActiveCasings(deltaTime);
        _updateHitSparks(deltaTime);
        _updateRain(deltaTime);
        _updateDust(deltaTime);
        _updateCampfire(deltaTime);
        _updateSnake(localEffects.snake); // Use snake data from localEffects (updated from server)

        // --- 5. Update Visual Effects ---
        _updateMuzzleFlash(localEffects, playerGroupMap[appState.localPlayerId]);

        // --- 6. Calculate UI Element Positions ---
        // Project world positions to screen space for HTML overlays
        const uiPositions = {};
        const projectEntity = (objMap, stateMap, yOffsetFn) => {
            for (const id in objMap) {
                const obj = objMap[id];
                const data = stateMap?.[id];
                if (obj?.visible && data) { // Check visibility
                    // Use object's current world position for projection
                    const worldPos = obj.position.clone();
                    // Apply specific Y offset calculation for the label anchor point
                    worldPos.y = yOffsetFn(data, obj);
                    const screenPos = _projectToScreen(worldPos);
                    if(screenPos) uiPositions[id] = screenPos;
                }
            }
        };
        // Define Y offset functions for different entity types (anchor points for UI labels)
        const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y + PLAYER_HEAD_RADIUS * 1.5 || PLAYER_TOTAL_HEIGHT;
        const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y + (d.type==='giant' ? ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER : ENEMY_HEAD_RADIUS)*1.2 || ENEMY_CHASER_HEIGHT;
        const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y + POWERUP_BASE_SIZE * 0.5 || Y_OFFSET_POWERUP;

        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY);
        projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY);
        projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);

        // Project damage text positions
        if (stateToRender.damage_texts) {
            for (const id in stateToRender.damage_texts) {
                const dt = stateToRender.damage_texts[id];
                // Project the base spawn position of the damage text
                const worldPos = _vector3.set(dt.x, PLAYER_TOTAL_HEIGHT * 0.8, dt.y); // Game Y -> World Z
                const screenPos = _projectToScreen(worldPos);
                if(screenPos) uiPositions[id] = screenPos;
            }
        }
        // Store calculated positions for the UI manager
        appState.uiPositions = uiPositions;

        // --- 7. Render ---
        try {
            renderer.setScissorTest(true); // Ensure scissor test is enabled before rendering
            renderer.render(scene, camera);
        } catch (e) {
            console.error("!!! RENDER ERROR !!!", e);
            // Stop game loop on critical render error
            if (window.appState?.animationFrameId) {
                cancelAnimationFrame(window.appState.animationFrameId);
                window.appState.animationFrameId = null;
                console.error("!!! Animation loop stopped due to render error. !!!");
            }
        }
    },

    /** Triggers a camera shake effect. */
    triggerShake: (magnitude, durationMs) => {
        if (!clock) return;
        const nowMs = clock.elapsedTime * 1000;
        const newEndTime = nowMs + durationMs;
        // Apply new shake if it's stronger or lasts longer than the current one
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(0.1, magnitude); // Use new magnitude (with minimum)
            shakeEndTime = Math.max(nowMs, newEndTime); // Extend end time if necessary
        }
    },

    /** Spawns a visual ammo casing effect. */
    spawnVisualAmmoCasing: (position, ejectVector) => {
        if (!clock) return; // Need clock for timing
        _spawnAmmoCasing(position, ejectVector);
    },

    /** Triggers visual hit sparks at a world position. */
    triggerVisualHitSparks: (position, count = 5) => {
        if (!clock) return; // Need clock for timing
        _triggerHitSparks(position, count);
    },

    /** Public access to the projection function if needed externally. */
    projectToScreen: (worldPosition) => {
        return _projectToScreen(worldPosition);
    },

    /** Cleans up all renderer resources. */
    cleanup: () => {
        console.log("--- Renderer3D Cleanup ---");

        // Dispose Particle Systems & Instanced Meshes
        [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(system => {
            if (system) {
                if(system.particles) scene?.remove(system.particles);
                if(system.lines) scene?.remove(system.lines);
                if(system.group) scene?.remove(system.group); // Campfire group
                system.geometry?.dispose();
                _disposeMaterialTextures(system.material); // Dispose particle textures
                system.material?.dispose();
            }
        });
        hitSparkSystem = null; rainSystem = null; dustSystem = null; campfireSystem = null;

        [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(mesh => {
            if (mesh) {
                scene?.remove(mesh);
                mesh.geometry?.dispose();
                 // InstancedMesh material is likely a shared one, disposed later
            }
        });
        playerBulletMesh = null; enemyBulletMesh = null; ammoCasingMesh = null;

        // Dispose Snake Mesh
        if (snakeMesh) {
            scene?.remove(snakeMesh);
            snakeMesh.geometry?.dispose();
            // Snake material is likely shared, disposed later
            snakeMesh = null;
        }

        // Dispose Scene Objects (Players, Enemies, Powerups)
        [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(objectMap => {
            for (const id in objectMap) {
                _disposeAndRemoveObject(objectMap[id], id, objectMap); // Use helper which calls _disposeObject3D
            }
        });

        // Dispose Shared Resources
        Object.values(sharedGeometries).forEach(geo => geo?.dispose());
        Object.values(powerupGeometries).forEach(geo => geo?.dispose());
        Object.values(sharedMaterials).forEach(mat => {
             if (mat instanceof THREE.Material) {
                 _disposeMaterialTextures(mat);
                 mat.dispose();
             }
        });
        if (sharedMaterials.powerups) {
            Object.values(sharedMaterials.powerups).forEach(mat => {
                 if (mat instanceof THREE.Material) {
                     _disposeMaterialTextures(mat);
                     mat.dispose();
                 }
            });
        }
        Object.values(loadedAssets).forEach(asset => asset?.dispose()); // Dispose loaded textures

        // Clear shared resource maps
        Object.keys(sharedGeometries).forEach(k=>delete sharedGeometries[k]);
        Object.keys(sharedMaterials).forEach(k=> { if (k !== 'powerups') delete sharedMaterials[k]; else delete sharedMaterials.powerups; });
        Object.keys(powerupGeometries).forEach(k=>delete powerupGeometries[k]);
        Object.keys(loadedAssets).forEach(k=>delete loadedAssets[k]);

        // Dispose Ground Plane
        if (groundPlane) {
            scene?.remove(groundPlane);
             _disposeObject3D(groundPlane); // Dispose its geometry/material (likely shared, but safe)
            groundPlane = null;
        }

        // Remove Lights
        if(scene) {
            if(ambientLight) scene.remove(ambientLight);
            if(directionalLight) scene.remove(directionalLight);
            if(directionalLight?.target) scene.remove(directionalLight.target);
            if(muzzleFlashLight) scene.remove(muzzleFlashLight);
        }
        // Lights themselves don't have dispose methods usually
        ambientLight = null; directionalLight = null; muzzleFlashLight = null;

        // Dispose Renderer and Context
        if (renderer) {
            console.log("Renderer: Disposing WebGL context...");
            renderer.dispose(); // Releases internal resources
            // Force loss of context to ensure GPU memory is freed (may be aggressive)
            // renderer.forceContextLoss();
            if (renderer.domElement?.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer = null;
            console.log("Renderer disposed.");
        }

        // Clear Core Variables
        scene = null; camera = null; clock = null; domContainer = null;
        playerBulletMatrices = []; enemyBulletMatrices = []; activeAmmoCasings = [];
        shakeMagnitude = 0; shakeEndTime = 0;

        console.log("Renderer3D resources released.");
    },

    // --- Getters for external use (if needed) ---
    getCamera: () => camera,
    getGroundPlane: () => groundPlane,
    getScene: () => scene, // Potentially useful for debugging
};

export default Renderer3D;
