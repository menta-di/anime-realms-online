const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const players = new Map();

const server = http.createServer((req, res) => {
  const cleanPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const requested = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, requested);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, "index.html")) {
    res.writeHead(403); return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(filePath).toLowerCase();
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function broadcast(payload, except) {
  for (const client of wss.clients) if (client !== except && client.readyState === WebSocket.OPEN) send(client, payload);
}
function snapshot() {
  return Array.from(players.values()).map(p => ({ id: p.id, name: p.name, x: p.x, z: p.z, yaw: p.yaw }));
}
function safeName(value) {
  const name = String(value || "Explorer").replace(/[<>]/g, "").trim().slice(0, 16);
  return name || "Explorer";
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 10);
  const player = { id, name: "Explorer", x: (Math.random() - 0.5) * 3, z: 2, yaw: 0 };
  players.set(id, player);
  ws.playerId = id;

  send(ws, { type: "welcome", id, players: snapshot() });
  broadcast({ type: "player-joined", player }, ws);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
    const current = players.get(id);
    if (!current || !msg || typeof msg.type !== "string") return;

    if (msg.type === "set-name") {
      current.name = safeName(msg.name);
      broadcast({ type: "player-updated", player: current });
      send(ws, { type: "you-updated", player: current });
      return;
    }

    if (msg.type === "move") {
      const x = Number(msg.x), z = Number(msg.z), yaw = Number(msg.yaw);
      if (![x, z, yaw].every(Number.isFinite)) return;
      // Simple world bounds and input sanity checks.
      current.x = Math.max(-28, Math.min(28, x));
      current.z = Math.max(-32, Math.min(28, z));
      current.yaw = Math.max(-1000, Math.min(1000, yaw));
      broadcast({ type: "player-moved", player: current }, ws);
    }
  });

  ws.on("close", () => {
    players.delete(id);
    broadcast({ type: "player-left", id });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Anime Realms server listening on port " + PORT);
});
