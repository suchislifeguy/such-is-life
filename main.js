// main.js - Client Application Logic (2D Renderer Integration)

console.log("--- main.js: Initializing Client (2D Renderer) ---");

// Assuming renderer.js is loaded and Renderer is globally available
// If using modules: import Renderer from './renderer.js';

const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
// const WEBSOCKET_URL = 'ws://localhost:8765/ws';
const SHOOT_COOLDOWN = 100;
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33;
const RECONNECT_DELAY = 3000;
const DEFAULT_WORLD_WIDTH = 1600;
const DEFAULT_WORLD_HEIGHT = 900;
const INTERPOLATION_BUFFER_MS = 100;
const SPEECH_BUBBLE_DURATION_MS = 4000;
const ENEMY_SPEECH_BUBBLE_DURATION_MS = 3000;
const PUSHBACK_ANIM_DURATION_MS = 250;
const MUZZLE_FLASH_DURATION_MS = 75;
const BLOOD_SPARK_DURATION_MS = 300;
const RESIZE_DEBOUNCE_MS = 150;
const FOOTSTEP_INTERVAL_MS = 350;
const SHOOT_VOLUME = 0.6;
const FOOTSTEP_VOLUME = 0.4;
const UI_CLICK_VOLUME = 0.7;

const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

let DOM = {};
let mainCtx = null; // Main 2D rendering context

let appState = {
    mode: 'menu',
    localPlayerId: null,
    currentGameId: null,
    maxPlayersInGame: null,
    serverState: null,
    lastServerState: null,
    lastStateReceiveTime: 0,
    animationFrameId: null,
    isConnected: false,
    isGameLoopRunning: false,
    worldWidth: DEFAULT_WORLD_WIDTH,
    worldHeight: DEFAULT_WORLD_HEIGHT,
    renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
    predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
    mouseCanvasPosition: { x: 0, y: 0 },
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
    currentTemp: 18.0,
    isRaining: false,
    isDustStorm: false,
    isNight: false,
    // For canvas renderer effects
    activeBloodSparkEffects: {}, // { entityId: endTime }
    activePlayerSpeechBubbles: {}, // { playerId: { text, endTime } }
    activeEnemySpeechBubbles: {},  // { enemyId: { text, endTime } }
};

let localEffects = {
    muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 },
    pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION_MS },
};

let socket = null;
let reconnectTimer = null;
let lastLoopTime = 0;
let resizeHandler = null;
let lastFootstepTime = 0;

const SoundManager = (() => {
    let audioContext = null; let gainNode = null; let loadedSounds = {};
    let soundFiles = {
        'shoot': 'assets/sounds/shoot.mp3', 'damage': 'assets/sounds/damage.mp3',
        'powerup': 'assets/sounds/powerup.mp3', 'death': 'assets/sounds/death.mp3',
        'enemy_hit': 'assets/sounds/enemy_hit.mp3', 'enemy_death': 'assets/sounds/enemy_death.mp3',
        'ui_click': 'assets/sounds/ui_click.mp3', 'footstep': 'assets/sounds/footstep.mp3',
    };
    let isInitialized = false; let canPlaySound = false; let isMuted = false;

    function init() {
        if (isInitialized) return;
        isInitialized = true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { error("[SM] Web Audio API not supported."); return; }
            audioContext = new AC();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            const resumeAudio = () => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(() => { log("[SM] Audio Resumed."); canPlaySound = true; loadSounds(); })
                                .catch(e => error("[SM] Resume failed:", e));
                }
                document.removeEventListener('click', resumeAudio); document.removeEventListener('keydown', resumeAudio);
            };
            if (audioContext.state === 'suspended') {
                document.addEventListener('click', resumeAudio, { once: true });
                document.addEventListener('keydown', resumeAudio, { once: true });
            } else if (audioContext.state === 'running') { canPlaySound = true; loadSounds(); }
        } catch (e) { error("[SM] Init error:", e); }
    }
    function loadSounds() {
        if (!audioContext || !canPlaySound) return;
        const promises = Object.entries(soundFiles).map(([name, path]) =>
            fetch(path).then(r => r.ok ? r.arrayBuffer() : Promise.reject(`HTTP ${r.status} loading ${path}`))
                .then(b => audioContext.decodeAudioData(b)).then(decodedBuffer => { loadedSounds[name] = decodedBuffer; })
                .catch(e => { error(`[SM] Load/Decode '${name}' (${path}) error:`, e); })
        );
        Promise.allSettled(promises).then(() => log("[SM] Sound loading finished."));
    }
    function playSound(name, volume = 1.0) {
        if (!canPlaySound || !audioContext || !gainNode || audioContext.state !== 'running') return;
        const buffer = loadedSounds[name];
        if (!buffer) { console.warn(`[SM] Sound not loaded: ${name}`); return; }
        if (isMuted && name !== 'ui_click') return;
        try {
            const source = audioContext.createBufferSource(); source.buffer = buffer;
            const soundGain = audioContext.createGain();
            soundGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime);
            source.connect(soundGain).connect(gainNode); source.start(0);
            source.onended = () => { try { source.disconnect(); soundGain.disconnect(); } catch(e){} };
        } catch (e) { error(`[SM] Play '${name}' error:`, e); }
    }
    function toggleMute() {
        isMuted = !isMuted;
        if (gainNode) gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext?.currentTime || 0);
        if (DOM.muteBtn) {
            DOM.muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
            DOM.muteBtn.setAttribute('aria-pressed', String(isMuted));
            DOM.muteBtn.classList.toggle('muted', isMuted);
        }
    }
    function getMuteState() { return isMuted; }
    return { init, playSound, toggleMute, getMuteState };
})();

