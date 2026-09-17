const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { requireVerifiedFor } = require('../controllers/user.controller');
const {
  createContract,
  initiateContractPayment,
  verifyContractPayment,
  getMyContracts,
  getContractById,
  completeContract,
  cancelContract,
  submitDelivery,
  confirmDelivery,
  requestRevision,
  fileDispute,
  requestExtension,
  approveExtension,
  getPendingExtension,
} = require('../controllers/contract.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { paymentRateLimit } = require('../middleware/security');
const { uploadDeliveryFile } = require('../utils/cloudinary');

router.get('/my-contracts', authenticate, requireVerifiedFor('standard'), getMyContracts);
router.get('/:contractId', authenticate, requireVerifiedFor('standard'), getContractById);

router.post('/', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), body('proposalId').notEmpty(), createContract);
router.post('/:contractId/pay', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), paymentRateLimit, initiateContractPayment);
router.post('/verify-payment', authenticate, requireVerifiedFor('standard'), verifyContractPayment);

// Delivery routes — multer handles Cloudinary upload
router.post(
  '/:contractId/deliver',
  authenticate,
  requireVerifiedFor('standard'),
  requireRole('freelancer'),
  uploadDeliveryFile.array('files', 10), // up to 10 files
  submitDelivery
);
router.patch('/:contractId/confirm', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), confirmDelivery);
router.patch('/:contractId/revision', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), body('feedback').optional().trim(), requestRevision);

router.patch('/:contractId/complete', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), completeContract);
router.patch('/:contractId/cancel', authenticate, requireVerifiedFor('standard'), body('reason').optional().trim(), cancelContract);

// ─── EXTENSION ROUTES ────────────────────────────────────────────────────
router.post('/:contractId/extension', authenticate, requireVerifiedFor('standard'), requireRole('freelancer'), body('days').isInt({ min: 1, max: 30 }), requestExtension);
router.patch('/:contractId/extension/respond', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), body('action').isIn(['approve', 'reject']), approveExtension);
 router.get('/:contractId/extension/pending', authenticate, requireVerifiedFor('standard'), getPendingExtension);
// ─── DISPUTE ROUTE ───────────────────────────────────────────────────────

const { uploadPostMedia } = require('../utils/cloudinary');

router.post(
  '/:contractId/dispute',
  authenticate,
  requireVerifiedFor('standard'),
  uploadPostMedia.array('evidence', 10),
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  fileDispute
);

module.exports = router;