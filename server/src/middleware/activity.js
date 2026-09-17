const { prisma } = require('../config/database');

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const updateLastActive = async (req, res, next) => {
  if (req.user?.id) {
    const now = new Date();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        lastActive: now,
        isOnline: true 
      },
    });
  }
  next();
};

// Compute online status from lastActive timestamp
const isUserOnline = (lastActive) => {
  if (!lastActive) return false;
  return (Date.now() - new Date(lastActive).getTime()) < ONLINE_THRESHOLD_MS;
};

module.exports = { updateLastActive, isUserOnline };