// Renderer3D.js
// Rewritten Version: Player-Following Camera Logic
// Focus on robust resizing, camera alignment following the player.

import * as THREE from 'three';

// --- Utility Functions ---
function lerp(start, end, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return start + (end - start) * t;
}

// --- Constants ---
const DEFAULT_GAME_WIDTH = 1600; const DEFAULT_GAME_HEIGHT = 900;
const CAMERA_FOV = 60; const CAMERA_NEAR = 10; const CAMERA_FAR = 2500;
// Camera position RELATIVE to its target (player or map center)
const CAMERA_HEIGHT_OFFSET = 950; // How high above the lookAt target
const CAMERA_DISTANCE_OFFSET = 300; // How far behind the lookAt target (along Z)
const CAMERA_ANGLE = -Math.PI / 2.7; // Still used for initial setup, might be redundant now
const CAMERA_LERP_FACTOR = 0.08; // Smoothness of camera follow
const GROUND_MARGIN = 1.2;

// Instancing & Particle Limits (Keep these)
const MAX_PLAYER_BULLETS = 500; const MAX_ENEMY_BULLETS = 500;
const MAX_AMMO_CASINGS = 150; const MAX_HIT_SPARKS = 200;
const MAX_RAIN_DROPS = 1000; const MAX_DUST_MOTES = 600;
const MAX_FLAME_PARTICLES = 80;

// Entity Visual Properties (Keep these)
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

// Particle Physics & Appearance (Keep these)
const AMMO_CASING_RADIUS = 0.6; const AMMO_CASING_LENGTH = 3.5;
const AMMO_CASING_GRAVITY = 980; const AMMO_CASING_BOUNCE = 0.3; const AMMO_CASING_DRAG = 0.5;
const HIT_SPARK_GRAVITY = 500; const HIT_SPARK_BASE_LIFE = 0.2; const HIT_SPARK_RAND_LIFE = 0.2;
const HIT_SPARK_INITIAL_VEL = 150; const HIT_SPARK_SPREAD = 120;
const FLAME_BASE_LIFE = 0.6; const FLAME_RAND_LIFE = 0.5; const FLAME_VEL_Y = 60; const FLAME_VEL_SPREAD = 25;
const RAIN_SPEED_Y = -500; const RAIN_SPEED_Y_RAND = -200; const RAIN_STREAK_LENGTH = 20;
const DUST_SPEED_XZ = 40; const DUST_SPEED_Y = 8; const DUST_OPACITY = 0.15;

// Misc Timing & State (Keep these)
const FADE_OUT_DURATION = 0.35;
const PLAYER_STATUS_ALIVE = 'alive'; const PLAYER_STATUS_DOWN = 'down'; const PLAYER_STATUS_DEAD = 'dead';

// Y-Offsets (Keep these)
const Y_OFFSET_PLAYER = PLAYER_CAPSULE_RADIUS;
const Y_OFFSET_ENEMY_BODY = 0;
const Y_OFFSET_POWERUP = POWERUP_BASE_SIZE * 0.7;
const Y_OFFSET_BULLET = 10;
const Y_OFFSET_CAMPFIRE = CAMPFIRE_LOG_RADIUS;
const Y_OFFSET_SNAKE = SNAKE_RADIUS;
const Y_OFFSET_CASING = AMMO_CASING_RADIUS;

// --- Module Scope Variables ---
let renderer, scene, camera, clock;
let ambientLight, directionalLight;
let domContainer;
// --- Dynamic Dimensions - Set by handleContainerResize ---
let currentCanvasWidth = DEFAULT_GAME_WIDTH;
let currentCanvasHeight = DEFAULT_GAME_HEIGHT;
// --- Scene Objects ---
let groundPlane = null;
const playerGroupMap = {}; const enemyGroupMap = {}; const powerupGroupMap = {};
// Instanced Meshes & Particles (Keep declarations)
let playerBulletMesh = null; let playerBulletMatrices = [];
let enemyBulletMesh = null;  let enemyBulletMatrices = [];
let ammoCasingMesh = null;   let activeAmmoCasings = [];
let hitSparkSystem = null;   let rainSystem = null;       let dustSystem = null;
let campfireSystem = null;   let snakeMesh = null;
// Effects (Keep declarations)
let muzzleFlashLight = null;
let screenShakeOffset = new THREE.Vector3(0, 0, 0);
let shakeMagnitude = 0; let shakeEndTime = 0;
// Shared Resources (Keep declarations)
const sharedGeometries = {}; const sharedMaterials = {}; const powerupGeometries = {}; const loadedAssets = {};
// Reusable THREE objects (Keep declarations)
const _dummyObject = new THREE.Object3D(); const _matrix = new THREE.Matrix4(); const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion(); const _scale = new THREE.Vector3(1, 1, 1); const _color = new THREE.Color();
const _vector3 = new THREE.Vector3();
const _cameraTargetWorldPos = new THREE.Vector3(); // Stores the calculated target (player pos or map center)
const _cameraDesiredPos = new THREE.Vector3(); // Stores the calculated desired camera position

