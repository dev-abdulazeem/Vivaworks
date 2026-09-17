const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackClient = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const initializePayment = async ({ email, amount, metadata, callback_url, reference }) => {
  try {
    const response = await paystackClient.post('/transaction/initialize', {
      email,
      amount: Math.round(amount * 100),
      metadata,
      callback_url,
      reference,
    });
    return {
      success: true,
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference,
      accessCode: response.data.data.access_code,
    };
  } catch (error) {
    console.error('Paystack initialize error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Payment initialization failed',
    };
  }
};

const verifyPayment = async (reference) => {
  try {
    const response = await paystackClient.get(`/transaction/verify/${reference}`);
    return {
      success: true,
      status: response.data.data.status,
      amount: response.data.data.amount / 100,
      reference: response.data.data.reference,
      gatewayResponse: response.data.data.gateway_response,
      paidAt: response.data.data.paid_at,
      channel: response.data.data.channel,
      metadata: response.data.data.metadata,
      customer: response.data.data.customer,
    };
  } catch (error) {
    console.error('Paystack verify error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Payment verification failed',
    };
  }
};

const createTransferRecipient = async ({ type, name, accountNumber, bankCode, currency = 'NGN' }) => {
  try {
    const response = await paystackClient.post('/transferrecipient', {
      type,
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency,
    });
    return {
      success: true,
      recipientCode: response.data.data.recipient_code,
      details: response.data.data,
    };
  } catch (error) {
    console.error('Paystack recipient error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to create transfer recipient',
    };
  }
};

const initiateTransfer = async ({ source = 'balance', amount, recipient, reason, reference }) => {
  try {
    const response = await paystackClient.post('/transfer', {
      source,
      amount: Math.round(amount * 100),
      recipient,
      reason,
      reference,
    });
    return {
      success: true,
      transferCode: response.data.data.transfer_code,
      reference: response.data.data.reference,
      status: response.data.data.status,
    };
  } catch (error) {
    console.error('Paystack transfer error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Transfer initiation failed',
    };
  }
};

const verifyTransfer = async (reference) => {
  try {
    const response = await paystackClient.get(`/transfer/verify/${reference}`);
    return {
      success: true,
      status: response.data.data.status,
      amount: response.data.data.amount / 100,
      reference: response.data.data.reference,
      transferredAt: response.data.data.transferred_at,
      reason: response.data.data.reason,
      recipient: response.data.data.recipient,
    };
  } catch (error) {
    console.error('Paystack transfer verify error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Transfer verification failed',
    };
  }
};

const resolveBankAccount = async (accountNumber, bankCode) => {
  try {
    const response = await paystackClient.get(`/bank/resolve`, {
      params: {
        account_number: accountNumber,
        bank_code: bankCode,
      },
    });
    return {
      success: true,
      accountName: response.data.data.account_name,
      accountNumber: response.data.data.account_number,
      bankId: response.data.data.bank_id,
    };
  } catch (error) {
    console.error('Paystack resolve error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Account resolution failed',
    };
  }
};

const listBanks = async () => {
  try {
    const response = await paystackClient.get('/bank', {
      params: { country: 'nigeria', currency: 'NGN' },
    });
    return {
      success: true,
      banks: response.data.data,
    };
  } catch (error) {
    console.error('Paystack banks error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch banks',
    };
  }
};

const fetchBalance = async () => {
  try {
    const response = await paystackClient.get('/balance');
    return {
      success: true,
      balances: response.data.data,
    };
  } catch (error) {
    console.error('Paystack balance error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch balance',
    };
  }
};

module.exports = {
  paystackClient,
  initializePayment,
  verifyPayment,
  createTransferRecipient,
  initiateTransfer,
  verifyTransfer,
  resolveBankAccount,
  listBanks,
  fetchBalance,
};