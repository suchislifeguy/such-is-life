// Renderer3D.js
// Handles 3D scene setup, rendering, object management, and visual effects.

import * as THREE from 'three';
// #TODO: Future - Consider loading models (GLTFLoader) for Trees/Props

// --- Constants ---

// World & Camera Configuration
const WORLD_WIDTH = 2000;               // Fixed width of the playable world area
const WORLD_HEIGHT = 1500;              // Fixed height of the playable world area
const CAMERA_FOV = 60;                  // Camera field of view
const CAMERA_NEAR = 10;                 // Camera near clipping plane
const CAMERA_FAR = 3500;                // Camera far clipping plane (increased for larger world)
const CAMERA_HEIGHT_OFFSET = 950;       // How high above the lookAt target
const CAMERA_DISTANCE_OFFSET = 300;     // How far behind the lookAt target (along Z)
const CAMERA_LERP_FACTOR = 0.08;        // Smoothness of camera follow

// Instancing & Particle Limits
const MAX_PLAYER_BULLETS = 500;
const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150;
const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000;
const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80;
const MAX_SMOKE_PARTICLES = 60;         // Campfire Smoke

// Entity Visual Properties (Sizes, Radii, etc.)
const PLAYER_CAPSULE_RADIUS = 12;
const PLAYER_CAPSULE_HEIGHT = 24;
const PLAYER_TOTAL_HEIGHT = PLAYER_CAPSULE_HEIGHT + PLAYER_CAPSULE_RADIUS * 2;
const PLAYER_HEAD_RADIUS = 10;
const PLAYER_GUN_LENGTH = 25;
const PLAYER_GUN_RADIUS = 2;
const ENEMY_CHASER_WIDTH = 20;
const ENEMY_CHASER_HEIGHT = 40;
const ENEMY_CHASER_DEPTH = 14;
const ENEMY_SHOOTER_RADIUS = 12;
const ENEMY_SHOOTER_HEIGHT = 45;
const ENEMY_GUN_LENGTH = 25;
const ENEMY_GUN_RADIUS = 2.5;
const ENEMY_GIANT_MULTIPLIER = 2.5;
const ENEMY_HEAD_RADIUS = 8;
const POWERUP_BASE_SIZE = 18;
const BULLET_BASE_RADIUS = 2.5;
const BULLET_LENGTH = 15;
const CAMPFIRE_LOG_RADIUS = 5;
const CAMPFIRE_LOG_LENGTH = 40;
const CAMPFIRE_BASE_RADIUS = 25; // Area for flames/smoke spawn
const SNAKE_VISUAL_SEGMENTS = 40; // #TODO Phase X: Optimize Snake update method
const SNAKE_RADIUS = 6;
const BOUNDARY_WALL_HEIGHT = 60;
const BOUNDARY_WALL_DEPTH = 20;

// Particle Physics & Appearance
const AMMO_CASING_RADIUS = 0.6; const AMMO_CASING_LENGTH = 3.5;
const AMMO_CASING_GRAVITY = 980; const AMMO_CASING_BOUNCE = 0.3; const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500; const HIT_SPARK_BASE_LIFE = 0.2; const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150; const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.7; const FLAME_RAND_LIFE = 0.6; const FLAME_VEL_Y = 75; const FLAME_VEL_SPREAD = 25; const FLAME_SIZE_START = 18; const FLAME_SIZE_END = 10; // Flame size over life
const SMOKE_BASE_LIFE = 2.5; const SMOKE_RAND_LIFE = 1.5; const SMOKE_VEL_Y = 40; const SMOKE_VEL_SPREAD = 15; const SMOKE_SIZE_START = 25; const SMOKE_SIZE_END = 60; const SMOKE_OPACITY_START = 0.35; const SMOKE_OPACITY_END = 0.0; // Smoke params
const RAIN_SPEED_Y = -500; const RAIN_SPEED_Y_RAND = -200; const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40; const DUST_SPEED_Y = 8; const DUST_OPACITY = 0.15;

// Misc Timing & State
const FADE_OUT_DURATION = 0.35;
const PLAYER_STATUS_ALIVE = 'alive'; const PLAYER_STATUS_DOWN = 'down'; const PLAYER_STATUS_DEAD = 'dead';

// Y-Offsets (Based on origin at feet on the ground plane)
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS;
const Y_OFFSET_ENEMY_BODY = 0; // Assuming enemy origin is at feet
const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7;
const Y_OFFSET_BULLET = 10; // #TODO: Could be more dynamic based on shooter height
const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS;
const Y_OFFSET_SNAKE = SNAKE_RADIUS;
const Y_OFFSET_CASING = AMMO_CASING_RADIUS;
const Y_OFFSET_BOUNDARY = BOUNDARY_WALL_HEIGHT / 2;

// --- Module Scope Variables ---
let renderer, scene, camera, clock;
let ambientLight, directionalLight;
let domContainer;
let currentCanvasWidth = 0; // Set during init/resize
let currentCanvasHeight = 0; // Set during init/resize
let worldWidth = WORLD_WIDTH; // Can be overridden by server state
let worldHeight = WORLD_HEIGHT; // Can be overridden by server state

// Scene Objects
let groundPlane = null;
let boundariesGroup = null; // Group for boundary walls
const playerGroupMap = {};
const enemyGroupMap = {};
const powerupGroupMap = {};

// Instanced Meshes & Particles
let playerBulletMesh = null; let playerBulletMatrices = [];
let enemyBulletMesh = null;  let enemyBulletMatrices = [];
let ammoCasingMesh = null;   let activeAmmoCasings = [];
let hitSparkSystem = null;
let rainSystem = null;
let dustSystem = null;
let campfireSystem = null; // Includes flames, smoke, logs, light
let snakeMesh = null; // #TODO Phase X: Optimize Snake update method

// Effects
let muzzleFlashLight = null;
let screenShakeOffset = new THREE.Vector3(0, 0, 0);
let shakeMagnitude = 0;
let shakeEndTime = 0;

// Shared Resources
const sharedGeometries = {};
const sharedMaterials = {};
const powerupGeometries = {};
const loadedAssets = {}; // For textures, models etc.

// Reusable THREE objects to avoid allocations in loop
const _dummyObject = new THREE.Object3D();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();
const _vector3 = new THREE.Vector3();
const _cameraTargetWorldPos = new THREE.Vector3();
const _cameraDesiredPos = new THREE.Vector3();
const _worldCenter = new THREE.Vector3(); // Store world center

// --- Internal Helper Functions ---

/** Linearly interpolates between two values. */
function lerp(start, end, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return start + (end - start) * t;
}

/** Creates shared textures (e.g., procedural flame). */
function _createAssets() {
    console.log("Renderer: Creating assets...");
    try {
        // Flame Texture
        const flameCanvas = document.createElement('canvas'); flameCanvas.width = 64; flameCanvas.height = 64;
        const flameCtx = flameCanvas.getContext('2d'); if (!flameCtx) throw new Error("Failed to get 2D context for flame texture");
        const flameGradient = flameCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        flameGradient.addColorStop(0, 'rgba(255,220,150,1)'); flameGradient.addColorStop(0.4, 'rgba(255,150,0,0.8)'); flameGradient.addColorStop(1, 'rgba(200,0,0,0)');
        flameCtx.fillStyle = flameGradient; flameCtx.fillRect(0, 0, 64, 64);
        loadedAssets.flameTexture = new THREE.CanvasTexture(flameCanvas); loadedAssets.flameTexture.name = "FlameTexture";

        // Smoke Texture (Simple procedural)
        const smokeCanvas = document.createElement('canvas'); smokeCanvas.width = 64; smokeCanvas.height = 64;
        const smokeCtx = smokeCanvas.getContext('2d'); if (!smokeCtx) throw new Error("Failed to get 2D context for smoke texture");
        const smokeGradient = smokeCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        smokeGradient.addColorStop(0, 'rgba(200, 200, 200, 0.7)'); smokeGradient.addColorStop(0.6, 'rgba(150, 150, 150, 0.3)'); smokeGradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
        smokeCtx.fillStyle = smokeGradient; smokeCtx.fillRect(0, 0, 64, 64);
        loadedAssets.smokeTexture = new THREE.CanvasTexture(smokeCanvas); loadedAssets.smokeTexture.name = "SmokeTexture";

    } catch (error) { console.error("Renderer Error creating procedural textures:", error); }
    // #TODO Phase 2: Load 3D models for trees/props here
}

