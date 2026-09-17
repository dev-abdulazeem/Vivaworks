const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');
const { authenticate, requireVerified } = require('../middleware/auth');

router.get('/', authenticate, requireVerified, getNotifications);
router.patch('/read-all', authenticate, requireVerified, markAllAsRead);
router.patch('/:notificationId/read', authenticate, requireVerified, markAsRead);
router.delete('/:notificationId', authenticate, requireVerified, deleteNotification);

module.exports = router;