// Renderer3D.js
// Advanced renderer using Three.js for Kelly Gang Survival.
// Features: Instanced rendering, particle effects, perspective camera, detailed models.

import * as THREE from 'three';

// --- Constants ---
const DEFAULT_GAME_WIDTH = 1600; // Default, will be updated from init/appState
const DEFAULT_GAME_HEIGHT = 900;
const CAMERA_FOV = 60;
const CAMERA_NEAR = 10;
const CAMERA_FAR = 2500;
const CAMERA_BASE_Y = 1000; // Height above the ground
const CAMERA_ANGLE = -Math.PI / 2.8; // Steeper angle looking down
const CAMERA_LERP_FACTOR = 0.08; // How quickly camera follows player

const GROUND_MARGIN = 1.2; // How much bigger the ground plane is than the game area

// Instancing & Particle Limits
const MAX_PLAYER_BULLETS = 500;
const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150;
const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000;
const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80;

// Gameplay Object Dimensions (Approximations)
const PLAYER_CAPSULE_RADIUS = 12;
const PLAYER_CAPSULE_HEIGHT = 24; // Height of cylindrical part
const PLAYER_TOTAL_HEIGHT = PLAYER_CAPSULE_HEIGHT + PLAYER_CAPSULE_RADIUS * 2;
const PLAYER_HEAD_RADIUS = 10;
const PLAYER_GUN_LENGTH = 25;
const PLAYER_GUN_RADIUS = 2;

const ENEMY_CHASER_WIDTH = 20; const ENEMY_CHASER_HEIGHT = 40; const ENEMY_CHASER_DEPTH = 14;
const ENEMY_SHOOTER_RADIUS = 12; const ENEMY_SHOOTER_HEIGHT = 45;
const ENEMY_GUN_LENGTH = 25; const ENEMY_GUN_RADIUS = 2.5;
const ENEMY_GIANT_MULTIPLIER = 2.5;
const ENEMY_HEAD_RADIUS = 8;

const POWERUP_BASE_SIZE = 18;
const BULLET_RADIUS = 4;

const CAMPFIRE_LOG_RADIUS = 5;
const CAMPFIRE_LOG_LENGTH = 40;
const CAMPFIRE_BASE_RADIUS = 25; // Area flames spawn within

const SNAKE_VISUAL_SEGMENTS = 40;
const SNAKE_RADIUS = 6;

const AMMO_CASING_RADIUS = 0.6;
const AMMO_CASING_LENGTH = 3.5;

// Physics/Animation Constants
const AMMO_CASING_GRAVITY = 980;
const AMMO_CASING_BOUNCE = 0.3;
const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500;
const HIT_SPARK_BASE_LIFE = 0.2;
const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150;
const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.6;
const FLAME_RAND_LIFE = 0.5;
const FLAME_VEL_Y = 60;
const FLAME_VEL_SPREAD = 25;
const RAIN_SPEED_Y = -500;
const RAIN_SPEED_Y_RAND = -200;
const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40;
const DUST_SPEED_Y = 8;
const DUST_OPACITY = 0.15;
const FADE_OUT_DURATION = 0.35; // For dead enemies

const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

// Y-Offsets for placing objects relative to the ground (plane at Y=0)
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS; // Bottom of capsule on ground
const Y_OFFSET_ENEMY_BODY = 0; // Base of enemy body on ground
const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7;
const Y_OFFSET_BULLET = 10;
const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS;
const Y_OFFSET_SNAKE = SNAKE_RADIUS;
const Y_OFFSET_CASING = AMMO_CASING_RADIUS;

// --- Module Scope Variables ---

// Core THREE
let renderer, scene, camera, clock;
let ambientLight, directionalLight;

// Game Area
let gameWidth = DEFAULT_GAME_WIDTH;
let gameHeight = DEFAULT_GAME_HEIGHT;
let groundPlane = null;

// Object Maps (GameID -> THREE.Object3D or index for instanced)
const playerGroupMap = {}; // Player Group (Body, Head, Gun)
const enemyGroupMap = {};  // Enemy Group (Body, Head, Optional Gun)
const powerupGroupMap = {};// Powerup Group (Icon)

// Instanced Meshes & Particle Systems
let playerBulletMesh = null; let playerBulletMatrices = []; let playerBulletCount = 0;
let enemyBulletMesh = null;  let enemyBulletMatrices = [];  let enemyBulletCount = 0;
let ammoCasingMesh = null;   let activeAmmoCasings = []; // { matrix, velocity, life, rotation }
let hitSparkSystem = null;   // { particles, geometry, material, data }
let rainSystem = null;       // { lines, geometry, material, data }
let dustSystem = null;       // { particles, geometry, material, data }
let campfireSystem = null;   // { group, flameParticles, glowLight, data }
let snakeMesh = null;

// Effects
let muzzleFlashLight = null;
let screenShakeOffset = new THREE.Vector3(0, 0, 0);
let shakeMagnitude = 0;
let shakeEndTime = 0;
let cameraTargetPos = new THREE.Vector3(gameWidth / 2, 0, gameHeight / 2); // Target point on the ground

// Shared Resources
const sharedGeometries = {};
const sharedMaterials = {};
const powerupGeometries = {}; // Specific geometries for powerup types
const loadedAssets = {}; // For textures etc.

// Temp objects for calculations
const _dummyObject = new THREE.Object3D();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();
const _vector3 = new THREE.Vector3(); // General purpose temp vector


// --- Initialization Functions ---

/** Creates textures needed by the renderer. */
function _createAssets() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Failed to get 2D context for texture");

        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,220,150,1)');
        gradient.addColorStop(0.4, 'rgba(255,150,0,0.8)');
        gradient.addColorStop(1, 'rgba(200,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);

        loadedAssets.flameTexture = new THREE.CanvasTexture(canvas);
        loadedAssets.flameTexture.name = "FlameTexture";
        console.log("Flame texture created.");
    } catch (error) {
        console.error("Error creating flame texture:", error);
        // Optionally create a fallback placeholder texture
    }
}

/** Creates reusable geometries. */
function _createGeometries() {
    sharedGeometries.playerBody = new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS, PLAYER_CAPSULE_HEIGHT, 4, 12);
    sharedGeometries.head = new THREE.SphereGeometry(1, 12, 8); // Scaled later
    sharedGeometries.playerGun = new THREE.CylinderGeometry(PLAYER_GUN_RADIUS, PLAYER_GUN_RADIUS * 0.8, PLAYER_GUN_LENGTH, 8);

    sharedGeometries.enemyChaserBody = new THREE.BoxGeometry(ENEMY_CHASER_WIDTH, ENEMY_CHASER_HEIGHT, ENEMY_CHASER_DEPTH);
    sharedGeometries.enemyShooterBody = new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_RADIUS, ENEMY_SHOOTER_HEIGHT, 10);
    sharedGeometries.enemyGiantBody = new THREE.BoxGeometry(
        ENEMY_CHASER_WIDTH * ENEMY_GIANT_MULTIPLIER,
        ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER,
        ENEMY_CHASER_DEPTH * ENEMY_GIANT_MULTIPLIER
    );
    sharedGeometries.enemyGun = new THREE.CylinderGeometry(ENEMY_GUN_RADIUS, ENEMY_GUN_RADIUS * 0.7, ENEMY_GUN_LENGTH, 8);

    sharedGeometries.bullet = new THREE.SphereGeometry(BULLET_RADIUS, 6, 5);
    sharedGeometries.ammoCasing = new THREE.CylinderGeometry(AMMO_CASING_RADIUS, AMMO_CASING_RADIUS, AMMO_CASING_LENGTH, 6);

    // Unique Powerup Geometries
    const ps = POWERUP_BASE_SIZE;
    powerupGeometries.health = new THREE.TorusGeometry(ps * 0.4, ps * 0.15, 8, 16); // Ring
    powerupGeometries.gun_upgrade = new THREE.ConeGeometry(ps * 0.45, ps * 0.9, 4); // Cone
    powerupGeometries.speed_boost = new THREE.CylinderGeometry(ps * 0.6, ps * 0.6, ps * 0.25, 16); // Flat Disc
    powerupGeometries.armor = new THREE.OctahedronGeometry(ps * 0.6, 0); // Octahedron
    powerupGeometries.ammo_shotgun = new THREE.BoxGeometry(ps * 0.8, ps * 0.8, ps * 0.8); // Cube
    powerupGeometries.ammo_heavy_slug = new THREE.SphereGeometry(ps * 0.6, 12, 8); // Sphere
    powerupGeometries.ammo_rapid_fire = new THREE.TorusGeometry(ps * 0.4, ps * 0.1, 6, 12); // Thin Ring
    powerupGeometries.bonus_score = new THREE.CylinderGeometry(ps * 0.35, ps * 0.35, ps * 0.5, 12); // Coin-like
    powerupGeometries.default = new THREE.BoxGeometry(ps * 0.9, ps * 0.9, ps * 0.9); // Default Box

    sharedGeometries.log = new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_RADIUS, CAMPFIRE_LOG_LENGTH, 6);
    sharedGeometries.groundPlane = new THREE.PlaneGeometry(1, 1); // Scaled later

    // Particle geometries initialized in _initParticlesAndInstances
}

