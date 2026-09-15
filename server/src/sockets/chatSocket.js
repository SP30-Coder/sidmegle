const roomService = require('../services/roomService');
const { sanitizeText, MAX_MESSAGE_LENGTH, isRoomId, isSafeSdp, isSafeIceCandidate } = require('../utils/validation');
const { checkRate, validateEnvelope, rejectExtra, recordViolation } = require('./socketSecurity');

function cleanup() { }

function registerChatHandlers(socket, io) {
  socket.on('chatMessage', (payload = {}) => {
    const { roomId, text } = payload;
    if (!validateEnvelope(payload, 8192).ok || !rejectExtra(payload, ['roomId', 'text']).ok) return;
    const room = roomService.getRoomOf(socket.id);
    if (!isRoomId(roomId) || !room || room.id !== roomId) return;
    if (!checkRate(socket.id, 'chatMessage', 8, 5000)) {
      socket.emit('chatError', { message: 'You are sending messages too quickly.' });
      return;
    }
    const clean = sanitizeText(text, MAX_MESSAGE_LENGTH);
    if (!clean) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    const messagePayload = { roomId, text: clean, from: 'stranger', at: Date.now() };
    if (partnerId) io.to(partnerId).emit('chatMessage', messagePayload);
    socket.emit('chatDelivered', { roomId, at: Date.now() });
  });

  socket.on('typing', ({ roomId, isTyping } = {}) => {
    const payload = { roomId, isTyping };
    if (!validateEnvelope(payload, 2048).ok || !rejectExtra(payload, ['roomId', 'isTyping']).ok || !checkRate(socket.id, 'typing', 12, 10000) || !isRoomId(roomId) || typeof isTyping !== 'boolean') return;
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('typing', { roomId, isTyping: !!isTyping });
  });

  socket.on('webrtcOffer', ({ roomId, offer } = {}) => {
    if (!validateEnvelope({ roomId, offer }, 24000).ok || !offer || !rejectExtra(offer, ['type', 'sdp']).ok || !checkRate(socket.id, 'webrtcOffer', 10, 30000) || !isRoomId(roomId) || offer.type !== 'offer' || !isSafeSdp(offer.sdp)) return;
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('webrtcOffer', { roomId, offer: { type: 'offer', sdp: offer.sdp.slice(0, 20000) } });
  });

  socket.on('webrtcAnswer', ({ roomId, answer } = {}) => {
    if (!validateEnvelope({ roomId, answer }, 24000).ok || !answer || !rejectExtra(answer, ['type', 'sdp']).ok || !checkRate(socket.id, 'webrtcAnswer', 10, 30000) || !isRoomId(roomId) || answer.type !== 'answer' || !isSafeSdp(answer.sdp)) return;
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('webrtcAnswer', { roomId, answer: { type: 'answer', sdp: answer.sdp.slice(0, 20000) } });
  });

  socket.on('iceCandidate', ({ roomId, candidate } = {}) => {
    if (!validateEnvelope({ roomId, candidate }, 6000).ok || !checkRate(socket.id, 'iceCandidate', 40, 10000) || !isRoomId(roomId) || !isSafeIceCandidate(candidate)) return;
    const room = roomService.getRoomOf(socket.id);
    if (!room || room.id !== roomId) return;
    const partnerId = room.users.find((s) => s !== socket.id);
    if (partnerId) io.to(partnerId).emit('iceCandidate', { roomId, candidate });
  });
}

module.exports = { registerChatHandlers, cleanup };
