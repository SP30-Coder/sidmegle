const roomService = require('../services/roomService');
const matchmaking = require('../services/matchmakingService');
const { sanitizeInterests, sanitizeGender, sanitizeGenderPreference } = require('../utils/validation');
const { checkRate, validateEnvelope, rejectExtra } = require('./socketSecurity');

function registerMatchmaking(io) {
  return {
    async joinQueue(socket, payload = {}) {
      if (!validateEnvelope(payload, 4096).ok || !rejectExtra(payload, ['interests', 'gender', 'preferredGender']).ok || !checkRate(socket.id, 'joinQueue', 5, 60000)) {
        socket.emit('queueError', { message: 'Please slow down and try again.' });
        return;
      }
      const sessionId = socket.data.sessionId;
      const interests = sanitizeInterests(payload.interests);
      const gender = sanitizeGender(payload.gender);
      const preferredGender = sanitizeGenderPreference(payload.preferredGender);
      if (!gender) {
        socket.emit('queueError', { message: 'Select your gender before searching.' });
        return;
      }
      socket.data.interests = interests;
      socket.data.gender = gender;
      socket.data.preferredGender = preferredGender;
      const existing = roomService.getRoomOf(socket.id);
      if (existing) {
        socket.emit('queueError', { message: 'You are already in a chat.' });
        return;
      }
      const res = matchmaking.enqueue(socket.id, sessionId, interests, gender, preferredGender);
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
      const gender = socket.data.gender || null;
      const preferredGender = socket.data.preferredGender || 'any';
      const sessionId = socket.data.sessionId;
      matchmaking.removeFromQueue(socket.id);
      await new Promise((r) => setTimeout(r, 300));
      const res = matchmaking.enqueue(socket.id, sessionId, interests, gender, preferredGender);
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