const UIManager = (() => {
    let allMenuSections = [];
    function init() {
         allMenuSections = [
            DOM.mainMenuSection, DOM.multiplayerMenuSection,
            DOM.hostWaitSection, DOM.joinCodeSection
        ];
    }
    function showSection(sectionId) {
        DOM.menuArea?.classList.add('hidden');
        allMenuSections.forEach(s => s?.classList.remove('active'));
        DOM.gameArea?.classList.remove('active');
        DOM.gameOverScreen?.classList.remove('active');
        const sectionToShow = DOM[sectionId] || document.getElementById(sectionId);
        if (sectionToShow) {
            sectionToShow.classList.add('active');
            if (sectionToShow.closest('#menu-area')) {
                DOM.menuArea?.classList.remove('hidden');
            }
        } else {
            error(`UI: Section not found: ${sectionId}`);
            DOM.mainMenuSection?.classList.add('active'); DOM.menuArea?.classList.remove('hidden');
        }
    }
    function updateStatus(message, isError = false) {
        if (!DOM.gameStatus) return;
        DOM.gameStatus.textContent = message;
        DOM.gameStatus.style.color = isError ? (getCssVar('--color-danger') || 'red') : (getCssVar('--color-accent') || 'yellow');
    }
    function updateHUD(serverState) {
        if (!DOM.playerStatsGrid || !serverState?.players || !appState.localPlayerId) {
            if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = ''; return;
        }
        const players = serverState.players; const localId = appState.localPlayerId;
        DOM.playerStatsGrid.innerHTML = '';
        const sortedPlayerIds = Object.keys(players).sort((a, b) => {
            if (a === localId) return -1; if (b === localId) return 1; return a.localeCompare(b);
        });
        sortedPlayerIds.forEach(pId => {
            const pData = players[pId]; if (!pData) return;
            const isSelf = (pId === localId);
            const header = isSelf ? "YOU" : `P:${pId.substring(0, 4)}`;
            const status = pData.player_status || PLAYER_STATUS_ALIVE;
            let healthDisplay;
            if (status === PLAYER_STATUS_DOWN) healthDisplay = `<span style='color: var(--color-down-status, orange);'>DOWN</span>`;
            else if (status === PLAYER_STATUS_DEAD || pData.health <= 0) healthDisplay = `<span style='color: var(--color-dead-status, grey);'>DEAD</span>`;
            else {
                const hp = pData.health ?? 0; let color = 'var(--color-health-high)';
                if (hp < 66) color = 'var(--color-health-medium)'; if (hp < 33) color = 'var(--color-health-low)';
                healthDisplay = `<span style='color:${color};'>${hp.toFixed(0)}</span>`;
            }
            const armor = pData.armor ?? 0; let armorDisplay = String(Math.round(armor));
            if(armor > 0) armorDisplay = `<span style='color: var(--color-armor, lightblue);'>${armorDisplay}</span>`;
            const ammoTypeDisplay = (pData.active_ammo_type === 'standard' ? 'Std' : pData.active_ammo_type?.split('_').pop().toUpperCase()) || 'Std';
            const box = document.createElement('div'); box.className = 'stats-box';
            box.innerHTML = `
                <div class="stats-header">${header}</div>
                <div class="stats-content">
                    <span>HP:</span> ${healthDisplay}<br><span>Armor:</span> ${armorDisplay}<br>
                    <span>Gun:</span> ${pData.gun ?? 1}<br><span>Speed:</span> ${pData.speed ? pData.speed.toFixed(0) : '-'}<br>
                    <span>Ammo:</span> ${ammoTypeDisplay}<br><span>Kills:</span> ${pData.kills ?? 0}<br>
                    <span>Score:</span> ${pData.score ?? 0}
                </div>`;
            DOM.playerStatsGrid.appendChild(box);
        });
    }
    function addChatMessage(senderId, message, isSystem = false) {
        if (!DOM.chatLog) return;
        const div = document.createElement('div'); const isSelf = senderId === appState.localPlayerId;
        let senderName = isSystem ? 'System' : (isSelf ? 'You' : `P:${senderId ? senderId.substring(0, 4) : '???'}`);
        div.classList.add('chat-message', isSystem ? 'system-message' : (isSelf ? 'my-message' : 'other-message'));
        div.textContent = isSystem ? message : `${senderName}: ${message}`;
        DOM.chatLog.appendChild(div); DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight;
    }
    function updateCountdown(serverState) {
        if (!DOM.countdownDiv) return;
        const isCountdown = serverState?.status === 'countdown' && serverState?.countdown >= 0;
        if (isCountdown) {
            DOM.countdownDiv.textContent = String(Math.ceil(serverState.countdown));
            DOM.countdownDiv.classList.add('active');
        } else { DOM.countdownDiv.classList.remove('active'); }
    }
    function updateEnvironmentDisplay(serverState) {
        if (!DOM.dayNightIndicator || !DOM.temperatureIndicator || !DOM.gameContainer) return;
        if (serverState?.status === 'active' || serverState?.status === 'countdown') {
            const isNight = serverState.is_night ?? false; appState.isNight = isNight;
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day';
            DOM.dayNightIndicator.style.display = 'block';
            DOM.gameContainer.classList.toggle('night-mode', isNight);
            appState.currentTemp = serverState.current_temperature ?? 18.0;
            appState.isRaining = serverState.is_raining ?? false;
            appState.isDustStorm = serverState.is_dust_storm ?? false;
            DOM.temperatureIndicator.textContent = `${appState.currentTemp.toFixed(0)}°C`;
            DOM.temperatureIndicator.style.display = 'block';
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
        let statsHtml = "---";
        if (player) {
            statsHtml = `<div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div>
                         <div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>`;
        }
        DOM.finalStatsDiv.innerHTML = statsHtml; showSection('gameOverScreen');
    }
    return { init, showSection, updateStatus, updateHUD, addChatMessage, updateCountdown, updateEnvironmentDisplay, showGameOver };
})();

const NetworkManager = (() => {
    function connect(onOpenCallback) {
        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
            if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); return;
        }
        clearTimeout(reconnectTimer); UIManager.updateStatus('Connecting...');
        try { socket = new WebSocket(WEBSOCKET_URL); }
        catch (err) { error("WS creation failed:", err); UIManager.updateStatus('Connection failed.', true); return; }

        socket.onopen = () => {
            log('WS open.'); appState.isConnected = true;
            DOM.loadingScreen?.classList.remove('active'); DOM.gameContainer?.classList.add('loaded');
            UIManager.updateStatus('Connected.');
            if (!appState.localPlayerId) UIManager.showSection('mainMenuSection');
            if (onOpenCallback) onOpenCallback();
        };
        socket.onmessage = handleServerMessage;
        socket.onerror = (event) => { error('WS Error:', event); };
        socket.onclose = (event) => {
            error(`WS Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`);
            const wasConnected = appState.isConnected; appState.isConnected = false; socket = null;
            GameManager.cleanupLoop();
            if (appState.mode !== 'menu') GameManager.resetClientState(false);
            if (event.code === 1000 || event.code === 1001 || event.code === 1005) {
                UIManager.updateStatus('Disconnected.'); UIManager.showSection('mainMenuSection');
            } else if (wasConnected) {
                UIManager.updateStatus('Connection lost. Retrying...', true); scheduleReconnect();
            } else { UIManager.updateStatus('Connection failed.', true); UIManager.showSection('mainMenuSection'); }
        };
    }
    function scheduleReconnect() {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
            connect(() => { UIManager.updateStatus('Reconnected.'); UIManager.showSection('mainMenuSection'); });
        }, RECONNECT_DELAY);
    }
    function sendMessage(payload) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify(payload)); }
            catch (err) { error("Send error:", err, payload); }
        }
    }
    function closeConnection(code = 1000, reason = "User action") {
        clearTimeout(reconnectTimer);
        if (socket && socket.readyState === WebSocket.OPEN) socket.close(code, reason);
        socket = null; appState.isConnected = false;
    }
    return { connect, sendMessage, closeConnection };
})();

