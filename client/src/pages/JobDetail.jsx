import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  X,
  Trash2,
  Send,
  DollarSign,
  Clock,
  Calendar,
  User,
  Briefcase,
  CheckCircle2,
  MapPin,
  Pencil,
  Lock,
  ChevronRight,
  Check,
  XCircle,
  MessageSquare,
  Star,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [proposalData, setProposalData] = useState({
    coverLetter: '',
    proposedBudget: '',
    proposedDuration: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [hasProposed, setHasProposed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const isFreelancer = user?.role === 'freelancer' || user?.isFreelancer === true;
  const isBuyer = user?.role === 'buyer' || user?.isBuyer === true;
  const isJobOwner = job?.buyerId?.toString() === user?.id?.toString();
  const canEdit = isJobOwner || user?.isAdmin;
  const canDelete = isJobOwner || user?.isAdmin;
  const canApply = isAuthenticated && isFreelancer && !isJobOwner && job?.status === 'open';

  useEffect(() => {
    if (jobId) fetchJob();
  }, [jobId]);

  useEffect(() => {
    if (isJobOwner && job) fetchProposals();
  }, [isJobOwner, job]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/jobs/${jobId}`);
      const jobData = response.data.job;
      setJob(jobData);

      if (user && jobData.proposals) {
        const userProposal = jobData.proposals.find(
          (p) => p.freelancerId?.toString() === user.id?.toString()
        );
        setHasProposed(!!userProposal);
      }
    } catch (err) {
      console.error('Fetch job error:', err);
      setError(err.response?.data?.message || 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const fetchProposals = async () => {
    try {
      setProposalsLoading(true);
      const response = await api.get(`/proposals/job/${jobId}`);
      setProposals(response.data.proposals || []);
    } catch (err) {
      console.error('Fetch proposals error:', err);
      setProposals(job?.proposals || []);
    } finally {
      setProposalsLoading(false);
    }
  };

  const handleProposalAction = async (proposalId, action) => {
    try {
      setActionLoading(proposalId);
    await api.patch(`/proposals/${proposalId}/status`, { status: action === 'accept' ? 'accepted' : 'rejected' });
      toast.success(`Proposal ${action}ed successfully`);
      fetchProposals();
      fetchJob();
    } catch (err) {
      console.error(`Proposal ${action} error:`, err);
      toast.error(err.response?.data?.message || `Failed to ${action} proposal`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to apply');
      navigate('/login');
      return;
    }

    if (!proposalData.coverLetter.trim()) {
      toast.error('Cover letter is required');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/proposals/job/${jobId}`, {
        coverLetter: proposalData.coverLetter,
        proposedRate: proposalData.proposedBudget ? parseFloat(proposalData.proposedBudget) : null,
        proposedBudget: proposalData.proposedBudget ? parseFloat(proposalData.proposedBudget) : null,
        duration: proposalData.proposedDuration ? `${proposalData.proposedDuration} days` : null,
        proposedDuration: proposalData.proposedDuration ? parseInt(proposalData.proposedDuration) : null,
      });
      toast.success('Proposal submitted successfully!');
      setHasProposed(true);
      setShowApplyModal(false);
      setProposalData({ coverLetter: '', proposedBudget: '', proposedDuration: '' });
      fetchJob();
    } catch (err) {
      console.error('Submit proposal error:', err);
      toast.error(err.response?.data?.message || 'Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;

    try {
      setDeleting(true);
      await api.delete(`/jobs/${jobId}`);
      toast.success('Job deleted successfully');
      navigate('/jobs');
    } catch (err) {
      console.error('Delete job error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const formatBudget = (budget, type) => {
    if (!budget && budget !== 0) return 'Budget not specified';
    const typeLabel = type === 'hourly' ? '/hr' : type === 'retainer' ? '/mo' : '';
    return `₦${budget.toLocaleString()}${typeLabel}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'in_progress':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getProposalStatusStyle = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'withdrawn':
        return 'bg-gray-50 text-gray-500 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-gray-500 font-medium">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-lg shadow-emerald-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const displayProposals = proposals.length > 0 ? proposals : (job.proposals || []);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-700 transition-colors mb-4 text-sm font-medium"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-50 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Jobs
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-wide ${getStatusStyle(job.status)}`}>
                  {job.status.replace('_', ' ')}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  Posted {formatDate(job.createdAt)}
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 uppercase tracking-wide">
                  {job.budgetType || 'fixed'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {job.title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => navigate(`/jobs/${jobId}/edit`)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm active:scale-[0.98]"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all font-medium text-sm active:scale-[0.98] disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Description */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Job Description</h2>
              </div>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  {job.description}
                </p>
              </div>
            </div>

            {/* Skills Required */}
            {job.skills && job.skills.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <Star className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-gray-900">Skills Required</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-default"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Media Attachments */}
            {job.media && job.media.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-gray-900">Attachments</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {job.media.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="group">
                      <img
                        src={url}
                        alt={`Attachment ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-xl group-hover:opacity-90 transition-opacity border border-gray-100"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Link Preview */}
            {job.linkUrl && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <LinkIcon className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-gray-900">Reference Link</h2>
                </div>
                <a
                  href={job.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-4 p-5 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors group border border-gray-100 hover:border-emerald-200"
                >
                  {job.linkImage && (
                    <img
                      src={job.linkImage}
                      alt=""
                      className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-100"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                      {job.linkTitle || job.linkUrl}
                    </h4>
                    {job.linkDesc && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {job.linkDesc}
                      </p>
                    )}
                    <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3" />
                      {job.linkUrl}
                    </p>
                  </div>
                </a>
              </div>
            )}

            {/* Proposals Section - BUYER VIEW */}
            {isJobOwner && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                   <User className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-bold text-gray-900">
                      Proposals ({displayProposals.length})
                    </h2>
                  </div>
                  {proposalsLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                </div>

                {proposalsLoading && displayProposals.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : displayProposals.length > 0 ? (
                  <div className="space-y-5">
                    {displayProposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="border border-gray-100 rounded-2xl p-5 sm:p-6 hover:shadow-md hover:border-emerald-200 transition-all duration-200"
                      >
                        <div className="flex items-start gap-4">
                          <Link to={`/profile/${proposal.freelancer?.id}`} className="shrink-0">
                            {proposal.freelancer?.avatar ? (
                              <img
                                src={proposal.freelancer.avatar}
                                alt=""
                                className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-100"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-200">
                                {(proposal.freelancer?.firstName?.[0] || '')}{(proposal.freelancer?.lastName?.[0] || '')}
                              </div>
                            )}
                          </Link>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <Link
                                  to={`/profile/${proposal.freelancer?.id}`}
                                  className="font-bold text-gray-900 hover:text-emerald-700 transition-colors text-lg"
                                >
                                  {proposal.freelancer?.firstName} {proposal.freelancer?.lastName}
                                </Link>
                                {proposal.freelancer?.headline && (
                                  <p className="text-sm text-gray-500">{proposal.freelancer.headline}</p>
                                )}
                              </div>
                              <span className={`text-xs px-3 py-1.5 rounded-full border font-bold shrink-0 ${getProposalStatusStyle(proposal.status)}`}>
                                {proposal.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                              {(proposal.proposedBudget || proposal.proposedRate) && (
                                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-semibold border border-emerald-100">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  ₦{(proposal.proposedBudget || proposal.proposedRate || 0).toLocaleString()}
                                </span>
                              )}
                              {(proposal.proposedDuration || proposal.duration) && (
                                <span className="flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-100">
                                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                                  {proposal.proposedDuration || proposal.duration} days
                                </span>
                              )}
                            </div>

                            <div className="mt-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {proposal.coverLetter}
                              </p>
                            </div>

                            {proposal.status === 'pending' && job.status === 'open' && (
                              <div className="flex flex-wrap gap-2 mt-5">
                                <button
                                  onClick={() => handleProposalAction(proposal.id, 'accept')}
                                  disabled={actionLoading === proposal.id}
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 disabled:opacity-50 active:scale-[0.98]"
                                >
                                  {actionLoading === proposal.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )}
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleProposalAction(proposal.id, 'reject')}
                                  disabled={actionLoading === proposal.id}
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all disabled:opacity-50 active:scale-[0.98]"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </button>
                                <Link
                                  to={`/messages?to=${proposal.freelancer?.id}`}
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all active:scale-[0.98]"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Message
                                </Link>
                              </div>
                            )}

                            {proposal.status === 'accepted' && (
                              <div className="flex flex-wrap gap-2 mt-5">
                                <Link
                                  to={`/messages?to=${proposal.freelancer?.id}`}
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 active:scale-[0.98]"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Message Freelancer
                                </Link>
                                <Link
                                  to={`/contracts/create?job=${jobId}&proposal=${proposal.id}`}
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition-all active:scale-[0.98]"
                                >
                                  <Briefcase className="w-3.5 h-3.5" />
                                  Create Contract
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No proposals yet</p>
                    <p className="text-sm text-gray-400 mt-1">Freelancers will appear here once they apply</p>
                  </div>
                )}
              </div>
            )}

            {/* Freelancer's own proposal view */}
            {!isJobOwner && hasProposed && job.proposals && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-5 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-700">You have submitted a proposal for this job</span>
                </div>
                {job.proposals
                  .filter((p) => p.freelancerId?.toString() === user?.id?.toString())
                  .map((proposal) => (
                    <div key={proposal.id} className="border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs px-3 py-1 rounded-full border font-bold ${getProposalStatusStyle(proposal.status)}`}>
                          {proposal.status}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Submitted {formatDate(proposal.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {proposal.coverLetter}
                      </p>
                      <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
                        {proposal.proposedBudget && (
                          <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <DollarSign className="w-3.5 h-3.5" />
                            ₦{proposal.proposedBudget.toLocaleString()}
                          </span>
                        )}
                        {proposal.proposedDuration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {proposal.proposedDuration} days
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Apply Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="space-y-5">
                <div className="flex items-center gap-3 text-gray-900 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Budget</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {formatBudget(job.budget, job.budgetType)}
                    </p>
                  </div>
                </div>

                {job.location && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Location</p>
                      <p className="text-sm font-semibold text-gray-700">{job.location}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Type</p>
                    <p className="text-sm font-semibold text-gray-700 capitalize">{job.budgetType} budget</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-600">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Proposals</p>
                    <p className="text-sm font-semibold text-gray-700">{displayProposals.length} submitted</p>
                  </div>
                </div>

                <div className="pt-5 border-t border-gray-100">
                  {!isAuthenticated && (
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-200 active:scale-[0.98]"
                    >
                      <Lock className="w-4 h-4" />
                      Login to Apply
                    </button>
                  )}

                  {isAuthenticated && isJobOwner && (
                    <div className="text-center py-4 px-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-semibold text-gray-600">You posted this job</p>
                      <p className="text-xs text-gray-400 mt-1">Proposals are shown below</p>
                    </div>
                  )}

                  {isAuthenticated && !isJobOwner && !isFreelancer && (
                    <div className="text-center py-4 px-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-semibold text-gray-600">Only freelancers can apply</p>
                    </div>
                  )}

                  {canApply && hasProposed && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                        You already applied
                      </div>
                      <Link
                        to="/proposals"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-all font-semibold text-sm active:scale-[0.98]"
                      >
                        View My Proposals
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}

                  {canApply && !hasProposed && job.status === 'open' && (
                    <button
                      onClick={() => setShowApplyModal(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-200 active:scale-[0.98]"
                    >
                      <Send className="w-4 h-4" />
                      Apply Now
                    </button>
                  )}

                  {canApply && !hasProposed && job.status !== 'open' && (
                    <div className="text-center py-4 px-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm text-gray-400">This job is no longer accepting proposals</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* About Client */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                About Client
              </h3>
              <Link
                to={`/profile/${job.buyer?.id}`}
                className="flex items-center gap-4 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform">
                  {job.buyer?.avatar ? (
                    <img
                      src={job.buyer.avatar}
                      alt=""
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    `${job.buyer?.firstName?.[0] || ''}${job.buyer?.lastName?.[0] || ''}`
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {job.buyer?.firstName} {job.buyer?.lastName}
                  </p>
                  {job.buyer?.headline && (
                    <p className="text-sm text-gray-500 truncate">{job.buyer.headline}</p>
                  )}
                </div>
              </Link>
            </div>

            {/* Activity */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Activity
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Posted</span>
                  <span className="font-semibold text-gray-700">{formatDate(job.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Proposals</span>
                  <span className="font-semibold text-gray-700">{displayProposals.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status</span>
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold capitalize ${getStatusStyle(job.status)}`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Submit Proposal</h2>
                <p className="text-sm text-gray-500 mt-0.5">Apply for: {job.title}</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleApply} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Cover Letter <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={proposalData.coverLetter}
                  onChange={(e) => setProposalData({ ...proposalData, coverLetter: e.target.value })}
                  rows={6}
                  placeholder="Introduce yourself and explain why you're a great fit for this job..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none text-sm transition-all"
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5 text-right">
                  {proposalData.coverLetter.length}/2000 characters
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Proposed Budget (₦)
                  </label>
                  <input
                    type="number"
                    value={proposalData.proposedBudget}
                    onChange={(e) => setProposalData({ ...proposalData, proposedBudget: e.target.value })}
                    placeholder="e.g. 50000"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1">Optional</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Duration (days)
                  </label>
                  <input
                    type="number"
                    value={proposalData.proposedDuration}
                    onChange={(e) => setProposalData({ ...proposalData, proposedDuration: e.target.value })}
                    placeholder="e.g. 14"
                    min="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1">Optional</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Proposal
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;