const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const isDev = process.env.NODE_ENV !== 'production';

// ─── ALLOWED ORIGINS ───────────────────────────────────────────────────
// In dev: allow localhost + your network IP so phone can connect
// In prod: only allow the configured CLIENT_URL
const allowedOrigins = isDev
  ? [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://172.20.10.4:5173',   // ← Your iPhone frontend
      'http://172.20.10.4:3000',
    ]
  : [process.env.CLIENT_URL];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400,
};

// ─── HELMET CONFIG ─────────────────────────────────────────────────────
// Allow connections from both localhost and network IP
const connectSrcOrigins = isDev
  ? [
      "'self'",
      'http://localhost:5173',
      'http://localhost:3000',
      'http://172.20.10.4:5173',
      'http://172.20.10.4:3000',
      'http://localhost:5000',
      'http://172.20.10.4:5000',
      'ws://localhost:5000',       // WebSocket
      'ws://172.20.10.4:5000',
      'wss://localhost:5000',
      'wss://172.20.10.4:5000',
    ]
  : ["'self'", process.env.CLIENT_URL];

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: connectSrcOrigins,
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'https:', 'blob:'],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: isDev ? false : {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// ============ RATE LIMITERS ============
// Skip ALL rate limiting in development
const skipInDev = (req, res, next) => next();

// Global: generous limit for general traffic
const globalRateLimit = isDev ? skipInDev : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 min (~33/min)
  message: {
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});

// Auth: 20 attempts per 15 min (enough for testing login/logout)
const authRateLimit = isDev ? skipInDev : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 min
  message: {
    message: 'Too many login attempts, please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// API: 200 per minute for normal browsing
const apiRateLimit = isDev ? skipInDev : rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: {
    message: 'API rate limit exceeded, please slow down.',
    code: 'API_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment: 20 per hour
const paymentRateLimit = isDev ? skipInDev : rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    message: 'Payment attempts limited, please try again later.',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Withdrawal: 5 per day
const withdrawalRateLimit = isDev ? skipInDev : rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: {
    message: 'Withdrawal limit reached for today.',
    code: 'WITHDRAWAL_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};

const requestSanitizer = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'P2002') {
    return res.status(409).json({
      message: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      message: 'Resource not found',
      code: 'NOT_FOUND',
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.errors,
      code: 'VALIDATION_ERROR',
    });
  }

  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      message: 'Invalid data provided',
      code: 'INVALID_DATA',
    });
  }

  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
    code: 'INTERNAL_ERROR',
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
  });
};

module.exports = {
  corsOptions,
  helmetConfig,
  globalRateLimit,
  authRateLimit,
  apiRateLimit,
  paymentRateLimit,
  withdrawalRateLimit,
  securityHeaders,
  requestSanitizer,
  errorHandler,
  notFoundHandler,
};