/** Creates shared geometries used by multiple objects. */
function _createGeometries() {
    console.log("Renderer: Creating geometries...");
    sharedGeometries.playerBody = new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HEIGHT, 4, 12);
    sharedGeometries.head = new THREE.SphereGeometry(1, 12, 8); // Unit sphere, scaled later
    sharedGeometries.playerGun = new THREE.CylinderGeometry(PLAYER_GUN_RADIUS, PLAYER_GUN_RADIUS * 0.8, PLAYER_GUN_LENGTH, 8);
    sharedGeometries.enemyChaserBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH, ENEMY_CHASER_HEIGHT, ENEMY_CHASER_DEPTH);
    sharedGeometries.enemyShooterBody = new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_HEIGHT, 10);
    sharedGeometries.enemyGiantBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_DEPTH * ENEMY_GIANT_MULTIPLIER);
    sharedGeometries.enemyGun = new THREE.CylinderGeometry(ENEMY_GUN_RADIUS, ENEMY_GUN_RADIUS * 0.7, ENEMY_GUN_LENGTH, 8);
    sharedGeometries.bullet = new THREE.CylinderGeometry(BULLET_BASE_RADIUS, BULLET_BASE_RADIUS * 0.8, BULLET_LENGTH, 8);
    sharedGeometries.bullet.rotateX(Math.PI / 2); // Align with Z forward
    sharedGeometries.ammoCasing = new THREE.CylinderGeometry(AMMO_CASING_RADIUS, AMMO_CASING_RADIUS, AMMO_CASING_LENGTH, 6);
    sharedGeometries.log = new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_LENGTH, 6);
    sharedGeometries.groundPlane = new THREE.PlaneGeometry(1, 1); // Scaled later
    sharedGeometries.boundaryWall = new THREE.BoxGeometry(1, BOUNDARY_WALL_HEIGHT, BOUNDARY_WALL_DEPTH); // Scaled later

    // Powerup Geometries
    const ps = POWERUP_BASE_SIZE;
    powerupGeometries.health = new THREE.TorusGeometry(ps * 0.4, ps * 0.15, 8, 16);
    powerupGeometries.gun_upgrade = new THREE.ConeGeometry(ps * 0.45, ps * 0.9, 4);
    powerupGeometries.speed_boost = new THREE.CylinderGeometry(ps * 0.6, ps * 0.6, ps * 0.25, 16);
    powerupGeometries.armor = new THREE.OctahedronGeometry(ps * 0.6, 0);
    powerupGeometries.ammo_shotgun = new THREE.BoxGeometry(ps * 0.8, ps * 0.8, ps * 0.8);
    powerupGeometries.ammo_heavy_slug = new THREE.SphereGeometry(ps * 0.6, 12, 8);
    powerupGeometries.ammo_rapid_fire = new THREE.TorusGeometry(ps * 0.4, ps * 0.1, 6, 12);
    powerupGeometries.bonus_score = new THREE.CylinderGeometry(ps * 0.35, ps * 0.35, ps * 0.5, 12);
    powerupGeometries.default = new THREE.BoxGeometry(ps * 0.9, ps * 0.9, ps * 0.9);
}

/** Creates shared materials. */
function _createMaterials() {
    console.log("Renderer: Creating materials...");
    sharedMaterials.playerBody = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.2, name: "PlayerBody" });
    sharedMaterials.playerHead = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: "PlayerHead" });
    sharedMaterials.playerGun = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: "PlayerGun" });
    sharedMaterials.playerDown = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6, metalness: 0.1, emissive: 0xccab00, emissiveIntensity: 0.5, name: "PlayerDown" });
    sharedMaterials.playerDead = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.0, name: "PlayerDead" });
    sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, metalness: 0.2, emissive: 0x331122, emissiveIntensity: 0.3, name: "PlayerSelfBody" });

    const enemyStandardProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 }; // Opacity needed for fade out
    sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemyStandardProps, name: "EnemyChaserBody" });
    sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemyStandardProps, name: "EnemyShooterBody" });
    sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 1.0, name: "EnemyGiantBody" });
    sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({ color: 0xBC8F8F, roughness: 0.7, name: "EnemyHead" });
    sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.6, metalness: 0.6, name: "EnemyGun" });

    sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: "PlayerBullet" });
    sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff4500, name: "EnemyBullet" });
    sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: "AmmoCasing" });

    // Powerup Materials
    sharedMaterials.powerupBase = { roughness: 0.6, metalness: 0.1, name: "PowerupDefault" }; // Base properties
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

    // Environment Materials
    sharedMaterials.groundDay = new THREE.MeshStandardMaterial({ color: 0x788a77, roughness: 0.9, metalness: 0.05, name: "GroundDay" });
    sharedMaterials.groundNight = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.85, metalness: 0.1, name: "GroundNight" });
    sharedMaterials.log = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: "Log" });
    sharedMaterials.boundary = new THREE.MeshStandardMaterial({ color: 0x4d443d, roughness: 0.8, metalness: 0.1, name: "BoundaryWall" }); // New boundary material
    sharedMaterials.snake = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide, name: "Snake" }); // #TODO Phase X: Optimize Snake

    // Particle Materials
    sharedMaterials.hitSpark = new THREE.PointsMaterial({ size: 10, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "HitSpark" });
    sharedMaterials.rainLine = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: "RainLine" });
    sharedMaterials.dustMote = new THREE.PointsMaterial({ size: 50, color: 0xd2b48c, transparent: true, opacity: DUST_OPACITY, sizeAttenuation: true, depthWrite: false, name: "DustMote" });
    sharedMaterials.flame = new THREE.PointsMaterial({ size: FLAME_SIZE_START, vertexColors: true, map: loadedAssets.flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "Flame" });
    sharedMaterials.smoke = new THREE.PointsMaterial({ size: SMOKE_SIZE_START, vertexColors: false, color: 0xaaaaaa, map: loadedAssets.smokeTexture, transparent: true, opacity: SMOKE_OPACITY_START, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, name: "Smoke" }); // Normal blending for smoke
}

/** Sets up instanced meshes and particle systems. */
function _initParticlesAndInstances() {
    if (!scene) { console.error("Renderer: Scene not ready for particle/instance init."); return; }
    console.log("Renderer: Initializing particles and instanced meshes...");

    // Player Bullets
    playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS);
    playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); playerBulletMesh.count = 0; playerBulletMesh.name = "PlayerBullets"; scene.add(playerBulletMesh); playerBulletMatrices = playerBulletMesh.instanceMatrix.array;

    // Enemy Bullets
    enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS);
    enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); enemyBulletMesh.count = 0; enemyBulletMesh.name = "EnemyBullets"; scene.add(enemyBulletMesh); enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array;

    // Ammo Casings
    ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS);
    ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ammoCasingMesh.castShadow = true; ammoCasingMesh.count = 0; ammoCasingMesh.name = "AmmoCasings"; scene.add(ammoCasingMesh); activeAmmoCasings = [];

    // Hit Sparks
    const sparkGeo = new THREE.BufferGeometry();
    const sparkP = new Float32Array(MAX_HIT_SPARKS * 3); const sparkC = new Float32Array(MAX_HIT_SPARKS * 3); const sparkA = new Float32Array(MAX_HIT_SPARKS);
    const sparkData = [];
    for (let i = 0; i < MAX_HIT_SPARKS; i++) { sparkP[i * 3 + 1] = -1e4; sparkA[i] = 0; sparkData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), a: 0.0, l: 0 }); }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkP, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkC, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkA, 1).setUsage(THREE.DynamicDrawUsage)); // Alpha needed for PointsMaterial transparency
    hitSparkSystem = { particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark), geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData };
    hitSparkSystem.particles.name = "HitSparks"; hitSparkSystem.particles.visible = false;
    scene.add(hitSparkSystem.particles);

    // Rain Lines
    const rainGeo = new THREE.BufferGeometry();
    const rainP = new Float32Array(MAX_RAIN_DROPS * 6); // 2 points per line * 3 coords
    const rainData = [];
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const x = Math.random() * worldWidth; const y = Math.random() * 1000 + 800; const z = Math.random() * worldHeight;
        rainP[i * 6 + 1] = -1e4; rainP[i * 6 + 4] = -1e4; // Initially hidden
        rainData.push({ x: x, y: y, z: z, s: RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND });
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3).setUsage(THREE.DynamicDrawUsage));
    rainSystem = { lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine), geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData };
    rainSystem.lines.visible = false; rainSystem.lines.name = "RainLines"; scene.add(rainSystem.lines);

    // Dust Motes
    const dustGeo = new THREE.BufferGeometry();
    const dustP = new Float32Array(MAX_DUST_MOTES * 3);
    const dustData = [];
    for (let i = 0; i < MAX_DUST_MOTES; i++) {
        dustP[i * 3 + 1] = -1e4; // Initially hidden
        dustData.push({
            p: new THREE.Vector3(Math.random() * worldWidth, Math.random() * 80 + 5, Math.random() * worldHeight),
            v: new THREE.Vector3((Math.random() - 0.5) * DUST_SPEED_XZ, (Math.random() - 0.5) * DUST_SPEED_Y, (Math.random() - 0.5) * DUST_SPEED_XZ)
        });
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustP, 3).setUsage(THREE.DynamicDrawUsage));
    dustSystem = { particles: new THREE.Points(dustGeo, sharedMaterials.dustMote), geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData };
    dustSystem.particles.visible = false; dustSystem.particles.name = "DustParticles"; scene.add(dustSystem.particles);
}

/** Creates the campfire object group including logs, light, and particles. */
function _initCampfire() {
    if (!scene) { console.error("Renderer: Scene not ready for campfire init."); return; }
    console.log("Renderer: Initializing campfire...");
    const group = new THREE.Group(); group.name = "CampfireGroup";

    // Logs
    const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log1.rotation.set(0, Math.PI / 10, Math.PI / 6); log1.castShadow = true; log1.position.set(-CAMPFIRE_LOG_LENGTH * 0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH * 0.2);
    const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log2.rotation.set(0, -Math.PI / 8, -Math.PI / 5); log2.castShadow = true; log2.position.set(CAMPFIRE_LOG_LENGTH * 0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH * 0.1);
    group.add(log1); group.add(log2);

    // Light Source
    const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0); // Color, Intensity, Distance, Decay
    glowLight.position.y = Y_OFFSET_CAMPFIRE + 15; glowLight.castShadow = true;
    glowLight.shadow.mapSize.width = 512; glowLight.shadow.mapSize.height = 512; glowLight.shadow.bias = -0.01; group.add(glowLight);

    // Flame Particles
    const flameGeo = new THREE.BufferGeometry();
    const flameP = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameC = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameS = new Float32Array(MAX_FLAME_PARTICLES); // Size attribute
    const flameData = [];
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { flameP[i * 3 + 1] = -1e4; flameS[i] = 0; flameData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), l: 0, bl: FLAME_BASE_LIFE + Math.random() * FLAME_RAND_LIFE, s: FLAME_SIZE_START }); }
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flameP, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameC, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('size', new THREE.BufferAttribute(flameS, 1).setUsage(THREE.DynamicDrawUsage)); // Use 'size' for PointsMaterial
    const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame); flameParticles.name = "CampfireFlames"; flameParticles.visible = false; group.add(flameParticles);

    // Smoke Particles
    const smokeGeo = new THREE.BufferGeometry();
    const smokeP = new Float32Array(MAX_SMOKE_PARTICLES * 3); const smokeA = new Float32Array(MAX_SMOKE_PARTICLES); const smokeS = new Float32Array(MAX_SMOKE_PARTICLES); // Alpha and Size
    const smokeData = [];
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) { smokeP[i * 3 + 1] = -1e4; smokeA[i] = 0; smokeS[i] = 0; smokeData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), a: 0.0, l: 0, bl: SMOKE_BASE_LIFE + Math.random() * SMOKE_RAND_LIFE, s: SMOKE_SIZE_START }); }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeP, 3).setUsage(THREE.DynamicDrawUsage));
    smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(smokeA, 1).setUsage(THREE.DynamicDrawUsage)); // Custom attribute for opacity control
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeS, 1).setUsage(THREE.DynamicDrawUsage));
    const smokeParticles = new THREE.Points(smokeGeo, sharedMaterials.smoke); smokeParticles.name = "CampfireSmoke"; smokeParticles.visible = false; group.add(smokeParticles);

    campfireSystem = { group: group, flameParticles: flameParticles, flameGeometry: flameGeo, flameMaterial: sharedMaterials.flame, flameData: flameData, smokeParticles: smokeParticles, smokeGeometry: smokeGeo, smokeMaterial: sharedMaterials.smoke, smokeData: smokeData, glowLight: glowLight };
    group.visible = false;
    scene.add(group);
}

/** Creates the visual boundary meshes. */
function _createBoundaries() {
    if (!scene) { console.error("Renderer: Scene not ready for boundaries init."); return; }
    console.log("Renderer: Creating boundaries...");
    boundariesGroup = new THREE.Group(); boundariesGroup.name = "Boundaries";
    const wallMaterial = sharedMaterials.boundary;
    const wallGeometry = sharedGeometries.boundaryWall;

    // Top Wall (positive Z)
    const wallTop = new THREE.Mesh(wallGeometry, wallMaterial);
    wallTop.scale.x = worldWidth + BOUNDARY_WALL_DEPTH * 2; // Extend slightly past corners
    wallTop.position.set(worldWidth / 2, Y_OFFSET_BOUNDARY, worldHeight + BOUNDARY_WALL_DEPTH / 2);
    wallTop.castShadow = true; wallTop.receiveShadow = true;
    boundariesGroup.add(wallTop);

    // Bottom Wall (negative Z / origin Z)
    const wallBottom = new THREE.Mesh(wallGeometry, wallMaterial);
    wallBottom.scale.x = worldWidth + BOUNDARY_WALL_DEPTH * 2;
    wallBottom.position.set(worldWidth / 2, Y_OFFSET_BOUNDARY, -BOUNDARY_WALL_DEPTH / 2);
    wallBottom.castShadow = true; wallBottom.receiveShadow = true;
    boundariesGroup.add(wallBottom);

    // Left Wall (negative X / origin X)
    const wallLeft = new THREE.Mesh(wallGeometry, wallMaterial);
    wallLeft.scale.x = worldHeight; // Use world height for the length
    wallLeft.rotation.y = Math.PI / 2; // Rotate to align along X axis
    wallLeft.position.set(-BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldHeight / 2);
    wallLeft.castShadow = true; wallLeft.receiveShadow = true;
    boundariesGroup.add(wallLeft);

    // Right Wall (positive X)
    const wallRight = new THREE.Mesh(wallGeometry, wallMaterial);
    wallRight.scale.x = worldHeight;
    wallRight.rotation.y = Math.PI / 2;
    wallRight.position.set(worldWidth + BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldHeight / 2);
    wallRight.castShadow = true; wallRight.receiveShadow = true;
    boundariesGroup.add(wallRight);

    scene.add(boundariesGroup);
}

/** Creates the snake mesh. #TODO: Phase X - Optimize update method. */
function _initSnake() {
    if (!scene) { console.error("Renderer: Scene not ready for snake init."); return; }
    console.log("Renderer: Initializing snake mesh...");
    // Create with a minimal dummy geometry initially
    const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0));
    const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false);
    snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake);
    snakeMesh.castShadow = true; snakeMesh.visible = false;
    snakeMesh.name = "Snake";
    scene.add(snakeMesh);
}

/** Creates a player group (visual representation). */
function _createPlayerGroup(playerData, isSelf) {
    const group = new THREE.Group(); group.name = `PlayerGroup_${playerData.id}`;
    const bodyMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
    // Use the shared material directly, only clone if/when needed (e.g., fade out)
    const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat);
    bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2; group.add(bodyMesh);

    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead);
    headMesh.scale.setScalar(PLAYER_HEAD_RADIUS); headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; headMesh.castShadow = true; group.add(headMesh);

    const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun);
    gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh);

    group.position.set(playerData.x, 0, playerData.y);
    // Store reference to the *shared* material currently assigned
    group.userData = { gameId: playerData.id, isPlayer: true, isSelf: isSelf, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentBodyMatRef: bodyMat, dyingStartTime: null };
    return group;
}

/** Creates an enemy group (visual representation). */
function _createEnemyGroup(enemyData) {
    const group = new THREE.Group(); group.name = `EnemyGroup_${enemyData.id}`;
    let bodyGeo, bodyMatRef, headScale, yBodyOffset, gunMesh = null;
    const enemyHeight = enemyData.height || ENEMY_CHASER_HEIGHT; // Use default if height missing

    switch (enemyData.type) {
        case 'shooter':
            bodyGeo = sharedGeometries.enemyShooterBody; bodyMatRef = sharedMaterials.enemyShooterBody; headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2;
            gunMesh = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun);
            gunMesh.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8); gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh);
            break;
        case 'giant':
            bodyGeo = sharedGeometries.enemyGiantBody; bodyMatRef = sharedMaterials.enemyGiantBody; headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8; yBodyOffset = enemyHeight / 2;
            break;
        case 'chaser': default:
            bodyGeo = sharedGeometries.enemyChaserBody; bodyMatRef = sharedMaterials.enemyChaserBody; headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2;
            break;
    }

    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMatRef); // Use shared material
    bodyMesh.castShadow = true; bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset; group.add(bodyMesh);

    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead);
    headMesh.scale.setScalar(headScale); headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; headMesh.castShadow = true; group.add(headMesh);

    group.position.set(enemyData.x, 0, enemyData.y);
    // Store reference to the *shared* material currently assigned
    group.userData = { gameId: enemyData.id, isEnemy: true, type: enemyData.type, bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh, currentBodyMatRef: bodyMatRef, dyingStartTime: null, health: enemyData.health };
    return group;
}

/** Creates a powerup group (visual representation). */
function _createPowerupGroup(powerupData) {
    const group = new THREE.Group(); group.name = `PowerupGroup_${powerupData.id}`;
    const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default;
    const material = (sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default);
    if (!material) { console.error(`Renderer Error: Could not find material for powerup type: ${powerupData.type}`); return null; }

    const iconMesh = new THREE.Mesh(geometry, material); // Use shared material
    iconMesh.castShadow = true; iconMesh.position.y = Y_OFFSET_POWERUP; iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); group.add(iconMesh);

    group.position.set(powerupData.x, 0, powerupData.y);
    group.userData = { gameId: powerupData.id, isPowerup: true, iconMesh: iconMesh };
    return group;
}

/** Disposes textures associated with a material. */
function _disposeMaterialTextures(material) {
    if (!material) return;
    const textures = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'displacementMap', 'envMap'];
    textures.forEach(prop => {
        if (material[prop] && material[prop] instanceof THREE.Texture) {
            // Only dispose textures we created procedurally or loaded, not shared internal ones
            if (Object.values(loadedAssets).includes(material[prop])) {
                material[prop].dispose();
            }
        }
    });
}

/** Disposes geometries and non-shared materials of an object and its children. */
function _disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
            child.geometry?.dispose(); // Dispose geometry

            // Dispose non-shared materials
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(m => {
                if (m) {
                    // Check if it's one of our explicitly shared materials
                    let isShared = Object.values(sharedMaterials).includes(m);
                    if (!isShared && sharedMaterials.powerups) {
                        isShared = Object.values(sharedMaterials.powerups).includes(m);
                    }
                    // If it's not shared, dispose its textures (if loaded by us) and the material itself
                    if (!isShared) {
                        _disposeMaterialTextures(m);
                        m.dispose();
                    }
                }
            });
        }
        // Lights managed separately (muzzle flash, campfire glow)
    });
}

/** Handles removal logic, including fade-out for enemies. */
function _handleObjectRemoval(obj, id, objectMap) {
    if (!obj || !scene || !clock) return;

    const userData = obj.userData;
    const isEnemy = userData?.isEnemy;
    const wasAlive = !userData?.dyingStartTime && (userData?.health === undefined || userData?.health > 0);

    // Start fade-out for living enemies being removed
    if (isEnemy && wasAlive && !userData.dyingStartTime) {
        userData.dyingStartTime = clock.elapsedTime;
        userData.health = 0; // Mark as dead logically
        // Ensure materials are cloned *now* if not already, and set to transparent
        obj.traverse(child => {
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat, index) => {
                    // Check if this mesh is using a shared material ref
                    let isShared = Object.values(sharedMaterials).includes(mat);
                     if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(m);

                    if (isShared) { // Clone *only* if currently shared
                        const clonedMat = mat.clone();
                        clonedMat.transparent = true;
                        clonedMat.needsUpdate = true;
                        if (Array.isArray(child.material)) child.material[index] = clonedMat;
                        else child.material = clonedMat;
                    } else { // Already unique (e.g., player status change), just set props
                         mat.transparent = true;
                         mat.needsUpdate = true;
                    }
                });
            }
        });
    }
    // Continue fade-out if already started
    else if (isEnemy && userData.dyingStartTime) {
        const timeElapsed = clock.elapsedTime - userData.dyingStartTime;
        const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION);
        const opacity = 1.0 - fadeProgress;

        obj.traverse(child => {
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(m => { m.opacity = opacity; }); // Update opacity on potentially cloned material
            }
        });

        // If fade complete, dispose and remove
        if (fadeProgress >= 1.0) {
            scene.remove(obj);
            _disposeObject3D(obj); // Dispose cloned materials too
            delete objectMap[id];
        }
    }
    // For non-enemies or already dead enemies, remove immediately
    else {
        scene.remove(obj);
        _disposeObject3D(obj);
        delete objectMap[id];
    }
}

/** Synchronizes scene objects based on server state. */
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) {
    if (!scene || !clock) return;
    const activeIds = new Set();

    if (state) {
        for (const id in state) {
            const data = state[id];
            // Basic validation
            if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;
            activeIds.add(id);

            let obj = objectMap[id];
            const isSelf = isSelfFn ? isSelfFn(id) : false;

            if (!obj) { // Object doesn't exist, create it
                obj = createFn(data, isSelf);
                if (obj) {
                    objectMap[id] = obj;
                    scene.add(obj);
                    updateFn(obj, data, 0, isSelf); // Initial update
                }
            } else { // Object exists, update it
                // Reset dying state if it reappears
                if (obj.userData?.dyingStartTime) {
                    obj.userData.dyingStartTime = null;
                    obj.visible = true;
                    // Revert material changes (opacity, transparency)
                    obj.traverse(child => {
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach((mat, index) => {
                                // Dispose cloned material if it exists
                                let isShared = Object.values(sharedMaterials).includes(mat);
                                if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(m);
                                if (!isShared) mat.dispose();

                                // Reassign the correct shared material reference
                                let correctSharedMat = null;
                                if(obj.userData.isPlayer) correctSharedMat = obj.userData.isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
                                else if(obj.userData.isEnemy) correctSharedMat = obj.userData.currentBodyMatRef; // Use stored ref
                                // #TODO: Handle head/gun materials too if they were cloned

                                if(correctSharedMat && child === obj.userData.bodyMesh) {
                                     if (Array.isArray(child.material)) child.material[index] = correctSharedMat;
                                     else child.material = correctSharedMat;
                                }
                                // Ensure non-body materials are reset if they were cloned
                                // (Simpler: just reset transparency/opacity on existing potentially-cloned mat)
                                mat.opacity = 1.0;
                                mat.transparent = false; // Or based on original shared material
                                mat.needsUpdate = true;
                            });
                        }
                    });
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

/** Updates a player group's position, rotation, and visual state. */
function _updatePlayerGroup(group, playerData, deltaTime, isSelf) {
    if (!group?.userData) return;

    // Position directly from server data (client uses renderedPlayerPos)
    group.position.x = playerData.x;
    group.position.z = playerData.y;

    const userData = group.userData;
    const bodyMesh = userData.bodyMesh;

    // Determine target material based on status
    let targetMatRef = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
    let shouldBeVisible = true;

    switch (playerData.player_status) {
        case PLAYER_STATUS_DOWN:
            targetMatRef = sharedMaterials.playerDown;
            break;
        case PLAYER_STATUS_DEAD:
            // We don't use playerDead material directly, group is hidden or removed
            shouldBeVisible = false;
            userData.dyingStartTime = null; // Ensure dying state is cleared if server says dead
            break;
        case PLAYER_STATUS_ALIVE:
        default:
            // Target material already set correctly
            break;
    }

    group.visible = shouldBeVisible;

    // Update material only if it changed *and* player is alive/down
    if (bodyMesh && userData.currentBodyMatRef !== targetMatRef && shouldBeVisible) {
        // If previous material was cloned (e.g. playerDown), dispose it? No, playerDown is shared.
        userData.currentBodyMatRef = targetMatRef;
        bodyMesh.material = targetMatRef; // Assign shared ref directly
        // No need to clone unless we need unique opacity/props later
    }

    // Aiming rotation (only apply if player is active)
    if (shouldBeVisible && isSelf && window.appState?.localPlayerAimState) {
        const { lastAimDx, lastAimDy } = window.appState.localPlayerAimState;
        group.rotation.y = Math.atan2(lastAimDx, lastAimDy);
    } else if (shouldBeVisible && !isSelf && playerData.aim_dx !== undefined && playerData.aim_dy !== undefined) {
        // Rotate other players based on server aim data
        group.rotation.y = Math.atan2(playerData.aim_dx, playerData.aim_dy);
    }
}

/** Updates an enemy group's position, rotation, and visual state. */
function _updateEnemyGroup(group, enemyData, deltaTime) {
    if (!group?.userData || group.userData.dyingStartTime || !clock) return; // Ignore if fading out

    // Position & Health Update
    group.position.x = enemyData.x;
    group.position.z = enemyData.y;
    group.userData.health = enemyData.health; // Update health for potential removal logic

    // Shooter Aiming
    const gunMesh = group.userData.gunMesh;
    if (enemyData.type === 'shooter' && gunMesh && enemyData.aim_dx !== undefined && enemyData.aim_dy !== undefined) {
        group.rotation.y = Math.atan2(enemyData.aim_dx, enemyData.aim_dy);
    }

    // Giant Windup Visual Cue
    const bodyMesh = group.userData.bodyMesh;
    if (bodyMesh && enemyData.type === 'giant') {
        const isWindingUp = enemyData.attack_state === 'winding_up';
        const scaleTarget = isWindingUp ? 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05 : 1.0;
        // Lerp scale smoothly
        bodyMesh.scale.lerp(_vector3.set(scaleTarget, scaleTarget, scaleTarget), 0.2);
    }
}

/** Updates a powerup group's animation. */
function _updatePowerupGroup(group, powerupData, deltaTime) {
    if (!group?.userData || !clock) return;

    // Position is set by sync function
    group.position.x = powerupData.x;
    group.position.z = powerupData.y;

    // Bobbing and Rotating Animation
    const iconMesh = group.userData.iconMesh;
    if (iconMesh) {
        // Use group ID for slight offset in bobbing phase
        const bobOffset = (parseInt(group.userData.gameId, 16) % 100) / 100.0 * Math.PI * 2; // Pseudo-random phase
        iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + bobOffset) * 4;
        iconMesh.rotation.y += 0.015; // Constant rotation
    }
}

/** Updates an instanced mesh based on the state object. */
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) {
    if (!mesh) return;
    if (!state || Object.keys(state).length === 0) {
        mesh.count = 0;
        mesh.instanceMatrix.needsUpdate = true;
        return;
    }

    let visibleCount = 0;
    const maxCount = matrices.length / 16; // Max instances based on buffer size

    for (const id in state) {
        if (visibleCount >= maxCount) {
            console.warn(`Renderer: Exceeded max instances (${maxCount}) for mesh ${mesh.name}.`);
            break;
        }
        const data = state[id];

        // Filter bullets based on owner type vs mesh type
        if (isBullet) {
            const isPlayerBullet = data.owner_type === 'player';
            if (mesh === playerBulletMesh && !isPlayerBullet) continue; // Skip enemy bullet for player mesh
            if (mesh === enemyBulletMesh && isPlayerBullet) continue;  // Skip player bullet for enemy mesh
        }

        if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue; // Skip invalid data

        _position.set(data.x, yOffset, data.y);

        // Set rotation for bullets based on velocity
        if (isBullet && data.vx !== undefined && data.vy !== undefined && (data.vx !== 0 || data.vy !== 0)) {
            const angle = Math.atan2(data.vx, data.vy);
            _quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
        } else {
            _quaternion.identity(); // Default rotation if no velocity
        }

         _scale.set(1, 1, 1); // Assuming uniform scale
        _matrix.compose(_position, _quaternion, _scale);
        mesh.setMatrixAt(visibleCount, _matrix);
        visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
}

/** Updates physics and position for active ammo casings. */
function _updateActiveCasings(deltaTime) {
    if (!ammoCasingMesh || !clock) return;
    if (activeAmmoCasings.length === 0) {
        if (ammoCasingMesh.count > 0) { // Ensure mesh count is zero if no active casings
            ammoCasingMesh.count = 0;
            ammoCasingMesh.instanceMatrix.needsUpdate = true;
        }
        return;
    }

    const now = clock.elapsedTime;
    let needsUpdate = false;

    // Filter out expired casings and update physics for active ones
    activeAmmoCasings = activeAmmoCasings.filter(casing => {
        if (now > casing.endTime) return false; // Remove expired

        // Apply gravity
        casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime;
        // Update position
        casing.position.addScaledVector(casing.velocity, deltaTime);
        // Update rotation
        casing.rotation += casing.rotationSpeed * deltaTime;

        // Ground collision and bounce
        if (casing.position.y <= Y_OFFSET_CASING) {
            casing.position.y = Y_OFFSET_CASING; // Clamp to ground
            casing.velocity.y *= -AMMO_CASING_BOUNCE; // Reverse and dampen Y velocity
            // Apply drag/friction on bounce
            casing.velocity.x *= (1.0 - AMMO_CASING_DRAG);
            casing.velocity.z *= (1.0 - AMMO_CASING_DRAG);
            casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0);

            // Stop tiny bounces/rotations
            if (Math.abs(casing.velocity.y) < 5) casing.velocity.y = 0;
            if (Math.abs(casing.rotationSpeed) < 0.1) casing.rotationSpeed = 0;
        }
        return true; // Keep active
    });

    // Update InstancedMesh matrices
    let visibleCount = 0;
    const maxCount = ammoCasingMesh.instanceMatrix.array.length / 16;

    for (let i = 0; i < activeAmmoCasings.length; i++) {
        if (visibleCount >= maxCount) break;
        const casing = activeAmmoCasings[i];
        // Set rotation (casings usually eject sideways, rotate around Y primarily)
        _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0)); // Adjust Euler order if needed
        _matrix.compose(casing.position, _quaternion, _scale);
        ammoCasingMesh.setMatrixAt(visibleCount, _matrix);
        visibleCount++;
        needsUpdate = true; // Need to update if any casings are active
    }

    // Update mesh count if it changed
    if (ammoCasingMesh.count !== visibleCount) {
        ammoCasingMesh.count = visibleCount;
        needsUpdate = true;
    }

    if (needsUpdate) {
        ammoCasingMesh.instanceMatrix.needsUpdate = true;
    }
}

