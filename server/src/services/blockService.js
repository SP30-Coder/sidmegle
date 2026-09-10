const Block = require('../models/Block');

// In-memory fallback when Mongo is unavailable
const memoryBlocks = new Set(); // "blocker|blocked"

function key(a, b) {
  return `${a}|${b}`;
}

function isDbReady() {
  const mongoose = require('mongoose');
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function addBlock(blockerSessionId, blockedSessionId) {
  if (!blockerSessionId || !blockedSessionId) throw new Error('Missing session ids');
  if (blockerSessionId === blockedSessionId) throw new Error('Cannot block yourself');
  memoryBlocks.add(key(blockerSessionId, blockedSessionId));
  if (isDbReady()) {
    try {
      await Block.updateOne(
        { blockerSessionId, blockedSessionId },
        { $setOnInsert: { blockerSessionId, blockedSessionId } },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[Block] DB write failed:', e.message);
    }
  }
}

async function isBlocked(a, b) {
  if (!a || !b) return false;
  if (memoryBlocks.has(key(a, b)) || memoryBlocks.has(key(b, a))) return true;
  if (isDbReady()) {
    try {
      const found = await Block.findOne({
        $or: [
          { blockerSessionId: a, blockedSessionId: b },
          { blockerSessionId: b, blockedSessionId: a },
        ],
      }).lean();
      if (found) {
        memoryBlocks.add(key(found.blockerSessionId, found.blockedSessionId));
        return true;
      }
    } catch (e) {
      return false;
    }
  }
  return false;
}

module.exports = { addBlock, isBlocked };
