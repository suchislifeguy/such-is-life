// main.js - Client Application Logic v4.1 (DOM Fix)

import * as THREE from 'three'; // Required for Vector3, Raycaster etc.
import Renderer3D from './Renderer3D.js';

console.log("--- main.js: Initializing Client ---");

// --- Constants ---
const WEBSOCKET_URL = 'wss://such-is-life.glitch.me/ws'; // Production Glitch URL
// const WEBSOCKET_URL = 'ws://localhost:8765/ws'; // Local Dev URL
const SHOOT_COOLDOWN = 100; // Base milliseconds between shots
const RAPID_FIRE_COOLDOWN_MULTIPLIER = 0.4; // Multiplier for rapid fire ammo
const INPUT_SEND_INTERVAL = 33; // Milliseconds between sending input updates (approx 30hz)
const RECONNECT_DELAY = 3000; // Milliseconds before attempting reconnect
const DEFAULT_WORLD_WIDTH = 1600; // Default world size if not provided by server
const DEFAULT_WORLD_HEIGHT = 900;
const DEFAULT_PLAYER_RADIUS = 12; // Should match server PLAYER_DEFAULTS['radius']
const INTERPOLATION_BUFFER_MS = 100; // Delay rendering to allow interpolation
const SPEECH_BUBBLE_DURATION_MS = 4000; // How long player speech bubbles last
const ENEMY_SPEECH_BUBBLE_DURATION_MS = 3000; // How long enemy speech bubbles last
const PUSHBACK_ANIM_DURATION = 250; // Duration of visual pushback effect
const MUZZLE_FLASH_DURATION = 75; // Duration of muzzle flash visual effect
const RESIZE_DEBOUNCE_MS = 150; // Debounce window resize events
const FOOTSTEP_INTERVAL_MS = 350; // Time between footstep sounds when moving
const SHOOT_VOLUME = 0.6;
const FOOTSTEP_VOLUME = 0.4;
const UI_CLICK_VOLUME = 0.7;

const PLAYER_STATUS_ALIVE = 'alive';
const PLAYER_STATUS_DOWN = 'down';
const PLAYER_STATUS_DEAD = 'dead';

// --- Utility Functions ---
function getCssVar(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || ''; }
function lerp(start, end, amount) { const t = Math.max(0, Math.min(1, amount)); return start + (end - start) * t; }
function distance(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }
function log(...args) { console.log("[Client]", ...args); }
function error(...args) { console.error("[Client]", ...args); }

// --- DOM Element Cache ---
// **DECLARED HERE, POPULATED INSIDE DOMContentLoaded**
let DOM = {};

// --- Application State ---
// Holds all client-side state information
let appState = {
    mode: 'menu', // 'menu', 'singleplayer', 'multiplayer-host', 'multiplayer-client'
    localPlayerId: null,
    currentGameId: null,
    maxPlayersInGame: null,
    serverState: null, // Latest authoritative state from server
    lastServerState: null, // Previous state for interpolation
    lastStateReceiveTime: 0, // Timestamp when last state was received
    animationFrameId: null, // ID for requestAnimationFrame loop
    isConnected: false, // WebSocket connection status
    isGameLoopRunning: false, // Is the main game loop active?
    isRendererReady: false, // Has the 3D renderer been initialized?
    worldWidth: DEFAULT_WORLD_WIDTH,
    worldHeight: DEFAULT_WORLD_HEIGHT,
    localPlayerRadius: DEFAULT_PLAYER_RADIUS,
    // --- Player Prediction & Reconciliation ---
    renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, // Smoothed position for rendering
    predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 }, // Position predicted based on input
    // --- Input & Aiming ---
    mouseWorldPosition: new THREE.Vector3(0, 0, 0), // Mouse position projected onto 3D ground
    localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 }, // Last calculated aim direction
    // --- UI & Environment ---
    uiPositions: {}, // Screen coordinates for overlay elements { entityId: { screenX, screenY } }
    currentTemp: 18.0,
    isRaining: false,
    isDustStorm: false,
    isNight: false,
};

// --- Local Client-Side Effects ---
// Manages visual effects triggered locally (not directly from server state)
let localEffects = {
    muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 },
    pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION },
    // Snake state is now primarily driven by server state, but keep structure if needed later
    snake: { active: false, segments: [] } // Client might reconstruct visual segments here if needed
};

// --- Overlay Element Pooling ---
// Reuses DOM elements for overlays to improve performance
const overlayElementPools = {
    damageText: { elements: {}, inactive: [] }, // { id: element } / [element, ...]
    speechBubble: { elements: {}, inactive: [] },
};

// --- Network & Timers ---
let socket = null;
let reconnectTimer = null;
let lastLoopTime = 0; // For calculating deltaTime in game loop
let resizeHandler = null; // Debounced resize handler
let lastFootstepTime = 0; // Timer for footstep sounds

// Reusable THREE vector for world position mapping in UI updates
const _mappedWorldPos = new THREE.Vector3();


// === Sound Manager Module ===
const SoundManager = (() => {
    let audioContext = null; let gainNode = null; let loadedSounds = {};
    // Sound asset paths (relative to index.html)
    let soundFiles = {
        'shoot': 'assets/sounds/shoot.mp3',
        'damage': 'assets/sounds/damage.mp3',
        'powerup': 'assets/sounds/powerup.mp3',
        'death': 'assets/sounds/death.mp3',
        'enemy_hit': 'assets/sounds/enemy_hit.mp3',
        'enemy_death': 'assets/sounds/enemy_death.mp3',
        'ui_click': 'assets/sounds/ui_click.mp3',
        'footstep': 'assets/sounds/footstep.mp3',
        // Add more sounds here: 'snake_bite', 'giant_stomp', etc.
    };
    let isInitialized = false; let canPlaySound = false; let isMuted = false;

    // Initialize AudioContext on first user interaction
    function init() {
        if (isInitialized) return;
        isInitialized = true;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { error("[SM] Web Audio API not supported."); return; }
            audioContext = new AC();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);

            // Resume audio context if suspended (required by browsers)
            const resumeAudio = () => {
                if (audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        log("[SM] Audio Resumed."); canPlaySound = true; loadSounds();
                    }).catch(e => error("[SM] Resume failed:", e));
                }
                // Clean up listeners after first interaction
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
            };

            if (audioContext.state === 'suspended') {
                log("[SM] Audio suspended. Waiting for user interaction.");
                document.addEventListener('click', resumeAudio, { once: true });
                document.addEventListener('keydown', resumeAudio, { once: true });
            } else if (audioContext.state === 'running') {
                canPlaySound = true; loadSounds(); // Load sounds immediately if context is running
            }
        } catch (e) { error("[SM] Init error:", e); }
    }

    // Load all sound files asynchronously
    function loadSounds() {
        if (!audioContext || !canPlaySound) return;
        log("[SM] Loading sounds...");
        const promises = Object.entries(soundFiles).map(([name, path]) =>
            fetch(path)
                .then(r => r.ok ? r.arrayBuffer() : Promise.reject(`HTTP ${r.status} loading ${path}`))
                .then(b => audioContext.decodeAudioData(b)) // Decode audio data
                .then(decodedBuffer => { loadedSounds[name] = decodedBuffer; })
                .catch(e => { error(`[SM] Load/Decode '${name}' (${path}) error:`, e); })
        );
        Promise.allSettled(promises).then(() => log("[SM] Sound loading finished."));
    }

    // Play a loaded sound
    function playSound(name, volume = 1.0) {
        // Check if sound can be played (initialized, context running, not muted for game sounds)
        if (!canPlaySound || !audioContext || !gainNode || audioContext.state !== 'running') return;
        const buffer = loadedSounds[name];
        if (!buffer) { console.warn(`[SM] Sound not loaded or decoded: ${name}`); return; }
        if (isMuted && name !== 'ui_click') return; // Allow UI clicks even when muted

        try {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            const soundGain = audioContext.createGain(); // Create gain node per sound for individual volume control
            soundGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime);
            source.connect(soundGain).connect(gainNode); // Connect source -> soundGain -> mainGain -> destination
            source.start(0); // Play immediately
            // Clean up nodes after sound finishes to prevent memory leaks
            source.onended = () => { try { source.disconnect(); soundGain.disconnect(); } catch(e){} };
        } catch (e) { error(`[SM] Play '${name}' error:`, e); }
    }

    // Toggle mute state
    function toggleMute() {
        isMuted = !isMuted;
        if (gainNode) gainNode.gain.setValueAtTime(isMuted ? 0 : 1, audioContext?.currentTime || 0); // Set main gain
        log(`[SM] Sound ${isMuted ? 'Muted' : 'Unmuted'}`);
        // Update mute button UI (Check if DOM.muteBtn exists first)
        if (DOM.muteBtn) {
            DOM.muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
            DOM.muteBtn.setAttribute('aria-pressed', isMuted);
            DOM.muteBtn.classList.toggle('muted', isMuted);
        }
    }

    function getMuteState() { return isMuted; }

    return { init, playSound, toggleMute, getMuteState };
})();


// === UI Manager Module ===
const UIManager = (() => {
    // List of all menu sections for easy hiding/showing
    let allMenuSections = []; // Populated in init

    function init() { // Call this after DOM is populated
         allMenuSections = [
            DOM.mainMenuSection, DOM.multiplayerMenuSection,
            DOM.hostWaitSection, DOM.joinCodeSection
        ];
    }

    // Show a specific UI section (menu, game area, game over)
    function showSection(sectionId) {
        // Hide all potential main areas first
        DOM.menuArea?.classList.add('hidden');
        allMenuSections.forEach(s => s?.classList.remove('active'));
        DOM.gameArea?.classList.remove('active');
        DOM.gameOverScreen?.classList.remove('active');

        const sectionToShow = DOM[sectionId] || document.getElementById(sectionId); // Use cached DOM if available
        if (sectionToShow) {
            sectionToShow.classList.add('active');
            // If the section is part of the menu area, make the menu area visible
            if (sectionToShow.closest('#menu-area')) {
                DOM.menuArea?.classList.remove('hidden');
            }
        } else {
            error(`UI: Section not found: ${sectionId}`);
            // Fallback: show main menu if requested section is invalid
            DOM.mainMenuSection?.classList.add('active');
            DOM.menuArea?.classList.remove('hidden');
        }
    }

    // Update the persistent game status message bar
    function updateStatus(message, isError = false) {
        if (!DOM.gameStatus) return;
        DOM.gameStatus.textContent = message;
        // Use CSS variables for colors, fallback to defaults
        DOM.gameStatus.style.color = isError
            ? (getCssVar('--color-danger') || 'red')
            : (getCssVar('--color-accent') || 'yellow');
    }

    // Update the Heads-Up Display (Player Stats Grid)
    function updateHUD(serverState) {
        if (!DOM.playerStatsGrid || !serverState?.players || !appState.localPlayerId) {
            if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = ''; // Clear grid if data invalid
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

        // Create stat box for each player
        sortedPlayerIds.forEach(pId => {
            const pData = players[pId];
            if (!pData) return; // Skip if player data is missing (shouldn't happen)

            const isSelf = (pId === localId);
            const header = isSelf ? "YOU" : `P:${pId.substring(0, 4)}`; // Shorten opponent IDs
            const status = pData.player_status || PLAYER_STATUS_ALIVE;

            // Determine health display based on status and value
            let healthDisplay;
            if (status === PLAYER_STATUS_DOWN) {
                healthDisplay = `<span style='color: var(--color-down-status, orange);'>DOWN</span>`;
            } else if (status === PLAYER_STATUS_DEAD || pData.health <= 0) {
                healthDisplay = `<span style='color: var(--color-dead-status, grey);'>DEAD</span>`;
            } else {
                const hp = pData.health ?? 0;
                let color = 'var(--color-health-high)'; // Default high health color
                if (hp < 66) color = 'var(--color-health-medium)';
                if (hp < 33) color = 'var(--color-health-low)';
                healthDisplay = `<span style='color:${color};'>${hp.toFixed(0)}</span>`;
            }

            // Format armor display
            const armor = pData.armor ?? 0;
            let armorDisplay = Math.round(armor);
            if(armor > 0) armorDisplay = `<span style='color: var(--color-armor, lightblue);'>${armorDisplay}</span>`;

            // Build HTML for the stat box
            const box = document.createElement('div');
            box.className = 'stats-box';
            // Include active ammo type display
            const ammoTypeDisplay = (pData.active_ammo_type === 'standard' ? 'Std' : pData.active_ammo_type?.split('_').pop().toUpperCase()) || 'Std';
            box.innerHTML = `
                <div class="stats-header">${header}</div>
                <div class="stats-content">
                    <span>HP:</span> ${healthDisplay}<br>
                    <span>Armor:</span> ${armorDisplay}<br>
                    <span>Gun:</span> ${pData.gun ?? 1}<br>
                    <span>Speed:</span> ${pData.speed ? pData.speed.toFixed(0) : '-'}<br>
                    <span>Ammo:</span> ${ammoTypeDisplay}<br>
                    <span>Kills:</span> ${pData.kills ?? 0}<br>
                    <span>Score:</span> ${pData.score ?? 0}
                </div>
            `;
            DOM.playerStatsGrid.appendChild(box);
        });
    }

    // Add a message to the chat log
    function addChatMessage(senderId, message, isSystem = false) {
        if (!DOM.chatLog) return;
        const div = document.createElement('div');
        const isSelf = senderId === appState.localPlayerId;

        // Determine sender name display
        let senderName = 'System';
        if (!isSystem) {
            senderName = isSelf ? 'You' : `P:${senderId ? senderId.substring(0, 4) : '???'}`;
        }

        // Add appropriate CSS classes for styling
        div.classList.add('chat-message',
            isSystem ? 'system-message' : (isSelf ? 'my-message' : 'other-message')
        );
        div.textContent = isSystem ? message : `${senderName}: ${message}`;
        DOM.chatLog.appendChild(div);
        DOM.chatLog.scrollTop = DOM.chatLog.scrollHeight; // Auto-scroll to bottom
    }

    // Update the countdown overlay display
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

    // Update environment indicators (Day/Night, Temp) and container classes
    function updateEnvironmentDisplay(serverState) {
        if (!DOM.dayNightIndicator || !DOM.temperatureIndicator || !DOM.gameContainer) return;

        if (serverState?.status === 'active' || serverState?.status === 'countdown') {
            const isNight = serverState.is_night ?? false;
            appState.isNight = isNight; // Store locally for potential other uses
            DOM.dayNightIndicator.textContent = isNight ? 'Night' : 'Day';
            DOM.dayNightIndicator.style.display = 'block';
            DOM.gameContainer.classList.toggle('night-mode', isNight); // Apply night mode class

            appState.currentTemp = serverState.current_temperature ?? 18.0;
            appState.isRaining = serverState.is_raining ?? false;
            appState.isDustStorm = serverState.is_dust_storm ?? false;
            DOM.temperatureIndicator.textContent = `${appState.currentTemp.toFixed(0)}°C`;
            DOM.temperatureIndicator.style.display = 'block';
            // Apply weather classes for potential visual effects (handled by CSS/Renderer)
            DOM.gameContainer.classList.toggle('raining', appState.isRaining);
            DOM.gameContainer.classList.toggle('dust-storm', appState.isDustStorm);
        } else {
            // Hide indicators and remove classes if game not active/countdown
            DOM.dayNightIndicator.style.display = 'none';
            DOM.temperatureIndicator.style.display = 'none';
            DOM.gameContainer.classList.remove('night-mode', 'raining', 'dust-storm');
            appState.isNight = false; appState.isRaining = false; appState.isDustStorm = false;
        }
    }

    // Display the game over screen with final stats
    function showGameOver(finalState) {
        if (!DOM.finalStatsDiv || !DOM.gameOverScreen) return;
        const player = finalState?.players?.[appState.localPlayerId];
        let statsHtml = "---"; // Default text if stats unavailable
        if (player) {
            // Format final stats display
            statsHtml = `
                <div class="final-stat-item"><strong>Score:</strong> ${player.score ?? 0}</div>
                <div class="final-stat-item"><strong>Kills:</strong> ${player.kills ?? 0}</div>
            `;
            // Add more stats here if needed (e.g., time survived)
        }
        DOM.finalStatsDiv.innerHTML = statsHtml;
        log("UI: Showing game over screen.");
        showSection('gameOverScreen'); // Show the game over section
    }

    // Update HTML overlays (damage text, speech bubbles) based on screen positions
    function updateHtmlOverlays() {
        if (!DOM.htmlOverlay || !appState.serverState || !appState.uiPositions) return;

        const overlay = DOM.htmlOverlay;
        const now = performance.now();
        const pools = overlayElementPools;
        const state = appState.serverState;
        const uiPos = appState.uiPositions; // Screen positions calculated by Renderer3D
        const activeElements = { damageText: new Set(), speechBubble: new Set() };

        // Helper to get or create an overlay element from the pool
        const getElement = (poolName, id, className) => {
            const pool = pools[poolName];
            let el = pool.elements[id];
            if (!el) { // Element doesn't exist for this ID
                el = pool.inactive.pop(); // Try to reuse an inactive element
                if (!el) { // If no inactive elements, create a new one
                    el = document.createElement('div');
                    overlay.appendChild(el);
                } else { // Reused element: make it visible
                    el.style.display = 'block';
                }
                pool.elements[id] = el; // Add to active elements map
                el.className = className; // Apply CSS class
            }
            return el;
        };

        // Helper to release an element back into the inactive pool
        const releaseElement = (poolName, id) => {
            const pool = pools[poolName];
            const el = pool.elements[id];
            if (el) {
                el.style.display = 'none'; // Hide element
                el.textContent = ''; // Clear content
                el.className = ''; // Remove classes
                pool.inactive.push(el); // Add to inactive list
                delete pool.elements[id]; // Remove from active map
            }
        };

        // --- Update Damage Texts ---
        if (state.damage_texts) {
            for (const id in state.damage_texts) {
                const dtData = state.damage_texts[id];
                const posData = uiPos[id]; // Get pre-calculated screen position
                if (!posData) continue; // Skip if position not available

                activeElements.damageText.add(id); // Mark this ID as active
                const element = getElement('damageText', id, 'overlay-element damage-text-overlay');
                element.textContent = dtData.text;
                element.classList.toggle('crit', dtData.is_crit || false); // Add crit class if needed

                // Calculate animation progress for fading/rising effect
                const lifeTime = (dtData.lifetime || 0.75) * 1000;
                const spawnTime = dtData.spawn_time * 1000; // Server timestamp
                const elapsed = now - spawnTime;
                const progress = Math.min(1, elapsed / lifeTime);
                const verticalOffset = -(progress * 50); // Text rises over time

                // Set element position and opacity
                element.style.left = `${posData.screenX}px`;
                element.style.top = `${posData.screenY + verticalOffset}px`;
                element.style.opacity = Math.max(0, 1.0 - (progress * 0.9)).toFixed(2); // Fade out
            }
        }
        // Release inactive damage text elements
        for (const id in pools.damageText.elements) {
            if (!activeElements.damageText.has(id)) releaseElement('damageText', id);
        }

        // --- Update Speech Bubbles ---
        const currentBubbles = {}; // Collect active speech bubbles for this frame
        // Player speech bubbles (sent individually in player state)
        if (state.players) {
            Object.entries(state.players).forEach(([id, pData]) => {
                if (pData?.speechBubble) { // Check if player has a speech bubble object
                    currentBubbles[id] = { ...pData.speechBubble, source: 'player' };
                }
            });
        }
        // Enemy speech bubble (sent as top-level fields)
        if (state.enemy_speaker_id && state.enemy_speech_text) {
            currentBubbles[state.enemy_speaker_id] = {
                text: state.enemy_speech_text,
                endTime: now + ENEMY_SPEECH_BUBBLE_DURATION_MS, // Server doesn't send duration, use client constant
                source: 'enemy'
            };
        }

        // Process active speech bubbles
        for(const id in currentBubbles) {
            const bubbleData = currentBubbles[id];
            const posData = uiPos[id]; // Get screen position for the speaker
            if (!posData) continue; // Skip if speaker not visible/projected

            // Skip expired player bubbles (server manages enemy bubble duration via presence)
            if (bubbleData.source === 'player' && bubbleData.endTime && now > bubbleData.endTime) continue;

            activeElements.speechBubble.add(id); // Mark as active
            const element = getElement('speechBubble', id, 'overlay-element speech-bubble');
            element.textContent = bubbleData.text.substring(0, 50); // Limit length
            const yOffset = -60; // Position above the entity's head
            element.style.left = `${posData.screenX}px`;
            element.style.top = `${posData.screenY + yOffset}px`;
            element.style.opacity = 1.0; // Assume full opacity while active
        }
        // Release inactive speech bubble elements
        for (const id in pools.speechBubble.elements) {
            if (!activeElements.speechBubble.has(id)) releaseElement('speechBubble', id);
        }
    }

    // Public methods exposed by the UIManager module
    return {
        init, // Expose init function
        showSection, updateStatus, updateHUD, addChatMessage,
        updateCountdown, updateEnvironmentDisplay, showGameOver, updateHtmlOverlays
    };
})();


// === Network Manager Module ===
const NetworkManager = (() => {
    // Attempt to establish WebSocket connection
    function connect(onOpenCallback) {
        // Avoid reconnecting if already connected or connecting
        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
            if (socket.readyState === WebSocket.OPEN && onOpenCallback) onOpenCallback(); // Already open, call callback
            return;
        }
        clearTimeout(reconnectTimer); // Clear any pending reconnect attempts
        UIManager.updateStatus('Connecting...');
        log("WS connect:", WEBSOCKET_URL);
        try {
            socket = new WebSocket(WEBSOCKET_URL); // Create new WebSocket instance
        } catch (err) {
            error("WS creation failed:", err);
            UIManager.updateStatus('Connection failed.', true);
            return;
        }

        // WebSocket Event Handlers
        socket.onopen = () => {
            log('WS open.');
            appState.isConnected = true;
            DOM.loadingScreen?.classList.remove('active'); // Hide loading screen
            DOM.gameContainer?.classList.add('loaded'); // Show game container
            UIManager.updateStatus('Connected.');
            // If not yet associated with a player, show the main menu
            if (!appState.localPlayerId) UIManager.showSection('mainMenuSection');
            if (onOpenCallback) onOpenCallback(); // Execute callback if provided
        };

        socket.onmessage = handleServerMessage; // Delegate message handling

        socket.onerror = (event) => {
            error('WS Error:', event);
            // Note: onclose usually follows onerror
        };

        socket.onclose = (event) => {
            error(`WS Closed: Code=${event.code}, Reason='${event.reason || 'N/A'}'`);
            const wasConnected = appState.isConnected;
            appState.isConnected = false;
            socket = null; // Clear socket reference
            GameManager.cleanupLoop(); // Stop game loop if running

            // If game was active, reset state but don't show menu immediately (allow reconnect attempt)
            if (appState.mode !== 'menu') GameManager.resetClientState(false);

            // Handle different close codes
            if (event.code === 1000 || event.code === 1001 || event.code === 1005) { // Normal closure or going away
                UIManager.updateStatus('Disconnected.');
                UIManager.showSection('mainMenuSection'); // Go back to main menu
            } else if (wasConnected) { // Unexpected closure while connected
                UIManager.updateStatus('Connection lost. Retrying...', true);
                scheduleReconnect(); // Attempt to reconnect
            } else { // Failed to connect initially
                UIManager.updateStatus('Connection failed.', true);
                UIManager.showSection('mainMenuSection');
            }
        };
    }

    // Schedule a reconnect attempt after a delay
    function scheduleReconnect() {
        clearTimeout(reconnectTimer);
        log(`Reconnect attempt in ${RECONNECT_DELAY}ms`);
        reconnectTimer = setTimeout(() => {
            log("Attempting reconnect...");
            // Connect again, on successful reconnect, show main menu
            connect(() => {
                UIManager.updateStatus('Reconnected.');
                UIManager.showSection('mainMenuSection');
            });
        }, RECONNECT_DELAY);
    }

    // Send JSON payload to the server
    function sendMessage(payload) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            try {
                socket.send(JSON.stringify(payload));
            } catch (err) {
                error("Send error:", err, payload);
                // Consider handling specific send errors (e.g., queueing)
            }
        } else {
            // log("Send failed: WebSocket not open."); // Can be noisy
        }
    }

    // Close the WebSocket connection gracefully
    function closeConnection(code = 1000, reason = "User action") {
        clearTimeout(reconnectTimer); // Cancel any pending reconnects
        if (socket && socket.readyState === WebSocket.OPEN) {
            log(`Closing WS connection: ${reason} (${code})`);
            socket.close(code, reason);
        }
        socket = null; // Clear reference immediately
        appState.isConnected = false;
    }

    return { connect, sendMessage, closeConnection };
})();


// === Input Manager Module ===
const InputManager = (() => {
    let keys = {}; // Tracks currently pressed keys { keyName: boolean }
    let lastShotTime = 0; // Timestamp of the last shot fired
    let inputInterval = null; // Interval timer for sending movement input
    let mouseScreenPos = { x: 0, y: 0 }; // Mouse position relative to canvas
    let isMouseDown = false; // Left mouse button state
    let isRightMouseDown = false; // Right mouse button state

    // THREE.js objects for mouse->world position calculation
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2(); // Normalized Device Coordinates (-1 to +1)

    // Prevent browser context menu over the game canvas
    function preventContextMenu(event) {
        // Check DOM.canvasContainer exists before accessing contains
        if (DOM.canvasContainer?.contains(event.target)) {
            event.preventDefault();
        }
    }

    // Set up input event listeners
    function setup() {
        cleanup(); // Ensure no duplicate listeners
        log("Input: Setting up listeners...");
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        // Check DOM elements exist before adding listeners
        DOM.chatInput?.addEventListener('keydown', handleChatEnter); // Enter key in chat input
        DOM.canvasContainer?.addEventListener('mousemove', handleMouseMove);
        DOM.canvasContainer?.addEventListener('mousedown', handleMouseDown);
        DOM.canvasContainer?.addEventListener('contextmenu', preventContextMenu); // Right-click prevention
        document.addEventListener('mouseup', handleMouseUp); // Listen on document for mouseup outside canvas

        // Start interval to send movement input periodically
        inputInterval = setInterval(sendMovementInput, INPUT_SEND_INTERVAL);
    }

    // Remove input event listeners
    function cleanup() {
        log("Input: Cleaning up listeners...");
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        DOM.chatInput?.removeEventListener('keydown', handleChatEnter);
        DOM.canvasContainer?.removeEventListener('mousemove', handleMouseMove);
        DOM.canvasContainer?.removeEventListener('mousedown', handleMouseDown);
        DOM.canvasContainer?.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('mouseup', handleMouseUp);
        clearInterval(inputInterval); // Stop sending movement input
        inputInterval = null;
        // Reset input states
        keys = {}; isMouseDown = false; isRightMouseDown = false;
        mouseScreenPos = { x: 0, y: 0 };
    }

    // Handle mouse movement over the canvas: calculate world position
    function handleMouseMove(event) {
        // Only process if renderer is ready and game is running
        if (!DOM.canvasContainer || !appState.isRendererReady || !Renderer3D.getCamera || !Renderer3D.getGroundPlane || !appState.isGameLoopRunning) return;

        const rect = DOM.canvasContainer.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        mouseScreenPos.x = canvasX; mouseScreenPos.y = canvasY;

        // Convert screen coordinates to Normalized Device Coordinates (NDC)
        mouseNDC.x = (canvasX / rect.width) * 2 - 1;
        mouseNDC.y = -(canvasY / rect.height) * 2 + 1;

        const camera = Renderer3D.getCamera();
        const groundPlane = Renderer3D.getGroundPlane();
        if (camera && groundPlane) {
            try {
                // Update the raycaster with the camera and mouse position
                raycaster.setFromCamera(mouseNDC, camera);
                // Find intersection with the ground plane
                const intersects = raycaster.intersectObject(groundPlane);
                if (intersects.length > 0) {
                    // Store the 3D world position of the intersection
                    appState.mouseWorldPosition.copy(intersects[0].point);
                }
            } catch (e) { error("Input: Raycasting error:", e); }
        }
    }

    // Handle mouse button presses
    function handleMouseDown(event) {
        // Ignore clicks if chat input is focused
        if (document.activeElement === DOM.chatInput) return;
        if (event.button === 0) { // Left click
             isMouseDown = true;
             // handleShooting(); // Optionally trigger shooting on down instead of up/hold
        } else if (event.button === 2) { // Right click
            isRightMouseDown = true;
            event.preventDefault(); // Prevent context menu
            triggerPushbackCheck(); // Trigger pushback ability
        }
    }

    // Handle mouse button releases
    function handleMouseUp(event) {
        if (event.button === 0) isMouseDown = false;
        if (event.button === 2) isRightMouseDown = false;
    }

    // Handle key presses
    function handleKeyDown(event) {
        // Ignore keydowns if chat input is focused
        if (document.activeElement === DOM.chatInput) return;
        const key = event.key.toLowerCase();

        // Movement keys (WASD, Arrows)
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            if (!keys[key]) keys[key] = true; // Track key state
            event.preventDefault(); // Prevent default browser actions (scrolling)
        }
        // Shoot key (Space)
        if (key === ' ' && !keys[' ']) {
            keys[' '] = true;
            handleShooting(); // Trigger shooting immediately on press
            event.preventDefault();
        }
        // Pushback key (E)
        if (key === 'e' && !keys['e']) {
            keys['e'] = true;
            triggerPushbackCheck();
            event.preventDefault();
        }
    }

    // Handle key releases
    function handleKeyUp(event) {
        const key = event.key.toLowerCase();
        // Update key state for relevant keys
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) {
            keys[key] = false;
        }
    }

    // Handle Enter key press in chat input field
    function handleChatEnter(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission/newline
            GameManager.sendChatMessage(); // Send the chat message
        }
    }

    // Calculate the normalized movement input vector based on currently pressed keys
    function getMovementInputVector() {
        let dx = 0, dy = 0;
        if (keys['w'] || keys['arrowup']) dy -= 1; // Server Y is down, so W is negative Y
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const factor = Math.SQRT1_2; // 1 / sqrt(2)
            dx *= factor;
            dy *= factor;
        }
        return { dx, dy };
    }

    // Send the current movement input vector to the server
    function sendMovementInput() {
        // Only send if in game, connected, and player exists
        if (appState.mode !== 'menu' && appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'player_move', direction: getMovementInputVector() });
        }
    }

    // Send a pushback request to the server
    function triggerPushbackCheck() {
        if (appState.serverState?.status === 'active' && appState.isConnected && appState.localPlayerId) {
            GameManager.triggerLocalPushback(); // Trigger local visual effect and send message
        }
    }

    // Handle player shooting action
    function handleShooting() {
        // Check conditions: game active, player exists and is alive
        if (!appState.serverState || !appState.localPlayerId || !appState.isRendererReady || appState.serverState.status !== 'active') return;
        const playerState = appState.serverState.players?.[appState.localPlayerId];
        if (!playerState || playerState.player_status !== PLAYER_STATUS_ALIVE) return;

        // --- Cooldown Check ---
        const nowTimestamp = Date.now();
        const currentAmmo = playerState?.active_ammo_type || 'standard';
        const isRapidFire = currentAmmo === 'ammo_rapid_fire';
        const cooldownMultiplier = isRapidFire ? RAPID_FIRE_COOLDOWN_MULTIPLIER : 1.0;
        const actualCooldown = SHOOT_COOLDOWN * cooldownMultiplier;
        if (nowTimestamp - lastShotTime < actualCooldown) return; // Still on cooldown
        lastShotTime = nowTimestamp; // Update last shot time

        // --- Calculate Aim Direction ---
        // Use predicted position for more responsive aiming origin
        const playerPredictX = appState.predictedPlayerPos.x;
        const playerPredictZ = appState.predictedPlayerPos.y; // Use Z from appState (server Y)

        // Convert mouse world position (THREE.js coords) to server coordinates (top-left origin)
        const mouseServerCoords = Renderer3D.mapWorldToServer
            ? Renderer3D.mapWorldToServer(appState.mouseWorldPosition)
            : { x: playerPredictX, y: playerPredictZ }; // Fallback if mapping unavailable

        let aimDx = 0, aimDy = -1; // Default aim up (server Y-down)
        if (mouseServerCoords && typeof playerPredictX === 'number' && typeof playerPredictZ === 'number') {
            aimDx = mouseServerCoords.x - playerPredictX;
            aimDy = mouseServerCoords.y - playerPredictZ; // Server Y is down
            const magSq = aimDx * aimDx + aimDy * aimDy;
            if (magSq > 0.01) { // Avoid division by zero/normalize
                const mag = Math.sqrt(magSq);
                aimDx /= mag;
                aimDy /= mag;
            } else { // Target too close, use default aim
                aimDx = 0; aimDy = -1;
            }
        }

        // Store aim direction for local effects and potentially sending to server (if needed)
        // Note: Renderer uses Z-up, so store dy negated for visual effects
        appState.localPlayerAimState.lastAimDx = aimDx;
        appState.localPlayerAimState.lastAimDy = -aimDy; // Negate for renderer's Z-up aim

        // --- Trigger Local Effects ---
        // Muzzle flash
        localEffects.muzzleFlash.active = true;
        localEffects.muzzleFlash.endTime = performance.now() + MUZZLE_FLASH_DURATION;
        localEffects.muzzleFlash.aimDx = appState.localPlayerAimState.lastAimDx; // Use stored aim
        localEffects.muzzleFlash.aimDy = appState.localPlayerAimState.lastAimDy;
        // Sound
        SoundManager.playSound('shoot', SHOOT_VOLUME);
        // Ammo Casing (visual only)
        if (Renderer3D.spawnVisualAmmoCasing) {
            const spawnPos = { x: playerPredictX, y: playerPredictZ }; // Server coords for spawn origin
            const ejectVec = new THREE.Vector3(aimDx, 0, aimDy); // Use server coords for eject direction base
            Renderer3D.spawnVisualAmmoCasing(spawnPos, ejectVec);
        }

        // --- Send Shoot Message to Server ---
        // Send the calculated target coordinates (server coordinate system)
        NetworkManager.sendMessage({ type: 'player_shoot', target: mouseServerCoords });
    }

    // Called every frame by the game loop
    function update(deltaTime) {
        // Handle continuous shooting if space or left mouse is held down
        if (keys[' ']) handleShooting();
        if (isMouseDown) handleShooting();

        // Play footstep sounds if moving and alive
        const isMoving = (keys['w'] || keys['a'] || keys['s'] || keys['d'] || keys['arrowup'] || keys['arrowdown'] || keys['arrowleft'] || keys['arrowright']);
        const player = appState.serverState?.players?.[appState.localPlayerId];
        if (isMoving && player?.player_status === PLAYER_STATUS_ALIVE) {
            const now = performance.now();
            if (now - lastFootstepTime > FOOTSTEP_INTERVAL_MS) {
                SoundManager.playSound('footstep', FOOTSTEP_VOLUME);
                lastFootstepTime = now;
            }
        }
    }

    return { setup, cleanup, update, getMovementInputVector };
})();


// === Game Manager Module ===
// Handles overall game flow, state transitions, and interactions between modules
const GameManager = (() => {
    let isInitialized = false; // Prevent duplicate listener setup

    // Set up initial UI event listeners
    function initListeners() {
        if (isInitialized) return;
        log("Game: Initializing listeners...");

        // --- Main Menu Buttons ---
        DOM.singlePlayerBtn?.addEventListener('click', () => { SoundManager.init(); startSinglePlayer(); });
        DOM.multiplayerBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection('multiplayerMenuSection'); });

        // --- Multiplayer Menu Buttons ---
        const hostHandler = (maxP) => { SoundManager.init(); hostMultiplayer(maxP); };
        DOM.hostGameBtn2?.addEventListener('click', () => hostHandler(2));
        DOM.hostGameBtn3?.addEventListener('click', () => hostHandler(3));
        DOM.hostGameBtn4?.addEventListener('click', () => hostHandler(4));
        DOM.showJoinUIBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); UIManager.showSection('joinCodeSection'); });

        // --- Join Game ---
        DOM.joinGameSubmitBtn?.addEventListener('click', () => { SoundManager.init(); joinMultiplayer(); });

        // --- In-Game / Lobby Controls ---
        DOM.cancelHostBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); leaveGame(); });
        DOM.sendChatBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); sendChatMessage(); });
        DOM.leaveGameBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); leaveGame(); });
        DOM.gameOverBackBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); resetClientState(true); }); // Go back to menu after game over
        DOM.muteBtn?.addEventListener('click', () => { SoundManager.playSound('ui_click', UI_CLICK_VOLUME); SoundManager.toggleMute(); });

        // --- Back Buttons ---
        // Generic handler for buttons with data-target attribute
        DOM.backButtons.forEach(btn => {
            const targetId = btn.dataset.target;
            // Use cached DOM reference if available
            const targetElement = DOM[targetId.replace(/-([a-z])/g, g => g[1].toUpperCase())] || document.getElementById(targetId);
            if (targetId && targetElement) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    SoundManager.playSound('ui_click', UI_CLICK_VOLUME);
                    UIManager.showSection(targetId); // Show the target section
                });
            } else {
                log(`Warn: Back button missing/invalid target: ${targetId}`, btn);
            }
        });

        // Update mute button initial state
        if(DOM.muteBtn) {
            const muted = SoundManager.getMuteState();
            DOM.muteBtn.textContent = muted ? 'Unmute' : 'Mute';
            DOM.muteBtn.setAttribute('aria-pressed', muted);
            DOM.muteBtn.classList.toggle('muted', muted);
        }

        isInitialized = true;
        log("Game: Listeners initialized.");
    }

    // --- Game Actions ---
    function startSinglePlayer() {
        log("Requesting Single Player game...");
        appState.mode = 'singleplayer';
        UIManager.updateStatus("Starting Single Player...");
        // Connect to server and send request on successful connection
        NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'start_single_player' }));
    }

    function joinMultiplayer() {
        const gameId = DOM.gameIdInput?.value.trim().toUpperCase();
        if (!gameId || gameId.length !== 6) {
            UIManager.updateStatus('Invalid Game ID (6 chars).', true); return;
        }
        log(`Joining MP game: ${gameId}`);
        appState.mode = 'multiplayer-client';
        UIManager.updateStatus(`Joining game ${gameId}...`);
        NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'join_game', game_id: gameId }));
    }

    function hostMultiplayer(maxPlayers) {
        log(`Hosting MP game (${maxPlayers}p)...`);
        if (![2, 3, 4].includes(maxPlayers)) {
            error("Invalid max players:", maxPlayers); UIManager.updateStatus("Invalid player count.", true); return;
        }
        appState.mode = 'multiplayer-host';
        UIManager.updateStatus(`Creating ${maxPlayers}p game...`);
        NetworkManager.connect(() => NetworkManager.sendMessage({ type: 'create_game', max_players: maxPlayers }));
    }

    function leaveGame() {
        log("Leaving game...");
        // Inform server if connected and in a game
        if (appState.isConnected && appState.currentGameId && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'leave_game' });
        }
        NetworkManager.closeConnection(1000, "User left game"); // Close connection
        resetClientState(true); // Reset client state and show main menu
    }

    function sendChatMessage() {
        const message = DOM.chatInput?.value.trim();
        if (message && appState.isConnected && appState.currentGameId && appState.localPlayerId) {
            NetworkManager.sendMessage({ type: 'player_chat', message: message });
            if(DOM.chatInput) DOM.chatInput.value = ''; // Clear input field
        }
    }

    // Trigger local pushback visual effect and send message to server
    function triggerLocalPushback() {
        localEffects.pushbackAnim.active = true;
        localEffects.pushbackAnim.endTime = performance.now() + localEffects.pushbackAnim.duration;
        NetworkManager.sendMessage({ type: 'player_pushback' });
    }

    // --- State Management ---
    // Reset client state to initial values, optionally show main menu
    function resetClientState(showMenu = true) {
        log(`Resetting client state. Show Menu: ${showMenu}`);
        cleanupLoop(); // Stop game loop and input listeners

        // Clear HTML overlays and reset pools
        if (DOM.htmlOverlay) DOM.htmlOverlay.innerHTML = '';
        Object.values(overlayElementPools).forEach(pool => { pool.elements = {}; pool.inactive = []; });

        // Cleanup renderer if initialized
        if (appState.isRendererReady && Renderer3D.cleanup) Renderer3D.cleanup();

        const currentIsConnected = appState.isConnected; // Preserve connection status for UI message

        // Reset core appState properties
        appState = {
            ...appState, // Keep some state like connection URL if needed
            mode: 'menu', localPlayerId: null, currentGameId: null, maxPlayersInGame: null,
            serverState: null, lastServerState: null, isGameLoopRunning: false, isRendererReady: false,
            worldWidth: DEFAULT_WORLD_WIDTH, worldHeight: DEFAULT_WORLD_HEIGHT,
            localPlayerRadius: DEFAULT_PLAYER_RADIUS,
            renderedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
            predictedPlayerPos: { x: DEFAULT_WORLD_WIDTH / 2, y: DEFAULT_WORLD_HEIGHT / 2 },
            lastStateReceiveTime: performance.now(),
            mouseWorldPosition: new THREE.Vector3(0,0,0),
            localPlayerAimState: { lastAimDx: 0, lastAimDy: -1 },
            uiPositions: {}, currentTemp: 18.0, isRaining: false, isDustStorm: false, isNight: false,
        };
        // Reset local effects
        localEffects = { muzzleFlash: { active: false, endTime: 0, aimDx: 0, aimDy: 0 }, pushbackAnim: { active: false, endTime: 0, duration: PUSHBACK_ANIM_DURATION }, snake: { active: false, segments: [] } };


        // Reset UI elements (check if they exist in DOM cache first)
        if(DOM.chatLog) DOM.chatLog.innerHTML = '';
        if(DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = '------';
        if(DOM.waitingMessage) DOM.waitingMessage.textContent = '';
        if(DOM.gameIdInput) DOM.gameIdInput.value = '';
        DOM.countdownDiv?.classList.remove('active');
        if(DOM.dayNightIndicator) DOM.dayNightIndicator.style.display = 'none';
        if(DOM.temperatureIndicator) DOM.temperatureIndicator.style.display = 'none';
        if(DOM.playerStatsGrid) DOM.playerStatsGrid.innerHTML = '';
        DOM.gameContainer?.classList.remove('night-mode', 'raining', 'dust-storm');

        // Show appropriate UI section
        if (showMenu) {
            UIManager.updateStatus(currentIsConnected ? "Connected." : "Disconnected.");
            UIManager.showSection('mainMenuSection');
        } else {
            UIManager.updateStatus("Initializing..."); // Status shown before connection established
        }
    }

    // Start the main game loop
    function startGameLoop() {
        // Only start if not already running, renderer is ready, and server state exists
        if (appState.isGameLoopRunning || !appState.isRendererReady || !appState.serverState) {
            log(`Game loop start condition not met: Running=${appState.isGameLoopRunning}, Renderer=${appState.isRendererReady}, State=${!!appState.serverState}`);
            return;
        }
        log("Starting game loop...");
        InputManager.setup(); // Start input listeners
        appState.isGameLoopRunning = true;
        lastLoopTime = performance.now(); // Initialize loop timer
        lastFootstepTime = 0; // Reset footstep timer
        appState.animationFrameId = requestAnimationFrame(gameLoop); // Start the loop
    }

    // Stop the game loop and cleanup related resources
    function cleanupLoop() {
        if (appState.animationFrameId) cancelAnimationFrame(appState.animationFrameId);
        appState.animationFrameId = null;
        InputManager.cleanup(); // Stop input listeners
        appState.isGameLoopRunning = false;
        log("Game loop stopped.");
    }

    // --- Interpolation & Prediction ---
    // Calculate the interpolated state for rendering between server updates
    function getInterpolatedState(renderTime) {
        const serverState = appState.serverState;
        const lastState = appState.lastServerState;

        // If no server state, return null
        if (!serverState) return null;

        // If no previous state or timestamps invalid, return current state directly
        // Also apply renderedPlayerPos to local player in this case
        if (!lastState || !serverState.timestamp || !lastState.timestamp || serverState.timestamp <= lastState.timestamp) {
            // Make a deep copy to avoid modifying the original server state
            let currentStateCopy = JSON.parse(JSON.stringify(serverState));
            // Apply the smoothed/reconciled position to the local player
            if (currentStateCopy.players?.[appState.localPlayerId]) {
                currentStateCopy.players[appState.localPlayerId].x = appState.renderedPlayerPos.x;
                currentStateCopy.players[appState.localPlayerId].y = appState.renderedPlayerPos.y;
            }
            // Include snake state (basic info from server)
            currentStateCopy.snake_state = serverState.snake_state;
            return currentStateCopy;
        }

        // Calculate interpolation factor 't'
        const serverTime = serverState.timestamp * 1000;
        const lastServerTime = lastState.timestamp * 1000;
        const timeBetweenStates = serverTime - lastServerTime;
        if (timeBetweenStates <= 0) return serverState; // Avoid division by zero

        const renderTargetTime = renderTime - INTERPOLATION_BUFFER_MS; // Target rendering time in the past
        const timeSinceLastState = renderTargetTime - lastServerTime;
        let t = Math.max(0, Math.min(1, timeSinceLastState / timeBetweenStates)); // Clamp t between 0 and 1

        // Create a deep copy of the current server state to modify
        let interpolatedState = JSON.parse(JSON.stringify(serverState));

        // Interpolate Players (excluding local player)
        if (interpolatedState.players) {
            for (const pId in interpolatedState.players) {
                const currentP = serverState.players[pId];
                const lastP = lastState.players?.[pId];
                if (pId === appState.localPlayerId) {
                    // Use the reconciled rendered position for the local player
                    interpolatedState.players[pId].x = appState.renderedPlayerPos.x;
                    interpolatedState.players[pId].y = appState.renderedPlayerPos.y;
                } else if (lastP && typeof currentP.x === 'number' && typeof lastP.x === 'number') {
                    // Interpolate other players
                    interpolatedState.players[pId].x = lerp(lastP.x, currentP.x, t);
                    interpolatedState.players[pId].y = lerp(lastP.y, currentP.y, t);
                }
            }
        }

        // Interpolate Enemies
        if (interpolatedState.enemies) {
            for (const eId in interpolatedState.enemies) {
                const currentE = serverState.enemies[eId];
                const lastE = lastState.enemies?.[eId];
                // Only interpolate if enemy existed in both states and is alive
                if (lastE && currentE.health > 0 && lastE.health > 0 && typeof currentE.x === 'number' && typeof lastE.x === 'number') {
                    interpolatedState.enemies[eId].x = lerp(lastE.x, currentE.x, t);
                    interpolatedState.enemies[eId].y = lerp(lastE.y, currentE.y, t);
                }
            }
        }

        // Interpolate Bullets
        if (interpolatedState.bullets) {
            for (const bId in interpolatedState.bullets) {
                const currentB = serverState.bullets[bId];
                const lastB = lastState.bullets?.[bId];
                if (lastB && typeof currentB.x === 'number' && typeof lastB.x === 'number') {
                    interpolatedState.bullets[bId].x = lerp(lastB.x, currentB.x, t);
                    interpolatedState.bullets[bId].y = lerp(lastB.y, currentB.y, t);
                }
            }
        }

        // Include snake state (basic info from server)
        interpolatedState.snake_state = serverState.snake_state;

        return interpolatedState;
    }

    // Predict the local player's position based on input
    function updatePredictedPosition(deltaTime) {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const playerState = appState.serverState.players[appState.localPlayerId];
        // Only predict if alive
        if (playerState.player_status !== PLAYER_STATUS_ALIVE) return;

        const moveVector = InputManager.getMovementInputVector();
        const playerSpeed = playerState?.speed ?? PLAYER_DEFAULTS['base_speed']; // Use current speed from server state

        // Apply movement based on input and speed
        if (moveVector.dx !== 0 || moveVector.dy !== 0) {
            appState.predictedPlayerPos.x += moveVector.dx * playerSpeed * deltaTime;
            appState.predictedPlayerPos.y += moveVector.dy * playerSpeed * deltaTime;
        }

        // Clamp predicted position to world bounds using player radius
        const radius = appState.localPlayerRadius;
        appState.predictedPlayerPos.x = Math.max(radius, Math.min(appState.worldWidth - radius, appState.predictedPlayerPos.x));
        appState.predictedPlayerPos.y = Math.max(radius, Math.min(appState.worldHeight - radius, appState.predictedPlayerPos.y));
    }

    // Reconcile the client's predicted/rendered position with the server's authoritative position
    function reconcileWithServer() {
        if (!appState.localPlayerId || !appState.serverState?.players?.[appState.localPlayerId]) return;
        const serverPlayerState = appState.serverState.players[appState.localPlayerId];
        // Ensure server position is valid
        if (typeof serverPlayerState.x !== 'number' || typeof serverPlayerState.y !== 'number') return;

        const serverPos = { x: serverPlayerState.x, y: serverPlayerState.y };
        const predictedPos = appState.predictedPlayerPos;
        const renderedPos = appState.renderedPlayerPos;

        const dist = distance(predictedPos.x, predictedPos.y, serverPos.x, serverPos.y);

        // Read thresholds from CSS variables (allows easier tuning)
        const snapThreshold = parseFloat(getCssVar('--reconciliation-threshold')) || 35; // Pixels difference to snap instantly
        const renderLerpFactor = parseFloat(getCssVar('--lerp-factor')) || 0.15; // Smoothing factor for rendered position

        // If difference is very large, snap both predicted and rendered positions to server state
        if (dist > snapThreshold * 1.5) { // Add hysteresis to snapping
            predictedPos.x = serverPos.x; predictedPos.y = serverPos.y;
            renderedPos.x = serverPos.x; renderedPos.y = serverPos.y;
        } else {
            // Smoothly interpolate the *rendered* position towards the *predicted* position
            renderedPos.x = lerp(renderedPos.x, predictedPos.x, renderLerpFactor);
            renderedPos.y = lerp(renderedPos.y, predictedPos.y, renderLerpFactor);

            // Gently nudge the *predicted* position towards the server position if there's a small discrepancy
            // This helps prevent prediction from drifting too far over time
            if (dist > 1.0) { // Only nudge if difference is noticeable
                predictedPos.x = lerp(predictedPos.x, serverPos.x, 0.05); // Small nudge factor
                predictedPos.y = lerp(predictedPos.y, serverPos.y, 0.05);
            }
        }
    }

    // --- Main Game Loop Function ---
    // Called by requestAnimationFrame
    function gameLoop(currentTime) {
        if (!appState.isGameLoopRunning) { cleanupLoop(); return; } // Stop if flag is false

        const now = performance.now();
        if (lastLoopTime === null) lastLoopTime = now; // Initialize timer on first frame
        // Calculate delta time, capping at 0.1s to prevent large jumps
        const deltaTime = Math.min(0.1, (now - lastLoopTime) / 1000);
        lastLoopTime = now;

        // --- Input & Local Effects Update ---
        InputManager.update(deltaTime); // Process continuous input (shooting, footsteps)
        // Update local effect timers (e.g., muzzle flash end)
        if (localEffects.pushbackAnim.active && now >= localEffects.pushbackAnim.endTime) localEffects.pushbackAnim.active = false;
        if (localEffects.muzzleFlash.active && now >= localEffects.muzzleFlash.endTime) localEffects.muzzleFlash.active = false;

        // --- Prediction & Reconciliation (Only if game is active) ---
        if (appState.serverState?.status === 'active') {
            updatePredictedPosition(deltaTime); // Predict local player movement
            reconcileWithServer(); // Correct prediction/rendered position based on server state
        }

        // --- Get State & Render ---
        const stateToRender = getInterpolatedState(now); // Calculate interpolated state for rendering
        if (stateToRender && appState.isRendererReady && Renderer3D.renderScene) {
            // Pass interpolated state, full app state, and local effects to the renderer
            Renderer3D.renderScene(stateToRender, appState, localEffects);
        }

        // --- Update UI Overlays ---
        // Needs to happen after renderer calculates screen positions (appState.uiPositions)
        if (stateToRender && appState.mode !== 'menu') {
            UIManager.updateHtmlOverlays();
        }

        // --- Request Next Frame ---
        if (appState.isGameLoopRunning) {
            appState.animationFrameId = requestAnimationFrame(gameLoop);
        } else {
            cleanupLoop(); // Ensure cleanup if loop flag was set to false
        }
    }

    // --- Server Message Processing Helpers ---
    // Set initial game state received from server
    function setInitialGameState(state, localId, gameId, maxPlayers) {
        log("Game: Setting initial state from server.");
        appState.lastServerState = null; // No previous state initially
        appState.serverState = state;
        appState.localPlayerId = localId;
        appState.currentGameId = gameId;
        appState.maxPlayersInGame = maxPlayers;
        // Use world dimensions from server state, fallback to defaults
        appState.worldWidth = state?.world_width || DEFAULT_WORLD_WIDTH;
        appState.worldHeight = state?.world_height || DEFAULT_WORLD_HEIGHT;

        const initialPlayer = state?.players?.[localId];
        appState.localPlayerRadius = initialPlayer?.radius || DEFAULT_PLAYER_RADIUS;
        // Set initial predicted and rendered positions based on server start position
        const startX = initialPlayer?.x ?? appState.worldWidth / 2;
        const startY = initialPlayer?.y ?? appState.worldHeight / 2;
        appState.predictedPlayerPos = { x: startX, y: startY };
        appState.renderedPlayerPos = { x: startX, y: startY };
        appState.localPlayerAimState = { lastAimDx: 0, lastAimDy: -1 }; // Reset aim

        // Initialize Renderer if not already done
        if (!appState.isRendererReady && DOM.canvasContainer) {
            log(`Game: Initializing Renderer with world size ${appState.worldWidth}x${appState.worldHeight}`);
            // Pass fixed world dimensions to renderer init
            appState.isRendererReady = Renderer3D.init(DOM.canvasContainer, appState.worldWidth, appState.worldHeight);
            if (!appState.isRendererReady) {
                error("Renderer initialization failed in setInitialGameState!");
                UIManager.updateStatus("Renderer Error!", true);
                // Consider further error handling (e.g., leave game)
            }
        }
    }

    // Update client state with a new snapshot from the server
    function updateServerState(newState) {
        appState.lastServerState = appState.serverState; // Store previous state
        appState.serverState = newState; // Update current state
        appState.lastStateReceiveTime = performance.now(); // Record receive time for interpolation

        // Update world dimensions if they change mid-game (unlikely but possible)
        if (newState?.world_width && newState?.world_height &&
            (appState.worldWidth !== newState.world_width || appState.worldHeight !== newState.world_height)) {
            log(`World dimensions updated mid-game: ${newState.world_width}x${newState.world_height}`);
            appState.worldWidth = newState.world_width;
            appState.worldHeight = newState.world_height;
            // Inform renderer if it needs to adapt (though current renderer uses fixed size)
            // if (Renderer3D.updateWorldSize) Renderer3D.updateWorldSize(appState.worldWidth, appState.worldHeight);
        }
        // Update local player radius if needed
        if (newState?.players?.[appState.localPlayerId]?.radius) {
            appState.localPlayerRadius = newState.players[appState.localPlayerId].radius;
        }

        // Update local snake effect state based on server data (basic info)
        // The renderer reconstructs the visual snake from this basic info
        if(newState.snake_state) {
             localEffects.snake = newState.snake_state; // Store basic snake properties
        } else { // Ensure snake is inactive if server doesn't send state
             localEffects.snake.active = false;
             localEffects.snake.segments = [];
        }
    }

    // Update UI for host waiting screen
    function updateHostWaitUI(state) {
        const currentP = Object.keys(state?.players || {}).length;
        const maxP = appState.maxPlayersInGame || '?';
        if (DOM.waitingMessage) DOM.waitingMessage.textContent = `Waiting... (${currentP}/${maxP} Players)`;
    }

    // Handle chat messages received from server
    function handlePlayerChat(senderId, message) {
        UIManager.addChatMessage(senderId, message, false); // Add as player message
    }

    // Handle enemy speech "chat" messages
    function handleEnemyChat(speakerId, message) {
        // Add as system message for distinction (could be styled differently)
        if (speakerId && message) UIManager.addChatMessage(speakerId, `(${message})`, true);
    }

    // Handle feedback based on state changes (damage, powerups, effects)
    function handleDamageFeedback(newState) {
        const localId = appState.localPlayerId;
        if (!localId || !appState.lastServerState) return; // Need previous state for comparison

        const prevP = appState.lastServerState?.players?.[localId];
        const currP = newState?.players?.[localId];

        // --- Player Took Damage Feedback ---
        if (prevP && currP && typeof currP.health === 'number' && typeof prevP.health === 'number' && currP.health < prevP.health) {
            // Check if 'hit_flash_this_tick' was set by server (optional, client could deduce)
            // if (currP.hit_flash_this_tick) { // Server might set this explicitly
                const dmg = prevP.health - currP.health;
                // Trigger screen shake based on damage amount
                const mag = Math.min(18, 5 + dmg * 0.2); // Example shake calculation
                if (Renderer3D.triggerShake) Renderer3D.triggerShake(mag, 250);
                SoundManager.playSound('damage', 0.8); // Play damage sound
            // }
        }

        // --- Snake Bite Feedback ---
        // Check for explicit flag from server
        if (currP?.trigger_snake_bite_shake_this_tick && Renderer3D.triggerShake) {
            log("Triggering snake bite shake effect.");
            // Use constants defined on server if available, else client defaults
            // Constants are not currently sent in snake_state, using client defaults
            const shakeMag = 20.0; // SNAKE_BITE_SHAKE_MAGNITUDE
            const shakeDur = 400.0; // SNAKE_BITE_SHAKE_DURATION_MS
            Renderer3D.triggerShake(shakeMag, shakeDur);
            // Play snake bite sound? SoundManager.playSound('snake_bite');
        }

        // --- Enemy Hit Feedback (Visual Sparks & Sound) ---
        if (newState.enemies && Renderer3D.triggerVisualHitSparks) {
            const now = performance.now();
            for (const eId in newState.enemies) {
                const enemy = newState.enemies[eId];
                const prevE = appState.lastServerState?.enemies?.[eId];
                // Check if enemy took damage *this tick* based on last_damage_time
                if (enemy?.last_damage_time && (!prevE || enemy.last_damage_time > (prevE.last_damage_time || 0))) {
                    // Check if the damage event is recent enough to warrant feedback
                    if (now - (enemy.last_damage_time * 1000) < 150) { // Allow slight delay
                        // Map server position to world position for sparks
                        const enemyPos = Renderer3D.mapServerToWorld(enemy.x, enemy.y);
                        // Adjust Y position for sparks (e.g., center of enemy)
                        enemyPos.y = (enemy.height / 2 || DEFAULT_PLAYER_RADIUS * 1.5);
                        Renderer3D.triggerVisualHitSparks(enemyPos, 5); // Trigger sparks
                        SoundManager.playSound('enemy_hit', 0.6); // Play hit sound

                        // Play death sound if health just dropped to zero
                        if (enemy.health <= 0 && prevE && prevE.health > 0) {
                            SoundManager.playSound('enemy_death', 0.7);
                        }
                    }
                }
            }
        }

        // --- Powerup Pickup Sound ---
        // Check if a powerup disappeared between states
        if (newState.powerups && appState.lastServerState?.powerups) {
            const currentIds = new Set(Object.keys(newState.powerups));
            const lastIds = new Set(Object.keys(appState.lastServerState.powerups));
            lastIds.forEach(id => {
                if (!currentIds.has(id)) { // Powerup with 'id' existed last state but not current
                    SoundManager.playSound('powerup', 0.9); // Play powerup sound
                }
            });
        }
    }

    // Public methods exposed by the GameManager module
    return {
        initListeners, startGameLoop, cleanupLoop, resetClientState,
        setInitialGameState, updateServerState, updateHostWaitUI,
        handlePlayerChat, handleEnemyChat, handleDamageFeedback,
        sendChatMessage, triggerLocalPushback
    };
})();


// === WebSocket Message Handler ===
// Processes messages received from the server
function handleServerMessage(event) {
    let data;
    try {
        data = JSON.parse(event.data); // Parse incoming JSON data
    } catch (err) {
        error("Failed parse WS message:", err, event.data); return;
    }

    try {
        // Process message based on its 'type'
        switch (data.type) {
            // --- Game Join / Start Confirmation ---
            case 'game_created': case 'game_joined': case 'sp_game_started':
                log(`Received '${data.type}'`);
                // Validate required data
                if (!data.initial_state || !data.player_id || !data.game_id) {
                    error(`'${data.type}' message missing critical data!`, data);
                    UIManager.updateStatus("Join/Start Error!", true);
                    // Force disconnect or reset? Depends on desired robustness.
                    return;
                }
                // Reset client state before setting new game state
                GameManager.resetClientState(false);
                // Set initial game state using received data
                GameManager.setInitialGameState(data.initial_state, data.player_id, data.game_id, data.max_players || 1);

                if (data.type === 'game_created') {
                    // Update UI for hosting
                    if (DOM.gameCodeDisplay) DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR';
                    UIManager.updateStatus(`Hosted Game: ${appState.currentGameId}`);
                    GameManager.updateHostWaitUI(appState.serverState); // Update player count
                    UIManager.showSection('hostWaitSection');
                } else { // game_joined or sp_game_started
                    const joinMsg = data.type === 'game_joined' ? `Joined ${appState.currentGameId}` : "Single Player Started!";
                    UIManager.updateStatus(joinMsg);
                    UIManager.showSection('gameArea'); // Show the main game UI
                    // Update HUD elements immediately with initial state
                    if (appState.serverState) {
                        UIManager.updateHUD(appState.serverState);
                        UIManager.updateCountdown(appState.serverState);
                        UIManager.updateEnvironmentDisplay(appState.serverState);
                    }
                    // Start game loop if renderer is ready
                    if (appState.isRendererReady) GameManager.startGameLoop();
                    else error("Cannot start game loop - Renderer not ready after game start confirmation!");
                }
                break;

            // --- Regular Game State Update ---
            case 'game_state':
                // Ignore if in menu, not yet associated, renderer not ready, or state missing
                if (appState.mode === 'menu' || !appState.localPlayerId || !appState.isRendererReady || !data.state) return;

                const previousStatus = appState.serverState?.status;
                GameManager.updateServerState(data.state); // Update client's authoritative state
                const newState = appState.serverState;

                // Handle transitions between game statuses (waiting -> countdown -> active -> finished)
                if (newState.status !== previousStatus) {
                    log(`Game Status Change: ${previousStatus || 'N/A'} -> ${newState.status}`);
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') {
                        // Transitioning into countdown or active play
                        UIManager.updateStatus(newState.status === 'countdown' ? "Get Ready..." : "Active!");
                        UIManager.showSection('gameArea'); // Ensure game area is visible
                        if (!appState.isGameLoopRunning) GameManager.startGameLoop(); // Start loop if not running
                    } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') {
                        // Host transitioning back to waiting (e.g., player left during countdown)
                        UIManager.updateStatus("Waiting for players...");
                        UIManager.showSection('hostWaitSection');
                        GameManager.updateHostWaitUI(newState);
                        GameManager.cleanupLoop(); // Stop game loop while waiting
                    } else if (newState.status === 'finished' && previousStatus !== 'finished') {
                        // Game just finished
                        log("Game Over via 'finished' status update.");
                        UIManager.updateStatus("Game Over!");
                        UIManager.showGameOver(newState); // Show game over screen with final state
                        SoundManager.playSound('death');
                        GameManager.cleanupLoop(); // Stop game loop
                    }
                }

                // Update UI elements based on current state
                if (appState.isGameLoopRunning && (newState.status === 'countdown' || newState.status === 'active')) {
                    UIManager.updateHUD(newState);
                    UIManager.updateCountdown(newState);
                    UIManager.updateEnvironmentDisplay(newState);
                } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') {
                    GameManager.updateHostWaitUI(newState); // Update player count in lobby
                }

                // Process feedback (damage, effects, sounds) based on state changes
                GameManager.handleEnemyChat(newState.enemy_speaker_id, newState.enemy_speech_text);
                GameManager.handleDamageFeedback(newState);
                break;

            // --- Explicit Game Over Notification ---
            // Separate message type for explicit game over signal from server
            case 'game_over_notification':
                log("Received 'game_over_notification'");
                if (data.final_state) {
                    appState.serverState = data.final_state; // Store final state
                    UIManager.updateStatus("Game Over!");
                    UIManager.showGameOver(data.final_state); // Show game over screen
                    SoundManager.playSound('death');
                } else {
                    error("Game over notification missing final_state.");
                    UIManager.showGameOver(null); // Show basic game over screen
                }
                GameManager.cleanupLoop(); // Stop game loop
                break;

            // --- Chat Message ---
            case 'chat_message':
                if(data.sender_id && data.message) {
                    GameManager.handlePlayerChat(data.sender_id, data.message);
                }
                break;

            // --- Server Error Message ---
            case 'error':
                error("Server Error:", data.message || "Unknown error");
                UIManager.updateStatus(`Error: ${data.message || 'Unknown'}`, true);
                // Handle specific errors to guide user UI
                const isJoinError = appState.mode === 'multiplayer-client' && data.message &&
                    (data.message.includes('not found') || data.message.includes('not waiting') ||
                     data.message.includes('full') || data.message.includes('finished'));
                const isHostError = appState.mode === 'multiplayer-host' && data.message && data.message.includes('creation failed');
                if (isJoinError) { // If join failed, go back to join UI
                    UIManager.showSection('joinCodeSection');
                    appState.mode = 'menu'; // Reset mode
                } else if (isHostError || (data.message && data.message.includes('Please create or join'))) {
                    // If host failed or generic error, go back to main menu
                    GameManager.resetClientState(true);
                }
                // Optionally close connection on critical errors?
                break;

            default:
                log(`Unknown message type received: ${data.type}`);
        }
    } catch (handlerError) {
        error("Error processing server message:", handlerError, "Data:", data);
        // Consider more robust error handling here (e.g., reset state, disconnect)
    }
}


// === Initialization on DOM Load ===
document.addEventListener('DOMContentLoaded', () => {
    log("DOM loaded. Initializing client...");

    // --- **FIX:** Populate DOM Cache AFTER DOM is loaded ---
    DOM = {
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
        // Query all back buttons after the main DOM structure is known
        backButtons: document.querySelectorAll('.button-back'),
    };
    // --- End DOM Cache Population ---


    // Check for essential UI elements
    const essentialIds = ['gameContainer', 'loadingScreen', 'canvasContainer', 'htmlOverlay', 'mainMenuSection', 'gameArea', 'menuArea'];
    let missingElement = false;
    essentialIds.forEach(id => {
        // Convert kebab-case to camelCase for checking the DOM object
        const camelCaseId = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
        if (!DOM[camelCaseId]) {
            error(`CRITICAL: Essential DOM element missing: #${id}`);
            missingElement = true;
        }
    });
    if (missingElement) {
        document.body.innerHTML = "<p style='color:red; font-size: 1.2em; text-align: center; padding: 2em;'>Error: Critical UI elements missing. Cannot start game. Check console.</p>";
        return;
    }

    // Initialize UI Manager now that DOM is ready
    UIManager.init();

    // Setup UI listeners
    try {
        GameManager.initListeners();
    } catch(listenerError) {
        error("Error initializing listeners:", listenerError);
        UIManager.updateStatus("Init Error: Controls failed.", true);
    }

    // Setup window resize handler
    resizeHandler = debounce(() => {
        if (appState.isRendererReady && Renderer3D.handleContainerResize) {
            Renderer3D.handleContainerResize();
        }
    }, RESIZE_DEBOUNCE_MS);
    window.addEventListener('resize', resizeHandler);

    // Show loading screen and attempt initial connection
    UIManager.showSection('loadingScreen'); // Use UIManager to show sections
    DOM.loadingScreen?.classList.add('active'); // Keep direct class manipulation for loading screen
    DOM.gameContainer?.classList.remove('loaded');
    UIManager.updateStatus("Initializing Connection...");
    NetworkManager.connect(() => {
        log("Initial WebSocket connection successful.");
        // On successful initial connection, the server's onopen handler
        // will transition UI state (e.g., show main menu).
    });

    log("Client initialization sequence complete.");
});
