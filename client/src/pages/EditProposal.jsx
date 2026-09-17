import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Save,
  DollarSign,
  Clock,
  FileText,
  Briefcase,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const EditProposal = () => {
  const { proposalId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [proposal, setProposal] = useState(null)
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    coverLetter: '',
    proposedBudget: '',
    proposedDuration: '',
  })

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
    fetchProposal()
  }, [isAuthenticated, isFreelancer, proposalId])

  const fetchProposal = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await api.get('/proposals/my-proposals')
      const foundProposal = response.data.proposals.find(p => p.id === proposalId)

      if (!foundProposal) {
        setError('Proposal not found')
        setLoading(false)
        return
      }

      if (foundProposal.status !== 'pending') {
        setError('This proposal can no longer be edited')
        setLoading(false)
        return
      }

      if (foundProposal.job.status !== 'open') {
        setError('This job is no longer open for edits')
        setLoading(false)
        return
      }

      setProposal(foundProposal)
      setJob(foundProposal.job)
      setFormData({
        coverLetter: foundProposal.coverLetter || '',
        proposedBudget: foundProposal.proposedBudget || foundProposal.proposedRate || '',
        proposedDuration: foundProposal.proposedDuration || '',
      })
    } catch (err) {
      console.error('Fetch proposal error:', err)
      setError(err.response?.data?.message || 'Failed to load proposal')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.coverLetter.trim()) {
      toast.error('Cover letter is required')
      return
    }

    try {
      setSaving(true)

      const payload = {
        coverLetter: formData.coverLetter.trim(),
      }

      if (formData.proposedBudget) {
        payload.proposedBudget = parseFloat(formData.proposedBudget)
      }

      if (formData.proposedDuration) {
        payload.proposedDuration = parseInt(formData.proposedDuration)
      }

      await api.patch(`/proposals/${proposalId}`, payload)
      toast.success('Proposal updated successfully!')
      navigate('/proposals')
    } catch (err) {
      console.error('Update error:', err)
      toast.error(err.response?.data?.message || 'Failed to update proposal')
    } finally {
      setSaving(false)
    }
  }

  const getJobStatusConfig = (status) => {
    switch (status) {
      case 'open':
        return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Open' }
      case 'in_progress':
        return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'In Progress' }
      case 'completed':
        return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Completed' }
      case 'cancelled':
        return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Cancelled' }
      default:
        return { color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', label: status }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-gray-500 font-medium">Loading proposal...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cannot Edit Proposal</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/proposals')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-lg shadow-emerald-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Proposals
          </button>
        </div>
      </div>
    )
  }

  const statusConfig = getJobStatusConfig(job?.status)

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <button
            onClick={() => navigate('/proposals')}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-700 transition-colors text-sm font-medium mb-4"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-50 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span>Back to Proposals</span>
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                Edit Proposal
              </h1>
              <p className="text-gray-500 mt-1">
                Update your application for this job
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.color.replace('text-', 'bg-')}`} />
              Job {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Job Info Card */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to={`/jobs/${job?.id}`}
                className="text-lg font-bold text-gray-900 hover:text-emerald-600 transition-colors"
              >
                {job?.title}
              </Link>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Budget: ₦{job?.budget?.toLocaleString()}
                </span>
                <span className="text-gray-300">•</span>
                <span className="capitalize">{job?.budgetType}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            {/* Cover Letter */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Cover Letter
                </span>
              </label>
              <textarea
                name="coverLetter"
                value={formData.coverLetter}
                onChange={handleChange}
                rows={8}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                placeholder="Tell the client why you're the best fit for this job..."
                maxLength={5000}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {formData.coverLetter.length}/5000
              </p>
            </div>

            {/* Budget & Duration Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Your Budget (₦)
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₦</span>
                  <input
                    type="number"
                    name="proposedBudget"
                    value={formData.proposedBudget}
                    onChange={handleChange}
                    min="0"
                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="Enter your rate"
                  />
                </div>
                {job?.budgetType === 'hourly' && (
                  <p className="text-xs text-gray-400 mt-1">per hour</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    Duration (days)
                  </span>
                </label>
                <input
                  type="number"
                  name="proposedDuration"
                  value={formData.proposedDuration}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="e.g. 14"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 p-6 sm:p-8 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate('/proposals')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-semibold text-sm shadow-sm shadow-emerald-200 disabled:opacity-50 active:scale-95"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditProposal