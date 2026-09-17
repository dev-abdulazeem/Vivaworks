const redis = require('../config/redis');

const DEFAULT_TTL = 300; // 5 minutes

class CacheService {
  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {Promise<any|null>}
   */
  static async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {any} value - Data to cache
   * @param {number} ttl - Time to live in seconds
   */
  static async set(key, value, ttl = DEFAULT_TTL) {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached data
   * @param {string} key - Cache key
   */
  static async delete(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - Key pattern (e.g., "jobs:*")
   */
  static async deletePattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Cache deletePattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   */
  static async exists(key) {
    try {
      return await redis.exists(key);
    } catch (error) {
      console.error('Cache exists error:', error);
      return 0;
    }
  }

  /**
   * Get or Set pattern (cache-aside)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not cached
   * @param {number} ttl - Time to live
   */
  static async getOrSet(key, fetchFn, ttl = DEFAULT_TTL) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    if (data) {
      await this.set(key, data, ttl);
    }
    return data;
  }

  /**
   * Increment counter (for analytics, rate limiting)
   * @param {string} key - Counter key
   * @param {number} amount - Amount to increment
   */
  static async increment(key, amount = 1) {
    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error('Cache increment error:', error);
      return null;
    }
  }

  /**
   * Set expiration on key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live
   */
  static async expire(key, ttl) {
    try {
      return await redis.expire(key, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Flush all cache (use with caution!)
   */
  static async flushAll() {
    try {
      await redis.flushdb();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache stats
   */
  static async getStats() {
    try {
      const info = await redis.info();
      return info;
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }
}

module.exports = CacheService;