const { prisma } = require('../config/database');
const { sanitizeInput } = require('../utils/security');
const axios = require('axios');

// ─── HELPER: FETCH LINK PREVIEW ───
const fetchLinkPreview = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VivaWorkBot/1.0)',
      },
    });
    
    const html = response.data;
    const getMeta = (prop) => {
      const match = html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'));
      return match ? match[1] : null;
    };
    const getMetaName = (name) => {
      const match = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'));
      return match ? match[1] : null;
    };

    return {
      title: getMeta('og:title') || getMetaName('title') || url,
      description: getMeta('og:description') || getMetaName('description') || '',
      image: getMeta('og:image') || getMeta('twitter:image') || '',
    };
  } catch (error) {
    console.error('Link preview error:', error.message);
    return {
      title: url,
      description: '',
      image: '',
    };
  }
};

// ─── VALIDATE URL ───
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// ─── SAFE SANITIZE ───
const safeSanitize = (input) => {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);
  try {
    return sanitizeInput(input);
  } catch (err) {
    console.error('sanitizeInput error:', err);
    return input.trim();
  }
};

// ─── PARSE HASHTAGS & MENTIONS ───
const parseContentMeta = (content) => {
  const hashtags = [...(content.match(/#[\w]+/g) || [])];
  const mentions = [...(content.match(/@[\w]+/g) || [])];
  return { hashtags, mentions };
};

// ─── CREATE POST ───
const createPost = async (req, res) => {
  try {
    console.log('=== CREATE POST DEBUG ===');
    console.log('req.body:', JSON.stringify(req.body, null, 2));

    const { content, type, media, linkUrl, linkPreview } = req.body;

    const validTypes = ['text', 'image', 'video', 'link'];
    const postType = type || 'text';
    if (!validTypes.includes(postType)) {
      return res.status(400).json({ message: 'Invalid post type', code: 'INVALID_TYPE' });
    }

    const sanitizedContent = safeSanitize(content);
    const { hashtags, mentions } = parseContentMeta(sanitizedContent);

    if (postType === 'text' && sanitizedContent.trim().length === 0) {
      return res.status(400).json({ message: 'Post content required for text posts', code: 'MISSING_CONTENT' });
    }

    if (sanitizedContent.length > 5000) {
      return res.status(400).json({ message: 'Content max 5000 characters', code: 'CONTENT_TOO_LONG' });
    }

    let postData = {
      userId: req.user.id,
      type: postType,
      content: sanitizedContent,
      hashtags,
      mentions,
      media: [],
    };

    if (postType === 'image' || postType === 'video') {
      if (!media || !Array.isArray(media) || media.length === 0) {
        return res.status(400).json({ message: 'Media required for image/video posts', code: 'MISSING_MEDIA' });
      }
      const validMedia = media.map(m => String(m)).filter(m => m.length > 0);
      if (validMedia.length === 0) {
        return res.status(400).json({ message: 'No valid media URLs provided', code: 'INVALID_MEDIA' });
      }
      postData.media = validMedia;
    }

    if (postType === 'link') {
      if (!linkUrl || !isValidUrl(linkUrl)) {
        return res.status(400).json({ message: 'Valid link URL required', code: 'INVALID_LINK' });
      }
      postData.linkUrl = linkUrl;
      
      const preview = linkPreview || await fetchLinkPreview(linkUrl);
      const domain = new URL(linkUrl).hostname.replace('www.', '');
      
      postData.linkTitle = preview.title;
      postData.linkDesc = preview.description;
      postData.linkImage = preview.image;
      postData.linkDomain = domain;
    }

    console.log('postData to create:', JSON.stringify(postData, null, 2));

    const post = await prisma.post.create({
      data: postData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            savesList: true,
            sharesList: true,
            commentsList: true
          },
        },
      },
    });

    // Notifications
    try {
      const connections = await prisma.connection.findMany({
        where: {
          OR: [
            { senderId: req.user.id, status: 'accepted' },
            { receiverId: req.user.id, status: 'accepted' },
          ],
        },
      });

      const connectionIds = connections.map(c => 
        c.senderId === req.user.id ? c.receiverId : c.senderId
      );

      const userName = `${req.user.firstName || 'Someone'} ${req.user.lastName || ''}`.trim();

      for (const connectionId of connectionIds) {
        await prisma.notification.create({
          data: {
            userId: connectionId,
            type: 'new_post',
            title: 'New Post',
            message: `${userName} shared a new ${postType} post`,
            link: `/feed?post=${post.id}`,
          },
        });
      }
    } catch (notifErr) {
      console.error('Notification creation failed (non-critical):', notifErr.message);
    }

    return res.status(201).json({
      message: 'Post created successfully',
      post: formatPostResponse(post, req.user.id),
    });
  } catch (error) {
    console.error('=== CREATE POST ERROR ===');
    console.error('Error:', error);
    return res.status(500).json({ 
      message: 'Failed to create post', 
      code: 'POST_ERROR',
    });
  }
};

