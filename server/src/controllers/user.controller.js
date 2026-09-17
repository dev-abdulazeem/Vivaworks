const { prisma } = require('../config/database');
const { sanitizeInput } = require('../utils/security');

// ─── EARNINGS TIER CALCULATION ─────────────────────────────────

const calculateEarningsTier = (totalEarned) => {
  if (totalEarned >= 5000000) return { tier: 'legend', label: 'Legend', color: 'purple', min: 5000000 };
  if (totalEarned >= 1000000) return { tier: 'top_rated', label: 'Top Rated', color: 'amber', min: 1000000 };
  if (totalEarned >= 250000) return { tier: 'established', label: 'Established', color: 'blue', min: 250000 };
  if (totalEarned >= 50000) return { tier: 'rising_talent', label: 'Rising Talent', color: 'emerald', min: 50000 };
  return { tier: 'newcomer', label: 'Newcomer', color: 'gray', min: 0 };
};

const formatEarningsDisplay = (totalEarned) => {
  if (totalEarned >= 1000000) return `₦${(totalEarned / 1000000).toFixed(1)}M+`;
  if (totalEarned >= 100000) return `₦${(totalEarned / 1000).toFixed(0)}K+`;
  if (totalEarned >= 1000) return `₦${(totalEarned / 1000).toFixed(0)}K+`;
  return `₦${totalEarned.toFixed(0)}`;
};

const updateUserEarningsTier = async (userId) => {
  try {
    const freelancerContracts = await prisma.contract.findMany({
      where: {
        freelancerId: userId,
        status: { in: ['completed'] },
      },
      select: { amount: true },
    });

    const totalEarned = freelancerContracts.reduce((sum, c) => sum + (c.amount || 0), 0);

    const buyerContracts = await prisma.contract.findMany({
      where: {
        buyerId: userId,
        status: { in: ['completed'] },
      },
      select: { amount: true },
    });

    const totalSpent = buyerContracts.reduce((sum, c) => sum + (c.amount || 0), 0);

    const tierInfo = calculateEarningsTier(totalEarned);

    await prisma.earningBadge.upsert({
      where: { userId },
      update: {
        totalEarned,
        totalSpent,
        tier: tierInfo.tier,
        tierUpdatedAt: new Date(),
      },
      create: {
        userId,
        totalEarned,
        totalSpent,
        tier: tierInfo.tier,
      },
    });

    return { totalEarned, totalSpent, tier: tierInfo };
  } catch (error) {
    console.error('Update earnings tier error:', error);
    return null;
  }
};

// ─── VERIFICATION MIDDLEWARE SYSTEM ────────────────────────────

/**
 * Permission levels:
 * - 'public'    : Anyone (no auth needed)
 * - 'basic'     : Unverified + Pending + Verified
 * - 'social'    : Pending + Verified only (NOT unverified)
 * - 'standard'  : Verified only
 */
const VERIFICATION_LEVELS = {
  public: 0,
  unverified: 1,   // basic
  pending: 2,      // social
  verified: 3,     // standard
};

const getUserVerificationLevel = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerified: true },
  });

  if (user?.isVerified) return VERIFICATION_LEVELS.verified;

  const verification = await prisma.documentVerification.findUnique({
    where: { userId },
    select: { status: true },
  });

  if (verification?.status === 'pending') return VERIFICATION_LEVELS.pending;
  return VERIFICATION_LEVELS.unverified;
};

/**
 * Main verification middleware
 * @param {string} requiredLevel - 'basic' | 'social' | 'standard'
 */
const requireVerifiedFor = (requiredLevel) => {
  const required = VERIFICATION_LEVELS[requiredLevel] || VERIFICATION_LEVELS.verified;

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    const userLevel = await getUserVerificationLevel(req.user.id);

    // Allow if user meets or exceeds required level
    if (userLevel >= required) {
      req.verificationLevel = userLevel;
      return next();
    }

    // Denied - provide helpful message based on their actual status
    const statusMap = {
      [VERIFICATION_LEVELS.unverified]: {
        message: 'Identity verification required to perform this action.',
        code: 'VERIFICATION_REQUIRED',
        status: 'unverified',
        action: 'Please submit your verification documents.',
      },
      [VERIFICATION_LEVELS.pending]: {
        message: 'Your verification is pending approval. This action requires full verification.',
        code: 'VERIFICATION_PENDING_RESTRICTED',
        status: 'pending',
        action: 'Please wait for admin approval or contact support.',
      },
    };

    const response = statusMap[userLevel] || {
      message: 'Access denied.',
      code: 'ACCESS_DENIED',
      status: 'unknown',
    };

    return res.status(403).json(response);
  };
};

// Legacy middleware for backward compatibility
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (req.user.isVerified === true) return next();
  
   prisma.documentVerification.findUnique({
    where: { userId: req.user.id },
    select: { status: true },
  }).then(verification => {
    if (verification?.status === 'pending') {
      return res.status(403).json({ 
        message: 'Your verification is pending approval.', 
        code: 'VERIFICATION_PENDING',
        status: 'pending'
      });
    }
    return res.status(403).json({ 
      message: 'Identity verification required.', 
      code: 'VERIFICATION_REQUIRED',
      status: 'unverified'
    });
  }).catch(err => {
    console.error('Verification check error:', err);
    return res.status(500).json({ message: 'Failed to check verification status', code: 'CHECK_ERROR' });
  });
};

const requireVerifiedOrPending = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (req.user.isVerified === true) return next();
  
   prisma.documentVerification.findUnique({
    where: { userId: req.user.id },
    select: { status: true },
  }).then(verification => {
    if (verification?.status === 'pending') {
      req.verificationStatus = 'pending';
      return next();
    }
    req.verificationStatus = 'unverified';
    return next();
  }).catch(err => {
    console.error('Verification check error:', err);
    return res.status(500).json({ message: 'Failed to check verification status', code: 'CHECK_ERROR' });
  });
};

const updateLastActive = async (userId) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActive: new Date() },
    });
  } catch (error) {
    console.error('Update last active error:', error);
  }
};

// ─── PROFILE UPDATE ────────────────────────────────────────────

const updateProfile = async (req, res) => {
  try {
    const {
      headline, bio, location, skills, hourlyRate,
      experience, education, certifications, portfolio,
      languages, availability, phone, website, linkedin, twitter, github,
    } = req.body;

    const userId = req.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        headline: headline ? sanitizeInput(headline) : undefined,
        bio: bio ? sanitizeInput(bio) : undefined,
        location: location ? sanitizeInput(location) : undefined,
        skills: skills || undefined,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
      },
    });

    const profileData = {
      experience: experience || undefined,
      education: education || undefined,
      certifications: certifications || undefined,
      portfolio: portfolio || undefined,
      languages: languages || undefined,
      availability: availability ? sanitizeInput(availability) : undefined,
      phone: phone ? sanitizeInput(phone) : undefined,
      website: website ? sanitizeInput(website) : undefined,
      linkedin: linkedin ? sanitizeInput(linkedin) : undefined,
      twitter: twitter ? sanitizeInput(twitter) : undefined,
      github: github ? sanitizeInput(github) : undefined,
    };

    const existingProfile = await prisma.profile.findUnique({ where: { userId } });

    let profile;
    if (existingProfile) {
      profile = await prisma.profile.update({ where: { userId }, data: profileData });
    } else {
      profile = await prisma.profile.create({ data: { userId, ...profileData } });
    }

    await updateLastActive(userId);

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: { ...updatedUser, profile },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Failed to update profile', code: 'UPDATE_ERROR' });
  }
};

// ─── EXPERIENCE ────────────────────────────────────────────────

const addExperience = async (req, res) => {
  try {
    const { title, role, company, type, period, description } = req.body;
    const userId = req.user.id;

    if (!title && !role) {
      return res.status(400).json({ message: 'Title or role is required', code: 'TITLE_REQUIRED' });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { experience: true },
    });

    const currentExperience = Array.isArray(profile?.experience) ? profile.experience : [];
    
    const newItem = {
      id: Date.now().toString(),
      title: title || role,
      role: role || title,
      company: company || null,
      type: type || 'Full-time',
      period: period || null,
      description: description || null,
      createdAt: new Date().toISOString(),
    };

    const updatedExperience = [...currentExperience, newItem];

    const existingProfile = await prisma.profile.findUnique({ where: { userId } });

    let updatedProfile;
    if (existingProfile) {
      updatedProfile = await prisma.profile.update({ where: { userId }, data: { experience: updatedExperience } });
    } else {
      updatedProfile = await prisma.profile.create({ data: { userId, experience: updatedExperience } });
    }

    await updateLastActive(userId);

    return res.status(201).json({
      message: 'Experience added',
      experience: newItem,
      allExperience: updatedProfile.experience,
    });
  } catch (error) {
    console.error('Add experience error:', error);
    return res.status(500).json({ message: 'Failed to add experience', code: 'ADD_ERROR' });
  }
};

