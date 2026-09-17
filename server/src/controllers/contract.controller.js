const { prisma } = require('../config/database');
const { processEscrowPayment, verifyTransaction } = require('../utils/paystack');
const { updateUserEarningsTier } = require('./user.controller');

// ─── HELPER: Resolve contract display title ──────────────────────────────
const getContractTitle = async (contract) => {
  if (contract.title) return contract.title;
  if (contract.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: contract.jobId },
      select: { title: true },
    });
    if (job?.title) return job.title;
  }
  if (contract.description) return contract.description;
  return 'Untitled Contract';
};

// ─── CREATE CONTRACT FROM ACCEPTED PROPOSAL ─────────────────────────────
const createContract = async (req, res) => {
  try {
    const { proposalId } = req.body;

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { job: true, freelancer: true },
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found', code: 'PROPOSAL_NOT_FOUND' });
    }

    if (proposal.status !== 'accepted') {
      return res.status(400).json({ message: 'Proposal must be accepted first', code: 'NOT_ACCEPTED' });
    }

    if (proposal.job.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the job owner can create a contract', code: 'UNAUTHORIZED' });
    }

    const existingContract = await prisma.contract.findFirst({
      where: { jobId: proposal.jobId },
    });

    if (existingContract) {
      return res.status(409).json({ message: 'Contract already exists for this job', code: 'CONTRACT_EXISTS' });
    }

    const duration = proposal.duration || proposal.proposedDuration || 7;
    const revisionsTotal = proposal.revisions || proposal.proposedRevisions || proposal.maxRevisions || 6;
    const startDate = new Date();
    const deadline = new Date(startDate);
    deadline.setDate(startDate.getDate() + parseInt(duration));

    console.log('[createContract] Creating contract with:', {
      proposalId,
      duration,
      revisionsTotal,
      revisionsFromProposal: proposal.revisions,
      proposedRevisions: proposal.proposedRevisions,
      maxRevisions: proposal.maxRevisions,
    });

    const contract = await prisma.contract.create({
      data: {
        jobId: proposal.jobId,
        buyerId: proposal.job.buyerId,
        freelancerId: proposal.freelancerId,
        amount: parseFloat(proposal.proposedBudget) || parseFloat(proposal.proposedRate) || 0,
        duration: parseInt(duration),
        revisionsTotal: parseInt(revisionsTotal) || 6,
        revisionsUsed: 0,
        deadline: deadline,
        dueDate: deadline,
        status: 'pending_payment',
      },
      include: {
        job: { select: { id: true, title: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
    });

    console.log('[createContract] Contract created:', {
      id: contract.id,
      revisionsTotal: contract.revisionsTotal,
      revisionsUsed: contract.revisionsUsed,
    });

    await prisma.notification.create({
      data: {
        userId: proposal.freelancerId,
        type: 'contract_created',
        title: 'New Contract',
        message: `A contract was created for "${proposal.job.title}" — awaiting payment`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(201).json({
      message: 'Contract created. Proceed to payment to activate.',
      contract,
    });
  } catch (error) {
    console.error('Create contract error:', error);
    return res.status(500).json({ message: 'Failed to create contract', code: 'CONTRACT_ERROR' });
  }
};

// ─── CREATE DIRECT HIRE CONTRACT (FROM OFFER) ───────────────────────────
const createDirectHireContract = async (req, res) => {
  try {
    const { freelancerId, amount, title, description, duration, revisions } = req.body;

    console.log('[createDirectHireContract] Request body:', {
      freelancerId,
      amount,
      title,
      duration,
      revisions,
      revisionsType: typeof revisions,
    });

    if (!freelancerId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Freelancer ID and valid amount are required', code: 'INVALID_INPUT' });
    }

    const freelancer = await prisma.user.findUnique({
      where: { id: freelancerId },
      select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
    });

    if (!freelancer) {
      return res.status(404).json({ message: 'Freelancer not found', code: 'FREELANCER_NOT_FOUND' });
    }

    const contractDuration = duration || 7;
    const contractRevisions = revisions !== undefined && revisions !== null && revisions !== '' ? parseInt(revisions) : 6;
    const startDate = new Date();
    const deadline = new Date(startDate);
    deadline.setDate(startDate.getDate() + parseInt(contractDuration));

    console.log('[createDirectHireContract] Computed values:', {
      contractDuration,
      contractRevisions,
      revisionsTotalToSave: contractRevisions || 6,
    });

    const contract = await prisma.contract.create({
      data: {
        buyerId: req.user.id,
        freelancerId: freelancer.id,
        amount: parseFloat(amount),
        duration: parseInt(contractDuration),
        revisionsTotal: contractRevisions || 6,
        revisionsUsed: 0,
        deadline: deadline,
        dueDate: deadline,
        status: 'pending_payment',
        title: title || 'Direct Hire Contract',
        description: description || null,
      },
      include: {
        freelancer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        buyer: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
    });

    console.log('[createDirectHireContract] Contract created:', {
      id: contract.id,
      revisionsTotal: contract.revisionsTotal,
      revisionsUsed: contract.revisionsUsed,
    });

    const displayTitle = title || description || 'Direct Hire Contract';

    await prisma.notification.create({
      data: {
        userId: freelancer.id,
        type: 'contract_created',
        title: 'New Contract',
        message: `A direct hire contract was created for you — "${displayTitle}" — awaiting payment`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(201).json({
      message: 'Direct hire contract created. Proceed to payment to activate.',
      contract,
    });
  } catch (error) {
    console.error('Create direct hire contract error:', error);
    return res.status(500).json({ message: 'Failed to create direct hire contract', code: 'DIRECT_HIRE_ERROR' });
  }
};

// ─── INITIATE PAYSTACK PAYMENT (BUYER PAYS INTO ESCROW) ────────────────
const initiateContractPayment = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        job: true,
        buyer: true,
        freelancer: true,
      },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the buyer can pay', code: 'UNAUTHORIZED' });
    }

    if (contract.status !== 'pending_payment') {
      return res.status(400).json({ message: 'Contract already paid or cancelled', code: 'INVALID_STATUS' });
    }

    const jobTitle = await getContractTitle(contract);

    const buyerWallet = await prisma.wallet.findUnique({
      where: { userId: contract.buyerId },
    });

    const amount = Math.ceil(contract.amount * 100);

    if (buyerWallet && parseFloat(buyerWallet.balance) >= parseFloat(contract.amount)) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { userId: contract.buyerId },
          data: { balance: { decrement: parseFloat(contract.amount) } },
        }),
        prisma.transaction.create({
          data: {
            walletId: buyerWallet.id,
            type: 'escrow_deposit',
            amount: -parseFloat(contract.amount),
            description: `Escrow deposit for contract: ${jobTitle}`,
            status: 'completed',
          },
        }),
        prisma.contract.update({
          where: { id: contractId },
          data: {
            status: 'active',
            escrowAmount: contract.amount,
            startDate: new Date(),
          },
        }),
      ]);

      await prisma.notification.create({
        data: {
          userId: contract.freelancerId,
          type: 'contract_active',
          title: 'Contract Active',
          message: `Payment received! Contract for "${jobTitle}" is now active.`,
          link: `/contracts/${contract.id}`,
        },
      });

      return res.status(200).json({
        message: 'Payment completed from wallet. Contract is now active.',
        contract: await prisma.contract.findUnique({
          where: { id: contractId },
          include: {
            job: { select: { title: true } },
            freelancer: { select: { firstName: true, lastName: true, avatar: true } },
            buyer: { select: { firstName: true, lastName: true, avatar: true } },
          },
        }),
      });
    }

    const paymentResult = await processEscrowPayment({
      buyerId: contract.buyerId,
      contractId: contract.id,
      amount: parseFloat(contract.amount),
      email: contract.buyer.email,
      metadata: {
        contractId: contract.id,
        jobTitle: jobTitle,
        type: 'contract_escrow',
      },
    });

    if (!paymentResult.success) {
      return res.status(400).json({ message: paymentResult.error, code: 'PAYMENT_FAILED' });
    }

    return res.status(200).json({
      message: 'Redirect to Paystack to complete payment',
      authorizationUrl: paymentResult.authorizationUrl,
      reference: paymentResult.reference,
    });
  } catch (error) {
    console.error('Contract payment error:', error);
    return res.status(500).json({ message: 'Payment initiation failed', code: 'PAYMENT_ERROR' });
  }
};