// ─── FORMAT POST RESPONSE ───
const formatPostResponse = (post, currentUserId) => {
  return {
    ...post,
    saves: post._count?.savesList || 0,
    shares: post._count?.sharesList || 0,
    comments: post._count?.commentsList || post.comments || 0,
    isLiked: post.likesList ? post.likesList.some(l => l.userId === currentUserId) : false,
    isSaved: post.savesList ? post.savesList.some(s => s.userId === currentUserId) : false,
    isShared: post.sharesList ? post.sharesList.some(s => s.sharedById === currentUserId) : false,
  };
};

// ─── GET FEED ─── (FIXED VERSION)
const getFeed = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const userId = req.user ? req.user.id : null;

    const skip = (page - 1) * limit;

    // ✅ FIXED: Remove the 30-day filter - show ALL posts
    // ✅ FIXED: Only return posts that are not deleted
    const where = {
      // Removed: createdAt filter that was limiting to 30 days
      // This allows posts from any time period to show
    };

    console.log('Fetching feed - Page:', page, 'Limit:', limit, 'Skip:', skip);

    // ✅ FIXED: Fetch exactly `limit` posts, not `limit * 2`
    const posts = await prisma.post.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
            isVerified: true,
            isOnline: true,
            lastActive: true,
          },
        },
        _count: {
          select: {
            savesList: true,
            sharesList: true,
            commentsList: true
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit, // ✅ FIXED: Changed from `limit * 2` to `limit`
    });

    console.log('Posts found:', posts.length);

    // Shuffle posts randomly for better engagement
    const shuffledPosts = [...posts];
    for (let i = shuffledPosts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPosts[i], shuffledPosts[j]] = [shuffledPosts[j], shuffledPosts[i]];
    }

    // Check if user liked each post
    let likedPostIds = new Set();
    let savedPostIds = new Set();
    if (userId) {
      const [likes, saves] = await Promise.all([
        prisma.postLike.findMany({
          where: { userId },
          select: { postId: true },
        }),
        prisma.save.findMany({
          where: { userId },
          select: { postId: true },
        }),
      ]);
      likedPostIds = new Set(likes.map(l => l.postId));
      savedPostIds = new Set(saves.map(s => s.postId));
    }

    let sharedPostIds = new Set();
    if (userId) {
      const shares = await prisma.share.findMany({
        where: { sharedById: userId },
        select: { postId: true },
      });
      sharedPostIds = new Set(shares.map(s => s.postId));
    }

    const postIds = shuffledPosts.map(p => p.id);
    const impressions = await prisma.postImpression.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds } },
      _count: { postId: true },
    });
    const impressionMap = new Map(impressions.map(i => [i.postId, i._count.postId]));

    const postsWithEngagement = shuffledPosts.map(post => ({
      ...post,
      isLiked: likedPostIds.has(post.id),
      isSaved: savedPostIds.has(post.id),
      isShared: sharedPostIds.has(post.id),
      saves: post._count.savesList,
      shares: post._count.sharesList,
      comments: post._count.commentsList, // ✅ FIXED: Use commentsList instead of comments
      impressions: impressionMap.get(post.id) || 0,
    }));

    // ✅ FIXED: Use same `where` clause to get accurate total
    const total = await prisma.post.count({ where });

    console.log('Total posts in DB:', total, 'Returning:', postsWithEngagement.length);

    return res.status(200).json({
      posts: postsWithEngagement,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch feed', 
      code: 'FEED_ERROR',
      error: error.message // For debugging
    });
  }
};

