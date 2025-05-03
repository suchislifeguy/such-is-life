// Renderer3D.js - DEBUG VERSION (Simple Cube Test - Corrected groundPlane Scope)
import * as THREE from 'three';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing DEBUG CUBE TEST ---");

    let scene, camera, renderer, ambientLight;
    let gameWidth = 1600, gameHeight = 900;
    let testCube = null;
    let groundPlane = null; // <<< Declare groundPlane in the module scope >>>

    // --- Initialization ---
    function init(containerElement) {
        console.log("--- Renderer3D.init() DEBUG CUBE TEST ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(gameWidth, gameHeight);
        containerElement.appendChild(renderer.domElement);
        console.log("Debug: Renderer created.");

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x444444);
        console.log("Debug: Scene created.");

        const aspect = gameWidth / gameHeight;
        const frustumHeight = gameHeight * 1.1;
        camera = new THREE.OrthographicCamera( frustumHeight * aspect / -2, frustumHeight * aspect / 2, frustumHeight / 2, frustumHeight / -2, -1000, 2000 );
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        camera.rotation.order = 'YXZ'; camera.rotation.x = -Math.PI / 2; camera.rotation.y = 0; camera.rotation.z = 0;
        camera.lookAt(gameWidth / 2, 0, gameHeight / 2);
        camera.updateProjectionMatrix();
        scene.add(camera);
        console.log(`Debug: Camera created. Pos: ${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)} RotX: ${camera.rotation.x.toFixed(2)}`);
        console.log(`Debug: Camera Frustum: L:${camera.left.toFixed(1)} R:${camera.right.toFixed(1)} T:${camera.top.toFixed(1)} B:${camera.bottom.toFixed(1)} N:${camera.near.toFixed(1)} F:${camera.far.toFixed(1)}`);

        ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);
        console.log("Debug: Minimal ambient light added.");

        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth, gameHeight); groundGeometryPlane.name = "GroundDebugGeo"; // Add name for debugging
        const groundMaterialBasic = new THREE.MeshBasicMaterial({ color: 0x006400, side: THREE.DoubleSide, name: "GroundDebugMat" });
        // Now correctly assigns to the module-scoped groundPlane
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundMaterialBasic);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2);
        groundPlane.name = "DebugGroundPlane"; // Add name for debugging
        scene.add(groundPlane);
        console.log("Debug: Ground plane added.");

        const cubeGeometry = new THREE.BoxGeometry(50, 50, 50); cubeGeometry.name = "TestCubeGeo";
        const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, name: "TestCubeMat" });
        testCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        testCube.position.set(gameWidth / 2, 25, gameHeight / 2);
        testCube.name = "DebugTestCube"; // Add name for debugging
        scene.add(testCube);
        console.log(`Debug: Test Cube added at Pos: ${testCube.position.x},${testCube.position.y},${testCube.position.z}`);

        window.addEventListener('resize', handleResize);
        handleResize();

        console.log("--- Renderer3D DEBUG initialization complete ---");
        return true;
    }

    function handleResize() {
        // Ensure renderer and camera exist before proceeding
        if (!renderer || !camera) return;

        // Reading module-level gameWidth/gameHeight (updated in renderScene later)
        renderer.setSize(gameWidth, gameHeight);
        const aspect = gameWidth / gameHeight;
        const frustumHeight = gameHeight * 1.1;
        camera.left = frustumHeight * aspect / - 2; camera.right = frustumHeight * aspect / 2;
        camera.top = frustumHeight / 2; camera.bottom = frustumHeight / - 2;
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        camera.lookAt(gameWidth / 2, 0, gameHeight / 2);
        camera.updateProjectionMatrix();
        console.log(`Debug: Renderer resized/camera updated to: ${gameWidth}x${gameHeight}`);
    }

    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera ) { return; }

        // Update internal dimensions from appState before doing anything else
        let dimensionsChanged = false;
        if (appState && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) {
             gameWidth = appState.canvasWidth;
             gameHeight = appState.canvasHeight;
             dimensionsChanged = true;
             console.log(`Debug: Renderer internal dimensions updated to: ${gameWidth}x${gameHeight}`);
        }
        // Handle resize immediately if dimensions changed
        if (dimensionsChanged) {
             handleResize();
        }


        if (testCube) { testCube.rotation.x += 0.01; testCube.rotation.y += 0.01; }

        try { renderer.render(scene, camera); }
        catch(e) { console.error("!!! RENDER ERROR !!!", e); if (typeof appState !== 'undefined' && appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; console.error("Stopped loop due to render error.");} }
    }

    function cleanup() {
        console.log("--- Renderer3D Cleanup DEBUG ---");
        window.removeEventListener('resize', handleResize);
        if(testCube) scene?.remove(testCube); if(groundPlane) scene?.remove(groundPlane);
        testCube?.geometry?.dispose(); testCube?.material?.dispose();
        groundPlane?.geometry?.dispose(); groundPlane?.material?.dispose(); // Use Optional Chaining ?.

        if (renderer) { renderer.dispose(); if (renderer.domElement?.parentNode) { renderer.domElement.parentNode.removeChild(renderer.domElement); } renderer = null; }
        scene = null; camera = null; groundPlane = null; ambientLight = null; testCube = null;
        console.log("Renderer3D DEBUG resources released.");
    }

    return { init, renderScene, cleanup };

})();

export default Renderer3D;
