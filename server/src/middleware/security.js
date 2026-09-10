const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

function applySecurity(app) {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const allowed = clientUrl.split(',').map((s) => s.trim()).filter(Boolean);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
    })
  );

  app.use(express_json_limit());

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);
}

function express_json_limit() {
  const express = require('express');
  return express.json({ limit: '50kb' });
}

module.exports = { applySecurity };
