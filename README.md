# Anime Realms Online — Multiplayer Prototype v0.2

A lightweight browser 3D RPG prototype using Three.js and a Node.js WebSocket server.

## Features
- Low-poly 3D meadow and shrine
- WASD movement and third-person camera
- WebSocket multiplayer player positions and names
- Simple companion interaction (`E`)
- Serves the game and WebSocket server from the same Node.js app

## Local test
Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

To test two players on the same computer, open the page in two different browsers or one normal window and one private window. This only tests local networking, not internet hosting.

## Deploy with GitHub + Render
1. Create a new GitHub repository, e.g. `anime-realms-online`.
2. Upload all files and folders from this project (keep `server.js`, `package.json`, and `public/`).
3. In Render, create a **New Web Service** and connect the repository.
4. Build command: `npm install`
5. Start command: `npm start`
6. Select the free instance if it is available to your account and region.
7. After deployment, open the Render URL. Share that same public URL with your friend.

The server uses the same HTTP port for the website and WebSocket connection. When hosted on HTTPS, the client automatically uses secure WebSockets (`wss://`).

## Important limitations
- This is an early prototype, not a finished RPG.
- No login, account system, persistent save data, chat, combat, or authoritative anti-cheat yet.
- Anyone with the public link can join; do not use private information as player names.
- Free hosting can sleep, have quotas, or change terms. Check the host's current dashboard and pricing before deploying.
- Three.js is loaded from a CDN, so the browser needs internet access.
