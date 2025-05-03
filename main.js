// main.js
import Renderer3D from './Renderer3D.js'; // Import the new 3D Renderer

console.log("--- main.js: Starting execution ---");

// --- Client Configuration & Core Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
const SHOOT_COOLDOWN = 750;
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33;
const RECONNECT_DELAY = 3000;
const TEMP_FREEZING_CLIENT = 0.0;
const TEMP_COLD_CLIENT = 10.0;
const TEMP_TEMPERATE_CLIENT = 25.0;
const TEMP_HOT_CLIENT = 35.0;
const TEMP_SCORCHING_CLIENT = 40.0;
const MAX_TINT_ALPHA = 0.25;
const PLAYER_DEFAULTS = { width: 25, height: 48, max_health: 100, base_speed: 150 };
const ENEMY_DEFAULTS = { width: 20, height: 40, max_health: 50 };
const BULLET_DEFAULTS = { radius: 4 };
const POWERUP_DEFAULTS = { size: 20 };
const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';
const ENEMY_TYPE_CHASER = 'chaser';
const ENEMY_TYPE_SHOOTER = 'shooter';
const SNAKE_BITE_DURATION = 8.0;

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { return start + (end - start) * amount; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }

// --- DOM Element References ---
const DOM = {
    gameContainer: document.getElementById('game-container'), gameStatus: document.getElementById('game-status'),
    mainMenuSection: document.getElementById('main-menu-section'), multiplayerMenuSection: document.getElementById('multiplayer-menu-section'),
    hostWaitSection: document.getElementById('host-wait-section'), joinCodeSection: document.getElementById('join-code-section'),
    gameArea: document.getElementById('game-area'), gameOverScreen: document.getElementById('game-over-screen'),
    gameCodeDisplay: document.getElementById('game-code-display'), waitingMessage: document.getElementById('waiting-message'),
    gameIdInput: document.getElementById('gameIdInput'),
    // REMOVED: canvas: document.getElementById('gameCanvas'),
    // REMOVED: ctx: null,
    canvasContainer: document.getElementById('canvas-container'), // ADDED Reference to the container
    dayNightIndicator: document.getElementById('day-night-indicator'),
    countdownDiv: document.getElementById('countdown'), finalStatsDiv: document.getElementById('final-stats'),
    chatInput: document.getElementById('chatInput'), chatLog: document.getElementById('chat-log'),
    singlePlayerBtn: document.getElementById('singlePlayerBtn'), multiplayerBtn: document.getElementById('multiplayerBtn'),
    hostGameBtn2: document.getElementById('hostGameBtn2'), hostGameBtn3: document.getElementById('hostGameBtn3'),
    hostGameBtn4: document.getElementById('hostGameBtn4'), showJoinUIBtn: document.getElementById('showJoinUIBtn'),
    cancelHostBtn: document.getElementById('cancelHostBtn'), joinGameSubmitBtn: document.getElementById('joinGameSubmitBtn'),
    sendChatBtn: document.getElementById('sendChatBtn'), leaveGameBtn: document.getElementById('leaveGameBtn'),
    gameOverBackBtn: document.getElementById('gameOverBackBtn'),
};
// REMOVED: Canvas/Context fetching logic here

// --- Global Client State ---
let appState = {
    mode: 'menu', localPlayerId: null, maxPlayersInGame: null, currentGameId: null,
    serverState: null, animationFrameId: null, isConnected: false,
    renderedPlayerPos: { x: 0, y: 0 },
    predictedPlayerPos: { x: 0, y: 0 },
    lastServerState: null, previousServerState: null, lastLoopTime: null,
    lastStateReceiveTime: performance.now(), currentTemp: 18.0, isRaining: false,
    isDustStorm: false, targetTint: null, targetTintAlpha: 0.0,
    canvasWidth: 1600, // Keep these defaults, updated by server
    canvasHeight: 900,
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, // Initialize aiming state
};

// --- Local Effects State (Remains in main.js, read by Renderer3D) ---
let localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
let localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
let hitPauseFrames = 0; // Consider removing or adapting hit pause for 3D
let activeSpeechBubbles = {}; // Still managed here for UI updates
let activeEnemyBubbles = {}; // Still managed here for UI updates
let socket = null;
let activeAmmoCasings = []; // Physics managed here, rendering done in Renderer3D
let activeBloodSparkEffects = {}; // State managed here, rendering done in Renderer3D

// --- Sound Manager (No changes needed here) ---
const SoundManager = (() => {
    let audioContext = null;
    let loadedSounds = {};
    let soundFiles = {
        'shoot': 'assets/sounds/shoot.mp3',
        'damage': 'assets/sounds/damage.mp3'
    };
    let soundsLoading = 0;
    let soundsLoaded = 0;
    let isInitialized = false;
    let canPlaySound = false;
    function init() {
        if (isInitialized) { return canPlaySound; }
        isInitialized = true; console.log("[SoundManager] Attempting initialization...");
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) { console.error("[SoundManager] Web Audio API not supported."); canPlaySound = false; return false; }
            audioContext = new AudioContextClass(); console.log("[SoundManager] AudioContext created. State:", audioContext.state);
            if (audioContext.state === 'suspended') {
                console.log("[SoundManager] AudioContext suspended. Waiting for interaction.");
                audioContext.resume().then(() => { console.log("[SoundManager] Resumed."); canPlaySound = true; loadSounds(); }).catch(err => { console.error("[SoundManager] Failed to auto-resume:", err); canPlaySound = false; });
            } else if (audioContext.state === 'running') { console.log("[SoundManager] AudioContext running."); canPlaySound = true; loadSounds(); }
            else { console.warn("[SoundManager] Context in state:", audioContext.state); canPlaySound = false; }
        } catch (e) { console.error("[SoundManager] Error creating AudioContext:", e); audioContext = null; canPlaySound = false; return false; }
        return canPlaySound;
    }
    function loadSounds() {
        if (!audioContext) { console.error("[SoundManager] Cannot load sounds, AudioContext NA."); return; }
        console.log("[SoundManager] Loading sounds..."); soundsLoading = Object.keys(soundFiles).length; soundsLoaded = 0; loadedSounds = {};
        Object.entries(soundFiles).forEach(([name, path]) => {
            fetch(path).then(response => { if (!response.ok) throw new Error(`HTTP error ${response.status} for ${path}`); return response.arrayBuffer(); }).then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer)).then(decodedBuffer => { console.log(`[SoundManager] Decoded: ${name}`); loadedSounds[name] = decodedBuffer; soundsLoaded++; if (soundsLoaded === soundsLoading) console.log("[SoundManager] All sounds loaded."); }).catch(error => { console.error(`[SoundManager] Error loading/decoding '${name}':`, error); soundsLoaded++; if (soundsLoaded === soundsLoading) console.log("[SoundManager] Sound loading finished (with errors)."); });
        });
    }
    function playSound(name, volume = 1.0) {
        if (!isInitialized || !canPlaySound || !audioContext || audioContext.state !== 'running') { if (!isInitialized) console.warn(`[SM] Cannot play '${name}': Not initialized.`); else if (!canPlaySound || audioContext?.state !== 'running') console.warn(`[SM] Cannot play '${name}': Context not running (State: ${audioContext?.state}).`); return; }
        const buffer = loadedSounds[name]; if (!buffer) { console.warn(`[SoundManager] Sound buffer not ready for: ${name}`); return; }
        try {
            const source = audioContext.createBufferSource(); source.buffer = buffer;
            const gainNode = audioContext.createGain(); const clampedVolume = Math.max(0, Math.min(1, volume)); gainNode.gain.setValueAtTime(clampedVolume, audioContext.currentTime);
            source.connect(gainNode).connect(audioContext.destination); source.start(0);
            source.onended = () => { try { source.disconnect(); gainNode.disconnect(); } catch (e) { /* Ignore */ } };
        } catch (e) { console.error(`[SoundManager] Error playing sound '${name}':`, e); }
    }
    return { init, playSound };
})();

