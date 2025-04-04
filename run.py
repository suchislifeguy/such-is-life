# -*- coding: utf-8 -*-
import os
import asyncio
import logging
import json
import time
import random
import math
import uuid
import operator
from aiohttp import web, WSMsgType

# --- Constants ---
MAX_PLAYERS = 4
TICK_RATE = 1 / 30
COUNTDOWN_TIME = 3.0
DAY_NIGHT_CYCLE_DURATION = 60.0
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

# --- Player State Constants --- 
PLAYER_STATUS_ALIVE = 'alive'
PLAYER_STATUS_DOWN = 'down'
PLAYER_STATUS_DEAD = 'dead'
REVIVAL_DURATION = 60.0
SPECIAL_AMMO_DURATION = 25.0
GAME_OVER_CHECK_INTERVAL = 1.0

PLAYER_DEFAULTS = { 'width': 20, 'height': 20, 'base_speed': 150, 'max_health': 100, 'gun': 1, 'armor': 0, 'kills': 0, 'score': 0, 'player_status': PLAYER_STATUS_ALIVE,  # Default to alive using the constant 'down_timer_expires_at': 0.0         # Default timer to 0
}

# ADD ENEMY TYPE CONSTANTS
ENEMY_FREEZE_DURATION = 0.1 
ENEMY_FADE_DURATION = 0.3
ENEMY_TYPE_CHASER = 'chaser'
ENEMY_TYPE_SHOOTER = 'shooter'
# ADJUST ENEMY DEFAULTS to include type and shooting params for shooters
ENEMY_DEFAULTS = {'width': 25, 'height': 25, 'speed': 80, 'max_health': 50, 'damage': 10, 'score_value': 10,
                  'target_player_id': None, 'type': ENEMY_TYPE_CHASER, # Default to chaser
                  'shoot_cooldown': 1.5, 'last_shot_time': 0, 'shoot_range_sq': 400**2, # Range of 400px squared
                  'bullet_speed': 200, 'bullet_damage': 15, 'bullet_lifetime': 2 } # Shooter-specific stats
BULLET_DEFAULTS = {'radius': 4, 'speed': 400, 'damage': 10, 'lifetime': 2.0, 'bullet_type': 'standard'} # Added bullet_type
# ADD ENEMY BULLET DEFAULTS (can override general bullet defaults if needed)
ENEMY_BULLET_DEFAULTS = {'radius': 3, 'speed': 200, 'damage': 15, 'lifetime': 2, 'bullet_type': 'standard_enemy'} # Enemy bullets look/act slightly different
# --- Damage Text Constants ---
DAMAGE_TEXT_DEFAULTS = {'lifetime': 0.75, 'speed_y': -40} # Text floats up

HIGHSCORE_FILE = "highscores.json"
MAX_HIGHSCORES = 50

PLAYER_CRIT_CHANCE = 0.15 # 15% chance for players
PLAYER_CRIT_MULTIPLIER = 2.0 # Double damage on crit
POWERUP_DEFAULTS = {'size': 12, 'duration': 10.0}
POWERUP_TYPES = ['health', 'gun_upgrade', 'speed_boost', 'armor', 'ammo_shotgun', 'ammo_heavy_slug', 'ammo_rapid_fire', 'bonus_score',]
POWERUP_VALUES = {'health': 25, 'gun_upgrade': 1, 'speed_boost': 50, 'armor': 25}
POWERUP_SPAWN_INTERVAL = 15.0
ENEMY_SPAWN_INTERVAL = 3.0
BONUS_SCORE_VALUE = 100 

PUSHBACK_RANGE = 200       # How close an entity needs to be to get pushed (pixels)
PUSHBACK_RANGE_SQ = PUSHBACK_RANGE * PUSHBACK_RANGE # Use squared distance for efficiency
PUSHBACK_FORCE = 150       # How far entities are pushed back (pixels)
PUSHBACK_COOLDOWN_DURATION = .1 # Seconds between push attempts

# --- Logging ---
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s [%(levelname)s] (%(name)s:%(lineno)d) %(message)s', datefmt='%H:%M:%S')
log_main = logging.getLogger('ServerMain')
log_net = logging.getLogger('NetworkLayer')
log_game = logging.getLogger('GameLogic')

# --- Utilities ---
def generate_id(): return str(uuid.uuid4())
def distance_sq(x1, y1, x2, y2): dx = x1 - x2; dy = y1 - y2; return dx * dx + dy * dy

def check_aabb_collision(obj1, obj2):
    x1, y1 = obj1.get('x'), obj1.get('y')
    x2, y2 = obj2.get('x'), obj2.get('y')

    if None in (x1, y1, x2, y2):
        return False

    if 'width' in obj1 and 'height' in obj1:
        w1_half = obj1['width'] / 2
        h1_half = obj1['height'] / 2
    elif 'size' in obj1:
        w1_half = obj1['size'] / 2
        h1_half = obj1['size'] / 2
    elif 'radius' in obj1:
        w1_half = obj1['radius']
        h1_half = obj1['radius']
    else:
        return False

    if 'width' in obj2 and 'height' in obj2:
        w2_half = obj2['width'] / 2
        h2_half = obj2['height'] / 2
    elif 'size' in obj2:
        w2_half = obj2['size'] / 2
        h2_half = obj2['size'] / 2
    elif 'radius' in obj2:
        w2_half = obj2['radius']
        h2_half = obj2['radius']
    else:
        return False

    if w1_half <= 0 or h1_half <= 0 or w2_half <= 0 or h2_half <= 0:
        return False

    collision_x = abs(x1 - x2) < (w1_half + w2_half)
    collision_y = abs(y1 - y2) < (h1_half + h2_half)

    return collision_x and collision_y

def load_high_scores():
    if not os.path.exists(HIGHSCORE_FILE):
        log_main.info(f"High score file '{HIGHSCORE_FILE}' not found, initializing empty list.")
        return []
    try:
        with open(HIGHSCORE_FILE, 'r') as f:
            scores = json.load(f)
            # Basic validation: ensure it's a list
            if not isinstance(scores, list):
                log_main.error(f"High score file '{HIGHSCORE_FILE}' contained invalid data (not a list). Resetting.")
                return []
            # Optional: Validate individual score entries further if needed
            log_main.info(f"Loaded {len(scores)} high scores from '{HIGHSCORE_FILE}'.")
            # Ensure list is sorted initially after loading
            scores.sort(key=operator.itemgetter('score'), reverse=True)
            return scores
    except json.JSONDecodeError:
        log_main.error(f"Error decoding JSON from '{HIGHSCORE_FILE}'. Resetting high scores.")
        return []
    except Exception as e:
        log_main.error(f"Error loading high scores from '{HIGHSCORE_FILE}': {e}", exc_info=True)
        return []

def save_high_scores(scores_list):
    try:
        # Ensure scores are sorted before saving (descending by score)
        scores_list.sort(key=operator.itemgetter('score'), reverse=True)
        # Trim to max length
        trimmed_scores = scores_list[:MAX_HIGHSCORES]
        with open(HIGHSCORE_FILE, 'w') as f:
            json.dump(trimmed_scores, f, indent=2) # Use indent for readability
        log_main.info(f"Saved {len(trimmed_scores)} high scores to '{HIGHSCORE_FILE}'.")
    except Exception as e:
        log_main.error(f"Error saving high scores to '{HIGHSCORE_FILE}': {e}", exc_info=True)

