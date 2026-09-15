const mongoose = require('mongoose');
const dns = require('dns');

function configureDnsServers() {
  const servers = (process.env.MONGODB_DNS_SERVERS || '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  if (!servers.length) return;

  dns.setServers(servers);
  console.log(`[DB] Using custom DNS servers for MongoDB SRV lookup: ${servers.join(', ')}`);
}

function isAtlasSrvDnsError(uri, err) {
  return (
    typeof uri === 'string' &&
    uri.startsWith('mongodb+srv://') &&
    (err.code === 'ECONNREFUSED' || err.message.includes('querySrv'))
  );
}

function getDatabaseName(uri) {
  const configuredName = (process.env.MONGODB_DB_NAME || '').trim();
  if (configuredName) return configuredName;

  try {
    const parsed = new URL(uri);
    const pathName = parsed.pathname.replace(/^\/+/, '').trim();
    return pathName || 'test';
  } catch (e) {
    return 'test';
  }
}

async function connectDB(uri) {
  const mongoUri = (uri || '').trim();
  if (!mongoUri) {
    console.warn('[DB] No MONGODB_URI provided. Running WITHOUT database (reports/blocks will be in-memory only).');
    return null;
  }
  try {
    configureDnsServers();
    const dbName = getDatabaseName(mongoUri);
    mongoose.set('strictQuery', true);
    await mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    if (isAtlasSrvDnsError(mongoUri, err)) {
      console.warn(
        '[DB] Atlas SRV DNS lookup failed. Check your internet/DNS/firewall, or use a local URI like mongodb://127.0.0.1:27017/test in server/.env.'
      );
    }
    console.warn('[DB] Continuing without database. Chat still works; reports/blocks fall back to memory.');
    return null;
  }
}

module.exports = { connectDB, mongoose };
