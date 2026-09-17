const { prisma } = require('../config/database');
const { sendDisputeUpdateEmail } = require('../utils/email');

// ─── GET ALL DISPUTES (ADMIN) ───────────────────────────────────────────
const getAllDisputes = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status && status !== 'all') where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          contract: {
            include: {
              job: { select: { id: true, title: true } },
              buyer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
              freelancer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            },
          },
          filedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
          replies: {
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispute.count({ where }),
    ]);

    return res.status(200).json({
      disputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get disputes error:', error);
    return res.status(500).json({ message: 'Failed to fetch disputes', code: 'FETCH_ERROR' });
  }
};

// ─── GET DISPUTE BY ID ──────────────────────────────────────────────────
const getDisputeById = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          include: {
            job: { select: { id: true, title: true } },
            buyer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          },
        },
        filedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
        replies: {
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found', code: 'NOT_FOUND' });
    }

    // Check authorization
    const contract = dispute.contract;
    const isInvolved = contract.buyerId === req.user.id || contract.freelancerId === req.user.id;
    if (!isInvolved && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    return res.status(200).json({ dispute });
  } catch (error) {
    console.error('Get dispute error:', error);
    return res.status(500).json({ message: 'Failed to fetch dispute', code: 'FETCH_ERROR' });
  }
};

