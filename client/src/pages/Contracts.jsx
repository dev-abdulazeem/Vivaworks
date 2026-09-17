import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  Calendar,
  FileText,
  CreditCard,
  Ban,
  ChevronRight,
  Briefcase,
  User,
  ShieldCheck,
  Wallet
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const Contracts = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchContracts()
  }, [isAuthenticated, activeFilter])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {}
      if (activeFilter !== 'all') params.status = activeFilter

      const response = await api.get('/contracts/my-contracts', { params })
      setContracts(response.data.contracts)
    } catch (err) {
      console.error('Fetch contracts error:', err)
      setError(err.response?.data?.message || 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (contractId) => {
    if (!window.confirm('Mark this contract as completed?')) return

    try {
      setActionLoading(contractId + '-complete')
      await api.patch(`/contracts/${contractId}/complete`)
      toast.success('Contract marked as completed')
      fetchContracts()
    } catch (err) {
      console.error('Complete error:', err)
      toast.error(err.response?.data?.message || 'Failed to complete contract')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (contractId) => {
    const reason = window.prompt('Reason for cancellation (optional):')
    if (reason === null) return

    try {
      setActionLoading(contractId + '-cancel')
      await api.patch(`/contracts/${contractId}/cancel`, { reason: reason || undefined })
      toast.success('Contract cancelled')
      fetchContracts()
    } catch (err) {
      console.error('Cancel error:', err)
      toast.error(err.response?.data?.message || 'Failed to cancel contract')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePay = async (contractId) => {
    try {
      setActionLoading(contractId + '-pay')
      const response = await api.post(`/contracts/${contractId}/pay`)
      if (response.data.authorizationUrl) {
        window.location.href = response.data.authorizationUrl
      } else {
        toast.success('Payment processed')
        fetchContracts()
      }
    } catch (err) {
      console.error('Payment error:', err)
      toast.error(err.response?.data?.message || 'Payment failed')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending_payment: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: <Clock className="w-3.5 h-3.5" />,
        label: 'Pending Payment'
      },
      active: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        label: 'Active'
      },
      completed: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        label: 'Completed'
      },
      cancelled: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: 'Cancelled'
      }
    }

    const config = styles[status] || {
      bg: 'bg-gray-50',
      text: 'text-gray-600',
      border: 'border-gray-200',
      icon: <Clock className="w-3.5 h-3.5" />,
      label: status
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  const getRoleBadge = (contract) => {
    const isClient = contract.buyerId === user?.id
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${isClient ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
        {isClient ? <Wallet className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
        {isClient ? 'Client' : 'Freelancer'}
      </span>
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatAmount = (amount) => {
    if (amount == null) return 'N/A'
    return `₦${Number(amount).toLocaleString()}`
  }

  const isBuyer = (contract) => contract.buyerId === user?.id

  const filters = [
    { key: 'all', label: 'All Contracts', count: null },
    { key: 'pending_payment', label: 'Pending Payment', count: null },
    { key: 'active', label: 'Active', count: null },
    { key: 'completed', label: 'Completed', count: null },
    { key: 'cancelled', label: 'Cancelled', count: null }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500 text-sm">Loading your contracts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-6 text-sm">{error}</p>
          <button
            onClick={fetchContracts}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                My Contracts
              </h1>
              <p className="text-gray-400 mt-1 text-sm">
                Track and manage all your project agreements
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
              <FileText className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-gray-700">{contracts.length}</span>
              <span>contract{contracts.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeFilter === filter.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Contracts List */}
        {contracts.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-16 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-gray-100">
              <FileText className="w-7 h-7 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No contracts found
            </h3>
            <p className="text-gray-400 mb-8 text-sm max-w-sm mx-auto leading-relaxed">
              {activeFilter === 'all'
                ? "You don't have any contracts yet. Accept a proposal to get started!"
                : `No ${activeFilter.replace('_', ' ')} contracts found.`}
            </p>
            {activeFilter === 'all' && user?.role === 'buyer' && (
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                View My Jobs
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {contracts.map((contract) => {
              const otherParty = isBuyer(contract)
                ? contract.freelancer
                : contract.buyer

              return (
                <div
                  key={contract.id}
                  className="bg-white rounded-xl border border-gray-100 p-5 sm:p-6 hover:shadow-lg hover:border-emerald-100 transition-all duration-300 group"
                >
                  <div className="flex flex-col gap-4">
                    {/* Top: Status + Role + Job Title */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {getRoleBadge(contract)}
                          {getStatusBadge(contract.status)}
                        </div>
                        
                        {/* Job Title - prominently displayed */}
                        {contract.job ? (
                          <Link
                            to={`/jobs/${contract.job.id}`}
                            className="text-lg font-bold text-gray-900 hover:text-emerald-600 transition-colors line-clamp-2 leading-snug"
                          >
                            {contract.job.title}
                          </Link>
                        ) : (
                          <span className="text-lg font-bold text-gray-400">
                            Untitled Contract
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gray-50" />

                    {/* Middle: Other Party + Details */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Other Party */}
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0 overflow-hidden">
                          {otherParty?.avatar ? (
                            <img
                              src={otherParty.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : otherParty ? (
                            `${otherParty.firstName?.[0] || ''}${otherParty.lastName?.[0] || ''}`
                          ) : (
                            <User className="w-5 h-5 text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {otherParty
                              ? `${otherParty.firstName || ''} ${otherParty.lastName || ''}`.trim() || 'Unknown User'
                              : 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {isBuyer(contract) ? 'Freelancer' : 'Client'}
                          </p>
                        </div>
                      </div>

                      {/* Contract Details */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          <span className="font-semibold text-gray-900">{formatAmount(contract.amount)}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Calendar className="w-4 h-4 text-gray-300" />
                          {formatDate(contract.createdAt)}
                        </span>
                        {contract.payments && contract.payments.length > 0 && (
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <CreditCard className="w-4 h-4 text-gray-300" />
                            {contract.payments.length} payment{contract.payments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-50">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors group-hover:translate-x-0.5 duration-200"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>

                      {/* Buyer: Pay Now */}
                      {isBuyer(contract) && contract.status === 'pending_payment' && (
                        <button
                          onClick={() => handlePay(contract.id)}
                          disabled={actionLoading === contract.id + '-pay'}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                        >
                          <CreditCard className="w-4 h-4" />
                          {actionLoading === contract.id + '-pay' ? 'Processing...' : 'Pay Now'}
                        </button>
                      )}

                      {/* Buyer: Mark Complete */}
                      {isBuyer(contract) && contract.status === 'active' && (
                        <button
                          onClick={() => handleComplete(contract.id)}
                          disabled={actionLoading === contract.id + '-complete'}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {actionLoading === contract.id + '-complete' ? 'Completing...' : 'Mark Complete'}
                        </button>
                      )}

                      {/* Cancel (both parties, if not finalized) */}
                      {(contract.status === 'pending_payment' || contract.status === 'active') && (
                        <button
                          onClick={() => handleCancel(contract.id)}
                          disabled={actionLoading === contract.id + '-cancel'}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors ml-auto"
                        >
                          <Ban className="w-4 h-4" />
                          {actionLoading === contract.id + '-cancel' ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Contracts