# --- Game Simulation Class ---
class Game:
    # CORRECTED SIGNATURE and BODY
    def __init__(self, game_id, host_id, broadcast_state_callback, on_game_finished_callback, max_players=MAX_PLAYERS):
        self.game_id = game_id
        self.host_id = host_id
        self._broadcast_state = broadcast_state_callback
        self._on_game_finished = on_game_finished_callback # Include the callback storage
        self.max_players = max_players # CORRECT: Assign from the parameter

        self.status = 'waiting'
        self.players = {}
        self.enemies = {}
        self.bullets = {}
        self.powerups = {}
        self.score = 0
        self.level = 1
        self.is_night = False
        self.countdown_timer = 0.0
        self.day_night_timer = DAY_NIGHT_CYCLE_DURATION / 2
        self.enemy_spawn_timer = ENEMY_SPAWN_INTERVAL
        self.powerup_spawn_timer = POWERUP_SPAWN_INTERVAL
        self.canvas_width = CANVAS_WIDTH
        self.canvas_height = CANVAS_HEIGHT
        self.game_over_check_timer = GAME_OVER_CHECK_INTERVAL
        self.damage_texts = {}
        self.campfire_x = CANVAS_WIDTH / 2
        self.campfire_y = CANVAS_HEIGHT / 2
        self.campfire_radius = 75
        self.campfire_radius_sq = self.campfire_radius * self.campfire_radius
        self.campfire_regen_rate = 1

        self.enemy_speech_timer = 0.0
        self.enemy_speech_cooldown = 5.0
        self.enemy_speech_chance = 0.4
        self.potential_speech_generic = [
            "Stop, Kelly!", "You won't escape!", "Surrender, outlaw!", "Gotcha now!", "He's too fast!",
            "Easy work today.", "Nowhere left to hide.", "This'll be quick.", "The reward's as good as mine!",
            "For the Queen!", "Uphold the law!", "Damn bushrangers!", "Think of the reward!"
        ]
        self.potential_speech_shooter = ["Steady... Aim...", "Got him in my sights!", "Eat lead!", "Hold still!"]
        self.potential_speech_armor = ["Curse that armor!"]
        self.active_enemy_speech_id = None
        self.current_enemy_speech = None

        self.loop_task = None
        # CORRECTED: Indent log inside __init__ and use correct variable
        log_game.info(f"[{self.game_id}] Game instance initialized with max_players = {self.max_players}.")

        # --- Generic Trooper/Police Chatter ---
        self.potential_speech_generic = [
            "Stop, Kelly!",
            "You won't escape!",
            "Surrender, outlaw!",
            "Gotcha now!",
            "He's too fast!",
            "Easy work today.", # Overconfident
            "Nowhere left to hide.", # Overconfident
            "This'll be quick.", # Overconfident
            "The reward's as good as mine!", # Overconfident/Greedy
            "For the Queen!", # Thematic
            "Uphold the law!", # Thematic
            "Damn bushrangers!", # Thematic
            "Think of the reward!" # Thematic/Greedy
        ]

        # --- Shooter Specific Lines ---
        self.potential_speech_shooter = [
            "Steady... Aim...",
            "Got him in my sights!",
            "Eat lead!",
            "Hold still!"
        ]

        # --- Armor Specific (Used if player has armor) ---
        self.potential_speech_armor = [
            "Curse that armor!"
        ]

        self.active_enemy_speech_id = None
        self.current_enemy_speech = None
                    
        self.loop_task = None
        log_game.info(f"[{self.game_id}] Instance created")

      
    def _update_campfire_regen(self, delta_time):
        """Applies health regeneration to players near the campfire at night."""
        if not self.is_night:
            return # Only active at night

        for p_id, player in self.players.items():
            # Only regen players who are alive and not already at max health
            if player.get('player_status') == PLAYER_STATUS_ALIVE and \
               player.get('health', 0) < player.get('max_health', PLAYER_DEFAULTS['max_health']):

                dist_sq_to_fire = distance_sq(player['x'], player['y'], self.campfire_x, self.campfire_y)

                if dist_sq_to_fire <= self.campfire_radius_sq:
                    regen_amount = self.campfire_regen_rate * delta_time
                    player['health'] += regen_amount
                    # Clamp health to max
                    player['health'] = min(player.get('max_health', PLAYER_DEFAULTS['max_health']), player['health'])
                    # Optional: log the regen
                    # log_game.debug(f"Player {p_id} regenerated {regen_amount:.2f} HP near campfire. New HP: {player['health']:.1f}")

    def remove_player(self, player_id):
        if player_id in self.players:
            del self.players[player_id]
            log_game.info(f"[{self.game_id}] Player {player_id} removed ({len(self.players)}/{self.max_players} remaining).")
            if self.status != 'finished':
                if not self.players:
                     self.finish_game("Game empty")
                # --- USE self.max_players ---
                # Return to waiting if game was active/countdown and now has less than max players
                elif self.status != 'waiting' and len(self.players) < self.max_players:
                     self.status = 'waiting'; self.countdown_timer = 0
                     log_game.info(f"[{self.game_id}] Returning to waiting (player left, now {len(self.players)}/{self.max_players}).")
        else:
             log_game.warning(f"[{self.game_id}] Remove failed: Player {player_id} not found.")

    def set_player_input(self, player_id, direction):
        player = self.players.get(player_id)
        if player and isinstance(direction, dict):
            dx = max(-1.0, min(1.0, direction.get('dx', 0)))
            dy = max(-1.0, min(1.0, direction.get('dy', 0)))
            player['input_vector'] = {'dx': dx, 'dy': dy}

    def player_shoot(self, player_id, target_coords): # <<< Parameter changed
        player = self.players.get(player_id)
        # Basic checks remain the same
        if not player or self.status != 'active' or player.get('health', 0) <= 0:
            log_game.debug(f"Player shoot ignored for {player_id}. Conditions not met (Player: {bool(player)}, Status: {self.status}, Health: {player.get('health', 0) if player else 'N/A'})")
            return

        # --- Calculate Direction Vector SERVER-SIDE ---
        if not isinstance(target_coords, dict):
            log_game.warning(f"Player shoot failed for {player_id}: target_coords is not a dict ({target_coords})")
            return
        target_x = target_coords.get('x')
        target_y = target_coords.get('y')
        if target_x is None or target_y is None:
            log_game.warning(f"Player shoot failed for {player_id}: target_coords missing x or y ({target_coords})")
            return

        # Use the server's authoritative position for the player
        player_x = player['x']
        player_y = player['y']

        # Calculate vector from server's player position to target coordinates
        dx = target_x - player_x
        dy = target_y - player_y
        mag_sq = dx*dx + dy*dy

        # Normalize the direction vector
        if mag_sq < 0.01: # If target is basically *on* the player, default aim (e.g., up)
            # log_game.debug(f"Player {player_id} shoot target too close, defaulting direction.")
            # TODO: Maybe use player's last known movement direction or view direction if available?
            norm_dx, norm_dy = 0, -1 # Defaulting to UP for now
        else:
            mag = math.sqrt(mag_sq)
            norm_dx = dx / mag
            norm_dy = dy / mag
        # --- End Server-Side Direction Calculation ---


        # --- Get Player / Weapon Stats ---
        # (Same as before: base_damage, base_speed, base_radius, now)
        base_damage = BULLET_DEFAULTS['damage'] + (player.get('gun', 1) - 1) * 5
        base_speed = BULLET_DEFAULTS['speed']
        base_radius = BULLET_DEFAULTS['radius']
        now = time.time()


        # --- Determine Active Ammo Type ---
        ammo_type = player.get('active_ammo_type', 'standard')
        # log_game.debug(f"Player {player_id} shooting with ammo: {ammo_type}, direction: ({norm_dx:.2f}, {norm_dy:.2f})") # Debug log


        bullets_to_create = [] # List to hold dicts of bullets to add
        # Use base radius for standard offset calculation initially
        spawn_offset = player.get('width', PLAYER_DEFAULTS['width']) / 2 + base_radius + 2

        # --- Firing Logic Based on Ammo Type (Uses SERVER-CALCULATED norm_dx, norm_dy) ---

        if ammo_type == 'ammo_shotgun':
            pellet_damage = base_damage * 0.4 # Pellet damage factor
            for _ in range(6): # Pellet count
                # Calculate spread relative to the server-calculated direction
                angle_offset = random.uniform(-0.175, 0.175) # Half of spread angle (0.35 / 2 radians ~= 20 degrees)
                base_angle = math.atan2(norm_dy, norm_dx) # Use server's calculated angle
                pellet_angle = base_angle + angle_offset
                pellet_dx = math.cos(pellet_angle)
                pellet_dy = math.sin(pellet_angle)
                # Optional: Use a slightly smaller radius/offset for pellets?
                pellet_rad = base_radius * 0.75
                pellet_offset = player.get('width', PLAYER_DEFAULTS['width']) / 2 + pellet_rad + 2
                start_x = player_x + pellet_dx * pellet_offset
                start_y = player_y + pellet_dy * pellet_offset
                bullets_to_create.append({
                    'x': start_x, 'y': start_y, 'vx': pellet_dx * base_speed, 'vy': pellet_dy * base_speed,
                    'owner_id': player_id, 'owner_type': 'player', 'damage': pellet_damage,
                    'spawn_time': now, 'lifetime': BULLET_DEFAULTS['lifetime'] * 0.8, # Shorter lifetime
                    'radius': pellet_rad, # Smaller radius
                    'bullet_type': 'ammo_shotgun' # Use type string
                })

        elif ammo_type == 'ammo_heavy_slug':
            slug_damage = base_damage * 1.8 # Damage multiplier
            slug_speed = base_speed * 0.7  # Speed factor
            slug_radius = base_radius * 1.5 # Radius multiplier
            # Adjust spawn offset for the slug's larger radius
            slug_offset = player.get('width', PLAYER_DEFAULTS['width']) / 2 + slug_radius + 2

            # Use server's calculated direction (norm_dx, norm_dy)
            start_x = player_x + norm_dx * slug_offset
            start_y = player_y + norm_dy * slug_offset
            bullets_to_create.append({
                'x': start_x, 'y': start_y, 'vx': norm_dx * slug_speed, 'vy': norm_dy * slug_speed,
                'owner_id': player_id, 'owner_type': 'player', 'damage': slug_damage,
                'spawn_time': now, 'lifetime': BULLET_DEFAULTS['lifetime'],
                'radius': slug_radius, # Use the larger radius
                'bullet_type': 'ammo_heavy_slug' # Use type string
            })

        else: # Standard or Rapid Fire (Client handles rapid timing, server just spawns one bullet per message)
            # Use server's calculated direction (norm_dx, norm_dy)
            start_x = player_x + norm_dx * spawn_offset
            start_y = player_y + norm_dy * spawn_offset
            # Send 'ammo_rapid_fire' type if active, otherwise 'standard'
            bullet_type_to_send = 'ammo_rapid_fire' if ammo_type == 'ammo_rapid_fire' else 'standard'
            bullets_to_create.append({
                'x': start_x, 'y': start_y, 'vx': norm_dx * base_speed, 'vy': norm_dy * base_speed,
                'owner_id': player_id, 'owner_type': 'player', 'damage': base_damage,
                'spawn_time': now, 'lifetime': BULLET_DEFAULTS['lifetime'],
                'radius': base_radius, # Use standard radius
                'bullet_type': bullet_type_to_send # Use type string
            })

        # --- Add generated bullets to game state ---
        for bullet_data in bullets_to_create:
            b_id = generate_id()
            bullet_data['id'] = b_id
            self.bullets[b_id] = bullet_data
            # log_game.debug(f"Created bullet {b_id} ({bullet_data.get('bullet_type')}) for player {player_id}") # Optional log


    def start_countdown(self):
        # --- USE self.max_players ---
        # Condition changed: Now explicitly called by add_player when full
        if self.status == 'waiting' and len(self.players) == self.max_players:
            self.status = 'countdown'; self.countdown_timer = COUNTDOWN_TIME
            log_game.info(f"[{self.game_id}] Starting countdown ({self.max_players} players present).")
            # Player positioning logic can remain the same or be adjusted based on player count
            for i, p in enumerate(self.players.values()):
                # Example simple positioning based on max_players
                offset_scale = 50 * (self.max_players / 2.0) # Wider spread for more players
                p['x'] = self.canvas_width / 2 + (i - (self.max_players - 1) / 2.0) * offset_scale
                p['y'] = self.canvas_height - 50
                p['input_vector'] = {'dx': 0, 'dy': 0}
        elif self.status == 'waiting':
             log_game.warning(f"[{self.game_id}] start_countdown called but not full ({len(self.players)}/{self.max_players}).")

    def start_game(self):
        if self.status == 'countdown':
            self.status = 'active'; self.level = 1; self.score = 0; self.is_night = False
            self.day_night_timer = DAY_NIGHT_CYCLE_DURATION / 2
            self.enemy_spawn_timer = self._get_current_enemy_spawn_interval()
            self.powerup_spawn_timer = POWERUP_SPAWN_INTERVAL
            self.enemies.clear(); self.bullets.clear(); self.powerups.clear()
            for p in self.players.values():
                 p.update({'health': p.get('max_health', PLAYER_DEFAULTS['max_health']),
                           'kills': 0, 'score': 0, 'gun': 1, 'armor': 0,
                           'speed': p.get('base_speed', PLAYER_DEFAULTS['base_speed']),
                           'effects': {}, 'input_vector': {'dx': 0, 'dy': 0},
                           'cooldowns': {} }) # Ensure cooldowns is reset
            log_game.info(f"[{self.game_id}] Game active!")

    def finish_game(self, reason="Unknown"):
        if self.status == 'finished': return # Already finished, do nothing
        self.status = 'finished'
        log_game.info(f"[{self.game_id}] Game finished (Reason: {reason}). Final Score: {self.score}, Level: {self.level}")

        # --- START MODIFICATION ---
        # Pass the game object itself to the callback
        if self._on_game_finished:
            try:
                # Assuming the callback is async, schedule it
                asyncio.create_task(self._on_game_finished(self)) # Pass 'self' (the game object)
                log_game.debug(f"[{self.game_id}] Scheduled on_game_finished callback.")
            except Exception as cb_err:
                log_game.error(f"[{self.game_id}] Error scheduling on_game_finished callback: {cb_err}")
        # --- END MODIFICATION ---

        if self.loop_task and not self.loop_task.done():
            log_game.debug(f"[{self.game_id}] Cancelling game loop task from finish_game.")
            self.loop_task.cancel()

    async def run_game_loop(self):
        log_game.info(f"[{self.game_id}] Starting loop task.")
        last_tick_time = time.monotonic()
        final_state_sent = False

        try:
            await asyncio.sleep(0.01)

            while True:
                if self.status == 'finished':
                    log_game.info(f"[{self.game_id}] Loop detected status='finished' at start of tick, breaking.")
                    break

                now_monotonic = time.monotonic()
                delta_time = min(0.1, now_monotonic - last_tick_time)
                last_tick_time = now_monotonic

                if delta_time <= 0:
                    await asyncio.sleep(TICK_RATE / 2)
                    continue

                snapshot = None
                try:
                    current_status = self.status
                    if current_status == 'active' or current_status == 'countdown':
                        self._update(delta_time)

                    if self.status == 'finished':
                        log_game.info(f"[{self.game_id}] Loop detected status='finished' after _update, breaking.")
                        break

                    snapshot = self.get_state()

                except Exception as loop_err:
                    log_game.error(f"[{self.game_id}] EXCEPTION during game tick simulation: {loop_err}", exc_info=True)
                    self.finish_game(f"Tick Error: {loop_err}")
                    log_game.info(f"[{self.game_id}] Breaking loop due to tick error.")
                    break

                if self.status != 'finished' and snapshot:
                    try:
                        # Ensure players still exist before broadcasting state
                        if self.players:
                             await self._broadcast_state(self.game_id, {'type': 'game_state', 'state': snapshot})
                        else:
                            # Optional log if needed:
                            # log_game.debug(f"[{self.game_id}] Skipping broadcast in loop; no players found.")
                            pass
                    except Exception as broadcast_err:
                        log_game.error(f"[{self.game_id}] Error during REGULAR state broadcast: {broadcast_err}", exc_info=False)
                elif snapshot and self.status == 'finished':
                     # Optional log if needed:
                     # log_game.debug(f"[{self.game_id}] Skipping broadcast in loop; status is '{self.status}'.")
                     pass

                elapsed_time = time.monotonic() - now_monotonic
                sleep_duration = max(0, TICK_RATE - elapsed_time)
                await asyncio.sleep(sleep_duration)

            log_game.info(f"[{self.game_id}] Main loop exited. Status: {self.status}. Attempting final broadcast.")

            self.status = 'finished'
            final_state = self.get_state()

            if self._broadcast_state:
                try:
                    await self._broadcast_state(self.game_id, {'type': 'game_state', 'state': final_state})
                    log_game.info(f"[{self.game_id}] Successfully sent FINAL game state after loop exit.")
                    final_state_sent = True
                except Exception as final_broadcast_err:
                     log_game.error(f"[{self.game_id}] FAILED to send final game state after loop exit: {final_broadcast_err}", exc_info=True)
            else:
                log_game.warning(f"[{self.game_id}] Cannot send final state after loop exit: _broadcast_state callback is missing.")

        except asyncio.CancelledError:
            log_game.info(f"[{self.game_id}] Game loop task cancelled externally.")
        except Exception as e:
            log_game.error(f"[{self.game_id}] FATAL error in game loop: {e}", exc_info=True)
            if self.status != 'finished': self.finish_game(f"Fatal Loop Error: {e}")
        finally:
            if self.status != 'finished':
                 log_game.warning(f"[{self.game_id}] Loop 'finally' block reached unexpectedly. Forcing status to finished.")
                 self.status = 'finished'
            log_game.info(f"[{self.game_id}] Game loop task ended. Final Status: {self.status}. Final state sent: {final_state_sent}")

    def _update(self, delta_time):
        # --- Initial status checks ---
        if self.status == 'finished': return
        if not self.players and self.status != 'waiting':
             log_game.warning(f"[{self.game_id}] _update called when active/countdown but no players found. Finishing game.")
             self.finish_game("Update with no players")
             return
        if self.status == 'countdown':
            self.countdown_timer -= delta_time
            if self.countdown_timer <= 0: self.start_game()
            return
        if self.status != 'active': return

        # --- Main update logic for 'active' status ---
        try:
            self._update_timers(delta_time)
            self._update_player_effects(delta_time)
            self._update_player_statuses(delta_time) 
            self._update_campfire_regen(delta_time) 
            self._update_players(delta_time)
            self._update_enemies(delta_time)
            self._update_bullets(delta_time)
            self._update_damage_texts(delta_time)
            self._spawn_entities(delta_time)
            self._update_enemy_speech(delta_time)
            self._check_collisions() # Checks hits -> DOWN status
            self._cleanup_entities()

            # --- TIMED GAME OVER CHECK ---
            # Now self.game_over_check_timer is guaranteed to exist
            self.game_over_check_timer -= delta_time
            if self.game_over_check_timer <= 0:
                self._perform_game_over_check() # Checks DEAD status -> finish_game
                self.game_over_check_timer = GAME_OVER_CHECK_INTERVAL # Reset timer

        except Exception as update_step_err:
             log_game.error(f"[{self.game_id}] Error during _update step: {update_step_err}", exc_info=True)
             raise update_step_err # Re-raise for the main loop handler


    def _update_timers(self, delta_time):
        self.day_night_timer -= delta_time
        if self.day_night_timer <= 0:
            self.is_night = not self.is_night
            self.day_night_timer = DAY_NIGHT_CYCLE_DURATION / 2

    def _update_players(self, delta_time):
        for player in self.players.values():
            if player.get('health', 0) <= 0: continue
            input_vec = player.get('input_vector', {'dx': 0, 'dy': 0})
            speed = player.get('speed', PLAYER_DEFAULTS['base_speed'])
            w_half = player.get('width', PLAYER_DEFAULTS['width']) / 2
            h_half = player.get('height', PLAYER_DEFAULTS['height']) / 2
            new_x = player['x'] + input_vec['dx'] * speed * delta_time
            new_y = player['y'] + input_vec['dy'] * speed * delta_time
            player['x'] = max(w_half, min(self.canvas_width - w_half, new_x))
            player['y'] = max(h_half, min(self.canvas_height - h_half, new_y))

        # Inside Game class:
    def _update_enemies(self, delta_time):
        alive_players = [p for p in self.players.values() if p.get('player_status') == PLAYER_STATUS_ALIVE] # Check status now
        if not alive_players: return
        now = time.time()

        for enemy_id, enemy in list(self.enemies.items()):
            # --- ADD FREEZE CHECK ---
            if now < enemy.get('freeze_until', 0):
                continue # Skip ALL updates for this enemy if frozen
            # --- END FREEZE CHECK ---

            # Skip dead/fading enemies
            if enemy.get('health', 0) <= 0 or 'death_timestamp' in enemy:
                 continue

            # --- Target Finding ---
            target = min(alive_players, key=lambda p: distance_sq(enemy['x'], enemy['y'], p['x'], p['y']), default=None)
            if not target: continue
            dx, dy = target['x'] - enemy['x'], target['y'] - enemy['y']
            dist_sq = dx * dx + dy * dy
            # --- End Target Finding ---

            # --- MOVEMENT LOGIC ---
            enemy_w_half = enemy.get('width', ENEMY_DEFAULTS['width']) / 2
            target_w_half = target.get('width', PLAYER_DEFAULTS['width']) / 2
            stop_distance_sq = (target_w_half + enemy_w_half + 5)**2
            enemy_type = enemy.get('type', ENEMY_TYPE_CHASER)
            if enemy_type == ENEMY_TYPE_SHOOTER:
                 stop_distance_sq = max(stop_distance_sq, enemy.get('shoot_range_sq', ENEMY_DEFAULTS['shoot_range_sq']) * 0.6)

            if dist_sq > stop_distance_sq:
                dist = math.sqrt(dist_sq)
                speed_mod = 1.3 if self.is_night else 1.0
                speed = enemy.get('speed', ENEMY_DEFAULTS['speed'])
                move_dist = speed * speed_mod * delta_time
                vx, vy = (dx / dist) * move_dist, (dy / dist) * move_dist
                new_x = enemy['x'] + vx; new_y = enemy['y'] + vy
                e_h_half = enemy.get('height', ENEMY_DEFAULTS['height']) / 2 # Use local var name
                enemy['x'] = max(enemy_w_half, min(self.canvas_width - enemy_w_half, new_x))
                enemy['y'] = max(e_h_half, min(self.canvas_height - e_h_half, new_y))
            # --- End Movement Logic ---

            # --- SHOOTING LOGIC (Only for Shooters) ---
            if enemy_type == ENEMY_TYPE_SHOOTER:
                shoot_range_sq = enemy.get('shoot_range_sq', ENEMY_DEFAULTS['shoot_range_sq'])
                shoot_cooldown = enemy.get('shoot_cooldown', ENEMY_DEFAULTS['shoot_cooldown'])
                last_shot = enemy.get('last_shot_time', 0)

                if dist_sq <= shoot_range_sq and (now - last_shot) > shoot_cooldown:
                    # Re-calculate dist if not done during movement phase
                    dist = math.sqrt(dist_sq)
                    if dist < 0.01: continue # Safety check

                    bullet_speed = enemy.get('bullet_speed', ENEMY_BULLET_DEFAULTS['speed'])
                    bullet_vx = (dx / dist) * bullet_speed
                    bullet_vy = (dy / dist) * bullet_speed
                    bullet_radius = ENEMY_BULLET_DEFAULTS['radius']
                    offset = enemy_w_half + bullet_radius + 2
                    start_x = enemy['x'] + (dx/dist) * offset
                    start_y = enemy['y'] + (dy/dist) * offset

                    b_id = generate_id()
                    self.bullets[b_id] = {
                        'id': b_id, 'x': start_x, 'y': start_y, 'vx': bullet_vx, 'vy': bullet_vy,
                        'owner_id': enemy_id, 'owner_type': 'enemy',
                        'damage': enemy.get('bullet_damage', ENEMY_BULLET_DEFAULTS['damage']),
                        'spawn_time': now,
                        'lifetime': enemy.get('bullet_lifetime', ENEMY_BULLET_DEFAULTS['lifetime']),
                        'radius': bullet_radius,
                        'bullet_type': ENEMY_BULLET_DEFAULTS['bullet_type']
                    }
                    enemy['last_shot_time'] = now
            # --- End Shooting Logic ---

    # --- End of _update_enemies function ---
    
    def _update_enemy_speech(self, delta_time):
        # --- CLEAR PREVIOUS SPEECH AT THE START OF THE UPDATE ---
        self.active_enemy_speech_id = None
        self.current_enemy_speech = None
        # -------------------------------------------------------

        self.enemy_speech_timer += delta_time

        # Only check if game is active
        if self.status != 'active':
             self.enemy_speech_timer = 0.0 # Reset timer if game not active
             return

        if self.enemy_speech_timer >= self.enemy_speech_cooldown:
            log_game.debug(f"Enemy speech cooldown met ({self.enemy_speech_timer:.2f}s). Checking chance...") # Log before reset
            self.enemy_speech_timer = 0.0 # Reset timer regardless of chance success

            if random.random() < self.enemy_speech_chance:
                log_game.debug("Enemy speech chance succeeded. Selecting speaker...")
                alive_enemies = [e for e in self.enemies.values() if e.get('health', 0) > 0]
                if alive_enemies:
                    speaker = random.choice(alive_enemies)
                    speaker_type = speaker.get('type', ENEMY_TYPE_CHASER)

                    # Build potential speech pool
                    speech_pool = list(self.potential_speech_generic) # Start with generic
                    if speaker_type == ENEMY_TYPE_SHOOTER:
                        speech_pool.extend(self.potential_speech_shooter)

                    # --- TODO: Add Armor Check Here if desired ---
                    # target_player = # Need logic to find speaker's target
                    # if target_player and target_player.get('armor', 0) > 0:
                    #    speech_pool.extend(self.potential_speech_armor)
                    # -------------------------------------------

                    if speech_pool:
                        chosen_phrase = random.choice(speech_pool)
                        # --- SET SPEECH FOR THIS TICK ---
                        self.active_enemy_speech_id = speaker['id']
                        self.current_enemy_speech = chosen_phrase
                        # ---------------------------------
                        log_game.debug(f"Enemy {speaker['id']} (Type: {speaker_type}) speaking: '{chosen_phrase}'")
                    else:
                        log_game.debug(f"No speech lines available for enemy {speaker['id']} type {speaker_type}.")
                else:
                    log_game.debug("Speech chance succeeded, but no alive enemies to speak.")
            else:
                 log_game.debug("Enemy speech chance failed.")
           # No else needed, timer is reset above if cooldown met

    def _update_bullets(self, delta_time):
        now = time.time()
        bullets_to_remove = [] # Use a list for simpler append

        for bullet_id, bullet in list(self.bullets.items()): # Iterate over a copy of items for safe modification
            # Check lifetime first
            # Use the specific bullet's lifetime if available, else the default
            bullet_lifetime = bullet.get('lifetime', BULLET_DEFAULTS['lifetime'])
            if (now - bullet.get('spawn_time', now)) > bullet_lifetime:
                bullets_to_remove.append(bullet_id)
                continue # Skip further processing if expired

            # Update position
            bullet['x'] += bullet.get('vx', 0) * delta_time
            bullet['y'] += bullet.get('vy', 0) * delta_time

            # Check bounds
            radius = bullet.get('radius', BULLET_DEFAULTS['radius'])
            if (bullet['x'] < -radius or bullet['x'] > self.canvas_width + radius or
                bullet['y'] < -radius or bullet['y'] > self.canvas_height + radius):
                 bullets_to_remove.append(bullet_id)

        # Remove bullets marked for removal
        for bullet_id in bullets_to_remove:
            self.bullets.pop(bullet_id, None)


    def _get_current_enemy_spawn_interval(self):
        # Ensure level doesn't make interval too short or negative
        return max(0.5, ENEMY_SPAWN_INTERVAL - (self.level * 0.15))

    def _spawn_entities(self, delta_time):
        # --- Enemy Spawning (Only during the Day) ---
        if not self.is_night:
            self.enemy_spawn_timer -= delta_time
            if self.enemy_spawn_timer <= 0:
                # Spawn at edges, not center
                side = random.choice(['top', 'bottom', 'left', 'right'])
                margin = 30  # Spawn outside playable area
                if side == 'top':
                    x = random.uniform(0, self.canvas_width)
                    y = -margin
                elif side == 'bottom':
                    x = random.uniform(0, self.canvas_width)
                    y = self.canvas_height + margin
                elif side == 'left':
                    x = -margin
                    y = random.uniform(0, self.canvas_height)
                else:  # right
                    x = self.canvas_width + margin
                    y = random.uniform(0, self.canvas_height)

                # Check if the spawn position collides with any player
                player = next(iter(self.players.values()), None)
                if player and check_aabb_collision({'x': x, 'y': y, 'width': ENEMY_DEFAULTS['width']}, player):
                    return  # Skip spawn if colliding with player

                # Proceed to spawn the enemy
                enemy_id = generate_id()
                self.enemies[enemy_id] = {
                    **ENEMY_DEFAULTS,
                    'id': enemy_id,
                    'x': x,
                    'y': y,
                    'health': ENEMY_DEFAULTS['max_health'],
                    'type': ENEMY_TYPE_CHASER,  # Default to chaser
                }
                self.enemy_spawn_timer = ENEMY_SPAWN_INTERVAL

                # --- CHOOSE ENEMY TYPE ---
                enemy_type = random.choices(
                     [ENEMY_TYPE_CHASER, ENEMY_TYPE_SHOOTER],
                     weights=[0.6, 0.4], # 60% chance chaser, 40% shooter (adjust as needed)
                     k=1
                )[0]

                # Adjust base stats based on level
                base_health = ENEMY_DEFAULTS['max_health']
                base_damage = ENEMY_DEFAULTS['damage'] # Melee damage
                base_speed = ENEMY_DEFAULTS['speed']

                e_health = base_health + (self.level - 1) * 8
                e_damage = base_damage + (self.level - 1) * 2
                e_speed = base_speed + (self.level - 1) * 3

                # Shooter specific stat adjustments (applied AFTER level scaling)
                if enemy_type == ENEMY_TYPE_SHOOTER:
                    e_speed *= 0.8 # Shooters are slower
                    e_health *= 1.1 # Shooters are tougher
                    # Shooter bullet damage/speed/etc are defined in ENEMY_DEFAULTS and ENEMY_BULLET_DEFAULTS
                    # The base 'damage' field here still represents their melee damage if player gets too close

                self.enemies[enemy_id] = {
                    **ENEMY_DEFAULTS, # Start with defaults (includes shooter-specific keys like shoot_cooldown)
                    'id': enemy_id, 'x': x, 'y': y,
                    'health': e_health, 'max_health': e_health,
                    'damage': e_damage, # This is the melee damage
                    'speed': e_speed,
                    'type': enemy_type, # <-- Set the type
                    'last_shot_time': 0 # Initialize for shooters
                    # Other shooter params like bullet_damage, bullet_speed, shoot_range_sq use defaults unless overridden
                }
                log_game.debug(f"[{self.game_id}] Spawned enemy {enemy_id} (Type: {enemy_type}) at level {self.level}")
        else:
            # Reset timer if it went negative during the night
            if self.enemy_spawn_timer < 0:
                 self.enemy_spawn_timer = self._get_current_enemy_spawn_interval()


        # --- Powerup Spawning (Continues day and night) ---
        self.powerup_spawn_timer -= delta_time
        if self.powerup_spawn_timer <= 0:
            self.powerup_spawn_timer = POWERUP_SPAWN_INTERVAL + random.uniform(-2.0, 2.0)
            # Limit max powerups on screen
            if len(self.powerups) < 5:
                 pu_id = generate_id(); p_type = random.choice(POWERUP_TYPES)
                 # Ensure powerups spawn within visible bounds
                 pu_x = random.uniform(POWERUP_DEFAULTS['size'], self.canvas_width - POWERUP_DEFAULTS['size'])
                 pu_y = random.uniform(POWERUP_DEFAULTS['size'], self.canvas_height - POWERUP_DEFAULTS['size'])
                 self.powerups[pu_id] = {
                     **POWERUP_DEFAULTS, 'id': pu_id,
                     'x': pu_x, 'y': pu_y, 'type': p_type
                 }
                 log_game.debug(f"[{self.game_id}] Spawned powerup {p_type} at ({pu_x:.0f}, {pu_y:.0f})")

    def _calculate_damage(self, base_damage, target_player):
        if not target_player: return base_damage
        try: armor = float(target_player.get('armor', 0))
        except (ValueError, TypeError): armor = 0.0

        # Ensure armor calculation doesn't lead to negative reduction
        armor = max(0.0, armor)

        # Calculate damage reduction factor (e.g., 100 armor = 75% reduction max)
        damage_reduction_factor = min(0.75, armor / 100.0)

        # Damage that gets through to health
        damage_taken_to_health = base_damage * (1.0 - damage_reduction_factor)

        # Damage absorbed by armor (armor takes less damage than health would)
        # Example: Armor absorbs 50% of the damage it blocks
        armor_damage_factor = 0.5
        damage_taken_to_armor = (base_damage * damage_reduction_factor) * armor_damage_factor

        # Reduce armor, ensuring it doesn't go below zero
        target_player['armor'] = max(0.0, armor - damage_taken_to_armor)

        # Return the damage dealt to health, ensuring it's not negative
        return max(0.0, damage_taken_to_health)



    def add_player(self, player_id):
        if player_id in self.players or len(self.players) >= self.max_players:
             log_game.warning(f"Add player {player_id} failed. Already present or game full ({len(self.players)}/{self.max_players}).")
             return False

        new_player = {
            **PLAYER_DEFAULTS,
            'id': player_id,
            'x': self.canvas_width / 2 + random.uniform(-25, 25),
            'y': self.canvas_height - 50,
            'input_vector': {'dx': 0, 'dy': 0},
            'effects': {},
            'cooldowns': {}
        }
        new_player['health'] = new_player.get('max_health', PLAYER_DEFAULTS['max_health'])
        new_player['speed'] = new_player.get('base_speed', PLAYER_DEFAULTS['base_speed'])
        new_player['player_status'] = PLAYER_STATUS_ALIVE

        self.players[player_id] = new_player

        log_game.info(f"[{self.game_id}] Player {player_id} added ({len(self.players)}/{self.max_players}).")
        if len(self.players) == self.max_players and self.status == 'waiting':
             self.start_countdown()
        return True

    def _update_player_effects(self, delta_time):
        now = time.time()
        for player in self.players.values():
            # Reset base speed (or other stats affected by expiring effects)
            player['speed'] = player.get('base_speed', PLAYER_DEFAULTS['base_speed'])

            if 'effects' not in player or not player['effects']:
                 continue

            expired_effects = [k for k, v in player['effects'].items()
                               if isinstance(v, dict) and 'expires_at' in v and now >= v['expires_at']]

            for k in expired_effects:
                log_game.debug(f"[{self.game_id}] Player {player['id']} effect '{k}' expired.")
                del player['effects'][k] # Remove the expired effect

            # Apply active effects
            if 'speed_boost' in player['effects']:
                effect_data = player['effects']['speed_boost']
                if isinstance(effect_data, dict) and 'value' in effect_data:
                     player['speed'] += effect_data.get('value', 0)
                    
        # --- Handle Special Ammo Expiration ---
        current_ammo = player.get('active_ammo_type', 'standard') # Default to standard
        # Check if it's one of the special types
        if current_ammo in ['ammo_shotgun', 'ammo_heavy_slug', 'ammo_rapid_fire']:
            expires_at = player.get('ammo_effect_expires_at', 0)
            # Check if timer is set (>0) and expired
            if expires_at > 0 and now >= expires_at:
                log_game.info(f"Player {player['id']} special ammo '{current_ammo}' expired.")
                player['active_ammo_type'] = 'standard' # Reset to standard
                player['ammo_effect_expires_at'] = 0.0 # Clear timer


    def _apply_powerup(self, player, powerup_type):
        if not player: return False
        now = time.time()
        value = POWERUP_VALUES.get(powerup_type, 0)
        duration = POWERUP_DEFAULTS.get('duration', 10.0)
        log_game.debug(f"Applying powerup '{powerup_type}' to player {player['id']}")

        if powerup_type == 'speed_boost':
            player.setdefault('effects', {})

        # Apply effect
        if powerup_type == 'health':
            player['health'] = min(player.get('max_health', PLAYER_DEFAULTS['max_health']), player.get('health', 0) + value)
        elif powerup_type == 'gun_upgrade':
            player['gun'] = min(5, player.get('gun', 1) + value)
        elif powerup_type == 'armor':
            player['armor'] = min(100, player.get('armor', 0) + value)
        elif powerup_type == 'speed_boost':
             player['effects']['speed_boost'] = {'value': value, 'expires_at': now + duration}
        else:
             log_game.warning(f"[{self.game_id}] Unknown powerup type collected: {powerup_type}")
             return True # Still remove unknown powerup from map

        return True



    def _check_collisions(self):
        bullets_to_remove = set()
        powerups_to_remove = set()
        now = time.time()

        # --- 1. Bullet Collisions ---
        for b_id, b in list(self.bullets.items()):
            if b_id in bullets_to_remove: continue

            # --- A. PLAYER Bullets vs Enemies ---
            if b.get('owner_type') == 'player':
                for e_id, e in list(self.enemies.items()):
                    # Skip check if enemy is dead/fading or bullet already hit something this tick
                    if e.get('health', 0) <= 0 or ('death_timestamp' in e) or b_id in bullets_to_remove:
                        continue

                    # Check collision (bullet vs enemy)
                    if check_aabb_collision(b, e):
                        # Calculate BASE damage
                        base_damage = b.get('damage', BULLET_DEFAULTS['damage'])

                        # --- Check for Critical Hit ---
                        is_crit = random.random() < PLAYER_CRIT_CHANCE
                        damage_dealt = base_damage * (PLAYER_CRIT_MULTIPLIER if is_crit else 1.0)
                        # --- End Crit Check ---

                        # Reduce enemy health
                        e['health'] -= damage_dealt
                        e['health'] = max(0.0, e['health']) # Clamp health at 0

                        # --- Create Damage Text ---
                        dmg_text_id = generate_id()
                        self.damage_texts[dmg_text_id] = {
                            'id': dmg_text_id,
                            'text': f"{damage_dealt:.0f}",
                            'x': e['x'] + random.uniform(-e['width']/4, e['width']/4),
                            'y': e['y'] - e['height']/2,
                            'spawn_time': now,
                            'lifetime': DAMAGE_TEXT_DEFAULTS['lifetime'] * (1.5 if is_crit else 1.0),
                            'speed_y': DAMAGE_TEXT_DEFAULTS['speed_y'],
                            'is_crit': is_crit
                        }
                        # --- End Damage Text Creation ---

                        # --- MARK BULLET FOR REMOVAL (CRITICAL FIX) ---
                        bullets_to_remove.add(b_id)
                        # --- END MARK BULLET ---

                        # Set the client hit flash flag (for client render pause)
                        owner_player = self.players.get(b.get('owner_id'))
                        if owner_player:
                            owner_player['hit_flash_this_tick'] = True

                        # --- ADD ENEMY FREEZE TIMESTAMP ---
                        e['freeze_until'] = now + ENEMY_FREEZE_DURATION
                        # --- END ADD ---

                        # Handle enemy death timestamp and score awarding
                        if e['health'] <= 0 and 'death_timestamp' not in e:
                            e['death_timestamp'] = time.time()
                            if owner_player:
                                enemy_score_value = e.get('score_value', ENEMY_DEFAULTS['score_value'])
                                owner_player['kills'] = owner_player.get('kills', 0) + 1
                                owner_player['score'] = owner_player.get('score', 0) + enemy_score_value
                                self.score += enemy_score_value
                        # --- End Enemy Death Handling ---

                        break # Bullet hits one enemy and is done for this tick

            # --- B. ENEMY Bullets vs Players ---
            elif b.get('owner_type') == 'enemy':
                 for p_id, p in list(self.players.items()):
                     # Skip dead/downed players or if bullet already hit something this tick
                     if p.get('player_status') != PLAYER_STATUS_ALIVE or b_id in bullets_to_remove:
                         continue
                     if check_aabb_collision(b, p):
                         damage_dealt = b.get('damage', ENEMY_BULLET_DEFAULTS['damage'])
                         damage_taken = self._calculate_damage(damage_dealt, p)
                         is_crit = False # Enemy bullets don't crit

                         p['health'] -= damage_taken
                         p['health'] = max(0.0, p['health'])

                         # --- MARK BULLET FOR REMOVAL ---
                         bullets_to_remove.add(b_id)
                         # --- END MARK BULLET ---

                         # Create Damage Text
                         dmg_text_id = generate_id()
                         self.damage_texts[dmg_text_id] = {
                             'id': dmg_text_id, 'text': f"{damage_taken:.0f}",
                             'x': p['x'] + random.uniform(-p['width']/4, p['width']/4),
                             'y': p['y'] - p['height']/2, 'spawn_time': now,
                             'lifetime': DAMAGE_TEXT_DEFAULTS['lifetime'],
                             'speed_y': DAMAGE_TEXT_DEFAULTS['speed_y'], 'is_crit': is_crit
                         }

                         # Handle player being downed
                         if p['health'] <= 0:
                            self._player_hit_zero_health(p_id)

                         break # Bullet hits one player

        # --- 2. Player vs Enemy Melee & Player vs Powerup ---
        for p_id, p in list(self.players.items()):
            if p.get('player_status') != PLAYER_STATUS_ALIVE:
                continue

            # A. Check Player vs Enemy Collisions (Melee)
            for e_id, e in list(self.enemies.items()):
                if e.get('health', 0) <= 0: continue

                if check_aabb_collision(p, e):
                    p.setdefault('cooldowns', {})
                    last_hit_time_key = f"last_hit_by_{e_id}"
                    last_hit_time = p['cooldowns'].get(last_hit_time_key, 0)
                    damage_cooldown = 0.5 # Prevent instant multi-hits from same enemy

                    if now - last_hit_time > damage_cooldown:
                        melee_damage = e.get('damage', ENEMY_DEFAULTS['damage'])
                        # Enemies don't crit (yet), pass player object for armor calc
                        damage_taken = self._calculate_damage(melee_damage, p)
                        is_crit = False # Enemy melee doesn't crit

                        p['health'] -= damage_taken
                        p['health'] = max(0.0, p['health'])
                        p['cooldowns'][last_hit_time_key] = now
                        log_game.debug(f"Player {p_id} MELEE hit by enemy {e_id}. Took {damage_taken:.1f} dmg. HP: {p['health']:.1f}, Armor: {p['armor']:.1f}")

                        # --- Create Damage Text (Enemy Melee Hit) ---
                        dmg_text_id = generate_id()
                        self.damage_texts[dmg_text_id] = {
                            'id': dmg_text_id,
                            'text': f"{damage_taken:.0f}",
                            'x': p['x'] + random.uniform(-p['width']/4, p['width']/4),
                            'y': p['y'] - p['height']/2,
                            'spawn_time': now,
                            'lifetime': DAMAGE_TEXT_DEFAULTS['lifetime'],
                            'speed_y': DAMAGE_TEXT_DEFAULTS['speed_y'],
                            'is_crit': is_crit # False for enemy hits
                        }
                        # --- End Damage Text Creation ---

                        if p['health'] <= 0:
                            self._player_hit_zero_health(p_id)


            # B. Check Player vs Powerup Collisions
            for pu_id, pu in list(self.powerups.items()):
                 # Skip if this powerup was already collected in this same collision check cycle
                 if pu_id in powerups_to_remove: continue

                 if check_aabb_collision(p, pu):
                     powerup_type = pu.get('type')

                     # --- Handle Special Ammo Types ---
                     if powerup_type in ['ammo_shotgun', 'ammo_heavy_slug', 'ammo_rapid_fire']:
                         p['active_ammo_type'] = powerup_type
                         p['ammo_effect_expires_at'] = now + SPECIAL_AMMO_DURATION
                         log_game.info(f"Player {p_id} activated {powerup_type} for {SPECIAL_AMMO_DURATION}s.")
                         powerups_to_remove.add(pu_id)

                     # --- Handle Bonus Score Type ---
                     elif powerup_type == 'bonus_score':
                         p['score'] = p.get('score', 0) + BONUS_SCORE_VALUE
                         self.score += BONUS_SCORE_VALUE
                         log_game.info(f"Player {p_id} collected bonus score: +{BONUS_SCORE_VALUE}. Player Score: {p['score']}, Game Score: {self.score}")
                         powerups_to_remove.add(pu_id)

                     # Calls the separate _apply_powerup function for health, armor, gun, speed
                     elif self._apply_powerup(p, powerup_type):
                          powerups_to_remove.add(pu_id)

                     # --- Handle Unknown Types ---
                     else:
                          log_game.warning(f"Unknown or unhandled powerup type collected: {powerup_type}")
                          powerups_to_remove.add(pu_id)

        # --- 3. Final Cleanup ---

        for b_id in bullets_to_remove:
            self.bullets.pop(b_id, None) 

        for pu_id in powerups_to_remove:
            self.powerups.pop(pu_id, None) 

    def _cleanup_entities(self):
        """Removes entities that have fully faded out after death."""
        now = time.time()
        enemies_to_fully_remove = []

        for eid, e in list(self.enemies.items()): # Iterate safely
            # Check if the enemy has a death timestamp and the fade duration has passed
            if 'death_timestamp' in e and (now - e['death_timestamp']) > ENEMY_FADE_DURATION:
                enemies_to_fully_remove.append(eid)

        # Remove the fully faded enemies
        for eid in enemies_to_fully_remove:
            self.enemies.pop(eid, None)
            #log_game.debug(f"Fully removed faded enemy {eid}") # Optional log

    def _update_damage_texts(self, delta_time):
        """Updates position and lifetime of floating damage numbers."""
        now = time.time()
        texts_to_remove = []
        for text_id, text_data in list(self.damage_texts.items()): # Iterate over items safely
            # Update lifetime check
            if (now - text_data.get('spawn_time', now)) > text_data.get('lifetime', DAMAGE_TEXT_DEFAULTS['lifetime']):
                texts_to_remove.append(text_id)
                continue

            # Update position (move upwards)
            text_data['y'] += text_data.get('speed_y', DAMAGE_TEXT_DEFAULTS['speed_y']) * delta_time

        # Remove expired texts
        for text_id in texts_to_remove:
            self.damage_texts.pop(text_id, None)
            
    def _player_hit_zero_health(self, player_id):
        player = self.players.get(player_id)
        if not player or player.get('player_status') != PLAYER_STATUS_ALIVE:
            return

        log_game.info(f"Player {player_id} health reached zero.")
        player['player_status'] = PLAYER_STATUS_DOWN
        player['health'] = 0
        player['input_vector'] = {'dx': 0, 'dy': 0}

        is_teammate_alive = False
        for other_p_id, other_p in self.players.items():
            if other_p_id == player_id:
                continue
            if other_p.get('player_status') == PLAYER_STATUS_ALIVE:
                is_teammate_alive = True
                break

        now = time.time()
        if is_teammate_alive:
            down_duration = 45.0
            player['down_timer_expires_at'] = now + down_duration
            player['will_revive_on_timer'] = True
            log_game.info(f"Player {player_id} DOWN. Teammate alive. Setting {down_duration}s revive timer.")
        else:
            down_duration = 3.0
            player['down_timer_expires_at'] = now + down_duration
            player['will_revive_on_timer'] = False
            log_game.info(f"Player {player_id} DOWN. No teammate alive. Setting {down_duration}s death timer.")

    def _update_player_statuses(self, delta_time):
        """Checks timers for downed players and sets status to ALIVE or DEAD based on the 'will_revive_on_timer' flag."""
        now = time.time()

        for p_id, p in self.players.items():
            if p.get('player_status') == PLAYER_STATUS_DOWN:
                expires_at = p.get('down_timer_expires_at', 0)

                # Check if the timer is set (non-zero) and has expired
                if expires_at > 0 and now >= expires_at:
                    will_revive = p.get('will_revive_on_timer', False) # Default to not reviving if flag missing

                    if will_revive:
                        # --- REVIVE LOGIC ---
                        log_game.info(f"Player {p_id}'s down timer expired. Reviving player.")
                        p['player_status'] = PLAYER_STATUS_ALIVE # Set back to alive
                        # Restore health (e.g., to half max health)
                        p['health'] = p.get('max_health', PLAYER_DEFAULTS['max_health']) / 2
                        p['down_timer_expires_at'] = 0.0 # Clear timer
                        p.pop('will_revive_on_timer', None) # Clean up the flag
                        log_game.info(f"Player {p_id} revived with {p['health']:.1f} HP.")
                        # --- END REVIVE LOGIC ---
                    else:
                        # --- DEATH LOGIC ---
                        log_game.info(f"Player {p_id}'s down timer expired. Setting status to DEAD.")
                        p['player_status'] = PLAYER_STATUS_DEAD # Set to DEAD
                        p['down_timer_expires_at'] = 0.0 # Clear timer
                        p.pop('will_revive_on_timer', None) # Clean up the flag
                        # Game over check happens separately in _perform_game_over_check

    def _perform_game_over_check(self):
        """
        Checks if the game should end because ALL players are DEAD.
        Runs periodically (e.g., every second).
        """
        if self.status != 'active' or not self.players:
            return # Only check active games with players

        num_players_dead = 0
        total_players = len(self.players)

        for p_id, p in self.players.items():
            status = p.get('player_status', PLAYER_STATUS_DEAD) # Default to dead if status missing
            if status == PLAYER_STATUS_DEAD:
                num_players_dead += 1

        # Game over ONLY if the number of DEAD players equals the total number of players
        if num_players_dead >= total_players:
            log_game.info(f"[{self.game_id}] Periodic Game Over Check: Condition met ({num_players_dead}/{total_players} players DEAD). Finishing game.")
            self.finish_game("All players eliminated")
        # else:
            # log_game.debug(f"Periodic Game Over Check: Condition not met ({num_players_dead}/{total_players} players DEAD).") # Optional debug


    def handle_pushback(self, player_id):
        """Handles a pushback request from a player."""
        player = self.players.get(player_id)
        if not player or self.status != 'active' or player.get('player_status') != PLAYER_STATUS_ALIVE:
            log_game.debug(f"Pushback ignored for {player_id}: Player invalid, game inactive, or player not alive.")
            return

        now = time.time()
        cooldowns = player.setdefault('cooldowns', {}) # Ensure cooldowns dict exists
        pushback_ready_at = cooldowns.get('pushback_ready_at', 0)

        if now >= pushback_ready_at:
            log_game.debug(f"Player {player_id} activating pushback.")
            player_x, player_y = player['x'], player['y']
            pushed_something = False # Flag to track if anything was pushed

            # --- Push Nearby Enemies ---
            for enemy_id, enemy in list(self.enemies.items()): # Iterate safely
                if enemy.get('health', 0) <= 0: continue # Skip dead enemies

                enemy_x, enemy_y = enemy['x'], enemy['y']
                dist_sq = distance_sq(player_x, player_y, enemy_x, enemy_y)

                if dist_sq <= PUSHBACK_RANGE_SQ:
                    # Calculate push vector (from player TO enemy)
                    dx, dy = enemy_x - player_x, enemy_y - player_y
                    if dist_sq < 0.01: # Avoid division by zero if exactly overlapping
                        dx, dy = 1, 0 # Push right as a default? Or random?
                        dist = 1.0
                    else:
                        dist = math.sqrt(dist_sq)

                    norm_dx, norm_dy = dx / dist, dy / dist

                    # Apply push directly to enemy position
                    new_enemy_x = enemy_x + norm_dx * PUSHBACK_FORCE
                    new_enemy_y = enemy_y + norm_dy * PUSHBACK_FORCE

                    # Clamp to canvas bounds
                    e_w_half = enemy.get('width', ENEMY_DEFAULTS['width']) / 2
                    e_h_half = enemy.get('height', ENEMY_DEFAULTS['height']) / 2
                    enemy['x'] = max(e_w_half, min(self.canvas_width - e_w_half, new_enemy_x))
                    enemy['y'] = max(e_h_half, min(self.canvas_height - e_h_half, new_enemy_y))
                    log_game.debug(f" -> Pushed enemy {enemy_id}")
                    pushed_something = True

            # --- Push Nearby Teammate ---
            for other_player_id, other_player in self.players.items():
                # Skip self, skip non-alive players
                if other_player_id == player_id or other_player.get('player_status') != PLAYER_STATUS_ALIVE:
                    continue

                other_x, other_y = other_player['x'], other_player['y']
                dist_sq = distance_sq(player_x, player_y, other_x, other_y)

                if dist_sq <= PUSHBACK_RANGE_SQ:
                    # Calculate push vector (from player TO other_player)
                    dx, dy = other_x - player_x, other_y - player_y
                    if dist_sq < 0.01:
                        dx, dy = 1, 0
                        dist = 1.0
                    else:
                        dist = math.sqrt(dist_sq)

                    norm_dx, norm_dy = dx / dist, dy / dist

                    # Apply push directly to teammate's position
                    new_other_x = other_x + norm_dx * PUSHBACK_FORCE
                    new_other_y = other_y + norm_dy * PUSHBACK_FORCE

                    # Clamp to canvas bounds
                    o_w_half = other_player.get('width', PLAYER_DEFAULTS['width']) / 2
                    o_h_half = other_player.get('height', PLAYER_DEFAULTS['height']) / 2
                    other_player['x'] = max(o_w_half, min(self.canvas_width - o_w_half, new_other_x))
                    other_player['y'] = max(o_h_half, min(self.canvas_height - o_h_half, new_other_y))
                    log_game.debug(f" -> Pushed teammate {other_player_id}")
                    pushed_something = True
                    # Only push one teammate per activation? Probably fine to push all in range.

            # --- Apply Cooldown ---
            if pushed_something: # Only apply cooldown if the push actually affected something? Or always? Let's apply always.
                 cooldowns['pushback_ready_at'] = now + PUSHBACK_COOLDOWN_DURATION
                 # log_game.debug(f"Pushback cooldown applied to {player_id}. Ready at {cooldowns['pushback_ready_at']:.2f}")
            else:
                 log_game.debug(f"Player {player_id} used pushback but nothing was in range.")
                 # Apply a shorter cooldown if nothing was hit? For now, full cooldown.
                 cooldowns['pushback_ready_at'] = now + PUSHBACK_COOLDOWN_DURATION

        else:
            # Cooldown active, do nothing (maybe log for debugging)
            # log_game.debug(f"Pushback attempt by {player_id} ignored, cooldown active. Ready in {pushback_ready_at - now:.1f}s")
            pass


    def get_state(self):
        state = {'game_id': self.game_id, 'status': self.status, 'players': self.players,
                 'enemies': self.enemies, 'bullets': self.bullets, 'powerups': self.powerups,
                 'damage_texts': self.damage_texts,
                 'score': self.score, 'is_night': self.is_night,
                 'game_over': self.status == 'finished', 'host_id': self.host_id, 'timestamp': time.time(),
                 'day_night_timer_remaining': max(0.0, self.day_night_timer),
                 'enemy_speaker_id': self.active_enemy_speech_id,
                 'enemy_speech_text': self.current_enemy_speech,
                 'max_players': self.max_players,
                 # --- ADD CAMPFIRE INFO ---
                 'campfire': {
                     'x': self.campfire_x,
                     'y': self.campfire_y,
                     'radius': self.campfire_radius,
                     'active': self.is_night # Send active status based on night
                 }
                }
        if self.status == 'countdown': state['countdown'] = max(0.0, self.countdown_timer)
        return state

