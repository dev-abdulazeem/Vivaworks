const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../config/redis');

const createRedisStore = (prefix = 'rl') => {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `${prefix}:`,
  });
};

const apiLimiter = rateLimit({
  store: createRedisStore('rl:api'),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  store: createRedisStore('rl:auth'),
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

const jobPostLimiter = rateLimit({
  store: createRedisStore('rl:job'),
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Daily job posting limit reached.' },
});

const proposalLimiter = rateLimit({
  store: createRedisStore('rl:proposal'),
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Hourly proposal limit reached.' },
});

const messageLimiter = rateLimit({
  store: createRedisStore('rl:message'),
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Message rate limit exceeded. Please slow down.' },
});

module.exports = { apiLimiter, authLimiter, jobPostLimiter, proposalLimiter, messageLimiter };