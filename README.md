# StrangerConnect — Omegle-style Random 1-to-1 Video Chat

Talk to strangers around the world. Random video, audio + text chat. No account needed.

## Features
- Landing page with brand, interests, safety info, Terms/Privacy/Guidelines
- Real WebRTC video/audio (getUserMedia, RTCPeerConnection, ICE, SDP offer/answer)
- Socket.IO signaling only (no media through socket)
- Server matchmaking queue (no self-match, no duplicates, interest-preferring, block-aware, rate-limited)
- Text chat (sanitized, length/frequency limited, typing indicator, auto-scroll, cleared on Next)
- Next / End / Mute / Camera off / Fullscreen (double-click video)
- Report (modal, MongoDB) + Block (prevents re-match)
- Anonymous session IDs (uuid), auth-ready structure
- Security: Helmet, CORS, rate-limit, validation, XSS sanitize
- Online counter + connection status (Connected/Connecting/Disconnected)
- Responsive dark UI, error states, permission-denial handling

## Tech
Frontend: React 18, Vite 5, socket.io-client, WebRTC
Backend: Node.js, Express 4, Socket.IO 4, Mongoose 8
DB: MongoDB (optional — app runs without it using in-memory fallback)

## Project structure
```
d:\sidmegle\
  client\src\
    components\ LandingPage, VideoChat, VideoPlayer, ChatPanel, ControlBar, Matchmaking, ReportModal, Header
    hooks\ useSocket, useMediaDevices, useWebRTC
    services\ socket.js
    App.jsx main.jsx index.css
  server\src\
    server.js
    config\database.js
    sockets\socketManager.js matchmakingSocket.js chatSocket.js
    services\matchmakingService.js roomService.js blockService.js reportService.js
    models\Report.js Block.js
    middleware\security.js
    utils\validation.js
```

## Env vars
Backend (`server\.env`, see `server\.env.example`):
```
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/strangerconnect
# leave empty to run without DB
```
Frontend (`client\.env`, see `client\.env.example`):
```
VITE_SOCKET_URL=http://localhost:5000
# VITE_TURN_URL=turn:host:3478
# VITE_TURN_USERNAME=
# VITE_TURN_CREDENTIAL=
```

## Run locally (exact commands)
```bat
cd /d d:\sidmegle\server
npm install
node src/server.js
:: health: curl http://localhost:5000/health

cd /d d:\sidmegle\client
npm install
npx vite --port 5173
:: open http://localhost:5173
```
Vite build test: `npx vite build` (passes).
Socket tests: `cd /d d:\sidmegle\server && node test-matchmaking.js` (all PASS).

## Local 2-tab testing
1. Start backend + frontend. 2. Open http://localhost:5173 in TWO tabs/windows (allow camera/mic; or test chat without camera — chat still works). 3. Pick same interest (optional), click Start Chatting in both → both get `matchFound`, WebRTC connects (same-network tabs connect via host candidates + STUN). 4. A→B text, B→A text. 5. Toggle mic/camera. 6. A clicks Next → B sees "Stranger disconnected / Searching...". 7. Close one tab → other is notified, room cleaned. 8. Report → toast + stored (Mongo or memory); Block → won't rematch.

Note: camera requires localhost or HTTPS. On LAN/Render use HTTPS.

## WebRTC / STUN/TURN
- ICE servers: `stun:stun.l.google.com:19302` by default; add TURN via `VITE_TURN_*` for production.
- Flow: initiator (smaller socket id) creates offer → `webrtcOffer` → answer → `webrtcAnswer` → `iceCandidate` both ways.
- Production NATs often need TURN (e.g. coturn, Twilio, Cloudflare). Without TURN some networks fail — UI shows "Connection failed. Click Next."

## MongoDB
Install locally or use Atlas. Models: Report(reporterSessionId, reportedSessionId, reason, details, roomId), Block(blocker, blocked, unique index). App logs `[DB] ...` and continues without DB.

## Deployment
- Frontend: Vercel/Netlify — set `VITE_SOCKET_URL=https://<backend>`, build `npm run build`, output `dist`.
- Backend: Render/Railway — start `node src/server.js`, set `PORT`, `CLIENT_URL=https://<frontend>`, `MONGODB_URI=<atlas>`. Ensure WebSocket allowed.
- CORS: backend allows CLIENT_URL (comma-separated list supported).

## Troubleshooting
- Server disconnected banner → backend not running or VITE_SOCKET_URL wrong.
- Camera denied → allow in browser site settings, click Retry.
- No match → open 2nd tab; queue needs 2 users.
- Build errors → `npm install` again in that folder.
- Port in use → kill node or change PORT.

## Safety
Report/Block/Guidelines/rate-limits from day one. No recording, no message persistence, no personal data.
