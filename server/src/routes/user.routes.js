const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadPostMedia } = require('../utils/cloudinary');
const { prisma } = require('../config/database');

const {
  updateProfile,
  addExperience,
  deleteExperience,
  addPortfolio,
  deletePortfolio,
  uploadAvatar,
  uploadBanner,
  getUserProfile,
  getCurrentUserProfile,
  searchUsers,
  toggleFreelancerStatus,
  toggleBuyerStatus,
  followUser,
  checkFollowStatus,
  getFollowers,
  getFollowing,
  requestVerification,
  getVerificationStatus,
  reviewVerification,
  syncUserEarnings,
  requireVerifiedFor,      // NEW: Three-tier middleware
  updateLastActive,
  getUserVerificationStatus,
  recordProfileView,
  getProfileViews,
  getProfileStats,
} = require('../controllers/user.controller');

// ============================================
// MIDDLEWARE: Update last active on every authenticated request
// ============================================
router.use(authenticate, async (req, res, next) => {
  if (req.user && req.user.id) {
    await updateLastActive(req.user.id);
  }
  next();
});

// ============================================
// PERMISSION LEVELS REFERENCE:
// 'basic'    = unverified + pending + verified  (login only)
// 'social'   = pending + verified only           (NO unverified)
// 'standard' = verified only                     (full access)
// ============================================

// ============================================
// GET /users/me - Fetch current user data
// ============================================
router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        earningBadge: true,
        verificationRequest: {
          select: { status: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const { password, refreshToken, ...safeUser } = user;
    
    // Add verification status
    safeUser.verificationStatus = user.isVerified ? 'verified' : (user.verificationRequest?.status || 'unverified');
    delete safeUser.verificationRequest;

    return res.status(200).json({ user: safeUser });
  } catch (error) {
    console.error('Get user error:', error.message);
    return res.status(500).json({ message: error.message, code: 'FETCH_ERROR' });
  }
});

// ============================================
// PROFILE ROUTES - BASIC (any logged-in user)
// ============================================
router.get('/profile', getCurrentUserProfile);                    // View own profile
router.get('/profile/:id', getUserProfile);                       // View other's profile
router.patch('/profile', updateProfile);                          // Edit profile
router.post('/avatar', uploadPostMedia.single('avatar'), uploadAvatar);
router.post('/banner', uploadPostMedia.single('banner'), uploadBanner);

// ============================================
// EXPERIENCE & PORTFOLIO - BASIC
// ============================================
router.post('/experience', addExperience);
router.delete('/experience/:itemId', deleteExperience);
router.post('/portfolio', addPortfolio);
router.delete('/portfolio/:itemId', deletePortfolio);

// ============================================
// MEDIA UPLOAD - BASIC
// ============================================
router.post('/media', uploadPostMedia.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded', code: 'NO_FILE' });
    }

    return res.status(200).json({
      message: 'File uploaded successfully',
      url: req.file.path,
      publicId: req.file.filename,
      type: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ message: 'Upload failed', code: 'UPLOAD_ERROR' });
  }
});

// ============================================
// SEARCH USERS - BASIC (browse freelancers, anyone can search)
// ============================================
router.get('/search', searchUsers);

// ============================================
// FOLLOWERS SYSTEM - SOCIAL (pending + verified only)
// Unverified users CANNOT follow/connect with people
// ============================================
router.get('/follow-status/:id', requireVerifiedFor('social'), checkFollowStatus);
router.post('/follow/:id', requireVerifiedFor('social'), followUser);
router.delete('/unfollow/:id', requireVerifiedFor('social'), followUser); // Toggle behavior
router.get('/followers/:id', requireVerifiedFor('social'), getFollowers);
router.get('/following/:id', requireVerifiedFor('social'), getFollowing);

// ============================================
// VERIFICATION - BASIC (unverified can submit, others check status)
// ============================================
router.post('/verification', uploadPostMedia.fields([
  { name: 'idImageFront', maxCount: 1 },
  { name: 'idImageBack', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 },
]), requestVerification);

router.get('/verification/status', getVerificationStatus);
router.get('/verification/:userId', getUserVerificationStatus);

// Admin review - STANDARD (only verified admins should review)
router.patch('/verification/:requestId', requireVerifiedFor('standard'), reviewVerification);

// ============================================
// TOGGLE STATUSES - BASIC (anyone can toggle their role)
// ============================================
router.post('/toggle-freelancer', toggleFreelancerStatus);
router.post('/toggle-buyer', toggleBuyerStatus);

// ============================================
// EARNINGS SYNC - BASIC
// ============================================
router.post('/sync-earnings/:userId', syncUserEarnings);

// ============================================
// PROFILE VIEWS & STATS - BASIC
// ============================================
router.post('/profile/:id/view', recordProfileView);
router.get('/profile-stats', getProfileStats);
router.get('/profile-views', getProfileViews);

module.exports = router;