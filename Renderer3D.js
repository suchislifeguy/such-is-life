// Renderer3D.js - Client-Side Rendering Logic

import * as THREE from 'three';

// --- Constants ---

// Camera Configuration
const CAMERA_FOV = 60; // Field of View
const CAMERA_NEAR = 10; // Near clipping plane
const CAMERA_FAR = 3500; // Far clipping plane (Adjust based on world size)
const CAMERA_HEIGHT_OFFSET = 950; // Camera height above the ground plane
const CAMERA_DISTANCE_OFFSET = 300; // Camera distance behind the player (along Z axis)
const CAMERA_LERP_FACTOR = 0.08; // Smoothing factor for camera movement

// Instancing & Particle Limits (Adjust based on performance needs)
const MAX_PLAYER_BULLETS = 500;
const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150;
const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000;
const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80; // For campfire
const MAX_SMOKE_PARTICLES = 60; // For campfire

// Entity Visual Properties (Sizes should generally match server logic for consistency)
// Note: These define the visual representation, collision is handled server-side.
const PLAYER_CAPSULE_RADIUS = 12; // Matches server PLAYER_DEFAULTS['radius']
const PLAYER_CAPSULE_HEIGHT = 24; // Visual height of the capsule body
const PLAYER_TOTAL_VISUAL_HEIGHT = PLAYER_CAPSULE_HEIGHT + PLAYER_CAPSULE_RADIUS * 2; // Approx total height
const PLAYER_HEAD_RADIUS = 10;
const PLAYER_GUN_LENGTH = 25; const PLAYER_GUN_RADIUS = 2;

const ENEMY_CHASER_WIDTH = 20; const ENEMY_CHASER_HEIGHT = 40; const ENEMY_CHASER_DEPTH = 14;
const ENEMY_SHOOTER_RADIUS = 12; const ENEMY_SHOOTER_HEIGHT = 45;
const ENEMY_GUN_LENGTH = 25; const ENEMY_GUN_RADIUS = 2.5;
const ENEMY_GIANT_MULTIPLIER = 2.5; // Visual size multiplier for Giants
const ENEMY_HEAD_RADIUS = 8;

const POWERUP_BASE_SIZE = 18; // Visual size of powerups
const BULLET_BASE_RADIUS = 2.5; const BULLET_LENGTH = 15; // Visual dimensions
const HEAVY_SLUG_RADIUS_VISUAL_MULT = 1.5; // Visual size multiplier for heavy slug

const CAMPFIRE_LOG_RADIUS = 5; const CAMPFIRE_LOG_LENGTH = 40; const CAMPFIRE_BASE_RADIUS = 25;
const SNAKE_VISUAL_SEGMENTS = 40; // Number of segments for the visual tube
const SNAKE_RADIUS = 6; // Visual radius of the snake tube
const BOUNDARY_WALL_HEIGHT = 60; const BOUNDARY_WALL_DEPTH = 20; // Visual dimensions of walls

// Particle Physics & Appearance (Client-side visual tuning)
const AMMO_CASING_RADIUS = 0.6; const AMMO_CASING_LENGTH = 3.5;
const AMMO_CASING_GRAVITY = 980; const AMMO_CASING_BOUNCE = 0.3; const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500; const HIT_SPARK_BASE_LIFE = 0.2; const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150; const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.7; const FLAME_RAND_LIFE = 0.6; const FLAME_VEL_Y = 75; const FLAME_VEL_SPREAD = 25; const FLAME_SIZE_START = 18; const FLAME_SIZE_END = 10;
const SMOKE_BASE_LIFE = 2.5; const SMOKE_RAND_LIFE = 1.5; const SMOKE_VEL_Y = 40; const SMOKE_VEL_SPREAD = 15; const SMOKE_SIZE_START = 25; const SMOKE_SIZE_END = 60; const SMOKE_OPACITY_START = 0.35; const SMOKE_OPACITY_END = 0.0;
const RAIN_SPEED_Y = -500; const RAIN_SPEED_Y_RAND = -200; const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40; const DUST_SPEED_Y = 8; const DUST_OPACITY = 0.15;

// Misc Timing & State
const FADE_OUT_DURATION = 0.35; // Seconds for enemy death fade animation

// Player status constants (used for visual state changes)
const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

// Y-Offsets (Vertical position offset from the ground plane for different entity types)
// Assumes entity origin is at its base on the ground (0)
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS; // Center of bottom sphere
const Y_OFFSET_ENEMY_BODY = 0; // Enemy origin is at its base
const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7; // Center powerup visually
const Y_OFFSET_BULLET = 10; // Bullets fly slightly above ground
const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS; // Base of campfire logs
const Y_OFFSET_SNAKE = SNAKE_RADIUS; // Center of snake tube
const Y_OFFSET_CASING = AMMO_CASING_RADIUS; // Base of ammo casing
const Y_OFFSET_BOUNDARY = BOUNDARY_WALL_HEIGHT / 2; // Center of wall height

// --- Module Scope Variables ---
let renderer, scene, camera, clock; // Core THREE.js components
let ambientLight, directionalLight, muzzleFlashLight; // Lighting
let domContainer; // Reference to the canvas container element
let currentCanvasWidth = 0; let currentCanvasHeight = 0; // Current dimensions of the canvas

// World dimensions (initialized from main.js based on server state)
let worldWidth = 0;
let worldHeight = 0;

// Scene Objects
let groundPlane = null; // The ground mesh
let boundariesGroup = null; // Group holding the boundary walls
// Maps to store 3D object groups associated with game entity IDs
const playerGroupMap = {}; // { playerId: THREE.Group }
const enemyGroupMap = {}; // { enemyId: THREE.Group }
const powerupGroupMap = {}; // { powerupId: THREE.Group }

// Instanced Meshes & Particle Systems
let playerBulletMesh = null; let playerBulletMatrices = []; // Instanced mesh for player bullets
let enemyBulletMesh = null; let enemyBulletMatrices = []; // Instanced mesh for enemy bullets
let ammoCasingMesh = null; let activeAmmoCasings = []; // Instanced mesh and data for ammo casings
let hitSparkSystem = null; // Particle system for hit sparks
let rainSystem = null; // Particle system for rain
let dustSystem = null; // Particle system for dust storm
let campfireSystem = null; // Group and particle systems for campfire
let snakeMesh = null; // Mesh for the snake visual

// Effects State
let screenShakeOffset = new THREE.Vector3(0, 0, 0); // Current camera shake offset
let shakeMagnitude = 0; // Current intensity of shake
let shakeEndTime = 0; // Timestamp when shake should end

// Shared Resources (Geometries, Materials, Assets)
const sharedGeometries = {}; // Reusable geometries
const sharedMaterials = {}; // Reusable materials
const powerupGeometries = {}; // Specific geometries for powerup types
const loadedAssets = {}; // Loaded textures, etc.

// Reusable THREE.js objects to avoid frequent allocations
const _dummyObject = new THREE.Object3D(); // For setting instance matrices
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3(); // General purpose position vector
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();
const _vector3 = new THREE.Vector3(); // General purpose vector
const _vector3_B = new THREE.Vector3(); // Additional vector for mapping/calculations
const _cameraTargetWorldPos = new THREE.Vector3(); // Target position for camera lookAt
const _cameraDesiredPos = new THREE.Vector3(); // Desired camera position (before lerping)
const _worldCenter = new THREE.Vector3(); // Center of the world plane

// --- Coordinate Mapping Utilities ---

/**
 * Maps server coordinates (origin top-left, Y down) to renderer world coordinates
 * (origin bottom-left, Z up/positive Z towards camera). Populates the targetVector.
 * Assumes ground plane is at Y=0 in world coordinates.
 * @param {number} serverX - X coordinate from server state.
 * @param {number} serverY - Y coordinate from server state.
 * @param {THREE.Vector3} targetVector - The vector to store the world coordinates in.
 */
function mapServerToWorld(serverX, serverY, targetVector) {
    if (!targetVector) {
        console.warn("mapServerToWorld: targetVector is undefined");
        targetVector = new THREE.Vector3(); // Create fallback, but log warning
    }
    targetVector.x = serverX;
    targetVector.y = 0; // Assume entity base is on the ground plane (Y=0)
    targetVector.z = worldHeight - serverY; // Invert Y and shift origin to bottom-left for Z
}

/**
 * Maps renderer world coordinates (XZ plane, origin bottom-left) back to
 * server coordinates (origin top-left, Y down).
 * @param {THREE.Vector3} worldVector - The world coordinate vector.
 * @returns {{x: number, y: number}} Server coordinates.
 */
function mapWorldToServer(worldVector) {
    if (!worldVector) return { x: 0, y: 0 };
    return {
        x: worldVector.x,
        y: worldHeight - worldVector.z // Invert Z and shift origin back
    };
}


// --- Internal Helper Functions ---

// Linear interpolation helper
function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; }

// Create procedural textures (e.g., for particles)
function _createAssets() {
    console.log("Renderer: Creating procedural assets...");
    try {
        // Flame Particle Texture
        const flameCanvas = document.createElement('canvas'); flameCanvas.width = 64; flameCanvas.height = 64;
        const flameCtx = flameCanvas.getContext('2d'); if (!flameCtx) throw new Error("Failed 2D context: flame");
        const flameGradient = flameCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        flameGradient.addColorStop(0, 'rgba(255,220,150,1)'); // Center color
        flameGradient.addColorStop(0.4, 'rgba(255,150,0,0.8)');
        flameGradient.addColorStop(1, 'rgba(200,0,0,0)'); // Outer edge transparent
        flameCtx.fillStyle = flameGradient; flameCtx.fillRect(0, 0, 64, 64);
        loadedAssets.flameTexture = new THREE.CanvasTexture(flameCanvas);
        loadedAssets.flameTexture.name = "FlameTexture";

        // Smoke Particle Texture
        const smokeCanvas = document.createElement('canvas'); smokeCanvas.width = 64; smokeCanvas.height = 64;
        const smokeCtx = smokeCanvas.getContext('2d'); if (!smokeCtx) throw new Error("Failed 2D context: smoke");
        const smokeGradient = smokeCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        smokeGradient.addColorStop(0, 'rgba(200, 200, 200, 0.7)');
        smokeGradient.addColorStop(0.6, 'rgba(150, 150, 150, 0.3)');
        smokeGradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
        smokeCtx.fillStyle = smokeGradient; smokeCtx.fillRect(0, 0, 64, 64);
        loadedAssets.smokeTexture = new THREE.CanvasTexture(smokeCanvas);
        loadedAssets.smokeTexture.name = "SmokeTexture";
    } catch (error) { console.error("Renderer Error creating procedural textures:", error); }
}

