SUCH IS LIFE - Bushranger Survival
A chaotic online co-op shooter inspired by Australian bushranger legends 

Gameplay Overview
Survive waves of enemies in this top-down multiplayer shooter. Play solo or with a mate (2-player co-op) as you:

Shoot troopers and dodge bullets
Collect power-ups to upgrade your gear
Survive increasingly difficult waves
Chat with teammates using in-game messaging
Core Mechanics
Guns & Upgrades
Pistol (1)
10
3 shots/s
0° spread
Starting gear
Revolver (2)
15
4 shots/s
5° spread
Gun Power-Up
Shotgun (3)
25
2 shots/s
15° spread
Gun Power-Up

Gun upgrades stack with player stats - combine with speed boosts for maximum chaos 

Power-Up System
Collect floating pickups to enhance your outlaw:

Health 🍀 (Green ): +25 HP (Max 200)
Gun Upgrade 🔥 (Pink ): +1 gun level
Speed Boost ⚡ (Cyan ): +30% movement speed
Armor 🛡️ (Gray ): Absorb 50% damage for 10s
Power-ups appear randomly when enemies are defeated 

Enemy Waves
Troopers (Green): Basic enemies with 50 HP
Sergeants (Red): Heavily armored, slower movement
Snipers (Blue): Long-range attackers
Waves increase in difficulty every 2 minutes (Day/Night cycle affects spawn rates)

Technical Analysis
Code Structure
WebSocket Integration
Connects to wss://such-is-life.glitch.me/ws for real-time multiplayer
Uses JSON messages for:
Player movement (player_move)
Shooting events (player_shoot)
Chat communication (player_chat)
State Management
Client-side prediction for smooth movement
Server reconciliation every 50ms to prevent desync
Interpolation between server updates for other players
Rendering System
Canvas-based with day/night color shifts
Dynamic health bars using CSS variable colors
Entity z-index:
Players > Enemies > Bullets > Power-ups
Key Files & Systems
Networking
Network
module handles WebSocket communication with automatic reconnect logic
Physics
Basic collision detection using axis-aligned bounding boxes (AABB)
AI
Enemy targeting uses distance-based priority system
UI
Responsive menu system with CSS transitions

How To Play
Controls
Movement: WASD or Arrow Keys
Shoot: Spacebar
Chat: Enter to type
Multiplayer
Host a game to get a 6-digit code
Share code with friends to join co-op
Team chat stays active even during gameplay
Survival Tips
Prioritize armor pickups in later waves
Use shotgun spread to hit multiple enemies
Stay mobile - camping attracts enemy clusters
Development Notes
Built with:
Python (server-side WebSocket handling)
JavaScript (client-side game logic)
Glitch (hosting and deployment)
Inspired by:
Bushranger history 
Classic top-down shooters 
Requires modern browser with WebSocket support. Mobile play possible but not optimized.
