// main.js

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
    gameIdInput: document.getElementById('gameIdInput'), canvas: document.getElementById('gameCanvas'),
    ctx: null,
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
if (DOM.canvas) {
    DOM.ctx = DOM.canvas.getContext('2d');
    if (!DOM.ctx) { console.error("Failed to get 2D context from canvas!"); }
} else { console.error("Canvas element not found!"); }


// --- Global Client State ---
let appState = {
    mode: 'menu', localPlayerId: null, maxPlayersInGame: null, currentGameId: null,
    serverState: null, animationFrameId: null, isConnected: false,
    renderedPlayerPos: { x: 0, y: 0 },  // Initial position can be 0,0 now
    predictedPlayerPos: { x: 0, y: 0 }, // Initial position can be 0,0 now
    lastServerState: null, previousServerState: null, lastLoopTime: null,
    lastStateReceiveTime: performance.now(), currentTemp: 18.0, isRaining: false,
    isDustStorm: false, targetTint: null, targetTintAlpha: 0.0,
    canvasWidth: 1600,  // Add to appState, with default values
    canvasHeight: 900, // Add to appState, with default values
};

// --- Local Effects State ---
let localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
// --- NEW: Pushback Animation State ---
let localPlayerPushbackAnim = {
    active: false,
    endTime: 0,
    duration: 250 // Animation duration in ms (adjust for desired speed)
};
// -------------------------------------
let hitPauseFrames = 0;
let activeSpeechBubbles = {};
let activeEnemyBubbles = {};
let socket = null;
let activeAmmoCasings = [];
let activeBloodSparkEffects = {}; // Stores { enemyId: effectEndTime }

// --- Sound Manager ---
const SoundManager = (() => {
    let audioContext = null;
    let loadedSounds = {}; // Holds the decoded AudioBuffers
    let soundFiles = {      // Map sound names to their file paths
        'shoot': 'assets/sounds/shoot.mp3',
        'damage': 'assets/sounds/damage.mp3'
        // Add more sounds here later
    };
    let soundsLoading = 0;
    let soundsLoaded = 0;
    let isInitialized = false; // Tracks if init() has been called at least once
    let canPlaySound = false;  // Tracks if AudioContext is successfully running

    // Function to initialize the AudioContext.
    // IMPORTANT: Must be called directly as a result of a user interaction (e.g., button click)
    // due to browser autoplay policies.
    function init() {
        if (isInitialized) {
            return canPlaySound; // Prevent re-initialization attempts
        }
        isInitialized = true;
        console.log("[SoundManager] Attempting initialization...");

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                console.error("[SoundManager] Web Audio API not supported by this browser.");
                canPlaySound = false;
                return false;
            }

            audioContext = new AudioContextClass();
            console.log("[SoundManager] AudioContext created. Initial state:", audioContext.state);

            // Handle potential suspended state - requires user interaction to resume
            if (audioContext.state === 'suspended') {
                console.log("[SoundManager] AudioContext is suspended. Waiting for user interaction (or resume call).");
                // Attempt immediate resume - this might only work if init() IS the direct result of the click
                audioContext.resume().then(() => {
                    console.log("[SoundManager] AudioContext resumed successfully.");
                    canPlaySound = true;
                    loadSounds(); // Load sounds once context is ready
                }).catch(err => {
                    // Log error but don't halt; sound might be enabled later manually if needed
                    console.error("[SoundManager] Failed to auto-resume AudioContext (may need more direct user gesture):", err);
                    canPlaySound = false;
                });
            } else if (audioContext.state === 'running') {
                console.log("[SoundManager] AudioContext is running.");
                canPlaySound = true;
                loadSounds(); // Load sounds now
            } else {
                 console.warn("[SoundManager] AudioContext in unexpected state:", audioContext.state);
                 canPlaySound = false;
            }
        } catch (e) {
            console.error("[SoundManager] Error creating AudioContext:", e);
            audioContext = null;
            canPlaySound = false;
            return false;
        }
        return canPlaySound; // Return status after initial attempt
    }

    // Function to load all defined sounds
    function loadSounds() {
        if (!audioContext) {
             console.error("[SoundManager] Cannot load sounds, AudioContext not available.");
             return;
        }
        console.log("[SoundManager] Starting to load sounds...");
        soundsLoading = Object.keys(soundFiles).length;
        soundsLoaded = 0;
        loadedSounds = {}; // Clear previous buffers

        Object.entries(soundFiles).forEach(([name, path]) => {
            fetch(path)
                .then(response => {
                    if (!response.ok) {
                        console.error(`[SoundManager] HTTP error! status: ${response.status} fetching ${path}`);
                        throw new Error(`HTTP error! status: ${response.status} for ${path}`);
                    }
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
                .then(decodedBuffer => {
                    console.log(`[SoundManager] Decoded: ${name}`);
                    loadedSounds[name] = decodedBuffer;
                    soundsLoaded++;
                    if (soundsLoaded === soundsLoading) {
                         console.log("[SoundManager] All sounds loaded successfully.");
                    }
                })
                .catch(error => {
                    console.error(`[SoundManager] Error loading/decoding sound '${name}' from ${path}:`, error);
                    soundsLoaded++; // Still count as "processed" even if failed
                     if (soundsLoaded === soundsLoading) {
                         console.log("[SoundManager] Sound loading finished (with errors).");
                     }
                });
        });
    }

    // Function to play a loaded sound by name
    function playSound(name, volume = 1.0) {
        // Essential checks: Init called? Context running? Sound buffer ready?
        if (!isInitialized || !canPlaySound || !audioContext || audioContext.state !== 'running') {
            // Log warning if sound cannot play due to system state
             if (!isInitialized) console.warn(`[SoundManager] Cannot play '${name}': Not initialized.`);
             else if (!canPlaySound || audioContext?.state !== 'running') console.warn(`[SoundManager] Cannot play '${name}': AudioContext not running (State: ${audioContext?.state}).`);
            return;
        }

        const buffer = loadedSounds[name];
        if (!buffer) {
            // Log warning if the specific sound buffer isn't ready
            console.warn(`[SoundManager] Sound buffer not ready for: ${name}`);
            return;
        }

        // Proceed with playback
        try {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            const gainNode = audioContext.createGain();
            const clampedVolume = Math.max(0, Math.min(1, volume)); // Ensure volume is 0-1
            gainNode.gain.setValueAtTime(clampedVolume, audioContext.currentTime);

            source.connect(gainNode).connect(audioContext.destination);
            source.start(0); // Play immediately

            // Disconnect nodes after playback finishes to free resources
            source.onended = () => {
                try {
                    source.disconnect();
                    gainNode.disconnect();
                } catch (e) { /* Ignore errors during cleanup */ }
            };

        } catch (e) {
            console.error(`[SoundManager] Error playing sound '${name}':`, e);
        }
    }

    return {
        init,
        playSound
    };
})();
// --- End Sound Manager ---

// --- Snake Effect State ---
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

// --- UI Management Module ---
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
    // Inside the UI Module in main.js
    function updateDayNight(serverState) {
        if (!DOM.dayNightIndicator || !DOM.canvas || !DOM.gameContainer) return;
        if (serverState?.status === 'active') {
            const isNight = serverState.is_night;
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day';
            DOM.dayNightIndicator.style.display = 'block';
            if (typeof Renderer !== 'undefined') {
                // --- CORRECTED LINE ---
                // Use the canvas dimensions stored in appState
                Renderer.updateGeneratedBackground(isNight, appState.canvasWidth, appState.canvasHeight);
                // --- END CORRECTION ---
            } else {
                error("Renderer not defined when calling updateGeneratedBackground from UI!");
            }
            DOM.gameContainer.classList.toggle('night-mode', isNight);
        } else {
            DOM.dayNightIndicator.style.display = 'none';
            DOM.gameContainer.classList.remove('night-mode');
        }
   }
    function showGameOver(finalState) { if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return; const player = finalState?.players?.[appState.localPlayerId]; let statsHtml = "Stats Unavailable"; if (player) { statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div><div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`; } DOM.finalStatsDiv.innerHTML = statsHtml; log("UI: Showing game over screen."); showSection('game-over-screen'); }
    function updateEnvironmentDisplay() { const tempIndicator = document.getElementById('temperature-indicator'); if (!tempIndicator) return; if ((appState.currentTemp === null && appState.serverState?.status !== 'active') || appState.serverState?.status === 'menu') { tempIndicator.style.display = 'none'; return; } tempIndicator.style.display = 'block'; const temp = appState.currentTemp; tempIndicator.innerHTML = `${temp.toFixed(0)}°C`; }
    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateDayNight, showGameOver, updateEnvironmentDisplay };
})();

// --- Network Module ---
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

    // Named function for context menu prevention
    function preventContextMenu(event) {
        console.log("Canvas contextmenu event triggered! Preventing default...");
        event.preventDefault();
    }

    function setup() {
        cleanup(); // Calls cleanup first
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        DOM.chatInput.addEventListener('keydown', handleChatEnter);
        if (DOM.canvas) {
            DOM.canvas.addEventListener('mousemove', handleMouseMove);
            DOM.canvas.addEventListener('mousedown', handleMouseDown);
            DOM.canvas.addEventListener('contextmenu', preventContextMenu); // Add listener
        } else {
            error("Input setup failed: Canvas element not found.");
        }
        document.addEventListener('mouseup', handleMouseUp);
        movementInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL);
        log("Input listeners setup.");
    }

    function cleanup() {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput.removeEventListener('keydown', handleChatEnter);
        if (DOM.canvas) {
            DOM.canvas.removeEventListener('mousemove', handleMouseMove);
            DOM.canvas.removeEventListener('mousedown', handleMouseDown);
            DOM.canvas.removeEventListener('contextmenu', preventContextMenu); // Remove listener
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
        if (!DOM.canvas) return;
        const rect = DOM.canvas.getBoundingClientRect();
        const rawMouseX = event.clientX - rect.left;
        const rawMouseY = event.clientY - rect.top;
        const visualWidth = rect.width;
        const visualHeight = rect.height;
        const internalWidth = DOM.canvas.width;
        const internalHeight = DOM.canvas.height;
        const scaleX = (visualWidth > 0) ? internalWidth / visualWidth : 1;
        const scaleY = (visualHeight > 0) ? internalHeight / visualHeight : 1;
        mouseCanvasPos.x = rawMouseX * scaleX;
        mouseCanvasPos.y = rawMouseY * scaleY;
    }

    // --- MODIFIED: handleMouseDown ---
    function handleMouseDown(event) {
        if (document.activeElement === DOM.chatInput) return; // Ignore if typing in chat

        // Button mapping: 0 = Left, 1 = Middle, 2 = Right
        if (event.button === 0) { // Left Click - Shoot
            isMouseDown = true;
            event.preventDefault(); // Prevent text selection, etc.
            // Shooting logic is handled by isShootHeld() check in game loop
        } else if (event.button === 2) { // Right Click - Pushback
            event.preventDefault(); // Prevent context menu (extra safety)

            // Check game state before sending
            if (appState.serverState?.status === 'active' && appState.isConnected) {
                log("Sending player_pushback message (triggered by RMB).");
                Network.sendMessage({ type: 'player_pushback' });

                // Trigger the visual animation
                localPlayerPushbackAnim.active = true;
                localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration;
                log("Pushback animation triggered.");

            } else {
                log("Pushback (RMB) ignored: Game not active or not connected.");
            }
        }
        // Ignore middle mouse button (event.button === 1) for now
    }
    function isShootHeld() {
        // Shoot is triggered by holding Space or Left Mouse Button
        return keys[' '] || isMouseDown;
    }

    function handleMouseUp(event) {
        if (event.button === 0) { // Left Click Release
            isMouseDown = false;
        }
        // No action needed for right-click release
    }

    function handleKeyDown(e) {
        if (document.activeElement === DOM.chatInput) return;
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            if (!keys[key]) { keys[key] = true; }
            e.preventDefault();
            return;
        }
        if (key === 'e') { // Keep 'E' key functional too
            if (appState.serverState?.status === 'active' && appState.isConnected) {
                log("Sending player_pushback message (triggered by E key).");
                Network.sendMessage({ type: 'player_pushback' });

                 // Trigger the visual animation (same as RMB)
                localPlayerPushbackAnim.active = true;
                localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration;
                 log("Pushback animation triggered.");

                e.preventDefault();
            } else {
                log("Pushback ('e') ignored: Game not active or not connected.");
            }
            return;
        }
    }

    function handleKeyUp(e) {
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            if (keys[key]) { keys[key] = false; }
        }
    }

    function handleChatEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            log("Enter key detected in chat input.");
            Game.sendChatMessage();
        }
    }

    function getMovementInputVector() {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;
        if (dx !== 0 && dy !== 0) {
            const factor = 1 / Math.sqrt(2);
            dx *= factor;
            dy *= factor;
        }
        return { dx, dy };
    }

    function sendMovementInput() {
        if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected) {
            Network.sendMessage({ type: 'player_move', direction: getMovementInputVector() });
        }
    }

    function handleShooting() {
        // --- Basic Checks ---
        if (appState.serverState?.status !== 'active') {
            // console.log("Shoot ignored: Game not active.");
            return;
        }
        const playerState = appState.serverState?.players?.[appState.localPlayerId];
        if (!playerState) {
            // console.log("Shoot ignored: Local player state not found.");
            return;
        }
         if (playerState.player_status !== 'alive') {
            // console.log("Shoot ignored: Player not alive.");
            return; // Cannot shoot if down or dead
        }
    
        // --- Cooldown Check ---
        const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire';
        const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier;
        const nowTimestamp = Date.now(); // Use Date.now for simple time comparison
    
        if (nowTimestamp - lastShotTime < actualCooldown) {
            // console.log("Shoot ignored: Cooldown active.");
            return; // Still on cooldown
        }
        lastShotTime = nowTimestamp; // Reset cooldown timer
    
        // --- Aim Calculation (Relative to Player's Rendered Position) ---
        const playerRenderX = appState.renderedPlayerPos.x;
        const playerRenderY = appState.renderedPlayerPos.y;
    
        // Ensure player position is valid before proceeding
        if (typeof playerRenderX !== 'number' || typeof playerRenderY !== 'number') {
            console.error("[handleShooting] Cannot shoot: Invalid renderedPlayerPos", appState.renderedPlayerPos);
            return;
        }
         // Ensure mouse position is valid
         if (typeof mouseCanvasPos.x !== 'number' || typeof mouseCanvasPos.y !== 'number') {
            console.error("[handleShooting] Cannot shoot: Invalid mouseCanvasPos", mouseCanvasPos);
            return;
         }
    
        // Calculate vector from player's screen position to mouse screen position
        let aimDx = mouseCanvasPos.x - playerRenderX;
        let aimDy = mouseCanvasPos.y - playerRenderY;
        const aimMagSq = aimDx * aimDx + aimDy * aimDy;
    
        // Normalize the vector
        if (aimMagSq > 1) { // Avoid division by zero or NaN if magnitude is tiny
            const aimMag = Math.sqrt(aimMagSq);
            aimDx /= aimMag;
            aimDy /= aimMag;
        } else {
            // If mouse is too close, default to aiming upwards
            aimDx = 0;
            aimDy = -1;
        }
        // --- End Aim Calculation ---
    
        // --- Update Muzzle Flash State ---
        // Use performance.now() for smooth animation timing if available
        const nowPerf = performance.now();
        localPlayerMuzzleFlash.active = true;
        localPlayerMuzzleFlash.endTime = nowPerf + 75; // Flash duration
        localPlayerMuzzleFlash.aimDx = aimDx; // Store the calculated player-relative direction
        localPlayerMuzzleFlash.aimDy = aimDy; // Store the calculated player-relative direction
    
        // --- Store Aim Direction for Gun Visual ---
        // Initialize the state object if it doesn't exist
        if (!appState.localPlayerAimState) {
            appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 }; // Start aiming up by default
        }
        // Store the *correct* calculated direction
        appState.localPlayerAimState.lastAimDx = aimDx;
        appState.localPlayerAimState.lastAimDy = aimDy;
        // console.log(`[Input.handleShooting] Stored Gun Aim: dx=${aimDx.toFixed(2)}, dy=${aimDy.toFixed(2)}`); // Keep for debug if needed
    
        // --- Send Message to Server ---
        // Send the raw mouse coordinates; server calculates world target or uses direction
        log("Sending shoot message with Target Coords:", mouseCanvasPos);
        Network.sendMessage({ type: 'player_shoot', target: { x: mouseCanvasPos.x, y: mouseCanvasPos.y } });

        // Play sound
        SoundManager.playSound('shoot');
    
        // --- Spawn Ammo Casing Particle ---
        const casingLifetime = 500 + Math.random() * 300;
        const ejectAngleOffset = Math.PI / 2 + (Math.random() - 0.5) * 0.4; // Eject sideways-ish
        const ejectAngle = Math.atan2(aimDy, aimDx) + ejectAngleOffset; // Base angle + offset
        const ejectSpeed = 80 + Math.random() * 40;
        const gravity = 150; // Example gravity value
    
        // Ensure activeAmmoCasings array exists (might be better initialized elsewhere)
        if (typeof activeAmmoCasings === 'undefined' || !Array.isArray(activeAmmoCasings)) {
            activeAmmoCasings = [];
        }
    
        const casing = {
            id: `casing_${nowPerf}_${Math.random().toString(16).slice(2)}`, // Unique ID
            x: playerRenderX + Math.cos(ejectAngle) * 15, // Start near player
            y: playerRenderY + Math.sin(ejectAngle) * 15 - 10, // Offset slightly up
            vx: Math.cos(ejectAngle) * ejectSpeed,
            vy: Math.sin(ejectAngle) * ejectSpeed - 40, // Initial upward pop
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 10, // Random spin
            spawnTime: nowPerf,
            lifetime: casingLifetime,
            gravity: gravity,
            width: 6, height: 3, // Casing dimensions
            color: "rgba(218, 165, 32, 0.9)" // Brass color
        };
        activeAmmoCasings.push(casing);
        // Limit total casings to prevent performance issues
        if (activeAmmoCasings.length > 30) {
            activeAmmoCasings.shift();
        }
    } // --- End of handleShooting ---

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
        log(`Resetting client state. Show Menu: ${showMenu}`); cleanupLoop();
        appState.localPlayerId = null; appState.currentGameId = null; appState.serverState = null; appState.lastServerState = null; appState.previousServerState = null; appState.maxPlayersInGame = null;
        appState.predictedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 }; // USE appState.canvasWidth and appState.canvasHeight
        appState.renderedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 }; // USE appState.canvasWidth and appState.canvasHeight
        appState.lastLoopTime = null;
        localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
        localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
        hitPauseFrames = 0; activeSpeechBubbles = {}; activeEnemyBubbles = {}; if(typeof snake !== 'undefined'){ snake.isActiveFromServer = false; snake.segments = []; }
        DOM.chatLog.innerHTML = ''; DOM.gameCodeDisplay.textContent = '------'; DOM.gameIdInput.value = ''; if(DOM.countdownDiv) DOM.countdownDiv.style.display = 'none'; if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none'; if(DOM.gameOverScreen) DOM.gameOverScreen.style.display = 'none';
        const gridContainer = document.getElementById('player-stats-grid'); if (gridContainer) gridContainer.innerHTML = 'Loading Stats...';
        if (showMenu) { appState.mode = 'menu'; UI.updateStatus(appState.isConnected ? "Connected. Select Mode." : "Disconnected."); UI.showSection('main-menu-section'); }
    }
    function gameLoop(currentTime) {
        // --- Animation State Reset ---
        // Check and reset expired animations at the start of the loop
        const now = performance.now();
        if (localPlayerPushbackAnim.active && now >= localPlayerPushbackAnim.endTime) {
            localPlayerPushbackAnim.active = false;
        }
        // (Muzzle flash reset is implicitly handled in Renderer when drawing)
        // ---------------------------

        if (hitPauseFrames > 0) { hitPauseFrames--; if (appState.mode !== 'menu' && appState.isConnected && !appState.serverState?.game_over) { appState.animationFrameId = requestAnimationFrame(gameLoop); } return; }
        if (appState.mode === 'menu' || !appState.isConnected || appState.serverState?.game_over) { if (appState.serverState?.game_over) { UI.updateStatus("Game Over!"); UI.showGameOver(appState.serverState); } else if (appState.mode === 'menu') { UI.updateStatus(appState.isConnected ? "Connected. Select Mode." : "Disconnected."); } cleanupLoop(); return; }
        if (!appState.serverState && appState.mode !== 'singleplayer') { appState.animationFrameId = requestAnimationFrame(gameLoop); return; }
        if (appState.lastLoopTime === null) { appState.lastLoopTime = currentTime; } const deltaTime = Math.min(0.1, (currentTime - appState.lastLoopTime) / 1000); appState.lastLoopTime = currentTime;
        if (typeof snake !== 'undefined' && typeof snake.update === 'function') { snake.update(currentTime); }
        if (appState.serverState?.status === 'active' && Input.isShootHeld()) { Input.handleShooting(); }

        // Client-side prediction / reconciliation
        if (appState.serverState?.status === 'active' && Input.isShootHeld()) { Input.handleShooting(); }

        if (appState.serverState?.status === 'active') {
            if (appState.mode === 'singleplayer') {
                const playerState = appState.serverState?.players?.[appState.localPlayerId];
                if (playerState && typeof playerState.x === 'number' && typeof playerState.y === 'number') {
                    appState.renderedPlayerPos.x = playerState.x;
                    appState.renderedPlayerPos.y = playerState.y;
                }
            } else {
                updatePredictedPosition(deltaTime);
                reconcileWithServer();
            }
        }

        const stateToRender = Game.getInterpolatedState(currentTime);
        if (stateToRender && typeof Renderer !== 'undefined' && DOM.ctx) {

            // Get current mouse position (ensure Input module is accessible)
            const currentMousePos = (typeof Input !== 'undefined' && Input.mouseCanvasPos)
                                     ? Input.mouseCanvasPos
                                     : { x: appState.canvasWidth / 2, y: 0 }; // Fallback if Input isn't ready

            // --- MODIFIED CALL TO Renderer.drawGame ---
            Renderer.drawGame(
                DOM.ctx,                        // ctx
                appState,                       // appState
                stateToRender,                  // stateToRender
                localPlayerMuzzleFlash,         // localPlayerMuzzleFlash
                localPlayerPushbackAnim,        // localPlayerPushbackAnimState
                activeBloodSparkEffects,
                activeEnemyBubbles,
                currentMousePos                 // *** Pass mouse position ***
            );

            // --- DRAW CASINGS *AFTER* main game render ---
            const now = performance.now(); // Need 'now' again if not declared earlier in this scope after move
            // Filter expired (redundant if already filtered before drawGame, but safe)
            activeAmmoCasings = activeAmmoCasings.filter(casing => (now - casing.spawnTime) < casing.lifetime);
            if (activeAmmoCasings.length > 0) {
                 DOM.ctx.save();
                 activeAmmoCasings.forEach(casing => {
                     // Update physics (using deltaTime from start of loop)
                     const tickDeltaTime = deltaTime; // Use loop's deltaTime
                     casing.vy += casing.gravity * tickDeltaTime;
                     casing.x += casing.vx * tickDeltaTime;
                     casing.y += casing.vy * tickDeltaTime;
                     casing.rotation += casing.rotationSpeed * tickDeltaTime;

                     // Calculate fade alpha
                     const lifeLeft = casing.lifetime - (now - casing.spawnTime);
                     const fadeDuration = 200;
                     const alpha = (lifeLeft < fadeDuration) ? Math.max(0, lifeLeft / fadeDuration) * 0.9 : 0.9;

                     // Draw rotated rectangle
                     DOM.ctx.fillStyle = casing.color.replace(/[\d\.]+\)$/g, `${alpha.toFixed(2)})`);
                     DOM.ctx.translate(casing.x, casing.y);
                     DOM.ctx.rotate(casing.rotation);
                     DOM.ctx.fillRect(-casing.width / 2, -casing.height / 2, casing.width, casing.height);
                     DOM.ctx.rotate(-casing.rotation);
                     DOM.ctx.translate(-casing.x, -casing.y);
                 });
                 DOM.ctx.restore();
            }
            // --- END CASING DRAWING ---

        } else {
             log("Skipping render: Missing state, Renderer, or context.");
        }


        // Request next frame or clean up loop
        if (appState.mode !== 'menu' && appState.isConnected && !appState.serverState?.game_over) { appState.animationFrameId = requestAnimationFrame(gameLoop); } else { if(appState.animationFrameId) cleanupLoop(); }
    }
    function startGameLoop() { if (appState.mode === 'menu') return; if (appState.animationFrameId) return; if (!appState.serverState && appState.mode !== 'singleplayer') return; Input.setup(); log("Starting game loop..."); appState.lastLoopTime = null; appState.animationFrameId = requestAnimationFrame(gameLoop); }
    function getInterpolatedState(renderTime) {
        const INTERPOLATION_BUFFER_MS = 100; const serverTime = appState.serverState?.timestamp * 1000; const lastServerTime = appState.lastServerState?.timestamp * 1000;
        if (!appState.serverState || !appState.lastServerState || !serverTime || !lastServerTime || serverTime <= lastServerTime) { return appState.serverState; }
        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS; const timeBetweenStates = serverTime - lastServerTime;
        const timeSinceLastState = renderTargetTime - lastServerTime; let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates));
        let interpolatedState = { ...appState.serverState }; interpolatedState.players = {}; interpolatedState.enemies = {}; interpolatedState.bullets = {};
        if (appState.serverState.players) { for (const pId in appState.serverState.players) { const currentP = appState.serverState.players[pId]; const lastP = appState.lastServerState.players?.[pId]; if (pId === appState.localPlayerId) { interpolatedState.players[pId] = { ...currentP, x: appState.renderedPlayerPos.x, y: appState.renderedPlayerPos.y }; } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number') { interpolatedState.players[pId] = { ...currentP, x: lerp(lastP.x, currentP.x, t), y: lerp(lastP.y, currentP.y, t) }; } else { interpolatedState.players[pId] = { ...currentP }; } } }
        if (appState.serverState.enemies) { for (const eId in appState.serverState.enemies) { const currentE = appState.serverState.enemies[eId]; const lastE = appState.lastServerState.enemies?.[eId]; if (lastE && typeof currentE.x === 'number' && typeof lastE.x === 'number' && currentE.health > 0) { interpolatedState.enemies[eId] = { ...currentE, x: lerp(lastE.x, currentE.x, t), y: lerp(lastE.y, currentE.y, t) }; } else { interpolatedState.enemies[eId] = { ...currentE }; } } }
        if (appState.serverState.bullets) { for (const bId in appState.serverState.bullets) { const currentB = appState.serverState.bullets[bId]; const lastB = appState.lastServerState.bullets?.[bId]; if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number') { interpolatedState.bullets[bId] = { ...currentB, x: lerp(lastB.x, currentB.x, t), y: lerp(lastB.y, currentB.y, t) }; } else { interpolatedState.bullets[bId] = { ...currentB }; } } }
        interpolatedState.powerups = appState.serverState.powerups; interpolatedState.damage_texts = appState.serverState.damage_texts;
        return interpolatedState;
    }
    function cleanupLoop() { if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; log("Game loop stopped and cleaned up."); } Input.cleanup(); appState.lastLoopTime = null; }
    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const moveVector = Input.getMovementInputVector(); const playerState = appState.serverState.players[appState.localPlayerId];
        const playerSpeed = playerState?.speed ?? PLAYER_DEFAULTS.base_speed;
        if (moveVector.dx !== 0 || moveVector.dy !== 0) { appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime; appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime; }
        const w_half = (playerState?.width ?? PLAYER_DEFAULTS.width) / 2; const h_half = (playerState?.height ?? PLAYER_DEFAULTS.height) / 2;
        appState.predictedPlayerPos.x = Math.max(w_half, Math.min(appState.canvasWidth - w_half, appState.predictedPlayerPos.x)); // CORRECTED LINE: Use appState.canvasWidth
        appState.predictedPlayerPos.y = Math.max(h_half, Math.min(appState.canvasHeight - h_half, appState.predictedPlayerPos.y)); // CORRECTED LINE: Use appState.canvasHeight
    }
    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const serverPos = appState.serverState.players[appState.localPlayerId]; if (typeof serverPos.x !== 'number' || typeof serverPos.y !== 'number') return;
        const predictedPos = appState.predictedPlayerPos; const renderedPos = appState.renderedPlayerPos; const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);
        const snapThreshold = (parseFloat(getCssVar('--reconciliation-threshold')) || 35); const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15;
        if (dist > snapThreshold) { predictedPos.x = serverPos.x; predictedPos.y = serverPos.y; renderedPos.x = serverPos.x; renderedPos.y = serverPos.y; }
        else { renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor); renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor); }
    }
    // --- CORRECTED initListeners ---
    // This function is now intended to be called ONCE during initialization
    // to set up the event handlers for the buttons.
    function initListeners() {
        log("Initializing button listeners...");

        // --- Game Start/Join Buttons ---
        // These handlers now call SoundManager.init() THEN the relevant game function

        if (DOM.singlePlayerBtn) {
            DOM.singlePlayerBtn.onclick = () => {
                log("Single Player button clicked.");
                SoundManager.init(); // Initialize sound system on user interaction
                startSinglePlayer(); // Call the internal function to start the game
            };
        } else { error("DOM Element not found: singlePlayerBtn"); }


        const hostHandler = (maxPlayers) => {
            log(`Host Game (${maxPlayers}p) button clicked.`);
            SoundManager.init(); // Initialize sound system on user interaction
            hostMultiplayer(maxPlayers); // Call the internal function to host
        };
        if (DOM.hostGameBtn2) DOM.hostGameBtn2.onclick = () => hostHandler(2);
        else { error("DOM Element not found: hostGameBtn2"); }

        if (DOM.hostGameBtn3) DOM.hostGameBtn3.onclick = () => hostHandler(3);
        else { error("DOM Element not found: hostGameBtn3"); }

        if (DOM.hostGameBtn4) DOM.hostGameBtn4.onclick = () => hostHandler(4);
        else { error("DOM Element not found: hostGameBtn4"); }


        if (DOM.joinGameSubmitBtn) {
            DOM.joinGameSubmitBtn.onclick = () => {
                log("Join Game Submit button clicked.");
                SoundManager.init(); // Initialize sound system on user interaction
                joinMultiplayer(); // Call the internal function to join
            };
        } else { error("DOM Element not found: joinGameSubmitBtn"); }


        // --- Other UI/Game Action Buttons ---
        // These typically don't need to initialize the sound system

        if (DOM.multiplayerBtn) DOM.multiplayerBtn.onclick = () => UI.showSection('multiplayer-menu-section');
        else { error("DOM Element not found: multiplayerBtn"); }

        if (DOM.showJoinUIBtn) DOM.showJoinUIBtn.onclick = () => UI.showSection('join-code-section');
        else { error("DOM Element not found: showJoinUIBtn"); }

        if (DOM.cancelHostBtn) DOM.cancelHostBtn.onclick = leaveGame; // Directly assign if leaveGame is simple
        else { error("DOM Element not found: cancelHostBtn"); }

        if (DOM.sendChatBtn) DOM.sendChatBtn.onclick = sendChatMessage; // Directly assign
        else { error("DOM Element not found: sendChatBtn"); }

        if (DOM.leaveGameBtn) DOM.leaveGameBtn.onclick = leaveGame; // Directly assign
        else { error("DOM Element not found: leaveGameBtn"); }

        if (DOM.gameOverBackBtn) DOM.gameOverBackBtn.onclick = () => resetClientState(true); // Use arrow func for clarity or direct assign if simple
        else { error("DOM Element not found: gameOverBackBtn"); }


        // Back buttons
        DOM.gameContainer.querySelectorAll('.back-button').forEach(btn => {
            const targetMatch = btn.getAttribute('onclick')?.match(/'([^']+)'/); // Keep original logic for finding target
            if (targetMatch && targetMatch[1]) {
                const targetId = targetMatch[1];
                if (DOM[targetId] || document.getElementById(targetId)) {
                     // Re-assign using addEventListener or standard onclick
                     btn.onclick = (e) => { e.preventDefault(); UI.showSection(targetId); };
                } else {
                    log(`Warning: Back button target section invalid: ${targetId}`);
                }
            } else {
                // This handles buttons that might not have the expected onclick format
                 log("Warning: Back button found without standard target in onclick:", btn);
                 // Optionally add a default handler or leave it unassigned if it has other means of working
            }
        });
    }
    // --- END initListeners ---

    // --- CORRECTED Return Statement ---
    // Expose all functions needed externally, including those called by initListeners
    return {
        // Functions called by click handlers in initListeners:
        startSinglePlayer,
        joinMultiplayer,
        hostMultiplayer,
        leaveGame,
        sendChatMessage,
        resetClientState,

        // Core game loop functions:
        startGameLoop,
        cleanupLoop,
        getInterpolatedState,

        // Expose initListeners itself so it can be called from DOMContentLoaded
        initListeners
    };
})(); // End of Game IIFE

// --- Global Server Message Handler ---

// --- Global Server Message Handler ---
// Processes all messages received via the WebSocket
function handleServerMessage(event) {
    let data;
    try { data = JSON.parse(event.data); }
    catch (err) { error("Failed to parse server message:", err, event.data); UI.updateStatus("Received invalid data from server.", true); return; }

    try {
        // Prevent critical errors if Renderer isn't ready yet for drawing-related messages
        if (typeof Renderer === 'undefined' && ['sp_game_started', 'game_joined', 'game_state', 'game_created'].includes(data.type)) {
             error(`Received critical message type '${data.type}' before Renderer was ready! Check loading order.`);
             return; // Don't process further if Renderer isn't loaded
        }

        switch (data.type) {
            // --- Association Cases (Now include canvas dimension setting) ---
            case 'game_created':
                log("Received 'game_created'");
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state; // Initial state received
                appState.maxPlayersInGame = data.max_players;

                // --- NEW: SET CANVAS DIMENSIONS IMMEDIATELY ---
                if (data.initial_state && typeof data.initial_state.canvas_width === 'number' && typeof data.initial_state.canvas_height === 'number') {
                    appState.canvasWidth = data.initial_state.canvas_width;
                    appState.canvasHeight = data.initial_state.canvas_height;
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                        log(`Canvas dimensions set to: ${DOM.canvas.width}x${DOM.canvas.height}`);
                        // Force initial background generation *after* setting dimensions
                        if (typeof Renderer !== 'undefined' && appState.serverState) {
                             Renderer.updateGeneratedBackground(appState.serverState.is_night);
                        }
                    } else {
                        error("DOM.canvas not found when trying to set dimensions!");
                    }
                } else {
                    error("Initial state ('game_created') missing canvas dimensions!", data.initial_state);
                    // Fallback - dimensions might be set later via game_state if server includes them
                    appState.canvasWidth = 1600; // Default fallback
                    appState.canvasHeight = 900; // Default fallback
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                    }
                }
                // -------------------------------------------

                const hostP = appState.serverState?.players[appState.localPlayerId];
                if (hostP) { appState.predictedPlayerPos = { x: hostP.x, y: hostP.y }; appState.renderedPlayerPos = { x: hostP.x, y: hostP.y }; }
                if (!appState.maxPlayersInGame) { error("'game_created' missing 'max_players'!"); appState.maxPlayersInGame = '?'; }

                DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR';
                const currentP = Object.keys(appState.serverState?.players || {}).length;
                DOM.waitingMessage.textContent = `Waiting for Team Mate... (${currentP}/${appState.maxPlayersInGame})`;
                UI.updateStatus(`Game hosted. Code: ${appState.currentGameId}`);
                UI.showSection('host-wait-section');
                // Host loop starts when game status changes from 'waiting' via game_state update
                break;

            case 'game_joined':
                log("Received 'game_joined'");
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state; // Initial state received
                appState.maxPlayersInGame = appState.serverState?.max_players;

                // --- NEW: SET CANVAS DIMENSIONS IMMEDIATELY ---
                if (data.initial_state && typeof data.initial_state.canvas_width === 'number' && typeof data.initial_state.canvas_height === 'number') {
                    appState.canvasWidth = data.initial_state.canvas_width;
                    appState.canvasHeight = data.initial_state.canvas_height;
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                        log(`Canvas dimensions set to: ${DOM.canvas.width}x${DOM.canvas.height}`);
                        // Force initial background generation *after* setting dimensions
                        if (typeof Renderer !== 'undefined' && appState.serverState) {
                             Renderer.updateGeneratedBackground(appState.serverState.is_night);
                        }
                    } else {
                        error("DOM.canvas not found when trying to set dimensions!");
                    }
                } else {
                    error("Initial state ('game_joined') missing canvas dimensions!", data.initial_state);
                    appState.canvasWidth = 1600; // Fallback
                    appState.canvasHeight = 900; // Fallback
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                    }
                }
                // -------------------------------------------

                if (!appState.maxPlayersInGame) { error("'game_joined' initial_state missing 'max_players'!"); appState.maxPlayersInGame = '?'; }
                const joinedP = appState.serverState?.players[appState.localPlayerId];
                if (joinedP) { appState.predictedPlayerPos = { x: joinedP.x, y: joinedP.y }; appState.renderedPlayerPos = { x: joinedP.x, y: joinedP.y }; }

                UI.updateStatus(`Joined game ${appState.currentGameId}. Get ready!`);
                UI.showSection('game-area');
                // Initial UI updates (HUD, Countdown) - Background already triggered above
                if (appState.serverState) {
                    UI.updateHUD(appState.serverState); UI.updateCountdown(appState.serverState);
                }
                Game.startGameLoop(); // Joining client starts loop immediately
                break;

            case 'sp_game_started':
                log("Received 'sp_game_started'");
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state; // Initial state received
                appState.maxPlayersInGame = 1;

                // --- NEW: SET CANVAS DIMENSIONS IMMEDIATELY ---
                if (data.initial_state && typeof data.initial_state.canvas_width === 'number' && typeof data.initial_state.canvas_height === 'number') {
                    appState.canvasWidth = data.initial_state.canvas_width;
                    appState.canvasHeight = data.initial_state.canvas_height;
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                        log(`Canvas dimensions set to: ${DOM.canvas.width}x${DOM.canvas.height}`);
                        // Force initial background generation *after* setting dimensions
                        if (typeof Renderer !== 'undefined' && appState.serverState) {
                            Renderer.updateGeneratedBackground(appState.serverState.is_night);
                        }
                    } else {
                        error("DOM.canvas not found when trying to set dimensions!");
                    }
                } else {
                    error("Initial state ('sp_game_started') missing canvas dimensions!", data.initial_state);
                    appState.canvasWidth = 1600; // Fallback
                    appState.canvasHeight = 900; // Fallback
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                    }
                }
                // -------------------------------------------

                const spP = appState.serverState?.players[appState.localPlayerId];
                if (spP) { appState.predictedPlayerPos = { x: spP.x, y: spP.y }; appState.renderedPlayerPos = { x: spP.x, y: spP.y }; }

                UI.updateStatus("Single Player Game Started!"); UI.showSection('game-area');
                // Initial UI updates (HUD, Countdown) - Background already triggered above
                if (appState.serverState) {
                    UI.updateHUD(appState.serverState); UI.updateCountdown(appState.serverState);
                }
                Game.startGameLoop(); // SP client starts loop immediately
                break;

                // --- Game State Update ---
            case 'game_state':
                // If client is in menu mode, ignore state updates entirely.
                if (appState.mode === 'menu') {
                    // log("Ignoring game_state message while in menu mode.");
                    return; // Stop processing this message
                }

                // --- Proceed with processing state if not in menu ---
                const previousStatus = appState.serverState?.status;
                const previousPlayerState = appState.serverState?.players?.[appState.localPlayerId];

                // Update state history for interpolation
                appState.previousServerState = appState.lastServerState;
                appState.lastServerState = appState.serverState;
                appState.serverState = data.state; // Store the new state
                const newState = appState.serverState; // Alias for clarity
                const currentPlayerState = newState?.players?.[appState.localPlayerId];

                // --- CRITICAL: Ensure canvas dimensions are set if missed initially ---
                // This is a safety net. The primary setting should happen in the association cases.
                if ((DOM.canvas.width <= 0 || DOM.canvas.height <= 0 || DOM.canvas.width !== newState.canvas_width) &&
                    newState && typeof newState.canvas_width === 'number' && typeof newState.canvas_height === 'number') {
                    error(`Correcting canvas dimensions via game_state: ${newState.canvas_width}x${newState.canvas_height}`);
                    appState.canvasWidth = newState.canvas_width;
                    appState.canvasHeight = newState.canvas_height;
                    if (DOM.canvas) {
                        DOM.canvas.width = appState.canvasWidth;
                        DOM.canvas.height = appState.canvasHeight;
                        // Force background update if dimensions changed significantly
                        if (typeof Renderer !== 'undefined' && newState) {
                            Renderer.updateGeneratedBackground(newState.is_night);
                        }
                    }
                }
                // -----------------------------------------------------------------


                // Update local client variables mirrored from server state
                appState.currentTemp = newState.current_temperature ?? 18.0; // Use a default if missing
                appState.isRaining = newState.is_raining ?? false;
                appState.isDustStorm = newState.is_dust_storm ?? false;
                UI.updateEnvironmentDisplay(); // Update temp display


                // --- Update Visual Snake State ---
                const serverSnakeState = newState.snake_state;
                if (serverSnakeState && typeof snake !== 'undefined') { // Check if snake object exists
                    snake.isActiveFromServer = serverSnakeState.active;
                    snake.serverHeadX = serverSnakeState.head_x;
                    snake.serverHeadY = serverSnakeState.head_y;
                    snake.serverBaseY = serverSnakeState.base_y;
                    // If snake just became active visually, ensure segment array starts correctly
                    if (snake.isActiveFromServer && snake.segments.length === 0) {
                        snake.segments = [{ x: snake.serverHeadX, y: snake.serverHeadY, time: performance.now() }];
                    } else if (!snake.isActiveFromServer) {
                        snake.segments = []; // Clear if inactive
                    }
                } else if (typeof snake !== 'undefined') {
                     snake.isActiveFromServer = false; // Ensure inactive if state missing
                     snake.segments = [];
                }
                // --- End Snake Update ---


                // --- Trigger Screen Shake on Snake Bite (Check Local Player) ---
                if (currentPlayerState?.trigger_snake_bite_shake_this_tick) {
                    // Use constants defined in your JS (ensure they match backend if needed)
                    const shakeMag = snake?.shakeMagnitude ?? 15.0; // Access magnitude from snake object or default
                    const shakeDur = snake?.shakeDurationMs ?? 400.0; // Access duration from snake object or default
                    if(typeof Renderer !== 'undefined') {
                         Renderer.triggerShake(shakeMag, shakeDur);
                    }
                }
                // --- End Shake Trigger ---

                let localPlayerDamagedThisTick = false; // Initialize flag

                 // Trigger screen shake AND set flag ONLY if local player took damage THIS tick
                if (previousPlayerState && currentPlayerState &&
                    typeof currentPlayerState.health === 'number' &&
                    typeof previousPlayerState.health === 'number' &&
                    currentPlayerState.health < previousPlayerState.health)
                {
                    // --- Actions INSIDE the damage detection block ---
                    const damageTaken = previousPlayerState.health - currentPlayerState.health;
                    const baseMag = 5; const dmgScale = 0.18; const maxMag = 18; // Shake params
                    const shakeMagnitude = Math.min(maxMag, baseMag + damageTaken * dmgScale);
                     if(typeof Renderer !== 'undefined') {
                         Renderer.triggerShake(shakeMagnitude, 250); // Trigger shake effect
                    }

                    // *** MOVE THIS LINE INSIDE ***
                    localPlayerDamagedThisTick = true; // Set the flag ONLY when damage is detected
                    // *****************************

                    console.log('[Main DEBUG] Health decreased, setting damage flag.'); // Optional log
                }
                // --- End of damage detection block ---


                 // Play damage sound if flag was set THIS tick
                 if (localPlayerDamagedThisTick) {
                    console.log('[Main DEBUG] Damage flag is true, attempting to play damage sound.'); // Optional log
                    SoundManager.playSound('damage');
                }

                // ... (rest of the game_state case)

                 // Trigger hit pause if local player was hit this tick
                 // Check currentPlayerState exists before accessing properties
                 if (currentPlayerState?.hit_flash_this_tick && hitPauseFrames <= 0) {
                     hitPauseFrames = 3; // Pause rendering for 3 frames
                 }


                // --- V3: Update Blood Spark Effects ---
                if (newState.enemies) {
                    const now = performance.now();
                    const sparkDuration = 300; // How long sparks stay visible (ms)

                    // Add/refresh sparks for enemies hit *this* tick according to server state
                    for (const enemyId in newState.enemies) {
                        const enemy = newState.enemies[enemyId];
                        // Check if enemy has a *new* last_damage_time compared to previous state
                        const previousEnemy = appState.lastServerState?.enemies?.[enemyId];
                        if (enemy && enemy.last_damage_time &&
                            (!previousEnemy || enemy.last_damage_time > (previousEnemy.last_damage_time || 0)))
                        {
                            // Server uses seconds, performance.now() is ms
                            const serverHitTimeMs = enemy.last_damage_time * 1000;
                            // Only trigger if the hit happened very recently to avoid re-triggering on late packets
                            if (now - serverHitTimeMs < 200) {
                                activeBloodSparkEffects[enemyId] = now + sparkDuration;
                            }
                        }
                    }

                    // Clean up expired sparks (optional, could also be done in renderer)
                    for (const enemyId in activeBloodSparkEffects) {
                        if (now >= activeBloodSparkEffects[enemyId]) {
                            delete activeBloodSparkEffects[enemyId];
                        }
                    }
                }
                // --- End V3 Blood Spark Update ---


                // Store max_players if received in state update (e.g., if missed initial message)
                if (!appState.maxPlayersInGame && newState.max_players) {
                     appState.maxPlayersInGame = newState.max_players;
                }

                // --- Handle transitions between game statuses ---
                if (newState.status !== previousStatus) {
                    log(`[Client State Change] From ${previousStatus || 'null'} to ${newState.status}`);

                    // Logic for STARTING the game (Countdown or Active)
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') {
                        UI.updateStatus(newState.status === 'countdown' ? "Countdown starting..." : "Game active!");
                        UI.showSection('game-area'); // Ensure game area is visible
                        if (!appState.animationFrameId) { // Start loop if not already running
                            log(`--> Starting game loop NOW (triggered by ${newState.status} state update).`);
                            if (typeof Renderer !== 'undefined' && newState) { Renderer.updateGeneratedBackground(newState.is_night); }
                            Game.startGameLoop();
                        }
                    }
                    // Logic for HOST potentially returning to WAITING state
                    else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') {
                        UI.updateStatus("Game reverted to waiting lobby.", true); // Inform host
                        UI.showSection('host-wait-section');
                        const currentPWaiting = Object.keys(newState.players || {}).length;
                        DOM.waitingMessage.textContent = `Waiting for Team Mate... (${currentPWaiting}/${appState.maxPlayersInGame || '?'})`;
                        Game.cleanupLoop(); // Stop loop if returning to wait
                    }
                    // If status becomes 'finished', ensure loop cleanup and show game over
                    // This is a *fallback* to the 'game_over_notification'
                    else if (newState.status === 'finished' && previousStatus !== 'finished') {
                         log("-> Game Over sequence initiated by 'finished' status in game_state.");
                         Game.cleanupLoop();
                         UI.showGameOver(newState); // Show game over based on this final state
                    }

                } // End status change handling

                // --- Update UI elements based on current state ---
                // Only update HUD/Timers if game is actually running client-side
                if (appState.animationFrameId && (newState.status === 'countdown' || newState.status === 'active')) {
                    UI.updateHUD(newState);
                    UI.updateCountdown(newState);
                    UI.updateDayNight(newState);
                }
                // Update waiting message specifically for hosts in waiting state
                else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') {
                    const pCount = Object.keys(newState.players || {}).length;
                    DOM.waitingMessage.textContent = `Waiting for Team Mate... (${pCount}/${appState.maxPlayersInGame || '?'})`;
                }

                // Update enemy speech bubbles based on state
                const speakerId = newState.enemy_speaker_id; const speechText = newState.enemy_speech_text;
                if (speakerId && speechText) {
                    activeEnemyBubbles[speakerId] = { text: speechText.substring(0, 50), endTime: performance.now() + 3000 };
                }
                break; // End game_state

            // --- Explicit Game Over Notification (Primary Trigger) ---
            case 'game_over_notification':
                log("Received 'game_over_notification'");
                if (data.final_state) {
                    appState.serverState = data.final_state; // Store final state
                    UI.updateStatus("Game Over!");
                    Game.cleanupLoop(); // --- Stop the game loop FIRST
                    UI.showGameOver(data.final_state); // --- THEN show the game over screen
                    log("-> Game Over sequence initiated by notification.");
                } else {
                    error("Received 'game_over_notification' without final_state data.");
                    Game.resetClientState(true); // Fallback to menu
                }
                break;

             // --- Chat Message ---
             case 'chat_message':
                 const senderId = data.sender_id; const msgText = data.message;
                 if (!senderId || !msgText) { // Basic validation
                      log("Received incomplete chat message", data);
                      break;
                 }
                 const isSelf = senderId === appState.localPlayerId;
                 UI.addChatMessage(senderId, msgText, isSelf); // Add to chat log
                 // Display as speech bubble only if the player is currently in the game state
                 if (appState.serverState?.players?.[senderId]) {
                      activeSpeechBubbles[senderId] = { text: msgText.substring(0, 50), endTime: performance.now() + 4000 };
                 }
                 break;

             // --- Error Message ---
             case 'error':
                 error("[Client] Server Error Message:", data.message);
                 UI.updateStatus(`Server Error: ${data.message}`, true);
                 // Handle specific errors causing UI state changes
                 if (appState.mode === 'multiplayer-client' && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'))) {
                     UI.showSection('join-code-section'); appState.mode = 'menu'; // Back to join input
                 } else if (appState.mode === 'multiplayer-host' && data.message.includes('Creation Error')) {
                     Game.resetClientState(true); // Back to main menu
                 } else if (data.message === 'Please create or join a game first.') {
                      Game.resetClientState(true); // Back to main menu if disconnected/out of sync
                 }
                 break;

            // Unknown message type
            default:
                log(`Unknown message type received: ${data.type}`);
        } // End switch
    } catch (handlerError) {
        error("Error inside handleServerMessage logic:", handlerError, "Data:", data); // Log data too
        UI.updateStatus("Client error processing message.", true);
    }
} // End handleServerMessage

document.addEventListener('DOMContentLoaded', () => {
    log("DOM fully loaded and parsed."); // #LOG A

    // --- Critical Checks ---
    if (typeof Renderer === 'undefined') {
        error("CRITICAL: Renderer is not defined after DOM load!");
        UI.updateStatus("Initialization Error: Renderer failed. Refresh.", true);
        return;
    }
    if (DOM.canvas) {
        DOM.ctx = DOM.canvas.getContext('2d');
        if (!DOM.ctx) {
            error("Failed to get 2D context!");
            UI.updateStatus("Error: Cannot get canvas context. Refresh.", true);
            return;
        }
    } else {
        error("Canvas element not found!");
        UI.updateStatus("Error: Canvas element missing. Refresh.", true);
        return;
    }
    // --- End Critical Checks ---

    UI.updateStatus("Initializing Connection & Listeners...");
    try {
        // --- DIRECTLY ATTACH LISTENERS HERE ---
        log("Directly attaching essential listeners...");

        // Single Player Button
        if (DOM.singlePlayerBtn) {
            DOM.singlePlayerBtn.onclick = () => {
                console.log("--- singlePlayerBtn CLICKED (Direct Attach) ---"); // #LOG D
                log("Single Player button clicked.");
                SoundManager.init(); // ! TRY INIT
                Game.startSinglePlayer(); // Use Game module function
            };
            log("Attached listener to singlePlayerBtn.");
        } else { error("singlePlayerBtn not found in DOM!"); }

        // Host Buttons (Example for one, repeat for others if testing MP)
        if (DOM.hostGameBtn2) {
             const hostHandler = (maxPlayers) => {
                 console.log(`--- hostGameBtn (${maxPlayers}p) CLICKED (Direct Attach) ---`); // #LOG E
                 log(`Host Game (${maxPlayers}p) button clicked.`);
                 SoundManager.init(); // ! TRY INIT
                 Game.hostMultiplayer(maxPlayers); // Use Game module function
             };
            DOM.hostGameBtn2.onclick = () => hostHandler(2);
             // Add similar blocks for hostGameBtn3 and hostGameBtn4 if needed
            log("Attached listener to hostGameBtn2.");
        } else { error("hostGameBtn2 not found in DOM!"); }


        // Join Button
        if (DOM.joinGameSubmitBtn) {
            DOM.joinGameSubmitBtn.onclick = () => {
                console.log("--- joinGameSubmitBtn CLICKED (Direct Attach) ---"); // #LOG F
                log("Join Game Submit button clicked.");
                SoundManager.init(); // ! TRY INIT
                Game.joinMultiplayer(); // Use Game module function
            };
            log("Attached listener to joinGameSubmitBtn.");
        } else { error("joinGameSubmitBtn not found in DOM!"); }

        // Attach other non-init listeners (can still use Game module methods if exposed)
        if (DOM.multiplayerBtn) DOM.multiplayerBtn.onclick = () => UI.showSection('multiplayer-menu-section');
        if (DOM.showJoinUIBtn) DOM.showJoinUIBtn.onclick = () => UI.showSection('join-code-section');
        if (DOM.cancelHostBtn) DOM.cancelHostBtn.onclick = Game.leaveGame; // Assumes Game.leaveGame exists
        if (DOM.sendChatBtn) DOM.sendChatBtn.onclick = Game.sendChatMessage; // Assumes Game.sendChatMessage exists
        if (DOM.leaveGameBtn) DOM.leaveGameBtn.onclick = Game.leaveGame;
        if (DOM.gameOverBackBtn) DOM.gameOverBackBtn.onclick = () => Game.resetClientState(true); // Assumes Game.resetClientState exists

        // Back buttons (same logic as before)
        DOM.gameContainer.querySelectorAll('.back-button').forEach(btn => {
             const targetMatch = btn.getAttribute('onclick')?.match(/'([^']+)'/);
             if (targetMatch && targetMatch[1]) {
                 const targetId = targetMatch[1];
                 if (DOM[targetId] || document.getElementById(targetId)) {
                     btn.onclick = (e) => { e.preventDefault(); UI.showSection(targetId); };
                 } else { log(`Warning: Back button target section invalid: ${targetId}`); }
             } else { log("Warning: Back button found without valid target in onclick:", btn); }
         });

        log("Finished attaching listeners directly."); // #LOG G
        // --- END DIRECT ATTACHMENT ---

        // Connect to WebSocket
        Network.connect(() => { /* Connection success handled within Network.connect */ });

    } catch (initError) {
        error("Initialization or Listener Attachment failed:", initError);
        UI.updateStatus("Error initializing game. Please refresh.", true);
    }
});
