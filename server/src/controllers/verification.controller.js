const { prisma } = require('../config/database');
const { cloudinary } = require('../utils/cloudinary');
const { sanitizeInput } = require('../utils/security');

// ============================================
// FREELANCER DOCUMENT REQUIREMENTS
// ============================================
const FREELANCER_REQUIRED_DOCS = [
  { type: 'NATIONAL_ID', label: 'National ID Card', requiresBack: true, requiresSelfie: true },
  { type: 'DRIVERS_LICENSE', label: "Driver's License", requiresBack: true, requiresSelfie: true },
  { type: 'INTERNATIONAL_PASSPORT', label: 'International Passport', requiresBack: false, requiresSelfie: true },
  { type: 'VOTERS_CARD', label: "Voter's Card", requiresBack: false, requiresSelfie: true },
];

// ============================================
// BUYER DOCUMENT REQUIREMENTS
// ============================================
const BUYER_REQUIRED_DOCS = [
  { type: 'NATIONAL_ID', label: 'National ID Card', requiresBack: true, requiresSelfie: true },
  { type: 'DRIVERS_LICENSE', label: "Driver's License", requiresBack: true, requiresSelfie: true },
  { type: 'INTERNATIONAL_PASSPORT', label: 'International Passport', requiresBack: false, requiresSelfie: true },
  { type: 'BUSINESS_REGISTRATION', label: 'Business Registration Certificate', requiresBack: false, requiresSelfie: false },
  { type: 'UTILITY_BILL', label: 'Utility Bill (last 3 months)', requiresBack: false, requiresSelfie: false },
];

// ============================================
// GET VERIFICATION REQUIREMENTS FOR CURRENT USER
// ============================================
const getRequirements = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isFreelancer: true, isBuyer: true, kycStatus: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const requirements = user.isFreelancer ? FREELANCER_REQUIRED_DOCS : BUYER_REQUIRED_DOCS;
    const strictnessLevel = user.isFreelancer ? 'STRICT' : 'STANDARD';

    const existing = await prisma.verificationRequest.findUnique({
      where: { userId: req.user.id },
    });

    return res.status(200).json({
      userType: user.isFreelancer ? 'FREELANCER' : 'BUYER',
      strictnessLevel,
      kycStatus: user.kycStatus,
      requirements,
      existingSubmission: existing ? {
        status: existing.status,
        documentType: existing.idType,
        submittedAt: existing.createdAt,
        reviewedAt: existing.updatedAt,
        rejectionReason: existing.rejectionReason,
      } : null,
    });
  } catch (error) {
    console.error('Get requirements error:', error);
    return res.status(500).json({ message: 'Failed to load requirements', code: 'REQUIREMENTS_ERROR' });
  }
};

// ============================================
// SUBMIT DOCUMENTS FOR VERIFICATION
// ============================================
const submitDocuments = async (req, res) => {
  try {
    const {
      documentType,
      fullName,
      documentNumber,
      dateOfBirth,
      expiryDate,
      country,
      address,
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isFreelancer: true, isBuyer: true, kycStatus: true, kycRejectionCount: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW') {
      return res.status(400).json({ message: 'Verification already in progress', code: 'ALREADY_PENDING' });
    }

    if (user.kycStatus === 'VERIFIED') {
      return res.status(400).json({ message: 'You are already verified', code: 'ALREADY_VERIFIED' });
    }

    const allowedTypes = user.isFreelancer
      ? FREELANCER_REQUIRED_DOCS.map(d => d.type)
      : BUYER_REQUIRED_DOCS.map(d => d.type);

    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({ message: 'Invalid document type for your account type', code: 'INVALID_DOC_TYPE' });
    }

    const docConfig = [...FREELANCER_REQUIRED_DOCS, ...BUYER_REQUIRED_DOCS].find(d => d.type === documentType);
    
    if (!req.files || !req.files.idImageFront) {
      return res.status(400).json({ message: 'Front image of document is required', code: 'MISSING_FRONT_IMAGE' });
    }

    if (docConfig.requiresBack && !req.files.idImageBack) {
      return res.status(400).json({ message: 'Back image of document is required', code: 'MISSING_BACK_IMAGE' });
    }

    if (docConfig.requiresSelfie && !req.files.selfieImage) {
      return res.status(400).json({ message: 'Live selfie is required for identity verification', code: 'MISSING_SELFIE' });
    }

    const uploadPromises = [];
    
    uploadPromises.push(
      cloudinary.uploader.upload(req.files.idImageFront[0].path, {
        folder: `vivawork/verifications/${req.user.id}`,
        resource_type: 'image',
      }).then(result => ({ key: 'idImageFront', url: result.secure_url }))
    );

    if (docConfig.requiresBack && req.files.idImageBack) {
      uploadPromises.push(
        cloudinary.uploader.upload(req.files.idImageBack[0].path, {
          folder: `vivawork/verifications/${req.user.id}`,
          resource_type: 'image',
        }).then(result => ({ key: 'idImageBack', url: result.secure_url }))
      );
    }

    if (docConfig.requiresSelfie && req.files.selfieImage) {
      uploadPromises.push(
        cloudinary.uploader.upload(req.files.selfieImage[0].path, {
          folder: `vivawork/verifications/${req.user.id}`,
          resource_type: 'image',
        }).then(result => ({ key: 'selfieImage', url: result.secure_url }))
      );
    }

    const uploadedImages = await Promise.all(uploadPromises);
    const imageUrls = {};
    uploadedImages.forEach(img => {
      imageUrls[img.key] = img.url;
    });

    const verification = await prisma.$transaction(async (tx) => {
      await tx.verificationRequest.deleteMany({
        where: { userId: req.user.id, status: 'REJECTED' },
      });

      const newVerification = await tx.verificationRequest.create({
        data: {
          userId: req.user.id,
          idType: documentType,
          idImageFront: imageUrls.idImageFront,
          idImageBack: imageUrls.idImageBack || null,
          selfieImage: imageUrls.selfieImage || null,
          idNumber: sanitizeInput(documentNumber),
          status: 'PENDING',
        },
      });

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          kycStatus: 'PENDING',
          kycSubmittedAt: new Date(),
        },
      });

      return newVerification;
    });

    return res.status(201).json({
      message: 'Documents submitted successfully. Awaiting admin review.',
      verification: {
        id: verification.id,
        status: verification.status,
        documentType: verification.idType,
        submittedAt: verification.createdAt,
      },
    });
  } catch (error) {
    console.error('Submit documents error:', error);
    return res.status(500).json({ message: 'Failed to submit documents', code: 'SUBMIT_ERROR' });
  }
};

// ============================================
// GET MY VERIFICATION STATUS
// ============================================
const getMyStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycApprovedAt: true,
        kycRejectionCount: true,
      },
    });

    const verification = await prisma.verificationRequest.findUnique({
      where: { userId: req.user.id },
    });

    return res.status(200).json({
      kycStatus: user.kycStatus,
      kycSubmittedAt: user.kycSubmittedAt,
      kycApprovedAt: user.kycApprovedAt,
      kycRejectionCount: user.kycRejectionCount,
      verification: verification ? {
        documentType: verification.idType,
        status: verification.status,
        submittedAt: verification.createdAt,
        reviewedAt: verification.updatedAt,
        rejectionReason: verification.rejectionReason,
        notes: verification.reviewNote,
      } : null,
    });
  } catch (error) {
    console.error('Get status error:', error);
    return res.status(500).json({ message: 'Failed to fetch status', code: 'STATUS_ERROR' });
  }
};

// ============================================
// ADMIN: GET ALL PENDING VERIFICATIONS
// ============================================
const getPendingVerifications = async (req, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
    }

    const { status = 'PENDING', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      status: status,
    };

    const [verifications, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isFreelancer: true,
              isBuyer: true,
              avatar: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.verificationRequest.count({ where }),
    ]);

    return res.status(200).json({
      verifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get pending error:', error);
    return res.status(500).json({ message: 'Failed to fetch verifications', code: 'FETCH_ERROR' });
  }
};

// ============================================
// ADMIN: GET SINGLE VERIFICATION DETAIL
// ============================================
const getVerificationDetail = async (req, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
    }

    const { id } = req.params;

    const verification = await prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isFreelancer: true,
            isBuyer: true,
            avatar: true,
            headline: true,
            createdAt: true,
            kycRejectionCount: true,
          },
        },
      },
    });

    if (!verification) {
      return res.status(404).json({ message: 'Verification not found', code: 'NOT_FOUND' });
    }

    return res.status(200).json({ verification });
  } catch (error) {
    console.error('Get detail error:', error);
    return res.status(500).json({ message: 'Failed to fetch verification', code: 'FETCH_ERROR' });
  }
};

