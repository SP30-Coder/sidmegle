const Report = require('../models/Report');

const memoryReports = [];
const lastReportAt = new Map(); // reporterSessionId -> timestamp
const REPORT_COOLDOWN_MS = 10 * 1000;

function isDbReady() {
  const mongoose = require('mongoose');
  return mongoose.connection && mongoose.connection.readyState === 1;
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
      return saved;
    } catch (e) {
      console.warn('[Report] DB write failed:', e.message);
      return doc;
    }
  }
  return doc;
}

module.exports = { createReport };
