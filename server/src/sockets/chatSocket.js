const roomService = require('../services/roomService');
const { sanitizeText, MAX_MESSAGE_LENGTH } = require('../utils/validation');

const msgTimestamps = new Map();

function checkRate(socketId) {
  const now = Date.now();
  const arr = (msgTimestamps.get(socketId) || []).filter((t) => now - t < 5000);
  arr.push(now);
  msgTimestamps.set(socketId, arr);
  return arr.length <= 8;
}

function cleanup(socketId) {
  msgTimestamps.delete(socketId);
}

function registerChatHandlers(socket, io) {
  socket.on('chatMessage', ({ roomId, text } = {}) => {
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    if (!checkRate(socket.id)) {
      socket.emit('chatError', { message: 'You are sending messages too quickly.' });
      return;
    }
    const clean = sanitizeText(text, MAX_MESSAGE_LENGTH);
    if (!clean) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    const payload = { roomId, text: clean, from: 'stranger', at: Date.now() };
    if (partnerId) io.to(partnerId).emit('chatMessage', payload);
    socket.emit('chatDelivered', { roomId, at: Date.now() });
  });

  socket.on('typing', ({ roomId, isTyping } = {}) => {
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('typing', { roomId, isTyping: !!isTyping });
  });

  socket.on('webrtcOffer', ({ roomId, offer } = {}) => {
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    if (!offer || typeof offer.sdp !== 'string') return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('webrtcOffer', { roomId, offer: { type: 'offer', sdp: offer.sdp.slice(0, 20000) } });
  });

  socket.on('webrtcAnswer', ({ roomId, answer } = {}) => {
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    if (!answer || typeof answer.sdp !== 'string') return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('webrtcAnswer', { roomId, answer: { type: 'answer', sdp: answer.sdp.slice(0, 20000) } });
  });

  socket.on('iceCandidate', ({ roomId, candidate } = {}) => {
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    if (!candidate) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('iceCandidate', { roomId, candidate });
  });
}

module.exports = { registerChatHandlers, cleanup };
