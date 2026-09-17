const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getWallet,
  getTransactionHistory,
  requestWithdrawalOtp,
  confirmWithdrawal,
  getBanks,
  verifyBankAccount,
  initializeTopUp,
  verifyTopUp,
  getSavedCards,
  deleteSavedCard,
  sendTip,
} = require('../controllers/wallet.controller');
const { authenticate, requireVerified } = require('../middleware/auth');
const { withdrawalRateLimit } = require('../middleware/security');

// ─── EXISTING ROUTES ───
router.get('/', authenticate, requireVerified, getWallet);
router.get('/transactions', authenticate, requireVerified, getTransactionHistory);
router.get('/banks', authenticate, requireVerified, getBanks);
router.post('/verify-account', authenticate, requireVerified, body('accountNumber').notEmpty(), body('bankCode').notEmpty(), verifyBankAccount);

router.post('/withdrawal-otp', authenticate, requireVerified, withdrawalRateLimit, body('amount').isFloat({ min: 1000 }), body('bankDetails').isObject(), requestWithdrawalOtp);
router.post('/confirm-withdrawal', authenticate, requireVerified, body('code').isLength({ min: 6, max: 6 }).isNumeric(), confirmWithdrawal);

// ═══ NEW: TOP-UP / ADD MONEY ROUTES ═══
router.post('/topup', authenticate, requireVerified, body('amount').isFloat({ min: 100 }), initializeTopUp);
router.post('/verify-topup', authenticate, requireVerified, body('reference').notEmpty(), verifyTopUp);

// ═══ NEW: SAVED CARDS ROUTES ═══
router.get('/cards', authenticate, requireVerified, getSavedCards);
router.delete('/cards/:cardId', authenticate, requireVerified, deleteSavedCard);

// ═══ TIP ROUTE ═══
router.post('/tip', authenticate, requireVerified, body('contractId').notEmpty(), body('amount').isFloat({ min: 500 }), sendTip);

// ═══ CHECK IF BUYER ALREADY TIPPED ═══
router.get('/tip-status', authenticate, requireVerified, async (req, res) => {
  try {
    const { contractId } = req.query;
    if (!contractId) {
      return res.status(400).json({ message: 'contractId required', code: 'MISSING_FIELDS' });
    }

    const existingTip = await prisma.tip.findFirst({
      where: {
        contractId,
        buyerId: req.user.id,
      },
    });

    return res.status(200).json({ hasTipped: !!existingTip });
  } catch (error) {
    console.error('Tip status error:', error);
    return res.status(500).json({ message: 'Failed to check tip status', code: 'ERROR' });
  }
});

module.exports = router;