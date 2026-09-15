const config = require('../config/security');
const { logSecurity } = require('../utils/securityLogger');

const connectionsByIp = new Map();
const attemptsByIp = new Map();
const eventsBySocket = new Map();

function getClientIp(socket) {
  const headers = socket.handshake?.headers || {};
  if (config.TRUST_CLOUDFLARE_HEADERS) {
    const forwarded = headers['cf-connecting-ip'] || headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return String(socket.handshake?.address || 'unknown').slice(0, 64);
}

function checkConn(ip) {
  const now = Date.now();
  const recent = (attemptsByIp.get(ip) || []).filter((time) => now - time < 60000);
  recent.push(now);
  attemptsByIp.set(ip, recent);
  if (recent.length > config.MAX_CONN_PER_IP_PER_MIN) return { ok: false, reason: 'connection rate limit' };
  if ((connectionsByIp.get(ip)?.size || 0) >= config.MAX_SOCKETS_PER_IP) return { ok: false, reason: 'socket limit' };
  return { ok: true };
}

function trackConn(ip, socketId) {
  const sockets = connectionsByIp.get(ip) || new Set();
  sockets.add(socketId);
  connectionsByIp.set(ip, sockets);
  eventsBySocket.set(socketId, new Map());
}

function releaseConn(ip, socketId) {
  const sockets = connectionsByIp.get(ip);
  if (sockets) {
    sockets.delete(socketId);
    if (!sockets.size) connectionsByIp.delete(ip);
  }
  eventsBySocket.delete(socketId);
}

function checkRate(socketId, event, max, windowMs) {
  const now = Date.now();
  const buckets = eventsBySocket.get(socketId) || new Map();
  const recent = (buckets.get(event) || []).filter((time) => now - time < windowMs);
  recent.push(now);
  buckets.set(event, recent);
  eventsBySocket.set(socketId, buckets);
  return recent.length <= max;
}

function isPlain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key) || hasForbiddenKey(value[key]));
}

function validateEnvelope(payload, maxBytes) {
  if (payload === undefined) return { ok: true };
  if (!isPlain(payload) || hasForbiddenKey(payload)) return { ok: false, reason: 'invalid payload' };
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { return { ok: false, reason: 'invalid payload' }; }
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) return { ok: false, reason: 'payload too large' };
  return { ok: true };
}

function rejectExtra(payload, allowed) {
  if (!isPlain(payload)) return { ok: false, reason: 'invalid payload' };
  const extra = Object.keys(payload).find((key) => !allowed.includes(key));
  return extra ? { ok: false, reason: `unexpected field: ${extra}` } : { ok: true };
}

function recordViolation(ip, socketId, sessionId, reason) {
  logSecurity('socket-violation', { ip, socketId, sessionId, reason });
}

setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [ip, values] of attemptsByIp) {
    const current = values.filter((time) => time > cutoff);
    if (current.length) attemptsByIp.set(ip, current); else attemptsByIp.delete(ip);
  }
}, 60000).unref();

module.exports = { getClientIp, checkConn, trackConn, releaseConn, checkRate, validateEnvelope, rejectExtra, recordViolation };
