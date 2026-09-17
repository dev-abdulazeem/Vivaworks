const { prisma } = require('../config/database');
const { generateTokens } = require('../middleware/auth');
const {
  hashPassword,
  comparePassword,
  generateSecureToken,
  hashToken,
  validatePasswordStrength,
  sanitizeInput,
} = require('../utils/security');
const {
  generateVerificationCode,
  getVerificationExpiry,
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../utils/email');
const { getGoogleAuthURL, getGoogleUser } = require('../utils/googleAuth');

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, isFreelancer, isBuyer } = req.body;

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedLastName = sanitizeInput(lastName);

    if (!sanitizedEmail || !password || !sanitizedFirstName || !sanitizedLastName) {
      return res.status(400).json({ message: 'All fields are required', code: 'MISSING_FIELDS' });
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ message: 'Password too weak', errors: passwordCheck.errors, code: 'WEAK_PASSWORD' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered', code: 'EMAIL_EXISTS' });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        isFreelancer: isFreelancer || false,
        isBuyer: isBuyer || false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        isFreelancer: true,
        isBuyer: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiry();

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        code,
        expiresAt,
      },
    });

    await sendVerificationEmail(user.email, code, user.firstName);

    return res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Registration failed', code: 'REGISTER_ERROR' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
      include: { emailVerifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified', code: 'ALREADY_VERIFIED' });
    }

    const latestVerification = user.emailVerifications[0];

    if (!latestVerification) {
      return res.status(400).json({ message: 'No verification code found', code: 'NO_CODE' });
    }

    if (latestVerification.used) {
      return res.status(400).json({ message: 'Code already used', code: 'CODE_USED' });
    }

    if (new Date() > latestVerification.expiresAt) {
      return res.status(400).json({ message: 'Code expired', code: 'CODE_EXPIRED' });
    }

    if (latestVerification.code !== code) {
      return res.status(400).json({ message: 'Invalid code', code: 'INVALID_CODE' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.emailVerification.update({
        where: { id: latestVerification.id },
        data: { used: true },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });

      await tx.wallet.create({
        data: { userId: user.id },
      });
    });

    const tokens = generateTokens(user.id);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: true,
        isFreelancer: user.isFreelancer,
        isBuyer: user.isBuyer,
        isAdmin: user.isAdmin,
      },
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ message: 'Verification failed', code: 'VERIFY_ERROR' });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified', code: 'ALREADY_VERIFIED' });
    }

    const recentCode = await prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentCode) {
      return res.status(429).json({ message: 'Please wait before requesting a new code', code: 'RATE_LIMIT' });
    }

    await prisma.emailVerification.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiry();

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        code,
        expiresAt,
      },
    });

    await sendVerificationEmail(user.email, code, user.firstName);

    return res.status(200).json({ message: 'New verification code sent' });
  } catch (error) {
    console.error('Resend code error:', error);
    return res.status(500).json({ message: 'Failed to resend code', code: 'RESEND_ERROR' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    if (!sanitizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password required', code: 'MISSING_CREDENTIALS' });
    }

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    await prisma.loginAttempt.create({
      data: {
        userId: user ? user.id : null,
        email: sanitizedEmail,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: false,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const recentFailedAttempts = await prisma.loginAttempt.count({
      where: {
        userId: user.id,
        success: false,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });

    if (recentFailedAttempts >= 5) {
      return res.status(429).json({ message: 'Too many failed attempts. Try again later.', code: 'ACCOUNT_LOCKED' });
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Account suspended. Contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        email: sanitizedEmail,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: true,
      },
    });

    const tokens = generateTokens(user.id);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        isFreelancer: user.isFreelancer,
        isBuyer: user.isBuyer,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        headline: user.headline,
      },
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed', code: 'LOGIN_ERROR' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required', code: 'NO_REFRESH_TOKEN' });
    }

    const { verifyRefreshToken } = require('../middleware/auth');
    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        isFreelancer: true,
        isBuyer: true,
        isAdmin: true,
        isSuspended: true,
      },
    });

    if (!user || user.isSuspended) {
      return res.status(401).json({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    const tokens = generateTokens(user.id);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Token refreshed',
      accessToken: tokens.accessToken,
      user,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }
    console.error('Refresh token error:', error);
    return res.status(500).json({ message: 'Token refresh failed', code: 'REFRESH_ERROR' });
  }
};

const logout = async (req, res) => {
  try {
    if (req.sessionId) {
      await prisma.session.update({
        where: { id: req.sessionId },
        data: { isActive: false },
      });
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Logout failed', code: 'LOGOUT_ERROR' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      return res.status(200).json({ message: 'If an account exists, a reset link has been sent' });
    }

    const resetToken = generateSecureToken();
    const hashedToken = hashToken(resetToken);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail(user.email, resetLink, user.firstName);

    return res.status(200).json({ message: 'If an account exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process request', code: 'FORGOT_ERROR' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ message: 'Password too weak', errors: passwordCheck.errors, code: 'WEAK_PASSWORD' });
    }

    const hashedToken = hashToken(token);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token', code: 'INVALID_TOKEN' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    return res.status(200).json({ message: 'Password reset successful. Please login again.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Password reset failed', code: 'RESET_ERROR' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        avatar: true,
        banner: true,
        location: true,
        skills: true,
        hourlyRate: true,
        isVerified: true,
        isFreelancer: true,
        isBuyer: true,
        isAdmin: true,
        kycVerified: true,
        createdAt: true,
        profile: true,
        wallet: {
          select: {
            balance: true,
            escrow: true,
            currency: true,
          },
        },
      },
    });

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile', code: 'PROFILE_ERROR' });
  }
};