# --- Network Server ---
class KellyGangGameServer:
    def __init__(self):
        self.games = {}
        self.clients = {}
        self.player_to_game = {}
        self.high_scores = load_high_scores()
        log_net.info("Network Server initialized")


    async def _send_string_to_player(self, target_identifier, message_string):
        """Sends a string message to a target (player_id string or ws object)."""
        ws = None
        player_id = None
        lookup_method = "N/A"

        if isinstance(target_identifier, str): # Target is a player_id string
            player_id = target_identifier
            lookup_method = f"Dict Lookup (PID: {player_id[:6]})"
            ws = self.clients.get(player_id) # <<<< PRIMARY LOOKUP METHOD
            if ws is None:
                log_net.warning(f"Send failed for {lookup_method}: WebSocket not found in self.clients.")
                return False
        elif isinstance(target_identifier, web.WebSocketResponse): # Target is a ws object directly
            ws = target_identifier
            # Find player_id for logging ONLY - DO NOT use for lookup here
            found_pid = next((pid for pid, client_ws in self.clients.items() if client_ws == ws), None)
            player_id = found_pid # Store if found, remains None otherwise
            lookup_method = f"Direct WS (Associated PID: {player_id[:6] if player_id else 'None'})"
            # We already have the ws object, no need for further lookup based on PID here
        else:
            log_net.error(f"Send failed: Invalid target_identifier type: {type(target_identifier)}")
            return False

        # --- At this point, 'ws' should be the correct WebSocketResponse object ---
        # --- OR it's None because the PID lookup failed initially             ---

        if not ws:
             # This should only be reachable if the initial PID lookup failed
             log_net.warning(f"Send failed ({lookup_method}): WebSocket object is None.")
             return False

        # --- Check WebSocket state and send ---
        log_net.debug(f"Send Check ({lookup_method}): WS Closed? {ws.closed}") # Add detailed check
        if not ws.closed:
            try:
                log_net.debug(f"Attempting send_str via {lookup_method}")
                await ws.send_str(message_string)
                # log_net.debug(f"Send successful via {lookup_method}.")
                return True
            except ConnectionResetError:
                log_net.warning(f"Send failed ({lookup_method}): ConnectionResetError.")
                if player_id: # Only handle disconnect if we know the player_id
                    asyncio.create_task(self.handle_disconnect(player_id))
                return False
            except Exception as e:
                log_net.error(f"Send failed ({lookup_method}): Exception during send: {e}", exc_info=False)
                return False
        else:
            log_net.warning(f"Send failed ({lookup_method}): WebSocket was already closed.")
            if player_id: # Ensure cleanup if we know the player_id
                self.clients.pop(player_id, None)
                self.player_to_game.pop(player_id, None)
            return False

    async def _send_dict_to_player(self, target_identifier, message_data):
        """Serializes dict and sends using _send_string_to_player."""
        player_id_for_log = 'UnknownTarget'
        if isinstance(target_identifier, str):
            player_id_for_log = target_identifier[:6]
        elif isinstance(target_identifier, web.WebSocketResponse):
             found_pid = next((pid for pid, client_ws in self.clients.items() if client_ws == target_identifier), None)
             player_id_for_log = found_pid[:6] if found_pid else 'WS_Obj'
        else:
             player_id_for_log = 'InvalidTarget'

        try:
            message_string = json.dumps(message_data)
            # Pass the original target (string or ws object)
            return await self._send_string_to_player(target_identifier, message_string)
        except Exception as e:
            log_net.error(f"Serialization failed for {player_id_for_log} before send: {e}")
            return False

    async def on_game_finished_internal_callback(self, finished_game_object):
        """Callback function passed to Game instances when they finish."""
        game_id = finished_game_object.game_id
        log_net.info(f"Internal Callback: Game {game_id} reported finished. Checking scores...")

        final_state = finished_game_object.get_state()
        if not final_state or 'players' not in final_state:
            log_net.warning(f"Game {game_id} finished but final state or players dict is missing.")
            return

        players_data = final_state.get('players', {})
        game_max_players = finished_game_object.max_players # Get max players for this game

        log_net.debug(f"Checking scores for {len(players_data)} players in finished game {game_id}.")

        # Check each player's score
        for player_id, player_data in players_data.items():
            score = player_data.get('score', 0)
            log_net.debug(f" -> Checking P:{player_id[:6]}, Score: {score}") # Log shortened ID
            # Call the helper function to check qualification and potentially send request
            await self.check_and_request_highscore(player_id, score, game_max_players)

    async def check_and_request_highscore(self, player_id, score, game_max_players):
        """Checks if a score qualifies for high scores and requests name if it does."""
        if not isinstance(score, (int, float)) or score <= 0:
            # log_net.debug(f"Score {score} for player {player_id[:6]} is invalid or zero, skipping highscore check.")
            return # Ignore zero or invalid scores

        # Ensure high scores are sorted before checking
        self.high_scores.sort(key=operator.itemgetter('score'), reverse=True)

        qualifies = False
        if len(self.high_scores) < MAX_HIGHSCORES:
            qualifies = True # List isn't full yet
            log_net.info(f"Score {score} for player {player_id[:6]} qualifies (list < {MAX_HIGHSCORES}).")
        else:
            lowest_highscore = self.high_scores[-1]['score']
            if score > lowest_highscore:
                qualifies = True
                log_net.info(f"Score {score} for player {player_id[:6]} qualifies (beats lowest: {lowest_highscore}).")
            # else:
                # log_net.debug(f"Score {score} for player {player_id[:6]} does not qualify (lowest: {lowest_highscore}).")

        if qualifies:
            # Send request to the specific player
            log_net.info(f"Sending highscore name request to player {player_id[:6]} for score {score} (MaxP: {game_max_players}).")
            payload = {
                'type': 'request_highscore_name',
                'score': score,
                'max_players': game_max_players # Send game size with the request
            }
            # Use _send_dict_to_player which handles checking if client exists/is open
            success = await self._send_dict_to_player(player_id, payload)
            if not success:
                log_net.warning(f"Failed to send highscore name request to player {player_id[:6]} (likely disconnected).")


    async def broadcast_state_callback(self, game_id, message_data):
        game = self.games.get(game_id)
        if not game: return
        # Get current players directly from the game instance for broadcasting
        current_player_ids = list(game.players.keys())
        if not current_player_ids: return

        message_str = None
        try:
            message_str = json.dumps(message_data)
        except Exception as e:
            log_net.error(f"Broadcast serialization failed for GID {game_id}: {e}", exc_info=True)
            return

        # Create send tasks only for players currently in the game instance
        tasks = [self._send_string_to_player(p_id, message_str) for p_id in current_player_ids]
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            failed_count = sum(1 for r in results if r is False or isinstance(r, Exception))
            if failed_count > 0:
                 log_net.debug(f"Broadcast for {game_id}: {failed_count}/{len(tasks)} sends failed (possible disconnects).")


    async def close_client_connection(self, player_id, code=1000, reason="Server request"):
        ws = self.clients.pop(player_id, None) # Remove from clients dict first
        if ws and not ws.closed:
            try:
                log_net.info(f"Closing WS for {player_id}. Code: {code}, Reason: {reason}")
                await ws.close(code=code, message=reason.encode('utf-8'))
            except Exception as e: log_net.error(f"Error closing WS for {player_id}: {e}")
        # Player association is removed in handle_disconnect

    async def create_single_player_game(self, ws):
        """
        Creates a single-player game instance, registers the player and game,
        sends confirmation, and only starts the game loop if confirmation succeeds.
        """
        player_id = generate_id()
        game_id = f"SP_{generate_id()[:5].upper()}"
        log_net.info(f"Attempting SP Create: GID={game_id}, PID={player_id}")

        game = None
        registration_done = False
        confirmation_sent_successfully = False # Flag to track success

        try:
            # 1. Create Game Instance and Add Player
            game = Game(
                game_id=game_id,
                host_id=player_id,
                broadcast_state_callback=self.broadcast_state_callback,
                on_game_finished_callback=self.on_game_finished_internal_callback,
                max_players=1 # Single player game always has max_players=1
            )
            if not game.add_player(player_id):
                # This should theoretically not fail for a new game with max_players=1
                raise RuntimeError("Unexpected error: Failed to add player to new SP game.")

            # 2. Immediately Set Game to Active (SP specific)
            game.status = 'active'
            game.level = 1
            player = game.players[player_id]
            player.update({
                'health': player.get('max_health', PLAYER_DEFAULTS['max_health']),
                'kills': 0, 'score': 0, 'gun': 1, 'armor': 0,
                'speed': player.get('base_speed', PLAYER_DEFAULTS['base_speed']),
                'effects': {}, 'input_vector': {'dx': 0, 'dy': 0}, 'cooldowns': {}
            })
            log_game.info(f"[{game.game_id}] SP Game instance immediately set to active.")

            # 3. Register Game and Client Associations *Before* Sending Confirmation
            self.games[game_id] = game
            self.clients[player_id] = ws
            self.player_to_game[player_id] = game_id
            registration_done = True
            log_net.debug(f"SP Game {game_id} registered internally for {player_id}.")

            # 4. Send Confirmation Payload and Check Success
            payload = {
                'type': 'sp_game_started',
                'game_id': game_id,
                'player_id': player_id,
                'initial_state': game.get_state()
            }
            try:
                # --- NEW CODE: Send directly ---
                await ws.send_str(json.dumps(payload))
                confirmation_sent_successfully = True
                # --- END NEW CODE ---
            except Exception as send_err:
                log_net.error(f"Direct send failed during game_created for {player_id}: {send_err}")
                confirmation_sent_successfully = False

            # 5. Start Loop *Only If* Confirmation Succeeded
            if confirmation_sent_successfully:
                log_net.info(f"Sent sp_game_started confirmation successfully to {player_id}")
                # Create and store the game loop task
                game.loop_task = asyncio.create_task(game.run_game_loop())
                log_net.info(f"SP Game {game_id} loop task created for {player_id}.")
                # Return the necessary info for the websocket handler
                return {'game_id': game_id, 'player_id': player_id}
            else:
                # Handle Confirmation Send Failure
                log_net.warning(f"FAILED to send sp_game_started confirmation to {player_id}. Aborting loop start and cleaning up registration.")
                # The failed send likely triggered handle_disconnect already, but clean up game object explicitly.
                self.games.pop(game_id, None)
                # player_to_game and clients should have been cleaned by handle_disconnect
                return None # Indicate failure to the websocket handler

        except Exception as e:
            log_net.error(f"EXCEPTION during create_single_player_game GID={game_id}/PID={player_id}: {e}", exc_info=True)
            # --- Rollback Logic ---
            if game:
                # If game exists, ensure it's marked finished, regardless of loop start attempt
                game.finish_game("SP Create/Confirm Error")
                # Attempt to cancel loop task if it somehow got created before the exception
                if game.loop_task and not game.loop_task.done():
                    game.loop_task.cancel()

            # Clean up server-side associations if registration occurred
            if registration_done:
                self.games.pop(game_id, None)
                self.clients.pop(player_id, None)
                self.player_to_game.pop(player_id, None)

            # Attempt to close the WebSocket connection if it's still open
            if ws and not ws.closed:
                try:
                    await ws.close(code=1011, message=b"SP game creation failed")
                except Exception as close_err:
                    log_net.error(f"Error closing WS after SP creation failure for {player_id}: {close_err}")

            return None # Indicate failure