const deleteExperience = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { experience: true },
    });

    const currentExperience = Array.isArray(profile?.experience) ? profile.experience : [];
    const updatedExperience = currentExperience.filter((item) => item.id !== itemId);

    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: { experience: updatedExperience },
    });

    await updateLastActive(userId);

    return res.status(200).json({
      message: 'Experience removed',
      experience: updatedProfile.experience,
    });
  } catch (error) {
    console.error('Delete experience error:', error);
    return res.status(500).json({ message: 'Failed to remove experience', code: 'DELETE_ERROR' });
  }
};

// ─── PORTFOLIO ─────────────────────────────────────────────────

const addPortfolio = async (req, res) => {
  try {
    const { title, url, imageUrl, category, description } = req.body;
    const userId = req.user.id;

    if (!title) {
      return res.status(400).json({ message: 'Title is required', code: 'TITLE_REQUIRED' });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { portfolio: true },
    });

    const currentPortfolio = Array.isArray(profile?.portfolio) ? profile.portfolio : [];
    
    const newItem = {
      id: Date.now().toString(),
      title,
      url: url || null,
      imageUrl: imageUrl || null,
      category: category || null,
      description: description || null,
      createdAt: new Date().toISOString(),
    };

    const updatedPortfolio = [...currentPortfolio, newItem];

    const existingProfile = await prisma.profile.findUnique({ where: { userId } });

    let updatedProfile;
    if (existingProfile) {
      updatedProfile = await prisma.profile.update({ where: { userId }, data: { portfolio: updatedPortfolio } });
    } else {
      updatedProfile = await prisma.profile.create({ data: { userId, portfolio: updatedPortfolio } });
    }

    await updateLastActive(userId);

    return res.status(201).json({
      message: 'Portfolio item added',
      portfolio: newItem,
      allPortfolio: updatedProfile.portfolio,
    });
  } catch (error) {
    console.error('Add portfolio error:', error);
    return res.status(500).json({ message: 'Failed to add portfolio item', code: 'ADD_ERROR' });
  }
};

const deletePortfolio = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { portfolio: true },
    });

    const currentPortfolio = Array.isArray(profile?.portfolio) ? profile.portfolio : [];
    const updatedPortfolio = currentPortfolio.filter((item) => item.id !== itemId);

    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: { portfolio: updatedPortfolio },
    });

    await updateLastActive(userId);

    return res.status(200).json({
      message: 'Portfolio item removed',
      portfolio: updatedProfile.portfolio,
    });
  } catch (error) {
    console.error('Delete portfolio error:', error);
    return res.status(500).json({ message: 'Failed to remove portfolio item', code: 'DELETE_ERROR' });
  }
};

// ─── AVATAR & BANNER ───────────────────────────────────────────

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded', code: 'NO_FILE' });

    const avatarUrl = req.file.path || req.file.secure_url;
    await prisma.user.update({ where: { id: req.user.id }, data: { avatar: avatarUrl } });
    await updateLastActive(req.user.id);

    return res.status(200).json({ message: 'Avatar uploaded successfully', avatar: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return res.status(500).json({ message: 'Failed to upload avatar', code: 'UPLOAD_ERROR' });
  }
};

const uploadBanner = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded', code: 'NO_FILE' });

    const bannerUrl = req.file.path || req.file.secure_url;
    await prisma.user.update({ where: { id: req.user.id }, data: { banner: bannerUrl } });
    await updateLastActive(req.user.id);

    return res.status(200).json({ message: 'Banner uploaded successfully', banner: bannerUrl });
  } catch (error) {
    console.error('Upload banner error:', error);
    return res.status(500).json({ message: 'Failed to upload banner', code: 'UPLOAD_ERROR' });
  }
};

