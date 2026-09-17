require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const os = require('os');

// ─── NEW: Software Engineering Tooling ─────────────────────────────────
const compression = require('compression');
const redis = require('./config/redis');
const logger = require('./config/logger');
const { router: healthRouter } = require('./routes/health');
const metricsMiddleware = require('./middleware/metrics');
const { cacheMiddleware, invalidateCache } = require('./middleware/cache');
const { apiLimiter, authLimiter, jobPostLimiter, proposalLimiter, messageLimiter } = require('./middleware/rateLimit');

const { connectDB } = require('./config/database');
const { initializeSocket } = require('./utils/socket');
const { prisma } = require('./config/database');


const {
  corsOptions,
  helmetConfig,
  securityHeaders,
  notFoundHandler,
  errorHandler,
} = require('./middleware/security');

// ─── ROUTES ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const jobRoutes = require('./routes/job.routes');
const proposalRoutes = require('./routes/proposal.routes');
const contractRoutes = require('./routes/contract.routes');
const walletRoutes = require('./routes/wallet.routes');
const reviewRoutes = require('./routes/review.routes');
const postRoutes = require('./routes/post.routes');
const connectionRoutes = require('./routes/connection.routes');
const messageRoutes = require('./routes/message.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const paystackWebhookRoutes = require('./routes/paystackWebhook.routes');
const uploadRoutes = require('./routes/upload.routes');
const verificationRoutes = require('./routes/verification.routes');
const disputeRoutes = require('./routes/dispute.routes');
const audioRoomRoutes = require('./routes/audioRoom.routes');

// ─── CRON JOB FUNCTIONS ────────────────────────────────────────────────
const {
  processMaturedPayouts,
  autoCancelOverdueContracts,
  autoAcceptDeliveries,
} = require('./controllers/contract.controller');

const app = express();
const server = http.createServer(app);

// Trust proxy (required for rate limiting behind nginx/Cloudflare/VPN)
app.set('trust proxy', 1);

connectDB();
initializeSocket(server);

// ─── SECURITY MIDDLEWARE ───────────────────────────────────────────────
app.use(helmetConfig);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(compression()); // NEW: Compress responses

// ─── BODY PARSERS ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── METRICS MIDDLEWARE (before routes) ────────────────────────────────
app.use(metricsMiddleware);

// ─── HEALTH & METRICS ROUTES (no rate limit) ───────────────────────────
app.use('/', healthRouter);

// ─── WEBHOOK ROUTES (no rate limit — Paystack needs free access) ───────
app.use('/api/webhooks', paystackWebhookRoutes);

// ─── RATE LIMITING CONFIG ──────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

// In dev, skip Redis-based rate limiting (use simple pass-through)
// In production, use Redis-backed rate limiting
const getLimiter = (limiter) => isDev ? (req, res, next) => next() : limiter;

// ============ API ROUTES ============
app.use('/api/vivarooms', audioRoomRoutes);
app.use('/api/auth', getLimiter(authLimiter), authRoutes);
app.use('/api/users', getLimiter(apiLimiter), userRoutes);
app.use('/api/jobs', getLimiter(apiLimiter), jobRoutes);
app.use('/api/proposals', getLimiter(apiLimiter), proposalRoutes);
app.use('/api/contracts', getLimiter(apiLimiter), contractRoutes);
app.use('/api/wallet', getLimiter(apiLimiter), walletRoutes);
app.use('/api/reviews', getLimiter(apiLimiter), reviewRoutes);
app.use('/api/posts', getLimiter(apiLimiter), postRoutes);
app.use('/api/connections', getLimiter(apiLimiter), connectionRoutes);
app.use('/api/messages', getLimiter(apiLimiter), messageRoutes);
app.use('/api/notifications', getLimiter(apiLimiter), notificationRoutes);
app.use('/api/admin', getLimiter(apiLimiter), adminRoutes);
app.use('/api/upload', getLimiter(apiLimiter), uploadRoutes);
app.use('/api/utils', getLimiter(apiLimiter), require('./routes/utils.routes'));
app.use('/api/verification', getLimiter(apiLimiter), verificationRoutes);
app.use('/api/disputes', getLimiter(apiLimiter), disputeRoutes);


// ─── 404 HANDLER ───────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  });

  errorHandler(err, req, res, next);
});

