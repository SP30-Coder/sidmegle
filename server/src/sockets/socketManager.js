const { v4: uuidv4 } = require('uuid');
const roomService = require('../services/roomService');
const matchmaking = require('../services/matchmakingService');
const blockService = require('../services/blockService');
const reportService = require('../services/reportService');
const { registerMatchmaking } = require('./matchmakingSocket');
const { registerChatHandlers, cleanup } = require('./chatSocket');
const { sanitizeText, isValidReason } = require('../utils/validation');

matchmaking.setBlockChecker(blockService.isBlocked);

function registerSocketManager(io) {
  const mm = registerMatchmaking(io);

  const broadcastOnline = () => {
    try {
      io.emit('onlineCount', {
        count: io.engine.clientsCount,
        rooms: roomService.roomCount(),
        queue: matchmaking.queueSize(),
      });
    } catch (e) { /* ignore */ }
  };
  setInterval(broadcastOnline, 5000);

  io.on('connection', (socket) => {
    const sessionId = uuidv4();
    socket.data.sessionId = sessionId;
    socket.data.interests = [];
    socket.emit('session', { sessionId });
    broadcastOnline();

    registerChatHandlers(socket, io);

    socket.on('joinQueue', (p) => mm.joinQueue(socket, p || {}));
    socket.on('leaveQueue', () => mm.leaveQueue(socket));
    socket.on('next', () => mm.next(socket, io));
    socket.on('leaveRoom', () => mm.leaveRoom(socket, io));

    socket.on('reportUser', async (payload = {}) => {
      try {
        const { roomId, reason, details, peerSessionId } = payload;
        if (!isValidReason(reason)) {
          socket.emit('reportResult', { ok: false, message: 'Invalid report reason.' });
          return;
        }
        let target = null;
        const room = roomId ? roomService.getRoom(roomId) : roomService.getRoomOf(socket.id);
        if (room) {
          const pid = room.users.find((s) => s !== socket.id);
          const partner = pid ? io.sockets.sockets.get(pid) : null;
          if (partner) target = partner.data.sessionId;
        }
        if (!target && typeof peerSessionId === 'string') target = peerSessionId.slice(0, 100);
        if (!target) {
          socket.emit('reportResult', { ok: false, message: 'No active stranger to report.' });
          return;
        }
        await reportService.createReport({
          reporterSessionId: sessionId,
          reportedSessionId: target,
          reason,
          details: sanitizeText(details || '', 500),
          roomId: roomId || '',
        });
        socket.emit('reportResult', { ok: true, message: 'Thanks. Your report was received.' });
      } catch (e) {
        socket.emit('reportResult', { ok: false, message: e.message || 'Could not submit report.' });
      }
    });

    socket.on('blockUser', async (payload = {}) => {
      try {
        let target = typeof payload.peerSessionId === 'string' ? payload.peerSessionId.slice(0, 100) : null;
        if (!target) {
          const room = roomService.getRoomOf(socket.id);
          if (room) {
            const pid = room.users.find((s) => s !== socket.id);
            const partner = pid ? io.sockets.sockets.get(pid) : null;
            if (partner) target = partner.data.sessionId;
          }
        }
        if (!target) {
          socket.emit('blockResult', { ok: false, message: 'No active stranger to block.' });
          return;
        }
        await blockService.addBlock(sessionId, target);
        socket.emit('blockResult', { ok: true, message: 'User blocked. You will not be matched again.' });
      } catch (e) {
        socket.emit('blockResult', { ok: false, message: e.message || 'Could not block user.' });
      }
    });

    socket.on('disconnect', () => {
      matchmaking.handleDisconnect(socket.id);
      cleanup(socket.id);
      const { room, partnerId } = roomService.removeSocket(socket.id);
      if (room && partnerId) {
        const partner = io.sockets.sockets.get(partnerId);
        if (partner) {
          partner.leave(room.id);
          partner.emit('strangerDisconnected', { roomId: room.id, reason: 'disconnect' });
        }
      }
      broadcastOnline();
    });
  });
}

module.exports = { registerSocketManager };