// ============================================
// ADMIN: APPROVE VERIFICATION  (WITH DEBUG LOGS)
// ============================================
const approveVerification = async (req, res) => {
  try {
    console.log('=== APPROVE VERIFICATION START ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Admin user from req.user:', req.user);

    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true, firstName: true, lastName: true },
    });

    console.log('Admin lookup result:', admin);

    if (!admin?.isAdmin) {
      console.log('Admin check FAILED - isAdmin:', admin?.isAdmin);
      return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
    }

    const { id } = req.params;
    const { notes } = req.body || {};

    console.log('Looking up verification with id:', id);

    const verification = await prisma.verificationRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    console.log('Verification lookup result:', verification ? {
      id: verification.id,
      userId: verification.userId,
      status: verification.status,
      userFirstName: verification.user?.firstName,
      userIsVerified: verification.user?.isVerified,
    } : 'NOT FOUND');

    if (!verification) {
      console.log('Verification NOT FOUND');
      return res.status(404).json({ message: 'Verification not found', code: 'NOT_FOUND' });
    }

    if (verification.status === 'APPROVED') {
      console.log('Verification already APPROVED');
      return res.status(400).json({ message: 'Already approved', code: 'ALREADY_APPROVED' });
    }

    console.log('Starting transaction...');
    console.log('Will update user with id:', verification.userId);
    console.log('Current user isVerified BEFORE transaction:', verification.user?.isVerified);

    await prisma.$transaction(async (tx) => {
      console.log('Inside transaction - updating verificationRequest...');

      const docUpdate = await tx.verificationRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: `${admin.firstName} ${admin.lastName}`,
          reviewNote: notes || null,
          updatedAt: new Date(),
        },
      });

      console.log('Document updated. New status:', docUpdate.status);

      console.log('Inside transaction - updating user...');
      console.log('User ID for update:', verification.userId);
      console.log('Setting isVerified to: true');

      const userUpdate = await tx.user.update({
        where: { id: verification.userId },
        data: {
          kycStatus: 'VERIFIED',
          isVerified: true,
          kycApprovedAt: new Date(),
          kycRejectionCount: 0,
        },
      });

      console.log('User updated successfully!');
      console.log('User update result - id:', userUpdate.id);
      console.log('User update result - isVerified:', userUpdate.isVerified);
      console.log('User update result - kycStatus:', userUpdate.kycStatus);
    });

    console.log('=== TRANSACTION COMPLETED SUCCESSFULLY ===');

    return res.status(200).json({
      message: 'Verification approved successfully',
      verification: {
        id: verification.id,
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('=== APPROVE ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ message: 'Failed to approve', code: 'APPROVE_ERROR' });
  }
};

// ============================================
// ADMIN: REJECT VERIFICATION
// ============================================
const rejectVerification = async (req, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true, firstName: true, lastName: true },
    });

    if (!admin?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return res.status(400).json({ 
        message: 'Rejection reason must be at least 10 characters', 
        code: 'REASON_TOO_SHORT' 
      });
    }

    const verification = await prisma.verificationRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!verification) {
      return res.status(404).json({ message: 'Verification not found', code: 'NOT_FOUND' });
    }

    if (verification.status === 'REJECTED') {
      return res.status(400).json({ message: 'Already rejected', code: 'ALREADY_REJECTED' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: `${admin.firstName} ${admin.lastName}`,
          rejectionReason: rejectionReason.trim(),
          updatedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: verification.userId },
        data: {
          kycStatus: 'REJECTED',
          kycRejectionCount: { increment: 1 },
        },
      });
    });

    return res.status(200).json({
      message: 'Verification rejected',
      verification: {
        id: verification.id,
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      },
    });
  } catch (error) {
    console.error('Reject error:', error);
    return res.status(500).json({ message: 'Failed to reject', code: 'REJECT_ERROR' });
  }
};

// ============================================
// ADMIN: GET VERIFICATION STATS
// ============================================
const getVerificationStats = async (req, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
    }

    const [
      totalPending,
      totalUnderReview,
      totalApproved,
      totalRejected,
      freelancerPending,
      buyerPending,
      todaySubmissions,
    ] = await Promise.all([
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.verificationRequest.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.verificationRequest.count({ where: { status: 'APPROVED' } }),
      prisma.verificationRequest.count({ where: { status: 'REJECTED' } }),
      prisma.verificationRequest.count({
        where: { status: 'PENDING', user: { isFreelancer: true } },
      }),
      prisma.verificationRequest.count({
        where: { status: 'PENDING', user: { isBuyer: true } },
      }),
      prisma.verificationRequest.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return res.status(200).json({
      stats: {
        totalPending,
        totalUnderReview,
        totalApproved,
        totalRejected,
        freelancerPending,
        buyerPending,
        todaySubmissions,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch stats', code: 'STATS_ERROR' });
  }
};

module.exports = {
  getRequirements,
  submitDocuments,
  getMyStatus,
  getPendingVerifications,
  getVerificationDetail,
  approveVerification,
  rejectVerification,
  getVerificationStats,
};