// --- Snake Effect State (No changes needed here) ---
let snake = {
    segmentLength: 6.0, segments: [], maxSegments: 12, frequency: 0.03, amplitude: 15.0,
    lineWidth: 3, serverHeadX: 0, serverHeadY: 0, serverBaseY: 0, isActiveFromServer: false,
    update: function(currentTime) {
        if (!this.isActiveFromServer) { this.segments = []; return; }
        const lerpFn = lerp;
        if (this.segments.length === 0) { this.segments.push({ x: this.serverHeadX, y: this.serverHeadY, time: currentTime }); }
        else { this.segments[0].x = this.serverHeadX; this.segments[0].y = this.serverHeadY; this.segments[0].time = currentTime; }
        const waveTime = currentTime * 0.005; const phaseOffsetPerSegment = 1.2; const followLerp = 0.4;
        for (let i = 1; i < this.segments.length; i++) {
            const seg = this.segments[i]; const prevSeg = this.segments[i - 1]; if (!seg || !prevSeg) continue;
            const dx = prevSeg.x - seg.x; const dy = prevSeg.y - seg.y; const dist = Math.sqrt(dx*dx + dy*dy);
            const dirX = dist > 0.01 ? dx / dist : 0; const dirY = dist > 0.01 ? dy / dist : 0;
            const targetFollowX = prevSeg.x - dirX * this.segmentLength; const wavePhase = waveTime - (i * phaseOffsetPerSegment);
            const midPoint = (this.segments.length - 1) / 2.0; const distanceFromMid = Math.abs(i - midPoint);
            const normDist = midPoint > 0 ? distanceFromMid / midPoint : 0; const amplitudeFactor = Math.cos(normDist * (Math.PI / 2));
            const targetWaveY = this.serverBaseY + Math.sin(wavePhase) * this.amplitude * amplitudeFactor;
            seg.x = lerpFn(seg.x, targetFollowX, followLerp); seg.y = lerpFn(seg.y, targetWaveY, followLerp * 1.2);
        }
        if (this.segments.length > 0 && this.segments.length < this.maxSegments) {
            const head = this.segments[0]; const neck = this.segments[1];
            if (neck) { const headNeckDistSq = (head.x - neck.x)**2 + (head.y - neck.y)**2; if (headNeckDistSq > (this.segmentLength * 1.1)**2) { this.segments.splice(1, 0, { x: lerpFn(neck.x, head.x, 0.5), y: lerpFn(neck.y, head.y, 0.5), time: currentTime }); } }
            else { this.segments.push({ x: head.x - (this.segmentLength*0.5), y: head.y, time: currentTime }); }
        }
        while (this.segments.length > this.maxSegments) { this.segments.pop(); }
    }
};

// --- Logging Wrappers ---
function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

// --- UI Management Module (Minor changes for Renderer dependency) ---
const UI = (() => {
    const allSections = [ DOM.mainMenuSection, DOM.multiplayerMenuSection, DOM.hostWaitSection, DOM.joinCodeSection, DOM.gameArea, DOM.gameOverScreen ];
    const gameSections = ['game-area'];
    function showSection(sectionId) { allSections.forEach(s => { if(s) s.style.display = 'none'; }); const sectionToShow = DOM[sectionId] || document.getElementById(sectionId); if (sectionToShow) { sectionToShow.style.display = (sectionId === 'game-area' || sectionId === 'game-over-screen') ? 'flex' : 'block'; log(`UI: Showing section: ${sectionId}`); DOM.gameContainer.classList.toggle('in-game', gameSections.includes(sectionId)); } else { error(`UI: Section not found: ${sectionId}`); } }
    function updateStatus(message, isError = false) { if (!DOM.gameStatus) return; DOM.gameStatus.textContent = message; DOM.gameStatus.style.color = isError ? (getCssVar('--player-color') || 'red') : (getCssVar('--accent-color') || 'yellow'); (isError ? error : log)("Status Update:", message); }
    function updateHUD(serverState) {
        const gridContainer = document.getElementById('player-stats-grid'); if (!gridContainer) return;
        const players = serverState?.players; const localPlayerId = appState.localPlayerId; gridContainer.innerHTML = '';
        if (!players || Object.keys(players).length === 0) { gridContainer.innerHTML = '<span>Waiting for players...</span>'; return; }
        const sortedPlayerIds = Object.keys(players).sort((a, b) => { if (a === localPlayerId) return -1; if (b === localPlayerId) return 1; return a.localeCompare(b); });
        sortedPlayerIds.forEach(playerId => {
            const pData = players[playerId]; if (!pData) return; const isSelf = (playerId === localPlayerId); const header = isSelf ? "YOU" : `P:${playerId.substring(0, 4)}`;
            const status = pData.player_status || PLAYER_STATUS_ALIVE; const health = pData.health ?? 0; const armor = pData.armor ?? 0;
            let healthDisplay; if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--health-bar-medium);'>DOWN</span>`; else if (status === PLAYER_STATUS_DEAD || health <= 0) healthDisplay = `<span style='color: var(--health-bar-low);'>DEAD</span>`; else healthDisplay = `${health.toFixed(1)}`;
            gridContainer.innerHTML += `<div class="player-stats-box"><div class="stats-header">${header}</div><div class="stats-content"><span>HP:</span> ${healthDisplay}<br><span>Armor:</span> ${Math.round(armor)}<br><span>Gun:</span> ${pData.gun ?? 1}<br><span>Speed:</span> ${pData.speed ?? PLAYER_DEFAULTS.base_speed}<br><span>Kills:</span> ${pData.kills ?? 0}<br><span>Score:</span> ${pData.score ?? 0}</div></div>`;
        });
    }
    function addChatMessage(sender, message, isSelf, isSystem = false) { if (!DOM.chatLog) return; const div = document.createElement('div'); if (isSystem) { div.className = 'system-message'; div.textContent = message; } else { div.className = isSelf ? 'my-message' : 'other-message'; div.textContent = `${sender ? `P:${sender.substring(0,4)}` : '???'}: ${message}`; } DOM.chatLog.appendChild(div); DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight; }
    function updateCountdown(serverState) { if (!DOM.countdownDiv || !DOM.dayNightIndicator) return; const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0; DOM.countdownDiv.textContent = isCountdown ? Math.ceil(serverState.countdown) : ''; DOM.countdownDiv.style.display = isCountdown ? 'block' : 'none'; DOM.dayNightIndicator.style.display = (serverState?.status === 'active') ? 'block' : 'none'; }
    function updateDayNight(serverState) {
        // This function no longer needs to call the renderer for background updates.
        // Renderer3D will handle lighting/sky changes internally based on state.
        if (!DOM.dayNightIndicator || !DOM.gameContainer) return;
        if (serverState?.status === 'active') {
            const isNight = serverState.is_night;
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day';
            DOM.dayNightIndicator.style.display = 'block';
            DOM.gameContainer.classList.toggle('night-mode', isNight); // Keep class for potential CSS effects
        } else {
            DOM.dayNightIndicator.style.display = 'none';
            DOM.gameContainer.classList.remove('night-mode');
        }
   }
    function showGameOver(finalState) { if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return; const player = finalState?.players?.[appState.localPlayerId]; let statsHtml = "Stats Unavailable"; if (player) { statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div><div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`; } DOM.finalStatsDiv.innerHTML = statsHtml; log("UI: Showing game over screen."); showSection('game-over-screen'); }
    function updateEnvironmentDisplay() { const tempIndicator = document.getElementById('temperature-indicator'); if (!tempIndicator) return; if ((appState.currentTemp === null && appState.serverState?.status !== 'active') || appState.serverState?.status === 'menu') { tempIndicator.style.display = 'none'; return; } tempIndicator.style.display = 'block'; const temp = appState.currentTemp; tempIndicator.innerHTML = `${temp.toFixed(0)}°C`; }
    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateDayNight, showGameOver, updateEnvironmentDisplay };
})();

// --- Network Module (No changes needed here) ---
const Network = (() => {
    let reconnectTimer = null;
    function connect(onOpenCallback) {
        if (socket && socket.readyState !== WebSocket.CLOSED) { if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); return; }
        clearTimeout(reconnectTimer); UI.updateStatus('Connecting...'); log("Attempting WebSocket connection to:", WEBSOCKET_URL);
        try { socket = new WebSocket(WEBSOCKET_URL); } catch (err) { error("WebSocket creation failed:", err); UI.updateStatus('Connection failed. Please refresh.', true); return; }
        socket.onopen = () => { log('WebSocket connection established.'); appState.isConnected = true; const loadingScreen = document.getElementById('loading-screen'); const gameContainer = DOM.gameContainer; if (loadingScreen) { loadingScreen.style.opacity = '0'; loadingScreen.style.pointerEvents = 'none'; } if (gameContainer) { gameContainer.style.visibility = 'visible'; gameContainer.style.opacity = '1'; } UI.updateStatus('Connected. Select Mode.'); UI.showSection('main-menu-section'); if (onOpenCallback) onOpenCallback(); };
        socket.onmessage = handleServerMessage; socket.onerror = (event) => { error('WebSocket Error Event:', event); };
        socket.onclose = (event) => { error(`WebSocket Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`); const wasConnected = appState.isConnected; appState.isConnected = false; socket = null; Game.resetClientState(false); if (event.code === 1000) { UI.updateStatus('Disconnected.'); UI.showSection('main-menu-section'); } else if (wasConnected) { UI.updateStatus('Connection lost. Reconnecting...', true); scheduleReconnect(); } else { UI.updateStatus('Connection failed. Please refresh.', true); } if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; Input.cleanup(); log("Game loop stopped due to connection close."); } };
    }
    function scheduleReconnect() { clearTimeout(reconnectTimer); log(`Scheduling reconnect in ${RECONNECT_DELAY}ms`); reconnectTimer = setTimeout(() => { log("Attempting reconnect..."); connect(() => { UI.updateStatus('Reconnected.'); UI.showSection('main-menu-section'); }); }, RECONNECT_DELAY); }
    function sendMessage(payload) { if (socket && socket.readyState === WebSocket.OPEN) { try { socket.send(JSON.stringify(payload)); } catch (err) { error("Error sending message:", err, payload); } } else { error('Cannot send message, WebSocket not open or null.', payload); } }
    function closeConnection(code = 1000, reason = "User action") { clearTimeout(reconnectTimer); if (socket && socket.readyState === WebSocket.OPEN) { log(`Closing WebSocket explicitly: ${reason} (Code: ${code})`); socket.close(code, reason); } socket = null; appState.isConnected = false; }
    return { connect, sendMessage, closeConnection };
})();

// --- Input Handling Module ---
const Input = (() => {
    let keys = {}; let lastShotTime = 0; let movementInterval = null; let mouseCanvasPos = { x: 0, y: 0 }; let isMouseDown = false;

    // Keep context menu prevention
    function preventContextMenu(event) {
        // Only prevent if the event target is the canvas container or its children (like the injected canvas)
        if (DOM.canvasContainer && DOM.canvasContainer.contains(event.target)) {
             console.log("Canvas container contextmenu event triggered! Preventing default...");
             event.preventDefault();
        }
    }

    function setup() {
        cleanup(); // Ensure clean state
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        DOM.chatInput.addEventListener('keydown', handleChatEnter);
        // Attach listeners to the CONTAINER, not the canvas itself initially
        if (DOM.canvasContainer) {
            DOM.canvasContainer.addEventListener('mousemove', handleMouseMove);
            DOM.canvasContainer.addEventListener('mousedown', handleMouseDown);
            // Add context menu listener to the container to catch right-clicks
            DOM.canvasContainer.addEventListener('contextmenu', preventContextMenu);
        } else {
            error("Input setup failed: Canvas container element not found.");
        }
        // Mouse up listener remains on document to catch releases outside the container
        document.addEventListener('mouseup', handleMouseUp);
        movementInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL);
        log("Input listeners setup.");
    }

    function cleanup() {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput.removeEventListener('keydown', handleChatEnter);
        if (DOM.canvasContainer) {
            DOM.canvasContainer.removeEventListener('mousemove', handleMouseMove);
            DOM.canvasContainer.removeEventListener('mousedown', handleMouseDown);
            DOM.canvasContainer.removeEventListener('contextmenu', preventContextMenu);
        }
        document.removeEventListener('mouseup', handleMouseUp);
        clearInterval(movementInterval);
        movementInterval = null;
        keys = {};
        isMouseDown = false;
        mouseCanvasPos = { x: 0, y: 0 };
        log("Input listeners cleaned up.");
    }

    function handleMouseMove(event) {
        // Calculate mouse position relative to the container, then scale to internal canvas size
        if (!DOM.canvasContainer) return;
        const rect = DOM.canvasContainer.getBoundingClientRect();
        
        const containerRawX = event.clientX - rect.left;
        const containerRawY = event.clientY - rect.top;

        const visualWidth = rect.width;
        const visualHeight = rect.height;
        const internalWidth = appState.canvasWidth; // Use dimensions from appState
        const internalHeight = appState.canvasHeight;

        // Calculate scale based on the container's visual size vs internal game size
        const scaleX = (visualWidth > 0) ? internalWidth / visualWidth : 1;
        const scaleY = (visualHeight > 0) ? internalHeight / visualHeight : 1;

        mouseCanvasPos.x = containerRawX * scaleX;
        mouseCanvasPos.y = containerRawY * scaleY;

        // Clamp mouse coordinates to internal canvas bounds just in case
        mouseCanvasPos.x = Math.max(0, Math.min(internalWidth, mouseCanvasPos.x));
        mouseCanvasPos.y = Math.max(0, Math.min(internalHeight, mouseCanvasPos.y));
    }


    function handleMouseDown(event) {
        if (document.activeElement === DOM.chatInput) return;

        if (event.button === 0) { // Left Click - Shoot
            isMouseDown = true;
            event.preventDefault();
        } else if (event.button === 2) { // Right Click - Pushback
            event.preventDefault();
            if (appState.serverState?.status === 'active' && appState.isConnected) {
                Network.sendMessage({ type: 'player_pushback' });
                localPlayerPushbackAnim.active = true;
                localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration;
                log("Pushback animation triggered.");
            } else { log("Pushback (RMB) ignored: Game not active or not connected."); }
        }
    }

    function isShootHeld() { return keys[' '] || isMouseDown; }

    function handleMouseUp(event) { if (event.button === 0) { isMouseDown = false; } }

    function handleKeyDown(e) {
        if (document.activeElement === DOM.chatInput) return;
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            if (!keys[key]) { keys[key] = true; } e.preventDefault(); return;
        }
        if (key === 'e') {
            if (appState.serverState?.status === 'active' && appState.isConnected) {
                Network.sendMessage({ type: 'player_pushback' });
                localPlayerPushbackAnim.active = true;
                localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration;
                log("Pushback animation triggered."); e.preventDefault();
            } else { log("Pushback ('e') ignored: Game not active or not connected."); }
            return;
        }
    }

    function handleKeyUp(e) { const key = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { if (keys[key]) { keys[key] = false; } } }
    function handleChatEnter(e) { if (e.key === 'Enter') { e.preventDefault(); Game.sendChatMessage(); } }

    function getMovementInputVector() {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1; if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1; if (keys['d'] || keys['arrowright']) dx += 1;
        if (dx !== 0 && dy !== 0) { const factor = 1 / Math.sqrt(2); dx *= factor; dy *= factor; }
        return { dx, dy };
    }

    function sendMovementInput() { if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected) { Network.sendMessage({ type: 'player_move', direction: getMovementInputVector() }); } }

    function handleShooting() {
        if (appState.serverState?.status !== 'active') return;
        const playerState = appState.serverState?.players?.[appState.localPlayerId];
        if (!playerState || playerState.player_status !== 'alive') return;

        const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire';
        const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier;
        const nowTimestamp = Date.now();
        if (nowTimestamp - lastShotTime < actualCooldown) return;
        lastShotTime = nowTimestamp;

        // Aim calculation using rendered player pos (which should be lerped/corrected)
        const playerRenderX = appState.renderedPlayerPos.x;
        const playerRenderY = appState.renderedPlayerPos.y;
        if (typeof playerRenderX !== 'number' || typeof playerRenderY !== 'number' || typeof mouseCanvasPos.x !== 'number' || typeof mouseCanvasPos.y !== 'number') {
            console.error("[handleShooting] Cannot shoot: Invalid positions", appState.renderedPlayerPos, mouseCanvasPos); return;
        }
        let aimDx = mouseCanvasPos.x - playerRenderX; let aimDy = mouseCanvasPos.y - playerRenderY;
        const aimMagSq = aimDx * aimDx + aimDy * aimDy;
        if (aimMagSq > 1) { const aimMag = Math.sqrt(aimMagSq); aimDx /= aimMag; aimDy /= aimMag; }
        else { aimDx = 0; aimDy = -1; }

        // Update Muzzle Flash (State managed here, Renderer3D reads it)
        const nowPerf = performance.now();
        localPlayerMuzzleFlash.active = true; localPlayerMuzzleFlash.endTime = nowPerf + 75;
        localPlayerMuzzleFlash.aimDx = aimDx; localPlayerMuzzleFlash.aimDy = aimDy;

        // Store Aim Direction for Renderer3D to use
        appState.localPlayerAimState.lastAimDx = aimDx;
        appState.localPlayerAimState.lastAimDy = aimDy;

        // Send Message to Server
        Network.sendMessage({ type: 'player_shoot', target: { x: mouseCanvasPos.x, y: mouseCanvasPos.y } });
        SoundManager.playSound('shoot');

        // Spawn Ammo Casing Particle (Physics managed here)
        const casingLifetime = 500 + Math.random() * 300;
        const ejectAngleOffset = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
        const ejectAngle = Math.atan2(aimDy, aimDx) + ejectAngleOffset;
        const ejectSpeed = 80 + Math.random() * 40; const gravity = 150;
        if (typeof activeAmmoCasings === 'undefined' || !Array.isArray(activeAmmoCasings)) { activeAmmoCasings = []; }
        const casing = {
            id: `casing_${nowPerf}_${Math.random().toString(16).slice(2)}`,
            x: playerRenderX + Math.cos(ejectAngle) * 15, y: playerRenderY + Math.sin(ejectAngle) * 15 - 10,
            vx: Math.cos(ejectAngle) * ejectSpeed, vy: Math.sin(ejectAngle) * ejectSpeed - 40,
            rotation: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() - 0.5) * 10,
            spawnTime: nowPerf, lifetime: casingLifetime, gravity: gravity,
            width: 6, height: 3, color: "rgba(218, 165, 32, 0.9)"
        };
        activeAmmoCasings.push(casing);
        if (activeAmmoCasings.length > 50) { activeAmmoCasings.shift(); } // Increased limit slightly
    }

    return { setup, cleanup, getMovementInputVector, handleShooting, isShootHeld };
})();

// --- Game Logic & Flow Module ---
const Game = (() => {
    function startSinglePlayer() { log("Requesting Single Player game..."); resetClientState(false); appState.mode = 'singleplayer'; UI.updateStatus("Starting Single Player..."); Network.sendMessage({ type: 'start_single_player' }); }
    function joinMultiplayer() { const gameId = DOM.gameIdInput.value.trim().toUpperCase(); if (!gameId || gameId.length !== 6) { UI.updateStatus('Invalid Game ID format.', true); return; } log(`Attempting to join game: ${gameId}`); resetClientState(false); appState.mode = 'multiplayer-client'; UI.updateStatus(`Joining game ${gameId}...`); Network.sendMessage({ type: 'join_game', game_id: gameId }); }
    function hostMultiplayer(maxPlayers) { log(`Requesting to Host MP game for ${maxPlayers} players...`); if (![2, 3, 4].includes(maxPlayers)) { error("Invalid max player count requested:", maxPlayers); UI.updateStatus("Invalid player count.", true); return; } resetClientState(false); appState.mode = 'multiplayer-host'; UI.updateStatus(`Creating ${maxPlayers}-player game...`); Network.sendMessage({ type: 'create_game', max_players: maxPlayers }); }
    function leaveGame() { log("Leaving current game..."); if (appState.isConnected && appState.currentGameId && appState.localPlayerId) { Network.sendMessage({ type: 'leave_game' }); } resetClientState(true); }
    function sendChatMessage() { const message = DOM.chatInput.value.trim(); if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) { Network.sendMessage({ type: 'player_chat', message: message }); DOM.chatInput.value = ''; } }

    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`);
        cleanupLoop(); // Stop the loop first
        // Reset core app state
        appState.localPlayerId = null; appState.currentGameId = null; appState.serverState = null; appState.lastServerState = null; appState.previousServerState = null; appState.maxPlayersInGame = null;
        appState.predictedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 };
        appState.renderedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 };
        appState.lastLoopTime = null;
        appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };
        // Reset local effects
        localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
        localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
        hitPauseFrames = 0; activeSpeechBubbles = {}; activeEnemyBubbles = {};
        activeAmmoCasings = []; activeBloodSparkEffects = {};
        if(typeof snake !== 'undefined'){ snake.isActiveFromServer = false; snake.segments = []; }
        // Reset UI elements
        DOM.chatLog.innerHTML = ''; DOM.gameCodeDisplay.textContent = '------'; DOM.gameIdInput.value = ''; if(DOM.countdownDiv) DOM.countdownDiv.style.display = 'none'; if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none'; if(DOM.gameOverScreen) DOM.gameOverScreen.style.display = 'none';
        const gridContainer = document.getElementById('player-stats-grid'); if (gridContainer) gridContainer.innerHTML = 'Loading Stats...';
        // Call Renderer cleanup
        if (typeof Renderer3D !== 'undefined') {
            Renderer3D.cleanup(); // Request renderer resource cleanup
        }
        if (showMenu) {
            appState.mode = 'menu';
            UI.updateStatus(appState.isConnected ? "Connected. Select Mode." : "Disconnected.");
            UI.showSection('main-menu-section');
        }
    }

    function gameLoop(currentTime) {
        const now = performance.now(); // Use performance.now for smooth timing

        // --- Check and reset expired local animations ---
        if (localPlayerPushbackAnim.active && now >= localPlayerPushbackAnim.endTime) {
            localPlayerPushbackAnim.active = false;
        }
        // --- End Animation Reset ---

        // --- Exit Conditions ---
        if (appState.mode === 'menu' || !appState.isConnected || appState.serverState?.game_over) {
            if (appState.serverState?.game_over && appState.mode !== 'menu') { // Check mode to avoid double update
                UI.updateStatus("Game Over!");
                UI.showGameOver(appState.serverState);
            } else if (appState.mode === 'menu') {
                UI.updateStatus(appState.isConnected ? "Connected. Select Mode." : "Disconnected.");
            }
            cleanupLoop(); // Stop loop if exiting
            return;
        }
        // --- End Exit Conditions ---

        // Wait for initial state
        if (!appState.serverState && appState.mode !== 'singleplayer') {
            appState.animationFrameId = requestAnimationFrame(gameLoop);
            return;
        }

        // --- Delta Time Calculation ---
        if (appState.lastLoopTime === null) appState.lastLoopTime = now;
        const deltaTime = Math.min(0.1, (now - appState.lastLoopTime) / 1000); // Use 'now', cap delta
        appState.lastLoopTime = now;
        // --- End Delta Time ---

        // --- Update Local Effects (Snake, Shooting) ---
        if (typeof snake !== 'undefined' && typeof snake.update === 'function') {
            snake.update(now); // Pass 'now' (performance.now based)
        }
        if (appState.serverState?.status === 'active' && Input.isShootHeld()) {
            Input.handleShooting(); // Handles cooldown internally
        }
        // --- End Local Effects ---

        // --- Update Ammo Casing Physics ---
        activeAmmoCasings = activeAmmoCasings.filter(casing => (now - casing.spawnTime) < casing.lifetime);
        activeAmmoCasings.forEach(casing => {
            casing.vy += casing.gravity * deltaTime;
            casing.x += casing.vx * deltaTime;
            casing.y += casing.vy * deltaTime;
            casing.rotation += casing.rotationSpeed * deltaTime;
        });
        // --- End Casing Physics ---


        // --- Client-Side Prediction / Reconciliation ---
        if (appState.serverState?.status === 'active') {
            if (appState.mode === 'singleplayer') { // SP directly uses server state
                const playerState = appState.serverState?.players?.[appState.localPlayerId];
                if (playerState && typeof playerState.x === 'number' && typeof playerState.y === 'number') {
                    appState.renderedPlayerPos.x = playerState.x;
                    appState.renderedPlayerPos.y = playerState.y;
                }
            } else { // MP uses prediction/reconciliation
                updatePredictedPosition(deltaTime);
                reconcileWithServer();
            }
        }
        // --- End Prediction ---

        // --- Get Interpolated State for Rendering ---
        const stateToRender = getInterpolatedState(now); // Pass 'now'
        // --- End Interpolation ---

        // --- Render Scene ---
        if (stateToRender && typeof Renderer3D !== 'undefined' && appState.mode !== 'menu') {
             // Pass all necessary state to the renderer
             // Renderer3D now internally accesses appState for things like aim direction
             // and reads local effect states (muzzle flash, pushback anim, sparks, casings)
             Renderer3D.renderScene(stateToRender, appState);
        } else if (appState.mode !== 'menu') {
             log("Skipping render: Missing state, Renderer, or context.");
        }
        // --- End Rendering ---

        // --- Request Next Frame ---
        // Check conditions again before requesting next frame
        if (appState.mode !== 'menu' && appState.isConnected && !appState.serverState?.game_over) {
            appState.animationFrameId = requestAnimationFrame(gameLoop);
        } else {
            if (appState.animationFrameId) cleanupLoop(); // Clean up if loop shouldn't continue
        }
        // --- End Next Frame ---
    }

    function startGameLoop() {
        if (appState.mode === 'menu') return;
        if (appState.animationFrameId) return; // Already running
        if (!appState.serverState && appState.mode !== 'singleplayer') {
             log("Delaying game loop start: Waiting for initial server state.");
             return; // Wait for state
        }
        Input.setup(); // Setup input handlers
        log("Starting game loop...");
        appState.lastLoopTime = null; // Reset timer
        appState.animationFrameId = requestAnimationFrame(gameLoop); // Start the loop
    }

    function getInterpolatedState(renderTime) {
        const INTERPOLATION_BUFFER_MS = 100;
        const serverState = appState.serverState;
        const lastServerState = appState.lastServerState;

        // Basic checks for valid states to interpolate
        if (!serverState || !lastServerState || !serverState.timestamp || !lastServerState.timestamp) {
            return serverState; // Return latest known state if interpolation isn't possible
        }

        const serverTime = serverState.timestamp * 1000;
        const lastServerTime = lastServerState.timestamp * 1000;

        if (serverTime <= lastServerTime) {
             return serverState; // New state isn't newer, return it directly
        }

        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS;
        const timeBetweenStates = serverTime - lastServerTime;
        const timeSinceLastState = renderTargetTime - lastServerTime;
        let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates));

        // Create a deep copy to avoid modifying the original state objects
        let interpolatedState = JSON.parse(JSON.stringify(serverState));

        // Interpolate Players (excluding local player if prediction is active)
        if (interpolatedState.players) {
            for (const pId in interpolatedState.players) {
                const currentP = serverState.players[pId];
                const lastP = lastServerState.players?.[pId];

                if (pId === appState.localPlayerId && appState.mode !== 'singleplayer') {
                    // Use the client's corrected rendered position for the local player
                    interpolatedState.players[pId].x = appState.renderedPlayerPos.x;
                    interpolatedState.players[pId].y = appState.renderedPlayerPos.y;
                } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number') {
                    // Interpolate remote players
                    interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t);
                    interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t);
                }
                // else: Keep the latest server state for players without previous data
            }
        }

        // Interpolate Enemies
        if (interpolatedState.enemies) {
            for (const eId in interpolatedState.enemies) {
                const currentE = serverState.enemies[eId];
                const lastE = lastServerState.enemies?.[eId];
                // Interpolate only if enemy exists in both states and is likely alive/moving
                if (lastE && typeof currentE.x === 'number' && typeof lastE.x === 'number' && currentE.health > 0) {
                    interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t);
                    interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t);
                }
            }
        }

        // Interpolate Bullets
        if (interpolatedState.bullets) {
            for (const bId in interpolatedState.bullets) {
                const currentB = serverState.bullets[bId];
                const lastB = lastServerState.bullets?.[bId];
                if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number') {
                    interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t);
                    interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t);
                }
            }
        }

        // Non-interpolated data (use latest state)
        interpolatedState.powerups = serverState.powerups;
        interpolatedState.damage_texts = serverState.damage_texts;
        // Keep other top-level state as is (status, score, is_night, etc.)

        return interpolatedState;
    }

    function cleanupLoop() {
        if (appState.animationFrameId) {
            cancelAnimationFrame(appState.animationFrameId);
            appState.animationFrameId = null;
            log("Game loop stopped and cleaned up.");
        }
        Input.cleanup(); // Cleanup input listeners
        appState.lastLoopTime = null; // Reset loop timer
    }

    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const moveVector = Input.getMovementInputVector();
        const playerState = appState.serverState.players[appState.localPlayerId];
        // Use the player's *current actual speed* from the server state for prediction
        const playerSpeed = playerState?.speed ?? PLAYER_DEFAULTS.base_speed;
        if (moveVector.dx !== 0 || moveVector.dy !== 0) {
            appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime;
            appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime;
        }
        // Clamp using player dimensions from server state or defaults
        const w_half = (playerState?.width ?? PLAYER_DEFAULTS.width) / 2;
        const h_half = (playerState?.height ?? PLAYER_DEFAULTS.height) / 2;
        appState.predictedPlayerPos.x = Math.max(w_half, Math.min(appState.canvasWidth - w_half, appState.predictedPlayerPos.x));
        appState.predictedPlayerPos.y = Math.max(h_half, Math.min(appState.canvasHeight - h_half, appState.predictedPlayerPos.y));
    }

    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const serverPos = appState.serverState.players[appState.localPlayerId];
        if (typeof serverPos.x !== 'number' || typeof serverPos.y !== 'number') return;

        const predictedPos = appState.predictedPlayerPos;
        const renderedPos = appState.renderedPlayerPos;

        const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);
        const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35;
        const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15;

        if (dist > snapThreshold) {
            // Snap prediction and render position directly to server position
            predictedPos.x = serverPos.x; predictedPos.y = serverPos.y;
            renderedPos.x = serverPos.x; renderedPos.y = serverPos.y;
        } else {
            // Gently lerp the rendered position towards the predicted position
            renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor);
            renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor);
        }
    }

    function initListeners() {
        log("Initializing button listeners...");
        if (DOM.singlePlayerBtn) DOM.singlePlayerBtn.onclick = () => { SoundManager.init(); startSinglePlayer(); };
        const hostHandler = (maxPlayers) => { SoundManager.init(); hostMultiplayer(maxPlayers); };
        if (DOM.hostGameBtn2) DOM.hostGameBtn2.onclick = () => hostHandler(2);
        if (DOM.hostGameBtn3) DOM.hostGameBtn3.onclick = () => hostHandler(3);
        if (DOM.hostGameBtn4) DOM.hostGameBtn4.onclick = () => hostHandler(4);
        if (DOM.joinGameSubmitBtn) DOM.joinGameSubmitBtn.onclick = () => { SoundManager.init(); joinMultiplayer(); };
        if (DOM.multiplayerBtn) DOM.multiplayerBtn.onclick = () => UI.showSection('multiplayer-menu-section');
        if (DOM.showJoinUIBtn) DOM.showJoinUIBtn.onclick = () => UI.showSection('join-code-section');
        if (DOM.cancelHostBtn) DOM.cancelHostBtn.onclick = leaveGame;
        if (DOM.sendChatBtn) DOM.sendChatBtn.onclick = sendChatMessage;
        if (DOM.leaveGameBtn) DOM.leaveGameBtn.onclick = leaveGame;
        if (DOM.gameOverBackBtn) DOM.gameOverBackBtn.onclick = () => resetClientState(true);
        // Back buttons (ensure UI module is accessible)
        DOM.gameContainer.querySelectorAll('.back-button').forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick');
            if (onclickAttr && onclickAttr.startsWith("UI.showSection")) { // Make sure it's the right handler
                const targetMatch = onclickAttr.match(/'([^']+)'/);
                if (targetMatch && targetMatch[1]) {
                     const targetId = targetMatch[1];
                     // Re-assign using addEventListener or standard onclick
                     btn.onclick = (e) => { e.preventDefault(); UI.showSection(targetId); };
                 } else { log(`Warning: Could not parse target section from back button onclick: ${onclickAttr}`); }
             } else { log("Warning: Back button found without standard 'UI.showSection' onclick:", btn); }
         });
        log("Finished initializing button listeners.");
    }

    return {
        startSinglePlayer, joinMultiplayer, hostMultiplayer, leaveGame, sendChatMessage,
        resetClientState, startGameLoop, cleanupLoop, getInterpolatedState, initListeners
    };
})();

// --- Global Server Message Handler (Minor changes for Renderer dependency) ---
function handleServerMessage(event) {
    let data;
    try { data = JSON.parse(event.data); }
    catch (err) { error("Failed to parse server message:", err, event.data); UI.updateStatus("Received invalid data from server.", true); return; }

    try {
        // Check if Renderer3D is loaded before processing state-dependent messages
        if (typeof Renderer3D === 'undefined' && ['sp_game_started', 'game_joined', 'game_state', 'game_created', 'game_over_notification'].includes(data.type)) {
             error(`Received critical message type '${data.type}' before Renderer3D was ready! Check loading order.`);
             return; // Don't process further
        }

        switch (data.type) {
            case 'game_created':
            case 'game_joined':
            case 'sp_game_started':
                log(`Received '${data.type}'`);
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state;
                appState.maxPlayersInGame = data.max_players || appState.serverState?.max_players || (data.type === 'sp_game_started' ? 1 : '?'); // Ensure maxPlayers is set

                // Set Canvas Dimensions from initial state
                if (data.initial_state && typeof data.initial_state.canvas_width === 'number' && typeof data.initial_state.canvas_height === 'number') {
                    appState.canvasWidth = data.initial_state.canvas_width;
                    appState.canvasHeight = data.initial_state.canvas_height;
                    // Renderer3D.updateSize() will be called internally or explicitly if needed
                } else {
                    error(`Initial state ('${data.type}') missing canvas dimensions! Using defaults.`, data.initial_state);
                    // Keep defaults in appState
                }

                const initialPlayer = appState.serverState?.players[appState.localPlayerId];
                if (initialPlayer) {
                     appState.predictedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y };
                     appState.renderedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y };
                } else { // Reset position if player data missing somehow
                     appState.predictedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 };
                     appState.renderedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 };
                }
                appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 }; // Reset aim

                if (data.type === 'game_created') {
                    DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR';
                    const currentP = Object.keys(appState.serverState?.players || {}).length;
                    DOM.waitingMessage.textContent = `Waiting for Team Mate... (${currentP}/${appState.maxPlayersInGame})`;
                    UI.updateStatus(`Game hosted. Code: ${appState.currentGameId}`);
                    UI.showSection('host-wait-section');
                    // Loop starts when state becomes 'countdown' or 'active'
                } else { // game_joined or sp_game_started
                     UI.updateStatus(data.type === 'game_joined' ? `Joined game ${appState.currentGameId}.` : "Single Player Started!");
                     UI.showSection('game-area');
                     // Initial UI updates
                     if (appState.serverState) {
                         UI.updateHUD(appState.serverState);
                         UI.updateCountdown(appState.serverState);
                         UI.updateDayNight(appState.serverState);
                         UI.updateEnvironmentDisplay();
                     }
                     Game.startGameLoop(); // Start loop immediately
                }
                break;

            case 'game_state':
                if (appState.mode === 'menu') return; // Ignore if in menu

                const previousStatus = appState.serverState?.status;
                const previousPlayerState = appState.serverState?.players?.[appState.localPlayerId];

                appState.previousServerState = appState.lastServerState;
                appState.lastServerState = appState.serverState;
                appState.serverState = data.state;
                const newState = appState.serverState;
                const currentPlayerState = newState?.players?.[appState.localPlayerId];
                appState.lastStateReceiveTime = performance.now(); // Update receive time

                // Update local state copies
                appState.currentTemp = newState.current_temperature ?? 18.0;
                appState.isRaining = newState.is_raining ?? false;
                appState.isDustStorm = newState.is_dust_storm ?? false;

                // Update Snake State (Visuals handled by Renderer3D reading 'snake')
                const serverSnakeState = newState.snake_state;
                if (serverSnakeState && typeof snake !== 'undefined') {
                    snake.isActiveFromServer = serverSnakeState.active;
                    snake.serverHeadX = serverSnakeState.head_x;
                    snake.serverHeadY = serverSnakeState.head_y;
                    snake.serverBaseY = serverSnakeState.base_y;
                    if (snake.isActiveFromServer && snake.segments.length === 0) { snake.segments = [{ x: snake.serverHeadX, y: snake.serverHeadY, time: performance.now() }]; }
                    else if (!snake.isActiveFromServer) { snake.segments = []; }
                } else if (typeof snake !== 'undefined') { snake.isActiveFromServer = false; snake.segments = []; }

                 // --- Update Blood Spark Effects ---
                 if (newState.enemies) {
                    const now = performance.now();
                    const sparkDuration = 300; // ms
                    for (const enemyId in newState.enemies) {
                        const enemy = newState.enemies[enemyId];
                        const previousEnemy = appState.lastServerState?.enemies?.[enemyId];
                        if (enemy && enemy.last_damage_time && (!previousEnemy || enemy.last_damage_time > (previousEnemy.last_damage_time || 0))) {
                            const serverHitTimeMs = enemy.last_damage_time * 1000;
                            if (now - serverHitTimeMs < 200) { activeBloodSparkEffects[enemyId] = now + sparkDuration; }
                        }
                    }
                    for (const enemyId in activeBloodSparkEffects) { if (now >= activeBloodSparkEffects[enemyId]) { delete activeBloodSparkEffects[enemyId]; } }
                }

                // Damage Check and Sound/Shake Trigger
                let localPlayerDamagedThisTick = false;
                if (previousPlayerState && currentPlayerState && typeof currentPlayerState.health === 'number' && typeof previousPlayerState.health === 'number' && currentPlayerState.health < previousPlayerState.health) {
                    const damageTaken = previousPlayerState.health - currentPlayerState.health;
                    const baseMag = 5; const dmgScale = 0.18; const maxMag = 18;
                    const shakeMagnitude = Math.min(maxMag, baseMag + damageTaken * dmgScale);
                    if (typeof Renderer3D !== 'undefined') Renderer3D.triggerShake(shakeMagnitude, 250);
                    localPlayerDamagedThisTick = true;
                }
                if (localPlayerDamagedThisTick) { SoundManager.playSound('damage'); }

                 // Snake Bite Shake Trigger
                 if (currentPlayerState?.trigger_snake_bite_shake_this_tick) {
                     const shakeMag = snake?.shakeMagnitude ?? 15.0;
                     const shakeDur = snake?.shakeDurationMs ?? 400.0;
                     if(typeof Renderer3D !== 'undefined') Renderer3D.triggerShake(shakeMag, shakeDur);
                 }

                // Handle Game Status Transitions
                if (newState.status !== previousStatus) {
                    log(`[Client State Change] From ${previousStatus || 'null'} to ${newState.status}`);
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') {
                        UI.updateStatus(newState.status === 'countdown' ? "Countdown..." : "Game active!");
                        UI.showSection('game-area');
                        if (!appState.animationFrameId) Game.startGameLoop(); // Start loop if not running
                    } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') {
                        UI.updateStatus("Game reverted to waiting.", true);
                        UI.showSection('host-wait-section');
                        const pCountWaiting = Object.keys(newState.players || {}).length;
                        DOM.waitingMessage.textContent = `Waiting... (${pCountWaiting}/${appState.maxPlayersInGame || '?'})`;
                        Game.cleanupLoop();
                    } else if (newState.status === 'finished' && previousStatus !== 'finished') {
                         log("-> Game Over sequence via 'finished' status.");
                         Game.cleanupLoop();
                         UI.showGameOver(newState);
                    }
                }

                // Update UI if game is running
                if (appState.animationFrameId && (newState.status === 'countdown' || newState.status === 'active')) {
                    UI.updateHUD(newState); UI.updateCountdown(newState); UI.updateDayNight(newState); UI.updateEnvironmentDisplay();
                } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') { // Update host waiting count
                    const pCount = Object.keys(newState.players || {}).length;
                    DOM.waitingMessage.textContent = `Waiting... (${pCount}/${appState.maxPlayersInGame || '?'})`;
                }

                // Update Enemy Speech Bubbles
                const speakerId = newState.enemy_speaker_id; const speechText = newState.enemy_speech_text;
                if (speakerId && speechText) { activeEnemyBubbles[speakerId] = { text: speechText.substring(0, 50), endTime: performance.now() + 3000 }; }
                break;

            case 'game_over_notification':
                log("Received 'game_over_notification'");
                if (data.final_state) {
                    appState.serverState = data.final_state; UI.updateStatus("Game Over!");
                    Game.cleanupLoop(); UI.showGameOver(data.final_state);
                    log("-> Game Over sequence via notification.");
                } else { error("Received 'game_over_notification' missing final_state."); Game.resetClientState(true); }
                break;

             case 'chat_message':
                 const senderId = data.sender_id; const msgText = data.message;
                 if (!senderId || !msgText) { log("Received incomplete chat message", data); break; }
                 const isSelf = senderId === appState.localPlayerId;
                 UI.addChatMessage(senderId, msgText, isSelf);
                 if (appState.serverState?.players?.[senderId]) { activeSpeechBubbles[senderId] = { text: msgText.substring(0, 50), endTime: performance.now() + 4000 }; }
                 break;

             case 'error':
                 error("[Client] Server Error:", data.message); UI.updateStatus(`Error: ${data.message}`, true);
                 if (appState.mode === 'multiplayer-client' && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'))) { UI.showSection('join-code-section'); appState.mode = 'menu'; }
                 else if (appState.mode === 'multiplayer-host' && data.message.includes('Creation Error')) { Game.resetClientState(true); }
                 else if (data.message === 'Please create or join a game first.') { Game.resetClientState(true); }
                 break;

            default: log(`Unknown message type: ${data.type}`);
        }
    } catch (handlerError) { error("Error in handleServerMessage:", handlerError, "Data:", data); UI.updateStatus("Client error processing msg.", true); }
}

