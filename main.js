// main.js v3
// Client-side logic for Kelly Gang Survival
// Incorporates Phase 1 fixes, boundary awareness, aiming fix, refined renderer interaction, more sounds.

import * K THREE from 'three'; // Used for Vector3
import Renderer3D from './Renderer3D.js';

console.log("--- main.js v3: Initializing ---");

// --- Constants ---
const WEBSOCKET_URL = determineWebSocketUrl(); // Dynamically determine WS URL
const SHOOT_COOLDOWN = 100; // Base cooldown ms
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33; // ~30Hz
const RECONNECT_DELAY = 3000; // ms
const DEFAULT_WORLD_WIDTH = 2000; // Fallback if server doesn't provide
const DEFAULT_WORLD_HEIGHT = 1500;
const INTERPOLATION_BUFFER_MS = 100; // Render slightly behind server time
const SPEECH_BUBBLE_DURATION_MS = 4000;
const ENEMY_SPEECH_BUBBLE_DURATION_MS = 3000;
const PUSHBACK_ANIM_DURATION = 250; // ms
const MUZZLE_FLASH_DURATION = 75; // ms
const RESIZE_DEBOUNCE_MS = 150; // ms

// Player State Constants (match server)
const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function determineWebSocketUrl() { return window.location.protocol === "https:" ? `wss://${window.location.host}/ws` : `ws://${window.location.host}/ws`; }
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

// --- DOM References ---
const DOM = {
    loadingScreen: document.getElementById('loading-screen'),
    gameContainer: document.getElementById('game-container'),
    topBar: document.getElementById('top-bar'),
    gameStatus: document.getElementById('game-status'),
    menuArea: document.getElementById('menu-area'), // Use to toggle visibility via class
    mainMenuSection: document.getElementById('main-menu-section'),
    multiplayerMenuSection: document.getElementById('multiplayer-menu-section'),
    hostWaitSection: document.getElementById('host-wait-section'),
    joinCodeSection: document.getElementById('join-code-section'),
    gameArea: document.getElementById('game-area'), // Container for 3 columns
    // Left Panel Elements
    statsPanel: document.getElementById('stats-panel'),
    playerStatsGrid: document.getElementById('player-stats-grid'),
    environmentInfo: document.getElementById('environment-info'),
    dayNightIndicator: document.getElementById('day-night-indicator'),
    temperatureIndicator: document.getElementById('temperature-indicator'),
    gameControls: document.querySelector('#stats-panel .game-controls'), // Controls are now in stats panel
    muteBtn: document.getElementById('muteBtn'),
    leaveGameBtn: document.getElementById('leaveGameBtn'),
    // Middle Panel Elements
    canvasContainer: document.getElementById('canvas-container'),
    countdownDiv: document.getElementById('countdown-overlay'),
    htmlOverlay: document.getElementById('html-overlay'),
    // Right Panel Elements
    chatPanel: document.getElementById('chat-panel'),
    chatLog: document.getElementById('chat-log'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    // Other UI
    gameOverScreen: document.getElementById('game-over-screen'),
    finalStatsDiv: document.getElementById('final-stats'),
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
    backButtons: document.querySelectorAll('.button-back'),
};

// --- Application State ---
// Central state object for the client
let appState = {
    mode: 'menu', // 'menu', 'singleplayer', 'multiplayer-host', 'multiplayer-client'
    localPlayerId: null,
    currentGameId: null,
    maxPlayersInGame: null,
    serverState: null,          // Latest full state from server
    lastServerState: null,      // Previous full state for interpolation
    lastStateReceiveTime: 0,    // timestamp of last state arrival
    animationFrameId: null,     // ID for canceling the game loop
    isConnected: false,
    isGameLoopRunning: false,
    isRendererReady: false,
    // World dimensions - Updated from server initial state
    worldWidth: DEFAULT_WORLD_WIDTH,
    worldHeight: DEFAULT_WORLD_HEIGHT,
    // Player position state for prediction/reconciliation/rendering
    renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, // Smoothed position for rendering
    predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, // Position based on local input
    // Input/Aiming state
    mouseWorldPosition: new THREE.Vector3(0, 0, 0), // World coords under cursor (on ground plane y=0)
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, // Normalized aim direction sent for rotation
    // UI related state mirrored from server or calculated by renderer
    uiPositions: {},            // Screen coords { id: { screenX, screenY } } calculated by renderer
    currentTemp: 18.0,
    isRaining: false,
    isDustStorm: false,
    isNight: false,
};

// --- Local Effects State ---
// Visual effects triggered immediately on client, independent of server state arrival
// Renderer uses these for visual flair. Casings/Sparks are now triggered via API calls.
let localEffects = {
    muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 },
    pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION },
    snake: { // Snake data passed to renderer (structure matches server)
        active: false,
        segments: [],
    }
    // activeAmmoCasings - Removed (managed by renderer via API call)
    // activeBloodSparkEffects - Removed (managed by renderer via API call)
};

// --- HTML Overlay Object Pools ---
// Reuses DOM elements for performance (damage text, speech bubbles)
const overlayElementPools = {
    damageText: { elements: {}, inactive: [] },
    speechBubble: { elements: {}, inactive: [] },
};

// --- Core Modules ---
let socket = null;
let reconnectTimer = null;
let lastLoopTime = 0; // Use performance.now()
let resizeHandler = null;

