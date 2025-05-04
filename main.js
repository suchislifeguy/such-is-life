// main.js
// Client-side logic for Kelly Gang Survival

import * as THREE from 'three'; // Still needed for Vector3 etc. if used directly
import Renderer3D from './Renderer3D.js';

console.log("--- main.js v2: Initializing ---");

// --- Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
const SHOOT_COOLDOWN = 100; // Base cooldown in ms for standard shots
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4; // Faster shooting
const INPUT_SEND_INTERVAL = 33; // ~30 times per second
const RECONNECT_DELAY = 3000; // Time between reconnect attempts
const DEFAULT_CANVAS_WIDTH = 1600; // Fallback if server doesn't provide
const DEFAULT_CANVAS_HEIGHT = 900;
const INTERPOLATION_BUFFER_MS = 100; // Render slightly behind server time for smoothness
const SPEECH_BUBBLE_DURATION_MS = 4000;
const ENEMY_SPEECH_BUBBLE_DURATION_MS = 3000;
const PUSHBACK_ANIM_DURATION = 250; // Local visual effect duration
const MUZZLE_FLASH_DURATION = 75; // Local visual effect duration
const RESIZE_DEBOUNCE_MS = 150; // Prevent resize spam

// Player State Constants (match server)
const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function determineWebSocketUrl() {
    if (window.location.protocol === "https:") {
        return `wss://${window.location.host}/ws`;
    } else {
        return `ws://${window.location.host}/ws`;
    }
}
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- DOM References ---
// Ensure IDs match index.html exactly
const DOM = {
    loadingScreen: document.getElementById('loading-screen'),
    gameContainer: document.getElementById('game-container'),
    topBar: document.getElementById('top-bar'),
    gameStatus: document.getElementById('game-status'),
    menuContainer: document.getElementById('menu-container'), // No longer used to control visibility directly?
    mainMenuSection: document.getElementById('main-menu-section'),
    multiplayerMenuSection: document.getElementById('multiplayer-menu-section'),
    hostWaitSection: document.getElementById('host-wait-section'),
    joinCodeSection: document.getElementById('join-code-section'),
    gameArea: document.getElementById('game-area'),
    leftPanel: document.getElementById('left-panel'),
    playerStatsGrid: document.getElementById('player-stats-grid'),
    dayNightIndicator: document.getElementById('day-night-indicator'),
    temperatureIndicator: document.getElementById('temperature-indicator'),
    chatLog: document.getElementById('chat-log'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
    muteBtn: document.getElementById('muteBtn'),
    leaveGameBtn: document.getElementById('leaveGameBtn'),
    canvasContainer: document.getElementById('canvas-container'), // Main container for the canvas
    countdownDiv: document.getElementById('countdown-overlay'), // Correct ID from HTML
    htmlOverlay: document.getElementById('html-overlay'),
    gameOverScreen: document.getElementById('game-over-screen'),
    finalStatsDiv: document.getElementById('final-stats'),
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
    backButtons: document.querySelectorAll('.button-back'), // Select all back buttons
};

// --- Application State ---
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
    isRendererReady: false, // Track if Renderer3D.init was successful
    // Position state - updated by prediction/reconciliation
    renderedPlayerPos: { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 }, // Smoothed position for rendering
    predictedPlayerPos: { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 }, // Position based on local input
    // Dimensions - updated from server state
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    // Input/Aiming state
    mouseWorldPosition: new THREE.Vector3(0, 0, 0), // World coords under cursor (on ground plane)
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, // Normalized aim direction
    // UI/Environment state mirrored from server
    uiPositions: {}, // Screen coords { id: { screenX, screenY } } calculated by renderer
    currentTemp: 18.0,
    isRaining: false,
    isDustStorm: false,
    isNight: false,
};

// --- Local Effects State ---
// These are triggered locally for immediate feedback, renderer uses them
let localEffects = {
    muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 },
    pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION },
    activeAmmoCasings: [], // Managed by renderer now via spawn function
    activeBloodSparkEffects: {}, // Key: enemyId, Value: endTime (managed by renderer via trigger function)
    snake: { // Data passed to renderer, updated from server state
        isActiveFromServer: false,
        segments: [], // Server provides data, renderer creates visual
    }
};

// HTML Overlay Object Pools
const overlayElementPools = {
    damageText: { elements: {}, inactive: [] },
    speechBubble: { elements: {}, inactive: [] },
    // Health bars are removed as they were 3D before; HTML version handled in UIManager updateHUD
};

// --- Core Modules ---
let socket = null;
let reconnectTimer = null;
let lastLoopTime = null;
let resizeHandler = null; // Store debounced resize handler

function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

// --- Sound Manager Module --- (Self-contained)
const SoundManager = (() => {
    let audioContext = null; let gainNode = null; let loadedSounds = {};
    let soundFiles = { 'shoot': 'assets/sounds/shoot.mp3', 'damage': 'assets/sounds/damage.mp3', 'powerup': 'assets/sounds/powerup.mp3', 'death': 'assets/sounds/death.mp3', 'enemy_hit': 'assets/sounds/enemy_hit.mp3' };
    let isInitialized = false; let canPlaySound = false; let isMuted = false;
    function init() {
        if (isInitialized) return; isInitialized = true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { error("[SM] Web Audio API not supported."); return; }
            audioContext = new AC(); gainNode = audioContext.createGain(); gainNode.connect(audioContext.destination);
            const r = () => { if (audioContext.state === 'suspended') { audioContext.resume().then(() => { log("[SM] Audio Resumed."); canPlaySound = true; loadSounds(); }).catch(e => error("[SM] Resume failed:", e)); } document.removeEventListener('click', r); document.removeEventListener('keydown', r); };
            if (audioContext.state === 'suspended') { document.addEventListener('click', r, { once: true }); document.addEventListener('keydown', r, { once: true }); }
            else if (audioContext.state === 'running') { canPlaySound = true; loadSounds(); }
        } catch (e) { error("[SM] Init error:", e); }
    }
    function loadSounds() {
        if (!audioContext || !canPlaySound) return;
        const promises = Object.entries(soundFiles).map(([name, path]) =>
            fetch(path).then(r => r.ok ? r.arrayBuffer() : Promise.reject(`HTTP ${r.status}`))
                .then(b => audioContext.decodeAudioData(b))
                .then(db => { loadedSounds[name] = db; log(`[SM] Loaded: ${name}`); })
                .catch(e => { error(`[SM] Load/Decode '${name}' error:`, e); })
        ); Promise.allSettled(promises).then(() => log("[SM] Sound loading finished."));
    }
    function playSound(name, volume = 1.0) {
        if (!canPlaySound || !audioContext || !gainNode || audioContext.state !== 'running') return;
        const buffer = loadedSounds[name]; if (!buffer) return;
        if (isMuted && name !== 'ui_click') return; // Allow UI clicks even when muted? Optional.
        try {
            const source = audioContext.createBufferSource(); source.buffer = buffer;
            const soundGain = audioContext.createGain(); soundGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime);
            source.connect(soundGain).connect(gainNode); // Connect through local gain to master gain
            source.start(0); source.onended = () => { try { source.disconnect(); soundGain.disconnect(); } catch(e){} };
        } catch (e) { error(`[SM] Play '${name}' error:`, e); }
    }
    function toggleMute() {
        isMuted = !isMuted; if (gainNode) gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext?.currentTime || 0);
        log(`[SM] Sound ${isMuted ? 'Muted' : 'Unmuted'}`);
        if (DOM.muteBtn) { DOM.muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; DOM.muteBtn.classList.toggle('muted', isMuted); }
    }
    function getMuteState() { return isMuted; }
    return { init, playSound, toggleMute, getMuteState };
})();

