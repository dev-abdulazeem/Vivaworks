const { prisma } = require('../config/database');

// ─── CREATE OFFER (in messages) ──────────────────────────────────────────
const createOffer = async (req, res) => {
  try {
    const { 
      receiverId, 
      amount, 
      description, 
      type = 'direct_hire', 
      jobId, 
      expiresInDays = 7,
      durationDays = 7,
      revisions = 2,
      deliverables = [],
      milestones = [],
    } = req.body;

    if (!receiverId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Receiver and valid amount required', code: 'MISSING_FIELDS' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ message: 'Cannot send offer to yourself', code: 'SELF_OFFER' });
    }

    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.user.findUnique({ where: { id: receiverId } }),
    ]);

    if (!receiver) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const buyerId = sender.isBuyer ? sender.id : receiver.isBuyer ? receiver.id : null;
    const freelancerId = sender.isBuyer ? receiver.id : receiver.isBuyer ? sender.id : null;

    if (!buyerId) {
      return res.status(400).json({
        message: 'One party must be a buyer. Freelancers cannot pay each other.',
        code: 'NO_BUYER',
      });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          senderId: req.user.id,
          receiverId,
          content: `💼 New Offer: ₦${parseFloat(amount).toLocaleString()}\n\n${description || ''}`,
          type: 'offer',
        },
      });

      const offer = await tx.offer.create({
        data: {
          type,
          senderId: req.user.id,
          receiverId,
          jobId: jobId || null,
          amount: parseFloat(amount),
          description: description || '',
          title: req.body.title || '',
          status: 'pending',
          expiresAt,
          messageId: message.id,
          durationDays: parseInt(durationDays) || 7,
          revisions: parseInt(revisions) || 2,
          deliverables: deliverables || [],
          milestones: milestones || [],
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          receiver: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          message: { select: { id: true, content: true, createdAt: true } },
          job: { select: { id: true, title: true } },
        },
      });

      return { message, offer };
    });

    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'new_offer',
        title: 'New Offer Received',
        message: `${sender.firstName} sent you an offer of ₦${parseFloat(amount).toLocaleString()} (${durationDays} days)`,
        link: `/messages?to=${req.user.id}`,
      },
    });

    return res.status(201).json({
      message: 'Offer sent',
      offer: result.offer,
    });
  } catch (error) {
    console.error('Create offer error:', error);
    return res.status(500).json({ message: 'Failed to create offer', code: 'OFFER_ERROR' });
  }
};

// ─── ACCEPT OFFER (FREELANCER ACCEPTS) ──────────────────────────────────
const acceptOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        sender: true,
        receiver: true,
        job: true,
      },
    });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found', code: 'OFFER_NOT_FOUND' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ message: 'Offer already processed', code: 'OFFER_PROCESSED' });
    }

    if (offer.expiresAt && new Date() > offer.expiresAt) {
      await prisma.offer.update({
        where: { id: offerId },
        data: { status: 'expired' },
      });
      return res.status(400).json({ message: 'Offer has expired', code: 'OFFER_EXPIRED' });
    }

    const buyerId = offer.sender.isBuyer ? offer.senderId : offer.receiverId;
    const freelancerId = offer.sender.isBuyer ? offer.receiverId : offer.senderId;

    // Only freelancer can accept (buyer already sent it)
    if (req.user.id !== freelancerId) {
      return res.status(403).json({ message: 'Only the freelancer can accept this offer', code: 'UNAUTHORIZED' });
    }

    // Calculate due date and grace period
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + offer.durationDays);
    const graceEndDate = new Date(dueDate);
    graceEndDate.setDate(graceEndDate.getDate() + 1); // 1 day grace period

    const result = await prisma.$transaction(async (tx) => {
      // Create contract (payment happens separately via contract payment)
      const contract = await tx.contract.create({
        data: {
          jobId: offer.jobId || null,
          buyerId: buyerId,
          freelancerId: freelancerId,
          amount: parseFloat(offer.amount),
          title: offer.title || offer.description?.slice(0, 100) || 'Untitled Contract',
          status: 'pending_payment',
          dueDate: dueDate,
          graceEndDate: graceEndDate,
          maxRevisions: offer.revisions,
          milestones: offer.milestones || [],
        },
      });

      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: {
          status: 'accepted',
          contractId: contract.id,
        },
      });

      return { contract, updatedOffer };
    });

    await Promise.all([
      prisma.notification.create({
        data: {
          userId: buyerId,
          type: 'offer_accepted',
          title: 'Offer Accepted!',
          message: `Your offer of ₦${offer.amount.toLocaleString()} was accepted. Proceed to payment to activate the contract.`,
          link: `/contracts/${result.contract.id}`,
        },
      }),
      prisma.notification.create({
        data: {
          userId: freelancerId,
          type: 'offer_accepted',
          title: 'Offer Accepted',
          message: `You accepted the offer. Waiting for buyer payment to start the project.`,
          link: `/contracts/${result.contract.id}`,
        },
      }),
    ]);

    return res.status(200).json({
      message: 'Offer accepted. Contract created. Buyer must pay to activate.',
      contract: result.contract,
      offer: result.updatedOffer,
    });
  } catch (error) {
    console.error('Accept offer error:', error);
    return res.status(500).json({ message: 'Failed to accept offer', code: 'ACCEPT_ERROR' });
  }
};