/** Creates reusable materials. */
function _createMaterials() {
    // Players
    sharedMaterials.playerBody = new THREE.MeshStandardMaterial({ color: 0xDC143C, roughness: 0.5, metalness: 0.2, name: "PlayerBody" });
    sharedMaterials.playerHead = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, name: "PlayerHead" });
    sharedMaterials.playerGun = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7, name: "PlayerGun" });
    sharedMaterials.playerDown = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.6, metalness: 0.1, emissive: 0xccab00, emissiveIntensity: 0.5, name: "PlayerDown" });
    sharedMaterials.playerDead = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.0, name: "PlayerDead" });
    sharedMaterials.playerSelfBody = new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5, metalness: 0.2, emissive: 0x331122, emissiveIntensity: 0.3, name: "PlayerSelfBody" }); // Different color for self

    // Enemies (Base materials, cloned and modified later for effects/fade)
    const enemyStandardProps = { roughness: 0.7, metalness: 0.1, transparent: true, opacity: 1.0 };
    sharedMaterials.enemyChaserBody = new THREE.MeshStandardMaterial({ color: 0x18315f, ...enemyStandardProps, name: "EnemyChaserBody" });
    sharedMaterials.enemyShooterBody = new THREE.MeshStandardMaterial({ color: 0x556B2F, ...enemyStandardProps, name: "EnemyShooterBody" });
    sharedMaterials.enemyGiantBody = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 1.0, name: "EnemyGiantBody" });
    sharedMaterials.enemyHead = new THREE.MeshStandardMaterial({ color: 0xBC8F8F, roughness: 0.7, name: "EnemyHead" }); // Rosy brown head
    sharedMaterials.enemyGun = new THREE.MeshStandardMaterial({ color: 0x505050, roughness: 0.6, metalness: 0.6, name: "EnemyGun" });

    // Bullets & Casings
    sharedMaterials.playerBullet = new THREE.MeshBasicMaterial({ color: 0xffed4a, name: "PlayerBullet" }); // Yellow player bullets
    sharedMaterials.enemyBullet = new THREE.MeshBasicMaterial({ color: 0xff4500, name: "EnemyBullet" });   // Orange-red enemy bullets
    sharedMaterials.ammoCasing = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.6, name: "AmmoCasing" });

    // Powerups (Base materials, cloned)
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

    // Environment
    sharedMaterials.groundDay = new THREE.MeshStandardMaterial({ color: 0x788a77, roughness: 0.9, metalness: 0.05, name: "GroundDay" }); // Slightly greener day
    sharedMaterials.groundNight = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.85, metalness: 0.1, name: "GroundNight" }); // Brownish night
    sharedMaterials.log = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, name: "Log" });
    sharedMaterials.snake = new THREE.MeshStandardMaterial({ color: 0x3a5311, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide, name: "Snake" });

    // Particles & Effects
    sharedMaterials.hitSpark = new THREE.PointsMaterial({ size: 10, vertexColors: true, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "HitSpark" });
    sharedMaterials.rainLine = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, name: "RainLine" });
    sharedMaterials.dustMote = new THREE.PointsMaterial({ size: 50, color: 0xd2b48c, transparent: true, opacity: DUST_OPACITY, sizeAttenuation: true, depthWrite: false, name: "DustMote" });
    sharedMaterials.flame = new THREE.PointsMaterial({ size: 18, vertexColors: true, map: loadedAssets.flameTexture, transparent: true, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, name: "Flame" });
}

/** Sets up instanced meshes and particle systems. */
function _initParticlesAndInstances() {
    // Player Bullets
    playerBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.playerBullet, MAX_PLAYER_BULLETS);
    playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    playerBulletMesh.count = 0;
    scene.add(playerBulletMesh);
    playerBulletMatrices = playerBulletMesh.instanceMatrix.array; // Get direct reference

    // Enemy Bullets
    enemyBulletMesh = new THREE.InstancedMesh(sharedGeometries.bullet, sharedMaterials.enemyBullet, MAX_ENEMY_BULLETS);
    enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    enemyBulletMesh.count = 0;
    scene.add(enemyBulletMesh);
    enemyBulletMatrices = enemyBulletMesh.instanceMatrix.array; // Get direct reference

    // Ammo Casings
    ammoCasingMesh = new THREE.InstancedMesh(sharedGeometries.ammoCasing, sharedMaterials.ammoCasing, MAX_AMMO_CASINGS);
    ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ammoCasingMesh.castShadow = true;
    ammoCasingMesh.count = 0;
    scene.add(ammoCasingMesh);
    activeAmmoCasings = []; // Ensure array is ready

    // Hit Sparks
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(MAX_HIT_SPARKS * 3);
    const sparkColors = new Float32Array(MAX_HIT_SPARKS * 3);
    const sparkAlphas = new Float32Array(MAX_HIT_SPARKS);
    const sparkSizes = new Float32Array(MAX_HIT_SPARKS);
    const sparkData = [];
    for (let i = 0; i < MAX_HIT_SPARKS; i++) {
        sparkPositions[i * 3 + 1] = -10000; // Start offscreen
        sparkAlphas[i] = 0;
        sparkSizes[i] = sharedMaterials.hitSpark.size;
        sparkData.push({ position: new THREE.Vector3(0, -10000, 0), velocity: new THREE.Vector3(), color: new THREE.Color(1, 1, 1), alpha: 0.0, life: 0, size: sharedMaterials.hitSpark.size });
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('alpha', new THREE.BufferAttribute(sparkAlphas, 1).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute('size', new THREE.BufferAttribute(sparkSizes, 1).setUsage(THREE.DynamicDrawUsage)); // If using custom shader for size
    hitSparkSystem = { particles: new THREE.Points(sparkGeo, sharedMaterials.hitSpark), geometry: sparkGeo, material: sharedMaterials.hitSpark, data: sparkData };
    scene.add(hitSparkSystem.particles);

    // Rain System
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(MAX_RAIN_DROPS * 6); // 2 points per line
    const rainData = [];
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const x = Math.random() * gameWidth * GROUND_MARGIN - (gameWidth * (GROUND_MARGIN - 1) / 2);
        const y = Math.random() * 1000 + 800; // Start high
        const z = Math.random() * gameHeight * GROUND_MARGIN - (gameHeight * (GROUND_MARGIN - 1) / 2);
        rainPositions[i * 6 + 1] = -10000; // Start offscreen
        rainPositions[i * 6 + 4] = -10000;
        rainData.push({ x: x, y: y, z: z, speed: RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND });
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    rainSystem = { lines: new THREE.LineSegments(rainGeo, sharedMaterials.rainLine), geometry: rainGeo, material: sharedMaterials.rainLine, data: rainData };
    rainSystem.lines.visible = false;
    scene.add(rainSystem.lines);

    // Dust System
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(MAX_DUST_MOTES * 3);
    const dustAlphas = new Float32Array(MAX_DUST_MOTES);
    const dustData = [];
    for (let i = 0; i < MAX_DUST_MOTES; i++) {
        dustPositions[i * 3 + 1] = -10000; // Start offscreen
        dustAlphas[i] = 0;
        dustData.push({
            position: new THREE.Vector3(Math.random() * gameWidth, Math.random() * 80 + 5, Math.random() * gameHeight),
            velocity: new THREE.Vector3((Math.random() - 0.5) * DUST_SPEED_XZ, (Math.random() - 0.5) * DUST_SPEED_Y, (Math.random() - 0.5) * DUST_SPEED_XZ),
            alpha: 0,
            baseAlpha: DUST_OPACITY * (0.5 + Math.random() * 0.7)
        });
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3).setUsage(THREE.DynamicDrawUsage));
    dustGeo.setAttribute('alpha', new THREE.BufferAttribute(dustAlphas, 1).setUsage(THREE.DynamicDrawUsage)); // If using custom shader
    dustSystem = { particles: new THREE.Points(dustGeo, sharedMaterials.dustMote), geometry: dustGeo, material: sharedMaterials.dustMote, data: dustData };
    dustSystem.particles.visible = false;
    scene.add(dustSystem.particles);

    // Campfire Flames (initialized separately in _initCampfire)
}