#--------------------------------------------------------------------------

    async def create_game(self, ws, requested_max_players):
        """
        Creates a multiplayer game instance, validates max players, registers host,
        sends confirmation, and only starts the game loop if confirmation succeeds.
        """
        player_id = generate_id()
        game_id = f"MP_{generate_id()[:5].upper()}"
        log_net.info(f"Attempting MP Create: GID={game_id}, PID={player_id}, Requested MaxP={requested_max_players}")

        # 1. Validate requested_max_players
        validated_max_players = None
        try:
            req_max_int = int(requested_max_players)
            if 2 <= req_max_int <= MAX_PLAYERS:
                validated_max_players = req_max_int
                log_net.debug(f"Validated max_players for {game_id} as {validated_max_players}")
            else:
                raise ValueError(f"Requested max_players ({req_max_int}) out of range [2, {MAX_PLAYERS}]")
        except (ValueError, TypeError) as val_err:
            log_net.warning(f"MP Create Rejected for {player_id} -> {game_id}: Invalid max_players requested ('{requested_max_players}'). Error: {val_err}")
            error_msg = f"Invalid max players requested. Must be between 2 and {MAX_PLAYERS}."
            try:
                await ws.send_str(json.dumps({'type': 'error', 'message': error_msg}))
            except Exception as send_err:
                log_net.error(f"Failed to send MP create rejection error to {player_id}: {send_err}")
            # Close connection for invalid request
            if not ws.closed:
                try: await ws.close(code=1008, message=error_msg.encode('utf-8'))
                except Exception: pass
            return None # Stop creation process

        # Proceed with validated_max_players
        game = None
        registration_done = False
        confirmation_sent_successfully = False # Flag for tracking

        try:
            # 2. Create Game Instance and Add Host Player
            game = Game(
                game_id=game_id,
                host_id=player_id,
                broadcast_state_callback=self.broadcast_state_callback,
                on_game_finished_callback=self.on_game_finished_internal_callback,
                max_players=validated_max_players # Use validated number
            )
            if not game.add_player(player_id):
                # Should not fail for the first player if max_players >= 1
                raise RuntimeError(f"Unexpected error: Failed to add host player {player_id} to new MP game {game_id}.")

            # 3. Register Game and Client Associations *Before* Sending Confirmation
            self.games[game_id] = game
            self.clients[player_id] = ws
            self.player_to_game[player_id] = game_id
            registration_done = True
            log_net.debug(f"MP Game {game_id} registered internally for host {player_id}.")

            # 4. Send Confirmation Payload and Check Success
            payload = {
                'type': 'game_created',
                'game_id': game_id,
                'player_id': player_id,
                'initial_state': game.get_state(),
                'max_players': game.max_players # Send the actual max_players of the created game
            }
            try:
                # --- NEW CODE: Send directly ---
                await ws.send_str(json.dumps(payload))
                confirmation_sent_successfully = True
                # --- END NEW CODE ---
            except Exception as send_err:
                log_net.error(f"Direct send failed during sp_game_started for {player_id}: {send_err}")
                confirmation_sent_successfully = False

            # 5. Start Loop *Only If* Confirmation Succeeded
            if confirmation_sent_successfully:
                log_net.info(f"Sent game_created confirmation successfully to {player_id}")
                # MP game starts in 'waiting', loop runs to handle state changes/joins
                game.loop_task = asyncio.create_task(game.run_game_loop())
                log_net.info(f"MP Game {game_id} loop task created for host {player_id}.")
                # Return success info
                return {'game_id': game_id, 'player_id': player_id}
            else:
                # Handle Confirmation Send Failure
                log_net.warning(f"FAILED to send game_created confirmation to {player_id}. Aborting loop start and cleaning up registration.")
                # Cleanup handled similarly to SP game failure
                self.games.pop(game_id, None)
                # handle_disconnect should clean clients/player_to_game map
                return None # Indicate failure

        except Exception as e:
            log_net.error(f"EXCEPTION during create_game GID={game_id}/PID={player_id}: {e}", exc_info=True)
            # --- Rollback Logic ---
            if game:
                game.finish_game("MP Create/Confirm Error")
                if game.loop_task and not game.loop_task.done():
                    game.loop_task.cancel()

            if registration_done:
                self.games.pop(game_id, None)
                self.clients.pop(player_id, None)
                self.player_to_game.pop(player_id, None)

            if ws and not ws.closed:
                try:
                    await ws.close(code=1011, message=b"MP game creation failed")
                except Exception as close_err:
                    log_net.error(f"Error closing WS after MP creation failure for {player_id}: {close_err}")

            return None # Indicate failure

    async def join_game(self, ws, game_id_to_join):
        player_id = generate_id(); game_id = game_id_to_join.strip().upper()
        log_net.info(f"Attempting Join: GID={game_id}, PID={player_id}")
        game = self.games.get(game_id); error_msg = None

        # --- Pre-join Checks ---
        if not game: error_msg = 'Game not found.'
        elif game.status == 'finished': error_msg = 'Game has already finished.'
        elif game.status != 'waiting': error_msg = 'Game is not waiting for players.'
        elif len(game.players) >= MAX_PLAYERS: error_msg = 'Game is full.'

        if error_msg:
            log_net.warning(f"Join Rejected for {player_id} -> {game_id}: {error_msg}")
            try: await ws.send_str(json.dumps({'type': 'error', 'message': error_msg}))
            except Exception as send_err: log_net.error(f"Failed to send join rejection error to {player_id}: {send_err}")
            # Close the connection after sending the error
            if not ws.closed:
                 try: await ws.close(code=1008, message=error_msg.encode('utf-8')) # 1008 = Policy Violation
                 except Exception: pass
            return None # Stop join process

        # --- Attempt to Add Player ---
        try:
            if not game.add_player(player_id):
                 # This case should ideally be caught by the len check above, but as a fallback:
                 raise RuntimeError("Failed to add joining player (unexpectedly full or internal error).")

            # --- Send Confirmation to Joining Player ---
            payload = {'type': 'game_joined', 'game_id': game_id, 'player_id': player_id, 'initial_state': game.get_state()}
            try:
                await ws.send_str(json.dumps(payload))
                log_net.info(f"Sent game_joined confirmation to {player_id}")
            except Exception as send_err:
                # If confirmation fails, remove the player that was just added
                log_net.error(f"Send confirmation failed for joiner {player_id}. Removing player from game.")
                game.remove_player(player_id) # Clean up game state
                raise ConnectionError(f"Failed to send game_joined to {player_id}: {send_err}") from send_err

            # --- Finalize Registration ---
            self.clients[player_id] = ws; self.player_to_game[player_id] = game_id
            log_net.info(f"Player {player_id} joined game {game_id} successfully.")

            # --- Inform Others & Trigger Countdown (logic moved to game.add_player) ---
            # The game.add_player method already handles calling start_countdown if the game becomes full.
            # Broadcasting the updated state happens in the game loop.

            return {'game_id': game_id, 'player_id': player_id}

        except Exception as e:
            log_net.error(f"EXCEPTION during join_game GID={game_id}/PID={player_id}: {e}", exc_info=True)
            # Clean up potential partial registration
            if game and player_id in game.players:
                 game.remove_player(player_id)
            if player_id in self.clients: del self.clients[player_id]
            if player_id in self.player_to_game: del self.player_to_game[player_id]

            # Close connection if join failed critically
            if not ws.closed:
                 try: await ws.close(code=1011, message=b"Join game failed internally") # 1011 = Internal Error
                 except Exception: pass
            return None

    def add_highscore_entry(self, name, score, max_players):
        """Adds a new highscore entry, sorts, trims, and saves."""
        log_net.info(f"Attempting to add highscore: Name={name}, Score={score}, MaxP={max_players}")

        # Re-validate score qualification (defense against client manipulation)
        # Ensure list is sorted before checking qualification again
        self.high_scores.sort(key=operator.itemgetter('score'), reverse=True)

        qualifies = False
        if len(self.high_scores) < MAX_HIGHSCORES:
             qualifies = True
        # Check only if list is full
        elif len(self.high_scores) >= MAX_HIGHSCORES and score > self.high_scores[-1]['score']:
             qualifies = True

        if not qualifies:
             log_net.warning(f"Highscore submission rejected for {name}/{score}: Score no longer qualifies.")
             return # Score doesn't qualify anymore (maybe list updated?)

        # Sanitize Name
        sanitized_name = ''.join(filter(str.isalnum, str(name))).upper()[:3]
        if not sanitized_name:
            sanitized_name = "???" # Default if name is empty or only non-alphanumeric

        # Create entry
        new_entry = {
            'name': sanitized_name,
            'score': score,
            'players': max_players, # Store the size of the game
            'timestamp': time.time()
        }

        # Add the new entry
        self.high_scores.append(new_entry)
        log_net.info(f"Added highscore entry: {new_entry}")

        # Save the updated list (save function handles sorting/trimming)
        save_high_scores(self.high_scores)

    async def handle_disconnect(self, player_id):
        log_net.info(f"Handling disconnect for PID: {player_id}")
        self.clients.pop(player_id, None) # Ensure client reference is removed
        game_id = self.player_to_game.pop(player_id, None) # Remove player->game mapping

        if game_id:
            log_net.info(f"Player {player_id} was in game {game_id}. Notifying game instance.")
            game = self.games.get(game_id)
            if game:
                game.remove_player(player_id) # Let the game instance handle player removal logic
                # The game.remove_player method handles checking if the game should end or return to waiting.
            else:
                log_net.warning(f"Game {game_id} not found for disconnected player {player_id}, but mapping existed.")
        else:
            log_net.debug(f"Disconnected player {player_id} was not associated with any active game.")


    async def route_to_game(self, player_id, data):
        game_id = self.player_to_game.get(player_id)
        if not game_id:
            log_net.warning(f"Routing failed: No game found for player {player_id}. Data: {str(data)[:100]}")
            # Optionally send an error back to client if they send data without being in a game?
            # await self._send_dict_to_player(player_id, {'type':'error', 'message':'Not in a game.'})
            return

        game = self.games.get(game_id)
        if not game:
            log_net.warning(f"Routing failed: Game {game_id} not found for player {player_id}, but mapping exists. Cleaning up.")
            self.player_to_game.pop(player_id, None) # Clean up stale mapping
            return
        if game.status == 'finished':
             # Don't route inputs to finished games, maybe allow chat?
             # log_net.debug(f"Routing ignored: Game {game_id} finished for player {player_id}.")
             # Pass through to allow chat if needed (see below)
             pass # Let chat route below if needed

        msg_type = data.get('type')
        is_chat = msg_type == 'player_chat'

        # Only allow chat messages if game is not active (waiting, countdown, finished)
        # Allow all message types if game is active
        if game.status != 'active' and not is_chat:
            log_net.debug(f"Input '{msg_type}' ignored from {player_id} in game {game_id} (Status: {game.status})")
            return

        # --- Start of the main message processing block ---
        try:
            # Handle Player Movement
            if msg_type == 'player_move' and 'direction' in data:
                 # Only process movement if game is active
                 if game.status == 'active' and isinstance(data['direction'], dict):
                     game.set_player_input(player_id, data['direction'])
                 elif game.status == 'active':
                      log_net.warning(f"Invalid move direction format from {player_id}: {data['direction']}")

            # Handle Player Shooting
            elif msg_type == 'player_shoot' and 'target' in data:
                 # Only process shooting if game is active
                 if game.status == 'active' and isinstance(data['target'], dict):
                     game.player_shoot(player_id, data['target']) # Pass the target dict
                 elif game.status == 'active':
                     log_net.warning(f"Invalid shoot target format from {player_id}: {data['target']}")

            # Handle Player Pushback Ability
            elif msg_type == 'player_pushback':
                 # Only allow pushback if game is active
                 if game.status == 'active':
                     game.handle_pushback(player_id) # Call the game logic function
                 else:
                     log_net.debug(f"Pushback ignored from {player_id}, game not active.")

            # Handle Player Chat
            elif msg_type == 'player_chat' and 'message' in data:
                 # Allow chat regardless of game status (waiting, countdown, active, finished)
                 message_text = str(data['message'])[:100].strip() # Sanitize/limit length
                 if message_text:
                     # Broadcast chat to all players currently associated with the game
                     await self.broadcast_state_callback(game_id, {'type': 'chat_message', 'sender_id': player_id, 'message': message_text})
                 else:
                     log_net.debug(f"Empty chat message from {player_id} ignored.")

            # Handle Unknown Message Types
            else:
                # Only log unknown messages if game is active, otherwise ignore silently
                if game.status == 'active':
                     log_net.warning(f"Unknown message type '{msg_type}' received in route_to_game from {player_id}")
        # --- End of the main message processing block ---

        except Exception as e:
            log_net.error(f"Error processing message type '{msg_type}' for player {player_id} in game {game_id}: {e}", exc_info=True)