// --- Internal Helper Functions (Assets, Geometries, Materials - Keep as before) ---
function _createAssets() { /* ... (keep implementation) ... */
    console.log("Renderer: Creating assets..."); try{const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');if(!x)throw new Error("Failed context");const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,220,150,1)');g.addColorStop(0.4,'rgba(255,150,0,0.8)');g.addColorStop(1,'rgba(200,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);loadedAssets.flameTexture=new THREE.CanvasTexture(c);loadedAssets.flameTexture.name="FlameTexture"}catch(e){console.error("Flame texture error:",e)} }
function _createGeometries() { /* ... (keep implementation) ... */
    console.log("Renderer: Creating geometries...");sharedGeometries.playerBody=new THREE.CapsuleGeometry(PLAYER_CAPSULE_RADIUS,PLAYER_CAPSULE_HEIGHT,4,12);sharedGeometries.head=new THREE.SphereGeometry(1,12,8);sharedGeometries.playerGun=new THREE.CylinderGeometry(PLAYER_GUN_RADIUS,PLAYER_GUN_RADIUS*0.8,PLAYER_GUN_LENGTH,8);sharedGeometries.enemyChaserBody=new THREE.BoxGeometry(ENEMY_CHASER_WIDTH,ENEMY_CHASER_HEIGHT,ENEMY_CHASER_DEPTH);sharedGeometries.enemyShooterBody=new THREE.CylinderGeometry(ENEMY_SHOOTER_RADIUS,ENEMY_SHOOTER_RADIUS,ENEMY_SHOOTER_HEIGHT,10);sharedGeometries.enemyGiantBody=new THREE.BoxGeometry(ENEMY_CHASER_WIDTH*ENEMY_GIANT_MULTIPLIER,ENEMY_CHASER_HEIGHT*ENEMY_GIANT_MULTIPLIER,ENEMY_CHASER_DEPTH*ENEMY_GIANT_MULTIPLIER);sharedGeometries.enemyGun=new THREE.CylinderGeometry(ENEMY_GUN_RADIUS,ENEMY_GUN_RADIUS*0.7,ENEMY_GUN_LENGTH,8);sharedGeometries.bullet=new THREE.CylinderGeometry(BULLET_BASE_RADIUS,BULLET_BASE_RADIUS*0.8,BULLET_LENGTH,8);sharedGeometries.bullet.rotateX(Math.PI/2);sharedGeometries.ammoCasing=new THREE.CylinderGeometry(AMMO_CASING_RADIUS,AMMO_CASING_RADIUS,AMMO_CASING_LENGTH,6);const p=POWERUP_BASE_SIZE;powerupGeometries.health=new THREE.TorusGeometry(p*0.4,p*0.15,8,16);powerupGeometries.gun_upgrade=new THREE.ConeGeometry(p*0.45,p*0.9,4);powerupGeometries.speed_boost=new THREE.CylinderGeometry(p*0.6,p*0.6,p*0.25,16);powerupGeometries.armor=new THREE.OctahedronGeometry(p*0.6,0);powerupGeometries.ammo_shotgun=new THREE.BoxGeometry(p*0.8,p*0.8,p*0.8);powerupGeometries.ammo_heavy_slug=new THREE.SphereGeometry(p*0.6,12,8);powerupGeometries.ammo_rapid_fire=new THREE.TorusGeometry(p*0.4,p*0.1,6,12);powerupGeometries.bonus_score=new THREE.CylinderGeometry(p*0.35,p*0.35,p*0.5,12);powerupGeometries.default=new THREE.BoxGeometry(p*0.9,p*0.9,p*0.9);sharedGeometries.log=new THREE.CylinderGeometry(CAMPFIRE_LOG_RADIUS,CAMPFIRE_LOG_RADIUS,CAMPFIRE_LOG_LENGTH,6);sharedGeometries.groundPlane=new THREE.PlaneGeometry(1,1);}
function _createMaterials() { /* ... (keep implementation) ... */
    console.log("Renderer: Creating materials...");sharedMaterials.playerBody=new THREE.MeshStandardMaterial({color:0xDC143C,roughness:0.5,metalness:0.2,name:"PlayerBody"});sharedMaterials.playerHead=new THREE.MeshStandardMaterial({color:0xD2B48C,roughness:0.7,name:"PlayerHead"});sharedMaterials.playerGun=new THREE.MeshStandardMaterial({color:0x444444,roughness:0.5,metalness:0.7,name:"PlayerGun"});sharedMaterials.playerDown=new THREE.MeshStandardMaterial({color:0xFFD700,roughness:0.6,metalness:0.1,emissive:0xccab00,emissiveIntensity:0.5,name:"PlayerDown"});sharedMaterials.playerDead=new THREE.MeshStandardMaterial({color:0x555555,roughness:0.8,metalness:0.0,name:"PlayerDead"});sharedMaterials.playerSelfBody=new THREE.MeshStandardMaterial({color:0xff69b4,roughness:0.5,metalness:0.2,emissive:0x331122,emissiveIntensity:0.3,name:"PlayerSelfBody"});const enemyStandardProps={roughness:0.7,metalness:0.1,transparent:!0,opacity:1.0};sharedMaterials.enemyChaserBody=new THREE.MeshStandardMaterial({color:0x18315f,...enemyStandardProps,name:"EnemyChaserBody"});sharedMaterials.enemyShooterBody=new THREE.MeshStandardMaterial({color:0x556B2F,...enemyStandardProps,name:"EnemyShooterBody"});sharedMaterials.enemyGiantBody=new THREE.MeshStandardMaterial({color:0x8B0000,roughness:0.6,metalness:0.2,transparent:!0,opacity:1.0,name:"EnemyGiantBody"});sharedMaterials.enemyHead=new THREE.MeshStandardMaterial({color:0xBC8F8F,roughness:0.7,name:"EnemyHead"});sharedMaterials.enemyGun=new THREE.MeshStandardMaterial({color:0x505050,roughness:0.6,metalness:0.6,name:"EnemyGun"});sharedMaterials.playerBullet=new THREE.MeshBasicMaterial({color:0xffed4a,name:"PlayerBullet"});sharedMaterials.enemyBullet=new THREE.MeshBasicMaterial({color:0xff4500,name:"EnemyBullet"});sharedMaterials.ammoCasing=new THREE.MeshStandardMaterial({color:0xdaa520,roughness:0.4,metalness:0.6,name:"AmmoCasing"});sharedMaterials.powerupBase={roughness:0.6,metalness:0.1,name:"PowerupDefault"};sharedMaterials.powerups={health:new THREE.MeshStandardMaterial({color:0x81c784,...sharedMaterials.powerupBase,name:"PowerupHealth"}),gun_upgrade:new THREE.MeshStandardMaterial({color:0x6a0dad,emissive:0x330044,emissiveIntensity:0.4,...sharedMaterials.powerupBase,name:"PowerupGun"}),speed_boost:new THREE.MeshStandardMaterial({color:0x3edef3,...sharedMaterials.powerupBase,name:"PowerupSpeed"}),armor:new THREE.MeshStandardMaterial({color:0xaaaaaa,metalness:0.8,roughness:0.3,...sharedMaterials.powerupBase,name:"PowerupArmor"}),ammo_shotgun:new THREE.MeshStandardMaterial({color:0xFFa500,...sharedMaterials.powerupBase,name:"PowerupShotgun"}),ammo_heavy_slug:new THREE.MeshStandardMaterial({color:0xA0522D,...sharedMaterials.powerupBase,name:"PowerupSlug"}),ammo_rapid_fire:new THREE.MeshStandardMaterial({color:0xFFFF00,emissive:0x555500,emissiveIntensity:0.5,...sharedMaterials.powerupBase,name:"PowerupRapid"}),bonus_score:new THREE.MeshStandardMaterial({color:0xFFD700,metalness:0.6,roughness:0.4,...sharedMaterials.powerupBase,name:"PowerupScore"}),default:new THREE.MeshStandardMaterial({color:0x888888,...sharedMaterials.powerupBase})};sharedMaterials.groundDay=new THREE.MeshStandardMaterial({color:0x788a77,roughness:0.9,metalness:0.05,name:"GroundDay"});sharedMaterials.groundNight=new THREE.MeshStandardMaterial({color:0x4E342E,roughness:0.85,metalness:0.1,name:"GroundNight"});sharedMaterials.log=new THREE.MeshStandardMaterial({color:0x5a3a1e,roughness:0.9,name:"Log"});sharedMaterials.snake=new THREE.MeshStandardMaterial({color:0x3a5311,roughness:0.4,metalness:0.1,side:THREE.DoubleSide,name:"Snake"});sharedMaterials.hitSpark=new THREE.PointsMaterial({size:10,vertexColors:!0,transparent:!0,sizeAttenuation:!0,depthWrite:!1,blending:THREE.AdditiveBlending,name:"HitSpark"});sharedMaterials.rainLine=new THREE.LineBasicMaterial({color:0x88aaff,transparent:!0,opacity:0.4,blending:THREE.AdditiveBlending,name:"RainLine"});sharedMaterials.dustMote=new THREE.PointsMaterial({size:50,color:0xd2b48c,transparent:!0,opacity:DUST_OPACITY,sizeAttenuation:!0,depthWrite:!1,name:"DustMote"});sharedMaterials.flame=new THREE.PointsMaterial({size:18,vertexColors:!0,map:loadedAssets.flameTexture,transparent:!0,sizeAttenuation:!0,depthWrite:!1,blending:THREE.AdditiveBlending,name:"Flame"});}

// --- Particle, Instance, Object Creation, Disposal (Keep as before, incl. hashCode fix) ---
function _initParticlesAndInstances() { /* ... (keep implementation) ... */ console.log("Renderer: Initializing particles and instanced meshes...");if(!scene)return;playerBulletMesh=new THREE.InstancedMesh(sharedGeometries.bullet,sharedMaterials.playerBullet,MAX_PLAYER_BULLETS);playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);playerBulletMesh.count=0;playerBulletMesh.name="PlayerBullets";scene.add(playerBulletMesh);playerBulletMatrices=playerBulletMesh.instanceMatrix.array;enemyBulletMesh=new THREE.InstancedMesh(sharedGeometries.bullet,sharedMaterials.enemyBullet,MAX_ENEMY_BULLETS);enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);enemyBulletMesh.count=0;enemyBulletMesh.name="EnemyBullets";scene.add(enemyBulletMesh);enemyBulletMatrices=enemyBulletMesh.instanceMatrix.array;ammoCasingMesh=new THREE.InstancedMesh(sharedGeometries.ammoCasing,sharedMaterials.ammoCasing,MAX_AMMO_CASINGS);ammoCasingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);ammoCasingMesh.castShadow=!0;ammoCasingMesh.count=0;ammoCasingMesh.name="AmmoCasings";scene.add(ammoCasingMesh);activeAmmoCasings=[];const s=new THREE.BufferGeometry(),k=new Float32Array(MAX_HIT_SPARKS*3),L=new Float32Array(MAX_HIT_SPARKS*3),M=new Float32Array(MAX_HIT_SPARKS),N=[];for(let i=0;i<MAX_HIT_SPARKS;i++)k[i*3+1]=-1e4,M[i]=0,N.push({p:new THREE.Vector3(0,-1e4,0),v:new THREE.Vector3,c:new THREE.Color(1,1,1),a:0,l:0});s.setAttribute('position',new THREE.BufferAttribute(k,3).setUsage(THREE.DynamicDrawUsage));s.setAttribute('color',new THREE.BufferAttribute(L,3).setUsage(THREE.DynamicDrawUsage));s.setAttribute('alpha',new THREE.BufferAttribute(M,1).setUsage(THREE.DynamicDrawUsage));hitSparkSystem={particles:new THREE.Points(s,sharedMaterials.hitSpark),geometry:s,material:sharedMaterials.hitSpark,data:N};hitSparkSystem.particles.name="HitSparks";hitSparkSystem.particles.visible=!1;scene.add(hitSparkSystem.particles);const O=new THREE.BufferGeometry(),P=new Float32Array(MAX_RAIN_DROPS*6),Q=[];for(let i=0;i<MAX_RAIN_DROPS;i++){const x=Math.random()*DEFAULT_GAME_WIDTH*GROUND_MARGIN-(DEFAULT_GAME_WIDTH*(GROUND_MARGIN-1)/2),y=Math.random()*1e3+800,z=Math.random()*DEFAULT_GAME_HEIGHT*GROUND_MARGIN-(DEFAULT_GAME_HEIGHT*(GROUND_MARGIN-1)/2);P[i*6+1]=-1e4;P[i*6+4]=-1e4;Q.push({x:x,y:y,z:z,s:RAIN_SPEED_Y+Math.random()*RAIN_SPEED_Y_RAND})}O.setAttribute('position',new THREE.BufferAttribute(P,3).setUsage(THREE.DynamicDrawUsage));rainSystem={lines:new THREE.LineSegments(O,sharedMaterials.rainLine),geometry:O,material:sharedMaterials.rainLine,data:Q};rainSystem.lines.visible=!1;rainSystem.lines.name="RainLines";scene.add(rainSystem.lines);const R=new THREE.BufferGeometry(),S=new Float32Array(MAX_DUST_MOTES*3),T=[];for(let i=0;i<MAX_DUST_MOTES;i++)S[i*3+1]=-1e4,T.push({p:new THREE.Vector3(Math.random()*DEFAULT_GAME_WIDTH,Math.random()*80+5,Math.random()*DEFAULT_GAME_HEIGHT),v:new THREE.Vector3((Math.random()-.5)*DUST_SPEED_XZ,(Math.random()-.5)*DUST_SPEED_Y,(Math.random()-.5)*DUST_SPEED_XZ)});R.setAttribute('position',new THREE.BufferAttribute(S,3).setUsage(THREE.DynamicDrawUsage));dustSystem={particles:new THREE.Points(R,sharedMaterials.dustMote),geometry:R,material:sharedMaterials.dustMote,data:T};dustSystem.particles.visible=!1;dustSystem.particles.name="DustParticles";scene.add(dustSystem.particles);}
function _initCampfire() { /* ... (keep implementation) ... */ console.log("Renderer: Initializing campfire...");if(!scene)return;const g=new THREE.Group;g.name="CampfireGroup";const l1=new THREE.Mesh(sharedGeometries.log,sharedMaterials.log);l1.rotation.set(0,Math.PI/10,Math.PI/6);l1.castShadow=!0;l1.position.set(-CAMPFIRE_LOG_LENGTH*.1,Y_OFFSET_CAMPFIRE,-CAMPFIRE_LOG_LENGTH*.2);const l2=new THREE.Mesh(sharedGeometries.log,sharedMaterials.log);l2.rotation.set(0,-Math.PI/8,-Math.PI/5);l2.castShadow=!0;l2.position.set(CAMPFIRE_LOG_LENGTH*.15,Y_OFFSET_CAMPFIRE,CAMPFIRE_LOG_LENGTH*.1);g.add(l1);g.add(l2);const gl=new THREE.PointLight(16753920,0,250,2);gl.position.y=Y_OFFSET_CAMPFIRE+15;gl.castShadow=!0;gl.shadow.mapSize.width=512;gl.shadow.mapSize.height=512;gl.shadow.bias=-.01;g.add(gl);const fG=new THREE.BufferGeometry(),fP=new Float32Array(MAX_FLAME_PARTICLES*3),fC=new Float32Array(MAX_FLAME_PARTICLES*3),fA=new Float32Array(MAX_FLAME_PARTICLES),fD=[];for(let i=0;i<MAX_FLAME_PARTICLES;i++)fP[i*3+1]=-1e4,fA[i]=0,fD.push({p:new THREE.Vector3(0,-1e4,0),v:new THREE.Vector3,c:new THREE.Color(1,1,1),a:0,l:0,bl:FLAME_BASE_LIFE+Math.random()*FLAME_RAND_LIFE});fG.setAttribute('position',new THREE.BufferAttribute(fP,3).setUsage(THREE.DynamicDrawUsage));fG.setAttribute('color',new THREE.BufferAttribute(fC,3).setUsage(THREE.DynamicDrawUsage));fG.setAttribute('alpha',new THREE.BufferAttribute(fA,1).setUsage(THREE.DynamicDrawUsage));const fp=new THREE.Points(fG,sharedMaterials.flame);fp.name="CampfireFlames";fp.visible=!1;g.add(fp);campfireSystem={group:g,particles:fp,geometry:fG,material:sharedMaterials.flame,glowLight:gl,data:fD};g.visible=!1;scene.add(g);}
function _initSnake() { /* ... (keep implementation) ... */ console.log("Renderer: Initializing snake mesh...");if(!scene)return;const d=new THREE.LineCurve3(new THREE.Vector3(0,Y_OFFSET_SNAKE,0),new THREE.Vector3(1,Y_OFFSET_SNAKE,0)),t=new THREE.TubeGeometry(d,1,SNAKE_RADIUS,6,!1);snakeMesh=new THREE.Mesh(t,sharedMaterials.snake);snakeMesh.castShadow=!0;snakeMesh.visible=!1;snakeMesh.name="Snake";scene.add(snakeMesh);}
function _createPlayerGroup(playerData, isSelf) { /* ... (keep implementation) ... */ const g=new THREE.Group;g.name=`PlayerGroup_${playerData.id}`;const bm=isSelf?sharedMaterials.playerSelfBody:sharedMaterials.playerBody,b=new THREE.Mesh(sharedGeometries.playerBody,bm.clone());b.castShadow=!0;b.position.y=Y_OFFSET_PLAYER+PLAYER_CAPSULE_HEIGHT/2;g.add(b);const h=new THREE.Mesh(sharedGeometries.head,sharedMaterials.playerHead.clone());h.scale.setScalar(PLAYER_HEAD_RADIUS);h.position.y=b.position.y+PLAYER_CAPSULE_HEIGHT/2+PLAYER_HEAD_RADIUS*.8;h.castShadow=!0;g.add(h);const n=new THREE.Mesh(sharedGeometries.playerGun,sharedMaterials.playerGun.clone());n.position.set(0,b.position.y*.9,PLAYER_CAPSULE_RADIUS*.8);n.rotation.x=Math.PI/2;n.castShadow=!0;g.add(n);g.position.set(playerData.x,0,playerData.y);g.userData={gameId:playerData.id,isPlayer:!0,isSelf:isSelf,bodyMesh:b,headMesh:h,gunMesh:n,currentBodyMatRef:bm,dyingStartTime:null};return g;}
function _createEnemyGroup(enemyData) { /* ... (keep implementation) ... */ const g=new THREE.Group;g.name=`EnemyGroup_${enemyData.id}`;let bG,bM,hS,yB,gM=null;const eH=enemyData.height||ENEMY_CHASER_HEIGHT;switch(enemyData.type){case'shooter':bG=sharedGeometries.enemyShooterBody;bM=sharedMaterials.enemyShooterBody;hS=ENEMY_HEAD_RADIUS;yB=eH/2;gM=new THREE.Mesh(sharedGeometries.enemyGun,sharedMaterials.enemyGun.clone());gM.position.set(0,yB*.7,ENEMY_SHOOTER_RADIUS*.8);gM.rotation.x=Math.PI/2;gM.castShadow=!0;g.add(gM);break;case'giant':bG=sharedGeometries.enemyGiantBody;bM=sharedMaterials.enemyGiantBody;hS=ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER*.8;yB=eH/2;break;case'chaser':default:bG=sharedGeometries.enemyChaserBody;bM=sharedMaterials.enemyChaserBody;hS=ENEMY_HEAD_RADIUS;yB=eH/2}const b=new THREE.Mesh(bG,bM.clone());b.castShadow=!0;b.position.y=Y_OFFSET_ENEMY_BODY+yB;g.add(b);const h=new THREE.Mesh(sharedGeometries.head,sharedMaterials.enemyHead.clone());h.scale.setScalar(hS);h.position.y=b.position.y+yB+hS*.7;h.castShadow=!0;g.add(h);g.position.set(enemyData.x,0,enemyData.y);g.userData={gameId:enemyData.id,isEnemy:!0,type:enemyData.type,bodyMesh:b,headMesh:h,gunMesh:gM,currentBodyMatRef:bM,dyingStartTime:null,health:enemyData.health};return g;}
function _createPowerupGroup(powerupData) { /* ... (keep implementation) ... */ const g=new THREE.Group;g.name=`PowerupGroup_${powerupData.id}`;const G=powerupGeometries[powerupData.type]||powerupGeometries.default,m=sharedMaterials.powerups[powerupData.type]||sharedMaterials.powerups.default;if(!m)return console.error(`Renderer Error: Could not find material for powerup type: ${powerupData.type}`),null;const i=new THREE.Mesh(G,m.clone());i.castShadow=!0;i.position.y=Y_OFFSET_POWERUP;i.rotation.set(Math.PI/7,0,Math.PI/7);g.add(i);g.position.set(powerupData.x,0,powerupData.y);g.userData={gameId:powerupData.id,isPowerup:!0,iconMesh:i};return g;}
function _disposeMaterialTextures(material) { /* ... (keep implementation) ... */ if(!material)return;const t=['map','normalMap','emissiveMap','roughnessMap','metalnessMap','aoMap','alphaMap','displacementMap','envMap'];t.forEach(p=>{if(material[p]&&material[p]instanceof THREE.Texture)material[p].dispose()});}
function _disposeObject3D(obj) { /* ... (keep implementation, with fix from previous step) ... */ if(!obj)return;obj.traverse(c=>{if(c instanceof THREE.Mesh||c instanceof THREE.Points||c instanceof THREE.LineSegments){c.geometry?.dispose();const m=Array.isArray(c.material)?c.material:[c.material];m.forEach(l=>{if(l){let s=Object.values(sharedMaterials).includes(l);if(!s&&sharedMaterials.powerups)s=Object.values(sharedMaterials.powerups).includes(l);if(!s)_disposeMaterialTextures(l),l.dispose()}})}else if(c instanceof THREE.PointLight&&c!==muzzleFlashLight&&c!==campfireSystem?.glowLight){}});}
function _disposeAndRemoveObject(obj, id, objectMap) { /* ... (keep implementation) ... */ if(!obj||!scene)return;scene.remove(obj);_disposeObject3D(obj);delete objectMap[id];}
function _handleObjectRemoval(obj, id, objectMap) { /* ... (keep implementation) ... */ if(!obj||!clock)return;const u=obj.userData,i=u?.isEnemy,w=!u?.dyingStartTime&&(u?.health===void 0||u?.health>0);if(i&&w&&!u.dyingStartTime){u.dyingStartTime=clock.elapsedTime;u.health=0;obj.traverse(c=>{if(c.material){const m=Array.isArray(c.material)?c.material:[c.material];m.forEach(a=>{a.transparent=!0;a.needsUpdate=!0})}})}else if(i&&u.dyingStartTime){const t=clock.elapsedTime-u.dyingStartTime,f=Math.min(1,t/FADE_OUT_DURATION),o=1-f;obj.traverse(c=>{if(c.material){const m=Array.isArray(c.material)?c.material:[c.material];m.forEach(a=>{a.opacity=o})}});if(f>=1)_disposeAndRemoveObject(obj,id,objectMap)}else _disposeAndRemoveObject(obj,id,objectMap);}
function _syncSceneObjects(state, objectMap, createFn, updateFn, isSelfFn = null) { /* ... (keep implementation) ... */ if(!scene||!clock)return;const a=new Set;if(state){for(const id in state){const d=state[id];if(typeof d?.x!='number'||typeof d?.y!='number')continue;a.add(id);let o=objectMap[id];if(!o){const i=isSelfFn?isSelfFn(id):!1;o=createFn(d,i);if(o)objectMap[id]=o,scene.add(o),updateFn(o,d,0,i)}else{const i=o.userData?.isSelf??(isSelfFn?isSelfFn(id):!1);if(o.userData?.dyingStartTime){o.userData.dyingStartTime=null;o.visible=!0;o.traverse(c=>{if(c.material){const m=Array.isArray(c.material)?c.material:[c.material];m.forEach(p=>{p.opacity=1;p.transparent=!1;p.needsUpdate=!0})}})}updateFn(o,d,clock.deltaTime,i)}}}for(const id in objectMap)if(!a.has(id))_handleObjectRemoval(objectMap[id],id,objectMap);}
function _updatePlayerGroup(group, playerData, deltaTime, isSelf) { /* ... (keep implementation) ... */ if(!group?.userData)return;group.position.x=playerData.x;group.position.z=playerData.y;const u=group.userData,b=u.bodyMesh;let t=isSelf?sharedMaterials.playerSelfBody:sharedMaterials.playerBody;switch(playerData.player_status){case PLAYER_STATUS_DOWN:t=sharedMaterials.playerDown;group.visible=!0;break;case PLAYER_STATUS_DEAD:group.visible=!1;u.dyingStartTime=null;return;case PLAYER_STATUS_ALIVE:default:group.visible=!0}if(b&&u.currentBodyMatRef!==t){u.currentBodyMatRef=t;b.material=t.clone();b.material.needsUpdate=!0}if(isSelf&&window.appState?.localPlayerAimState){const{lastAimDx:l,lastAimDy:d}=window.appState.localPlayerAimState;group.rotation.y=Math.atan2(l,d)}}
function _updateEnemyGroup(group, enemyData, deltaTime) { /* ... (keep implementation) ... */ if(!group?.userData||group.userData.dyingStartTime||!clock)return;group.position.x=enemyData.x;group.position.z=enemyData.y;group.userData.health=enemyData.health;const g=group.userData.gunMesh;if(enemyData.type==='shooter'&&g&&window.appState?.serverState?.players){const t=window.appState.serverState.players[enemyData.target_player_id];if(t){const d=t.x-enemyData.x,z=t.y-enemyData.y;group.rotation.y=Math.atan2(d,z)}}const b=group.userData.bodyMesh;if(b&&enemyData.type==='giant'){const i=enemyData.attack_state==='winding_up',s=i?1+Math.sin(clock.elapsedTime*10)*.05:1;b.scale.lerp(_vector3.set(s,s,s),.2)}}
function _updatePowerupGroup(group, powerupData, deltaTime) { /* ... (keep implementation - hashCode fix applied) ... */ if(!group?.userData||!clock)return;group.position.x=powerupData.x;group.position.z=powerupData.y;const i=group.userData.iconMesh;if(i){i.position.y=Y_OFFSET_POWERUP+Math.sin(clock.elapsedTime*2.5+group.id)*4;i.rotation.y+=.015;i.rotation.x+=.005;i.rotation.z+=.003;}}
function _updateInstancedMesh(mesh, matrices, state, yOffset, isBullet = false) { /* ... (keep implementation) ... */ if(!mesh)return;if(!state||Object.keys(state).length===0){mesh.count=0;mesh.instanceMatrix.needsUpdate=!0;return}let v=0;const m=matrices.length/16;for(const id in state){if(v>=m){console.warn(`Renderer: Exceeded max instances (${m}) for mesh ${mesh.name}.`);break}const d=state[id];if(isBullet){const i=d.owner_type==='player';if(mesh===playerBulletMesh&&!i)continue;if(mesh===enemyBulletMesh&&i)continue}if(typeof d?.x!='number'||typeof d?.y!='number')continue;_position.set(d.x,yOffset,d.y);if(isBullet&&d.vx!==void 0&&d.vy!==void 0&&(d.vx!==0||d.vy!==0)){const a=Math.atan2(d.vx,d.vy);_quaternion.setFromEuler(new THREE.Euler(0,a,0))}else _quaternion.identity();_scale.set(1,1,1);_matrix.compose(_position,_quaternion,_scale);mesh.setMatrixAt(v,_matrix);v++}mesh.count=v;mesh.instanceMatrix.needsUpdate=!0;}
function _updateActiveCasings(deltaTime) { /* ... (keep implementation) ... */ if(!ammoCasingMesh||!clock)return;if(activeAmmoCasings.length===0){if(ammoCasingMesh.count>0)ammoCasingMesh.count=0,ammoCasingMesh.instanceMatrix.needsUpdate=!0;return}const n=clock.elapsedTime;let u=!1;activeAmmoCasings=activeAmmoCasings.filter(c=>{if(n>c.endTime)return!1;c.velocity.y-=AMMO_CASING_GRAVITY*deltaTime;c.position.addScaledVector(c.velocity,deltaTime);c.rotation+=c.rotationSpeed*deltaTime;if(c.position.y<=Y_OFFSET_CASING){c.position.y=Y_OFFSET_CASING;c.velocity.y*=-AMMO_CASING_BOUNCE;c.velocity.x*=1-AMMO_CASING_DRAG;c.velocity.z*=1-AMMO_CASING_DRAG;c.rotationSpeed*=1-AMMO_CASING_DRAG*2;if(Math.abs(c.velocity.y)<5)c.velocity.y=0;if(Math.abs(c.rotationSpeed)<.1)c.rotationSpeed=0}return!0});let v=0;const M=ammoCasingMesh.instanceMatrix.array.length/16;for(let i=0;i<activeAmmoCasings.length;i++){if(v>=M)break;const c=activeAmmoCasings[i];_quaternion.setFromEuler(new THREE.Euler(Math.PI/2,c.rotation,0));_matrix.compose(c.position,_quaternion,_scale);ammoCasingMesh.setMatrixAt(v,_matrix);v++;u=!0}if(ammoCasingMesh.count!==v)ammoCasingMesh.count=v,u=!0;if(u)ammoCasingMesh.instanceMatrix.needsUpdate=!0;}
function _spawnAmmoCasing(spawnPos, ejectVec) { /* ... (keep implementation) ... */ if(!ammoCasingMesh||!clock||activeAmmoCasings.length>=MAX_AMMO_CASINGS)return;const n=clock.elapsedTime,l=1.5+Math.random()*1,e=Math.atan2(ejectVec.z,ejectVec.x)+Math.PI/2+(Math.random()-.5)*.5,s=150+Math.random()*80,u=50+Math.random()*40,r=(Math.random()-.5)*20;activeAmmoCasings.push({position:new THREE.Vector3(spawnPos.x+Math.cos(e)*5,spawnPos.y+PLAYER_TOTAL_HEIGHT*.6,spawnPos.z+Math.sin(e)*5),velocity:new THREE.Vector3(Math.cos(e)*s,u,Math.sin(e)*s),rotation:Math.random()*Math.PI*2,rotationSpeed:r,startTime:n,endTime:n+l});}
function _updateHitSparks(deltaTime) { /* ... (keep implementation) ... */ if(!hitSparkSystem||!clock)return;const p=hitSparkSystem.geometry.attributes.position.array,c=hitSparkSystem.geometry.attributes.color.array,a=hitSparkSystem.geometry.attributes.alpha.array,d=hitSparkSystem.data;let n=!1,v=0;for(let i=0;i<MAX_HIT_SPARKS;i++){const S=d[i];if(S.l>0){S.l-=deltaTime;v++;if(S.l<=0)a[i]=0,p[i*3+1]=-1e4;else{S.v.y-=HIT_SPARK_GRAVITY*deltaTime;S.p.addScaledVector(S.v,deltaTime);S.a=Math.min(1,Math.max(0,S.l/(HIT_SPARK_BASE_LIFE+HIT_SPARK_RAND_LIFE)*1.5));a[i]=S.a;p[i*3+0]=S.p.x;p[i*3+1]=S.p.y;p[i*3+2]=S.p.z;c[i*3+0]=S.c.r;c[i*3+1]=S.c.g;c[i*3+2]=S.c.b}n=!0}else if(a[i]>0)a[i]=0,p[i*3+1]=-1e4,n=!0}if(n){hitSparkSystem.geometry.attributes.position.needsUpdate=!0;hitSparkSystem.geometry.attributes.color.needsUpdate=!0;hitSparkSystem.geometry.attributes.alpha.needsUpdate=!0}hitSparkSystem.particles.visible=v>0;}
function _triggerHitSparks(position, count = 5) { /* ... (keep implementation) ... */ if(!hitSparkSystem||!clock)return;const d=hitSparkSystem.data;let s=0;for(let i=0;i<MAX_HIT_SPARKS&&s<count;i++)if(d[i].l<=0){const p=d[i];p.p.copy(position);const a=Math.random()*Math.PI*2,g=(Math.random()-.5)*Math.PI*.6,t=HIT_SPARK_INITIAL_VEL+Math.random()*HIT_SPARK_SPREAD;p.v.set(Math.cos(a)*Math.cos(g)*t,Math.sin(g)*t*1.5+30,Math.sin(a)*Math.cos(g)*t);p.c.setRGB(1,.2+Math.random()*.3,0);p.a=1;p.l=HIT_SPARK_BASE_LIFE+Math.random()*HIT_SPARK_RAND_LIFE;s++}if(s>0)hitSparkSystem.particles.visible=!0;}
function _updateRain(deltaTime) { /* ... (keep implementation) ... */ if(!rainSystem||!rainSystem.lines.visible)return;const p=rainSystem.geometry.attributes.position.array,d=rainSystem.data;let n=!1;const cW=currentCanvasWidth*GROUND_MARGIN,cH=currentCanvasHeight*GROUND_MARGIN,wO=currentCanvasWidth*(GROUND_MARGIN-1)/2,hO=currentCanvasHeight*(GROUND_MARGIN-1)/2;for(let i=0;i<MAX_RAIN_DROPS;i++){const R=d[i];R.y+=R.s*deltaTime;if(R.y<-50){R.x=Math.random()*cW-wO;R.y=Math.random()*500+1e3;R.z=Math.random()*cH-hO;R.s=RAIN_SPEED_Y+Math.random()*RAIN_SPEED_Y_RAND}const x=i*6;p[x+0]=R.x;p[x+1]=R.y;p[x+2]=R.z;p[x+3]=R.x;p[x+4]=R.y-RAIN_STREAK_LENGTH;p[x+5]=R.z;n=!0}if(n)rainSystem.geometry.attributes.position.needsUpdate=!0;}
function _updateDust(deltaTime) { /* ... (keep implementation) ... */ if(!dustSystem||!dustSystem.particles.visible||!camera)return;const p=dustSystem.geometry.attributes.position.array,d=dustSystem.data;let n=!1;const wW=currentCanvasWidth*GROUND_MARGIN,wH=currentCanvasHeight*GROUND_MARGIN,hW=currentCanvasWidth/2,hH=currentCanvasHeight/2,mW=currentCanvasWidth*(GROUND_MARGIN-1)/2,mH=currentCanvasHeight*(GROUND_MARGIN-1)/2;for(let i=0;i<MAX_DUST_MOTES;i++){const D=d[i];D.p.addScaledVector(D.v,deltaTime);if(D.p.x<hW-mW)D.p.x+=wW;else if(D.p.x>hW+wW-mW)D.p.x-=wW;if(D.p.z<hH-mH)D.p.z+=wH;else if(D.p.z>hH+wH-mH)D.p.z-=wH;D.p.y+=(Math.random()-.5)*DUST_SPEED_Y*deltaTime;D.p.y=Math.max(5,Math.min(80,D.p.y));p[i*3+0]=D.p.x;p[i*3+1]=D.p.y;p[i*3+2]=D.p.z;n=!0}if(n)dustSystem.geometry.attributes.position.needsUpdate=!0;}
function _updateCampfire(deltaTime) { /* ... (keep implementation) ... */ if(!campfireSystem||!campfireSystem.group.visible||!clock)return;const p=campfireSystem.geometry.attributes.position.array,c=campfireSystem.geometry.attributes.color.array,a=campfireSystem.geometry.attributes.alpha.array,d=campfireSystem.data;let g=!1,v=0;const s=150,N=Math.floor(s*deltaTime*(.5+Math.random()));let w=0;for(let i=0;i<MAX_FLAME_PARTICLES&&w<N;i++)if(d[i].l<=0){const P=d[i],A=Math.random()*Math.PI*2,r=Math.random()*CAMPFIRE_BASE_RADIUS;P.p.set(Math.cos(A)*r,Y_OFFSET_CAMPFIRE+2,Math.sin(A)*r);P.v.set((Math.random()-.5)*FLAME_VEL_SPREAD,FLAME_VEL_Y+Math.random()*30,(Math.random()-.5)*FLAME_VEL_SPREAD);P.l=P.bl;P.a=.7+Math.random()*.3;P.c.setHSL(.07+Math.random()*.06,1,.6+Math.random()*.1);w++}for(let i=0;i<MAX_FLAME_PARTICLES;i++){const P=d[i];if(P.l>0){P.l-=deltaTime;v++;if(P.l<=0)a[i]=0,p[i*3+1]=-1e4;else{P.v.y+=(Math.random()-.4)*20*deltaTime;P.v.x*=.97;P.v.z*=.97;P.p.addScaledVector(P.v,deltaTime);P.a=Math.max(0,P.l/P.bl*1.2);P.c.lerp(_color.setRGB(1,.1,0),deltaTime*1.5);a[i]=P.a;p[i*3+0]=P.p.x;p[i*3+1]=P.p.y;p[i*3+2]=P.p.z;c[i*3+0]=P.c.r;c[i*3+1]=P.c.g;c[i*3+2]=P.c.b}g=!0}else if(a[i]>0)a[i]=0,p[i*3+1]=-1e4,g=!0}if(g){campfireSystem.geometry.attributes.position.needsUpdate=!0;campfireSystem.geometry.attributes.color.needsUpdate=!0;campfireSystem.geometry.attributes.alpha.needsUpdate=!0}if(campfireSystem.glowLight)campfireSystem.glowLight.intensity=2.5+Math.sin(clock.elapsedTime*3)*.8;if(campfireSystem.group&&window.appState?.serverState?.campfire){const f=window.appState.serverState.campfire;campfireSystem.group.position.set(f.x,0,f.y);campfireSystem.group.visible=f.active;campfireSystem.particles.visible=f.active}else if(campfireSystem.group)campfireSystem.group.visible=!1,campfireSystem.particles.visible=!1;}
function _updateSnake(snakeData) { /* ... (keep implementation) ... */ if(!snakeMesh)return;const i=snakeData?.active??!1;snakeMesh.visible=i;if(i&&snakeData.segments&&snakeData.segments.length>1){const p=snakeData.segments.map(s=>_vector3.set(s.x,Y_OFFSET_SNAKE,s.y));if(p.length>=2)try{const c=new THREE.CatmullRomCurve3(p,!1,'catmullrom',.1),t=c.getPoints(SNAKE_VISUAL_SEGMENTS*2);if(t.length>=2){const n=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(t),t.length-1,SNAKE_RADIUS,6,!1);snakeMesh.geometry.dispose();snakeMesh.geometry=n;snakeMesh.visible=!0}else snakeMesh.visible=!1}catch(e){console.error("Renderer Error updating snake geometry:",e);snakeMesh.visible=!1}}else snakeMesh.visible=!1;}
function _updateEnvironment(isNight, isRaining, isDustStorm) { /* ... (keep implementation) ... */ if(!scene||!ambientLight||!directionalLight||!groundPlane||!clock)return;const dAI=.7,nAI=.45,dDI=1.2,nDI=.7,dAC=16777215,nAC=7372960,dDC=16777215,nDC=10532095,dFC=12639424,dFD=.0003,nFC=263690,nFD=.0008,dstFC=11571312,dstFD=.0015;const tAI=isNight?nAI:dAI,tDI=isNight?nDI:dDI,tAC=isNight?nAC:dAC,tDC=isNight?nDC:dDC,tGM=isNight?sharedMaterials.groundNight:sharedMaterials.groundDay;let tFD,tFC;if(isDustStorm)tFD=dstFD,tFC=dstFC;else if(isNight)tFD=nFD,tFC=nFC;else tFD=dFD,tFC=dFC;const lA=.05;ambientLight.intensity=lerp(ambientLight.intensity,tAI,lA);directionalLight.intensity=lerp(directionalLight.intensity,tDI,lA);ambientLight.color.lerp(_color.setHex(tAC),lA);directionalLight.color.lerp(_color.setHex(tDC),lA);if(groundPlane.material!==tGM)groundPlane.material=tGM;if(!scene.fog)scene.fog=new THREE.FogExp2(tFC,tFD);else{scene.fog.color.lerp(_color.setHex(tFC),lA);scene.fog.density=lerp(scene.fog.density,tFD,lA)}if(!scene.background||!(scene.background instanceof THREE.Color))scene.background=new THREE.Color;scene.background.lerp(_color.setHex(tFC),lA);if(rainSystem?.lines)rainSystem.lines.visible=isRaining;if(dustSystem?.particles)dustSystem.particles.visible=isDustStorm;}
function _updateMuzzleFlash(localEffects, playerGroup) { /* ... (keep implementation) ... */ if(!muzzleFlashLight||!clock)return;const f=localEffects?.muzzleFlash,n=clock.elapsedTime*1e3;if(f?.active&&n<f.endTime&&playerGroup){muzzleFlashLight.intensity=5+Math.random()*4;const g=playerGroup.userData.gunMesh;if(g)_vector3.set(0,0,PLAYER_GUN_LENGTH/2+5),g.localToWorld(_vector3),muzzleFlashLight.position.copy(_vector3);else muzzleFlashLight.intensity=0}else{muzzleFlashLight.intensity=0;if(f)f.active=!1}}
function _projectToScreen(worldPosition) { /* ... (keep implementation) ... */ if(!camera||!renderer?.domElement||!domContainer)return null;try{_vector3.copy(worldPosition);_vector3.project(camera);const r=domContainer.getBoundingClientRect(),w=r.width/2,h=r.height/2,sX=Math.round(_vector3.x*w+w),sY=Math.round(-(_vector3.y*h)+h);if(_vector3.z>1)return null;return{screenX:sX,screenY:sY}}catch(e){return null}}


