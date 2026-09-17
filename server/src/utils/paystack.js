const crypto = require('crypto');
const { initializePayment, verifyPayment, createTransferRecipient, initiateTransfer, verifyTransfer, resolveBankAccount, listBanks } = require('../config/paystack');
const { prisma } = require('../config/database');
const { generateWithdrawalReference } = require('./security');

const PLATFORM_FEE_PERCENTAGE = 10;

const calculatePlatformFee = (amount) => {
  return Math.round((amount * PLATFORM_FEE_PERCENTAGE) / 100);
};

const calculateNetAmount = (amount) => {
  const fee = calculatePlatformFee(amount);
  return amount - fee;
};

const processEscrowPayment = async ({ buyerId, contractId, amount, email, metadata }) => {
  const reference = `ESC-${Date.now()}-${buyerId.slice(0, 8)}`;
  const platformFee = calculatePlatformFee(amount);
  const netAmount = calculateNetAmount(amount);

  const result = await initializePayment({
    email,
    amount,
    metadata: {
      ...metadata,
      contractId,
      buyerId,
      platformFee,
      netAmount,
      type: 'escrow',
    },
    callback_url: `${process.env.CLIENT_URL}/payment/callback`,
    reference,
  });

  if (result.success) {
    await prisma.payment.create({
      data: {
        contractId,
        amount,
        paystackRef: reference,
        status: 'pending',
        type: 'escrow',
      },
    });
  }

  return result;
};

const verifyAndReleaseEscrow = async (reference) => {
  const verification = await verifyPayment(reference);

  if (!verification.success) {
    return verification;
  }

  if (verification.status !== 'success') {
    return {
      success: false,
      error: `Payment status is ${verification.status}`,
    };
  }

  const payment = await prisma.payment.findFirst({
    where: { paystackRef: reference },
    include: { contract: true },
  });

  if (!payment) {
    return { success: false, error: 'Payment record not found' };
  }

  if (payment.status === 'completed') {
    return { success: false, error: 'Payment already processed' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'completed' },
    });

    const freelancerWallet = await tx.wallet.findUnique({
      where: { userId: payment.contract.freelancerId },
    });

    if (!freelancerWallet) {
      await tx.wallet.create({
        data: {
          userId: payment.contract.freelancerId,
          balance: calculateNetAmount(payment.amount),
        },
      });
    } else {
      await tx.wallet.update({
        where: { userId: payment.contract.freelancerId },
        data: { balance: { increment: calculateNetAmount(payment.amount) } },
      });
    }

    await tx.transaction.create({
      data: {
        walletId: freelancerWallet ? freelancerWallet.id : (await tx.wallet.findUnique({ where: { userId: payment.contract.freelancerId } })).id,
        type: 'escrow_release',
        amount: calculateNetAmount(payment.amount),
        description: `Escrow release for contract ${payment.contractId}`,
        paystackRef: reference,
      },
    });
  });

  return {
    success: true,
    message: 'Escrow released successfully',
    amount: calculateNetAmount(payment.amount),
  };
};

const processWithdrawal = async ({ userId, amount, bankDetails, email, firstName }) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet || wallet.balance < amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  const minWithdrawal = 1000;
  if (amount < minWithdrawal) {
    return { success: false, error: `Minimum withdrawal is ₦${minWithdrawal}` };
  }

  const reference = generateWithdrawalReference();

  const recipientResult = await createTransferRecipient({
    type: 'nuban',
    name: bankDetails.accountName,
    accountNumber: bankDetails.accountNumber,
    bankCode: bankDetails.bankCode,
  });

  if (!recipientResult.success) {
    return recipientResult;
  }

  const transferResult = await initiateTransfer({
    amount,
    recipient: recipientResult.recipientCode,
    reason: `Withdrawal by ${firstName}`,
    reference,
  });

  if (!transferResult.success) {
    return transferResult;
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'withdrawal',
        amount: -amount,
        description: `Withdrawal to ${bankDetails.bankName} - ${bankDetails.accountNumber.slice(-4)}`,
        paystackRef: reference,
      },
    });
  });

  return {
    success: true,
    message: 'Withdrawal initiated successfully',
    reference,
    amount,
    status: transferResult.status,
  };
};

const handlePaystackWebhook = async (payload, signature) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  if (hash !== signature) {
    return { success: false, error: 'Invalid webhook signature' };
  }

  const event = payload.event;
  const data = payload.data;

  if (event === 'charge.success') {
    await verifyAndReleaseEscrow(data.reference);
  }

  if (event === 'transfer.success') {
    await prisma.transaction.updateMany({
      where: { paystackRef: data.reference },
      data: { status: 'completed' },
    });
  }

  if (event === 'transfer.failed') {
    const transaction = await prisma.transaction.findFirst({
      where: { paystackRef: data.reference },
      include: { wallet: true },
    });

    if (transaction) {
      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: { increment: Math.abs(transaction.amount) } },
        });

        await tx.transaction.updateMany({
          where: { paystackRef: data.reference },
          data: { status: 'failed' },
        });
      });
    }
  }

  return { success: true, message: 'Webhook processed' };
};

module.exports = {
  calculatePlatformFee,
  calculateNetAmount,
  processEscrowPayment,
  verifyAndReleaseEscrow,
  processWithdrawal,
  handlePaystackWebhook,
  resolveBankAccount,
  listBanks,
};