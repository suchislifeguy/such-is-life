// Renderer3D.js
// Manages the Three.js scene, objects, and rendering for Kelly Gang Survival.

import * as THREE from 'three';
// Optional: Import controls for debugging if needed (uncomment)
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Constants ---
const MESH_Y_OFFSET = 5; // Base Y position offset for meshes on the ground plane
const FADE_OUT_DURATION = 0.3; // Matches server ENEMY_FADE_DURATION
const AMMO_CASING_INSTANCES = 100; // Max casings rendered at once
const BLOOD_SPARK_INSTANCES = 150; // Max sparks rendered at once
const SNAKE_SEGMENTS_VISUAL = 40; // How many segments to draw for the snake tube
const SNAKE_RADIUS = 8; // Visual radius of the snake tube

// --- Module Scope Variables ---
let renderer, scene, camera, ambientLight, directionalLight, clock, controls; // Added controls
let container, canvas, width, height;
let groundPlane, campfireLogs, campfireLight;

// Object Maps (GameID -> THREE.Object3D)
const objectMaps = {
    playerMeshes: {},
    enemyMeshes: {},
    bulletMeshes: {},
    powerupMeshes: {},
    effectMeshes: {}, // For things like pushback rings
    ammoCasingMesh: null, // InstancedMesh
    bloodSparkMesh: null, // InstancedMesh
    snakeMesh: null,
};

// Shared Resources (Geometries, Materials)
const sharedResources = {
    materials: {},
    geometries: {},
};

// Camera Shake State
let shakeIntensity = 0;
let shakeEndTime = 0;
const originalCameraPos = new THREE.Vector3();

// --- Internal Functions ---

