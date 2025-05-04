// main.js - FINAL CORRECTED VERSION
import Renderer3D from './Renderer3D.js';

console.log("--- main.js: Starting execution Final Corrected ---");

// --- Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
const SHOOT_COOLDOWN = 750; const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33; const RECONNECT_DELAY = 3000;
const PLAYER_DEFAULTS = { width: 25, height: 48, max_health: 100, base_speed: 150 };
const PLAYER_STATUS_ALIVE = 'alive'; const PLAYER_STATUS_DOWN = 'down'; const PLAYER_STATUS_DEAD = 'dead';
const SNAKE_BITE_DURATION = 8.0;

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { return start + (end - start) * amount; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }

// --- DOM References ---
const DOM = {
    gameContainer: document.getElementById('game-container'), gameStatus: document.getElementById('game-status'),
    mainMenuSection: document.getElementById('main-menu-section'), multiplayerMenuSection: document.getElementById('multiplayer-menu-section'),
    hostWaitSection: document.getElementById('host-wait-section'), joinCodeSection: document.getElementById('join-code-section'),
    gameArea: document.getElementById('game-area'), gameOverScreen: document.getElementById('game-over-screen'),
    gameCodeDisplay: document.getElementById('game-code-display'), waitingMessage: document.getElementById('waiting-message'),
    gameIdInput: document.getElementById('gameIdInput'), canvasContainer: document.getElementById('canvas-container'),
    htmlOverlay: document.getElementById('html-overlay'), dayNightIndicator: document.getElementById('day-night-indicator'),
    countdownDiv: document.getElementById('countdown'), finalStatsDiv: document.getElementById('final-stats'),
    chatInput: document.getElementById('chatInput'), chatLog: document.getElementById('chat-log'),
    singlePlayerBtn: document.getElementById('singlePlayerBtn'), multiplayerBtn: document.getElementById('multiplayerBtn'),
    hostGameBtn2: document.getElementById('hostGameBtn2'), hostGameBtn3: document.getElementById('hostGameBtn3'),
    hostGameBtn4: document.getElementById('hostGameBtn4'), showJoinUIBtn: document.getElementById('showJoinUIBtn'),
    cancelHostBtn: document.getElementById('cancelHostBtn'), joinGameSubmitBtn: document.getElementById('joinGameSubmitBtn'),
    sendChatBtn: document.getElementById('sendChatBtn'), leaveGameBtn: document.getElementById('leaveGameBtn'),
    gameOverBackBtn: document.getElementById('gameOverBackBtn'),
};

// --- Global Client State ---
let appState = {
    mode: 'menu', localPlayerId: null, maxPlayersInGame: null, currentGameId: null,
    serverState: null, animationFrameId: null, isConnected: false,
    renderedPlayerPos: { x: 800, y: 450 }, predictedPlayerPos: { x: 800, y: 450 },
    lastServerState: null, previousServerState: null, lastLoopTime: null,
    lastStateReceiveTime: performance.now(), currentTemp: 18.0, isRaining: false,
    isDustStorm: false, targetTint: null, targetTintAlpha: 0.0,
    canvasWidth: 1600, canvasHeight: 900,
    uiPositions: {}, localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
};

// --- Local Effects State ---
let localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
let localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
let activeSpeechBubbles = {}; let activeEnemyBubbles = {};
let socket = null;
let activeAmmoCasings = []; let activeBloodSparkEffects = {};
let snake = {
    segmentLength: 6.0, segments: [], maxSegments: 12, frequency: 0.03, amplitude: 15.0,
    lineWidth: 3, serverHeadX: 0, serverHeadY: 0, serverBaseY: 0, isActiveFromServer: false,
    update: function(currentTime) { if (!this.isActiveFromServer) this.segments = []; }
};
let localEffects = {
    muzzleFlash: localPlayerMuzzleFlash, pushbackAnim: localPlayerPushbackAnim,
    activeBloodSparkEffects: activeBloodSparkEffects, activeAmmoCasings: activeAmmoCasings,
    snake: snake
};

// --- HTML Overlay Element Management ---
const damageTextElements = {}; const inactiveDamageTextElements = [];
const healthBarElements = {}; const inactiveHealthBarElements = [];
const speechBubbleElements = {}; const inactiveSpeechBubbleElements = [];

// --- Sound Manager ---
const SoundManager = (() => {
    let audioContext = null; let loadedSounds = {};
    let soundFiles = { 'shoot': 'assets/sounds/shoot.mp3', 'damage': 'assets/sounds/damage.mp3' };
    let soundsLoading = 0; let soundsLoaded = 0; let isInitialized = false; let canPlaySound = false;
    function init() { if (isInitialized) { return canPlaySound; } isInitialized = true; try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { console.error("[SM] Web Audio API not supported."); canPlaySound = false; return false; } audioContext = new AC(); if (audioContext.state === 'suspended') { audioContext.resume().then(() => { canPlaySound = true; loadSounds(); }).catch(err => { console.error("[SM] Failed auto-resume:", err); canPlaySound = false; }); } else if (audioContext.state === 'running') { canPlaySound = true; loadSounds(); } else { canPlaySound = false; } } catch (e) { console.error("[SM] Error creating AudioContext:", e); audioContext = null; canPlaySound = false; return false; } return canPlaySound; }
    function loadSounds() { if (!audioContext) return; soundsLoading = Object.keys(soundFiles).length; soundsLoaded = 0; loadedSounds = {}; Object.entries(soundFiles).forEach(([name, path]) => { fetch(path).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`); return r.arrayBuffer(); }).then(b => audioContext.decodeAudioData(b)).then(db => { loadedSounds[name] = db; soundsLoaded++; if (soundsLoaded === soundsLoading) console.log("[SM] Sounds loaded."); }).catch(e => { console.error(`[SM] Error load/decode '${name}':`, e); soundsLoaded++; if (soundsLoaded === soundsLoading) console.log("[SM] Sound loading finished (errors)."); }); }); }
    function playSound(name, volume = 1.0) { if (!isInitialized || !canPlaySound || !audioContext || audioContext.state !== 'running') return; const buffer = loadedSounds[name]; if (!buffer) return; try { const source = audioContext.createBufferSource(); source.buffer = buffer; const gainNode = audioContext.createGain(); const clampedVolume = Math.max(0, Math.min(1, volume)); gainNode.gain.setValueAtTime(clampedVolume, audioContext.currentTime); source.connect(gainNode).connect(audioContext.destination); source.start(0); source.onended = () => { try { source.disconnect(); gainNode.disconnect(); } catch (e) {} }; } catch (e) { console.error(`[SM] Error playing '${name}':`, e); } }
    return { init, playSound };
})();

// --- Logging Wrappers ---
function log(...args) { console.log("[Client]", ...args); } function error(...args) { console.error("[Client]", ...args); }

// --- UI Management Module ---
const UI = (() => {
    const allSections = [ DOM.mainMenuSection, DOM.multiplayerMenuSection, DOM.hostWaitSection, DOM.joinCodeSection, DOM.gameArea, DOM.gameOverScreen ];
    const gameSections = ['game-area'];
    function showSection(sectionId) { allSections.forEach(s => { if(s) s.style.display = 'none'; }); const sectionToShow = DOM[sectionId] || document.getElementById(sectionId); if (sectionToShow) { sectionToShow.style.display = (sectionId === 'game-area' || sectionId === 'game-over-screen') ? 'flex' : 'block'; log(`UI: Showing section: ${sectionId}`); DOM.gameContainer.classList.toggle('in-game', gameSections.includes(sectionId)); } else { error(`UI: Section not found: ${sectionId}`); } }
    function updateStatus(message, isError = false) { if (!DOM.gameStatus) return; DOM.gameStatus.textContent = message; DOM.gameStatus.style.color = isError ? (getCssVar('--player-color') || 'red') : (getCssVar('--accent-color') || 'yellow'); }
    function updateHUD(serverState) { const gridContainer = document.getElementById('player-stats-grid'); if (!gridContainer) return; const players = serverState?.players; const localPlayerId = appState.localPlayerId; gridContainer.innerHTML = ''; if (!players || Object.keys(players).length === 0) { gridContainer.innerHTML = '<span>Waiting...</span>'; return; } const sortedPlayerIds = Object.keys(players).sort((a, b) => { if (a === localPlayerId) return -1; if (b === localPlayerId) return 1; return a.localeCompare(b); }); sortedPlayerIds.forEach(playerId => { const pData = players[playerId]; if (!pData) return; const isSelf = (playerId === localPlayerId); const header = isSelf ? "YOU" : `P:${playerId.substring(0, 4)}`; const status = pData.player_status || PLAYER_STATUS_ALIVE; const health = pData.health ?? 0; const armor = pData.armor ?? 0; let healthDisplay; if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--health-bar-medium);'>DOWN</span>`; else if (status === PLAYER_STATUS_DEAD || health <= 0) healthDisplay = `<span style='color: var(--health-bar-low);'>DEAD</span>`; else healthDisplay = `${health.toFixed(1)}`; gridContainer.innerHTML += `<div class="player-stats-box"><div class="stats-header">${header}</div><div class="stats-content"><span>HP:</span> ${healthDisplay}<br><span>Armor:</span> ${Math.round(armor)}<br><span>Gun:</span> ${pData.gun ?? 1}<br><span>Speed:</span> ${pData.speed ?? PLAYER_DEFAULTS.base_speed}<br><span>Kills:</span> ${pData.kills ?? 0}<br><span>Score:</span> ${pData.score ?? 0}</div></div>`; }); }
    function addChatMessage(sender, message, isSelf, isSystem = false) { if (!DOM.chatLog) return; const div = document.createElement('div'); if (isSystem) { div.className = 'system-message'; div.textContent = message; } else { div.className = isSelf ? 'my-message' : 'other-message'; div.textContent = `${sender ? `P:${sender.substring(0,4)}` : '???'}: ${message}`; } DOM.chatLog.appendChild(div); DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight; }
    function updateCountdown(serverState) { if (!DOM.countdownDiv || !DOM.dayNightIndicator) return; const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0; DOM.countdownDiv.textContent = isCountdown ? Math.ceil(serverState.countdown) : ''; DOM.countdownDiv.style.display = isCountdown ? 'block' : 'none'; DOM.dayNightIndicator.style.display = (serverState?.status === 'active') ? 'block' : 'none'; }
    function updateDayNight(serverState) { if (!DOM.dayNightIndicator || !DOM.gameContainer) return; if (serverState?.status === 'active') { const isNight = serverState.is_night; DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day'; DOM.dayNightIndicator.style.display = 'block'; DOM.gameContainer.classList.toggle('night-mode', isNight); } else { DOM.dayNightIndicator.style.display = 'none'; DOM.gameContainer.classList.remove('night-mode'); } }
    function showGameOver(finalState) { if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return; const player = finalState?.players?.[appState.localPlayerId]; let statsHtml = "Stats Unavailable"; if (player) { statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div><div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`; } DOM.finalStatsDiv.innerHTML = statsHtml; log("UI: Showing game over screen."); showSection('game-over-screen'); }
    function updateEnvironmentDisplay() { const tempIndicator = document.getElementById('temperature-indicator'); if (!tempIndicator) return; if (appState.mode === 'menu' || !appState.serverState || appState.serverState.status !== 'active') { tempIndicator.style.display = 'none'; return; } tempIndicator.style.display = 'block'; const temp = appState.currentTemp; tempIndicator.innerHTML = `${temp.toFixed(0)}°C`; }
    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateDayNight, showGameOver, updateEnvironmentDisplay };
})();

// --- Network Module ---
const Network = (() => {
    let reconnectTimer = null;
    function connect(onOpenCallback) { if (socket && socket.readyState !== WebSocket.CLOSED) { if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); return; } clearTimeout(reconnectTimer); UI.updateStatus('Connecting...'); log("WS connect:", WEBSOCKET_URL); try { socket = new WebSocket(WEBSOCKET_URL); } catch (err) { error("WS creation failed:", err); UI.updateStatus('Connection failed.', true); return; } socket.onopen = () => { log('WS open.'); appState.isConnected = true; const loadingScreen = document.getElementById('loading-screen'); const gameContainer = DOM.gameContainer; if (loadingScreen) { loadingScreen.style.opacity = '0'; loadingScreen.style.pointerEvents = 'none'; } if (gameContainer) { gameContainer.style.visibility = 'visible'; gameContainer.style.opacity = '1'; } UI.updateStatus('Connected.'); UI.showSection('main-menu-section'); if (onOpenCallback) onOpenCallback(); }; socket.onmessage = handleServerMessage; socket.onerror = (event) => { error('WS Error:', event); }; socket.onclose = (event) => { error(`WS Closed: Code=${event.code}, Reason='${event.reason||'N/A'}'`); const wasConnected = appState.isConnected; appState.isConnected = false; socket = null; Game.resetClientState(false); if (event.code === 1000) { UI.updateStatus('Disconnected.'); UI.showSection('main-menu-section'); } else if (wasConnected) { UI.updateStatus('Connection lost. Reconnecting...', true); scheduleReconnect(); } else { UI.updateStatus('Connection failed.', true); } if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; Input.cleanup(); log("Game loop stopped: connection close."); } }; }
    function scheduleReconnect() { clearTimeout(reconnectTimer); log(`Reconnect in ${RECONNECT_DELAY}ms`); reconnectTimer = setTimeout(() => { log("Reconnecting..."); connect(() => { UI.updateStatus('Reconnected.'); UI.showSection('main-menu-section'); }); }, RECONNECT_DELAY); }
    function sendMessage(payload) { if (socket && socket.readyState === WebSocket.OPEN) { try { socket.send(JSON.stringify(payload)); } catch (err) { error("Send error:", err, payload); } } }
    function closeConnection(code = 1000, reason = "User action") { clearTimeout(reconnectTimer); if (socket && socket.readyState === WebSocket.OPEN) { log(`Closing WS: ${reason} (${code})`); socket.close(code, reason); } socket = null; appState.isConnected = false; }
    return { connect, sendMessage, closeConnection };
})();

// --- Input Handling Module ---
const Input = (() => {
    let keys = {}; let lastShotTime = 0; let movementInterval = null; let mouseCanvasPos = { x: 0, y: 0 }; let isMouseDown = false;
    function preventContextMenu(event) { if (DOM.canvasContainer && DOM.canvasContainer.contains(event.target)) event.preventDefault(); }
    function setup() { cleanup(); document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp); DOM.chatInput.addEventListener('keydown', handleChatEnter); if (DOM.canvasContainer) { DOM.canvasContainer.addEventListener('mousemove', handleMouseMove); DOM.canvasContainer.addEventListener('mousedown', handleMouseDown); DOM.canvasContainer.addEventListener('contextmenu', preventContextMenu); } else { error("Input setup failed: Canvas container not found."); } document.addEventListener('mouseup', handleMouseUp); movementInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL); log("Input setup."); }
    function cleanup() { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp); DOM.chatInput.removeEventListener('keydown', handleChatEnter); if (DOM.canvasContainer) { DOM.canvasContainer.removeEventListener('mousemove', handleMouseMove); DOM.canvasContainer.removeEventListener('mousedown', handleMouseDown); DOM.canvasContainer.removeEventListener('contextmenu', preventContextMenu); } document.removeEventListener('mouseup', handleMouseUp); clearInterval(movementInterval); movementInterval = null; keys = {}; isMouseDown = false; mouseCanvasPos = { x: 0, y: 0 }; log("Input cleaned up."); }
    function handleMouseMove(event) { if (!DOM.canvasContainer || !appState) return; const rect = DOM.canvasContainer.getBoundingClientRect(); const containerRawX = event.clientX - rect.left; const containerRawY = event.clientY - rect.top; const visualWidth = rect.width; const visualHeight = rect.height; const internalWidth = appState.canvasWidth; const internalHeight = appState.canvasHeight; const scaleX = (visualWidth > 0) ? internalWidth / visualWidth : 1; const scaleY = (visualHeight > 0) ? internalHeight / visualHeight : 1; mouseCanvasPos.x = Math.max(0, Math.min(internalWidth, containerRawX * scaleX)); mouseCanvasPos.y = Math.max(0, Math.min(internalHeight, containerRawY * scaleY)); }
    function handleMouseDown(event) { if (document.activeElement === DOM.chatInput) return; if (event.button === 0) { isMouseDown = true; event.preventDefault(); } else if (event.button === 2) { event.preventDefault(); if (appState.serverState?.status === 'active' && appState.isConnected) { Network.sendMessage({ type: 'player_pushback' }); localPlayerPushbackAnim.active = true; localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration; log("Pushback anim triggered."); } else { log("Pushback (RMB) ignored."); } } }
    function isShootHeld() { return keys[' '] || isMouseDown; }
    function handleMouseUp(event) { if (event.button === 0) { isMouseDown = false; } }
    function handleKeyDown(e) { if (document.activeElement === DOM.chatInput) return; const key = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { if (!keys[key]) { keys[key] = true; } e.preventDefault(); return; } if (key === 'e') { if (appState.serverState?.status === 'active' && appState.isConnected) { Network.sendMessage({ type: 'player_pushback' }); localPlayerPushbackAnim.active = true; localPlayerPushbackAnim.endTime = performance.now() + localPlayerPushbackAnim.duration; log("Pushback anim triggered."); e.preventDefault(); } else { log("Pushback ('e') ignored."); } return; } }
    function handleKeyUp(e) { const key = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) { if (keys[key]) { keys[key] = false; } } }
    function handleChatEnter(e) { if (e.key === 'Enter') { e.preventDefault(); Game.sendChatMessage(); } }
    function getMovementInputVector() { let dx = 0, dy = 0; if (keys['w'] || keys['arrowup']) dy -= 1; if (keys['s'] || keys['arrowdown']) dy += 1; if (keys['a'] || keys['arrowleft']) dx -= 1; if (keys['d'] || keys['arrowright']) dx += 1; if (dx !== 0 && dy !== 0) { const factor = 1 / Math.sqrt(2); dx *= factor; dy *= factor; } return { dx, dy }; }
    function sendMovementInput() { if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected) { Network.sendMessage({ type: 'player_move', direction: getMovementInputVector() }); } }
    function handleShooting() { if (appState.serverState?.status !== 'active') return; const playerState = appState.serverState?.players?.[appState.localPlayerId]; if (!playerState || playerState.player_status !== 'alive') return; const currentAmmo = playerState?.active_ammo_type || 'standard'; const isRapidFire = currentAmmo === 'ammo_rapid_fire'; const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0; const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier; const nowTimestamp = Date.now(); if (nowTimestamp - lastShotTime < actualCooldown) return; lastShotTime = nowTimestamp; const playerRenderX = appState.renderedPlayerPos.x; const playerRenderY = appState.renderedPlayerPos.y; if (typeof playerRenderX !== 'number' || typeof playerRenderY !== 'number' || typeof mouseCanvasPos.x !== 'number' || typeof mouseCanvasPos.y !== 'number') { console.error("Invalid pos for shooting", appState.renderedPlayerPos, mouseCanvasPos); return; } let aimDx = mouseCanvasPos.x - playerRenderX; let aimDy = mouseCanvasPos.y - playerRenderY; const aimMagSq = aimDx * aimDx + aimDy * aimDy; if (aimMagSq > 1) { const aimMag = Math.sqrt(aimMagSq); aimDx /= aimMag; aimDy /= aimMag; } else { aimDx = 0; aimDy = -1; } const nowPerf = performance.now(); localPlayerMuzzleFlash.active = true; localPlayerMuzzleFlash.endTime = nowPerf + 75; localPlayerMuzzleFlash.aimDx = aimDx; localPlayerMuzzleFlash.aimDy = aimDy; appState.localPlayerAimState.lastAimDx = aimDx; appState.localPlayerAimState.lastAimDy = aimDy; Network.sendMessage({ type: 'player_shoot', target: { x: mouseCanvasPos.x, y: mouseCanvasPos.y } }); SoundManager.playSound('shoot'); const casingLifetime = 500 + Math.random() * 300; const ejectAngleOffset = Math.PI / 2 + (Math.random() - 0.5) * 0.4; const ejectAngle = Math.atan2(aimDy, aimDx) + ejectAngleOffset; const ejectSpeed = 80 + Math.random() * 40; const gravity = 150; if (typeof activeAmmoCasings === 'undefined' || !Array.isArray(activeAmmoCasings)) { activeAmmoCasings = []; } const casing = { id: `casing_${nowPerf}_${Math.random().toString(16).slice(2)}`, x: playerRenderX + Math.cos(ejectAngle) * 15, y: playerRenderY + Math.sin(ejectAngle) * 15 - 10, vx: Math.cos(ejectAngle) * ejectSpeed, vy: Math.sin(ejectAngle) * ejectSpeed - 40, rotation: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() - 0.5) * 10, spawnTime: nowPerf, lifetime: casingLifetime, gravity: gravity, width: 6, height: 3, color: "rgba(218, 165, 32, 0.9)" }; activeAmmoCasings.push(casing); if (activeAmmoCasings.length > 50) { activeAmmoCasings.shift(); } }
    return { setup, cleanup, getMovementInputVector, handleShooting, isShootHeld };
})();

// --- Game Logic & Flow Module ---
const Game = (() => {
    function startSinglePlayer() { log("Requesting SP game..."); appState.mode = 'singleplayer'; UI.updateStatus("Starting..."); Network.sendMessage({ type: 'start_single_player' }); }
    function joinMultiplayer() { const gameId = DOM.gameIdInput.value.trim().toUpperCase(); if (!gameId || gameId.length !== 6) { UI.updateStatus('Invalid Game ID.', true); return; } log(`Joining game: ${gameId}`); appState.mode = 'multiplayer-client'; UI.updateStatus(`Joining ${gameId}...`); Network.sendMessage({ type: 'join_game', game_id: gameId }); }
    function hostMultiplayer(maxPlayers) { log(`Hosting MP game (${maxPlayers}p)...`); if (![2, 3, 4].includes(maxPlayers)) { error("Invalid max players:", maxPlayers); UI.updateStatus("Invalid count.", true); return; } appState.mode = 'multiplayer-host'; UI.updateStatus(`Creating ${maxPlayers}p game...`); Network.sendMessage({ type: 'create_game', max_players: maxPlayers }); }
    function leaveGame() { log("Leaving game..."); if (appState.isConnected && appState.currentGameId && appState.localPlayerId) { Network.sendMessage({ type: 'leave_game' }); } resetClientState(true); }
    function sendChatMessage() { const message = DOM.chatInput.value.trim(); if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) { Network.sendMessage({ type: 'player_chat', message: message }); DOM.chatInput.value = ''; } }

    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`); cleanupLoop();
        if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = ''; Object.keys(damageTextElements).forEach(id => delete damageTextElements[id]); inactiveDamageTextElements.length = 0; Object.keys(healthBarElements).forEach(id => delete healthBarElements[id]); inactiveHealthBarElements.length = 0; Object.keys(speechBubbleElements).forEach(id => delete speechBubbleElements[id]); inactiveSpeechBubbleElements.length = 0;
        if (typeof Renderer3D !== 'undefined') Renderer3D.cleanup();
        appState = { mode: 'menu', localPlayerId: null, maxPlayersInGame: null, currentGameId: null, serverState: null, animationFrameId: null, isConnected: appState.isConnected, renderedPlayerPos: { x: appState.canvasWidth/2 || 800, y: appState.canvasHeight/2 || 450 }, predictedPlayerPos: { x: appState.canvasWidth/2 || 800, y: appState.canvasHeight/2 || 450 }, lastServerState: null, previousServerState: null, lastLoopTime: null, lastStateReceiveTime: performance.now(), currentTemp: 18.0, isRaining: false, isDustStorm: false, targetTint: null, targetTintAlpha: 0.0, canvasWidth: appState.canvasWidth || 1600, canvasHeight: appState.canvasHeight || 900, uiPositions: {}, localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, };
        localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 }; localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
        activeSpeechBubbles = {}; activeEnemyBubbles = {}; activeAmmoCasings = []; activeBloodSparkEffects = {};
        if(typeof snake !== 'undefined'){ snake.isActiveFromServer = false; snake.segments = []; }
        DOM.chatLog.innerHTML = ''; DOM.gameCodeDisplay.textContent = '------'; DOM.gameIdInput.value = ''; if(DOM.countdownDiv) DOM.countdownDiv.style.display = 'none'; if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none'; if(DOM.gameOverScreen) DOM.gameOverScreen.style.display = 'none';
        const gridContainer = document.getElementById('player-stats-grid'); if (gridContainer) gridContainer.innerHTML = '';
        if (showMenu) { appState.mode = 'menu'; UI.updateStatus(appState.isConnected ? "Connected." : "Disconnected."); UI.showSection('main-menu-section'); }
    }

    function updateHtmlOverlays(stateToRender, appState) {
        if (!DOM.htmlOverlay || !stateToRender || !appState.uiPositions) return;
        const overlay = DOM.htmlOverlay; const now = performance.now();
        const players = stateToRender.players || {}; const enemies = stateToRender.enemies || {};
        const damageTexts = stateToRender.damage_texts || {};
        const allBubbles = { ...activeSpeechBubbles, ...activeEnemyBubbles };

        const activeDamageIds = new Set(Object.keys(damageTexts));
        const activeHealthBarIds = new Set();
        const activeBubbleIds = new Set(); for (const id in allBubbles) { if (now < allBubbles[id].endTime) activeBubbleIds.add(id); }

        // Damage Text
        for (const id in damageTexts) { const dtData = damageTexts[id]; const posData = appState.uiPositions[id]; if (!posData) continue; let element = damageTextElements[id]; if (!element) { element = inactiveDamageTextElements.pop() || document.createElement('div'); element.className = 'overlay-element damage-text-overlay'; element.style.position = 'absolute'; element.style.display = 'block'; overlay.appendChild(element); damageTextElements[id] = element; } element.textContent = dtData.text; element.classList.toggle('crit', dtData.is_crit || false); const lifeTime = (dtData.lifetime || 0.75) * 1000; const spawnTime = dtData.spawn_time * 1000; const timeElapsed = now - spawnTime; const lifeProgress = Math.min(1, timeElapsed / lifeTime); const verticalOffset = - (lifeProgress * 50); element.style.left = `${posData.screenX}px`; element.style.top = `${posData.screenY + verticalOffset}px`; element.style.opacity = 1.0 - (lifeProgress * 0.8); }
        for (const id in damageTextElements) { if (!activeDamageIds.has(id)) { const elementToPool = damageTextElements[id]; elementToPool.style.display = 'none'; inactiveDamageTextElements.push(elementToPool); delete damageTextElements[id]; } }

        // Health/Armor Bars
        const healthBarOffsetY = -35; const healthBarHeight = 7; const armorBarHeight = 4; const barSpacing = 2; const healthBarWidthFactor = 0.8; const minBarWidth = 30; const healthBarHighColor = getCssVar('--health-bar-high') || '#66bb6a'; const healthBarMediumColor = getCssVar('--health-bar-medium') || '#FFD700'; const healthBarLowColor = getCssVar('--health-bar-low') || '#DC143C'; const armorBarColor = getCssVar('--powerup-armor') || '#9e9e9e'; const healthBarBgColor = getCssVar('--health-bar-bg') || '#444';
        const processEntityForHealthBar = (id, entityData) => { if (!entityData || entityData.health <= 0 || entityData.player_status === PLAYER_STATUS_DOWN || entityData.player_status === PLAYER_STATUS_DEAD) return; const posData = appState.uiPositions[id]; if (!posData) return; activeHealthBarIds.add(id); const entityWidth = entityData.width || (id in players ? PLAYER_DEFAULTS.width : 20); const barWidth = Math.max(minBarWidth, entityWidth * healthBarWidthFactor); const maxHealth = entityData.max_health || 100; const healthPercent = Math.max(0, Math.min(1, entityData.health / maxHealth)); const currentHealthWidth = barWidth * healthPercent; const armorPercent = Math.max(0, Math.min(1, (entityData.armor || 0) / 100)); const currentArmorWidth = barWidth * armorPercent; const showArmor = entityData.armor > 0; let barContainer = healthBarElements[id]; if (!barContainer) { barContainer = inactiveHealthBarElements.pop(); if (!barContainer) { barContainer = document.createElement('div'); barContainer.className = 'overlay-element health-bar-container'; barContainer.style.position = 'absolute'; const healthBg = document.createElement('div'); healthBg.className = 'health-bar-bg'; healthBg.style.height = `${healthBarHeight}px`; healthBg.style.backgroundColor = healthBarBgColor; barContainer.appendChild(healthBg); const healthFg = document.createElement('div'); healthFg.className = 'health-bar-fg'; healthFg.style.height = `${healthBarHeight}px`; healthFg.style.position = 'absolute'; healthFg.style.top = '0'; healthFg.style.left = '0'; barContainer.appendChild(healthFg); const armorBg = document.createElement('div'); armorBg.className = 'armor-bar-bg'; armorBg.style.height = `${armorBarHeight}px`; armorBg.style.position = 'absolute'; armorBg.style.top = `${healthBarHeight + barSpacing}px`; armorBg.style.left = '0'; armorBg.style.backgroundColor = healthBarBgColor; barContainer.appendChild(armorBg); const armorFg = document.createElement('div'); armorFg.className = 'armor-bar-fg'; armorFg.style.height = `${armorBarHeight}px`; armorFg.style.position = 'absolute'; armorFg.style.top = `${healthBarHeight + barSpacing}px`; armorFg.style.left = '0'; armorFg.style.backgroundColor = armorBarColor; barContainer.appendChild(armorFg); overlay.appendChild(barContainer); } else { barContainer.style.display = 'block'; } healthBarElements[id] = barContainer; } barContainer.style.left = `${posData.screenX}px`; barContainer.style.top = `${posData.screenY + healthBarOffsetY}px`; barContainer.style.width = `${barWidth}px`; barContainer.style.transform = 'translateX(-50%)'; const healthBgEl = barContainer.children[0]; const healthFgEl = barContainer.children[1]; const armorBgEl = barContainer.children[2]; const armorFgEl = barContainer.children[3]; healthBgEl.style.width = `${barWidth}px`; healthFgEl.style.width = `${currentHealthWidth}px`; if (healthPercent > 0.66) healthFgEl.style.backgroundColor = healthBarHighColor; else if (healthPercent > 0.33) healthFgEl.style.backgroundColor = healthBarMediumColor; else healthFgEl.style.backgroundColor = healthBarLowColor; armorBgEl.style.display = showArmor ? 'block' : 'none'; armorFgEl.style.display = showArmor ? 'block' : 'none'; if(showArmor) { armorBgEl.style.width = `${barWidth}px`; armorFgEl.style.width = `${currentArmorWidth}px`; } };
        Object.entries(players).forEach(([id, data]) => processEntityForHealthBar(id, data)); Object.entries(enemies).forEach(([id, data]) => processEntityForHealthBar(id, data));
        for (const id in healthBarElements) { if (!activeHealthBarIds.has(id)) { const elementToPool = healthBarElements[id]; elementToPool.style.display = 'none'; inactiveHealthBarElements.push(elementToPool); delete healthBarElements[id]; } }

        // Speech Bubbles
        const playerSpeechBubbleBg = "rgba(0, 0, 0, 0.7)"; const playerSpeechBubbleColor = "#d0d8d7"; const enemySpeechBubbleBg = "rgba(70, 0, 0, 0.7)"; const enemySpeechBubbleColor = "#FFAAAA";
        for (const id in allBubbles) { const bubbleData = allBubbles[id]; if (!activeBubbleIds.has(id)) continue; const posData = appState.uiPositions[id]; if (!posData) continue; let element = speechBubbleElements[id]; if (!element) { element = inactiveSpeechBubbleElements.pop() || document.createElement('div'); element.style.position='absolute'; element.style.padding='5px 8px'; element.style.borderRadius='5px'; element.style.fontSize='13px'; element.style.textAlign='center'; element.style.maxWidth='150px'; element.style.wordWrap='break-word'; element.className='overlay-element speech-bubble'; overlay.appendChild(element); speechBubbleElements[id] = element; } element.textContent = bubbleData.text; element.style.display = 'block'; const isPlayer = !!stateToRender.players[id]; element.style.backgroundColor = isPlayer ? playerSpeechBubbleBg : enemySpeechBubbleBg; element.style.color = isPlayer ? playerSpeechBubbleColor : enemySpeechBubbleColor; const healthBarExists = activeHealthBarIds.has(id); const armorVisible = healthBarExists && (players[id]?.armor > 0 || enemies[id]?.armor > 0); const baseOffsetY = -45; const healthBarTotalHeight = healthBarExists ? (healthBarHeight + (armorVisible ? armorBarHeight + barSpacing : 0) + barSpacing) : 0; const bubbleOffsetY = baseOffsetY - healthBarTotalHeight; element.style.left = `${posData.screenX}px`; element.style.top = `${posData.screenY + bubbleOffsetY}px`; element.style.transform = 'translateX(-50%)'; }
        for (const id in speechBubbleElements) { if (!activeBubbleIds.has(id)) { const elementToPool = speechBubbleElements[id]; elementToPool.style.display = 'none'; inactiveSpeechBubbleElements.push(elementToPool); delete speechBubbleElements[id]; } }
    }

    // --- Game Loop ---
    function gameLoop(currentTime) {
        const now = performance.now();
        if (localPlayerPushbackAnim.active && now >= localPlayerPushbackAnim.endTime) localPlayerPushbackAnim.active = false;
        if (appState.mode === 'menu' || !appState.isConnected || appState.serverState?.game_over) { cleanupLoop(); return; }
        if (!appState.serverState && appState.mode !== 'singleplayer') { appState.animationFrameId = requestAnimationFrame(gameLoop); return; }

        if (appState.lastLoopTime === null) appState.lastLoopTime = now;
        const deltaTime = Math.min(0.1, (now - appState.lastLoopTime) / 1000);
        appState.lastLoopTime = now;

        if (typeof snake !== 'undefined' && typeof snake.update === 'function') snake.update(now);
        if (appState.serverState?.status === 'active' && Input.isShootHeld()) Input.handleShooting();

        activeAmmoCasings = activeAmmoCasings.filter(c => (now - c.spawnTime) < c.lifetime);
        activeAmmoCasings.forEach(c => { c.vy += c.gravity * deltaTime; c.x += c.vx * deltaTime; c.y += c.vy * deltaTime; c.rotation += c.rotationSpeed * deltaTime; });

        if (appState.serverState?.status === 'active') {
            if (appState.mode === 'singleplayer') { const pState = appState.serverState?.players?.[appState.localPlayerId]; if (pState && typeof pState.x === 'number') { appState.renderedPlayerPos.x = pState.x; appState.renderedPlayerPos.y = pState.y; }} // Added checks
            else { updatePredictedPosition(deltaTime); reconcileWithServer(); }
        }

        const stateToRender = getInterpolatedState(now);

        if (stateToRender && typeof Renderer3D !== 'undefined' && appState.mode !== 'menu') {
             localEffects.activeBloodSparkEffects = activeBloodSparkEffects; localEffects.activeAmmoCasings = activeAmmoCasings; localEffects.snake = snake;
             Renderer3D.renderScene(stateToRender, appState, localEffects);
        } else if (appState.mode !== 'menu') { log("Skipping render..."); }

        if (stateToRender && appState.mode !== 'menu') {
             updateHtmlOverlays(stateToRender, appState);
        }

        if (appState.mode !== 'menu' && appState.isConnected && !appState.serverState?.game_over) { appState.animationFrameId = requestAnimationFrame(gameLoop); }
        else { if(appState.animationFrameId) cleanupLoop(); }
    }

    function startGameLoop() { if (appState.mode === 'menu' || appState.animationFrameId) return; if (!appState.serverState && appState.mode !== 'singleplayer') { log("Delaying loop: Waiting for state."); return; } Input.setup(); log("Starting game loop..."); appState.lastLoopTime = null; appState.animationFrameId = requestAnimationFrame(gameLoop); }
    function getInterpolatedState(renderTime) {
        const INTERPOLATION_BUFFER_MS = 100; const serverState = appState.serverState; const lastServerState = appState.lastServerState;
        if (!serverState || !lastServerState || !serverState.timestamp || !lastServerState.timestamp) return serverState;
        const serverTime = serverState.timestamp * 1000; const lastServerTime = lastServerState.timestamp * 1000;
        if (serverTime <= lastServerTime) return serverState;
        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS; const timeBetweenStates = serverTime - lastServerTime;
        const timeSinceLastState = renderTargetTime - lastServerTime; let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates));
        let interpolatedState = JSON.parse(JSON.stringify(serverState));
        if (interpolatedState.players) { for (const pId in interpolatedState.players) { const currentP = serverState.players[pId]; const lastP = lastServerState.players?.[pId]; if (pId === appState.localPlayerId && appState.mode !== 'singleplayer') { interpolatedState.players[pId].x = appState.renderedPlayerPos.x; interpolatedState.players[pId].y = appState.renderedPlayerPos.y; } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number' && typeof currentP.y === 'number' && typeof lastP.y === 'number') { interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t); interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t); } } } // Added y check
        if (interpolatedState.enemies) { for (const eId in interpolatedState.enemies) { const currentE = serverState.enemies[eId]; const lastE = lastServerState.enemies?.[eId]; if (lastE && typeof currentE.x === 'number' && typeof lastE.x === 'number' && typeof currentE.y === 'number' && typeof lastE.y === 'number' && currentE.health > 0) { interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t); interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t); } } } // Fixed typo & added y check
        if (interpolatedState.bullets) { for (const bId in interpolatedState.bullets) { const currentB = serverState.bullets[bId]; const lastB = lastServerState.bullets?.[bId]; if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number' && typeof currentB.y === 'number' && typeof lastB.y === 'number') { interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t); interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t); } } } // Added y check
        interpolatedState.powerups = serverState.powerups; interpolatedState.damage_texts = serverState.damage_texts;
        return interpolatedState;
     }
    function cleanupLoop() { if (appState.animationFrameId) { cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; log("Game loop stopped."); } Input.cleanup(); appState.lastLoopTime = null; }
    function updatePredictedPosition(deltaTime) { if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return; const moveVector = Input.getMovementInputVector(); const playerState = appState.serverState.players[appState.localPlayerId]; const playerSpeed = playerState?.speed ?? PLAYER_DEFAULTS.base_speed; if (moveVector.dx !== 0 || moveVector.dy !== 0) { appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime; appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime; } const w_half = (playerState?.width ?? PLAYER_DEFAULTS.width) / 2; const h_half = (playerState?.height ?? PLAYER_DEFAULTS.height) / 2; appState.predictedPlayerPos.x = Math.max(w_half, Math.min(appState.canvasWidth - w_half, appState.predictedPlayerPos.x)); appState.predictedPlayerPos.y = Math.max(h_half, Math.min(appState.canvasHeight - h_half, appState.predictedPlayerPos.y)); }
    function reconcileWithServer() { if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return; const serverPos = appState.serverState.players[appState.localPlayerId]; if (typeof serverPos.x !== 'number' || typeof serverPos.y !== 'number') return; const predictedPos = appState.predictedPlayerPos; const renderedPos = appState.renderedPlayerPos; const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y); const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35; const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15; if (dist > snapThreshold) { predictedPos.x = serverPos.x; predictedPos.y = serverPos.y; renderedPos.x = serverPos.x; renderedPos.y = serverPos.y; } else { renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor); renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor); } }

    function initListeners() { log("Initializing button listeners..."); if (DOM.singlePlayerBtn) DOM.singlePlayerBtn.onclick = () => { SoundManager.init(); startSinglePlayer(); }; const hostHandler = (maxPlayers) => { SoundManager.init(); hostMultiplayer(maxPlayers); }; if (DOM.hostGameBtn2) DOM.hostGameBtn2.onclick = () => hostHandler(2); if (DOM.hostGameBtn3) DOM.hostGameBtn3.onclick = () => hostHandler(3); if (DOM.hostGameBtn4) DOM.hostGameBtn4.onclick = () => hostHandler(4); if (DOM.joinGameSubmitBtn) DOM.joinGameSubmitBtn.onclick = () => { SoundManager.init(); joinMultiplayer(); }; if (DOM.multiplayerBtn) DOM.multiplayerBtn.onclick = () => UI.showSection('multiplayer-menu-section'); if (DOM.showJoinUIBtn) DOM.showJoinUIBtn.onclick = () => UI.showSection('join-code-section'); if (DOM.cancelHostBtn) DOM.cancelHostBtn.onclick = leaveGame; if (DOM.sendChatBtn) DOM.sendChatBtn.onclick = sendChatMessage; if (DOM.leaveGameBtn) DOM.leaveGameBtn.onclick = leaveGame; if (DOM.gameOverBackBtn) DOM.gameOverBackBtn.onclick = () => resetClientState(true); DOM.gameContainer.querySelectorAll('.back-button').forEach(btn => { const targetId = btn.dataset.target; if (targetId && (DOM[targetId] || document.getElementById(targetId))) { btn.onclick = (e) => { e.preventDefault(); UI.showSection(targetId); }; } else { log(`Warn: Back button missing or invalid data-target: ${targetId}`, btn); } }); log("Finished initializing button listeners."); }

    return { startSinglePlayer, joinMultiplayer, hostMultiplayer, leaveGame, sendChatMessage, resetClientState, startGameLoop, cleanupLoop, getInterpolatedState, initListeners };
})();

// --- Global Server Message Handler ---
function handleServerMessage(event) {
    let data; try { data = JSON.parse(event.data); } catch (err) { error("Failed parse:", err, event.data); return; }
    try {
        if (typeof Renderer3D === 'undefined' && ['sp_game_started', 'game_joined', 'game_state', 'game_created', 'game_over_notification'].includes(data.type)) { error(`Received '${data.type}' before Renderer3D!`); return; }
        switch (data.type) {
            case 'game_created': case 'game_joined': case 'sp_game_started':
                log(`Received '${data.type}'`); appState.localPlayerId = data.player_id; appState.currentGameId = data.game_id; appState.serverState = data.initial_state; appState.maxPlayersInGame = data.max_players || appState.serverState?.max_players || (data.type === 'sp_game_started' ? 1 : '?');
                if (data.initial_state && typeof data.initial_state.canvas_width === 'number') { appState.canvasWidth = data.initial_state.canvas_width; appState.canvasHeight = data.initial_state.canvas_height; } else { error(`Initial state ('${data.type}') missing canvas dimensions!`); }
                const initialPlayer = appState.serverState?.players[appState.localPlayerId]; if (initialPlayer && typeof initialPlayer.x === 'number') { appState.predictedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y }; appState.renderedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y }; } else { appState.predictedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 }; appState.renderedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 }; } appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };
                if (data.type === 'game_created') { DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR'; const currentP = Object.keys(appState.serverState?.players || {}).length; DOM.waitingMessage.textContent = `Waiting... (${currentP}/${appState.maxPlayersInGame})`; UI.updateStatus(`Hosted: ${appState.currentGameId}`); UI.showSection('host-wait-section'); }
                else { UI.updateStatus(data.type === 'game_joined' ? `Joined ${appState.currentGameId}.` : "SP Started!"); UI.showSection('game-area'); if (appState.serverState) { UI.updateHUD(appState.serverState); UI.updateCountdown(appState.serverState); UI.updateDayNight(appState.serverState); UI.updateEnvironmentDisplay(); } Game.startGameLoop(); }
                break;
            case 'game_state':
                if (appState.mode === 'menu') return;
                const previousStatus = appState.serverState?.status; const previousPlayerState = appState.serverState?.players?.[appState.localPlayerId];
                appState.previousServerState = appState.lastServerState; appState.lastServerState = appState.serverState; appState.serverState = data.state;
                const newState = appState.serverState; const currentPlayerState = newState?.players?.[appState.localPlayerId]; appState.lastStateReceiveTime = performance.now();
                if (newState && typeof newState.canvas_width === 'number' && (appState.canvasWidth !== newState.canvas_width || appState.canvasHeight !== newState.canvas_height)) { appState.canvasWidth = newState.canvas_width; appState.canvasHeight = newState.canvas_height; }
                appState.currentTemp = newState.current_temperature ?? 18.0; appState.isRaining = newState.is_raining ?? false; appState.isDustStorm = newState.is_dust_storm ?? false;
                const serverSnakeState = newState.snake_state; if (serverSnakeState && typeof snake !== 'undefined') { snake.isActiveFromServer = serverSnakeState.active; snake.serverHeadX = serverSnakeState.head_x; snake.serverHeadY = serverSnakeState.head_y; snake.serverBaseY = serverSnakeState.base_y; if (snake.isActiveFromServer && snake.segments.length === 0) { snake.segments = [{ x: snake.serverHeadX, y: snake.serverHeadY, time: performance.now() }]; } else if (!snake.isActiveFromServer) { snake.segments = []; } } else if (typeof snake !== 'undefined') { snake.isActiveFromServer = false; snake.segments = []; }
                if (newState.enemies) { const now = performance.now(); const sparkDuration = 300; for (const enemyId in newState.enemies) { const enemy = newState.enemies[enemyId]; const previousEnemy = appState.lastServerState?.enemies?.[enemyId]; if (enemy && enemy.last_damage_time && (!previousEnemy || enemy.last_damage_time > (previousEnemy.last_damage_time || 0))) { const serverHitTimeMs = enemy.last_damage_time * 1000; if (now - serverHitTimeMs < 250) activeBloodSparkEffects[enemyId] = now + sparkDuration; } } for (const enemyId in activeBloodSparkEffects) { if (now >= activeBloodSparkEffects[enemyId]) delete activeBloodSparkEffects[enemyId]; } }
                let localPlayerDamagedThisTick = false; if (previousPlayerState && currentPlayerState && typeof currentPlayerState.health === 'number' && typeof previousPlayerState.health === 'number' && currentPlayerState.health < previousPlayerState.health) { const damageTaken = previousPlayerState.health - currentPlayerState.health; const baseMag = 5; const dmgScale = 0.18; const maxMag = 18; const shakeMagnitude = Math.min(maxMag, baseMag + damageTaken * dmgScale); if (Renderer3D?.triggerShake) Renderer3D.triggerShake(shakeMagnitude, 250); else console.warn("Renderer3D or triggerShake missing on damage"); localPlayerDamagedThisTick = true; } if (localPlayerDamagedThisTick) SoundManager.playSound('damage');
                if (currentPlayerState?.trigger_snake_bite_shake_this_tick) { const shakeMag = 15.0; const shakeDur = 400.0; if(Renderer3D?.triggerShake) Renderer3D.triggerShake(shakeMag, shakeDur); else console.warn("Renderer3D or triggerShake missing on snake bite"); }
                if (newState.status !== previousStatus) { log(`[Client State Change] ${previousStatus || 'null'} -> ${newState.status}`); if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') { UI.updateStatus(newState.status === 'countdown' ? "Countdown..." : "Active!"); UI.showSection('game-area'); if (!appState.animationFrameId) Game.startGameLoop(); } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') { UI.updateStatus("Waiting lobby.", true); UI.showSection('host-wait-section'); const pCountWaiting = Object.keys(newState.players || {}).length; DOM.waitingMessage.textContent = `Waiting... (${pCountWaiting}/${appState.maxPlayersInGame || '?'})`; Game.cleanupLoop(); } else if (newState.status === 'finished' && previousStatus !== 'finished') { log("-> Game Over via 'finished' status."); Game.cleanupLoop(); UI.showGameOver(newState); } }
                if (appState.animationFrameId && (newState.status === 'countdown' || newState.status === 'active')) { UI.updateHUD(newState); UI.updateCountdown(newState); UI.updateDayNight(newState); UI.updateEnvironmentDisplay(); } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') { const pCount = Object.keys(newState.players || {}).length; DOM.waitingMessage.textContent = `Waiting... (${pCount}/${appState.maxPlayersInGame || '?'})`; }
                const speakerId = newState.enemy_speaker_id; const speechText = newState.enemy_speech_text; if (speakerId && speechText) activeEnemyBubbles[speakerId] = { text: speechText.substring(0, 50), endTime: performance.now() + 3000 };
                break;
            case 'game_over_notification': log("Received 'game_over_notification'"); if (data.final_state) { appState.serverState = data.final_state; UI.updateStatus("Game Over!"); Game.cleanupLoop(); UI.showGameOver(data.final_state); log("-> Game Over via notification."); } else { error("Game over notification missing final_state."); Game.resetClientState(true); } break;
            case 'chat_message': const senderId = data.sender_id; const msgText = data.message; if (!senderId || !msgText) break; const isSelf = senderId === appState.localPlayerId; UI.addChatMessage(senderId, msgText, isSelf); if (appState.serverState?.players?.[senderId]) activeSpeechBubbles[senderId] = { text: msgText.substring(0, 50), endTime: performance.now() + 4000 }; break;
            case 'error': error("[Client] Server Error:", data.message); UI.updateStatus(`Error: ${data.message}`, true); if (appState.mode === 'multiplayer-client' && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'))) { UI.showSection('join-code-section'); appState.mode = 'menu'; } else if (appState.mode === 'multiplayer-host' && data.message.includes('Creation Error')) { Game.resetClientState(true); } else if (data.message === 'Please create or join a game first.') { Game.resetClientState(true); } break;
            default: log(`Unknown msg type: ${data.type}`);
        }
    } catch (handlerError) { error("Error in handleServerMessage:", handlerError, "Data:", data); }
}

// --- DOMContentLoaded Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded.");
    if (typeof Renderer3D === 'undefined') { error("CRITICAL: Renderer3D not defined!"); UI.updateStatus("Init Error: Renderer failed.", true); return; }
    if (DOM.canvasContainer) { if (!Renderer3D.init(DOM.canvasContainer, appState.canvasWidth, appState.canvasHeight)) { error("Renderer3D initialization failed!"); UI.updateStatus("Init Error: Graphics failed.", true); return; } log("Renderer3D initialized."); }
    else { error("Canvas container not found!"); UI.updateStatus("Init Error: UI missing.", true); return; }
    try { Game.initListeners(); log("Button listeners initialized."); }
    catch(listenerError) { error("Error initializing listeners:", listenerError); UI.updateStatus("Init Error: Controls failed.", true); return; }
    UI.updateStatus("Initializing Connection...");
    Network.connect(() => { /* Success handled internally */ });
});
