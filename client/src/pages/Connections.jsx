import { useState, useEffect } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Search,
  Check,
  X,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Lightbulb,
  Clock,
  MapPin,
  Briefcase,
  Shield,
  Mail,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const Connections = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'connections') {
        const response = await api.get('/connections');
        setConnections(response.data.connections || []);
      } else if (activeTab === 'pending') {
        const response = await api.get('/connections/pending');
        setPendingRequests(response.data.requests || []);
      } else if (activeTab === 'suggestions') {
        const response = await api.get('/connections/suggestions');
        setSuggestions(response.data.suggestions || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (userId) => {
    try {
      setActionLoading(userId + '-send');
      await api.post(`/connections/request/${userId}`);
      toast.success('Connection request sent');
      setSuggestions((prev) => prev.filter((s) => s.id !== userId));
    } catch (err) {
      console.error('Send request error:', err);
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const acceptRequest = async (connectionId) => {
    try {
      setActionLoading(connectionId + '-accept');
      await api.patch(`/connections/accept/${connectionId}`);
      toast.success('Connection accepted');
      setPendingRequests((prev) => prev.filter((r) => r.id !== connectionId));
      if (activeTab === 'connections') fetchData();
    } catch (err) {
      console.error('Accept error:', err);
      toast.error(err.response?.data?.message || 'Failed to accept');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRequest = async (connectionId) => {
    try {
      setActionLoading(connectionId + '-reject');
      await api.patch(`/connections/reject/${connectionId}`);
      toast.success('Request rejected');
      setPendingRequests((prev) => prev.filter((r) => r.id !== connectionId));
    } catch (err) {
      console.error('Reject error:', err);
      toast.error(err.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const removeConnection = async (connectionId) => {
    if (!window.confirm('Remove this connection?')) return;

    try {
      setActionLoading(connectionId + '-remove');
      await api.delete(`/connections/${connectionId}`);
      toast.success('Connection removed');
      setConnections((prev) => prev.filter((c) => c.connectionId !== connectionId));
    } catch (err) {
      console.error('Remove error:', err);
      toast.error(err.response?.data?.message || 'Failed to remove');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredConnections = connections.filter((c) => {
    const fullName = `${c.user.firstName} ${c.user.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const tabs = [
    { key: 'connections', label: 'My Connections', icon: <UserCheck className="w-4 h-4" /> },
    { key: 'pending', label: 'Pending', icon: <Clock className="w-4 h-4" /> },
    { key: 'suggestions', label: 'Suggestions', icon: <Lightbulb className="w-4 h-4" /> },
  ];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (firstName, lastName) => {
    const f = firstName?.trim()?.[0] || '';
    const l = lastName?.trim()?.[0] || '';
    return `${f}${l}`.toUpperCase() || '?';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-emerald-100 border-t-emerald-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Loading your network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-emerald-700 transition-colors mb-3 text-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-50 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            Back
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Network</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                My Connections
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage your professional network and discover new opportunities
              </p>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                {connections.length} connection{connections.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-200 hover:text-emerald-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'pending' && pendingRequests.length > 0 && (
                <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search (connections tab only) */}
        {activeTab === 'connections' && (
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your connections..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>
        )}

        {/* Connections Tab */}
        {activeTab === 'connections' && (
          <>
            {filteredConnections.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {searchQuery ? 'No matches found' : 'No connections yet'}
                </h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed mb-5">
                  {searchQuery
                    ? 'Try a different search term to find who you are looking for.'
                    : 'Start building your professional network by sending connection requests to people you know.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab('suggestions')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm shadow-sm active:scale-[0.98]"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Find People
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
                {filteredConnections.map((connection) => (
                  <div
                    key={connection.connectionId}
                    className="bg-white sm:rounded-2xl rounded-xl border border-slate-200 p-3 sm:p-4 hover:shadow-md hover:shadow-slate-100 hover:border-emerald-200 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <RouterLink to={`/profile/${connection.user.id}`} className="shrink-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                          {connection.user.avatar ? (
                            <img
                              src={connection.user.avatar}
                              alt={`${connection.user.firstName} ${connection.user.lastName}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(connection.user.firstName, connection.user.lastName)
                          )}
                        </div>
                      </RouterLink>
                      <div className="flex-1 min-w-0">
                        <RouterLink to={`/profile/${connection.user.id}`}>
                          <h3 className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors text-sm leading-tight">
                            {connection.user.firstName} {connection.user.lastName}
                          </h3>
                        </RouterLink>
                        {connection.user.headline && (
                          <p className="text-xs text-slate-500 truncate mt-0.5 leading-relaxed">
                            {connection.user.headline}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(connection.connectedAt)}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 shrink-0">
                        <RouterLink
                          to={`/messages?to=${connection.user.id}`}
                          className="p-2 sm:px-3 sm:py-1.5 bg-emerald-50 text-emerald-700 rounded-lg sm:rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100"
                          title="Message"
                        >
                          <Mail className="w-3.5 h-3.5 sm:hidden" />
                          <span className="hidden sm:inline-flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            Message
                          </span>
                        </RouterLink>
                        <button
                          onClick={() => removeConnection(connection.connectionId)}
                          disabled={actionLoading === connection.connectionId + '-remove'}
                          className="p-2 sm:px-3 sm:py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          title="Remove"
                        >
                          <UserX className="w-3.5 h-3.5 sm:hidden" />
                          <span className="hidden sm:inline-flex items-center gap-1.5">
                            <UserX className="w-3 h-3" />
                            {actionLoading === connection.connectionId + '-remove' ? '...' : 'Remove'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'pending' && (
          <>
            {pendingRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No pending requests</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Incoming connection requests from other professionals will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white sm:rounded-2xl rounded-xl border border-slate-200 p-3 sm:p-5 flex items-center gap-3 hover:shadow-sm transition-all"
                  >
                    <RouterLink to={`/profile/${request.sender.id}`} className="shrink-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0 shadow-sm overflow-hidden">
                        {request.sender.avatar ? (
                          <img
                            src={request.sender.avatar}
                            alt={`${request.sender.firstName} ${request.sender.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(request.sender.firstName, request.sender.lastName)
                        )}
                      </div>
                    </RouterLink>
                    <div className="flex-1 min-w-0">
                      <RouterLink to={`/profile/${request.sender.id}`}>
                        <h3 className="font-semibold text-slate-900 text-sm">
                          {request.sender.firstName} {request.sender.lastName}
                        </h3>
                      </RouterLink>
                      {request.sender.headline && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {request.sender.headline}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        onClick={() => acceptRequest(request.id)}
                        disabled={actionLoading === request.id + '-accept'}
                        className="p-2 sm:px-4 sm:py-2 bg-emerald-600 text-white rounded-lg sm:rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 active:scale-[0.98]"
                        title="Accept"
                      >
                        <Check className="w-3.5 h-3.5 sm:hidden" />
                        <span className="hidden sm:inline-flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          {actionLoading === request.id + '-accept' ? '...' : 'Accept'}
                        </span>
                      </button>
                      <button
                        onClick={() => rejectRequest(request.id)}
                        disabled={actionLoading === request.id + '-reject'}
                        className="p-2 sm:px-4 sm:py-2 border border-slate-200 text-slate-600 rounded-lg sm:rounded-xl text-xs font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 active:scale-[0.98]"
                        title="Decline"
                      >
                        <X className="w-3.5 h-3.5 sm:hidden" />
                        <span className="hidden sm:inline-flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5" />
                          {actionLoading === request.id + '-reject' ? '...' : 'Decline'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <>
            {suggestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lightbulb className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No suggestions right now</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                  We will recommend people to connect with based on your skills and interests. Check back soon!
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-white sm:rounded-2xl rounded-xl border border-slate-200 p-3 sm:p-5 hover:shadow-md hover:shadow-slate-100 hover:border-emerald-200 transition-all duration-200 group flex items-center gap-3 sm:flex-col sm:text-center"
                  >
                    <RouterLink to={`/profile/${suggestion.id}`} className="shrink-0">
                      <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-sm group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                        {suggestion.avatar ? (
                          <img
                            src={suggestion.avatar}
                            alt={`${suggestion.firstName} ${suggestion.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(suggestion.firstName, suggestion.lastName)
                        )}
                      </div>
                    </RouterLink>
                    
                    <div className="flex-1 min-w-0 sm:w-full">
                      <RouterLink to={`/profile/${suggestion.id}`}>
                        <h3 className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors text-sm sm:mt-3">
                          {suggestion.firstName} {suggestion.lastName}
                        </h3>
                      </RouterLink>
                      
                      {suggestion.headline && (
                        <p className="text-xs text-slate-500 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                          {suggestion.headline}
                        </p>
                      )}
                      
                      <div className="hidden sm:flex flex-col items-center gap-1 mt-2 text-[11px] text-slate-400">
                        {suggestion.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {suggestion.location}
                          </span>
                        )}
                        {suggestion.skills && suggestion.skills.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {suggestion.skills.slice(0, 2).join(', ')}
                            {suggestion.skills.length > 2 && ` +${suggestion.skills.length - 2}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => sendRequest(suggestion.id)}
                      disabled={actionLoading === suggestion.id + '-send'}
                      className="shrink-0 p-2.5 sm:px-4 sm:py-2 bg-emerald-600 text-white rounded-lg sm:rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 active:scale-[0.98] sm:mt-4 sm:w-full"
                      title="Connect"
                    >
                      <UserPlus className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center justify-center gap-2">
                        <UserPlus className="w-3.5 h-3.5" />
                        {actionLoading === suggestion.id + '-send' ? 'Sending...' : 'Connect'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Connections;