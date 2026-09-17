import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import {
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  UserIcon,
  DocumentTextIcon,
  FunnelIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

function AdminVerifications() {
  const navigate = useNavigate()
  const [verifications, setVerifications] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedVerification, setSelectedVerification] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadData()
  }, [statusFilter, page])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [verificationsRes, statsRes] = await Promise.all([
        api.get(`/verification/admin/pending?status=${statusFilter}&page=${page}&limit=10`),
        api.get('/verification/admin/stats'),
      ])
      setVerifications(verificationsRes.data.verifications)
      setStats(statsRes.data.stats)
    } catch (err) {
      setError('Failed to load verifications')
    } finally {
      setIsLoading(false)
    }
  }

  const viewDetail = async (id) => {
    try {
      setIsDetailLoading(true)
      const res = await api.get(`/verification/admin/${id}`)
      setSelectedVerification(res.data.verification)
      setError('')
    } catch (err) {
      setError('Failed to load verification details')
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      setIsProcessing(true)
      await api.post(`/verification/admin/${id}/approve`)
      setSuccess('Verification approved successfully')
      setSelectedVerification(null)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async (id) => {
    if (!rejectionReason.trim() || rejectionReason.length < 10) {
      setError('Rejection reason must be at least 10 characters')
      return
    }

    try {
      setIsProcessing(true)
      await api.post(`/verification/admin/${id}/reject`, { rejectionReason: rejectionReason.trim() })
      setSuccess('Verification rejected')
      setShowRejectModal(false)
      setRejectionReason('')
      setSelectedVerification(null)
      loadData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-amber-100 text-amber-700',
      UNDER_REVIEW: 'bg-blue-100 text-blue-700',
      APPROVED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status === 'PENDING' && <ClockIcon className="w-3 h-3" />}
        {status === 'APPROVED' && <CheckCircleIcon className="w-3 h-3" />}
        {status === 'REJECTED' && <XCircleIcon className="w-3 h-3" />}
        {status}
      </span>
    )
  }

  // ============================================
  // DETAIL VIEW
  // ============================================
  if (selectedVerification) {
    const v = selectedVerification
    const isFreelancer = v.user?.isFreelancer

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedVerification(null)}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Back to List
              </button>
              <div className="flex items-center gap-3">
                {getStatusBadge(v.status)}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3">
              <XCircleIcon className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm flex items-center gap-3">
              <CheckCircleIcon className="w-5 h-5 shrink-0" />
              {success}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: User Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Applicant Info</h3>
                <div className="flex items-center gap-4 mb-6">
                  {v.user?.avatar ? (
                    <img src={v.user.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                      <UserIcon className="w-8 h-8 text-emerald-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-gray-900">{v.user?.firstName} {v.user?.lastName}</p>
                    <p className="text-sm text-gray-500">{v.user?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isFreelancer ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isFreelancer ? 'FREELANCER' : 'BUYER'}
                      </span>
                      <span className="text-xs text-gray-400">
                        Joined {new Date(v.user?.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Account Type</span>
                    <span className="font-medium text-gray-900">{isFreelancer ? 'Freelancer (Strict)' : 'Buyer (Standard)'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rejection Count</span>
                    <span className={`font-medium ${v.user?.kycRejectionCount > 1 ? 'text-red-600' : 'text-gray-900'}`}>
                      {v.user?.kycRejectionCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Submitted</span>
                    <span className="font-medium text-gray-900">{new Date(v.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Document Info */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Document Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Document Type</span>
                    <span className="font-medium text-gray-900">{(v.idType || 'N/A').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Document Number</span>
                    <span className="font-medium text-gray-900 font-mono">{v.idNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              {v.status === 'PENDING' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Admin Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleApprove(v.id)}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          Approve Verification
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all disabled:opacity-50 active:scale-[0.98] border border-red-200"
                    >
                      <XMarkIcon className="w-5 h-5" />
                      Reject Verification
                    </button>
                  </div>
                </div>
              )}

              {v.status === 'APPROVED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 text-emerald-700">
                    <CheckCircleIcon className="w-6 h-6" />
                    <div>
                      <p className="font-bold">Approved</p>
                      <p className="text-sm">By {v.reviewedBy} on {new Date(v.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {v.reviewNote && (
                    <p className="mt-3 text-sm text-emerald-600">Notes: {v.reviewNote}</p>
                  )}
                </div>
              )}

              {v.status === 'REJECTED' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 text-red-700">
                    <XCircleIcon className="w-6 h-6" />
                    <div>
                      <p className="font-bold">Rejected</p>
                      <p className="text-sm">By {v.reviewedBy} on {new Date(v.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {v.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-100 rounded-lg">
                      <p className="text-xs font-bold text-red-600 mb-1">Reason:</p>
                      <p className="text-sm text-red-700">{v.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Document Images */}
            <div className="lg:col-span-2 space-y-6">
              {/* Document Front */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-emerald-600" />
                  Document Front
                </h3>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {v.idImageFront ? (
                    <img
                      src={v.idImageFront}
                      alt="Document Front"
                      className="w-full h-auto max-h-[500px] object-contain"
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No front image uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Document Back */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-emerald-600" />
                  Document Back
                </h3>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {v.idImageBack ? (
                    <img
                      src={v.idImageBack}
                      alt="Document Back"
                      className="w-full h-auto max-h-[500px] object-contain"
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No back image uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Selfie with ID (Freelancer only) */}
              {isFreelancer && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-emerald-600" />
                    Selfie with ID
                    <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">FREELANCER ONLY</span>
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    {v.selfieImage ? (
                      <img
                        src={v.selfieImage}
                        alt="Selfie with ID"
                        className="w-full h-auto max-h-[500px] object-contain"
                      />
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        No selfie uploaded
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reject Verification</h3>
                  <p className="text-sm text-gray-500">Please provide a reason for rejection</p>
                </div>
              </div>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Minimum 10 characters. Explain why this verification is being rejected..."
                className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectionReason('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(v.id)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Reject'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // LIST VIEW
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <ShieldCheckIcon className="w-8 h-8 text-emerald-600" />
                Document Verifications
              </h1>
              <p className="text-gray-500 mt-1">Review and approve identity verification requests</p>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Pending', value: stats.pending, color: 'amber' },
                { label: 'Under Review', value: stats.underReview, color: 'blue' },
                { label: 'Approved', value: stats.approved, color: 'emerald' },
                { label: 'Rejected', value: stats.rejected, color: 'red' },
              ].map((stat) => (
                <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-xl p-4`}>
                  <p className={`text-2xl font-bold text-${stat.color}-700`}>{stat.value}</p>
                  <p className={`text-sm font-medium text-${stat.color}-600`}>{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
            >
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3">
            <XCircleIcon className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 shrink-0" />
            {success}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading verifications...</p>
          </div>
        ) : verifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <ShieldCheckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No verifications found</h3>
            <p className="text-gray-500">No {statusFilter.toLowerCase()} verification requests at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">User</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Type</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Document</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Submitted</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {verifications.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {v.user?.avatar ? (
                            <img src={v.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <UserIcon className="w-5 h-5 text-emerald-600" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{v.user?.firstName} {v.user?.lastName}</p>
                            <p className="text-xs text-gray-500">{v.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          v.user?.isFreelancer ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {v.user?.isFreelancer ? 'Freelancer' : 'Buyer'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{(v.idType || 'Unknown').replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500 font-mono">{v.idNumber || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(v.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => viewDetail(v.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg hover:bg-emerald-100 transition-all"
                        >
                          <EyeIcon className="w-4 h-4" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Previous
              </button>
              <span className="text-sm text-gray-500 font-medium">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={verifications.length < 10}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Next
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminVerifications