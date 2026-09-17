const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createReview,
  getReviewsForUser,
  getMyReviews,
  getContractReview,
} = require('../controllers/review.controller');
const { authenticate, requireVerified } = require('../middleware/auth');

router.get('/my-reviews', authenticate, requireVerified, getMyReviews);
router.get('/user/:userId', getReviewsForUser);
router.get('/contract/:contractId', authenticate, getContractReview);

router.post('/contract/:contractId', authenticate, requireVerified, body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim().isLength({ max: 1000 }), createReview);

module.exports = router;