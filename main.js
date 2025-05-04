import * as THREE from 'three';
import Renderer3D from './Renderer3D.js'; // Still imports the existing renderer

console.log("--- main.js Rewrite: Initializing ---");

// --- Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
const SHOOT_COOLDOWN = 750; // Base cooldown in ms
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33; // Approx 30 times/sec
const RECONNECT_DELAY = 3500; // ms
const PLAYER_DEFAULTS = { width: 25, height: 48, max_health: 100, base_speed: 150 };
const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';
const DEFAULT_CANVAS_WIDTH = 1600; // Default, server state overrides
const DEFAULT_CANVAS_HEIGHT = 900; // Default, server state overrides
const SNAKE_BITE_DURATION = 8.0; // Seconds, used for client-side effect checks
const SPEECH_BUBBLE_DURATION_MS = 4000;
const ENEMY_SPEECH_BUBBLE_DURATION_MS = 3000;
const PUSHBACK_ANIM_DURATION = 250; // ms
const MUZZLE_FLASH_DURATION = 75; // ms
const CASING_LIFETIME_BASE_MS = 500;
const CASING_LIFETIME_RANDOM_MS = 300;
const MAX_CASED_AMMO = 50;
const INTERPOLATION_BUFFER_MS = 100;

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { return start + (end - start) * amount; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }

// --- DOM References (Matching New HTML) ---
const DOM = {
    loadingScreen: document.getElementById('loading-screen'),
    gameContainer: document.getElementById('game-container'),
    topBar: document.getElementById('top-bar'),
    gameStatus: document.getElementById('game-status'),
    menuArea: document.getElementById('menu-area'),
    mainMenuSection: document.getElementById('main-menu-section'),
    multiplayerMenuSection: document.getElementById('multiplayer-menu-section'),
    hostWaitSection: document.getElementById('host-wait-section'),
    joinCodeSection: document.getElementById('join-code-section'),
    gameArea: document.getElementById('game-area'), // The flex container for panel + canvas
    leftPanel: document.getElementById('left-panel'),
    playerStatsGrid: document.getElementById('player-stats-grid'),
    dayNightIndicator: document.getElementById('day-night-indicator'),
    temperatureIndicator: document.getElementById('temperature-indicator'),
    chatArea: document.getElementById('chat-area'),
    chatLog: document.getElementById('chat-log'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    gameControls: document.getElementById('game-controls'),
    muteBtn: document.getElementById('muteBtn'),
    leaveGameBtn: document.getElementById('leaveGameBtn'),
    canvasWrapper: document.getElementById('canvas-wrapper'), // Wrapper div
    gameCanvas: document.getElementById('gameCanvas'),      // The actual canvas
    countdownOverlay: document.getElementById('countdown-overlay'),
    htmlOverlay: document.getElementById('html-overlay'),   // Container for dynamic elements
    gameOverScreen: document.getElementById('game-over-screen'),
    finalStats: document.getElementById('final-stats'),
    // Buttons
    singlePlayerBtn: document.getElementById('singlePlayerBtn'),
    multiplayerBtn: document.getElementById('multiplayerBtn'),
    hostGameBtn2: document.getElementById('hostGameBtn2'),
    hostGameBtn3: document.getElementById('hostGameBtn3'),
    hostGameBtn4: document.getElementById('hostGameBtn4'),
    showJoinUIBtn: document.getElementById('showJoinUIBtn'),
    cancelHostBtn: document.getElementById('cancelHostBtn'),
    gameCodeDisplay: document.getElementById('game-code-display'),
    waitingMessage: document.getElementById('waiting-message'),
    gameIdInput: document.getElementById('gameIdInput'),
    joinGameSubmitBtn: document.getElementById('joinGameSubmitBtn'),
    gameOverBackBtn: document.getElementById('gameOverBackBtn'),
};

// --- Global Client State ---
let appState = {
    mode: 'menu', // 'menu', 'singleplayer', 'multiplayer-host', 'multiplayer-client'
    localPlayerId: null,
    currentGameId: null,
    maxPlayersInGame: null,
    serverState: null, // Latest full state from server
    lastServerState: null, // Previous full state for interpolation
    lastStateReceiveTime: performance.now(),
    animationFrameId: null,
    isConnected: false,
    isGameLoopRunning: false,
    // Player position state
    renderedPlayerPos: { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 }, // Smoothed position for rendering
    predictedPlayerPos: { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 }, // Position based on local input prediction
    // Canvas dimensions (updated from server)
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    // Input & Aiming
    mouseWorldPosition: new THREE.Vector3(0, 0, 0), // World coords of cursor on ground plane
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, // Last calculated aim direction
    // UI State
    uiPositions: {}, // Screen coordinates for entities { entityId: { screenX, screenY } }
    // Environment
    currentTemp: 18.0,
    isRaining: false,
    isDustStorm: false,
    isNight: false,
};

// --- Local Effects State (Client-Side Only Visuals) ---
let localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
let localPlayerPushbackAnim = { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION };
let activeSpeechBubbles = {}; // { entityId: { text: string, endTime: number } }
let activeEnemyBubbles = {}; // { entityId: { text: string, endTime: number } }
let activeAmmoCasings = []; // { id, x, y, vx, vy, rotation, rotationSpeed, spawnTime, lifetime, gravity, ... }
let activeBloodSparkEffects = {}; // { enemyId: effectEndTime }
let snake = { // Client-side representation for Renderer3D
    segmentLength: 6.0, segments: [], maxSegments: 12, frequency: 0.03, amplitude: 15.0,
    lineWidth: 3, serverHeadX: 0, serverHeadY: 0, serverBaseY: 0, isActiveFromServer: false,
    update: function(currentTime) { if (!this.isActiveFromServer) this.segments = []; /* Basic reset */ }
};
let localEffects = { // Passed to Renderer3D
    muzzleFlash: localPlayerMuzzleFlash,
    pushbackAnim: localPlayerPushbackAnim,
    activeBloodSparkEffects: activeBloodSparkEffects,
    activeAmmoCasings: activeAmmoCasings,
    snake: snake
};

// --- HTML Overlay Element Pooling ---
const damageTextPool = { elements: {}, inactive: [] };
const healthBarPool = { elements: {}, inactive: [] };
const speechBubblePool = { elements: {}, inactive: [] };

// --- WebSocket Instance ---
let socket = null;
let reconnectTimer = null;

// --- Logging ---
function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

// --- Sound Manager (IIFE Module) ---
const SoundManager = (() => {
    let audioContext = null;
    let loadedSounds = {};
    let soundFiles = {
        'shoot': 'assets/sounds/shoot.mp3',
        'damage': 'assets/sounds/damage.mp3',
        // Add other sounds here: 'powerup', 'enemy_die', 'button_click', 'player_down', etc.
    };
    let soundsLoading = 0;
    let soundsLoaded = 0;
    let isInitialized = false;
    let canPlaySound = false;
    let isMuted = false;

    function init() {
        if (isInitialized) return canPlaySound;
        isInitialized = true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { console.error("[SM] Web Audio API not supported."); return false; }
            audioContext = new AC();
            // Handle suspended state (common before user interaction)
            const resumeAudio = () => {
                audioContext.resume().then(() => {
                    log("[SM] AudioContext Resumed.");
                    canPlaySound = true;
                    loadSounds();
                }).catch(err => {
                    console.error("[SM] Failed to resume AudioContext:", err);
                    canPlaySound = false;
                });
                // Remove listeners after first interaction
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
            };
            if (audioContext.state === 'suspended') {
                log("[SM] AudioContext suspended. Waiting for user interaction.");
                document.addEventListener('click', resumeAudio, { once: true });
                document.addEventListener('keydown', resumeAudio, { once: true });
            } else if (audioContext.state === 'running') {
                canPlaySound = true;
                loadSounds();
            } else {
                 canPlaySound = false;
            }
        } catch (e) {
            console.error("[SM] Error creating AudioContext:", e);
            audioContext = null;
            return false;
        }
        return canPlaySound;
    }

    function loadSounds() {
        if (!audioContext || !canPlaySound) return;
        soundsLoading = Object.keys(soundFiles).length;
        soundsLoaded = 0;
        loadedSounds = {};
        log(`[SM] Loading ${soundsLoading} sounds...`);
        Object.entries(soundFiles).forEach(([name, path]) => {
            fetch(path)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error ${response.status} for ${path}`);
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
                .then(decodedBuffer => {
                    loadedSounds[name] = decodedBuffer;
                    soundsLoaded++;
                    //log(`[SM] Loaded: ${name}`);
                    if (soundsLoaded === soundsLoading) log("[SM] All sounds loaded.");
                })
                .catch(e => {
                    console.error(`[SM] Error loading/decoding '${name}':`, e);
                    soundsLoaded++; // Increment even on error to finish count
                    if (soundsLoaded === soundsLoading) log("[SM] Sound loading finished (with errors).");
                });
        });
    }

    function playSound(name, volume = 1.0) {
        if (isMuted || !isInitialized || !canPlaySound || !audioContext || audioContext.state !== 'running') return;
        const buffer = loadedSounds[name];
        if (!buffer) { /* console.warn(`[SM] Sound not found: ${name}`); */ return; }
        try {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime);
            source.connect(gainNode).connect(audioContext.destination);
            source.start(0);
            source.onended = () => { try { source.disconnect(); gainNode.disconnect(); } catch(e){} }; // Cleanup
        } catch (e) {
            console.error(`[SM] Error playing '${name}':`, e);
        }
    }

    function toggleMute() {
        isMuted = !isMuted;
        log(`[SM] Sound ${isMuted ? 'Muted' : 'Unmuted'}`);
        if (DOM.muteBtn) {
            DOM.muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
            DOM.muteBtn.classList.toggle('muted', isMuted);
        }
        // Optional: Pause/resume ongoing looping sounds if any
        return isMuted;
    }

    function getMuteState() { return isMuted; }

    return { init, playSound, toggleMute, getMuteState };
})();

// --- UI Management (IIFE Module) ---
const UIManager = (() => {
    const allSections = [
        DOM.mainMenuSection, DOM.multiplayerMenuSection, DOM.hostWaitSection,
        DOM.joinCodeSection, DOM.gameArea, DOM.gameOverScreen
    ];
    const gameActiveSections = [DOM.gameArea]; // Sections active during gameplay

    function showSection(sectionId) {
        allSections.forEach(s => s?.classList.remove('active'));
        DOM.menuArea?.classList.remove('active'); // Hide menu container if showing game/game over
        DOM.gameArea?.classList.remove('active');
        DOM.gameOverScreen?.classList.remove('active');

        const sectionToShow = document.getElementById(sectionId); // Use plain ID selector
        if (sectionToShow) {
            sectionToShow.classList.add('active');
            log(`UI: Showing section: ${sectionId}`);
            // Show parent containers if needed
            if (sectionToShow.closest('#menu-area')) DOM.menuArea?.classList.add('active');
            if (sectionToShow === DOM.gameArea) DOM.gameArea?.classList.add('active');
            if (sectionToShow === DOM.gameOverScreen) DOM.gameOverScreen?.classList.add('active');

        } else {
            error(`UI: Section not found: ${sectionId}`);
        }
    }

    function updateStatus(message, isError = false) {
        if (!DOM.gameStatus) return;
        DOM.gameStatus.textContent = message;
        DOM.gameStatus.style.color = isError ? (getCssVar('--color-danger') || 'red') : (getCssVar('--color-accent') || 'yellow');
    }

    function updateHUD(serverState) {
        if (!DOM.playerStatsGrid) return;
        const players = serverState?.players;
        const localId = appState.localPlayerId;
        DOM.playerStatsGrid.innerHTML = ''; // Clear previous

        if (!players || Object.keys(players).length === 0) {
            DOM.playerStatsGrid.innerHTML = '<div class="stats-box placeholder">Waiting...</div>';
            return;
        }

        // Sort to put local player first
        const sortedPlayerIds = Object.keys(players).sort((a, b) => {
            if (a === localId) return -1; if (b === localId) return 1;
            return a.localeCompare(b);
        });

        sortedPlayerIds.forEach(playerId => {
            const pData = players[playerId];
            if (!pData) return;
            const isSelf = (playerId === localId);
            const header = isSelf ? "YOU" : `P:${playerId.substring(0, 4)}`;
            const status = pData.player_status || PLAYER_STATUS_ALIVE;
            const health = pData.health ?? 0;
            const armor = pData.armor ?? 0;

            let healthDisplay;
            if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--color-down-status);'>DOWN</span>`;
            else if (status === PLAYER_STATUS_DEAD || health <= 0) healthDisplay = `<span style='color: var(--color-dead-status);'>DEAD</span>`;
            else healthDisplay = `${health.toFixed(1)}`; // Show decimal for health

            const statsBox = document.createElement('div');
            statsBox.className = 'stats-box';
            statsBox.innerHTML = `
                <div class="stats-header">${header}</div>
                <div class="stats-content">
                    <span>HP:</span> ${healthDisplay}<br>
                    <span>Armor:</span> ${Math.round(armor)}<br>
                    <span>Gun:</span> ${pData.gun ?? 1}<br>
                    <span>Speed:</span> ${pData.speed ?? PLAYER_DEFAULTS.base_speed}<br>
                    <span>Kills:</span> ${pData.kills ?? 0}<br>
                    <span>Score:</span> ${pData.score ?? 0}
                </div>
            `;
            DOM.playerStatsGrid.appendChild(statsBox);
        });
    }

    function addChatMessage(sender, message, isSelf, isSystem = false) {
        if (!DOM.chatLog) return;
        const div = document.createElement('div');
        div.classList.add('chat-message'); // Base class
        if (isSystem) {
            div.classList.add('system-message');
            div.textContent = message;
        } else {
            div.classList.add(isSelf ? 'my-message' : 'other-message');
            div.textContent = `${sender ? `P:${sender.substring(0,4)}` : '???'}: ${message}`;
        }
        DOM.chatLog.appendChild(div);
        // Auto-scroll to bottom
        DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
    }

    function updateCountdown(serverState) {
        if (!DOM.countdownOverlay) return;
        const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0;
        if (isCountdown) {
            DOM.countdownOverlay.textContent = Math.ceil(serverState.countdown);
            DOM.countdownOverlay.classList.add('active');
        } else {
            DOM.countdownOverlay.classList.remove('active');
        }
    }

    function updateDayNight(serverState) {
        if (!DOM.dayNightIndicator || !DOM.gameContainer) return;
        if (serverState?.status === 'active') {
            const isNight = serverState.is_night;
            appState.isNight = isNight; // Update global state
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day';
            DOM.dayNightIndicator.style.display = 'block';
            DOM.gameContainer.classList.toggle('night-mode', isNight);
        } else {
            DOM.dayNightIndicator.style.display = 'none';
            DOM.gameContainer.classList.remove('night-mode');
            appState.isNight = false;
        }
    }

    function updateEnvironmentDisplay(serverState) {
        if (!DOM.temperatureIndicator) return;
        if (serverState?.status === 'active') {
            appState.currentTemp = serverState.current_temperature ?? 18.0;
            appState.isRaining = serverState.is_raining ?? false;
            appState.isDustStorm = serverState.is_dust_storm ?? false;
            DOM.temperatureIndicator.textContent = `${appState.currentTemp.toFixed(0)}°C`;
            DOM.temperatureIndicator.style.display = 'block';
        } else {
             DOM.temperatureIndicator.style.display = 'none';
        }
    }

     function showGameOver(finalState) {
        if (!DOM.finalStats || !DOM.gameOverScreen) return;
        const player = finalState?.players?.[appState.localPlayerId];
        let statsHtml = "Stats Unavailable";
        if (player) {
            statsHtml = `
                <div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div>
                <div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>
                <!-- Add more final stats if available -->
            `;
        }
        DOM.finalStats.innerHTML = statsHtml;
        log("UI: Showing game over screen.");
        showSection('game-over-screen');
    }

    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateDayNight, updateEnvironmentDisplay, showGameOver };
})();

