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

function requireMongoWrites() {
  return process.env.REQUIRE_MONGODB_WRITES === 'true' || process.env.NODE_ENV === 'production';
}

async function addBlock(blockerSessionId, blockedSessionId) {
  if (!blockerSessionId || !blockedSessionId) throw new Error('Missing session ids');
  if (blockerSessionId === blockedSessionId) throw new Error('Cannot block yourself');
  memoryBlocks.add(key(blockerSessionId, blockedSessionId));
  if (isDbReady()) {
    try {
      const result = await Block.updateOne(
        { blockerSessionId, blockedSessionId },
        { $setOnInsert: { blockerSessionId, blockedSessionId } },
        { upsert: true }
      );
      console.log(
        `[Block] Stored in MongoDB: ${Block.collection.name} matched=${result.matchedCount} modified=${result.modifiedCount} upserted=${result.upsertedCount}`
      );
    } catch (e) {
      console.warn('[Block] DB write failed:', e.message);
      if (requireMongoWrites()) {
        const err = new Error('Could not save block to database.');
        err.code = 'DB_WRITE_FAILED';
        throw err;
      }
    }
  } else if (requireMongoWrites()) {
    const err = new Error('Database is not connected. Could not save block.');
    err.code = 'DB_NOT_READY';
    throw err;
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
