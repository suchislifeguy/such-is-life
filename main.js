// main.js
import Renderer3D from './Renderer3D.js';

console.log("--- main.js: Starting execution Final ---");

// --- Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws';
const SHOOT_COOLDOWN = 750; const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4;
const INPUT_SEND_INTERVAL = 33; const RECONNECT_DELAY = 3000;
const PLAYER_DEFAULTS = { width: 25, height: 48, max_health: 100, base_speed: 150 };
// ... other constants ...

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
    renderedPlayerPos: { x: 0, y: 0 }, predictedPlayerPos: { x: 0, y: 0 },
    lastServerState: null, previousServerState: null, lastLoopTime: null,
    lastStateReceiveTime: performance.now(), currentTemp: 18.0, isRaining: false,
    isDustStorm: false, targetTint: null, targetTintAlpha: 0.0,
    canvasWidth: 1600, canvasHeight: 900, // Updated by server state
    uiPositions: {}, localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
};

// --- Local Effects State ---
let localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 };
let localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
let activeSpeechBubbles = {}; // { id: { text: '', endTime: timestamp } }
let activeEnemyBubbles = {}; // { id: { text: '', endTime: timestamp } }
let socket = null;
let activeAmmoCasings = []; // { id, x, y, vx, vy, rotation, ..., spawnTime, lifetime }
let activeBloodSparkEffects = {}; // { enemyId: effectEndTime }
let snake = { // Updated by server state, passed to Renderer3D
    segmentLength: 6.0, segments: [], maxSegments: 12, frequency: 0.03, amplitude: 15.0,
    lineWidth: 3, serverHeadX: 0, serverHeadY: 0, serverBaseY: 0, isActiveFromServer: false,
    update: function(currentTime) { /* ... snake segment logic as before ... */ }
};

// Combine states needed directly by Renderer3D's update functions
let localEffects = {
    muzzleFlash: localPlayerMuzzleFlash,
    pushbackAnim: localPlayerPushbackAnim,
    activeBloodSparkEffects: activeBloodSparkEffects,
    activeAmmoCasings: activeAmmoCasings,
    snake: snake
};

// --- HTML Overlay Element Management ---
const damageTextElements = {}; const inactiveDamageTextElements = []; // Pool
const healthBarElements = {}; const inactiveHealthBarElements = []; // #TODO: Implement pooling
const speechBubbleElements = {}; const inactiveSpeechBubbleElements = []; // Pool

// --- Sound Manager ---
const SoundManager = (() => { /* ... sound manager code ... */ })();

// --- Logging Wrappers ---
function log(...args) { console.log("[Client]", ...args); } function error(...args) { console.error("[Client]", ...args); }

// --- UI Management Module ---
const UI = (() => { /* ... UI code ... */ })();

// --- Network Module ---
const Network = (() => { /* ... Network code ... */ })();

// --- Input Handling Module ---
const Input = (() => { /* ... Input code ... */ })();

// --- Game Logic & Flow Module ---
const Game = (() => {
    // ... (start/join/host/leave/chat functions) ...

    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`); cleanupLoop();
        appState = { mode: 'menu', localPlayerId: null, maxPlayersInGame: null, currentGameId: null, serverState: null, animationFrameId: null, isConnected: appState.isConnected, renderedPlayerPos: { x: 0, y: 0 }, predictedPlayerPos: { x: 0, y: 0 }, lastServerState: null, previousServerState: null, lastLoopTime: null, lastStateReceiveTime: performance.now(), currentTemp: 18.0, isRaining: false, isDustStorm: false, targetTint: null, targetTintAlpha: 0.0, canvasWidth: 1600, canvasHeight: 900, uiPositions: {}, localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, };
        localPlayerMuzzleFlash = { active: false, endTime: 0, aimDx: 0, aimDy: 0 }; localPlayerPushbackAnim = { active: false, endTime: 0, duration: 250 };
        activeSpeechBubbles = {}; activeEnemyBubbles = {}; activeAmmoCasings = []; activeBloodSparkEffects = {};
        if(typeof snake !== 'undefined'){ snake.isActiveFromServer = false; snake.segments = []; }
        DOM.chatLog.innerHTML = ''; DOM.gameCodeDisplay.textContent = '------'; DOM.gameIdInput.value = ''; if(DOM.countdownDiv) DOM.countdownDiv.style.display = 'none'; if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none'; if(DOM.gameOverScreen) DOM.gameOverScreen.style.display = 'none';
        const gridContainer = document.getElementById('player-stats-grid'); if (gridContainer) gridContainer.innerHTML = '';
        // Clear HTML overlay elements and pools
        if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = '';
        Object.keys(damageTextElements).forEach(id => delete damageTextElements[id]); inactiveDamageTextElements.length = 0;
        Object.keys(healthBarElements).forEach(id => delete healthBarElements[id]); inactiveHealthBarElements.length = 0;
        Object.keys(speechBubbleElements).forEach(id => delete speechBubbleElements[id]); inactiveSpeechBubbleElements.length = 0;
        if (typeof Renderer3D !== 'undefined') Renderer3D.cleanup();
        if (showMenu) { appState.mode = 'menu'; UI.updateStatus(appState.isConnected ? "Connected." : "Disconnected."); UI.showSection('main-menu-section'); }
    }

    // --- HTML Overlay Update Function ---
    function updateHtmlOverlays(stateToRender, appState) {
        if (!DOM.htmlOverlay || !stateToRender || !appState.uiPositions) return;
        const overlay = DOM.htmlOverlay; const now = performance.now();

        // --- Damage Text ---
        const damageTexts = stateToRender.damage_texts || {};
        const activeDamageIds = new Set();
        for (const id in damageTexts) {
            const dtData = damageTexts[id];
            const posData = appState.uiPositions[id]; // Position calculated by Renderer3D
            if (!posData) continue; activeDamageIds.add(id);
            let element = damageTextElements[id];
            if (!element) {
                element = inactiveDamageTextElements.pop() || document.createElement('div');
                element.className = 'overlay-element damage-text-overlay';
                element.style.position = 'absolute'; element.style.display = 'block';
                overlay.appendChild(element); damageTextElements[id] = element;
            }
            element.textContent = dtData.text;
            element.classList.toggle('crit', dtData.is_crit || false);
            const lifeTime = (dtData.lifetime || 0.75) * 1000;
            const spawnTime = dtData.spawn_time * 1000;
            const timeElapsed = now - spawnTime;
            const lifeProgress = Math.min(1, timeElapsed / lifeTime);
            const verticalOffset = - (lifeProgress * 50);
            element.style.left = `${posData.screenX}px`;
            element.style.top = `${posData.screenY + verticalOffset}px`;
            element.style.opacity = 1.0 - (lifeProgress * 0.8); // Fade faster
        }
        // Return unused damage text elements to pool
        for (const id in damageTextElements) {
            if (!activeDamageIds.has(id)) {
                const elementToPool = damageTextElements[id];
                elementToPool.style.display = 'none'; // Hide it
                inactiveDamageTextElements.push(elementToPool);
                delete damageTextElements[id];
            }
        }

        // --- Speech Bubbles (Players & Enemies) ---
        const allBubbles = { ...activeSpeechBubbles, ...activeEnemyBubbles }; // Combine bubbles
        const activeBubbleIds = new Set();
        const playerSpeechBubbleBg = "rgba(0, 0, 0, 0.7)"; // From original renderer
        const playerSpeechBubbleColor = "#d0d8d7";
        const enemySpeechBubbleBg = "rgba(70, 0, 0, 0.7)";
        const enemySpeechBubbleColor = "#FFAAAA";

        for (const id in allBubbles) {
             const bubbleData = allBubbles[id];
             if (now >= bubbleData.endTime) continue; // Skip expired ones early

             const posData = appState.uiPositions[id]; // Position from Renderer3D
             if (!posData) continue; // Need position data

             activeBubbleIds.add(id);
             let element = speechBubbleElements[id];
             if (!element) {
                 element = inactiveSpeechBubbleElements.pop() || document.createElement('div');
                 // Basic styling - could add classes later
                 element.style.position = 'absolute';
                 element.style.padding = '5px 8px';
                 element.style.borderRadius = '5px';
                 element.style.fontSize = '13px';
                 element.style.textAlign = 'center';
                 element.style.maxWidth = '150px';
                 element.style.wordWrap = 'break-word';
                 element.className = 'overlay-element'; // Base class
                 overlay.appendChild(element);
                 speechBubbleElements[id] = element;
             }

             element.textContent = bubbleData.text;
             element.style.display = 'block';

             // Determine background/color based on whether it's a player or enemy bubble
             const isPlayer = !!stateToRender.players[id]; // Check if ID exists in players
             element.style.backgroundColor = isPlayer ? playerSpeechBubbleBg : enemySpeechBubbleBg;
             element.style.color = isPlayer ? playerSpeechBubbleColor : enemySpeechBubbleColor;

             // Position above the entity's calculated screen pos
             const bubbleOffsetY = -45; // Adjust offset as needed
             element.style.left = `${posData.screenX}px`;
             element.style.top = `${posData.screenY + bubbleOffsetY}px`; // Offset upwards
             element.style.transform = 'translateX(-50%)'; // Center horizontally
        }
         // Return unused speech bubble elements to pool
        for (const id in speechBubbleElements) {
             if (!activeBubbleIds.has(id)) {
                 const elementToPool = speechBubbleElements[id];
                 elementToPool.style.display = 'none';
                 inactiveSpeechBubbleElements.push(elementToPool);
                 delete speechBubbleElements[id];
             }
        }

        // #TODO: Implement Health/Armor Bars using similar pooling and positioning logic
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
            if (appState.mode === 'singleplayer') { /* ... SP position update ... */
                const pState = appState.serverState?.players?.[appState.localPlayerId];
                if (pState) { appState.renderedPlayerPos.x = pState.x; appState.renderedPlayerPos.y = pState.y; }
             } else { updatePredictedPosition(deltaTime); reconcileWithServer(); }
        }

        const stateToRender = getInterpolatedState(now);

        // Render 3D Scene (Populates appState.uiPositions)
        if (stateToRender && typeof Renderer3D !== 'undefined' && appState.mode !== 'menu') {
             localEffects.activeBloodSparkEffects = activeBloodSparkEffects; // Ensure Renderer gets latest
             localEffects.activeAmmoCasings = activeAmmoCasings;
             localEffects.snake = snake;
             Renderer3D.renderScene(stateToRender, appState, localEffects);
        } else if (appState.mode !== 'menu') { log("Skipping render..."); }

        // Update HTML Overlays using calculated positions
        if (stateToRender && appState.mode !== 'menu') {
             updateHtmlOverlays(stateToRender, appState);
        }

        if (appState.mode !== 'menu' && appState.isConnected && !appState.serverState?.game_over) {
             appState.animationFrameId = requestAnimationFrame(gameLoop);
        } else { if(appState.animationFrameId) cleanupLoop(); }
    }

    // ... (startGameLoop, getInterpolatedState, cleanupLoop, prediction, reconciliation - same) ...
    function getInterpolatedState(renderTime) { /* ... unchanged ... */ }
    function cleanupLoop() { /* ... unchanged ... */ }
    function updatePredictedPosition(deltaTime) { /* ... unchanged ... */ }
    function reconcileWithServer() { /* ... unchanged ... */ }
    function initListeners() { /* ... unchanged ... */ }

    return {
        startSinglePlayer, joinMultiplayer, hostMultiplayer, leaveGame, sendChatMessage,
        resetClientState, startGameLoop, cleanupLoop, getInterpolatedState, initListeners
    };
})();

// --- Global Server Message Handler ---
function handleServerMessage(event) {
    let data; try { data = JSON.parse(event.data); } catch (err) { error("Failed to parse msg:", err, event.data); return; }
    try {
        if (typeof Renderer3D === 'undefined' && ['sp_game_started', 'game_joined', 'game_state', 'game_created', 'game_over_notification'].includes(data.type)) { error(`Received '${data.type}' before Renderer3D!`); return; }
        switch (data.type) {
            case 'game_created': case 'game_joined': case 'sp_game_started':
                log(`Received '${data.type}'`); appState.localPlayerId = data.player_id; appState.currentGameId = data.game_id; appState.serverState = data.initial_state; appState.maxPlayersInGame = data.max_players || appState.serverState?.max_players || (data.type === 'sp_game_started' ? 1 : '?');
                if (data.initial_state && typeof data.initial_state.canvas_width === 'number') { appState.canvasWidth = data.initial_state.canvas_width; appState.canvasHeight = data.initial_state.canvas_height; } else { error(`Initial state ('${data.type}') missing canvas dimensions! Using defaults.`); }
                const initialPlayer = appState.serverState?.players[appState.localPlayerId];
                if (initialPlayer) { appState.predictedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y }; appState.renderedPlayerPos = { x: initialPlayer.x, y: initialPlayer.y }; }
                else { appState.predictedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 }; appState.renderedPlayerPos = { x: appState.canvasWidth / 2, y: appState.canvasHeight / 2 }; }
                appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 };
                if (data.type === 'game_created') { /* ... UI setup for host wait ... */
                    DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR'; const currentP = Object.keys(appState.serverState?.players || {}).length; DOM.waitingMessage.textContent = `Waiting... (${currentP}/${appState.maxPlayersInGame})`; UI.updateStatus(`Hosted: ${appState.currentGameId}`); UI.showSection('host-wait-section');
                } else { /* ... UI setup for joined/SP ... */
                     UI.updateStatus(data.type === 'game_joined' ? `Joined game ${appState.currentGameId}.` : "Single Player Started!"); UI.showSection('game-area');
                     if (appState.serverState) { UI.updateHUD(appState.serverState); UI.updateCountdown(appState.serverState); UI.updateDayNight(appState.serverState); UI.updateEnvironmentDisplay(); }
                     Game.startGameLoop();
                }
                break;
            case 'game_state':
                if (appState.mode === 'menu') return;
                const previousStatus = appState.serverState?.status; const previousPlayerState = appState.serverState?.players?.[appState.localPlayerId];
                appState.previousServerState = appState.lastServerState; appState.lastServerState = appState.serverState; appState.serverState = data.state;
                const newState = appState.serverState; const currentPlayerState = newState?.players?.[appState.localPlayerId]; appState.lastStateReceiveTime = performance.now();
                if (newState && typeof newState.canvas_width === 'number' && (appState.canvasWidth !== newState.canvas_width || appState.canvasHeight !== newState.canvas_height)) { appState.canvasWidth = newState.canvas_width; appState.canvasHeight = newState.canvas_height; /* Renderer handles resize internally */ }
                appState.currentTemp = newState.current_temperature ?? 18.0; appState.isRaining = newState.is_raining ?? false; appState.isDustStorm = newState.is_dust_storm ?? false;
                const serverSnakeState = newState.snake_state;
                if (serverSnakeState && typeof snake !== 'undefined') { snake.isActiveFromServer = serverSnakeState.active; snake.serverHeadX = serverSnakeState.head_x; snake.serverHeadY = serverSnakeState.head_y; snake.serverBaseY = serverSnakeState.base_y; if (snake.isActiveFromServer && snake.segments.length === 0) { snake.segments = [{ x: snake.serverHeadX, y: snake.serverHeadY, time: performance.now() }]; } else if (!snake.isActiveFromServer) { snake.segments = []; } }
                else if (typeof snake !== 'undefined') { snake.isActiveFromServer = false; snake.segments = []; }
                if (newState.enemies) { /* ... Blood spark update logic ... */
                    const now = performance.now(); const sparkDuration = 300;
                    for (const enemyId in newState.enemies) { const enemy = newState.enemies[enemyId]; const previousEnemy = appState.lastServerState?.enemies?.[enemyId]; if (enemy && enemy.last_damage_time && (!previousEnemy || enemy.last_damage_time > (previousEnemy.last_damage_time || 0))) { const serverHitTimeMs = enemy.last_damage_time * 1000; if (now - serverHitTimeMs < 200) activeBloodSparkEffects[enemyId] = now + sparkDuration; } }
                    for (const enemyId in activeBloodSparkEffects) { if (now >= activeBloodSparkEffects[enemyId]) delete activeBloodSparkEffects[enemyId]; }
                }
                let localPlayerDamagedThisTick = false;
                if (previousPlayerState && currentPlayerState && typeof currentPlayerState.health === 'number' && typeof previousPlayerState.health === 'number' && currentPlayerState.health < previousPlayerState.health) { const damageTaken = previousPlayerState.health - currentPlayerState.health; const baseMag = 5; const dmgScale = 0.18; const maxMag = 18; const shakeMagnitude = Math.min(maxMag, baseMag + damageTaken * dmgScale); if (typeof Renderer3D !== 'undefined') Renderer3D.triggerShake(shakeMagnitude, 250); localPlayerDamagedThisTick = true; }
                if (localPlayerDamagedThisTick) SoundManager.playSound('damage');
                if (currentPlayerState?.trigger_snake_bite_shake_this_tick) { const shakeMag = snake?.shakeMagnitude ?? 15.0; const shakeDur = snake?.shakeDurationMs ?? 400.0; if(typeof Renderer3D !== 'undefined') Renderer3D.triggerShake(shakeMag, shakeDur); }
                if (newState.status !== previousStatus) { /* ... Status change handling ... */
                    log(`[Client State Change] From ${previousStatus || 'null'} to ${newState.status}`);
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') { UI.updateStatus(newState.status === 'countdown' ? "Countdown..." : "Game active!"); UI.showSection('game-area'); if (!appState.animationFrameId) Game.startGameLoop(); }
                    else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') { /* Host wait UI update */ }
                    else if (newState.status === 'finished' && previousStatus !== 'finished') { log("-> Game Over via 'finished' status."); Game.cleanupLoop(); UI.showGameOver(newState); }
                }
                if (appState.animationFrameId && (newState.status === 'countdown' || newState.status === 'active')) { /* HUD updates */ UI.updateHUD(newState); UI.updateCountdown(newState); UI.updateDayNight(newState); UI.updateEnvironmentDisplay(); }
                else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') { /* Update waiting count */ }
                const speakerId = newState.enemy_speaker_id; const speechText = newState.enemy_speech_text; if (speakerId && speechText) activeEnemyBubbles[speakerId] = { text: speechText.substring(0, 50), endTime: performance.now() + 3000 };
                break;
            case 'game_over_notification': /* ... unchanged ... */ break;
            case 'chat_message': /* ... unchanged ... */ break;
            case 'error': /* ... unchanged ... */ break;
            default: log(`Unknown message type: ${data.type}`);
        }
    } catch (handlerError) { error("Error in handleServerMessage:", handlerError, "Data:", data); }
}

// --- DOMContentLoaded Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded.");
    if (typeof Renderer3D === 'undefined') { error("CRITICAL: Renderer3D not defined!"); UI.updateStatus("Init Error: Renderer failed.", true); return; }
    if (DOM.canvasContainer) { if (!Renderer3D.init(DOM.canvasContainer)) { error("Renderer3D initialization failed!"); UI.updateStatus("Init Error: Graphics failed.", true); return; } log("Renderer3D initialized."); }
    else { error("Canvas container not found!"); UI.updateStatus("Init Error: UI missing.", true); return; }
    try { Game.initListeners(); log("Button listeners initialized."); }
    catch(listenerError) { error("Error initializing listeners:", listenerError); UI.updateStatus("Init Error: Controls failed.", true); return; }
    UI.updateStatus("Initializing Connection...");
    Network.connect(() => { /* Success handled internally */ });
});