// --- Network Management (IIFE Module) ---
const NetworkManager = (() => {

    function connect(onOpenCallback) {
        if (socket && socket.readyState !== WebSocket.CLOSED) {
            if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback();
            return; // Already connected or connecting
        }
        clearTimeout(reconnectTimer);
        UIManager.updateStatus('Connecting...');
        log("WS connect:", WEBSOCKET_URL);
        try {
            socket = new WebSocket(WEBSOCKET_URL);
        } catch (err) {
            error("WS creation failed:", err);
            UIManager.updateStatus('Connection failed.', true);
            return;
        }

        socket.onopen = () => {
            log('WS open.');
            appState.isConnected = true;
            // Fade out loading screen, fade in game container
            DOM.loadingScreen?.classList.remove('active');
            DOM.gameContainer?.classList.add('loaded'); // Use new class for fade-in
            UIManager.updateStatus('Connected.');
            UIManager.showSection('main-menu-section'); // Show main menu on successful connect
            if (onOpenCallback) onOpenCallback();
        };

        socket.onmessage = handleServerMessage; // Global handler function

        socket.onerror = (event) => {
            error('WS Error:', event);
            // Don't show reconnecting message on initial connection error
        };

        socket.onclose = (event) => {
            error(`WS Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`);
            const wasConnected = appState.isConnected;
            appState.isConnected = false;
            socket = null;
            GameManager.resetClientState(false); // Reset state but don't force menu if mid-game

            if (event.code === 1000) { // Normal closure
                UIManager.updateStatus('Disconnected.');
                UIManager.showSection('main-menu-section');
            } else if (wasConnected) { // Abnormal closure after connection
                UIManager.updateStatus('Connection lost. Reconnecting...', true);
                scheduleReconnect();
            } else { // Failed initial connection
                UIManager.updateStatus('Connection failed.', true);
                 // Show main menu even if connection failed initially
                UIManager.showSection('main-menu-section');
            }

            GameManager.cleanupLoop(); // Ensure loop stops if connection closes
        };
    }

    function scheduleReconnect() {
        clearTimeout(reconnectTimer);
        log(`Reconnect attempt in ${RECONNECT_DELAY}ms`);
        reconnectTimer = setTimeout(() => {
            log("Attempting reconnect...");
            connect(() => {
                 // Reconnected successfully
                 UIManager.updateStatus('Reconnected.');
                 // Should ideally try to rejoin the game if possible,
                 // but for now, just go back to the main menu.
                 GameManager.resetClientState(true); // Force back to menu on reconnect
            });
        }, RECONNECT_DELAY);
    }

    function sendMessage(payload) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                socket.send(JSON.stringify(payload));
            } catch (err) {
                error("Send error:", err, payload);
            }
        } else {
            // error("Cannot send message, WebSocket not open."); // Can be noisy
        }
    }

    function closeConnection(code = 1000, reason = "User action") {
        clearTimeout(reconnectTimer);
        if (socket && socket.readyState === WebSocket.OPEN) {
            log(`Closing WS connection: ${reason} (${code})`);
            socket.close(code, reason);
        }
        socket = null; // Ensure reference is cleared
        appState.isConnected = false;
    }

    return { connect, sendMessage, closeConnection };
})();

// --- Input Handling (IIFE Module) ---
const InputManager = (() => {
    let keys = {}; // Tracks currently pressed keys relevant to game
    let lastShotTime = 0;
    let inputInterval = null;
    let mouseScreenPos = { x: 0, y: 0 }; // Mouse relative to canvas wrapper
    let isMouseDown = false; // Track left mouse button state
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(); // Normalized Device Coordinates

    // Prevent browser context menu on right-click inside canvas
    function preventContextMenu(event) {
        if (DOM.canvasWrapper?.contains(event.target)) {
            event.preventDefault();
        }
    }

    function setup() {
        cleanup(); // Ensure no duplicate listeners
        log("Input: Setting up listeners...");
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        DOM.chatInput?.addEventListener('keydown', handleChatEnter); // Enter key in chat input

        // Listeners on the canvas wrapper
        DOM.canvasWrapper?.addEventListener('mousemove', handleMouseMove);
        DOM.canvasWrapper?.addEventListener('mousedown', handleMouseDown);
        DOM.canvasWrapper?.addEventListener('contextmenu', preventContextMenu);
        // Mouse up listener on the document to catch mouse up outside canvas
        document.addEventListener('mouseup', handleMouseUp);

        // Start sending movement input periodically
        inputInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL);
    }

    function cleanup() {
        log("Input: Cleaning up listeners...");
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput?.removeEventListener('keydown', handleChatEnter);
        DOM.canvasWrapper?.removeEventListener('mousemove', handleMouseMove);
        DOM.canvasWrapper?.removeEventListener('mousedown', handleMouseDown);
        DOM.canvasWrapper?.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('mouseup', handleMouseUp);

        clearInterval(inputInterval);
        inputInterval = null;
        keys = {};
        isMouseDown = false;
        mouseScreenPos = { x: 0, y: 0 };
    }

    function handleMouseMove(event) {
        if (!DOM.canvasWrapper || typeof Renderer3D === 'undefined' || !Renderer3D.getCamera || !Renderer3D.getGroundPlane || !appState.isGameLoopRunning) return;

        const rect = DOM.canvasWrapper.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        mouseScreenPos.x = canvasX;
        mouseScreenPos.y = canvasY;

        // Calculate Normalized Device Coordinates (-1 to +1)
        mouseNDC.x = (canvasX / rect.width) * 2 - 1;
        mouseNDC.y = -(canvasY / rect.height) * 2 + 1;

        const camera = Renderer3D.getCamera();
        const groundPlane = Renderer3D.getGroundPlane();
        if (camera && groundPlane) {
            try {
                raycaster.setFromCamera(mouseNDC, camera);
                const intersects = raycaster.intersectObject(groundPlane);
                if (intersects.length > 0) {
                    // Store the 3D world coordinates where the mouse intersects the ground
                    appState.mouseWorldPosition.copy(intersects[0].point);
                }
            } catch (e) {
                console.error("Input: Raycasting error:", e);
            }
        }
    }

    function handleMouseDown(event) {
        // Ignore clicks if typing in chat
        if (document.activeElement === DOM.chatInput) return;

        if (event.button === 0) { // Left click
            isMouseDown = true;
            event.preventDefault(); // Prevent text selection, etc.
        } else if (event.button === 2) { // Right click
            event.preventDefault(); // Already handled by contextmenu, but good practice
             // Trigger pushback if in active game state
            if (appState.serverState?.status === 'active' && appState.isConnected) {
                 GameManager.triggerLocalPushback(); // Trigger local animation and send message
            }
        }
    }

    function handleMouseUp(event) {
        if (event.button === 0) { // Left click released
            isMouseDown = false;
        }
    }

    function handleKeyDown(event) {
        // Ignore key presses if typing in chat
        if (document.activeElement === DOM.chatInput) return;

        const key = event.key.toLowerCase();
        // Movement keys & Shoot
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            if (!keys[key]) { // Prevent repeated triggers for held keys
                keys[key] = true;
            }
            event.preventDefault(); // Prevent page scrolling, space bar actions
        }
        // Pushback key (alternative to right-click)
        if (key === 'e') {
             if (appState.serverState?.status === 'active' && appState.isConnected) {
                 GameManager.triggerLocalPushback();
                 event.preventDefault();
            }
        }
    }

    function handleKeyUp(event) {
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            keys[key] = false;
        }
    }

    function handleChatEnter(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission/newline
            GameManager.sendChatMessage();
            // Optionally blur input after sending
            // DOM.chatInput.blur();
        }
    }

    function getMovementInputVector() {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const factor = 1 / Math.sqrt(2);
            dx *= factor;
            dy *= factor;
        }
        return { dx, dy };
    }

    // Called periodically by interval timer
    function sendMovementInput() {
        // Only send if in active game and connected
        if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected) {
            NetworkManager.sendMessage({ type: 'player_move', direction: getMovementInputVector() });
        }
    }

    // Check if shoot action is currently active
    function isShootHeld() {
        return keys[' '] || isMouseDown;
    }

    // Triggered within the game loop if shoot is held
    function handleShooting() {
        if (appState.serverState?.status !== 'active') return;

        const playerState = appState.serverState?.players?.[appState.localPlayerId];
        if (!playerState || playerState.player_status !== PLAYER_STATUS_ALIVE) return;

        const nowTimestamp = Date.now();
        const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire';
        const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier;

        if (nowTimestamp - lastShotTime < actualCooldown) return; // Still on cooldown

        lastShotTime = nowTimestamp;

        // Calculate aim direction based on mouse world position
        const playerRenderX = appState.renderedPlayerPos.x;
        const playerRenderZ = appState.renderedPlayerPos.y; // Game Y is Scene Z
        let aimDx = 0, aimDy = -1; // Default aim up if something fails
        const targetWorldPos = appState.mouseWorldPosition;

        if (targetWorldPos && typeof playerRenderX === 'number' && typeof playerRenderZ === 'number') {
            aimDx = targetWorldPos.x - playerRenderX;
            aimDy = targetWorldPos.z - playerRenderZ; // Use Z for world Y
            const magSq = aimDx * aimDx + aimDy * aimDy;
            if (magSq > 0.01) { // Avoid division by zero
                const mag = Math.sqrt(magSq);
                aimDx /= mag;
                aimDy /= mag;
            } else {
                 aimDx = 0; aimDy = -1; // Reset to default if target is directly on player
            }
        }
        // Store last aim direction for renderer
        appState.localPlayerAimState.lastAimDx = aimDx;
        appState.localPlayerAimState.lastAimDy = aimDy;

        // Trigger local visual effects
        const nowPerf = performance.now();
        localPlayerMuzzleFlash.active = true;
        localPlayerMuzzleFlash.endTime = nowPerf + MUZZLE_FLASH_DURATION;
        localPlayerMuzzleFlash.aimDx = aimDx;
        localPlayerMuzzleFlash.aimDy = aimDy;

        // Play sound
        SoundManager.playSound('shoot');

        // Spawn local ammo casing effect
        GameManager.spawnLocalAmmoCasing(playerRenderX, playerRenderZ, aimDx, aimDy);

        // Send shoot message to server with target world coordinates
        NetworkManager.sendMessage({ type: 'player_shoot', target: { x: targetWorldPos.x, y: targetWorldPos.z } });
    }

    return { setup, cleanup, isShootHeld, handleShooting };
})();

