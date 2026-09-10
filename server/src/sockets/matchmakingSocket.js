const roomService = require('../services/roomService');
const matchmaking = require('../services/matchmakingService');
const { sanitizeInterests } = require('../utils/validation');

function registerMatchmaking(io) {
  return {
    async joinQueue(socket, payload = {}) {
      const sessionId = socket.data.sessionId;
      const interests = sanitizeInterests(payload.interests);
      socket.data.interests = interests;
      const existing = roomService.getRoomOf(socket.id);
      if (existing) {
        socket.emit('queueError', { message: 'You are already in a chat.' });
        return;
      }
      const res = matchmaking.enqueue(socket.id, sessionId, interests);
      if (!res.ok) {
        socket.emit('queueError', { message: res.error });
        return;
      }
      socket.emit('queueJoined', { status: 'searching' });
      await matchmaking.tryMatch(io);
    },
    leaveQueue(socket) {
      matchmaking.leaveQueue(socket.id);
      socket.emit('queueLeft', {});
    },
    async next(socket, io) {
      const room = roomService.getRoomOf(socket.id);
      if (room) {
        const partnerId = room.users.find((s) => s !== socket.id);
        socket.leave(room.id);
        roomService.removeRoom(room.id);
        if (partnerId) {
          const partner = io.sockets.sockets.get(partnerId);
          if (partner) {
            partner.leave(room.id);
            partner.emit('strangerDisconnected', { roomId: room.id, reason: 'next' });
          }
        }
        socket.emit('leftRoom', { roomId: room.id });
      }
      const interests = socket.data.interests || [];
      const sessionId = socket.data.sessionId;
      matchmaking.removeFromQueue(socket.id);
      await new Promise((r) => setTimeout(r, 300));
      const res = matchmaking.enqueue(socket.id, sessionId, interests);
      if (!res.ok) {
        socket.emit('queueError', { message: res.error });
        return;
      }
      socket.emit('queueJoined', { status: 'searching' });
      await matchmaking.tryMatch(io);
    },
    leaveRoom(socket, io) {
      const room = roomService.getRoomOf(socket.id);
      if (room) {
        const partnerId = room.users.find((s) => s !== socket.id);
        socket.leave(room.id);
        roomService.removeRoom(room.id);
        if (partnerId) {
          const partner = io.sockets.sockets.get(partnerId);
          if (partner) {
            partner.leave(room.id);
            partner.emit('strangerDisconnected', { roomId: room.id, reason: 'left' });
          }
        }
        socket.emit('leftRoom', { roomId: room.id });
      }
    },
  };
}

module.exports = { registerMatchmaking };