/** Sets up the campfire object group. */
function _initCampfire() {
    campfireSystem = {}; // Initialize the system object
    const group = new THREE.Group();
    group.name = "CampfireGroup";

    // Logs
    const log1 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log1.rotation.set(0, Math.PI / 10, Math.PI / 6);
    log1.castShadow = true;
    log1.position.set(-CAMPFIRE_LOG_LENGTH * 0.1, Y_OFFSET_CAMPFIRE, -CAMPFIRE_LOG_LENGTH * 0.2);

    const log2 = new THREE.Mesh(sharedGeometries.log, sharedMaterials.log);
    log2.rotation.set(0, -Math.PI / 8, -Math.PI / 5);
    log2.castShadow = true;
    log2.position.set(CAMPFIRE_LOG_LENGTH * 0.15, Y_OFFSET_CAMPFIRE, CAMPFIRE_LOG_LENGTH * 0.1);

    group.add(log1);
    group.add(log2);

    // Glow Light
    const glowLight = new THREE.PointLight(0xffa500, 0, 250, 2.0); // Orange glow, intensity 0 initially, range 250, decay 2
    glowLight.position.y = Y_OFFSET_CAMPFIRE + 15;
    glowLight.castShadow = true;
    glowLight.shadow.mapSize.width = 512;
    glowLight.shadow.mapSize.height = 512;
    glowLight.shadow.bias = -0.01; // Adjust bias for point light
    group.add(glowLight);

    // Flame Particles
    const flameGeo = new THREE.BufferGeometry();
    const flamePositions = new Float32Array(MAX_FLAME_PARTICLES * 3);
    const flameColors = new Float32Array(MAX_FLAME_PARTICLES * 3);
    const flameAlphas = new Float32Array(MAX_FLAME_PARTICLES);
    const flameData = [];
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        flamePositions[i * 3 + 1] = -10000; // Start offscreen
        flameAlphas[i] = 0;
        flameData.push({
            position: new THREE.Vector3(0, -10000, 0),
            velocity: new THREE.Vector3(),
            color: new THREE.Color(1, 1, 1),
            alpha: 0.0,
            life: 0,
            baseLife: FLAME_BASE_LIFE + Math.random() * FLAME_RAND_LIFE
        });
    }
    flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('color', new THREE.BufferAttribute(flameColors, 3).setUsage(THREE.DynamicDrawUsage));
    flameGeo.setAttribute('alpha', new THREE.BufferAttribute(flameAlphas, 1).setUsage(THREE.DynamicDrawUsage));

    const flameParticles = new THREE.Points(flameGeo, sharedMaterials.flame);

    group.add(flameParticles);
    group.visible = false; // Start hidden

    // Store references in the system object
    campfireSystem.group = group;
    campfireSystem.flameParticles = flameParticles;
    campfireSystem.geometry = flameGeo;
    campfireSystem.material = sharedMaterials.flame;
    campfireSystem.glowLight = glowLight;
    campfireSystem.data = flameData;

    scene.add(group);
}

/** Sets up the snake mesh object. */
function _initSnake() {
    // Create a basic tube geometry initially, it will be updated
    const dummyCurve = new THREE.LineCurve3(new THREE.Vector3(0, Y_OFFSET_SNAKE, 0), new THREE.Vector3(1, Y_OFFSET_SNAKE, 0));
    const tubeGeo = new THREE.TubeGeometry(dummyCurve, 1, SNAKE_RADIUS, 6, false);
    snakeMesh = new THREE.Mesh(tubeGeo, sharedMaterials.snake);
    snakeMesh.castShadow = true;
    snakeMesh.visible = false;
    snakeMesh.name = "Snake";
    scene.add(snakeMesh);
}

// --- Object Creation Functions ---

function _createPlayerGroup(playerData, isSelf) {
    const group = new THREE.Group();
    group.name = `PlayerGroup_${playerData.id}`;

    // Body
    const bodyMat = isSelf ? sharedMaterials.playerSelfBody.clone() : sharedMaterials.playerBody.clone();
    const bodyMesh = new THREE.Mesh(sharedGeometries.playerBody, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = Y_OFFSET_PLAYER + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_CAPSULE_RADIUS; // Center the capsule body
    group.add(bodyMesh);

    // Head
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.playerHead.clone());
    headMesh.scale.setScalar(PLAYER_HEAD_RADIUS);
    headMesh.position.y = bodyMesh.position.y + PLAYER_CAPSULE_HEIGHT / 2 + PLAYER_HEAD_RADIUS * 0.8; // Position head on top
    headMesh.castShadow = true;
    group.add(headMesh);

    // Gun
    const gunMesh = new THREE.Mesh(sharedGeometries.playerGun, sharedMaterials.playerGun.clone());
    gunMesh.position.set(0, bodyMesh.position.y * 0.9, PLAYER_CAPSULE_RADIUS * 0.8); // Position gun slightly forward and lower
    gunMesh.rotation.x = Math.PI / 2; // Align gun horizontally
    gunMesh.castShadow = true;
    group.add(gunMesh);

    // Initial position
    group.position.set(playerData.x, 0, playerData.y); // Group base at Y=0

    group.userData = {
        gameId: playerData.id,
        isPlayer: true,
        isSelf: isSelf,
        bodyMesh: bodyMesh,
        headMesh: headMesh,
        gunMesh: gunMesh,
        currentMat: bodyMat, // Store current material for status changes
        dyingStartTime: null // For potential fade out (though players usually just disappear)
    };
    return group;
}

function _createEnemyGroup(enemyData) {
    const group = new THREE.Group();
    group.name = `EnemyGroup_${enemyData.id}`;

    let bodyGeo, bodyMat, headScale, yBodyOffset;

    switch (enemyData.type) {
        case 'shooter':
            bodyGeo = sharedGeometries.enemyShooterBody;
            bodyMat = sharedMaterials.enemyShooterBody.clone();
            headScale = ENEMY_HEAD_RADIUS;
            yBodyOffset = ENEMY_SHOOTER_HEIGHT / 2;
            // Add shooter gun
            const enemyGun = new THREE.Mesh(sharedGeometries.enemyGun, sharedMaterials.enemyGun.clone());
            enemyGun.position.set(0, yBodyOffset * 0.7, ENEMY_SHOOTER_RADIUS * 0.8); // Position gun forward
            enemyGun.rotation.x = Math.PI / 2;
            enemyGun.castShadow = true;
            group.add(enemyGun);
            group.userData.gunMesh = enemyGun; // Store reference if needed
            break;
        case 'giant':
            bodyGeo = sharedGeometries.enemyGiantBody;
            bodyMat = sharedMaterials.enemyGiantBody.clone();
            headScale = ENEMY_HEAD_RADIUS * ENEMY_GIANT_MULTIPLIER * 0.8; // Slightly smaller head relative to giant body
            yBodyOffset = (ENEMY_CHASER_HEIGHT * ENEMY_GIANT_MULTIPLIER) / 2;
            break;
        case 'chaser':
        default:
            bodyGeo = sharedGeometries.enemyChaserBody;
            bodyMat = sharedMaterials.enemyChaserBody.clone();
            headScale = ENEMY_HEAD_RADIUS;
            yBodyOffset = ENEMY_CHASER_HEIGHT / 2;
            break;
    }

    // Body
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = Y_OFFSET_ENEMY_BODY + yBodyOffset;
    group.add(bodyMesh);

    // Head
    const headMesh = new THREE.Mesh(sharedGeometries.head, sharedMaterials.enemyHead.clone());
    headMesh.scale.setScalar(headScale);
    headMesh.position.y = bodyMesh.position.y + yBodyOffset + headScale * 0.7; // Place head on top
    headMesh.castShadow = true;
    group.add(headMesh);

    // Initial position
    group.position.set(enemyData.x, 0, enemyData.y);

    group.userData = {
        gameId: enemyData.id,
        isEnemy: true,
        type: enemyData.type,
        bodyMesh: bodyMesh,
        headMesh: headMesh,
        currentMat: bodyMat, // Store current material for fading
        dyingStartTime: null,
        health: enemyData.health // Store initial health for fade check
    };

    return group;
}

function _createPowerupGroup(powerupData) {
    const group = new THREE.Group();
    group.name = `PowerupGroup_${powerupData.id}`;

    const geometry = powerupGeometries[powerupData.type] || powerupGeometries.default;
    const material = (sharedMaterials.powerups[powerupData.type] || sharedMaterials.powerups.default).clone();

    const iconMesh = new THREE.Mesh(geometry, material);
    iconMesh.castShadow = true;
    iconMesh.position.y = Y_OFFSET_POWERUP;
    iconMesh.rotation.set(Math.PI / 7, 0, Math.PI / 7); // Initial tilt

    group.add(iconMesh);
    group.position.set(powerupData.x, 0, powerupData.y);

    group.userData = {
        gameId: powerupData.id,
        isPowerup: true,
        iconMesh: iconMesh
    };
    return group;
}

// --- Update Functions ---

/** Generic sync function, replacing the old updateMeshes */
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) {
    const activeIds = new Set();
    if (state) {
        for (const id in state) {
            const data = state[id];
            // Basic validation: ensure position exists if expected
            if (typeof data?.x !== 'number' || typeof data?.y !== 'number') {
                // console.warn(`Skipping entity ${id}: Invalid position data`, data);
                continue;
            }
            activeIds.add(id);

            let obj = objectMap[id];
            if (!obj) {
                // Create new object
                const isSelf = isSelfFn ? isSelfFn(id) : false;
                obj = createFn(data, isSelf); // Pass isSelf flag if needed
                if (obj) {
                    objectMap[id] = obj;
                    scene.add(obj);
                    updateFn(obj, data, 0, isSelf, true); // Initial update
                } else {
                    console.warn(`Failed to create object for ${id}`);
                    continue; // Skip if creation failed
                }
            } else {
                // Update existing object
                const isSelf = obj.userData?.isSelf ?? (isSelfFn ? isSelfFn(id) : false);
                // Reset fade state if object reappears and was marked for fading
                if (obj.userData?.dyingStartTime) {
                    // console.log(`Object ${id} reappeared, resetting fade.`);
                    obj.userData.dyingStartTime = null;
                    obj.visible = true;
                    obj.traverse(child => {
                        if (child.material) {
                            child.material.opacity = 1.0;
                            child.material.transparent = false; // May need adjustment based on base material
                            child.material.needsUpdate = true;
                        }
                    });
                }
                updateFn(obj, data, clock.deltaTime, isSelf, false); // Pass deltaTime
            }
        }
    }

    // Cleanup stale objects
    for (const id in objectMap) {
        if (!activeIds.has(id)) {
            _handleObjectRemoval(objectMap[id], id, objectMap);
        }
    }
}

/** Handles removal logic, including fading for enemies */
function _handleObjectRemoval(obj, id, objectMap) {
    if (!obj) return;

    const isEnemy = obj.userData?.isEnemy;
    const wasAlive = obj.userData?.health > 0 || obj.userData?.dyingStartTime === null; // Check if it was alive before this removal check

    if (isEnemy && wasAlive && !obj.userData.dyingStartTime) {
        // Start fading out enemy that just disappeared but wasn't marked dead yet
        obj.userData.dyingStartTime = clock.elapsedTime;
        obj.userData.health = 0; // Mark as dead locally
         obj.traverse(child => {
             if (child.material) {
                 child.material.transparent = true; // Ensure transparency is enabled
             }
         });
        // Keep in map until fade completes
    } else if (isEnemy && obj.userData.dyingStartTime) {
        // Continue fading enemy
        const timeElapsed = clock.elapsedTime - obj.userData.dyingStartTime;
        const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION);
        const opacity = 1.0 - fadeProgress;

        obj.traverse(child => {
            if (child.material) {
                child.material.opacity = opacity;
            }
        });

        if (fadeProgress >= 1.0) {
            // Fade complete, remove fully
            _disposeAndRemoveObject(obj, id, objectMap);
        }
        // Otherwise, keep in map while fading
    } else {
        // Remove non-enemies or already faded enemies immediately
        _disposeAndRemoveObject(obj, id, objectMap);
    }
}

/** Performs the actual disposal and removal from scene/map */
function _disposeAndRemoveObject(obj, id, objectMap) {
    if (!obj) return;
    scene.remove(obj);
    // More careful disposal
    obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            // Dispose materials only if they were cloned unique instances
            if (child.material) {
                 if (Array.isArray(child.material)) {
                     child.material.forEach(m => { if(m && !Object.values(sharedMaterials).includes(m) && !Object.values(sharedMaterials.powerups).includes(m)) m.dispose();});
                 } else if (!Object.values(sharedMaterials).includes(child.material) && !Object.values(sharedMaterials.powerups).includes(child.material)) {
                     child.material.dispose();
                 }
            }
        }
    });
    delete objectMap[id];
}


function _updatePlayerGroup(group, playerData, deltaTime, isSelf, isInitial) {
    group.position.x = playerData.x;
    group.position.z = playerData.y; // Game Y is 3D Z

    const bodyMesh = group.userData.bodyMesh;
    const headMesh = group.userData.headMesh;
    const gunMesh = group.userData.gunMesh;
    let targetMat = isSelf ? sharedMaterials.playerSelfBody : sharedMaterials.playerBody;

    // Status Effects / Material Changes
    if (playerData.player_status === PLAYER_STATUS_DOWN) {
        targetMat = sharedMaterials.playerDown;
        group.visible = true; // Ensure visible when down
    } else if (playerData.player_status === PLAYER_STATUS_DEAD) {
        targetMat = sharedMaterials.playerDead;
        group.visible = false; // Hide immediately when dead
        group.userData.dyingStartTime = null; // Ensure no fade attempt
        return; // No further updates needed
    } else {
         group.visible = true;
    }

    // Apply material if changed
    if (group.userData.currentMat !== targetMat) {
        group.userData.currentMat = targetMat;
        if (bodyMesh) bodyMesh.material = targetMat.clone(); // Clone if applying effects potentially
    }

    // Player Aiming Rotation (only for local player)
    if (isSelf && window.appState?.localPlayerAimState) { // Access global cautiously
        const aimDx = window.appState.localPlayerAimState.lastAimDx;
        const aimDy = window.appState.localPlayerAimState.lastAimDy;
        group.rotation.y = Math.atan2(aimDx, aimDy); // Y rotation for XZ plane aiming
    }

     // TODO: Add visual effect updates (speed boost particles, etc.)
}

function _updateEnemyGroup(group, enemyData, deltaTime, isSelf, isInitial) {
    group.position.x = enemyData.x;
    group.position.z = enemyData.y;
    group.userData.health = enemyData.health; // Update health for fade check

    // Check if needs fading (logic now in _handleObjectRemoval)
    if (group.userData.dyingStartTime) return; // Skip updates if fading out

    // Aiming Rotation (Shooters)
    const gunMesh = group.userData.gunMesh;
    if (enemyData.type === 'shooter' && window.appState?.serverState?.players) { // Access global cautiously
        const targetPlayer = window.appState.serverState.players[enemyData.target_player_id];
        if (targetPlayer) {
            const aimTargetX = targetPlayer.x;
            const aimTargetZ = targetPlayer.y;
            group.rotation.y = Math.atan2(aimTargetX - enemyData.x, aimTargetZ - enemyData.y);
        }
    }

    // Giant Windup Effect
    const bodyMesh = group.userData.bodyMesh;
    if (bodyMesh && enemyData.type === 'giant') {
        if (enemyData.attack_state === 'winding_up') {
            const pulse = 1.0 + Math.sin(clock.elapsedTime * 10) * 0.05; // Subtle pulse
            bodyMesh.scale.set(pulse, pulse, pulse);
        } else if (bodyMesh.scale.x !== 1.0) {
            bodyMesh.scale.set(1, 1, 1); // Reset scale
        }
    }

    // TODO: Snake bite visual effect? (Green tint/particles?)
}

function _updatePowerupGroup(group, powerupData, deltaTime, isSelf, isInitial) {
    group.position.x = powerupData.x;
    group.position.z = powerupData.y;

    const iconMesh = group.userData.iconMesh;
    if (iconMesh) {
        // Bobbing and Rotating animation
        iconMesh.position.y = Y_OFFSET_POWERUP + Math.sin(clock.elapsedTime * 2.5 + group.id * 0.5) * 4; // Bobbing
        iconMesh.rotation.y += 0.015; // Slow rotation
        iconMesh.rotation.x += 0.005;
        iconMesh.rotation.z += 0.003;
    }
}