const googleAuth = async (req, res) => {
  try {
    const authUrl = getGoogleAuthURL();
    return res.status(200).json({ authUrl });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ message: 'Google auth failed', code: 'GOOGLE_AUTH_ERROR' });
  }
};

const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ message: 'Authorization code required', code: 'MISSING_CODE' });
    }

    const googleUser = await getGoogleUser(code);

    if (!googleUser.email) {
      return res.status(400).json({ message: 'Failed to get user email from Google', code: 'NO_EMAIL' });
    }

    let user = await prisma.user.findUnique({
      where: { email: googleUser.email.toLowerCase() },
    });

    if (!user) {
      const randomPassword = require('crypto').randomBytes(32).toString('hex');
      const hashedPassword = await hashPassword(randomPassword);

      user = await prisma.user.create({
        data: {
          email: googleUser.email.toLowerCase(),
          password: hashedPassword,
          firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'Google',
          lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || 'User',
          avatar: googleUser.picture || null,
          isVerified: true,
          isBuyer: true,
        },
      });

      await prisma.wallet.create({
        data: { userId: user.id },
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
    }

    const tokens = generateTokens(user.id);

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?token=${tokens.accessToken}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
      isFreelancer: user.isFreelancer,
      isBuyer: user.isBuyer,
      isAdmin: user.isAdmin,
      avatar: user.avatar,
    }))}`;

    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google callback error:', error);
    const redirectUrl = `${process.env.CLIENT_URL}/login?error=google_auth_failed`;
    return res.redirect(redirectUrl);
  }
};


// ─── GET ACTIVE SESSIONS ───
const getSessions = async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    // Parse user agent to get device name
    const sessionsWithDevice = sessions.map(s => ({
      ...s,
      deviceName: parseDeviceName(s.userAgent),
      browser: parseBrowser(s.userAgent),
    }));

    return res.status(200).json({ sessions: sessionsWithDevice });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({ message: 'Failed to fetch sessions', code: 'SESSIONS_ERROR' });
  }
};

// ─── REVOKE A SESSION ───
const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user.id,
      },
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return res.status(200).json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Revoke session error:', error);
    return res.status(500).json({ message: 'Failed to revoke session', code: 'REVOKE_ERROR' });
  }
};

// ─── REVOKE ALL OTHER SESSIONS ───
const revokeAllOtherSessions = async (req, res) => {
  try {
    await prisma.session.updateMany({
      where: {
        userId: req.user.id,
        id: { not: req.sessionId }, // Keep current session
        isActive: true,
      },
      data: { isActive: false },
    });

    return res.status(200).json({ message: 'All other sessions revoked' });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    return res.status(500).json({ message: 'Failed to revoke sessions', code: 'REVOKE_ALL_ERROR' });
  }
};

// ─── CHANGE PASSWORD ───
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ message: 'Password too weak', errors: passwordCheck.errors, code: 'WEAK_PASSWORD' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect', code: 'INVALID_PASSWORD' });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
      }),
      prisma.session.updateMany({
        where: { userId: req.user.id, isActive: true },
        data: { isActive: false },
      }),
    ]);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({ message: 'Password changed. Please login again.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Failed to change password', code: 'CHANGE_PASSWORD_ERROR' });
  }
};

// ─── CHANGE EMAIL ───
const changeEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    const sanitizedEmail = sanitizeInput(newEmail).toLowerCase();

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Password is incorrect', code: 'INVALID_PASSWORD' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ message: 'Email already in use', code: 'EMAIL_EXISTS' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { email: sanitizedEmail, isVerified: false },
    });

    const code = generateVerificationCode();
    await prisma.emailVerification.create({
      data: {
        userId: req.user.id,
        code,
        expiresAt: getVerificationExpiry(),
      },
    });

    await sendVerificationEmail(sanitizedEmail, code, user.firstName);

    return res.status(200).json({ message: 'Email updated. Please verify your new email.' });
  } catch (error) {
    console.error('Change email error:', error);
    return res.status(500).json({ message: 'Failed to change email', code: 'CHANGE_EMAIL_ERROR' });
  }
};

// ─── DELETE ACCOUNT ───
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Password is incorrect', code: 'INVALID_PASSWORD' });
    }

    await prisma.user.delete({
      where: { id: req.user.id },
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ message: 'Failed to delete account', code: 'DELETE_ACCOUNT_ERROR' });
  }
};

// ─── HELPERS: Parse Device Info ───
function parseDeviceName(userAgent) {
  if (!userAgent) return 'Unknown Device';
  if (userAgent.includes('Mobile')) return 'Mobile Device';
  if (userAgent.includes('Tablet')) return 'Tablet';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';
  return 'Desktop';
}

function parseBrowser(userAgent) {
  if (!userAgent) return 'Unknown Browser';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Browser';
}

module.exports = {
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
};