const express = require('express');
const router = express.Router();
const {
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  getMyConnections,
  getPendingRequests,
  removeConnection,
  getConnectionSuggestions,
  checkConnectionStatus,      // <-- ADDED
} = require('../controllers/connection.controller');
const { authenticate, requireVerified } = require('../middleware/auth');

// List routes
router.get('/', authenticate, requireVerified, getMyConnections);           // GET /api/connections
router.get('/pending', authenticate, requireVerified, getPendingRequests);
router.get('/suggestions', authenticate, requireVerified, getConnectionSuggestions);
router.get('/check/:userId', authenticate, requireVerified, checkConnectionStatus);  // <-- ADDED

// Action routes
router.post('/request/:userId', authenticate, requireVerified, sendConnectionRequest);
router.patch('/accept/:connectionId', authenticate, requireVerified, acceptConnection);
router.patch('/reject/:connectionId', authenticate, requireVerified, rejectConnection);
router.delete('/:connectionId', authenticate, requireVerified, removeConnection);

module.exports = router;