// --- NEW Camera Update Logic ---
/**
 * Updates camera position to follow the target (player or map center)
 * and applies screen shake.
 * @param {number} deltaTime Time since last frame.
 * @param {THREE.Group | null} localPlayerGroup The group object of the local player, or null.
 */
function _updateCamera(deltaTime, localPlayerGroup) {
    if (!camera || !clock) return;

    // 1. Determine Target Position
    let targetX, targetZ;
    if (localPlayerGroup && localPlayerGroup.visible) {
        // Follow player if available and visible
        targetX = localPlayerGroup.position.x;
        targetZ = localPlayerGroup.position.z;
    } else {
        // Fallback: Center on the middle of the current canvas dimensions
        targetX = currentCanvasWidth / 2;
        targetZ = currentCanvasHeight / 2;
    }
    _cameraTargetWorldPos.set(targetX, 0, targetZ); // Target is on the ground plane

    // 2. Calculate Desired Camera Position (Above and behind target)
    _cameraDesiredPos.set(
        targetX,
        CAMERA_HEIGHT_OFFSET,
        targetZ + CAMERA_DISTANCE_OFFSET
    );

    // 3. Smoothly Interpolate Camera Position
    camera.position.lerp(_cameraDesiredPos, CAMERA_LERP_FACTOR);

    // 4. Apply Screen Shake (if active)
    const nowMs = clock.elapsedTime * 1000;
    if (shakeMagnitude > 0 && nowMs < shakeEndTime) {
        const timeRemaining = shakeEndTime - nowMs;
        const totalDuration = shakeEndTime - (nowMs - deltaTime * 1000);
        const decayFactor = totalDuration > 0 ? Math.pow(Math.max(0, timeRemaining / totalDuration), 2) : 0;
        const currentMag = shakeMagnitude * decayFactor;
        const shakeAngle = Math.random() * Math.PI * 2;
        screenShakeOffset.set(
            Math.cos(shakeAngle) * currentMag,
            (Math.random() - 0.5) * currentMag * 0.5,
            Math.sin(shakeAngle) * currentMag
        );
        camera.position.add(screenShakeOffset);
    } else {
        shakeMagnitude = 0; // Reset shake
    }

    // 5. Set LookAt Target
    camera.lookAt(_cameraTargetWorldPos); // Always look at the target ground position

    // --- DEBUG LOG ---
    // console.log(`UpdateCamera - Target: (${targetX.toFixed(0)}, ${targetZ.toFixed(0)}), DesiredCam: (${_cameraDesiredPos.x.toFixed(0)}, ${_cameraDesiredPos.z.toFixed(0)}), ActualCam: (${camera.position.x.toFixed(0)}, ${camera.position.z.toFixed(0)})`);
}


