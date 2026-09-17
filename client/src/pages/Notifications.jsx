import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  CheckCheck,
  Trash2,
  DollarSign,
  Clock,
  MessageCircle,
  Bell,
  Briefcase,
  FileText,
  CheckCircle2,
  XCircle,
  Star,
  ChevronRight,
  Ban,
  UserPlus,
  Link2,
  Lock,
  Mail,
  Heart,
  Shield,
  Zap
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const Notifications = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)
  const [deletedIds, setDeletedIds] = useState(new Set())

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchNotifications()
  }, [isAuthenticated, filter])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {}
      if (filter === 'unread') params.unreadOnly = 'true'

      const response = await api.get('/notifications', { params })
      const fetched = response.data.notifications || []
      const filtered = fetched.filter((n) => !deletedIds.has(n.id))
      setNotifications(filtered)
      setUnreadCount(response.data.unreadCount || 0)
    } catch (err) {
      console.error('Fetch notifications error:', err)
      setError(err.response?.data?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      setActionLoading(notificationId + '-read')
      await api.patch(`/notifications/${notificationId}/read`)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Mark read error:', err)
      toast.error('Failed to mark as read')
    } finally {
      setActionLoading(null)
    }
  }

  const markAllAsRead = async () => {
    try {
      setActionLoading('all-read')
      await api.patch('/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err) {
      console.error('Mark all read error:', err)
      toast.error('Failed to mark all as read')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      setActionLoading(notificationId + '-delete')
      await api.delete(`/notifications/${notificationId}`)
      setDeletedIds((prev) => {
        const next = new Set(prev)
        next.add(notificationId)
        return next
      })
      const deleted = notifications.find((n) => n.id === notificationId)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      if (deleted && !deleted.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      toast.success('Notification deleted')
    } catch (err) {
      console.error('Delete error:', err)
      toast.error(err.response?.data?.message || 'Failed to delete notification')
    } finally {
      setActionLoading(null)
    }
  }

  const getNotificationConfig = (type) => {
    const configs = {
      new_message: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
      new_proposal: { icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
      proposal_accepted: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      proposal_shortlisted: { icon: Star, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      proposal_rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
      contract_created: { icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
      contract_completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      contract_cancelled: { icon: Ban, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
      withdrawal_success: { icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      payment_received: { icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      new_review: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
      connection_request: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
      connection_accepted: { icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      new_job: { icon: Briefcase, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
      job_invite: { icon: Mail, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-100' },
      milestone_completed: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      milestone_paid: { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      dispute_opened: { icon: Shield, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
      dispute_resolved: { icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      account_verified: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      password_changed: { icon: Lock, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' },
      welcome: { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
      system: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
      promotion: { icon: Star, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-100' },
    }
    return configs[type] || { icon: Bell, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-100' }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500">Loading notifications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={fetchNotifications}
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-6 h-6 text-gray-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Notifications
                </h1>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                    : 'All caught up!'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={actionLoading === 'all-read'}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                {actionLoading === 'all-read' ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filter === f.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filter === f.key ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-gray-500 text-sm">
              {filter === 'unread'
                ? 'You have read all your notifications'
                : 'When something happens, you will see it here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isUnread = !notification.isRead
              const config = getNotificationConfig(notification.type)
              const IconComponent = config.icon

              return (
                <div
                  key={notification.id}
                  className={`group relative bg-white rounded-xl border transition-all duration-200 ${
                    isUnread
                      ? `${config.border} shadow-sm ring-1 ring-emerald-50`
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="p-4 sm:p-5 flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}
                    >
                      <IconComponent className={`w-5 h-5 ${config.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3
                            className={`font-semibold text-sm ${
                              isUnread ? 'text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notification.createdAt)}
                          </span>
                          {isUnread && (
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        {notification.link && (
                          <Link
                            to={notification.link}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            View details
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        )}
                        {isUnread && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            disabled={actionLoading === notification.id + '-read'}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 font-medium transition-colors disabled:opacity-50"
                          >
                            <CheckCheck className="w-3 h-3" />
                            {actionLoading === notification.id + '-read' ? 'Marking...' : 'Mark read'}
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          disabled={actionLoading === notification.id + '-delete'}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 font-medium opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
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

export default Notifications