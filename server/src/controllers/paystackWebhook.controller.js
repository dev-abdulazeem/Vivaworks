const crypto = require('crypto');
const { handlePaystackWebhook } = require('../utils/paystack');

const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];

    if (!signature) {
      return res.status(400).json({ message: 'Missing signature', code: 'MISSING_SIGNATURE' });
    }

    const payload = req.body;

    const result = await handlePaystackWebhook(payload, signature);

    if (!result.success) {
      return res.status(400).json({ message: result.error, code: 'WEBHOOK_ERROR' });
    }

    return res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ message: 'Webhook processing failed', code: 'WEBHOOK_ERROR' });
  }
};

module.exports = {
  paystackWebhook,
};