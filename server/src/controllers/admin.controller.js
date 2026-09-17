const { prisma } = require('../config/database');

// ─── PLATFORM FEE CONFIG ─────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 10;       // 10% on normal completed orders
const DISPUTE_BUYER_WINS_FEE = 5;    // 5% when dispute filed & buyer wins
const DISPUTE_FREELANCER_WINS_FEE = 10; // 10% when dispute filed & freelancer wins

// ─── GET DASHBOARD STATS ─────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisMonth,
      totalJobs,
      activeJobs,
      totalContracts,
      activeContracts,
      completedContracts,
      totalRevenue,
      revenueThisMonth,
      totalProposals,
      pendingVerifications,
      suspendedUsers,
      recentTransactions,
      pendingDisputes,
      totalDisputes,
      platformWallet,
      totalEscrowHeld,
      pendingWithdrawals,
      totalWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.job.count(),
      prisma.job.count({ where: { status: 'open' } }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'active' } }),
      prisma.contract.count({ where: { status: 'completed' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'escrow_release', status: 'completed' } }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'escrow_release', status: 'completed', createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.proposal.count(),
      prisma.user.count({ where: { kycStatus: 'PENDING', isAdmin: false } }),
      prisma.user.count({ where: { isSuspended: true } }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          wallet: {
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      prisma.dispute.count({ where: { status: 'pending' } }),
      prisma.dispute.count(),
      prisma.wallet.findUnique({ where: { id: 'platform' } }).catch(() => null),
      prisma.contract.aggregate({ _sum: { escrowAmount: true }, where: { status: 'active' } }),
      prisma.transaction.count({ where: { type: 'withdrawal', status: 'pending' } }),
      prisma.transaction.count({ where: { type: 'withdrawal' } }),
    ]);

    const platformEarnings = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'platform_fee', status: 'completed' },
    });

    return res.status(200).json({
      stats: {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
          pendingVerifications,
          suspended: suspendedUsers,
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
        },
        contracts: {
          total: totalContracts,
          active: activeContracts,
          completed: completedContracts,
        },
        revenue: {
          total: totalRevenue._sum.amount || 0,
          thisMonth: revenueThisMonth._sum.amount || 0,
          platformEarnings: platformEarnings._sum.amount || 0,
        },
        proposals: {
          total: totalProposals,
        },
        disputes: {
          pending: pendingDisputes,
          total: totalDisputes,
        },
        escrow: {
          totalHeld: totalEscrowHeld._sum.escrowAmount || 0,
        },
        withdrawals: {
          pending: pendingWithdrawals,
          total: totalWithdrawals,
        },
        platformWallet: platformWallet || { balance: 0 },
      },
      recentTransactions,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch stats', code: 'STATS_ERROR' });
  }
};

// ─── GET ALL USERS ───────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { search, status, role, page = 1, limit = 20 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'verified') where.isVerified = true;
    if (status === 'unverified') where.isVerified = false;
    if (status === 'suspended') where.isSuspended = true;
    if (status === 'kyc_pending') where.kycStatus = 'PENDING';

    if (role === 'freelancer') where.isFreelancer = true;
    if (role === 'buyer') where.isBuyer = true;
    if (role === 'admin') where.isAdmin = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          isSuspended: true,
          isAdmin: true,
          isFreelancer: true,
          isBuyer: true,
          kycStatus: true,
          createdAt: true,
          wallet: {
            select: {
              balance: true,
            },
          },
          _count: {
            select: {
              jobsPosted: true,
              contracts: true,
              proposals: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ message: 'Failed to fetch users', code: 'FETCH_ERROR' });
  }
};

// ─── GET USER DETAILS ────────────────────────────────────────────────────
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: {
                wallet: { select: { user: { select: { firstName: true, lastName: true } } } },
              },
            }
          }
        },
        jobsPosted: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            proposals: { select: { id: true, status: true } },
            contracts: { select: { id: true, status: true, amount: true } },
          },
        },
        contracts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            job: { select: { title: true } },
            freelancer: { select: { firstName: true, lastName: true } },
            buyer: { select: { firstName: true, lastName: true } },
          },
        },
        proposals: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            job: { select: { title: true } },
          },
        },
       documentVerification: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get user details error:', error);
    return res.status(500).json({ message: 'Failed to fetch user', code: 'FETCH_ERROR' });
  }
};