# --- End of route_to_game method ---

        msg_type = data.get('type')
        is_chat = msg_type == 'player_chat'

        # Only allow chat messages if game is not active (waiting, countdown, finished)
        # Allow all message types if game is active
        if game.status != 'active' and not is_chat:
            log_net.debug(f"Input '{msg_type}' ignored from {player_id} in game {game_id} (Status: {game.status})")
            return

        try:
            if msg_type == 'player_move' and 'direction' in data:
                 # Only process movement if game is active
                 if game.status == 'active' and isinstance(data['direction'], dict):
                     game.set_player_input(player_id, data['direction'])
                 elif game.status == 'active':
                      log_net.warning(f"Invalid move direction format from {player_id}: {data['direction']}")

            # <<< MODIFIED BLOCK FOR SHOOTING >>>
            elif msg_type == 'player_shoot' and 'target' in data: # Check for 'target'
                 # Only process shooting if game is active
                 if game.status == 'active' and isinstance(data['target'], dict): # Check 'target' is a dict
                     game.player_shoot(player_id, data['target']) # Pass the target dict
                 elif game.status == 'active':
                     log_net.warning(f"Invalid shoot target format from {player_id}: {data['target']}")
            # <<< END OF MODIFIED BLOCK >>>

        except Exception as e:
            log_net.error(f"Error processing message type '{msg_type}' for player {player_id} in game {game_id}: {e}", exc_info=True)

    async def cleanup_finished_games(self):
        # log_net.debug("--- Entering cleanup_finished_games ---") # Can be noisy
        finished_ids = []
        try:
            # Iterate safely over a copy of the items
            game_items = list(self.games.items())
            finished_ids = [gid for gid, game in game_items if game.status == 'finished']
            # log_net.debug(f"Found {len(finished_ids)} finished games: {finished_ids}") # Can be noisy
        except Exception as e:
             log_net.error(f"Error finding finished games: {e}", exc_info=True)
             # log_net.debug("--- Exiting cleanup_finished_games (error finding games) ---") # Can be noisy
             return

        if not finished_ids:
            # log_net.debug("No finished games to clean up.") # Can be noisy
            # log_net.debug("--- Exiting cleanup_finished_games (no games) ---") # Can be noisy
            return

        log_net.info(f"Running periodic cleanup. Cleaning finished games: {finished_ids}")
        cleaned_count = 0
        for gid in finished_ids:
            # log_net.debug(f"Cleaning game ID: {gid}") # Can be noisy
            game = None
            try:
                game = self.games.pop(gid, None)
                if game:
                    # log_net.debug(f"Popped game {gid} from games dict.") # Can be noisy
                    # Ensure loop task is cancelled if it wasn't already
                    if game.loop_task and not game.loop_task.done():
                        log_net.warning(f"Game {gid} was finished but loop task was not done. Cancelling now in cleanup.")
                        game.loop_task.cancel()
                        # Optional: await cancellation? Usually not necessary here.

                    # Find and remove any players still mapped to this game ID
                    stale_pids = [pid for pid, mapped_gid in list(self.player_to_game.items()) if mapped_gid == gid]
                    if stale_pids:
                         # log_net.debug(f"Found {len(stale_pids)} stale player associations for game {gid}: {stale_pids}") # Can be noisy
                         for pid in stale_pids:
                             # log_net.debug(f"Removing stale player association: {pid} -> {gid}") # Can be noisy
                             self.player_to_game.pop(pid, None)
                             # Optionally close their connection if still present in clients? Risky if they reconnected.
                             # self.clients.pop(pid, None) # Don't necessarily remove client ref, they might be back in menu

                    cleaned_count += 1
                else:
                    # Game was already removed between finding it and trying to pop it (race condition? unlikely but possible)
                    log_net.warning(f"Attempted to clean game {gid}, but it was already removed from dict.")
            except Exception as e:
                log_net.error(f"Error during cleanup for game {gid}: {e}", exc_info=True)

        log_net.info(f"Cleanup processed {len(finished_ids)} IDs. Successfully cleaned: {cleaned_count}. Active games remaining: {len(self.games)}")
        # log_net.debug("--- Exiting cleanup_finished_games (finished processing) ---") # Can be noisy