// ─── PAYSTACK WEBHOOK: VERIFY & ACTIVATE CONTRACT ──────────────────────
const verifyContractPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    const verification = await verifyTransaction(reference);

    if (!verification.success) {
      return res.status(400).json({ message: 'Payment verification failed', code: 'VERIFY_FAILED' });
    }

    const contractId = verification.data.metadata?.contractId;
    if (!contractId) {
      return res.status(400).json({ message: 'Invalid payment metadata', code: 'INVALID_METADATA' });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { job: true, freelancer: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    const jobTitle = await getContractTitle(contract);

    const amount = verification.data.amount / 100;

    await prisma.$transaction([
      prisma.contract.update({
        where: { id: contractId },
        data: {
          status: 'active',
          escrowAmount: amount,
          startDate: new Date(),
        },
      }),
      prisma.payment.create({
        data: {
          contractId,
          amount,
          paystackRef: reference,
          status: 'completed',
          type: 'deposit',
        },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: contract.freelancerId,
        type: 'contract_active',
        title: 'Contract Active',
        message: `Payment received! Contract for "${jobTitle}" is now active.`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(200).json({ message: 'Payment verified. Contract activated.' });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ message: 'Verification failed', code: 'VERIFY_ERROR' });
  }
};

// ─── SUBMIT DELIVERY (FREELANCER) ──────────────────────────────────────
const submitDelivery = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { note } = req.body;

    const fileMeta = [];
    const fileUrls = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileObj = {
          url: file.path,
          name: file.originalname || file.filename || 'Untitled',
          type: file.mimetype || 'application/octet-stream',
          size: file.size || 0,
        };
        fileMeta.push(fileObj);
        fileUrls.push(file.path);
      }
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { buyer: true, freelancer: true, job: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.freelancerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the freelancer can deliver', code: 'UNAUTHORIZED' });
    }

    if (contract.status !== 'active' && contract.status !== 'revision_requested') {
      return res.status(400).json({ message: 'Contract must be active to deliver', code: 'INVALID_STATUS' });
    }

    const autoAcceptDeadline = new Date();
    autoAcceptDeadline.setDate(autoAcceptDeadline.getDate() + 2);

    const delivery = await prisma.delivery.create({
      data: {
        contractId,
        freelancerId: req.user.id,
        note: note || '',
        files: fileUrls,
        fileMeta: fileMeta,
        status: 'pending',
        autoAcceptAt: autoAcceptDeadline,
      },
    });

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'delivered',
        deliveryNote: note || '',
        deliveryFiles: fileUrls,
        deliveryFileMeta: fileMeta,
        deliveredAt: new Date(),
      },
    });

    const jobTitle = await getContractTitle(contract);

    await prisma.notification.create({
      data: {
        userId: contract.buyerId,
        type: 'delivery_submitted',
        title: 'Work Delivered!',
        message: `${contract.freelancer.firstName} submitted work for "${jobTitle}". Review and confirm within 2 days or it will be auto-accepted.`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(200).json({
      message: 'Delivery submitted successfully',
      delivery: {
        ...delivery,
        files: fileMeta,
        autoAcceptAt: autoAcceptDeadline,
      },
    });
  } catch (error) {
    console.error('Submit delivery error:', error);
    return res.status(500).json({ message: 'Failed to submit delivery', code: 'DELIVERY_ERROR' });
  }
};

// ─── CONFIRM DELIVERY / COMPLETE CONTRACT (BUYER) ────────────────────────
const confirmDelivery = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { job: true, freelancer: true, buyer: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Only the buyer can confirm', code: 'UNAUTHORIZED' });
    }

    if (contract.status !== 'delivered') {
      return res.status(400).json({ message: 'Contract must be delivered first', code: 'INVALID_STATUS' });
    }

    const contractTitle = await getContractTitle(contract);

    const PLATFORM_COMMISSION_RATE = 0.10;
    const platformFee = contract.escrowAmount * PLATFORM_COMMISSION_RATE;
    const freelancerPayout = contract.escrowAmount - platformFee;

    const payoutDate = new Date();
    payoutDate.setDate(payoutDate.getDate() + 2);
    const disputeWindowEndsAt = new Date();
    disputeWindowEndsAt.setDate(disputeWindowEndsAt.getDate() + 2);

    await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: 'completed',
          endDate: new Date(),
          payoutStatus: 'pending',
          payoutDate: payoutDate,
          disputeWindowEndsAt: disputeWindowEndsAt,
          freelancerPayout: freelancerPayout,
          platformFee: platformFee,
        },
      });

      await tx.delivery.updateMany({
        where: { contractId, status: 'pending' },
        data: { status: 'accepted' },
      });

      let freelancerWallet = await tx.wallet.findUnique({
        where: { userId: contract.freelancerId },
      });

      if (!freelancerWallet) {
        freelancerWallet = await tx.wallet.create({
          data: {
            userId: contract.freelancerId,
            balance: 0,
          },
        });
      }

      await tx.transaction.create({
        data: {
          walletId: freelancerWallet.id,
          type: 'contract_payment',
          amount: parseFloat(freelancerPayout),
          description: `Pending payout for: ${contractTitle} (after 10% platform fee) — available in 2 days`,
          status: 'pending',
        },
      });

      let platformWallet = await tx.wallet.findFirst({
        where: { user: { isAdmin: true } },
      });

      if (!platformWallet) {
        const adminUser = await tx.user.findFirst({ where: { isAdmin: true } });
        if (adminUser) {
          platformWallet = await tx.wallet.create({
            data: {
              userId: adminUser.id,
              balance: 0,
            },
          });
        }
      }

      if (platformWallet) {
        await tx.transaction.create({
          data: {
            walletId: platformWallet.id,
            type: 'commission',
            amount: parseFloat(platformFee),
            description: `Pending platform commission (10%) from: ${contractTitle}`,
            status: 'pending',
          },
        });
      }

      await tx.payment.create({
        data: {
          contractId,
          amount: contract.escrowAmount,
          status: 'completed',
          type: 'final',
        },
      });
    });

    await updateUserEarningsTier(contract.freelancerId);
    await updateUserEarningsTier(contract.buyerId);

    await prisma.notification.create({
      data: {
        userId: contract.freelancerId,
        type: 'payment_pending',
        title: 'Payment Pending',
        message: `₦${freelancerPayout.toLocaleString()} for "${contractTitle}" will be available in your wallet in 2 days.`,
        link: `/wallet`,
      },
    });

    await prisma.notification.create({
      data: {
        userId: contract.buyerId,
        type: 'delivery_confirmed',
        title: 'Delivery Confirmed',
        message: `You confirmed delivery for "${contractTitle}". Freelancer will be paid in 2 days.`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(200).json({
      message: 'Delivery confirmed. Payment will be released to freelancer in 2 days.',
      contract: await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          job: { select: { title: true } },
          freelancer: { select: { firstName: true, lastName: true } },
          buyer: { select: { firstName: true, lastName: true } },
        },
      }),
      freelancerPayout,
      platformFee,
      payoutDate,
      payoutIn: '2 days',
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    return res.status(500).json({ message: 'Failed to confirm delivery', code: 'CONFIRM_ERROR' });
  }
};