// ─── GET NETWORK IP ────────────────────────────────────────────────────
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ─── START SERVER ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // ← KEY: Listen on ALL interfaces (localhost + network)
const networkIP = getNetworkIP();

server.listen(PORT, HOST, () => {
  logger.info(`🚀 VivaWork server running`);
  logger.info(`   → Local:    http://localhost:${PORT}`);
  logger.info(`   → Network:  http://${networkIP}:${PORT}`);
  logger.info(`   → Health:   http://localhost:${PORT}/health`);
  logger.info(`   → Metrics:  http://localhost:${PORT}/metrics`);
  logger.info(`   → Cache:    http://localhost:${PORT}/cache-stats`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`⏱️  Rate limiting: ${isDev ? 'DISABLED (dev mode)' : 'ENABLED (Redis-backed)'}`);
});

// ─── CRON JOBS ─────────────────────────────────────────────────────────

// 1. Matured payouts — Release freelancer payments after 2-day hold
cron.schedule('0 * * * *', async () => {
  logger.info('[Cron] Running matured payouts check...');
  try {
    const count = await processMaturedPayouts();
    logger.info(`[Cron] Released ${count} matured payouts`);
  } catch (err) {
    logger.error('[Cron] Matured payouts error:', err.message);
  }
});

// Run once immediately on startup
(async () => {
  try {
    const count = await processMaturedPayouts();
    if (count > 0) {
      logger.info(`[Startup] Released ${count} missed matured payouts`);
    }
  } catch (err) {
    logger.error('[Startup] Matured payouts error:', err.message);
  }
})();

// 2. Auto-cancel overdue contracts — Cancel contracts 1 day past deadline
cron.schedule('0 0 * * *', async () => {
  logger.info('[Cron] Running overdue contract cancellation...');
  try {
    const count = await autoCancelOverdueContracts();
    logger.info(`[Cron] Auto-cancelled ${count} overdue contracts`);
  } catch (err) {
    logger.error('[Cron] Auto-cancel error:', err.message);
  }
});

// Run once immediately on startup
(async () => {
  try {
    const count = await autoCancelOverdueContracts();
    if (count > 0) {
      logger.info(`[Startup] Auto-cancelled ${count} overdue contracts`);
    }
  } catch (err) {
    logger.error('[Startup] Auto-cancel error:', err.message);
  }
})();

// 3. Auto-accept deliveries — Accept deliveries after 2 days of no buyer response
cron.schedule('0 0 * * *', async () => {
  logger.info('[Cron] Running auto-accept deliveries check...');
  try {
    const count = await autoAcceptDeliveries();
    logger.info(`[Cron] Auto-accepted ${count} deliveries`);
  } catch (err) {
    logger.error('[Cron] Auto-accept error:', err.message);
  }
});

// Run once immediately on startup
(async () => {
  try {
    const count = await autoAcceptDeliveries();
    if (count > 0) {
      logger.info(`[Startup] Auto-accepted ${count} deliveries`);
    }
  } catch (err) {
    logger.error('[Startup] Auto-accept error:', err.message);
  }
})();

// 4. Online status cleanup — Mark inactive users as offline
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

setInterval(async () => {
  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  try {
    const result = await prisma.user.updateMany({
      where: {
        isOnline: true,
        lastActive: { lt: cutoff },
      },
      data: { isOnline: false },
    });
    if (result.count > 0) {
      logger.info(`[Cleanup] Marked ${result.count} user(s) as offline`);
    }
  } catch (err) {
    logger.error('[Cleanup] Online status cleanup error:', err.message);
  }
}, 60 * 1000);

// ─── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await redis.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.error('Error closing Redis:', err.message);
    }

    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error('Error closing database:', err.message);
    }

    logger.info('👋 Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.message);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});