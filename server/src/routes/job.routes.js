const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getFeaturedJobs,
  markJobFeatured,
} = require('../controllers/job.controller');
const { authenticate, requireVerified, requireRole } = require('../middleware/auth');

const jobValidation = [
  body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Title required, max 200 chars'),
  body('description').trim().notEmpty().isLength({ max: 10000 }).withMessage('Description required, max 10000 chars'),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be positive'),
  body('budgetType').optional().isIn(['fixed', 'hourly', 'retainer']).withMessage('Invalid budget type'),
  body('location').optional().trim().isLength({ max: 100 }),
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array(),
    });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
// IMPORTANT: Order matters! More specific routes FIRST
// ═══════════════════════════════════════════════════════════════

// Protected routes (authenticated users only)
router.get('/my-jobs', authenticate, requireVerified, requireRole('buyer'), getMyJobs);

// Public routes (no authentication required)
router.get('/featured', getFeaturedJobs); // ← NEW: Featured jobs endpoint
router.get('/search', getJobs); // Your existing search route
router.get('/:jobId', getJobById);
router.get('/', getJobs);

// Protected POST/PATCH/DELETE routes
router.post('/', authenticate, requireVerified, requireRole('buyer'), jobValidation, handleValidationErrors, createJob);
router.patch('/:jobId', authenticate, requireVerified, requireRole('buyer'), updateJob);
router.delete('/:jobId', authenticate, requireVerified, deleteJob);

// Admin-only: Feature/unfeature jobs
router.patch('/:jobId/feature', authenticate, markJobFeatured);

module.exports = router;