// ─── AUTO-ACCEPT DELIVERIES (CRON JOB — runs daily) ─────────────────────
const autoAcceptDeliveries = async () => {
  try {
    const now = new Date();

    const contractsToAutoAccept = await prisma.contract.findMany({
      where: {
        status: 'delivered',
        deliveries: {
          some: {
            status: 'pending',
            autoAcceptAt: { lte: now },
          },
        },
      },
      include: {
        job: true,
        freelancer: true,
        buyer: true,
        deliveries: {
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let processedCount = 0;

    for (const contract of contractsToAutoAccept) {
      try {
        const contractTitle = await getContractTitle(contract);

        const PLATFORM_COMMISSION_RATE = 0.10;
        const platformFee = contract.escrowAmount * PLATFORM_COMMISSION_RATE;
        const freelancerPayout = contract.escrowAmount - platformFee;

        const payoutDate = new Date();
        payoutDate.setDate(payoutDate.getDate() + 2);
        const disputeWindowEndsAt = new Date();
        disputeWindowEndsAt.setDate(disputeWindowEndsAt.getDate() + 2);

        await prisma.$transaction(async (tx) => {
          await tx.contract.update({
            where: { id: contract.id },
            data: {
              status: 'completed',
              endDate: now,
              payoutStatus: 'pending',
              payoutDate: payoutDate,
              disputeWindowEndsAt: disputeWindowEndsAt,
              freelancerPayout: freelancerPayout,
              platformFee: platformFee,
            },
          });

          await tx.delivery.updateMany({
            where: { contractId: contract.id, status: 'pending' },
            data: { status: 'auto_accepted' },
          });

          let freelancerWallet = await tx.wallet.findUnique({
            where: { userId: contract.freelancerId },
          });

          if (!freelancerWallet) {
            freelancerWallet = await tx.wallet.create({
              data: {
                userId: contract.freelancerId,
                balance: 0,
              },
            });
          }

          await tx.transaction.create({
            data: {
              walletId: freelancerWallet.id,
              type: 'contract_payment',
              amount: parseFloat(freelancerPayout),
              description: `Pending payout for: ${contractTitle} (after 10% platform fee) — available in 2 days`,
              status: 'pending',
            },
          });

          let platformWallet = await tx.wallet.findFirst({
            where: { user: { isAdmin: true } },
          });

          if (!platformWallet) {
            const adminUser = await tx.user.findFirst({ where: { isAdmin: true } });
            if (adminUser) {
              platformWallet = await tx.wallet.create({
                data: {
                  userId: adminUser.id,
                  balance: 0,
                },
              });
            }
          }

          if (platformWallet) {
            await tx.wallet.update({
              where: { id: platformWallet.id },
              data: { balance: { increment: parseFloat(platformFee) } },
            });

            await tx.transaction.create({
              data: {
                walletId: platformWallet.id,
                type: 'commission',
                amount: parseFloat(platformFee),
                description: `Platform commission (10%) from: ${contractTitle}`,
                status: 'completed',
              },
            });
          }

          await tx.payment.create({
            data: {
              contractId: contract.id,
              amount: contract.escrowAmount,
              status: 'completed',
              type: 'final',
            },
          });
        });

        await updateUserEarningsTier(contract.freelancerId);
        await updateUserEarningsTier(contract.buyerId);

        await prisma.notification.create({
          data: {
            userId: contract.freelancerId,
            type: 'payment_pending',
            title: 'Payment Pending (Auto-Accepted)',
            message: `₦${freelancerPayout.toLocaleString()} for "${contractTitle}" has been auto-accepted. Available in your wallet in 2 days.`,
            link: `/wallet`,
          },
        });

        await prisma.notification.create({
          data: {
            userId: contract.buyerId,
            type: 'delivery_auto_accepted',
            title: 'Delivery Auto-Accepted',
            message: `Delivery for "${contractTitle}" was auto-accepted after 2 days of no response. Freelancer will be paid in 2 days.`,
            link: `/contracts/${contract.id}`,
          },
        });

        processedCount++;
      } catch (innerError) {
        console.error(`Failed to auto-accept delivery for contract ${contract.id}:`, innerError);
      }
    }

    console.log(`Auto-accepted ${processedCount} deliveries`);
    return processedCount;
  } catch (error) {
    console.error('Auto-accept deliveries error:', error);
    return 0;
  }
};

// ─── REQUEST REVISION (BUYER) ────────────────────────────────────────────
const requestRevision = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { feedback } = req.body;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { job: true, freelancer: true, buyer: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the buyer can request revision', code: 'UNAUTHORIZED' });
    }

    if (contract.status !== 'delivered') {
      return res.status(400).json({ message: 'Contract must be delivered first', code: 'INVALID_STATUS' });
    }

    // NULL-safe: treat null/undefined revisionsTotal as 6 (default)
    const revisionsTotal = parseInt(contract.revisionsTotal) || 6;
    const revisionsUsed = parseInt(contract.revisionsUsed) || 0;

    console.log(`[Revision] Contract ${contractId}: revisionsUsed=${revisionsUsed}, revisionsTotal=${revisionsTotal}, status=${contract.status}`);

    if (revisionsUsed >= revisionsTotal) {
      console.log(`[Revision] BLOCKED: ${revisionsUsed} >= ${revisionsTotal}`);
      return res.status(400).json({ message: 'Maximum revisions reached', code: 'MAX_REVISIONS' });
    }

    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'revision_requested',
        revisionsUsed: { increment: 1 },
        revisionFeedback: feedback || null,
      },
    });

    console.log(`[Revision] SUCCESS: Contract ${contractId} updated to revisionsUsed=${updatedContract.revisionsUsed}`);

    await prisma.delivery.updateMany({
      where: { contractId, status: 'pending' },
      data: { status: 'rejected' },
    });

    const contractTitle = await getContractTitle(contract);

    await prisma.notification.create({
      data: {
        userId: contract.freelancerId,
        type: 'revision_requested',
        title: 'Revision Requested',
        message: `Buyer requested revision for "${contractTitle}". Feedback: ${feedback || 'No feedback provided'}`,
        link: `/contracts/${contract.id}`,
      },
    });

    const revisionsLeft = revisionsTotal - updatedContract.revisionsUsed;

    return res.status(200).json({
      message: 'Revision requested successfully',
      revisionsLeft: revisionsLeft,
      revisionsUsed: updatedContract.revisionsUsed,
      revisionsTotal: revisionsTotal,
    });
  } catch (error) {
    console.error('Request revision error:', error);
    return res.status(500).json({ message: 'Failed to request revision', code: 'REVISION_ERROR' });
  }
};