// ─── GET USER PROFILE (by ID) ──────────────────────────────────

const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required', code: 'ID_REQUIRED' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        avatar: true,
        banner: true,
        location: true,
        skills: true,
        hourlyRate: true,
        isFreelancer: true,
        isBuyer: true,
        isVerified: true,
        isAdmin: true,
        isSuspended: true,
        createdAt: true,
        lastActive: true,
        profile: true,
        documentVerification: {
          select: { status: true, documentType: true, reviewedBy: true },
        },
        earningBadge: {
          select: { totalEarned: true, totalSpent: true, tier: true, tierUpdatedAt: true },
        },
        _count: {
          select: { followers: true, following: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    let earningsData = user.earningBadge;
    if (!earningsData) {
      await updateUserEarningsTier(userId);
      earningsData = await prisma.earningBadge.findUnique({
        where: { userId },
        select: { totalEarned: true, totalSpent: true, tier: true, tierUpdatedAt: true },
      });
    }

    const tierInfo = calculateEarningsTier(earningsData?.totalEarned || 0);
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();
    const lastActiveTime = user.lastActive ? new Date(user.lastActive).getTime() : 0;
    const isCurrentlyOnline = lastActiveTime > 0 && (now - lastActiveTime) < ONLINE_THRESHOLD_MS;

    // Check if current viewer is following this user
    let isFollowing = false;
    if (req.user && req.user.id !== userId) {
      const follow = await prisma.follower.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: userId,
          },
        },
      });
      isFollowing = !!follow;
    }

    // FIX: Explicitly compute follower/following counts to avoid Prisma _count ambiguity
     const [followersCount, followingCount, reviewsData] = await Promise.all([
           prisma.follower.count({ where: { followingId: userId } }),
      prisma.follower.count({ where: { followerId: userId } }),
      prisma.review.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const profileResponse = {
      user: {
        ...user,
        isOnline: isCurrentlyOnline,
        lastActive: user.lastActive,
        followersCount,
        followingCount,
        isFollowing,
        totalEarnings: earningsData?.totalEarned || 0,
        averageRating: reviewsData?._avg?.rating ? parseFloat(reviewsData._avg.rating.toFixed(1)) : 0,
        totalReviews: reviewsData?._count?.rating || 0,
        earnings: {
          totalEarned: earningsData?.totalEarned || 0,
          totalSpent: earningsData?.totalSpent || 0,
          tier: tierInfo.tier,
          tierLabel: tierInfo.label,
          tierColor: tierInfo.color,
          displayAmount: formatEarningsDisplay(earningsData?.totalEarned || 0),
        },
            verificationStatus: user.isVerified === true ? 'verified' : (user.documentVerification?.status?.toLowerCase() || 'none'),
      },
    };

    delete profileResponse.user._count;
    delete profileResponse.user.documentVerification;

    if (req.user && req.user.id === userId) {
      await updateLastActive(req.user.id);
    }

    return res.status(200).json(profileResponse);
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile', code: 'PROFILE_ERROR' });
  }
};

// ─── GET CURRENT USER PROFILE ──────────────────────────────────

