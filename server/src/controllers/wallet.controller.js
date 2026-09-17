const crypto = require('crypto');
const { prisma } = require('../config/database');
const { generateVerificationCode, getVerificationExpiry, sendWithdrawalOtpEmail } = require('../utils/email');
const { resolveBankAccount, listBanks } = require('../utils/paystack');
const { initializePayment, verifyPayment } = require('../config/paystack');
const { generateWithdrawalReference, maskAccountNumber } = require('../utils/security');

// ─── CONFIG ───
const WITHDRAWAL_COOLDOWN_HOURS = parseInt(process.env.WITHDRAWAL_COOLDOWN_HOURS || '24', 10);
const MAX_WITHDRAWAL_AMOUNT = parseFloat(process.env.MAX_WITHDRAWAL_AMOUNT || '1000000');
const MAX_DAILY_WITHDRAWAL = parseFloat(process.env.MAX_DAILY_WITHDRAWAL || '2000000');
const MAX_OTP_ATTEMPTS = 3;
const MAX_OTP_REQUESTS_PER_DAY = 3;
const MIN_WITHDRAWAL = 2000;
const MAX_TOPUP_AMOUNT = parseFloat(process.env.MAX_TOPUP_AMOUNT || '5000000');

// ─── AUDIT LOG HELPER ───
const audit = async (userId, action, metadata = {}, ipAddress = null) => {
  try {
    await prisma.auditLog.create({
      data: { userId, action, metadata, ipAddress },
    });
  } catch (err) {
    console.error('Audit log failed (non-fatal):', action, err.message);
  }
};

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;

// ─── DECIMAL HELPER ───
// Converts a JS number/string into a Prisma Decimal-compatible string.
// Prisma Decimal fields accept strings or Decimal.js instances.
const toDecimal = (val) => {
  if (val === null || val === undefined) return '0';
  const cleaned = String(val).replace(/,/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '0';
  return num.toFixed(2);
};

// ─── GET WALLET ───
const getWallet = async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      const newWallet = await prisma.wallet.create({
        data: { userId: req.user.id },
        include: { transactions: true },
      });
      return res.status(200).json({ wallet: newWallet });
    }

    const totalIn = await prisma.transaction.aggregate({
      where: { walletId: wallet.id, amount: { gt: 0 }, status: 'completed' },
      _sum: { amount: true },
    });

    const totalOut = await prisma.transaction.aggregate({
      where: { walletId: wallet.id, amount: { lt: 0 }, status: 'completed' },
      _sum: { amount: true },
    });

    let withdrawalLockedUntil = null;
    if (wallet.lastWithdrawalAt) {
      const unlockAt = new Date(
        wallet.lastWithdrawalAt.getTime() + WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000
      );
      if (unlockAt > new Date()) withdrawalLockedUntil = unlockAt;
    }

    const pendingWithdrawals = await prisma.transaction.count({
      where: {
        walletId: wallet.id,
        type: 'withdrawal',
        status: 'pending',
      },
    });

    // Buyer's active escrow: money they have locked in active contracts
    const buyerActiveEscrow = await prisma.contract.aggregate({
      where: {
        buyerId: req.user.id,
        status: { in: ['pending_payment', 'active', 'in_progress', 'delivered', 'revision_requested'] },
        escrowAmount: { gt: 0 },
      },
      _sum: { escrowAmount: true },
    });

    // Freelancer's active escrow: money earned but not yet released
    const freelancerActiveEscrow = await prisma.contract.aggregate({
      where: {
        freelancerId: req.user.id,
        status: { in: ['active', 'in_progress', 'delivered', 'revision_requested'] },
        escrowAmount: { gt: 0 },
        payoutStatus: { not: 'released' },
      },
      _sum: { escrowAmount: true },
    });

    const buyerEscrowTotal = parseFloat(buyerActiveEscrow._sum?.escrowAmount?.toString?.() || buyerActiveEscrow._sum?.escrowAmount || 0);
    const freelancerEscrowTotal = parseFloat(freelancerActiveEscrow._sum?.escrowAmount?.toString?.() || freelancerActiveEscrow._sum?.escrowAmount || 0);

    // escrowBalance: positive for freelancer (money to receive), negative for buyer (money locked)
    const escrowBalance = freelancerEscrowTotal > 0 ? freelancerEscrowTotal : -buyerEscrowTotal;

    const transactionCount = await prisma.transaction.count({ where: { walletId: wallet.id } });

    const enrichedWallet = {
      ...wallet,
      totalIn: parseFloat(totalIn._sum.amount?.toString?.() || totalIn._sum.amount) || 0,
      totalOut: Math.abs(parseFloat(totalOut._sum.amount?.toString?.() || totalOut._sum.amount)) || 0,
      escrowBalance,
      transactionCount,
      withdrawalLockedUntil,
      pendingWithdrawals,
    };

    return res.status(200).json({ wallet: enrichedWallet });
  } catch (error) {
    console.error('Get wallet error:', error);
    return res.status(500).json({ message: 'Failed to fetch wallet', code: 'WALLET_ERROR' });
  }
};