# --- Global Instance ---
network_server = KellyGangGameServer()

# --- aiohttp Handlers & Setup ---
async def handle_index(request):
    try:
        script_dir = os.path.dirname(__file__)
        # --- IMPORTANT: Ensure your HTML file is named index.html ---
        file_path = os.path.join(script_dir, 'index.html')
        if os.path.exists(file_path):
            log_main.debug(f"Serving index.html from: {file_path}")
            return web.FileResponse(file_path)
        else:
            log_main.error(f"index.html not found at expected path: {file_path}")
            # Provide a more informative error if file is missing
            return web.Response(status=404, text=f"Error: index.html not found on server at {file_path}")
    except Exception as e:
        log_main.error(f"Error serving index.html: {e}", exc_info=True)
        return web.Response(status=500, text="Internal Server Error serving index.html")

async def websocket_handler(request):
    # --- Enable Heartbeat Here ---
    # Send a ping every 10 seconds, timeout after 20 seconds of no pong
    # The arguments are passed, but we won't try to read them back directly.
    ws = web.WebSocketResponse(heartbeat=10.0, receive_timeout=20.0)
    # -----------------------------

    client_ip = request.remote
    temp_log_id = f"Init-{generate_id()[:4]}"
    # *** REMOVED the logging line that caused the AttributeError ***
    log_net.info(f"[{temp_log_id}] WS connection attempt from: {client_ip} (Heartbeat enabled)")

    try:
        await ws.prepare(request)
        log_net.info(f"[{temp_log_id}] WS connection prepared for: {client_ip}")

        # --- KEEP the hello test and delay for now ---
        initial_delay = 0.3
        log_net.debug(f"[{temp_log_id}] Applying {initial_delay}s initial delay...")
        await asyncio.sleep(initial_delay)

        if ws.closed:
            log_net.warning(f"[{temp_log_id}] WS for {client_ip} closed during initial delay. Aborting handler.")
            return ws

        log_net.debug(f"[{temp_log_id}] WS for {client_ip} still open after delay.")

        hello_sent_ok = False
        try:
            hello_payload = json.dumps({'type': 'hello_from_server', 'message': 'Connection test successful.'})
            await ws.send_str(hello_payload)
            hello_sent_ok = True
            log_net.info(f"[{temp_log_id}] Initial 'hello' send to {client_ip} SUCCEEDED.")
        except Exception as e_hello:
            log_net.error(f"[{temp_log_id}] Initial 'hello' send failed (Exception: {e_hello}) for {client_ip}. Closing WS.", exc_info=False)
            if not ws.closed: await ws.close()
            return ws
        # --- END hello test ---

        if not hello_sent_ok: # Safeguard
            if not ws.closed: await ws.close()
            return ws

        log_net.debug(f"[{temp_log_id}] Proceeding to main message loop for {client_ip}...")

    except Exception as e_prepare:
        log_net.error(f"[{temp_log_id}] WebSocket prepare failed for {client_ip}: {e_prepare}", exc_info=True)
        return ws

    # --- Initialize variables for the message loop ---
    player_id = None
    game_id = None
    connection_info = None
    is_associating = False
    handler_log_id = temp_log_id

    try:
        # --- Main Message Processing Loop ---
        async for msg in ws:
            if player_id: handler_log_id = player_id[:6]

            if ws.closed:
                 log_net.warning(f"[{handler_log_id}] WS closed during message loop iteration for {client_ip}. Breaking loop.")
                 break

            if msg.type == WSMsgType.TEXT:
                 data = None
                 try:
                     if is_associating:
                         log_net.warning(f"[{handler_log_id}] Handler ignoring message during association phase from {client_ip}: {msg.data[:100]}")
                         continue

                     data = json.loads(msg.data)
                     msg_type = data.get('type')

                     # --- Message Handling Logic ---
                     # 1. Highscore Submit
                     if msg_type == 'submit_highscore_name':
                         p_name = data.get('name'); p_score = data.get('score'); p_max_players = data.get('max_players')
                         log_net.debug(f"[{handler_log_id}] Rcvd highscore submit: {p_name}/{p_score}/{p_max_players}")
                         if p_name and isinstance(p_score, int) and p_score >= 0 and isinstance(p_max_players, int) and p_max_players > 0:
                             network_server.add_highscore_entry(p_name, p_score, p_max_players)
                         else: log_net.warning(f"[{handler_log_id}] Invalid highscore submit format: {data}")

                     # 2. Highscore Request (Client shouldn't send auto)
                     elif msg_type == 'request_high_scores':
                         log_net.debug(f"[{handler_log_id}] Rcvd request_high_scores from {client_ip}")
                         if ws and not ws.closed:
                             success = await network_server._send_dict_to_player(
                                 ws, {'type': 'high_scores_list', 'scores': network_server.high_scores}
                             )
                             if not success: log_net.warning(f"[{handler_log_id}] Failed sending high_scores_list back via WS object.")
                         else: log_net.warning(f"[{handler_log_id}] Cannot send high scores: WS invalid/closed.")

                     # 3. Association Logic
                     elif not connection_info and msg_type in ['create_game', 'join_game', 'start_single_player']:
                         is_associating = True
                         temp_conn_info = None
                         log_net.info(f"[{handler_log_id}] Starting association: '{msg_type}'...")
                         try:
                             if msg_type == 'create_game':
                                 temp_conn_info = await network_server.create_game(ws, data.get('max_players'))
                             elif msg_type == 'join_game':
                                 req_game_id = data.get('game_id')
                                 if req_game_id: temp_conn_info = await network_server.join_game(ws, req_game_id)
                                 else: log_net.warning(f"[{handler_log_id}] Join attempt missing game_id.")
                             elif msg_type == 'start_single_player':
                                 temp_conn_info = await network_server.create_single_player_game(ws)

                             if temp_conn_info:
                                 connection_info = temp_conn_info
                                 player_id = connection_info.get('player_id')
                                 game_id = connection_info.get('game_id')
                                 handler_log_id = player_id[:6] if player_id else handler_log_id
                                 log_net.info(f"[{handler_log_id}] Association SUCCEEDED for '{msg_type}'. PID:{player_id[:6]} GID:{game_id}")
                             else:
                                 log_net.warning(f"[{handler_log_id}] Association FAILED for '{msg_type}' (server returned None).")

                         except Exception as assoc_err:
                              log_net.error(f"[{handler_log_id}] Exception during association '{msg_type}': {assoc_err}", exc_info=True)
                              if not ws.closed: await ws.close(code=1011, message=b"Association error")
                              break
                         finally:
                             is_associating = False
                             log_net.debug(f"[{handler_log_id}] Finished association attempt.")

                     # 4. Routing Logic
                     elif connection_info:
                         if player_id: await network_server.route_to_game(player_id, data)
                         else:
                             log_net.error(f"[{handler_log_id}] State inconsistency: Conn info but no player_id. Closing.")
                             if not ws.closed: await ws.close(code=1011, message=b"Internal state error")
                             break

                     # 5. Unassociated Messages
                     else:
                          log_net.warning(f"[{handler_log_id}] Rcvd '{msg_type}' from unassociated client. Ignoring.")
                          try: await ws.send_str(json.dumps({'type':'error', 'message':'Please create or join a game first.'}))
                          except Exception: pass

                 # --- Error handling for msg processing ---
                 except json.JSONDecodeError:
                    log_net.error(f"[{handler_log_id}] Invalid JSON: {msg.data}")
                    try: await ws.send_str(json.dumps({'type':'error', 'message':'Invalid JSON format.'}))
                    except Exception: pass
                 except ConnectionResetError:
                    log_net.warning(f"[{handler_log_id}] Connection reset. Breaking loop.")
                    break
                 except Exception as e:
                    log_net.error(f"[{handler_log_id}] Error processing msg, Type:'{data.get('type', '?') if data else 'N/A'}': {e}", exc_info=True)
                    try: await ws.send_str(json.dumps({'type':'error', 'message':'Internal server error.'}))
                    except Exception: pass

            # --- Handle other WSMsgTypes ---
            elif msg.type == WSMsgType.ERROR:
                log_net.error(f'[{handler_log_id}] WS Protocol Error: {ws.exception()}')
                break
            elif msg.type == WSMsgType.CLOSED:
                log_net.info(f'[{handler_log_id}] WS Closed msg received. Code: {ws.close_code}')
                break

    # --- Outer loop error handling ---
    except asyncio.CancelledError:
        log_net.info(f"[{handler_log_id}] WS handler task cancelled.")
    except Exception as e_outer:
        log_net.error(f"[{handler_log_id}] Unexpected error in handler outer loop: {e_outer}", exc_info=True)

    # --- Finally block for cleanup ---
    finally:
        final_log_id = player_id[:6] if player_id else temp_log_id
        log_net.info(f"[{final_log_id}] WS Cleanup initiated (Associated PID: {player_id}, Game: {game_id})")
        if player_id: await network_server.handle_disconnect(player_id)
        else: log_net.debug(f"[{final_log_id}] Cleanup: No player ID was associated.")
        if ws and not ws.closed:
            log_net.debug(f"[{final_log_id}] Ensuring WS is closed.")
            close_code = ws.close_code if ws.close_code else 1001
            try: await ws.close(code=close_code, message=b'Server Cleanup')
            except Exception as close_err: log_net.error(f"[{final_log_id}] Error during final WS close: {close_err}")
        log_net.info(f"[{final_log_id}] WS handler finished.")

    return ws