// Create reusable geometries
function _createGeometries() {
    console.log("Renderer: Creating geometries...");
    sharedGeometries.playerBody = new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HEIGHT, 4, 12);
    sharedGeometries.head = new THREE.SphereGeometry(1, 12, 8); // Base sphere, scaled later
    sharedGeometries.playerGun = new THREE.CylinderGeometry(PLAYER_GUN_RADIUS, PLAYER_GUN_RADIUS * 0.8, PLAYER_GUN_LENGTH, 8);
    sharedGeometries.enemyChaserBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH, ENEMY_CHASER_HEIGHT, ENEMY_CHASER_DEPTH);
    sharedGeometries.enemyShooterBody = new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_HEIGHT, 10);
    sharedGeometries.enemyGiantBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER, ENEMY_CHASER_DEPTH * ENEMY_GIANT_MULTIPLIER);
    sharedGeometries.enemyGun = new THREE.CylinderGeometry(ENEMY_GUN_RADIUS, ENEMY_GUN_RADIUS * 0.7, ENEMY_GUN_LENGTH, 8);
    // Bullet geometry (oriented to point along its velocity vector)
    sharedGeometries.bullet = new THREE.CylinderGeometry(BULLET_BASE_RADIUS, BULLET_BASE_RADIUS * 0.8, BULLET_LENGTH, 8);
    sharedGeometries.bullet.rotateX(Math.PI / 2); // Rotate to align with Z axis initially
    sharedGeometries.heavySlugBullet = new THREE.CylinderGeometry(BULLET_BASE_RADIUS * HEAVY_SLUG_RADIUS_VISUAL_MULT, BULLET_BASE_RADIUS * HEAVY_SLUG_RADIUS_VISUAL_MULT * 0.8, BULLET_LENGTH, 8);
    sharedGeometries.heavySlugBullet.rotateX(Math.PI / 2);
    // Ammo casing
    sharedGeometries.ammoCasing = new THREE.CylinderGeometry(AMMO_CASING_RADIUS, AMMO_CASING_RADIUS, AMMO_CASING_LENGTH, 6);
    // Campfire log
    sharedGeometries.log = new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_LENGTH, 6);
    // Ground plane (scaled later)
    sharedGeometries.groundPlane = new THREE.PlaneGeometry(1, 1);
    // Boundary wall (scaled later)
    sharedGeometries.boundaryWall = new THREE.BoxGeometry(1, BOUNDARY_WALL_HEIGHT, BOUNDARY_WALL_DEPTH);

    // Powerup geometries
    const ps = POWERUP_BASE_SIZE; // Base size for scaling powerup visuals
    powerupGeometries.health = new THREE.TorusGeometry(ps * 0.4, ps * 0.15, 8, 16);
    powerupGeometries.gun_upgrade = new THREE.ConeGeometry(ps * 0.45, ps * 0.9, 4);
    powerupGeometries.speed_boost = new THREE.CylinderGeometry(ps * 0.6, ps * 0.6, ps * 0.25, 16);
    powerupGeometries.armor = new THREE.OctahedronGeometry(ps * 0.6, 0);
    powerupGeometries.ammo_shotgun = new THREE.BoxGeometry(ps * 0.8, ps * 0.8, ps * 0.8); // Simple box for shotgun
    powerupGeometries.ammo_heavy_slug = new THREE.SphereGeometry(ps * 0.6, 12, 8); // Sphere for heavy slug
    powerupGeometries.ammo_rapid_fire = new THREE.TorusGeometry(ps * 0.4, ps * 0.1, 6, 12); // Torus for rapid fire
    powerupGeometries.bonus_score = new THREE.CylinderGeometry(ps * 0.35, ps * 0.35, ps * 0.5, 12); // Coin shape for score
    powerupGeometries.default = new THREE.BoxGeometry(ps * 0.9, ps * 0.9, ps * 0.9); // Fallback box
}

// Create reusable materials
function _createMaterials() {
    console.log("Renderer: Creating materials...");
    // Player Materials
    sharedMaterials.playerBody = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.2, name: "PlayerBody" });
    sharedMaterials.playerHead = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: "PlayerHead" });
    sharedMaterials.playerGun = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: "PlayerGun" });
    sharedMaterials.playerDown = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6, metalness: 0.1, emissive: 0xccab00, emissiveIntensity: 0.5, name: "PlayerDown" }); // Yellow/Gold for down
    sharedMaterials.playerDead = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.0, name: "PlayerDead" }); // Grey for dead
    sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, metalness: 0.2, emissive: 0x331122, emissiveIntensity: 0.3, name: "PlayerSelfBody" }); // Pinkish for local player

    // Enemy Materials (Allow transparency for fading out)
    const enemyStandardProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemyStandardProps, name: "EnemyChaserBody" }); // Dark Blue
    sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemyStandardProps, name: "EnemyShooterBody" }); // Olive Green
    sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 1.0, name: "EnemyGiantBody" }); // Dark Red
    sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({ color: 0xBC8F8F, roughness: 0.7, name: "EnemyHead" }); // Rosy Brown
    sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.6, metalness: 0.6, name: "EnemyGun" });

    // Bullet Materials (Basic materials for performance)
    sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: "PlayerBullet" }); // Yellow
    sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff4500, name: "EnemyBullet" }); // OrangeRed
    sharedMaterials.heavySlugBullet = new THREE.MeshBasicMaterial({ color: 0x800080, name: "HeavySlugBullet" }); // Purple

    // Other Materials
    sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: "AmmoCasing" }); // Brass color
    sharedMaterials.powerupBase = { roughness: 0.6, metalness: 0.1, name: "PowerupDefault" }; // Base properties for powerups
    sharedMaterials.powerups = { // Specific powerup materials
        health: new THREE.MeshStandardMaterial({ color: 0x81c784, ...sharedMaterials.powerupBase, name: "PowerupHealth" }), // Green
        gun_upgrade: new THREE.MeshStandardMaterial({ color: 0x6a0dad, emissive: 0x330044, emissiveIntensity: 0.4, ...sharedMaterials.powerupBase, name: "PowerupGun" }), // Purple
        speed_boost: new THREE.MeshStandardMaterial({ color: 0x3edef3, ...sharedMaterials.powerupBase, name: "PowerupSpeed" }), // Cyan
        armor: new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3, ...sharedMaterials.powerupBase, name: "PowerupArmor" }), // Silver
        ammo_shotgun: new THREE.MeshStandardMaterial({ color: 0xFFa500, ...sharedMaterials.powerupBase, name: "PowerupShotgun" }), // Orange
        ammo_heavy_slug: new THREE.MeshStandardMaterial({ color: 0xA0522D, ...sharedMaterials.powerupBase, name: "PowerupSlug" }), // Sienna (Brown)
        ammo_rapid_fire: new THREE.MeshStandardMaterial({ color: 0xFFFF00, emissive: 0x555500, emissiveIntensity: 0.5, ...sharedMaterials.powerupBase, name: "PowerupRapid" }), // Yellow
        bonus_score: new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.6, roughness: 0.4, ...sharedMaterials.powerupBase, name: "PowerupScore" }), // Gold
        default: new THREE.MeshStandardMaterial({ color: 0x888888, ...sharedMaterials.powerupBase }) // Grey fallback
    };
    sharedMaterials.groundDay = new THREE.MeshStandardMaterial({ color: 0x788a77, roughness: 0.9, metalness: 0.05, name: "GroundDay" }); // Dusty Green
    sharedMaterials.groundNight = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.85, metalness: 0.1, name: "GroundNight" }); // Dark Brown/Grey
    sharedMaterials.log = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: "Log" }); // Brown
    sharedMaterials.boundary = new THREE.MeshStandardMaterial({ color: 0x4d443d, roughness: 0.8, metalness: 0.1, name: "BoundaryWall" }); // Dark Stone/Wood
    sharedMaterials.snake = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide, name: "Snake" }); // Dark Green

    // Particle Materials
    sharedMaterials.hitSpark = new THREE.PointsMaterial({ size: 10, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "HitSpark" });
    sharedMaterials.rainLine = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: "RainLine" });
    sharedMaterials.dustMote = new THREE.PointsMaterial({ size: 50, color: 0xd2b48c, transparent: true, opacity: DUST_OPACITY, sizeAttenuation: true, depthWrite: false, name: "DustMote" }); // Tan color for dust
    sharedMaterials.flame = new THREE.PointsMaterial({ size: FLAME_SIZE_START, vertexColors: true, map: loadedAssets.flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "Flame" });
    sharedMaterials.smoke = new THREE.PointsMaterial({ size: SMOKE_SIZE_START, vertexColors: false, color: 0xaaaaaa, map: loadedAssets.smokeTexture, transparent: true, opacity: SMOKE_OPACITY_START, sizeAttenuation: true, depthWrite: false, blending: THREE.NormalBlending, name: "Smoke" });
}

// Initialize instanced meshes and particle systems
function _initParticlesAndInstances() {
    if (!scene) { console.error("Renderer: Scene not ready for particle/instance init."); return; }
    console.log("Renderer: Initializing particles and instanced meshes...");

    // Player Bullets Instanced Mesh
    playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS);
    playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Optimize for frequent updates
    playerBulletMesh.count = 0; playerBulletMesh.name = "PlayerBullets";
    scene.add(playerBulletMesh);
    playerBulletMatrices = playerBulletMesh.instanceMatrix.array; // Get reference to underlying array

    // Enemy Bullets Instanced Mesh
    enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS);
    enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    enemyBulletMesh.count = 0; enemyBulletMesh.name = "EnemyBullets";
    scene.add(enemyBulletMesh);
    enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array;

    // Ammo Casings Instanced Mesh
    ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS);
    ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ammoCasingMesh.castShadow = true; // Casings can cast shadows
    ammoCasingMesh.count = 0; ammoCasingMesh.name = "AmmoCasings";
    scene.add(ammoCasingMesh);
    activeAmmoCasings = []; // Array to manage individual casing physics

    // Hit Sparks Particle System
    const sparkGeo = new THREE.BufferGeometry();
    const sparkP = new Float32Array(MAX_HIT_SPARKS * 3); // Position (x, y, z)
    const sparkC = new Float32Array(MAX_HIT_SPARKS * 3); // Color (r, g, b)
    const sparkA = new Float32Array(MAX_HIT_SPARKS); // Alpha (opacity) - might not be directly used by material but good for logic
    const sparkData = []; // Array to store individual spark physics/lifetime data
    for (let i = 0; i < MAX_HIT_SPARKS; i++) {
        sparkP[i * 3 + 1] = -1e4; // Initialize off-screen
        sparkA[i] = 0; // Initialize transparent
        sparkData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1, 1, 1), a: 0.0, l: 0 }); // Position, Velocity, Color, Alpha, Lifetime
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkP, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkC, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkA, 1).setUsage(THREE.DynamicDrawUsage)); // Custom attribute for alpha logic
    hitSparkSystem = {
        particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark),
        geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData
    };
    hitSparkSystem.particles.name = "HitSparks";
    hitSparkSystem.particles.visible = false; // Initially hidden
    scene.add(hitSparkSystem.particles);

    // Rain Particle System (Line Segments)
    const rainGeo = new THREE.BufferGeometry();
    const rainP = new Float32Array(MAX_RAIN_DROPS * 6); // Two points (start/end) per line segment
    const rainData = []; // Store position and speed for each drop
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const x = Math.random() * worldWidth; // Random initial position within world bounds
        const y = Math.random() * 1000 + 800; // Start high up
        const z = Math.random() * worldHeight;
        rainP[i * 6 + 1] = -1e4; rainP[i * 6 + 4] = -1e4; // Initialize off-screen
        rainData.push({ x: x, y: y, z: z, s: RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND }); // Position and speed
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainP, 3).setUsage(THREE.DynamicDrawUsage));
    rainSystem = {
        lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine),
        geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData
    };
    rainSystem.lines.visible = false; rainSystem.lines.name = "RainLines";
    scene.add(rainSystem.lines);

    // Dust Particle System (Points)
    const dustGeo = new THREE.BufferGeometry();
    const dustP = new Float32Array(MAX_DUST_MOTES * 3);
    const dustData = []; // Store position and velocity for each mote
    for (let i = 0; i < MAX_DUST_MOTES; i++) {
        dustP[i * 3 + 1] = -1e4; // Initialize off-screen
        dustData.push({
            p: new THREE.Vector3(Math.random() * worldWidth, Math.random() * 80 + 5, Math.random() * worldHeight), // Random position
            v: new THREE.Vector3((Math.random() - 0.5) * DUST_SPEED_XZ, (Math.random() - 0.5) * DUST_SPEED_Y, (Math.random() - 0.5) * DUST_SPEED_XZ) // Random velocity
        });
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustP, 3).setUsage(THREE.DynamicDrawUsage));
    dustSystem = {
        particles: new THREE.Points(dustGeo, sharedMaterials.dustMote),
        geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData
    };
    dustSystem.particles.visible = false; dustSystem.particles.name = "DustParticles";
    scene.add(dustSystem.particles);
}

