import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  X,
  Eye,
  DollarSign,
  Clock,
  Calendar,
  User,
  Briefcase,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Ban,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Mail,
  Users,
  Wallet,
  UserCheck,
  UserX,
  Link2,
  Lock,
  LayoutDashboard,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Gavel,
  FileCheck,
  AlertTriangle,
  Download,
  Image,
  BadgeCheck,
  BadgeX,
  Percent,
  Banknote,
  Receipt,
  FileSearch,
  Send,
  MessageSquare,
  Hash,
  Filter,
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Edit3,
  Unlock,
  Lock as LockIcon,
  Info,
  Shield,
  ShieldCheck,
  IdCard,
  FileImage,
  CreditCard,
  MapPin,
  Phone,
  Globe,
  CalendarDays,
  Award,
  Star,
  Flag,
  EyeOff,
  Scale,
  HandCoins,
  Divide,
  Settings2,
  Building2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [txFilter, setTxFilter] = useState('all');
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [userPagination, setUserPagination] = useState(null);
  const [jobPagination, setJobPagination] = useState(null);
  const [txPagination, setTxPagination] = useState(null);
  const [withdrawalPagination, setWithdrawalPagination] = useState(null);

  // Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [withdrawalRejectionReason, setWithdrawalRejectionReason] = useState('');

  // Revenue stats
  const [revenueStats, setRevenueStats] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    fetchOverview();
  }, [isAuthenticated, user]);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/dashboard');
      setStats(response.data.stats);
      setTransactions(response.data.recentTransactions || []);
      setRevenueStats(response.data.revenueBreakdown || null);
    } catch (err) {
      console.error('Fetch stats error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (userSearch) params.search = userSearch;
      if (userFilter !== 'all') params.status = userFilter;
      if (userRoleFilter !== 'all') params.role = userRoleFilter;

      const response = await api.get('/admin/users', { params });
      setUsers(response.data.users || []);
      setUserPagination(response.data.pagination || null);
      setUserPage(page);
    } catch (err) {
      console.error('Fetch users error:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (jobFilter !== 'all') params.status = jobFilter;

      const response = await api.get('/admin/jobs', { params });
      setJobs(response.data.jobs || []);
      setJobPagination(response.data.pagination || null);
      setJobPage(page);
    } catch (err) {
      console.error('Fetch jobs error:', err);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (txFilter !== 'all') params.type = txFilter;

      const response = await api.get('/admin/transactions', { params });
      setTransactions(response.data.transactions || []);
      setTxPagination(response.data.pagination || null);
      setTxPage(page);
    } catch (err) {
      console.error('Fetch transactions error:', err);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (withdrawalFilter !== 'all') params.status = withdrawalFilter;

      const response = await api.get('/admin/withdrawals', { params });
      setWithdrawals(response.data.withdrawals || []);
      setWithdrawalPagination(response.data.pagination || null);
      setWithdrawalPage(page);
    } catch (err) {
      console.error('Fetch withdrawals error:', err);
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setLoading(true);
    switch (tab) {
      case 'overview':
        fetchOverview();
        break;
      case 'users':
        fetchUsers(1);
        break;
      case 'jobs':
        fetchJobs(1);
        break;
      case 'transactions':
        fetchTransactions(1);
        break;
      case 'withdrawals':
        fetchWithdrawals(1);
        break;
      default:
        break;
    }
  };

  // ─── USER ACTIONS ─────────────────────────────────────────────────────
  const suspendUser = async (userId) => {
    const reason = window.prompt('Reason for suspension:');
    if (reason === null) return;

    try {
      setActionLoading(userId + '-suspend');
      await api.patch(`/admin/users/${userId}/suspend`, { reason: reason || undefined });
      toast.success('User suspended successfully');
      fetchUsers(userPage);
    } catch (err) {
      console.error('Suspend error:', err);
      toast.error(err.response?.data?.message || 'Failed to suspend user');
    } finally {
      setActionLoading(null);
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      setActionLoading(userId + '-unsuspend');
      await api.patch(`/admin/users/${userId}/unsuspend`);
      toast.success('User unsuspended successfully');
      fetchUsers(userPage);
    } catch (err) {
      console.error('Unsuspend error:', err);
      toast.error('Failed to unsuspend user');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── WITHDRAWAL ACTIONS ───────────────────────────────────────────────
  const approveWithdrawal = async (withdrawalId) => {
    try {
      setActionLoading(withdrawalId + '-approve');
      await api.patch(`/admin/withdrawals/${withdrawalId}/approve`);
      toast.success('Withdrawal approved successfully');
      fetchWithdrawals(withdrawalPage);
    } catch (err) {
      console.error('Approve withdrawal error:', err);
      toast.error(err.response?.data?.message || 'Failed to approve withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectWithdrawal = async (withdrawalId) => {
    if (!withdrawalRejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setActionLoading(withdrawalId + '-reject');
      await api.patch(`/admin/withdrawals/${withdrawalId}/reject`, { reason: withdrawalRejectionReason });
      toast.success('Withdrawal rejected successfully');
      closeWithdrawalModal();
      fetchWithdrawals(withdrawalPage);
    } catch (err) {
      console.error('Reject withdrawal error:', err);
      toast.error(err.response?.data?.message || 'Failed to reject withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  const openWithdrawalModal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setWithdrawalRejectionReason('');
    setWithdrawalModalOpen(true);
  };

  const closeWithdrawalModal = () => {
    setWithdrawalModalOpen(false);
    setSelectedWithdrawal(null);
    setWithdrawalRejectionReason('');
  };

  // ─── USER DETAIL MODAL ────────────────────────────────────────────────
  const openUserModal = async (userId) => {
    try {
      setActionLoading(userId + '-view');
      const response = await api.get(`/admin/users/${userId}`);
      setSelectedUser(response.data.user);
      setUserModalOpen(true);
    } catch (err) {
      toast.error('Failed to load user details');
    } finally {
      setActionLoading(null);
    }
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    setSelectedUser(null);
  };

  // ─── FORMATTERS ───────────────────────────────────────────────────────
  const formatCurrency = (amount) => {
    return `₦${(amount || 0).toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      completed: 'bg-gray-50 text-gray-700 border-gray-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      unverified: 'bg-amber-50 text-amber-700 border-amber-200',
      suspended: 'bg-red-50 text-red-700 border-red-200',
      delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      in_revision: 'bg-amber-50 text-amber-700 border-amber-200',
      disputed: 'bg-red-50 text-red-700 border-red-200',
      pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
      auto_cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
      deposit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      withdrawal: 'bg-orange-50 text-orange-700 border-orange-200',
      escrow: 'bg-purple-50 text-purple-700 border-purple-200',
      escrow_release: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      escrow_deposit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      contract_payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      refund: 'bg-red-50 text-red-700 border-red-200',
      credit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      debit: 'bg-red-50 text-red-700 border-red-200',
      pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
      resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      buyer_wins: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      freelancer_wins: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      split: 'bg-blue-50 text-blue-700 border-blue-200',
      custom: 'bg-purple-50 text-purple-700 border-purple-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      submitted: 'bg-amber-50 text-amber-700 border-amber-200',
      under_review: 'bg-blue-50 text-blue-700 border-blue-200',
      processing: 'bg-blue-50 text-blue-700 border-blue-200',
      failed: 'bg-red-50 text-red-700 border-red-200',
      paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return styles[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getTransactionIcon = (type) => {
    const creditTypes = ['credit', 'escrow_release', 'contract_payment', 'refund'];
    return creditTypes.includes(type) ? (
      <ArrowDownLeft className="w-5 h-5" />
    ) : (
      <ArrowUpRight className="w-5 h-5" />
    );
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { key: 'jobs', label: 'Jobs', icon: <Briefcase className="w-4 h-4" /> },
    { key: 'transactions', label: 'Transactions', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'withdrawals', label: 'Withdrawals', icon: <HandCoins className="w-4 h-4" /> },
  ];

  // ─── LOADING STATE ────────────────────────────────────────────────────
  if (loading && !stats && activeTab === 'overview') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => handleTabChange(activeTab)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ─── PAGE HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Manage platform operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/disputes')}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm shadow-emerald-100 hover:shadow-md transition-all"
            >
              <ShieldAlert className="w-4 h-4" />
              Manage Disputes
            </button>
            <span className="text-sm text-gray-500 hidden sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold border border-emerald-200">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </div>

        {/* ─── TABS ─────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Users',
                  value: stats.users?.total || 0,
                  sub: `${stats.users?.newThisMonth || 0} new this month`,
                  icon: <Users className="w-5 h-5" />,
                  color: 'bg-emerald-50 text-emerald-600',
                  trend: stats.users?.newThisMonth > 0 ? 'up' : null,
                },
                {
                  label: 'Total Jobs',
                  value: stats.jobs?.total || 0,
                  sub: `${stats.jobs?.active || 0} active`,
                  icon: <Briefcase className="w-5 h-5" />,
                  color: 'bg-emerald-50 text-emerald-600',
                  trend: null,
                },
                {
                  label: 'Contracts',
                  value: stats.contracts?.total || 0,
                  sub: `${stats.contracts?.active || 0} active`,
                  icon: <FileText className="w-5 h-5" />,
                  color: 'bg-emerald-50 text-emerald-600',
                  trend: null,
                },
                {
                  label: 'Revenue',
                  value: formatCurrency(stats.revenue?.total),
                  sub: `${formatCurrency(stats.revenue?.thisMonth || 0)} this month`,
                  icon: <DollarSign className="w-5 h-5" />,
                  color: 'bg-emerald-50 text-emerald-600',
                  trend: stats.revenue?.thisMonth > 0 ? 'up' : null,
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer"
                  onClick={() => {
                    if (stat.label === 'Total Users') handleTabChange('users');
                    if (stat.label === 'Total Jobs') handleTabChange('jobs');
                    if (stat.label === 'Contracts') handleTabChange('jobs');
                    if (stat.label === 'Revenue') handleTabChange('transactions');
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`p-2.5 rounded-xl ${stat.color}`}>
                      {stat.icon}
                    </span>
                    {stat.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <HandCoins className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Pending Withdrawals</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.withdrawals?.pending || 0}</p>
                <button
                  onClick={() => { setWithdrawalFilter('pending'); handleTabChange('withdrawals'); }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 mt-2 inline-flex items-center gap-1 font-medium"
                >
                  Review withdrawals <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <UserX className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Suspended Users</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.users?.suspended || 0}</p>
                <button
                  onClick={() => { setUserFilter('suspended'); handleTabChange('users'); }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 mt-2 inline-flex items-center gap-1 font-medium"
                >
                  View suspended <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Pending Disputes</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.disputes?.pending || 0}</p>
                <button
                  onClick={() => navigate('/admin/disputes')}
                  className="text-sm text-emerald-600 hover:text-emerald-700 mt-2 inline-flex items-center gap-1 font-medium"
                >
                  Review disputes <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Revenue Breakdown */}
            {revenueStats && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Percent className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Platform Revenue (10% Commission)</h3>
                    <p className="text-xs text-gray-500">Deducted from every completed contract</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Total Commission</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(revenueStats.totalCommission)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">This Month</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(revenueStats.thisMonthCommission)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Completed Contracts</p>
                    <p className="text-lg font-bold text-gray-900">{revenueStats.completedContracts}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Avg Commission</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(revenueStats.averageCommission)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Disputes Alert */}
            {(stats.disputes?.pending || 0) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800">
                    {stats.disputes.pending} pending dispute{stats.disputes.pending > 1 ? 's' : ''} require attention
                  </p>
                </div>
                <button
                  onClick={() => navigate('/admin/disputes')}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Review
                </button>
              </div>
            )}

            {/* Pending Withdrawals Alert */}
            {(stats.withdrawals?.pending || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <HandCoins className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    {stats.withdrawals.pending} withdrawal{stats.withdrawals.pending > 1 ? 's' : ''} pending approval
                  </p>
                </div>
                <button
                  onClick={() => { setWithdrawalFilter('pending'); handleTabChange('withdrawals'); }}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Review
                </button>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-400" />
                  Recent Transactions
                </h3>
                <button
                  onClick={() => handleTabChange('transactions')}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">No recent transactions</div>
                ) : (
                  transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-500">
                          {tx.wallet?.user?.firstName} {tx.wallet?.user?.lastName} • {formatShortDate(tx.createdAt)}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm ${
                        tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund'
                          ? 'text-emerald-600'
                          : 'text-emerald-600'
                      }`}>
                        {tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            USERS TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <select
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); fetchUsers(1); }}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="suspended">Suspended</option>
              </select>
              <select
                value={userRoleFilter}
                onChange={(e) => { setUserRoleFilter(e.target.value); fetchUsers(1); }}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Roles</option>
                <option value="buyer">Buyers</option>
                <option value="freelancer">Freelancers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Balance</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Joined</th>
                      <th className="text-right px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold border border-emerald-200">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            u.isAdmin ? 'bg-emerald-50 text-emerald-700' :
                            u.isFreelancer ? 'bg-emerald-50 text-emerald-700' :
                            u.isBuyer ? 'bg-emerald-50 text-emerald-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {u.isAdmin ? 'Admin' : u.isFreelancer ? 'Freelancer' : u.isBuyer ? 'Buyer' : 'User'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            u.isSuspended
                              ? getStatusBadge('suspended')
                              : u.isVerified
                              ? getStatusBadge('verified')
                              : getStatusBadge('unverified')
                          }`}>
                            {u.isSuspended ? 'Suspended' : u.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-900">{formatCurrency(u.wallet?.balance)}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{formatShortDate(u.createdAt)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openUserModal(u.id)}
                              disabled={actionLoading === u.id + '-view'}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {u.isSuspended ? (
                              <button
                                onClick={() => unsuspendUser(u.id)}
                                disabled={actionLoading === u.id + '-unsuspend'}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Unsuspend"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            ) : !u.isAdmin && (
                              <button
                                onClick={() => suspendUser(u.id)}
                                disabled={actionLoading === u.id + '-suspend'}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Suspend"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No users found</div>
              )}

              {/* Pagination */}
              {userPagination && userPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing {(userPage - 1) * 20 + 1} - {Math.min(userPage * 20, userPagination.total)} of {userPagination.total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => fetchUsers(userPage - 1)}
                      disabled={userPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                      {userPage} / {userPagination.pages}
                    </span>
                    <button
                      onClick={() => fetchUsers(userPage + 1)}
                      disabled={userPage === userPagination.pages}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            JOBS TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select
                value={jobFilter}
                onChange={(e) => { setJobFilter(e.target.value); fetchJobs(1); }}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Job</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Buyer</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Budget</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Proposals</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Posted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <Link to={`/jobs/${job.id}`} className="font-medium text-gray-900 hover:text-emerald-600 transition-colors line-clamp-1">
                            {job.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">{job.buyer?.firstName} {job.buyer?.lastName}</td>
                        <td className="px-4 py-3.5 font-medium text-gray-900">{formatCurrency(job.budget)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(job.status)}`}>
                            {job.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">{job.proposals?.length || 0}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{formatShortDate(job.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {jobs.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No jobs found</div>
              )}

              {/* Pagination */}
              {jobPagination && jobPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing {(jobPage - 1) * 20 + 1} - {Math.min(jobPage * 20, jobPagination.total)} of {jobPagination.total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => fetchJobs(jobPage - 1)}
                      disabled={jobPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                      {jobPage} / {jobPagination.pages}
                    </span>
                    <button
                      onClick={() => fetchJobs(jobPage + 1)}
                      disabled={jobPage === jobPagination.pages}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TRANSACTIONS TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select
                value={txFilter}
                onChange={(e) => { setTxFilter(e.target.value); fetchTransactions(1); }}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="escrow_deposit">Escrow Deposits</option>
                <option value="escrow_release">Escrow Releases</option>
                <option value="contract_payment">Contract Payments</option>
                <option value="refund">Refunds</option>
              </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-2">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund'
                                ? 'bg-emerald-50 text-emerald-500'
                                : 'bg-emerald-50 text-emerald-500'
                            }`}>
                              {getTransactionIcon(tx.type)}
                            </span>
                            <span className="capitalize font-medium text-gray-700">{tx.type?.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          {tx.wallet?.user?.firstName} {tx.wallet?.user?.lastName}
                        </td>
                        <td className={`px-4 py-3.5 font-semibold ${
                          tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund'
                            ? 'text-emerald-600'
                            : 'text-emerald-600'
                        }`}>
                          {tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(tx.status)}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{formatShortDate(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {transactions.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">No transactions found</div>
              )}

              {/* Pagination */}
              {txPagination && txPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing {(txPage - 1) * 20 + txPagination.total} of {txPagination.total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => fetchTransactions(txPage - 1)}
                      disabled={txPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                      {txPage} / {txPagination.pages}
                    </span>
                    <button
                      onClick={() => fetchTransactions(txPage + 1)}
                      disabled={txPage === txPagination.pages}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            WITHDRAWALS TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Pending',
                  value: withdrawals.filter(w => w.status === 'pending').length,
                  icon: <Clock className="w-5 h-5" />,
                  color: 'bg-amber-50 text-amber-600',
                },
                {
                  label: 'Approved',
                  value: withdrawals.filter(w => w.status === 'approved').length,
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  color: 'bg-emerald-50 text-emerald-600',
                },
                {
                  label: 'Rejected',
                  value: withdrawals.filter(w => w.status === 'rejected').length,
                  icon: <XCircle className="w-5 h-5" />,
                  color: 'bg-red-50 text-red-600',
                },
                {
                  label: 'Total Amount',
                  value: formatCurrency(withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0)),
                  icon: <HandCoins className="w-5 h-5" />,
                  color: 'bg-emerald-50 text-emerald-600',
                },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`p-2.5 rounded-xl ${stat.color}`}>
                      {stat.icon}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={withdrawalFilter}
                onChange={(e) => { setWithdrawalFilter(e.target.value); fetchWithdrawals(1); }}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="processing">Processing</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {/* Withdrawals Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Bank Details</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Requested</th>
                      <th className="text-right px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold border border-emerald-200">
                              {w.user?.firstName?.[0]}{w.user?.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{w.user?.firstName} {w.user?.lastName}</p>
                              <p className="text-xs text-gray-500">{w.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-gray-900">{formatCurrency(w.amount)}</td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-gray-900">{w.bankName || 'N/A'}</p>
                            <p className="text-xs text-gray-500">{w.accountNumber ? `****${w.accountNumber.slice(-4)}` : 'N/A'}</p>
                            <p className="text-xs text-gray-500">{w.accountName || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(w.status)}`}>
                            {w.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {w.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {w.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                            {w.status === 'processing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            {w.status === 'paid' && <Check className="w-3 h-3 mr-1" />}
                            {w.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{formatShortDate(w.createdAt)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openUserModal(w.userId)}
                              disabled={actionLoading === w.userId + '-view'}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View User"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {w.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => openWithdrawalModal(w)}
                                  disabled={actionLoading === w.id + '-reject'}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => approveWithdrawal(w.id)}
                                  disabled={actionLoading === w.id + '-approve'}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {withdrawals.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <HandCoins className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p>No withdrawals found</p>
                </div>
              )}

              {/* Pagination */}
              {withdrawalPagination && withdrawalPagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing {(withdrawalPage - 1) * 20 + 1} - {Math.min(withdrawalPage * 20, withdrawalPagination.total)} of {withdrawalPagination.total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => fetchWithdrawals(withdrawalPage - 1)}
                      disabled={withdrawalPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                      {withdrawalPage} / {withdrawalPagination.pages}
                    </span>
                    <button
                      onClick={() => fetchWithdrawals(withdrawalPage + 1)}
                      disabled={withdrawalPage === withdrawalPagination.pages}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          WITHDRAWAL REJECTION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {withdrawalModalOpen && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  Reject Withdrawal
                </h2>
                <button
                  onClick={closeWithdrawalModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {selectedWithdrawal.user?.firstName} {selectedWithdrawal.user?.lastName} — {formatCurrency(selectedWithdrawal.amount)}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Bank Details</p>
                <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.bankName || 'N/A'}</p>
                <p className="text-sm text-gray-600">{selectedWithdrawal.accountName || 'N/A'}</p>
                <p className="text-sm text-gray-600">{selectedWithdrawal.accountNumber ? `****${selectedWithdrawal.accountNumber.slice(-4)}` : 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900 mb-2 block">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={withdrawalRejectionReason}
                  onChange={(e) => setWithdrawalRejectionReason(e.target.value)}
                  placeholder="Explain why this withdrawal is being rejected..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  This reason will be shared with the user.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={closeWithdrawalModal}
                className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectWithdrawal(selectedWithdrawal.id)}
                disabled={!withdrawalRejectionReason.trim() || actionLoading === selectedWithdrawal.id + '-reject'}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedWithdrawal.id + '-reject' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Reject Withdrawal</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          USER DETAIL MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {userModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">User Details</h2>
              <button
                onClick={closeUserModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xl font-bold border border-emerald-200">
                  {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</h3>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      selectedUser.isSuspended ? getStatusBadge('suspended') :
                      selectedUser.isVerified ? getStatusBadge('verified') : getStatusBadge('unverified')
                    }`}>
                      {selectedUser.isSuspended ? 'Suspended' : selectedUser.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedUser.isAdmin ? 'bg-emerald-50 text-emerald-700' :
                      selectedUser.isFreelancer ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {selectedUser.isAdmin ? 'Admin' : selectedUser.isFreelancer ? 'Freelancer' : 'Buyer'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedUser.wallet?.balance || 0)}</p>
                  <p className="text-xs text-gray-500 mt-1">Wallet Balance</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedUser.jobsPosted?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Jobs Posted</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedUser.contracts?.length || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Contracts</p>
                </div>
              </div>

              {/* Recent Transactions */}
              {selectedUser.wallet?.transactions && selectedUser.wallet.transactions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    Recent Transactions
                  </h4>
                  <div className="space-y-2">
                    {selectedUser.wallet.transactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.type}</p>
                          <p className="text-xs text-gray-500">{formatShortDate(tx.createdAt)}</p>
                        </div>
                        <span className={`text-sm font-semibold ${
                          tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund'
                            ? 'text-emerald-600'
                            : 'text-emerald-600'
                        }`}>
                          {tx.type === 'credit' || tx.type === 'escrow_release' || tx.type === 'contract_payment' || tx.type === 'refund' ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Jobs Posted */}
              {selectedUser.jobsPosted && selectedUser.jobsPosted.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    Recent Jobs Posted
                  </h4>
                  <div className="space-y-2">
                    {selectedUser.jobsPosted.slice(0, 5).map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="min-w-0">
                          <Link to={`/jobs/${job.id}`} className="text-sm font-medium text-gray-900 hover:text-emerald-600 truncate block">
                            {job.title}
                          </Link>
                          <p className="text-xs text-gray-500">{formatShortDate(job.createdAt)}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(job.status)}`}>
                          {job.status?.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Link
                  to={`/profile/${selectedUser.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  View Public Profile
                </Link>
                {selectedUser.isSuspended ? (
                  <button
                    onClick={() => {
                      unsuspendUser(selectedUser.id);
                      closeUserModal();
                    }}
                                       disabled={actionLoading === selectedUser.id + '-unsuspend'}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                  >
                    <Unlock className="w-4 h-4" />
                    Unsuspend User
                  </button>
                ) : !selectedUser.isAdmin && (
                  <button
                    onClick={() => {
                      suspendUser(selectedUser.id);
                      closeUserModal();
                    }}
                    disabled={actionLoading === selectedUser.id + '-suspend'}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                  >
                    <Ban className="w-4 h-4" />
                    Suspend User
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;