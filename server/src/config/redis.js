const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('🔌 Redis Cloud connected successfully');
});

redis.on('ready', () => {
  console.log('✅ Redis ready for operations');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

process.on('SIGTERM', async () => {
  await redis.quit();
  console.log('👋 Redis connection closed');
});

module.exports = redis;