// --- UI Manager Module ---
const UIManager = (() => {
    const allMenuSections = [ DOM.mainMenuSection, DOM.multiplayerMenuSection, DOM.hostWaitSection, DOM.joinCodeSection ];
    function showSection(sectionId) {
        // Hide all major areas first
        allMenuSections.forEach(s => s?.classList.remove('active'));
        DOM.gameArea?.classList.remove('active');
        DOM.gameOverScreen?.classList.remove('active');

        const sectionToShow = document.getElementById(sectionId);
        if (sectionToShow) {
            sectionToShow.classList.add('active');
            // log(`UI: Showing section: ${sectionId}`); // Less verbose logging
            // Make parent visible if needed (e.g., menu sections are inside game-container visually)
            if (sectionToShow.closest('#game-container')) {
                 // Game container is always visible after loading now
            }
        } else { error(`UI: Section not found: ${sectionId}`); }
    }
    function updateStatus(message, isError = false) { if (!DOM.gameStatus) return; DOM.gameStatus.textContent = message; DOM.gameStatus.style.color = isError ? (getCssVar('--color-danger') || 'red') : (getCssVar('--color-accent') || 'yellow'); }
    function updateHUD(serverState) {
        if (!DOM.playerStatsGrid || !serverState?.players || !appState.localPlayerId) { if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = '<div class="stats-box placeholder">Waiting...</div>'; return; }
        const players = serverState.players; const localId = appState.localPlayerId; DOM.playerStatsGrid.innerHTML = '';
        const sortedPlayerIds = Object.keys(players).sort((a, b) => { if (a === localId) return -1; if (b === localId) return 1; return a.localeCompare(b); });
        sortedPlayerIds.forEach(pId => {
            const pData = players[pId]; if (!pData) return;
            const isSelf = (pId === localId);
            const header = isSelf ? "YOU" : `P:${pId.substring(0, 4)}`;
            const status = pData.player_status || PLAYER_STATUS_ALIVE; let healthDisplay;
            if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--color-down-status);'>DOWN</span>`;
            else if (status === PLAYER_STATUS_DEAD || pData.health <= 0) healthDisplay = `<span style='color: var(--color-dead-status);'>DEAD</span>`;
            else { const hp = pData.health ?? 0; let color = 'var(--color-health-high)'; if(hp < 66) color = 'var(--color-health-medium)'; if(hp < 33) color = 'var(--color-health-low)'; healthDisplay = `<span style='color:${color};'>${hp.toFixed(0)}</span>`; }
            const armor = pData.armor ?? 0; let armorDisplay = Math.round(armor); if(armor > 0) armorDisplay = `<span style='color: var(--color-armor);'>${armorDisplay}</span>`;
            const box = document.createElement('div'); box.className = 'stats-box';
            box.innerHTML = `<div class="stats-header">${header}</div><div class="stats-content"><span>HP:</span> ${healthDisplay}<br><span>Armor:</span> ${armorDisplay}<br><span>Gun:</span> ${pData.gun ?? 1}<br><span>Speed:</span> ${pData.speed ?? '-'}<br><span>Kills:</span> ${pData.kills ?? 0}<br><span>Score:</span> ${pData.score ?? 0}</div>`;
            DOM.playerStatsGrid.appendChild(box);
        });
    }
    function addChatMessage(senderId, message, isSystem = false) {
        if (!DOM.chatLog) return;
        const div = document.createElement('div');
        const isSelf = senderId === appState.localPlayerId;
        let senderName = 'System';
        if (!isSystem) { senderName = isSelf ? 'You' : `P:${senderId ? senderId.substring(0,4) : '???'}`; }
        div.classList.add(isSystem ? 'system-message' : (isSelf ? 'my-message' : 'other-message'));
        div.textContent = isSystem ? message : `${senderName}: ${message}`;
        DOM.chatLog.appendChild(div); DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
    }
    function updateCountdown(serverState) {
        if (!DOM.countdownDiv) return;
        const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0;
        if (isCountdown) { DOM.countdownDiv.textContent = Math.ceil(serverState.countdown); DOM.countdownDiv.classList.add('active'); }
        else { DOM.countdownDiv.classList.remove('active'); }
    }
    function updateEnvironmentDisplay(serverState) {
        if (!DOM.dayNightIndicator || !DOM.temperatureIndicator || !DOM.gameContainer) return;
        if (serverState?.status === 'active') {
            const isNight = serverState.is_night; appState.isNight = isNight;
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day'; DOM.dayNightIndicator.style.display = 'block';
            DOM.gameContainer.classList.toggle('night-mode', isNight);

            appState.currentTemp = serverState.current_temperature ?? 18.0;
            appState.isRaining = serverState.is_raining ?? false;
            appState.isDustStorm = serverState.is_dust_storm ?? false;
            DOM.temperatureIndicator.textContent = `${appState.currentTemp.toFixed(0)}°C`; DOM.temperatureIndicator.style.display = 'block';
             // Update CSS variables or classes based on weather for visual effects
             DOM.gameContainer.classList.toggle('raining', appState.isRaining);
             DOM.gameContainer.classList.toggle('dust-storm', appState.isDustStorm);
        } else {
            DOM.dayNightIndicator.style.display = 'none'; DOM.temperatureIndicator.style.display = 'none';
            DOM.gameContainer.classList.remove('night-mode', 'raining', 'dust-storm');
            appState.isNight = false; appState.isRaining = false; appState.isDustStorm = false;
        }
    }
    function showGameOver(finalState) {
        if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return;
        const player = finalState?.players?.[appState.localPlayerId];
        let statsHtml = "Final Stats Unavailable";
        if (player) { statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div><div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`; }
        DOM.finalStatsDiv.innerHTML = statsHtml; log("UI: Showing game over screen."); showSection('game-over-screen');
    }
    function updateHtmlOverlays() {
        if (!DOM.htmlOverlay || !appState.serverState || !appState.uiPositions) return;
        const overlay = DOM.htmlOverlay; const now = performance.now();
        const pools = overlayElementPools; // Use the refactored pool object
        const state = appState.serverState;
        const uiPos = appState.uiPositions;

        const activeElements = { damageText: new Set(), speechBubble: new Set() };

        // Helper to get/create/recycle pool elements
        const getElement = (poolName, id, className) => {
            const pool = pools[poolName]; let el = pool.elements[id];
            if (!el) { el = pool.inactive.pop(); if (!el) { el = document.createElement('div'); overlay.appendChild(el); } else { el.style.display = 'block'; } pool.elements[id] = el; el.className = className; } return el;
        };
        const releaseElement = (poolName, id) => { const pool = pools[poolName]; const el = pool.elements[id]; if (el) { el.style.display = 'none'; pool.inactive.push(el); delete pool.elements[id]; } };

        // Update Damage Texts
        if (state.damage_texts) {
            for (const id in state.damage_texts) {
                const dtData = state.damage_texts[id]; const posData = uiPos[id]; if (!posData) continue;
                activeElements.damageText.add(id); const element = getElement('damageText', id, 'overlay-element damage-text-overlay');
                element.textContent = dtData.text; element.classList.toggle('crit', dtData.is_crit || false);
                const lifeTime = (dtData.lifetime || 0.75) * 1000; const spawnTime = dtData.spawn_time * 1000; const elapsed = now - spawnTime; const progress = Math.min(1, elapsed / lifeTime);
                const verticalOffset = -(progress * 50); // Move up as it fades
                element.style.left = `${posData.screenX}px`; element.style.top = `${posData.screenY + verticalOffset}px`;
                element.style.opacity = Math.max(0, 1.0 - (progress * 0.9)).toFixed(2); // Fade out faster
            }
        }
        for (const id in pools.damageText.elements) { if (!activeElements.damageText.has(id)) releaseElement('damageText', id); }

        // Update Speech Bubbles (Combine player and enemy)
        const currentBubbles = {}; // Temp store for active bubbles this frame
        if (state.players) { Object.entries(state.players).forEach(([id, pData]) => { if (pData?.speechBubble) currentBubbles[id] = { ...pData.speechBubble, source: 'player' }; }); }
        if (state.enemy_speaker_id && state.enemy_speech_text) { currentBubbles[state.enemy_speaker_id] = { text: state.enemy_speech_text, endTime: now + ENEMY_SPEECH_BUBBLE_DURATION_MS, source: 'enemy'}; } // Approx end time

        for(const id in currentBubbles) {
             const bubbleData = currentBubbles[id]; const posData = uiPos[id]; if (!posData) continue;
             activeElements.speechBubble.add(id); const element = getElement('speechBubble', id, 'overlay-element speech-bubble');
             element.textContent = bubbleData.text.substring(0, 50); // Limit length
             const yOffset = -60; // Adjust offset as needed relative to projected point
             element.style.left = `${posData.screenX}px`; element.style.top = `${posData.screenY + yOffset}px`;
             element.style.opacity = 1.0; // Keep visible while active
        }
        for (const id in pools.speechBubble.elements) { if (!activeElements.speechBubble.has(id)) releaseElement('speechBubble', id); }
    }
    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateEnvironmentDisplay, showGameOver, updateHtmlOverlays };
})();

// --- Network Manager Module ---
const NetworkManager = (() => {
    function connect(onOpenCallback) {
        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) { log("WS connect called, but already connecting/open."); if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); return; }
        clearTimeout(reconnectTimer); UIManager.updateStatus('Connecting...'); log("WS connect:", WEBSOCKET_URL);
        try { socket = new WebSocket(WEBSOCKET_URL); } catch (err) { error("WS creation failed:", err); UIManager.updateStatus('Connection failed.', true); return; }
        socket.onopen = () => { log('WS open.'); appState.isConnected = true; DOM.loadingScreen?.classList.remove('active'); DOM.gameContainer?.classList.add('loaded'); UIManager.updateStatus('Connected.'); if (!appState.localPlayerId) UIManager.showSection('main-menu-section'); if (onOpenCallback) onOpenCallback(); }; // Show menu if reconnecting without game state
        socket.onmessage = handleServerMessage; socket.onerror = (event) => { error('WS Error:', event); };
        socket.onclose = (event) => {
            error(`WS Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`);
            const wasConnected = appState.isConnected; appState.isConnected = false; socket = null;
            GameManager.cleanupLoop(); // Stop loop on disconnect
            // Only reset state if we were actually in a game or hosting
            if (appState.mode !== 'menu') GameManager.resetClientState(false); // Don't show menu yet
            if (event.code === 1000 || event.code === 1001 || event.code === 1005) { // Normal close codes
                 UIManager.updateStatus('Disconnected.'); UIManager.showSection('main-menu-section');
            } else if (wasConnected) { UIManager.updateStatus('Connection lost. Reconnecting...', true); scheduleReconnect(); }
            else { UIManager.updateStatus('Connection failed.', true); UIManager.showSection('main-menu-section'); }
        };
    }
    function scheduleReconnect() { clearTimeout(reconnectTimer); log(`Reconnect attempt in ${RECONNECT_DELAY}ms`); reconnectTimer = setTimeout(() => { log("Attempting reconnect..."); connect(() => { UIManager.updateStatus('Reconnected.'); UIManager.showSection('main-menu-section'); }); }, RECONNECT_DELAY); } // Reconnect goes to menu
    function sendMessage(payload) { if (socket && socket.readyState === WebSocket.OPEN) { try { socket.send(JSON.stringify(payload)); } catch (err) { error("Send error:", err, payload); } } else { /* log("WS not open, message dropped:", payload.type); */ } }
    function closeConnection(code = 1000, reason = "User action") { clearTimeout(reconnectTimer); if (socket && socket.readyState === WebSocket.OPEN) { log(`Closing WS connection: ${reason} (${code})`); socket.close(code, reason); } socket = null; appState.isConnected = false; }
    return { connect, sendMessage, closeConnection };
})();

// --- Input Manager Module ---
const InputManager = (() => {
    let keys = {}; let lastShotTime = 0; let inputInterval = null; let mouseScreenPos = { x: 0, y: 0 }; let isMouseDown = false; let isRightMouseDown = false;
    const raycaster = new THREE.Raycaster(); const mouseNDC = new THREE.Vector2();
    function preventContextMenu(event) { if (DOM.canvasContainer?.contains(event.target)) event.preventDefault(); }
    function setup() {
        cleanup(); log("Input: Setting up...");
        document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp);
        DOM.chatInput?.addEventListener('keydown', handleChatEnter);
        DOM.canvasContainer?.addEventListener('mousemove', handleMouseMove); DOM.canvasContainer?.addEventListener('mousedown', handleMouseDown);
        DOM.canvasContainer?.addEventListener('contextmenu', preventContextMenu); document.addEventListener('mouseup', handleMouseUp);
        inputInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL);
    }
    function cleanup() {
        log("Input: Cleaning up...");
        document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput?.removeEventListener('keydown', handleChatEnter);
        DOM.canvasContainer?.removeEventListener('mousemove', handleMouseMove); DOM.canvasContainer?.removeEventListener('mousedown', handleMouseDown);
        DOM.canvasContainer?.removeEventListener('contextmenu', preventContextMenu); document.removeEventListener('mouseup', handleMouseUp);
        clearInterval(inputInterval); inputInterval = null; keys = {}; isMouseDown = false; isRightMouseDown = false; mouseScreenPos = { x: 0, y: 0 };
    }
    function handleMouseMove(event) {
        if (!DOM.canvasContainer || !appState.isRendererReady || !Renderer3D.getCamera || !Renderer3D.getGroundPlane || !appState.isGameLoopRunning) return;
        const rect = DOM.canvasContainer.getBoundingClientRect(); const canvasX = event.clientX - rect.left; const canvasY = event.clientY - rect.top; mouseScreenPos.x = canvasX; mouseScreenPos.y = canvasY;
        mouseNDC.x = (canvasX / rect.width) * 2 - 1; mouseNDC.y = -(canvasY / rect.height) * 2 + 1;
        const camera = Renderer3D.getCamera(); const groundPlane = Renderer3D.getGroundPlane();
        if (camera && groundPlane) { try { raycaster.setFromCamera(mouseNDC, camera); const intersects = raycaster.intersectObject(groundPlane); if (intersects.length > 0) appState.mouseWorldPosition.copy(intersects[0].point); } catch (e) { error("Input: Raycasting error:", e); } }
    }
    function handleMouseDown(event) {
        if (document.activeElement === DOM.chatInput) return;
        if (event.button === 0) isMouseDown = true; // Left click
        else if (event.button === 2) { isRightMouseDown = true; event.preventDefault(); triggerPushbackCheck(); } // Right click
    }
    function handleMouseUp(event) { if (event.button === 0) isMouseDown = false; if (event.button === 2) isRightMouseDown = false; }
    function handleKeyDown(event) { if (document.activeElement === DOM.chatInput) return; const key = event.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { if (!keys[key]) keys[key] = true; event.preventDefault(); } if (key === ' ' && !keys[' ']) { keys[' '] = true; handleShooting(); event.preventDefault(); } if (key === 'e' && !keys['e']) { keys['e'] = true; triggerPushbackCheck(); event.preventDefault(); } }
    function handleKeyUp(event) { const key = event.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) keys[key] = false; }
    function handleChatEnter(event) { if (event.key === 'Enter') { event.preventDefault(); GameManager.sendChatMessage(); } }
    function getMovementInputVector() { let dx = 0, dy = 0; if (keys['w'] || keys['arrowup']) dy -= 1; if (keys['s'] || keys['arrowdown']) dy += 1; if (keys['a'] || keys['arrowleft']) dx -= 1; if (keys['d'] || keys['arrowright']) dx += 1; if (dx !== 0 && dy !== 0) { const factor = Math.SQRT1_2; dx *= factor; dy *= factor; } return { dx, dy }; }
    function sendMovementInput() { if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) NetworkManager.sendMessage({ type: 'player_move', direction: getMovementInputVector() }); }
    function triggerPushbackCheck() { if (appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) GameManager.triggerLocalPushback(); }
    function handleShooting() {
        if (!appState.isRendererReady || appState.serverState?.status !== 'active' || !appState.localPlayerId) return;
        const playerState = appState.serverState?.players?.[appState.localPlayerId]; if (!playerState || playerState.player_status !== PLAYER_STATUS_ALIVE) return;
        const nowTimestamp = Date.now(); const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire'; const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier; if (nowTimestamp - lastShotTime < actualCooldown) return;
        lastShotTime = nowTimestamp;
        const playerRenderX = appState.renderedPlayerPos.x; const playerRenderZ = appState.renderedPlayerPos.y;
        let aimDx = 0, aimDy = -1; const targetWorldPos = appState.mouseWorldPosition;
        if (targetWorldPos && typeof playerRenderX === 'number' && typeof playerRenderZ === 'number') {
            aimDx = targetWorldPos.x - playerRenderX; aimDy = targetWorldPos.z - playerRenderZ;
            const magSq = aimDx * aimDx + aimDy * aimDy;
            if (magSq > 0.01) { const mag = Math.sqrt(magSq); aimDx /= mag; aimDy /= mag; } else { aimDx = 0; aimDy = -1; }
        } appState.localPlayerAimState.lastAimDx = aimDx; appState.localPlayerAimState.lastAimDy = aimDy;
        localEffects.muzzleFlash.active = true; localEffects.muzzleFlash.endTime = performance.now() + MUZZLE_FLASH_DURATION; localEffects.muzzleFlash.aimDx = aimDx; localEffects.muzzleFlash.aimDy = aimDy; // Store aim for renderer
        SoundManager.playSound('shoot');
        if (Renderer3D.spawnVisualAmmoCasing) { // Call renderer to spawn casing
             const spawnPos = new THREE.Vector3(playerRenderX, 0, playerRenderZ); // Position on ground
             const ejectVec = new THREE.Vector3(aimDx, 0, aimDy);
             Renderer3D.spawnVisualAmmoCasing(spawnPos, ejectVec);
        }
        NetworkManager.sendMessage({ type: 'player_shoot', target: { x: targetWorldPos.x, y: targetWorldPos.z } }); // Send target world coords
    }
    function update(deltaTime) { // Called from game loop
         if (keys[' ']) handleShooting(); // Handle continuous shooting if space is held
         if (isMouseDown) handleShooting(); // Handle continuous shooting if mouse is held
    }
    return { setup, cleanup, update, getMovementInputVector };

})();

// --- Game Manager Module ---
const GameManager = (() => {
    let isInitialized = false;
    function initListeners() {
        if (isInitialized) return; log("Game: Initializing listeners...");
        DOM.singlePlayerBtn?.addEventListener('click', () => { SoundManager.init(); startSinglePlayer(); });
        DOM.multiplayerBtn?.addEventListener('click', () => UIManager.showSection('multiplayer-menu-section'));
        const hostHandler = (maxP) => { SoundManager.init(); hostMultiplayer(maxP); };
        DOM.hostGameBtn2?.addEventListener('click', () => hostHandler(2)); DOM.hostGameBtn3?.addEventListener('click', () => hostHandler(3)); DOM.hostGameBtn4?.addEventListener('click', () => hostHandler(4));
        DOM.showJoinUIBtn?.addEventListener('click', () => UIManager.showSection('join-code-section'));
        DOM.joinGameSubmitBtn?.addEventListener('click', () => { SoundManager.init(); joinMultiplayer(); });
        DOM.cancelHostBtn?.addEventListener('click', leaveGame); DOM.sendChatBtn?.addEventListener('click', sendChatMessage);
        DOM.leaveGameBtn?.addEventListener('click', leaveGame); DOM.gameOverBackBtn?.addEventListener('click', () => resetClientState(true));
        DOM.muteBtn?.addEventListener('click', SoundManager.toggleMute);
        if(DOM.muteBtn) { DOM.muteBtn.textContent = SoundManager.getMuteState() ? 'Unmute' : 'Mute'; DOM.muteBtn.classList.toggle('muted', SoundManager.getMuteState()); }
        DOM.backButtons.forEach(btn => { const targetId = btn.dataset.target; if (targetId && document.getElementById(targetId)) { btn.addEventListener('click', (e) => { e.preventDefault(); UIManager.showSection(targetId); }); } else { log(`Warn: Back button missing/invalid target: ${targetId}`, btn); } });
        isInitialized = true; log("Game: Listeners initialized.");
    }
    function startSinglePlayer() { log("Requesting Single Player game..."); appState.mode = 'singleplayer'; UIManager.updateStatus("Starting Single Player..."); NetworkManager.sendMessage({ type: 'start_single_player' }); }
    function joinMultiplayer() { const gameId = DOM.gameIdInput?.value.trim().toUpperCase(); if (!gameId || gameId.length !== 6) { UIManager.updateStatus('Invalid Game ID (6 chars).', true); return; } log(`Joining MP game: ${gameId}`); appState.mode = 'multiplayer-client'; UIManager.updateStatus(`Joining game ${gameId}...`); NetworkManager.sendMessage({ type: 'join_game', game_id: gameId }); }
    function hostMultiplayer(maxPlayers) { log(`Hosting MP game (${maxPlayers}p)...`); if (![2, 3, 4].includes(maxPlayers)) { error("Invalid max players:", maxPlayers); UIManager.updateStatus("Invalid player count.", true); return; } appState.mode = 'multiplayer-host'; UIManager.updateStatus(`Creating ${maxPlayers}p game...`); NetworkManager.sendMessage({ type: 'create_game', max_players: maxPlayers }); }
    function leaveGame() { log("Leaving game..."); if (appState.isConnected && appState.currentGameId && appState.localPlayerId) NetworkManager.sendMessage({ type: 'leave_game' }); resetClientState(true); }
    function sendChatMessage() { const message = DOM.chatInput?.value.trim(); if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) { NetworkManager.sendMessage({ type: 'player_chat', message: message }); if(DOM.chatInput) DOM.chatInput.value = ''; } }
    function triggerLocalPushback() { localEffects.pushbackAnim.active = true; localEffects.pushbackAnim.endTime = performance.now() + localEffects.pushbackAnim.duration; NetworkManager.sendMessage({ type: 'player_pushback' }); }
    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`); cleanupLoop();
        // Clear HTML overlay pool
        if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = ''; // Clear existing elements
        Object.values(overlayElementPools).forEach(pool => { pool.elements = {}; pool.inactive = []; });

        if (appState.isRendererReady && Renderer3D.cleanup) Renderer3D.cleanup();

        const currentIsConnected = appState.isConnected;
        // Reset appState partially, keeping connection status and potentially settings
        appState = {
            ...appState, // Keep existing connection status etc.
            mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null,
            serverState: null, lastServerState: null,
            isGameLoopRunning: false, isRendererReady: false, // Reset renderer ready flag
            renderedPlayerPos: { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 },
            predictedPlayerPos: { x: DEFAULT_CANVAS_WIDTH / 2, y: DEFAULT_CANVAS_HEIGHT / 2 },
            lastStateReceiveTime: performance.now(),
            canvasWidth: DEFAULT_CANVAS_WIDTH, canvasHeight: DEFAULT_CANVAS_HEIGHT, // Reset to default until server updates
            mouseWorldPosition: new THREE.Vector3(0,0,0),
            localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
            uiPositions: {}, currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false,
        };
        // Reset local effects
        localEffects = { muzzleFlash: { active: false, endTime: 0 }, pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION }, activeAmmoCasings: [], activeBloodSparkEffects: {}, snake: { isActiveFromServer: false, segments: [] } };

        // Clear UI elements
        DOM.chatLog.innerHTML = ''; DOM.gameCodeDisplay.textContent = '------'; DOM.gameIdInput.value = ''; DOM.countdownDiv?.classList.remove('active'); DOM.dayNightIndicator.style.display = 'none'; DOM.temperatureIndicator.style.display = 'none'; DOM.playerStatsGrid.innerHTML = '<div class="stats-box placeholder">Loading Stats...</div>'; DOM.gameContainer?.classList.remove('night-mode', 'raining', 'dust-storm');

        if (showMenu) { UIManager.updateStatus(currentIsConnected ? "Connected." : "Disconnected."); UIManager.showSection('main-menu-section'); }
        else { UIManager.updateStatus("Initializing..."); } // Status if not going straight to menu (e.g., on reconnect)

        // Re-initialize renderer for the next game attempt
        if (DOM.canvasContainer) {
             appState.isRendererReady = Renderer3D.init(DOM.canvasContainer, appState.canvasWidth, appState.canvasHeight);
             if (!appState.isRendererReady) { error("Renderer re-initialization failed!"); UIManager.updateStatus("Renderer Error!", true); }
        }
    }
    function startGameLoop() {
        if (appState.isGameLoopRunning || !appState.isRendererReady || !appState.serverState) { /* log("Loop start conditions not met."); */ return; }
        log("Starting game loop..."); InputManager.setup(); appState.isGameLoopRunning = true; lastLoopTime = performance.now(); // Use performance.now
        appState.animationFrameId = requestAnimationFrame(gameLoop);
    }
    function cleanupLoop() { if (appState.animationFrameId) cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; InputManager.cleanup(); appState.isGameLoopRunning = false; log("Game loop stopped."); }
    function getInterpolatedState(renderTime) {
        const serverState = appState.serverState; const lastState = appState.lastServerState;
        if (!serverState) return null; // Cannot render without state
        if (!lastState || !serverState.timestamp || !lastState.timestamp || serverState.timestamp <= lastState.timestamp) {
            // No interpolation possible, use latest server state but override local player pos
            let currentStateCopy = JSON.parse(JSON.stringify(serverState));
            if (currentStateCopy.players?.[appState.localPlayerId]) {
                 currentStateCopy.players[appState.localPlayerId].x = appState.renderedPlayerPos.x;
                 currentStateCopy.players[appState.localPlayerId].y = appState.renderedPlayerPos.y;
            } return currentStateCopy;
        }
        const serverTime = serverState.timestamp * 1000; const lastServerTime = lastState.timestamp * 1000;
        const timeBetweenStates = serverTime - lastServerTime; if (timeBetweenStates <= 0) return serverState;
        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS;
        const timeSinceLastState = renderTargetTime - lastServerTime;
        let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates));
        let interpolatedState = JSON.parse(JSON.stringify(serverState)); // Start with newest state structure

        // Interpolate Players
        if (interpolatedState.players) {
            for (const pId in interpolatedState.players) {
                const currentP = serverState.players[pId]; const lastP = lastState.players?.[pId];
                if (pId === appState.localPlayerId) { interpolatedState.players[pId].x = appState.renderedPlayerPos.x; interpolatedState.players[pId].y = appState.renderedPlayerPos.y; } // Use client rendered pos
                else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number' && typeof currentP.y === 'number' && typeof lastP.y === 'number') { interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t); interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t); }
            }
        }
        // Interpolate Enemies
        if (interpolatedState.enemies) {
            for (const eId in interpolatedState.enemies) {
                const currentE = serverState.enemies[eId]; const lastE = lastState.enemies?.[eId];
                if (lastE && currentE.health > 0 && lastE.health > 0 && typeof currentE.x === 'number' && typeof lastE.x === 'number' && typeof currentE.y === 'number' && typeof lastE.y === 'number') { interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t); interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t); }
            }
        }
        // Interpolate Bullets (simple linear interpolation)
        if (interpolatedState.bullets) {
            for (const bId in interpolatedState.bullets) {
                const currentB = serverState.bullets[bId]; const lastB = lastState.bullets?.[bId];
                if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number' && typeof currentB.y === 'number' && typeof lastB.y === 'number') { interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t); interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t); }
            }
        }
        // Powerups usually snap, no interpolation needed unless they move
        // Damage texts appear instantly, no interpolation needed

        return interpolatedState;
    }
    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const playerState = appState.serverState.players[appState.localPlayerId]; if(playerState.player_status !== PLAYER_STATUS_ALIVE) return;
        const moveVector = InputManager.getMovementInputVector(); // Assumes InputManager is updated
        const playerSpeed = playerState?.speed ?? DEFAULT_CANVAS_WIDTH / 10; // Fallback speed
        if (moveVector.dx !== 0 || moveVector.dy !== 0) { appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime; appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime; }
        const w_half = (playerState?.width ?? 25) / 2; const h_half = (playerState?.height ?? 48) / 2;
        appState.predictedPlayerPos.x = Math.max(w_half, Math.min(appState.canvasWidth - w_half, appState.predictedPlayerPos.x)); appState.predictedPlayerPos.y = Math.max(h_half, Math.min(appState.canvasHeight - h_half, appState.predictedPlayerPos.y));
    }
    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const serverPlayerState = appState.serverState.players[appState.localPlayerId];
        if (typeof serverPlayerState.x !== 'number' || typeof serverPlayerState.y !== 'number') return;
        const serverPos = { x: serverPlayerState.x, y: serverPlayerState.y };
        const predictedPos = appState.predictedPlayerPos; const renderedPos = appState.renderedPlayerPos;
        const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);
        const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35; const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15;
        if (dist > snapThreshold * 2) { // Increase threshold slightly to avoid snapping too often
             log(`SNAP RECONCILE! Dist: ${dist.toFixed(1)}`);
             predictedPos.x = serverPos.x; predictedPos.y = serverPos.y; renderedPos.x = serverPos.x; renderedPos.y = serverPos.y;
        } else { // Smooth correction towards predicted position
            renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor); renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor);
            // Gently pull prediction towards server state if slightly off
            if (dist > 1.0) { // Only pull if error is non-trivial
                 predictedPos.x = lerp(predictedPos.x, serverPos.x, 0.05); // Very slow pull
                 predictedPos.y = lerp(predictedPos.y, serverPos.y, 0.05);
            }
        }
    }
    function gameLoop(currentTime) { // currentTime from requestAnimationFrame
        if (!appState.isGameLoopRunning) { cleanupLoop(); return; }
        const now = performance.now(); if (lastLoopTime === null) lastLoopTime = now;
        const deltaTime = Math.min(0.1, (now - lastLoopTime) / 1000); // Delta time in seconds, capped
        lastLoopTime = now;

        // Update Input (handles held keys/buttons)
        InputManager.update(deltaTime);

        // Update local effects timers
        if (localEffects.pushbackAnim.active && now >= localEffects.pushbackAnim.endTime) localEffects.pushbackAnim.active = false;
        if (localEffects.muzzleFlash.active && now >= localEffects.muzzleFlash.endTime) localEffects.muzzleFlash.active = false;

        // Client-Side Prediction & Reconciliation
        if (appState.serverState?.status === 'active') { updatePredictedPosition(deltaTime); reconcileWithServer(); }

        // Get state to render (handles interpolation)
        const stateToRender = getInterpolatedState(now);

        // Render Scene
        if (stateToRender && appState.isRendererReady && Renderer3D.renderScene) { Renderer3D.renderScene(stateToRender, appState, localEffects); }
        else if (appState.mode !== 'menu') { /* log("Skipping render..."); */ }

        // Update HTML Overlays (after rendering gives new uiPositions)
        if (stateToRender && appState.mode !== 'menu') { UIManager.updateHtmlOverlays(); }

        // Request next frame
        if (appState.isGameLoopRunning) { appState.animationFrameId = requestAnimationFrame(gameLoop); } else { cleanupLoop(); }
    }
    function setInitialGameState(state, localId, gameId, maxPlayers) {
        log("Game: Setting initial state.");
        appState.lastServerState = null; // Clear previous state on new game
        appState.serverState = state; appState.localPlayerId = localId; appState.currentGameId = gameId; appState.maxPlayersInGame = maxPlayers;
        if (state?.canvas_width && state?.canvas_height) { appState.canvasWidth = state.canvas_width; appState.canvasHeight = state.canvas_height; } else { error("Initial state missing canvas dimensions!"); appState.canvasWidth = DEFAULT_CANVAS_WIDTH; appState.canvasHeight = DEFAULT_CANVAS_HEIGHT; }
        const initialPlayer = state?.players?.[localId];
        const startX = initialPlayer?.x ?? appState.canvasWidth / 2;
        const startY = initialPlayer?.y ?? appState.canvasHeight / 2;
        appState.predictedPlayerPos = { x: startX, y: startY }; appState.renderedPlayerPos = { x: startX, y: startY };
        appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };
        // Initialize renderer here if not already done (e.g., on join/start)
        if (!appState.isRendererReady && DOM.canvasContainer) {
             appState.isRendererReady = Renderer3D.init(DOM.canvasContainer, appState.canvasWidth, appState.canvasHeight);
             if (!appState.isRendererReady) { error("Renderer initialization failed in setInitialGameState!"); UIManager.updateStatus("Renderer Error!", true); }
        }
    }
    function updateServerState(newState) {
        appState.lastServerState = appState.serverState; appState.serverState = newState; appState.lastStateReceiveTime = performance.now();
        // Update logical dimensions if they change mid-game
        if (newState?.canvas_width && newState?.canvas_height && (appState.canvasWidth !== newState.canvas_width || appState.canvasHeight !== newState.canvas_height)) {
            appState.canvasWidth = newState.canvas_width; appState.canvasHeight = newState.canvas_height;
            log(`Canvas dimensions updated mid-game: ${appState.canvasWidth}x${appState.canvasHeight}`);
            // The resize logic in renderScene handles renderer/camera updates
        }
        // Update local copy of snake state for renderer
        if(newState.snake_state) { localEffects.snake = newState.snake_state; }
        else { localEffects.snake.isActiveFromServer = false; }
    }
    function updateHostWaitUI(state) { const currentP = Object.keys(state?.players || {}).length; const maxP = appState.maxPlayersInGame || '?'; if (DOM.waitingMessage) DOM.waitingMessage.textContent = `Waiting... (${currentP}/${maxP})`; }
    function handlePlayerChat(senderId, message) { UIManager.addChatMessage(senderId, message); } // Simplified
    function handleEnemyChat(speakerId, message) { if (speakerId && message) UIManager.addChatMessage(speakerId, `(${message})`, true); } // Display enemy chat differently
    function handleDamageFeedback(newState) {
         const localId = appState.localPlayerId; if(!localId) return;
         const prevP = appState.lastServerState?.players?.[localId]; const currP = newState?.players?.[localId];
         if (prevP && currP && typeof currP.health === 'number' && typeof prevP.health === 'number' && currP.health < prevP.health) {
             const dmg = prevP.health - currP.health; const mag = Math.min(18, 5 + dmg * 0.2); // Adjusted shake calc
             if (Renderer3D.triggerShake) Renderer3D.triggerShake(mag, 250); SoundManager.playSound('damage', 0.8);
         }
         if (currP?.trigger_snake_bite_shake_this_tick && Renderer3D.triggerShake) { Renderer3D.triggerShake(15.0, 400.0); }
         // Trigger blood sparks via Renderer function
         if (newState.enemies && Renderer3D.triggerVisualHitSparks) {
             const now = performance.now();
             for (const eId in newState.enemies) {
                 const enemy = newState.enemies[eId]; const prevE = appState.lastServerState?.enemies?.[eId];
                 if (enemy?.last_damage_time && (!prevE || enemy.last_damage_time > (prevE.last_damage_time || 0))) {
                     if (now - (enemy.last_damage_time * 1000) < 150) { // Only trigger if damage is very recent
                          const enemyPos = new THREE.Vector3(enemy.x, (enemy.height/2 || ENEMY_CHASER_HEIGHT/2), enemy.y);
                          Renderer3D.triggerVisualHitSparks(enemyPos, 5); // Trigger sparks via renderer
                          SoundManager.playSound('enemy_hit', 0.6);
                     }
                 }
             }
         }
    }
    return { initListeners, startGameLoop, cleanupLoop, resetClientState, setInitialGameState, updateServerState, updateHostWaitUI, handlePlayerChat, handleEnemyChat, handleDamageFeedback, sendChatMessage, triggerLocalPushback };
})();

