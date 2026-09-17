import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  ChevronRight,
  ChevronLeft,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Building2,
  Hash,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Wallet,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const AdminWithdrawals = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  // Modal
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!user?.isAdmin) {
      navigate('/')
      return
    }
    fetchWithdrawals(1)
  }, [isAuthenticated, user])

  const fetchWithdrawals = async (pageNum = 1) => {
    try {
      setLoading(true)
      setError(null)
      const params = { page: pageNum, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter

      const response = await api.get('/admin/withdrawals', { params })
      setWithdrawals(response.data.withdrawals || [])
      setPagination(response.data.pagination || null)
      setPage(pageNum)
    } catch (err) {
      console.error('Fetch withdrawals error:', err)
      setError(err.response?.data?.message || 'Failed to load withdrawals')
      toast.error('Failed to load withdrawals')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus)
    fetchWithdrawals(1)
  }

  const openModal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal)
    setAdminNotes('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedWithdrawal(null)
    setAdminNotes('')
  }

  const approveWithdrawal = async (transactionId) => {
    try {
      setActionLoading(transactionId + '-approve')
      await api.patch(`/admin/withdrawals/${transactionId}`, {
        status: 'completed',
        notes: adminNotes || undefined,
      })
      toast.success('Withdrawal approved successfully')
      closeModal()
      fetchWithdrawals(page)
    } catch (err) {
      console.error('Approve error:', err)
      toast.error(err.response?.data?.message || 'Failed to approve withdrawal')
    } finally {
      setActionLoading(null)
    }
  }

  const rejectWithdrawal = async (transactionId) => {
    if (!adminNotes.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    try {
      setActionLoading(transactionId + '-reject')
      await api.patch(`/admin/withdrawals/${transactionId}`, {
        status: 'rejected',
        notes: adminNotes,
      })
      toast.success('Withdrawal rejected and funds returned to user')
      closeModal()
      fetchWithdrawals(page)
    } catch (err) {
      console.error('Reject error:', err)
      toast.error(err.response?.data?.message || 'Failed to reject withdrawal')
    } finally {
      setActionLoading(null)
    }
  }

  const formatCurrency = (amount) => {
    return `₦${Math.abs(amount || 0).toLocaleString()}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      processing: 'bg-blue-50 text-blue-700 border-blue-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      failed: 'bg-red-50 text-red-700 border-red-200',
    }
    return styles[status] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const userName = `${w.wallet?.user?.firstName || ''} ${w.wallet?.user?.lastName || ''}`.toLowerCase()
    const email = (w.wallet?.user?.email || '').toLowerCase()
    const bankName = (w.bankDetails?.bankName || '').toLowerCase()
    const accountName = (w.bankDetails?.accountName || '').toLowerCase()
    return userName.includes(query) || email.includes(query) || bankName.includes(query) || accountName.includes(query)
  })

  if (loading && !withdrawals.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500">Loading withdrawals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => fetchWithdrawals(1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Withdrawal Requests</h1>
                <p className="text-xs text-gray-500">Manage and process user withdrawals</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold border border-emerald-200">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ─── STATS CARDS ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-5 h-5" />
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {withdrawals.filter(w => w.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Pending</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {withdrawals.filter(w => w.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Approved</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-red-50 text-red-600">
                <XCircle className="w-5 h-5" />
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {withdrawals.filter(w => w.status === 'rejected').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Rejected</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="w-5 h-5" />
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + Math.abs(w.amount), 0))}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Pending</p>
          </div>
        </div>

        {/* ─── FILTERS ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or bank..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => fetchWithdrawals(1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* ─── WITHDRAWALS TABLE ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Bank Details</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500 text-sm">
                      <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p>No withdrawals found</p>
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold border border-emerald-200">
                            {w.wallet?.user?.firstName?.[0]}{w.wallet?.user?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{w.wallet?.user?.firstName} {w.wallet?.user?.lastName}</p>
                            <p className="text-xs text-gray-500">{w.wallet?.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-emerald-600 text-lg">
                          {formatCurrency(w.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {w.bankDetails ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">{w.bankDetails.bankName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-600">{w.bankDetails.accountName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-xs text-gray-500 font-mono">{w.bankDetails.accountNumber}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No bank details</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(w.status)}`}>
                          {w.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {w.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {w.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs">
                        {formatDate(w.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openModal(w)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {w.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openModal(w)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openModal(w)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => fetchWithdrawals(page - 1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
                  {page} / {pagination.pages}
                </span>
                <button
                  onClick={() => fetchWithdrawals(page + 1)}
                  disabled={page === pagination.pages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          WITHDRAWAL DETAIL / ACTION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {modalOpen && selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  Withdrawal Details
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* User Info */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-bold border border-emerald-200">
                  {selectedWithdrawal.wallet?.user?.firstName?.[0]}{selectedWithdrawal.wallet?.user?.lastName?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedWithdrawal.wallet?.user?.firstName} {selectedWithdrawal.wallet?.user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedWithdrawal.wallet?.user?.email}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider mb-1">Withdrawal Amount</p>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(selectedWithdrawal.amount)}</p>
              </div>

              {/* Bank Details */}
              {selectedWithdrawal.bankDetails && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    Bank Account Details
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Bank Name</p>
                        <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.bankDetails.bankName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Account Name</p>
                        <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.bankDetails.accountName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Account Number</p>
                        <p className="text-sm font-medium text-gray-900 font-mono">{selectedWithdrawal.bankDetails.accountNumber}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status & Date */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedWithdrawal.status)}`}>
                    {selectedWithdrawal.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(selectedWithdrawal.createdAt)}</p>
                </div>
              </div>

              {/* Admin Notes (for pending) */}
              {selectedWithdrawal.status === 'pending' && (
                <div>
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Admin Notes <span className="text-gray-400">(optional for approve, required for reject)</span>
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this withdrawal..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  />
                </div>
              )}

              {/* Admin Notes (if already processed) */}
              {selectedWithdrawal.adminNotes && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Admin Notes</p>
                  <p className="text-sm text-gray-700">{selectedWithdrawal.adminNotes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer - Actions */}
            <div className="p-6 border-t border-gray-100">
              {selectedWithdrawal.status === 'pending' ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => rejectWithdrawal(selectedWithdrawal.id)}
                    disabled={actionLoading === selectedWithdrawal.id + '-reject'}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {actionLoading === selectedWithdrawal.id + '-reject' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> Reject</>
                    )}
                  </button>
                  <button
                    onClick={() => approveWithdrawal(selectedWithdrawal.id)}
                    disabled={actionLoading === selectedWithdrawal.id + '-approve'}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm shadow-emerald-100 disabled:opacity-50"
                  >
                    {actionLoading === selectedWithdrawal.id + '-approve' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Approve</>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminWithdrawals