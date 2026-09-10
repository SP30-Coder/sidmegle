const { v4: uuidv4 } = require('uuid');

// roomId -> { id, users: [socketIdA, socketIdB], createdAt }
const rooms = new Map();
// socketId -> roomId
const socketRoom = new Map();

function createRoom(a, b) {
  const id = `room_${uuidv4()}`;
  rooms.set(id, { id, users: [a, b], createdAt: Date.now() });
  socketRoom.set(a, id);
  socketRoom.set(b, id);
  return rooms.get(id);
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function getRoomOf(socketId) {
  const roomId = socketRoom.get(socketId);
  if (!roomId) return null;
  return rooms.get(roomId) || null;
}

function removeRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  for (const sid of room.users) socketRoom.delete(sid);
  rooms.delete(roomId);
  return room;
}

function removeSocket(socketId) {
  const room = getRoomOf(socketId);
  if (room) {
    const other = room.users.find((s) => s !== socketId);
    removeRoom(room.id);
    return { room, partnerId: other || null };
  }
  socketRoom.delete(socketId);
  return { room: null, partnerId: null };
}

function roomCount() {
  return rooms.size;
}

module.exports = {
  createRoom,
  getRoom,
  getRoomOf,
  removeRoom,
  removeSocket,
  roomCount,
  _rooms: rooms,
  _socketRoom: socketRoom,
};
