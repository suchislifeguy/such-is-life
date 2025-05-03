// Renderer3D.js - DEBUG VERSION (Simple Cube Test)
import * as THREE from 'three';

const Renderer3D = (() => {
    console.log("--- Renderer3D.js: Initializing DEBUG CUBE TEST ---");

    let scene, camera, renderer, ambientLight; // Removed directional for simplicity now
    let gameWidth = 1600, gameHeight = 900;
    let testCube = null; // The cube we will add

    // --- Initialization ---
    function init(containerElement) {
        console.log("--- Renderer3D.init() DEBUG CUBE TEST ---");
        if (!containerElement) { console.error("Renderer3D init failed: No container."); return false; }

        // --- Renderer ---
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(gameWidth, gameHeight);
        // NO SHADOWS for this test
        // renderer.shadowMap.enabled = true;
        // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerElement.appendChild(renderer.domElement);
        console.log("Debug: Renderer created.");

        // --- Scene ---
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x444444); // Mid-grey background
        console.log("Debug: Scene created.");

        // --- Camera ---
        const aspect = gameWidth / gameHeight;
        // Make frustum slightly larger vertically to ensure things aren't clipped easily
        const frustumHeight = gameHeight * 1.1;
        camera = new THREE.OrthographicCamera(
            frustumHeight * aspect / -2, // left
            frustumHeight * aspect / 2,  // right
            frustumHeight / 2,           // top
            frustumHeight / -2,          // bottom
            -1000,                       // near - Allow objects behind camera origin slightly
            2000                       // far
        );
        // Position directly above the center of the intended game area
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        // Explicitly set rotation to look straight down Y-axis
        camera.rotation.order = 'YXZ'; // Ensure consistent rotation order
        camera.rotation.x = -Math.PI / 2;
        camera.rotation.y = 0;
        camera.rotation.z = 0;

        // Ensure camera looks at the center of the ground plane
        camera.lookAt(gameWidth / 2, 0, gameHeight / 2); // Look at the center point on the ground
        camera.updateProjectionMatrix(); // IMPORTANT after setting position/rotation/lookAt
        scene.add(camera);
        console.log(`Debug: Camera created. Pos: ${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)} RotX: ${camera.rotation.x.toFixed(2)}`);
        console.log(`Debug: Camera Frustum: L:${camera.left.toFixed(1)} R:${camera.right.toFixed(1)} T:${camera.top.toFixed(1)} B:${camera.bottom.toFixed(1)} N:${camera.near.toFixed(1)} F:${camera.far.toFixed(1)}`);

        // --- Lighting (Minimal) ---
        ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Bright ambient light
        scene.add(ambientLight);
        console.log("Debug: Minimal ambient light added.");
        // NO Directional Light for this test

        // --- Ground Plane (Basic Material) ---
        const groundGeometryPlane = new THREE.PlaneGeometry(gameWidth, gameHeight); // Exact size
        const groundMaterialBasic = new THREE.MeshBasicMaterial({ color: 0x006400, side: THREE.DoubleSide }); // Dark Green
        groundPlane = new THREE.Mesh(groundGeometryPlane, groundMaterialBasic);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(gameWidth / 2, 0, gameHeight / 2); // Center it
        // groundPlane.receiveShadow = false; // Not needed for basic material
        scene.add(groundPlane);
        console.log("Debug: Ground plane added.");

        // --- ADD TEST CUBE ---
        const cubeGeometry = new THREE.BoxGeometry(50, 50, 50);
        const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Bright Magenta
        testCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        // Position it clearly within the view, slightly above ground
        testCube.position.set(gameWidth / 2, 25, gameHeight / 2); // Centered, Y=25 (half height)
        scene.add(testCube);
        console.log(`Debug: Test Cube added at Pos: ${testCube.position.x},${testCube.position.y},${testCube.position.z}`);


        window.addEventListener('resize', handleResize);
        // Call handleResize once AFTER creating camera/setting initial dimensions
        handleResize();

        console.log("--- Renderer3D DEBUG initialization complete ---");
        return true;
    }

    function handleResize() {
        // Ensure internal dimensions are updated if appState has them
        // (This might happen after init if main.js updates appState later)
        // if (typeof appState !== 'undefined') { // Guard against appState not existing globally
        //     gameWidth = appState.canvasWidth || gameWidth;
        //     gameHeight = appState.canvasHeight || gameHeight;
        // }

        // Use module-level dimensions
        renderer.setSize(gameWidth, gameHeight);
        const aspect = gameWidth / gameHeight;
        const frustumHeight = gameHeight * 1.1; // Match init calculation
        camera.left = frustumHeight * aspect / - 2;
        camera.right = frustumHeight * aspect / 2;
        camera.top = frustumHeight / 2;
        camera.bottom = frustumHeight / - 2;
        // Re-center camera position based on current gameWidth/Height
        camera.position.set(gameWidth / 2, 1000, gameHeight / 2);
        // Ensure lookAt is also updated if position changes significantly relative to target
        camera.lookAt(gameWidth / 2, 0, gameHeight / 2);
        camera.updateProjectionMatrix();
        console.log(`Debug: Renderer resized/camera updated to: ${gameWidth}x${gameHeight}`);
    }

    // --- Main Render Function (Simplified for Debug) ---
    function renderScene(stateToRender, appState, localEffects) {
        if (!renderer || !scene || !camera ) {
            console.warn("Debug renderScene skipped: Renderer/Scene/Camera not ready.");
            return;
        }

        // VERY basic update: just rotate the test cube
        if (testCube) {
            testCube.rotation.x += 0.01;
            testCube.rotation.y += 0.01;
        }

        // Update internal dimensions from appState if available
        // (This ensures handleResize uses correct values if called later)
        if (appState && (gameWidth !== appState.canvasWidth || gameHeight !== appState.canvasHeight)) {
            gameWidth = appState.canvasWidth;
            gameHeight = appState.canvasHeight;
            handleResize(); // Update renderer/camera if dimensions changed
        }


        // ONLY Render the simplified scene
        try {
             renderer.render(scene, camera);
        } catch(e) {
            console.error("!!! ERROR DURING RENDER CALL !!!", e);
            // Potentially stop the loop here if render fails critically
            if (typeof appState !== 'undefined' && appState.animationFrameId) {
                 cancelAnimationFrame(appState.animationFrameId);
                 appState.animationFrameId = null;
                 console.error("Stopped game loop due to render error.");
            }
        }
    }

    // --- Cleanup (Simplified for Debug) ---
    function cleanup() {
        console.log("--- Renderer3D Cleanup DEBUG ---");
        window.removeEventListener('resize', handleResize);
        // Remove test objects
        if(testCube) scene?.remove(testCube);
        if(groundPlane) scene?.remove(groundPlane);
        testCube?.geometry?.dispose();
        testCube?.material?.dispose();
        groundPlane?.geometry?.dispose();
        groundPlane?.material?.dispose();

        if (renderer) {
            renderer.dispose();
            if (renderer.domElement?.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer = null;
        }
        scene = null; camera = null; groundPlane = null; ambientLight = null; testCube = null;
        console.log("Renderer3D DEBUG resources released.");
    }

    // Return minimal interface for debug
    return { init, renderScene, cleanup };

})();

export default Renderer3D;