// Initialize the campfire object (logs, light, particles)
function _initCampfire() {
    if (!scene) { console.error("Renderer: Scene not ready for campfire init."); return; }
    console.log("Renderer: Initializing campfire...");
    const group = new THREE.Group(); group.name = "CampfireGroup";

    // Logs
    const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log1.rotation.set(0, Math.PI / 10, Math.PI / 6); log1.castShadow = true;
    log1.position.set(-CAMPFIRE_LOG_LENGTH * 0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH * 0.2);
    const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log2.rotation.set(0, -Math.PI / 8, -Math.PI / 5); log2.castShadow = true;
    log2.position.set(CAMPFIRE_LOG_LENGTH * 0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH * 0.1);
    group.add(log1); group.add(log2);

    // Glow Light
    const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0); // Orange glow, initially off
    glowLight.position.y = Y_OFFSET_CAMPFIRE + 15; glowLight.castShadow = true;
    glowLight.shadow.mapSize.width = 512; glowLight.shadow.mapSize.height = 512; // Shadow map resolution
    glowLight.shadow.bias = -0.01; // Adjust shadow bias to prevent artifacts
    group.add(glowLight);

    // Flame Particles
    const flameGeo = new THREE.BufferGeometry();
    const flameP = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameC = new Float32Array(MAX_FLAME_PARTICLES * 3); const flameS = new Float32Array(MAX_FLAME_PARTICLES);
    const flameData = [];
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) { flameP[i*3+1] = -1e4; flameS[i] = 0; flameData.push({ p: new THREE.Vector3(0, -1e4, 0), v: new THREE.Vector3(), c: new THREE.Color(1,1,1), l: 0, bl: FLAME_BASE_LIFE + Math.random() * FLAME_RAND_LIFE, s: FLAME_SIZE_START }); }
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flameP, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameC, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('size', new THREE.BufferAttribute(flameS, 1).setUsage(THREE.DynamicDrawUsage));
    const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame); flameParticles.name = "CampfireFlames"; flameParticles.visible = false;
    group.add(flameParticles);

    // Smoke Particles
    const smokeGeo = new THREE.BufferGeometry();
    const smokeP = new Float32Array(MAX_SMOKE_PARTICLES * 3); const smokeA = new Float32Array(MAX_SMOKE_PARTICLES); const smokeS = new Float32Array(MAX_SMOKE_PARTICLES);
    const smokeData = [];
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) { smokeP[i*3+1] = -1e4; smokeA[i] = 0; smokeS[i] = 0; smokeData.push({ p: new THREE.Vector3(0,-1e4,0), v: new THREE.Vector3(), a:0.0, l:0, bl: SMOKE_BASE_LIFE + Math.random() * SMOKE_RAND_LIFE, s: SMOKE_SIZE_START }); }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeP, 3).setUsage(THREE.DynamicDrawUsage));
    smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(smokeA, 1).setUsage(THREE.DynamicDrawUsage)); // Custom alpha attribute
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeS, 1).setUsage(THREE.DynamicDrawUsage));
    const smokeParticles = new THREE.Points(smokeGeo, sharedMaterials.smoke); smokeParticles.name = "CampfireSmoke"; smokeParticles.visible = false;
    group.add(smokeParticles);

    // Store references
    campfireSystem = {
        group: group, flameParticles: flameParticles, flameGeometry: flameGeo, flameMaterial: sharedMaterials.flame, flameData: flameData,
        smokeParticles: smokeParticles, smokeGeometry: smokeGeo, smokeMaterial: sharedMaterials.smoke, smokeData: smokeData, glowLight: glowLight
    };
    group.visible = false; // Initially hidden
    scene.add(group);
}

// Create boundary walls based on fixed world dimensions
function _createBoundaries() {
    if (!scene) { console.error("Renderer: Scene not ready for boundaries init."); return; }
    console.log(`Renderer: Creating boundaries for world size ${worldWidth}x${worldHeight}...`);
    boundariesGroup = new THREE.Group(); boundariesGroup.name = "Boundaries";
    const wallMaterial = sharedMaterials.boundary;
    const wallGeometry = sharedGeometries.boundaryWall; // Base geometry

    // Top Wall
    const wallTop = new THREE.Mesh(wallGeometry, wallMaterial); wallTop.name="WallTop";
    wallTop.scale.x = worldWidth + BOUNDARY_WALL_DEPTH; // Scale width to cover world + overlap
    wallTop.position.set(worldWidth / 2, Y_OFFSET_BOUNDARY, worldHeight + BOUNDARY_WALL_DEPTH / 2); // Position centered on top edge
    wallTop.castShadow = true; wallTop.receiveShadow = true;

    // Bottom Wall
    const wallBottom = new THREE.Mesh(wallGeometry, wallMaterial); wallBottom.name="WallBottom";
    wallBottom.scale.x = worldWidth + BOUNDARY_WALL_DEPTH;
    wallBottom.position.set(worldWidth / 2, Y_OFFSET_BOUNDARY, -BOUNDARY_WALL_DEPTH / 2);

    // Left Wall
    const wallLeft = new THREE.Mesh(wallGeometry, wallMaterial); wallLeft.name="WallLeft";
    wallLeft.scale.x = worldHeight + BOUNDARY_WALL_DEPTH; // Scale width (which becomes height after rotation)
    wallLeft.rotation.y = Math.PI / 2; // Rotate to align vertically
    wallLeft.position.set(-BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldHeight / 2);

    // Right Wall
    const wallRight = new THREE.Mesh(wallGeometry, wallMaterial); wallRight.name="WallRight";
    wallRight.scale.x = worldHeight + BOUNDARY_WALL_DEPTH;
    wallRight.rotation.y = Math.PI / 2;
    wallRight.position.set(worldWidth + BOUNDARY_WALL_DEPTH / 2, Y_OFFSET_BOUNDARY, worldHeight / 2);

    boundariesGroup.add(wallTop, wallBottom, wallLeft, wallRight);
    scene.add(boundariesGroup);
}

// Initialize the snake mesh (initially hidden)
function _initSnake() {
    if (!scene) { console.error("Renderer: Scene not ready for snake init."); return; }
    console.log("Renderer: Initializing snake mesh...");
    // Create with a dummy curve initially, geometry will be updated later
    const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0));
    const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false); // Low detail initially
    snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake);
    snakeMesh.castShadow = true;
    snakeMesh.visible = false; // Start hidden
    snakeMesh.name = "Snake";
    scene.add(snakeMesh);
}

// --- Entity Creation Functions ---

// Create the 3D group for a player
function _createPlayerGroup(playerData, isSelf) {
    const group = new THREE.Group(); group.name = `PlayerGroup_${playerData.id}`;
    const bodyMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody; // Different material for local player

    // Body
    const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2; // Position capsule center relative to group origin
    group.add(bodyMesh);

    // Head
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead);
    headMesh.scale.setScalar(PLAYER_HEAD_RADIUS); // Scale the base sphere geometry
    headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; // Position above body
    headMesh.castShadow = true;
    group.add(headMesh);

    // Gun
    const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun);
    // Position gun relative to body center, pointing forward (along positive Z in local space)
    gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8);
    gunMesh.rotation.x = Math.PI / 2; // Orient gun barrel
    gunMesh.castShadow = true;
    group.add(gunMesh);

    // Set initial world position using coordinate mapping
    mapServerToWorld(playerData.x, playerData.y, group.position);

    // Store references and state in userData for easy access
    group.userData = {
        gameId: playerData.id, isPlayer: true, isSelf: isSelf,
        bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh,
        currentBodyMatRef: bodyMat, // Reference to the currently assigned body material
        dyingStartTime: null // For fade-out animations (if needed for players)
    };
    return group;
}

// Create the 3D group for an enemy
function _createEnemyGroup(enemyData) {
    const group = new THREE.Group(); group.name = `EnemyGroup_${enemyData.id}`;
    let bodyGeo, bodyMatRef, headScale, yBodyOffset, gunMesh = null;
    // Determine geometry, material, and offsets based on enemy type
    const enemyHeight = enemyData.height || ENEMY_DEFAULTS['height'];
    const enemyType = enemyData.type || ENEMY_DEFAULTS['type'];

    switch (enemyType) {
        case ENEMY_TYPE_SHOOTER:
            bodyGeo = sharedGeometries.enemyShooterBody; bodyMatRef = sharedMaterials.enemyShooterBody;
            headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2;
            gunMesh = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun);
            gunMesh.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8); // Position gun
            gunMesh.rotation.x = Math.PI / 2; gunMesh.castShadow = true; group.add(gunMesh);
            break;
        case ENEMY_TYPE_GIANT:
            bodyGeo = sharedGeometries.enemyGiantBody; bodyMatRef = sharedMaterials.enemyGiantBody;
            headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8; yBodyOffset = enemyHeight / 2;
            break;
        case ENEMY_TYPE_CHASER: default:
            bodyGeo = sharedGeometries.enemyChaserBody; bodyMatRef = sharedMaterials.enemyChaserBody;
            headScale = ENEMY_HEAD_RADIUS; yBodyOffset = enemyHeight / 2;
            break;
    }

    // Body
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMatRef);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset; // Position body center relative to group origin
    group.add(bodyMesh);

    // Head
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead);
    headMesh.scale.setScalar(headScale);
    headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; // Position above body
    headMesh.castShadow = true;
    group.add(headMesh);

    // Set initial world position using coordinate mapping
    mapServerToWorld(enemyData.x, enemyData.y, group.position);

    group.userData = {
        gameId: enemyData.id, isEnemy: true, type: enemyType,
        bodyMesh: bodyMesh, headMesh: headMesh, gunMesh: gunMesh,
        currentBodyMatRef: bodyMatRef, dyingStartTime: null, health: enemyData.health
    };
    return group;
}

