import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import { toast } from 'react-hot-toast'
import {
  MapPin,
  Briefcase,
  Mail,
  Link as LinkIcon,
  Calendar,
  Pencil,
  BadgeCheck,
  Star,
  UserPlus,
  User,
  Check,
  Globe,
  GraduationCap,
  Clock,
  DollarSign,
  X,
  ArrowLeft,
  Camera,
  Plus,
  ChevronRight,
  Eye,
  Trash2,
  PencilLine,
  Phone,
  Building2,
  Award,
  FileText,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Loader2,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Users,
  Activity,
  Zap,
  Crown,
  Diamond,
  Medal,
  BarChart3,
} from 'lucide-react'

// Earnings tier config
const EARNINGS_TIERS = [
  { key: 'newcomer', label: 'Newcomer', min: 0, max: 49999, color: 'gray', icon: User },
  { key: 'rising_talent', label: 'Rising Talent', min: 50000, max: 249999, color: 'emerald', icon: Zap },
  { key: 'established', label: 'Established', min: 250000, max: 999999, color: 'blue', icon: Star },
  { key: 'top_rated', label: 'Top Rated', min: 1000000, max: 4999999, color: 'amber', icon: Crown },
  { key: 'legend', label: 'Legend', min: 5000000, max: Infinity, color: 'purple', icon: Diamond },
]

const getTierByEarnings = (earnings) => {
  return EARNINGS_TIERS.find(t => earnings >= t.min && earnings <= t.max) || EARNINGS_TIERS[0]
}

const getTierColorClasses = (color) => {
  const map = {
    gray:    'bg-gray-100 text-gray-700 border-gray-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    purple:  'bg-purple-50 text-purple-700 border-purple-200',
  }
  return map[color] || map.gray
}