function _updateInstancedMesh(mesh, matrices, count, state, yOffset, isBullet = false) {
    if (!mesh || !state) {
        if (mesh) mesh.count = 0;
        return;
    }

    let visibleCount = 0;
    const maxCount = matrices.length / 16; // Size of Matrix4

    for (const id in state) {
        if (visibleCount >= maxCount) break;
        const data = state[id];
        if (typeof data?.x !== 'number' || typeof data?.y !== 'number') continue;

        // TODO: Add culling if needed (check if position is within camera frustum)

        _position.set(data.x, yOffset, data.y);
        _quaternion.identity(); // Simple alignment for bullets/casings
        _scale.set(1, 1, 1);

        // Specific logic for bullets vs casings if needed (e.g., rotation)
        if (!isBullet) { // Assume casing
            _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, data.rotation || 0, 0)); // Rotate casing
        }

        _matrix.compose(_position, _quaternion, _scale);
        _matrix.toArray(matrices, visibleCount * 16);
        visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
}

function _updateActiveCasings(deltaTime) {
    const now = clock.elapsedTime; // Use consistent time

    activeAmmoCasings = activeAmmoCasings.filter(casing => {
        if (now > casing.endTime) return false;

        // Physics Update
        casing.velocity.y -= AMMO_CASING_GRAVITY * deltaTime;
        casing.position.addScaledVector(casing.velocity, deltaTime);
        casing.rotation += casing.rotationSpeed * deltaTime;

        // Ground Collision / Bounce
        if (casing.position.y <= Y_OFFSET_CASING) {
            casing.position.y = Y_OFFSET_CASING;
            casing.velocity.y *= -AMMO_CASING_BOUNCE;
            // Dampen horizontal velocity and rotation on bounce
            casing.velocity.x *= (1.0 - AMMO_CASING_DRAG);
            casing.velocity.z *= (1.0 - AMMO_CASING_DRAG);
            casing.rotationSpeed *= (1.0 - AMMO_CASING_DRAG * 2.0); // More rotation dampening
            // Stop tiny bounces
            if (Math.abs(casing.velocity.y) < 5) {
                casing.velocity.y = 0;
            }
             // Stop tiny rotation
             if(Math.abs(casing.rotationSpeed) < 0.1) {
                 casing.rotationSpeed = 0;
             }
        }
        return true;
    });

    // Update Instanced Mesh
    let visibleCount = 0;
    for (let i = 0; i < activeAmmoCasings.length && i < MAX_AMMO_CASINGS; i++) {
        const casing = activeAmmoCasings[i];
        _quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, casing.rotation, 0)); // Lay flat, rotate around Y
        _matrix.compose(casing.position, _quaternion, _scale);
        ammoCasingMesh.setMatrixAt(i, _matrix);
        visibleCount++;
    }
    ammoCasingMesh.count = visibleCount;
    ammoCasingMesh.instanceMatrix.needsUpdate = true;
}

