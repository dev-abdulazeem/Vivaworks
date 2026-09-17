const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register,
  verifyEmail,
  resendVerificationCode,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  googleAuth,
  googleCallback,
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  changePassword,
  changeEmail,
  deleteAccount,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/security');

// ─── VALIDATION MIDDLEWARE ───

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name required'),
  body('lastName').trim().notEmpty().withMessage('Last name required'),
  body('isFreelancer').optional().isBoolean(),
  body('isBuyer').optional().isBoolean(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const verifyEmailValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit code required'),
];

const forgotPasswordValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

const changeEmailValidation = [
  body('newEmail').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const deleteAccountValidation = [
  body('password').notEmpty().withMessage('Password required'),
];

// ─── AUTH ROUTES ───

// Registration & Email Verification
router.post('/register', registerValidation, register);
router.post('/verify-email', verifyEmailValidation, verifyEmail);
router.post('/resend-code', forgotPasswordValidation, resendVerificationCode);

// Login & Token Management
router.post('/login', authRateLimit, loginValidation, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logout);

// Password Reset
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.post('/reset-password', resetPasswordValidation, resetPassword);

// Current User
router.get('/me', authenticate, getMe);

// ─── SESSION MANAGEMENT (Settings → Security) ───

// Get all active sessions/devices
router.get('/sessions', authenticate, getSessions);

// Revoke a specific session (logout a device)
router.delete('/sessions/:sessionId', authenticate, revokeSession);

// Revoke all other sessions except current (logout everywhere else)
router.delete('/sessions', authenticate, revokeAllOtherSessions);

// ─── ACCOUNT SETTINGS ───

// Change password
router.patch('/change-password', authenticate, changePasswordValidation, changePassword);

// Change email
router.patch('/change-email', authenticate, changeEmailValidation, changeEmail);

// Delete account permanently
router.delete('/account', authenticate, deleteAccountValidation, deleteAccount);

// ─── GOOGLE OAUTH ───

router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

module.exports = router;