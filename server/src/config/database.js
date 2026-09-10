const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) {
    console.warn('[DB] No MONGODB_URI provided. Running WITHOUT database (reports/blocks will be in-memory only).');
    return null;
  }
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[DB] MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    console.warn('[DB] Continuing without database. Chat still works; reports/blocks fall back to memory.');
    return null;
  }
}

module.exports = { connectDB, mongoose };
