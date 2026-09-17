const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vivawork/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    public_id: (req, file) => `avatar_${req.user.id}_${Date.now()}`,
  },
});

const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vivawork/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1500, height: 500, crop: 'fill' }],
    public_id: (req, file) => `banner_${req.user.id}_${Date.now()}`,
  },
});

const postMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vivawork/posts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
    resource_type: 'auto',
    public_id: (req, file) => `post_${req.user.id}_${Date.now()}`,
  },
});

const messageFileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vivawork/messages',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mp4', 'webm'],
    resource_type: 'auto',
    public_id: (req, file) => `msg_${req.user.id}_${Date.now()}`,
  },
});

const deliveryFileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vivawork/deliveries',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mp4', 'webm', 'zip', 'doc', 'docx'],
    resource_type: 'auto',
    public_id: (req, file) => `delivery_${req.user.id}_${Date.now()}`,
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  },
});

const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  },
});

const uploadPostMedia = multer({
  storage: postMediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files allowed'), false);
    }
  },
});

const uploadMessageFile = multer({
  storage: messageFileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'video/mp4', 'video/webm'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and videos allowed'), false);
    }
  },
});

const uploadDeliveryFile = multer({
  storage: deliveryFileStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for deliveries
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'video/mp4', 'video/webm',
      'application/zip', 'application/x-zip-compressed',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  cloudinary,
  uploadAvatar,
  uploadBanner,
  uploadPostMedia,
  uploadMessageFile,
  uploadDeliveryFile,
  deleteFromCloudinary,
};