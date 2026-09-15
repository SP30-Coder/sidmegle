require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const { applySecurity } = require('./middleware/security');
const { registerSocketManager } = require('./sockets/socketManager');
const roomService = require('./services/roomService');
const matchmaking = require('./services/matchmakingService');
const config = require('./config/security');
const { isUuidish, isRoomId, sanitizeText, isValidReason } = require('./utils/validation');

const PORT = Number(process.env.PORT || 5000);
const MAX_PORT_RETRIES = process.env.NODE_ENV === 'production' ? 0 : Number(process.env.PORT_RETRY_COUNT || 10);
const app = express();
applySecurity(app);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  if (!config.ADMIN_TOKEN || req.get('x-admin-token') !== config.ADMIN_TOKEN) return res.status(401).json({ ok: false, message: 'Unauthorized.' });
  res.json({ rooms: roomService.roomCount(), queue: matchmaking.queueSize() });
});

app.post('/api/report', async (req, res) => {
  const reportService = require('./services/reportService');
  const { sanitizeText, isValidReason } = require('./utils/validation');
  try {
    const { reporterSessionId, reportedSessionId, reason, details, roomId } = req.body || {};
    if (!isUuidish(reporterSessionId) || !isUuidish(reportedSessionId) || reporterSessionId === reportedSessionId || !isValidReason(reason) || (roomId && !isRoomId(roomId))) {
      return res.status(400).json({ ok: false, message: 'Invalid report payload.' });
    }
    await reportService.createReport({
      reporterSessionId: String(reporterSessionId).slice(0, 100),
      reportedSessionId: String(reportedSessionId).slice(0, 100),
      reason,
      details: sanitizeText(details || '', 500),
      roomId: String(roomId || '').slice(0, 100),
    });
    res.json({ ok: true });
  } catch (e) {
    const status = e.code === 'RATE_LIMIT' ? 429 : e.code === 'DUPLICATE' ? 409 : 500;
    res.status(status).json({ ok: false, message: status === 500 ? 'Could not submit report.' : e.message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: false },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: config.MAX_SOCKET_PAYLOAD_BYTES,
});

registerSocketManager(io);

function listen(port, retriesLeft = MAX_PORT_RETRIES) {
  const onListening = () => {
    server.off('error', onError);
    console.log(`[Server] StrangerConnect backend listening on :${port}`);
  };

  const onError = (err) => {
    server.off('listening', onListening);
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`[Server] Port ${port} is already in use. Trying :${nextPort}...`);
      listen(nextPort, retriesLeft - 1);
      return;
    }

    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${port} is already in use. Stop the other process or set PORT to a free port.`);
    } else {
      console.error('[Server] Failed to start:', err.message);
    }
    process.exit(1);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port);
}

connectDB(process.env.MONGODB_URI).then(() => {
  listen(PORT);
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ ok: false, message: 'Internal server error.' });
});
