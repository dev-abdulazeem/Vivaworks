import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  FileText,
  Briefcase,
  Clock,
  Star,
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  Pencil,
  Trash2,
  ChevronRight,
  Search,
  Filter,
  X
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const Proposals = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [withdrawingId, setWithdrawingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const isFreelancer = user?.role === 'freelancer' || user?.isFreelancer === true

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!isFreelancer) {
      navigate('/')
      return
    }
    fetchProposals()
  }, [isAuthenticated, isFreelancer, activeFilter])

  const fetchProposals = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {}
      if (activeFilter !== 'all') params.status = activeFilter

      const response = await api.get('/proposals/my-proposals', { params })
      setProposals(response.data.proposals)
    } catch (err) {
      console.error('Fetch proposals error:', err)
      setError(err.response?.data?.message || 'Failed to load proposals')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async (proposalId) => {
    if (!window.confirm('Are you sure you want to withdraw this proposal?')) return

    try {
      setWithdrawingId(proposalId)
      await api.delete(`/proposals/${proposalId}`)
      toast.success('Proposal withdrawn successfully')
      setProposals((prev) => prev.filter((p) => p.id !== proposalId))
    } catch (err) {
      console.error('Withdraw error:', err)
      toast.error(err.response?.data?.message || 'Failed to withdraw proposal')
    } finally {
      setWithdrawingId(null)
    }
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          dot: 'bg-amber-500',
          label: 'Pending'
        }
      case 'shortlisted':
        return {
          icon: <Star className="w-3.5 h-3.5" />,
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-200',
          dot: 'bg-purple-500',
          label: 'Shortlisted'
        }
      case 'accepted':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Accepted'
        }
      case 'rejected':
        return {
          icon: <XCircle className="w-3.5 h-3.5" />,
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-200',
          dot: 'bg-red-500',
          label: 'Rejected'
        }
      default:
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          dot: 'bg-gray-400',
          label: status
        }
    }
  }

  const getJobStatusConfig = (status) => {
    switch (status) {
      case 'open':
        return 'text-emerald-600'
      case 'in_progress':
        return 'text-amber-600'
      case 'completed':
        return 'text-blue-600'
      case 'cancelled':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const filters = [
    { key: 'all', label: 'All', count: null },
    { key: 'pending', label: 'Pending', count: null },
    { key: 'shortlisted', label: 'Shortlisted', count: null },
    { key: 'accepted', label: 'Accepted', count: null },
    { key: 'rejected', label: 'Rejected', count: null }
  ]

  const filteredProposals = proposals.filter((p) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      p.job.title.toLowerCase().includes(query) ||
      p.coverLetter.toLowerCase().includes(query) ||
      `${p.job.buyer?.firstName} ${p.job.buyer?.lastName}`.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-400 text-sm">Loading your proposals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button
            onClick={fetchProposals}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                My Proposals
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Track and manage your job applications
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span className="font-medium text-gray-700">{proposals.length}</span>
                <span>proposal{proposals.length !== 1 ? 's' : ''}</span>
              </div>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm shadow-emerald-100"
              >
                <Briefcase className="w-4 h-4" />
                Find Jobs
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Desktop Filters */}
          <div className="hidden sm:flex items-center gap-2">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeFilter === filter.key
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-100'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="sm:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600"
          >
            <Filter className="w-4 h-4" />
            Filter
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
              {activeFilter === 'all' ? 'All' : filters.find(f => f.key === activeFilter)?.label}
            </span>
          </button>
        </div>

        {/* Mobile Filters Dropdown */}
        {showMobileFilters && (
          <div className="sm:hidden flex flex-wrap gap-2 mb-6 p-3 bg-white border border-gray-200 rounded-xl">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => {
                  setActiveFilter(filter.key)
                  setShowMobileFilters(false)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === filter.key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {/* Mobile Count */}
        <div className="sm:hidden flex items-center gap-2 text-sm text-gray-500 mb-4">
          <FileText className="w-4 h-4 text-emerald-500" />
          <span className="font-medium text-gray-700">{filteredProposals.length}</span>
          <span>proposal{filteredProposals.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Proposals List */}
        {filteredProposals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'No matching proposals' : 'No proposals found'}
            </h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search terms.'
                : activeFilter === 'all'
                ? "You haven't submitted any proposals yet. Browse jobs and start applying!"
                : `No ${activeFilter} proposals found.`}
            </p>
            {!searchQuery && activeFilter === 'all' && (
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm shadow-emerald-100"
              >
                <Briefcase className="w-4 h-4" />
                Browse Jobs
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProposals.map((proposal) => {
              const statusConfig = getStatusConfig(proposal.status)
              const jobStatusConfig = getJobStatusConfig(proposal.job.status)

              return (
                <div
                  key={proposal.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-200 group"
                >
                  {/* Top Row: Title + Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link
                      to={`/jobs/${proposal.job.id}`}
                      className="text-base sm:text-lg font-semibold text-gray-900 hover:text-emerald-600 transition-colors line-clamp-2 flex-1"
                    >
                      {proposal.job.title}
                    </Link>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Client Info */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                      {proposal.job.buyer?.avatar ? (
                        <img
                          src={proposal.job.buyer.avatar}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        `${proposal.job.buyer?.firstName?.[0] || ''}${proposal.job.buyer?.lastName?.[0] || ''}`
                      )}
                    </div>
                    <span className="text-sm text-gray-600 font-medium">
                      {proposal.job.buyer?.firstName} {proposal.job.buyer?.lastName}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className={`text-sm font-medium ${jobStatusConfig}`}>
                      Job {proposal.job.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Proposal Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {(proposal.proposedBudget || proposal.proposedRate) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                        <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-medium text-gray-900">
                          ₦{(proposal.proposedBudget || proposal.proposedRate || 0).toLocaleString()}
                        </span>
                        {proposal.job.budgetType === 'hourly' && (
                          <span className="text-gray-400 text-xs">/hr</span>
                        )}
                      </div>
                    )}

                    {(proposal.proposedDuration || proposal.duration) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                        <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-medium text-gray-900">
                          {proposal.proposedDuration || proposal.duration}
                        </span>
                        {proposal.proposedDuration && (
                          <span className="text-gray-400 text-xs">days</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-xl">
                      <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-gray-500 text-xs sm:text-sm">
                        {formatDate(proposal.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Cover Letter Preview */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-5 leading-relaxed">
                    {proposal.coverLetter}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-100">
                    <Link
                      to={`/jobs/${proposal.job.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                    >
                      View Job
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    {proposal.status === 'pending' && proposal.job.status === 'open' && (
                      <Link
                        to={`/proposals/${proposal.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                    )}

                    {proposal.status === 'pending' && (
                      <button
                        onClick={() => handleWithdraw(proposal.id)}
                        disabled={withdrawingId === proposal.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {withdrawingId === proposal.id ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    )}
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

export default Proposals