const InputManager = (() => {
    let keys = {}; let lastShotTime = 0; let inputInterval = null;
    let isMouseDown = false; let isRightMouseDown = false;

    function preventContextMenu(event) { if (DOM.gameCanvas?.contains(event.target)) event.preventDefault(); }
    function setup() {
        cleanup();
        document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp);
        DOM.chatInput?.addEventListener('keydown', handleChatEnter);
        DOM.gameCanvas?.addEventListener('mousemove', handleMouseMove);
        DOM.gameCanvas?.addEventListener('mousedown', handleMouseDown);
        DOM.gameCanvas?.addEventListener('contextmenu', preventContextMenu);
        document.addEventListener('mouseup', handleMouseUp);
        inputInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL);
    }
    function cleanup() {
        document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput?.removeEventListener('keydown', handleChatEnter);
        DOM.gameCanvas?.removeEventListener('mousemove', handleMouseMove);
        DOM.gameCanvas?.removeEventListener('mousedown', handleMouseDown);
        DOM.gameCanvas?.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('mouseup', handleMouseUp);
        clearInterval(inputInterval); inputInterval = null;
        keys = {}; isMouseDown = false; isRightMouseDown = false; appState.mouseCanvasPosition = {x:0, y:0};
    }
    function handleMouseMove(event) {
        if (!DOM.gameCanvas || !appState.isGameLoopRunning) return;
        const rect = DOM.gameCanvas.getBoundingClientRect();
        appState.mouseCanvasPosition.x = event.clientX - rect.left;
        appState.mouseCanvasPosition.y = event.clientY - rect.top;
    }
    function handleMouseDown(event) {
        if (document.activeElement === DOM.chatInput) return;
        if (event.button === 0) isMouseDown = true;
        else if (event.button === 2) { isRightMouseDown = true; event.preventDefault(); triggerPushbackCheck(); }
    }
    function handleMouseUp(event) {
        if (event.button === 0) isMouseDown = false;
        if (event.button === 2) isRightMouseDown = false;
    }
    function handleKeyDown(event) {
        if (document.activeElement === DOM.chatInput) return;
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            if (!keys[key]) keys[key] = true; event.preventDefault();
        }
        if (key === ' ' && !keys[' ']) { keys[' '] = true; handleShooting(); event.preventDefault(); }
        if (key === 'e' && !keys['e']) { keys['e'] = true; triggerPushbackCheck(); event.preventDefault(); }
    }
    function handleKeyUp(event) {
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) keys[key] = false;
    }
    function handleChatEnter(event) { if (event.key === 'Enter') { event.preventDefault(); GameManager.sendChatMessage(); } }
    function getMovementInputVector() {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1; if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1; if (keys['d'] || keys['arrowright']) dx += 1;
        if (dx !== 0 && dy !== 0) { const factor = Math.SQRT1_2; dx *= factor; dy *= factor; }
        return { dx, dy };
    }
    function sendMovementInput() {
        if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'player_move', direction: getMovementInputVector() });
        }
    }
    function triggerPushbackCheck() {
        if (appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) {
            GameManager.triggerLocalPushback();
        }
    }
    function handleShooting() {
        if (!appState.serverState || !appState.localPlayerId || appState.serverState.status !== 'active') return;
        const playerState = appState.serverState.players?.[appState.localPlayerId];
        if (!playerState || playerState.player_status !== PLAYER_STATUS_ALIVE) return;

        const nowTimestamp = Date.now();
        const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire';
        const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier;
        if (nowTimestamp - lastShotTime < actualCooldown) return;
        lastShotTime = nowTimestamp;

        const playerPredictX = appState.predictedPlayerPos.x;
        const playerPredictY = appState.predictedPlayerPos.y;
        const mouseTarget = appState.mouseCanvasPosition;
        let aimDx = mouseTarget.x - playerPredictX;
        let aimDy = mouseTarget.y - playerPredictY;
        const magSq = aimDx * aimDx + aimDy * aimDy;
        if (magSq > 0.01) { const mag = Math.sqrt(magSq); aimDx /= mag; aimDy /= mag; }
        else { aimDx = 0; aimDy = -1; }

        appState.localPlayerAimState.lastAimDx = aimDx;
        appState.localPlayerAimState.lastAimDy = aimDy;

        localEffects.muzzleFlash.active = true;
        localEffects.muzzleFlash.endTime = performance.now() + MUZZLE_FLASH_DURATION_MS;
        localEffects.muzzleFlash.aimDx = aimDx; localEffects.muzzleFlash.aimDy = aimDy;
        SoundManager.playSound('shoot', SHOOT_VOLUME);
        NetworkManager.sendMessage({ type: 'player_shoot', target: mouseTarget });
    }
    function update() {
        if (keys[' ']) handleShooting(); if (isMouseDown) handleShooting();
        const isMoving = (keys['w']||keys['a']||keys['s']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright']);
        const player = appState.serverState?.players?.[appState.localPlayerId];
        if (isMoving && player?.player_status === PLAYER_STATUS_ALIVE) {
            const now = performance.now();
            if (now - lastFootstepTime > FOOTSTEP_INTERVAL_MS) { SoundManager.playSound('footstep', FOOTSTEP_VOLUME); lastFootstepTime = now; }
        }
    }
    return { setup, cleanup, update, getMovementInputVector };
})();

const GameManager = (() => {
    let isInitialized = false;
    function initListeners() {
        if (isInitialized) return;
        DOM.singlePlayerBtn?.addEventListener('click', () => { SoundManager.init(); startSinglePlayer(); });
        DOM.multiplayerBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection('multiplayerMenuSection'); });
        const hostHandler = (maxP) => { SoundManager.init(); hostMultiplayer(maxP); };
        DOM.hostGameBtn2?.addEventListener('click', () => hostHandler(2));
        DOM.hostGameBtn3?.addEventListener('click', () => hostHandler(3));
        DOM.hostGameBtn4?.addEventListener('click', () => hostHandler(4));
        DOM.showJoinUIBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection('joinCodeSection'); });
        DOM.joinGameSubmitBtn?.addEventListener('click', () => { SoundManager.init(); joinMultiplayer(); });
        DOM.cancelHostBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); leaveGame(); });
        DOM.sendChatBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); sendChatMessage(); });
        DOM.leaveGameBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); leaveGame(); });
        DOM.gameOverBackBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); resetClientState(true); });
        DOM.muteBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); SoundManager.toggleMute(); });
        DOM.backButtons.forEach(btn => {
            const targetId = btn.dataset.target;
            const targetElement = DOM[targetId.replace(/-([a-z])/g, g => g[1].toUpperCase())] || document.getElementById(targetId);
            if (targetId && targetElement) {
                btn.addEventListener('click', (e) => { e.preventDefault(); SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection(targetId); });
            }
        });
        if(DOM.muteBtn) { const muted = SoundManager.getMuteState(); DOM.muteBtn.textContent = muted ? 'Unmute' : 'Mute'; DOM.muteBtn.setAttribute('aria-pressed', String(muted)); DOM.muteBtn.classList.toggle('muted', muted); }
        isInitialized = true;
    }
    function startSinglePlayer() {
        appState.mode = 'singleplayer'; UIManager.updateStatus("Starting Single Player...");
        NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'start_single_player' }));
    }
    function joinMultiplayer() {
        const gameId = DOM.gameIdInput?.value.trim().toUpperCase();
        if (!gameId || gameId.length !== 6) { UIManager.updateStatus('Invalid Game ID (6 chars).', true); return; }
        appState.mode = 'multiplayer-client'; UIManager.updateStatus(`Joining game ${gameId}...`);
        NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'join_game', game_id: gameId }));
    }
    function hostMultiplayer(maxPlayers) {
        if (![2,3,4].includes(maxPlayers)) { UIManager.updateStatus("Invalid player count.", true); return; }
        appState.mode = 'multiplayer-host'; UIManager.updateStatus(`Creating ${maxPlayers}p game...`);
        NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'create_game', max_players: maxPlayers }));
    }
    function leaveGame() {
        if (appState.isConnected && appState.currentGameId && appState.localPlayerId) NetworkManager.sendMessage({ type: 'leave_game' });
        NetworkManager.closeConnection(1000, "User left game"); resetClientState(true);
    }
    function sendChatMessage() {
        const message = DOM.chatInput?.value.trim();
        if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'player_chat', message: message });
            if(DOM.chatInput) DOM.chatInput.value = '';
        }
    }
    function triggerLocalPushback() {
        localEffects.pushbackAnim.active = true;
        localEffects.pushbackAnim.endTime = performance.now() + localEffects.pushbackAnim.duration;
        NetworkManager.sendMessage({ type: 'player_pushback' });
    }
    function resetClientState(showMenu = true) {
        cleanupLoop();
        if (mainCtx && DOM.gameCanvas) mainCtx.clearRect(0,0, DOM.gameCanvas.width, DOM.gameCanvas.height);

        const currentIsConnected = appState.isConnected;
        appState = {
            ...appState, mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null,
            serverState: null, lastServerState: null, isGameLoopRunning: false,
            worldWidth: DEFAULT_WORLD_WIDTH, worldHeight: DEFAULT_WORLD_HEIGHT,
            renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
            predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
            lastStateReceiveTime: performance.now(),
            mouseCanvasPosition: { x: 0, y: 0 },
            localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
            currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false,
            activeBloodSparkEffects: {}, activePlayerSpeechBubbles: {}, activeEnemySpeechBubbles: {},
        };
        localEffects = { muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 }, pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION_MS }};

        if(DOM.chatLog) DOM.chatLog.innerHTML = '';
        if(DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = '------';
        if(DOM.waitingMessage) DOM.waitingMessage.textContent = '';
        if(DOM.gameIdInput) DOM.gameIdInput.value = '';
        DOM.countdownDiv?.classList.remove('active');
        if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none';
        if(DOM.temperatureIndicator) DOM.temperatureIndicator.style.display = 'none';
        if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = '';
        DOM.gameContainer?.classList.remove('night-mode', 'raining', 'dust-storm');

        if (showMenu) {
            UIManager.updateStatus(currentIsConnected ? "Connected." : "Disconnected.");
            UIManager.showSection('mainMenuSection');
        } else UIManager.updateStatus("Initializing...");
    }
    function startGameLoop() {
        if (appState.isGameLoopRunning || !mainCtx || !appState.serverState) return;
        InputManager.setup(); appState.isGameLoopRunning = true;
        lastLoopTime = performance.now(); lastFootstepTime = 0;
        appState.animationFrameId = requestAnimationFrame(gameLoop);
    }
    function cleanupLoop() {
        if (appState.animationFrameId) cancelAnimationFrame(appState.animationFrameId);
        appState.animationFrameId = null; InputManager.cleanup(); appState.isGameLoopRunning = false;
    }
    function getInterpolatedState(renderTime) {
        const serverState = appState.serverState; const lastState = appState.lastServerState;
        if (!serverState) return null;
        if (!lastState || !serverState.timestamp || !lastState.timestamp || serverState.timestamp <= lastState.timestamp) {
            let currentStateCopy = JSON.parse(JSON.stringify(serverState));
            if (currentStateCopy.players?.[appState.localPlayerId]) {
                currentStateCopy.players[appState.localPlayerId].x = appState.renderedPlayerPos.x;
                currentStateCopy.players[appState.localPlayerId].y = appState.renderedPlayerPos.y;
            }
            return currentStateCopy;
        }
        const serverTime = serverState.timestamp * 1000; const lastServerTime = lastState.timestamp * 1000;
        const timeBetweenStates = serverTime - lastServerTime;
        if (timeBetweenStates <= 0) return serverState;
        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS;
        const timeSinceLastState = renderTargetTime - lastServerTime;
        let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates));
        let interpolatedState = JSON.parse(JSON.stringify(serverState));

        if (interpolatedState.players) {
            for (const pId in interpolatedState.players) {
                const currentP = serverState.players[pId]; const lastP = lastState.players?.[pId];
                if (pId === appState.localPlayerId) {
                    interpolatedState.players[pId].x = appState.renderedPlayerPos.x;
                    interpolatedState.players[pId].y = appState.renderedPlayerPos.y;
                } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number') {
                    interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t);
                    interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t);
                }
            }
        }
        if (interpolatedState.enemies) {
            for (const eId in interpolatedState.enemies) {
                const currentE = serverState.enemies[eId]; const lastE = lastState.enemies?.[eId];
                if (lastE && currentE.health > 0 && lastE.health > 0 && typeof currentE.x === 'number' && typeof lastE.x === 'number') {
                    interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t);
                    interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t);
                }
            }
        }
        if (interpolatedState.bullets) {
            for (const bId in interpolatedState.bullets) {
                const currentB = serverState.bullets[bId]; const lastB = lastState.bullets?.[bId];
                if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number') {
                    interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t);
                    interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t);
                }
            }
        }
        return interpolatedState;
    }
    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const playerState = appState.serverState.players[appState.localPlayerId];
        if (playerState.player_status !== PLAYER_STATUS_ALIVE) return;
        const moveVector = InputManager.getMovementInputVector();
        const playerSpeed = playerState?.speed ?? 150;
        if (moveVector.dx !== 0 || moveVector.dy !== 0) {
            appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime;
            appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime;
        }
        const playerWidth = playerState?.width ?? 25; // Use actual player width for clamping
        const radius = playerWidth / 2;
        appState.predictedPlayerPos.x = Math.max(radius, Math.min(appState.worldWidth - radius, appState.predictedPlayerPos.x));
        appState.predictedPlayerPos.y = Math.max(radius, Math.min(appState.worldHeight - radius, appState.predictedPlayerPos.y));
    }
    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const serverPlayerState = appState.serverState.players[appState.localPlayerId];
        if (typeof serverPlayerState.x !== 'number' || typeof serverPlayerState.y !== 'number') return;
        const serverPos = { x: serverPlayerState.x, y: serverPlayerState.y };
        const predictedPos = appState.predictedPlayerPos; const renderedPos = appState.renderedPlayerPos;
        const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);
        const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35;
        const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15;
        if (dist > snapThreshold * 1.5) {
            predictedPos.x = serverPos.x; predictedPos.y = serverPos.y;
            renderedPos.x = serverPos.x; renderedPos.y = serverPos.y;
        } else {
            renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor);
            renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor);
            if (dist > 1.0) {
                predictedPos.x = lerp(predictedPos.x, serverPos.x, 0.05);
                predictedPos.y = lerp(predictedPos.y, serverPos.y, 0.05);
            }
        }
    }
    function gameLoop(currentTime) {
        if (!appState.isGameLoopRunning) { cleanupLoop(); return; }
        const now = performance.now(); if (lastLoopTime === null) lastLoopTime = now;
        const deltaTime = Math.min(0.1, (now - lastLoopTime) / 1000); lastLoopTime = now;

        InputManager.update();
        if (localEffects.pushbackAnim.active && now >= localEffects.pushbackAnim.endTime) localEffects.pushbackAnim.active = false;
        if (localEffects.muzzleFlash.active && now >= localEffects.muzzleFlash.endTime) localEffects.muzzleFlash.active = false;

        if (appState.serverState?.status === 'active') {
            updatePredictedPosition(deltaTime); reconcileWithServer();
        }

        const stateToRender = getInterpolatedState(now);
        if (mainCtx && stateToRender && appState.mode !== 'menu' && Renderer.drawGame) {
            Renderer.drawGame(
                mainCtx, appState, stateToRender,
                localEffects.muzzleFlash, localEffects.pushbackAnim,
                appState.activeBloodSparkEffects,
                appState.activePlayerSpeechBubbles,
                appState.activeEnemySpeechBubbles,
                appState.worldWidth, appState.worldHeight
            );
        }
        if (appState.isGameLoopRunning) appState.animationFrameId = requestAnimationFrame(gameLoop);
        else cleanupLoop();
    }
    function setInitialGameState(state, localId, gameId, maxPlayers) {
        appState.lastServerState = null; appState.serverState = state;
        appState.localPlayerId = localId; appState.currentGameId = gameId; appState.maxPlayersInGame = maxPlayers;
        appState.worldWidth = state?.canvas_width || DEFAULT_WORLD_WIDTH; // Use canvas_width from server
        appState.worldHeight = state?.canvas_height || DEFAULT_WORLD_HEIGHT; // Use canvas_height from server

        const initialPlayer = state?.players?.[localId];
        const startX = initialPlayer?.x ?? appState.worldWidth / 2;
        const startY = initialPlayer?.y ?? appState.worldHeight / 2;
        appState.predictedPlayerPos = { x: startX, y: startY };
        appState.renderedPlayerPos = { x: startX, y: startY };
        appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };

        if (DOM.gameCanvas) { // Resize existing canvas if necessary
            DOM.gameCanvas.width = appState.worldWidth;
            DOM.gameCanvas.height = appState.worldHeight;
        }
        if (Renderer.updateGeneratedBackground) {
            Renderer.updateGeneratedBackground(state?.is_night || false, appState.worldWidth, appState.worldHeight);
        }
    }
    function updateServerState(newState) {
        appState.lastServerState = appState.serverState; appState.serverState = newState;
        appState.lastStateReceiveTime = performance.now();
        if (newState?.canvas_width && newState?.canvas_height && (appState.worldWidth !== newState.canvas_width || appState.worldHeight !== newState.canvas_height)) {
            appState.worldWidth = newState.canvas_width; appState.worldHeight = newState.canvas_height;
            if (DOM.gameCanvas) { DOM.gameCanvas.width = appState.worldWidth; DOM.gameCanvas.height = appState.worldHeight; }
            if (Renderer.updateGeneratedBackground) Renderer.updateGeneratedBackground(newState.is_night, appState.worldWidth, appState.worldHeight);
        }
        appState.isNight = newState.is_night; // Keep appState.isNight updated for renderer background
        appState.isRaining = newState.is_raining;
        appState.isDustStorm = newState.is_dust_storm;
        appState.currentTemp = newState.current_temperature;

        // Manage active enemy speech bubbles
        if (newState.enemy_speaker_id && newState.enemy_speech_text) {
            appState.activeEnemySpeechBubbles[newState.enemy_speaker_id] = {
                text: newState.enemy_speech_text,
                endTime: performance.now() + ENEMY_SPEECH_BUBBLE_DURATION_MS
            };
        }
        // Clean up expired speech bubbles (can be done less frequently too)
        const now = performance.now();
        for (const id in appState.activePlayerSpeechBubbles) if (now >= appState.activePlayerSpeechBubbles[id].endTime) delete appState.activePlayerSpeechBubbles[id];
        for (const id in appState.activeEnemySpeechBubbles) if (now >= appState.activeEnemySpeechBubbles[id].endTime) delete appState.activeEnemySpeechBubbles[id];
    }
    function updateHostWaitUI(state) {
        const currentP = Object.keys(state?.players || {}).length;
        const maxP = appState.maxPlayersInGame || '?';
        if (DOM.waitingMessage) DOM.waitingMessage.textContent = `Waiting... (${currentP}/${maxP} Players)`;
    }
    function handlePlayerChat(senderId, message) {
        UIManager.addChatMessage(senderId, message, false);
        appState.activePlayerSpeechBubbles[senderId] = { text: message, endTime: performance.now() + SPEECH_BUBBLE_DURATION_MS };
    }
    function handleDamageFeedback(newState) {
        const localId = appState.localPlayerId;
        if (!localId || !appState.lastServerState) return;
        const prevP = appState.lastServerState?.players?.[localId];
        const currP = newState?.players?.[localId];
        if (prevP && currP && typeof currP.health === 'number' && typeof prevP.health === 'number' && currP.health < prevP.health) {
            const dmg = prevP.health - currP.health;
            if (Renderer.triggerShake) Renderer.triggerShake(Math.min(18, 5 + dmg * 0.2), 250);
            SoundManager.playSound('damage', 0.8);
        }
        if (newState.enemies) {
            const now = performance.now();
            for (const eId in newState.enemies) {
                const enemy = newState.enemies[eId];
                const prevE = appState.lastServerState?.enemies?.[eId];
                if (enemy?.last_damage_time && (!prevE || enemy.last_damage_time > (prevE.last_damage_time || 0))) {
                    if (now - (enemy.last_damage_time * 1000) < 150) {
                        appState.activeBloodSparkEffects[eId] = now + BLOOD_SPARK_DURATION_MS;
                        SoundManager.playSound('enemy_hit', 0.6);
                        if (enemy.health <= 0 && prevE && prevE.health > 0) SoundManager.playSound('enemy_death', 0.7);
                    }
                }
            }
        }
        if (newState.powerups && appState.lastServerState?.powerups) {
            const currentIds = new Set(Object.keys(newState.powerups));
            const lastIds = new Set(Object.keys(appState.lastServerState.powerups));
            lastIds.forEach(id => { if (!currentIds.has(id)) SoundManager.playSound('powerup', 0.9); });
        }
    }
    return { initListeners, startGameLoop, cleanupLoop, resetClientState, setInitialGameState, updateServerState, updateHostWaitUI, handlePlayerChat, handleDamageFeedback, sendChatMessage, triggerLocalPushback };
})();

function handleServerMessage(event) {
    let data;
    try { data = JSON.parse(event.data); }
    catch (err) { error("Failed parse WS message:", err, event.data); return; }
    try {
        switch (data.type) {
            case 'game_created': case 'game_joined': case 'sp_game_started':
                if (!data.initial_state || !data.player_id || !data.game_id) {
                    error(`'${data.type}' message missing critical data!`, data); UIManager.updateStatus("Join/Start Error!", true); return;
                }
                GameManager.resetClientState(false);
                GameManager.setInitialGameState(data.initial_state, data.player_id, data.game_id, data.initial_state.max_players || data.max_players || 1);

                if (data.type === 'game_created') {
                    if (DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR';
                    UIManager.updateStatus(`Hosted Game: ${appState.currentGameId}`);
                    GameManager.updateHostWaitUI(appState.serverState);
                    UIManager.showSection('hostWaitSection');
                } else {
                    const joinMsg = data.type === 'game_joined' ? `Joined ${appState.currentGameId}` : "Single Player Started!";
                    UIManager.updateStatus(joinMsg); UIManager.showSection('gameArea');
                    if (appState.serverState) {
                        UIManager.updateHUD(appState.serverState);
                        UIManager.updateCountdown(appState.serverState);
                        UIManager.updateEnvironmentDisplay(appState.serverState);
                    }
                    if (mainCtx) GameManager.startGameLoop(); else error("Cannot start game loop - mainCtx not ready!");
                }
                break;
            case 'game_state':
                if (appState.mode === 'menu' || !appState.localPlayerId || !mainCtx || !data.state) return;
                const previousStatus = appState.serverState?.status;
                GameManager.updateServerState(data.state); const newState = appState.serverState;
                if (newState.status !== previousStatus) {
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') {
                        UIManager.updateStatus(newState.status === 'countdown' ? "Get Ready..." : "Active!");
                        UIManager.showSection('gameArea');
                        if (!appState.isGameLoopRunning) GameManager.startGameLoop();
                    } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') {
                        UIManager.updateStatus("Waiting for players..."); UIManager.showSection('hostWaitSection');
                        GameManager.updateHostWaitUI(newState); GameManager.cleanupLoop();
                    } else if (newState.status === 'finished' && previousStatus !== 'finished') {
                        UIManager.updateStatus("Game Over!"); UIManager.showGameOver(newState);
                        SoundManager.playSound('death'); GameManager.cleanupLoop();
                    }
                }
                if (appState.isGameLoopRunning && (newState.status === 'countdown' || newState.status === 'active')) {
                    UIManager.updateHUD(newState); UIManager.updateCountdown(newState); UIManager.updateEnvironmentDisplay(newState);
                } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') {
                    GameManager.updateHostWaitUI(newState);
                }
                GameManager.handleDamageFeedback(newState);
                break;
            case 'game_over_notification':
                if (data.final_state) {
                    appState.serverState = data.final_state; UIManager.updateStatus("Game Over!");
                    UIManager.showGameOver(data.final_state); SoundManager.playSound('death');
                } else { UIManager.showGameOver(null); }
                GameManager.cleanupLoop();
                break;
            case 'chat_message':
                if(data.sender_id && data.message) GameManager.handlePlayerChat(data.sender_id, data.message);
                break;
            case 'error':
                error("Server Error:", data.message || "Unknown error");
                UIManager.updateStatus(`Error: ${data.message || 'Unknown'}`, true);
                const isJoinError = appState.mode === 'multiplayer-client' && data.message && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'));
                const isHostError = appState.mode === 'multiplayer-host' && data.message && data.message.includes('creation failed');
                if (isJoinError) { UIManager.showSection('joinCodeSection'); appState.mode = 'menu'; }
                else if (isHostError || (data.message && data.message.includes('Please create or join'))) GameManager.resetClientState(true);
                break;
            default: log(`Unknown message type: ${data.type}`);
        }
    } catch (handlerError) { error("Error processing server message:", handlerError, "Data:", data); }
}

document.addEventListener('DOMContentLoaded', () => {
    DOM = {
        loadingScreen: document.getElementById('loading-screen'), gameContainer: document.getElementById('game-container'),
        topBar: document.getElementById('top-bar'), gameStatus: document.getElementById('game-status'),
        menuArea: document.getElementById('menu-area'), mainMenuSection: document.getElementById('main-menu-section'),
        multiplayerMenuSection: document.getElementById('multiplayer-menu-section'), hostWaitSection: document.getElementById('host-wait-section'),
        joinCodeSection: document.getElementById('join-code-section'), gameArea: document.getElementById('game-area'),
        statsPanel: document.getElementById('stats-panel'), playerStatsGrid: document.getElementById('player-stats-grid'),
        environmentInfo: document.getElementById('environment-info'), dayNightIndicator: document.getElementById('day-night-indicator'),
        temperatureIndicator: document.getElementById('temperature-indicator'), gameControls: document.querySelector('#stats-panel .game-controls'),
        muteBtn: document.getElementById('muteBtn'), leaveGameBtn: document.getElementById('leaveGameBtn'),
        canvasContainer: document.getElementById('canvas-container'), // Container for the canvas
        countdownDiv: document.getElementById('countdown-overlay'),
        // htmlOverlay: document.getElementById('html-overlay'), // No longer primary for game elements
        chatPanel: document.getElementById('chat-panel'), chatLog: document.getElementById('chat-log'),
        chatInput: document.getElementById('chatInput'), sendChatBtn: document.getElementById('sendChatBtn'),
        gameOverScreen: document.getElementById('game-over-screen'), finalStatsDiv: document.getElementById('final-stats'),
        singlePlayerBtn: document.getElementById('singlePlayerBtn'), multiplayerBtn: document.getElementById('multiplayerBtn'),
        hostGameBtn2: document.getElementById('hostGameBtn2'), hostGameBtn3: document.getElementById('hostGameBtn3'),
        hostGameBtn4: document.getElementById('hostGameBtn4'), showJoinUIBtn: document.getElementById('showJoinUIBtn'),
        cancelHostBtn: document.getElementById('cancelHostBtn'), gameCodeDisplay: document.getElementById('game-code-display'),
        waitingMessage: document.getElementById('waiting-message'), gameIdInput: document.getElementById('gameIdInput'),
        joinGameSubmitBtn: document.getElementById('joinGameSubmitBtn'), gameOverBackBtn: document.getElementById('gameOverBackBtn'),
        backButtons: document.querySelectorAll('.button-back'),
    };

    const essentialIds = ['canvasContainer', 'mainMenuSection', 'gameArea', 'menuArea'];
    let missingElement = false;
    essentialIds.forEach(id => {
        const camelCaseId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
        if (!DOM[camelCaseId]) { error(`CRITICAL: DOM element missing: #${id}`); missingElement = true; }
    });
    if (missingElement) { document.body.innerHTML = "<p style='color:red;'>Error: Critical UI elements missing.</p>"; return; }

    // Create and setup the main game canvas
    if (DOM.canvasContainer) {
        DOM.gameCanvas = document.createElement('canvas');
        DOM.gameCanvas.id = 'gameCanvas2D';
        DOM.gameCanvas.width = appState.worldWidth;
        DOM.gameCanvas.height = appState.worldHeight;
        DOM.canvasContainer.appendChild(DOM.gameCanvas);
        mainCtx = DOM.gameCanvas.getContext('2d');
        if (!mainCtx) { error("Failed to get 2D context for main canvas!"); return; }
    } else { error("Canvas container not found!"); return; }

    UIManager.init();
    try { GameManager.initListeners(); }
    catch(listenerError) { error("Error initializing listeners:", listenerError); UIManager.updateStatus("Init Error: Controls failed.", true); }

    resizeHandler = debounce(() => {
        if (DOM.gameCanvas && DOM.canvasContainer) {
            const newWidth = DOM.canvasContainer.clientWidth;
            const newHeight = DOM.canvasContainer.clientHeight;
            DOM.gameCanvas.width = newWidth;
            DOM.gameCanvas.height = newHeight;
            appState.worldWidth = newWidth;
            appState.worldHeight = newHeight;
            if (Renderer.updateGeneratedBackground && appState.serverState) { // Also check serverState to get is_night
                Renderer.updateGeneratedBackground(appState.serverState.is_night, newWidth, newHeight);
            } else if (Renderer.updateGeneratedBackground) { // Fallback if no serverState yet
                 Renderer.updateGeneratedBackground(false, newWidth, newHeight);
            }
        }
    }, RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', resizeHandler);
    resizeHandler(); // Initial call to set size

    UIManager.showSection('loadingScreen');
    DOM.loadingScreen?.classList.add('active'); DOM.gameContainer?.classList.remove('loaded');
    UIManager.updateStatus("Initializing Connection...");
    NetworkManager.connect(() => { log("Initial WebSocket connection successful."); });
    log("Client initialization sequence complete.");
});
