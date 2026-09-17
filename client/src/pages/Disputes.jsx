import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  ArrowLeft,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Scale,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  DollarSign,
  MessageSquare,
  Calendar,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  FileText,
  TrendingUp,
  Users,
  Ban,
  Image as ImageIcon,
  File,
  Download,
  ZoomIn,
  Send,
  Upload,
  Trash2,
  ChevronRight,
  Gavel,
  Wallet,
  RotateCcw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function Disputes() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [resolving, setResolving] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [submittingReply, setSubmittingReply] = useState(false);
  const replyFileInputRef = useRef(null);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/disputes/admin/disputes');
      setDisputes(res.data.disputes || []);
    } catch (err) {
      console.error('Fetch disputes error:', err);
      toast.error(err.response?.data?.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const filteredDisputes = disputes.filter((d) => {
    const matchesSearch =
      d.contract?.job?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contract?.buyer?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contract?.buyer?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contract?.freelancer?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contract?.freelancer?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status) => {
    switch (status) {
      case 'open':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          dot: 'bg-amber-500',
          icon: Clock,
          label: 'Open',
        };
      case 'under_review':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          dot: 'bg-blue-500',
          icon: Eye,
          label: 'Under Review',
        };
      case 'resolved':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
          icon: CheckCircle,
          label: 'Resolved',
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          dot: 'bg-gray-400',
          icon: AlertCircle,
          label: status,
        };
    }
  };

  const getResolutionLabel = (res) => {
    switch (res) {
      case 'buyer_wins':
        return 'Buyer Wins — Full Refund';
      case 'freelancer_wins':
        return 'Freelancer Wins — Full Payout';
      case 'split':
        return 'Split — 50/50';
      case 'custom':
        return 'Custom Refund';
      default:
        return res;
    }
  };

  const getResolutionColor = (res) => {
    switch (res) {
      case 'buyer_wins':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'freelancer_wins':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'split':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'custom':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleUpdateStatus = async (disputeId, newStatus) => {
    try {
      setStatusUpdating(true);
      await api.patch(`/disputes/admin/disputes/${disputeId}/status`, {
        status: newStatus,
      });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      fetchDisputes();
      if (selectedDispute?.id === disputeId) {
        const refreshed = await api.get(`/disputes/${disputeId}`);
        setSelectedDispute(refreshed.data.dispute);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleResolve = async () => {
    if (!resolution) {
      toast.error('Please select a resolution');
      return;
    }
    try {
      setResolving(true);
      const body = { resolution, adminNotes: adminNotes.trim() || undefined };
      if (resolution === 'custom' && refundAmount) {
        body.refundAmount = parseFloat(refundAmount);
      }
      await api.patch(
        `/disputes/admin/disputes/${selectedDispute.id}/resolve`,
        body
      );
      toast.success('Dispute resolved successfully');
      setShowResolveModal(false);
      setSelectedDispute(null);
      setResolution('');
      setAdminNotes('');
      setRefundAmount('');
      fetchDisputes();
      setExpandedRow(null);
    } catch (err) {
      console.error('Resolve dispute error:', err);
      toast.error(err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  };

  const handleAddAdminReply = async (disputeId) => {
    if (!replyContent.trim() && replyFiles.length === 0) {
      toast.error('Please add a message or upload files');
      return;
    }
    try {
      setSubmittingReply(true);
      const formData = new FormData();
      if (replyContent.trim()) formData.append('content', replyContent.trim());
      replyFiles.forEach((f) => formData.append('files', f.file));

      await api.post(`/disputes/${disputeId}/reply`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Reply added');
      setReplyContent('');
      setReplyFiles([]);
      
      // Refresh
      const refreshed = await api.get(`/disputes/${disputeId}`);
      setSelectedDispute(refreshed.data.dispute);
      
      // Update in list too
      fetchDisputes();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const openResolveModal = (dispute) => {
    setSelectedDispute(dispute);
    setShowResolveModal(true);
  };

  const handleReplyFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 20 * 1024 * 1024;
    const valid = [];
    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 20MB`);
        continue;
      }
      valid.push({
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      });
    }
    setReplyFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  };

  const removeReplyFile = (index) => {
    setReplyFiles((prev) => {
      const f = prev[index];
      if (f.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₦0';
    return `₦${Number(amount).toLocaleString()}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(Number(bytes))) return '';
    const num = Number(bytes);
    if (num === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(1024));
    const size = (num / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
    return `${size} ${sizes[i]}`;
  };

  const isImageFile = (type, url) => {
    if (type?.startsWith('image/')) return true;
    if (!url) return false;
    const ext = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  };

  const getFileIcon = (type, url) => {
    if (isImageFile(type, url)) return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    return <File className="w-4 h-4 text-blue-500" />;
  };

  const handleDownload = (url, name) => {
    if (!url) {
      toast.error('File not available');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = name || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = [
    {
      label: 'Total Disputes',
      value: disputes.length,
      icon: Scale,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Open',
      value: disputes.filter((d) => d.status === 'open').length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Under Review',
      value: disputes.filter((d) => d.status === 'under_review').length,
      icon: Eye,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Resolved',
      value: disputes.filter((d) => d.status === 'resolved').length,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const getFullName = (user) => {
    if (!user) return 'Unknown';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
  };

  const resolutionOptions = [
    { value: 'buyer_wins', label: 'Buyer Wins', desc: 'Full refund to buyer', icon: Wallet },
    { value: 'freelancer_wins', label: 'Freelancer Wins', desc: 'Full payout to freelancer', icon: CheckCircle },
    { value: 'split', label: 'Split 50/50', desc: 'Equal split between parties', icon: Scale },
    { value: 'custom', label: 'Custom', desc: 'Specify refund amount', icon: Gavel },
  ];

  // Timeline steps
  const getTimelineSteps = (status) => {
    const steps = [
      { key: 'open', label: 'Open', icon: Clock },
      { key: 'under_review', label: 'Under Review', icon: Eye },
      { key: 'resolved', label: 'Resolved', icon: CheckCircle },
    ];
    const currentIndex = steps.findIndex((s) => s.key === status);
    return steps.map((step, i) => ({
      ...step,
      completed: i <= currentIndex,
      active: i === currentIndex,
    }));
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 text-gray-500 hover:text-emerald-700 transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-gray-50 group-hover:bg-emerald-50 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Dashboard</span>
              </button>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Disputes Center</h1>
                  <p className="text-xs text-gray-500">Manage and resolve platform disputes</p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchDisputes}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:text-emerald-700 transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md hover:border-emerald-200 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by contract, buyer, freelancer, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Disputes Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">Loading disputes...</p>
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <Scale className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No disputes found</h3>
              <p className="text-sm text-gray-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'There are no disputes on the platform yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                      Contract
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                      Parties
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                      Amount
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                      Date
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDisputes.map((dispute) => {
                    const statusConfig = getStatusConfig(dispute.status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <>
                        <tr key={dispute.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-100">
                                <Briefcase className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {dispute.contract?.job?.title || 'Untitled Contract'}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                  {dispute.contractId?.slice(0, 8)}...
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                  <User className="w-3.5 h-3.5 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-700">
                                    {getFullName(dispute.contract?.buyer)}
                                  </p>
                                  <p className="text-[10px] text-gray-400">Buyer</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                                  <User className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-700">
                                    {getFullName(dispute.contract?.freelancer)}
                                  </p>
                                  <p className="text-[10px] text-gray-400">Freelancer</p>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900">
                              {formatCurrency(dispute.contract?.amount)}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(dispute.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setExpandedRow(expandedRow === dispute.id ? null : dispute.id);
                                  if (expandedRow !== dispute.id) {
                                    setSelectedDispute(dispute);
                                  }
                                }}
                                className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
                                title="View Details"
                              >
                                {expandedRow === dispute.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                              {dispute.status !== 'resolved' && (
                                <button
                                  onClick={() => openResolveModal(dispute)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-sm shadow-emerald-100"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Details Panel */}
                        {expandedRow === dispute.id && (
                          <tr>
                            <td colSpan={6} className="px-6 py-0">
                              <div className="py-6 border-t border-gray-100">
                                {/* Status Timeline */}
                                <div className="mb-6">
                                  <div className="flex items-center gap-0">
                                    {getTimelineSteps(dispute.status).map((step, i, arr) => (
                                      <div key={step.key} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center flex-1">
                                          <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                                              step.completed
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : step.active
                                                ? 'bg-white border-emerald-500 text-emerald-600'
                                                : 'bg-white border-gray-200 text-gray-300'
                                            }`}
                                          >
                                            <step.icon className="w-4 h-4" />
                                          </div>
                                          <p
                                            className={`text-xs font-medium mt-2 ${
                                              step.completed || step.active ? 'text-gray-700' : 'text-gray-400'
                                            }`}
                                          >
                                            {step.label}
                                          </p>
                                        </div>
                                        {i < arr.length - 1 && (
                                          <div
                                            className={`flex-1 h-0.5 mx-2 ${
                                              step.completed ? 'bg-emerald-500' : 'bg-gray-200'
                                            }`}
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Left Column */}
                                  <div className="space-y-6">
                                    {/* Dispute Reason */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        </div>
                                        Dispute Reason
                                      </h4>
                                      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                          {dispute.reason || 'No reason provided'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Evidence Gallery */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                                          <ImageIcon className="w-4 h-4 text-blue-600" />
                                        </div>
                                        Evidence ({(dispute.evidenceMeta?.length || dispute.evidence?.length || 0)})
                                      </h4>
                                      
                                      {(dispute.evidenceMeta?.length > 0 || dispute.evidence?.length > 0) ? (
                                        <div className="space-y-3">
                                          {/* Images */}
                                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {(dispute.evidenceMeta || dispute.evidence || []).map((ev, i) => {
                                              const meta = typeof ev === 'string' ? { url: ev, name: `Evidence ${i + 1}`, type: 'unknown' } : ev;
                                              if (!isImageFile(meta.type, meta.url)) return null;
                                              return (
                                                <div
                                                  key={i}
                                                  className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer bg-gray-100"
                                                  onClick={() => setPreviewImage(meta.url)}
                                                >
                                                  <img
                                                    src={meta.url}
                                                    alt={meta.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    loading="lazy"
                                                  />
                                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <ZoomIn className="w-5 h-5 text-white" />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                          
                                          {/* Documents */}
                                          <div className="space-y-2">
                                            {(dispute.evidenceMeta || dispute.evidence || []).map((ev, i) => {
                                              const meta = typeof ev === 'string' ? { url: ev, name: `Evidence ${i + 1}`, type: 'unknown', size: 0 } : ev;
                                              if (isImageFile(meta.type, meta.url)) return null;
                                              return (
                                                <div
                                                  key={i}
                                                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
                                                  onClick={() => handleDownload(meta.url, meta.name)}
                                                >
                                                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <File className="w-5 h-5 text-blue-500" />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 truncate">
                                                      {meta.name || `File ${i + 1}`}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                      {formatFileSize(meta.size)}
                                                    </p>
                                                  </div>
                                                  <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-400 italic">No evidence uploaded</p>
                                      )}
                                    </div>

                                    {/* Reply Thread */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100">
                                          <MessageSquare className="w-4 h-4 text-purple-600" />
                                        </div>
                                        Reply Thread ({dispute.replies?.length || 0})
                                      </h4>
                                      
                                      {dispute.replies?.length > 0 ? (
                                        <div className="space-y-3">
                                          {dispute.replies.map((reply, i) => (
                                            <div
                                              key={reply.id}
                                              className={`p-4 rounded-xl border ${
                                                reply.senderId === dispute.filedById
                                                  ? 'bg-amber-50 border-amber-200'
                                                  : 'bg-gray-50 border-gray-200'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 mb-2">
                                                <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                                                  <span className="text-[10px] font-bold text-gray-600">
                                                    {reply.sender?.firstName?.[0]}
                                                    {reply.sender?.lastName?.[0]}
                                                  </span>
                                                </div>
                                                <div>
                                                  <p className="text-xs font-semibold text-gray-900">
                                                    {getFullName(reply.sender)}
                                                    {reply.senderId === dispute.filedById && (
                                                      <span className="ml-1 text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                                        Filer
                                                      </span>
                                                    )}
                                                  </p>
                                                  <p className="text-[10px] text-gray-400">{formatDate(reply.createdAt)}</p>
                                                </div>
                                              </div>
                                              {reply.content && (
                                                <p className="text-sm text-gray-700 mb-2">{reply.content}</p>
                                              )}
                                              {reply.files?.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                  {(reply.fileMeta || reply.files).map((file, fi) => {
                                                    const meta = typeof file === 'string' ? { url: file, name: `File ${fi + 1}`, type: 'unknown' } : file;
                                                    return (
                                                      <button
                                                        key={fi}
                                                        onClick={() => isImageFile(meta.type, meta.url) ? setPreviewImage(meta.url) : handleDownload(meta.url, meta.name)}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs hover:border-purple-300 transition-colors"
                                                      >
                                                        {getFileIcon(meta.type, meta.url)}
                                                        <span className="truncate max-w-[120px]">{meta.name}</span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-400 italic">No replies yet</p>
                                      )}

                                      {/* Admin Reply Input */}
                                      {dispute.status !== 'resolved' && (
                                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                          <p className="text-xs font-semibold text-gray-700 mb-2">Add Admin Note / Reply</p>
                                          <textarea
                                            value={replyContent}
                                            onChange={(e) => setReplyContent(e.target.value)}
                                            placeholder="Type your message..."
                                            rows={2}
                                            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-2"
                                          />
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="file"
                                                multiple
                                                accept="image/*,application/pdf"
                                                ref={replyFileInputRef}
                                                onChange={handleReplyFileSelect}
                                                className="hidden"
                                              />
                                              <button
                                                onClick={() => replyFileInputRef.current?.click()}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                              >
                                                <Upload className="w-3.5 h-3.5" />
                                                Attach
                                              </button>
                                              {replyFiles.length > 0 && (
                                                <span className="text-xs text-gray-500">
                                                  {replyFiles.length} file{replyFiles.length !== 1 ? 's' : ''}
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => handleAddAdminReply(dispute.id)}
                                              disabled={submittingReply || (!replyContent.trim() && replyFiles.length === 0)}
                                              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                            >
                                              {submittingReply ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              ) : (
                                                <Send className="w-3.5 h-3.5" />
                                              )}
                                              Send
                                            </button>
                                          </div>
                                          {replyFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                              {replyFiles.map((f, i) => (
                                                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs">
                                                  {f.preview ? (
                                                    <img src={f.preview} alt="" className="w-4 h-4 rounded object-cover" />
                                                  ) : (
                                                    <File className="w-3.5 h-3.5 text-gray-400" />
                                                  )}
                                                  <span className="truncate max-w-[100px]">{f.name}</span>
                                                  <button onClick={() => removeReplyFile(i)} className="text-gray-400 hover:text-red-500">
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Column */}
                                  <div className="space-y-6">
                                    {/* Contract Info */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                          <FileText className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        Contract Info
                                      </h4>
                                      <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-4">
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-500">Contract ID</span>
                                          <span className="text-xs font-mono text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-lg">
                                            {dispute.contractId}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-500">Contract Amount</span>
                                          <span className="text-sm font-bold text-gray-900">
                                            {formatCurrency(dispute.contract?.amount)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-500">Escrow Amount</span>
                                          <span className="text-sm font-bold text-emerald-600">
                                            {formatCurrency(dispute.contract?.escrowAmount)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-500">Contract Status</span>
                                          <span className="text-xs font-medium text-gray-700 capitalize bg-white border border-gray-200 px-2 py-1 rounded-lg">
                                            {dispute.contract?.status?.replace('_', ' ') || 'N/A'}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-500">Created</span>
                                          <span className="text-xs text-gray-500">
                                            {formatDate(dispute.contract?.createdAt)}
                                          </span>
                                        </div>
                                        {dispute.resolvedAt && (
                                          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                            <span className="text-xs text-gray-500">Resolved On</span>
                                            <span className="text-xs text-emerald-600 font-medium">
                                              {formatDate(dispute.resolvedAt)}
                                            </span>
                                          </div>
                                        )}
                                        {dispute.resolvedBy && (
                                          <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Resolved By</span>
                                            <span className="text-xs text-gray-700">
                                              {getFullName(dispute.resolvedBy)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                                                        {/* Dispute Window Info */}
                                    {dispute.filedDuringWindow && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100">
                                            <Clock className="w-4 h-4 text-purple-600" />
                                          </div>
                                          Filed During Dispute Window
                                        </h4>
                                        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
                                          <p className="text-sm text-purple-700">
                                            This dispute was filed during the 2-day escrow hold period after project completion. 
                                            Funds were pulled back from pending payout to escrow for review.
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Filed By */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                                          <User className="w-4 h-4 text-amber-600" />
                                        </div>
                                        Filed By
                                      </h4>
                                      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-white border border-amber-200 flex items-center justify-center">
                                            <span className="text-sm font-bold text-amber-600">
                                              {dispute.filedBy?.firstName?.[0]}
                                              {dispute.filedBy?.lastName?.[0]}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {getFullName(dispute.filedBy)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {dispute.filedById === dispute.contract?.buyerId ? 'Buyer' : 'Freelancer'}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Resolution (if resolved) */}
                                    {dispute.resolution && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                            <Gavel className="w-4 h-4 text-emerald-600" />
                                          </div>
                                          Resolution
                                        </h4>
                                        <div className={`rounded-xl border p-4 ${getResolutionColor(dispute.resolution)}`}>
                                          <p className="text-sm font-bold">
                                            {getResolutionLabel(dispute.resolution)}
                                          </p>
                                          {dispute.adminNotes && (
                                            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                                              {dispute.adminNotes}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Admin Actions */}
                                    {dispute.status !== 'resolved' && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                            <Shield className="w-4 h-4 text-emerald-600" />
                                          </div>
                                          Admin Actions
                                        </h4>
                                        <div className="space-y-2">
                                          {dispute.status === 'open' && (
                                            <button
                                              onClick={() => handleUpdateStatus(dispute.id, 'under_review')}
                                              disabled={statusUpdating}
                                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all"
                                            >
                                              <Eye className="w-4 h-4" />
                                              Mark as Under Review
                                            </button>
                                          )}
                                          {dispute.status === 'under_review' && (
                                            <button
                                              onClick={() => handleUpdateStatus(dispute.id, 'open')}
                                              disabled={statusUpdating}
                                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all"
                                            >
                                              <RotateCcw className="w-4 h-4" />
                                              Revert to Open
                                            </button>
                                          )}
                                          <button
                                            onClick={() => openResolveModal(dispute)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
                                          >
                                            <Gavel className="w-4 h-4" />
                                            Resolve Dispute
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Resolve Dispute</h3>
                  <p className="text-xs text-gray-500">
                    {selectedDispute.contract?.job?.title || 'Untitled Contract'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setSelectedDispute(null);
                  setResolution('');
                  setAdminNotes('');
                  setRefundAmount('');
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Escrow Info */}
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-700 font-medium">Escrow Amount</span>
                  <span className="text-lg font-bold text-emerald-800">
                    {formatCurrency(selectedDispute.contract?.escrowAmount)}
                  </span>
                </div>
              </div>

              {/* Resolution Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Resolution Type <span className="text-emerald-600">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {resolutionOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setResolution(opt.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        resolution === opt.value
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        resolution === opt.value ? 'bg-emerald-100' : 'bg-gray-100'
                      }`}>
                        <opt.icon className={`w-5 h-5 ${
                          resolution === opt.value ? 'text-emerald-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${
                          resolution === opt.value ? 'text-emerald-700' : 'text-gray-700'
                        }`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </div>
                      {resolution === opt.value && (
                        <Check className="w-5 h-5 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Refund Amount (for custom) */}
              {resolution === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Refund Amount (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
                      ₦
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={selectedDispute.contract?.escrowAmount}
                      placeholder="Enter refund amount"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Maximum: {formatCurrency(selectedDispute.contract?.escrowAmount)}
                  </p>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain your decision..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none transition-all"
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  This action is irreversible. The resolution will trigger wallet transactions
                  and notify both parties automatically via email.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setSelectedDispute(null);
                  setResolution('');
                  setAdminNotes('');
                  setRefundAmount('');
                }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || !resolution}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-100"
              >
                {resolving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm Resolution
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[95vh] w-full flex items-center justify-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-14 right-0 p-2 text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={previewImage}
              download
              className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 hover:bg-white text-gray-900 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}