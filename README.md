# SUCH IS LIFE - Bushranger Survival
*A chaotic top-down co-op shooter Down Under! Blast troopers with ya mate, grab loot, and survive the onslaught. Good onya!*

**(Playable at: [`https://suchislifeguy.github.io/such-is-life/`](https://suchislifeguy.github.io/such-is-life/))**

## Gameplay Overview
Dive into the Australian bush and survive waves of relentless troopers in this frantic top-down shooter. Go it alone or team up with a mate (2-player online co-op).

*   **Shoot & Scoot:** Blast troopers and dodge a hail of bullets using mouse-based aiming.
*   **Power Up:** Grab floating pickups to heal, boost your stats, and unleash temporary special ammo types!
*   **Survive the Day... & Night:** Face increasingly difficult waves of enemies spawning during the day. Huddle near the **Campfire** at night for safety and regeneration.
*   **Mates Rates:** If you go down in co-op, your mate has a chance to keep fighting while you wait for a potential comeback (or face final defeat!). Single players face a quicker demise.
*   **Bush Telegraph:** Chat with your teammate using the in-game messaging system.

---

## Core Mechanics

### **Movement & Shooting**
*   **Movement:** `WASD` or `Arrow Keys`
*   **Shoot:** `Left Mouse Click` (Aim with cursor position relative to your player)
*   **Chat:** `Enter` to open chat input, `Enter` again to send.

### **Guns & Ammo**
Your base firepower increases with your **Gun Level**, which improves the damage of your standard shots. Look for the **'G' Power-Up**!

Beyond standard bullets, temporary **Special Ammo Power-Ups** drastically change how you shoot for a limited time:

*   **(::) Shotgun Ammo:** Fires a spread of 6 pellets. Great for crowd control. Less damage per pellet, but hits multiple targets.
*   **(■) Heavy Slug Ammo:** Fires a single, slower, larger projectile dealing significantly increased damage. Packs a punch!
*   **(>) Rapid Fire Ammo:** Dramatically increases your firing speed with standard bullets. Mow 'em down!

*Critical Hits:* You have a base **15% chance** to land a critical hit, dealing **double damage**! Look for the larger, yellow damage numbers.

### **Power-Up System**
Floating pickups spawn periodically. Grab 'em quick!

| Symbol | Power-Up          | Effect                                                        | Notes                                     |
| :----: | ----------------- | ------------------------------------------------------------- | ----------------------------------------- |
|   **+**  | Health            | Instantly restores **25 HP** (up to Max Health).              | Green pickup. Essential for survival!     |
|   **G**  | Gun Upgrade       | Increases base **Gun Level** by 1 (Max 5), boosting damage. | Pink pickup. Permanent upgrade for match. |
|   **S**  | Speed Boost       | Increases **Movement Speed** by +50 for **10 seconds**.       | Cyan pickup. Gotta go fast!               |
|   **#**  | Armor             | Adds **+25 Armor** (up to Max 100). Reduces damage taken.   | Silver/Gray pickup. Absorbs hits.         |
|  **::**  | Ammo: Shotgun     | Activates **Shotgun** firing mode for **25 seconds**.         | Orange pickup. Wide spread.               |
|   **■**  | Ammo: Heavy Slug  | Activates **Heavy Slug** firing mode for **25 seconds**.      | Brown pickup. High damage, slow fire.   |
|   **>**  | Ammo: Rapid Fire  | Activates **Rapid Fire** mode for **25 seconds**.           | Yellow pickup. Increased fire rate.       |
|   **$**  | Bonus Score       | Instantly grants **+100 Score** to player and game total.   | Gold pickup. Boost your ranking!          |

### **Player Health & Status**
*   **Health (HP):** Your life force. Reaches 0, you go down. Starts at 100. Regenerates near the Campfire at night.
*   **Armor:** Acts like extra protection, reducing the HP damage you take from hits based on how much Armor you have (up to 75% reduction at 100 Armor). Armor depletes as it absorbs damage.
*   **Player Status:**
    *   `Alive`: Normal state. Can move, shoot, collect.
    *   `Down`: HP is 0. Cannot act. In **Multiplayer**, a **60-second** timer starts. If your mate survives until the timer ends OR clears the wave (TBC), you might get back up (or maybe not!). In **Single Player**, this state lasts only 1 second before becoming `Dead`.
    *   `Dead`: You're out for the count this round. Game Over if all players are Dead.

### **Enemies**
Troopers crawl out of the woodwork during the **Daytime**. They get tougher as the game progresses (scaling with game level).

*   **Chaser:** Green troopers that relentlessly pursue you for melee attacks.
*   **Shooter:** Blue troopers that keep their distance and fire bullets at you. Watch out for their shots!

*Enemy Chatter:* Occasionally, troopers might shout taunts or tactical commands via speech bubbles!

### **Day/Night Cycle & Campfire**
*   **Cycle:** The game alternates between Day and Night phases, each lasting approximately **30 seconds** (60s total cycle). A timer and indicator are shown on the HUD.
*   **Day:** Enemies spawn from the edges of the map. The main combat phase.
*   **Night:** Enemy spawning **stops**. The **Campfire** in the center of the map activates.
*   **Campfire:** Standing near the glowing campfire **at night** provides slow **Health Regeneration**. Use this time to recover!

---

## How To Play

1.  **Controls:**
    *   Movement: `WASD` or `Arrow Keys`
    *   Shoot: `Left Mouse Click` (Aim with cursor)
    *   Chat: `Enter` (Type message, then `Enter` again to send)

2.  **Single Player:**
    *   Select "Single Player" from the main menu.
    *   The game starts immediately. Survive as long as you can! If you go down, it's Game Over quickly.

3.  **Multiplayer (2 Players):**
    *   **Host:** Select Multiplayer -> Host Game. You'll get a 6-digit **Game Code**. Share this code with your mate. Wait for them to join.
    *   **Join:** Select Multiplayer -> Join Game. Enter the 6-digit code your mate gave you.
    *   Once the second player joins, a brief countdown begins, then the game starts!
    *   Use the **Chat** (`Enter`) to coordinate.
    *   If one player goes `Down`, the other must survive the **60-second** revival timer for a chance at reinforcement (or face defeat if they also fall).

4.  **Leaving:** You can leave a game early using the "Leave Game" button. If hosting, this will end the game for both players.

---

## Survival Tips
*   **Stay Mobile:** Don't stand still! Keep moving to dodge bullets and Chasers.
*   **Use the Campfire:** Head to the center during Night for crucial HP regeneration.
*   **Armor Up:** Grab '#' powerups whenever possible, especially in later stages. It makes a huge difference.
*   **Ammo Management:** Use Special Ammo strategically. Shotgun (::) for groups, Heavy Slug (■) for tough targets, Rapid Fire (>) for clearing waves fast.
*   **Prioritize Shooters:** Ranged enemies (Blue) can be dangerous. Try to eliminate them quickly.
*   **Communicate (Co-op):** Call out powerups, dangerous enemies, or when you need help using the chat.
*   **Revival Awareness (Co-op):** If your mate goes down, try to draw enemies away and play defensively until the timer runs out or you can safely clear the area.

---

## Technical Details

*   **Networking:** Real-time multiplayer via WebSockets (`wss://such-is-life.glitch.me/ws`). *(Note: Gameplay is hosted on GitHub Pages, but the WebSocket server likely remains on Glitch unless moved)*.
*   **Communication:** Uses JSON messages for game state synchronization, player actions (`player_move`, `player_shoot`), and chat (`player_chat`).
*   **Client-Side:** JavaScript handles rendering on an HTML Canvas, input processing, sound effects (if any), client-side prediction for smooth local movement, and interpolation for smooth remote player/entity movement.
*   **Server-Side:** Python with `aiohttp` manages game logic, WebSocket connections, physics (AABB collision), AI, and state synchronization.
*   **Hosting:** Game client hosted on GitHub Pages, WebSocket server hosted on Glitch.

---

## Development Notes
*   **Built With:** Python 3, aiohttp, JavaScript, HTML5 Canvas.
*   **Inspired By:** Australian bushranger legends (like Ned Kelly), classic arcade top-down shooters.
*   **Requirements:** Requires a modern web browser with WebSocket support (Chrome, Firefox, Edge recommended). Desktop play is intended; mobile may work but is not optimized.

*Right then, good luck out there, ya mongrels! Such is life.*
