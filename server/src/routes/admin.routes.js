const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  suspendUser,
  unsuspendUser,
  verifyUserKyc,
  rejectKyc,
  getAllJobs,
  getAllTransactions,
  getDisputes,
  getDisputeById,
  resolveDispute,
  getKycDocuments,
  getPlatformRevenue,
  getWithdrawalRequests,
  updateWithdrawalStatus,
} = require('../controllers/admin.controller');
const { authenticate, requireVerified, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireVerified, requireAdmin);

// ─── DASHBOARD ───────────────────────────────────────────────────────────
router.get('/dashboard', getDashboardStats);

// ─── USERS ───────────────────────────────────────────────────────────────
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetails);
router.patch('/users/:userId/suspend', body('reason').optional().trim(), suspendUser);
router.patch('/users/:userId/unsuspend', unsuspendUser);
router.patch('/users/:userId/verify-kyc', verifyUserKyc);
router.patch('/users/:userId/reject-kyc', body('reason').optional().trim(), rejectKyc);

// ─── JOBS ────────────────────────────────────────────────────────────────
router.get('/jobs', getAllJobs);

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────
router.get('/transactions', getAllTransactions);

// ─── DISPUTES ──────────────────────────────────────────────────────────────
router.get('/disputes', getDisputes);
router.get('/disputes/:disputeId', getDisputeById);
router.patch(
  '/disputes/:disputeId/resolve',
  body('resolution').isIn(['buyer_wins', 'freelancer_wins', 'split', 'custom']).withMessage('Resolution must be buyer_wins, freelancer_wins, split, or custom'),
  body('adminNotes').optional().trim(),
  body('refundAmount').optional().isFloat({ min: 0 }).withMessage('Refund amount must be a positive number'),
  resolveDispute
);

// ─── KYC / DOCUMENT VERIFICATION ─────────────────────────────────────────
router.get('/kyc-documents', getKycDocuments);

// ─── PLATFORM REVENUE ────────────────────────────────────────────────────
router.get('/revenue', getPlatformRevenue);

// ─── WITHDRAWALS ─────────────────────────────────────────────────────────
router.get('/withdrawals', getWithdrawalRequests);
router.patch(
  '/withdrawals/:transactionId',
  body('status').isIn(['completed', 'rejected']).withMessage('Status must be completed or rejected'),
  body('notes').optional().trim(),
  updateWithdrawalStatus
);

module.exports = router;