// --- Public API ---
const Renderer3D = {
    init: (containerElement, initialWidth, initialHeight) => {
        console.log("--- Renderer3D.init() ---");
        if (!containerElement) { console.error("Renderer Init Failed: Container element required."); return false; }
        domContainer = containerElement;

        // Set initial dimensions (will be overridden by first resize)
        currentCanvasWidth = initialWidth || DEFAULT_GAME_WIDTH;
        currentCanvasHeight = initialHeight || DEFAULT_GAME_HEIGHT;

        try {
            // 1. Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            domContainer.appendChild(renderer.domElement);

            // 2. Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a2a28);

            // 3. Camera
            // Start with default aspect, resize will correct
            camera = new THREE.PerspectiveCamera(CAMERA_FOV, DEFAULT_GAME_WIDTH / DEFAULT_GAME_HEIGHT, CAMERA_NEAR, CAMERA_FAR);
            // Set initial position (will snap/lerp to correct target later)
            // NOTE: Using map center initially, _updateCamera will take over
            const initialTargetX = currentCanvasWidth / 2;
            const initialTargetZ = currentCanvasHeight / 2;
            camera.position.set(initialTargetX, CAMERA_HEIGHT_OFFSET, initialTargetZ + CAMERA_DISTANCE_OFFSET);
            // camera.rotation.x = CAMERA_ANGLE; // Setting rotation directly is less reliable than lookAt
            camera.lookAt(initialTargetX, 0, initialTargetZ); // Look at initial center
            scene.add(camera);

            // 4. Lighting (Keep as before)
            ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
            directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(currentCanvasWidth * 0.3, 400, currentCanvasHeight * 0.4); // Use current dim for positioning
            directionalLight.castShadow = true; directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.bias = -0.002;
            directionalLight.target.position.set(initialTargetX, 0, initialTargetZ); // Initial target
            scene.add(directionalLight); scene.add(directionalLight.target);
            muzzleFlashLight = new THREE.PointLight(0xffcc66, 0, 150, 1.8); muzzleFlashLight.castShadow = false; scene.add(muzzleFlashLight);


            // 5. Assets, Geometries, Materials
            _createAssets(); _createGeometries(); _createMaterials();

            // 6. Ground Plane
            groundPlane = new THREE.Mesh(sharedGeometries.groundPlane, sharedMaterials.groundDay);
            groundPlane.rotation.x = -Math.PI / 2; groundPlane.receiveShadow = true; groundPlane.name = "GroundPlane";
            scene.add(groundPlane); // Scale/Position set in resize

            // 7. Particles, Instances, Systems
            _initParticlesAndInstances(); _initCampfire(); _initSnake();

            // 8. Clock
            clock = new THREE.Clock();

            // 9. Initial Resize and setup
            Renderer3D.handleContainerResize(); // Set correct initial size, aspect, etc.
            setTimeout(() => Renderer3D.handleContainerResize(), 150); // Catch layout shifts


        } catch (error) { console.error("Renderer Init Error:", error); Renderer3D.cleanup(); return false; }
        console.log("--- Renderer3D initialization complete ---");
        return true;
    },

    handleContainerResize: () => {
        if (!renderer || !camera || !domContainer) return;
        const newWidth = domContainer.clientWidth;
        const newHeight = domContainer.clientHeight;
        if (newWidth <= 0 || newHeight <= 0) return;

        // --- 1. Update Current Dimensions ---
        currentCanvasWidth = newWidth;
        currentCanvasHeight = newHeight;

        // --- 2. Update Renderer & Camera Projection ---
        renderer.setSize(newWidth, newHeight);
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        camera.clearViewOffset(); // Ensure no offset is applied

        // --- 3. Update Viewport & Scissor ---
        renderer.setViewport(0, 0, newWidth, newHeight);
        renderer.setScissor(0, 0, newWidth, newHeight);
        renderer.setScissorTest(true);

        // --- 4. Update World Elements Dependent on Dimensions ---
        if (groundPlane) {
            groundPlane.scale.set(currentCanvasWidth * GROUND_MARGIN, currentCanvasHeight * GROUND_MARGIN, 1);
            groundPlane.position.set(currentCanvasWidth / 2, 0, currentCanvasHeight / 2); // Recenter
        }
        if (directionalLight?.target) {
            directionalLight.target.position.set(currentCanvasWidth / 2, 0, currentCanvasHeight / 2); // Update light target
        }
        if (directionalLight?.shadow?.camera) { // Update shadow frustum
            const shadowCamSizeX = currentCanvasWidth * GROUND_MARGIN * 0.55;
            const shadowCamSizeZ = currentCanvasHeight * GROUND_MARGIN * 0.55;
            directionalLight.shadow.camera.left = -shadowCamSizeX;
            directionalLight.shadow.camera.right = shadowCamSizeX;
            directionalLight.shadow.camera.top = shadowCamSizeZ;
            directionalLight.shadow.camera.bottom = -shadowCamSizeZ;
            directionalLight.shadow.camera.updateProjectionMatrix();
        }
        // NOTE: cameraTargetPos is NO LONGER used for static centering.
        // The target is now dynamic (player or fallback map center).

        // --- DEBUG LOG ---
        console.log(`>>> Resize Handled - Canvas W: ${currentCanvasWidth.toFixed(0)}, H: ${currentCanvasHeight.toFixed(0)}`);

         // --- Update AppState ---
         if (window.appState) {
            window.appState.canvasWidth = currentCanvasWidth;
            window.appState.canvasHeight = currentCanvasHeight;
        }
    },

    renderScene: (stateToRender, appState, localEffects) => {
        if (!renderer || !scene || !camera || !stateToRender || !appState || !localEffects || !clock) { return; }
        const deltaTime = clock.getDelta();

        // --- 1. Get Local Player Group ---
        const localPlayerGroup = appState.localPlayerId ? playerGroupMap[appState.localPlayerId] : null;

        // --- 2. Update Camera ---
        _updateCamera(deltaTime, localPlayerGroup); // Pass player group

        // --- 3. Update Environment ---
        _updateEnvironment(stateToRender.is_night, stateToRender.is_raining, stateToRender.is_dust_storm);

        // --- 4. Sync Scene Objects ---
        _syncSceneObjects(stateToRender.players, playerGroupMap, _createPlayerGroup, _updatePlayerGroup, (id) => id === appState.localPlayerId);
        _syncSceneObjects(stateToRender.enemies, enemyGroupMap, _createEnemyGroup, _updateEnemyGroup);
        _syncSceneObjects(stateToRender.powerups, powerupGroupMap, _createPowerupGroup, _updatePowerupGroup);

        // --- 5. Update Instances & Particles ---
        _updateInstancedMesh(playerBulletMesh, playerBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateInstancedMesh(enemyBulletMesh, enemyBulletMatrices, stateToRender.bullets, Y_OFFSET_BULLET, true);
        _updateActiveCasings(deltaTime);
        _updateHitSparks(deltaTime);
        _updateRain(deltaTime);
        _updateDust(deltaTime);
        _updateCampfire(deltaTime);
        _updateSnake(localEffects.snake);

        // --- 6. Update Effects ---
        _updateMuzzleFlash(localEffects, localPlayerGroup); // Pass player group

        // --- 7. Calculate UI Positions ---
        const uiPositions = {};
        const projectEntity = (objMap, stateMap, yOffsetFn) => { /* ... (keep implementation) ... */ for(const id in objMap){const o=objMap[id],d=stateMap?.[id];if(o?.visible&&d){const w=o.position.clone();w.y=yOffsetFn(d,o);const s=_projectToScreen(w);if(s)uiPositions[id]=s}}} };
        const getPlayerHeadY = (d,g) => g.userData?.headMesh?.position.y+PLAYER_HEAD_RADIUS*1.5||PLAYER_TOTAL_HEIGHT;
        const getEnemyHeadY = (d,g) => g.userData?.headMesh?.position.y+(d.type==='giant'?ENEMY_HEAD_RADIUS*ENEMY_GIANT_MULTIPLIER:ENEMY_HEAD_RADIUS)*1.2||ENEMY_CHASER_HEIGHT;
        const getPowerupTopY = (d,g) => g.userData?.iconMesh?.position.y+POWERUP_BASE_SIZE*.5||Y_OFFSET_POWERUP;
        projectEntity(playerGroupMap, stateToRender.players, getPlayerHeadY);
        projectEntity(enemyGroupMap, stateToRender.enemies, getEnemyHeadY);
        projectEntity(powerupGroupMap, stateToRender.powerups, getPowerupTopY);
        if (stateToRender.damage_texts) { for(const id in stateToRender.damage_texts){const dt=stateToRender.damage_texts[id],w=_vector3.set(dt.x,PLAYER_TOTAL_HEIGHT*.8,dt.y),s=_projectToScreen(w);if(s)uiPositions[id]=s} }
        appState.uiPositions = uiPositions;

        // --- 8. Render ---
        try {
            renderer.setScissorTest(true);
            renderer.render(scene, camera);
        } catch (e) { console.error("!!! RENDER ERROR !!!", e); if (window.appState?.animationFrameId) { cancelAnimationFrame(window.appState.animationFrameId); window.appState.animationFrameId = null; console.error("!!! Animation loop stopped due to render error. !!!"); } }
    },

    // --- Effects Triggers (Keep as before) ---
    triggerShake: (magnitude, durationMs) => { /* ... (keep implementation) ... */ if(!clock)return;const n=clock.elapsedTime*1e3,e=n+durationMs;if(magnitude>=shakeMagnitude||e>shakeEndTime)shakeMagnitude=Math.max(.1,magnitude),shakeEndTime=Math.max(n,e)},
    spawnVisualAmmoCasing: (position, ejectVector) => { /* ... (keep implementation) ... */ if(!clock)return;_spawnAmmoCasing(position,ejectVector)},
    triggerVisualHitSparks: (position, count = 5) => { /* ... (keep implementation) ... */ if(!clock)return;_triggerHitSparks(position,count)},
    projectToScreen: (worldPosition) => { /* ... (keep implementation) ... */ return _projectToScreen(worldPosition)},

    // --- Cleanup (Keep as before, incl. robustness fix) ---
    cleanup: () => { /* ... (keep implementation) ... */ console.log("--- Renderer3D Cleanup ---");[hitSparkSystem,rainSystem,dustSystem,campfireSystem].forEach(s=>{if(s){if(s.particles)scene?.remove(s.particles);if(s.lines)scene?.remove(s.lines);if(s.group)scene?.remove(s.group);s.geometry?.dispose();_disposeMaterialTextures(s.material);s.material?.dispose()}});hitSparkSystem=null;rainSystem=null;dustSystem=null;campfireSystem=null;[playerBulletMesh,enemyBulletMesh,ammoCasingMesh].forEach(m=>{if(m){scene?.remove(m);m.geometry?.dispose()}});playerBulletMesh=null;enemyBulletMesh=null;ammoCasingMesh=null;if(snakeMesh){scene?.remove(snakeMesh);snakeMesh.geometry?.dispose();snakeMesh=null}[playerGroupMap,enemyGroupMap,powerupGroupMap].forEach(o=>{for(const id in o)_disposeAndRemoveObject(o[id],id,o)});Object.values(sharedGeometries).forEach(g=>g?.dispose());Object.values(powerupGeometries).forEach(g=>g?.dispose());Object.values(sharedMaterials).forEach(m=>{if(m instanceof THREE.Material)_disposeMaterialTextures(m),m.dispose()});if(sharedMaterials.powerups)Object.values(sharedMaterials.powerups).forEach(m=>{if(m instanceof THREE.Material)_disposeMaterialTextures(m),m.dispose()});Object.values(loadedAssets).forEach(a=>a?.dispose());Object.keys(sharedGeometries).forEach(k=>delete sharedGeometries[k]);Object.keys(sharedMaterials).forEach(k=>{if(k!=='powerups')delete sharedMaterials[k];else delete sharedMaterials.powerups});Object.keys(powerupGeometries).forEach(k=>delete powerupGeometries[k]);Object.keys(loadedAssets).forEach(k=>delete loadedAssets[k]);if(groundPlane){scene?.remove(groundPlane);_disposeObject3D(groundPlane);groundPlane=null}if(scene){if(ambientLight)scene.remove(ambientLight);if(directionalLight)scene.remove(directionalLight);if(directionalLight?.target)scene.remove(directionalLight.target);if(muzzleFlashLight)scene.remove(muzzleFlashLight)}ambientLight=null;directionalLight=null;muzzleFlashLight=null;if(renderer){console.log("Renderer: Disposing WebGL context...");renderer.dispose();if(renderer.domElement?.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);renderer=null;console.log("Renderer disposed.")}scene=null;camera=null;clock=null;domContainer=null;playerBulletMatrices=[];enemyBulletMatrices=[];activeAmmoCasings=[];shakeMagnitude=0;shakeEndTime=0;console.log("Renderer3D resources released."); },

    // --- Getters (Keep as before) ---
    getCamera: () => camera,
    getGroundPlane: () => groundPlane,
    getScene: () => scene,
};

export default Renderer3D;