// --- Game Logic & Flow (IIFE Module) ---
const GameManager = (() => {
    let lastLoopTime = null;

    function initListeners() {
        log("Game: Initializing button listeners...");
        DOM.singlePlayerBtn?.addEventListener('click', () => { SoundManager.init(); startSinglePlayer(); });
        DOM.multiplayerBtn?.addEventListener('click', () => UIManager.showSection('multiplayer-menu-section'));

        const hostHandler = (maxPlayers) => { SoundManager.init(); hostMultiplayer(maxPlayers); };
        DOM.hostGameBtn2?.addEventListener('click', () => hostHandler(2));
        DOM.hostGameBtn3?.addEventListener('click', () => hostHandler(3));
        DOM.hostGameBtn4?.addEventListener('click', () => hostHandler(4));

        DOM.showJoinUIBtn?.addEventListener('click', () => UIManager.showSection('join-code-section'));
        DOM.joinGameSubmitBtn?.addEventListener('click', () => { SoundManager.init(); joinMultiplayer(); });
        DOM.cancelHostBtn?.addEventListener('click', leaveGame); // Cancel hosting = leave game

        DOM.sendChatBtn?.addEventListener('click', sendChatMessage);
        DOM.leaveGameBtn?.addEventListener('click', leaveGame);
        DOM.gameOverBackBtn?.addEventListener('click', () => resetClientState(true)); // Go back to main menu

        DOM.muteBtn?.addEventListener('click', SoundManager.toggleMute);
        // Set initial mute button state
        if(DOM.muteBtn) {
             DOM.muteBtn.textContent = SoundManager.getMuteState() ? 'Unmute' : 'Mute';
             DOM.muteBtn.classList.toggle('muted', SoundManager.getMuteState());
        }

        // Generic back buttons
        document.querySelectorAll('.button-back').forEach(btn => {
            const targetId = btn.dataset.target;
            if (targetId && document.getElementById(targetId)) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    UIManager.showSection(targetId);
                });
            } else {
                log(`Warn: Back button missing or invalid data-target: ${targetId}`, btn);
            }
        });
        log("Game: Button listeners initialized.");
    }

    function startSinglePlayer() {
        log("Requesting Single Player game...");
        appState.mode = 'singleplayer';
        UIManager.updateStatus("Starting Single Player...");
        NetworkManager.sendMessage({ type: 'start_single_player' });
        // Server response 'sp_game_started' will trigger game start
    }

    function joinMultiplayer() {
        const gameId = DOM.gameIdInput?.value.trim().toUpperCase();
        if (!gameId || gameId.length !== 6) {
            UIManager.updateStatus('Invalid Game ID (must be 6 characters).', true);
            return;
        }
        log(`Joining multiplayer game: ${gameId}`);
        appState.mode = 'multiplayer-client';
        UIManager.updateStatus(`Joining game ${gameId}...`);
        NetworkManager.sendMessage({ type: 'join_game', game_id: gameId });
        // Server response 'game_joined' or 'error' will follow
    }

    function hostMultiplayer(maxPlayers) {
        log(`Hosting multiplayer game (${maxPlayers} players)...`);
        if (![2, 3, 4].includes(maxPlayers)) {
            error("Invalid max players count:", maxPlayers);
            UIManager.updateStatus("Invalid player count specified.", true);
            return;
        }
        appState.mode = 'multiplayer-host';
        UIManager.updateStatus(`Creating ${maxPlayers}-player game...`);
        NetworkManager.sendMessage({ type: 'create_game', max_players: maxPlayers });
        // Server response 'game_created' or 'error' will follow
    }

    function leaveGame() {
        log("Leaving current game...");
        if (appState.isConnected && appState.currentGameId && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'leave_game' });
            // Don't wait for server confirmation, reset immediately
        }
        resetClientState(true); // Reset state and force back to menu
    }

    function sendChatMessage() {
        const message = DOM.chatInput?.value.trim();
        if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'player_chat', message: message });
            if(DOM.chatInput) DOM.chatInput.value = ''; // Clear input after sending
        }
    }

     function triggerLocalPushback() {
        // Trigger local animation immediately
        localPlayerPushbackAnim.active = true;
        localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration;
        log("Input: Local pushback animation triggered.");
        // Send message to server
        NetworkManager.sendMessage({ type: 'player_pushback' });
    }

    function spawnLocalAmmoCasing(playerX, playerZ, aimDx, aimDy) {
         if (!Array.isArray(activeAmmoCasings)) activeAmmoCasings = [];
         if (activeAmmoCasings.length >= MAX_CASED_AMMO) {
             activeAmmoCasings.shift(); // Remove oldest if limit reached
         }
         const nowPerf = performance.now();
         const casingLifetime = CASING_LIFETIME_BASE_MS + Math.random() * CASING_LIFETIME_RANDOM_MS;
         const ejectAngleOffset = Math.PI / 2 + (Math.random() - 0.5) * 0.4; // Eject roughly sideways/back
         const ejectAngle = Math.atan2(aimDy, aimDx) + ejectAngleOffset;
         const ejectSpeed = 80 + Math.random() * 40;
         const gravity = 150;
         const casing = {
             id: `casing_${nowPerf}_${Math.random().toString(16).slice(2)}`,
             x: playerX + Math.cos(ejectAngle) * 15, // Start slightly offset
             y: playerZ + Math.sin(ejectAngle) * 15,
             vx: Math.cos(ejectAngle) * ejectSpeed,
             vy: Math.sin(ejectAngle) * ejectSpeed - 40, // Initial upward pop
             rotation: Math.random() * Math.PI * 2,
             rotationSpeed: (Math.random() - 0.5) * 10,
             spawnTime: nowPerf,
             lifetime: casingLifetime,
             gravity: gravity,
             width: 6, height: 3, // Dimensions for renderer
             color: "rgba(218, 165, 32, 0.9)" // Color for renderer
         };
         activeAmmoCasings.push(casing);
    }

    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`);
        cleanupLoop(); // Stop game loop and input

        // Clear HTML overlays and pools
        if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = '';
        Object.keys(damageTextPool.elements).forEach(id => delete damageTextPool.elements[id]);
        damageTextPool.inactive.length = 0;
        Object.keys(healthBarPool.elements).forEach(id => delete healthBarPool.elements[id]);
        healthBarPool.inactive.length = 0;
        Object.keys(speechBubblePool.elements).forEach(id => delete speechBubblePool.elements[id]);
        speechBubblePool.inactive.length = 0;

        // Cleanup Renderer (if it exists and has cleanup method)
        if (typeof Renderer3D !== 'undefined' && Renderer3D.cleanup) {
            Renderer3D.cleanup();
        }

        // Reset state variables
        const currentIsConnected = appState.isConnected; // Preserve connection status if just leaving game
        const currentW = appState.canvasWidth;
        const currentH = appState.canvasHeight;

        appState = {
            mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null,
            serverState: null, lastServerState: null, animationFrameId: null,
            isConnected: currentIsConnected, // Keep connection status
            isGameLoopRunning: false,
            renderedPlayerPos: { x: currentW / 2, y: currentH / 2 },
            predictedPlayerPos: { x: currentW / 2, y: currentH / 2 },
            lastStateReceiveTime: performance.now(),
            canvasWidth: currentW, canvasHeight: currentH,
            mouseWorldPosition: new THREE.Vector3(0,0,0),
            localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
            uiPositions: {}, currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false,
        };

        // Reset local effects
        localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
        localPlayerPushbackAnim = { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION };
        activeSpeechBubbles = {}; activeEnemyBubbles = {};
        activeAmmoCasings = []; activeBloodSparkEffects = {};
        if(typeof snake !== 'undefined'){ snake.isActiveFromServer = false; snake.segments = []; }

        // Reset UI elements
        DOM.chatLog.innerHTML = '';
        DOM.gameCodeDisplay.textContent = '------';
        DOM.gameIdInput.value = '';
        DOM.countdownOverlay?.classList.remove('active');
        DOM.dayNightIndicator.style.display = 'none';
        DOM.temperatureIndicator.style.display = 'none';
        DOM.playerStatsGrid.innerHTML = '<div class="stats-box placeholder">Loading Stats...</div>';

        if (showMenu) {
            appState.mode = 'menu';
            UIManager.updateStatus(appState.isConnected ? "Connected." : "Disconnected.");
            UIManager.showSection('main-menu-section');
        }
    }

    // --- HTML Overlay Update Logic ---
    function updateHtmlOverlays(stateToRender) {
        if (!DOM.htmlOverlay || !stateToRender || !appState.uiPositions) return;
        const overlay = DOM.htmlOverlay;
        const now = performance.now();

        // Helper to get/create pooled elements
        const getElement = (pool, id, className, parent) => {
            let element = pool.elements[id];
            if (!element) {
                element = pool.inactive.pop();
                if (!element) {
                    element = document.createElement('div');
                    element.className = className; // Set base class on creation
                    parent.appendChild(element);
                } else {
                    element.style.display = 'block'; // Make visible if reused
                }
                pool.elements[id] = element;
            }
            return element;
        };
        // Helper to release elements back to pool
        const releaseElement = (pool, id) => {
            const element = pool.elements[id];
            if (element) {
                element.style.display = 'none';
                pool.inactive.push(element);
                delete pool.elements[id];
            }
        };

        const players = stateToRender.players || {};
        const enemies = stateToRender.enemies || {};
        const damageTexts = stateToRender.damage_texts || {};
        const allBubbles = { ...activeSpeechBubbles, ...activeEnemyBubbles };

        const activeDamageIds = new Set(Object.keys(damageTexts));
        const activeHealthBarIds = new Set();
        const activeBubbleIds = new Set();
        for (const id in allBubbles) { if (now < allBubbles[id].endTime) activeBubbleIds.add(id); }

        // --- Damage Text Update ---
        for (const id in damageTexts) {
            const dtData = damageTexts[id];
            const posData = appState.uiPositions[id];
            if (!posData) continue; // Need screen position

            const element = getElement(damageTextPool, id, 'overlay-element damage-text-overlay', overlay);
            element.textContent = dtData.text;
            element.classList.toggle('crit', dtData.is_crit || false);

            const lifeTime = (dtData.lifetime || 0.75) * 1000;
            const spawnTime = dtData.spawn_time * 1000; // Assuming server sends seconds
            const timeElapsed = now - spawnTime;
            const lifeProgress = Math.min(1, timeElapsed / lifeTime);
            const verticalOffset = -(lifeProgress * 50); // Move up as it fades

            element.style.left = `${posData.screenX}px`;
            element.style.top = `${posData.screenY + verticalOffset}px`;
            element.style.opacity = Math.max(0, 1.0 - (lifeProgress * 0.8)).toFixed(2);
        }
        // Release inactive damage texts
        for (const id in damageTextPool.elements) { if (!activeDamageIds.has(id)) releaseElement(damageTextPool, id); }

        // --- Health/Armor Bar Update ---
        const healthBarOffsetY = -35; const healthBarHeight = 7; const armorBarHeight = 4; const barSpacing = 2; const healthBarWidthFactor = 0.8; const minBarWidth = 30;
        const healthBarHighColor = getCssVar('--color-health-high'); const healthBarMediumColor = getCssVar('--color-health-medium'); const healthBarLowColor = getCssVar('--color-health-low'); const armorBarColor = getCssVar('--color-armor');

        const processEntityForHealthBar = (id, entityData) => {
             // Don't show for dead/downed or if no health
            if (!entityData || entityData.health <= 0 || entityData.player_status === PLAYER_STATUS_DOWN || entityData.player_status === PLAYER_STATUS_DEAD) return;
            const posData = appState.uiPositions[id];
            if (!posData) return; // Need screen position
            activeHealthBarIds.add(id); // Mark this ID as active

            const entityWidth = entityData.width || (id in players ? PLAYER_DEFAULTS.width : 20);
            const barWidth = Math.max(minBarWidth, entityWidth * healthBarWidthFactor);
            const maxHealth = entityData.max_health || 100;
            const healthPercent = Math.max(0, Math.min(1, entityData.health / maxHealth));
            const currentHealthWidth = barWidth * healthPercent;
            const armorPercent = Math.max(0, Math.min(1, (entityData.armor || 0) / 100));
            const currentArmorWidth = barWidth * armorPercent;
            const showArmor = entityData.armor > 0;

            const barContainer = getElement(healthBarPool, id, 'overlay-element health-bar-container', overlay);

            // Ensure child elements exist if container is new
            if (barContainer.children.length === 0) {
                barContainer.innerHTML = `
                    <div class="health-bar-bg" style="height: ${healthBarHeight}px;">
                        <div class="health-bar-fg" style="height: ${healthBarHeight}px;"></div>
                    </div>
                    <div class="armor-bar-bg" style="height: ${armorBarHeight}px; top: ${healthBarHeight + barSpacing}px;">
                         <div class="armor-bar-fg" style="height: ${armorBarHeight}px; top: 0; left: 0;"></div>
                    </div>
                `;
                 // Apply centering transform only once or ensure it's there
                 barContainer.style.transform = 'translateX(-50%)';
            }

            // Position container (centered via CSS transform)
            barContainer.style.left = `${posData.screenX}px`;
            barContainer.style.top = `${posData.screenY + healthBarOffsetY}px`;
            barContainer.style.width = `${barWidth}px`;

            // Update individual bar elements
            const healthBgEl = barContainer.children[0];
            const healthFgEl = healthBgEl.children[0];
            const armorBgEl = barContainer.children[1];
            const armorFgEl = armorBgEl.children[0];

            healthBgEl.style.width = `${barWidth}px`;
            healthFgEl.style.width = `${currentHealthWidth}px`;
            // Set health bar color based on percentage
            if (healthPercent > 0.66) healthFgEl.style.backgroundColor = healthBarHighColor;
            else if (healthPercent > 0.33) healthFgEl.style.backgroundColor = healthBarMediumColor;
            else healthFgEl.style.backgroundColor = healthBarLowColor;

            // Toggle armor bar visibility and update width
            const armorVisible = showArmor;
            armorBgEl.style.display = armorVisible ? 'block' : 'none';
            if (armorVisible) {
                armorBgEl.style.width = `${barWidth}px`;
                armorFgEl.style.width = `${currentArmorWidth}px`;
            }
        };

        Object.entries(players).forEach(([id, data]) => processEntityForHealthBar(id, data));
        Object.entries(enemies).forEach(([id, data]) => processEntityForHealthBar(id, data));
        // Release inactive health bars
        for (const id in healthBarPool.elements) { if (!activeHealthBarIds.has(id)) releaseElement(healthBarPool, id); }

        // --- Speech Bubble Update ---
        for (const id in allBubbles) {
             if (!activeBubbleIds.has(id)) continue; // Skip expired
             const bubbleData = allBubbles[id];
             const posData = appState.uiPositions[id];
             if (!posData) continue; // Need screen position

             const element = getElement(speechBubblePool, id, 'overlay-element speech-bubble', overlay);
             element.textContent = bubbleData.text; // Set text content

             // Determine Y offset based on health/armor bar visibility
            const healthBarExists = activeHealthBarIds.has(id);
            const entityData = players[id] || enemies[id];
            const armorVisible = healthBarExists && (entityData?.armor > 0);
            const baseOffsetY = -45; // Base offset above entity center
            const healthBarTotalHeight = healthBarExists ? (healthBarHeight + (armorVisible ? armorBarHeight + barSpacing : 0) + barSpacing) : 0;
            const bubbleOffsetY = baseOffsetY - healthBarTotalHeight;

            // Position bubble (centered via CSS transform)
             element.style.left = `${posData.screenX}px`;
             element.style.top = `${posData.screenY + bubbleOffsetY}px`;
        }
         // Release inactive speech bubbles
        for (const id in speechBubblePool.elements) { if (!activeBubbleIds.has(id)) releaseElement(speechBubblePool, id); }
    }


    // --- Game Loop ---
    function gameLoop(currentTime) {
        if (!appState.isGameLoopRunning) {
            log("Loop exit: Game loop flag is false.");
            cleanupLoop(); // Ensure cleanup if flag changed unexpectedly
            return;
        }

        const now = performance.now();
        if (lastLoopTime === null) lastLoopTime = now;
        const deltaTime = Math.min(0.1, (now - lastLoopTime) / 1000); // Delta time in seconds, capped
        lastLoopTime = now;

        // Update local effects timers
        if (localPlayerPushbackAnim.active && now >= localPlayerPushbackAnim.endTime) localPlayerPushbackAnim.active = false;
        if (localPlayerMuzzleFlash.active && now >= localPlayerMuzzleFlash.endTime) localPlayerMuzzleFlash.active = false;

        // Update client-side representations/effects
        if (typeof snake?.update === 'function') snake.update(now); // Update snake visual state
        updateLocalAmmoCasings(deltaTime); // Update physics for casings

        // Process input
        if (appState.serverState?.status === 'active' && InputManager.isShootHeld()) {
            InputManager.handleShooting();
        }

        // Update predicted position based on input
        if (appState.serverState?.status === 'active') {
            updatePredictedPosition(deltaTime);
            // Server reconciliation (adjusts renderedPos towards predicted, snaps if needed)
            reconcileWithServer();
        }

        // Get interpolated state for rendering
        const stateToRender = getInterpolatedState(now);

        // Render the scene using the interpolated state
        if (stateToRender && typeof Renderer3D !== 'undefined' && Renderer3D.renderScene) {
            // Pass appState for camera control, localPlayerId, etc.
            // Pass localEffects for muzzle flash, pushback anim, sparks, casings
            Renderer3D.renderScene(stateToRender, appState, localEffects);
        } else if (appState.mode !== 'menu') {
            log("Skipping render: Missing state or Renderer3D.");
        }

        // Update HTML overlays based on rendered positions
        if (stateToRender && appState.mode !== 'menu') {
            updateHtmlOverlays(stateToRender);
        }

        // Request next frame if loop should continue
        if (appState.isGameLoopRunning) {
            appState.animationFrameId = requestAnimationFrame(gameLoop);
        } else {
            log("Loop exit: Game loop flag became false during execution.");
            cleanupLoop();
        }
    }

    function startGameLoop() {
        if (appState.isGameLoopRunning) return; // Already running
        if (appState.mode === 'menu') { log("Cannot start loop in menu mode."); return; }
        if (!appState.serverState) { log("Delaying loop: Waiting for initial server state."); return; } // Wait for state

        log("Starting game loop...");
        InputManager.setup(); // Setup input listeners when loop starts
        appState.isGameLoopRunning = true;
        lastLoopTime = null; // Reset last loop time
        appState.animationFrameId = requestAnimationFrame(gameLoop);
    }

    function cleanupLoop() {
        if (appState.animationFrameId) {
            cancelAnimationFrame(appState.animationFrameId);
            appState.animationFrameId = null;
        }
        InputManager.cleanup(); // Remove input listeners
        appState.isGameLoopRunning = false;
        lastLoopTime = null;
        log("Game loop stopped.");
    }

     function updateLocalAmmoCasings(deltaTime) {
         activeAmmoCasings = activeAmmoCasings.filter(c => (performance.now() - c.spawnTime) < c.lifetime);
         activeAmmoCasings.forEach(c => {
             c.vy += c.gravity * deltaTime; // Apply gravity
             c.x += c.vx * deltaTime;
             c.y += c.vy * deltaTime; // Update position (y is world Z)
             c.rotation += c.rotationSpeed * deltaTime;
         });
     }

    function getInterpolatedState(renderTime) {
        const serverState = appState.serverState;
        const lastState = appState.lastServerState;

        // If no previous state or timestamps are bad, return current state
        if (!lastState || !serverState?.timestamp || !lastState?.timestamp || serverState.timestamp <= lastState.timestamp) {
            // Still apply local player prediction directly if possible
             if (serverState && serverState.players && serverState.players[appState.localPlayerId]) {
                 let currentStateCopy = JSON.parse(JSON.stringify(serverState)); // Avoid modifying original
                 currentStateCopy.players[appState.localPlayerId].x = appState.renderedPlayerPos.x;
                 currentStateCopy.players[appState.localPlayerId].y = appState.renderedPlayerPos.y;
                 return currentStateCopy;
             }
            return serverState;
        }

        const serverTime = serverState.timestamp * 1000;
        const lastServerTime = lastState.timestamp * 1000;
        const timeBetweenStates = serverTime - lastServerTime;
        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS; // Target time in the past
        const timeSinceLastState = renderTargetTime - lastServerTime;

        // Interpolation factor (clamped between 0 and 1)
        let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates));

        // Deep copy the target state to modify for interpolation
        let interpolatedState = JSON.parse(JSON.stringify(serverState));

        // --- Interpolate Players ---
        if (interpolatedState.players) {
            for (const pId in interpolatedState.players) {
                const currentP = serverState.players[pId];
                const lastP = lastState.players?.[pId];

                if (pId === appState.localPlayerId) {
                    // Use the client's smoothed rendered position for the local player
                    interpolatedState.players[pId].x = appState.renderedPlayerPos.x;
                    interpolatedState.players[pId].y = appState.renderedPlayerPos.y;
                } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number' && typeof currentP.y === 'number' && typeof lastP.y === 'number') {
                    // Interpolate other players
                    interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t);
                    interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t);
                }
            }
        }

        // --- Interpolate Enemies ---
         if (interpolatedState.enemies) {
            for (const eId in interpolatedState.enemies) {
                 const currentE = serverState.enemies[eId];
                 const lastE = lastState.enemies?.[eId];
                 // Only interpolate enemies that are alive in the target state
                 if (lastE && currentE.health > 0 && typeof currentE.x === 'number' && typeof lastE.x === 'number' && typeof currentE.y === 'number' && typeof lastE.y === 'number') {
                     interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t);
                     interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t);
                 }
            }
         }

        // --- Interpolate Bullets ---
        if (interpolatedState.bullets) {
             for (const bId in interpolatedState.bullets) {
                 const currentB = serverState.bullets[bId];
                 const lastB = lastState.bullets?.[bId];
                 if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number' && typeof currentB.y === 'number' && typeof lastB.y === 'number') {
                     interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t);
                     interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t);
                 }
             }
        }

        // Non-interpolated data (copy directly from latest state)
        interpolatedState.powerups = serverState.powerups;
        interpolatedState.damage_texts = serverState.damage_texts; // Damage text position handled separately

        return interpolatedState;
    }

    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;

        const playerState = appState.serverState.players[appState.localPlayerId];
        // Cannot predict if player is not alive
        if(playerState.player_status !== PLAYER_STATUS_ALIVE) return;

        const moveVector = InputManager.getMovementInputVector(); // Assuming InputManager has this
        const playerSpeed = playerState?.speed ?? PLAYER_DEFAULTS.base_speed;

        if (moveVector.dx !== 0 || moveVector.dy !== 0) {
            appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime;
            appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime;
        }

        // Clamp predicted position to canvas bounds (using potentially larger map size)
        const w_half = (playerState?.width ?? PLAYER_DEFAULTS.width) / 2;
        const h_half = (playerState?.height ?? PLAYER_DEFAULTS.height) / 2;
        appState.predictedPlayerPos.x = Math.max(w_half, Math.min(appState.canvasWidth - w_half, appState.predictedPlayerPos.x));
        appState.predictedPlayerPos.y = Math.max(h_half, Math.min(appState.canvasHeight - h_half, appState.predictedPlayerPos.y));
    }

    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;

        const serverPos = appState.serverState.players[appState.localPlayerId];
        // Server might not send position if player is dead/down
        if (typeof serverPos.x !== 'number' || typeof serverPos.y !== 'number') return;

        const predictedPos = appState.predictedPlayerPos;
        const renderedPos = appState.renderedPlayerPos;
        const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);

        // Use thresholds from CSS vars or defaults
        const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35;
        const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15;

        // If discrepancy is too large, snap predicted position to server position
        if (dist > snapThreshold) {
            predictedPos.x = serverPos.x;
            predictedPos.y = serverPos.y;
            // Snap rendered position as well to avoid large visual jump
            renderedPos.x = serverPos.x;
            renderedPos.y = serverPos.y;
        } else {
            // Smoothly interpolate rendered position towards predicted position
            renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor);
            renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor);
        }
    }

    return {
        initListeners, startSinglePlayer, joinMultiplayer, hostMultiplayer,
        leaveGame, sendChatMessage, triggerLocalPushback, spawnLocalAmmoCasing,
        resetClientState, startGameLoop, cleanupLoop,
        // Expose for server message handler:
        setInitialGameState: (state, localId, gameId, maxPlayers) => {
            log("Game: Setting initial state.");
            appState.serverState = state;
            appState.localPlayerId = localId;
            appState.currentGameId = gameId;
            appState.maxPlayersInGame = maxPlayers;
             // Set initial dimensions
             if (state && typeof state.canvas_width === 'number') {
                 appState.canvasWidth = state.canvas_width;
                 appState.canvasHeight = state.canvas_height;
                 // Consider triggering a resize in Renderer3D here if dimensions differ from default
                 // if (typeof Renderer3D !== 'undefined' && Renderer3D.handleResize) {
                 //     Renderer3D.handleResize(appState.canvasWidth, appState.canvasHeight); // Need to adapt handleResize signature
                 // }
             } else {
                  error("Initial state missing canvas dimensions!");
             }
            // Set initial position
            const initialPlayer = state?.players[localId];
            if (initialPlayer && typeof initialPlayer.x === 'number') {
                appState.predictedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y };
                appState.renderedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y };
            } else {
                // Fallback if player data missing
                appState.predictedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 };
                appState.renderedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 };
            }
            appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };
        },
        updateServerState: (newState) => {
            // Shift states for interpolation
            appState.lastServerState = appState.serverState;
            appState.serverState = newState;
            appState.lastStateReceiveTime = performance.now();
             // Update canvas dimensions if changed
             if (newState && typeof newState.canvas_width === 'number' &&
                 (appState.canvasWidth !== newState.canvas_width || appState.canvasHeight !== newState.canvas_height)) {
                 appState.canvasWidth = newState.canvas_width;
                 appState.canvasHeight = newState.canvas_height;
                  // Trigger renderer resize? (See above comment)
                 log(`Canvas dimensions updated to ${appState.canvasWidth}x${appState.canvasHeight}`);
             }
        },
        updateHostWaitUI: (state) => {
             const currentP = Object.keys(state?.players || {}).length;
             const maxP = appState.maxPlayersInGame || '?';
             if (DOM.waitingMessage) DOM.waitingMessage.textContent = `Waiting... (${currentP}/${maxP})`;
        },
        handlePlayerChat: (senderId, message) => {
            const isSelf = senderId === appState.localPlayerId;
            UIManager.addChatMessage(senderId, message, isSelf);
            // Add to speech bubble queue
            if (appState.serverState?.players?.[senderId]) {
                activeSpeechBubbles[senderId] = { text: message.substring(0, 50), endTime: performance.now() + SPEECH_BUBBLE_DURATION_MS };
            }
        },
        handleEnemyChat: (speakerId, message) => {
            if (speakerId && message) {
                 activeEnemyBubbles[speakerId] = { text: message.substring(0, 50), endTime: performance.now() + ENEMY_SPEECH_BUBBLE_DURATION_MS };
             }
        },
        handleDamageFeedback: (newState) => {
            // Check for local player damage
            const previousPlayerState = appState.lastServerState?.players?.[appState.localPlayerId];
            const currentPlayerState = newState?.players?.[appState.localPlayerId];
             let localPlayerDamagedThisTick = false;
             if (previousPlayerState && currentPlayerState &&
                 typeof currentPlayerState.health === 'number' && typeof previousPlayerState.health === 'number' &&
                 currentPlayerState.health < previousPlayerState.health)
             {
                 const damageTaken = previousPlayerState.health - currentPlayerState.health;
                 const baseMag = 5; const dmgScale = 0.18; const maxMag = 18;
                 const shakeMagnitude = Math.min(maxMag, baseMag + damageTaken * dmgScale);
                 if (Renderer3D?.triggerShake) Renderer3D.triggerShake(shakeMagnitude, 250);
                 else console.warn("Renderer3D or triggerShake missing on damage");
                 localPlayerDamagedThisTick = true;
                 SoundManager.playSound('damage'); // Play damage sound only on actual health loss
             }

             // Check for snake bite shake trigger
             if (currentPlayerState?.trigger_snake_bite_shake_this_tick) {
                 const shakeMag = 15.0; const shakeDur = 400.0;
                 if(Renderer3D?.triggerShake) Renderer3D.triggerShake(shakeMag, shakeDur);
                 else console.warn("Renderer3D or triggerShake missing on snake bite");
                 // Server handles removing the flag, client just reacts
             }

            // Update blood spark effects (moved from handleServerMessage)
             if (newState.enemies) {
                 const now = performance.now();
                 const sparkDuration = 300; // ms
                 for (const enemyId in newState.enemies) {
                     const enemy = newState.enemies[enemyId];
                     const previousEnemy = appState.lastServerState?.enemies?.[enemyId];
                     // Check if damage timestamp is new for this enemy
                     if (enemy && enemy.last_damage_time &&
                         (!previousEnemy || enemy.last_damage_time > (previousEnemy.last_damage_time || 0)))
                     {
                         // Check if the damage event is recent enough to trigger spark
                         const serverHitTimeMs = enemy.last_damage_time * 1000;
                         if (now - serverHitTimeMs < 250) { // Only spark for recent hits
                             activeBloodSparkEffects[enemyId] = now + sparkDuration;
                         }
                     }
                 }
                 // Cleanup old spark effects
                 for (const enemyId in activeBloodSparkEffects) {
                     if (now >= activeBloodSparkEffects[enemyId]) {
                         delete activeBloodSparkEffects[enemyId];
                     }
                 }
             }
        }
    };
})();

// --- Global Server Message Handler ---
function handleServerMessage(event) {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch (err) {
        error("Failed parse WS message:", err, event.data);
        return;
    }

    try {
        // Check if Renderer is needed and available
        const rendererNeeded = ['sp_game_started', 'game_joined', 'game_state', 'game_created', 'game_over_notification'].includes(data.type);
        if (rendererNeeded && typeof Renderer3D === 'undefined') {
            error(`Received '${data.type}' before Renderer3D module is available!`);
            // Maybe force disconnect or show error?
            return;
        }

        switch (data.type) {
            case 'game_created':
            case 'game_joined':
            case 'sp_game_started':
                log(`Received '${data.type}'`);
                GameManager.setInitialGameState(
                    data.initial_state,
                    data.player_id,
                    data.game_id,
                    data.max_players || data.initial_state?.max_players || (data.type === 'sp_game_started' ? 1 : '?')
                );

                if (data.type === 'game_created') {
                    if (DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR';
                    UIManager.updateStatus(`Hosted Game: ${appState.currentGameId}`);
                    GameManager.updateHostWaitUI(appState.serverState); // Update player count
                    UIManager.showSection('host-wait-section');
                } else {
                    const joinMsg = data.type === 'game_joined' ? `Joined ${appState.currentGameId}` : "Single Player Started!";
                    UIManager.updateStatus(joinMsg);
                    UIManager.showSection('game-area');
                    // Update UI with initial state
                    if (appState.serverState) {
                        UIManager.updateHUD(appState.serverState);
                        UIManager.updateCountdown(appState.serverState);
                        UIManager.updateDayNight(appState.serverState);
                        UIManager.updateEnvironmentDisplay(appState.serverState);
                    }
                    GameManager.startGameLoop(); // Start the loop now
                }
                break;

            case 'game_state':
                if (appState.mode === 'menu' || !appState.localPlayerId) return; // Ignore state updates if not in a game

                const previousStatus = appState.serverState?.status;
                GameManager.updateServerState(data.state); // Update state including dimensions
                const newState = appState.serverState; // Convenience ref to the new state

                 // Check for state transitions (e.g., waiting -> countdown -> active)
                 if (newState.status !== previousStatus) {
                     log(`[Client State Change] ${previousStatus || 'null'} -> ${newState.status}`);
                     if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') {
                         UIManager.updateStatus(newState.status === 'countdown' ? "Get Ready..." : "Active!");
                         UIManager.showSection('game-area');
                         if (!appState.isGameLoopRunning) GameManager.startGameLoop();
                     } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') {
                         UIManager.updateStatus("Waiting for players...");
                         UIManager.showSection('host-wait-section');
                         GameManager.updateHostWaitUI(newState);
                         GameManager.cleanupLoop(); // Stop loop if back to waiting
                     } else if (newState.status === 'finished' && previousStatus !== 'finished') {
                         log("-> Game Over reported via 'finished' status.");
                         UIManager.updateStatus("Game Over!");
                         UIManager.showGameOver(newState); // Show game over screen
                         GameManager.cleanupLoop(); // Stop the loop
                     }
                 }

                // Update UI elements based on the new state if game is running
                if (appState.isGameLoopRunning && (newState.status === 'countdown' || newState.status === 'active')) {
                    UIManager.updateHUD(newState);
                    UIManager.updateCountdown(newState);
                    UIManager.updateDayNight(newState);
                    UIManager.updateEnvironmentDisplay(newState);
                } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') {
                     GameManager.updateHostWaitUI(newState); // Keep host wait UI updated
                }

                // Handle enemy speech bubbles
                GameManager.handleEnemyChat(newState.enemy_speaker_id, newState.enemy_speech_text);
                // Handle damage feedback (screen shake, sound, blood sparks)
                GameManager.handleDamageFeedback(newState);
                // Update snake state for renderer
                 if (newState.snake_state && typeof snake !== 'undefined') {
                     snake.isActiveFromServer = newState.snake_state.active;
                     snake.serverHeadX = newState.snake_state.head_x;
                     snake.serverHeadY = newState.snake_state.head_y;
                     snake.serverBaseY = newState.snake_state.base_y;
                     // Client snake visual update handled in its own update function or by Renderer3D
                 } else if (typeof snake !== 'undefined') {
                     snake.isActiveFromServer = false; // Ensure deactivated if no state sent
                 }
                break;

            case 'game_over_notification':
                 log("Received 'game_over_notification'");
                 if (data.final_state) {
                     appState.serverState = data.final_state; // Store final state
                     UIManager.updateStatus("Game Over!");
                     UIManager.showGameOver(data.final_state);
                     log("-> Game Over processed via notification.");
                 } else {
                     error("Game over notification missing final_state. Resetting.");
                     UIManager.showGameOver(null); // Show basic game over if state missing
                 }
                 GameManager.cleanupLoop(); // Stop the loop
                 break;

            case 'chat_message':
                 GameManager.handlePlayerChat(data.sender_id, data.message);
                 break;

            case 'error':
                error("[Client] Received Server Error:", data.message);
                UIManager.updateStatus(`Error: ${data.message}`, true);
                // Handle specific errors that should change UI state
                const isJoinError = appState.mode === 'multiplayer-client' && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'));
                const isHostError = appState.mode === 'multiplayer-host' && data.message.includes('Creation Error');
                if (isJoinError) {
                    UIManager.showSection('join-code-section'); // Go back to join input
                    appState.mode = 'menu'; // Reset mode
                } else if (isHostError) {
                    GameManager.resetClientState(true); // Go back to main menu
                } else if (data.message === 'Please create or join a game first.') {
                    GameManager.resetClientState(true); // Go back to main menu if server lost track
                }
                break;

            default:
                log(`Unknown message type received: ${data.type}`);
        }
    } catch (handlerError) {
        error("Error in handleServerMessage:", handlerError, "Data:", data);
    }
}

// --- DOMContentLoaded Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded. Initializing...");

    // Ensure essential DOM elements exist
    if (!DOM.gameContainer || !DOM.loadingScreen || !DOM.canvasWrapper || !DOM.gameCanvas) {
         error("CRITICAL: Essential DOM elements missing! Cannot initialize.");
         document.body.innerHTML = "<p style='color:red; text-align: center;'>Error: Critical UI elements not found. Cannot load game.</p>";
         return;
    }

    // Initialize Renderer (assuming Renderer3D.init now takes the canvas element)
    if (typeof Renderer3D === 'undefined' || !Renderer3D.init) {
        error("CRITICAL: Renderer3D module not loaded or init function missing!");
        UIManager.updateStatus("Init Error: Renderer failed.", true);
         DOM.loadingScreen.classList.remove('active'); // Hide loading
         DOM.gameContainer.classList.add('loaded');    // Show container
        return;
    }
    // Pass the actual canvas element to the renderer
    if (!Renderer3D.init(DOM.gameCanvas, appState.canvasWidth, appState.canvasHeight)) {
        error("Renderer3D initialization failed!");
        UIManager.updateStatus("Init Error: Graphics failed.", true);
        DOM.loadingScreen.classList.remove('active');
        DOM.gameContainer.classList.add('loaded');
        return;
    }
    log("Renderer3D initialized.");

    // Initialize Sound Manager (user interaction might be needed later)
    SoundManager.init();

    // Initialize button listeners
    try {
        GameManager.initListeners();
    } catch(listenerError) {
        error("Error initializing listeners:", listenerError);
        UIManager.updateStatus("Init Error: Controls failed.", true);
        // Continue loading other parts if possible
    }

    // Connect to WebSocket Server
    UIManager.updateStatus("Initializing Connection...");
    NetworkManager.connect(() => {
        // Optional: Callback on successful *initial* connection
        log("Initial WebSocket connection successful.");
    });

     // Hide loading screen initially (NetworkManager.connect handles showing game container on OPEN)
     // DOM.loadingScreen.classList.remove('active'); // Moved to WS onopen

});
