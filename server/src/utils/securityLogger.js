function redactIp(ip) {
  if (typeof ip !== 'string') return 'unknown';
  if (ip.includes('.')) return `${ip.split('.').slice(0, 3).join('.')}.xxx`;
  if (ip.includes(':')) return `${ip.split(':').slice(0, 4).join(':')}::xxxx`;
  return 'redacted';
}

function shortId(value) {
  if (typeof value !== 'string' || !value) return 'none';
  return value.length <= 8 ? `${value.slice(0, 4)}...` : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function logSecurity(event, details = {}) {
  console.warn(`[Security] ${JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ip: redactIp(details.ip),
    session: shortId(details.sessionId),
    socket: shortId(details.socketId),
    reason: typeof details.reason === 'string' ? details.reason.slice(0, 120) : '',
  })}`);
}

module.exports = { logSecurity, redactIp, shortId };