// ─── SUSPEND USER ────────────────────────────────────────────────────────
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.isAdmin) {
      return res.status(403).json({ message: 'Cannot suspend admin', code: 'CANNOT_SUSPEND_ADMIN' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isSuspended: true },
      });

      await tx.session.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'account_suspended',
        title: 'Account Suspended',
        message: `Your account has been suspended. Reason: ${reason || 'Violation of terms'}`,
        link: '/support',
      },
    });

    return res.status(200).json({ message: 'User suspended successfully' });
  } catch (error) {
    console.error('Suspend user error:', error);
    return res.status(500).json({ message: 'Failed to suspend user', code: 'SUSPEND_ERROR' });
  }
};

// ─── UNSUSPEND USER ──────────────────────────────────────────────────────
const unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'account_restored',
        title: 'Account Restored',
        message: 'Your account has been restored. Welcome back!',
        link: '/',
      },
    });

    return res.status(200).json({ message: 'User unsuspended successfully' });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    return res.status(500).json({ message: 'Failed to unsuspend user', code: 'UNSUSPEND_ERROR' });
  }
};

// ─── VERIFY USER KYC ─────────────────────────────────────────────────────
const verifyUserKyc = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: 'VERIFIED', isVerified: true },
      });

       await tx.documentVerification.updateMany({
        where: { userId },
        data: { status: 'APPROVED', reviewNote: 'Verified by admin' },
      });
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'kyc_verified',
        title: 'KYC Verified',
        message: 'Your KYC verification is complete. You can now use all platform features.',
        link: '/profile',
      },
    });

    return res.status(200).json({ message: 'KYC verified successfully' });
  } catch (error) {
    console.error('KYC verify error:', error);
    return res.status(500).json({ message: 'Failed to verify KYC', code: 'KYC_ERROR' });
  }
};

// ─── REJECT KYC ──────────────────────────────────────────────────────────
const rejectKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: 'REJECTED' },
      });

      await tx.documentVerification.updateMany({
        where: { userId },
        data: { status: 'REJECTED', reviewNote: reason || 'Documents did not meet requirements' },
      });
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'kyc_rejected',
        title: 'KYC Rejected',
        message: `Your KYC was rejected. Reason: ${reason || 'Documents did not meet requirements'}. Please resubmit.`,
        link: '/profile/kyc',
      },
    });

    return res.status(200).json({ message: 'KYC rejected successfully' });
  } catch (error) {
    console.error('KYC reject error:', error);
    return res.status(500).json({ message: 'Failed to reject KYC', code: 'KYC_ERROR' });
  }
};

// ─── GET ALL JOBS ────────────────────────────────────────────────────────
const getAllJobs = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
          proposals: { select: { id: true, status: true } },
          contracts: { select: { id: true, status: true, amount: true } },
          _count: {
            select: {
              proposals: true,
              contracts: true,
            },
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
    console.error('Get all jobs error:', error);
    return res.status(500).json({ message: 'Failed to fetch jobs', code: 'FETCH_ERROR' });
  }
};

// ─── GET ALL TRANSACTIONS ────────────────────────────────────────────────
const getAllTransactions = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return res.status(200).json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all transactions error:', error);
    return res.status(500).json({ message: 'Failed to fetch transactions', code: 'FETCH_ERROR' });
  }
};

// ─── GET DISPUTES ────────────────────────────────────────────────────────
const getDisputes = async (req, res) => {
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
            select: {
              id: true,
              amount: true,
              escrowAmount: true,
              status: true,
              buyerId: true,
              freelancerId: true,
              job: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  budget: true,
                },
              },
              buyer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                },
              },
              freelancer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          },
          filedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
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

