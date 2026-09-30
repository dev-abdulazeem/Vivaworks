// freelancer.routes.js
const express = require('express');
const router = express.Router();
const { searchFreelancers } = require('../controllers/freelancer.controller');
const { authenticate, requireRole } = require('../middleware/auth');

// Only buyers (clients) can access this
router.get('/search', authenticate, requireRole('buyer'), searchFreelancers);

module.exports = router;