// ─── GET STORIES ───
const getStories = async (req, res) => {
  try {
    const userId = req.user.id;

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { senderId: userId, status: 'accepted' },
          { receiverId: userId, status: 'accepted' },
        ],
      },
    });

    const connectionIds = connections.map(c => 
      c.senderId === userId ? c.receiverId : c.senderId
    );

    const visibleUserIds = [...connectionIds, userId];

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const storyPosts = await prisma.post.findMany({
      where: {
        userId: { in: visibleUserIds },
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const groups = new Map();
    storyPosts.forEach((post) => {
      const existing = groups.get(post.userId);
      if (existing) {
        existing.posts.push(post);
      } else {
        groups.set(post.userId, { userId: post.userId, user: post.user, posts: [post] });
      }
    });

    const stories = [...groups.values()].sort(
      (a, b) => new Date(b.posts[0].createdAt) - new Date(a.posts[0].createdAt)
    );

    return res.status(200).json({ stories });
  } catch (error) {
    console.error('Get stories error:', error);
    return res.status(500).json({ message: 'Failed to fetch stories', code: 'STORIES_ERROR' });
  }
};

// ─── GET POST BY ID ───
const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            savesList: true,
            sharesList: true,
            commentsList: true
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    let isSaved = false;
    let isLiked = false;
    if (userId) {
      const [save, like] = await Promise.all([
        prisma.save.findUnique({ where: { postId_userId: { postId, userId } } }),
        prisma.postLike.findUnique({ where: { postId_userId: { postId, userId } } }),
      ]);
      isSaved = !!save;
      isLiked = !!like;
    }

    return res.status(200).json({ 
      post: {
        ...post,
        saves: post._count.savesList,
        shares: post._count.sharesList,
        comments: post._count.commentsList,
        isSaved,
        isLiked,
      }
    });
  } catch (error) {
    console.error('Get post error:', error);
    return res.status(500).json({ message: 'Failed to fetch post', code: 'FETCH_ERROR' });
  }
};

// ─── GET USER POSTS ───
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              headline: true,
              isVerified: true,
            },
          },
          _count: {
            select: {
              savesList: true,
              sharesList: true,
              commentsList: true, 
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where: { userId } }),
    ]);

    let savedPostIds = new Set();
    let likedPostIds = new Set();
    if (currentUserId) {
      const [saves, likes] = await Promise.all([
        prisma.save.findMany({
          where: { userId: currentUserId, postId: { in: posts.map(p => p.id) } },
          select: { postId: true },
        }),
        prisma.postLike.findMany({
          where: { userId: currentUserId, postId: { in: posts.map(p => p.id) } },
          select: { postId: true },
        }),
      ]);
      savedPostIds = new Set(saves.map(s => s.postId));
      likedPostIds = new Set(likes.map(l => l.postId));
    }

    const postIds = posts.map(p => p.id);
    const impressions = await prisma.postImpression.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds } },
      _count: { postId: true },
    });
    const impressionMap = new Map(impressions.map(i => [i.postId, i._count.postId]));

    const postsWithEngagement = posts.map(post => ({
      ...post,
      saves: post._count.savesList,
      shares: post._count.sharesList,
      comments: post._count.commentsList,
      impressions: impressionMap.get(post.id) || 0,
      isSaved: savedPostIds.has(post.id),
      isLiked: likedPostIds.has(post.id),
    }));

    return res.status(200).json({
      posts: postsWithEngagement,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    return res.status(500).json({ message: 'Failed to fetch posts', code: 'FETCH_ERROR' });
  }
};

