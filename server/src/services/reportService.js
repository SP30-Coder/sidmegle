const Report = require('../models/Report');

const memoryReports = [];
const lastReportAt = new Map(); // reporterSessionId -> timestamp
const REPORT_COOLDOWN_MS = 10 * 1000;

function isDbReady() {
  const mongoose = require('mongoose');
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function requireMongoWrites() {
  return process.env.REQUIRE_MONGODB_WRITES === 'true' || process.env.NODE_ENV === 'production';
}

async function createReport({ reporterSessionId, reportedSessionId, reason, details, roomId }) {
  if (typeof reporterSessionId !== 'string' || typeof reportedSessionId !== 'string' || reporterSessionId === reportedSessionId) {
    const err = new Error('Invalid report identities');
    err.code = 'INVALID';
    throw err;
  }
  const now = Date.now();
  const last = lastReportAt.get(reporterSessionId) || 0;
  if (now - last < REPORT_COOLDOWN_MS) {
    const err = new Error('You are reporting too quickly. Please wait a few seconds.');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  lastReportAt.set(reporterSessionId, now);

  // duplicate protection: same reporter+reported within 5 min
  const recent = memoryReports.find(
    (r) =>
      r.reporterSessionId === reporterSessionId &&
      r.reportedSessionId === reportedSessionId &&
      now - r.createdAt < 5 * 60 * 1000
  );
  if (recent) {
    const err = new Error('You already reported this user recently.');
    err.code = 'DUPLICATE';
    throw err;
  }

  const doc = {
    reporterSessionId,
    reportedSessionId,
    reason,
    details: (details || '').slice(0, 500),
    roomId: roomId || '',
    createdAt: now,
  };
  memoryReports.push(doc);
  if (memoryReports.length > 500) memoryReports.shift();

  if (isDbReady()) {
    try {
      const saved = await Report.create({
        reporterSessionId,
        reportedSessionId,
        reason,
        details: doc.details,
        roomId: doc.roomId,
      });
      console.log(`[Report] Stored in MongoDB: ${saved.collection.name}/${saved._id}`);
      return saved;
    } catch (e) {
      console.warn('[Report] DB write failed:', e.message);
      if (requireMongoWrites()) {
        const err = new Error('Could not save report to database.');
        err.code = 'DB_WRITE_FAILED';
        throw err;
      }
      return doc;
    }
  }
  if (requireMongoWrites()) {
    const err = new Error('Database is not connected. Could not save report.');
    err.code = 'DB_NOT_READY';
    throw err;
  }
  return doc;
}

module.exports = { createReport };