async def periodic_cleanup(server_instance):
    while True:
        await asyncio.sleep(60) # Run every 60 seconds
        log_main.debug("Running periodic cleanup task...")
        try:
            await server_instance.cleanup_finished_games()
        except Exception as e:
            log_main.error(f"Error during periodic cleanup task: {e}", exc_info=True)

async def main():
    log_main.info("Setting up aiohttp app...")
    app = web.Application()
    app.router.add_get('/', handle_index)
    app.router.add_get('/ws', websocket_handler)
    async def handle_health(request): return web.Response(status=200, text="OK")
    app.router.add_get('/health', handle_health)
    app['network_server'] = network_server # Make server instance accessible if needed

    # --- Server Startup ---
    HOST = '0.0.0.0' # Listen on all available interfaces
    PORT = int(os.environ.get('PORT', 8765)) # Use environment variable or default

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    cleanup_task = None

    try:
        await site.start()
        log_main.info(f"Server successfully started on http://{HOST}:{PORT}")

        # Start periodic cleanup task
        cleanup_task = asyncio.create_task(periodic_cleanup(network_server))
        log_main.info("Periodic cleanup task started.")

        # Keep the server running indefinitely (or until interrupted)
        log_main.info("Entering main server loop (awaiting termination)...")
        # Instead of sleeping, await the cleanup task completion,
        # which will only happen if it's cancelled during shutdown.
        # This keeps the main function alive.
        await asyncio.gather(cleanup_task) # This will run until cleanup_task is done or cancelled

    except OSError as e:
        log_main.critical(f"FATAL: Could not start server on {HOST}:{PORT}. Error: {e}", exc_info=True)
    except asyncio.CancelledError:
         log_main.info("Main server task cancelled.") # Expected during shutdown
    except Exception as e:
        log_main.critical(f"FATAL: An unexpected error occurred during server run: {e}", exc_info=True)
    finally:
        log_main.info("Server shutdown sequence initiated...")

        # --- Shutdown Cleanup Task ---
        if cleanup_task and not cleanup_task.done():
             log_main.info("Cancelling periodic cleanup task...")
             cleanup_task.cancel()
             try:
                 await cleanup_task # Wait for cancellation to complete
             except asyncio.CancelledError:
                 pass # Expected
             except Exception as ct_err:
                 log_main.error(f"Error during cleanup task cancellation: {ct_err}")
             log_main.info("Cleanup task cancelled.")

        # --- Shutdown Active Game Loops ---
        log_main.info("Stopping active game loops...")
        active_games = list(network_server.games.values()) # Get games before iterating
        game_cancel_tasks = []
        for game in active_games:
            if game.loop_task and not game.loop_task.done():
                log_main.debug(f"Requesting cancellation for game loop {game.game_id}")
                game.loop_task.cancel()
                game_cancel_tasks.append(game.loop_task)

        if game_cancel_tasks:
             # Wait for all cancellations, suppressing CancelledError
             results = await asyncio.gather(*game_cancel_tasks, return_exceptions=True)
             cancelled_count = sum(1 for r in results if isinstance(r, asyncio.CancelledError) or r is None) # None if already done
             error_count = len(results) - cancelled_count
             log_main.info(f"Attempted to cancel {len(game_cancel_tasks)} game loops. Cancelled/Finished: {cancelled_count}, Errors: {error_count}")
        else:
             log_main.info("No active game loops required cancellation.")

        # --- Close Remaining Client Connections ---
        log_main.info("Closing remaining client connections...")
        client_ids = list(network_server.clients.keys()) # Get IDs before iterating
        if client_ids:
            close_tasks = [network_server.close_client_connection(pid, 1001, "Server Shutdown") for pid in client_ids]
            await asyncio.gather(*close_tasks, return_exceptions=True)
            log_main.info(f"Attempted to close {len(close_tasks)} client connections.")
        else:
            log_main.info("No active client connections found to close.")

        # --- Stop Web Server ---
        log_main.info("Stopping web server site...")
        await site.stop() # Stop listening for new connections
        log_main.info("Cleaning up application runner...")
        await runner.cleanup() # Clean up resources
        log_main.info("Application runner cleaned up.")

        log_main.info("Shutdown complete.")

# --- Entry Point ---
if __name__ == "__main__":
    log_main.info("Running run.py directly...")
    try:
        # Use asyncio.run() which handles loop creation and shutdown
        asyncio.run(main())
    except KeyboardInterrupt:
        log_main.info("KeyboardInterrupt received. Initiating shutdown...")
        # asyncio.run() handles graceful shutdown on KeyboardInterrupt
    except Exception as e:
        log_main.critical(f"Application failed catastrophically during asyncio.run(): {e}", exc_info=True)
    finally:
        log_main.info("run.py finished.")
