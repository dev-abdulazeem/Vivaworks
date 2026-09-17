import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Check,
  X,
  DollarSign,
  Clock,
  Calendar,
  User,
  Briefcase,
  Star,
  Mail,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Award,
  MessageSquare,
  TrendingUp,
  Shield,
  MapPin,
  FileText,
  ThumbsUp,
  Bookmark,
  MoreHorizontal,
  Filter,
  Search,
  Sparkles
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const JobProposals = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [job, setJob] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isBuyer = user?.role === 'buyer' || user?.isBuyer === true;
  const isJobOwner = job?.buyerId === user?.id;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!isBuyer) {
      navigate('/');
      return;
    }
    fetchJobAndProposals();
  }, [jobId, isAuthenticated, isBuyer]);

  const fetchJobAndProposals = async () => {
    try {
      setLoading(true);
      setError(null);

      const [jobRes, proposalsRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/proposals/job/${jobId}`)
      ]);

      setJob(jobRes.data.job);
      setProposals(proposalsRes.data.proposals);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (proposalId) => {
    if (!window.confirm('Accept this proposal and send a job offer?')) return;

    try {
      setProcessingId(proposalId);
      await api.patch(`/proposals/${proposalId}/status`, { status: 'accepted' });
      toast.success('Proposal accepted! Job offer sent to freelancer.');
      fetchJobAndProposals();
    } catch (err) {
      console.error('Accept error:', err);
      toast.error(err.response?.data?.message || 'Failed to accept proposal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (proposalId) => {
    if (!window.confirm('Reject this proposal?')) return;

    try {
      setProcessingId(proposalId);
      await api.patch(`/proposals/${proposalId}/status`, { status: 'rejected' });
      toast.success('Proposal rejected');
      fetchJobAndProposals();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error(err.response?.data?.message || 'Failed to reject proposal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleShortlist = async (proposalId) => {
    try {
      setProcessingId(proposalId);
      await api.patch(`/proposals/${proposalId}/status`, { status: 'shortlisted' });
      toast.success('Proposal shortlisted');
      fetchJobAndProposals();
    } catch (err) {
      console.error('Shortlist error:', err);
      toast.error(err.response?.data?.message || 'Failed to shortlist');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMessage = (freelancerId) => {
    navigate(`/messages/${freelancerId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          dot: 'bg-amber-500',
          label: 'Pending Review',
        };
      case 'shortlisted':
        return {
          icon: <Star className="w-3.5 h-3.5" />,
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Shortlisted',
        };
      case 'accepted':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-200',
          dot: 'bg-green-500',
          label: 'Hired',
        };
      case 'rejected':
        return {
          icon: <XCircle className="w-3.5 h-3.5" />,
          bg: 'bg-gray-50',
          text: 'text-gray-500',
          border: 'border-gray-200',
          dot: 'bg-gray-400',
          label: 'Declined',
        };
      default:
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          bg: 'bg-gray-50',
          text: 'text-gray-600',
          border: 'border-gray-200',
          dot: 'bg-gray-400',
          label: status,
        };
    }
  };

  const filteredProposals = proposals.filter(p => {
    if (activeFilter !== 'all' && p.status !== activeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = `${p.freelancer?.firstName} ${p.freelancer?.lastName}`.toLowerCase();
      return name.includes(query) || p.coverLetter?.toLowerCase().includes(query);
    }
    return true;
  });

  const pendingCount = proposals.filter(p => p.status === 'pending').length;
  const shortlistedCount = proposals.filter(p => p.status === 'shortlisted').length;
  const acceptedCount = proposals.filter(p => p.status === 'accepted').length;
  const rejectedCount = proposals.filter(p => p.status === 'rejected').length;

  const filters = [
    { key: 'all', label: 'All Proposals', count: proposals.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'shortlisted', label: 'Shortlisted', count: shortlistedCount },
    { key: 'accepted', label: 'Hired', count: acceptedCount },
    { key: 'rejected', label: 'Declined', count: rejectedCount },
  ];

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
          <p className="text-gray-500 font-medium">Loading proposals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
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

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(`/jobs/${jobId}`)}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-700 transition-colors text-sm font-medium"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-50 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline">Back to Job</span>
            </button>
            
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                {proposals.length} {proposals.length === 1 ? 'Proposal' : 'Proposals'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Job Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-100">
                  {job.category || 'Job Posting'}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  Posted {formatDate(job.createdAt)}
                </span>
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-2">
                {job.title}
              </h1>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed max-w-2xl">
                Review and manage proposals from talented freelancers interested in your project
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-700">{pendingCount}</p>
                  <p className="text-xs text-amber-600 font-medium">Pending</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Star className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-700">{shortlistedCount}</p>
                  <p className="text-xs text-emerald-600 font-medium">Shortlisted</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-100">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-green-700">{acceptedCount}</p>
                  <p className="text-xs text-green-600 font-medium">Hired</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 overflow-x-auto">
            {filters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === filter.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {filter.label}
                <span className={`ml-1.5 text-xs ${activeFilter === filter.key ? 'text-emerald-200' : 'text-gray-400'}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search freelancers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Proposals List */}
        {filteredProposals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Briefcase className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery ? 'No matching proposals' : 'No proposals yet'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
              {searchQuery 
                ? 'Try adjusting your search terms or filters to find what you are looking for.'
                : 'No freelancers have applied to this job yet. Share your job posting to attract more candidates.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProposals.map((proposal) => {
              const statusConfig = getStatusConfig(proposal.status);
              const isProcessing = processingId === proposal.id;
              const initials = `${proposal.freelancer?.firstName?.[0] || ''}${proposal.freelancer?.lastName?.[0] || ''}`;

              return (
                <div
                  key={proposal.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 ${
                    proposal.status === 'accepted'
                      ? 'border-green-300 shadow-lg shadow-green-50'
                      : proposal.status === 'shortlisted'
                      ? 'border-emerald-200 shadow-md shadow-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                  }`}
                >
                  <div className="p-6 sm:p-7">
                    <div className="flex flex-col xl:flex-row xl:items-start gap-6">
                      
                      {/* Left: Avatar & Main Info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-200">
                            {proposal.freelancer?.avatar ? (
                              <img
                                src={proposal.freelancer.avatar}
                                alt=""
                                className="w-full h-full rounded-2xl object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </div>
                          {proposal.status === 'accepted' && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name & Status Row */}
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 text-lg truncate">
                                {proposal.freelancer?.firstName} {proposal.freelancer?.lastName}
                              </h3>
                              {proposal.freelancer?.headline && (
                                <p className="text-sm text-gray-500 truncate">
                                  {proposal.freelancer.headline}
                                </p>
                              )}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                              {statusConfig.label}
                            </span>
                          </div>

                          {/* Meta Info */}
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                            {(proposal.proposedBudget || proposal.proposedRate) && (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold text-sm border border-emerald-100">
                                <DollarSign className="w-4 h-4" />
                                ₦{(proposal.proposedBudget || proposal.proposedRate || 0).toLocaleString()}
                                {job.budgetType === 'hourly' && '/hr'}
                              </span>
                            )}
                            {(proposal.proposedDuration || proposal.duration) && (
                              <span className="flex items-center gap-1.5 text-gray-500">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {proposal.proposedDuration || proposal.duration}
                                {proposal.proposedDuration && ' days'}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 text-gray-400">
                              <Calendar className="w-4 h-4" />
                              {formatDate(proposal.createdAt)}
                            </span>
                          </div>

                          {/* Skills */}
                          {proposal.freelancer?.skills && proposal.freelancer.skills.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {proposal.freelancer.skills.slice(0, 6).map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-100"
                                >
                                  {skill}
                                </span>
                              ))}
                              {proposal.freelancer.skills.length > 6 && (
                                <span className="px-2.5 py-1 text-gray-400 text-xs font-medium">
                                  +{proposal.freelancer.skills.length - 6}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Cover Letter */}
                          <div className="mt-5 p-5 bg-gray-50/80 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cover Letter</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {proposal.coverLetter}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex xl:flex-col gap-2 xl:w-48 shrink-0">
                        {proposal.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAccept(proposal.id)}
                              disabled={isProcessing}
                              className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-semibold text-sm shadow-sm shadow-emerald-200 disabled:opacity-50 active:scale-95"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Accept & Hire
                            </button>
                            
                            <button
                              onClick={() => handleShortlist(proposal.id)}
                              disabled={isProcessing}
                              className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-emerald-700 border-2 border-emerald-100 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-all font-semibold text-sm disabled:opacity-50 active:scale-95"
                            >
                              <Star className="w-4 h-4" />
                              Shortlist
                            </button>
                            
                            <button
                              onClick={() => handleReject(proposal.id)}
                              disabled={isProcessing}
                              className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-medium text-sm disabled:opacity-50 active:scale-95"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </>
                        )}

                        {proposal.status === 'shortlisted' && (
                          <>
                            <button
                              onClick={() => handleAccept(proposal.id)}
                              disabled={isProcessing}
                              className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-semibold text-sm shadow-sm shadow-emerald-200 disabled:opacity-50 active:scale-95"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Accept & Hire
                            </button>
                            
                            <button
                              onClick={() => handleReject(proposal.id)}
                              disabled={isProcessing}
                              className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-medium text-sm disabled:opacity-50 active:scale-95"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </>
                        )}

                        {proposal.status === 'accepted' && (
                          <div className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl font-semibold text-sm">
                            <Award className="w-4 h-4" />
                            Hired
                          </div>
                        )}

                        {proposal.status === 'rejected' && (
                          <div className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-400 border border-gray-200 rounded-xl font-medium text-sm">
                            <XCircle className="w-4 h-4" />
                            Declined
                          </div>
                        )}

                        <button
                          onClick={() => handleMessage(proposal.freelancer?.id)}
                          className="flex-1 xl:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-sm active:scale-95"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Message
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobProposals;