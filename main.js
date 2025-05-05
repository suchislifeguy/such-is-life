// main.js v3.5 - DRASTIC SIMPLIFICATION FOR DEBUG
// Client-side logic for Kelly Gang Survival
// Removes interpolation & prediction/reconciliation to force rendering latest server state.

import * as THREE from 'three';
import Renderer3D from './Renderer3D.js';

console.log("--- main.js v3.5 (DEBUG MODE - NO INTERP/PREDICT): Initializing ---");

// --- Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
const SHOOT_COOLDOWN = 100;
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33;
const RECONNECT_DELAY = 3000;
const DEFAULT_WORLD_WIDTH = 2000;
const DEFAULT_WORLD_HEIGHT = 1500;
const DEFAULT_PLAYER_RADIUS = 12;
// const INTERPOLATION_BUFFER_MS = 100; // Not used in this version
const SPEECH_BUBBLE_DURATION_MS = 4000;
const ENEMY_SPEECH_BUBBLE_DURATION_MS = 3000;
const PUSHBACK_ANIM_DURATION = 250;
const MUZZLE_FLASH_DURATION = 75;
const RESIZE_DEBOUNCE_MS = 150;
const FOOTSTEP_INTERVAL_MS = 350;
const SHOOT_VOLUME = 0.6;
const FOOTSTEP_VOLUME = 0.4;
const UI_CLICK_VOLUME = 0.7;

// Player State Constants
const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
// function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; } // Not used
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

// --- DOM References --- (Assumed correct)
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
    gameArea: document.getElementById('game-area'),
    statsPanel: document.getElementById('stats-panel'),
    playerStatsGrid: document.getElementById('player-stats-grid'),
    environmentInfo: document.getElementById('environment-info'),
    dayNightIndicator: document.getElementById('day-night-indicator'),
    temperatureIndicator: document.getElementById('temperature-indicator'),
    gameControls: document.querySelector('#stats-panel .game-controls'),
    muteBtn: document.getElementById('muteBtn'),
    leaveGameBtn: document.getElementById('leaveGameBtn'),
    canvasContainer: document.getElementById('canvas-container'),
    countdownDiv: document.getElementById('countdown-overlay'),
    htmlOverlay: document.getElementById('html-overlay'),
    chatPanel: document.getElementById('chat-panel'),
    chatLog: document.getElementById('chat-log'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),
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
    backButtons: document.querySelectorAll('.button-back'),
};

// --- Application State ---
let appState = {
    mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null,
    serverState: null,          // Latest full state from server
    // lastServerState: null,   // Not needed for non-interpolated version
    lastStateReceiveTime: 0,
    animationFrameId: null, isConnected: false, isGameLoopRunning: false, isRendererReady: false,
    worldWidth: DEFAULT_WORLD_WIDTH, worldHeight: DEFAULT_WORLD_HEIGHT,
    localPlayerRadius: DEFAULT_PLAYER_RADIUS,
    // renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, // Not used directly for rendering player position
    // predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, // Not used directly for rendering player position
    mouseWorldPosition: new THREE.Vector3(0, 0, 0),
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
    uiPositions: {}, currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false,
};

// --- Local Effects State ---
let localEffects = {
    muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 },
    pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION },
    snake: { active: false, segments: [] }
};

// --- HTML Overlay Object Pools ---
const overlayElementPools = {
    damageText: { elements: {}, inactive: [] },
    speechBubble: { elements: {}, inactive: [] },
};

// --- Core Modules ---
let socket = null;
let reconnectTimer = null;
let lastLoopTime = 0;
let resizeHandler = null;
let lastFootstepTime = 0;

// --- Sound Manager Module ---
const SoundManager = (() => {
    let audioContext = null; let gainNode = null; let loadedSounds = {};
    let soundFiles = { 'shoot': 'assets/sounds/shoot.mp3', 'damage': 'assets/sounds/damage.mp3', 'powerup': 'assets/sounds/powerup.mp3', 'death': 'assets/sounds/death.mp3', 'enemy_hit': 'assets/sounds/enemy_hit.mp3', 'enemy_death': 'assets/sounds/enemy_death.mp3', 'ui_click': 'assets/sounds/ui_click.mp3', 'footstep': 'assets/sounds/footstep.mp3', };
    let isInitialized = false; let canPlaySound = false; let isMuted = false;
    function init() { if (isInitialized) return; isInitialized = true; try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { error("[SM] Web Audio API not supported."); return; } audioContext = new AC(); gainNode = audioContext.createGain(); gainNode.connect(audioContext.destination); const resumeAudio = () => { if (audioContext.state === 'suspended') { audioContext.resume().then(() => { log("[SM] Audio Resumed."); canPlaySound = true; loadSounds(); }).catch(e => error("[SM] Resume failed:", e)); } document.removeEventListener('click', resumeAudio); document.removeEventListener('keydown', resumeAudio); }; if (audioContext.state === 'suspended') { log("[SM] Audio suspended. Waiting for user interaction."); document.addEventListener('click', resumeAudio, { once: true }); document.addEventListener('keydown', resumeAudio, { once: true }); } else if (audioContext.state === 'running') { canPlaySound = true; loadSounds(); } } catch (e) { error("[SM] Init error:", e); } }
    function loadSounds() { if (!audioContext || !canPlaySound) return; log("[SM] Loading sounds..."); const promises = Object.entries(soundFiles).map(([name, path]) => fetch(path).then(r => r.ok ? r.arrayBuffer() : Promise.reject(`HTTP ${r.status} loading ${path}`)).then(b => audioContext.decodeAudioData(b)).then(db => { loadedSounds[name] = db; }).catch(e => { error(`[SM] Load/Decode '${name}' (${path}) error:`, e); })); Promise.allSettled(promises).then(() => log("[SM] Sound loading finished.")); }
    function playSound(name, volume = 1.0) { if (!canPlaySound || !audioContext || !gainNode || audioContext.state !== 'running') return; const buffer = loadedSounds[name]; if (!buffer) { console.warn(`[SM] Sound not loaded or decoded: ${name}`); return; } if (isMuted && name !== 'ui_click') return; try { const source = audioContext.createBufferSource(); source.buffer = buffer; const soundGain = audioContext.createGain(); soundGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime); source.connect(soundGain).connect(gainNode); source.start(0); source.onended = () => { try { source.disconnect(); soundGain.disconnect(); } catch(e){} }; } catch (e) { error(`[SM] Play '${name}' error:`, e); } }
    function toggleMute() { isMuted = !isMuted; if (gainNode) gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext?.currentTime || 0); log(`[SM] Sound ${isMuted ? 'Muted' : 'Unmuted'}`); if (DOM.muteBtn) { DOM.muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; DOM.muteBtn.setAttribute('aria-pressed', isMuted); DOM.muteBtn.classList.toggle('muted', isMuted); } }
    function getMuteState() { return isMuted; }
    return { init, playSound, toggleMute, getMuteState };
})();

// --- UI Manager Module ---
const UIManager = (() => {
    const allMenuSections = [ DOM.mainMenuSection, DOM.multiplayerMenuSection, DOM.hostWaitSection, DOM.joinCodeSection ];
    function showSection(sectionId) { DOM.menuArea?.classList.add('hidden'); allMenuSections.forEach(s => s?.classList.remove('active')); DOM.gameArea?.classList.remove('active'); DOM.gameOverScreen?.classList.remove('active'); const sectionToShow = document.getElementById(sectionId); if (sectionToShow) { sectionToShow.classList.add('active'); if (sectionToShow.closest('#menu-area')) { DOM.menuArea?.classList.remove('hidden'); } } else { error(`UI: Section not found: ${sectionId}`); } }
    function updateStatus(message, isError = false) { if (!DOM.gameStatus) return; DOM.gameStatus.textContent = message; DOM.gameStatus.style.color = isError ? (getCssVar('--color-danger') || 'red') : (getCssVar('--color-accent') || 'yellow'); }
    function updateHUD(serverState) { if (!DOM.playerStatsGrid || !serverState?.players || !appState.localPlayerId) { if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = ''; return; } const players = serverState.players; const localId = appState.localPlayerId; DOM.playerStatsGrid.innerHTML = ''; const sortedPlayerIds = Object.keys(players).sort((a, b) => { if (a === localId) return -1; if (b === localId) return 1; return a.localeCompare(b); }); sortedPlayerIds.forEach(pId => { const pData = players[pId]; if (!pData) return; const isSelf = (pId === localId); const header = isSelf ? "YOU" : `P:${pId.substring(0, 4)}`; const status = pData.player_status || PLAYER_STATUS_ALIVE; let healthDisplay; if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--color-down-status);'>DOWN</span>`; else if (status === PLAYER_STATUS_DEAD || pData.health <= 0) healthDisplay = `<span style='color: var(--color-dead-status);'>DEAD</span>`; else { const hp = pData.health ?? 0; let color = 'var(--color-health-high)'; if (hp < 66) color = 'var(--color-health-medium)'; if (hp < 33) color = 'var(--color-health-low)'; healthDisplay = `<span style='color:${color};'>${hp.toFixed(0)}</span>`; } const armor = pData.armor ?? 0; let armorDisplay = Math.round(armor); if(armor > 0) armorDisplay = `<span style='color: var(--color-armor);'>${armorDisplay}</span>`; const box = document.createElement('div'); box.className = 'stats-box'; box.innerHTML = `<div class="stats-header">${header}</div><div class="stats-content"><span>HP:</span> ${healthDisplay}<br><span>Armor:</span> ${armorDisplay}<br><span>Gun:</span> ${pData.gun ?? 1}<br><span>Speed:</span> ${pData.speed ?? '-'}<br><span>Kills:</span> ${pData.kills ?? 0}<br><span>Score:</span> ${pData.score ?? 0}</div>`; DOM.playerStatsGrid.appendChild(box); }); }
    function addChatMessage(senderId, message, isSystem = false) { if (!DOM.chatLog) return; const div = document.createElement('div'); const isSelf = senderId === appState.localPlayerId; let senderName = 'System'; if (!isSystem) { senderName = isSelf ? 'You' : `P:${senderId ? senderId.substring(0, 4) : '???'}`; } div.classList.add('chat-message', isSystem ? 'system-message' : (isSelf ? 'my-message' : 'other-message')); div.textContent = isSystem ? message : `${senderName}: ${message}`; DOM.chatLog.appendChild(div); DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight; }
    function updateCountdown(serverState) { if (!DOM.countdownDiv) return; const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0; if (isCountdown) { DOM.countdownDiv.textContent = Math.ceil(serverState.countdown); DOM.countdownDiv.classList.add('active'); } else { DOM.countdownDiv.classList.remove('active'); } }
    function updateEnvironmentDisplay(serverState) { if (!DOM.dayNightIndicator || !DOM.temperatureIndicator || !DOM.gameContainer) return; if (serverState?.status === 'active' || serverState?.status === 'countdown') { const isNight = serverState.is_night ?? false; appState.isNight = isNight; DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day'; DOM.dayNightIndicator.style.display = 'block'; DOM.gameContainer.classList.toggle('night-mode', isNight); appState.currentTemp = serverState.current_temperature ?? 18.0; appState.isRaining = serverState.is_raining ?? false; appState.isDustStorm = serverState.is_dust_storm ?? false; DOM.temperatureIndicator.textContent = `${appState.currentTemp.toFixed(0)}°C`; DOM.temperatureIndicator.style.display = 'block'; DOM.gameContainer.classList.toggle('raining', appState.isRaining); DOM.gameContainer.classList.toggle('dust-storm', appState.isDustStorm); } else { DOM.dayNightIndicator.style.display = 'none'; DOM.temperatureIndicator.style.display = 'none'; DOM.gameContainer.classList.remove('night-mode', 'raining', 'dust-storm'); appState.isNight = false; appState.isRaining = false; appState.isDustStorm = false; } }
    function showGameOver(finalState) { if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return; const player = finalState?.players?.[appState.localPlayerId]; let statsHtml = "---"; if (player) { statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div><div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`; } DOM.finalStatsDiv.innerHTML = statsHtml; log("UI: Showing game over screen."); showSection('game-over-screen'); }
    function updateHtmlOverlays() { if (!DOM.htmlOverlay || !appState.serverState || !appState.uiPositions) return; const overlay = DOM.htmlOverlay; const now = performance.now(); const pools = overlayElementPools; const state = appState.serverState; const uiPos = appState.uiPositions; const activeElements = { damageText: new Set(), speechBubble: new Set() }; const getElement = (poolName, id, className) => { const pool = pools[poolName]; let el = pool.elements[id]; if (!el) { el = pool.inactive.pop(); if (!el) { el = document.createElement('div'); overlay.appendChild(el); } else { el.style.display = 'block'; } pool.elements[id] = el; el.className = className; } return el; }; const releaseElement = (poolName, id) => { const pool = pools[poolName]; const el = pool.elements[id]; if (el) { el.style.display = 'none'; el.textContent = ''; el.className = ''; pool.inactive.push(el); delete pool.elements[id]; } }; if (state.damage_texts) { for (const id in state.damage_texts) { const dtData = state.damage_texts[id]; const posData = uiPos[id]; if (!posData) continue; activeElements.damageText.add(id); const element = getElement('damageText', id, 'overlay-element damage-text-overlay'); element.textContent = dtData.text; element.classList.toggle('crit', dtData.is_crit || false); const lifeTime = (dtData.lifetime || 0.75) * 1000; const spawnTime = dtData.spawn_time * 1000; const elapsed = now - spawnTime; const progress = Math.min(1, elapsed / lifeTime); const verticalOffset = -(progress * 50); element.style.left = `${posData.screenX}px`; element.style.top = `${posData.screenY + verticalOffset}px`; element.style.opacity = Math.max(0, 1.0 - (progress * 0.9)).toFixed(2); } } for (const id in pools.damageText.elements) { if (!activeElements.damageText.has(id)) releaseElement('damageText', id); } const currentBubbles = {}; if (state.players) { Object.entries(state.players).forEach(([id, pData]) => { if (pData?.speechBubble) currentBubbles[id] = { ...pData.speechBubble, source: 'player' }; }); } if (state.enemy_speaker_id && state.enemy_speech_text) { currentBubbles[state.enemy_speaker_id] = { text: state.enemy_speech_text, endTime: now + ENEMY_SPEECH_BUBBLE_DURATION_MS, source: 'enemy'}; } for(const id in currentBubbles) { const bubbleData = currentBubbles[id]; const posData = uiPos[id]; if (!posData) continue; if (bubbleData.source === 'player' && bubbleData.endTime && now > bubbleData.endTime) continue; activeElements.speechBubble.add(id); const element = getElement('speechBubble', id, 'overlay-element speech-bubble'); element.textContent = bubbleData.text.substring(0, 50); const yOffset = -60; element.style.left = `${posData.screenX}px`; element.style.top = `${posData.screenY + yOffset}px`; element.style.opacity = 1.0; } for (const id in pools.speechBubble.elements) { if (!activeElements.speechBubble.has(id)) releaseElement('speechBubble', id); } }
    return { showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateEnvironmentDisplay, showGameOver, updateHtmlOverlays };
})();

// --- Network Manager Module ---
const NetworkManager = (() => {
    function connect(onOpenCallback) { if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) { if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); return; } clearTimeout(reconnectTimer); UIManager.updateStatus('Connecting...'); log("WS connect:", WEBSOCKET_URL); try { socket = new WebSocket(WEBSOCKET_URL); } catch (err) { error("WS creation failed:", err); UIManager.updateStatus('Connection failed.', true); return; } socket.onopen = () => { log('WS open.'); appState.isConnected = true; DOM.loadingScreen?.classList.remove('active'); DOM.gameContainer?.classList.add('loaded'); UIManager.updateStatus('Connected.'); if (!appState.localPlayerId) UIManager.showSection('main-menu-section'); if (onOpenCallback) onOpenCallback(); }; socket.onmessage = handleServerMessage; socket.onerror = (event) => { error('WS Error:', event); }; socket.onclose = (event) => { error(`WS Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`); const wasConnected = appState.isConnected; appState.isConnected = false; socket = null; GameManager.cleanupLoop(); if (appState.mode !== 'menu') GameManager.resetClientState(false); if (event.code === 1000 || event.code === 1001 || event.code === 1005) { UIManager.updateStatus('Disconnected.'); UIManager.showSection('main-menu-section'); } else if (wasConnected) { UIManager.updateStatus('Connection lost. Retrying...', true); scheduleReconnect(); } else { UIManager.updateStatus('Connection failed.', true); UIManager.showSection('main-menu-section'); } }; }
    function scheduleReconnect() { clearTimeout(reconnectTimer); log(`Reconnect attempt in ${RECONNECT_DELAY}ms`); reconnectTimer = setTimeout(() => { log("Attempting reconnect..."); connect(() => { UIManager.updateStatus('Reconnected.'); UIManager.showSection('main-menu-section'); }); }, RECONNECT_DELAY); }
    function sendMessage(payload) { if (socket && socket.readyState === WebSocket.OPEN) { try { socket.send(JSON.stringify(payload)); } catch (err) { error("Send error:", err, payload); } } }
    function closeConnection(code = 1000, reason = "User action") { clearTimeout(reconnectTimer); if (socket && socket.readyState === WebSocket.OPEN) { log(`Closing WS connection: ${reason} (${code})`); socket.close(code, reason); } socket = null; appState.isConnected = false; }
    return { connect, sendMessage, closeConnection };
})();

// --- Input Manager Module ---
const InputManager = (() => {
    let keys = {}; let lastShotTime = 0; let inputInterval = null; let mouseScreenPos = { x: 0, y: 0 }; let isMouseDown = false; let isRightMouseDown = false;
    const raycaster = new THREE.Raycaster(); const mouseNDC = new THREE.Vector2();
    function preventContextMenu(event) { if (DOM.canvasContainer?.contains(event.target)) event.preventDefault(); }
    function setup() { cleanup(); log("Input: Setting up listeners..."); document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp); DOM.chatInput?.addEventListener('keydown', handleChatEnter); DOM.canvasContainer?.addEventListener('mousemove', handleMouseMove); DOM.canvasContainer?.addEventListener('mousedown', handleMouseDown); DOM.canvasContainer?.addEventListener('contextmenu', preventContextMenu); document.addEventListener('mouseup', handleMouseUp); inputInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL); }
    function cleanup() { log("Input: Cleaning up listeners..."); document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp); DOM.chatInput?.removeEventListener('keydown', handleChatEnter); DOM.canvasContainer?.removeEventListener('mousemove', handleMouseMove); DOM.canvasContainer?.removeEventListener('mousedown', handleMouseDown); DOM.canvasContainer?.removeEventListener('contextmenu', preventContextMenu); document.removeEventListener('mouseup', handleMouseUp); clearInterval(inputInterval); inputInterval = null; keys = {}; isMouseDown = false; isRightMouseDown = false; mouseScreenPos = { x: 0, y: 0 }; }
    function handleMouseMove(event) { if (!DOM.canvasContainer || !appState.isRendererReady || !Renderer3D.getCamera || !Renderer3D.getGroundPlane || !appState.isGameLoopRunning) return; const rect = DOM.canvasContainer.getBoundingClientRect(); const canvasX = event.clientX - rect.left; const canvasY = event.clientY - rect.top; mouseScreenPos.x = canvasX; mouseScreenPos.y = canvasY; mouseNDC.x = (canvasX / rect.width) * 2 - 1; mouseNDC.y = -(canvasY / rect.height) * 2 + 1; const camera = Renderer3D.getCamera(); const groundPlane = Renderer3D.getGroundPlane(); if (camera && groundPlane) { try { raycaster.setFromCamera(mouseNDC, camera); const intersects = raycaster.intersectObject(groundPlane); if (intersects.length > 0) appState.mouseWorldPosition.copy(intersects[0].point); } catch (e) { error("Input: Raycasting error:", e); } } }
    function handleMouseDown(event) { if (document.activeElement === DOM.chatInput) return; if (event.button === 0) isMouseDown = true; else if (event.button === 2) { isRightMouseDown = true; event.preventDefault(); triggerPushbackCheck(); } }
    function handleMouseUp(event) { if (event.button === 0) isMouseDown = false; if (event.button === 2) isRightMouseDown = false; }
    function handleKeyDown(event) { if (document.activeElement === DOM.chatInput) return; const key = event.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { if (!keys[key]) keys[key] = true; event.preventDefault(); } if (key === ' ' && !keys[' ']) { keys[' '] = true; handleShooting(); event.preventDefault(); } if (key === 'e' && !keys['e']) { keys['e'] = true; triggerPushbackCheck(); event.preventDefault(); } }
    function handleKeyUp(event) { const key = event.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) keys[key] = false; }
    function handleChatEnter(event) { if (event.key === 'Enter') { event.preventDefault(); GameManager.sendChatMessage(); } }
    function getMovementInputVector() { let dx = 0, dy = 0; if (keys['w'] || keys['arrowup']) dy -= 1; if (keys['s'] || keys['arrowdown']) dy += 1; if (keys['a'] || keys['arrowleft']) dx -= 1; if (keys['d'] || keys['arrowright']) dx += 1; if (dx !== 0 && dy !== 0) { const factor = Math.SQRT1_2; dx *= factor; dy *= factor; } return { dx, dy }; }
    function sendMovementInput() { if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) { NetworkManager.sendMessage({ type: 'player_move', direction: getMovementInputVector() }); } }
    function triggerPushbackCheck() { if (appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) { GameManager.triggerLocalPushback(); } }
    // handleShooting - Guard clause added
    function handleShooting() {
        if (!appState.serverState || !appState.localPlayerId) return; // GUARD
        if (!appState.isRendererReady || appState.serverState.status !== 'active') return; // GUARD
        const playerState = appState.serverState.players?.[appState.localPlayerId];
        if (!playerState || playerState.player_status !== PLAYER_STATUS_ALIVE) return; // GUARD

        const nowTimestamp = Date.now(); const currentAmmo = playerState?.active_ammo_type || 'standard'; const isRapidFire = currentAmmo === 'ammo_rapid_fire'; const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0; const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier; if (nowTimestamp - lastShotTime < actualCooldown) return; lastShotTime = nowTimestamp;
        const playerPredictX = appState.predictedPlayerPos.x; const playerPredictZ = appState.predictedPlayerPos.y; const targetWorldPos = appState.mouseWorldPosition;
        let aimDx = 0, aimDy = -1; if (targetWorldPos && typeof playerPredictX === 'number' && typeof playerPredictZ === 'number') { aimDx = targetWorldPos.x - playerPredictX; aimDy = targetWorldPos.z - playerPredictZ; const magSq = aimDx * aimDx + aimDy * aimDy; if (magSq > 0.01) { const mag = Math.sqrt(magSq); aimDx /= mag; aimDy /= mag; } else { aimDx = 0; aimDy = -1; } } appState.localPlayerAimState.lastAimDx = aimDx; appState.localPlayerAimState.lastAimDy = aimDy;
        localEffects.muzzleFlash.active = true; localEffects.muzzleFlash.endTime = performance.now() + MUZZLE_FLASH_DURATION; localEffects.muzzleFlash.aimDx = aimDx; localEffects.muzzleFlash.aimDy = aimDy;
        SoundManager.playSound('shoot', SHOOT_VOLUME);
        if (Renderer3D.spawnVisualAmmoCasing) { const spawnPos = new THREE.Vector3(playerPredictX, 0, playerPredictZ); const ejectVec = new THREE.Vector3(aimDx, 0, aimDy); Renderer3D.spawnVisualAmmoCasing(spawnPos, ejectVec); }
        NetworkManager.sendMessage({ type: 'player_shoot', target: { x: targetWorldPos.x, y: targetWorldPos.z } });
    }
    function update(deltaTime) {
         if (keys[' ']) handleShooting();
         if (isMouseDown) handleShooting();
         const isMoving = (keys['w'] || keys['a'] || keys['s'] || keys['d'] || keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright']);
         const player = appState.serverState?.players?.[appState.localPlayerId];
         if (isMoving && player?.player_status === PLAYER_STATUS_ALIVE) { const now = performance.now(); if (now - lastFootstepTime > FOOTSTEP_INTERVAL_MS) { SoundManager.playSound('footstep', FOOTSTEP_VOLUME); lastFootstepTime = now; } }
    }
    return { setup, cleanup, update, getMovementInputVector };
})();

// --- Game Manager Module ---
const GameManager = (() => {
    let isInitialized = false;
    function initListeners() { // ui_click sounds added back (except initial start)
        if (isInitialized) return; log("Game: Initializing listeners...");
        DOM.singlePlayerBtn?.addEventListener('click', () => { SoundManager.init(); startSinglePlayer(); }); DOM.multiplayerBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection('multiplayer-menu-section'); }); const hostHandler = (maxP) => { SoundManager.init(); hostMultiplayer(maxP); }; DOM.hostGameBtn2?.addEventListener('click', () => hostHandler(2)); DOM.hostGameBtn3?.addEventListener('click', () => hostHandler(3)); DOM.hostGameBtn4?.addEventListener('click', () => hostHandler(4)); DOM.showJoinUIBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection('join-code-section'); }); DOM.joinGameSubmitBtn?.addEventListener('click', () => { SoundManager.init(); joinMultiplayer(); }); DOM.cancelHostBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); leaveGame(); }); DOM.sendChatBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); sendChatMessage(); }); DOM.leaveGameBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); leaveGame(); }); DOM.gameOverBackBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); resetClientState(true); }); DOM.muteBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); SoundManager.toggleMute(); }); if(DOM.muteBtn) { DOM.muteBtn.textContent = SoundManager.getMuteState() ? 'Unmute' : 'Mute'; DOM.muteBtn.setAttribute('aria-pressed', SoundManager.getMuteState()); DOM.muteBtn.classList.toggle('muted', SoundManager.getMuteState()); } DOM.backButtons.forEach(btn => { const targetId = btn.dataset.target; if (targetId && document.getElementById(targetId)) { btn.addEventListener('click', (e) => { e.preventDefault(); SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection(targetId); }); } else { log(`Warn: Back button missing/invalid target: ${targetId}`, btn); } }); isInitialized = true; log("Game: Listeners initialized.");
    }
    function startSinglePlayer() { log("Requesting Single Player game..."); appState.mode = 'singleplayer'; UIManager.updateStatus("Starting Single Player..."); NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'start_single_player' })); }
    function joinMultiplayer() { const gameId = DOM.gameIdInput?.value.trim().toUpperCase(); if (!gameId || gameId.length !== 6) { UIManager.updateStatus('Invalid Game ID (6 chars).', true); return; } log(`Joining MP game: ${gameId}`); appState.mode = 'multiplayer-client'; UIManager.updateStatus(`Joining game ${gameId}...`); NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'join_game', game_id: gameId })); }
    function hostMultiplayer(maxPlayers) { log(`Hosting MP game (${maxPlayers}p)...`); if (![2, 3, 4].includes(maxPlayers)) { error("Invalid max players:", maxPlayers); UIManager.updateStatus("Invalid player count.", true); return; } appState.mode = 'multiplayer-host'; UIManager.updateStatus(`Creating ${maxPlayers}p game...`); NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'create_game', max_players: maxPlayers })); }
    function leaveGame() { log("Leaving game..."); if (appState.isConnected && appState.currentGameId && appState.localPlayerId) NetworkManager.sendMessage({ type: 'leave_game' }); NetworkManager.closeConnection(1000, "User left game"); resetClientState(true); }
    function sendChatMessage() { const message = DOM.chatInput?.value.trim(); if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) { NetworkManager.sendMessage({ type: 'player_chat', message: message }); if(DOM.chatInput) DOM.chatInput.value = ''; } }
    function triggerLocalPushback() { localEffects.pushbackAnim.active = true; localEffects.pushbackAnim.endTime = performance.now() + localEffects.pushbackAnim.duration; NetworkManager.sendMessage({ type: 'player_pushback' }); }
    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`); cleanupLoop(); if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = ''; Object.values(overlayElementPools).forEach(pool => { pool.elements = {}; pool.inactive = []; }); if (appState.isRendererReady && Renderer3D.cleanup) Renderer3D.cleanup(); const currentIsConnected = appState.isConnected; appState = { ...appState, mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null, serverState: null, lastServerState: null, isGameLoopRunning: false, isRendererReady: false, worldWidth: DEFAULT_WORLD_WIDTH, worldHeight: DEFAULT_WORLD_HEIGHT, localPlayerRadius: DEFAULT_PLAYER_RADIUS, renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, lastStateReceiveTime: performance.now(), mouseWorldPosition: new THREE.Vector3(0,0,0), localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, uiPositions: {}, currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false, }; localEffects = { muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 }, pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION }, snake: { active: false, segments: [] } }; if(DOM.chatLog) DOM.chatLog.innerHTML = ''; if(DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = '------'; if(DOM.waitingMessage) DOM.waitingMessage.textContent = ''; if(DOM.gameIdInput) DOM.gameIdInput.value = ''; DOM.countdownDiv?.classList.remove('active'); if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none'; if(DOM.temperatureIndicator) DOM.temperatureIndicator.style.display = 'none'; if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = ''; DOM.gameContainer?.classList.remove('night-mode', 'raining', 'dust-storm'); if (showMenu) { UIManager.updateStatus(currentIsConnected ? "Connected." : "Disconnected."); UIManager.showSection('main-menu-section'); } else { UIManager.updateStatus("Initializing..."); }
     }
    function startGameLoop() { if (appState.isGameLoopRunning || !appState.isRendererReady || !appState.serverState) { return; } log("Starting game loop..."); InputManager.setup(); appState.isGameLoopRunning = true; lastLoopTime = performance.now(); lastFootstepTime = 0; appState.animationFrameId = requestAnimationFrame(gameLoop); }
    function cleanupLoop() { if (appState.animationFrameId) cancelAnimationFrame(appState.animationFrameId); appState.animationFrameId = null; InputManager.cleanup(); appState.isGameLoopRunning = false; log("Game loop stopped."); }
    // SIMPLIFIED: Returns latest server state directly
    function getInterpolatedState(renderTime) {
        if (!appState.serverState) return null;
        // Return a copy to prevent accidental modification? Or trust renderer not to modify?
        // Let's return a direct reference for now, assuming renderer is read-only with it.
        // Add snake state which is purely local effect visual
        appState.serverState.snake_state = localEffects.snake;
        return appState.serverState;
    }
    // DISABLED: Not needed when rendering raw server state
    function updatePredictedPosition(deltaTime) { /* NOOP */ }
    // DISABLED: Not needed when rendering raw server state
    function reconcileWithServer() { /* NOOP */ }

    function gameLoop(currentTime) {
        if (!appState.isGameLoopRunning) { cleanupLoop(); return; }
        const now = performance.now(); if (lastLoopTime === null) lastLoopTime = now; const deltaTime = Math.min(0.1, (now - lastLoopTime) / 1000); lastLoopTime = now;

        InputManager.update(deltaTime); // Still process input for shooting, footsteps, sending movement
        if (localEffects.pushbackAnim.active && now >= localEffects.pushbackAnim.endTime) localEffects.pushbackAnim.active = false; if (localEffects.muzzleFlash.active && now >= localEffects.muzzleFlash.endTime) localEffects.muzzleFlash.active = false;

        // Prediction and Reconciliation disabled in this debug version
        // if (appState.serverState?.status === 'active') { updatePredictedPosition(deltaTime); reconcileWithServer(); }

        // Get state to render (Simplified: just the latest server state)
        const stateToRender = getInterpolatedState(now);

        if (stateToRender && appState.isRendererReady && Renderer3D.renderScene) {
            // DEBUG: Log the player position being sent to renderer
            if (stateToRender.players?.[appState.localPlayerId]) {
                 // console.log(`Rendering Player X: ${stateToRender.players[appState.localPlayerId].x.toFixed(1)}`);
            }
            Renderer3D.renderScene(stateToRender, appState, localEffects);
        }
        if (stateToRender && appState.mode !== 'menu') { UIManager.updateHtmlOverlays(); }
        if (appState.isGameLoopRunning) { appState.animationFrameId = requestAnimationFrame(gameLoop); } else { cleanupLoop(); }
    }
    function setInitialGameState(state, localId, gameId, maxPlayers) { // Stores player radius
        log("Game: Setting initial state from server."); appState.lastServerState = null; appState.serverState = state; appState.localPlayerId = localId; appState.currentGameId = gameId; appState.maxPlayersInGame = maxPlayers; appState.worldWidth = state?.world_width || DEFAULT_WORLD_WIDTH; appState.worldHeight = state?.world_height || DEFAULT_WORLD_HEIGHT; const initialPlayer = state?.players?.[localId]; appState.localPlayerRadius = initialPlayer?.radius || DEFAULT_PLAYER_RADIUS; const startX = initialPlayer?.x ?? appState.worldWidth / 2; const startY = initialPlayer?.y ?? appState.worldHeight / 2;
        // Reset positions - prediction/rendered not strictly needed in this debug version
        appState.predictedPlayerPos = { x: startX, y: startY }; appState.renderedPlayerPos = { x: startX, y: startY };
        appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };
        if (!appState.isRendererReady && DOM.canvasContainer) { log(`Game: Initializing Renderer...`); appState.isRendererReady = Renderer3D.init(DOM.canvasContainer); if (!appState.isRendererReady) { error("Renderer initialization failed in setInitialGameState!"); UIManager.updateStatus("Renderer Error!", true); } } // Init uses dynamic size
    }
    function updateServerState(newState) { // Stores player radius
        // appState.lastServerState = appState.serverState; // Not needed for non-interpolated version
        appState.serverState = newState; appState.lastStateReceiveTime = performance.now();
        // Note: No longer updating worldWidth/Height here, renderer handles dynamically
        if (newState?.players?.[appState.localPlayerId]?.radius) { appState.localPlayerRadius = newState.players[appState.localPlayerId].radius; }
        if(newState.snake_state) { localEffects.snake = newState.snake_state; } else { localEffects.snake.active = false; localEffects.snake.segments = []; }
    }
    function updateHostWaitUI(state) { const currentP = Object.keys(state?.players || {}).length; const maxP = appState.maxPlayersInGame || '?'; if (DOM.waitingMessage) DOM.waitingMessage.textContent = `Waiting... (${currentP}/${maxP} Players)`; }
    function handlePlayerChat(senderId, message) { UIManager.addChatMessage(senderId, message, false); }
    function handleEnemyChat(speakerId, message) { if (speakerId && message) UIManager.addChatMessage(speakerId, `(${message})`, true); }
    function handleDamageFeedback(newState) { // Includes sounds
         const localId = appState.localPlayerId; if (!localId) return; // Need localId but not last state
         const currP = newState?.players?.[localId];
         // Check only current state for damage sound trigger (less accurate but simpler)
         // A better way would be server sending explicit 'player_damaged' events
         // For now, let's assume server state reflects damage immediately
         // if (prevP && currP && ...) { // Old logic requiring last state }

         // Play damage sound if health is lower than some max (crude)
         // if (currP && typeof currP.health === 'number' && currP.health < 100) { SoundManager.playSound('damage', 0.8); }

         // Trigger shake based on current state flag
         if (currP?.trigger_snake_bite_shake_this_tick && Renderer3D.triggerShake) { Renderer3D.triggerShake(15.0, 400.0); }

         // Trigger ENEMY Hit Visuals/Sounds based on current state only (less accurate)
         if (newState.enemies && Renderer3D.triggerVisualHitSparks) {
             const now = performance.now();
             for (const eId in newState.enemies) {
                 const enemy = newState.enemies[eId];
                 // Check if damage happened very recently according to server time
                 if (enemy?.last_damage_time && (now - (enemy.last_damage_time * 1000) < 150) ) {
                      const enemyPos = new THREE.Vector3(enemy.x, (enemy.height / 2 || DEFAULT_PLAYER_RADIUS * 1.5), enemy.y);
                      Renderer3D.triggerVisualHitSparks(enemyPos, 5);
                      SoundManager.playSound('enemy_hit', 0.6);
                      // Check for death sound based on current health only
                      if (enemy.health <= 0) { // Need previous state to check transition accurately
                          // SoundManager.playSound('enemy_death', 0.7); // Cannot reliably detect transition here
                      }
                 }
             }
         }
         // POWERUP SOUND - Requires comparing states, cannot reliably do without lastServerState
         // if (newState.powerups && appState.lastServerState?.powerups) { ... }
    }

    return { initListeners, startGameLoop, cleanupLoop, resetClientState, setInitialGameState, updateServerState, updateHostWaitUI, handlePlayerChat, handleEnemyChat, handleDamageFeedback, sendChatMessage, triggerLocalPushback };
})();

// --- WebSocket Message Handler ---
function handleServerMessage(event) {
    let data; try { data = JSON.parse(event.data); } catch (err) { error("Failed parse WS message:", err, event.data); return; }
    // log(`<<< Received WS message Type: ${data?.type || 'UNKNOWN'}`);

    try {
        switch (data.type) {
            case 'game_created': case 'game_joined': case 'sp_game_started':
                log(`Received '${data.type}'`); if (!data.initial_state || !data.player_id || !data.game_id) { error(`'${data.type}' message missing critical data!`, data); return; }
                GameManager.resetClientState(false); GameManager.setInitialGameState(data.initial_state, data.player_id, data.game_id, data.max_players || data.initial_state?.max_players || 1);
                if (data.type === 'game_created') { if (DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR'; UIManager.updateStatus(`Hosted Game: ${appState.currentGameId}`); GameManager.updateHostWaitUI(appState.serverState); UIManager.showSection('host-wait-section'); }
                else { const joinMsg = data.type === 'game_joined' ? `Joined ${appState.currentGameId}` : "Single Player Started!"; UIManager.updateStatus(joinMsg); UIManager.showSection('game-area'); if (appState.serverState) { UIManager.updateHUD(appState.serverState); UIManager.updateCountdown(appState.serverState); UIManager.updateEnvironmentDisplay(appState.serverState); } if (appState.isRendererReady) GameManager.startGameLoop(); else error("Cannot start game loop - Renderer not ready!"); }
                break;
            case 'game_state':
                if (appState.mode === 'menu' || !appState.localPlayerId || !appState.isRendererReady || !data.state) return;
                const previousStatus = appState.serverState?.status;
                // SIMPLIFIED: Directly update serverState, no lastServerState needed here
                GameManager.updateServerState(data.state);
                const newState = appState.serverState;
                if (newState.status !== previousStatus) { log(`Game Status Change: ${previousStatus || 'N/A'} -> ${newState.status}`); if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') { UIManager.updateStatus(newState.status === 'countdown' ? "Get Ready..." : "Active!"); UIManager.showSection('game-area'); if (!appState.isGameLoopRunning) GameManager.startGameLoop(); } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') { UIManager.updateStatus("Waiting for players..."); UIManager.showSection('host-wait-section'); GameManager.updateHostWaitUI(newState); GameManager.cleanupLoop(); } else if (newState.status === 'finished' && previousStatus !== 'finished') { log("Game Over via 'finished' status."); UIManager.updateStatus("Game Over!"); UIManager.showGameOver(newState); SoundManager.playSound('death'); GameManager.cleanupLoop(); } }
                if (appState.isGameLoopRunning && (newState.status === 'countdown' || newState.status === 'active')) { UIManager.updateHUD(newState); UIManager.updateCountdown(newState); UIManager.updateEnvironmentDisplay(newState); } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') { GameManager.updateHostWaitUI(newState); }
                GameManager.handleEnemyChat(newState.enemy_speaker_id, newState.enemy_speech_text);
                GameManager.handleDamageFeedback(newState); // Damage feedback uses latest state only now
                break;
            case 'game_over_notification':
                log("Received 'game_over_notification'"); if (data.final_state) { appState.serverState = data.final_state; UIManager.updateStatus("Game Over!"); UIManager.showGameOver(data.final_state); SoundManager.playSound('death');} else { error("Game over notification missing final_state."); UIManager.showGameOver(null); }
                GameManager.cleanupLoop(); break;
            case 'chat_message': if(data.sender_id && data.message) GameManager.handlePlayerChat(data.sender_id, data.message); break;
            case 'error':
                error("Server Error:", data.message || "Unknown error"); UIManager.updateStatus(`Error: ${data.message || 'Unknown'}`, true);
                const isJoinError = appState.mode === 'multiplayer-client' && data.message && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished')); const isHostError = appState.mode === 'multiplayer-host' && data.message && data.message.includes('creation failed');
                if (isJoinError) { UIManager.showSection('join-code-section'); appState.mode = 'menu'; } else if (isHostError || (data.message && data.message.includes('Please create or join'))) { GameManager.resetClientState(true); }
                break;
            default: log(`Unknown message type: ${data.type}`);
        }
    } catch (handlerError) { error("Error processing server message:", handlerError, "Data:", data); }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded. Initializing client...");
    const essentialIds = ['gameContainer', 'loadingScreen', 'canvasContainer', 'htmlOverlay', 'mainMenuSection', 'gameArea', 'menuArea']; let missingElement = false; essentialIds.forEach(id => { if (!DOM[id]) { error(`CRITICAL: Essential DOM element missing: #${id}`); missingElement = true; } }); if (missingElement) { document.body.innerHTML = "<p style='color:red; font-size: 1.2em; text-align: center; padding: 2em;'>Error: Critical UI elements missing. Check console.</p>"; return; }
    try { GameManager.initListeners(); } catch(listenerError) { error("Error initializing listeners:", listenerError); UIManager.updateStatus("Init Error: Controls failed.", true); }
    UIManager.updateStatus("Initializing Connection..."); NetworkManager.connect(() => { log("Initial WebSocket connection successful."); });
    resizeHandler = debounce(() => { if (appState.isRendererReady && Renderer3D.handleContainerResize) { Renderer3D.handleContainerResize(); } }, RESIZE_DEBOUNCE_MS); window.addEventListener('resize', resizeHandler);
    DOM.loadingScreen?.classList.add('active'); DOM.gameContainer?.classList.remove('loaded'); UIManager.showSection('loading-screen');
    log("Client initialization sequence complete.");
});
