const { v4: uuidv4 } = require('uuid');
const roomService = require('../services/roomService');
const matchmaking = require('../services/matchmakingService');
const blockService = require('../services/blockService');
const reportService = require('../services/reportService');
const { registerMatchmaking } = require('./matchmakingSocket');
const { registerChatHandlers, cleanup } = require('./chatSocket');
const { sanitizeText, isValidReason } = require('../utils/validation');
const { checkConn, trackConn, releaseConn, getClientIp, checkRate, validateEnvelope, rejectExtra } = require('./socketSecurity');

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
    const clientIp = getClientIp(socket);
    const connection = checkConn(clientIp);
    if (!connection.ok) return socket.disconnect(true);
    socket.data.clientIp = clientIp;
    trackConn(clientIp, socket.id);
    const sessionId = uuidv4();
    socket.data.sessionId = sessionId;
    socket.data.interests = [];
    socket.data.gender = null;
    socket.data.preferredGender = 'any';
    socket.emit('session', { sessionId });
    broadcastOnline();

    registerChatHandlers(socket, io);

    socket.on('joinQueue', (p) => mm.joinQueue(socket, p || {}));
    socket.on('leaveQueue', () => { if (checkRate(socket.id, 'leaveQueue', 10, 60000)) mm.leaveQueue(socket); });
    socket.on('next', () => { if (checkRate(socket.id, 'next', 6, 60000)) mm.next(socket, io); });
    socket.on('leaveRoom', () => { if (checkRate(socket.id, 'leaveRoom', 10, 60000)) mm.leaveRoom(socket, io); });

    socket.on('reportUser', async (payload = {}) => {
      try {
        if (!validateEnvelope(payload, 8192).ok || !rejectExtra(payload, ['roomId', 'reason', 'details', 'peerSessionId']).ok || !checkRate(socket.id, 'reportUser', 3, 600000)) return;
        const { roomId, reason, details, peerSessionId } = payload;
        if (!isValidReason(reason)) {
          socket.emit('reportResult', { ok: false, message: 'Invalid report reason.' });
          return;
        }
        let target = null;
        const room = roomService.getRoomOf(socket.id);
        if (roomId && room?.id !== roomId) return;
        if (room) {
          const pid = room.users.find((s) => s !== socket.id);
          const partner = pid ? io.sockets.sockets.get(pid) : null;
          if (partner) target = partner.data.sessionId;
        }
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
        if (reason === 'gender-misrepresentation') {
          await blockService.addBlock(sessionId, target);
        }
        socket.emit('reportResult', { ok: true, message: 'Thanks. Your report was received.' });
      } catch (e) {
        socket.emit('reportResult', { ok: false, message: e.message || 'Could not submit report.' });
      }
    });

    socket.on('blockUser', async (payload = {}) => {
      try {
        if (!validateEnvelope(payload, 4096).ok || !rejectExtra(payload, ['roomId', 'peerSessionId']).ok || !checkRate(socket.id, 'blockUser', 3, 600000)) return;
        let target = null;
        const room = roomService.getRoomOf(socket.id);
        if (room) {
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
      releaseConn(socket.data.clientIp, socket.id);
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
