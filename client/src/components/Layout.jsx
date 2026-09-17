import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Home, Briefcase, Users, MessageCircle, Bell, Wallet,
  UserCircle, X, Search, LogOut, ShieldCheck,
  ChevronDown, AlertTriangle, ShieldAlert, Shield,
  ArrowRight, Banknote, Settings, User, ChevronRight,
} from 'lucide-react'

// ─────────────────────────────────────────────
// VivaWork Logo
// ─────────────────────────────────────────────
function VivaWorkLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M8 12 L30 56 L32 52 L14 12 Z" fill="url(#bladeLeft)" />
      <path d="M56 12 L34 56 L32 52 L50 12 Z" fill="url(#bladeRight)" />
      <path d="M30 56 L32 52 L34 56 L32 60 Z" fill="white" fillOpacity="0.95" />
      <path d="M8 12 L14 12 L32 52 L30 56 Z" fill="url(#highlight)" fillOpacity="0.4" />
      <ellipse cx="32" cy="58" rx="6" ry="3" fill="url(#glow)" opacity="0.3" />
      <defs>
        <linearGradient id="bladeLeft" x1="8" y1="12" x2="32" y2="60">
          <stop stopColor="#065f46" /><stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="bladeRight" x1="56" y1="12" x2="32" y2="60">
          <stop stopColor="#10b981" /><stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="highlight" x1="8" y1="12" x2="32" y2="52">
          <stop stopColor="#34d399" stopOpacity="0.6" /><stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow" cx="32" cy="58" r="6">
          <stop stopColor="#10b981" stopOpacity="0.5" /><stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

// ─────────────────────────────────────────────
// KYC Verification Banner
// ─────────────────────────────────────────────
function KycBanner() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const user = useAuthStore((state) => state.user)
  const isAuthReady = useAuthStore((state) => state.isAuthReady)

  if (!isAuthReady || !user || dismissed) return null

  const kycStatus = user.kycStatus || 'UNVERIFIED'
  if (user.isAdmin || user.role === 'admin' || kycStatus === 'VERIFIED') return null

  const config = {
    UNVERIFIED: {
      bg: 'bg-amber-50 border-amber-200',
      icon: ShieldAlert,
      iconColor: 'text-amber-600',
      text: 'text-amber-800',
      muted: 'text-amber-600',
      btn: 'bg-amber-600 hover:bg-amber-700',
      label: 'Complete Identity Verification',
      message: 'Verify your identity to unlock all platform features.',
      action: () => navigate('/document-verification'),
      actionLabel: 'Verify Now',
    },
    PENDING: {
      bg: 'bg-blue-50 border-blue-200',
      icon: Shield,
      iconColor: 'text-blue-600',
      text: 'text-blue-800',
      muted: 'text-blue-600',
      btn: 'bg-blue-600 hover:bg-blue-700',
      label: 'Verification Pending',
      message: 'Your documents are under review. We will notify you once approved.',
      action: null,
      actionLabel: null,
    },
    UNDER_REVIEW: {
      bg: 'bg-blue-50 border-blue-200',
      icon: Shield,
      iconColor: 'text-blue-600',
      text: 'text-blue-800',
      muted: 'text-blue-600',
      btn: 'bg-blue-600 hover:bg-blue-700',
      label: 'Verification In Review',
      message: 'Your documents are being reviewed by our team.',
      action: null,
      actionLabel: null,
    },
    REJECTED: {
      bg: 'bg-red-50 border-red-200',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      text: 'text-red-800',
      muted: 'text-red-600',
      btn: 'bg-red-600 hover:bg-red-700',
      label: 'Verification Rejected',
      message: 'Your documents were rejected. Please resubmit with correct information.',
      action: () => navigate('/document-verification'),
      actionLabel: 'Resubmit',
    },
    SUSPENDED: {
      bg: 'bg-red-50 border-red-200',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      text: 'text-red-800',
      muted: 'text-red-600',
      btn: 'bg-red-600 hover:bg-red-700',
      label: 'Account Suspended',
      message: 'Your verification is suspended. Contact support for assistance.',
      action: null,
      actionLabel: null,
    },
  }

  const c = config[kycStatus] || config.UNVERIFIED
  const Icon = c.icon

  return (
    <div className={`border-b ${c.bg} px-4 py-2.5`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${c.iconColor}`} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${c.text} leading-tight`}>{c.label}</p>
            <p className={`text-xs ${c.muted} leading-tight mt-0.5 hidden sm:block`}>{c.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.action && (
            <button
              onClick={c.action}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 ${c.btn}`}
            >
              {c.actionLabel}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className={`p-1 rounded-md hover:bg-black/5 transition-colors ${c.muted}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Admin Toolbar
// ─────────────────────────────────────────────
function AdminToolbar() {
  const location = useLocation()
  const navigate = useNavigate()

  if (!location.pathname.startsWith('/admin')) return null

  const links = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/verifications', label: 'Verifications' },
    { path: '/admin/disputes', label: 'Disputes' },
    { path: '/admin/withdrawals', label: 'Withdrawals' },
  ]

  return (
    <div className="bg-emerald-900 border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider mr-3 shrink-0 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin
          </span>
          {links.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                location.pathname === link.path
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-emerald-200 hover:text-white hover:bg-emerald-800'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Nav Link Item (Desktop)
// ─────────────────────────────────────────────
function NavLink({ to, icon: Icon, label, isActive, badge }) {
  return (
    <Link
      to={to}
      className={`relative flex flex-col items-center px-3 py-1.5 rounded-xl transition-all duration-200 ${
        isActive
          ? 'text-emerald-700 bg-emerald-50/80 shadow-sm'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
      }`}
    >
      <div className="relative">
        <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -top-2 -right-3 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 ring-[1.5px] ring-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-semibold mt-0.5">{label}</span>
    </Link>
  )
}

// ─────────────────────────────────────────────
// Profile Dropdown (Desktop)
// ─────────────────────────────────────────────
function ProfileDropdown({ user, isAdmin, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`
  const role = user?.isAdmin || user?.role === 'admin' ? 'Admin'
    : user?.isBuyer && user?.isFreelancer ? 'Buyer & Freelancer'
    : user?.isFreelancer ? 'Freelancer'
    : user?.isBuyer ? 'Buyer'
    : 'User'

  const adminLinks = [
    { path: '/admin', label: 'Dashboard', icon: ShieldCheck },
    { path: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
    { path: '/admin/disputes', label: 'Disputes', icon: ShieldCheck },
    { path: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  ]

  const menuItem = (to, icon, label, onClick) => (
    <Link
      key={to}
      to={to}
      onClick={() => { setOpen(false); onClick?.() }}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        location.pathname === to ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100/80 transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-slate-200/80 shadow-sm overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : initials}
        </div>
        <div className="hidden lg:flex flex-col items-start leading-none">
          <span className="text-[11px] font-semibold text-slate-800">{user?.firstName} {user?.lastName?.[0]}.</span>
          <span className="text-[9px] text-slate-400 mt-0.5">{role}</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-100 py-2 z-50 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="py-1">
            {menuItem(`/profile/${user?.id}`, <UserCircle className="w-4 h-4 text-slate-400" />, 'View Profile')}
            {menuItem('/settings', <Settings className="w-4 h-4 text-slate-400" />, 'Settings')}

            {user?.kycStatus && user.kycStatus !== 'VERIFIED' && !isAdmin && (
              <button
                onClick={() => { setOpen(false); navigate('/document-verification') }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors w-full text-left"
              >
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Complete Verification
              </button>
            )}

            {isAdmin && (
              <>
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Admin Tools</span>
                </div>
                {adminLinks.map((link) =>
                  menuItem(link.path, <link.icon className="w-4 h-4 text-emerald-500" />, link.label)
                )}
              </>
            )}
          </div>

          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Mobile Sidebar (slides from RIGHT)
// ─────────────────────────────────────────────
function MobileSidebar({ isOpen, onClose, user, isAdmin, unreadMessages, unreadNotifications, onLogout }) {
  const location = useLocation()
  const navigate = useNavigate()
  const panelRef = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    if (isOpen) {
      document.addEventListener('mousedown', handle)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('mousedown', handle)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isActive = (path) =>
    path === '/feed'
      ? location.pathname === '/feed' || location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(path + '/')

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`
  const kycStatus = user?.kycStatus
  const showKycBanner = kycStatus && kycStatus !== 'VERIFIED' && !isAdmin

  const navItems = [
    { path: '/feed', label: 'Feed', icon: Home },
    { path: '/jobs', label: 'Jobs', icon: Briefcase },
    { path: '/connections', label: 'Network', icon: Users },
    { path: '/messages', label: 'Messages', icon: MessageCircle, badge: unreadMessages },
    { path: '/notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { path: '/wallet', label: 'Wallet', icon: Wallet },
    { path: `/profile/${user?.id}`, label: 'Profile', icon: UserCircle },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  const adminItems = [
    { path: '/admin', label: 'Dashboard', icon: ShieldCheck },
    { path: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
    { path: '/admin/disputes', label: 'Disputes', icon: ShieldCheck },
    { path: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
  ]

  return (
    <div className="md:hidden fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Sidebar Panel - SLIDES FROM RIGHT */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-[280px] bg-white shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Header with close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
            <VivaWorkLogo className="w-8 h-8" />
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">
              Viva<span className="text-emerald-600">Work</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* User Profile Card */}
          <div className="px-4 py-4 border-b border-slate-100">
            <button
              onClick={() => { onClose(); navigate(`/profile/${user?.id}`) }}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold ring-2 ring-slate-200/80 shadow-sm overflow-hidden shrink-0 group-hover:ring-emerald-300 transition-all">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
            </button>

            {/* KYC mini banner inside sidebar */}
            {showKycBanner && (
              <button
                onClick={() => { onClose(); navigate('/document-verification') }}
                className={`mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                  kycStatus === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200'
                  : kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {kycStatus === 'REJECTED' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  : kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW' ? <Shield className="w-3.5 h-3.5 shrink-0" />
                  : <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">
                  {kycStatus === 'REJECTED' ? 'Resubmit Verification'
                    : kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIDEW' ? 'Verification In Review'
                    : 'Complete Verification'}
                </span>
                <ArrowRight className="w-3 h-3 ml-auto shrink-0" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search jobs, people, posts..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Nav Links */}
          <div className="py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'text-emerald-700 bg-emerald-50 shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Admin Section */}
          {isAdmin && (
            <div className="border-t border-slate-100 py-2">
              <div className="px-4 py-2">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Admin Tools</span>
              </div>
              {adminItems.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'text-emerald-700 bg-emerald-50 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer - Logout */}
        <div className="border-t border-slate-100 p-4">
          <button
            onClick={() => { onClose(); onLogout() }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Layout
// ─────────────────────────────────────────────
function Layout() {
  const { user, isAuthenticated, logout, setUser } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMsgs, setUnreadMsgs] = useState(0)

  const isAdmin = user?.isAdmin || user?.role === 'admin'

  const isActive = (path) => {
    if (path === '/feed') return location.pathname === '/feed' || location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  // Fetch unread counts + user data
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchData = async () => {
      try {
        const userRes = await api.get('/users/me')
        if (userRes.data.user) setUser(userRes.data.user)

        const [notifRes, msgRes] = await Promise.all([
          api.get('/notifications?unreadOnly=true&limit=1'),
          api.get('/messages/unread-count'),
        ])
        setUnreadNotifs(notifRes.data.unreadCount || 0)
        setUnreadMsgs(msgRes.data.unreadCount || 0)
      } catch (err) {
        console.error('Fetch counts error:', err.response?.data?.message || err.message)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, setUser])

  // Scroll shadow
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handle, { passive: true })
    return () => window.removeEventListener('scroll', handle)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navLinks = [
    { path: '/feed', label: 'Feed', icon: Home },
    { path: '/jobs', label: 'Jobs', icon: Briefcase },
    { path: '/connections', label: 'Network', icon: Users },
    { path: '/messages', label: 'Messages', icon: MessageCircle },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {isAuthenticated && <KycBanner />}
      {isAdmin && <AdminToolbar />}

      {/* Navbar */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.04)] border-b border-slate-200/50'
          : 'bg-white border-b border-slate-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <Link to={isAuthenticated ? '/feed' : '/'} className="flex items-center gap-3 shrink-0 group">
                <VivaWorkLogo className="w-10 h-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
                <div className="hidden sm:flex flex-col leading-none">
                  <span className="text-[19px] font-extrabold text-slate-900 tracking-tight">
                    Viva<span className="text-emerald-600">Work</span>
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 tracking-[0.15em] uppercase mt-0.5">
                    Freelance Hub
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Search */}
            {isAuthenticated && (
              <div className="hidden md:flex flex-1 max-w-md mx-6 lg:mx-10">
                <div className={`relative w-full transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}>
                  <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchFocused ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    placeholder="Search jobs, people, posts..."
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/80 border border-transparent rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 focus:bg-white focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {isAuthenticated ? (
                <>
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.path}
                      to={link.path}
                      icon={link.icon}
                      label={link.label}
                      isActive={isActive(link.path)}
                      badge={link.path === '/messages' ? unreadMsgs : 0}
                    />
                  ))}

                  <Link
                    to="/notifications"
                    className={`relative flex flex-col items-center px-3 py-1.5 rounded-xl transition-all duration-200 ${
                      isActive('/notifications')
                        ? 'text-emerald-700 bg-emerald-50/80 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="relative">
                      <Bell className="w-[18px] h-[18px]" strokeWidth={isActive('/notifications') ? 2.5 : 2} />
                      {unreadNotifs > 0 && (
                        <span className="absolute -top-2 -right-3 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 ring-[1.5px] ring-white">
                          {unreadNotifs > 99 ? '99+' : unreadNotifs}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold mt-0.5">Alerts</span>
                  </Link>

                  <Link
                    to="/wallet"
                    className={`flex flex-col items-center px-3 py-1.5 rounded-xl transition-all duration-200 ${
                      isActive('/wallet')
                        ? 'text-emerald-700 bg-emerald-50/80 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <Wallet className="w-[18px] h-[18px]" strokeWidth={isActive('/wallet') ? 2.5 : 2} />
                    <span className="text-[11px] font-semibold mt-0.5">Wallet</span>
                  </Link>

                  <div className="w-px h-8 bg-slate-200 mx-1" />

                  <ProfileDropdown user={user} isAdmin={isAdmin} onLogout={handleLogout} />
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm hover:shadow-md hover:-translate-y-[1px]"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Right Side */}
            {isAuthenticated ? (
              /* Logged in: Profile avatar opens sidebar */
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[11px] font-bold ring-2 ring-slate-200/80 shadow-sm overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`}
                </div>
              </button>
            ) : (
              /* NOT logged in: Login + Sign Up buttons on mobile */
              <div className="md:hidden flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar (slides from RIGHT) */}
      {isAuthenticated && (
        <MobileSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          isAdmin={isAdmin}
          unreadMessages={unreadMsgs}
          unreadNotifications={unreadNotifs}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Slide-in from RIGHT animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  )
}

export default Layout