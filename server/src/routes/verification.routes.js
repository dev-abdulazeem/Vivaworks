const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  getRequirements,
  submitDocuments,
  getMyStatus,
  getPendingVerifications,
  getVerificationDetail,
  approveVerification,
  rejectVerification,
  getVerificationStats,
} = require('../controllers/verification.controller');

// Multer config for file uploads
const upload = multer({
  dest: 'uploads/verifications/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 3,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed'), false);
    }
  },
});

// User routes
router.get('/requirements', authenticate, getRequirements);
router.get('/status', authenticate, getMyStatus);

router.post(
  '/submit',
  authenticate,
  upload.fields([
    { name: 'idImageFront', maxCount: 1 },
    { name: 'idImageBack', maxCount: 1 },
    { name: 'selfieImage', maxCount: 1 },
  ]),
  [
    body('documentType').notEmpty().withMessage('Document type is required'),
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('documentNumber').trim().notEmpty().withMessage('Document number is required'),
    body('country').trim().notEmpty().withMessage('Country is required'),
  ],
  submitDocuments
);

// Admin routes
router.get('/admin/pending', authenticate, getPendingVerifications);
router.get('/admin/stats', authenticate, getVerificationStats);
router.get('/admin/:id', authenticate, getVerificationDetail);
router.post('/admin/:id/approve', authenticate, approveVerification);
router.post('/admin/:id/reject', authenticate, [
  body('rejectionReason').trim().isLength({ min: 10 }).withMessage('Rejection reason required (min 10 chars)'),
], rejectVerification);

module.exports = router;