// Create the 3D group for a powerup
function _createPowerupGroup(powerupData) {
    const group = new THREE.Group(); group.name = `PowerupGroup_${powerupData.id}`;
    // Select geometry and material based on powerup type
    const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default;
    const material = sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default;
    if (!material) { console.error(`Renderer Error: No material for powerup type: ${powerupData.type}`); return null; }

    const iconMesh = new THREE.Mesh(geometry, material);
    iconMesh.castShadow = true;
    iconMesh.position.y = Y_OFFSET_POWERUP; // Set vertical offset
    iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); // Give slight tilt
    group.add(iconMesh);

    // Set initial world position using coordinate mapping
    mapServerToWorld(powerupData.x, powerupData.y, group.position);

    group.userData = { gameId: powerupData.id, isPowerup: true, iconMesh: iconMesh };
    return group;
}


// --- Cleanup & Disposal ---

// Dispose textures associated with a material (if not shared assets)
function _disposeMaterialTextures(material) {
    if (!material) return;
    const textures = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'displacementMap', 'envMap'];
    textures.forEach(prop => {
        if (material[prop] && material[prop] instanceof THREE.Texture) {
            // Only dispose if it's NOT one of the pre-loaded procedural assets
            if (!Object.values(loadedAssets).includes(material[prop])) {
                material[prop].dispose();
            }
        }
    });
}

// Dispose geometry and materials of an Object3D hierarchy
function _disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
            child.geometry?.dispose(); // Dispose geometry
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(m => { // Dispose material(s)
                if (m) {
                    // Check if material is one of the shared ones (don't dispose shared)
                    let isShared = Object.values(sharedMaterials).includes(m);
                    if (!isShared && sharedMaterials.powerups) { isShared = Object.values(sharedMaterials.powerups).includes(m); }
                    if (!isShared) {
                        _disposeMaterialTextures(m); // Dispose associated textures first
                        m.dispose();
                    }
                }
            });
        }
    });
}

// Handle removal of an object from the scene, including fade-out effect for enemies
function _handleObjectRemoval(obj, id, objectMap) {
    if (!obj || !scene || !clock) return;
    const userData = obj.userData;
    const isEnemy = userData?.isEnemy;
    const wasAlive = !userData?.dyingStartTime && (userData?.health === undefined || userData?.health > 0);

    // If it's an enemy that was alive and hasn't started dying yet, initiate fade-out
    if (isEnemy && wasAlive && !userData.dyingStartTime) {
        userData.dyingStartTime = clock.elapsedTime; // Record start time of fade
        userData.health = 0; // Ensure health is marked as 0

        // Make materials transparent for fade effect
        obj.traverse(child => {
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat, index) => {
                    // Check if it's a shared material reference
                    let isShared = Object.values(sharedMaterials).includes(mat);
                    if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(mat);

                    if (isShared) { // If shared, clone it to modify transparency independently
                        const clonedMat = mat.clone();
                        clonedMat.transparent = true;
                        clonedMat.needsUpdate = true;
                        if (Array.isArray(child.material)) child.material[index] = clonedMat;
                        else child.material = clonedMat;
                    } else { // If not shared, modify directly
                        mat.transparent = true;
                        mat.needsUpdate = true;
                    }
                });
            }
        });
    }
    // If enemy is already fading out, update opacity
    else if (isEnemy && userData.dyingStartTime) {
        const timeElapsed = clock.elapsedTime - userData.dyingStartTime;
        const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION);
        const opacity = 1.0 - fadeProgress; // Calculate opacity based on progress

        obj.traverse(child => {
            if (child.material) { // Update opacity on all materials (cloned or original)
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(m => { m.opacity = opacity; });
            }
        });

        // If fade is complete, remove from scene and dispose
        if (fadeProgress >= 1.0) {
            scene.remove(obj);
            _disposeObject3D(obj); // Dispose geometry/materials
            delete objectMap[id]; // Remove from tracking map
        }
    }
    // For non-enemies or enemies already dead, remove immediately
    else {
        scene.remove(obj);
        _disposeObject3D(obj);
        delete objectMap[id];
    }
}


// --- Scene Synchronization & Updates ---

/**
 * Synchronizes 3D objects in the scene with the provided game state.
 * Creates, updates, or removes objects based on the state data.
 * @param {object} state - The relevant part of the game state (e.g., state.players).
 * @param {object} objectMap - The map storing the 3D objects (e.g., playerGroupMap).
 * @param {function} createFn - Function to create a new 3D object group.
 * @param {function} updateFn - Function to update an existing 3D object group.
 * @param {function} [isSelfFn=null] - Optional function to check if an ID belongs to the local player.
 */
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) {
    if (!scene || !clock) return;
    const activeIds = new Set(); // Track IDs present in the current state

    // Update existing objects and create new ones
    if (state) {
        for (const id in state) {
            const data = state[id];
            // Basic validation: ensure position data exists
            if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;
            activeIds.add(id); // Mark this ID as active

            let obj = objectMap[id];
            const isSelf = isSelfFn ? isSelfFn(id) : false; // Check if it's the local player

            if (!obj) { // Object doesn't exist, create it
                obj = createFn(data, isSelf); // Call creation function
                if (obj) {
                    objectMap[id] = obj; // Store the new object
                    scene.add(obj); // Add to the scene
                    // Call update function immediately after creation for initial setup
                    updateFn(obj, data, 0, isSelf);
                }
            } else { // Object exists, update it
                 // If object was marked as dying, reset that state
                 if (obj.userData?.dyingStartTime) {
                    obj.userData.dyingStartTime = null; // Clear dying timestamp
                    obj.visible = true; // Make visible again
                    // Restore original materials and opacity
                    obj.traverse(child => {
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach((mat, index) => {
                                // Check if it's a temporary cloned material from fading
                                let isShared = Object.values(sharedMaterials).includes(mat);
                                if (!isShared && sharedMaterials.powerups) isShared = Object.values(sharedMaterials.powerups).includes(mat);
                                if (!isShared) mat.dispose(); // Dispose the temporary clone

                                // Restore the correct shared material reference
                                let correctSharedMat = null;
                                if(obj.userData.isPlayer) correctSharedMat = obj.userData.isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
                                else if(obj.userData.isEnemy) correctSharedMat = obj.userData.currentBodyMatRef; // Use stored original ref

                                if(correctSharedMat && child === obj.userData.bodyMesh) { // Only restore body mesh mat for now
                                    if (Array.isArray(child.material)) child.material[index] = correctSharedMat;
                                    else child.material = correctSharedMat;
                                    correctSharedMat.opacity = 1.0;
                                    correctSharedMat.transparent = false; // Ensure not transparent
                                    correctSharedMat.needsUpdate = true;
                                } else if (mat) { // Reset others just in case
                                     mat.opacity = 1.0;
                                     mat.transparent = false;
                                     mat.needsUpdate = true;
                                }
                            });
                        }
                    });
                }
                // Call the update function for the existing object
                updateFn(obj, data, clock.deltaTime, isSelf);
            }
        }
    }

    // Remove objects that are no longer in the state
    for (const id in objectMap) {
        if (!activeIds.has(id)) {
            _handleObjectRemoval(objectMap[id], id, objectMap); // Handle removal (includes fade-out)
        }
    }
}

// Update function for player groups
function _updatePlayerGroup(group, playerData, deltaTime, isSelf) {
    if (!group?.userData) return;

    // --- IMPORTANT: Update world position using mapped server coordinates ---
    mapServerToWorld(playerData.x, playerData.y, group.position);

    const userData = group.userData;
    const bodyMesh = userData.bodyMesh;

    // Determine target material based on player status
    let targetMatRef = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;
    let shouldBeVisible = true;
    switch (playerData.player_status) {
        case PLAYER_STATUS_DOWN: targetMatRef = sharedMaterials.playerDown; break;
        case PLAYER_STATUS_DEAD:
            shouldBeVisible = false; // Hide immediately for dead status
            userData.dyingStartTime = null; // Ensure no fade animation for dead players
            break;
        case PLAYER_STATUS_ALIVE: default: break; // Use default material
    }

    group.visible = shouldBeVisible; // Set visibility

    // Update material only if it changed and the player should be visible
    if (bodyMesh && userData.currentBodyMatRef !== targetMatRef && shouldBeVisible) {
        userData.currentBodyMatRef = targetMatRef; // Store new material reference
        bodyMesh.material = targetMatRef; // Assign new material
    }

    // Update rotation based on aim direction (only if visible)
    if (shouldBeVisible) {
        let aimDx, aimDy;
        if (isSelf && window.appState?.localPlayerAimState) {
            // Use locally calculated aim for immediate feedback
            aimDx = window.appState.localPlayerAimState.lastAimDx;
            aimDy = window.appState.localPlayerAimState.lastAimDy; // Use Z-up aim from local state
        } else if (!isSelf && playerData.aim_dx !== undefined && playerData.aim_dy !== undefined) {
            // Use aim direction from server state for other players
            aimDx = playerData.aim_dx;
            aimDy = playerData.aim_dy; // Server sends Y-down aim, renderer uses Z-up
        } else {
            aimDx = 0; aimDy = -1; // Default aim if data missing
        }
        // Calculate rotation angle around Y axis (up)
        group.rotation.y = Math.atan2(aimDx, aimDy);
    }
}

// Update function for enemy groups
function _updateEnemyGroup(group, enemyData, deltaTime) {
    // Skip update if enemy is already fading out
    if (!group?.userData || group.userData.dyingStartTime || !clock) return;

    // --- IMPORTANT: Update world position using mapped server coordinates ---
    mapServerToWorld(enemyData.x, enemyData.y, group.position);

    group.userData.health = enemyData.health; // Update health stored in userData

    // Update rotation for shooters based on server aim direction
    const gunMesh = group.userData.gunMesh;
    if (enemyData.type === ENEMY_TYPE_SHOOTER && enemyData.aim_dx !== undefined && enemyData.aim_dy !== undefined) {
        group.rotation.y = Math.atan2(enemyData.aim_dx, enemyData.aim_dy); // Rotate based on server aim
    } else if (enemyData.type === ENEMY_TYPE_GIANT) {
        // Optionally rotate giant towards target even without gun?
        // Or just let movement direction imply rotation
    }

    // Giant wind-up visual effect (scaling)
    const bodyMesh = group.userData.bodyMesh;
    if (bodyMesh && enemyData.type === ENEMY_TYPE_GIANT) {
        const isWindingUp = enemyData.attack_state === 'winding_up';
        // Apply subtle scaling oscillation during wind-up
        const scaleTarget = isWindingUp ? 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05 : 1.0;
        // Smoothly lerp towards the target scale
        bodyMesh.scale.lerp(_vector3.set(scaleTarget, scaleTarget, scaleTarget), 0.2);
    }
}