/** Spawns a single visual ammo casing particle. */
function _spawnAmmoCasing(spawnPos, ejectVec) {
    if (!ammoCasingMesh || !clock || activeAmmoCasings.length >= MAX_AMMO_CASINGS) return;

    const now = clock.elapsedTime;
    const life = 1.5 + Math.random() * 1.0; // Lifetime of the casing

    // Calculate ejection direction (perpendicular to aim, with randomness)
    const ejectAngle = Math.atan2(ejectVec.z, ejectVec.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5; // 90 degrees + variance
    const ejectSpeed = 150 + Math.random() * 80; // Horizontal speed
    const upSpeed = 50 + Math.random() * 40; // Vertical speed
    const rotationSpeed = (Math.random() - 0.5) * 20; // Tumbling speed

    // Calculate spawn offset from player center based on eject angle
    const spawnOffsetX = Math.cos(ejectAngle) * 5;
    const spawnOffsetZ = Math.sin(ejectAngle) * 5;
    const spawnY = spawnPos.y + PLAYER_TOTAL_HEIGHT * 0.6; // Approx gun height

    activeAmmoCasings.push({
        position: new THREE.Vector3(spawnPos.x + spawnOffsetX, spawnY, spawnPos.z + spawnOffsetZ),
        velocity: new THREE.Vector3(Math.cos(ejectAngle) * ejectSpeed, upSpeed, Math.sin(ejectAngle) * ejectSpeed),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: rotationSpeed,
        startTime: now,
        endTime: now + life
    });
}

/** Updates hit spark particle system. */
function _updateHitSparks(deltaTime) {
    if (!hitSparkSystem || !clock) return;

    const positions = hitSparkSystem.geometry.attributes.position.array;
    const colors = hitSparkSystem.geometry.attributes.color.array;
    const alphas = hitSparkSystem.geometry.attributes.alpha.array; // Use alpha attribute
    const data = hitSparkSystem.data;
    let needsGeomUpdate = false;
    let activeCount = 0;

    for (let i = 0; i < MAX_HIT_SPARKS; i++) {
        const p = data[i];
        if (p.l > 0) { // If particle is alive
            p.l -= deltaTime; // Decrease lifetime
            activeCount++;

            if (p.l <= 0) { // Particle died this frame
                alphas[i] = 0.0; // Hide it
                positions[i * 3 + 1] = -10000; // Move offscreen (belt and braces)
            } else {
                // Apply physics
                p.v.y -= HIT_SPARK_GRAVITY * deltaTime;
                p.p.addScaledVector(p.v, deltaTime);
                // Update alpha based on remaining life (fade out)
                p.a = Math.min(1.0, Math.max(0, (p.l / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5)); // Slightly faster fade
                alphas[i] = p.a;
                // Update buffer attributes
                positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z;
                colors[i * 3 + 0] = p.c.r; colors[i * 3 + 1] = p.c.g; colors[i * 3 + 2] = p.c.b;
            }
            needsGeomUpdate = true;
        } else if (alphas[i] > 0) { // Ensure dead particles are marked as fully transparent
            alphas[i] = 0.0;
            positions[i * 3 + 1] = -10000; // Move offscreen
            needsGeomUpdate = true;
        }
    }

    if (needsGeomUpdate) {
        hitSparkSystem.geometry.attributes.position.needsUpdate = true;
        hitSparkSystem.geometry.attributes.color.needsUpdate = true;
        hitSparkSystem.geometry.attributes.alpha.needsUpdate = true;
    }
    hitSparkSystem.particles.visible = activeCount > 0;
}

/** Triggers a burst of hit sparks at a given position. */
function _triggerHitSparks(position, count = 5) {
    if (!hitSparkSystem || !clock) return;
    const data = hitSparkSystem.data;
    let spawned = 0;

    for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) {
        if (data[i].l <= 0) { // Find an inactive particle
            const p = data[i];
            p.p.copy(position); // Set spawn position

            // Calculate random velocity (spherical spread)
            const angle = Math.random() * Math.PI * 2;
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; // Up/down spread
            const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD;
            p.v.set(
                Math.cos(angle) * Math.cos(spreadAngle) * speed,
                Math.sin(spreadAngle) * speed * 1.5 + 30, // Bias upwards slightly
                Math.sin(angle) * Math.cos(spreadAngle) * speed
            );
            // Set initial properties
            p.c.setRGB(1, 0.2 + Math.random() * 0.3, 0); // Orange/yellow sparks
            p.a = 1.0; // Start fully visible (alpha)
            p.l = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE; // Set lifetime
            spawned++;
        }
    }
    if (spawned > 0) hitSparkSystem.particles.visible = true; // Ensure system is visible
}

/** Updates rain particle system. */
function _updateRain(deltaTime) {
    if (!rainSystem || !rainSystem.lines.visible) { return; }

    const positions = rainSystem.geometry.attributes.position.array;
    const data = rainSystem.data;
    let needsUpdate = false;

    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const p = data[i];
        p.y += p.s * deltaTime; // Move down based on speed

        // If drop goes below ground, reset position to top within world bounds
        if (p.y < -50) {
            p.x = Math.random() * worldWidth;
            p.y = Math.random() * 500 + 1000; // Reset high above
            p.z = Math.random() * worldHeight;
            p.s = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND; // Reset speed
        }

        // Update line segment vertices
        const idx = i * 6;
        positions[idx + 0] = p.x; positions[idx + 1] = p.y; positions[idx + 2] = p.z; // Top point
        positions[idx + 3] = p.x; positions[idx + 4] = p.y - RAIN_STREAK_LENGTH; positions[idx + 5] = p.z; // Bottom point
        needsUpdate = true;
    }
    if (needsUpdate) rainSystem.geometry.attributes.position.needsUpdate = true;
}

/** Updates dust mote particle system. */
function _updateDust(deltaTime) {
     if (!dustSystem || !dustSystem.particles.visible || !camera) { return; }

     const positions = dustSystem.geometry.attributes.position.array;
     const data = dustSystem.data;
     let needsUpdate = false;

     for (let i = 0; i < MAX_DUST_MOTES; i++) {
         const p = data[i];
         p.p.addScaledVector(p.v, deltaTime); // Update position based on velocity

         // Wrap around world boundaries
         if (p.p.x < 0) p.p.x += worldWidth; else if (p.p.x > worldWidth) p.p.x -= worldWidth;
         if (p.p.z < 0) p.p.z += worldHeight; else if (p.p.z > worldHeight) p.p.z -= worldHeight;

         // Keep Y position within a certain range (slight random drift)
         p.p.y += (Math.random() - 0.5) * DUST_SPEED_Y * deltaTime;
         p.p.y = Math.max(5, Math.min(80, p.p.y)); // Clamp Y

         // Update buffer
         positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z;
         needsUpdate = true;
     }
     if (needsUpdate) dustSystem.geometry.attributes.position.needsUpdate = true;
}

