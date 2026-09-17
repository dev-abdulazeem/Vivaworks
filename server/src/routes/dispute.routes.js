const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireVerifiedFor } = require('../controllers/user.controller');
const {
  getAllDisputes,
  getDisputeById,
  addDisputeReply,
  updateDisputeStatus,
  resolveDispute,
} = require('../controllers/dispute.controller');
const { uploadPostMedia } = require('../utils/cloudinary');

// Admin: Get all disputes
router.get('/admin/disputes', authenticate, requireRole('admin'), getAllDisputes);

// Get single dispute (involved party or admin)
router.get('/:disputeId', authenticate, requireVerifiedFor('standard'), getDisputeById);

// Add reply with evidence (buyer or freelancer)
router.post(
  '/:disputeId/reply',
  authenticate,
  requireVerifiedFor('standard'),
  uploadPostMedia.array('files', 10),
  body('content').optional().trim(),
  addDisputeReply
);

// Admin: Update status
router.patch(
  '/admin/disputes/:disputeId/status',
  authenticate,
  requireRole('admin'),
  body('status').isIn(['open', 'under_review', 'resolved']),
  updateDisputeStatus
);

// Admin: Resolve dispute
router.patch(
  '/admin/disputes/:disputeId/resolve',
  authenticate,
  requireRole('admin'),
  body('resolution').isIn(['buyer_wins', 'freelancer_wins', 'split', 'custom']),
  resolveDispute
);

module.exports = router;