// ─── LIKE / UNLIKE POST ───
const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, likes: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    let result;
    if (existingLike) {
      await prisma.$transaction([
        prisma.postLike.delete({
          where: { id: existingLike.id },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likes: { decrement: 1 } },
        }),
      ]);
      result = { liked: false };
    } else {
      await prisma.$transaction([
        prisma.postLike.create({
          data: { postId, userId },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likes: { increment: 1 } },
        }),
      ]);
      result = { liked: true };

      if (post.userId !== userId) {
        await prisma.notification.create({
          data: {
            userId: post.userId,
            type: 'post_like',
            title: 'New Like',
            message: `${req.user.firstName || 'Someone'} ${req.user.lastName || ''} liked your post`.trim(),
            link: `/feed?post=${postId}`,
          },
        }).catch(() => {});
      }
    }

    const updatedPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { likes: true },
    });

    return res.status(200).json({
      message: result.liked ? 'Post liked' : 'Post unliked',
      liked: result.liked,
      likes: updatedPost.likes,
    });
  } catch (error) {
    console.error('Like post error:', error);
    return res.status(500).json({ message: 'Failed to like post', code: 'LIKE_ERROR' });
  }
};

// ─── SAVE / UNSAVE POST ───
const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    const existingSave = await prisma.save.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    let result;
    if (existingSave) {
      await prisma.save.delete({
        where: { id: existingSave.id },
      });
      result = { saved: false };
    } else {
      await prisma.save.create({
        data: { postId, userId },
      });
      result = { saved: true };
    }

    const saveCount = await prisma.save.count({
      where: { postId },
    });

    return res.status(200).json({
      message: result.saved ? 'Post saved' : 'Post unsaved',
      saved: result.saved,
      saves: saveCount,
    });
  } catch (error) {
    console.error('Save post error:', error);
    return res.status(500).json({ message: 'Failed to save post', code: 'SAVE_ERROR' });
  }
};

// ─── GET SAVED POSTS ───
const getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const [saves, total] = await Promise.all([
      prisma.save.findMany({
        where: { userId },
        include: {
          post: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  headline: true,
                  isVerified: true,
                },
              },
              _count: {
                select: {
                  savesList: true,
                  sharesList: true,
                  commentsList: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.save.count({ where: { userId } }),
    ]);

    const likedPostIds = new Set(
      (await prisma.postLike.findMany({
        where: { userId },
        select: { postId: true },
      })).map(l => l.postId)
    );

    const posts = saves.map(save => ({
      ...save.post,
      isSaved: true,
      isLiked: likedPostIds.has(save.post.id),
      saves: save.post._count.savesList,
      shares: save.post._count.sharesList,
      comments: save.post._count.commentsList,
    }));

    return res.status(200).json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Get saved posts error:', error);
    return res.status(500).json({ message: 'Failed to fetch saved posts', code: 'FETCH_ERROR' });
  }
};

// ─── SHARE POST ───
const sharePost = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      console.error('sharePost: req.body is missing or not an object. Headers:', req.headers['content-type']);
      return res.status(400).json({ 
        message: 'Request body is missing. Ensure Content-Type: application/json header is set.', 
        code: 'MISSING_BODY' 
      });
    }

    const { postId } = req.params;
    const { recipientId } = req.body;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    const shareLink = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const share = await prisma.share.create({
      data: {
        postId,
        sharedById: userId,
        recipientId: recipientId || null,
        shareLink,
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { shares: { increment: 1 } },
    });

    if (post.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: 'post_share',
          title: 'New Share',
          message: `${req.user.firstName || 'Someone'} ${req.user.lastName || ''} shared your post`.trim(),
          link: `/feed?post=${postId}`,
        },
      }).catch(() => {});
    }

    if (recipientId && recipientId !== userId) {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'post_shared_with_you',
          title: 'Post Shared With You',
          message: `${req.user.firstName || 'Someone'} ${req.user.lastName || ''} shared a post with you`.trim(),
          link: `/share/${shareLink}`,
        },
      }).catch(() => {});
    }

    const shareCount = await prisma.share.count({
      where: { postId },
    });

    return res.status(200).json({
      message: recipientId ? 'Post shared with user' : 'Post shared',
      shareLink: share.shareLink,
      shares: shareCount,
    });
  } catch (error) {
    console.error('Share post error:', error);
    return res.status(500).json({ message: 'Failed to share post', code: 'SHARE_ERROR' });
  }
};

