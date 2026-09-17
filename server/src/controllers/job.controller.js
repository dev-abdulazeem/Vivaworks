const { prisma } = require('../config/database');
const { sanitizeInput } = require('../utils/security');

// ────────────────────────────────────────────────────────────────
// CREATE JOB
// ────────────────────────────────────────────────────────────────
const createJob = async (req, res) => {
  try {
    const { title, description, skills, budget, budgetType, location, media, linkUrl, linkTitle, linkImage, linkDesc } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description required', code: 'MISSING_FIELDS' });
    }

    const job = await prisma.job.create({
      data: {
        buyerId: req.user.id,
        title: sanitizeInput(title),
        description: sanitizeInput(description),
        skills: skills || [],
        budget: budget ? parseFloat(budget) : null,
        budgetType: budgetType || 'fixed',
        location: location ? sanitizeInput(location) : null,
        media: media || [],
        linkUrl: linkUrl ? sanitizeInput(linkUrl) : null,
        linkTitle: linkTitle ? sanitizeInput(linkTitle) : null,
        linkImage: linkImage ? sanitizeInput(linkImage) : null,
        linkDesc: linkDesc ? sanitizeInput(linkDesc) : null,
        featured: false, // Default: not featured
      },
    });

    return res.status(201).json({
      message: 'Job posted successfully',
      job,
    });
  } catch (error) {
    console.error('Create job error:', error);
    return res.status(500).json({ message: 'Failed to post job', code: 'JOB_CREATE_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET ALL JOBS (with filters)
// ────────────────────────────────────────────────────────────────
const getJobs = async (req, res) => {
  try {
    const { status, skill, minBudget, maxBudget, location, page = 1, limit = 10 } = req.query;

    const where = {};

    if (status) where.status = status;
    if (skill) where.skills = { has: skill };
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (minBudget || maxBudget) {
      where.budget = {};
      if (minBudget) where.budget.gte = parseFloat(minBudget);
      if (maxBudget) where.budget.lte = parseFloat(maxBudget);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          buyer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          proposals: {
            select: { id: true },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where }),
    ]);

    return res.status(200).json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    return res.status(500).json({ message: 'Failed to fetch jobs', code: 'JOBS_FETCH_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET FEATURED JOBS
// ────────────────────────────────────────────────────────────────
const getFeaturedJobs = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: {
          featured: true,  // Only get featured jobs
          status: 'open',  // Only open jobs
        },
        include: {
          buyer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              headline: true,
            },
          },
          proposals: {
            select: { id: true },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({
        where: {
          featured: true,
          status: 'open',
        },
      }),
    ]);

    if (jobs.length === 0) {
      return res.status(200).json({
        message: 'No featured jobs found',
        jobs: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0,
        },
      });
    }

    return res.status(200).json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get featured jobs error:', error);
    return res.status(500).json({ message: 'Failed to fetch featured jobs', code: 'FEATURED_JOBS_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET JOB BY ID
// ────────────────────────────────────────────────────────────────
const getJobById = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
          },
        },
        proposals: {
          include: {
            freelancer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                headline: true,
                hourlyRate: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    return res.status(200).json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    return res.status(500).json({ message: 'Failed to fetch job', code: 'JOB_FETCH_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// UPDATE JOB
// ────────────────────────────────────────────────────────────────
const updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { title, description, skills, budget, budgetType, location, status, media, linkUrl, linkTitle, linkImage, linkDesc, featured } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    if (job.buyerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    // Only allow editing if job is open or in_progress
    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot edit completed or cancelled jobs', code: 'JOB_CLOSED' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        title: title ? sanitizeInput(title) : job.title,
        description: description ? sanitizeInput(description) : job.description,
        skills: skills || job.skills,
        budget: budget !== undefined ? (budget ? parseFloat(budget) : null) : job.budget,
        budgetType: budgetType || job.budgetType,
        location: location !== undefined ? (location ? sanitizeInput(location) : null) : job.location,
        status: status || job.status,
        media: media || job.media,
        linkUrl: linkUrl !== undefined ? (linkUrl ? sanitizeInput(linkUrl) : null) : job.linkUrl,
        linkTitle: linkTitle !== undefined ? (linkTitle ? sanitizeInput(linkTitle) : null) : job.linkTitle,
        linkImage: linkImage !== undefined ? (linkImage ? sanitizeInput(linkImage) : null) : job.linkImage,
        linkDesc: linkDesc !== undefined ? (linkDesc ? sanitizeInput(linkDesc) : null) : job.linkDesc,
        featured: featured !== undefined ? featured : job.featured,
      }
    });

    return res.status(200).json({
      message: 'Job updated successfully',
      job: updatedJob
    });
  } catch (error) {
    console.error('Update job error:', error);
    return res.status(500).json({ message: 'Failed to update job', code: 'UPDATE_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// DELETE JOB
// ────────────────────────────────────────────────────────────────
const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!existingJob) {
      return res.status(404).json({ message: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    if (existingJob.buyerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    await prisma.job.delete({
      where: { id: jobId },
    });

    return res.status(200).json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    return res.status(500).json({ message: 'Failed to delete job', code: 'JOB_DELETE_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// GET MY JOBS (Buyer's own jobs)
// ────────────────────────────────────────────────────────────────
const getMyJobs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where = { buyerId: req.user.id };
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          proposals: {
            select: { id: true, status: true },
          },
          contracts: {
            select: { id: true, status: true },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where }),
    ]);

    return res.status(200).json({
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    return res.status(500).json({ message: 'Failed to fetch jobs', code: 'JOBS_FETCH_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// MARK JOB AS FEATURED (Admin only)
// ────────────────────────────────────────────────────────────────
const markJobFeatured = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { featured } = req.body;

    // Admin check
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Only admins can feature jobs', code: 'ADMIN_ONLY' });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { featured: featured === true },
    });

    return res.status(200).json({
      message: `Job ${featured ? 'featured' : 'unfeatured'} successfully`,
      job: updatedJob,
    });
  } catch (error) {
    console.error('Mark featured job error:', error);
    return res.status(500).json({ message: 'Failed to update job featured status', code: 'FEATURED_UPDATE_ERROR' });
  }
};

// ────────────────────────────────────────────────────────────────
// EXPORT ALL CONTROLLERS
// ────────────────────────────────────────────────────────────────
module.exports = {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getFeaturedJobs,
  markJobFeatured,
};