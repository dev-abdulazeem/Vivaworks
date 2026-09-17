const { prisma } = require('../config/database');

const createReview = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5', code: 'INVALID_RATING' });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { 
        reviews: true,
        job: { select: { title: true } },
        offers: { 
          select: { description: true, amount: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.status !== 'completed') {
      return res.status(400).json({ message: 'Can only review completed contracts', code: 'NOT_COMPLETED' });
    }

    const isBuyer = contract.buyerId === req.user.id;
    const isFreelancer = contract.freelancerId === req.user.id;

    if (!isBuyer && !isFreelancer) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const revieweeId = isBuyer ? contract.freelancerId : contract.buyerId;

    const existingReview = await prisma.review.findFirst({
      where: {
        contractId,
        reviewerId: req.user.id,
      },
    });

    if (existingReview) {
      return res.status(409).json({ message: 'You already reviewed this contract', code: 'ALREADY_REVIEWED' });
    }

    // Get project name from: job title → contract title → offer description → fallback
    const projectName = 
      contract.job?.title || 
      contract.title || 
      contract.offers?.[0]?.description?.substring(0, 100) || 
      'Project';

    const review = await prisma.review.create({
      data: {
        contractId,
        reviewerId: req.user.id,
        revieweeId,
        rating: parseInt(rating),
        comment: comment || null,
        projectName,
      },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        contract: {
          select: { 
            id: true, 
            title: true, 
            job: { select: { title: true } } 
          },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: revieweeId,
        type: 'new_review',
        title: 'New Review',
        message: `${req.user.firstName} left you a ${rating}-star review`,
        link: `/contracts/${contractId}`,
      },
    });

    return res.status(201).json({
      message: 'Review submitted successfully',
      review,
    });
  } catch (error) {
    console.error('Create review error:', error);
    return res.status(500).json({ message: 'Failed to submit review', code: 'REVIEW_ERROR' });
  }
};

const getReviewsForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: userId },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          contract: {
            select: { 
              id: true, 
              title: true, 
              job: { select: { title: true } } 
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count({ where: { revieweeId: userId } }),
    ]);

    const averageRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    return res.status(200).json({
      reviews,
      averageRating,
      totalReviews: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return res.status(500).json({ message: 'Failed to fetch reviews', code: 'FETCH_ERROR' });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: req.user.id },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          contract: {
            select: { 
              id: true, 
              title: true, 
              job: { select: { title: true } } 
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count({ where: { revieweeId: req.user.id } }),
    ]);

    const averageRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    return res.status(200).json({
      reviews,
      averageRating,
      totalReviews: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    return res.status(500).json({ message: 'Failed to fetch reviews', code: 'FETCH_ERROR' });
  }
};

const getContractReview = async (req, res) => {
  try {
    const { contractId } = req.params;

    const review = await prisma.review.findFirst({
      where: {
        contractId,
        reviewerId: req.user.id,
      },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        reviewee: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        contract: {
          select: { 
            id: true, 
            title: true, 
            job: { select: { title: true } } 
          },
        },
      },
    });

    return res.status(200).json({
      hasReviewed: !!review,
      review: review || null,
    });
  } catch (error) {
    console.error('Get contract review error:', error);
    return res.status(500).json({ message: 'Failed to check review status', code: 'FETCH_ERROR' });
  }
};

module.exports = {
  createReview,
  getReviewsForUser,
  getMyReviews,
  getContractReview,
};