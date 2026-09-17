import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Send,
  Eye,
  EyeOff,
  DollarSign,
  Clock,
  CheckCircle2,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  Wallet,
  Shield,
  ChevronRight,
  Banknote,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const WalletPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showBalance, setShowBalance] = useState(true);

  // Withdrawal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [withdrawData, setWithdrawData] = useState({
    amount: '',
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState(null);
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(null);
  const [otpLocked, setOtpLocked] = useState(false);

  // Top-up state
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [savedCards, setSavedCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const processedRefs = useRef(new Set());
  const verifyAttempted = useRef(false);

  const LOW_BALANCE_THRESHOLD = 5000;

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/wallet');
      setWallet(response.data.wallet);
      setTransactions(response.data.wallet.transactions || []);
    } catch (err) {
      console.error('Fetch wallet error:', err);
      setError(err.response?.data?.message || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setTxLoading(true);
      const response = await api.get('/wallet/transactions');
      setTransactions(response.data.transactions);
    } catch (err) {
      console.error('Fetch transactions error:', err);
      toast.error('Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  }, []);

  const fetchBanks = useCallback(async () => {
    try {
      setBanksLoading(true);
      const response = await api.get('/wallet/banks');
      setBanks(response.data.banks || []);
    } catch (err) {
      console.error('Fetch banks error:', err);
      toast.error('Failed to load banks');
    } finally {
      setBanksLoading(false);
    }
  }, []);

  const fetchSavedCards = useCallback(async () => {
    try {
      setCardsLoading(true);
      const response = await api.get('/wallet/cards');
      setSavedCards(response.data.cards || []);
    } catch (err) {
      console.error('Fetch cards error:', err);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const verifyTopUpPayment = useCallback(async (reference) => {
    if (!reference) return;
    if (processedRefs.current.has(reference)) return;
    if (verifyingPayment) return;

    processedRefs.current.add(reference);

    try {
      setVerifyingPayment(true);
      toast.loading('Verifying your payment...');

      const response = await api.post('/wallet/verify-topup', { reference });

      toast.dismiss();
      toast.success(`₦${response.data.amount?.toLocaleString()} added to your wallet!`);

      await fetchWallet();
      navigate('/wallet', { replace: true });
    } catch (err) {
      toast.dismiss();
      console.error('Verify top-up error:', err);
      toast.error(err.response?.data?.message || 'Payment verification failed');
    } finally {
      setVerifyingPayment(false);
    }
  }, [fetchWallet, navigate, verifyingPayment]);

  const manualVerify = async (reference) => {
    if (!reference) {
      toast.error('No reference to verify');
      return;
    }
    processedRefs.current.delete(reference);
    await verifyTopUpPayment(reference);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchWallet();
    fetchSavedCards();

    const ref = searchParams.get('reference') || searchParams.get('trxref');
    if (ref && !verifyAttempted.current) {
      verifyAttempted.current = true;
      const timer = setTimeout(() => verifyTopUpPayment(ref), 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate, fetchWallet, fetchSavedCards, searchParams, verifyTopUpPayment]);

  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);

    if (!amount || isNaN(amount) || amount < 100) {
      toast.error('Minimum top-up is ₦100');
      return;
    }

    try {
      setTopUpLoading(true);
      const response = await api.post('/wallet/topup', { amount });

      if (response.data.authorizationUrl) {
        verifyAttempted.current = false;
        processedRefs.current.clear();
        window.location.href = response.data.authorizationUrl;
      } else {
        toast.error('Payment initialization failed');
      }
    } catch (err) {
      console.error('Top-up error:', err);
      toast.error(err.response?.data?.message || 'Failed to initialize payment');
    } finally {
      setTopUpLoading(false);
    }
  };

  const deleteCard = async (cardId) => {
    if (!window.confirm('Remove this card?')) return;
    try {
      await api.delete(`/wallet/cards/${cardId}`);
      toast.success('Card removed');
      fetchSavedCards();
    } catch (err) {
      toast.error('Failed to remove card');
    }
  };

  const verifyAccount = async () => {
    if (!withdrawData.accountNumber || !withdrawData.bankCode) {
      toast.error('Enter account number and select bank');
      return;
    }
    try {
      setVerifyingAccount(true);
      const response = await api.post('/wallet/verify-account', {
        accountNumber: withdrawData.accountNumber,
        bankCode: withdrawData.bankCode,
      });
      setWithdrawData((prev) => ({ ...prev, accountName: response.data.accountName }));
      toast.success('Account verified');
    } catch (err) {
      console.error('Verify error:', err);
      toast.error(err.response?.data?.message || 'Failed to verify account');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const requestOtp = async (e) => {
    e.preventDefault();
    if (!withdrawData.amount || !withdrawData.accountName) {
      toast.error('Fill all fields and verify account');
      return;
    }
    const amount = parseFloat(withdrawData.amount);
    if (isNaN(amount) || amount < 1000) {
      toast.error('Minimum withdrawal is ₦1,000');
      return;
    }
    if (wallet && amount > parseFloat(wallet.balance)) {
      toast.error('Insufficient balance');
      return;
    }
    try {
      setWithdrawLoading(true);
      const selectedBank = banks.find((b) => b.code === withdrawData.bankCode);
      await api.post('/wallet/withdrawal-otp', {
        amount,
        bankDetails: {
          accountNumber: withdrawData.accountNumber,
          accountName: withdrawData.accountName,
          bankCode: withdrawData.bankCode,
          bankName: selectedBank?.name || withdrawData.bankName,
        },
      });
      toast.success('OTP sent to your email');
      setOtpAttemptsLeft(null);
      setOtpLocked(false);
      setWithdrawStep(2);
    } catch (err) {
      console.error('OTP request error:', err);
      const code = err.response?.data?.code;
      if (code === 'WITHDRAWAL_COOLDOWN') {
        toast.error(err.response.data.message);
        setShowWithdrawModal(false);
        fetchWallet();
      } else {
        toast.error(err.response?.data?.message || 'Failed to send OTP');
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  const confirmWithdrawal = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Enter 6-digit OTP');
      return;
    }
    try {
      setWithdrawLoading(true);
      const response = await api.post('/wallet/confirm-withdrawal', { code: otpCode });
      setWithdrawResult(response.data);
      setWithdrawStep(3);
      toast.success('Withdrawal successful!');
      fetchWallet();
    } catch (err) {
      console.error('Withdrawal error:', err);
      const data = err.response?.data;
      if (data?.code === 'OTP_LOCKED') {
        setOtpLocked(true);
        toast.error(data.message);
      } else if (typeof data?.attemptsLeft === 'number') {
        setOtpAttemptsLeft(data.attemptsLeft);
        toast.error(`${data.message} (${data.attemptsLeft} attempt${data.attemptsLeft === 1 ? '' : 's'} left)`);
      } else {
        toast.error(data?.message || 'Withdrawal failed');
      }
    } finally {
      setWithdrawLoading(false);
    }
  };

  const openWithdrawModal = () => {
    setShowWithdrawModal(true);
    setWithdrawStep(1);
    setWithdrawData({ amount: '', bankCode: '', bankName: '', accountNumber: '', accountName: '' });
    setOtpCode('');
    setWithdrawResult(null);
    setOtpAttemptsLeft(null);
    setOtpLocked(false);
    fetchBanks();
  };

  const openTopUpModal = () => {
    setShowTopUpModal(true);
    setTopUpAmount('');
  };

  const cooldownHoursLeft = useMemo(() => {
    if (!wallet?.withdrawalLockedUntil) return 0;
    const msLeft = new Date(wallet.withdrawalLockedUntil).getTime() - Date.now();
    return msLeft > 0 ? Math.ceil(msLeft / (60 * 60 * 1000)) : 0;
  }, [wallet?.withdrawalLockedUntil]);

  const withdrawalOnCooldown = cooldownHoursLeft > 0;

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
      case 'deposit':
      case 'escrow_deposit':
        return <ArrowDownLeft className="w-4 h-4 text-emerald-600" />;
      case 'debit':
      case 'withdrawal':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'escrow':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'release':
      case 'contract_payment':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'refund':
        return <RotateCcw className="w-4 h-4 text-violet-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'credit':
      case 'deposit':
      case 'release':
      case 'contract_payment':
      case 'refund':
        return 'text-emerald-600';
      case 'debit':
      case 'withdrawal':
      case 'escrow_deposit':
        return 'text-red-500';
      case 'escrow':
        return 'text-amber-500';
      default:
        return 'text-gray-600';
    }
  };

  const formatAmount = (amount, type) => {
    const prefix =
      type === 'credit' || type === 'deposit' || type === 'release' || type === 'contract_payment' || type === 'refund'
        ? '+'
        : type === 'debit' || type === 'withdrawal' || type === 'escrow_deposit'
        ? '-'
        : '';
    return `${prefix}₦${Math.abs(amount).toLocaleString()}`;
  };

  const getTransactionBgColor = (type) => {
    switch (type) {
      case 'credit':
      case 'deposit':
      case 'release':
      case 'contract_payment':
      case 'refund':
        return 'bg-emerald-50';
      case 'debit':
      case 'withdrawal':
      case 'escrow_deposit':
        return 'bg-red-50';
      case 'escrow':
        return 'bg-amber-50';
      default:
        return 'bg-gray-50';
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const isLowBalance = wallet && parseFloat(wallet.balance) < LOW_BALANCE_THRESHOLD;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500 text-sm">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={fetchWallet}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">My Wallet</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage your earnings, top-ups, and withdrawals</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Low balance warning */}
        {isLowBalance && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Low Balance Warning</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Your balance is below ₦{LOW_BALANCE_THRESHOLD.toLocaleString()}. Add money to continue hiring freelancers.
                </p>
              </div>
            </div>
            <button
              onClick={openTopUpModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Money
            </button>
          </div>
        )}

        {/* Withdrawal cooldown notice */}
        {withdrawalOnCooldown && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Withdrawals temporarily locked</p>
              <p className="text-sm text-gray-600 mt-0.5">
                For your security, only one withdrawal is allowed every 24 hours. You can withdraw again in about {cooldownHoursLeft}h.
              </p>
            </div>
          </div>
        )}

        {/* Main balance card */}
        <div className="bg-emerald-600 rounded-2xl p-5 sm:p-8 text-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="w-5 h-5 text-emerald-200 shrink-0" />
              <span className="text-emerald-100 font-medium text-sm truncate">Available Balance</span>
            </div>
            <button onClick={() => setShowBalance(!showBalance)} className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0">
              {showBalance ? <Eye className="w-5 h-5 text-emerald-200" /> : <EyeOff className="w-5 h-5 text-emerald-200" />}
            </button>
          </div>
          <div className="text-2xl sm:text-4xl font-bold mb-2 break-all">
            {showBalance ? `₦${(parseFloat(wallet?.balance) || 0).toLocaleString()}` : '₦••••••'}
          </div>
          <div className="flex items-center gap-2 text-emerald-200 text-sm">
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>VivaWork Wallet</span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={openTopUpModal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-emerald-50 transition-colors shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Money
            </button>
            <button
              onClick={openWithdrawModal}
              disabled={!wallet?.balance || parseFloat(wallet.balance) < 1000 || withdrawalOnCooldown}
              title={withdrawalOnCooldown ? `Available again in ${cooldownHoursLeft}h` : undefined}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {withdrawalOnCooldown ? <Lock className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              {withdrawalOnCooldown ? `Locked (${cooldownHoursLeft}h)` : 'Withdraw'}
            </button>
            <button
              onClick={fetchWallet}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total In', value: parseFloat(wallet?.totalIn) || 0, icon: <ArrowDownLeft className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Total Out', value: parseFloat(wallet?.totalOut) || 0, icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-red-500 bg-red-50' },
            { label: 'In Escrow', value: parseFloat(wallet?.escrowBalance) || 0, icon: <Clock className="w-4 h-4" />, color: 'text-amber-500 bg-amber-50' },
            { label: 'Transactions', value: parseFloat(wallet?.transactionCount) || transactions.length, icon: <CreditCard className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 hover:border-emerald-200 transition-colors min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`p-1.5 rounded-lg shrink-0 ${stat.color}`}>{stat.icon}</span>
                <span className="text-xs text-gray-500 font-medium truncate">{stat.label}</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-gray-900 truncate">
                {stat.label === 'Transactions' ? stat.value.toLocaleString() : `₦${stat.value.toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>

        {/* Saved cards */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Saved Cards</h2>
              <p className="text-sm text-gray-500 mt-0.5">Quick access for future top-ups</p>
            </div>
            <button
              onClick={openTopUpModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New
            </button>
          </div>

          {savedCards.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">No saved cards yet. Cards are saved automatically after your first top-up.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {savedCards.map((card) => (
                <div key={card.id} className="p-4 sm:px-6 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{card.brand} •••• {card.last4}</p>
                    <p className="text-xs text-gray-400 truncate">
                      Expires {card.expiryMonth}/{card.expiryYear}
                      {card.isDefault && <span className="ml-2 text-emerald-600 font-medium">Default</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transaction history */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
              <p className="text-sm text-gray-500 mt-0.5">Recent activity on your wallet</p>
            </div>
            <button onClick={fetchTransactions} disabled={txLoading} className="p-2 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 shrink-0">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${txLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No transactions yet</h3>
              <p className="text-sm text-gray-500">Your transaction history will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 sm:px-6 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${getTransactionBgColor(tx.type)}`}>
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{tx.description || tx.type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold text-sm ${getTransactionColor(tx.type)}`}>{formatAmount(tx.amount, tx.type)}</p>
                    <div className="flex items-center gap-2 justify-end mt-1 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                          tx.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : tx.status === 'pending' || tx.status === 'processing'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-red-50 text-red-500'
                        }`}
                      >
                        {tx.status}
                      </span>
                      {tx.status === 'pending' && tx.paystackRef && tx.type === 'deposit' && (
                        <button
                          onClick={() => manualVerify(tx.paystackRef)}
                          disabled={verifyingPayment}
                          className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-800 disabled:opacity-50 whitespace-nowrap"
                          title="Verify this payment"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Withdrawal Modal ────────────────────────────────────── */}
      {/* Desktop: centered card | Mobile: bottom sheet */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
            {/* Mobile drag handle */}
            <div className="sm:hidden w-full flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {withdrawStep === 1 && 'Withdraw Funds'}
                {withdrawStep === 2 && 'Enter OTP'}
                {withdrawStep === 3 && 'Withdrawal Successful'}
              </h2>
              <button onClick={() => setShowWithdrawModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6">
              {withdrawStep === 1 && (
                <form onSubmit={requestOtp} className="space-y-5">
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-600">
                      For security, you can only make one withdrawal every 24 hours, and it must go to a bank account name matching yours.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₦)</label>
                    <input
                      type="number"
                      value={withdrawData.amount}
                      onChange={(e) => setWithdrawData((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Min ₦1,000"
                      min="1000"
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">Available: ₦{(parseFloat(wallet?.balance) || 0).toLocaleString()}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank</label>
                    <select
                      value={withdrawData.bankCode}
                      onChange={(e) => {
                        const selected = banks.find((b) => b.code === e.target.value);
                        setWithdrawData((prev) => ({ ...prev, bankCode: e.target.value, bankName: selected?.name || '', accountName: '' }));
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm bg-white"
                      required
                    >
                      <option value="">Select bank</option>
                      {banksLoading ? <option disabled>Loading banks...</option> : banks.map((bank) => (
                        <option key={bank.code} value={bank.code}>{bank.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={withdrawData.accountNumber}
                        onChange={(e) => setWithdrawData((prev) => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10), accountName: '' }))}
                        placeholder="10 digits"
                        maxLength={10}
                        className="flex-1 min-w-0 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={verifyAccount}
                        disabled={verifyingAccount || withdrawData.accountNumber.length !== 10 || !withdrawData.bankCode}
                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {verifyingAccount ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verify'}
                      </button>
                    </div>
                  </div>

                  {withdrawData.accountName && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-emerald-800 truncate">{withdrawData.accountName}</p>
                        <p className="text-xs text-emerald-600">Account verified</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={withdrawLoading || !withdrawData.accountName || !withdrawData.amount}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 text-sm active:scale-[0.98] sm:active:scale-100"
                  >
                    {withdrawLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Sending OTP...</>) : (<><Send className="w-4 h-4" />Request OTP</>)}
                  </button>
                </form>
              )}

              {withdrawStep === 2 && (
                <form onSubmit={confirmWithdrawal} className="space-y-5">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-7 h-7 text-emerald-600" />
                    </div>
                    <p className="text-sm text-gray-600 break-words">
                      Enter the 6-digit OTP sent to <span className="font-medium text-gray-900">{user?.email}</span>
                    </p>
                  </div>

                  {otpLocked ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center space-y-3">
                      <p className="text-sm text-red-700">
                        Too many incorrect attempts. This OTP has been locked for your protection.
                      </p>
                      <button
                        type="button"
                        onClick={() => setWithdrawStep(1)}
                        className="text-sm font-medium text-red-700 underline"
                      >
                        Request a new OTP
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">OTP Code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-center text-xl sm:text-2xl font-mono tracking-widest"
                          required
                          autoFocus
                        />
                        {otpAttemptsLeft !== null && (
                          <p className="text-xs text-red-500 mt-1.5 text-center">
                            {otpAttemptsLeft} attempt{otpAttemptsLeft === 1 ? '' : 's'} remaining
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={withdrawLoading || otpCode.length !== 6}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 text-sm active:scale-[0.98] sm:active:scale-100"
                      >
                        {withdrawLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Processing...</>) : (<><CheckCircle2 className="w-4 h-4" />Confirm Withdrawal</>)}
                      </button>

                      <button type="button" onClick={() => setWithdrawStep(1)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
                        Back to details
                      </button>
                    </>
                  )}
                </form>
              )}

              {withdrawStep === 3 && withdrawResult && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Withdrawal Successful!</h3>
                    <p className="text-sm text-gray-500 mt-1">₦{withdrawResult.amount?.toLocaleString()} has been sent to your bank account</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 shrink-0">Reference</span>
                      <span className="font-mono text-gray-900 truncate text-right">{withdrawResult.reference}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 shrink-0">Status</span>
                      <span className="text-emerald-600 font-medium capitalize">{withdrawResult.status}</span>
                    </div>
                    {withdrawResult.nextWithdrawalAvailableAt && (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-500 shrink-0">Next withdrawal available</span>
                        <span className="text-gray-900 text-right">
                          {new Date(withdrawResult.nextWithdrawalAvailableAt).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm active:scale-[0.98] sm:active:scale-100"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Top-up Modal ────────────────────────────────────────── */}
      {/* Desktop: centered card | Mobile: bottom sheet */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
            {/* Mobile drag handle */}
            <div className="sm:hidden w-full flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Add Money</h2>
                <p className="text-sm text-gray-500">Fund your wallet securely</p>
              </div>
              <button onClick={() => setShowTopUpModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Current Balance</p>
                    <p className="text-lg font-bold text-gray-900 truncate">₦{(parseFloat(wallet?.balance) || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleTopUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₦)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₦</span>
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="100"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-base sm:text-lg font-semibold"
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Minimum top-up: ₦100</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1000, 5000, 10000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt.toString())}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-[0.98] sm:active:scale-100 ${
                        topUpAmount === amt.toString()
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="flex items-start gap-2 bg-emerald-50 rounded-lg p-3">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700">
                    Secured by Paystack. Your card details are encrypted and never stored on our servers.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={topUpLoading || !topUpAmount}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 text-sm active:scale-[0.98] sm:active:scale-100"
                >
                  {topUpLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Processing...</>) : (<><Banknote className="w-4 h-4" />Pay ₦{topUpAmount ? parseFloat(topUpAmount).toLocaleString() : '0'}</>)}
                </button>
              </form>

              {savedCards.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Your saved cards</p>
                  <div className="space-y-2">
                    {savedCards.map((card) => (
                      <div key={card.id} className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                        <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{card.brand} •••• {card.last4}</p>
                          <p className="text-xs text-gray-400">Expires {card.expiryMonth}/{card.expiryYear}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Enter an amount above and pay — Paystack will offer your saved card at checkout.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;