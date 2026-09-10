require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/database');
const { applySecurity } = require('./middleware/security');
const { registerSocketManager } = require('./sockets/socketManager');
const roomService = require('./services/roomService');
const matchmaking = require('./services/matchmakingService');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
applySecurity(app);

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), rooms: roomService.roomCount(), queue: matchmaking.queueSize() });
});

app.get('/api/stats', (req, res) => {
  res.json({ rooms: roomService.roomCount(), queue: matchmaking.queueSize() });
});

const reportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.post('/api/report', reportLimiter, async (req, res) => {
  const reportService = require('./services/reportService');
  const { sanitizeText, isValidReason } = require('./utils/validation');
  try {
    const { reporterSessionId, reportedSessionId, reason, details, roomId } = req.body || {};
    if (!reporterSessionId || !reportedSessionId || !isValidReason(reason)) {
      return res.status(400).json({ ok: false, message: 'Invalid report payload.' });
    }
    const saved = await reportService.createReport({
      reporterSessionId: String(reporterSessionId).slice(0, 100),
      reportedSessionId: String(reportedSessionId).slice(0, 100),
      reason,
      details: sanitizeText(details || '', 500),
      roomId: String(roomId || '').slice(0, 100),
    });
    res.json({ ok: true, id: saved._id || null });
  } catch (e) {
    res.status(429).json({ ok: false, message: e.message });
  }
});

const server = http.createServer(app);
const allowedOrigins = CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);

const io = new Server(server, {
  cors: { origin: allowedOrigins.includes('*') ? '*' : allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});

registerSocketManager(io);

connectDB(process.env.MONGODB_URI).then(() => {
  server.listen(PORT, () => {
    console.log(`[Server] StrangerConnect backend listening on :${PORT}`);
    console.log(`[Server] CLIENT_URL=${CLIENT_URL}`);
  });
});
