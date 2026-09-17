const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createPost,
  getFeed,
  getPostById,
  getUserPosts,
  likePost,
  savePost,
  getSavedPosts,
  sharePost,
  getShareByLink,
  getComments,
  createComment,
  deletePost,
  getLinkPreview,
  getStories,
  recordPostImpression,
} = require('../controllers/post.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Feed
router.get('/feed', optionalAuth, getFeed);

// Saved posts
router.get('/saved', authenticate, getSavedPosts);

// User posts
router.get('/user/:userId', getUserPosts);

router.get('/stories', authenticate, getStories);

// Single post
router.get('/:postId', getPostById);

// Share by link (public access)
router.get('/share/:shareLink', getShareByLink);

// Link preview
router.post('/link-preview', authenticate, getLinkPreview);

// Create post
router.post('/', authenticate, createPost);

// Like / unlike
router.post('/:postId/like', authenticate, likePost);

// Save / unsave
router.post('/:postId/save', authenticate, savePost);

// Share post
router.post('/:postId/share', authenticate, sharePost);

// Comments
router.get('/:postId/comments', getComments);
router.post('/:postId/comments', authenticate, createComment);

// Record post impression
router.post('/:postId/impression', authenticate, recordPostImpression);

// Delete
router.delete('/:postId', authenticate, deletePost);

module.exports = router;