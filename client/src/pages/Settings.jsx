import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import { toast } from 'react-hot-toast'
import {
  Settings,
  Shield,
  Smartphone,
  Bell,
  Eye,
  Trash2,
  Lock,
  Mail,
  LogOut,
  ChevronRight,
  Monitor,
  Globe,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  Check,
  KeyRound,
  AtSign,
} from 'lucide-react'

function parseDeviceIcon(userAgent) {
  if (!userAgent) return Monitor
  if (userAgent.includes('Mobile')) return Smartphone
  return Monitor
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [activeSection, setActiveSection] = useState('security')
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Forms
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const [deleteForm, setDeleteForm] = useState({ password: '' })

  // Notification preferences (mock for now - add to DB later if needed)
  const [notifications, setNotifications] = useState({
    emailJobAlerts: true,
    emailMessages: true,
    emailMarketing: false,
    pushEnabled: true,
  })

  // Privacy settings (mock for now)
  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    allowMessages: 'everyone', // everyone, connections, none
    showEarnings: false,
  })

  useEffect(() => {
    if (activeSection === 'security') {
      fetchSessions()
    }
  }, [activeSection])

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true)
      const res = await api.get('/auth/sessions')
      setSessions(res.data.sessions || [])
    } catch (err) {
      toast.error('Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`)
      toast.success('Device removed')
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove device')
    }
  }

  const handleRevokeAllOthers = async () => {
    if (!window.confirm('This will log you out of all other devices. Continue?')) return
    try {
      await api.delete('/auth/sessions')
      toast.success('All other devices logged out')
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to logout other devices')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    try {
      setIsLoading(true)
      await api.patch('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      toast.success('Password changed. Please login again.')
      setShowChangePassword(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => logout(), 1500)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeEmail = async (e) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      await api.patch('/auth/change-email', {
        newEmail: emailForm.newEmail,
        password: emailForm.password,
      })
      toast.success('Email updated. Please verify your new email.')
      setShowChangeEmail(false)
      setEmailForm({ newEmail: '', password: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change email')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    if (!window.confirm('WARNING: This will permanently delete your account and all data. This cannot be undone. Are you sure?')) return
    try {
      setIsLoading(true)
      await api.delete('/auth/account', { data: { password: deleteForm.password } })
      toast.success('Account deleted')
      setShowDeleteAccount(false)
      logout()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account')
    } finally {
      setIsLoading(false)
    }
  }

  const sections = [
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Eye },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-600 rotate-180" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-20">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-500'
                      : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {section.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* ─── SECURITY ─── */}
          {activeSection === 'security' && (
            <>
              {/* Password */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Password</h3>
                      <p className="text-sm text-gray-500">Change your account password</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChangePassword(!showChangePassword)}
                    className="px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  >
                    {showChangePassword ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showChangePassword && (
                  <form onSubmit={handleChangePassword} className="space-y-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                        minLength={8}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Update Password
                    </button>
                  </form>
                )}
              </div>

              {/* Email */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Email Address</h3>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChangeEmail(!showChangeEmail)}
                    className="px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  >
                    {showChangeEmail ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showChangeEmail && (
                  <form onSubmit={handleChangeEmail} className="space-y-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New Email</label>
                      <input
                        type="email"
                        value={emailForm.newEmail}
                        onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                      <input
                        type="password"
                        value={emailForm.password}
                        onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AtSign className="w-4 h-4" />}
                      Update Email
                    </button>
                  </form>
                )}
              </div>

              {/* Active Sessions */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Active Sessions</h3>
                      <p className="text-sm text-gray-500">{sessions.length} device{sessions.length !== 1 ? 's' : ''} logged in</p>
                    </div>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      onClick={handleRevokeAllOthers}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      Logout All Others
                    </button>
                  )}
                </div>

                {sessionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => {
                      const DeviceIcon = parseDeviceIcon(session.userAgent)
                      const isCurrent = session.id === sessions[0]?.id // First one is current (most recent)

                      return (
                        <div
                          key={session.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border ${
                            isCurrent ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent ? 'bg-emerald-100' : 'bg-gray-100'
                          }`}>
                            <DeviceIcon className={`w-5 h-5 ${isCurrent ? 'text-emerald-600' : 'text-gray-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-gray-900">
                                {session.deviceName}
                              </p>
                              {isCurrent && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{session.browser} • {session.ipAddress}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Last active: {formatDate(session.lastUsedAt)}
                            </p>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                              title="Remove this device"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── NOTIFICATIONS ─── */}
          {activeSection === 'notifications' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Notification Preferences</h3>
                  <p className="text-sm text-gray-500">Choose what you want to be notified about</p>
                </div>
              </div>

              {[
                { key: 'emailJobAlerts', label: 'Job Alerts', desc: 'Get notified about new jobs matching your skills' },
                { key: 'emailMessages', label: 'Messages', desc: 'Get notified when someone messages you' },
                { key: 'emailMarketing', label: 'Marketing & Updates', desc: 'Receive news, tips, and promotional emails' },
                { key: 'pushEnabled', label: 'Push Notifications', desc: 'Browser push notifications for real-time updates' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3 border-t border-gray-100 first:border-0">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      notifications[item.key] ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      notifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}

              <button
                onClick={() => toast.success('Notification preferences saved')}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all"
              >
                Save Preferences
              </button>
            </div>
          )}

          {/* ─── PRIVACY ─── */}
          {activeSection === 'privacy' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Privacy Settings</h3>
                  <p className="text-sm text-gray-500">Control who can see and interact with you</p>
                </div>
              </div>

              {/* Profile Visibility */}
              <div className="py-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">Profile Visibility</p>
                    <p className="text-xs text-gray-500">Make your profile visible to everyone</p>
                  </div>
                  <button
                    onClick={() => setPrivacy(prev => ({ ...prev, profileVisible: !prev.profileVisible }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      privacy.profileVisible ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      privacy.profileVisible ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Who Can Message */}
              <div className="py-3 border-t border-gray-100">
                <p className="font-medium text-sm text-gray-900 mb-3">Who Can Message You</p>
                <div className="space-y-2">
                  {[
                    { value: 'everyone', label: 'Everyone', desc: 'Anyone can send you messages' },
                    { value: 'connections', label: 'Connections Only', desc: 'Only your connections can message you' },
                    { value: 'none', label: 'No One', desc: 'Disable messages completely' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        privacy.allowMessages === option.value
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        privacy.allowMessages === option.value ? 'border-emerald-500' : 'border-gray-300'
                      }`}>
                        {privacy.allowMessages === option.value && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{option.label}</p>
                        <p className="text-xs text-gray-500">{option.desc}</p>
                      </div>
                      <input
                        type="radio"
                        name="allowMessages"
                        value={option.value}
                        checked={privacy.allowMessages === option.value}
                        onChange={(e) => setPrivacy(prev => ({ ...prev, allowMessages: e.target.value }))}
                        className="hidden"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Show Earnings */}
              <div className="py-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">Show Earnings on Profile</p>
                    <p className="text-xs text-gray-500">Display your earnings tier publicly</p>
                  </div>
                  <button
                    onClick={() => setPrivacy(prev => ({ ...prev, showEarnings: !prev.showEarnings }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      privacy.showEarnings ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      privacy.showEarnings ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              <button
                onClick={() => toast.success('Privacy settings saved')}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all"
              >
                Save Privacy Settings
              </button>
            </div>
          )}

          {/* ─── DANGER ZONE ─── */}
          {activeSection === 'danger' && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-red-900">Danger Zone</h3>
                  <p className="text-sm text-red-500">Irreversible account actions</p>
                </div>
              </div>

              <div className="border border-red-100 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Delete Account</p>
                    <p className="text-xs text-gray-500 mt-0.5">Permanently delete your account and all data</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteAccount(!showDeleteAccount)}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    Delete Account
                  </button>
                </div>

                {showDeleteAccount && (
                  <form onSubmit={handleDeleteAccount} className="mt-4 pt-4 border-t border-red-100 space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        This action cannot be undone. All your data will be permanently deleted.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Enter your password to confirm</label>
                      <input
                        type="password"
                        value={deleteForm.password}
                        onChange={(e) => setDeleteForm({ password: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Permanently Delete My Account
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage