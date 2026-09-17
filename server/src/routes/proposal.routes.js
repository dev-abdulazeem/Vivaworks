const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { requireVerifiedFor } = require('../controllers/user.controller');
const {
  createProposal,
  getProposalsForJob,
  getMyProposals,
  updateProposal,
  updateProposalStatus,
  withdrawProposal,
} = require('../controllers/proposal.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const proposalValidation = [
  body('coverLetter').trim().notEmpty().isLength({ max: 5000 }).withMessage('Cover letter required, max 5000 chars'),
  body('proposedRate').isFloat({ min: 0 }).withMessage('Proposed rate must be positive'),
  body('duration').optional().trim().isLength({ max: 100 }),
];

router.get('/my-proposals', authenticate, requireVerifiedFor('standard'), requireRole('freelancer'), getMyProposals);
router.get('/job/:jobId', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), getProposalsForJob);

router.post('/job/:jobId', authenticate, requireVerifiedFor('standard'), requireRole('freelancer'), proposalValidation, createProposal);

router.patch('/:proposalId', authenticate, requireVerifiedFor('standard'), requireRole('freelancer'), [
  body('coverLetter').optional().trim().isLength({ max: 5000 }),
  body('proposedBudget').optional().isFloat({ min: 0 }),
  body('proposedDuration').optional().isInt({ min: 1 }),
], updateProposal);

router.patch('/:proposalId/status', authenticate, requireVerifiedFor('standard'), requireRole('buyer'), body('status').isIn(['accepted', 'rejected', 'shortlisted']), updateProposalStatus);
router.delete('/:proposalId', authenticate, requireVerifiedFor('standard'), requireRole('freelancer'), withdrawProposal);

module.exports = router;