// ─── GET SINGLE DISPUTE DETAILS ──────────────────────────────────────────
const getDisputeById = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        contract: {
          select: {
            id: true,
            amount: true,
            escrowAmount: true,
            status: true,
            buyerId: true,
            freelancerId: true,
            job: {
              select: {
                id: true,
                title: true,
                description: true,
                budget: true,
              },
            },
            buyer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
            freelancer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
            payments: true,
            deliveries: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: {
                sender: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
        filedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found', code: 'DISPUTE_NOT_FOUND' });
    }

    return res.status(200).json({ dispute });
  } catch (error) {
    console.error('Get dispute error:', error);
    return res.status(500).json({ message: 'Failed to fetch dispute', code: 'FETCH_ERROR' });
  }
};

// ─── RESOLVE DISPUTE (ADMIN) ─────────────────────────────────────────────
const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolution, adminNotes, refundAmount } = req.body;

    const dispute = await prisma.dispute.findFirst({
      where: { id: disputeId },
      include: {
        contract: {
          include: {
            job: true,
            buyer: true,
            freelancer: true,
            payments: true,
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found', code: 'DISPUTE_NOT_FOUND' });
    }

    if (dispute.status !== 'pending') {
      return res.status(400).json({ message: 'Dispute already resolved', code: 'ALREADY_RESOLVED' });
    }

    const contract = dispute.contract;
    const contractTitle = contract.job?.title || contract.title || 'Untitled Contract';
    const escrowAmount = contract.escrowAmount || 0;

    if (escrowAmount <= 0) {
      return res.status(400).json({ message: 'No escrow funds available', code: 'NO_ESCROW' });
    }

    let feePercent;
    if (resolution === 'buyer_wins') {
      feePercent = DISPUTE_BUYER_WINS_FEE;
    } else {
      feePercent = DISPUTE_FREELANCER_WINS_FEE;
    }

    const platformFee = Math.round(escrowAmount * (feePercent / 100));
    const distributableAmount = escrowAmount - platformFee;

    await prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: 'resolved',
          resolution,
          adminNotes: adminNotes || null,
          resolvedAt: new Date(),
          resolvedById: req.user.id,
        },
      });

      if (platformFee > 0) {
        let platformWallet = await tx.wallet.findUnique({
          where: { id: 'platform' },
        });

        if (platformWallet) {
          await tx.wallet.update({
            where: { id: 'platform' },
            data: { balance: { increment: platformFee } },
          });
        } else {
          platformWallet = await tx.wallet.create({
            data: {
              id: 'platform',
              userId: null,
              balance: platformFee,
            },
          });
        }

        await tx.transaction.create({
          data: {
            walletId: platformWallet.id,
            type: 'platform_fee',
            amount: platformFee,
            description: `Platform fee (${feePercent}%) from dispute: ${contractTitle}`,
            status: 'completed',
          },
        });
      }

      await tx.contract.update({
        where: { id: contract.id },
        data: { escrowAmount: 0 },
      });

      if (resolution === 'buyer_wins') {
        let buyerWallet = await tx.wallet.findUnique({
          where: { userId: contract.buyerId },
        });

        if (buyerWallet) {
          await tx.wallet.update({
            where: { userId: contract.buyerId },
            data: { balance: { increment: distributableAmount } },
          });
        } else {
          buyerWallet = await tx.wallet.create({
            data: {
              userId: contract.buyerId,
              balance: distributableAmount,
            },
          });
        }

        await tx.transaction.create({
          data: {
            walletId: buyerWallet.id,
            type: 'refund',
            amount: distributableAmount,
            description: `Dispute refund: ${contractTitle} (Freelancer found at fault)`,
            status: 'completed',
          },
        });

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: 'cancelled',
            endDate: new Date(),
          },
        });
      } else if (resolution === 'freelancer_wins') {
        let freelancerWallet = await tx.wallet.findUnique({
          where: { userId: contract.freelancerId },
        });

        if (freelancerWallet) {
          await tx.wallet.update({
            where: { userId: contract.freelancerId },
            data: { balance: { increment: distributableAmount } },
          });
        } else {
          freelancerWallet = await tx.wallet.create({
            data: {
              userId: contract.freelancerId,
              balance: distributableAmount,
            },
          });
        }

        await tx.transaction.create({
          data: {
            walletId: freelancerWallet.id,
            type: 'contract_payment',
            amount: distributableAmount,
            description: `Dispute payment: ${contractTitle} (Buyer found at fault)`,
            status: 'completed',
          },
        });

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: 'completed',
            endDate: new Date(),
          },
        });
      } else if (resolution === 'split') {
        const halfAmount = Math.floor(distributableAmount / 2);
        const remainder = distributableAmount - (halfAmount * 2);

        let buyerWallet = await tx.wallet.findUnique({
          where: { userId: contract.buyerId },
        });

        if (buyerWallet) {
          await tx.wallet.update({
            where: { userId: contract.buyerId },
            data: { balance: { increment: halfAmount + remainder } },
          });
        } else {
          buyerWallet = await tx.wallet.create({
            data: {
              userId: contract.buyerId,
              balance: halfAmount + remainder,
            },
          });
        }

        let freelancerWallet = await tx.wallet.findUnique({
          where: { userId: contract.freelancerId },
        });

        if (freelancerWallet) {
          await tx.wallet.update({
            where: { userId: contract.freelancerId },
            data: { balance: { increment: halfAmount } },
          });
        } else {
          freelancerWallet = await tx.wallet.create({
            data: {
              userId: contract.freelancerId,
              balance: halfAmount,
            },
          });
        }

        await tx.transaction.create({
          data: {
            walletId: buyerWallet.id,
            type: 'refund',
            amount: halfAmount + remainder,
            description: `Dispute split refund: ${contractTitle}`,
            status: 'completed',
          },
        });

        await tx.transaction.create({
          data: {
            walletId: freelancerWallet.id,
            type: 'contract_payment',
            amount: halfAmount,
            description: `Dispute split payment: ${contractTitle}`,
            status: 'completed',
          },
        });

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: 'cancelled',
            endDate: new Date(),
          },
        });
      } else if (resolution === 'custom') {
        const customRefund = Math.min(Math.max(0, refundAmount || 0), distributableAmount);
        const freelancerGets = distributableAmount - customRefund;

        if (customRefund > 0) {
          let buyerWallet = await tx.wallet.findUnique({
            where: { userId: contract.buyerId },
          });

          if (buyerWallet) {
            await tx.wallet.update({
              where: { userId: contract.buyerId },
              data: { balance: { increment: customRefund } },
            });
          } else {
            buyerWallet = await tx.wallet.create({
              data: {
                userId: contract.buyerId,
                balance: customRefund,
              },
            });
          }

          await tx.transaction.create({
            data: {
              walletId: buyerWallet.id,
              type: 'refund',
              amount: customRefund,
              description: `Custom dispute refund: ${contractTitle}`,
              status: 'completed',
            },
          });
        }

        if (freelancerGets > 0) {
          let freelancerWallet = await tx.wallet.findUnique({
            where: { userId: contract.freelancerId },
          });

          if (freelancerWallet) {
            await tx.wallet.update({
              where: { userId: contract.freelancerId },
              data: { balance: { increment: freelancerGets } },
            });
          } else {
            freelancerWallet = await tx.wallet.create({
              data: {
                userId: contract.freelancerId,
                balance: freelancerGets,
              },
            });
          }

          await tx.transaction.create({
            data: {
              walletId: freelancerWallet.id,
              type: 'contract_payment',
              amount: freelancerGets,
              description: `Custom dispute payment: ${contractTitle}`,
              status: 'completed',
            },
          });
        }

        await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: 'cancelled',
            endDate: new Date(),
          },
        });
      }
    });

    await prisma.notification.create({
      data: {
        userId: contract.buyerId,
        type: 'dispute_resolved',
        title: 'Dispute Resolved',
        message: `Dispute for "${contractTitle}" resolved. ${resolution === 'buyer_wins' ? 'You have been refunded.' : resolution === 'freelancer_wins' ? 'Payment released to freelancer.' : 'Payment was split between both parties.'}`,
        link: `/contracts/${contract.id}`,
      },
    });

    await prisma.notification.create({
      data: {
        userId: contract.freelancerId,
        type: 'dispute_resolved',
        title: 'Dispute Resolved',
        message: `Dispute for "${contractTitle}" resolved. ${resolution === 'freelancer_wins' ? 'Payment released to you.' : resolution === 'buyer_wins' ? 'Buyer refunded.' : 'Payment was split between both parties.'}`,
        link: `/contracts/${contract.id}`,
      },
    });

    return res.status(200).json({
      message: `Dispute resolved: ${resolution}`,
      resolution,
      platformFeePercent: feePercent,
      platformFee,
      distributableAmount,
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    return res.status(500).json({ message: 'Failed to resolve dispute', code: 'RESOLVE_ERROR' });
  }
};

// ─── GET KYC DOCUMENTS FOR REVIEW ────────────────────────────────────────
const getKycDocuments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [documents, total] = await Promise.all([
      prisma.documentVerification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              kycStatus: true,
              createdAt: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.documentVerification.count({ where }),
    ]);

    return res.status(200).json({
      documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get KYC documents error:', error);
    return res.status(500).json({ message: 'Failed to fetch KYC documents', code: 'FETCH_ERROR' });
  }
};

// ─── GET PLATFORM WALLET / REVENUE ───────────────────────────────────────
const getPlatformRevenue = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const platformWallet = await prisma.wallet.findUnique({
      where: { id: 'platform' },
    });

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: 'platform' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          wallet: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.transaction.count({ where: { walletId: 'platform' } }),
    ]);

    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const monthlyRevenue = await prisma.transaction.groupBy({
      by: ['createdAt'],
      where: {
        walletId: 'platform',
        createdAt: { gte: sixMonthsAgo },
      },
      _sum: { amount: true },
    });

    return res.status(200).json({
      platformWallet: platformWallet || { balance: 0 },
      transactions,
      monthlyRevenue,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get platform revenue error:', error);
    return res.status(500).json({ message: 'Failed to fetch revenue', code: 'FETCH_ERROR' });
  }
};