/** Updates flame particle system. */
function _updateCampfireFlames(deltaTime) {
    if (!campfireSystem || !campfireSystem.group.visible || !clock) return;

    const positions = campfireSystem.flameGeometry.attributes.position.array;
    const colors = campfireSystem.flameGeometry.attributes.color.array;
    const sizes = campfireSystem.flameGeometry.attributes.size.array; // Use size attribute
    const data = campfireSystem.flameData;
    let needsGeomUpdate = false;
    let activeCount = 0;

    // Spawn new particles
    const spawnRate = 150; // Particles per second
    const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random())); // Add randomness
    let spawned = 0;
    for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) {
        if (data[i].l <= 0) { // Find inactive particle
            const p = data[i];
            // Spawn within base radius
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.8; // Spawn slightly inwards
            p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 2, Math.sin(angle) * radius);
            // Initial velocity (mostly upwards, slight spread)
            p.v.set(
                (Math.random() - 0.5) * FLAME_VEL_SPREAD,
                FLAME_VEL_Y + Math.random() * 30,
                (Math.random() - 0.5) * FLAME_VEL_SPREAD
            );
            p.l = p.bl; // Reset lifetime
            p.s = FLAME_SIZE_START; // Reset size
            p.c.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); // Initial color (yellow/orange)
            spawned++;
        }
    }

    // Update active particles
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        const p = data[i];
        if (p.l > 0) { // If particle is alive
            p.l -= deltaTime;
            activeCount++;

            if (p.l <= 0) { // Particle died
                sizes[i] = 0; // Hide it by setting size to 0
                positions[i * 3 + 1] = -10000; // Move offscreen
            } else {
                // Apply physics (simple upward drift with slight randomness)
                p.v.y += (Math.random() - 0.4) * 20 * deltaTime; // Tend upwards
                p.v.x *= 0.97; p.v.z *= 0.97; // Horizontal drag
                p.p.addScaledVector(p.v, deltaTime);

                // Update size and color over lifetime
                const lifeRatio = Math.max(0, p.l / p.bl);
                p.s = lerp(FLAME_SIZE_END, FLAME_SIZE_START, lifeRatio); // Lerp size
                p.c.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); // Lerp color towards red
                sizes[i] = p.s;

                // Update buffer attributes
                positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z;
                colors[i * 3 + 0] = p.c.r; colors[i * 3 + 1] = p.c.g; colors[i * 3 + 2] = p.c.b;
            }
            needsGeomUpdate = true;
        } else if (sizes[i] > 0) { // Ensure dead particles have size 0
            sizes[i] = 0;
            positions[i * 3 + 1] = -10000;
            needsGeomUpdate = true;
        }
    }

    if (needsGeomUpdate) {
        campfireSystem.flameGeometry.attributes.position.needsUpdate = true;
        campfireSystem.flameGeometry.attributes.color.needsUpdate = true;
        campfireSystem.flameGeometry.attributes.size.needsUpdate = true;
    }
     campfireSystem.flameParticles.visible = activeCount > 0;
}

/** Updates smoke particle system. */
function _updateCampfireSmoke(deltaTime) {
    if (!campfireSystem || !campfireSystem.group.visible || !clock) return;

    const positions = campfireSystem.smokeGeometry.attributes.position.array;
    const alphas = campfireSystem.smokeGeometry.attributes.alpha.array;
    const sizes = campfireSystem.smokeGeometry.attributes.size.array;
    const data = campfireSystem.smokeData;
    let needsGeomUpdate = false;
    let activeCount = 0;

    // Spawn new particles
    const spawnRate = 80; // Smoke particles per second
    const numToSpawn = Math.floor(spawnRate * deltaTime * (0.6 + Math.random()));
    let spawned = 0;
    for (let i = 0; i < MAX_SMOKE_PARTICLES && spawned < numToSpawn; i++) {
        if (data[i].l <= 0) { // Find inactive particle
            const p = data[i];
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.6; // Spawn near center
            p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 5, Math.sin(angle) * radius);
            p.v.set(
                (Math.random() - 0.5) * SMOKE_VEL_SPREAD,
                SMOKE_VEL_Y + Math.random() * 15, // Slower rise than flame
                (Math.random() - 0.5) * SMOKE_VEL_SPREAD
            );
            p.l = p.bl; // Reset lifetime
            p.s = SMOKE_SIZE_START; // Reset size
            p.a = SMOKE_OPACITY_START * (0.8 + Math.random() * 0.4); // Initial alpha with variance
            spawned++;
        }
    }

    // Update active particles
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
        const p = data[i];
        if (p.l > 0) {
            p.l -= deltaTime;
            activeCount++;

            if (p.l <= 0) {
                alphas[i] = 0.0; sizes[i] = 0;
                positions[i * 3 + 1] = -10000;
            } else {
                // Apply physics (slow rise, spread out)
                p.v.y += (Math.random() - 0.45) * 5 * deltaTime; // Slow upward acceleration
                p.v.x += (Math.random() - 0.5) * 8 * deltaTime; // Spread horizontally
                p.v.z += (Math.random() - 0.5) * 8 * deltaTime;
                p.v.multiplyScalar(0.98); // Air drag
                p.p.addScaledVector(p.v, deltaTime);

                // Update size and alpha over lifetime
                const lifeRatio = Math.max(0, p.l / p.bl);
                p.s = lerp(SMOKE_SIZE_END, SMOKE_SIZE_START, lifeRatio); // Grow larger
                p.a = lerp(SMOKE_OPACITY_END, SMOKE_OPACITY_START, lifeRatio * lifeRatio); // Fade out (quadratic)
                sizes[i] = p.s;
                alphas[i] = p.a;

                // Update buffer attributes
                positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z;
            }
            needsGeomUpdate = true;
        } else if (alphas[i] > 0) {
            alphas[i] = 0.0; sizes[i] = 0;
            positions[i * 3 + 1] = -10000;
            needsGeomUpdate = true;
        }
    }

    if (needsGeomUpdate) {
        campfireSystem.smokeGeometry.attributes.position.needsUpdate = true;
        campfireSystem.smokeGeometry.attributes.alpha.needsUpdate = true; // Update custom alpha
        campfireSystem.smokeGeometry.attributes.size.needsUpdate = true;
    }
    // Update material opacity based on average alpha (or just use vertex alpha if supported well)
    // For simplicity, let's control overall opacity via material property if needed,
    // but vertex alpha control is better if the shader supports it.
    // We'll rely on vertex alpha via the custom attribute for now.
    campfireSystem.smokeParticles.visible = activeCount > 0;
}

/** Updates the entire campfire system (position, light, particles). */
function _updateCampfire(deltaTime) {
    if (!campfireSystem || !clock) return;

    // Update visibility and position based on server state
    const cfData = window.appState?.serverState?.campfire;
    const isActive = cfData?.active ?? false;
    campfireSystem.group.visible = isActive;

    if (isActive) {
        campfireSystem.group.position.set(cfData.x, 0, cfData.y);
        // Update light flicker
        if (campfireSystem.glowLight) {
            campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0 + Math.random()*0.5) * 0.8; // Added randomness
        }
        // Update flame and smoke particles
        _updateCampfireFlames(deltaTime);
        _updateCampfireSmoke(deltaTime);
    } else {
        // Ensure particles are marked invisible if campfire is off
        campfireSystem.flameParticles.visible = false;
        campfireSystem.smokeParticles.visible = false;
        if (campfireSystem.glowLight) campfireSystem.glowLight.intensity = 0;
    }
}

/** Updates the snake mesh geometry based on server data. #TODO: Optimize this. */
function _updateSnake(snakeData) {
    if (!snakeMesh) { return; }
    const isActive = snakeData?.active ?? false;
    snakeMesh.visible = isActive;

    if (isActive && snakeData.segments && snakeData.segments.length > 1) {
        const points = snakeData.segments.map(seg => _vector3.set(seg.x, Y_OFFSET_SNAKE, seg.y));

        if (points.length >= 2) {
            try {
                // --- INEFFICIENT METHOD - REPLACE LATER ---
                const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
                const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2); // Sample more points for smoothness
                if (tubePoints.length >= 2) {
                    const newGeometry = new THREE.TubeGeometry(
                        new THREE.CatmullRomCurve3(tubePoints), // Use sampled points for tube path
                        tubePoints.length - 1, // Segments along path
                        SNAKE_RADIUS,
                        6, // Radial segments
                        false // Closed?
                    );
                    snakeMesh.geometry.dispose(); // Dispose old geometry
                    snakeMesh.geometry = newGeometry; // Assign new geometry
                    snakeMesh.visible = true;
                } else {
                    snakeMesh.visible = false; // Not enough points for a tube
                }
                // --- END INEFFICIENT METHOD ---
                // #TODO Phase X: Replace above block with geometry attribute update method
            } catch (e) {
                console.error("Renderer Error updating snake geometry:", e);
                snakeMesh.visible = false;
            }
        } else {
            snakeMesh.visible = false; // Need at least 2 segments
        }
    } else {
        snakeMesh.visible = false; // Not active or no segments
    }
}

/** Updates lighting, fog, and weather effects based on environment state. */
function _updateEnvironment(isNight, isRaining, isDustStorm) {
     if (!scene || !ambientLight || !directionalLight || !groundPlane || !clock) return;

     // Target values based on conditions
     const dayAI = 0.7, nightAI = 0.45; const dayDI = 1.2, nightDI = 0.7;
     const dayAC = 0xffffff, nightAC = 0x7080a0; const dayDC = 0xffffff, nightDC = 0xa0b0ff;
     const dayFogC = 0xc0d0e0, dayFogD = 0.0003;
     const nightFogC = 0x04060a, nightFogD = 0.0008;
     const dustFogC = 0xb09070, dustFogD = 0.0015;

     const targetAI = isNight ? nightAI : dayAI;
     const targetDI = isNight ? nightDI : dayDI;
     const targetAC = isNight ? nightAC : dayAC;
     const targetDC = isNight ? nightDC : dayDC;
     const targetGM = isNight ? sharedMaterials.groundNight : sharedMaterials.groundDay;

     let targetFD, targetFC;
     if (isDustStorm) { targetFD = dustFogD; targetFC = dustFogC; }
     else if (isNight) { targetFD = nightFogD; targetFC = nightFogC; }
     else { targetFD = dayFogD; targetFC = dayFogC; }

     // Smoothly interpolate lighting and fog
     const lerpA = 0.05; // Lerp amount for smooth transition
     ambientLight.intensity = lerp(ambientLight.intensity, targetAI, lerpA);
     directionalLight.intensity = lerp(directionalLight.intensity, targetDI, lerpA);
     ambientLight.color.lerp(_color.setHex(targetAC), lerpA);
     directionalLight.color.lerp(_color.setHex(targetDC), lerpA);

     // Update ground material instantly (no lerp needed for material swap)
     if (groundPlane.material !== targetGM) groundPlane.material = targetGM;

     // Update fog
     if (!scene.fog) {
         scene.fog = new THREE.FogExp2(targetFC, targetFD); // Initialize fog if it doesn't exist
     } else {
         scene.fog.color.lerp(_color.setHex(targetFC), lerpA);
         scene.fog.density = lerp(scene.fog.density, targetFD, lerpA);
     }

     // Update scene background color to match fog
     if (!scene.background || !(scene.background instanceof THREE.Color)) {
         scene.background = new THREE.Color();
     }
     scene.background.lerp(_color.setHex(targetFC), lerpA);

     // Update visibility of weather particle systems
     if (rainSystem?.lines) rainSystem.lines.visible = isRaining;
     if (dustSystem?.particles) dustSystem.particles.visible = isDustStorm;
}

