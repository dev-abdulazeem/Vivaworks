const express = require('express');
const router = express.Router();
const { requireVerifiedFor } = require('../controllers/user.controller');
const { body } = require('express-validator');
const {
  sendMessage,
  getConversation,
  getConversationsList,
  markAsRead,
  deleteMessage,
  getUnreadCount,
  blockContact,
  unblockContact,
  getBlockedContacts,
  archiveConversation,
  unarchiveConversation,
  getArchivedConversations,
  initiateVideoCall,
  endVideoCall,
  getCallHistory,
  getCallById
} = require('../controllers/message.controller');
const {
  createOffer,
  acceptOffer,
  rejectOffer,
  cancelOffer,
  getMyOffers,
  getOfferById,
} = require('../controllers/offer.controller');
const { uploadMessageFile } = require('../utils/cloudinary');
const { authenticate } = require('../middleware/auth');

router.get('/conversations', authenticate, requireVerifiedFor('standard'), getConversationsList);
router.get('/conversation/:userId', authenticate, requireVerifiedFor('standard'), getConversation);
router.get('/unread-count', authenticate, requireVerifiedFor('standard'), getUnreadCount);
router.patch('/read/:userId', authenticate, requireVerifiedFor('standard'), markAsRead);

// ─── MESSAGES ───────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireVerifiedFor('standard'),
  body('receiverId').notEmpty().withMessage('Receiver ID is required'),
  body('content').optional().trim().isLength({ max: 5000 }).withMessage('Content max 5000 characters'),
  body('type').optional().isIn(['text', 'image', 'pdf', 'file']).withMessage('Invalid message type'),
  sendMessage
);

router.post(
  '/upload',
  authenticate,
  requireVerifiedFor('standard'),
  uploadMessageFile.single('file'),
  body('receiverId').notEmpty().withMessage('Receiver ID is required'),
  body('content').optional().trim(),
  sendMessage
);

router.delete('/:messageId', authenticate, requireVerifiedFor('standard'), deleteMessage);

// ─── BLOCK / UNBLOCK ────────────────────────────────────────
router.post('/block/:userId', authenticate, requireVerifiedFor('standard'), blockContact);
router.delete('/block/:userId', authenticate, requireVerifiedFor('standard'), unblockContact);
router.get('/blocked', authenticate, requireVerifiedFor('standard'), getBlockedContacts);

// ─── ARCHIVE ────────────────────────────────────────────────
router.post('/archive/:userId', authenticate, requireVerifiedFor('standard'), archiveConversation);
router.delete('/archive/:userId', authenticate, requireVerifiedFor('standard'), unarchiveConversation);
router.get('/archived', authenticate, requireVerifiedFor('standard'), getArchivedConversations);

// ─── VIDEO CALL ─────────────────────────────────────────────
router.post('/call/initiate', authenticate, requireVerifiedFor('standard'), initiateVideoCall);
router.patch('/call/:callId/end', authenticate, requireVerifiedFor('standard'), endVideoCall);
router.get('/call/history', authenticate, requireVerifiedFor('standard'), getCallHistory);
router.get('/call/:callId', authenticate, requireVerifiedFor('standard'), getCallById);

// ─── OFFERS ─────────────────────────────────────────────────
router.post(
  '/offers',
  authenticate,
  requireVerifiedFor('standard'),
  [
    body('receiverId').notEmpty().withMessage('Receiver ID is required'),
    body('amount').isFloat({ min: 100 }).withMessage('Minimum offer amount is ₦100'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 characters'),
    body('durationDays').optional().isInt({ min: 1, max: 90 }).withMessage('Duration must be 1-90 days'),
    body('revisions').optional().isInt({ min: 0, max: 10 }).withMessage('Revisions must be 0-10'),
    body('deliverables').optional().isArray().withMessage('Deliverables must be an array'),
    body('milestones').optional().isArray().withMessage('Milestones must be an array'),
  ],
  createOffer
);

router.patch('/offers/:offerId/accept', authenticate, requireVerifiedFor('standard'), acceptOffer);
router.patch('/offers/:offerId/reject', authenticate, requireVerifiedFor('standard'), rejectOffer);
router.patch('/offers/:offerId/cancel', authenticate, requireVerifiedFor('standard'), cancelOffer);
router.get('/offers/my', authenticate, requireVerifiedFor('standard'), getMyOffers);
router.get('/offers/:offerId', authenticate, requireVerifiedFor('standard'), getOfferById);


module.exports = router;