// Update function for powerup groups
function _updatePowerupGroup(group, powerupData, deltaTime) {
    if (!group?.userData || !clock) return;

    // --- IMPORTANT: Update world position using mapped server coordinates ---
    mapServerToWorld(powerupData.x, powerupData.y, group.position);

    // Add visual bobbing effect
    const iconMesh = group.userData.iconMesh;
    if (iconMesh) {
        // Use powerup ID for deterministic but varied bobbing phase
        const bobOffset = (parseInt(group.userData.gameId.substring(0, 4), 16) % 1000) / 1000.0 * Math.PI * 2;
        iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + bobOffset) * 4; // Bobbing motion
        iconMesh.rotation.y += 0.015; // Gentle rotation
    }
}

// Update function for instanced meshes (bullets)
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) {
    if (!mesh) return;
    if (!state || Object.keys(state).length === 0) {
        mesh.count = 0; mesh.instanceMatrix.needsUpdate = true; return; // No instances to draw
    }

    let visibleCount = 0;
    const maxCount = matrices.length / 16; // Max instances based on buffer size

    for (const id in state) {
        if (visibleCount >= maxCount) { console.warn(`Renderer: Exceeded max instances (${maxCount}) for ${mesh.name}.`); break; }
        const data = state[id];

        // Filter bullets based on owner type if necessary (though separate meshes are used now)
        if (isBullet) {
            const isPlayerBullet = data.owner_type === 'player';
            // if (mesh === playerBulletMesh && !isPlayerBullet) continue; // Skip enemy bullet for player mesh
            // if (mesh === enemyBulletMesh && isPlayerBullet) continue; // Skip player bullet for enemy mesh
        }

        // Validate position data
        if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;

        // --- IMPORTANT: Map server coordinates to world position ---
        mapServerToWorld(data.x, data.y, _position);
        _position.y = yOffset; // Apply vertical offset

        // Calculate rotation based on velocity (for bullets)
        if (isBullet && data.vx !== undefined && data.vy !== undefined && (data.vx !== 0 || data.vy !== 0)) {
            // Server vy is Y-down, map to Z-up world rotation
            const angle = Math.atan2(data.vx, data.vy); // atan2(x, y) gives angle relative to positive Y axis
            _quaternion.setFromEuler(new THREE.Euler(0, angle, 0)); // Rotate around world Y axis
        } else {
            _quaternion.identity(); // No rotation if no velocity
        }

        // Determine scale (e.g., for heavy slugs)
        if (isBullet && data.bullet_type === 'ammo_heavy_slug') {
            // Use a slightly larger scale for heavy slugs visually
             _scale.set(HEAVY_SLUG_RADIUS_VISUAL_MULT, HEAVY_SLUG_RADIUS_VISUAL_MULT, 1); // Scale radius, keep length
        } else {
             _scale.set(1, 1, 1); // Default scale
        }


        // Compose matrix and set for this instance
        _matrix.compose(_position, _quaternion, _scale);
        mesh.setMatrixAt(visibleCount, _matrix);
        visibleCount++;
    }

    mesh.count = visibleCount; // Update visible instance count
    mesh.instanceMatrix.needsUpdate = true; // Mark matrix buffer for update
}

// Update physics for active ammo casings
function _updateActiveCasings(deltaTime) {
    if (!ammoCasingMesh || !clock) return;
    if (activeAmmoCasings.length === 0) { // Optimization: if no active casings, ensure count is 0
        if (ammoCasingMesh.count > 0) { ammoCasingMesh.count = 0; ammoCasingMesh.instanceMatrix.needsUpdate = true; } return;
    }

    const now = clock.elapsedTime;
    let needsUpdate = false; // Flag to update instance matrix only if needed

    // Filter out expired casings and update physics for active ones
    activeAmmoCasings = activeAmmoCasings.filter(casing => {
        if (now > casing.endTime) return false; // Remove if lifetime expired

        // Apply gravity and drag
        casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime;
        casing.position.addScaledVector(casing.velocity, deltaTime);
        casing.rotation += casing.rotationSpeed * deltaTime;

        // Ground collision and bounce
        if (casing.position.y <= Y_OFFSET_CASING) {
            casing.position.y = Y_OFFSET_CASING; // Place on ground
            casing.velocity.y *= -AMMO_CASING_BOUNCE; // Reverse and dampen Y velocity
            // Apply drag/friction to horizontal velocity and rotation
            casing.velocity.x *= (1.0 - AMMO_CASING_DRAG);
            casing.velocity.z *= (1.0 - AMMO_CASING_DRAG);
            casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0);
            // Stop bounce/spin if velocity/rotation is very low
            if (Math.abs(casing.velocity.y) < 5) casing.velocity.y = 0;
            if(Math.abs(casing.rotationSpeed) < 0.1) casing.rotationSpeed = 0;
        }
        return true; // Keep active casing
    });

    // Update instanced mesh matrices
    let visibleCount = 0;
    const maxCount = ammoCasingMesh.instanceMatrix.array.length / 16;
    for (let i = 0; i < activeAmmoCasings.length; i++) {
        if (visibleCount >= maxCount) break; // Don't exceed buffer size
        const casing = activeAmmoCasings[i];
        // Set rotation (around Y axis and initial X rotation for cylinder)
        _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0));
        _matrix.compose(casing.position, _quaternion, _scale); // Use default scale (1,1,1)
        ammoCasingMesh.setMatrixAt(visibleCount, _matrix);
        visibleCount++;
        needsUpdate = true; // Matrix needs update if any casing moved
    }

    // Update count and flag matrix for update if necessary
    if (ammoCasingMesh.count !== visibleCount) { ammoCasingMesh.count = visibleCount; needsUpdate = true; }
    if (needsUpdate) { ammoCasingMesh.instanceMatrix.needsUpdate = true; }
}

// Spawn a new visual ammo casing
function _spawnAmmoCasing(serverPos, ejectVector) { // Expects server coordinates for position
    if (!ammoCasingMesh || !clock || activeAmmoCasings.length >= MAX_AMMO_CASINGS) return;

    const now = clock.elapsedTime;
    const life = 1.5 + Math.random() * 1.0; // Random lifetime

    // Calculate ejection physics (angles in world space)
    // ejectVector is based on server aim (dx, 0, dy)
    const ejectAngle = Math.atan2(ejectVector.z, ejectVector.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Eject sideways + randomness
    const ejectSpeed = 150 + Math.random() * 80;
    const upSpeed = 50 + Math.random() * 40;
    const rotationSpeed = (Math.random() - 0.5) * 20;

    // --- IMPORTANT: Map server spawn position to world coordinates ---
    mapServerToWorld(serverPos.x, serverPos.y, _vector3_B);

    // Calculate spawn offset in world space (slightly away from player center)
    const spawnOffsetX = Math.cos(ejectAngle) * 5;
    const spawnOffsetZ = Math.sin(ejectAngle) * 5;
    // Approximate gun height in world space
    const spawnY = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT * 0.6;

    // Add new casing data to the active list
    activeAmmoCasings.push({
        position: new THREE.Vector3(_vector3_B.x + spawnOffsetX, spawnY, _vector3_B.z + spawnOffsetZ ), // Initial world position
        velocity: new THREE.Vector3( Math.cos(ejectAngle) * ejectSpeed, upSpeed, Math.sin(ejectAngle) * ejectSpeed ), // Initial world velocity
        rotation: Math.random() * Math.PI * 2, rotationSpeed: rotationSpeed,
        startTime: now, endTime: now + life
    });
}

// Update hit spark particle system
function _updateHitSparks(deltaTime) {
    if (!hitSparkSystem || !clock) return;
    const positions = hitSparkSystem.geometry.attributes.position.array;
    const colors = hitSparkSystem.geometry.attributes.color.array;
    const alphas = hitSparkSystem.geometry.attributes.alpha.array;
    const data = hitSparkSystem.data;
    let needsGeomUpdate = false; let activeCount = 0;

    for (let i = 0; i < MAX_HIT_SPARKS; i++) {
        const p = data[i];
        if (p.l > 0) { // If particle is alive
            p.l -= deltaTime; // Decrease lifetime
            activeCount++;
            if (p.l <= 0) { // Particle died this frame
                alphas[i] = 0.0; positions[i * 3 + 1] = -10000; // Hide it
            } else { // Update living particle
                p.v.y -= HIT_SPARK_GRAVITY * deltaTime; // Apply gravity
                p.p.addScaledVector(p.v, deltaTime); // Update position
                p.a = Math.min(1.0, Math.max(0, (p.l / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5)); // Calculate alpha based on remaining life
                // Update buffer arrays
                alphas[i] = p.a;
                positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z;
                colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b;
            }
            needsGeomUpdate = true; // Geometry needs update if any particle changed
        } else if (alphas[i] > 0) { // Ensure dead particles are marked as fully transparent
            alphas[i] = 0.0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true;
        }
    }
    // Update geometry attributes if needed
    if (needsGeomUpdate) {
        hitSparkSystem.geometry.attributes.position.needsUpdate = true;
        hitSparkSystem.geometry.attributes.color.needsUpdate = true;
        hitSparkSystem.geometry.attributes.alpha.needsUpdate = true; // Update alpha attribute
        // Note: PointsMaterial doesn't directly use 'alpha' attribute, transparency is material-wide.
        // If per-particle alpha is needed, a custom shader or different approach is required.
        // For now, we just manage lifetime logic. Material opacity handles overall fade if needed.
    }
    hitSparkSystem.particles.visible = activeCount > 0; // Set visibility based on active particles
}

// Trigger new hit sparks at a given world position
function _triggerHitSparks(worldPosition, count = 5) { // Expects world coordinates
    if (!hitSparkSystem || !clock) return;
    const data = hitSparkSystem.data;
    let spawned = 0;
    // Find inactive particles in the pool and activate them
    for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) {
        if (data[i].l <= 0) { // Found an inactive particle
            const p = data[i];
            p.p.copy(worldPosition); // Set initial position
            // Calculate random velocity cone
            const angle = Math.random() * Math.PI * 2;
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; // Vertical spread
            const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD;
            p.v.set( // Calculate velocity components
                Math.cos(angle) * Math.cos(spreadAngle) * speed,
                Math.sin(spreadAngle) * speed * 1.5 + 30, // Add slight upward bias
                Math.sin(angle) * Math.cos(spreadAngle) * speed
            );
            p.c.setRGB(1, 0.2 + Math.random() * 0.3, 0); // Set color (Orange/Yellow)
            p.a = 1.0; // Initial alpha
            p.l = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE; // Set lifetime
            spawned++;
        }
    }
    if (spawned > 0) hitSparkSystem.particles.visible = true; // Make system visible if sparks were added
}

// Update rain particle system
function _updateRain(deltaTime) {
    if (!rainSystem?.lines.visible) return; // Skip if not raining
    const positions = rainSystem.geometry.attributes.position.array;
    const data = rainSystem.data;
    let needsUpdate = false;
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const p = data[i];
        p.y += p.s * deltaTime; // Move drop down based on its speed
        // If drop goes below ground, reset its position to the top
        if (p.y < -50) {
            p.x = Math.random() * worldWidth; p.y = Math.random() * 500 + 1000; p.z = Math.random() * worldHeight;
            p.s = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND; // Reset speed too
        }
        // Update line segment vertices in the buffer
        const idx = i * 6;
        positions[idx + 0] = p.x; positions[idx + 1] = p.y; positions[idx + 2] = p.z; // Start point
        positions[idx + 3] = p.x; positions[idx + 4] = p.y - RAIN_STREAK_LENGTH; positions[idx + 5] = p.z; // End point (below start)
        needsUpdate = true;
    }
    if (needsUpdate) rainSystem.geometry.attributes.position.needsUpdate = true; // Flag buffer for update
}