// --- DOMContentLoaded Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded.");
    // --- Check for Renderer3D ---
    if (typeof Renderer3D === 'undefined') {
        error("CRITICAL: Renderer3D is not defined after DOM load!");
        UI.updateStatus("Init Error: Renderer failed. Refresh.", true);
        return; // Stop initialization
    }
    // --- Initialize Renderer3D ---
    if (DOM.canvasContainer) {
         if (!Renderer3D.init(DOM.canvasContainer)) { // Pass the container
             error("Renderer3D initialization failed!");
             UI.updateStatus("Init Error: Graphics failed. Refresh.", true);
             return; // Stop initialization
         }
         log("Renderer3D initialized successfully.");
    } else {
         error("Canvas container element not found for Renderer init!");
         UI.updateStatus("Init Error: UI missing. Refresh.", true);
         return; // Stop initialization
    }
    // --- Initialize Listeners ---
    try {
        Game.initListeners(); // Call the exported listener setup
        log("Button listeners initialized via Game.initListeners().");
    } catch(listenerError) {
        error("Error initializing button listeners:", listenerError);
        UI.updateStatus("Init Error: Controls failed. Refresh.", true);
        return;
    }
    // --- Connect WebSocket ---
    UI.updateStatus("Initializing Connection...");
    Network.connect(() => { /* Connection success handled internally */ });
});