// ─── GET WITHDRAWAL REQUESTS ─────────────────────────────────────────────
const getWithdrawalRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { type: 'withdrawal' };
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    const withdrawalsWithBankDetails = transactions.map(t => ({
      ...t,
      bankDetails: t.metadata ? JSON.parse(t.metadata) : null
    }));

    return res.status(200).json({
      withdrawals: withdrawalsWithBankDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    return res.status(500).json({ message: 'Failed to fetch withdrawals', code: 'FETCH_ERROR' });
  }
};

// ─── APPROVE / REJECT WITHDRAWAL ─────────────────────────────────────────
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, notes } = req.body;

    if (!['completed', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status', code: 'INVALID_STATUS' });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found', code: 'NOT_FOUND' });
    }

    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ message: 'Not a withdrawal transaction', code: 'INVALID_TYPE' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction already processed', code: 'ALREADY_PROCESSED' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status, adminNotes: notes || null },
      });

      if (status === 'rejected') {
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: { increment: Math.abs(transaction.amount) } },
        });
      }
    });

    await prisma.notification.create({
      data: {
        userId: transaction.wallet.userId,
        type: status === 'completed' ? 'withdrawal_approved' : 'withdrawal_rejected',
        title: status === 'completed' ? 'Withdrawal Approved' : 'Withdrawal Rejected',
        message: status === 'completed'
          ? `Your withdrawal of ₦${Math.abs(transaction.amount).toLocaleString()} has been approved and processed to your bank account.`
          : `Your withdrawal was rejected. Reason: ${notes || 'No reason provided'}. Funds returned to your wallet.`,
        link: '/wallet',
      },
    });

    return res.status(200).json({ message: `Withdrawal ${status}` });
  } catch (error) {
    console.error('Update withdrawal error:', error);
    return res.status(500).json({ message: 'Failed to update withdrawal', code: 'UPDATE_ERROR' });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  suspendUser,
  unsuspendUser,
  verifyUserKyc,
  rejectKyc,
  getAllJobs,
  getAllTransactions,
  getDisputes,
  getDisputeById,
  resolveDispute,
  getKycDocuments,
  getPlatformRevenue,
  getWithdrawalRequests,
  updateWithdrawalStatus,
};