// ─── COMPLETE CONTRACT (LEGACY — redirects to confirmDelivery) ───────────
const completeContract = async (req, res) => {
  return confirmDelivery(req, res);
};

// ─── CANCEL CONTRACT & REFUND BUYER ────────────────────────────────────
const cancelContract = async (req, res) => {
  try {
    const { contractId } = req.params;

    const reason = req.body?.reason || null;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { job: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id && contract.freelancerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    if (contract.status === 'completed' || contract.status === 'cancelled') {
      return res.status(400).json({ message: 'Contract already finalized', code: 'ALREADY_FINALIZED' });
    }

    const contractTitle = await getContractTitle(contract);

    if (contract.status === 'active' && parseFloat(contract.escrowAmount) > 0) {
      await prisma.$transaction(async (tx) => {
        let buyerWallet = await tx.wallet.findUnique({
          where: { userId: contract.buyerId },
        });

        if (buyerWallet) {
          await tx.wallet.update({
            where: { userId: contract.buyerId },
            data: { balance: { increment: parseFloat(contract.escrowAmount) } },
          });
        } else {
          buyerWallet = await tx.wallet.create({
            data: {
              userId: contract.buyerId,
              balance: contract.escrowAmount,
            },
          });
        }

        await tx.transaction.create({
          data: {
            walletId: buyerWallet.id,
            type: 'refund',
            amount: contract.escrowAmount,
            description: `Refund for cancelled contract: ${contractTitle}`,
            status: 'completed',
          },
        });
      });
    }

    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'cancelled',
        endDate: new Date(),
        escrowAmount: 0,
        payoutStatus: null,
        payoutDate: null,
      },
    });

    const otherPartyId = contract.buyerId === req.user.id ? contract.freelancerId : contract.buyerId;

    await prisma.notification.create({
      data: {
        userId: otherPartyId,
        type: 'contract_cancelled',
        title: 'Contract Cancelled',
        message: `Contract cancelled. Reason: ${reason || 'No reason provided'}`,
        link: `/contracts/${contractId}`,
      },
    });

    return res.status(200).json({
      message: 'Contract cancelled. Buyer refunded if payment was made.',
      contract: updatedContract,
    });
  } catch (error) {
    console.error('Cancel contract error:', error);
    return res.status(500).json({ message: 'Failed to cancel contract', code: 'CANCEL_ERROR' });
  }
};

// ─── FILE DISPUTE (BUYER OR FREELANCER) ─────────────────────────────────
const fileDispute = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { reason } = req.body;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { job: true, buyer: true, freelancer: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id && contract.freelancerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const now = new Date();
    const canDispute = ['active', 'delivered', 'revision_requested', 'completed'].includes(contract.status);
    const isInDisputeWindow = contract.status === 'completed' && 
      contract.disputeWindowEndsAt && new Date(contract.disputeWindowEndsAt) > now;

    if (!canDispute && !isInDisputeWindow) {
      return res.status(400).json({ message: 'Cannot dispute this contract at this stage', code: 'INVALID_STATUS' });
    }

    const existingDispute = await prisma.dispute.findFirst({
      where: { contractId },
    });

    if (existingDispute) {
      return res.status(409).json({ message: 'A dispute already exists for this contract', code: 'DISPUTE_EXISTS' });
    }

    const evidence = [];
    const evidenceMeta = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        evidence.push(file.path);
        evidenceMeta.push({
          url: file.path,
          name: file.originalname || file.filename || 'Untitled',
          type: file.mimetype || 'application/octet-stream',
          size: file.size || 0,
        });
      }
    }

    const dispute = await prisma.dispute.create({
      data: {
        contractId,
        filedById: req.user.id,
        reason,
        evidence,
        evidenceMeta: evidenceMeta.length > 0 ? evidenceMeta : undefined,
        status: 'open',
        filedDuringWindow: isInDisputeWindow,
      },
      include: {
        filedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        contract: {
          include: {
            buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
          },
        },
      },
    });

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'disputed',
        payoutStatus: 'pending',
      },
    });

    const contractTitle = await getContractTitle(contract);

    const otherPartyId = contract.buyerId === req.user.id ? contract.freelancerId : contract.buyerId;

    await prisma.notification.create({
      data: {
        userId: otherPartyId,
        type: 'dispute_filed',
        title: 'Dispute Filed',
        message: `A dispute has been filed for "${contractTitle}". Admin will review.`,
        link: `/contracts/${contract.id}`,
      },
    });

    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true, email: true, firstName: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'new_dispute',
          title: 'New Dispute',
          message: `Dispute filed for contract "${contractTitle}" by ${req.user.firstName || 'User'}`,
          link: `/admin/disputes`,
        },
      });
    }

    try {
      const { sendDisputeFiledEmail } = require('../utils/email');
      const otherParty = contract.buyerId === req.user.id ? contract.freelancer : contract.buyer;

      await sendDisputeFiledEmail({
        to: otherParty.email,
        firstName: otherParty.firstName,
        contractTitle,
        filedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        isFiledByBuyer: contract.buyerId === req.user.id,
        disputeId: dispute.id,
      });

      for (const admin of admins) {
        await sendDisputeFiledEmail({
          to: admin.email,
          firstName: admin.firstName,
          contractTitle,
          filedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
          isFiledByBuyer: contract.buyerId === req.user.id,
          disputeId: dispute.id,
          isAdmin: true,
        });
      }
    } catch (emailErr) {
      console.error('Dispute email error:', emailErr);
    }

    return res.status(201).json({
      message: 'Dispute filed successfully. Admin will review.',
      dispute,
    });
  } catch (error) {
    console.error('File dispute error:', error);
    return res.status(500).json({ message: 'Failed to file dispute', code: 'DISPUTE_ERROR' });
  }
};

