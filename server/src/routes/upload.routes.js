const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uploadPostMedia } = require('../utils/cloudinary');
const { prisma } = require('../config/database');

// GET /users/me - Fetch current user data
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        banner: true,
        isFreelancer: true,
        isBuyer: true,
        isAdmin: true,
        kycStatus: true,
        kycApprovedAt: true,
        kycSubmittedAt: true,
        kycRejectionCount: true,
        headline: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ message: 'Failed to fetch user', code: 'FETCH_ERROR' });
  }
});

// Single file upload
router.post('/media', authenticate, uploadPostMedia.single('file'), (req, res) => {
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

module.exports = router;