// Update dust particle system
function _updateDust(deltaTime) {
    if (!dustSystem?.particles.visible || !camera) return; // Skip if no dust storm or camera missing
    const positions = dustSystem.geometry.attributes.position.array;
    const data = dustSystem.data;
    let needsUpdate = false;
    for (let i = 0; i < MAX_DUST_MOTES; i++) {
        const p = data[i];
        p.p.addScaledVector(p.v, deltaTime); // Update position based on velocity

        // Wrap particles around world edges for continuous effect
        if (p.p.x < 0) p.p.x += worldWidth; else if (p.p.x > worldWidth) p.p.x -= worldWidth;
        if (p.p.z < 0) p.p.z += worldHeight; else if (p.p.z > worldHeight) p.p.z -= worldHeight;
        // Add slight random vertical drift and clamp height
        p.p.y += (Math.random() - 0.5) * DUST_SPEED_Y * deltaTime;
        p.p.y = Math.max(5, Math.min(80, p.p.y)); // Keep within vertical bounds

        // Update buffer array
        positions[i * 3 + 0] = p.p.x; positions[i * 3 + 1] = p.p.y; positions[i * 3 + 2] = p.p.z;
        needsUpdate = true;
    }
    if (needsUpdate) dustSystem.geometry.attributes.position.needsUpdate = true;
}

// Update campfire flame particles
function _updateCampfireFlames(deltaTime) {
    if (!campfireSystem?.group.visible || !clock) return;
    const positions = campfireSystem.flameGeometry.attributes.position.array;
    const colors = campfireSystem.flameGeometry.attributes.color.array;
    const sizes = campfireSystem.flameGeometry.attributes.size.array;
    const data = campfireSystem.flameData;
    let needsGeomUpdate = false; let activeCount = 0;

    // Spawn new particles based on rate
    const spawnRate = 150; // Particles per second
    const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random())); // Spawn variability
    let spawned = 0;
    for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) {
        if (data[i].l <= 0) { // Find inactive particle
            const p = data[i];
            const angle = Math.random() * Math.PI * 2; const radius = Math.random() * CAMPFIRE_BASE_RADIUS * 0.8;
            p.p.set(Math.cos(angle) * radius, Y_OFFSET_CAMPFIRE + 2, Math.sin(angle) * radius); // Spawn near base
            p.v.set((Math.random()-0.5)*FLAME_VEL_SPREAD, FLAME_VEL_Y+Math.random()*30, (Math.random()-0.5)*FLAME_VEL_SPREAD); // Upward velocity
            p.l = p.bl; p.s = FLAME_SIZE_START; // Reset lifetime and size
            p.c.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); // Orange/Yellow color
            spawned++;
        }
    }

    // Update existing particles
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        const p = data[i];
        if (p.l > 0) { // If alive
            p.l -= deltaTime; activeCount++;
            if (p.l <= 0) { // Died this frame
                sizes[i] = 0; positions[i * 3 + 1] = -10000; // Hide
            } else { // Update
                p.v.y += (Math.random() - 0.4) * 20 * deltaTime; // Add flicker/turbulence
                p.v.x *= 0.97; p.v.z *= 0.97; // Dampen horizontal velocity
                p.p.addScaledVector(p.v, deltaTime); // Move
                const lifeRatio = Math.max(0, p.l / p.bl);
                p.s = lerp(FLAME_SIZE_END, FLAME_SIZE_START, lifeRatio); // Shrink over time
                p.c.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); // Shift color towards red
                // Update buffers
                sizes[i] = p.s;
                positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z;
                colors[i*3+0]=p.c.r; colors[i*3+1]=p.c.g; colors[i*3+2]=p.c.b;
            }
            needsGeomUpdate = true;
        } else if (sizes[i] > 0) { // Ensure dead particles are hidden
            sizes[i] = 0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true;
        }
    }

    if (needsGeomUpdate) {
        campfireSystem.flameGeometry.attributes.position.needsUpdate = true;
        campfireSystem.flameGeometry.attributes.color.needsUpdate = true;
        campfireSystem.flameGeometry.attributes.size.needsUpdate = true;
    }
    campfireSystem.flameParticles.visible = activeCount > 0;
}

// Update campfire smoke particles
function _updateCampfireSmoke(deltaTime) {
     if (!campfireSystem?.group.visible || !clock) return;
    const positions = campfireSystem.smokeGeometry.attributes.position.array;
    const alphas = campfireSystem.smokeGeometry.attributes.alpha.array; // Custom alpha attribute
    const sizes = campfireSystem.smokeGeometry.attributes.size.array;
    const data = campfireSystem.smokeData;
    let needsGeomUpdate = false; let activeCount = 0;

    // Spawn new particles
    const spawnRate = 80; const numToSpawn = Math.floor(spawnRate * deltaTime * (0.6 + Math.random()));
    let spawned = 0;
    for (let i = 0; i < MAX_SMOKE_PARTICLES && spawned < numToSpawn; i++) {
        if (data[i].l <= 0) {
            const p = data[i];
            const angle = Math.random()*Math.PI*2; const radius = Math.random()*CAMPFIRE_BASE_RADIUS*0.6;
            p.p.set(Math.cos(angle)*radius, Y_OFFSET_CAMPFIRE+5, Math.sin(angle)*radius); // Spawn near base
            p.v.set((Math.random()-0.5)*SMOKE_VEL_SPREAD, SMOKE_VEL_Y+Math.random()*15, (Math.random()-0.5)*SMOKE_VEL_SPREAD); // Upward drift
            p.l = p.bl; p.s = SMOKE_SIZE_START; p.a = SMOKE_OPACITY_START * (0.8 + Math.random() * 0.4); // Reset lifetime, size, alpha
            spawned++;
        }
    }

    // Update existing particles
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
        const p = data[i];
        if (p.l > 0) {
            p.l -= deltaTime; activeCount++;
            if (p.l <= 0) { // Died
                alphas[i] = 0.0; sizes[i] = 0; positions[i * 3 + 1] = -10000;
            } else { // Update
                p.v.y += (Math.random() - 0.45) * 5 * deltaTime; // Vertical drift
                p.v.x += (Math.random() - 0.5) * 8 * deltaTime; // Horizontal drift
                p.v.z += (Math.random() - 0.5) * 8 * deltaTime;
                p.v.multiplyScalar(0.98); // Dampen velocity
                p.p.addScaledVector(p.v, deltaTime); // Move
                const lifeRatio = Math.max(0, p.l / p.bl);
                p.s = lerp(SMOKE_SIZE_END, SMOKE_SIZE_START, lifeRatio); // Grow over time
                p.a = lerp(SMOKE_OPACITY_END, SMOKE_OPACITY_START, lifeRatio * lifeRatio); // Fade out (squared for slower start)
                // Update buffers
                sizes[i] = p.s; alphas[i] = p.a;
                positions[i*3+0]=p.p.x; positions[i*3+1]=p.p.y; positions[i*3+2]=p.p.z;
            }
            needsGeomUpdate = true;
        } else if (alphas[i] > 0) { // Ensure dead are hidden
            alphas[i] = 0.0; sizes[i] = 0; positions[i * 3 + 1] = -10000; needsGeomUpdate = true;
        }
    }

    if (needsGeomUpdate) {
        campfireSystem.smokeGeometry.attributes.position.needsUpdate = true;
        campfireSystem.smokeGeometry.attributes.alpha.needsUpdate = true; // Update alpha attribute
        campfireSystem.smokeGeometry.attributes.size.needsUpdate = true;
        // Update material opacity based on average alpha or fixed value?
        // For simplicity, keep material opacity constant, rely on texture alpha.
        // campfireSystem.smokeMaterial.opacity = SMOKE_OPACITY_START; // Or calculate average alpha?
    }
    campfireSystem.smokeParticles.visible = activeCount > 0;
}

// Update the campfire object (position, visibility, particles)
function _updateCampfire(deltaTime) {
    if (!campfireSystem || !clock) return;
    // Get campfire state from the main application state
    const cfData = window.appState?.serverState?.campfire;
    const isActive = cfData?.active ?? false; // Campfire active state from server (tied to is_night)

    campfireSystem.group.visible = isActive; // Set group visibility

    if (isActive) {
        // --- IMPORTANT: Update world position using mapped server coordinates ---
        mapServerToWorld(cfData.x, cfData.y, campfireSystem.group.position);

        // Update glow light intensity
        if (campfireSystem.glowLight) {
            campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0 + Math.random()*0.5) * 0.8; // Flickering effect
        }
        // Update flame and smoke particles
        _updateCampfireFlames(deltaTime);
        _updateCampfireSmoke(deltaTime);
    } else { // If inactive, ensure particles are hidden and light is off
        campfireSystem.flameParticles.visible = false;
        campfireSystem.smokeParticles.visible = false;
        if (campfireSystem.glowLight) campfireSystem.glowLight.intensity = 0;
    }
}