function _spawnAmmoCasing(spawnPos, ejectVec) {
    if (!ammoCasingMesh || activeAmmoCasings.length >= MAX_AMMO_CASINGS) return;

    const now = clock.elapsedTime;
    const life = 1.5 + Math.random() * 1.0; // Casings last 1.5-2.5 seconds

    // Eject sideways and slightly up/back relative to ejectVec (which is usually aim direction)
    const ejectAngle = Math.atan2(ejectVec.z, ejectVec.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Eject ~90deg right
    const ejectSpeed = 150 + Math.random() * 80;
    const upSpeed = 50 + Math.random() * 40;
    const rotationSpeed = (Math.random() - 0.5) * 20;

    activeAmmoCasings.push({
        position: new THREE.Vector3(
            spawnPos.x + Math.cos(ejectAngle) * 5,
            spawnPos.y + PLAYER_TOTAL_HEIGHT * 0.6, // Eject from near gun height
            spawnPos.z + Math.sin(ejectAngle) * 5
        ),
        velocity: new THREE.Vector3(
            Math.cos(ejectAngle) * ejectSpeed,
            upSpeed,
            Math.sin(ejectAngle) * ejectSpeed
        ),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: rotationSpeed,
        startTime: now,
        endTime: now + life
    });
}

function _updateHitSparks(deltaTime) {
    if (!hitSparkSystem) return;

    const positions = hitSparkSystem.geometry.attributes.position.array;
    const colors = hitSparkSystem.geometry.attributes.color.array;
    const alphas = hitSparkSystem.geometry.attributes.alpha.array;
    const data = hitSparkSystem.data;
    let needsUpdate = false;
    let activeCount = 0;

    for (let i = 0; i < MAX_HIT_SPARKS; i++) {
        const p = data[i];
        if (p.life > 0) {
            p.life -= deltaTime;
            if (p.life <= 0) {
                alphas[i] = 0.0;
                positions[i * 3 + 1] = -10000; // Move offscreen
            } else {
                p.velocity.y -= HIT_SPARK_GRAVITY * deltaTime;
                p.position.addScaledVector(p.velocity, deltaTime);

                // Fade out based on life
                p.alpha = Math.max(0, (p.life / (HIT_SPARK_BASE_LIFE + HIT_SPARK_RAND_LIFE)) * 1.5); // Slightly brighter fade
                p.alpha = Math.min(1.0, p.alpha); // Clamp alpha

                alphas[i] = p.alpha;
                positions[i * 3 + 0] = p.position.x;
                positions[i * 3 + 1] = p.position.y;
                positions[i * 3 + 2] = p.position.z;
                colors[i * 3 + 0] = p.color.r;
                colors[i * 3 + 1] = p.color.g;
                colors[i * 3 + 2] = p.color.b;
                activeCount++;
            }
            needsUpdate = true;
        } else if (alphas[i] > 0) { // Ensure already dead sparks are fully hidden
            alphas[i] = 0.0;
            positions[i * 3 + 1] = -10000;
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        hitSparkSystem.geometry.attributes.position.needsUpdate = true;
        hitSparkSystem.geometry.attributes.color.needsUpdate = true;
        hitSparkSystem.geometry.attributes.alpha.needsUpdate = true;
        // hitSparkSystem.geometry.attributes.size.needsUpdate = true; // If using size attribute
        hitSparkSystem.particles.visible = activeCount > 0;
    }
}


function _triggerHitSparks(position, count = 5) {
    if (!hitSparkSystem) return;
    const data = hitSparkSystem.data;
    let spawned = 0;
    // Find inactive slots to reuse
    for (let i = 0; i < MAX_HIT_SPARKS && spawned < count; i++) {
        if (data[i].life <= 0) {
            const p = data[i];
            p.position.copy(position);
            // Random velocity outward and slightly up
            const angle = Math.random() * Math.PI * 2;
            const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; // Spread up/down a bit
            const speed = HIT_SPARK_INITIAL_VEL + Math.random() * HIT_SPARK_SPREAD;

            p.velocity.set(
                Math.cos(angle) * Math.cos(spreadAngle) * speed,
                Math.sin(spreadAngle) * speed * 1.5 + 30, // More upward bias
                Math.sin(angle) * Math.cos(spreadAngle) * speed
            );
            p.color.setRGB(1, 0.2 + Math.random() * 0.3, 0); // Orange-red sparks
            p.alpha = 1.0;
            p.life = HIT_SPARK_BASE_LIFE + Math.random() * HIT_SPARK_RAND_LIFE;
            p.size = sharedMaterials.hitSpark.size * (0.8 + Math.random() * 0.4); // Vary size slightly
            spawned++;
        }
    }
}

function _updateRain(deltaTime) {
    if (!rainSystem || !rainSystem.lines.visible) return;

    const positions = rainSystem.geometry.attributes.position.array;
    const data = rainSystem.data;
    let needsUpdate = false;

    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const p = data[i];
        p.y += p.speed * deltaTime;

        // Reset if below ground
        if (p.y < -50) {
            p.x = Math.random() * gameWidth * GROUND_MARGIN - (gameWidth * (GROUND_MARGIN - 1) / 2);
            p.y = Math.random() * 500 + 1000; // Reset high
            p.z = Math.random() * gameHeight * GROUND_MARGIN - (gameHeight * (GROUND_MARGIN - 1) / 2);
            p.speed = RAIN_SPEED_Y + Math.random() * RAIN_SPEED_Y_RAND;
        }

        const idx = i * 6;
        positions[idx + 0] = p.x; positions[idx + 1] = p.y; positions[idx + 2] = p.z;
        positions[idx + 3] = p.x; positions[idx + 4] = p.y - RAIN_STREAK_LENGTH; positions[idx + 5] = p.z; // End point below start point
        needsUpdate = true;
    }

    if (needsUpdate) {
        rainSystem.geometry.attributes.position.needsUpdate = true;
    }
}

function _updateDust(deltaTime) {
     if (!dustSystem || !dustSystem.particles.visible) return;

     const positions = dustSystem.geometry.attributes.position.array;
     const alphas = dustSystem.geometry.attributes.alpha.array; // Assuming using alpha attribute
     const data = dustSystem.data;
     let needsUpdate = false;

     const cameraPos = camera.position;
     const maxDistSq = 1200 * 1200; // Fade dust further away

     for (let i = 0; i < MAX_DUST_MOTES; i++) {
         const p = data[i];
         p.position.addScaledVector(p.velocity, deltaTime);

         // Wrap around edges
         const halfW = gameWidth / 2; const halfH = gameHeight / 2;
         const marginW = gameWidth * (GROUND_MARGIN - 1) / 2;
         const marginH = gameHeight * (GROUND_MARGIN - 1) / 2;
         const worldWidth = gameWidth * GROUND_MARGIN;
         const worldHeight = gameHeight * GROUND_MARGIN;

         if (p.position.x < halfW - marginW) p.position.x += worldWidth;
         if (p.position.x > halfW + worldWidth - marginW) p.position.x -= worldWidth;
         if (p.position.z < halfH - marginH) p.position.z += worldHeight;
         if (p.position.z > halfH + worldHeight - marginH) p.position.z -= worldHeight;
         // Keep Y within bounds
         p.position.y += (Math.random() - 0.5) * DUST_SPEED_Y * deltaTime;
         p.position.y = Math.max(5, Math.min(80, p.position.y));

         // Fade based on distance to camera (optional, for performance/visuals)
         const distSq = cameraPos.distanceToSquared(p.position);
         const fadeFactor = Math.max(0, 1.0 - distSq / maxDistSq);

         p.alpha = p.baseAlpha * fadeFactor;
         alphas[i] = p.alpha;

         positions[i * 3 + 0] = p.position.x;
         positions[i * 3 + 1] = p.position.y;
         positions[i * 3 + 2] = p.position.z;
         needsUpdate = true;
     }

     if (needsUpdate) {
         dustSystem.geometry.attributes.position.needsUpdate = true;
         dustSystem.geometry.attributes.alpha.needsUpdate = true;
         dustSystem.material.opacity = DUST_OPACITY; // Ensure base opacity is set
     }
}

function _updateCampfire(deltaTime) {
    if (!campfireSystem || !campfireSystem.group.visible) return;

    const positions = campfireSystem.geometry.attributes.position.array;
    const colors = campfireSystem.geometry.attributes.color.array;
    const alphas = campfireSystem.geometry.attributes.alpha.array;
    const data = campfireSystem.data;
    let needsUpdate = false;
    let activeCount = 0;

    // Spawn new particles
    const spawnRate = 150; // Particles per second
    const numToSpawn = Math.floor(spawnRate * deltaTime * (0.5 + Math.random()));

    let spawned = 0;
    for (let i = 0; i < MAX_FLAME_PARTICLES && spawned < numToSpawn; i++) {
        if (data[i].life <= 0) {
            const p = data[i];
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * CAMPFIRE_BASE_RADIUS;
            p.position.set(
                Math.cos(angle) * radius,
                Y_OFFSET_CAMPFIRE + 2, // Start just above logs
                Math.sin(angle) * radius
            );
            p.velocity.set(
                (Math.random() - 0.5) * FLAME_VEL_SPREAD,
                FLAME_VEL_Y + Math.random() * 30,
                (Math.random() - 0.5) * FLAME_VEL_SPREAD
            );
            p.life = p.baseLife;
            p.alpha = 0.7 + Math.random() * 0.3;
            p.color.setHSL(0.07 + Math.random() * 0.06, 1.0, 0.6 + Math.random() * 0.1); // Orange/Yellow
            spawned++;
        }
    }

    // Update existing particles
    for (let i = 0; i < MAX_FLAME_PARTICLES; i++) {
        const p = data[i];
        if (p.life > 0) {
            p.life -= deltaTime;
            if (p.life <= 0) {
                alphas[i] = 0.0;
                positions[i * 3 + 1] = -10000; // Move offscreen
            } else {
                p.velocity.y += (Math.random() - 0.4) * 20 * deltaTime; // Slight upward drift variation
                p.velocity.x *= 0.97; // Dampen horizontal movement
                p.velocity.z *= 0.97;
                p.position.addScaledVector(p.velocity, deltaTime);

                p.alpha = Math.max(0, (p.life / p.baseLife) * 1.2); // Fade out
                p.color.lerp(_color.setRGB(1.0, 0.1, 0.0), deltaTime * 1.5); // Lerp towards red/embers

                alphas[i] = p.alpha;
                positions[i * 3 + 0] = p.position.x;
                positions[i * 3 + 1] = p.position.y;
                positions[i * 3 + 2] = p.position.z;
                colors[i * 3 + 0] = p.color.r;
                colors[i * 3 + 1] = p.color.g;
                colors[i * 3 + 2] = p.color.b;
                activeCount++;
            }
            needsUpdate = true;
        } else if (alphas[i] > 0) { // Ensure dead are hidden
             alphas[i] = 0.0;
             positions[i * 3 + 1] = -10000;
             needsUpdate = true;
        }
    }

    if (needsUpdate) {
        campfireSystem.geometry.attributes.position.needsUpdate = true;
        campfireSystem.geometry.attributes.color.needsUpdate = true;
        campfireSystem.geometry.attributes.alpha.needsUpdate = true;
    }

    // Update glow light intensity
    if (campfireSystem.glowLight) {
        campfireSystem.glowLight.intensity = 2.5 + Math.sin(clock.elapsedTime * 3.0) * 0.8; // Flicker
    }
}

function _updateSnake(snakeData) {
    if (!snakeMesh) return;

    const isActive = snakeData?.isActiveFromServer ?? false;
    snakeMesh.visible = isActive;

    if (isActive && snakeData.segments && snakeData.segments.length > 1) {
        // Use CatmullRomCurve3 for smoother interpolation between server points
        const points = snakeData.segments.map(seg => _vector3.set(seg.x, Y_OFFSET_SNAKE, seg.y));

        if (points.length >= 2) {
            try {
                 const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1); // Adjust tension if needed
                 // Use the curve points, potentially getting more points than segments for smoothness
                 const tubePoints = curve.getPoints(SNAKE_VISUAL_SEGMENTS * 2);
                 if(tubePoints.length >= 2) {
                    const newGeometry = new THREE.TubeGeometry(
                        new THREE.CatmullRomCurve3(tubePoints), // Create curve from more points
                        tubePoints.length - 1, // Segments based on points
                        SNAKE_RADIUS,
                        6,  // Radial segments
                        false // Closed
                    );
                    snakeMesh.geometry.dispose(); // Dispose old geometry
                    snakeMesh.geometry = newGeometry;
                 } else {
                     snakeMesh.visible = false; // Not enough points for a curve
                 }
            } catch(e) {
                console.error("Error updating snake geometry:", e);
                snakeMesh.visible = false; // Hide if geometry creation fails
            }
        } else {
            snakeMesh.visible = false; // Not enough points for a curve
        }
    }
}

function _updateCamera(deltaTime) {
    if (!camera) return;

    // Smoothly follow the target position
    const targetX = cameraTargetPos.x;
    const targetZ = cameraTargetPos.z;

    _vector3.set(targetX, CAMERA_BASE_Y, targetZ); // Base position above target
    camera.position.lerp(_vector3, CAMERA_LERP_FACTOR);

    // Apply screen shake offset relative to the smoothed position
    if (shakeMagnitude > 0 && clock.elapsedTime < shakeEndTime) {
        const timeRemaining = shakeEndTime - clock.elapsedTime;
        // Use a non-linear decay for better feel
        const decayFactor = Math.pow(Math.max(0, timeRemaining / (shakeEndTime - (clock.elapsedTime-deltaTime))), 2); // Quadratic decay
        const currentMag = shakeMagnitude * decayFactor;

        const shakeAngle = Math.random() * Math.PI * 2; // Random direction each frame
        screenShakeOffset.set(
            Math.cos(shakeAngle) * currentMag,
            (Math.random() - 0.5) * currentMag * 0.5, // Subtle vertical shake
            Math.sin(shakeAngle) * currentMag
        );
        camera.position.add(screenShakeOffset);
    } else {
        shakeMagnitude = 0; // Reset shake when done
    }

    // Ensure camera always looks down at the target point on the ground
    _vector3.set(targetX, 0, targetZ); // Look at point on ground
    camera.lookAt(_vector3);
}