// ─── GET CONTRACTS ─────────────────────────────────────────────────────
const getMyContracts = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where = {
      OR: [
        { buyerId: req.user.id },
        { freelancerId: req.user.id },
      ],
    };

    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          job: { select: { id: true, title: true } },
          buyer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          freelancer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          payments: { select: { id: true, status: true, amount: true } },
          deliveries: { select: { id: true, status: true, createdAt: true, autoAcceptAt: true } },
          dispute: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.count({ where }),
    ]);

    return res.status(200).json({
      contracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get contracts error:', error);
    return res.status(500).json({ message: 'Failed to fetch contracts', code: 'FETCH_ERROR' });
  }
};

const getContractById = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        job: true,
        proposal: true,
        buyer: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        freelancer: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        payments: true,
        reviews: true,
        offers: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
        },
        dispute: true,
      },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id && contract.freelancerId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const transformedDeliveries = contract.deliveries.map(delivery => {
      if (delivery.fileMeta && Array.isArray(delivery.fileMeta) && delivery.fileMeta.length > 0) {
        return {
          ...delivery,
          files: delivery.fileMeta,
        };
      }

      if (delivery.files && delivery.files.length > 0) {
        return {
          ...delivery,
          files: delivery.files.map(url => ({
            url: url,
            name: url.split('/').pop() || 'File',
            type: 'application/octet-stream',
            size: null,
          })),
        };
      }

      return {
        ...delivery,
        files: [],
      };
    });

    const now = new Date();
    let countdown = null;
    let isOverdue = false;

    let targetDate = contract.deadline || contract.dueDate || null;

    if (!targetDate && contract.startDate && contract.duration) {
      const calculatedDeadline = new Date(contract.startDate);
      calculatedDeadline.setDate(calculatedDeadline.getDate() + parseInt(contract.duration));
      targetDate = calculatedDeadline;
    }

    if (targetDate && (contract.status === 'active' || contract.status === 'revision_requested' || contract.status === 'pending_payment')) {
      const dueTime = new Date(targetDate).getTime();
      const nowTime = now.getTime();
      const diff = dueTime - nowTime;

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        countdown = { days, hours, minutes, seconds, totalMs: diff };
      } else {
        isOverdue = true;
      }
    }

    let payoutCountdown = null;
    if (contract.status === 'completed' && contract.payoutStatus === 'pending' && contract.payoutDate) {
      const payoutTime = new Date(contract.payoutDate).getTime();
      const nowTime = now.getTime();
      const diff = payoutTime - nowTime;

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        payoutCountdown = { days, hours, minutes, totalMs: diff };
      }
    }

    let disputeWindowCountdown = null;
    if (contract.status === 'completed' && contract.disputeWindowEndsAt) {
      const windowTime = new Date(contract.disputeWindowEndsAt).getTime();
      const nowTime = now.getTime();
      const diff = windowTime - nowTime;

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        disputeWindowCountdown = { days, hours, minutes, totalMs: diff };
      }
    }

    let autoAcceptCountdown = null;
    if (contract.status === 'delivered') {
      const pendingDelivery = contract.deliveries.find(d => d.status === 'pending');
      if (pendingDelivery && pendingDelivery.autoAcceptAt) {
        const autoAcceptTime = new Date(pendingDelivery.autoAcceptAt).getTime();
        const nowTime = now.getTime();
        const diff = autoAcceptTime - nowTime;

        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          autoAcceptCountdown = { days, hours, minutes, totalMs: diff };
        }
      }
    }

    // NULL-safe: ensure revisionsTotal and revisionsUsed are never null in response
    const responseContract = {
      ...contract,
      deliveries: transformedDeliveries,
      deadline: targetDate,
      duration: contract.duration || contract.proposal?.proposedDuration || contract.proposal?.duration || 0,
      revisionsTotal: parseInt(contract.revisionsTotal) || parseInt(contract.proposal?.revisions) || parseInt(contract.maxRevisions) || 6,
      revisionsUsed: parseInt(contract.revisionsUsed) || parseInt(contract.revisionCount) || 0,
    };

    return res.status(200).json({
      contract: responseContract,
      countdown,
      isOverdue,
      payoutCountdown,
      disputeWindowCountdown,
      autoAcceptCountdown,
      isBuyer: contract.buyerId === req.user.id,
      isFreelancer: contract.freelancerId === req.user.id,
    });
  } catch (error) {
    console.error('Get contract error:', error);
    return res.status(500).json({ message: 'Failed to fetch contract', code: 'FETCH_ERROR' });
  }
};

