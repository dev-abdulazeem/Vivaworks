const CacheService = require('../utils/cache');

/**
 * Cache middleware for Express routes
 * @param {number} duration - Cache duration in seconds
 * @param {Function} keyGenerator - Custom key generator function
 */
const cacheMiddleware = (duration = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const key = keyGenerator 
      ? keyGenerator(req)
      : `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;

    try {
      const cached = await CacheService.get(key);
      
      if (cached) {
        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', key);
        return res.status(200).json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json to cache response
      res.json = (data) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          CacheService.set(key, data, duration).catch(console.error);
        }
        
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', key);
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Invalidate cache middleware
 * @param {string|Array<string>} patterns - Key patterns to invalidate
 */
const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    
    // Store original json method
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    res.json = (data) => {
      // Invalidate cache after successful mutation
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patternList.forEach(pattern => {
          CacheService.deletePattern(pattern).catch(console.error);
        });
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCache
};