const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'vivawork_'
});

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'vivawork_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 3, 5, 10]
});
register.registerMetric(httpRequestDuration);

const httpRequestsTotal = new client.Counter({
  name: 'vivawork_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

const activeConnections = new client.Gauge({
  name: 'vivawork_active_connections',
  help: 'Number of active connections'
});
register.registerMetric(activeConnections);

module.exports = {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  activeConnections
};