const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        avatar: true,
        banner: true,
        location: true,
        skills: true,
        hourlyRate: true,
        isFreelancer: true,
        isBuyer: true,
        isVerified: true,
        isAdmin: true,
        isSuspended: true,
        createdAt: true,
        lastActive: true,
        profile: true,
         documentVerification: {
          select: { status: true, documentType: true, reviewedBy: true },
        },
        earningBadge: {
          select: { totalEarned: true, totalSpent: true, tier: true, tierUpdatedAt: true },
        },
        _count: {
          select: { followers: true, following: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    let earningsData = user.earningBadge;
    if (!earningsData) {
      await updateUserEarningsTier(userId);
      earningsData = await prisma.earningBadge.findUnique({
        where: { userId },
        select: { totalEarned: true, totalSpent: true, tier: true, tierUpdatedAt: true },
      });
    }

    const tierInfo = calculateEarningsTier(earningsData?.totalEarned || 0);
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();
    const lastActiveTime = user.lastActive ? new Date(user.lastActive).getTime() : 0;
    const isCurrentlyOnline = lastActiveTime > 0 && (now - lastActiveTime) < ONLINE_THRESHOLD_MS;

    // FIX: Explicitly compute follower/following counts to avoid Prisma _count ambiguity
    const [followersCount, followingCount, reviewsData] = await Promise.all([
            prisma.follower.count({ where: { followingId: userId } }),
      prisma.follower.count({ where: { followerId: userId } }),
      prisma.review.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const profileResponse = {
      user: {
        ...user,
        isOnline: isCurrentlyOnline,
        lastActive: user.lastActive,
        followersCount,
        followingCount,
        totalEarnings: earningsData?.totalEarned || 0,
        averageRating: reviewsData?._avg?.rating ? parseFloat(reviewsData._avg.rating.toFixed(1)) : 0,
        totalReviews: reviewsData?._count?.rating || 0,
        earnings: {
          totalEarned: earningsData?.totalEarned || 0,
          totalSpent: earningsData?.totalSpent || 0,
          tier: tierInfo.tier,
          tierLabel: tierInfo.label,
          tierColor: tierInfo.color,
          displayAmount: formatEarningsDisplay(earningsData?.totalEarned || 0),
        },
         verificationStatus: user.isVerified === true ? 'verified' : (user.documentVerification?.status?.toLowerCase() || 'none'),
      },
    };

    delete profileResponse.user._count;
    delete profileResponse.user.documentVerification;

    await updateLastActive(userId);

    return res.status(200).json(profileResponse);
  } catch (error) {
    console.error('Get current user profile error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile', code: 'PROFILE_ERROR' });
  }
};

// ─── SEARCH USERS ──────────────────────────────────────────────

const searchUsers = async (req, res) => {
  try {
    const { query, skill, location, page = 1, limit = 10 } = req.query;

    const where = { isVerified: true, isSuspended: false };

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { headline: { contains: query, mode: 'insensitive' } },
        { bio: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (skill) where.skills = { has: skill };
    if (location) where.location = { contains: location, mode: 'insensitive' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          headline: true,
          avatar: true,
          location: true,
          skills: true,
          hourlyRate: true,
          isFreelancer: true,
          isVerified: true,
          lastActive: true,
          earningBadge: { select: { tier: true, totalEarned: true } },
          _count: { select: { followers: true } },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();

    const formattedUsers = users.map((u) => {
      const lastActiveTime = u.lastActive ? new Date(u.lastActive).getTime() : 0;
      return {
        ...u,
        isOnline: lastActiveTime > 0 && (now - lastActiveTime) < ONLINE_THRESHOLD_MS,
        followersCount: u._count?.followers || 0,
        earningsTier: u.earningBadge?.tier || 'newcomer',
        earningsDisplay: formatEarningsDisplay(u.earningBadge?.totalEarned || 0),
        _count: undefined,
        earningBadge: undefined,
      };
    });

    await updateLastActive(req.user.id);

    return res.status(200).json({
      users: formattedUsers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({ message: 'Search failed', code: 'SEARCH_ERROR' });
  }
};

// ─── FOLLOWERS SYSTEM (FIXED) ──────────────────────────────────

const followUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const followerId = req.user.id;

    if (!targetId) {
      return res.status(400).json({ message: 'User ID is required', code: 'ID_REQUIRED' });
    }

    if (targetId === followerId) {
      return res.status(400).json({ message: 'Cannot follow yourself', code: 'SELF_FOLLOW' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, isSuspended: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (targetUser.isSuspended) {
      return res.status(403).json({ message: 'Cannot follow suspended user', code: 'SUSPENDED' });
    }

    // Check existing follow
    const existingFollow = await prisma.follower.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetId,
        },
      },
    });

    if (existingFollow) {
      // UNFOLLOW
      await prisma.follower.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId: targetId,
          },
        },
      });

      // Get updated counts for TARGET user (the profile being viewed)
      const targetFollowersCount = await prisma.follower.count({ where: { followingId: targetId } });
      const targetFollowingCount = await prisma.follower.count({ where: { followerId: targetId } });

      return res.status(200).json({
        message: 'Unfollowed successfully',
        isFollowing: false,
        followersCount: targetFollowersCount,
        followingCount: targetFollowingCount,
      });
    }

    // FOLLOW
    await prisma.follower.create({
      data: { followerId, followingId: targetId },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: targetId,
        type: 'follow',
        title: 'New Follower',
        message: `${req.user.firstName || 'Someone'} started following you`,
        link: `/profile/${followerId}`,
      },
    });

    // Get updated counts for TARGET user (the profile being viewed)
    const targetFollowersCount = await prisma.follower.count({ where: { followingId: targetId } });
    const targetFollowingCount = await prisma.follower.count({ where: { followerId: targetId } });

    await updateLastActive(followerId);

    return res.status(200).json({
      message: 'Followed successfully',
      isFollowing: true,
      followersCount: targetFollowersCount,
      followingCount: targetFollowingCount,
    });

  } catch (error) {
    console.error('Follow error:', error);
    return res.status(500).json({ message: 'Failed to follow user', code: 'FOLLOW_ERROR' });
  }
};

