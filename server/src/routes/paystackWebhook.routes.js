const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { prisma } = require('../config/database');

// Verify Paystack signature
const verifyPaystackSignature = (req, res, next) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ message: 'Invalid signature' });
  }
  next();
};

router.post('/paystack', verifyPaystackSignature, async (req, res) => {
  const event = req.body;

  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data;

    // Check if this is a contract escrow payment
    if (metadata?.type === 'contract_escrow' && metadata?.contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: metadata.contractId },
        include: { job: true, freelancer: true },
      });

      if (!contract) return res.status(200).json({ received: true });

      const amount = event.data.amount / 100;

      await prisma.$transaction([
        prisma.contract.update({
          where: { id: metadata.contractId },
          data: {
            status: 'active',
            escrowAmount: amount,
            startDate: new Date(),
          },
        }),
        prisma.payment.create({
          data: {
            contractId: metadata.contractId,
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
          message: `Payment received! Contract for "${contract.job.title}" is now active.`,
          link: `/contracts/${contract.id}`,
        },
      });
    }

    // Handle wallet top-up
    if (metadata?.type === 'wallet_topup') {
      // Your existing wallet top-up logic
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;