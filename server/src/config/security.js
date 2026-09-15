const isProd = process.env.NODE_ENV === 'production';

function origins(value) {
  return String(value || 'http://localhost:5173').split(',').map((item) => item.trim()).filter(Boolean);
}

const ALLOWED_ORIGINS = origins(process.env.CLIENT_URL || process.env.FRONTEND_URL);
if (isProd && ALLOWED_ORIGINS.includes('*')) throw new Error('Wildcard CORS is forbidden in production.');

module.exports = {
  isProd,
  ALLOWED_ORIGINS,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  TRUST_CLOUDFLARE_HEADERS: process.env.TRUST_CLOUDFLARE_HEADERS === 'true',
  JSON_LIMIT: process.env.JSON_LIMIT || '50kb',
  REQUEST_TIMEOUT_MS: Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),
  MAX_SOCKET_PAYLOAD_BYTES: Number.parseInt(process.env.MAX_SOCKET_PAYLOAD_BYTES || '100000', 10),
  MAX_SOCKETS_PER_IP: Number.parseInt(process.env.MAX_SOCKETS_PER_IP || '10', 10),
  MAX_CONN_PER_IP_PER_MIN: Number.parseInt(process.env.MAX_CONN_PER_IP_PER_MIN || '30', 10),
  MAX_QUEUE: Number.parseInt(process.env.MAX_QUEUE || '2000', 10),
  MAX_ROOMS: Number.parseInt(process.env.MAX_ROOMS || '5000', 10),
};
