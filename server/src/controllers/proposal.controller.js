const { prisma } = require('../config/database');
const { sanitizeInput } = require('../utils/security');

const createProposal = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { coverLetter, proposedRate, duration, proposedBudget, proposedDuration } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({ message: 'Job is no longer open', code: 'JOB_CLOSED' });
    }

    if (job.buyerId === req.user.id) {
      return res.status(400).json({ message: 'Cannot apply to your own job', code: 'OWN_JOB' });
    }

    const existingProposal = await prisma.proposal.findFirst({
      where: {
        jobId,
        freelancerId: req.user.id,
      },
    });

    if (existingProposal) {
      return res.status(409).json({ message: 'You already submitted a proposal', code: 'PROPOSAL_EXISTS' });
    }

    const budgetValue = proposedBudget ? parseFloat(proposedBudget) : (proposedRate ? parseFloat(proposedRate) : null);
    const durationValue = proposedDuration ? String(proposedDuration) : (duration ? sanitizeInput(duration) : null);
    const durationInt = proposedDuration ? parseInt(proposedDuration) : null;

    const proposal = await prisma.proposal.create({
      data: {
        jobId,
        freelancerId: req.user.id,
        coverLetter: sanitizeInput(coverLetter),
        proposedBudget: budgetValue,
        proposedDuration: durationInt,
        proposedRate: budgetValue,
        duration: durationValue,
      },
      include: {
        freelancer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
          },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: job.buyerId,
        type: 'new_proposal',
        title: 'New Proposal Received',
        message: `${req.user.firstName} ${req.user.lastName} submitted a proposal for "${job.title}"`,
        link: `/jobs/${jobId}`,
      },
    });

    return res.status(201).json({
      message: 'Proposal submitted successfully',
      proposal,
    });
  } catch (error) {
    console.error('Create proposal error:', error);
    return res.status(500).json({ message: 'Failed to submit proposal', code: 'PROPOSAL_ERROR' });
  }
};

const getProposalsForJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    if (job.buyerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const proposals = await prisma.proposal.findMany({
      where: { jobId },
      include: {
        freelancer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
            hourlyRate: true,
            skills: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ proposals });
  } catch (error) {
    console.error('Get proposals error:', error);
    return res.status(500).json({ message: 'Failed to fetch proposals', code: 'FETCH_ERROR' });
  }
};

const getMyProposals = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where = { freelancerId: req.user.id };
    if (status && status !== 'all') where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              budget: true,
              budgetType: true,
              status: true,
              buyer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.proposal.count({ where }),
    ]);

    return res.status(200).json({
      proposals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get my proposals error:', error);
    return res.status(500).json({ message: 'Failed to fetch proposals', code: 'FETCH_ERROR' });
  }
};

const updateProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { coverLetter, proposedBudget, proposedDuration } = req.body;

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { job: true },
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' });
    }

    if (proposal.freelancerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot edit a processed proposal', code: 'CANNOT_EDIT' });
    }

    if (proposal.job.status !== 'open') {
      return res.status(400).json({ message: 'Job is no longer open for edits', code: 'JOB_CLOSED' });
    }

    const updateData = {};
    if (coverLetter !== undefined) updateData.coverLetter = sanitizeInput(coverLetter);
    if (proposedBudget !== undefined) {
      updateData.proposedBudget = parseFloat(proposedBudget);
      updateData.proposedRate = parseFloat(proposedBudget);
    }
    if (proposedDuration !== undefined) {
      updateData.proposedDuration = parseInt(proposedDuration);
      updateData.duration = String(proposedDuration);
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: updateData,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
            budgetType: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: 'Proposal updated successfully',
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error('Update proposal error:', error);
    return res.status(500).json({ message: 'Failed to update proposal', code: 'UPDATE_ERROR' });
  }
};

const updateProposalStatus = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected', 'shortlisted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status', code: 'INVALID_STATUS' });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { job: true },
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' });
    }

    if (proposal.job.buyerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status },
    });

    let notificationTitle, notificationMessage;
    if (status === 'accepted') {
      notificationTitle = 'Proposal Accepted';
      notificationMessage = `Your proposal for "${proposal.job.title}" was accepted!`;
    } else if (status === 'rejected') {
      notificationTitle = 'Proposal Rejected';
      notificationMessage = `Your proposal for "${proposal.job.title}" was not selected.`;
    } else {
      notificationTitle = 'Proposal Shortlisted';
      notificationMessage = `Your proposal for "${proposal.job.title}" was shortlisted.`;
    }

    await prisma.notification.create({
      data: {
        userId: proposal.freelancerId,
        type: `proposal_${status}`,
        title: notificationTitle,
        message: notificationMessage,
        link: `/proposals`,
      },
    });

    if (status === 'accepted') {
      // Determine the offer amount with proper fallbacks
      const offerAmount = 
        proposal.proposedBudget || 
        proposal.proposedRate || 
        proposal.job?.budget || 
        0;

      // Validate amount is not zero
      if (offerAmount <= 0) {
        return res.status(400).json({
          message: 'Cannot accept proposal: no valid amount found. Proposal must have a budget or rate.',
          code: 'NO_AMOUNT',
        });
      }

      // Create the offer record first
      const offer = await prisma.offer.create({
        data: {
          type: 'direct_hire',
          senderId: req.user.id,
          receiverId: proposal.freelancerId,
          jobId: proposal.jobId,
          amount: offerAmount,
          description: proposal.coverLetter || `Job offer for ${proposal.job.title}`,
          durationDays: proposal.proposedDuration || 7,
          revisions: 2,
          status: 'pending',
        },
      });

      // Create message linked to the offer
      const message = await prisma.message.create({
        data: {
          senderId: req.user.id,
          receiverId: proposal.freelancerId,
          content: `💼 JOB OFFER: ${proposal.job.title}`,
          type: 'offer',
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      });

      // Link the offer to the message
      await prisma.offer.update({
        where: { id: offer.id },
        data: { messageId: message.id },
      });

      await prisma.notification.create({
        data: {
          userId: proposal.freelancerId,
          type: 'new_offer',
          title: 'New Job Offer',
          message: `You have a new job offer for "${proposal.job.title}". Check your messages.`,
          link: `/messages/${req.user.id}`,
        },
      });
    }

    return res.status(200).json({
      message: `Proposal ${status} successfully`,
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error('Update proposal error:', error);
    return res.status(500).json({ message: 'Failed to update proposal', code: 'UPDATE_ERROR' });
  }
};

const withdrawProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' });
    }

    if (proposal.freelancerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot withdraw processed proposal', code: 'CANNOT_WITHDRAW' });
    }

    await prisma.proposal.delete({
      where: { id: proposalId },
    });

    return res.status(200).json({ message: 'Proposal withdrawn successfully' });
  } catch (error) {
    console.error('Withdraw proposal error:', error);
    return res.status(500).json({ message: 'Failed to withdraw proposal', code: 'WITHDRAW_ERROR' });
  }
};

module.exports = {
  createProposal,
  getProposalsForJob,
  getMyProposals,
  updateProposal,
  updateProposalStatus,
  withdrawProposal,
};