// Update the snake visual representation
function _updateSnake(snakeData) { // snakeData comes from main.js (originates from server)
    if (!snakeMesh) return;

    const isActive = snakeData?.active ?? false;
    snakeMesh.visible = isActive; // Set mesh visibility based on server state

    if (isActive && snakeData.segments && snakeData.segments.length > 1) {
        // --- IMPORTANT: Map server segment coordinates to world coordinates ---
        const points = snakeData.segments.map(seg => {
            mapServerToWorld(seg.x, seg.y, _vector3_B); // Map each segment point
            return _vector3_B.clone().setY(Y_OFFSET_SNAKE); // Apply vertical offset
        });

        // Create a smooth curve through the mapped points
        if (points.length >= 2) {
            try {
                // Use CatmullRomCurve3 for smooth interpolation between logical points
                const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1); // Adjust tension (0.1) if needed
                // Get more points along the curve for a smoother tube geometry
                const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2); // Sample more points than segments

                if(tubePoints.length >= 2) {
                    // Create new tube geometry based on the smooth curve points
                    const newGeometry = new THREE.TubeGeometry(
                        new THREE.CatmullRomCurve3(tubePoints), // Use sampled points for final curve
                        tubePoints.length - 1, // Number of segments in the tube geometry
                        SNAKE_RADIUS, // Visual radius of the tube
                        6, // Radial segments (complexity of the tube cross-section)
                        false // Not a closed tube
                    );
                    // Dispose the old geometry and assign the new one
                    snakeMesh.geometry.dispose();
                    snakeMesh.geometry = newGeometry;
                    snakeMesh.visible = true; // Ensure visible if geometry updated successfully
                } else { snakeMesh.visible = false; } // Hide if not enough points for curve
            } catch(e) {
                console.error("Renderer Error updating snake geometry:", e);
                snakeMesh.visible = false; // Hide on error
            }
        } else { snakeMesh.visible = false; } // Hide if not enough logical segments
    } else {
        snakeMesh.visible = false; // Hide if server state says inactive
    }
}