// ─── REJECT OFFER ────────────────────────────────────────────────────────
const rejectOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found', code: 'OFFER_NOT_FOUND' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ message: 'Offer already processed', code: 'OFFER_PROCESSED' });
    }

    if (req.user.id !== offer.senderId && req.user.id !== offer.receiverId) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'rejected' },
    });

    const otherPartyId = req.user.id === offer.senderId ? offer.receiverId : offer.senderId;

    await prisma.notification.create({
      data: {
        userId: otherPartyId,
        type: 'offer_rejected',
        title: 'Offer Rejected',
        message: `An offer was rejected`,
        link: `/messages`,
      },
    });

    return res.status(200).json({
      message: 'Offer rejected',
      offer: updatedOffer,
    });
  } catch (error) {
    console.error('Reject offer error:', error);
    return res.status(500).json({ message: 'Failed to reject offer', code: 'REJECT_ERROR' });
  }
};

// ─── CANCEL OFFER (BUYER ONLY, BEFORE PAYMENT) ──────────────────────────
const cancelOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { contract: true },
    });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found', code: 'OFFER_NOT_FOUND' });
    }

    if (offer.senderId !== req.user.id) {
      return res.status(403).json({ message: 'Only the sender can cancel', code: 'UNAUTHORIZED' });
    }

    if (offer.status !== 'pending' && offer.status !== 'accepted') {
      return res.status(400).json({ message: 'Cannot cancel this offer', code: 'INVALID_STATUS' });
    }

    // If contract exists and is pending_payment, delete it
    if (offer.contract && offer.contract.status === 'pending_payment') {
      await prisma.contract.delete({
        where: { id: offer.contract.id },
      });
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'cancelled' },
    });

    await prisma.notification.create({
      data: {
        userId: offer.receiverId,
        type: 'offer_cancelled',
        title: 'Offer Cancelled',
        message: `An offer was cancelled by the buyer`,
        link: `/messages`,
      },
    });

    return res.status(200).json({
      message: 'Offer cancelled',
      offer: updatedOffer,
    });
  } catch (error) {
    console.error('Cancel offer error:', error);
    return res.status(500).json({ message: 'Failed to cancel offer', code: 'CANCEL_ERROR' });
  }
};

// ─── GET MY OFFERS ─────────────────────────────────────────────────────
const getMyOffers = async (req, res) => {
  try {
    const { status, type } = req.query;

    const where = {
      OR: [
        { senderId: req.user.id },
        { receiverId: req.user.id },
      ],
    };

    if (status) where.status = status;
    if (type) where.type = type;

    const offers = await prisma.offer.findMany({
      where,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        contract: { 
          select: { 
            id: true, 
            status: true, 
            dueDate: true, 
            graceEndDate: true,
            deliveredAt: true,
          } 
        },
        job: { select: { id: true, title: true } },
        message: { select: { id: true, content: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ offers });
  } catch (error) {
    console.error('Get offers error:', error);
    return res.status(500).json({ message: 'Failed to fetch offers', code: 'FETCH_ERROR' });
  }
};

// ─── GET OFFER BY ID ───────────────────────────────────────────────────
const getOfferById = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        contract: { 
          select: { 
            id: true, 
            status: true, 
            dueDate: true, 
            graceEndDate: true,
            deliveredAt: true,
            deliveryNote: true,
            deliveryFiles: true,
            revisionCount: true,
            maxRevisions: true,
          } 
        },
        job: { select: { id: true, title: true } },
        message: { select: { id: true, content: true, createdAt: true } },
      },
    });

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found', code: 'OFFER_NOT_FOUND' });
    }

    if (offer.senderId !== req.user.id && offer.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    return res.status(200).json({ offer });
  } catch (error) {
    console.error('Get offer error:', error);
    return res.status(500).json({ message: 'Failed to fetch offer', code: 'FETCH_ERROR' });
  }
};

module.exports = {
  createOffer,
  acceptOffer,
  rejectOffer,
  cancelOffer,
  getMyOffers,
  getOfferById,
};