/** Updates the muzzle flash light effect. */
function _updateMuzzleFlash(localEffects, playerGroup) {
    if (!muzzleFlashLight || !clock) return;
    const flashState = localEffects?.muzzleFlash;
    const nowMs = clock.elapsedTime * 1000;

    if (flashState?.active && nowMs < flashState.endTime && playerGroup) {
        muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; // Flicker intensity
        const gunMesh = playerGroup.userData.gunMesh;
        if (gunMesh) {
            // Position flash slightly in front of the gun mesh
            _vector3.set(0, 0, PLAYER_GUN_LENGTH / 2 + 5); // Offset from gun center along its local Z
            gunMesh.localToWorld(_vector3); // Convert local offset to world position
            muzzleFlashLight.position.copy(_vector3);
        } else {
            muzzleFlashLight.intensity = 0; // Cannot position without gun mesh
        }
    } else {
        muzzleFlashLight.intensity = 0; // Turn off light
        if (flashState) flashState.active = false; // Ensure state reflects light off
    }
}

/** Projects a 3D world position to 2D screen coordinates. */
function _projectToScreen(worldPosition) {
    if (!camera || !renderer?.domElement || !domContainer) return null;

    try {
        _vector3.copy(worldPosition);
        _vector3.project(camera); // Project world coords to Normalized Device Coords (-1 to +1)

        // Check if behind the camera
        if (_vector3.z > 1.0) return null;

        // Convert NDC to screen coordinates
        const rect = domContainer.getBoundingClientRect();
        const widthHalf = rect.width / 2;
        const heightHalf = rect.height / 2;
        const screenX = Math.round((_vector3.x * widthHalf) + widthHalf);
        const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); // Y is inverted

        return { screenX, screenY };
    } catch (e) {
        console.warn("Renderer: _projectToScreen error:", e);
        return null;
    }
}

/** Updates camera position and applies screen shake. */
function _updateCamera(deltaTime, localPlayerGroup) {
    if (!camera || !clock) return;

    // 1. Determine Target Position (where the camera should look)
    let targetX, targetZ;
    if (localPlayerGroup && localPlayerGroup.visible) {
        // Follow player if available and visible
        targetX = localPlayerGroup.position.x;
        targetZ = localPlayerGroup.position.z;
    } else {
        // Fallback: Center on the middle of the world
        targetX = worldWidth / 2;
        targetZ = worldHeight / 2;
    }
    _cameraTargetWorldPos.set(targetX, 0, targetZ); // Target is always on the ground plane

    // 2. Calculate Desired Camera Position (Above and behind target)
    _cameraDesiredPos.set(
        targetX,                            // X matches target
        CAMERA_HEIGHT_OFFSET,               // Fixed height above ground
        targetZ + CAMERA_DISTANCE_OFFSET    // Fixed distance behind target
    );

    // 3. Smoothly Interpolate Camera Position towards desired position
    camera.position.lerp(_cameraDesiredPos, CAMERA_LERP_FACTOR);

    // 4. Apply Screen Shake (if active)
    const nowMs = clock.elapsedTime * 1000;
    if (shakeMagnitude > 0 && nowMs < shakeEndTime) {
        const timeRemaining = shakeEndTime - nowMs;
        const totalDuration = shakeEndTime - (nowMs - deltaTime * 1000); // Approx start time
        // Quadratic decay for shake intensity
        const decayFactor = totalDuration > 0 ? Math.pow(Math.max(0, timeRemaining / totalDuration), 2) : 0;
        const currentMag = shakeMagnitude * decayFactor;

        // Random direction for shake offset
        const shakeAngle = Math.random() * Math.PI * 2;
        screenShakeOffset.set(
            Math.cos(shakeAngle) * currentMag,
            (Math.random() - 0.5) * currentMag * 0.5, // Less vertical shake
            Math.sin(shakeAngle) * currentMag
        );
        camera.position.add(screenShakeOffset); // Temporarily add offset
    } else {
        shakeMagnitude = 0; // Reset shake if expired
    }

    // 5. Set LookAt Target
    camera.lookAt(_cameraTargetWorldPos); // Always look at the target ground position
}