// ─── GET TRANSACTION HISTORY ───
const getTransactionHistory = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found', code: 'WALLET_NOT_FOUND' });
    }

    const where = { walletId: wallet.id };
    if (type) where.type = type;

    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: safeLimit }),
      prisma.transaction.count({ where }),
    ]);

    return res.status(200).json({
      transactions,
      pagination: { page: parseInt(page) || 1, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    return res.status(500).json({ message: 'Failed to fetch transactions', code: 'FETCH_ERROR' });
  }
};

// ─── REQUEST WITHDRAWAL OTP ───
const requestWithdrawalOtp = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const ipAddress = getClientIp(req);

    if (!amount || !bankDetails || !bankDetails.accountNumber || !bankDetails.bankCode || !bankDetails.accountName || !bankDetails.bankName) {
      return res.status(400).json({ message: 'Amount and complete bank details required', code: 'MISSING_FIELDS' });
    }

    if (!/^\d{10}$/.test(String(bankDetails.accountNumber))) {
      return res.status(400).json({ message: 'Account number must be 10 digits', code: 'INVALID_ACCOUNT_FORMAT' });
    }

    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount', code: 'INVALID_AMOUNT' });
    }
    if (withdrawalAmount < MIN_WITHDRAWAL) {
      return res.status(400).json({ message: `Minimum withdrawal is ₦2,000`, code: 'MIN_WITHDRAWAL' });
    }
    if (withdrawalAmount > MAX_WITHDRAWAL_AMOUNT) {
      return res.status(400).json({
        message: `Maximum withdrawal per transaction is ₦${MAX_WITHDRAWAL_AMOUNT.toLocaleString()}`,
        code: 'MAX_WITHDRAWAL_EXCEEDED',
      });
    }

    // ── LOCKED WALLET READ: use interactive transaction with explicit row lock ──
    // This prevents two concurrent OTP requests from reading the same balance
    // and both passing the "sufficient balance" check before either withdrawal
    // is confirmed. The lock is held until the transaction commits.
    const walletCheck = await prisma.$transaction(async (tx) => {
      const w = await tx.$queryRaw`
        SELECT * FROM wallets WHERE "userId" = ${req.user.id} FOR UPDATE
      `;
      return w[0] || null;
    });

    if (!walletCheck) {
      return res.status(404).json({ message: 'Wallet not found', code: 'WALLET_NOT_FOUND' });
    }

    // Compare as numbers for the check, but store as Decimal
    const currentBalance = parseFloat(walletCheck.balance);
    if (currentBalance < withdrawalAmount) {
      return res.status(400).json({ message: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
    }

    // ── 24-HOUR COOLDOWN ──
    if (walletCheck.lastWithdrawalAt) {
      const cooldownMs = WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000;
      const elapsed = Date.now() - new Date(walletCheck.lastWithdrawalAt).getTime();
      if (elapsed < cooldownMs) {
        const hoursLeft = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
        await audit(req.user.id, 'withdrawal_blocked_cooldown', { withdrawalAmount }, ipAddress);
        return res.status(429).json({
          message: `You can only withdraw once every ${WITHDRAWAL_COOLDOWN_HOURS} hours. Try again in about ${hoursLeft}h.`,
          code: 'WITHDRAWAL_COOLDOWN',
          retryAfterHours: hoursLeft,
        });
      }
    }

    // ── DAILY CUMULATIVE LIMIT ──
    const today = new Date().toDateString();
    const dailySumSoFar =
      walletCheck.dailyWithdrawalDate && new Date(walletCheck.dailyWithdrawalDate).toDateString() === today
        ? parseFloat(walletCheck.dailyWithdrawalSum)
        : 0;
    if (dailySumSoFar + withdrawalAmount > MAX_DAILY_WITHDRAWAL) {
      return res.status(400).json({
        message: `This would exceed your daily withdrawal limit of ₦${MAX_DAILY_WITHDRAWAL.toLocaleString()}`,
        code: 'DAILY_LIMIT_EXCEEDED',
      });
    }

    // ── RATE-LIMIT OTP REQUESTS ──
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOtpCount = await prisma.withdrawalOtp.count({
      where: { userId: req.user.id, createdAt: { gt: since } },
    });
    if (recentOtpCount >= MAX_OTP_REQUESTS_PER_DAY) {
      await audit(req.user.id, 'withdrawal_otp_rate_limited', {}, ipAddress);
      return res.status(429).json({ message: 'Too many withdrawal attempts. Try again later.', code: 'OTP_RATE_LIMIT' });
    }

    const resolveResult = await resolveBankAccount(bankDetails.accountNumber, bankDetails.bankCode);
    if (!resolveResult.success) {
      return res.status(400).json({ message: 'Invalid bank account', code: 'INVALID_ACCOUNT' });
    }

    const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalize(resolveResult.accountName) !== normalize(bankDetails.accountName)) {
      await audit(req.user.id, 'withdrawal_name_mismatch', { provided: bankDetails.accountName }, ipAddress);
      return res.status(400).json({ message: 'Account name does not match bank records', code: 'NAME_MISMATCH' });
    }

    // Invalidate any still-active OTPs
    await prisma.withdrawalOtp.updateMany({
      where: { userId: req.user.id, used: false },
      data: { used: true },
    });

    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiry();

    await prisma.withdrawalOtp.create({
      data: {
        userId: req.user.id,
        code,
        expiresAt,
        amount: toDecimal(withdrawalAmount),
        attempts: 0,
        ipAddress,
        bankDetails: {
          accountNumber: bankDetails.accountNumber,
          accountName: resolveResult.accountName,
          bankCode: bankDetails.bankCode,
          bankName: bankDetails.bankName,
        },
      },
    });

    await sendWithdrawalOtpEmail(req.user.email, code, withdrawalAmount, req.user.firstName);
    await audit(req.user.id, 'withdrawal_otp_requested', { amount: withdrawalAmount }, ipAddress);

    return res.status(200).json({
      message: 'Withdrawal OTP sent to your email',
      maskedAccount: maskAccountNumber(bankDetails.accountNumber),
      expiresIn: '5 minutes',
    });
  } catch (error) {
    console.error('Request withdrawal OTP error:', error);
    return res.status(500).json({ message: 'Failed to send OTP', code: 'OTP_ERROR' });
  }
};

// ─── CONFIRM WITHDRAWAL ───
const confirmWithdrawal = async (req, res) => {
  try {
    const { code } = req.body;
    const ipAddress = getClientIp(req);

    if (!code) {
      return res.status(400).json({ message: 'OTP code required', code: 'MISSING_CODE' });
    }

    const otpRecord = await prisma.withdrawalOtp.findFirst({
      where: { userId: req.user.id, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP', code: 'INVALID_OTP' });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.withdrawalOtp.update({ where: { id: otpRecord.id }, data: { used: true } });
      await audit(req.user.id, 'withdrawal_otp_locked', {}, ipAddress);
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new OTP.', code: 'OTP_LOCKED' });
    }

    if (otpRecord.code !== code) {
      await prisma.withdrawalOtp.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } });
      const attemptsLeft = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
      await audit(req.user.id, 'withdrawal_otp_wrong_code', { attemptsLeft }, ipAddress);
      return res.status(400).json({ message: 'Incorrect OTP', code: 'INVALID_OTP', attemptsLeft: Math.max(attemptsLeft, 0) });
    }

    const otpAmount = parseFloat(otpRecord.amount);

    // ── ATOMIC LOCKED DEBIT: SELECT FOR UPDATE inside a transaction ──
    // This is the critical section. We lock the wallet row, re-check balance,
    // re-check cooldown, debit atomically, and create the transaction record.
    // No other request can touch this wallet row until we commit.
    const today = new Date();

    const debit = await prisma.$transaction(async (tx) => {
      // 1. Lock the wallet row for this user — blocks all other writers
      const lockedWallet = await tx.$queryRaw`
        SELECT * FROM wallets WHERE "userId" = ${req.user.id} FOR UPDATE
      `;

      if (!lockedWallet || lockedWallet.length === 0) {
        throw new Error('WALLET_NOT_FOUND');
      }

      const wallet = lockedWallet[0];

      // 2. Re-check cooldown inside the lock (prevents race: two OTPs confirmed
      //    at the same time, both pass the pre-check, but only one gets the lock)
      if (wallet.lastWithdrawalAt) {
        const cooldownMs = WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(wallet.lastWithdrawalAt).getTime();
        if (elapsed < cooldownMs) {
          throw new Error('WITHDRAWAL_COOLDOWN');
        }
      }

      // 3. Re-check balance inside the lock
      const currentBalance = parseFloat(wallet.balance);
      if (currentBalance < otpAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // 4. Re-check daily limit inside the lock
      const isNewDay = !wallet.dailyWithdrawalDate || new Date(wallet.dailyWithdrawalDate).toDateString() !== today.toDateString();
      const dailySumSoFar = isNewDay ? 0 : parseFloat(wallet.dailyWithdrawalSum);
      if (dailySumSoFar + otpAmount > MAX_DAILY_WITHDRAWAL) {
        throw new Error('DAILY_LIMIT_EXCEEDED');
      }

      // 5. Atomic debit using raw query (Decimal-safe)
      const newBalance = (currentBalance - otpAmount).toFixed(2);
      const newDailySum = (dailySumSoFar + otpAmount).toFixed(2);

      await tx.$executeRaw`
        UPDATE wallets
        SET balance = ${newBalance}::decimal,
            "lastWithdrawalAt" = ${today},
            "dailyWithdrawalSum" = ${newDailySum}::decimal,
            "dailyWithdrawalDate" = ${today},
            "updatedAt" = ${new Date()}
        WHERE id = ${wallet.id}
      `;

      // 6. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'withdrawal',
          amount: toDecimal(-otpAmount),
          description: 'Wallet withdrawal (processing)',
          status: 'processing',
        },
      });

      // 7. Mark OTP as used
      await tx.withdrawalOtp.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });

      return transaction;
    }).catch((err) => {
      // Map thrown errors back to controller-level responses
      if (err.message === 'WALLET_NOT_FOUND') return { error: 'WALLET_NOT_FOUND' };
      if (err.message === 'WITHDRAWAL_COOLDOWN') return { error: 'WITHDRAWAL_COOLDOWN' };
      if (err.message === 'INSUFFICIENT_BALANCE') return { error: 'INSUFFICIENT_BALANCE' };
      if (err.message === 'DAILY_LIMIT_EXCEEDED') return { error: 'DAILY_LIMIT_EXCEEDED' };
      throw err; // re-throw unexpected errors
    });

    if (debit.error === 'WALLET_NOT_FOUND') {
      return res.status(404).json({ message: 'Wallet not found', code: 'WALLET_NOT_FOUND' });
    }
    if (debit.error === 'WITHDRAWAL_COOLDOWN') {
      return res.status(429).json({ message: `Only one withdrawal is allowed every ${WITHDRAWAL_COOLDOWN_HOURS} hours.`, code: 'WITHDRAWAL_COOLDOWN' });
    }
    if (debit.error === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ message: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
    }
    if (debit.error === 'DAILY_LIMIT_EXCEEDED') {
      return res.status(400).json({ message: `This would exceed your daily withdrawal limit of ₦${MAX_DAILY_WITHDRAWAL.toLocaleString()}`, code: 'DAILY_LIMIT_EXCEEDED' });
    }

    // Update transaction to pending admin approval
    await prisma.transaction.update({
      where: { id: debit.id },
      data: {
        status: 'pending',
        description: 'Withdrawal pending admin approval',
        metadata: {
          bankName: otpRecord.bankDetails.bankName,
          accountNumber: otpRecord.bankDetails.accountNumber,
          accountName: otpRecord.bankDetails.accountName,
        },
      },
    });

    await audit(req.user.id, 'withdrawal_pending_admin', { amount: otpAmount }, ipAddress);

    return res.status(200).json({
      message: 'Withdrawal submitted for admin approval. You will be notified once processed.',
      amount: otpAmount,
      status: 'pending',
      nextWithdrawalAvailableAt: new Date(today.getTime() + WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error('Confirm withdrawal error:', error);
    return res.status(500).json({ message: 'Withdrawal failed', code: 'WITHDRAWAL_ERROR' });
  }
};

// ─── GET BANKS ───
const getBanks = async (req, res) => {
  try {
    const result = await listBanks();
    if (!result.success) {
      return res.status(400).json({ message: result.error, code: 'BANKS_ERROR' });
    }
    return res.status(200).json({ banks: result.banks });
  } catch (error) {
    console.error('Get banks error:', error);
    return res.status(500).json({ message: 'Failed to fetch banks', code: 'FETCH_ERROR' });
  }
};

// ─── VERIFY BANK ACCOUNT ───
const verifyBankAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ message: 'Account number and bank code required', code: 'MISSING_FIELDS' });
    }
    if (!/^\d{10}$/.test(String(accountNumber))) {
      return res.status(400).json({ message: 'Account number must be 10 digits', code: 'INVALID_ACCOUNT_FORMAT' });
    }

    const result = await resolveBankAccount(accountNumber, bankCode);
    if (!result.success) {
      return res.status(400).json({ message: result.error, code: 'VERIFY_ERROR' });
    }

    return res.status(200).json({ accountName: result.accountName, accountNumber: result.accountNumber });
  } catch (error) {
    console.error('Verify account error:', error);
    return res.status(500).json({ message: 'Verification failed', code: 'VERIFY_ERROR' });
  }
};