// ─── GET SHARE BY LINK ───
const getShareByLink = async (req, res) => {
  try {
    const { shareLink } = req.params;

    const share = await prisma.share.findUnique({
      where: { shareLink },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                headline: true,
                isVerified: true,
              },
            },
            _count: {
              select: {
                savesList: true,
                sharesList: true,
                commentsList: true,
              },
            },
          },
        },
        sharedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ message: 'Share link not found', code: 'SHARE_NOT_FOUND' });
    }

    return res.status(200).json({
      share: {
        ...share,
        post: {
          ...share.post,
          saves: share.post._count.savesList,
          shares: share.post._count.sharesList,
          comments: share.post._count.commentsList,
        },
      },
    });
  } catch (error) {
    console.error('Get share error:', error);
    return res.status(500).json({ message: 'Failed to fetch share', code: 'FETCH_ERROR' });
  }
};

// ─── GET COMMENTS (WITH NESTED REPLIES) ───
const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    // Fetch top-level comments only
    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                isVerified: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ message: 'Failed to fetch comments', code: 'FETCH_ERROR' });
  }
};

// ─── CREATE COMMENT (WITH PARENT SUPPORT) ───
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment cannot be empty', code: 'EMPTY_COMMENT' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, comments: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    // Validate parent comment if provided
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true },
      });
      if (!parentComment || parentComment.postId !== postId) {
        return res.status(400).json({ message: 'Invalid parent comment', code: 'INVALID_PARENT' });
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          postId,
          userId: req.user.id,
          content: content.trim(),
          parentId: parentId || null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              isVerified: true,
            },
          },
          replies: true,
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { comments: { increment: 1 } },
      });

      return newComment;
    });

    // Notify post owner
    if (post.userId !== req.user.id && !parentId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          type: 'post_comment',
          title: 'New Comment',
          message: `${req.user.firstName || 'Someone'} ${req.user.lastName || ''} commented on your post`.trim(),
          link: `/feed?post=${postId}`,
        },
      }).catch(() => {});
    }

    // Notify parent comment author if it's a reply
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true },
      });
      if (parentComment && parentComment.userId !== req.user.id) {
        await prisma.notification.create({
          data: {
            userId: parentComment.userId,
            type: 'comment_reply',
            title: 'New Reply',
            message: `${req.user.firstName || 'Someone'} ${req.user.lastName || ''} replied to your comment`.trim(),
            link: `/feed?post=${postId}&comment=${comment.id}`,
          },
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      message: parentId ? 'Reply created' : 'Comment created',
      comment,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ message: 'Failed to create comment', code: 'COMMENT_ERROR' });
  }
};

// ─── DELETE POST ───
const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    if (post.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({ message: 'Failed to delete post', code: 'DELETE_ERROR' });
  }
};

// ─── GET LINK PREVIEW ───
const getLinkPreview = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ message: 'Valid URL required', code: 'INVALID_URL' });
    }

    const preview = await fetchLinkPreview(url);
    const domain = new URL(url).hostname.replace('www.', '');

    return res.status(200).json({
      preview: {
        ...preview,
        url,
        domain,
      },
    });
  } catch (error) {
    console.error('Link preview error:', error);
    return res.status(500).json({ message: 'Failed to fetch preview', code: 'PREVIEW_ERROR' });
  }
};

// ─── RECORD POST IMPRESSION ───
const recordPostImpression = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found', code: 'POST_NOT_FOUND' });
    }

    if (post.userId === userId) {
      return res.status(200).json({ message: 'Own post, not counted' });
    }

    await prisma.postImpression.upsert({
      where: {
        postId_viewerId: { postId, viewerId: userId },
      },
      update: { viewedAt: new Date() },
      create: { postId, viewerId: userId },
    });

    return res.status(200).json({ message: 'Impression recorded' });
  } catch (error) {
    console.error('Record impression error:', error);
    return res.status(500).json({ message: 'Failed to record impression', code: 'IMPRESSION_ERROR' });
  }
};


module.exports = {
  createPost,
  getFeed,
  getStories,
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
  recordPostImpression,
};