// ─── AUTO-CANCEL OVERDUE CONTRACTS (CRON JOB — runs daily) ────────────────
const autoCancelOverdueContracts = async () => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const overdueContracts = await prisma.contract.findMany({
      where: {
        status: { in: ['active', 'revision_requested'] },
        deadline: { lt: oneDayAgo },
      },
      include: {
        job: true,
        buyer: true,
        freelancer: true,
      },
    });

    let cancelledCount = 0;

    for (const contract of overdueContracts) {
      try {
        const contractTitle = await getContractTitle(contract);

        await prisma.$transaction(async (tx) => {
          if (parseFloat(contract.escrowAmount) > 0) {
            let buyerWallet = await tx.wallet.findUnique({
              where: { userId: contract.buyerId },
            });

            if (buyerWallet) {
              await tx.wallet.update({
                where: { userId: contract.buyerId },
                data: { balance: { increment: parseFloat(contract.escrowAmount) } },
              });
            } else {
              buyerWallet = await tx.wallet.create({
                data: {
                  userId: contract.buyerId,
                  balance: contract.escrowAmount,
                },
              });
            }

            await tx.transaction.create({
              data: {
                walletId: buyerWallet.id,
                type: 'refund',
                amount: contract.escrowAmount,
                description: `Auto-refund for overdue contract: ${contractTitle}`,
                status: 'completed',
              },
            });
          }

          await tx.contract.update({
            where: { id: contract.id },
            data: {
              status: 'auto_cancelled',
              endDate: now,
              escrowAmount: 0,
              payoutStatus: null,
              payoutDate: null,
            },
          });
        });

        await prisma.notification.create({
          data: {
            userId: contract.freelancerId,
            type: 'contract_auto_cancelled',
            title: 'Contract Auto-Cancelled',
            message: `Contract "${contractTitle}" was auto-cancelled after 1 day past deadline. Buyer refunded.`,
            link: `/contracts/${contract.id}`,
          },
        });

        await prisma.notification.create({
          data: {
            userId: contract.buyerId,
            type: 'contract_auto_cancelled',
            title: 'Contract Auto-Cancelled',
            message: `Contract "${contractTitle}" was auto-cancelled after 1 day past deadline. You have been refunded.`,
            link: `/contracts/${contract.id}`,
          },
        });

        cancelledCount++;
      } catch (innerError) {
        console.error(`Failed to auto-cancel contract ${contract.id}:`, innerError);
      }
    }

    console.log(`Auto-cancelled ${cancelledCount} overdue contracts`);
    return cancelledCount;
  } catch (error) {
    console.error('Auto-cancel error:', error);
    return 0;
  }
};

// ─── PROCESS MATURED PAYOUTS (CRON JOB — runs daily) ────────────────────
const processMaturedPayouts = async () => {
  try {
    const now = new Date();

    const maturedContracts = await prisma.contract.findMany({
      where: {
        status: 'completed',
        payoutStatus: 'pending',
        payoutDate: { lte: now },
      },
      include: {
        job: true,
        freelancer: true,
        buyer: true,
      },
    });

    let processedCount = 0;

    for (const contract of maturedContracts) {
      try {
        const contractTitle = await getContractTitle(contract);

        await prisma.$transaction(async (tx) => {
          await tx.contract.update({
            where: { id: contract.id },
            data: {
              payoutStatus: 'released',
              escrowAmount: 0,
            },
          });

          let freelancerWallet = await tx.wallet.findUnique({
            where: { userId: contract.freelancerId },
          });

          if (freelancerWallet) {
            await tx.wallet.update({
              where: { userId: contract.freelancerId },
              data: { balance: { increment: contract.freelancerPayout || 0 } },
            });
          } else {
            freelancerWallet = await tx.wallet.create({
              data: {
                userId: contract.freelancerId,
                balance: contract.freelancerPayout || 0,
              },
            });
          }

          await tx.transaction.updateMany({
            where: {
              walletId: freelancerWallet.id,
              type: 'contract_payment',
              status: 'pending',
              description: { contains: contractTitle },
            },
            data: {
              status: 'completed',
              description: `Payment for: ${contractTitle} (after 10% platform fee)`,
            },
          });

          let platformWallet = await tx.wallet.findFirst({
            where: { user: { isAdmin: true } },
          });

          if (!platformWallet) {
            const adminUser = await tx.user.findFirst({ where: { isAdmin: true } });
            if (adminUser) {
              platformWallet = await tx.wallet.create({
                data: {
                  userId: adminUser.id,
                  balance: 0,
                },
              });
            }
          }

          if (platformWallet) {
            await tx.wallet.update({
              where: { id: platformWallet.id },
              data: { balance: { increment: contract.platformFee || 0 } },
            });

            await tx.transaction.updateMany({
              where: {
                walletId: platformWallet.id,
                type: 'commission',
                status: 'pending',
                description: { contains: contractTitle },
              },
              data: {
                status: 'completed',
                description: `Platform commission (10%) from: ${contractTitle}`,
              },
            });
          }
        });

        await prisma.notification.create({
          data: {
            userId: contract.freelancerId,
            type: 'payment_received',
            title: 'Payment Received',
            message: `₦${(contract.freelancerPayout || 0).toLocaleString()} has been credited to your wallet for "${contractTitle}".`,
            link: `/wallet`,
          },
        });

        processedCount++;
      } catch (innerError) {
        console.error(`Failed to process payout for contract ${contract.id}:`, innerError);
      }
    }

    console.log(`Processed ${processedCount} matured payouts`);
    return processedCount;
  } catch (error) {
    console.error('Process matured payouts error:', error);
    return 0;
  }
};

