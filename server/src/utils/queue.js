const { Queue, Worker, QueueScheduler } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../config/logger');

// Connection config for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Job queues
const emailQueue = new Queue('email', { connection });
const notificationQueue = new Queue('notification', { connection });
const contractQueue = new Queue('contract', { connection });
const reportQueue = new Queue('report', { connection });

// Email worker
const emailWorker = new Worker('email', async (job) => {
  const { type, to, subject, data } = job.data;
  
  logger.info(`Processing email job: ${type} to ${to}`);
  
  switch (type) {
    case 'WELCOME':
      // Send welcome email
      break;
    case 'PROPOSAL_RECEIVED':
      // Notify client of new proposal
      break;
    case 'CONTRACT_STARTED':
      // Notify both parties
      break;
    case 'PAYMENT_RECEIVED':
      // Payment confirmation
      break;
    case 'DISPUTE_FILED':
      // Dispute notification
      break;
    default:
      logger.warn(`Unknown email type: ${type}`);
  }
}, { connection });

// Notification worker
const notificationWorker = new Worker('notification', async (job) => {
  const { userId, type, message, data } = job.data;
  
  logger.info(`Processing notification for user: ${userId}`);
  
  // Create in-app notification
  // Emit via Socket.io if user is online
  // Send push notification if enabled
  
}, { connection });

// Contract worker
const contractWorker = new Worker('contract', async (job) => {
  const { type, contractId } = job.data;
  
  switch (type) {
    case 'REMINDER':
      // Send contract deadline reminder
      break;
    case 'AUTO_COMPLETE':
      // Auto-complete contract after deadline
      break;
    case 'MILESTONE_DUE':
      // Milestone reminder
      break;
  }
}, { connection });

// Error handlers
[emailWorker, notificationWorker, contractWorker].forEach(worker => {
  worker.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed:`, err);
  });
  
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });
});

// Queue helpers
class QueueService {
  static async addEmailJob(type, to, subject, data, options = {}) {
    return emailQueue.add(type, { type, to, subject, data }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...options
    });
  }

  static async addNotificationJob(userId, type, message, data, options = {}) {
    return notificationQueue.add(type, { userId, type, message, data }, {
      attempts: 2,
      ...options
    });
  }

  static async addContractJob(type, contractId, options = {}) {
    return contractQueue.add(type, { type, contractId }, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 10000 },
      ...options
    });
  }

  static async scheduleContractReminder(contractId, delayMs) {
    return contractQueue.add('REMINDER', { type: 'REMINDER', contractId }, {
      delay: delayMs
    });
  }
}

module.exports = {
  QueueService,
  emailQueue,
  notificationQueue,
  contractQueue,
  reportQueue
};