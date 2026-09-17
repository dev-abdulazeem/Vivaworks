const express = require('express');
const router = express.Router();
const redis = require('../config/redis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { register } = require('../config/metrics');

router.get('/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {},
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = { status: 'up' };
  } catch (error) {
    checks.services.database = { status: 'down', error: error.message };
    checks.status = 'unhealthy';
  }

  try {
    await redis.ping();
    checks.services.redis = { status: 'up' };
  } catch (error) {
    checks.services.redis = { status: 'down', error: error.message };
    checks.status = 'unhealthy';
  }

  res.status(checks.status === 'healthy' ? 200 : 503).json(checks);
});

router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive', uptime: process.uptime() });
});

router.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

router.get('/cache-stats', async (req, res) => {
  try {
    const info = await redis.info();
    const stats = {};
    info.split('\r\n').forEach((line) => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    });

    const hits = parseInt(stats.keyspace_hits) || 0;
    const misses = parseInt(stats.keyspace_misses) || 0;
    const total = hits + misses;

    res.json({
      connected_clients: stats.connected_clients,
      used_memory_human: stats.used_memory_human,
      keyspace_hits: hits,
      keyspace_misses: misses,
      hit_rate: total > 0 ? ((hits / total) * 100).toFixed(2) + '%' : 'N/A',
      uptime_in_seconds: stats.uptime_in_seconds,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

module.exports = { router };