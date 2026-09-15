/** Focused security regression tests. Run with: npm test */
const assert = require('assert');
const validation = require('./src/utils/validation');
const socketSecurity = require('./src/sockets/socketSecurity');

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test('room IDs are strict', () => {
  assert(validation.isRoomId('room_123e4567-e89b-12d3-a456-426614174000'));
  assert(!validation.isRoomId('../../etc/passwd'));
});

test('operator-shaped IDs are rejected', () => {
  assert(!validation.isUuidish({ $ne: null }));
  assert(!validation.isUuidish('not-an-id'));
});

test('SDP and ICE are bounded', () => {
  assert(validation.isSafeSdp('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'));
  assert(!validation.isSafeSdp('<script>alert(1)</script>'));
  assert(validation.isSafeIceCandidate({ candidate: 'candidate:1 1 udp 1 1.2.3.4 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 }));
  assert(!validation.isSafeIceCandidate({ candidate: 'x', unexpected: true }));
});

test('payload envelope rejects unexpected and oversized data', () => {
  assert(!socketSecurity.validateEnvelope([], 8192).ok);
  assert(!socketSecurity.validateEnvelope({ value: 'x'.repeat(9000) }, 8192).ok);
  assert(!socketSecurity.rejectExtra({ roomId: 'x', admin: true }, ['roomId']).ok);
});

test('socket event rate limits', () => {
  const id = `security-test-${Date.now()}`;
  for (let i = 0; i < 3; i++) assert(socketSecurity.checkRate(id, 'event', 3, 5000));
  assert(!socketSecurity.checkRate(id, 'event', 3, 5000));
});

console.log('Security regression tests passed.');
