const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config/security');
const { logSecurity } = require('../utils/securityLogger');

function applySecurity(app) {
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", ...config.ALLOWED_ORIGINS, 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: config.isProd ? undefined : false,
  }));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (config.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error('Origin not allowed'));
      },
      credentials: false,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    })
  );

  app.use(express_json_limit(config.JSON_LIMIT));
  app.use((req, res, next) => {
    req.setTimeout(config.REQUEST_TIMEOUT_MS, () => {
      if (!res.headersSent) res.status(408).json({ ok: false, message: 'Request timeout.' });
      req.destroy();
    });
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ ok: false, message: 'Request too large.' });
    if (err instanceof SyntaxError && err.status === 400) return res.status(400).json({ ok: false, message: 'Malformed JSON.' });
    if (err.message === 'Origin not allowed') return res.status(403).json({ ok: false, message: 'Origin not allowed.' });
    logSecurity('http-error', { ip: req.ip, reason: err.message });
    return next(err);
  });
}

function express_json_limit(limit) {
  const express = require('express');
  return express.json({ limit, strict: true });
}

module.exports = { applySecurity };
