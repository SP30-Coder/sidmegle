const { io } = require('socket.io-client');

const URL = process.env.TEST_URL || 'http://localhost:5000';

function makeClient(name) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'] });
    const state = { name, socket: s, session: null, room: null, initiator: null, chat: [], strangerGone: false };
    const timer = setTimeout(() => reject(new Error(name + ' timeout')), 10000);
    s.on('session', (d) => { state.session = d.sessionId; });
    s.on('queueJoined', () => {});
    s.on('matchFound', (d) => { state.room = d.roomId; state.initiator = d.initiator; clearTimeout(timer); resolve(state); });
    s.on('chatMessage', (m) => state.chat.push(m));
    s.on('strangerDisconnected', () => { state.strangerGone = true; });
    s.on('connect', () => s.emit('joinQueue', { interests: ['gaming'] }));
    s.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
  });
}

(async () => {
  console.log('TEST 1: matchmaking two clients...');
  const [A, B] = await Promise.all([makeClient('A'), makeClient('B')]);
  console.log('PASS match:', A.room === B.room ? 'same room ' + A.room : 'FAIL rooms differ');
  console.log('initiators:', A.initiator, B.initiator);

  console.log('TEST 3/4: text chat A->B and B->A...');
  A.socket.emit('chatMessage', { roomId: A.room, text: 'Hello from A' });
  await new Promise((r) => setTimeout(r, 600));
  console.log(B.chat.length && B.chat[0].text === 'Hello from A' ? 'PASS A->B' : 'FAIL A->B ' + JSON.stringify(B.chat));
  B.socket.emit('chatMessage', { roomId: B.room, text: 'Hi from B' });
  await new Promise((r) => setTimeout(r, 600));
  console.log(A.chat.length && A.chat[0].text === 'Hi from B' ? 'PASS B->A' : 'FAIL B->A ' + JSON.stringify(A.chat));

  console.log('TEST 2: A clicks Next...');
  A.socket.emit('next');
  await new Promise((r) => setTimeout(r, 1500));
  console.log(B.strangerGone ? 'PASS B got strangerDisconnected' : 'FAIL B not notified');

  console.log('TEST 8: report...');
  await new Promise((resolve) => {
    B.socket.once('reportResult', (r) => { console.log(r.ok ? 'PASS report stored' : 'FAIL report ' + r.message); resolve(); });
    B.socket.emit('reportUser', { roomId: B.room, reason: 'spam', details: 'test report', peerSessionId: A.session });
  });

  console.log('TEST block...');
  await new Promise((resolve) => {
    B.socket.once('blockResult', (r) => { console.log(r.ok ? 'PASS block stored' : 'FAIL block ' + r.message); resolve(); });
    B.socket.emit('blockUser', { peerSessionId: A.session });
  });

  A.socket.disconnect();
  B.socket.disconnect();
  console.log('ALL SOCKET TESTS DONE');
  process.exit(0);
})().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