// --- Sound Manager Module --- (Self-contained, assumed functional from previous version)
const SoundManager = (() => {
    let audioContext = null; let gainNode = null; let loadedSounds = {};
    let soundFiles = {
        'shoot': 'assets/sounds/shoot.mp3',
        'damage': 'assets/sounds/damage.mp3', // Player hit
        'powerup': 'assets/sounds/powerup.mp3',
        'death': 'assets/sounds/death.mp3',   // Player death / Game Over
        'enemy_hit': 'assets/sounds/enemy_hit.mp3',
        'enemy_death': 'assets/sounds/enemy_death.mp3', // #TODO: Add this sound file
        'ui_click': 'assets/sounds/ui_click.mp3',   // #TODO: Add this sound file
        'footstep': 'assets/sounds/footstep.mp3', // #TODO: Add and implement
    };
    let isInitialized = false; let canPlaySound = false; let isMuted = false;
    function init() { /* ... same as before ... */
        if (isInitialized) return; isInitialized = true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { error("[SM] Web Audio API not supported."); return; }
            audioContext = new AC(); gainNode = audioContext.createGain(); gainNode.connect(audioContext.destination);
            const r = () => { if (audioContext.state === 'suspended') { audioContext.resume().then(() => { log("[SM] Audio Resumed."); canPlaySound = true; loadSounds(); }).catch(e => error("[SM] Resume failed:", e)); } document.removeEventListener('click', r); document.removeEventListener('keydown', r); };
            if (audioContext.state === 'suspended') { document.addEventListener('click', r, { once: true }); document.addEventListener('keydown', r, { once: true }); log("[SM] Audio suspended. Waiting for user interaction.");}
            else if (audioContext.state === 'running') { canPlaySound = true; loadSounds(); }
        } catch (e) { error("[SM] Init error:", e); }
    }
    function loadSounds() { /* ... same as before ... */
        if (!audioContext || !canPlaySound) return;
        log("[SM] Loading sounds...");
        const promises = Object.entries(soundFiles).map(([name, path]) =>
            fetch(path).then(r => r.ok ? r.arrayBuffer() : Promise.reject(`HTTP ${r.status}`))
                .then(b => audioContext.decodeAudioData(b))
                .then(db => { loadedSounds[name] = db; /* log(`[SM] Loaded: ${name}`); */ })
                .catch(e => { error(`[SM] Load/Decode '${name}' error:`, e); })
        ); Promise.allSettled(promises).then(() => log("[SM] Sound loading finished."));
    }
    function playSound(name, volume = 1.0) { /* ... same as before ... */
        if (!canPlaySound || !audioContext || !gainNode || audioContext.state !== 'running') return;
        const buffer = loadedSounds[name]; if (!buffer) { /* console.warn(`[SM] Sound not loaded: ${name}`); */ return; }
        if (isMuted && name !== 'ui_click') return; // Allow UI clicks even when muted? Optional.
        try {
            const source = audioContext.createBufferSource(); source.buffer = buffer;
            const soundGain = audioContext.createGain(); soundGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime);
            source.connect(soundGain).connect(gainNode); // Connect through local gain to master gain
            source.start(0); source.onended = () => { try { source.disconnect(); soundGain.disconnect(); } catch(e){} };
        } catch (e) { error(`[SM] Play '${name}' error:`, e); }
    }
    function toggleMute() { /* ... same as before ... */
        isMuted = !isMuted; if (gainNode) gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext?.currentTime || 0);
        log(`[SM] Sound ${isMuted ? 'Muted' : 'Unmuted'}`);
        if (DOM.muteBtn) { DOM.muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; DOM.muteBtn.setAttribute('aria-pressed', isMuted); DOM.muteBtn.classList.toggle('muted', isMuted); }
    }
    function getMuteState() { return isMuted; }
    return { init, playSound, toggleMute, getMuteState };
})();