function _createSharedResources() {
    // Player
    sharedResources.geometries.playerCapsule = new THREE.CapsuleGeometry(12, 24, 4, 12); // Radius, height, cap segments, radial segments
    sharedResources.materials.playerBase = new THREE.MeshStandardMaterial({ color: 0x7a8c79, roughness: 0.6, metalness: 0.2 });
    sharedResources.materials.playerDown = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.7, metalness: 0.1 });
    sharedResources.materials.playerDead = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.0 });
    sharedResources.materials.playerSelf = new THREE.MeshStandardMaterial({ color: 0xa0bd9a, roughness: 0.6, metalness: 0.2, emissive: 0x113311, emissiveIntensity: 0.4 }); // Slight glow for local player

    // Enemies
    sharedResources.geometries.enemyChaser = new THREE.BoxGeometry(20, 40, 20);
    sharedResources.materials.enemyChaser = new THREE.MeshStandardMaterial({ color: 0x9e2b2f, roughness: 0.7 });
    sharedResources.geometries.enemyShooter = new THREE.CylinderGeometry(12, 12, 45, 16);
    sharedResources.materials.enemyShooter = new THREE.MeshStandardMaterial({ color: 0x364f6b, roughness: 0.6 });
    sharedResources.geometries.enemyGiant = new THREE.BoxGeometry(50, 100, 50); // Scaled by constants
    sharedResources.materials.enemyGiant = new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.8 });

    // Bullets
    sharedResources.geometries.bulletStandard = new THREE.SphereGeometry(4, 8, 6);
    sharedResources.materials.bulletStandard = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaaaaa, emissiveIntensity: 0.5, roughness: 0.2 });
    sharedResources.materials.bulletShotgun = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xcc8800, emissiveIntensity: 0.6 }); // Smaller radius handled in creation
    sharedResources.materials.bulletHeavySlug = new THREE.MeshStandardMaterial({ color: 0xeeeeff, emissive: 0xccccff, emissiveIntensity: 0.7 }); // Larger radius handled in creation
    sharedResources.materials.bulletRapid = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xeeee00, emissiveIntensity: 0.8 });
    sharedResources.materials.bulletEnemy = new THREE.MeshStandardMaterial({ color: 0xff6666, emissive: 0xcc4444, emissiveIntensity: 0.5 }); // Smaller radius handled in creation

    // Powerups (Using simple boxes with emissive colors for glow)
    sharedResources.geometries.powerupBox = new THREE.BoxGeometry(20, 20, 20);
    sharedResources.materials.powerupHealth = new THREE.MeshStandardMaterial({ color: 0x66bb6a, emissive: 0x449944, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupGun = new THREE.MeshStandardMaterial({ color: 0x6a0dad, emissive: 0x48098a, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupSpeed = new THREE.MeshStandardMaterial({ color: 0x3edef3, emissive: 0x2eadda, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupArmor = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, emissive: 0x7c7c7c, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupShotgun = new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xcc8400, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupSlug = new THREE.MeshStandardMaterial({ color: 0xa0522d, emissive: 0x803a1a, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupRapid = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xeeee00, emissiveIntensity: 0.6 });
    sharedResources.materials.powerupScore = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xccab00, emissiveIntensity: 0.6 });

    // Effects
    sharedResources.geometries.muzzleFlash = new THREE.PlaneGeometry(30, 30);
    sharedResources.materials.muzzleFlash = new THREE.SpriteMaterial({ color: 0xffffee, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 }); // Simple sprite, could use texture later
    sharedResources.geometries.pushbackRing = new THREE.RingGeometry(90, 100, 32);
    sharedResources.materials.pushbackRing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    sharedResources.geometries.ammoCasing = new THREE.BoxGeometry(6, 2, 3); // Width, height, depth
    sharedResources.materials.ammoCasing = new THREE.MeshStandardMaterial({ color: 0xdaa520, roughness: 0.4, metalness: 0.7 });
    sharedResources.geometries.bloodSpark = new THREE.SphereGeometry(2.5, 5, 4);
    sharedResources.materials.bloodSpark = new THREE.MeshBasicMaterial({ color: 0xff2200 }); // Basic bright red

    // Snake
    sharedResources.materials.snake = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.1 }); // Forest green
}

function _createInstancedMeshes() {
    // Ammo Casings
    objectMaps.ammoCasingMesh = new THREE.InstancedMesh(
        sharedResources.geometries.ammoCasing,
        sharedResources.materials.ammoCasing,
        AMMO_CASING_INSTANCES
    );
    objectMaps.ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Important for performance
    objectMaps.ammoCasingMesh.castShadow = true;
    scene.add(objectMaps.ammoCasingMesh);

    // Blood Sparks
    objectMaps.bloodSparkMesh = new THREE.InstancedMesh(
        sharedResources.geometries.bloodSpark,
        sharedResources.materials.bloodSpark,
        BLOOD_SPARK_INSTANCES
    );
    objectMaps.bloodSparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Sparks probably don't need shadows
    scene.add(objectMaps.bloodSparkMesh);
}


function _handleResize() {
    if (!container || !renderer || !camera) return;

    width = container.clientWidth;
    height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    // console.log(`Renderer resized to ${width}x${height}`);
}

// Generic function to sync state entities with THREE meshes
function _syncObjects(stateEntities, meshMap, createFn, updateFn, activeIdsSet) {
    if (!stateEntities) return;
    const now = clock.elapsedTime;

    for (const id in stateEntities) {
        const entityData = stateEntities[id];
        activeIdsSet.add(id);

        let mesh = meshMap[id];
        if (mesh) {
            // Reset fade state if entity is alive again (e.g., revived enemy - unlikely server logic, but safe)
            if (mesh.userData.dyingStartTime && (entityData.health === undefined || entityData.health > 0)) {
                 delete mesh.userData.dyingStartTime;
                 mesh.material.opacity = 1.0; // Ensure visible
                 mesh.visible = true;
            }
            updateFn(mesh, entityData, now);
        } else {
            // Only create if entity is not already dead/faded on arrival
             if (entityData.health === undefined || entityData.health > 0 || entityData.type) { // Check type for powerups etc.
                mesh = createFn(entityData);
                if (mesh) {
                    meshMap[id] = mesh;
                    scene.add(mesh);
                    // Initial update call might be needed if createFn doesn't fully position/orient
                    updateFn(mesh, entityData, now);
                }
             }
        }
    }
}

// Generic function to clean up stale THREE meshes
function _cleanupStaleObjects(meshMap, activeIdsSet, handleFade = false) {
    const now = clock.elapsedTime;
    for (const id in meshMap) {
        if (!activeIdsSet.has(id)) {
            const mesh = meshMap[id];
            if (handleFade && mesh.userData.health > 0) { // Check if it *was* alive before disappearing from state
                 // Start fading out
                 mesh.userData.dyingStartTime = now;
                 mesh.userData.wasAlive = true; // Mark that it needs fading
                 mesh.userData.health = 0; // Mark as dead locally for next check
                 mesh.material.transparent = true; // Need transparency for fade
                 // console.log(`Starting fade for ${id}`);
            } else if (handleFade && mesh.userData.wasAlive && mesh.userData.dyingStartTime) {
                 // Continue fading
                 const timeElapsed = now - mesh.userData.dyingStartTime;
                 const fadeProgress = Math.min(1.0, timeElapsed / FADE_OUT_DURATION);
                 mesh.material.opacity = 1.0 - fadeProgress;
                 // Optional: Add scaling down effect
                 // mesh.scale.setScalar(1.0 - fadeProgress);

                 if (fadeProgress >= 1.0) {
                    // console.log(`Fade complete for ${id}`);
                    _removeMesh(mesh, id, meshMap);
                 }
            } else {
                // Not handling fade or fade already finished / wasn't alive
                _removeMesh(mesh, id, meshMap);
            }
        }
         // Additional check: if an object is marked dead by the server immediately ('health' <= 0 from state)
         // but we weren't fading it yet, start the fade now.
        else if(handleFade && meshMap[id]) {
             const mesh = meshMap[id];
             // Check against internal userData health state
             if (mesh.userData.health <= 0 && !mesh.userData.dyingStartTime && mesh.userData.wasAlive !== false) {
                mesh.userData.dyingStartTime = now;
                mesh.userData.wasAlive = true; // Mark that it needs fading
                mesh.material.transparent = true;
                // console.log(`Starting fade for already dead ${id}`);
            }
        }
    }
}


function _removeMesh(mesh, id, meshMap) {
    if (!mesh) return;
    scene.remove(mesh);
    // Dispose geometry/material ONLY if they are unique to this mesh
    // Currently, most resources are shared, so disposal happens in Renderer3D.cleanup()
    // If you create unique geometry/material per object, dispose here:
    // mesh.geometry?.dispose();
    // mesh.material?.dispose();
    delete meshMap[id];
}

// --- Player Object Functions ---
function _createPlayerMesh(playerData) {
    const isSelf = playerData.id === (window.appState ? window.appState.localPlayerId : null); // Access global appState cautiously
    const material = isSelf
        ? sharedResources.materials.playerSelf.clone() // Clone for potential modification
        : sharedResources.materials.playerBase.clone();

    const mesh = new THREE.Mesh(sharedResources.geometries.playerCapsule, material);
    mesh.castShadow = true;
    mesh.userData.gameId = playerData.id;
    mesh.userData.isPlayer = true;
    mesh.userData.health = playerData.health;
    mesh.userData.status = playerData.player_status;
    mesh.userData.isSelf = isSelf;
    // Rotate capsule to stand upright (it's created along Y)
    // No rotation needed if Y is up
    return mesh;
}

function _updatePlayerMesh(mesh, playerData, now) {
    mesh.position.set(playerData.x, MESH_Y_OFFSET + 24, playerData.y); // Adjust Y based on capsule height/2
    mesh.userData.health = playerData.health;
    mesh.userData.status = playerData.player_status;

    // Rotation (Aiming) - Only rotate local player based on aim state
    if (mesh.userData.isSelf && window.appState?.localPlayerAimState) {
        const aimDx = window.appState.localPlayerAimState.lastAimDx;
        const aimDy = window.appState.localPlayerAimState.lastAimDy;
        const targetAngle = Math.atan2(aimDx, aimDy); // atan2 takes (x, z) for Y-up rotation
        mesh.rotation.y = targetAngle;
    }
    // else { // Optionally rotate remote players based on velocity or server direction?
    //     // Needs direction vector from server state if desired.
    // }


    // Update material based on status
    let targetMaterial = sharedResources.materials.playerBase;
    if (mesh.userData.isSelf) targetMaterial = sharedResources.materials.playerSelf;
    if (playerData.player_status === 'down') targetMaterial = sharedResources.materials.playerDown;
    else if (playerData.player_status === 'dead' || playerData.health <= 0) targetMaterial = sharedResources.materials.playerDead;

    if (mesh.material !== targetMaterial) {
        mesh.material = targetMaterial.clone(); // Use clone if you might modify properties later
    }

    // Visual cues for effects (Example: Speed Boost)
    if (playerData.effects?.speed_boost && now < playerData.effects.speed_boost.expires_at) {
        // Simple glow example - could add particles later
        mesh.material.emissive.setHex(0x3edef3);
        mesh.material.emissiveIntensity = Math.sin(now * 5) * 0.3 + 0.4; // Pulsing effect
    } else if (mesh.material.emissive) { // Reset emissive if effect ended
         const baseEmissive = mesh.userData.isSelf ? 0x113311 : 0x000000;
         const baseIntensity = mesh.userData.isSelf ? 0.4 : 0;
         if(mesh.material.emissive.getHex() !== baseEmissive || mesh.material.emissiveIntensity !== baseIntensity) {
            mesh.material.emissive.setHex(baseEmissive);
            mesh.material.emissiveIntensity = baseIntensity;
         }
    }

     // Hide mesh immediately if status is DEAD and not fading
    if(playerData.player_status === 'dead' && !mesh.userData.dyingStartTime) {
        mesh.visible = false;
        mesh.userData.wasAlive = false; // Prevent cleanup trying to fade it
    } else {
        mesh.visible = true;
    }
}

// --- Enemy Object Functions ---
function _createEnemyMesh(enemyData) {
    let geometry, material;
    switch (enemyData.type) {
        case 'shooter':
            geometry = sharedResources.geometries.enemyShooter;
            material = sharedResources.materials.enemyShooter.clone();
            break;
        case 'giant':
            geometry = sharedResources.geometries.enemyGiant;
            material = sharedResources.materials.enemyGiant.clone();
            break;
        case 'chaser':
        default:
            geometry = sharedResources.geometries.enemyChaser;
            material = sharedResources.materials.enemyChaser.clone();
            break;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.userData.gameId = enemyData.id;
    mesh.userData.type = enemyData.type;
    mesh.userData.isEnemy = true;
    mesh.userData.health = enemyData.health;
    mesh.userData.wasAlive = true; // Assume alive on creation
    return mesh;
}

function _updateEnemyMesh(mesh, enemyData, now) {
    const yPos = (enemyData.type === 'giant' ? 50 : (enemyData.type === 'shooter' ? 22.5 : 20)); // half height offset
    mesh.position.set(enemyData.x, MESH_Y_OFFSET + yPos, enemyData.y);
    mesh.userData.health = enemyData.health; // Keep track for fading logic

    // Rotation (Targeting) - Needs target info from server if implemented
    // Example: if (enemyData.target_player_id && objectMaps.playerMeshes[enemyData.target_player_id]) {
    //    const targetMesh = objectMaps.playerMeshes[enemyData.target_player_id];
    //    mesh.lookAt(targetMesh.position.x, mesh.position.y, targetMesh.position.z); // LookAt in XZ plane
    //}

    // Giant windup effect (Example: slight scale pulse)
    if (enemyData.type === 'giant' && enemyData.attack_state === 'winding_up') {
        const pulse = Math.sin((now - (enemyData.windup_ends_at - 0.6)) * Math.PI / 0.6) * 0.1 + 1.0; // Simple sine pulse during windup
        mesh.scale.set(pulse, pulse, pulse);
    } else {
        mesh.scale.set(1, 1, 1); // Reset scale
    }
}

// --- Bullet Object Functions ---
function _createBulletMesh(bulletData) {
    let geometry, material;
    let radius = 4;
    switch (bulletData.bullet_type) {
        case 'ammo_shotgun':
            radius = 4 * 0.75; // SHOTGUN_PELLET_RADIUS_FACTOR
            geometry = new THREE.SphereGeometry(radius, 6, 4); // Unique geo for size
            material = sharedResources.materials.bulletShotgun;
            break;
        case 'ammo_heavy_slug':
            radius = 4 * 1.5; // HEAVY_SLUG_RADIUS_MULTIPLIER
            geometry = new THREE.SphereGeometry(radius, 10, 8); // Unique geo for size
            material = sharedResources.materials.bulletHeavySlug;
            break;
        case 'ammo_rapid_fire':
            geometry = sharedResources.geometries.bulletStandard;
            material = sharedResources.materials.bulletRapid;
            break;
        case 'standard_enemy':
            radius = 3;
            geometry = new THREE.SphereGeometry(radius, 6, 4); // Unique geo for size
            material = sharedResources.materials.bulletEnemy;
            break;
        case 'standard':
        default:
            geometry = sharedResources.geometries.bulletStandard;
            material = sharedResources.materials.bulletStandard;
            break;
    }
    const mesh = new THREE.Mesh(geometry, material);
    // Bullets usually don't cast shadows unless they are very large
    // mesh.castShadow = true;
    mesh.userData.gameId = bulletData.id;
    mesh.userData.isBullet = true;
    return mesh;
}

function _updateBulletMesh(mesh, bulletData, now) {
    // Bullets are often high off the ground
    mesh.position.set(bulletData.x, MESH_Y_OFFSET + 15, bulletData.y);
}

// --- Powerup Object Functions ---
function _createPowerupMesh(powerupData) {
    let material;
    switch (powerupData.type) {
        case 'health': material = sharedResources.materials.powerupHealth; break;
        case 'gun_upgrade': material = sharedResources.materials.powerupGun; break;
        case 'speed_boost': material = sharedResources.materials.powerupSpeed; break;
        case 'armor': material = sharedResources.materials.powerupArmor; break;
        case 'ammo_shotgun': material = sharedResources.materials.powerupShotgun; break;
        case 'ammo_heavy_slug': material = sharedResources.materials.powerupSlug; break;
        case 'ammo_rapid_fire': material = sharedResources.materials.powerupRapid; break;
        case 'bonus_score': material = sharedResources.materials.powerupScore; break;
        default: material = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Default fallback
    }
    const mesh = new THREE.Mesh(sharedResources.geometries.powerupBox, material.clone()); // Clone material for effects
    mesh.castShadow = true;
    mesh.userData.gameId = powerupData.id;
    mesh.userData.isPowerup = true;
    mesh.userData.type = powerupData.type;
    return mesh;
}

function _updatePowerupMesh(mesh, powerupData, now) {
    mesh.position.set(powerupData.x, MESH_Y_OFFSET + 10, powerupData.y); // Box half-height offset
    // Add simple bobbing/rotation animation
    mesh.position.y += Math.sin(now * 2 + mesh.id * 0.5) * 3; // Bobbing
    mesh.rotation.y = (now * 0.5 + mesh.id * 0.3) % (Math.PI * 2); // Slow rotation
}


// --- Effects ---

function _updateMuzzleFlash(flashData, playerPos, aimState) {
    let flashMesh = objectMaps.effectMeshes['muzzleFlash'];
    if (flashData.active) {
        if (!flashMesh) {
            flashMesh = new THREE.Sprite(sharedResources.materials.muzzleFlash);
            flashMesh.scale.set(50, 50, 1); // Adjust scale as needed
            objectMaps.effectMeshes['muzzleFlash'] = flashMesh;
            scene.add(flashMesh);
        }
        // Position slightly ahead of player along aim direction
        const forwardOffset = 30;
        const sideOffset = 0; // Can adjust if gun is held to side
        const angle = Math.atan2(aimState.lastAimDx, aimState.lastAimDy);
        const muzzleX = playerPos.x + Math.sin(angle) * forwardOffset - Math.cos(angle) * sideOffset;
        const muzzleZ = playerPos.y + Math.cos(angle) * forwardOffset + Math.sin(angle) * sideOffset;

        flashMesh.position.set(muzzleX, MESH_Y_OFFSET + 25, muzzleZ); // Position at ~barrel height
        flashMesh.visible = true;
    } else if (flashMesh) {
        flashMesh.visible = false;
    }
}

function _updatePushbackEffect(pushbackData, playerPos) {
    let ringMesh = objectMaps.effectMeshes['pushbackRing'];
    if (pushbackData.active) {
        if (!ringMesh) {
            ringMesh = new THREE.Mesh(sharedResources.geometries.pushbackRing, sharedResources.materials.pushbackRing.clone());
            ringMesh.rotation.x = -Math.PI / 2; // Rotate ring to be flat on ground
            objectMaps.effectMeshes['pushbackRing'] = ringMesh;
            scene.add(ringMesh);
        }

        const timeElapsed = performance.now() - (pushbackData.endTime - pushbackData.duration);
        const progress = Math.min(1.0, timeElapsed / pushbackData.duration);

        const currentScale = 1.0 + progress * 1.5; // Ring expands outwards
        const currentOpacity = 0.6 * (1.0 - progress); // Ring fades out

        ringMesh.scale.set(currentScale, currentScale, currentScale);
        ringMesh.material.opacity = currentOpacity;
        ringMesh.position.set(playerPos.x, MESH_Y_OFFSET + 1, playerPos.y); // Slightly above ground
        ringMesh.visible = true;

    } else if (ringMesh) {
        ringMesh.visible = false;
    }
}

function _updateAmmoCasings(activeCasings, deltaTime) {
    const mesh = objectMaps.ammoCasingMesh;
    if (!mesh || !activeCasings) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let visibleInstances = 0;

    for (let i = 0; i < activeCasings.length && visibleInstances < AMMO_CASING_INSTANCES; i++) {
        const casing = activeCasings[i];

        // Use physics state calculated in main.js
        position.set(casing.x, MESH_Y_OFFSET + 5 + casing.vy * 0.01, casing.y); // Approx Y based on velocity? Or add height state? Let's keep it simple.
        quaternion.setFromEuler(new THREE.Euler(Math.random()*Math.PI*2, casing.rotation, Math.random()*Math.PI*2)); // Add tumble

        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(visibleInstances, matrix);
        visibleInstances++;
    }

    mesh.count = visibleInstances;
    mesh.instanceMatrix.needsUpdate = true;
}

function _updateBloodSparks(activeSparkEffects, enemyMeshMap, deltaTime) {
    const mesh = objectMaps.bloodSparkMesh;
    if (!mesh || !activeSparkEffects) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion().identity(); // Sparks don't need rotation
    const scale = new THREE.Vector3(1, 1, 1);
    let visibleInstances = 0;

    const gravity = 350;
    const initialVelY = 80;
    const initialVelSpread = 100;

    for (const enemyId in activeSparkEffects) {
         if (visibleInstances >= BLOOD_SPARK_INSTANCES) break;

         const enemyMesh = enemyMeshMap[enemyId];
         if (!enemyMesh) continue; // Enemy might have been removed

         const endTime = activeSparkEffects[enemyId];
         const spawnTime = endTime - 300; // SPARK_DURATION_MS
         const timeElapsed = performance.now() - spawnTime;
         const lifeProgress = Math.min(1.0, timeElapsed / 300);

         // Simple projectile motion per spark (let's spawn a few per hit)
         const numSparksPerHit = 3;
         for (let i = 0; i < numSparksPerHit && visibleInstances < BLOOD_SPARK_INSTANCES; i++) {
             // Calculate physics based on timeElapsed
             const angleXY = Math.random() * Math.PI * 2;
             const angleZ = (Math.random() - 0.5) * Math.PI * 0.8; // Spread upwards/downwards
             const speed = initialVelSpread * (1 + Math.random());

             const vx = Math.cos(angleXY) * Math.cos(angleZ) * speed;
             const vy = Math.sin(angleZ) * speed + initialVelY; // Initial upward component
             const vz = Math.sin(angleXY) * Math.cos(angleZ) * speed;

             const dt = timeElapsed / 1000;
             const currentX = enemyMesh.position.x + vx * dt;
             const currentY = enemyMesh.position.y + vy * dt - 0.5 * gravity * dt * dt;
             const currentZ = enemyMesh.position.z + vz * dt;

             if (currentY < MESH_Y_OFFSET) continue; // Skip sparks below ground

             position.set(currentX, currentY, currentZ);
             const currentScale = 1.0 - lifeProgress; // Shrink as they fade
             scale.set(currentScale, currentScale, currentScale);

             matrix.compose(position, quaternion, scale);
             mesh.setMatrixAt(visibleInstances, matrix);
             visibleInstances++;
         }
    }

    mesh.count = visibleInstances;
    mesh.instanceMatrix.needsUpdate = true;
}


// --- Snake Visual ---
function _updateSnakeVisual(snakeState, deltaTime) {
     if (snakeState?.isActiveFromServer) {
         const points = [];
         const headX = snakeState.serverHeadX;
         const baseY = snakeState.serverBaseY;
         const direction = snakeState.direction;
         const waveTimeFactor = clock.elapsedTime * 0.5; // Match server calculation if possible
         const frequency = 0.03; // SNAKE_FREQUENCY
         const amplitude = 5.0; // SNAKE_AMPLITUDE
         const segmentLength = 10.0; // SNAKE_SEGMENT_LENGTH

         for (let i = 0; i < SNAKE_SEGMENTS_VISUAL; i++) {
            const currentX = headX - direction * i * segmentLength;
            // Recalculate Y based on the server's wave function
            const currentY = baseY + Math.sin(currentX * frequency + waveTimeFactor) * amplitude;
            points.push(new THREE.Vector3(currentX, MESH_Y_OFFSET + SNAKE_RADIUS, currentY));
         }

         if (points.length < 2) { // Need at least 2 points for a tube
             if (objectMaps.snakeMesh) {
                 _removeMesh(objectMaps.snakeMesh, 'snake', objectMaps); // Use generic remover
                 objectMaps.snakeMesh = null;
             }
             return;
         }

         const curve = new THREE.CatmullRomCurve3(points);
         const tubeGeo = new THREE.TubeGeometry(curve, SNAKE_SEGMENTS_VISUAL - 1, SNAKE_RADIUS, 8, false);

         if (!objectMaps.snakeMesh) {
            objectMaps.snakeMesh = new THREE.Mesh(tubeGeo, sharedResources.materials.snake);
            objectMaps.snakeMesh.castShadow = true;
            scene.add(objectMaps.snakeMesh);
         } else {
             objectMaps.snakeMesh.geometry.dispose(); // Dispose old geometry
             objectMaps.snakeMesh.geometry = tubeGeo;
         }
     } else if (objectMaps.snakeMesh) {
         _removeMesh(objectMaps.snakeMesh, 'snake', objectMaps); // Use generic remover
         objectMaps.snakeMesh = null;
     }
}

// --- Weather Effects (Placeholders - Requires more complex implementation) ---
function _updateWeatherEffects(isRaining, isDustStorm, deltaTime) {
    // TODO: Implement particle systems for rain
    // TODO: Implement shader/overlay for dust storm
    if (isRaining) {
        // Update rain particle positions
    }
    if (isDustStorm) {
        // Update dust storm shader uniforms or overlay opacity/scroll
    }
}

// --- Camera Shake ---
function _updateCameraShake(deltaTime) {
    if (shakeIntensity > 0 && clock.elapsedTime < shakeEndTime) {
        const timeRemaining = shakeEndTime - clock.elapsedTime;
        const decayFactor = Math.max(0, timeRemaining / (shakeEndTime - (shakeEndTime - 0.250))); // Approx decay over 250ms duration used in main.js
        const currentIntensity = shakeIntensity * decayFactor * decayFactor; // Exponential decay

        const shakeX = (Math.random() - 0.5) * currentIntensity * 1.5;
        const shakeY = (Math.random() - 0.5) * currentIntensity * 1.5;
        // Apply shake relative to original position
        camera.position.x = originalCameraPos.x + shakeX;
        camera.position.y = originalCameraPos.y + shakeY;
        // Optional: Add slight rotation shake
        // camera.rotation.z += (Math.random() - 0.5) * currentIntensity * 0.001;
    } else {
        if (shakeIntensity > 0) { // Reset when shake ends
             camera.position.copy(originalCameraPos);
             // camera.rotation.z = 0; // Reset rotation if applied
             shakeIntensity = 0;
        }
    }
}


// --- Exported Renderer3D Object ---

const Renderer3D = {
    init: (containerElement, initialWidth, initialHeight) => {
        try {
            if (!containerElement) throw new Error("Container element is required.");
            container = containerElement;
            width = initialWidth;
            height = initialHeight;

            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); // Use alpha false for potentially better perf if bg is opaque
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(width, height);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
            renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct color space
            // renderer.toneMapping = THREE.ACESFilmicToneMapping; // Optional: nice tone mapping
            // renderer.toneMappingExposure = 1.0;
            container.appendChild(renderer.domElement);
            canvas = renderer.domElement; // Store reference to the canvas

            // Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a28); // Match CSS --color-dark-bg
            scene.fog = new THREE.FogExp2(0x1a2a28, 0.0015); // Start with matching fog

            // Camera
            camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
            camera.position.set(0, 700, 500); // Adjusted position for better view angle
            camera.lookAt(scene.position);
            originalCameraPos.copy(camera.position); // Store initial pos for shake reset

            // Lights
            ambientLight = new THREE.AmbientLight(0x607080, 0.8); // Dim ambient light
            scene.add(ambientLight);

            directionalLight = new THREE.DirectionalLight(0xffffff, 2.0); // Brighter directional
            directionalLight.position.set(150, 300, 200);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048; // Higher res shadows
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.left = -800; // Adjust bounds to cover game area
            directionalLight.shadow.camera.right = 800;
            directionalLight.shadow.camera.top = 800;
            directionalLight.shadow.camera.bottom = -800;
            directionalLight.shadow.camera.near = 10;
            directionalLight.shadow.camera.far = 1000;
            directionalLight.shadow.bias = -0.001; // Adjust bias to prevent shadow acne
            scene.add(directionalLight);
            scene.add(directionalLight.target); // Target defaults to 0,0,0

             // Optional: Controls for Debugging (Uncomment to use)
            // controls = new OrbitControls(camera, renderer.domElement);
            // controls.target.set(0, 0, 0);
            // controls.enablePan = true;
            // controls.enableZoom = true;
            // controls.update();

            // Ground
            const groundGeo = new THREE.PlaneGeometry(initialWidth * 1.5, initialHeight * 1.5, 10, 10); // Larger ground
            const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5d65, roughness: 0.8, metalness: 0.1 }); // Match --color-secondary approx
            groundPlane = new THREE.Mesh(groundGeo, groundMat);
            groundPlane.rotation.x = -Math.PI / 2; // Rotate flat
            groundPlane.receiveShadow = true;
            scene.add(groundPlane);

             // Campfire Visual Placeholder
            const logGeo = new THREE.CylinderGeometry(15, 15, 40, 8);
            const logMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
            campfireLogs = new THREE.Mesh(logGeo, logMat);
            campfireLogs.position.set(initialWidth / 2, MESH_Y_OFFSET + 20, initialHeight / 2); // Position in center
            campfireLogs.castShadow = true;
            scene.add(campfireLogs);

            campfireLight = new THREE.PointLight(0xffa500, 0, 150); // Start intensity 0 (off during day)
            campfireLight.position.set(initialWidth / 2, MESH_Y_OFFSET + 35, initialHeight / 2);
            campfireLight.castShadow = true; // Campfire can cast shadows
            campfireLight.shadow.bias = -0.005;
            scene.add(campfireLight);

            // Initialize Resources & Meshes
            _createSharedResources();
            _createInstancedMeshes(); // Create instanced meshes after scene is ready

            // Clock
            clock = new THREE.Clock();

            // Resize Listener
            window.addEventListener('resize', _handleResize);
            _handleResize(); // Initial call

            console.log("Renderer3D Initialized Successfully.");
            return true;

        } catch (error) {
            console.error("Renderer3D Initialization Failed:", error);
            // Cleanup potentially partially initialized state
            Renderer3D.cleanup();
            return false;
        }
    },

    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects) return;

        const deltaTime = clock.getDelta();
        const now = clock.elapsedTime; // Use internal clock for animations

        // 1. Update World Environment
        const isNight = stateToRender.is_night;
        const isDust = stateToRender.is_dust_storm;
        const targetAmbient = isNight ? 0.3 : 0.8;
        const targetDirectional = isNight ? 0.4 : 2.0;
        const targetFogDensity = isDust ? 0.0035 : (isNight ? 0.0025 : 0.0015);
        const targetFogColor = isDust ? 0xcdab8f : (isNight ? 0x050a10 : 0x1a2a28);
        const targetCampfireIntensity = isNight ? 3.0 : 0; // Intensity units for point light

        ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, targetAmbient, 0.05);
        directionalLight.intensity = THREE.MathUtils.lerp(directionalLight.intensity, targetDirectional, 0.05);
        // Optional: Slightly shift light direction for night
        directionalLight.position.y = THREE.MathUtils.lerp(directionalLight.position.y, isNight ? 250 : 300, 0.05);
        directionalLight.target.updateMatrixWorld(); // Update target if light moves

        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, targetFogDensity, 0.05);
        scene.fog.color.lerp(new THREE.Color(targetFogColor), 0.05);
        scene.background.lerp(new THREE.Color(targetFogColor), 0.05); // Match background to fog

        campfireLight.intensity = THREE.MathUtils.lerp(campfireLight.intensity, targetCampfireIntensity, 0.1);

        _updateWeatherEffects(stateToRender.is_raining, isDust, deltaTime);
        _updateSnakeVisual(stateToRender.snake_state, deltaTime);

        // 2. Sync Game State to 3D Objects
        const activeIds = { players: new Set(), enemies: new Set(), bullets: new Set(), powerups: new Set() };

        _syncObjects(stateToRender.players, objectMaps.playerMeshes, _createPlayerMesh, _updatePlayerMesh, activeIds.players);
        _syncObjects(stateToRender.enemies, objectMaps.enemyMeshes, _createEnemyMesh, _updateEnemyMesh, activeIds.enemies);
        _syncObjects(stateToRender.bullets, objectMaps.bulletMeshes, _createBulletMesh, _updateBulletMesh, activeIds.bullets);
        _syncObjects(stateToRender.powerups, objectMaps.powerupMeshes, _createPowerupMesh, _updatePowerupMesh, activeIds.powerups);

        // 3. Cleanup Stale Objects
        _cleanupStaleObjects(objectMaps.playerMeshes, activeIds.players);
        _cleanupStaleObjects(objectMaps.enemyMeshes, activeIds.enemies, true); // Handle enemy fade
        _cleanupStaleObjects(objectMaps.bulletMeshes, activeIds.bullets);
        _cleanupStaleObjects(objectMaps.powerups, activeIds.powerups);

        // 4. Update Local Effects
        _updateMuzzleFlash(localEffects.muzzleFlash, appState.renderedPlayerPos, appState.localPlayerAimState);
        _updatePushbackEffect(localEffects.pushbackAnim, appState.renderedPlayerPos);
        _updateAmmoCasings(localEffects.activeAmmoCasings, deltaTime);
        _updateBloodSparks(localEffects.activeBloodSparkEffects, objectMaps.enemyMeshes, deltaTime); // Pass enemy map for positioning

        // 5. Project World Positions to Screen for UI Overlays
        appState.uiPositions = {}; // Clear previous positions
        const projectableEntities = [
            { map: objectMaps.playerMeshes, state: stateToRender.players },
            { map: objectMaps.enemyMeshes, state: stateToRender.enemies },
            // Damage texts are handled differently as their state includes x,y already
        ];
        projectableEntities.forEach(({ map, state }) => {
            if (!state) return;
            for (const id in state) {
                const mesh = map[id];
                if (mesh && mesh.visible) { // Only project visible meshes
                     try {
                        const worldPos = new THREE.Vector3();
                        mesh.getWorldPosition(worldPos);
                        // Offset slightly upwards for better UI placement above the mesh center
                        worldPos.y += (mesh.geometry.boundingBox?.max.y || 10) * mesh.scale.y; // Use bounding box or estimate
                        appState.uiPositions[id] = Renderer3D.projectToScreen(worldPos);
                     } catch(e) {
                         console.error(`Error projecting mesh ${id}:`, e);
                     }
                }
            }
        });
         // Project damage text positions (use their state x/y directly)
        if (stateToRender.damage_texts) {
            for (const id in stateToRender.damage_texts) {
                const dt = stateToRender.damage_texts[id];
                // Use damage text's world coords directly, assume Y=0 for projection unless state provides it
                const dtWorldPos = new THREE.Vector3(dt.x, MESH_Y_OFFSET + 20, dt.y); // Assume a sensible Y offset
                appState.uiPositions[id] = Renderer3D.projectToScreen(dtWorldPos);
            }
        }

        // 6. Update Camera Shake
         _updateCameraShake(deltaTime);

         // Optional: Update Debug Controls
         // if (controls) controls.update();

        // 7. Render the Scene
        renderer.render(scene, camera);
    },

    // --- Utilities ---

    getCamera: () => camera,
    getGroundPlane: () => groundPlane, // For mouse raycasting in main.js

    projectToScreen: (worldPosition) => {
        if (!camera || !width || !height) return { screenX: -1, screenY: -1 };
        const vector = worldPosition.clone();
        vector.project(camera);
        const screenX = Math.round(((vector.x + 1) * width) / 2);
        const screenY = Math.round(((-vector.y + 1) * height) / 2);
        return { screenX, screenY };
    },

     triggerShake: (intensity, durationMs) => {
        if (intensity > shakeIntensity) { // Only apply stronger shake
             shakeIntensity = Math.max(0.1, intensity); // Clamp min intensity
             shakeEndTime = clock.elapsedTime + durationMs / 1000.0;
             originalCameraPos.copy(camera.position); // Store current pre-shake position
             // console.log(`Triggering shake: ${intensity} for ${durationMs}ms`);
        }
    },

    cleanup: () => {
        console.log("Cleaning up Renderer3D...");
        window.removeEventListener('resize', _handleResize);

        // Cancel any running animations managed by external loops if necessary (main.js handles this)

        // Remove all objects from scene and dispose resources
        const mapsToClean = [
            objectMaps.playerMeshes, objectMaps.enemyMeshes,
            objectMaps.bulletMeshes, objectMaps.powerupsMeshes,
            objectMaps.effectMeshes // Add other maps if created
        ];
        mapsToClean.forEach(map => {
            if(map) {
                Object.keys(map).forEach(id => _removeMesh(map[id], id, map));
            }
        });

         // Remove snake mesh explicitly if it exists
        if (objectMaps.snakeMesh) _removeMesh(objectMaps.snakeMesh, 'snake', objectMaps);

         // Remove instanced meshes
        if(objectMaps.ammoCasingMesh) scene.remove(objectMaps.ammoCasingMesh);
        if(objectMaps.bloodSparkMesh) scene.remove(objectMaps.bloodSparkMesh);

        // Dispose shared resources
        Object.values(sharedResources.geometries).forEach(geo => geo?.dispose());
        Object.values(sharedResources.materials).forEach(mat => mat?.dispose());
        sharedResources.geometries = {};
        sharedResources.materials = {};

        // Dispose ground plane, campfire etc.
        groundPlane?.geometry?.dispose();
        groundPlane?.material?.dispose();
        campfireLogs?.geometry?.dispose();
        campfireLogs?.material?.dispose();
        scene.remove(groundPlane);
        scene.remove(campfireLogs);
        scene.remove(campfireLight); // Lights don't need disposal

        // Dispose renderer
        renderer?.dispose();
        if (renderer?.domElement) {
             container?.removeChild(renderer.domElement);
        }

        // Clear variables
        renderer = null; scene = null; camera = null; ambientLight = null; directionalLight = null;
        clock = null; container = null; canvas = null; groundPlane = null; campfireLogs = null; campfireLight = null; controls = null;
        objectMaps.playerMeshes = {}; objectMaps.enemyMeshes = {}; objectMaps.bulletMeshes = {};
        objectMaps.powerupMeshes = {}; objectMaps.effectMeshes = {}; objectMaps.ammoCasingMesh = null; objectMaps.bloodSparkMesh = null; objectMaps.snakeMesh = null;
        shakeIntensity = 0; shakeEndTime = 0;

        console.log("Renderer3D Cleanup Complete.");
    }
};

// Make appState accessible globally (use with caution - better dependency injection is preferred in larger apps)
// This is needed for _updatePlayerMesh and potentially others to access localPlayerId/aimState.
window.appState = window.appState || {}; // Ensure it exists

export default Renderer3D;