// Update environment settings (lighting, fog, background, weather visibility)
function _updateEnvironment(isNight, isRaining, isDustStorm) {
    if (!scene || !ambientLight || !directionalLight || !groundPlane || !clock) return;

    // Define day/night parameters
    const dayAI = 0.7, nightAI = 0.45; // Ambient Intensity
    const dayDI = 1.2, nightDI = 0.7; // Directional Intensity
    const dayAC = 0xffffff, nightAC = 0x7080a0; // Ambient Color
    const dayDC = 0xffffff, nightDC = 0xa0b0ff; // Directional Color
    const dayFogC = 0xc0d0e0, dayFogD = 0.0003; // Fog Color / Density (Day)
    const nightFogC = 0x04060a, nightFogD = 0.0008; // Fog Color / Density (Night)
    const dustFogC = 0xb09070, dustFogD = 0.0015; // Fog Color / Density (Dust Storm)

    // Determine target values based on state
    const targetAI = isNight ? nightAI : dayAI;
    const targetDI = isNight ? nightDI : dayDI;
    const targetAC = isNight ? nightAC : dayAC;
    const targetDC = isNight ? nightDC : dayDC;
    const targetGM = isNight ? sharedMaterials.groundNight : sharedMaterials.groundDay; // Target ground material

    let targetFD, targetFC; // Target Fog Density / Color
    if(isDustStorm) { targetFD = dustFogD; targetFC = dustFogC; }
    else if(isNight) { targetFD = nightFogD; targetFC = nightFogC; }
    else { targetFD = dayFogD; targetFC = dayFogC; }

    // Smoothly interpolate current values towards target values
    const lerpA = 0.05; // Lerp factor for smooth transitions
    ambientLight.intensity = lerp(ambientLight.intensity, targetAI, lerpA);
    directionalLight.intensity = lerp(directionalLight.intensity, targetDI, lerpA);
    ambientLight.color.lerp(_color.setHex(targetAC), lerpA);
    directionalLight.color.lerp(_color.setHex(targetDC), lerpA);

    // Update ground material if needed
    if (groundPlane.material !== targetGM) groundPlane.material = targetGM;

    // Update fog
    if (!scene.fog) scene.fog = new THREE.FogExp2(targetFC, targetFD); // Create fog if none exists
    else { scene.fog.color.lerp(_color.setHex(targetFC), lerpA); scene.fog.density = lerp(scene.fog.density, targetFD, lerpA); }

    // Update background color to match fog
    if (!scene.background || !(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    scene.background.lerp(_color.setHex(targetFC), lerpA);

    // Update weather particle system visibility
    if (rainSystem?.lines) rainSystem.lines.visible = isRaining;
    if (dustSystem?.particles) dustSystem.particles.visible = isDustStorm;
}

// Update muzzle flash light effect
function _updateMuzzleFlash(localEffects, playerGroup) {
    if (!muzzleFlashLight || !clock) return;
    const flashState = localEffects?.muzzleFlash; // Get flash state from main.js localEffects
    const nowMs = clock.elapsedTime * 1000;

    // Activate light if flash is active and player group exists
    if (flashState?.active && nowMs < flashState.endTime && playerGroup) {
        muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; // Random intensity for flicker
        const gunMesh = playerGroup.userData.gunMesh;
        if (gunMesh) {
            // Position light at the end of the gun barrel in world space
            _vector3.set(0, 0, PLAYER_GUN_LENGTH / 2 + 5); // Position relative to gun center
            gunMesh.localToWorld(_vector3); // Convert local gun position to world position
            muzzleFlashLight.position.copy(_vector3);
        } else { muzzleFlashLight.intensity = 0; } // Turn off if no gun mesh found
    } else { // Turn off light if flash inactive or expired
        muzzleFlashLight.intensity = 0;
        if (flashState) flashState.active = false; // Ensure local effect state is marked inactive
    }
}

// Project a 3D world position to 2D screen coordinates
function _projectToScreen(worldPosition) {
    if (!camera || !renderer?.domElement || !domContainer) return null;
    try {
        _vector3.copy(worldPosition);
        _vector3.project(camera); // Project world position to NDC

        // Check if behind camera
        if (_vector3.z > 1.0) return null;

        // Convert NDC to screen coordinates relative to the container
        const rect = domContainer.getBoundingClientRect();
        const widthHalf = rect.width / 2;
        const heightHalf = rect.height / 2;
        const screenX = Math.round((_vector3.x * widthHalf) + widthHalf);
        const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); // Y is inverted in screen space

        return { screenX, screenY };
    } catch (e) { console.warn("Renderer: _projectToScreen error:", e); return null; }
}

// Update camera position to follow the local player smoothly
function _updateCamera(deltaTime, localPlayerGroup) {
    if (!camera || !clock) return;
    let targetX, targetZ;

    // Determine target position (local player or world center fallback)
    if (localPlayerGroup && localPlayerGroup.visible) {
        // --- IMPORTANT: Use the player group's world position (already mapped) ---
        targetX = localPlayerGroup.position.x;
        targetZ = localPlayerGroup.position.z;
    } else {
        // Fallback to fixed world center if player doesn't exist or is invisible
        targetX = _worldCenter.x;
        targetZ = _worldCenter.z;
    }

    _cameraTargetWorldPos.set(targetX, 0, targetZ); // Target lookAt position (on the ground plane)
    // Calculate desired camera position (offset from target)
    _cameraDesiredPos.set(targetX, CAMERA_HEIGHT_OFFSET, targetZ + CAMERA_DISTANCE_OFFSET);

    // Smoothly interpolate camera position towards desired position
    camera.position.lerp(_cameraDesiredPos, CAMERA_LERP_FACTOR);

    // Apply screen shake effect
    const nowMs = clock.elapsedTime * 1000;
    if (shakeMagnitude > 0 && nowMs < shakeEndTime) {
        const timeRemaining = shakeEndTime - nowMs;
        // Calculate decay factor (e.g., quadratic decay)
        const totalDuration = shakeEndTime - (nowMs - deltaTime * 1000); // Approx duration based on last frame
        const decayFactor = totalDuration > 0 ? Math.pow(Math.max(0, timeRemaining / totalDuration), 2) : 0;
        const currentMag = shakeMagnitude * decayFactor;
        // Apply random offset based on magnitude
        const shakeAngle = Math.random() * Math.PI * 2;
        screenShakeOffset.set(
            Math.cos(shakeAngle) * currentMag,
            (Math.random() - 0.5) * currentMag * 0.5, // Less vertical shake
            Math.sin(shakeAngle) * currentMag
        );
        camera.position.add(screenShakeOffset); // Add shake offset to camera position
    } else {
        shakeMagnitude = 0; // Reset shake magnitude if expired
    }

    // Make camera look at the target position
    camera.lookAt(_cameraTargetWorldPos);
}


// --- Public API ---
const Renderer3D = {
    /**
     * Initializes the THREE.js renderer, scene, camera, and other components.
     * @param {HTMLElement} containerElement - The DOM element to contain the canvas.
     * @param {number} initialWorldWidth - The fixed width of the game world.
     * @param {number} initialWorldHeight - The fixed height of the game world.
     * @returns {boolean} True if initialization was successful, false otherwise.
     */
    init: (containerElement, initialWorldWidth, initialWorldHeight) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;

        // Set fixed world dimensions provided by main.js
        worldWidth = initialWorldWidth || DEFAULT_WORLD_WIDTH;
        worldHeight = initialWorldHeight || DEFAULT_WORLD_HEIGHT;
        _worldCenter.set(worldWidth / 2, 0, worldHeight / 2); // Calculate world center

        currentCanvasWidth = domContainer.clientWidth || worldWidth; // Initial canvas size
        currentCanvasHeight = domContainer.clientHeight || worldHeight;

        try {
            // Renderer Setup
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(currentCanvasWidth, currentCanvasHeight);
            renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Enable soft shadows
            renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space
            domContainer.appendChild(renderer.domElement); // Add canvas to container

            // Scene Setup
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a28); // Initial background color

            // Camera Setup
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, currentCanvasWidth / currentCanvasHeight, CAMERA_NEAR, CAMERA_FAR);
            camera.position.set(_worldCenter.x, CAMERA_HEIGHT_OFFSET, _worldCenter.z + CAMERA_DISTANCE_OFFSET); // Initial camera position
            camera.lookAt(_worldCenter); scene.add(camera);

            // Lighting Setup
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(_worldCenter.x + worldWidth * 0.1, 400, _worldCenter.z + worldHeight * 0.2); // Position light relative to world center
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048; // Shadow map resolution
            directionalLight.shadow.bias = -0.002; // Adjust shadow bias
            // Set shadow camera bounds based on fixed world size
            const shadowCamSizeX = worldWidth * 0.6; const shadowCamSizeZ = worldHeight * 0.6;
            directionalLight.shadow.camera.near = 150; directionalLight.shadow.camera.far = 800;
            directionalLight.shadow.camera.left = -shadowCamSizeX; directionalLight.shadow.camera.right = shadowCamSizeX;
            directionalLight.shadow.camera.top = shadowCamSizeZ; directionalLight.shadow.camera.bottom = -shadowCamSizeZ;
            directionalLight.target.position.copy(_worldCenter); // Ensure light targets world center
            scene.add(directionalLight); scene.add(directionalLight.target);
            // Muzzle Flash Light (Point light, initially off)
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8);
            muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);

            // Create Assets, Geometries, Materials
            _createAssets(); _createGeometries(); _createMaterials();

            // Create Ground Plane (scaled to world size)
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.scale.set(worldWidth, worldHeight, 1); // Scale plane geometry
            groundPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
            groundPlane.position.copy(_worldCenter); // Center the ground plane
            groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane";
            scene.add(groundPlane);

            // Create Boundaries, Particles, Campfire, Snake
            _createBoundaries(); // Uses fixed world size
            _initParticlesAndInstances(); // Uses fixed world size for initial placement
            _initCampfire();
            _initSnake();

            clock = new THREE.Clock(); // Start clock for animations/updates

            Renderer3D.handleContainerResize(); // Initial resize to set aspect ratio
            setTimeout(() => Renderer3D.handleContainerResize(), 150); // Handle potential race condition on load

        } catch (error) {
            console.error("Renderer Init Error:", error); Renderer3D.cleanup(); return false;
        }
        console.log("--- Renderer3D initialization complete ---"); return true;
    },

    /** Handles resizing of the canvas container. Only updates viewport/aspect ratio. */
    handleContainerResize: () => {
        if (!renderer || !camera || !domContainer) return;
        const newWidth = domContainer.clientWidth; const newHeight = domContainer.clientHeight;
        if (newWidth <= 0 || newHeight <= 0 || (newWidth === currentCanvasWidth && newHeight === currentCanvasHeight)) return; // No change or invalid size

        currentCanvasWidth = newWidth; currentCanvasHeight = newHeight;
        renderer.setSize(newWidth, newHeight); // Update renderer size
        camera.aspect = newWidth / newHeight; // Update camera aspect ratio
        camera.updateProjectionMatrix(); // Apply changes
        // log(`Renderer: Resize Handled - Canvas: ${currentCanvasWidth}x${currentCanvasHeight}`); // Optional debug log
    },

    /**
     * Renders the scene based on the provided game state.
     * @param {object} stateToRender - The interpolated/reconciled game state (using server coordinates).
     * @param {object} appState - The main client application state.
     * @param {object} localEffects - Client-side visual effects state.
     */
    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) return;
        const deltaTime = clock.getDelta();

        // --- Update Scene Elements ---
        const localPlayerGroup = appState.localPlayerId ? playerGroupMap[appState.localPlayerId] : null;
        _updateCamera(deltaTime, localPlayerGroup); // Update camera based on local player's world position
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);

        // Synchronize 3D objects with game state (these functions handle coordinate mapping internally)
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);

        // Update instanced meshes (bullets)
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);

        // Update particle systems & other effects
        _updateActiveCasings(deltaTime);
        _updateHitSparks(deltaTime);
        _updateRain(deltaTime);
        _updateDust(deltaTime);
        _updateCampfire(deltaTime); // Uses server state directly for position/active
        _updateSnake(stateToRender.snake_state); // Uses server state passed via main.js
        _updateMuzzleFlash(localEffects, localPlayerGroup); // Uses local effect state

        // --- Calculate UI Overlay Positions ---
        // Project relevant entity world positions to screen coordinates for main.js
        const uiPositions = {};
        const projectEntity = (objMap, stateMap, yOffsetFn) => {
            for(const id in objMap){
                const obj = objMap[id];
                const data = stateMap?.[id]; // Get corresponding state data
                if(obj?.visible && data){ // Only project visible entities with state data
                    // Clone world position and apply appropriate vertical offset for projection anchor
                    const worldPos = obj.position.clone();
                    worldPos.y = yOffsetFn(data, obj); // Calculate Y offset based on entity type/state
                    const screenPos = _projectToScreen(worldPos); // Project to screen
                    if(screenPos) uiPositions[id] = screenPos; // Store if projection successful
                }
            }
        };
        // Define Y-offset functions for different entity types (anchor point for UI element)
        const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y + PLAYER_HEAD_RADIUS * 1.5 || PLAYER_TOTAL_VISUAL_HEIGHT;
        const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y + (d.type===ENEMY_TYPE_GIANT ? ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER : ENEMY_HEAD_RADIUS)*1.2 || ENEMY_DEFAULTS.height;
        const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y + POWERUP_BASE_SIZE*.5 || Y_OFFSET_POWERUP;
        // Project entities
        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY);
        projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY);
        projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);

        // Project damage text origins (server coords need mapping first)
        if (stateToRender.damage_texts) {
            for(const id in stateToRender.damage_texts){
                const dt = stateToRender.damage_texts[id];
                // Map server coords to world, apply offset, then project
                mapServerToWorld(dt.x, dt.y, _vector3_B);
                _vector3_B.y = PLAYER_TOTAL_VISUAL_HEIGHT * 0.8; // Approx Y offset for damage text origin
                const screenPos = _projectToScreen(_vector3_B);
                if(screenPos) uiPositions[id] = screenPos;
            }
        }
        // Update uiPositions in the main app state for UIManager to use
        appState.uiPositions = uiPositions;

        // --- Render the Scene ---
        try { renderer.render(scene, camera); }
        catch (e) { // Catch render errors to prevent loop crash
            console.error("!!! RENDER ERROR !!!", e);
            if (window.appState?.animationFrameId) { // Stop game loop on render error
                cancelAnimationFrame(window.appState.animationFrameId);
                window.appState.animationFrameId = null;
                console.error("!!! Animation loop stopped due to render error. !!!");
                // Optionally update UI status
                if(UIManager) UIManager.updateStatus("FATAL RENDER ERROR!", true);
            }
        }
    },

    /** Triggers a camera shake effect. */
    triggerShake: (magnitude, durationMs) => {
        if (!clock) return;
        const nowMs = clock.elapsedTime * 1000;
        const newEndTime = nowMs + durationMs;
        // Apply shake if new magnitude is larger or effect lasts longer
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(0.1, magnitude); // Ensure minimum magnitude
            shakeEndTime = Math.max(nowMs, newEndTime); // Extend end time if needed
        }
    },

    /** Spawns a visual ammo casing effect. Expects position in server coordinates. */
    spawnVisualAmmoCasing: (serverPos, ejectVector) => {
        if (!clock) return;
        _spawnAmmoCasing(serverPos, ejectVector); // Internal function handles mapping
    },

    /** Triggers visual hit sparks. Expects position in world coordinates. */
    triggerVisualHitSparks: (worldPosition, count = 5) => {
        if (!clock) return;
        _triggerHitSparks(worldPosition, count);
    },

    /** Exposes the coordinate mapping utility. */
    mapServerToWorld: (serverX, serverY, targetVector = _vector3_B) => {
        mapServerToWorld(serverX, serverY, targetVector);
        return targetVector; // Return for convenience
    },

    /** Exposes the coordinate mapping utility. */
    mapWorldToServer: (worldVector) => mapWorldToServer(worldVector),

    /** Exposes the screen projection utility. */
    projectToScreen: (worldPosition) => _projectToScreen(worldPosition),

    /** Cleans up THREE.js resources. */
    cleanup: () => {
        console.log("--- Renderer3D Cleanup ---");
        try { // Dispose particle systems
            [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(system => {
                if (system) {
                    if (system.particles) scene?.remove(system.particles); if (system.lines) scene?.remove(system.lines); if (system.group) scene?.remove(system.group);
                    system.geometry?.dispose(); system.material?.dispose();
                    if(system.flameGeometry) system.flameGeometry.dispose(); if(system.smokeGeometry) system.smokeGeometry.dispose();
                     _disposeMaterialTextures(system.flameMaterial); system.flameMaterial?.dispose();
                     _disposeMaterialTextures(system.smokeMaterial); system.smokeMaterial?.dispose();
                }
            });
        } catch(e){error("Cleanup particles error:",e);}
        hitSparkSystem=null; rainSystem=null; dustSystem=null; campfireSystem=null;

        try { // Dispose instanced meshes
            [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(mesh => { if (mesh) { scene?.remove(mesh); mesh.geometry?.dispose(); } });
        } catch(e){error("Cleanup instanced mesh error:",e);}
        playerBulletMesh=null; enemyBulletMesh=null; ammoCasingMesh=null;

        try { if(snakeMesh){scene?.remove(snakeMesh); snakeMesh.geometry?.dispose(); snakeMesh=null;} } catch(e){error("Cleanup snake error:",e);}
        try { if(boundariesGroup){scene?.remove(boundariesGroup); _disposeObject3D(boundariesGroup); boundariesGroup=null;} } catch(e){error("Cleanup boundaries error:",e);}
        try { // Dispose dynamic entity groups
            [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(objectMap => { for (const id in objectMap) { _handleObjectRemoval(objectMap[id], id, objectMap); } });
        } catch(e){error("Cleanup dynamic objects error:",e);}

        try { // Dispose shared resources
            Object.values(sharedGeometries).forEach(g => g?.dispose()); Object.values(powerupGeometries).forEach(g => g?.dispose());
            Object.values(sharedMaterials).forEach(m => { if (m instanceof THREE.Material) { _disposeMaterialTextures(m); m.dispose(); } });
            if (sharedMaterials.powerups) Object.values(sharedMaterials.powerups).forEach(m => { if (m instanceof THREE.Material) { _disposeMaterialTextures(m); m.dispose(); } });
            Object.values(loadedAssets).forEach(a => a?.dispose());
        } catch(e){error("Cleanup shared resources error:",e);}
        // Clear resource maps
        Object.keys(sharedGeometries).forEach(k=>delete sharedGeometries[k]); Object.keys(powerupGeometries).forEach(k=>delete powerupGeometries[k]);
        Object.keys(sharedMaterials).forEach(k=>{if(k!=='powerups')delete sharedMaterials[k];else delete sharedMaterials.powerups;});
        Object.keys(loadedAssets).forEach(k=>delete loadedAssets[k]);

        try { if(groundPlane){scene?.remove(groundPlane); _disposeObject3D(groundPlane); groundPlane=null;} } catch(e){error("Cleanup ground error:",e);}
        try { // Remove lights
            if (scene) { scene.remove(ambientLight); scene.remove(directionalLight); scene.remove(directionalLight?.target); scene.remove(muzzleFlashLight); }
        } catch(e){error("Cleanup lights error:",e);}
        ambientLight=null; directionalLight=null; muzzleFlashLight=null;

        try { // Dispose renderer and remove canvas
            if(renderer){ renderer.dispose(); if(renderer.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); renderer=null; }
        } catch(e){error("Cleanup renderer error:",e);}

        // Reset core variables
        scene=null; camera=null; clock=null; domContainer=null;
        playerBulletMatrices=[]; enemyBulletMatrices=[]; activeAmmoCasings=[];
        shakeMagnitude=0; shakeEndTime=0;
        console.log("Renderer3D resources released.");
    },

    // Getters for internal components if needed by other modules (e.g., InputManager)
    getCamera: () => camera,
    getGroundPlane: () => groundPlane,
    getScene: () => scene,
};

export default Renderer3D;