const getTierProgressColor = (color) => {
  const map = { gray: 'bg-gray-500', emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500', purple: 'bg-purple-500' }
  return map[color] || map.gray
}

const formatEarningsPublic = (earnings) => {
  if (earnings === 0) return '₦0 earned'
  if (earnings < 10000) return 'Less than ₦10K earned'
  if (earnings < 50000) return '₦10K – ₦50K earned'
  if (earnings < 100000) return '₦50K – ₦100K earned'
  if (earnings < 500000) return '₦100K – ₦500K earned'
  if (earnings < 1000000) return '₦500K – ₦1M earned'
  if (earnings < 5000000) return '₦1M – ₦5M earned'
  return '₦5M+ earned'
}

// Online status uses lastActive from backend
const getActivityStatus = (profile) => {
  if (!profile) return { label: 'Offline', dot: null, show: false }

  if (profile.isOnline === true) return { label: 'Online', dot: 'bg-emerald-500', show: true }

  const lastActive = profile.lastActive || profile.last_active
  if (!lastActive) return { label: 'Offline', dot: null, show: false }

  const lastActiveDate = new Date(lastActive)
  if (isNaN(lastActiveDate.getTime())) return { label: 'Offline', dot: null, show: false }

  const diff = Date.now() - lastActiveDate.getTime()
  if (diff < 5 * 60 * 1000) return { label: 'Online', dot: 'bg-emerald-500', show: true }
  if (diff < 30 * 60 * 1000) return { label: 'Recently active', dot: 'bg-amber-400', show: true }
  if (diff < 24 * 60 * 60 * 1000) return { label: 'Active today', dot: 'bg-gray-400', show: false }

  return { label: 'Offline', dot: null, show: false }
}

const getIsVerified = (profile) => {
  if (!profile) return false
  return profile.isVerified === true
}

const getVerificationLabel = (profile) => {
  if (!profile) return 'Unverified'
  if (profile.isVerified === true) return 'Verified'
  
  const vStatus = (profile.verificationStatus || '').toLowerCase()
  const docStatus = (profile.verification?.status || '').toLowerCase()
  const kycStatus = (profile.kycStatus || '').toLowerCase()
  
  if (vStatus === 'pending' || docStatus === 'pending' || kycStatus === 'pending') return 'Pending'
  if (vStatus === 'rejected' || docStatus === 'rejected' || kycStatus === 'rejected') return 'Rejected'
  
  return 'Unverified'
}

const getVerificationMessage = (profile) => {
  const label = getVerificationLabel(profile)
  if (label === 'Verified') return 'Identity confirmed'
  if (label === 'Pending') return 'Verification under review'
  if (label === 'Rejected') return 'Verification was rejected. Please resubmit.'
  return 'Complete signup verification to get verified'
}

const getProfileLinks = (profile) => {
  if (!profile) return {}
  const p = profile.profile || {}
  return {
    website:  p.website  || profile.website  || null,
    linkedin: p.linkedin || profile.linkedin || null,
    twitter:  p.twitter  || profile.twitter  || null,
    github:   p.github   || profile.github   || null,
  }
}

const getProfileLanguages = (profile) => {
  if (!profile) return []
  const p = profile.profile || {}
  return p.languages || profile.languages || []
}

// Experience/portfolio can live either on profile.profile.* (after edits)
// or directly on profile.* (as returned by the initial fetch), so check both.
const getProfileExperience = (profile) => {
  if (!profile) return []
  if (profile.profile?.experience) return profile.profile.experience
  if (Array.isArray(profile.experience)) return profile.experience
  return []
}

const getProfilePortfolio = (profile) => {
  if (!profile) return []
  if (profile.profile?.portfolio) return profile.profile.portfolio
  if (Array.isArray(profile.portfolio)) return profile.portfolio
  return []
}

function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [profileStats, setProfileStats] = useState(null)
  const [showProfileViews, setShowProfileViews] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [error, setError] = useState('')
  const [editForm, setEditForm] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [userPosts, setUserPosts] = useState([])
  const [userJobs, setUserJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [postLikes, setPostLikes] = useState({})
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const [reviewsList, setReviewsList] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsData, setReviewsData] = useState({ averageRating: 0, totalReviews: 0 })
  const [followList, setFollowList] = useState([])
  const [followListLoading, setFollowListLoading] = useState(false)

  // Experience modal state
  const [showExpModal, setShowExpModal] = useState(false)
  const [expForm, setExpForm] = useState({ title: '', company: '', type: 'Full-time', period: '', description: '' })
  const [expSaving, setExpSaving] = useState(false)
  const [editingExpId, setEditingExpId] = useState(null)

  // Portfolio modal state
  const [showPortModal, setShowPortModal] = useState(false)
  const [portForm, setPortForm] = useState({ title: '', category: '', description: '', url: '', imageUrl: '' })
  const [portSaving, setPortSaving] = useState(false)
  const [editingPortId, setEditingPortId] = useState(null)

  const targetUserId = userId || currentUser?.id
  const isOwnProfile = !userId || userId === currentUser?.id?.toString()

  // Fetch profile
  const fetchProfile = async () => {
    if (!targetUserId) { setIsLoading(false); return }

    try {
      setIsLoading(true)
      setError('')

      const response = await api.get(`/users/profile/${targetUserId}`)
      const userData = response.data.user

      setProfile(userData)
      setFollowerCount(userData.followersCount || 0)
      setFollowingCount(userData.followingCount || 0)
      setEditForm({
        headline: userData.headline || '',
        bio: userData.bio || '',
        location: userData.location || '',
        hourlyRate: userData.hourlyRate || '',
        skills: (userData.skills || []).join(', '),
        website: userData.profile?.website || userData.website || '',
        linkedin: userData.profile?.linkedin || userData.linkedin || '',
        twitter: userData.profile?.twitter || userData.twitter || '',
        github: userData.profile?.github || userData.github || '',
        availability: userData.profile?.availability || userData.availability || '',
        languages: ((userData.profile?.languages || userData.languages) || []).join(', '),
        phone: userData.phone || '',
        company: userData.company || '',
      })

      try {
        const postsResponse = await api.get(`/posts/user/${targetUserId}?page=1&limit=10`)
        setUserPosts(postsResponse.data.posts || [])
      } catch { setUserPosts([]) }

      if (userData.isBuyer) fetchUserJobs(targetUserId)

      if (!isOwnProfile && userId) {
        try {
          const followRes = await api.get(`/users/follow-status/${userId}`)
          setIsFollowing(followRes.data.isFollowing)
        } catch { setIsFollowing(false) }
      }

     // Record profile view if not own profile
      if (!isOwnProfile && userId) {
        api.post(`/users/profile/${targetUserId}/view`).catch(() => {})
      }

      // Fetch profile stats for own profile (impressions + profile views)
      if (isOwnProfile) {
        try {
          const statsRes = await api.get('/users/profile-stats')
          setProfileStats(statsRes.data)
        } catch {
          setProfileStats(null)
        }
      }



    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile.')
    } finally {
      setIsLoading(false)
    }
  }

    useEffect(() => {
    fetchProfile()
  }, [targetUserId, userId, isOwnProfile])

 
  const fetchUserJobs = async (uid) => {
    try {
      setJobsLoading(true)
      let response
      if (isOwnProfile) {
        response = await api.get('/jobs/my-jobs')
      } else {
        response = await api.get('/jobs?limit=100')
        const allJobs = response.data.jobs || []
        setUserJobs(allJobs.filter(job => job.buyerId === uid))
        setJobsLoading(false)
        return
      }
      setUserJobs(response.data.jobs || [])
    } catch (err) {
      console.error('Fetch jobs error:', err)
      setUserJobs([])
    } finally {
      setJobsLoading(false)
    }
  }

  // Follow / unfollow
  const handleFollow = async () => {
    if (isOwnProfile || !userId) return
    try {
      setFollowLoading(true)
      const res = await api.post(`/users/follow/${userId}`)
      setIsFollowing(res.data.isFollowing)
      toast.success(res.data.message)
      // Backend returns the target user's updated counts
      setFollowerCount(res.data.followersCount || 0)
      setFollowingCount(res.data.followingCount || 0)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update follow status')
    } finally {
      setFollowLoading(false)
    }
  }

  // Fetch follow list
  const fetchFollowList = async (type) => {
    try {
      setFollowList([])
      setFollowListLoading(true)
      const res = await api.get(`/users/${type}/${targetUserId}`)
      setFollowList(res.data.users || [])
    } catch (err) {
      console.error(`[${type}] error:`, err.response?.data || err.message)
      toast.error(`Failed to load ${type}`)
      setFollowList([])
    } finally {
      setFollowListLoading(false)
    }
  }

  const openFollowers = () => {
    setShowFollowers(true)
    fetchFollowList('followers')
  }

  const openFollowing = () => {
    setShowFollowing(true)
    fetchFollowList('following')
  }
  const fetchProfileViews = async () => {
    try {
      setFollowList([])
      setFollowListLoading(true)
      const res = await api.get('/users/profile-views')
      setFollowList(res.data.users || [])
    } catch (err) {
      console.error('[profile-views] error:', err.response?.data || err.message)
      toast.error('Failed to load profile views')
      setFollowList([])
    } finally {
      setFollowListLoading(false)
    }
  }

  const openProfileViews = () => {
    setShowProfileViews(true)
    fetchProfileViews()
  }

    const fetchReviews = async () => {
    try {
      setReviewsLoading(true)
      const res = await api.get(`/reviews/user/${targetUserId}`)
      setReviewsList(res.data.reviews || [])
      setReviewsData({
        averageRating: res.data.averageRating || 0,
        totalReviews: res.data.totalReviews || 0,
      })
    } catch (err) {
      toast.error('Failed to load reviews')
      setReviewsList([])
    } finally {
      setReviewsLoading(false)
    }
  }

  const openReviews = () => {
    setShowReviews(true)
    fetchReviews()
  }

  // Save profile
  const handleSaveProfile = async () => {
    try {
      setIsSaving(true)
      setError('')

      const payload = {
        headline: editForm.headline || undefined,
        bio: editForm.bio || undefined,
        location: editForm.location || undefined,
        hourlyRate: editForm.hourlyRate ? parseFloat(editForm.hourlyRate) : undefined,
        skills: editForm.skills ? editForm.skills.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        website: editForm.website || undefined,
        linkedin: editForm.linkedin || undefined,
        twitter: editForm.twitter || undefined,
        github: editForm.github || undefined,
        availability: editForm.availability || undefined,
        languages: editForm.languages ? editForm.languages.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        phone: editForm.phone || undefined,
        company: editForm.company || undefined,
      }

      const response = await api.patch('/users/profile', payload)
      const updatedUser = response.data.user

      setProfile(prev => ({ ...prev, ...updatedUser }))
      setIsEditing(false)
      toast.success('Profile updated successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile')
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  // Add / edit experience
  const openAddExperience = () => {
    setEditingExpId(null)
    setExpForm({ title: '', company: '', type: 'Full-time', period: '', description: '' })
    setShowExpModal(true)
  }

  const openEditExperience = (expItem) => {
    setEditingExpId(expItem.id)
    setExpForm({
      title: expItem.title || expItem.role || '',
      company: expItem.company || '',
      type: expItem.type || 'Full-time',
      period: expItem.period || '',
      description: expItem.description || '',
    })
    setShowExpModal(true)
  }

  const handleSaveExperience = async () => {
    if (!expForm.title.trim() || !expForm.company.trim()) {
      toast.error('Title and company are required')
      return
    }
    try {
      setExpSaving(true)

      if (editingExpId) {
        await api.delete(`/users/experience/${editingExpId}`)
      }

      const res = await api.post('/users/experience', {
        title: expForm.title,
        role: expForm.title,
        company: expForm.company,
        type: expForm.type,
        period: expForm.period,
        description: expForm.description,
      })

      setProfile(prev => {
        const newExp = res.data.allExperience || []
        return {
          ...prev,
          experience: newExp,
          profile: {
            ...(prev.profile || {}),
            experience: newExp,
          }
        }
      })

      setShowExpModal(false)
      setExpForm({ title: '', company: '', type: 'Full-time', period: '', description: '' })
      setEditingExpId(null)
      toast.success(editingExpId ? 'Experience updated' : 'Experience added')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save experience')
    } finally {
      setExpSaving(false)
    }
  }

  const handleDeleteExperience = async (expId) => {
    if (!window.confirm('Delete this experience?')) return
    try {
      const res = await api.delete(`/users/experience/${expId}`)

      const newExp = res.data.experience || []
      setProfile(prev => ({
        ...prev,
        experience: newExp,
        profile: {
          ...(prev.profile || {}),
          experience: newExp,
        }
      }))

      toast.success('Experience deleted')
    } catch (err) {
      toast.error('Failed to delete experience')
    }
  }

  // Add / edit portfolio
  const openAddPortfolio = () => {
    setEditingPortId(null)
    setPortForm({ title: '', category: '', description: '', url: '', imageUrl: '' })
    setShowPortModal(true)
  }

  const openEditPortfolio = (portItem) => {
    setEditingPortId(portItem.id)
    setPortForm({
      title: portItem.title || '',
      category: portItem.category || '',
      description: portItem.description || '',
      url: portItem.url || '',
      imageUrl: portItem.imageUrl || '',
    })
    setShowPortModal(true)
  }

  const handleSavePortfolio = async () => {
    if (!portForm.title.trim()) {
      toast.error('Project title is required')
      return
    }
    try {
      setPortSaving(true)

      if (editingPortId) {
        await api.delete(`/users/portfolio/${editingPortId}`)
      }

      const res = await api.post('/users/portfolio', {
        title: portForm.title,
        category: portForm.category,
        description: portForm.description,
        url: portForm.url,
        imageUrl: portForm.imageUrl,
      })

      setProfile(prev => {
        const newPort = res.data.allPortfolio || []
        return {
          ...prev,
          portfolio: newPort,
          profile: {
            ...(prev.profile || {}),
            portfolio: newPort,
          }
        }
      })

      setShowPortModal(false)
      setPortForm({ title: '', category: '', description: '', url: '', imageUrl: '' })
      setEditingPortId(null)
      toast.success(editingPortId ? 'Project updated' : 'Project added')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save project')
    } finally {
      setPortSaving(false)
    }
  }

  const handleDeletePortfolio = async (portId) => {
    if (!window.confirm('Delete this project?')) return
    try {
      const res = await api.delete(`/users/portfolio/${portId}`)

      const newPort = res.data.portfolio || []
      setProfile(prev => ({
        ...prev,
        portfolio: newPort,
        profile: {
          ...(prev.profile || {}),
          portfolio: newPort,
        }
      }))

      toast.success('Project deleted')
    } catch (err) {
      toast.error('Failed to delete project')
    }
  }

  // Avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return }

    const formData = new FormData()
    formData.append('avatar', file)

    try {
      setIsSaving(true)
      setError('')
      const response = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setProfile(prev => ({ ...prev, avatar: response.data.avatar }))
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload avatar')
    } finally {
      setIsSaving(false)
      e.target.value = ''
    }
  }

  // Banner upload
  const handleBannerUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be less than 10MB'); return }

    const formData = new FormData()
    formData.append('banner', file)

    try {
      setIsSaving(true)
      setError('')
      const response = await api.post('/users/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setProfile(prev => ({ ...prev, banner: response.data.banner }))
      toast.success('Banner updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload banner')
    } finally {
      setIsSaving(false)
      e.target.value = ''
    }
  }

  // Delete job
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) return
    try {
      await api.delete(`/jobs/${jobId}`)
      setUserJobs(prev => prev.filter(j => j.id !== jobId))
      toast.success('Job deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete job')
    }
  }

  // Like post
  const handleLikePost = async (postId) => {
    try {
      const isLiked = postLikes[postId]
      if (isLiked) {
        await api.delete(`/posts/${postId}/like`)
        setPostLikes(prev => ({ ...prev, [postId]: false }))
        setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 1) - 1 } : p))
      } else {
        await api.post(`/posts/${postId}/like`)
        setPostLikes(prev => ({ ...prev, [postId]: true }))
        setUserPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p))
      }
    } catch {
      toast.error('Failed to update like')
    }
  }

  // Formatters
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'Not set'
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN', minimumFractionDigits: 0,
    }).format(amount)
  }

  const getInitials = (firstName, lastName) => {
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase()
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
  }

  const formatTimeAgo = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'open':        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'in_progress':  return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'completed':    return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'cancelled':    return 'bg-red-50 text-red-700 border-red-200'
      default:              return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getJobStatusBadge = (status) => {
    switch (status) {
      case 'open':        return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
      case 'in_progress':  return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' }
      case 'completed':    return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' }
      case 'cancelled':    return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' }
      default:              return { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-400' }
    }
  }

  // Tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'posts', label: 'Posts', icon: FileText },
  ]
  if (profile?.isBuyer) tabs.push({ id: 'jobs', label: 'Jobs', icon: Briefcase })
  tabs.push(
    { id: 'portfolio', label: 'Portfolio', icon: Award },
    { id: 'experience', label: 'Experience', icon: GraduationCap }
  )

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gray-50">
        <div className="h-40 sm:h-64 bg-gray-200 animate-pulse" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 -mt-12 sm:-mt-16">
            <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-gray-200 border-4 border-white animate-pulse mx-auto sm:mx-0" />
            <div className="flex-1 space-y-3 pt-4 sm:pt-20">
              <div className="h-6 bg-gray-200 rounded w-2/3 sm:w-1/3 mx-auto sm:mx-0 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-1/2 sm:w-1/4 mx-auto sm:mx-0 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
              <div className="h-48 bg-gray-200 rounded-2xl animate-pulse" />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
              <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile not found</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/feed')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feed
          </button>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
  const displayName = fullName || 'Anonymous'
  const headline = profile.headline || 'Member'
  const earnings = profile.earnings?.totalEarned || 0

  const tier = getTierByEarnings(earnings) || EARNINGS_TIERS[0]
  const TierIcon = tier?.icon || User
  const activity = getActivityStatus(profile)

  const tierProgress = tier.max === Infinity
    ? 100
    : Math.min(100, Math.round(((earnings - tier.min) / (tier.max - tier.min)) * 100))

  const profileLinks = getProfileLinks(profile)
  const profileLanguages = getProfileLanguages(profile)
  const profileExperience = getProfileExperience(profile)
  const profilePortfolio = getProfilePortfolio(profile)

  const isVerified = getIsVerified(profile)
  const verificationLabel = getVerificationLabel(profile)
  const verificationMessage = getVerificationMessage(profile)

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gray-50">

      {/* Error banner */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between shadow-lg">
            <span className="flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              {error}
            </span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Experience modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
                {editingExpId ? 'Edit Experience' : 'Add Experience'}
              </h3>
              <button onClick={() => setShowExpModal(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title *</label>
                <input
                  type="text"
                  value={expForm.title}
                  onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                  placeholder="e.g. Senior Developer"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company *</label>
                <input
                  type="text"
                  value={expForm.company}
                  onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                  placeholder="e.g. TechCorp Nigeria"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                  <select
                    value={expForm.type}
                    onChange={(e) => setExpForm({ ...expForm, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Freelance</option>
                    <option>Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Period</label>
                  <input
                    type="text"
                    value={expForm.period}
                    onChange={(e) => setExpForm({ ...expForm, period: e.target.value })}
                    placeholder="e.g. 2022 - Present"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={expForm.description}
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  rows={3}
                  placeholder="Describe your role and achievements..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-4 sm:p-5 border-t border-gray-100">
              <button
                onClick={() => setShowExpModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExperience}
                disabled={expSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {expSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : (editingExpId ? 'Update' : 'Add Experience')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio modal */}
      {showPortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <Award className="w-5 h-5 text-emerald-500 shrink-0" />
                {editingPortId ? 'Edit Project' : 'Add Portfolio Project'}
              </h3>
              <button onClick={() => setShowPortModal(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Title *</label>
                <input
                  type="text"
                  value={portForm.title}
                  onChange={(e) => setPortForm({ ...portForm, title: e.target.value })}
                  placeholder="e.g. E-commerce Platform"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <input
                  type="text"
                  value={portForm.category}
                  onChange={(e) => setPortForm({ ...portForm, category: e.target.value })}
                  placeholder="e.g. Web Development"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project URL</label>
                <input
                  type="text"
                  value={portForm.url}
                  onChange={(e) => setPortForm({ ...portForm, url: e.target.value })}
                  placeholder="https://yourproject.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL</label>
                <input
                  type="text"
                  value={portForm.imageUrl}
                  onChange={(e) => setPortForm({ ...portForm, imageUrl: e.target.value })}
                  placeholder="https://image-url.com/screenshot.png"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={portForm.description}
                  onChange={(e) => setPortForm({ ...portForm, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the project, your role, and technologies used..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-4 sm:p-5 border-t border-gray-100">
              <button
                onClick={() => setShowPortModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePortfolio}
                disabled={portSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {portSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : (editingPortId ? 'Update' : 'Add Project')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Followers modal */}
      {showFollowers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[75vh] sm:max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <Users className="w-5 h-5 text-emerald-500 shrink-0" />
                Followers ({followerCount})
              </h3>
              <button onClick={() => setShowFollowers(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {followListLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : followList.length > 0 ? (
                followList.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer" onClick={() => { setShowFollowers(false); navigate(`/profile/${u.id}`) }}>
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{u.headline || 'Member'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">No followers yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following modal */}
      {showFollowing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[75vh] sm:max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <Users className="w-5 h-5 text-emerald-500 shrink-0" />
                Following ({followingCount})
              </h3>
              <button onClick={() => setShowFollowing(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {followListLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : followList.length > 0 ? (
                followList.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer" onClick={() => { setShowFollowing(false); navigate(`/profile/${u.id}`) }}>
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{u.headline || 'Member'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">Not following anyone yet</p>
              )}
            </div>
          </div>
        </div>
      )}
             {/* Profile Views modal */}
      {showProfileViews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[75vh] sm:max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                <Eye className="w-5 h-5 text-blue-500 shrink-0" />
                Profile Views ({profileStats?.profileViewsLast7Days || 0})
              </h3>
              <button onClick={() => setShowProfileViews(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {followListLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : followList.length > 0 ? (
                followList.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer" onClick={() => { setShowProfileViews(false); navigate(`/profile/${u.id}`) }}>
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {getInitials(u.firstName, u.lastName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{u.headline || 'Member'}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(u.viewedAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">No profile views yet</p>
              )}
            </div>
          </div>
        </div>
      )}

            {/* Reviews modal */}
      {showReviews && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[75vh] sm:max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                  Reviews ({reviewsData.totalReviews})
                </h3>
                {reviewsData.averageRating > 0 && (
                  <span className="flex items-center gap-1 text-sm text-amber-600 font-medium">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {reviewsData.averageRating}
                  </span>
                )}
              </div>
              <button onClick={() => setShowReviews(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {reviewsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : reviewsList.length > 0 ? (
                reviewsList.map((review) => (
                  <div key={review.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-center gap-3 mb-2">
                      {review.reviewer?.avatar ? (
                        <img src={review.reviewer.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {getInitials(review.reviewer?.firstName, review.reviewer?.lastName)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {review.reviewer?.firstName} {review.reviewer?.lastName}
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatTimeAgo(review.createdAt)}
                      </span>
                    </div>
                    
                    {/* Project name - priority: projectName → job.title → contract.title */}
                    {(review.projectName || review.contract?.job?.title || review.contract?.title) && (
                      <p className="text-xs text-emerald-600 font-medium mb-2 flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3" />
                        {review.projectName || review.contract?.job?.title || review.contract?.title}
                      </p>
                    )}
                    
                    {review.comment && (
                      <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 text-sm py-8">No reviews yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cover image */}
      <div className="h-40 sm:h-64 relative overflow-hidden">
        {profile.banner ? (
          <img src={profile.banner} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400" />
        )}
        <div className="absolute inset-0 bg-black/10" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 w-9 h-9 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
        </button>

        {isOwnProfile && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
            <label className="flex w-9 h-9 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-lg cursor-pointer hover:bg-white hover:scale-110 transition-all">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 pointer-events-none" />
              <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-12 sm:-mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="relative shrink-0 mx-auto sm:mx-0">
            {profile.avatar ? (
              <img src={profile.avatar} alt={displayName} className="w-24 h-24 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white shadow-xl" />
            ) : (
              <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold border-4 border-white shadow-xl">
                {getInitials(profile.firstName, profile.lastName)}
              </div>
            )}
            {activity.show && (
              <div className={`absolute bottom-2 right-2 w-3.5 h-3.5 sm:w-4 sm:h-4 ${activity.dot} border-2 border-white rounded-full shadow-sm`} title={activity.label} />
            )}
            {isOwnProfile && (
              <label className="absolute bottom-1 right-1 w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-gray-50 transition-colors border border-gray-100">
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{displayName}</h1>
              {isVerified && (
                <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 shrink-0" title="Verified" />
              )}
            </div>
            <p className="text-gray-600 font-medium text-sm sm:text-base">{headline}</p>
            {profile.company && (
              <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-1 mt-1">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                {profile.company}
              </p>
            )}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-center justify-center sm:justify-start gap-1 sm:gap-x-4 sm:gap-y-1 mt-2 text-xs sm:text-sm text-gray-500">
              {profile.location && (
                <span className="flex items-center gap-1 max-w-full"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{profile.location}</span></span>
              )}
              {profile.createdAt && (
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 shrink-0" />Joined {formatDate(profile.createdAt)}</span>
              )}
              {(profile.profile?.availability || profile.availability) && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 shrink-0" />{profile.profile?.availability || profile.availability}</span>
              )}
              <span className={`flex items-center gap-1 ${activity.show ? 'text-emerald-600' : 'text-gray-500'}`} title={`Status: ${activity.label}`}>
                <Activity className={`w-3.5 h-3.5 shrink-0 ${activity.show ? 'text-emerald-500' : ''}`} />
                {activity.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 sm:gap-4 mt-3">
              
                {profile.totalReviews > 0 && (
                <button onClick={openReviews} className="text-sm hover:text-amber-600 transition-colors flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                 <span className="font-bold text-gray-900">{profile.averageRating?.toFixed(1)}</span>
                  <span className="text-gray-500">({profile.totalReviews} review{profile.totalReviews !== 1 ? 's' : ''})</span>
                </button>
              )}
              
              <button onClick={openFollowers} className="text-sm hover:text-emerald-600 transition-colors">
                <span className="font-bold text-gray-900">{followerCount}</span>
                <span className="text-gray-500 ml-1">followers</span>
              </button>
              <button onClick={openFollowing} className="text-sm hover:text-emerald-600 transition-colors">
                <span className="font-bold text-gray-900">{followingCount}</span>
                <span className="text-gray-500 ml-1">following</span>
              </button>
              {profile.completionRate !== undefined && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-bold text-gray-900">{profile.completionRate}%</span> completion
                </span>
              )}
              {profile.responseTime && (
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-bold text-gray-900">{profile.responseTime}h</span> response
                </span>
              )}
            </div>

            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
              {profile.isFreelancer && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                  Freelancer
                </span>
              )}
              {profile.isBuyer && (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
                  Buyer
                </span>
              )}
              {profile.isAdmin && (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-100">
                  Admin
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pb-2 shrink-0 w-full sm:w-auto">
            {isOwnProfile ? (
              <>
                {profile.isBuyer && (
                  <button
                    onClick={() => navigate('/jobs/post-job')}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 transition-all w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Post Job
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all w-full sm:w-auto ${
                    isEditing ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all w-full sm:w-auto ${
                    isFollowing
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20'
                  }`}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    <><Check className="w-4 h-4" />Following</>
                  ) : (
                    <><UserPlus className="w-4 h-4" />Follow</>
                  )}
                </button>
                <Link
                  to={`/messages?to=${profile.id}`}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all bg-white w-full sm:w-auto"
                >
                  <Mail className="w-4 h-4" />
                  Message
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="font-bold text-gray-900 mb-5 text-lg">Edit Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Headline / Title</label>
                <input
                  type="text"
                  value={editForm.headline}
                  onChange={(e) => setEditForm({ ...editForm, headline: e.target.value })}
                  placeholder="e.g. Full Stack Developer"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  placeholder="e.g. Tech Corp"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  placeholder="e.g. Lagos, Nigeria"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+234 801 234 5678"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hourly Rate (₦)</label>
                <input
                  type="number"
                  value={editForm.hourlyRate}
                  onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                  placeholder="e.g. 15000"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
                <input
                  type="text"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Availability</label>
                <input
                  type="text"
                  value={editForm.availability}
                  onChange={(e) => setEditForm({ ...editForm, availability: e.target.value })}
                  placeholder="e.g. Available for work"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">LinkedIn</label>
                <input
                  type="text"
                  value={editForm.linkedin}
                  onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Twitter / X</label>
                <input
                  type="text"
                  value={editForm.twitter}
                  onChange={(e) => setEditForm({ ...editForm, twitter: e.target.value })}
                  placeholder="https://twitter.com/..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub</label>
                <input
                  type="text"
                  value={editForm.github}
                  onChange={(e) => setEditForm({ ...editForm, github: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={4}
                  placeholder="Tell us about yourself..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Skills (comma separated)</label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="React, Node.js, TypeScript, PostgreSQL..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Languages (comma separated)</label>
                <input
                  type="text"
                  value={editForm.languages}
                  onChange={(e) => setEditForm({ ...editForm, languages: e.target.value })}
                  placeholder="English, Yoruba, Igbo, Hausa..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => setIsEditing(false)}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 pb-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar */}
        <div className="lg:col-span-1 space-y-5">

          {/* Earnings tier card */}
          {profile.isFreelancer && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Medal className="w-4 h-4 text-emerald-500 shrink-0" />
                Earnings Tier
              </h3>
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${getTierColorClasses(tier.color)}`}>
                <div className={`w-10 h-10 rounded-lg shrink-0 ${getTierColorClasses(tier.color).split(' ')[0]} flex items-center justify-center`}>
                  <TierIcon className={`w-5 h-5 ${getTierColorClasses(tier.color).split(' ')[1]}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm">{tier.label}</p>
                  <p className="text-xs opacity-80 truncate">
                    {isOwnProfile ? formatCurrency(earnings) + ' earned' : formatEarningsPublic(earnings)}
                  </p>
                </div>
              </div>
              {tier.max !== Infinity && (
                <div className="mt-3">
                  <div className="flex flex-wrap justify-between gap-x-2 text-xs text-gray-500 mb-1">
                    <span>Progress to next tier</span>
                    <span>{tierProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${getTierProgressColor(tier.color)} rounded-full transition-all duration-500`} style={{ width: `${tierProgress}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 break-words">
                    {isOwnProfile
                      ? formatCurrency(tier.max + 1) + ' for next tier'
                      : formatEarningsPublic(tier.max + 1) + ' to advance'}
                  </p>
                </div>
              )}
              {tier.max === Infinity && (
                <p className="text-xs text-emerald-600 font-medium mt-2 text-center">Maximum tier reached!</p>
              )}
            </div>
          )}

          {/* Verification status card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              Verification
            </h3>
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              isVerified
                ? 'bg-emerald-50 border-emerald-200'
                : verificationLabel === 'Pending'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              {isVerified ? (
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : verificationLabel === 'Pending' ? (
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-gray-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`font-semibold text-sm ${
                  isVerified ? 'text-emerald-700' : verificationLabel === 'Pending' ? 'text-amber-700' : 'text-gray-500'
                }`}>
                  {verificationLabel}
                </p>
                <p className="text-xs text-gray-500">
                  {verificationMessage}
                </p>
              </div>
            </div>
          </div>
         
                   {/* Profile Stats Card (owner only) */}
          {isOwnProfile && profileStats && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500 shrink-0" />
                Your Stats (Last 7 Days)
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div>
                    <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Post Impressions</p>
                    <p className="text-2xl font-bold text-emerald-700">{(profileStats.impressionsLast7Days || 0).toLocaleString()}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-emerald-300" />
                </div>
                  <button
                  onClick={openProfileViews}
                  className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors text-left"
                >
                  <div>
                    <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Profile Views</p>
                    <p className="text-2xl font-bold text-blue-700">{(profileStats.profileViewsLast7Days || 0).toLocaleString()}</p>
                  </div>
                  <Eye className="w-8 h-8 text-blue-300" />
                </button>
              </div>
            </div>
          )}


          {/* Bio card */}
          {profile.bio && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-500 shrink-0" />
                About
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed break-words">{profile.bio}</p>
            </div>
          )}

          {/* Rate card */}
          {profile.hourlyRate && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                Rate
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(profile.hourlyRate)}</span>
                <span className="text-gray-500 text-sm">/hr</span>
              </div>
            </div>
          )}

          {/* Member since */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
              Member Since
            </h3>
            <p className="text-sm text-gray-600">
              {profile.createdAt ? formatDate(profile.createdAt) : 'Unknown'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {profile.createdAt ? `${Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} months on VivaWork` : ''}
            </p>
          </div>

          {/* Contact info */}
          {(profile.phone || profile.email) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                Contact
              </h3>
              <div className="space-y-2">
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors break-all">
                    <Mail className="w-4 h-4 shrink-0" />{profile.email}
                  </a>
                )}
                {profile.phone && (
                  <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                    <Phone className="w-4 h-4 shrink-0" />{profile.phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-100">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {profileLanguages.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                Languages
              </h3>
              <div className="flex flex-wrap gap-2">
                {profileLanguages.map((lang) => (
                  <span key={lang} className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-100">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {(profileLinks.website || profileLinks.linkedin || profileLinks.twitter || profileLinks.github) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                Links
              </h3>
              <div className="space-y-2.5">
                {profileLinks.website && (
                  <a href={profileLinks.website.startsWith('http') ? profileLinks.website : `https://${profileLinks.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                    <Globe className="w-4 h-4 shrink-0" /><span className="truncate">{profileLinks.website}</span>
                  </a>
                )}
                {profileLinks.linkedin && (
                  <a href={profileLinks.linkedin.startsWith('http') ? profileLinks.linkedin : `https://${profileLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                    <LinkIcon className="w-4 h-4 shrink-0" />LinkedIn
                  </a>
                )}
                {profileLinks.twitter && (
                  <a href={profileLinks.twitter.startsWith('http') ? profileLinks.twitter : `https://${profileLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                    <LinkIcon className="w-4 h-4 shrink-0" />Twitter / X
                  </a>
                )}
                {profileLinks.github && (
                  <a href={profileLinks.github.startsWith('http') ? profileLinks.github : `https://${profileLinks.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                    <LinkIcon className="w-4 h-4 shrink-0" />GitHub
                  </a>
                )}
                {!isOwnProfile && (
                  <Link to={`/messages?to=${profile.id}`} className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors font-medium">
                    <Mail className="w-4 h-4 shrink-0" />Send Message
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right content */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 overflow-x-auto">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="space-y-4">
            {activeTab === 'overview' && (
              <>
                {/* Experience preview */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-500 shrink-0" />
                      Experience
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwnProfile && (
                        <button
                          onClick={openAddExperience}
                          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                      <button onClick={() => setActiveTab('experience')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
                    </div>
                  </div>
                  {profileExperience.length > 0 ? (
                    profileExperience.slice(0, 2).map((exp, idx) => (
                      <div key={exp.id || idx} className="flex gap-3 mb-4 last:mb-0 group">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm truncate">{exp.title || exp.role}</h4>
                              <p className="text-sm text-gray-500 truncate">{exp.company} · {exp.type || 'Full-time'}</p>
                              {exp.period && <p className="text-xs text-gray-400 mt-0.5">{exp.period}</p>}
                            </div>
                            {isOwnProfile && (
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={() => openEditExperience(exp)}
                                  className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <PencilLine className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExperience(exp.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-400">No experience added yet.</p>
                      {isOwnProfile && (
                        <button
                          onClick={openAddExperience}
                          className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          + Add your first experience
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Portfolio preview */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                      Portfolio
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwnProfile && (
                        <button
                          onClick={openAddPortfolio}
                          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                      <button onClick={() => setActiveTab('portfolio')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
                    </div>
                  </div>
                  {profilePortfolio.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {profilePortfolio.slice(0, 3).map((item, idx) => (
                        <div key={item.id || idx} className="group relative">
                          <a href={item.url || '#'} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center overflow-hidden hover:shadow-md transition-all">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-3">
                                <LinkIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs font-medium text-gray-600 truncate max-w-[100px]">{item.title}</p>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/10 transition-colors" />
                          </a>
                          {isOwnProfile && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditPortfolio(item) }}
                                className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-600 hover:text-emerald-600 rounded-lg shadow-sm transition-colors"
                                title="Edit"
                              >
                                <PencilLine className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePortfolio(item.id) }}
                                className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-600 rounded-lg shadow-sm transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-400">No portfolio projects yet.</p>
                      {isOwnProfile && (
                        <button
                          onClick={openAddPortfolio}
                          className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          + Add your first project
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Jobs preview (for buyers) */}
                {profile.isBuyer && userJobs.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-emerald-500 shrink-0" />
                        Posted Jobs
                      </h3>
                      <button onClick={() => setActiveTab('jobs')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
                    </div>
                    <div className="space-y-3">
                      {userJobs.slice(0, 3).map((job) => (
                        <div key={job.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                          <div className="min-w-0">
                            <Link to={`/jobs/${job.id}`} className="font-semibold text-gray-900 text-sm hover:text-emerald-600 transition-colors truncate block">{job.title}</Link>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{job.proposals?.length || 0} proposals</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getJobStatusColor(job.status)}`}>{job.status.replace('_', ' ')}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent posts preview */}
                {userPosts.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                        Recent Posts
                      </h3>
                      <button onClick={() => setActiveTab('posts')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all</button>
                    </div>
                    {userPosts.slice(0, 2).map((post) => (
                      <div key={post.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0 mb-4 last:mb-0">
                        <p className="text-sm text-gray-700 line-clamp-2 break-words">{post.content}</p>
                        {post.media && post.media.length > 0 && (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {post.media.slice(0, 3).map((url, idx) => (
                              <div key={idx} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                            {post.media.length > 3 && (
                              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium shrink-0">+{post.media.length - 3}</div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likes || 0}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments || 0}</span>
                          <span>{formatTimeAgo(post.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {profileExperience.length === 0 && profilePortfolio.length === 0 && !userJobs.length && !userPosts.length && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Getting started</h3>
                    <p className="text-gray-500 text-sm max-w-sm mx-auto mb-4">
                      {isOwnProfile ? "Complete your profile by adding experience, portfolio items, and making posts to stand out." : "This user hasn't added any details yet."}
                    </p>
                    {isOwnProfile && (
                      <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <button onClick={openAddExperience} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium">
                          <Briefcase className="w-4 h-4" />Add Experience
                        </button>
                        <button onClick={openAddPortfolio} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-medium">
                          <Award className="w-4 h-4" />Add Project
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'posts' && (
              <div className="space-y-4">
                {userPosts.length > 0 ? (
                  userPosts.map((post) => (
                    <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                      <div className="flex items-center gap-3 mb-3">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt={displayName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {getInitials(profile.firstName, profile.lastName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">{displayName}</h4>
                          <p className="text-xs text-gray-400">{formatTimeAgo(post.createdAt)}</p>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 whitespace-pre-line mb-3 break-words">{post.content}</p>

                      {post.media && post.media.length > 0 && (
                        <div className={`grid gap-2 mb-3 ${
                          post.media.length === 1 ? 'grid-cols-1' :
                          post.media.length === 2 ? 'grid-cols-2' :
                          'grid-cols-2 sm:grid-cols-3'
                        }`}>
                          {post.media.map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                              <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <button
                            onClick={() => handleLikePost(post.id)}
                            className={`flex items-center gap-1.5 text-sm transition-colors ${
                              postLikes[post.id] ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${postLikes[post.id] ? 'fill-red-500' : ''}`} />
                            {post.likes || 0}
                          </button>
                          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                            {post.comments || 0}
                          </button>
                          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                            <Share2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Share</span>
                          </button>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600">
                          <Bookmark className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-500 text-sm">
                      {isOwnProfile ? "Share your thoughts and updates with your network." : "This user hasn't posted anything yet."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'jobs' && profile.isBuyer && (
              <div className="space-y-4">
                {isOwnProfile && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate('/jobs/post-job')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 transition-all w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Post New Job
                    </button>
                  </div>
                )}

                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  </div>
                ) : userJobs.length > 0 ? (
                  userJobs.map((job) => {
                    const statusBadge = getJobStatusBadge(job.status)
                    return (
                      <div key={job.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Link to={`/jobs/${job.id}`} className="font-bold text-gray-900 hover:text-emerald-600 transition-colors">
                                {job.title}
                              </Link>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.bg} ${statusBadge.text} ${getJobStatusColor(job.status).split(' ')[2]}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                {job.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{job.description}</p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                              {job.budget && (
                                <span className="flex items-center gap-1 font-medium text-gray-700">
                                  <DollarSign className="w-4 h-4 text-emerald-500" />
                                  {formatCurrency(job.budget)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-4 h-4" />
                                {job.budgetType || 'Fixed'}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {job.proposals?.length || 0} proposals
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {formatTimeAgo(job.createdAt)}
                              </span>
                            </div>

                            {job.skills && job.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {job.skills.map((skill) => (
                                  <span key={skill} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-100">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {isOwnProfile && (
                            <div className="flex flex-row sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                              <Link
                                to={`/jobs/${job.id}/proposals`}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Proposals
                              </Link>
                              <button
                                onClick={() => navigate(`/jobs/${job.id}/edit`)}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                <PencilLine className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Briefcase className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No jobs posted yet
                    </h3>
                    <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                      {isOwnProfile
                        ? "Start hiring by posting your first job and find the right talent!"
                        : "This buyer hasn't posted any jobs yet."}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => navigate('/jobs/post-job')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-semibold"
                      >
                        <Plus className="w-4 h-4" />
                        Post Your First Job
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-5 gap-2">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                    Portfolio Projects
                  </h3>
                  {isOwnProfile && (
                    <button
                      onClick={openAddPortfolio}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add Project</span>
                    </button>
                  )}
                </div>
                {profilePortfolio.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profilePortfolio.map((item, idx) => (
                      <div key={item.id || idx} className="group border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all bg-white relative">
                        <a
                          href={item.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <div className="aspect-video bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <LinkIcon className="w-10 h-10 text-emerald-300" />
                            )}
                          </div>
                          <div className="p-4">
                            <h4 className="font-semibold text-gray-900">{item.title}</h4>
                            {item.category && <p className="text-sm text-gray-500 mt-0.5">{item.category}</p>}
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                            )}
                            {item.url && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-2 font-medium">
                                Visit project
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </a>
                        {isOwnProfile && (
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            <button
                              onClick={() => openEditPortfolio(item)}
                              className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-600 hover:text-emerald-600 rounded-lg shadow-sm transition-colors"
                              title="Edit"
                            >
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePortfolio(item.id)}
                              className="p-1.5 bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-600 rounded-lg shadow-sm transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No portfolio items yet.</p>
                    {isOwnProfile && (
                      <button
                        onClick={openAddPortfolio}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-semibold"
                      >
                        <Plus className="w-4 h-4" />
                        Add Your First Project
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'experience' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-5 gap-2">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-500 shrink-0" />
                    Work Experience
                  </h3>
                  {isOwnProfile && (
                    <button
                      onClick={openAddExperience}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add Experience</span>
                    </button>
                  )}
                </div>
                {profileExperience.length > 0 ? (
                  <div className="space-y-6">
                    {profileExperience.map((exp, idx) => (
                      <div key={exp.id || idx} className="flex gap-4 group">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-gray-900">{exp.title || exp.role}</h4>
                              <p className="text-sm text-gray-600 font-medium">{exp.company}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {exp.type && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{exp.type}</span>
                                )}
                                {exp.period && <span className="text-xs text-gray-400">{exp.period}</span>}
                              </div>
                              {exp.description && (
                                <p className="text-sm text-gray-600 mt-2 leading-relaxed break-words">{exp.description}</p>
                              )}
                            </div>
                            {isOwnProfile && (
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  onClick={() => openEditExperience(exp)}
                                  className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <PencilLine className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExperience(exp.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No experience listed yet.</p>
                    {isOwnProfile && (
                      <button
                        onClick={openAddExperience}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-semibold"
                      >
                        <Plus className="w-4 h-4" />
                        Add Your First Experience
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile