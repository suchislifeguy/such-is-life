// --- Global Server Message Handler ---
function handleServerMessage(event) {
    let data;
    try { data = JSON.parse(event.data); }
    catch (err) { error("Failed to parse server message:", err, event.data); UI.updateStatus("Received invalid data from server.", true); return; }

    try {
        if (typeof Renderer === 'undefined' && ['sp_game_started', 'game_joined', 'game_state'].includes(data.type)) {
             error(`Received critical message type '${data.type}' before Renderer was ready!`);
             return;
        }

        switch (data.type) {
            case 'game_created':
                log("Received 'game_created'");
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state;
                appState.maxPlayersInGame = data.max_players;
                const hostP = appState.serverState?.players[appState.localPlayerId];
                if (hostP) { appState.predictedPlayerPos = { x: hostP.x, y: hostP.y }; appState.renderedPlayerPos = { x: hostP.x, y: hostP.y }; }
                if (!appState.maxPlayersInGame) { appState.maxPlayersInGame = '?'; }
                DOM.gameCodeDisplay.textContent = appState.currentGameId || 'ERROR';
                const currentP = Object.keys(appState.serverState?.players || {}).length;
                DOM.waitingMessage.textContent = `Waiting for Team Mate... (${currentP}/${appState.maxPlayersInGame})`;
                UI.updateStatus(`Game hosted. Code: ${appState.currentGameId}`);
                UI.showSection('host-wait-section');
                break;

            case 'game_joined':
                log("Received 'game_joined'");
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state;
                appState.maxPlayersInGame = appState.serverState?.max_players;
                if (!appState.maxPlayersInGame) { appState.maxPlayersInGame = '?'; }
                const joinedP = appState.serverState?.players[appState.localPlayerId];
                if (joinedP) { appState.predictedPlayerPos = { x: joinedP.x, y: joinedP.y }; appState.renderedPlayerPos = { x: joinedP.x, y: joinedP.y }; }
                UI.updateStatus(`Joined game ${appState.currentGameId}. Get ready!`);
                UI.showSection('game-area');
                if (appState.serverState) { Renderer.updateGeneratedBackground(appState.serverState.is_night, CANVAS_WIDTH, CANVAS_HEIGHT); UI.updateHUD(appState.serverState); UI.updateCountdown(appState.serverState); }
                Game.startGameLoop();
                break;

            case 'sp_game_started':
                log("Received 'sp_game_started'");
                appState.localPlayerId = data.player_id;
                appState.currentGameId = data.game_id;
                appState.serverState = data.initial_state;
                appState.maxPlayersInGame = 1;
                const spP = appState.serverState?.players[appState.localPlayerId];
                if (spP) { appState.predictedPlayerPos = { x: spP.x, y: spP.y }; appState.renderedPlayerPos = { x: spP.x, y: spP.y }; }
                UI.updateStatus("Single Player Game Started!");
                UI.showSection('game-area');
                if (appState.serverState) { Renderer.updateGeneratedBackground(appState.serverState.is_night, CANVAS_WIDTH, CANVAS_HEIGHT); UI.updateHUD(appState.serverState); UI.updateCountdown(appState.serverState); }
                Game.startGameLoop();
                break;

            case 'game_state':
                if (appState.mode === 'menu') return;

                // --- CORRECTED PLACEMENT --- Declare here, before use/population
                const previousEnemyDamageTimes = {};
                // Populate with data from the *current* appState.serverState (which is the *previous* server state at this point)
                if (appState.serverState?.enemies) {
                    Object.entries(appState.serverState.enemies).forEach(([id, enemy]) => {
                        if (enemy.last_damage_time) {
                            previousEnemyDamageTimes[id] = enemy.last_damage_time;
                        }
                    });
                }
                // --- End Population ---

                const previousStatus = appState.serverState?.status;
                const previousPlayerState = appState.serverState?.players?.[appState.localPlayerId];

                // Update state tracking
                appState.previousServerState = appState.lastServerState;
                appState.lastServerState = appState.serverState;
                appState.serverState = data.state; // Update to the new state received from server

                // Now process the NEW state
                const newState = appState.serverState;
                const currentPlayerState = newState?.players?.[appState.localPlayerId];
                const now = performance.now();
                const sparkEffectDuration = 30;

                // Check for new enemy damage to trigger client effect
                if (newState?.enemies) {
                    Object.entries(newState.enemies).forEach(([id, enemy]) => {
                        const newDamageTime = enemy.last_damage_time;
                        const oldDamageTime = previousEnemyDamageTimes[id]; // Access the map populated earlier

                        // Trigger if new damage time exists and is different from the stored previous time
                        if (newDamageTime && newDamageTime !== oldDamageTime) {
                            activeBloodSparkEffects[id] = now + sparkEffectDuration;
                        }
                    });
                }

                // Cleanup expired client-side spark effects
                Object.keys(activeBloodSparkEffects).forEach(enemyId => {
                    if (now >= activeBloodSparkEffects[enemyId]) {
                        delete activeBloodSparkEffects[enemyId];
                    }
                    if (!newState?.enemies?.[enemyId]) { // Also remove if enemy no longer exists
                         delete activeBloodSparkEffects[enemyId];
                    }
                });

                // Update environment and snake state based on newState
                appState.currentTemp = newState.current_temperature ?? 18.0;
                appState.isRaining = newState.is_raining ?? false;
                appState.isDustStorm = newState.is_dust_storm ?? false;
                UI.updateEnvironmentDisplay();

                const serverSnakeState = newState.snake_state;
                if (serverSnakeState && typeof snake !== 'undefined') {
                    snake.isActiveFromServer = serverSnakeState.active;
                    snake.serverHeadX = serverSnakeState.head_x;
                    snake.serverHeadY = serverSnakeState.head_y;
                    snake.serverBaseY = serverSnakeState.base_y;
                    if (snake.isActiveFromServer && snake.segments.length === 0) {
                         snake.segments = [{ x: snake.serverHeadX, y: snake.serverHeadY, time: performance.now() }];
                    } else if (!snake.isActiveFromServer) {
                         snake.segments = [];
                    }
                 }

                // Trigger shakes based on newState flags
                if (currentPlayerState?.trigger_snake_bite_shake_this_tick) {
                     Renderer.triggerShake(SNAKE_BITE_SHAKE_MAGNITUDE ?? 15.0, SNAKE_BITE_SHAKE_DURATION_MS ?? 400.0); // Use constants if available
                }

                // Trigger screen shake on taking damage
                if (previousPlayerState && currentPlayerState && typeof currentPlayerState.health === 'number' && typeof previousPlayerState.health === 'number' && currentPlayerState.health < previousPlayerState.health) {
                    const damageTaken = previousPlayerState.health - currentPlayerState.health;
                    const baseMag = 5; const dmgScale = 0.18; const maxMag = 18;
                    const shakeMagnitude = Math.min(maxMag, baseMag + damageTaken * dmgScale);
                    Renderer.triggerShake(shakeMagnitude, 250);
                }

                 // Handle game status changes (starting loop, reverting to waiting)
                 if (newState.status !== previousStatus) {
                    log(`[Client State Change] From ${previousStatus || 'null'} to ${newState.status}`);
                    if ((newState.status === 'countdown' || newState.status === 'active') && previousStatus !== 'active' && previousStatus !== 'countdown') {
                        UI.updateStatus(newState.status === 'countdown' ? "Countdown starting..." : "Game active!");
                        UI.showSection('game-area');
                        if (!appState.animationFrameId) {
                             log(`--> Starting game loop NOW (triggered by ${newState.status} state update).`);
                             if (newState) { Renderer.updateGeneratedBackground(newState.is_night, CANVAS_WIDTH, CANVAS_HEIGHT); }
                             Game.startGameLoop();
                        }
                    } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host' && previousStatus !== 'waiting') {
                         UI.updateStatus("Game reverted to waiting lobby.", true);
                         UI.showSection('host-wait-section');
                         const currentPWaiting = Object.keys(newState.players || {}).length;
                         DOM.waitingMessage.textContent = `Waiting for Team Mate... (${currentPWaiting}/${appState.maxPlayersInGame || '?'})`;
                         Game.cleanupLoop();
                    }
                 }

                 // Update HUD/UI elements if game is running
                 if (appState.animationFrameId && (newState.status === 'countdown' || newState.status === 'active')) {
                    UI.updateHUD(newState);
                    UI.updateCountdown(newState);
                    UI.updateDayNight(newState);
                 } else if (newState.status === 'waiting' && appState.mode === 'multiplayer-host') {
                    // Update waiting message if in host waiting screen
                    const pCount = Object.keys(newState.players || {}).length;
                    DOM.waitingMessage.textContent = `Waiting for Team Mate... (${pCount}/${appState.maxPlayersInGame || '?'})`;
                 }

                 // Update enemy speech bubbles
                 const speakerId = newState.enemy_speaker_id;
                 const speechText = newState.enemy_speech_text;
                 if (speakerId && speechText && typeof activeEnemyBubbles !== 'undefined') {
                     activeEnemyBubbles[speakerId] = { text: speechText.substring(0, 50), endTime: performance.now() + 3000 };
                 }
                 break; // End case 'game_state'

            case 'game_over_notification':
                log("Received 'game_over_notification'");
                if (data.final_state) {
                    appState.serverState = data.final_state; // Store final state
                    UI.updateStatus("Game Over!");
                    Game.cleanupLoop(); // Stop client loop
                    UI.showGameOver(data.final_state); // Display game over screen with stats
                    log("-> Game Over sequence initiated by notification.");
                } else {
                     error("Received 'game_over_notification' without final_state data.");
                     Game.resetClientState(true); // Reset to menu
                }
                break;

             case 'chat_message':
                 const senderId = data.sender_id;
                 const msgText = data.message;
                 const isSelf = senderId === appState.localPlayerId;
                 UI.addChatMessage(senderId, msgText, isSelf);
                 // Add to speech bubbles map
                 if (senderId && msgText && typeof activeSpeechBubbles !== 'undefined') {
                     activeSpeechBubbles[senderId] = { text: msgText.substring(0, 50), endTime: performance.now() + 4000 };
                 }
                 break;

             case 'error':
                 error("[Client] Server Error Message:", data.message);
                 UI.updateStatus(`Server Error: ${data.message}`, true);
                 // Handle specific errors that should revert UI state
                 if (appState.mode === 'multiplayer-client' && (data.message.includes('not found') || data.message.includes('not waiting') || data.message.includes('full') || data.message.includes('finished'))) {
                     UI.showSection('join-code-section');
                     appState.mode = 'menu'; // Reset mode if join fails critically
                 } else if (appState.mode === 'multiplayer-host' && data.message.includes('Creation Error')) {
                     Game.resetClientState(true);
                 } else if (data.message === 'Please create or join a game first.') {
                     // This can happen if client sends game messages after server cleanup
                     Game.resetClientState(true);
                 }
                 break;

            default:
                log(`Unknown message type received: ${data.type}`);
        }
    } catch (handlerError) {
        error("Error inside handleServerMessage logic:", handlerError); // Log the specific error
        UI.updateStatus("Client error processing message.", true);
    }
} // End handleServerMessage
