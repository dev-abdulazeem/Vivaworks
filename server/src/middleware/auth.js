const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, JWT_REFRESH_SECRET);

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Update lastUsedAt for this session
    await prisma.session.updateMany({
      where: { token: token, isActive: true },
      data: { lastUsedAt: new Date() }
    });

    const session = await prisma.session.findFirst({
      where: {
        userId: decoded.userId,
        token: token,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        isSuspended: true,
        isAdmin: true,
        isFreelancer: true,
        isBuyer: true,
      },
    });

    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended' });

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Authentication failed' });
  }
};

const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({ message: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' });
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  const userRoles = [];
  if (req.user.isFreelancer) userRoles.push('freelancer');
  if (req.user.isBuyer) userRoles.push('buyer');
  if (req.user.isAdmin) userRoles.push('admin');

  if (!roles.some(role => userRoles.includes(role))) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        isSuspended: true,
        isAdmin: true,
        isFreelancer: true,
        isBuyer: true,
      },
    });

    req.user = user && !user.isSuspended ? user : null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  authenticate,
  requireVerified,
  requireRole,
  requireAdmin,
  optionalAuth,
};