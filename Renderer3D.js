// Renderer3D.js - DEBUG Camera & Initial Objects
import * as THREE from 'three';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing DEBUG Camera/Objects ---");

    // --- Core THREE.js Components ---
    let scene, camera, renderer, ambientLight; // Use only ambient for this test
    let gameWidth = 1600, gameHeight = 900;

    // --- Game Object Representations ---
    const playerMeshes = {}; // Keep player mesh logic for testing spawning
    let groundPlane = null;

    // --- Internal Constants ---
    const DEF_PLAYER_WIDTH = 25; const DEF_PLAYER_HEIGHT = 48;

    // --- Materials (USE BASIC FOR TEST) ---
    const playerMaterialBasic = new THREE.MeshBasicMaterial({ color: 0xDC143C, name: 'PlayerMatBasic' });
    const groundMaterialBasic = new THREE.MeshBasicMaterial({ color: 0x006400, side: THREE.DoubleSide, name: 'GroundMatBasic' }); // Dark Green

    // --- Geometries ---
    const playerGeometry = new THREE.CapsuleGeometry(DEF_PLAYER_WIDTH / 2, DEF_PLAYER_HEIGHT - DEF_PLAYER_WIDTH, 4, 8); playerGeometry.name = "PlayerGeo";
    const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth, gameHeight); groundGeometryPlane.name = "GroundGeo"; // Use exact dimensions

    // --- Mesh Positioning Offsets ---
    const PLAYER_MESH_Y_OFFSET = DEF_PLAYER_HEIGHT / 2;

    // --- Initialization ---
    function init(containerElement, initialWidth, initialHeight) {
        console.log("--- Renderer3D.init() DEBUG Camera/Objects ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }
        gameWidth = initialWidth || 1600; gameHeight = initialHeight || 900;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(gameWidth, gameHeight);
        containerElement.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111); // Very dark grey background

        // --- Camera Setup ---
        const aspect = gameWidth / gameHeight;
        // ** CRITICAL: Ensure frustum size covers the game area **
        // Let's use gameHeight, but double-check calculations.
        const frustumHeight = gameHeight;
        // Orthographic camera: left, right, top, bottom, near, far
        camera = new THREE.OrthographicCamera(
            gameWidth / -2, // left should cover 0 to gameWidth
            gameWidth / 2,  // right
            gameHeight / 2, // top should cover 0 to gameHeight
            gameHeight / -2,// bottom
            1,              // near (Must be > 0)
            2000            // far (Ensure it's beyond camera Y pos)
        );

        // Position camera looking DOWN at the CENTER of the game area
        camera.position.set(gameWidth / 2, 1500, gameHeight / 2); // Centered X,Z; High Y
        camera.rotation.order = 'YXZ'; // Standard order
        camera.rotation.x = -Math.PI / 2; // Look straight down
        camera.rotation.y = 0;
        camera.rotation.z = 0;
        // camera.lookAt(gameWidth / 2, 0, gameHeight / 2); // lookAt can sometimes conflict with direct rotation, rely on rotation for now
        camera.updateProjectionMatrix(); // IMPORTANT!
        scene.add(camera);
        console.log(`Debug Init: Camera Pos: ${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)} RotX: ${camera.rotation.x.toFixed(2)}`);
        console.log(`Debug Init: Camera Frustum: L:${camera.left.toFixed(1)} R:${camera.right.toFixed(1)} T:${camera.top.toFixed(1)} B:${camera.bottom.toFixed(1)}`);

        // --- Lighting (Minimal) ---
        ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Extra bright ambient
        scene.add(ambientLight);
        console.log("Debug: Minimal ambient light added.");

        // --- Ground Plane ---
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundMaterialBasic);
        groundPlane.rotation.x = -Math.PI / 2; // Horizontal
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2); // Centered at Y=0
        groundPlane.name = "DebugGroundPlane";
        scene.add(groundPlane);
        console.log(`Debug: Ground plane added at Y=${groundPlane.position.y}.`);

        window.addEventListener('resize', handleResize);
        handleResize(); // Call once after setup

        console.log("--- Renderer3D DEBUG initialization complete ---");
        return true;
    }

    // --- Resize Handler (Adjust Camera View) ---
    function handleResize() {
        if (!renderer || !camera) return;
        renderer.setSize(gameWidth, gameHeight);
        const aspect = gameWidth / gameHeight;
        const frustumHeight = gameHeight; // Keep vertical size consistent
        camera.left = frustumHeight * aspect / -2; camera.right = frustumHeight * aspect / 2;
        camera.top = frustumHeight / 2; camera.bottom = frustumHeight / -2;
        // Re-center position
        camera.position.set(gameWidth / 2, 1500, gameHeight / 2);
        // Ensure rotation is still correct
        camera.rotation.x = -Math.PI / 2;
        camera.rotation.y = 0;
        camera.rotation.z = 0;
        // camera.lookAt(gameWidth / 2, 0, gameHeight / 2); // Re-apply lookAt if position changed
        camera.updateProjectionMatrix(); // Crucial after changing frustum or position/rotation
        console.log(`Debug Resize: Renderer: ${gameWidth}x${gameHeight}. Camera L/R/T/B: ${camera.left.toFixed(0)}/${camera.right.toFixed(0)}/${camera.top.toFixed(0)}/${camera.bottom.toFixed(0)}`);
    }

    // --- Entity Creation (Player Only for Test) ---
    function createPlayerMesh(playerData) {
        const m=new THREE.Mesh(playerGeometry,playerMaterialBasic); // Use basic material
        m.position.set(playerData.x, PLAYER_MESH_Y_OFFSET, playerData.y);
        m.userData.gameId=playerData.id;
        m.name = `Player_${playerData.id.substring(0,4)}`;
        console.log(`>>> DEBUG: Creating Player Mesh for ${m.name} at x:${playerData.x.toFixed(1)}, z:${playerData.y.toFixed(1)} (Y=${m.position.y.toFixed(1)})`);
        return m;
    }

    // --- Entity Update (Player Only for Test) ---
    function updateMeshes(state, meshDict, createFn, defaultYOffsetFn, localEffects, appState) {
        const activeIds = new Set();
        if (state) {
            for (const id in state) {
                const data = state[id]; if (typeof data.x !== 'number' || typeof data.y !== 'number') continue; activeIds.add(id);
                let mesh = meshDict[id];
                if (!mesh) {
                    mesh = createFn(data);
                    if (mesh) { meshDict[id] = mesh; scene.add(mesh); console.log(`>>> DEBUG: Added mesh ${mesh.name} to scene.`); }
                } else {
                    const yPos = defaultYOffsetFn(data);
                    mesh.position.set(data.x, yPos, data.y);
                    // Add player rotation update back for aiming test
                     if (meshDict === playerMeshes && id === appState?.localPlayerId) {
                        updatePlayerAiming(appState); // Update rotation
                    }
                }
            }
        }
        for (const id in meshDict) { if (!activeIds.has(id)) { const meshToRemove = meshDict[id]; if (meshToRemove) { scene.remove(meshToRemove); console.log(`>>> DEBUG: Removed mesh ${meshToRemove.name} from scene.`); if (meshToRemove.geometry) meshToRemove.geometry.dispose(); if (meshToRemove.material) meshToRemove.material.dispose(); } delete meshDict[id]; } }
    }

    // Player aiming update
     function updatePlayerAiming(appState) { if (!appState?.localPlayerId || !appState.localPlayerAimState) return; const playerMesh = playerMeshes[appState.localPlayerId]; if (playerMesh) { const aimDx = appState.localPlayerAimState.lastAimDx; const aimDy = appState.localPlayerAimState.lastAimDy; const angle = Math.atan2(aimDx, aimDy); playerMesh.rotation.y = angle; } }

    // Dummy get offset function
    function getYOffset(entityData) { return PLAYER_MESH_Y_OFFSET; } // Only players exist in this test

    // --- Screen Position Calculation (Needed for potential future UI debug) ---
    function getScreenPosition(worldPosition, cameraRef, rendererRef) { const vector=worldPosition.clone(); vector.project(cameraRef); const screenX=Math.round((vector.x+1)*rendererRef.domElement.width/2); const screenY=Math.round((-vector.y+1)*rendererRef.domElement.height/2); return{x:screenX,y:screenY}; }


    // --- Main Render Function (Simplified for Debug) ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera ) { console.warn("Render scene skipped: Components missing"); return; }
        if (!stateToRender || !appState) { console.warn("Render scene skipping: State missing"); return; } // Need appState for dimensions

        // Update internal dimensions from appState
        let dimensionsChanged = false;
        if (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight) {
             gameWidth = appState.canvasWidth; gameHeight = appState.canvasHeight;
             dimensionsChanged = true;
        }
        if (dimensionsChanged) handleResize(); // Update renderer/camera if needed

        // --- Update only Player Meshes for this test ---
        updateMeshes(stateToRender.players, playerMeshes, createPlayerMesh, getYOffset, localEffects, appState);

        // Log player mesh position right before render
        const localPlayerMesh = playerMeshes[appState.localPlayerId];
        if (localPlayerMesh) {
            console.log(`>>> DEBUG Render: Player Mesh Pos: x=${localPlayerMesh.position.x.toFixed(1)}, y=${localPlayerMesh.position.y.toFixed(1)}, z=${localPlayerMesh.position.z.toFixed(1)} Visible: ${localPlayerMesh.visible}`);
        } else {
             console.log(">>> DEBUG Render: Local player mesh not found in dictionary.");
        }
         console.log(`>>> DEBUG Render: Camera Pos: Y=${camera.position.y.toFixed(1)}`);


        try { renderer.render(scene, camera); }
        catch(e) { console.error("!!! RENDER ERROR !!!", e); if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; console.error("Stopped loop.");} }
    }

    // --- Cleanup ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup DEBUG ---");
        window.removeEventListener('resize', handleResize);
        // Clean up player meshes explicitly
        for (const id in playerMeshes) {
             const meshToRemove = playerMeshes[id];
             if (meshToRemove) {
                 scene?.remove(meshToRemove);
                 meshToRemove.geometry?.dispose();
                 meshToRemove.material?.dispose();
             }
             delete playerMeshes[id];
        }
        if(groundPlane) scene?.remove(groundPlane);
        groundPlane?.geometry?.dispose(); groundPlane?.material?.dispose();
        playerGeometry?.dispose(); // Dispose shared geometry
        playerMaterialBasic?.dispose(); groundMaterialBasic?.dispose(); // Dispose materials

        if (renderer) { renderer.dispose(); if (renderer.domElement?.parentNode) { renderer.domElement.parentNode.removeChild(renderer.domElement); } renderer = null; }
        scene = null; camera = null; groundPlane = null; ambientLight = null;
        console.log("Renderer3D DEBUG resources released.");
    }

    // Return minimal interface for debug
    return { init, renderScene, cleanup };

})();

export default Renderer3D;