// ─── ADD REPLY TO DISPUTE (BUYER OR FREELANCER) ─────────────────────────
const addDisputeReply = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { content } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found', code: 'NOT_FOUND' });
    }

    if (dispute.status === 'resolved') {
      return res.status(400).json({ message: 'Cannot reply to a resolved dispute', code: 'DISPUTE_RESOLVED' });
    }

    const contract = dispute.contract;
    if (contract.buyerId !== req.user.id && contract.freelancerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    // Process uploaded files
    const files = [];
    const fileMeta = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        files.push(file.path);
        fileMeta.push({
          url: file.path,
          name: file.originalname || file.filename || 'Untitled',
          type: file.mimetype || 'application/octet-stream',
          size: file.size || 0,
        });
      }
    }

    const reply = await prisma.disputeReply.create({
      data: {
        disputeId,
        senderId: req.user.id,
        content: content || '',
        files,
        fileMeta: fileMeta.length > 0 ? fileMeta : undefined,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    // Notify the other party
    const otherPartyId = contract.buyerId === req.user.id ? contract.freelancerId : contract.buyerId;
    const otherParty = contract.buyerId === req.user.id ? contract.freelancer : contract.buyer;

    await prisma.notification.create({
      data: {
        userId: otherPartyId,
        type: 'dispute_reply',
        title: 'New Dispute Reply',
        message: `${req.user.firstName || 'User'} replied to the dispute for "${contract.job?.title || 'Contract'}".`,
        link: `/contracts/${contract.id}`,
      },
    });

    // Email notification
    try {
      await sendDisputeUpdateEmail({
        to: otherParty.email,
        firstName: otherParty.firstName,
        contractTitle: contract.job?.title || 'Contract',
        status: dispute.status,
        message: `${req.user.firstName || 'User'} has submitted a reply with new evidence.`,
      });
    } catch (emailErr) {
      console.error('Reply email error:', emailErr);
    }

    return res.status(201).json({
      message: 'Reply added successfully',
      reply,
    });
  } catch (error) {
    console.error('Add reply error:', error);
    return res.status(500).json({ message: 'Failed to add reply', code: 'REPLY_ERROR' });
  }
};

// ─── UPDATE DISPUTE STATUS (ADMIN) ──────────────────────────────────────
const updateDisputeStatus = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status, adminNotes } = req.body;

    if (!['open', 'under_review', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status', code: 'INVALID_STATUS' });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
          },
        },
        filedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found', code: 'NOT_FOUND' });
    }

    const updateData = {
      status,
      adminNotes: adminNotes || dispute.adminNotes,
    };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = req.user.id;
    }
        // If dispute was filed during the dispute window, mark contract as cancelled
    if (dispute.filedDuringWindow) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: 'cancelled',
          endDate: new Date(),
          payoutStatus: null,
          payoutDate: null,
          disputeWindowEndsAt: null,
        },
      });
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: updateData,
      include: {
        contract: {
          include: {
            job: { select: { title: true } },
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify both parties
    const contract = dispute.contract;
    const parties = [
      { id: contract.buyerId, user: contract.buyer },
      { id: contract.freelancerId, user: contract.freelancer },
    ];

    for (const party of parties) {
      await prisma.notification.create({
        data: {
          userId: party.id,
          type: 'dispute_status_update',
          title: 'Dispute Status Updated',
          message: `The dispute for "${contract.job?.title || 'Contract'}" is now ${status.replace('_', ' ')}.`,
          link: `/contracts/${contract.id}`,
        },
      });

      // Email
      try {
        await sendDisputeUpdateEmail({
          to: party.user.email,
          firstName: party.user.firstName,
          contractTitle: contract.job?.title || 'Contract',
          status,
          message: status === 'under_review' 
            ? 'An admin is now reviewing your dispute. You may be contacted for additional information.'
            : status === 'resolved'
            ? 'The dispute has been resolved. Check your dashboard for the final decision.'
            : 'The dispute status has been updated.',
        });
      } catch (emailErr) {
        console.error('Status update email error:', emailErr);
      }
    }

    return res.status(200).json({
      message: 'Dispute status updated',
      dispute: updatedDispute,
    });
  } catch (error) {
    console.error('Update dispute status error:', error);
    return res.status(500).json({ message: 'Failed to update dispute status', code: 'UPDATE_ERROR' });
  }
};

// ─── RESOLVE DISPUTE (ADMIN) ────────────────────────────────────────────
const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, adminNotes, refundAmount } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found', code: 'NOT_FOUND' });
    }

    if (dispute.status === 'resolved') {
      return res.status(400).json({ message: 'Dispute already resolved', code: 'ALREADY_RESOLVED' });
    }

    const contract = dispute.contract;

    // Handle wallet transactions based on resolution
    if (resolution === 'buyer_wins' || resolution === 'custom') {
      const refundAmt = resolution === 'custom' && refundAmount ? parseFloat(refundAmount) : parseFloat(contract.escrowAmount);

      if (refundAmt > 0 && parseFloat(contract.escrowAmount) > 0) {
        await prisma.$transaction(async (tx) => {
          let buyerWallet = await tx.wallet.findUnique({
            where: { userId: contract.buyerId },
          });

          if (!buyerWallet) {
            buyerWallet = await tx.wallet.create({
              data: { userId: contract.buyerId, balance: 0 },
            });
          }

          await tx.wallet.update({
            where: { userId: contract.buyerId },
            data: { balance: { increment: refundAmt } },
          });

          await tx.transaction.create({
            data: {
              walletId: buyerWallet.id,
              type: 'dispute_refund',
              amount: refundAmt,
              description: `Dispute refund for: ${contract.job?.title || 'Contract'}`,
              status: 'completed',
            },
          });

          await tx.contract.update({
            where: { id: contract.id },
            data: {
              escrowAmount: { decrement: refundAmt },
              status: 'cancelled',
              endDate: new Date(),
            },
          });
        });
      }
    } else if (resolution === 'freelancer_wins') {
      const payoutAmt = parseFloat(contract.escrowAmount);

      if (payoutAmt > 0) {
        await prisma.$transaction(async (tx) => {
          let freelancerWallet = await tx.wallet.findUnique({
            where: { userId: contract.freelancerId },
          });

          if (!freelancerWallet) {
            freelancerWallet = await tx.wallet.create({
              data: { userId: contract.freelancerId, balance: 0 },
            });
          }

          await tx.wallet.update({
            where: { userId: contract.freelancerId },
            data: { balance: { increment: payoutAmt } },
          });

          await tx.transaction.create({
            data: {
              walletId: freelancerWallet.id,
              type: 'dispute_payout',
              amount: payoutAmt,
              description: `Dispute payout for: ${contract.job?.title || 'Contract'}`,
              status: 'completed',
            },
          });

          await tx.contract.update({
            where: { id: contract.id },
            data: {
              escrowAmount: 0,
              status: 'completed',
              endDate: new Date(),
              payoutStatus: 'released',
            },
          });
        });
      }
    } else if (resolution === 'split') {
      const halfAmount = parseFloat(contract.escrowAmount) / 2;

      if (halfAmount > 0) {
        await prisma.$transaction(async (tx) => {
          let buyerWallet = await tx.wallet.findUnique({
            where: { userId: contract.buyerId },
          });
          let freelancerWallet = await tx.wallet.findUnique({
            where: { userId: contract.freelancerId },
          });

          if (!buyerWallet) {
            buyerWallet = await tx.wallet.create({
              data: { userId: contract.buyerId, balance: 0 },
            });
          }
          if (!freelancerWallet) {
            freelancerWallet = await tx.wallet.create({
              data: { userId: contract.freelancerId, balance: 0 },
            });
          }

          await tx.wallet.update({
            where: { userId: contract.buyerId },
            data: { balance: { increment: halfAmount } },
          });
          await tx.wallet.update({
            where: { userId: contract.freelancerId },
            data: { balance: { increment: halfAmount } },
          });

          await tx.transaction.create({
            data: {
              walletId: buyerWallet.id,
              type: 'dispute_refund',
              amount: halfAmount,
              description: `Dispute split refund for: ${contract.job?.title || 'Contract'}`,
              status: 'completed',
            },
          });
          await tx.transaction.create({
            data: {
              walletId: freelancerWallet.id,
              type: 'dispute_payout',
              amount: halfAmount,
              description: `Dispute split payout for: ${contract.job?.title || 'Contract'}`,
              status: 'completed',
            },
          });

          await tx.contract.update({
            where: { id: contract.id },
            data: {
              escrowAmount: 0,
              status: 'cancelled',
              endDate: new Date(),
            },
          });
        });
      }
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'resolved',
        resolution,
        adminNotes: adminNotes || null,
        resolvedAt: new Date(),
        resolvedById: req.user.id,
      },
      include: {
        contract: {
          include: {
            job: { select: { title: true } },
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify both parties
    const parties = [
      { id: contract.buyerId, user: contract.buyer },
      { id: contract.freelancerId, user: contract.freelancer },
    ];

    for (const party of parties) {
      await prisma.notification.create({
        data: {
          userId: party.id,
          type: 'dispute_resolved',
          title: 'Dispute Resolved',
          message: `The dispute for "${contract.job?.title || 'Contract'}" has been resolved: ${resolution.replace('_', ' ')}.`,
          link: `/contracts/${contract.id}`,
        },
      });

      try {
        await sendDisputeUpdateEmail({
          to: party.user.email,
          firstName: party.user.firstName,
          contractTitle: contract.job?.title || 'Contract',
          status: 'resolved',
          message: `Resolution: ${resolution.replace('_', ' ')}. ${adminNotes || ''}`,
        });
      } catch (emailErr) {
        console.error('Resolution email error:', emailErr);
      }
    }

    return res.status(200).json({
      message: 'Dispute resolved successfully',
      dispute: updatedDispute,
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    return res.status(500).json({ message: 'Failed to resolve dispute', code: 'RESOLVE_ERROR' });
  }
};

module.exports = {
  getAllDisputes,
  getDisputeById,
  addDisputeReply,
  updateDisputeStatus,
  resolveDispute,
};