// --- WebSocket Message Handler ---
function handleServerMessage(event) {
    let data; try { data = JSON.parse(event.data); } catch (err) { error("Failed parse WS message:", err, event.data); return; }
    try {
        switch (data.type) {
            case 'game_created': case 'game_joined': case 'sp_game_started':
                log(`Received '${data.type}'`);
                // Ensure renderer is ready *before* setting state and starting loop
                if (!appState.isRendererReady && DOM.canvasContainer) {
                    appState.isRendererReady = Renderer3D.init(DOM.canvasContainer, appState.canvasWidth, appState.canvasHeight); // Use defaults initially
                    if (!appState.isRendererReady) { error("Renderer init failed on game start!"); UIManager.updateStatus("Renderer Error!", true); return; }
                }
                GameManager.setInitialGameState(data.initial_state, data.player_id, data.game_id, data.max_players || data.initial_state?.max_players || 1);
                if (data.type === 'game_created') { if (DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR'; UIManager.updateStatus(`Hosted Game: ${appState.currentGameId}`); GameManager.updateHostWaitUI(appState.serverState); UIManager.showSection('host-wait-section'); }
                else { const joinMsg = data.type === 'game_joined' ? `Joined ${appState.currentGameId}` : "Single Player Started!"; UIManager.updateStatus(joinMsg); UIManager.showSection('game-area'); if (appState.serverState) { UIManager.updateHUD(appState.serverState); UIManager.updateCountdown(appState.serverState); UIManager.updateEnvironmentDisplay(appState.serverState); } GameManager.startGameLoop(); } // Start loop after state is set
                break;
            case 'game_state':
                if (appState.mode === 'menu' || !appState.localPlayerId || !appState.isRendererReady) return; // Ignore if not in game or renderer isn't ready
                const previousStatus = appState.serverState?.status;
                GameManager.updateServerState(data.state); const newState = appState.serverState;
                // Handle major status transitions
                if (newState.status !== previousStatus) {
                    log(`[Client State Change] ${previousStatus || 'null'} -> ${newState.status}`);
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') { UIManager.updateStatus(newState.status === 'countdown' ? "Get Ready..." : "Active!"); UIManager.showSection('game-area'); if (!appState.isGameLoopRunning) GameManager.startGameLoop(); }
                    else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') { UIManager.updateStatus("Waiting for players..."); UIManager.showSection('host-wait-section'); GameManager.updateHostWaitUI(newState); GameManager.cleanupLoop(); }
                    else if (newState.status === 'finished' && previousStatus !== 'finished') { log("-> Game Over via 'finished' status."); UIManager.updateStatus("Game Over!"); UIManager.showGameOver(newState); SoundManager.playSound('death'); GameManager.cleanupLoop(); }
                }
                // Update UI only if game is ongoing visually
                if (appState.isGameLoopRunning && (newState.status === 'countdown' || newState.status === 'active')) { UIManager.updateHUD(newState); UIManager.updateCountdown(newState); UIManager.updateEnvironmentDisplay(newState); }
                else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') { GameManager.updateHostWaitUI(newState); }
                GameManager.handleEnemyChat(newState.enemy_speaker_id, newState.enemy_speech_text);
                GameManager.handleDamageFeedback(newState); // Process damage/hit effects
                break;
            case 'game_over_notification':
                log("Received 'game_over_notification'");
                if (data.final_state) { appState.serverState = data.final_state; UIManager.updateStatus("Game Over!"); UIManager.showGameOver(data.final_state); SoundManager.playSound('death');}
                else { error("Game over missing final_state."); UIManager.showGameOver(null); }
                GameManager.cleanupLoop(); break;
            case 'chat_message': GameManager.handlePlayerChat(data.sender_id, data.message); break;
            case 'error':
                error("[Client] Server Error:", data.message); UIManager.updateStatus(`Error: ${data.message}`, true);
                const isJoinError = appState.mode === 'multiplayer-client' && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'));
                const isHostError = appState.mode === 'multiplayer-host' && data.message.includes('creation failed');
                if (isJoinError) { UIManager.showSection('join-code-section'); appState.mode = 'menu'; }
                else if (isHostError) { GameManager.resetClientState(true); }
                else if (data.message === 'Please create or join a game first.') { GameManager.resetClientState(true); }
                // Consider closing connection on critical errors?
                break;
            default: log(`Unknown message type: ${data.type}`);
        }
    } catch (handlerError) { error("Error in handleServerMessage:", handlerError, "Data:", data); }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded. Initializing...");
    // Verify essential DOM elements exist
    if (!DOM.gameContainer || !DOM.loadingScreen || !DOM.canvasContainer || !DOM.htmlOverlay || !DOM.mainMenuSection || !DOM.gameArea) {
        error("CRITICAL: Essential DOM elements missing! Check IDs in HTML and main.js.");
        document.body.innerHTML = "<p style='color:red; font-size: 1.2em; text-align: center; padding: 2em;'>Error: Critical UI elements missing. Cannot start game.</p>";
        return;
    }

    // Initialize systems
    SoundManager.init();
    try { GameManager.initListeners(); } catch(listenerError) { error("Error initializing listeners:", listenerError); UIManager.updateStatus("Init Error: Controls failed.", true); }

    // Connect to WebSocket
    UIManager.updateStatus("Initializing Connection...");
    NetworkManager.connect(() => { log("Initial WebSocket connection successful."); });

    // Setup Debounced Resize Handler (added AFTER init potentially runs)
    resizeHandler = debounce(() => {
        if (appState.isRendererReady && Renderer3D.handleContainerResize) {
            Renderer3D.handleContainerResize();
        }
    }, RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', resizeHandler);

    // Initial UI state
    DOM.loadingScreen?.classList.add('active'); // Show loading initially
    DOM.gameContainer?.classList.remove('loaded'); // Hide game until connection
    UIManager.showSection('loading-screen'); // Explicitly show loading section
});