// ─── REQUEST EXTENSION (FREELANCER) ─────────────────────────────────────
const requestExtension = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { days, reason } = req.body;

    if (!days || days < 1 || days > 30) {
      return res.status(400).json({ message: 'Extension days must be between 1 and 30', code: 'INVALID_DAYS' });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { job: true, buyer: true, freelancer: true, extensionRequests: { where: { status: 'pending' } } },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.freelancerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the freelancer can request an extension', code: 'UNAUTHORIZED' });
    }

    if (contract.status !== 'active' && contract.status !== 'revision_requested') {
      return res.status(400).json({ message: 'Extension can only be requested for active contracts', code: 'INVALID_STATUS' });
    }

    if (contract.extensionRequests.length > 0) {
      return res.status(409).json({ message: 'You already have a pending extension request', code: 'PENDING_EXISTS' });
    }

    const contractTitle = await getContractTitle(contract);

    const extension = await prisma.extensionRequest.create({
      data: {
        contractId,
        requestedBy: req.user.id,
        days: parseInt(days),
        reason: reason || null,
        status: 'pending',
      },
    });

    await prisma.notification.create({
      data: {
        userId: contract.buyerId,
        type: 'extension_requested',
        title: 'Extension Requested',
        message: `${contract.freelancer.firstName} requested a ${days}-day extension for "${contractTitle}"${reason ? `: ${reason}` : ''}`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(201).json({
      message: 'Extension request sent to client for approval',
      extension,
    });
  } catch (error) {
    console.error('Request extension error:', error);
    return res.status(500).json({ message: 'Failed to request extension', code: 'EXTENSION_ERROR' });
  }
};

// ─── APPROVE/REJECT EXTENSION (BUYER) ───────────────────────────────────
const approveExtension = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { action } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "approve" or "reject"', code: 'INVALID_ACTION' });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        job: true,
        buyer: true,
        freelancer: true,
        extensionRequests: { where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found', code: 'CONTRACT_NOT_FOUND' });
    }

    if (contract.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Only the buyer can approve extensions', code: 'UNAUTHORIZED' });
    }

    if (contract.extensionRequests.length === 0) {
      return res.status(404).json({ message: 'No pending extension request found', code: 'NO_PENDING_EXTENSION' });
    }

    const extension = contract.extensionRequests[0];
    const contractTitle = await getContractTitle(contract);

    if (action === 'approve') {
      const currentDeadline = contract.deadline || contract.dueDate || new Date();
      const newDeadline = new Date(currentDeadline);
      newDeadline.setDate(newDeadline.getDate() + extension.days);

      let newGraceEndDate = contract.graceEndDate;
      if (newGraceEndDate) {
        newGraceEndDate = new Date(newGraceEndDate);
        newGraceEndDate.setDate(newGraceEndDate.getDate() + extension.days);
      }

      await prisma.$transaction([
        prisma.extensionRequest.update({
          where: { id: extension.id },
          data: { status: 'approved', approvedAt: new Date() },
        }),
        prisma.contract.update({
          where: { id: contractId },
          data: {
            deadline: newDeadline,
            dueDate: newDeadline,
            graceEndDate: newGraceEndDate,
            duration: { increment: extension.days },
          },
        }),
      ]);

      await prisma.notification.create({
        data: {
          userId: contract.freelancerId,
          type: 'extension_approved',
          title: 'Extension Approved',
          message: `Your ${extension.days}-day extension for "${contractTitle}" has been approved. New deadline: ${newDeadline.toLocaleDateString('en-NG')}`,
          link: `/contracts/${contract.id}`,
        },
      });

      return res.status(200).json({
        message: `Extension approved. Deadline extended by ${extension.days} days.`,
        newDeadline,
        extension,
      });
    } else {
      await prisma.extensionRequest.update({
        where: { id: extension.id },
        data: { status: 'rejected' },
      });

      await prisma.notification.create({
        data: {
          userId: contract.freelancerId,
          type: 'extension_rejected',
          title: 'Extension Rejected',
          message: `Your extension request for "${contractTitle}" was rejected by the client.`,
          link: `/contracts/${contract.id}`,
        },
      });

      return res.status(200).json({
        message: 'Extension request rejected',
        extension: await prisma.extensionRequest.findUnique({ where: { id: extension.id } }),
      });
    }
  } catch (error) {
    console.error('Approve extension error:', error);
    return res.status(500).json({ message: 'Failed to process extension', code: 'EXTENSION_ERROR' });
  }
};

// ─── GET PENDING EXTENSION ──────────────────────────────────────────────
const getPendingExtension = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { buyerId: true, freelancerId: true },
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.buyerId !== userId && contract.freelancerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const extension = await prisma.extensionRequest.findFirst({
      where: {
        contractId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ extension });
  } catch (error) {
    console.error('Get pending extension error:', error);
    res.status(500).json({ message: 'Failed to fetch extension' });
  }
};

module.exports = {
  createContract,
  createDirectHireContract,
  initiateContractPayment,
  verifyContractPayment,
  submitDelivery,
  confirmDelivery,
  autoAcceptDeliveries,
  requestRevision,
  completeContract,
  cancelContract,
  fileDispute,
  getMyContracts,
  getContractById,
  autoCancelOverdueContracts,
  processMaturedPayouts,
  requestExtension,
  approveExtension,
  getPendingExtension,
};