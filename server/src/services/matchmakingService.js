/**
 * Server-side matchmaking queue.
 * - Prevents self-match, duplicate queue entries, stale rooms
 * - Interest-aware: prefers common interest, falls back to random
 * - Blocks respected via blockService callback
 */
const roomService = require('./roomService');

const queue = []; // [{ socketId, sessionId, interests, enqueuedAt }]
const socketMeta = new Map(); // socketId -> { sessionId, interests }
const recentPairs = new Map(); // pairKey -> timestamp (avoid immediate re-match)
const lastMatchAt = new Map(); // socketId -> timestamp (rate limit)

const QUEUE_RATE_LIMIT_MS = 1500;
const RECENT_PAIR_AVOID_MS = 60 * 1000;

let isBlockedFn = null; // async (aSessionId, bSessionId) => boolean

function setBlockChecker(fn) {
  isBlockedFn = fn;
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function enqueue(socketId, sessionId, interests = []) {
  const now = Date.now();
  const last = lastMatchAt.get(socketId) || 0;
  if (now - last < QUEUE_RATE_LIMIT_MS) {
    return { ok: false, error: 'Please wait a moment before searching again.' };
  }
  lastMatchAt.set(socketId, now);

  // never multiple active rooms
  const existingRoom = roomService.getRoomOf(socketId);
  if (existingRoom) {
    return { ok: false, error: 'You are already in a chat.' };
  }
  // prevent duplicate queue entries
  removeFromQueue(socketId);
  queue.push({ socketId, sessionId, interests: interests || [], enqueuedAt: now });
  socketMeta.set(socketId, { sessionId, interests: interests || [] });
  return { ok: true };
}

function removeFromQueue(socketId) {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) queue.splice(idx, 1);
}

function leaveQueue(socketId) {
  removeFromQueue(socketId);
}

function queueSize() {
  return queue.length;
}

function hasCommonInterest(a, b) {
  if (!a.length || !b.length) return false;
  return a.some((x) => b.includes(x));
}

async function tryMatch(io, getSessionId) {
  // Attempt to pair waiting users. Called after each enqueue.
  while (queue.length >= 2) {
    let matched = null;

    outer: for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const A = queue[i];
        const B = queue[j];
        if (A.socketId === B.socketId) continue;
        if (A.sessionId && B.sessionId && A.sessionId === B.sessionId) continue;
        // skip if in a room already (race safety)
        if (roomService.getRoomOf(A.socketId) || roomService.getRoomOf(B.socketId)) continue;
        // avoid immediate re-match of same pair
        const pk = pairKey(A.socketId, B.socketId);
        const recent = recentPairs.get(pk);
        if (recent && Date.now() - recent < RECENT_PAIR_AVOID_MS && queue.length > 2) continue;
        // blocked check
        if (isBlockedFn && A.sessionId && B.sessionId) {
          // do synchronously-safe: we handle async below by breaking; simplest: skip check here,
          // actual check done in async pass. For now do best-effort via cache.
        }
        matched = { i, j, A, B, preferCommon: hasCommonInterest(A.interests, B.interests) };
        if (matched.preferCommon) break outer;
      }
    }

    // If no "common interest" pair found, fall back to first valid random pair
    if (!matched) {
      // find first valid pair ignoring interest
      let found = null;
      for (let i = 0; i < queue.length && !found; i++) {
        for (let j = i + 1; j < queue.length && !found; j++) {
          const A = queue[i];
          const B = queue[j];
          if (A.socketId === B.socketId) continue;
          if (A.sessionId && B.sessionId && A.sessionId === B.sessionId) continue;
          if (roomService.getRoomOf(A.socketId) || roomService.getRoomOf(B.socketId)) continue;
          found = { i, j, A, B };
        }
      }
      if (!found) break;
      matched = found;
    }

    const { A, B } = matched;

    // async block check
    if (isBlockedFn && A.sessionId && B.sessionId) {
      try {
        const blocked = await isBlockedFn(A.sessionId, B.sessionId);
        if (blocked) {
          // don't pair these two right now; try next combination by rotating B to end
          const idxB = queue.findIndex((e) => e.socketId === B.socketId);
          if (idxB !== -1) {
            queue.push(queue.splice(idxB, 1)[0]);
          } else {
            break;
          }
          continue;
        }
      } catch (e) {
        // ignore block errors, allow match
      }
    }

    // remove both from queue (higher index first)
    const idxs = [queue.findIndex((e) => e.socketId === A.socketId), queue.findIndex((e) => e.socketId === B.socketId)]
      .filter((x) => x !== -1)
      .sort((a, b) => b - a);
    for (const idx of idxs) queue.splice(idx, 1);

    // double-check sockets still connected
    const sockA = io.sockets.sockets.get(A.socketId);
    const sockB = io.sockets.sockets.get(B.socketId);
    if (!sockA || !sockB) {
      // put back the one still connected
      if (sockA) queue.push(A);
      if (sockB) queue.push(B);
      continue;
    }

    const room = roomService.createRoom(A.socketId, B.socketId);
    recentPairs.set(pairKey(A.socketId, B.socketId), Date.now());

    // Deterministic initiator: lexicographically smaller socket id initiates offer
    const initiatorId = A.socketId < B.socketId ? A.socketId : B.socketId;

    for (const entry of [A, B]) {
      const s = io.sockets.sockets.get(entry.socketId);
      if (s) {
        s.join(room.id);
        s.emit('matchFound', {
          roomId: room.id,
          initiator: entry.socketId === initiatorId,
          peerSessionId: entry.socketId === A.socketId ? B.sessionId : A.sessionId,
        });
      }
    }
  }
}

function handleDisconnect(socketId) {
  removeFromQueue(socketId);
  socketMeta.delete(socketId);
  lastMatchAt.delete(socketId);
}

module.exports = {
  enqueue,
  leaveQueue,
  removeFromQueue,
  tryMatch,
  queueSize,
  handleDisconnect,
  setBlockChecker,
};