function _updateEnvironment(isNight, isRaining, isDustStorm) {
     if (!scene || !ambientLight || !directionalLight || !groundPlane) return;

     const dayAmbientIntensity = 0.7; const nightAmbientIntensity = 0.45;
     const dayDirIntensity = 1.2; const nightDirIntensity = 0.7;
     const dayAmbientColor = 0xffffff; const nightAmbientColor = 0x7080a0; // Cooler night ambient
     const dayDirColor = 0xffffff; const nightDirColor = 0xa0b0ff; // Bluish moon light

     const dayFogColor = 0xc0d0e0; const dayFogDensity = 0.0003; // Light haze day
     const nightFogColor = 0x04060a; const nightFogDensity = 0.0008; // Darker, denser night fog
     const dustFogColor = 0xb09070; const dustFogDensity = 0.0015; // Brownish, very dense dust

     // Lerp values for smooth transitions
     const targetAmbientIntensity = isNight ? nightAmbientIntensity : dayAmbientIntensity;
     const targetDirIntensity = isNight ? nightDirIntensity : dayDirIntensity;
     const targetAmbientColor = isNight ? nightAmbientColor : dayAmbientColor;
     const targetDirColor = isNight ? nightDirColor : dayDirColor;
     const targetGroundMaterial = isNight ? sharedMaterials.groundNight : sharedMaterials.groundDay;

     let targetFogDensity, targetFogColorHex;
     if(isDustStorm) {
         targetFogDensity = dustFogDensity;
         targetFogColorHex = dustFogColor;
     } else if (isNight) {
         targetFogDensity = nightFogDensity;
         targetFogColorHex = nightFogColor;
     } else {
         targetFogDensity = dayFogDensity;
         targetFogColorHex = dayFogColor;
     }

     ambientLight.intensity = lerp(ambientLight.intensity, targetAmbientIntensity, 0.05);
     directionalLight.intensity = lerp(directionalLight.intensity, targetDirIntensity, 0.05);
     ambientLight.color.lerp(_color.setHex(targetAmbientColor), 0.05);
     directionalLight.color.lerp(_color.setHex(targetDirColor), 0.05);

     // Set ground material directly (no lerp needed for material swap)
     if (groundPlane.material !== targetGroundMaterial) {
         groundPlane.material = targetGroundMaterial;
     }

     // Update Fog
     if (!scene.fog) {
         scene.fog = new THREE.FogExp2(targetFogColorHex, targetFogDensity);
     } else {
         scene.fog.color.lerp(_color.setHex(targetFogColorHex), 0.05);
         scene.fog.density = lerp(scene.fog.density, targetFogDensity, 0.05);
     }
     // Match background to fog
     if(!scene.background) scene.background = new THREE.Color();
     scene.background.lerp(_color.setHex(targetFogColorHex), 0.05);

     // Update particle system visibility
     if (rainSystem) rainSystem.lines.visible = isRaining;
     if (dustSystem) dustSystem.particles.visible = isDustStorm;

     // Update campfire visibility/glow based on state (done in _updateCampfire)
}

function _updateMuzzleFlash(localEffects, playerGroup) {
    if (!muzzleFlashLight) return;
    const flashState = localEffects?.muzzleFlash;
    const now = performance.now();

    if (flashState?.active && now < flashState.endTime && playerGroup && playerGroup.userData.gunMesh) {
        muzzleFlashLight.intensity = 5.0 + Math.random() * 4.0; // Intensity flicker

        // Position at the tip of the gun mesh
        const gunMesh = playerGroup.userData.gunMesh;
        _vector3.set(0, PLAYER_GUN_LENGTH / 2 + 5, 0); // Position at tip in local space (Y is forward for cylinder)
        gunMesh.localToWorld(_vector3); // Convert to world space
        muzzleFlashLight.position.copy(_vector3);

    } else {
        muzzleFlashLight.intensity = 0;
        if (flashState) flashState.active = false; // Reset flag if expired
    }
}

// --- Public API ---