const checkFollowStatus = async (req, res) => {
  try {
    const targetId = req.params.id;
    const followerId = req.user.id;

    if (!targetId) {
      return res.status(400).json({ message: 'User ID is required', code: 'ID_REQUIRED' });
    }

    const [follow, targetFollowersCount, targetFollowingCount] = await Promise.all([
      prisma.follower.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId: targetId,
          },
        },
      }),
      prisma.follower.count({ where: { followingId: targetId } }),
      prisma.follower.count({ where: { followerId: targetId } }),
    ]);

    return res.status(200).json({
      isFollowing: !!follow,
      followersCount: targetFollowersCount,
      followingCount: targetFollowingCount,
    });

  } catch (error) {
    console.error('Check follow status error:', error);
    return res.status(500).json({ message: 'Failed to check follow status', code: 'CHECK_ERROR' });
  }
};

const getFollowers = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { page = 1, limit = 20 } = req.query;

    if (!targetId) {
      return res.status(400).json({ message: 'User ID is required', code: 'ID_REQUIRED' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followers, total] = await Promise.all([
      prisma.follower.findMany({
        where: { followingId: targetId },
        include: {
          follower: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              headline: true,
              avatar: true,
              isVerified: true,
              lastActive: true,
              earningBadge: { select: { tier: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follower.count({ where: { followingId: targetId } }),
    ]);

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();

    return res.status(200).json({
      users: followers.map((f) => {
        const lastActiveTime = f.follower.lastActive ? new Date(f.follower.lastActive).getTime() : 0;
        return {
          ...f.follower,
          isOnline: lastActiveTime > 0 && (now - lastActiveTime) < ONLINE_THRESHOLD_MS,
          earningsTier: f.follower.earningBadge?.tier || 'newcomer',
          followedAt: f.createdAt,
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get followers error:', error);
    return res.status(500).json({ message: 'Failed to get followers', code: 'FETCH_ERROR' });
  }
};

const getFollowing = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { page = 1, limit = 20 } = req.query;

    if (!targetId) {
      return res.status(400).json({ message: 'User ID is required', code: 'ID_REQUIRED' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [following, total] = await Promise.all([
      prisma.follower.findMany({
        where: { followerId: targetId },
        include: {
          following: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              headline: true,
              avatar: true,
              isVerified: true,
              lastActive: true,
              earningBadge: { select: { tier: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follower.count({ where: { followerId: targetId } }),
    ]);

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();

    return res.status(200).json({
      users: following.map((f) => {
        const lastActiveTime = f.following.lastActive ? new Date(f.following.lastActive).getTime() : 0;
        return {
          ...f.following,
          isOnline: lastActiveTime > 0 && (now - lastActiveTime) < ONLINE_THRESHOLD_MS,
          earningsTier: f.following.earningBadge?.tier || 'newcomer',
          followedAt: f.createdAt,
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get following error:', error);
    return res.status(500).json({ message: 'Failed to get following', code: 'FETCH_ERROR' });
  }
};

// ─── VERIFICATION ──────────────────────────────────────────────

const requestVerification = async (req, res) => {
  try {
    const { idType, idNumber } = req.body;
    const userId = req.user.id;

    if (!req.files || !req.files.idImageFront) {
      return res.status(400).json({ message: 'ID front image required', code: 'NO_ID_IMAGE' });
    }

      const existingRequest = await prisma.documentVerification.findUnique({ where: { userId } });

    if (existingRequest?.status === 'pending') {
      return res.status(400).json({ message: 'Verification request already pending', code: 'PENDING_EXISTS' });
    }
    if (existingRequest?.status === 'approved') {
      return res.status(400).json({ message: 'Already verified', code: 'ALREADY_VERIFIED' });
    }

    const idImageFront = req.files.idImageFront[0].path;
    const idImageBack = req.files.idImageBack?.[0]?.path || null;
    const selfieImage = req.files.selfieImage?.[0]?.path || null;

    const verification = await prisma.documentVerification.create({
      data: {
        userId,
        idType: sanitizeInput(idType),
        idNumber: idNumber ? sanitizeInput(idNumber) : null,
        idImageFront,
        idImageBack,
        selfieImage,
        status: 'pending',
      },
    });

    await updateLastActive(userId);

    return res.status(201).json({
      message: 'Verification request submitted successfully',
      verification: {
        id: verification.id,
        status: verification.status,
        idType: verification.idType,
        createdAt: verification.createdAt,
      },
    });
  } catch (error) {
    console.error('Request verification error:', error);
    return res.status(500).json({ message: 'Failed to submit verification', code: 'VERIFY_ERROR' });
  }
};

const getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, verification] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { isVerified: true } }),
      prisma.documentVerification.findUnique({ where: { userId } }),
    ]);

    return res.status(200).json({
      isVerified: user?.isVerified || false,
      status: verification?.status || 'none',
      idType: verification?.idType || null,
      reviewedBy: verification?.reviewedBy || null,
      reviewNote: verification?.reviewNote || null,
      createdAt: verification?.createdAt || null,
      updatedAt: verification?.updatedAt || null,
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    return res.status(500).json({ message: 'Failed to get verification status', code: 'FETCH_ERROR' });
  }
};

const reviewVerification = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, reviewNote } = req.body;
    const adminId = req.user.id;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status', code: 'INVALID_STATUS' });
    }

   const verification = await prisma.documentVerification.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!verification) {
      return res.status(404).json({ message: 'Verification request not found', code: 'NOT_FOUND' });
    }

    const updated = await prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedBy: adminId,
        reviewNote: reviewNote ? sanitizeInput(reviewNote) : null,
      },
    });

    if (status === 'approved') {
      await prisma.user.update({ where: { id: verification.userId }, data: { isVerified: true } });
      await prisma.notification.create({
        data: {
          userId: verification.userId,
          type: 'verification',
          title: 'Account Verified',
          message: 'Your account has been verified successfully!',
          link: '/profile',
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId: verification.userId,
          type: 'verification',
          title: 'Verification Rejected',
          message: reviewNote || 'Your verification request was not approved.',
          link: '/profile',
        },
      });
    }

    return res.status(200).json({
      message: `Verification ${status}`,
      verification: updated,
    });
  } catch (error) {
    console.error('Review verification error:', error);
    return res.status(500).json({ message: 'Failed to review verification', code: 'REVIEW_ERROR' });
  }
};

// ─── TOGGLE STATUSES ───────────────────────────────────────────

const toggleFreelancerStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isFreelancer: true, isBuyer: true },
    });

    if (!user.isBuyer && !user.isFreelancer) {
      return res.status(400).json({ message: 'You must be a buyer first', code: 'NOT_BUYER' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { isFreelancer: !user.isFreelancer },
      select: { id: true, isFreelancer: true, isBuyer: true },
    });

    await updateLastActive(req.user.id);

    return res.status(200).json({
      message: `Freelancer status ${updatedUser.isFreelancer ? 'enabled' : 'disabled'}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Toggle freelancer error:', error);
    return res.status(500).json({ message: 'Failed to update status', code: 'UPDATE_ERROR' });
  }
};

const toggleBuyerStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isFreelancer: true, isBuyer: true },
    });

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { isBuyer: !user.isBuyer },
      select: { id: true, isFreelancer: true, isBuyer: true },
    });

    await updateLastActive(req.user.id);

    return res.status(200).json({
      message: `Buyer status ${updatedUser.isBuyer ? 'enabled' : 'disabled'}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Toggle buyer error:', error);
    return res.status(500).json({ message: 'Failed to update status', code: 'UPDATE_ERROR' });
  }
};

// ─── SYNC EARNINGS ─────────────────────────────────────────────

const syncUserEarnings = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await updateUserEarningsTier(userId);

    if (!result) {
      return res.status(500).json({ message: 'Failed to sync earnings', code: 'SYNC_ERROR' });
    }

    return res.status(200).json({
      message: 'Earnings synced successfully',
      earnings: {
        ...result,
        tierLabel: result.tier.label,
        tierColor: result.tier.color,
        displayAmount: formatEarningsDisplay(result.totalEarned),
      },
    });
  } catch (error) {
    console.error('Sync earnings error:', error);
    return res.status(500).json({ message: 'Failed to sync earnings', code: 'SYNC_ERROR' });
  }
};

// ─── GET USER VERIFICATION STATUS (public) ─────────────────────

const getUserVerificationStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isVerified: true,
        documentVerification: { select: { status: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

     const status = user.isVerified ? 'verified' : (user.documentVerification?.status || 'unverified');

    return res.status(200).json({ userId: user.id, isVerified: user.isVerified, status });
  } catch (error) {
    console.error('Get user verification status error:', error);
    return res.status(500).json({ message: 'Failed to get verification status', code: 'FETCH_ERROR' });
  }
};


// ─── RECORD PROFILE VIEW ───
const recordProfileView = async (req, res) => {
  try {
    const viewedId = req.params.id;
    const viewerId = req.user.id;

    if (viewedId === viewerId) {
      return res.status(200).json({ message: 'Own profile, not counted' });
    }

    const viewedUser = await prisma.user.findUnique({
      where: { id: viewedId },
      select: { id: true },
    });

    if (!viewedUser) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // Upsert: unique per viewed+viewer, updates timestamp
    await prisma.profileView.upsert({
      where: {
        viewedId_viewerId: { viewedId, viewerId },
      },
      update: { viewedAt: new Date() },
      create: { viewedId, viewerId },
    });

    return res.status(200).json({ message: 'Profile view recorded' });
  } catch (error) {
    console.error('Record profile view error:', error);
    return res.status(500).json({ message: 'Failed to record profile view', code: 'VIEW_ERROR' });
  }
};

// ─── GET PROFILE STATS (impressions + profile views) ───
const getProfileStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Post impressions in last 7 days
    const impressionsCount = await prisma.postImpression.count({
      where: {
        post: { userId },
        viewedAt: { gte: sevenDaysAgo },
      },
    });

    // Unique profile viewers in last 7 days
    const profileViewsCount = await prisma.profileView.count({
      where: {
        viewedId: userId,
        viewedAt: { gte: sevenDaysAgo },
      },
    });

    return res.status(200).json({
      impressionsLast7Days: impressionsCount,
      profileViewsLast7Days: profileViewsCount,
    });
  } catch (error) {
    console.error('Get profile stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch stats', code: 'STATS_ERROR' });
  }
};
// ─── GET PROFILE VIEWERS (who viewed my profile) ───
const getProfileViews = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [views, total] = await Promise.all([
      prisma.profileView.findMany({
        where: { viewedId: userId },
        include: {
          viewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              headline: true,
              avatar: true,
              isVerified: true,
              lastActive: true,
              earningBadge: { select: { tier: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { viewedAt: 'desc' },
      }),
      prisma.profileView.count({ where: { viewedId: userId } }),
    ]);

    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const now = Date.now();

    return res.status(200).json({
      users: views.map((v) => {
        const lastActiveTime = v.viewer.lastActive ? new Date(v.viewer.lastActive).getTime() : 0;
        return {
          ...v.viewer,
          isOnline: lastActiveTime > 0 && (now - lastActiveTime) < ONLINE_THRESHOLD_MS,
          earningsTier: v.viewer.earningBadge?.tier || 'newcomer',
          viewedAt: v.viewedAt,
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get profile views error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile views', code: 'VIEWS_ERROR' });
  }
};


module.exports = {
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
  updateUserEarningsTier,
  calculateEarningsTier,
  formatEarningsDisplay,
  requireVerified,
  requireVerifiedOrPending,
  requireVerifiedFor,      
  updateLastActive,
  getUserVerificationStatus,
  recordProfileView,
  getProfileViews,
  getProfileStats,
};