// --- Public API ---
const Renderer3D = {
    /** Initializes the THREE.js renderer, scene, camera, lights, and essential objects. */
    init: (containerElement, initialWorldWidth, initialWorldHeight) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;

        // Set initial dimensions (can be updated later if server sends different ones)
        worldWidth = initialWorldWidth || WORLD_WIDTH;
        worldHeight = initialWorldHeight || WORLD_HEIGHT;
        _worldCenter.set(worldWidth / 2, 0, worldHeight / 2);
        currentCanvasWidth = domContainer.clientWidth || WORLD_WIDTH; // Use container size or fallback
        currentCanvasHeight = domContainer.clientHeight || WORLD_HEIGHT;

        try {
            // Renderer Setup
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(currentCanvasWidth, currentCanvasHeight); // Initial size
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space
            domContainer.appendChild(renderer.domElement);

            // Scene Setup
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a28); // Initial background

            // Camera Setup
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, currentCanvasWidth / currentCanvasHeight, CAMERA_NEAR, CAMERA_FAR);
            camera.position.set(_worldCenter.x, CAMERA_HEIGHT_OFFSET, _worldCenter.z + CAMERA_DISTANCE_OFFSET);
            camera.lookAt(_worldCenter);
            scene.add(camera);

            // Lighting Setup
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Default day light
            scene.add(ambientLight);

            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(_worldCenter.x + worldWidth * 0.1, 400, _worldCenter.z + worldHeight * 0.2); // Position relative to world center
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048; // Shadow map resolution
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.bias = -0.002;
            // Configure shadow camera based on FIXED world size
            const shadowCamSizeX = worldWidth * 0.6; // Cover slightly more than world width
            const shadowCamSizeZ = worldHeight * 0.6;
            directionalLight.shadow.camera.near = 150;
            directionalLight.shadow.camera.far = 800;
            directionalLight.shadow.camera.left = -shadowCamSizeX;
            directionalLight.shadow.camera.right = shadowCamSizeX;
            directionalLight.shadow.camera.top = shadowCamSizeZ;
            directionalLight.shadow.camera.bottom = -shadowCamSizeZ;
            directionalLight.target.position.copy(_worldCenter); // Target the world center
            scene.add(directionalLight);
            scene.add(directionalLight.target); // Target must be added to scene

            // Muzzle Flash Light (Initially off)
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8);
            muzzleFlashLight.castShadow = false;
            scene.add(muzzleFlashLight);

            // Create Shared Assets, Geometries, Materials
            _createAssets();
            _createGeometries();
            _createMaterials();

            // Create Ground Plane (Scaled to fixed world size)
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.scale.set(worldWidth, worldHeight, 1); // Scale plane geometry
            groundPlane.rotation.x = -Math.PI / 2; // Rotate flat
            groundPlane.position.copy(_worldCenter); // Center it
            groundPlane.receiveShadow = true;
            groundPlane.name = "GroundPlane";
            scene.add(groundPlane);

            // Create Boundaries
            _createBoundaries();

            // Initialize Particle Systems & Instanced Meshes
            _initParticlesAndInstances();
            _initCampfire();
            _initSnake(); // #TODO Phase X: Optimize Snake update

            // Clock for timing
            clock = new THREE.Clock();

            // Initial resize call to ensure consistency
            Renderer3D.handleContainerResize();
            setTimeout(() => Renderer3D.handleContainerResize(), 150); // Call again shortly after just in case

        } catch (error) {
            console.error("Renderer Init Error:", error);
            Renderer3D.cleanup(); // Attempt cleanup on error
            return false; // Indicate failure
        }

        console.log("--- Renderer3D initialization complete ---");
        return true; // Indicate success
    },

    /** Handles resizing of the container element and updates renderer/camera. */
    handleContainerResize: () => {
        if (!renderer || !camera || !domContainer) return;

        const newWidth = domContainer.clientWidth;
        const newHeight = domContainer.clientHeight;

        if (newWidth <= 0 || newHeight <= 0 || (newWidth === currentCanvasWidth && newHeight === currentCanvasHeight)) {
            return; // No change or invalid size
        }

        currentCanvasWidth = newWidth;
        currentCanvasHeight = newHeight;

        // Update Renderer size and viewport
        renderer.setSize(newWidth, newHeight);
        renderer.setViewport(0, 0, newWidth, newHeight);
        // Scissor is useful if rendering only part of the viewport, ensure it covers all
        renderer.setScissor(0, 0, newWidth, newHeight);
        renderer.setScissorTest(true);


        // Update Camera aspect ratio
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        camera.clearViewOffset(); // Ensure no view offset is active

        // --- REMOVED --- Scaling world elements based on canvas size
        // Ground plane and shadow camera are now fixed based on WORLD_WIDTH/HEIGHT

        console.log(`Renderer: Resize Handled - Canvas: ${currentCanvasWidth}x${currentCanvasHeight}`);
        // Update appState dimensions if needed (main.js might do this too)
        if (window.appState) {
            window.appState.canvasWidth = currentCanvasWidth;
            window.appState.canvasHeight = currentCanvasHeight;
        }
    },

    /** Main render loop function, called by main.js. */
    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) {
            // console.warn("Renderer: Skipping render - prerequisites not met.");
            return;
        }

        const deltaTime = clock.getDelta();

        // --- State Synchronization ---
        // Update world dimensions if server provides different ones
        if (stateToRender.world_width && stateToRender.world_height &&
            (worldWidth !== stateToRender.world_width || worldHeight !== stateToRender.world_height))
        {
            console.warn(`Renderer: World dimensions updated mid-game: ${stateToRender.world_width}x${stateToRender.world_height}`);
            worldWidth = stateToRender.world_width;
            worldHeight = stateToRender.world_height;
            _worldCenter.set(worldWidth / 2, 0, worldHeight / 2);
            // #TODO: Update ground plane scale, boundary positions, shadow camera bounds if world size changes
        }

        const localPlayerGroup = appState.localPlayerId ? playerGroupMap[appState.localPlayerId] : null;

        // Update dynamic elements
        _updateCamera(deltaTime, localPlayerGroup);
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);

        // Sync scene graph with game state
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);

        // Update instanced meshes and particle systems
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateActiveCasings(deltaTime);
        _updateHitSparks(deltaTime);
        _updateRain(deltaTime);
        _updateDust(deltaTime);
        _updateCampfire(deltaTime);
        _updateSnake(stateToRender.snake_state); // Pass snake state directly #TODO: Optimize

        // Update local visual effects
        _updateMuzzleFlash(localEffects, localPlayerGroup);

        // --- UI Position Calculation ---
        const uiPositions = {}; // Store screen positions { id: { screenX, screenY } }
        // Helper to project entity positions for UI overlays
        const projectEntity = (objMap, stateMap, yOffsetFn) => {
            for (const id in objMap) {
                const obj = objMap[id];
                const data = stateMap?.[id]; // Get corresponding state data
                if (obj?.visible && data) {
                    const worldPos = obj.position.clone();
                    worldPos.y = yOffsetFn(data, obj); // Calculate appropriate Y offset for the label anchor
                    const screenPos = _projectToScreen(worldPos);
                    if (screenPos) uiPositions[id] = screenPos;
                }
            }
        };
        // Y-offset functions for different entity types (aiming for top/head area)
        const getPlayerHeadY = (d, g) => g.userData?.headMesh?.position.y + PLAYER_HEAD_RADIUS * 1.5 || PLAYER_TOTAL_HEIGHT;
        const getEnemyHeadY = (d, g) => g.userData?.headMesh?.position.y + (d.type === 'giant' ? ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER : ENEMY_HEAD_RADIUS) * 1.2 || ENEMY_CHASER_HEIGHT;
        const getPowerupTopY = (d, g) => g.userData?.iconMesh?.position.y + POWERUP_BASE_SIZE * .5 || Y_OFFSET_POWERUP;

        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY);
        projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY);
        projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);

        // Project damage text positions (use coords from server state)
        if (stateToRender.damage_texts) {
            for (const id in stateToRender.damage_texts) {
                const dt = stateToRender.damage_texts[id];
                // Use damage text coords, estimate Y slightly above ground
                const worldPos = _vector3.set(dt.x, PLAYER_TOTAL_HEIGHT * 0.8, dt.y);
                const screenPos = _projectToScreen(worldPos);
                if (screenPos) uiPositions[id] = screenPos;
            }
        }
        // Pass calculated screen positions back to main.js
        appState.uiPositions = uiPositions;

        // --- Render ---
        try {
            // Ensure scissor test is enabled (if using viewport/scissor)
            renderer.setScissorTest(true);
            renderer.render(scene, camera);
        }
        catch (e) {
            console.error("!!! RENDER ERROR !!!", e);
            // Stop the animation loop in main.js to prevent repeated errors
            if (window.appState?.animationFrameId) {
                cancelAnimationFrame(window.appState.animationFrameId);
                window.appState.animationFrameId = null;
                console.error("!!! Animation loop stopped due to render error. !!!");
                // #TODO: Display a user-friendly error message via UIManager
            }
        }
    },

    /** Triggers a camera shake effect. */
    triggerShake: (magnitude, durationMs) => {
        if (!clock) return;
        const nowMs = clock.elapsedTime * 1000;
        const newEndTime = nowMs + durationMs;
        // Apply shake if magnitude is greater or it lasts longer
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(0.1, magnitude); // Ensure minimum magnitude
            shakeEndTime = Math.max(nowMs, newEndTime); // Ensure end time isn't in the past
        }
    },

    /** Spawns a visual ammo casing particle effect. Called by main.js. */
    spawnVisualAmmoCasing: (position, ejectVector) => {
        if (!clock) return; // Need clock for timing
        _spawnAmmoCasing(position, ejectVector);
    },

    /** Triggers a visual hit spark effect. Called by main.js. */
    triggerVisualHitSparks: (position, count = 5) => {
        if (!clock) return; // Need clock for timing
        _triggerHitSparks(position, count);
    },

    /** Projects a 3D world position to 2D screen coordinates. */
    projectToScreen: (worldPosition) => {
        // Expose the internal helper function
        return _projectToScreen(worldPosition);
    },

    /** Cleans up all THREE.js resources. */
    cleanup: () => {
        console.log("--- Renderer3D Cleanup ---");

        // Dispose particle systems
        [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(system => {
            if (system) {
                if (system.particles) scene?.remove(system.particles);
                if (system.lines) scene?.remove(system.lines);
                if (system.group) scene?.remove(system.group); // Campfire group
                system.geometry?.dispose(); // Base geometry
                if(system.flameGeometry) system.flameGeometry.dispose(); // Specific campfire geoms
                if(system.smokeGeometry) system.smokeGeometry.dispose();
                // Dispose materials carefully (check if shared?) - particle materials usually unique
                _disposeMaterialTextures(system.material); system.material?.dispose();
                if(system.flameMaterial){_disposeMaterialTextures(system.flameMaterial); system.flameMaterial.dispose();}
                if(system.smokeMaterial){_disposeMaterialTextures(system.smokeMaterial); system.smokeMaterial.dispose();}
            }
        });
        hitSparkSystem = null; rainSystem = null; dustSystem = null; campfireSystem = null;

        // Dispose instanced meshes
        [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(mesh => {
            if (mesh) {
                scene?.remove(mesh);
                mesh.geometry?.dispose();
                // InstancedMesh materials are shared, disposed later
            }
        });
        playerBulletMesh = null; enemyBulletMesh = null; ammoCasingMesh = null;

        // Dispose snake mesh
        if (snakeMesh) { scene?.remove(snakeMesh); snakeMesh.geometry?.dispose(); snakeMesh = null; } // Snake material is shared

        // Dispose boundary group
        if (boundariesGroup) { scene?.remove(boundariesGroup); _disposeObject3D(boundariesGroup); boundariesGroup = null; } // Disposes wall meshes/geoms

        // Dispose dynamic object groups (players, enemies, powerups)
        [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(objectMap => {
            for (const id in objectMap) {
                // Use the removal function which handles disposing internal meshes/cloned materials
                _handleObjectRemoval(objectMap[id], id, objectMap);
            }
        });

        // Dispose ground plane
        if (groundPlane) { scene?.remove(groundPlane); _disposeObject3D(groundPlane); groundPlane = null; } // Ground material is shared

        // Dispose shared resources last
        Object.values(sharedGeometries).forEach(g => g?.dispose());
        Object.values(powerupGeometries).forEach(g => g?.dispose());
        Object.values(sharedMaterials).forEach(m => { if (m instanceof THREE.Material) { _disposeMaterialTextures(m); m.dispose(); } });
        if (sharedMaterials.powerups) Object.values(sharedMaterials.powerups).forEach(m => { if (m instanceof THREE.Material) { _disposeMaterialTextures(m); m.dispose(); } });
        Object.values(loadedAssets).forEach(a => a?.dispose()); // Dispose loaded textures

        // Clear shared resource maps
        Object.keys(sharedGeometries).forEach(k => delete sharedGeometries[k]);
        Object.keys(sharedMaterials).forEach(k => { if (k !== 'powerups') delete sharedMaterials[k]; else delete sharedMaterials.powerups; });
        Object.keys(powerupGeometries).forEach(k => delete powerupGeometries[k]);
        Object.keys(loadedAssets).forEach(k => delete loadedAssets[k]);

        // Remove lights from scene
        if (scene) {
            if (ambientLight) scene.remove(ambientLight);
            if (directionalLight) scene.remove(directionalLight);
            if (directionalLight?.target) scene.remove(directionalLight.target);
            if (muzzleFlashLight) scene.remove(muzzleFlashLight);
        }
        ambientLight = null; directionalLight = null; muzzleFlashLight = null;

        // Dispose renderer and remove canvas
        if (renderer) {
            console.log("Renderer: Disposing WebGL context...");
            renderer.dispose();
            if (renderer.domElement?.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer = null;
            console.log("Renderer disposed.");
        }

        // Clear references
        scene = null; camera = null; clock = null; domContainer = null;
        playerBulletMatrices = []; enemyBulletMatrices = []; activeAmmoCasings = [];
        shakeMagnitude = 0; shakeEndTime = 0; worldWidth = WORLD_WIDTH; worldHeight = WORLD_HEIGHT; // Reset world dims

        console.log("Renderer3D resources released.");
    },

    // --- Getters for Debugging or Advanced Interaction ---
    getCamera: () => camera,
    getGroundPlane: () => groundPlane,
    getScene: () => scene,
};

export default Renderer3D;