// --- UI Manager Module ---
const UIManager = (() => {
    const allMenuSections = [ DOM.mainMenuSection, DOM.multiplayerMenuSection, DOM.hostWaitSection, DOM.joinCodeSection ];
    // Shows a specific top-level UI area (menu section, game area, game over)
    function showSection(sectionId) {
        // Hide all potentially visible major sections first
        DOM.menuArea?.classList.add('hidden'); // Hide entire menu container
        allMenuSections.forEach(s => s?.classList.remove('active')); // Deactivate specific menu sections
        DOM.gameArea?.classList.remove('active');
        DOM.gameOverScreen?.classList.remove('active');

        const sectionToShow = document.getElementById(sectionId);
        if (sectionToShow) {
            sectionToShow.classList.add('active');
            // If the section is within the menu container, make the container visible
            if (sectionToShow.closest('#menu-area')) {
                DOM.menuArea?.classList.remove('hidden');
            }
        } else {
            error(`UI: Section not found: ${sectionId}`);
        }
    }
    // Updates the status message bar
    function updateStatus(message, isError = false) {
        if (!DOM.gameStatus) return;
        DOM.gameStatus.textContent = message;
        DOM.gameStatus.style.color = isError ? (getCssVar('--color-danger') || 'red') : (getCssVar('--color-accent') || 'yellow');
    }
    // Updates the player stats grid in the HUD
    function updateHUD(serverState) {
        if (!DOM.playerStatsGrid || !serverState?.players || !appState.localPlayerId) {
            if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = ''; // Clear if no state/player
            return;
        }
        const players = serverState.players;
        const localId = appState.localPlayerId;
        DOM.playerStatsGrid.innerHTML = ''; // Clear previous stats

        // Sort players: local player first, then by ID
        const sortedPlayerIds = Object.keys(players).sort((a, b) => {
            if (a === localId) return -1; if (b === localId) return 1;
            return a.localeCompare(b);
        });

        sortedPlayerIds.forEach(pId => {
            const pData = players[pId]; if (!pData) return;
            const isSelf = (pId === localId);
            const header = isSelf ? "YOU" : `P:${pId.substring(0, 4)}`;
            const status = pData.player_status || PLAYER_STATUS_ALIVE;
            let healthDisplay;
            // Format health/status display
            if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--color-down-status);'>DOWN</span>`;
            else if (status === PLAYER_STATUS_DEAD || pData.health <= 0) healthDisplay = `<span style='color: var(--color-dead-status);'>DEAD</span>`;
            else { const hp = pData.health ?? 0; let color = 'var(--color-health-high)'; if (hp < 66) color = 'var(--color-health-medium)'; if (hp < 33) color = 'var(--color-health-low)'; healthDisplay = `<span style='color:${color};'>${hp.toFixed(0)}</span>`; }
            // Format armor display
            const armor = pData.armor ?? 0; let armorDisplay = Math.round(armor); if(armor > 0) armorDisplay = `<span style='color: var(--color-armor);'>${armorDisplay}</span>`;
            // Create stats box element
            const box = document.createElement('div'); box.className = 'stats-box';
            box.innerHTML = `<div class="stats-header">${header}</div>` +
                            `<div class="stats-content">` +
                            `<span>HP:</span> ${healthDisplay}<br>` +
                            `<span>Armor:</span> ${armorDisplay}<br>` +
                            `<span>Gun:</span> ${pData.gun ?? 1}<br>` +
                            `<span>Speed:</span> ${pData.speed ?? '-'}<br>` +
                            `<span>Kills:</span> ${pData.kills ?? 0}<br>` +
                            `<span>Score:</span> ${pData.score ?? 0}` +
                            `</div>`;
            DOM.playerStatsGrid.appendChild(box);
        });
    }
    // Adds a message to the chat log
    function addChatMessage(senderId, message, isSystem = false) {
        if (!DOM.chatLog) return;
        const div = document.createElement('div');
        const isSelf = senderId === appState.localPlayerId;
        let senderName = 'System';
        if (!isSystem) { senderName = isSelf ? 'You' : `P:${senderId ? senderId.substring(0, 4) : '???'}`; }
        div.classList.add('chat-message', isSystem ? 'system-message' : (isSelf ? 'my-message' : 'other-message'));
        div.textContent = isSystem ? message : `${senderName}: ${message}`;
        DOM.chatLog.appendChild(div);
        // Auto-scroll to bottom
        DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
    }
    // Updates the countdown overlay
    function updateCountdown(serverState) {
        if (!DOM.countdownDiv) return;
        const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0;
        if (isCountdown) {
            DOM.countdownDiv.textContent = Math.ceil(serverState.countdown);
            DOM.countdownDiv.classList.add('active');
        } else {
            DOM.countdownDiv.classList.remove('active');
        }
    }
    // Updates environment indicators (Day/Night, Temp) and applies CSS classes
    function updateEnvironmentDisplay(serverState) {
        if (!DOM.dayNightIndicator || !DOM.temperatureIndicator || !DOM.gameContainer) return;
        if (serverState?.status === 'active' || serverState?.status === 'countdown') { // Show during countdown too
            const isNight = serverState.is_night ?? false; appState.isNight = isNight;
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day';
            DOM.dayNightIndicator.style.display = 'block';
            DOM.gameContainer.classList.toggle('night-mode', isNight);

            appState.currentTemp = serverState.current_temperature ?? 18.0;
            appState.isRaining = serverState.is_raining ?? false;
            appState.isDustStorm = serverState.is_dust_storm ?? false;
            DOM.temperatureIndicator.textContent = `${appState.currentTemp.toFixed(0)}°C`;
            DOM.temperatureIndicator.style.display = 'block';

            // Toggle weather classes for potential CSS effects
            DOM.gameContainer.classList.toggle('raining', appState.isRaining);
            DOM.gameContainer.classList.toggle('dust-storm', appState.isDustStorm);
        } else { // Hide if not in active game state
            DOM.dayNightIndicator.style.display = 'none';
            DOM.temperatureIndicator.style.display = 'none';
            DOM.gameContainer.classList.remove('night-mode', 'raining', 'dust-storm');
            appState.isNight = false; appState.isRaining = false; appState.isDustStorm = false;
        }
    }
    // Displays the game over screen with final stats
    function showGameOver(finalState) {
        if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return;
        const player = finalState?.players?.[appState.localPlayerId];
        let statsHtml = "---"; // Default if stats unavailable
        if (player) {
            statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div>` +
                        `<div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`;
        }
        DOM.finalStatsDiv.innerHTML = statsHtml;
        log("UI: Showing game over screen.");
        showSection('game-over-screen'); // Make the game over screen visible
    }
    // Updates HTML overlays (damage text, speech bubbles) based on calculated screen positions
    function updateHtmlOverlays() {
        if (!DOM.htmlOverlay || !appState.serverState || !appState.uiPositions) return;
        const overlay = DOM.htmlOverlay;
        const now = performance.now();
        const pools = overlayElementPools;
        const state = appState.serverState;
        const uiPos = appState.uiPositions;

        // Sets to track which elements are active this frame
        const activeElements = { damageText: new Set(), speechBubble: new Set() };

        // Helper to get/create/recycle pool elements
        const getElement = (poolName, id, className) => {
            const pool = pools[poolName]; let el = pool.elements[id];
            if (!el) { el = pool.inactive.pop(); if (!el) { el = document.createElement('div'); overlay.appendChild(el); } else { el.style.display = 'block'; } pool.elements[id] = el; el.className = className; } return el;
        };
        // Helper to release elements back to the pool
        const releaseElement = (poolName, id) => { const pool = pools[poolName]; const el = pool.elements[id]; if (el) { el.style.display = 'none'; el.textContent = ''; el.className = ''; pool.inactive.push(el); delete pool.elements[id]; } };

        // Update Damage Texts
        if (state.damage_texts) {
            for (const id in state.damage_texts) {
                const dtData = state.damage_texts[id]; const posData = uiPos[id]; if (!posData) continue; // Need screen position
                activeElements.damageText.add(id);
                const element = getElement('damageText', id, 'overlay-element damage-text-overlay');
                element.textContent = dtData.text;
                element.classList.toggle('crit', dtData.is_crit || false);
                // Calculate lifetime progress
                const lifeTime = (dtData.lifetime || 0.75) * 1000;
                const spawnTime = dtData.spawn_time * 1000; // Assuming server sends spawn time in seconds
                const elapsed = now - spawnTime;
                const progress = Math.min(1, elapsed / lifeTime);
                // Animate position and opacity
                const verticalOffset = -(progress * 50); // Move up
                element.style.left = `${posData.screenX}px`;
                element.style.top = `${posData.screenY + verticalOffset}px`;
                element.style.opacity = Math.max(0, 1.0 - (progress * 0.9)).toFixed(2); // Fade out
            }
        }
        // Release inactive damage texts
        for (const id in pools.damageText.elements) { if (!activeElements.damageText.has(id)) releaseElement('damageText', id); }

        // Update Speech Bubbles
        const currentBubbles = {}; // Collect active bubbles from players and enemies
        if (state.players) { Object.entries(state.players).forEach(([id, pData]) => { if (pData?.speechBubble) currentBubbles[id] = { ...pData.speechBubble, source: 'player' }; }); }
        if (state.enemy_speaker_id && state.enemy_speech_text) { currentBubbles[state.enemy_speaker_id] = { text: state.enemy_speech_text, endTime: now + ENEMY_SPEECH_BUBBLE_DURATION_MS, source: 'enemy' }; }

        for (const id in currentBubbles) {
            const bubbleData = currentBubbles[id]; const posData = uiPos[id]; if (!posData) continue; // Need screen position
            // Check bubble lifetime for player bubbles
            if (bubbleData.source === 'player' && bubbleData.endTime && now > bubbleData.endTime) continue;

            activeElements.speechBubble.add(id);
            const element = getElement('speechBubble', id, 'overlay-element speech-bubble');
            element.textContent = bubbleData.text.substring(0, 50); // Limit length
            const yOffset = -60; // Position above the projected point
            element.style.left = `${posData.screenX}px`;
            element.style.top = `${posData.screenY + yOffset}px`;
            element.style.opacity = 1.0;
        }
        // Release inactive speech bubbles
        for (const id in pools.speechBubble.elements) { if (!activeElements.speechBubble.has(id)) releaseElement('speechBubble', id); }
    }

    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateEnvironmentDisplay, showGameOver, updateHtmlOverlays };
})();

// --- Network Manager Module ---
const NetworkManager = (() => {
    function connect(onOpenCallback) {
        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) { if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); return; }
        clearTimeout(reconnectTimer); UIManager.updateStatus('Connecting...'); log("WS connect:", WEBSOCKET_URL);
        try { socket = new WebSocket(WEBSOCKET_URL); } catch (err) { error("WS creation failed:", err); UIManager.updateStatus('Connection failed.', true); return; }
        socket.onopen = () => { log('WS open.'); appState.isConnected = true; DOM.loadingScreen?.classList.remove('active'); DOM.gameContainer?.classList.add('loaded'); UIManager.updateStatus('Connected.'); if (!appState.localPlayerId) UIManager.showSection('main-menu-section'); if (onOpenCallback) onOpenCallback(); };
        socket.onmessage = handleServerMessage;
        socket.onerror = (event) => { error('WS Error:', event); /* Consider updating status */ };
        socket.onclose = (event) => {
            error(`WS Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`);
            const wasConnected = appState.isConnected; appState.isConnected = false; socket = null;
            GameManager.cleanupLoop(); // Stop game loop on disconnect
            if (appState.mode !== 'menu') GameManager.resetClientState(false); // Reset if in game/host, don't show menu yet
            if (event.code === 1000 || event.code === 1001 || event.code === 1005) { UIManager.updateStatus('Disconnected.'); UIManager.showSection('main-menu-section'); } // Normal close
            else if (wasConnected) { UIManager.updateStatus('Connection lost. Retrying...', true); scheduleReconnect(); } // Unexpected close while connected
            else { UIManager.updateStatus('Connection failed.', true); UIManager.showSection('main-menu-section'); } // Initial connection failed
        };
    }
    function scheduleReconnect() { clearTimeout(reconnectTimer); log(`Reconnect attempt in ${RECONNECT_DELAY}ms`); reconnectTimer = setTimeout(() => { log("Attempting reconnect..."); connect(() => { UIManager.updateStatus('Reconnected.'); UIManager.showSection('main-menu-section'); }); }, RECONNECT_DELAY); }
    function sendMessage(payload) { if (socket && socket.readyState === WebSocket.OPEN) { try { socket.send(JSON.stringify(payload)); } catch (err) { error("Send error:", err, payload); } } }
    function closeConnection(code = 1000, reason = "User action") { clearTimeout(reconnectTimer); if (socket && socket.readyState === WebSocket.OPEN) { log(`Closing WS connection: ${reason} (${code})`); socket.close(code, reason); } socket = null; appState.isConnected = false; }
    return { connect, sendMessage, closeConnection };
})();

// --- Input Manager Module ---
const InputManager = (() => {
    let keys = {}; // Tracks currently pressed keys
    let lastShotTime = 0;
    let inputInterval = null; // Interval timer for sending movement
    let mouseScreenPos = { x: 0, y: 0 }; // Last known mouse position on canvas
    let isMouseDown = false; // Left mouse button state
    let isRightMouseDown = false; // Right mouse button state
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(); // Normalized device coordinates for raycasting

    // Prevent browser context menu over the game canvas
    function preventContextMenu(event) { if (DOM.canvasContainer?.contains(event.target)) event.preventDefault(); }

    // Set up all input event listeners
    function setup() {
        cleanup(); log("Input: Setting up listeners...");
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        DOM.chatInput?.addEventListener('keydown', handleChatEnter); // Enter key in chat
        DOM.canvasContainer?.addEventListener('mousemove', handleMouseMove);
        DOM.canvasContainer?.addEventListener('mousedown', handleMouseDown);
        DOM.canvasContainer?.addEventListener('contextmenu', preventContextMenu); // Prevent right-click menu
        document.addEventListener('mouseup', handleMouseUp); // Listen on document to catch mouseup outside canvas
        inputInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL); // Periodically send movement
    }

    // Remove all input event listeners
    function cleanup() {
        log("Input: Cleaning up listeners...");
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput?.removeEventListener('keydown', handleChatEnter);
        DOM.canvasContainer?.removeEventListener('mousemove', handleMouseMove);
        DOM.canvasContainer?.removeEventListener('mousedown', handleMouseDown);
        DOM.canvasContainer?.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('mouseup', handleMouseUp);
        clearInterval(inputInterval); inputInterval = null;
        keys = {}; isMouseDown = false; isRightMouseDown = false; mouseScreenPos = { x: 0, y: 0 };
    }

    // Handle mouse movement over the canvas for aiming
    function handleMouseMove(event) {
        if (!DOM.canvasContainer || !appState.isRendererReady || !Renderer3D.getCamera || !Renderer3D.getGroundPlane || !appState.isGameLoopRunning) return;
        const rect = DOM.canvasContainer.getBoundingClientRect();
        const canvasX = event.clientX - rect.left; const canvasY = event.clientY - rect.top;
        mouseScreenPos.x = canvasX; mouseScreenPos.y = canvasY;
        // Convert screen coordinates to Normalized Device Coordinates (NDC)
        mouseNDC.x = (canvasX / rect.width) * 2 - 1;
        mouseNDC.y = -(canvasY / rect.height) * 2 + 1;
        // Raycast from camera to ground plane to find world position under cursor
        const camera = Renderer3D.getCamera(); const groundPlane = Renderer3D.getGroundPlane();
        if (camera && groundPlane) {
            try {
                raycaster.setFromCamera(mouseNDC, camera);
                const intersects = raycaster.intersectObject(groundPlane);
                if (intersects.length > 0) {
                    appState.mouseWorldPosition.copy(intersects[0].point); // Update world position state
                }
            } catch (e) { error("Input: Raycasting error:", e); }
        }
    }
    // Handle mouse button presses
    function handleMouseDown(event) {
        if (document.activeElement === DOM.chatInput) return; // Ignore clicks if typing in chat
        if (event.button === 0) isMouseDown = true; // Left click down
        else if (event.button === 2) { isRightMouseDown = true; event.preventDefault(); triggerPushbackCheck(); } // Right click down
    }
    // Handle mouse button releases
    function handleMouseUp(event) {
        if (event.button === 0) isMouseDown = false; // Left click up
        if (event.button === 2) isRightMouseDown = false; // Right click up
    }
    // Handle keyboard key presses
    function handleKeyDown(event) {
        if (document.activeElement === DOM.chatInput) return; // Ignore game keys if typing in chat
        const key = event.key.toLowerCase();
        // Track movement keys state
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            if (!keys[key]) keys[key] = true; event.preventDefault();
        }
        // Handle shooting (space bar press)
        if (key === ' ' && !keys[' ']) {
            keys[' '] = true; handleShooting(); event.preventDefault();
        }
        // Handle pushback (E key press)
        if (key === 'e' && !keys['e']) {
            keys['e'] = true; triggerPushbackCheck(); event.preventDefault();
        }
    }
    // Handle keyboard key releases
    function handleKeyUp(event) {
        const key = event.key.toLowerCase();
        // Update movement keys state
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) {
            keys[key] = false;
        }
    }
    // Handle Enter key press in chat input
    function handleChatEnter(event) { if (event.key === 'Enter') { event.preventDefault(); GameManager.sendChatMessage(); } }

    // Calculate normalized movement vector based on currently pressed keys
    function getMovementInputVector() {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) { const factor = Math.SQRT1_2; dx *= factor; dy *= factor; }
        return { dx, dy };
    }

    // Send current movement input to the server periodically
    function sendMovementInput() {
        if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'player_move', direction: getMovementInputVector() });
        }
    }

    // Trigger local pushback effect and notify server
    function triggerPushbackCheck() {
        if (appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) {
            GameManager.triggerLocalPushback(); // Handles effect and message sending
        }
    }

    // Handle shooting logic (called on key press or mouse down)
    function handleShooting() {
        if (!appState.isRendererReady || appState.serverState?.status !== 'active' || !appState.localPlayerId) return;
        const playerState = appState.serverState?.players?.[appState.localPlayerId];
        if (!playerState || playerState.player_status !== PLAYER_STATUS_ALIVE) return; // Can't shoot if not alive

        const nowTimestamp = Date.now();
        const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire';
        const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier;

        // Check cooldown
        if (nowTimestamp - lastShotTime < actualCooldown) return;
        lastShotTime = nowTimestamp;

        // --- AIMING FIX ---
        // Use PREDICTED position for aim calculation for immediate feedback
        const playerPredictX = appState.predictedPlayerPos.x;
        const playerPredictZ = appState.predictedPlayerPos.y; // Z in world space
        const targetWorldPos = appState.mouseWorldPosition; // From raycast

        let aimDx = 0, aimDy = -1; // Default aim forward
        if (targetWorldPos && typeof playerPredictX === 'number' && typeof playerPredictZ === 'number') {
            aimDx = targetWorldPos.x - playerPredictX;
            aimDy = targetWorldPos.z - playerPredictZ; // Use Z for world direction
            const magSq = aimDx * aimDx + aimDy * aimDy;
            if (magSq > 0.01) { // Avoid division by zero/tiny numbers
                const mag = Math.sqrt(magSq);
                aimDx /= mag;
                aimDy /= mag;
            } else {
                aimDx = 0; aimDy = -1; // Fallback if target is too close
            }
        }
        // Update shared aim state used by renderer for player rotation
        appState.localPlayerAimState.lastAimDx = aimDx;
        appState.localPlayerAimState.lastAimDy = aimDy;

        // Trigger local visual effects
        localEffects.muzzleFlash.active = true;
        localEffects.muzzleFlash.endTime = performance.now() + MUZZLE_FLASH_DURATION;
        localEffects.muzzleFlash.aimDx = aimDx; localEffects.muzzleFlash.aimDy = aimDy;
        SoundManager.playSound('shoot');

        // Spawn visual ammo casing via Renderer API
        if (Renderer3D.spawnVisualAmmoCasing) {
             const spawnPos = new THREE.Vector3(playerPredictX, 0, playerPredictZ); // Use predicted pos for visual spawn origin
             const ejectVec = new THREE.Vector3(aimDx, 0, aimDy); // Eject based on aim direction
             Renderer3D.spawnVisualAmmoCasing(spawnPos, ejectVec);
        }

        // Send shoot message to server with TARGET world coordinates
        NetworkManager.sendMessage({
            type: 'player_shoot',
            target: { x: targetWorldPos.x, y: targetWorldPos.z } // Send target position, server calculates trajectory
        });
    }

    // Update function called every frame from the game loop
    function update(deltaTime) {
         // Handle continuous shooting if space or mouse button is held down
         if (keys[' ']) handleShooting();
         if (isMouseDown) handleShooting();
         // #TODO: Potentially add footstep sounds based on movement keys state and player status
    }

    return { setup, cleanup, update, getMovementInputVector };
})();

// --- Game Manager Module ---
const GameManager = (() => {
    let isInitialized = false;

    // Initialize event listeners for buttons and UI elements
    function initListeners() {
        if (isInitialized) return; log("Game: Initializing listeners...");
        // Menu Buttons
        DOM.singlePlayerBtn?.addEventListener('click', () => { SoundManager.init(); SoundManager.playSound('ui_click'); startSinglePlayer(); });
        DOM.multiplayerBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); UIManager.showSection('multiplayer-menu-section'); });
        const hostHandler = (maxP) => { SoundManager.init(); SoundManager.playSound('ui_click'); hostMultiplayer(maxP); };
        DOM.hostGameBtn2?.addEventListener('click', () => hostHandler(2)); DOM.hostGameBtn3?.addEventListener('click', () => hostHandler(3)); DOM.hostGameBtn4?.addEventListener('click', () => hostHandler(4));
        DOM.showJoinUIBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); UIManager.showSection('join-code-section'); });
        DOM.joinGameSubmitBtn?.addEventListener('click', () => { SoundManager.init(); SoundManager.playSound('ui_click'); joinMultiplayer(); });
        // In-Game / Global Buttons
        DOM.cancelHostBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); leaveGame(); });
        DOM.sendChatBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); sendChatMessage(); });
        DOM.leaveGameBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); leaveGame(); });
        DOM.gameOverBackBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); resetClientState(true); });
        DOM.muteBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click'); SoundManager.toggleMute(); });
        if(DOM.muteBtn) { DOM.muteBtn.textContent = SoundManager.getMuteState() ? 'Unmute' : 'Mute'; DOM.muteBtn.setAttribute('aria-pressed', SoundManager.getMuteState()); DOM.muteBtn.classList.toggle('muted', SoundManager.getMuteState()); }
        // Generic Back Buttons
        DOM.backButtons.forEach(btn => {
            const targetId = btn.dataset.target;
            if (targetId && document.getElementById(targetId)) {
                btn.addEventListener('click', (e) => { e.preventDefault(); SoundManager.playSound('ui_click'); UIManager.showSection(targetId); });
            } else { log(`Warn: Back button missing/invalid target: ${targetId}`, btn); }
        });
        isInitialized = true; log("Game: Listeners initialized.");
    }
    // --- Game Mode Actions ---
    function startSinglePlayer() { log("Requesting Single Player game..."); appState.mode = 'singleplayer'; UIManager.updateStatus("Starting Single Player..."); NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'start_single_player' })); }
    function joinMultiplayer() { const gameId = DOM.gameIdInput?.value.trim().toUpperCase(); if (!gameId || gameId.length !== 6) { UIManager.updateStatus('Invalid Game ID (6 chars).', true); return; } log(`Joining MP game: ${gameId}`); appState.mode = 'multiplayer-client'; UIManager.updateStatus(`Joining game ${gameId}...`); NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'join_game', game_id: gameId })); }
    function hostMultiplayer(maxPlayers) { log(`Hosting MP game (${maxPlayers}p)...`); if (![2, 3, 4].includes(maxPlayers)) { error("Invalid max players:", maxPlayers); UIManager.updateStatus("Invalid player count.", true); return; } appState.mode = 'multiplayer-host'; UIManager.updateStatus(`Creating ${maxPlayers}p game...`); NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'create_game', max_players: maxPlayers })); }
    function leaveGame() { log("Leaving game..."); if (appState.isConnected && appState.currentGameId && appState.localPlayerId) NetworkManager.sendMessage({ type: 'leave_game' }); NetworkManager.closeConnection(1000, "User left game"); resetClientState(true); } // Close connection explicitly
    // --- In-Game Actions ---
    function sendChatMessage() { const message = DOM.chatInput?.value.trim(); if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) { NetworkManager.sendMessage({ type: 'player_chat', message: message }); if(DOM.chatInput) DOM.chatInput.value = ''; } }
    function triggerLocalPushback() { localEffects.pushbackAnim.active = true; localEffects.pushbackAnim.endTime = performance.now() + localEffects.pushbackAnim.duration; NetworkManager.sendMessage({ type: 'player_pushback' }); }
    // --- State Management ---
    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`);
        cleanupLoop(); // Stop game loop and input listeners

        // Clear HTML overlay pool
        if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = '';
        Object.values(overlayElementPools).forEach(pool => { pool.elements = {}; pool.inactive = []; });

        // Cleanup renderer resources
        if (appState.isRendererReady && Renderer3D.cleanup) Renderer3D.cleanup();

        const currentIsConnected = appState.isConnected; // Preserve connection status
        // Reset appState, keeping connection status
        appState = {
            ...appState, // Keep existing props if needed
            mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null,
            serverState: null, lastServerState: null, lastStateReceiveTime: performance.now(),
            isGameLoopRunning: false, isRendererReady: false,
            worldWidth: DEFAULT_WORLD_WIDTH, worldHeight: DEFAULT_WORLD_HEIGHT, // Reset world dims
            renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
            predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
            mouseWorldPosition: new THREE.Vector3(0, 0, 0),
            localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
            uiPositions: {}, currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false,
        };
        // Reset local effects state
        localEffects = { muzzleFlash: { active: false, endTime: 0 }, pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION }, snake: { active: false, segments: [] } };

        // Reset UI elements to default state
        if(DOM.chatLog) DOM.chatLog.innerHTML = '';
        if(DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = '------';
        if(DOM.waitingMessage) DOM.waitingMessage.textContent = '';
        if(DOM.gameIdInput) DOM.gameIdInput.value = '';
        DOM.countdownDiv?.classList.remove('active');
        if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none';
        if(DOM.temperatureIndicator) DOM.temperatureIndicator.style.display = 'none';
        if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = ''; // Clear stats
        DOM.gameContainer?.classList.remove('night-mode', 'raining', 'dust-storm');

        // Optionally navigate UI and update status
        if (showMenu) { UIManager.updateStatus(currentIsConnected ? "Connected." : "Disconnected."); UIManager.showSection('main-menu-section'); }
        else { UIManager.updateStatus("Initializing..."); }

        // DO NOT re-initialize renderer here - wait for game start message
    }
    // Starts the main game loop
    function startGameLoop() {
        if (appState.isGameLoopRunning || !appState.isRendererReady || !appState.serverState) { return; }
        log("Starting game loop...");
        InputManager.setup(); // Start input listeners
        appState.isGameLoopRunning = true;
        lastLoopTime = performance.now();
        appState.animationFrameId = requestAnimationFrame(gameLoop); // Start loop
    }
    // Stops the main game loop and cleans up input
    function cleanupLoop() {
        if (appState.animationFrameId) cancelAnimationFrame(appState.animationFrameId);
        appState.animationFrameId = null;
        InputManager.cleanup(); // Stop input listeners
        appState.isGameLoopRunning = false;
        log("Game loop stopped.");
    }
    // Interpolates game state for smooth rendering
    function getInterpolatedState(renderTime) {
        const serverState = appState.serverState; const lastState = appState.lastServerState;
        if (!serverState) return null; // No state to render

        // If no previous state or timestamps invalid/same, use latest state directly
        // Apply predicted position for local player even in this case
        if (!lastState || !serverState.timestamp || !lastState.timestamp || serverState.timestamp <= lastState.timestamp) {
            let currentStateCopy = JSON.parse(JSON.stringify(serverState)); // Deep copy needed? Maybe shallow is enough if careful
            if (currentStateCopy.players?.[appState.localPlayerId]) {
                 currentStateCopy.players[appState.localPlayerId].x = appState.renderedPlayerPos.x; // Use smoothed render pos
                 currentStateCopy.players[appState.localPlayerId].y = appState.renderedPlayerPos.y;
            }
            // Add snake state to be rendered
             currentStateCopy.snake_state = localEffects.snake;
            return currentStateCopy;
        }

        const serverTime = serverState.timestamp * 1000; const lastServerTime = lastState.timestamp * 1000;
        const timeBetweenStates = serverTime - lastServerTime; if (timeBetweenStates <= 0) return serverState; // Avoid division by zero

        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS; // Target time slightly in the past
        const timeSinceLastState = renderTargetTime - lastServerTime;
        let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates)); // Interpolation factor (0 to 1)

        // Start with the structure of the newest state
        let interpolatedState = JSON.parse(JSON.stringify(serverState));

        // Interpolate Players (excluding local player)
        if (interpolatedState.players) {
            for (const pId in interpolatedState.players) {
                const currentP = serverState.players[pId]; const lastP = lastState.players?.[pId];
                if (pId === appState.localPlayerId) { // Use client's smoothed render position
                    interpolatedState.players[pId].x = appState.renderedPlayerPos.x;
                    interpolatedState.players[pId].y = appState.renderedPlayerPos.y;
                } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number') { // Interpolate others
                    interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t);
                    interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t);
                     // #TODO: Interpolate rotation/aim?
                }
            }
        }
        // Interpolate Enemies (only if alive in both states)
        if (interpolatedState.enemies) {
            for (const eId in interpolatedState.enemies) {
                const currentE = serverState.enemies[eId]; const lastE = lastState.enemies?.[eId];
                if (lastE && currentE.health > 0 && lastE.health > 0 && typeof currentE.x === 'number' && typeof lastE.x === 'number') {
                    interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t);
                    interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t);
                    // #TODO: Interpolate rotation/aim?
                }
            }
        }
        // Interpolate Bullets (simple position lerp)
        if (interpolatedState.bullets) {
            for (const bId in interpolatedState.bullets) {
                const currentB = serverState.bullets[bId]; const lastB = lastState.bullets?.[bId];
                if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number') {
                    interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t);
                    interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t);
                }
            }
        }
        // Powerups usually snap, no interpolation needed unless they move smoothly server-side
        // Add snake state to be rendered
        interpolatedState.snake_state = localEffects.snake;

        return interpolatedState;
    }
    // Updates the client's predicted position based on input
    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const playerState = appState.serverState.players[appState.localPlayerId];
        if (playerState.player_status !== PLAYER_STATUS_ALIVE) return; // Don't predict if not alive

        const moveVector = InputManager.getMovementInputVector();
        const playerSpeed = playerState?.speed ?? (appState.worldWidth / 10); // Use world width for fallback speed

        if (moveVector.dx !== 0 || moveVector.dy !== 0) {
            appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime;
            appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime; // Y corresponds to Z world
        }

        // Clamp predicted position to world boundaries
        // #TODO: Get player width/height from server state if available for more accuracy
        const playerRadius = PLAYER_CAPSULE_RADIUS; // Approximation
        appState.predictedPlayerPos.x = Math.max(playerRadius, Math.min(appState.worldWidth - playerRadius, appState.predictedPlayerPos.x));
        appState.predictedPlayerPos.y = Math.max(playerRadius, Math.min(appState.worldHeight - playerRadius, appState.predictedPlayerPos.y));
    }
    // Corrects the client's predicted/rendered position based on authoritative server state
    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const serverPlayerState = appState.serverState.players[appState.localPlayerId];
        if (typeof serverPlayerState.x !== 'number' || typeof serverPlayerState.y !== 'number') return;

        const serverPos = { x: serverPlayerState.x, y: serverPlayerState.y };
        const predictedPos = appState.predictedPlayerPos;
        const renderedPos = appState.renderedPlayerPos;

        const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);
        const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35;
        const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15;

        // If discrepancy is too large, snap prediction and render position immediately
        if (dist > snapThreshold * 1.5) { // Slightly higher threshold for snapping
             // log(`SNAP RECONCILE! Dist: ${dist.toFixed(1)}`);
             predictedPos.x = serverPos.x; predictedPos.y = serverPos.y;
             renderedPos.x = serverPos.x; renderedPos.y = serverPos.y;
        } else {
            // Smoothly interpolate the *rendered* position towards the *predicted* position
            renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor);
            renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor);

            // Gently pull prediction towards server state only if there's a noticeable difference
            // This prevents minor jitter but corrects drift over time.
            if (dist > 1.0) {
                 predictedPos.x = lerp(predictedPos.x, serverPos.x, 0.05); // Slow adjustment
                 predictedPos.y = lerp(predictedPos.y, serverPos.y, 0.05);
            }
        }
    }
    // The main game loop, called by requestAnimationFrame
    function gameLoop(currentTime) {
        if (!appState.isGameLoopRunning) { cleanupLoop(); return; } // Exit if stopped
        const now = performance.now();
        if (lastLoopTime === null) lastLoopTime = now;
        const deltaTime = Math.min(0.1, (now - lastLoopTime) / 1000); // Delta time in seconds, capped
        lastLoopTime = now;

        // Process Input (handles held keys/buttons for continuous actions like shooting)
        InputManager.update(deltaTime);

        // Update local effects timers (e.g., fade out muzzle flash)
        if (localEffects.pushbackAnim.active && now >= localEffects.pushbackAnim.endTime) localEffects.pushbackAnim.active = false;
        if (localEffects.muzzleFlash.active && now >= localEffects.muzzleFlash.endTime) localEffects.muzzleFlash.active = false;

        // Client-Side Prediction & Reconciliation
        if (appState.serverState?.status === 'active') {
            updatePredictedPosition(deltaTime);
            reconcileWithServer();
        }

        // Get Interpolated State for Rendering
        const stateToRender = getInterpolatedState(now);

        // Render Scene using Interpolated State
        if (stateToRender && appState.isRendererReady && Renderer3D.renderScene) {
            Renderer3D.renderScene(stateToRender, appState, localEffects);
        }

        // Update HTML Overlays (using latest uiPositions calculated by renderer)
        if (stateToRender && appState.mode !== 'menu') {
            UIManager.updateHtmlOverlays();
        }

        // Request next frame
        if (appState.isGameLoopRunning) {
            appState.animationFrameId = requestAnimationFrame(gameLoop);
        } else {
            cleanupLoop(); // Ensure cleanup if loop flag was turned off
        }
    }
    // Sets the initial game state received from the server
    function setInitialGameState(state, localId, gameId, maxPlayers) {
        log("Game: Setting initial state from server.");
        appState.lastServerState = null; // Clear previous state
        appState.serverState = state;
        appState.localPlayerId = localId;
        appState.currentGameId = gameId;
        appState.maxPlayersInGame = maxPlayers;

        // Set world dimensions from server state, use defaults as fallback
        appState.worldWidth = state?.world_width || DEFAULT_WORLD_WIDTH;
        appState.worldHeight = state?.world_height || DEFAULT_WORLD_HEIGHT;

        // Initialize player position based on server state
        const initialPlayer = state?.players?.[localId];
        const startX = initialPlayer?.x ?? appState.worldWidth / 2;
        const startY = initialPlayer?.y ?? appState.worldHeight / 2;
        appState.predictedPlayerPos = { x: startX, y: startY };
        appState.renderedPlayerPos = { x: startX, y: startY };
        appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 }; // Reset aim

        // Initialize renderer *after* setting world dimensions
        if (!appState.isRendererReady && DOM.canvasContainer) {
             log(`Game: Initializing Renderer with world size ${appState.worldWidth}x${appState.worldHeight}`);
             appState.isRendererReady = Renderer3D.init(DOM.canvasContainer, appState.worldWidth, appState.worldHeight);
             if (!appState.isRendererReady) { error("Renderer initialization failed in setInitialGameState!"); UIManager.updateStatus("Renderer Error!", true); }
        } else if (appState.isRendererReady) {
            // If renderer was already ready (e.g., reconnect), ensure it knows the new world size?
            // Renderer currently reads world size on its init. Maybe add an updateWorldSize method?
            // For now, assume resetClientState + re-init handles this.
        }
    }
    // Updates the stored server state
    function updateServerState(newState) {
        appState.lastServerState = appState.serverState;
        appState.serverState = newState;
        appState.lastStateReceiveTime = performance.now();

        // Update world dimensions if they change mid-game (unlikely but possible)
        if (newState?.world_width && newState?.world_height && (appState.worldWidth !== newState.world_width || appState.worldHeight !== newState.world_height)) {
            log(`World dimensions updated mid-game: ${newState.world_width}x${newState.world_height}`);
            appState.worldWidth = newState.world_width;
            appState.worldHeight = newState.world_height;
            // #TODO: Need a way to tell Renderer3D to update its world size representation (ground, boundaries, shadows)
        }

        // Update local copy of snake state for renderer
        if(newState.snake_state) { localEffects.snake = newState.snake_state; }
        else { localEffects.snake.active = false; localEffects.snake.segments = []; } // Reset if not present
    }
    // Updates the UI for the host waiting screen
    function updateHostWaitUI(state) {
        const currentP = Object.keys(state?.players || {}).length;
        const maxP = appState.maxPlayersInGame || '?';
        if (DOM.waitingMessage) DOM.waitingMessage.textContent = `Waiting... (${currentP}/${maxP} Players)`;
    }
    // Handles displaying chat messages
    function handlePlayerChat(senderId, message) { UIManager.addChatMessage(senderId, message, false); }
    function handleEnemyChat(speakerId, message) { if (speakerId && message) UIManager.addChatMessage(speakerId, `(${message})`, true); } // Mark enemy chat
    // Handles feedback for damage taken and dealt
    function handleDamageFeedback(newState) {
         const localId = appState.localPlayerId; if (!localId || !appState.lastServerState) return;

         // --- Player Took Damage ---
         const prevP = appState.lastServerState?.players?.[localId];
         const currP = newState?.players?.[localId];
         if (prevP && currP && typeof currP.health === 'number' && typeof prevP.health === 'number' && currP.health < prevP.health) {
             const dmg = prevP.health - currP.health;
             const mag = Math.min(18, 5 + dmg * 0.2); // Calculate shake magnitude
             if (Renderer3D.triggerShake) Renderer3D.triggerShake(mag, 250); // Trigger screen shake
             SoundManager.playSound('damage', 0.8); // Play player hit sound
         }
         // Check for snake bite shake trigger from server
         if (currP?.trigger_snake_bite_shake_this_tick && Renderer3D.triggerShake) {
             Renderer3D.triggerShake(15.0, 400.0);
         }

         // --- Player Dealt Damage (Trigger Enemy Hit Visuals/Sound) ---
         if (newState.enemies && Renderer3D.triggerVisualHitSparks) {
             const now = performance.now();
             for (const eId in newState.enemies) {
                 const enemy = newState.enemies[eId];
                 const prevE = appState.lastServerState?.enemies?.[eId];
                 // Check if damage time recently updated (indicates a hit processed by server)
                 if (enemy?.last_damage_time && (!prevE || enemy.last_damage_time > (prevE.last_damage_time || 0))) {
                     // Check if the damage happened very recently to avoid delayed effects
                     if (now - (enemy.last_damage_time * 1000) < 150) { // Threshold in ms
                          const enemyPos = new THREE.Vector3(enemy.x, (enemy.height / 2 || ENEMY_CHASER_HEIGHT / 2), enemy.y); // Approx center mass
                          Renderer3D.triggerVisualHitSparks(enemyPos, 5); // Trigger sparks via renderer API
                          SoundManager.playSound('enemy_hit', 0.6); // Play enemy hit sound
                          // #TODO: Add enemy death sound - check if health just dropped to 0
                          if (enemy.health <= 0 && prevE && prevE.health > 0) {
                              SoundManager.playSound('enemy_death', 0.7);
                          }
                     }
                 }
             }
         }
          // --- Powerup Collected Sound ---
         if (newState.powerups && appState.lastServerState?.powerups) {
             const currentIds = new Set(Object.keys(newState.powerups));
             const lastIds = new Set(Object.keys(appState.lastServerState.powerups));
             lastIds.forEach(id => {
                 if (!currentIds.has(id)) { // Powerup disappeared
                     SoundManager.playSound('powerup', 0.9);
                 }
             });
         }
    }

    return { initListeners, startGameLoop, cleanupLoop, resetClientState, setInitialGameState, updateServerState, updateHostWaitUI, handlePlayerChat, handleEnemyChat, handleDamageFeedback, sendChatMessage, triggerLocalPushback };
})();

// --- WebSocket Message Handler ---
function handleServerMessage(event) {
    let data;
    try { data = JSON.parse(event.data); } // Robust parsing
    catch (err) { error("Failed parse WS message:", err, event.data); return; }

    try { // Wrap handler logic in try/catch
        switch (data.type) {
            case 'game_created': case 'game_joined': case 'sp_game_started':
                log(`Received '${data.type}'`);
                // Reset client state *before* setting new initial state
                GameManager.resetClientState(false); // Reset state but don't show menu yet
                // Ensure initial state exists
                if (!data.initial_state || !data.player_id || !data.game_id) { error(`'${data.type}' message missing critical data!`, data); return; }
                GameManager.setInitialGameState(data.initial_state, data.player_id, data.game_id, data.max_players || data.initial_state?.max_players || 1);
                // Update UI based on game type
                if (data.type === 'game_created') { if (DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR'; UIManager.updateStatus(`Hosted Game: ${appState.currentGameId}`); GameManager.updateHostWaitUI(appState.serverState); UIManager.showSection('host-wait-section'); }
                else { const joinMsg = data.type === 'game_joined' ? `Joined ${appState.currentGameId}` : "Single Player Started!"; UIManager.updateStatus(joinMsg); UIManager.showSection('game-area'); if (appState.serverState) { UIManager.updateHUD(appState.serverState); UIManager.updateCountdown(appState.serverState); UIManager.updateEnvironmentDisplay(appState.serverState); } if (appState.isRendererReady) GameManager.startGameLoop(); else error("Cannot start game loop - Renderer not ready!"); }
                break;
            case 'game_state':
                if (appState.mode === 'menu' || !appState.localPlayerId || !appState.isRendererReady || !data.state) return; // Ignore if not in game or state missing
                const previousStatus = appState.serverState?.status;
                GameManager.updateServerState(data.state); // Update internal state store
                const newState = appState.serverState; // Use the newly updated state
                // Handle major game status transitions
                if (newState.status !== previousStatus) {
                    log(`Game Status Change: ${previousStatus || 'N/A'} -> ${newState.status}`);
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') { UIManager.updateStatus(newState.status === 'countdown' ? "Get Ready..." : "Active!"); UIManager.showSection('game-area'); if (!appState.isGameLoopRunning) GameManager.startGameLoop(); }
                    else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') { UIManager.updateStatus("Waiting for players..."); UIManager.showSection('host-wait-section'); GameManager.updateHostWaitUI(newState); GameManager.cleanupLoop(); }
                    else if (newState.status === 'finished' && previousStatus !== 'finished') { log("Game Over via 'finished' status."); UIManager.updateStatus("Game Over!"); UIManager.showGameOver(newState); SoundManager.playSound('death'); GameManager.cleanupLoop(); }
                }
                // Update UI elements relevant to the current game status
                if (appState.isGameLoopRunning && (newState.status === 'countdown' || newState.status === 'active')) { UIManager.updateHUD(newState); UIManager.updateCountdown(newState); UIManager.updateEnvironmentDisplay(newState); }
                else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') { GameManager.updateHostWaitUI(newState); }
                // Process secondary effects based on state changes
                GameManager.handleEnemyChat(newState.enemy_speaker_id, newState.enemy_speech_text);
                GameManager.handleDamageFeedback(newState);
                break;
            case 'game_over_notification':
                log("Received 'game_over_notification'");
                if (data.final_state) { appState.serverState = data.final_state; UIManager.updateStatus("Game Over!"); UIManager.showGameOver(data.final_state); SoundManager.playSound('death');}
                else { error("Game over notification missing final_state."); UIManager.showGameOver(null); }
                GameManager.cleanupLoop(); break;
            case 'chat_message': if(data.sender_id && data.message) GameManager.handlePlayerChat(data.sender_id, data.message); break;
            case 'error':
                error("Server Error:", data.message || "Unknown error");
                UIManager.updateStatus(`Error: ${data.message || 'Unknown'}`, true);
                // Handle specific errors that should reset UI state
                const isJoinError = appState.mode === 'multiplayer-client' && data.message && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'));
                const isHostError = appState.mode === 'multiplayer-host' && data.message && data.message.includes('creation failed');
                if (isJoinError) { UIManager.showSection('join-code-section'); appState.mode = 'menu'; } // Go back to join screen
                else if (isHostError || (data.message && data.message.includes('Please create or join'))) { GameManager.resetClientState(true); } // Go back to main menu
                break;
            default: log(`Unknown message type: ${data.type}`);
        }
    } catch (handlerError) { error("Error processing server message:", handlerError, "Data:", data); }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded. Initializing client...");
    // Verify essential DOM elements exist
    const essentialIds = ['gameContainer', 'loadingScreen', 'canvasContainer', 'htmlOverlay', 'mainMenuSection', 'gameArea', 'menuArea'];
    let missingElement = false;
    essentialIds.forEach(id => { if (!DOM[id]) { error(`CRITICAL: Essential DOM element missing: #${id}`); missingElement = true; } });
    if (missingElement) { document.body.innerHTML = "<p style='color:red; font-size: 1.2em; text-align: center; padding: 2em;'>Error: Critical UI elements missing. Check console.</p>"; return; }

    // Initialize core modules
    try { GameManager.initListeners(); } catch(listenerError) { error("Error initializing listeners:", listenerError); UIManager.updateStatus("Init Error: Controls failed.", true); }
    // Note: SoundManager.init() called on first user interaction (e.g., button click)

    // Connect to WebSocket
    UIManager.updateStatus("Initializing Connection...");
    NetworkManager.connect(() => { log("Initial WebSocket connection successful."); });

    // Setup Debounced Resize Handler
    resizeHandler = debounce(() => {
        if (appState.isRendererReady && Renderer3D.handleContainerResize) {
            Renderer3D.handleContainerResize();
        }
    }, RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', resizeHandler);

    // Initial UI state: Show loading screen until connected
    DOM.loadingScreen?.classList.add('active');
    DOM.gameContainer?.classList.remove('loaded');
    UIManager.showSection('loading-screen'); // Hide menus/game initially

    log("Client initialization sequence complete.");
});
