console.log('Testing imports...\n');

const tests = [
  'ioredis',
  'winston',
  'prom-client',
  'express-rate-limit',
  'rate-limit-redis',
  'helmet',
  'compression',
];

for (const pkg of tests) {
  try {
    require(pkg);
    console.log(`✅ ${pkg} - OK`);
  } catch (err) {
    console.log(`❌ ${pkg} - MISSING: ${err.message}`);
  }
}

console.log('\nTesting local files...');

const files = [
  './src/config/redis',
  './src/config/logger',
  './src/utils/cache',
  './src/middleware/cache',
  './src/middleware/metrics',
  './src/middleware/rateLimit',
  './src/routes/health',
];

for (const file of files) {
  try {
    require(file);
    console.log(`✅ ${file} - OK`);
  } catch (err) {
    console.log(`❌ ${file} - ERROR: ${err.message}`);
  }
}