// ─── INITIALIZE TOP-UP PAYMENT ───
const initializeTopUp = async (req, res) => {
  try {
    const { amount } = req.body;

    const topUpAmount = parseFloat(amount);
    if (!amount || isNaN(topUpAmount) || topUpAmount < 100) {
      return res.status(400).json({ message: 'Minimum top-up is ₦100', code: 'INVALID_AMOUNT' });
    }
    if (topUpAmount > MAX_TOPUP_AMOUNT) {
      return res.status(400).json({ message: `Maximum top-up is ₦${MAX_TOPUP_AMOUNT.toLocaleString()}`, code: 'MAX_TOPUP_EXCEEDED' });
    }

    const reference = `VW-TOPUP-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const paystackResult = await initializePayment({
      email: req.user.email,
      amount: topUpAmount,
      reference,
      callback_url: `${process.env.CLIENT_URL}/wallet?trxref=${reference}`,
      metadata: { userId: req.user.id, type: 'wallet_topup' },
    });

    if (!paystackResult.success) {
      return res.status(400).json({ message: paystackResult.error, code: 'PAYSTACK_ERROR' });
    }

    let wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId: req.user.id } });
    }

    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'deposit',
        amount: toDecimal(topUpAmount),
        description: 'Wallet top-up (pending)',
        status: 'pending',
        paystackRef: reference,
      },
    });

    await audit(req.user.id, 'topup_initialized', { amount: topUpAmount, reference }, getClientIp(req));

    return res.status(200).json({ message: 'Payment initialized', authorizationUrl: paystackResult.authorizationUrl, reference });
  } catch (error) {
    console.error('Initialize top-up error:', error);
    return res.status(500).json({ message: 'Failed to initialize payment', code: 'TOPUP_ERROR' });
  }
};

// ─── SHARED: credit a wallet for a verified top-up, idempotently ───
const creditWalletForTopup = async (reference, paystackAmount) => {
  const transaction = await prisma.transaction.findFirst({
    where: { paystackRef: reference },
    include: { wallet: true },
  });

  if (!transaction) return { ok: false, reason: 'NOT_FOUND' };
  if (transaction.status === 'completed') return { ok: true, alreadyProcessed: true, amount: transaction.amount };

  const txAmount = parseFloat(transaction.amount);

  // Amount tampering guard
  if (typeof paystackAmount === 'number' && Math.abs(paystackAmount - txAmount) > 0.01) {
    await prisma.transaction.updateMany({
      where: { paystackRef: reference, status: 'pending' },
      data: { status: 'failed', description: 'Amount mismatch — possible tampering' },
    });
    await audit(transaction.wallet.userId, 'topup_amount_mismatch', { reference, expected: txAmount, got: paystackAmount });
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the wallet row before crediting
    await tx.$queryRaw`
      SELECT * FROM wallets WHERE id = ${transaction.walletId} FOR UPDATE
    `;

    const updated = await tx.transaction.updateMany({
      where: { id: transaction.id, status: 'pending' },
      data: { status: 'completed', description: 'Wallet top-up' },
    });
    if (updated.count === 0) return null;

    await tx.wallet.update({
      where: { id: transaction.walletId },
      data: { balance: { increment: toDecimal(txAmount) } },
    });

    return true;
  });

  if (!result) return { ok: true, alreadyProcessed: true, amount: transaction.amount };

  await prisma.notification.create({
    data: {
      userId: transaction.wallet.userId,
      type: 'deposit_success',
      title: 'Wallet Funded',
      message: `₦${txAmount.toLocaleString()} has been added to your wallet.`,
      link: '/wallet',
    },
  });
  await audit(transaction.wallet.userId, 'topup_completed', { reference, amount: txAmount });

  return { ok: true, amount: transaction.amount };
};

// ─── VERIFY TOP-UP (client-triggered) ───
const verifyTopUp = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ message: 'Reference required', code: 'MISSING_REFERENCE' });
    }

    const verifyResult = await verifyPayment(reference);
    if (!verifyResult.success) {
      return res.status(400).json({ message: verifyResult.error, code: 'VERIFICATION_FAILED' });
    }

    if (verifyResult.status !== 'success') {
      await prisma.transaction.updateMany({ where: { paystackRef: reference }, data: { status: 'failed' } });
      return res.status(400).json({ message: 'Payment was not successful', code: 'PAYMENT_FAILED' });
    }

    const outcome = await creditWalletForTopup(reference, verifyResult.amount);

    if (!outcome.ok) {
      if (outcome.reason === 'NOT_FOUND') return res.status(404).json({ message: 'Transaction not found', code: 'NOT_FOUND' });
      if (outcome.reason === 'AMOUNT_MISMATCH') return res.status(400).json({ message: 'Payment amount could not be verified', code: 'AMOUNT_MISMATCH' });
      return res.status(400).json({ message: 'Verification failed', code: 'VERIFY_ERROR' });
    }

    return res.status(200).json({
      message: outcome.alreadyProcessed ? 'Payment already processed' : 'Payment verified successfully',
      amount: outcome.amount,
      reference,
    });
  } catch (error) {
    console.error('Verify top-up error:', error);
    return res.status(500).json({ message: 'Verification failed', code: 'VERIFY_ERROR' });
  }
};

// ─── PAYSTACK WEBHOOK ───
const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      console.error('PAYSTACK_SECRET_KEY not configured — rejecting webhook');
      return res.status(500).send();
    }
    if (!signature) {
      return res.status(400).send();
    }

    const expectedSignature = crypto.createHmac('sha512', secret).update(req.body).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(400).send();
    }

    res.status(200).send();

    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const amountInNaira = event.data.amount / 100;
      await creditWalletForTopup(reference, amountInNaira);
    }
  } catch (error) {
    console.error('Paystack webhook error:', error);
  }
};

// ─── GET SAVED CARDS ───
const getSavedCards = async (req, res) => {
  try {
    const cards = await prisma.savedCard.findMany({
      where: { userId: req.user.id },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" }
      ],
      select: {
        id: true, last4: true, brand: true, expiryMonth: true, expiryYear: true, isDefault: true, createdAt: true,
      },
    });
    return res.status(200).json({ cards });
  } catch (error) {
    console.error('Get saved cards error:', error);
    return res.status(500).json({ message: 'Failed to fetch cards', code: 'FETCH_ERROR' });
  }
};

// ─── DELETE SAVED CARD ───
const deleteSavedCard = async (req, res) => {
  try {
    const { cardId } = req.params;

    const card = await prisma.savedCard.findFirst({ where: { id: cardId, userId: req.user.id } });
    if (!card) {
      return res.status(404).json({ message: 'Card not found', code: 'NOT_FOUND' });
    }

    await prisma.savedCard.delete({ where: { id: cardId } });
    await audit(req.user.id, 'card_deleted', { cardId }, getClientIp(req));

    return res.status(200).json({ message: 'Card removed' });
  } catch (error) {
    console.error('Delete card error:', error);
    return res.status(500).json({ message: 'Failed to remove card', code: 'DELETE_ERROR' });
  }
};

// ─── SEND TIP TO FREELANCER (BUYER → FREELANCER, OPTIONAL) ──────────────
const sendTip = async (req, res) => {
  try {
    const { contractId, amount, message } = req.body;
    const userId = req.user.id;

    const tipAmount = parseFloat(amount);
    if (!tipAmount || tipAmount < 500) {
      return res.status(400).json({ message: 'Minimum tip is ₦500' });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { freelancer: true, buyer: true }
    });

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    if (contract.buyerId !== userId) {
      return res.status(403).json({ message: 'Only the buyer can send a tip' });
    }

    if (contract.status !== 'completed') {
      return res.status(400).json({ message: 'Can only tip completed contracts' });
    }

    // Check if already tipped
    const existingTip = await prisma.tip.findFirst({
      where: { contractId, buyerId: userId },
    });

    if (existingTip) {
      return res.status(400).json({ message: 'You have already tipped for this contract' });
    }

    // Check buyer wallet balance
    const buyerWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!buyerWallet) {
      return res.status(400).json({ message: 'Wallet not found' });
    }

    if (buyerWallet.balance < tipAmount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Get/create freelancer wallet
    let freelancerWallet = await prisma.wallet.findUnique({
      where: { userId: contract.freelancerId }
    });

    if (!freelancerWallet) {
      freelancerWallet = await prisma.wallet.create({
        data: { userId: contract.freelancerId, balance: 0 }
      });
    }

    // Deduct from buyer
    await prisma.wallet.update({
      where: { id: buyerWallet.id },
      data: { balance: { decrement: tipAmount } }
    });

    // Add to freelancer
    await prisma.wallet.update({
      where: { id: freelancerWallet.id },
      data: { balance: { increment: tipAmount } }
    });

    // Create tip record
    await prisma.tip.create({
      data: {
        contractId,
        buyerId: userId,
        freelancerId: contract.freelancerId,
        amount: tipAmount,
        message: message || null,
      }
    });

    // Create transaction records for both wallets
    await prisma.transaction.create({
      data: {
        walletId: buyerWallet.id,
        type: 'tip_sent',
        amount: tipAmount,
        description: `Tip to ${contract.freelancer.firstName}${message ? `: ${message}` : ''}`,
        status: 'completed',
        metadata: { contractId, recipientId: contract.freelancerId, message: message || null }
      }
    });

    await prisma.transaction.create({
      data: {
        walletId: freelancerWallet.id,
        type: 'tip_received',
        amount: tipAmount,
        description: `Tip from ${contract.buyer.firstName}${message ? `: ${message}` : ''}`,
        status: 'completed',
        metadata: { contractId, senderId: userId, message: message || null }
      }
    });

    // Notify freelancer
    await prisma.notification.create({
      data: {
        userId: contract.freelancerId,
        type: 'tip_received',
        title: 'You received a tip! 🎉',
        message: `${contract.buyer.firstName} sent you a ₦${tipAmount.toLocaleString()} tip${message ? `: "${message}"` : ''}`,
        link: `/contracts/${contractId}`
      }
    });

    return res.status(200).json({ 
      message: `₦${tipAmount.toLocaleString()} tip sent successfully!`,
      tipAmount 
    });

  } catch (error) {
    console.error('Send tip error:', error);
    return res.status(500).json({ message: 'Failed to send tip', error: error.message });
  }
};


module.exports = {
  getWallet,
  getTransactionHistory,
  requestWithdrawalOtp,
  confirmWithdrawal,
  getBanks,
  verifyBankAccount,
  initializeTopUp,
  verifyTopUp,
  paystackWebhook,
  getSavedCards,
  deleteSavedCard,
  sendTip,
};      