const Renderer3D = {
    /** Initializes the THREE.js renderer, scene, camera, and essential elements. */
    init: (containerElement, initialWidth, initialHeight) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) {
            console.error("Renderer Init Failed: Container element is required.");
            return false;
        }

        gameWidth = initialWidth || DEFAULT_GAME_WIDTH;
        gameHeight = initialHeight || DEFAULT_GAME_HEIGHT;
        cameraTargetPos.set(gameWidth / 2, 0, gameHeight / 2);

        try {
            // 1. Renderer Setup
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); // Opaque bg is faster
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(gameWidth, gameHeight);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Good quality/perf balance
            renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct colors
            // Optional: Tone mapping for nicer lighting
            // renderer.toneMapping = THREE.ACESFilmicToneMapping;
            // renderer.toneMappingExposure = 1.0;
            containerElement.appendChild(renderer.domElement);

            // 2. Scene Setup
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a28); // Initial dark background
            // Fog is initialized/updated in _updateEnvironment

            // 3. Camera Setup (Perspective)
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, gameWidth / gameHeight, CAMERA_NEAR, CAMERA_FAR);
            camera.position.set(gameWidth / 2, CAMERA_BASE_Y, gameHeight / 2 + 300); // Position slightly back for perspective
            camera.rotation.x = CAMERA_ANGLE;
            scene.add(camera);

            // 4. Lighting Setup
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Start with decent ambient
            scene.add(ambientLight);

            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Main sun/moon light
            directionalLight.position.set(gameWidth * 0.3, 400, gameHeight * 0.4); // Angled light source
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            // Adjust shadow camera frustum to tightly fit the game area + margin
            const shadowCamSizeX = gameWidth * GROUND_MARGIN * 0.55;
            const shadowCamSizeZ = gameHeight * GROUND_MARGIN * 0.55;
            directionalLight.shadow.camera.left = -shadowCamSizeX;
            directionalLight.shadow.camera.right = shadowCamSizeX;
            directionalLight.shadow.camera.top = shadowCamSizeZ;
            directionalLight.shadow.camera.bottom = -shadowCamSizeZ;
            directionalLight.shadow.camera.near = 50;
            directionalLight.shadow.camera.far = 1000;
            directionalLight.shadow.bias = -0.002; // Fine-tune shadow bias
            directionalLight.target.position.set(gameWidth / 2, 0, gameHeight / 2); // Target center
            scene.add(directionalLight);
            scene.add(directionalLight.target);

            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8); // Orange, intensity 0, range 150, decay 1.8
            muzzleFlashLight.castShadow = false; // Muzzle flash shouldn't cast shadows
            scene.add(muzzleFlashLight);

            // 5. Ground Plane
            _createAssets(); // Create textures first
            _createGeometries();
            _createMaterials();

            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.scale.set(gameWidth * GROUND_MARGIN, gameHeight * GROUND_MARGIN, 1);
            groundPlane.rotation.x = -Math.PI / 2;
            groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2); // Centered at Y=0
            groundPlane.receiveShadow = true;
            groundPlane.name = "GroundPlane";
            scene.add(groundPlane);

            // 6. Initialize Systems
            _initParticlesAndInstances();
            _initCampfire();
            _initSnake();

            // 7. Clock & Resize Listener
            clock = new THREE.Clock();
            window.addEventListener('resize', () => {
                if (!renderer || !camera || !containerElement) return;
                gameWidth = containerElement.clientWidth;
                gameHeight = containerElement.clientHeight;
                renderer.setSize(gameWidth, gameHeight);
                camera.aspect = gameWidth / gameHeight;
                camera.updateProjectionMatrix();
            });

        } catch (error) {
            console.error("Renderer Init Error:", error);
            Renderer3D.cleanup(); // Attempt cleanup if init fails
            return false;
        }
        console.log("--- Renderer3D initialization complete ---");
        return true;
    },

    /** Renders the scene based on the provided game state. */
    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) {
            // console.warn("Renderer not ready or missing state for render.");
            return;
        }

        const deltaTime = clock.getDelta(); // Time since last frame

        // Ensure dimensions match appState (in case of late resize)
        if (appState.canvasWidth && appState.canvasHeight && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) {
            gameWidth = appState.canvasWidth;
            gameHeight = appState.canvasHeight;
            if (renderer) renderer.setSize(gameWidth, gameHeight);
            if (camera) {
                camera.aspect = gameWidth / gameHeight;
                camera.updateProjectionMatrix();
            }
            // Update ground scale if needed
             if (groundPlane) groundPlane.scale.set(gameWidth * GROUND_MARGIN, gameHeight * GROUND_MARGIN, 1);
            // Update camera target base
            cameraTargetPos.x = gameWidth / 2;
            cameraTargetPos.z = gameHeight / 2;
        }

        // --- Update Phase ---

        // 1. Update Camera (Smooth follow, shake)
        _updateCamera(deltaTime);

        // 2. Update Environment (Lighting, Fog, Ground, Weather Visibility)
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);

        // 3. Sync Game Objects (Players, Enemies, Powerups)
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);

        // 4. Update Instanced Meshes (Bullets)
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, playerBulletCount, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, enemyBulletCount, stateToRender.bullets, Y_OFFSET_BULLET, true);

        // 5. Update Particle Systems & Dynamic Effects
        _updateActiveCasings(deltaTime); // Includes updating InstancedMesh
        _updateHitSparks(deltaTime);
        _updateRain(deltaTime);
        _updateDust(deltaTime);
        _updateCampfire(deltaTime); // Includes updating particles
        _updateSnake(localEffects.snake); // Update based on local copy driven by server state
        _updateMuzzleFlash(localEffects, playerGroupMap[appState.localPlayerId]);


        // 6. Project UI Positions (after all objects are positioned)
        const uiPositions = {};
        const projectEntity = (objMap, stateMap, yOffsetFn) => {
            for (const id in objMap) {
                 const obj = objMap[id];
                 const data = stateMap?.[id];
                 if (obj && obj.visible && data) { // Project only visible objects with state data
                     // Use the main object's position, but calculate offset based on data/type
                     const worldPos = obj.position.clone();
                     worldPos.y = yOffsetFn(data, obj); // Use specific Y for UI projection point
                     const screenPos = Renderer3D.projectToScreen(worldPos);
                     if(screenPos) uiPositions[id] = screenPos;
                 }
            }
        };
        const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y + PLAYER_HEAD_RADIUS * 1.5 || PLAYER_TOTAL_HEIGHT;
        const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y + (d.type==='giant' ? ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER : ENEMY_HEAD_RADIUS)*1.2 || ENEMY_CHASER_HEIGHT;
        const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y + POWERUP_BASE_SIZE * 0.5 || Y_OFFSET_POWERUP;

        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY);
        projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY);
        projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);

        // Damage texts use their own state position
        if (stateToRender.damage_texts) {
            for (const id in stateToRender.damage_texts) {
                const dt = stateToRender.damage_texts[id];
                const worldPos = _vector3.set(dt.x, PLAYER_TOTAL_HEIGHT * 0.8, dt.y); // Project from approx player height
                const screenPos = Renderer3D.projectToScreen(worldPos);
                 if(screenPos) uiPositions[id] = screenPos;
            }
        }
        appState.uiPositions = uiPositions; // Update global appState for main.js

        // --- Render Phase ---
        try {
            renderer.render(scene, camera);
        } catch (e) {
            console.error("!!! RENDER ERROR !!!", e);
            // Consider stopping the loop or showing an error overlay
            if (window.appState && window.appState.animationFrameId) {
                 cancelAnimationFrame(window.appState.animationFrameId);
                 window.appState.animationFrameId = null;
                 console.error("!!! Animation loop stopped due to render error. !!!");
                 // Optionally, try to cleanup
                 // Renderer3D.cleanup();
            }
        }
    },

    /** Triggers a camera shake effect. */
    triggerShake: (magnitude, durationMs) => {
        if (!clock) return; // Guard against calls before init
        const now = clock.elapsedTime * 1000; // Use clock time in ms
        const newEndTime = now + durationMs;
        // Apply new shake if stronger or lasts longer
        if (magnitude >= shakeMagnitude || newEndTime > shakeEndTime) {
            shakeMagnitude = Math.max(0.1, magnitude); // Ensure some minimum shake
            shakeEndTime = Math.max(newEndTime, shakeEndTime); // Extend duration if needed
            // console.log(`Trigger shake mag: ${shakeMagnitude.toFixed(1)}, end: ${shakeEndTime.toFixed(0)}`);
        }
    },

    /** Spawns a visual ammo casing effect. */
    spawnVisualAmmoCasing: (position, ejectVector) => {
        if (!clock) return; // Guard
         _spawnAmmoCasing(position, ejectVector);
    },

     /** Triggers a cluster of visual hit sparks */
    triggerVisualHitSparks: (position, count = 5) => {
         if (!clock) return; // Guard
         _triggerHitSparks(position, count);
    },


    /** Projects a 3D world position to 2D screen coordinates. */
    projectToScreen: (worldPosition) => {
        if (!camera || !renderer || !renderer.domElement) return null;
        try {
            _vector3.copy(worldPosition);
            _vector3.project(camera); // Project into NDC (-1 to 1)

            const widthHalf = renderer.domElement.width / 2;
            const heightHalf = renderer.domElement.height / 2;

            const screenX = Math.round((_vector3.x * widthHalf) + widthHalf);
            const screenY = Math.round(-(_vector3.y * heightHalf) + heightHalf); // Y is inverted

            // Check if behind camera (z > 1 in NDC)
            if (_vector3.z > 1.0) {
                return null; // Don't return positions behind the camera
            }

            return { screenX, screenY };
        } catch (e) {
            // console.error("Error projecting to screen:", e);
            return null;
        }
    },

    /** Cleans up all THREE.js resources. */
    cleanup: () => {
        console.log("--- Renderer3D Cleanup ---");
        window.removeEventListener('resize', () => {/* reference removal */}); // Might need named function or AbortController

        // Dispose systems first
        [hitSparkSystem, rainSystem, dustSystem, campfireSystem].forEach(system => {
            if (system) {
                 if(system.particles) scene?.remove(system.particles);
                 if(system.lines) scene?.remove(system.lines);
                 if(system.group) scene?.remove(system.group);
                 system.geometry?.dispose();
                 system.material?.dispose();
            }
        });
        hitSparkSystem = null; rainSystem = null; dustSystem = null; campfireSystem = null;

        // Dispose instanced meshes
         [playerBulletMesh, enemyBulletMesh, ammoCasingMesh].forEach(mesh => {
             if (mesh) {
                 scene?.remove(mesh);
                 mesh.geometry?.dispose();
                 mesh.material?.dispose();
             }
         });
         playerBulletMesh = null; enemyBulletMesh = null; ammoCasingMesh = null;

         // Dispose snake
         if (snakeMesh) {
             scene?.remove(snakeMesh);
             snakeMesh.geometry?.dispose();
             // Snake material is shared, disposed below
             snakeMesh = null;
         }

        // Dispose managed object groups
        [playerGroupMap, enemyGroupMap, powerupGroupMap].forEach(objectMap => {
             for (const id in objectMap) {
                 _disposeAndRemoveObject(objectMap[id], id, objectMap); // Use the safer disposal
             }
        });

        // Dispose shared resources
        Object.values(sharedGeometries).forEach(geo => geo?.dispose());
        Object.values(sharedMaterials).forEach(mat => mat?.dispose());
        Object.values(powerupGeometries).forEach(geo => geo?.dispose());
        Object.values(sharedMaterials.powerups).forEach(mat => mat?.dispose());
        Object.values(loadedAssets).forEach(asset => asset?.dispose()); // Dispose textures

        sharedGeometries = {}; sharedMaterials = {}; powerupGeometries = {}; loadedAssets = {};

        // Dispose ground plane
        if (groundPlane) {
             scene?.remove(groundPlane);
             // Ground geo/mat are shared, disposed above
             groundPlane = null;
        }

        // Dispose lights (no dispose needed, just remove from scene)
        if(scene) {
            if(ambientLight) scene.remove(ambientLight);
            if(directionalLight) scene.remove(directionalLight);
            if(directionalLight?.target) scene.remove(directionalLight.target);
            if(muzzleFlashLight) scene.remove(muzzleFlashLight);
        }
         ambientLight = null; directionalLight = null; muzzleFlashLight = null;

        // Dispose renderer and remove canvas
        if (renderer) {
            renderer.dispose();
            renderer.forceContextLoss(); // Aggressively release context
            if (renderer.domElement?.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer = null;
            console.log("Renderer disposed.");
        }

        // Nullify core variables
        scene = null; camera = null; clock = null;
        playerBulletMatrices = []; enemyBulletMatrices = []; activeAmmoCasings = [];
        shakeMagnitude = 0; shakeEndTime = 0;

        console.log("Renderer3D resources released.");
    },

    // --- Getters (for external use if needed) ---
    getCamera: () => camera,
    getGroundPlane: () => groundPlane, // Needed for raycasting mouse position
};

export default Renderer3D;
