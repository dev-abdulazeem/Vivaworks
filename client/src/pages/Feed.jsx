import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import VivaRoomSection from '../components/feed/VivaRoomSection'
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Send,
  Image as ImageIcon,
  Link as LinkIcon,
  Video,
  FileText,
  MoreHorizontal,
  BadgeCheck,
  X,
  Trash2,
  Play,
  Plus,
  Globe,
  Copy,
  Check,
  Search,
  UserPlus,
  ExternalLink,
  Loader2,
  BarChart3,
  Volume2,
  VolumeX,
  Maximize,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

// ─── CONSTANTS ────────────────────────────────────────────────────────
const POST_TYPES = {
  text: { icon: FileText, label: 'Text', color: 'text-emerald-600' },
  image: { icon: ImageIcon, label: 'Image', color: 'text-emerald-600' },
  video: { icon: Video, label: 'Video', color: 'text-emerald-600' },
  link: { icon: LinkIcon, label: 'Link', color: 'text-emerald-600' },
}

const STORY_DURATION_HOURS = 24

// ─── HELPERS ──────────────────────────────────────────────────────────
const getInitials = (firstName, lastName) => {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase()
}

const formatTimeAgo = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}

const isStoryActive = (createdAt) => {
  if (!createdAt) return false
  const hoursAgo = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  return hoursAgo <= STORY_DURATION_HOURS
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
function Feed() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  // ─── STORIES FROM BACKEND (CONNECTIONS ONLY) ───
  const [stories, setStories] = useState([])
  const [isLoadingStories, setIsLoadingStories] = useState(false)

  // Stories viewer state
  const [selectedStory, setSelectedStory] = useState(null)
  const [storyIndex, setStoryIndex] = useState(0)
  const [storyProgress, setStoryProgress] = useState(0)

  // Create post modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [postType, setPostType] = useState('text')
  const [mediaFiles, setMediaFiles] = useState([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPreview, setLinkPreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Comments state
  const [expandedComments, setExpandedComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [postingComment, setPostingComment] = useState({})

  // Share modal state
  const [shareModalPost, setShareModalPost] = useState(null)
  const [shareLink, setShareLink] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [sendingToUser, setSendingToUser] = useState(null)

  // ─── IMAGE LIGHTBOX ───────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ─── VIDEO PLAYER STATE ───────────────────────────────────────────────
  const [playingVideo, setPlayingVideo] = useState(null)
  const [videoMuted, setVideoMuted] = useState(true)

  // ─── REPLY STATE ──────────────────────────────────────────────────────
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyInputs, setReplyInputs] = useState({})

  const storyTimerRef = useRef(null)

  const currentStoryPost = selectedStory?.posts[storyIndex] ?? null

  // ─── FETCH STORIES (CONNECTIONS ONLY) ─────────────────────────────
  const fetchStories = useCallback(async () => {
    if (!user?.id) return
    setIsLoadingStories(true)
    try {
      const response = await api.get('/posts/stories')
      setStories(response.data.stories || [])
    } catch (err) {
      console.error('Failed to fetch stories:', err)
      setStories([])
    } finally {
      setIsLoadingStories(false)
    }
  }, [user?.id])

  // ─── FETCH FEED (WITH ROBUST ERROR HANDLING) ─────────────────────────
  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    try {
      setIsLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '15'
      })

      // Add timeout and better error handling
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      )

      const fetchPromise = api.get(`/posts/feed?${params.toString()}`)

      const response = await Promise.race([fetchPromise, timeoutPromise])

      const { posts: newPosts = [], pagination = {} } = response.data

      setPosts((prev) => (append ? [...prev, ...newPosts] : newPosts))
      setTotalPages(pagination.pages || 1)
      setRetryCount(0) // Reset retry count on success
      setPage(pageNum)
    } catch (err) {
      console.error('Error fetching feed:', err)

      // Determine error type and message
      let errorMessage = 'Failed to load feed'
      let isNetworkError = false

      if (!err.response) {
        isNetworkError = true
        errorMessage = 'Network error. Check your connection and try again.'
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again in a moment.'
      } else if (err.response?.status === 404) {
        errorMessage = 'Feed endpoint not found. Please refresh the page.'
      } else if (err.message === 'Request timeout') {
        isNetworkError = true
        errorMessage = 'Request timed out. Check your connection.'
      } else {
        errorMessage = err.response?.data?.message || errorMessage
      }

      setError(errorMessage)

      // Auto-retry network errors up to max retries
      if (isNetworkError && retryCount < maxRetries) {
        setRetryCount((prev) => prev + 1)
        setTimeout(() => {
          fetchFeed(pageNum, append)
        }, 2000 * (retryCount + 1)) // Exponential backoff
      }
    } finally {
      setIsLoading(false)
    }
  }, [retryCount])

  useEffect(() => {
    fetchFeed(1, false)
    fetchStories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── TRACK POST IMPRESSIONS ───────────────────────────────────────
  useEffect(() => {
    if (!posts.length || !user?.id) return

    const timer = setTimeout(() => {
      posts.forEach((post) => {
        if (post.userId !== user.id) {
          api.post(`/posts/${post.id}/impression`).catch(() => {})
        }
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [posts, user?.id])

  // ─── STORY VIEWER ─────────────────────────────────────────────────
  const openStory = (story) => {
    setSelectedStory(story)
    setStoryIndex(0)
    setStoryProgress(0)
  }

  const closeStory = () => {
    if (storyTimerRef.current) clearInterval(storyTimerRef.current)
    setSelectedStory(null)
    setStoryIndex(0)
    setStoryProgress(0)
  }

  const goToNextStoryPost = useCallback(() => {
    if (!selectedStory) return
    if (storyIndex < selectedStory.posts.length - 1) {
      setStoryIndex((i) => i + 1)
    } else {
      closeStory()
    }
  }, [selectedStory, storyIndex])

  const goToPrevStoryPost = () => {
    if (storyIndex > 0) setStoryIndex((i) => i - 1)
  }

  useEffect(() => {
    if (!selectedStory) return
    setStoryProgress(0)
    const stepMs = 50
    let elapsed = 0
    storyTimerRef.current = setInterval(() => {
      elapsed += stepMs
      const pct = (elapsed / 5000) * 100
      setStoryProgress(Math.min(pct, 100))
      if (pct >= 100) {
        clearInterval(storyTimerRef.current)
        goToNextStoryPost()
      }
    }, stepMs)
    return () => clearInterval(storyTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStory, storyIndex])

  // ─── CREATE POST ───────────────────────────────────────────────────
  const mediaPreviews = useMemo(
    () => mediaFiles.map((file) => URL.createObjectURL(file)),
    [mediaFiles]
  )
  useEffect(() => {
    return () => mediaPreviews.forEach((url) => URL.revokeObjectURL(url))
  }, [mediaPreviews])

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files)
    e.target.value = ''
    if (files.length === 0) return

    if (postType === 'image' && files.length > 4) {
      setError('Maximum 4 images allowed')
      return
    }
    if (postType === 'video' && files.length > 1) {
      setError('Only 1 video allowed per post')
      return
    }

    const validFiles = files.filter((file) => {
      if (postType === 'image') return file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024
      if (postType === 'video') return file.type.startsWith('video/') && file.size <= 100 * 1024 * 1024
      return false
    })

    if (validFiles.length !== files.length) {
      setError(postType === 'image' ? 'Only images up to 10MB each' : 'Only videos up to 100MB')
    } else {
      setError('')
    }
    setMediaFiles(validFiles)
  }

  const removeMediaFile = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadMedia = async () => {
    if (mediaFiles.length === 0) return []
    setIsUploading(true)
    try {
      const uploads = mediaFiles.map((file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', postType)
        return api.post('/upload/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      })
      const responses = await Promise.all(uploads)
      return responses.map((res) => res.data.url)
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to upload media')
    } finally {
      setIsUploading(false)
    }
  }

  const fetchLinkPreview = useCallback(async (url) => {
    if (!url || !url.startsWith('http')) {
      setLinkPreview(null)
      return
    }
    try {
      const response = await api.post('/posts/link-preview', { url })
      setLinkPreview(response.data.preview)
    } catch {
      setLinkPreview(null)
    }
  }, [])

  useEffect(() => {
    if (postType !== 'link' || !linkUrl) return
    const timeout = setTimeout(() => fetchLinkPreview(linkUrl), 800)
    return () => clearTimeout(timeout)
  }, [linkUrl, postType, fetchLinkPreview])

  const resetCreateForm = () => {
    setNewPostContent('')
    setMediaFiles([])
    setLinkUrl('')
    setLinkPreview(null)
    setPostType('text')
    setError('')
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (postType === 'text' && !newPostContent.trim()) {
      setError('Post content cannot be empty')
      return
    }
    if (postType === 'link' && !linkUrl.trim()) {
      setError('Please enter a link URL')
      return
    }
    if ((postType === 'image' || postType === 'video') && mediaFiles.length === 0) {
      setError(`Please select at least one ${postType}`)
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      let mediaUrls = []
      if (postType === 'image' || postType === 'video') {
        mediaUrls = await uploadMedia()
      }

      const postData = { content: newPostContent.trim(), type: postType, media: mediaUrls }
      if (postType === 'link') {
        postData.linkUrl = linkUrl.trim()
        postData.linkPreview = linkPreview
      }

      const response = await api.post('/posts', postData)
      const newPost = response.data.post
      setPosts((prev) => [newPost, ...prev])
      resetCreateForm()
      setShowCreateModal(false)
      toast.success('Post created!')
      fetchStories()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isCreateDisabled =
    (postType === 'text' && !newPostContent.trim()) ||
    (postType === 'link' && !linkUrl.trim()) ||
    ((postType === 'image' || postType === 'video') && mediaFiles.length === 0) ||
    isSubmitting ||
    isUploading

  // ─── LIKE ──────────────────────────────────────────────────────────
  const handleLike = async (postId) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    const wasLiked = post.isLiked
    const newLikes = wasLiked ? (post.likes || 1) - 1 : (post.likes || 0) + 1
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isLiked: !wasLiked, likes: newLikes } : p))
    )
    try {
      await api.post(`/posts/${postId}/like`)
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isLiked: wasLiked, likes: post.likes || 0 } : p))
      )
      toast.error(err.response?.data?.message || 'Failed to like post')
    }
  }

  // ─── SHARE SYSTEM ──────────────────────────────────────────────────
  const openShareModal = async (post) => {
    setShareModalPost(post)
    setShareLink('')
    setCopiedLink(false)
    setSearchQuery('')
    setSearchResults([])
    setSendingToUser(null)
    try {
      const response = await api.post(`/posts/${post.id}/share`, {})
      setShareLink(response.data.shareLink)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate share link')
    }
  }

  const closeShareModal = () => {
    setShareModalPost(null)
    setShareLink('')
    setCopiedLink(false)
    setSearchQuery('')
    setSearchResults([])
    setSendingToUser(null)
  }

  const copyShareLink = () => {
    const fullLink = `${window.location.origin}/share/${shareLink}`
    navigator.clipboard.writeText(fullLink)
    setCopiedLink(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const searchUsers = useCallback(async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`)
      const filtered = (response.data.users || []).filter(u => u.id !== user?.id)
      setSearchResults(filtered)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [user?.id])

  useEffect(() => {
    const timeout = setTimeout(() => searchUsers(searchQuery), 400)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchUsers])

  const sendPostToUser = async (recipientId) => {
    if (!shareModalPost || !recipientId) return
    setSendingToUser(recipientId)
    try {
      await api.post(`/posts/${shareModalPost.id}/share`, { recipientId })
      toast.success('Post sent!')
      closeShareModal()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send post')
    } finally {
      setSendingToUser(null)
    }
  }

  // ─── SAVE ───────────────────────────────────────────────────────────
  const handleSave = async (postId) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    const wasSaved = post.isSaved
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: !wasSaved, saves: wasSaved ? (p.saves || 1) - 1 : (p.saves || 0) + 1 } : p)))
    try {
      const response = await api.post(`/posts/${postId}/save`)
      const { saved, saves } = response.data
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: saved, saves } : p)))
      toast.success(saved ? 'Post saved!' : 'Removed from saved')
    } catch (err) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isSaved: wasSaved, saves: post.saves || 0 } : p)))
      toast.error(err.response?.data?.message || 'Failed to save post')
    }
  }

  // ─── COMMENTS ──────────────────────────────────────────────────────
  const handleCommentChange = (postId, value) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: value }))
  }

  // Fetches the latest comments for a post from the backend and syncs them into state
  const fetchComments = async (postId) => {
    try {
      const response = await api.get(`/posts/${postId}/comments`)
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentsList: response.data.comments || [] } : p))
      )
    } catch {
      toast.error('Failed to load comments')
    }
  }

  const handleToggleComments = (post) => {
    const willOpen = !expandedComments[post.id]
    setExpandedComments((prev) => ({ ...prev, [post.id]: willOpen }))
    if (willOpen && (!post.commentsList || post.commentsList.length === 0)) {
      fetchComments(post.id)
    }
  }

  const handlePostComment = async (postId, parentId = null) => {
    const inputKey = parentId ? `${postId}_${parentId}` : postId
    const content = (parentId ? replyInputs[inputKey] : commentInputs[postId])?.trim()
    if (!content) return
    setPostingComment((prev) => ({ ...prev, [inputKey]: true }))
    try {
      const response = await api.post(`/posts/${postId}/comments`, { content, parentId })
      const newComment = response.data.comment
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p
          if (parentId) {
            const updatedComments = (p.commentsList || []).map((c) => {
              if (c.id === parentId) {
                return { ...c, replies: [...(c.replies || []), newComment], _count: { ...c._count, replies: (c._count?.replies || 0) + 1 } }
              }
              return c
            })
            return { ...p, commentsList: updatedComments }
          }
          return { ...p, commentsList: [...(p.commentsList || []), newComment], comments: (p.comments || 0) + 1 }
        })
      )
      if (parentId) {
        setReplyInputs((prev) => ({ ...prev, [inputKey]: '' }))
        setReplyingTo(null)
      } else {
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
      }
      // Re-fetch comments to ensure sync with backend
      fetchComments(postId)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post comment')
    } finally {
      setPostingComment((prev) => ({ ...prev, [inputKey]: false }))
    }
  }

  // ─── DELETE ──────────────────────────────────────────────────────
  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await api.delete(`/posts/${postId}`)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      fetchStories()
      toast.success('Post deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete post')
    }
  }

  // ─── LOAD MORE ───────────────────────────────────────────────────
  const loadMore = () => {
    if (page >= totalPages || isLoading) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchFeed(nextPage, true)
  }

  const isOwnPost = (post) => post.userId === user?.id

  // ─── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── HEADER ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-emerald-100">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-800 tracking-tight">Feed</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 rounded-full hover:bg-emerald-50 transition-colors group"
          >
            <Plus className="w-6 h-6 text-emerald-600 group-hover:text-emerald-700" />
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto">
        {/* ─── STORIES BAR ─────────────────────────────────────────── */}
        <div className="flex gap-4 overflow-x-auto px-4 py-4 scrollbar-hide border-b border-emerald-50 bg-white">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full p-[2.5px] bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                <div className="w-full h-full rounded-full border-[2.5px] border-white bg-emerald-50 overflow-hidden flex items-center justify-center">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-emerald-600">
                      {getInitials(user?.firstName, user?.lastName)}
                    </span>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                <Plus className="w-3 h-3 text-white" />
              </div>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Your story</span>
          </button>

          {stories.map((story) => (
            <button
              key={story.userId}
              onClick={() => openStory(story)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
            >
              <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-400 via-teal-500 to-emerald-600 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full border-[2.5px] border-white bg-emerald-100 overflow-hidden">
                  {story.user?.avatar ? (
                    <img src={story.user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-200 to-emerald-300 flex items-center justify-center text-emerald-700 font-bold text-xs">
                      {getInitials(story.user?.firstName, story.user?.lastName)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium truncate w-16 text-center">
                {story.user?.firstName || 'User'}
              </span>
            </button>
          ))}
        </div>

        {/* ─── VIVA ROOM SECTION (MICROPHONE BUTTON WITH MODAL) ─────────────────────────────── */}
        <VivaRoomSection />

        {/* ─── STORY VIEWER MODAL ────────────────────────────────── */}
        {selectedStory && currentStoryPost && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="absolute top-4 left-3 right-3 flex gap-1 z-10">
              {selectedStory.posts.map((_, idx) => (
                <div key={idx} className="h-[2px] flex-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{
                      width:
                        idx < storyIndex ? '100%' : idx === storyIndex ? `${storyProgress}%` : '0%',
                      transition: idx === storyIndex ? 'none' : 'width 200ms ease',
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                {selectedStory.user?.avatar ? (
                  <img
                    src={selectedStory.user.avatar}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs border border-white/30">
                    {getInitials(selectedStory.user?.firstName, selectedStory.user?.lastName)}
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold text-sm">
                    {selectedStory.user?.firstName} {selectedStory.user?.lastName}
                  </p>
                  <p className="text-white/50 text-xs">{formatTimeAgo(currentStoryPost.createdAt)}</p>
                </div>
              </div>
              <button
                onClick={closeStory}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={goToPrevStoryPost}
              className="absolute left-0 top-0 bottom-0 w-1/3 z-[5]"
              aria-label="Previous"
            />
            <button
              onClick={goToNextStoryPost}
              className="absolute right-0 top-0 bottom-0 w-2/3 z-[5]"
              aria-label="Next"
            />

            <div className="flex-1 flex items-center justify-center p-4 pointer-events-none">
              <div className="max-w-lg w-full pointer-events-auto">
                {currentStoryPost.type === 'image' && currentStoryPost.media?.length > 0 ? (
                  <img
                    src={currentStoryPost.media[0]}
                    alt=""
                    className="w-full max-h-[75vh] object-contain rounded-lg"
                  />
                ) : currentStoryPost.type === 'video' && currentStoryPost.media?.length > 0 ? (
                  <video
                    src={currentStoryPost.media[0]}
                    controls
                    autoPlay
                    className="w-full max-h-[75vh] rounded-lg"
                  />
                ) : (
                  <div className="bg-white rounded-2xl p-6 max-h-[75vh] overflow-y-auto">
                    <p className="text-gray-900 text-lg leading-relaxed whitespace-pre-line">
                      {currentStoryPost.content}
                    </p>
                    {currentStoryPost.media?.length > 0 && (
                      <img src={currentStoryPost.media[0]} alt="" className="mt-4 w-full rounded-xl" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-6 left-4 right-4 flex items-center gap-3 z-10">
              <Link
                to={`/profile/${selectedStory.userId}`}
                onClick={closeStory}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white text-center rounded-full font-medium text-sm transition-colors backdrop-blur-sm"
              >
                View Profile
              </Link>
              <button
                onClick={() => {
                  const postId = currentStoryPost.id
                  setPosts((prev) =>
                    prev.map((p) =>
                      p.id === postId ? { ...p, isLiked: !p.isLiked, likes: (p.likes || 0) + (p.isLiked ? -1 : 1) } : p
                    )
                  )
                  api.post(`/posts/${postId}/like`).catch(() => {})
                }}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
              >
                <Heart className={`w-6 h-6 ${currentStoryPost.isLiked ? 'fill-current text-rose-400' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* ─── ERROR BANNER ──────────────────────────────────────── */}
        {error && (
          <div className="mx-4 mt-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                {error.includes('Network') || error.includes('timeout') ? (
                  <p className="text-xs text-red-600 mt-1">Make sure you're online and the server is accessible</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchFeed(page, false)}
                className="text-red-600 hover:text-red-800 p-1 hover:bg-red-100 rounded transition-colors"
                title="Retry"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── POSTS FEED ─────────────────────────────────────────── */}
        {isLoading && posts.length === 0 ? (
          <div className="space-y-0 bg-white">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-emerald-50 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-emerald-100 rounded-full w-1/3" />
                    <div className="h-3 bg-emerald-100 rounded-full w-1/4" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 bg-emerald-100 rounded-full w-full" />
                  <div className="h-3 bg-emerald-100 rounded-full w-5/6" />
                </div>
                <div className="mt-3 h-64 bg-emerald-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="pb-20">
            {posts.map((post) => (
              <article
                key={post.id}
                className="border-b border-emerald-50 hover:bg-emerald-50/20 transition-colors bg-white"
              >
                {/* ─── POST HEADER ─────────────────────────────── */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <Link to={`/profile/${post.user?.id}`} className="shrink-0">
                        {post.user?.avatar ? (
                          <img src={post.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                            {getInitials(post.user?.firstName, post.user?.lastName)}
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            to={`/profile/${post.user?.id}`}
                            className="font-semibold text-emerald-900 hover:text-emerald-700 hover:underline text-[15px]"
                          >
                            {post.user?.firstName} {post.user?.lastName}
                          </Link>
                          {post.user?.isVerified && <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
                          <span className="text-emerald-200">·</span>
                          <span className="text-[13px] text-emerald-400">{formatTimeAgo(post.createdAt)}</span>
                        </div>
                        {post.user?.role && (
                          <p className="text-[12px] text-emerald-400 capitalize mt-0.5">{post.user.role}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center">
                      {isOwnPost(post) && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="text-emerald-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
                          title="Delete post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button className="text-emerald-300 hover:text-emerald-600 p-2 rounded-full hover:bg-emerald-50 transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ─── POST CONTENT ──────────────────────────────── */}
                <div className="px-4 pb-1">
                  {post.content && (
                    <p className="text-emerald-900 text-[15px] leading-relaxed whitespace-pre-line">
                      {post.content.split(/(\s+)/).map((part, i) => {
                        if (part.startsWith('#')) {
                          return <Link key={i} to={`/feed?hashtag=${part.slice(1)}`} className="text-emerald-600 hover:underline font-medium">{part}</Link>
                        }
                        if (part.startsWith('@')) {
                          return <Link key={i} to={`/profile/${part.slice(1)}`} className="text-emerald-600 hover:underline font-medium">{part}</Link>
                        }
                        return part
                      })}
                    </p>
                  )}

                  {post.type === 'image' && post.media && post.media.length > 0 && (
                    <div
                      className={`mt-3 grid gap-0.5 rounded-lg overflow-hidden ${
                        post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                      }`}
                    >
                      {post.media.map((url, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setLightboxImages(post.media)
                            setLightboxIndex(idx)
                            setLightboxOpen(true)
                          }}
                          className={`relative bg-emerald-50 overflow-hidden cursor-pointer ${
                            post.media.length === 3 && idx === 0 ? 'row-span-2' : ''
                          } ${post.media.length === 1 ? 'max-h-[500px]' : 'aspect-square'}`}
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover hover:opacity-95 transition-opacity"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {post.type === 'video' && post.media && post.media.length > 0 && (
                    <div className="mt-3 rounded-lg overflow-hidden bg-black relative group">
                      <video
                        ref={(el) => {
                          if (el && playingVideo === post.id) el.play()
                          if (el && playingVideo !== post.id) { el.pause(); el.currentTime = 0 }
                        }}
                        src={post.media[0]}
                        className="w-full max-h-[500px]"
                        preload="metadata"
                        muted={videoMuted}
                        loop
                        playsInline
                        onClick={(e) => {
                          if (e.target.paused) {
                            setPlayingVideo(post.id)
                            e.target.play()
                          } else {
                            setPlayingVideo(null)
                            e.target.pause()
                          }
                        }}
                      />
                      {playingVideo !== post.id && (
                        <div
                          onClick={() => setPlayingVideo(post.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                        >
                          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <Play className="w-8 h-8 text-emerald-600 ml-1" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setVideoMuted(!videoMuted) }}
                          className="text-white hover:text-emerald-300 transition-colors"
                        >
                          {videoMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const video = e.target.closest('.relative').querySelector('video')
                            if (video) {
                              if (document.fullscreenElement) {
                                document.exitFullscreen()
                              } else {
                                video.requestFullscreen()
                              }
                            }
                          }}
                          className="text-white hover:text-emerald-300 transition-colors ml-auto"
                        >
                          <Maximize className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {post.type === 'link' && (post.linkPreview || (post.linkTitle && post.linkUrl)) && (
                    <a
                      href={post.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-3 border border-emerald-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-white group"
                    >
                      {(post.linkPreview?.image || post.linkImage) && (
                        <div className="h-40 bg-emerald-50 overflow-hidden">
                          <img
                            src={post.linkPreview?.image || post.linkImage}
                            alt={post.linkPreview?.title || post.linkTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-sm font-semibold text-emerald-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                          {post.linkPreview?.title || post.linkTitle}
                        </p>
                        {(post.linkPreview?.description || post.linkDesc) && (
                          <p className="text-xs text-emerald-500 mt-1 line-clamp-2">{post.linkPreview?.description || post.linkDesc}</p>
                        )}
                        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          {post.linkPreview?.domain || (post.linkUrl ? new URL(post.linkUrl).hostname.replace('www.', '') : '')}
                        </p>
                      </div>
                    </a>
                  )}
                </div>

                {/* ─── ACTION BAR ────────────────────────────────── */}
                <div className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <ActionButton
                        active={post.isLiked}
                        activeColor="text-rose-500"
                        onClick={() => handleLike(post.id)}
                        icon={Heart}
                        count={post.likes || 0}
                      />
                      <ActionButton
                        active={expandedComments[post.id]}
                        activeColor="text-emerald-600"
                        onClick={() => handleToggleComments(post)}
                        icon={MessageCircle}
                        count={post.comments || 0}
                      />
                      <ActionButton
                        active={post.isShared}
                        activeColor="text-emerald-600"
                        onClick={() => openShareModal(post)}
                        icon={Share2}
                        count={post.shares || 0}
                      />
                      <ActionButton
                        active={false}
                        activeColor="text-emerald-600"
                        onClick={() => {}}
                        icon={BarChart3}
                        count={post.impressions || 0}
                      />
                    </div>
                    <ActionButton
                      active={post.isSaved}
                      activeColor="text-emerald-600"
                      onClick={() => handleSave(post.id)}
                      icon={Bookmark}
                      count={post.saves || 0}
                    />
                  </div>
                </div>

                {/* ─── LIKES COUNT ───────────────────────────────── */}
                {post.likes > 0 && (
                  <div className="px-4 pb-2">
                    <p className="text-[13px] font-semibold text-emerald-800">
                      {post.likes.toLocaleString()} like{post.likes !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                {/* ─── COMMENTS SECTION ────────────────────────────── */}
                {expandedComments[post.id] && (
                  <div className="bg-emerald-50/30 border-t border-emerald-100">
                    <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
                      {post.commentsList?.length > 0 ? (
                        post.commentsList.map((comment) => (
                          <div key={comment.id}>
                            <div className="flex gap-2.5">
                              <Link to={`/profile/${comment.user?.id}`} className="shrink-0">
                                {comment.user?.avatar ? (
                                  <img src={comment.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-400 flex items-center justify-center text-white text-xs font-bold">
                                    {getInitials(comment.user?.firstName, comment.user?.lastName)}
                                  </div>
                                )}
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[13px] font-semibold text-emerald-900">
                                      {comment.user?.firstName} {comment.user?.lastName}
                                    </span>
                                    {comment.user?.isVerified && <BadgeCheck className="w-3 h-3 text-emerald-500" />}
                                  </div>
                                  <p className="text-[14px] text-emerald-800 leading-relaxed">{comment.content}</p>
                                </div>
                                <div className="flex items-center gap-3 mt-1 ml-1">
                                  <span className="text-[11px] text-emerald-400">{formatTimeAgo(comment.createdAt)}</span>
                                  <button className="text-[11px] font-semibold text-emerald-500 hover:text-emerald-700 transition-colors">Like</button>
                                  <button
                                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                                    className="text-[11px] font-semibold text-emerald-500 hover:text-emerald-700 transition-colors"
                                  >
                                    Reply
                                  </button>
                                  {comment._count?.replies > 0 && (
                                    <span className="text-[11px] text-emerald-400">{comment._count.replies} repl{comment._count.replies === 1 ? 'y' : 'ies'}</span>
                                  )}
                                </div>

                                {replyingTo === comment.id && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 flex items-center gap-2 bg-emerald-50 rounded-full px-3 py-1.5">
                                      <input
                                        type="text"
                                        value={replyInputs[`${post.id}_${comment.id}`] || ''}
                                        onChange={(e) => setReplyInputs((prev) => ({ ...prev, [`${post.id}_${comment.id}`]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handlePostComment(post.id, comment.id)
                                          }
                                        }}
                                        placeholder={`Reply to ${comment.user?.firstName}...`}
                                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-emerald-300 text-emerald-900"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handlePostComment(post.id, comment.id)}
                                        disabled={!replyInputs[`${post.id}_${comment.id}`]?.trim() || postingComment[`${post.id}_${comment.id}`]}
                                        className="text-emerald-500 hover:text-emerald-700 disabled:text-emerald-200 font-semibold text-xs transition-colors"
                                      >
                                        {postingComment[`${post.id}_${comment.id}`] ? '...' : 'Post'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {comment.replies && comment.replies.length > 0 && (
                                  <div className="mt-2 ml-4 pl-3 border-l-2 border-emerald-100 space-y-2">
                                    {comment.replies.map((reply) => (
                                      <div key={reply.id} className="flex gap-2">
                                        <Link to={`/profile/${reply.user?.id}`} className="shrink-0">
                                          {reply.user?.avatar ? (
                                            <img src={reply.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-400 flex items-center justify-center text-white text-[10px] font-bold">
                                              {getInitials(reply.user?.firstName, reply.user?.lastName)}
                                            </div>
                                          )}
                                        </Link>
                                        <div className="flex-1 min-w-0">
                                          <div className="bg-white rounded-2xl rounded-tl-sm px-2.5 py-1.5 shadow-sm">
                                            <div className="flex items-center gap-1 mb-0.5">
                                              <span className="text-[12px] font-semibold text-emerald-900">
                                                {reply.user?.firstName} {reply.user?.lastName}
                                              </span>
                                              {reply.user?.isVerified && <BadgeCheck className="w-2.5 h-2.5 text-emerald-500" />}
                                            </div>
                                            <p className="text-[13px] text-emerald-800 leading-relaxed">{reply.content}</p>
                                          </div>
                                          <span className="text-[10px] text-emerald-400 ml-1">{formatTimeAgo(reply.createdAt)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-sm text-emerald-400">No comments yet. Be the first!</p>
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-t border-emerald-100 bg-white">
                      <div className="flex items-center gap-2">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-400 flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(user?.firstName, user?.lastName)}
                          </div>
                        )}
                        <div className="flex-1 flex items-center gap-2 bg-emerald-50 rounded-full px-4 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-300 border border-transparent transition-all">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => handleCommentChange(post.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handlePostComment(post.id)
                              }
                            }}
                            placeholder="Add a comment..."
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-emerald-300 text-emerald-900"
                          />
                          <button
                            onClick={() => handlePostComment(post.id)}
                            disabled={!commentInputs[post.id]?.trim() || postingComment[post.id]}
                            className="text-emerald-500 hover:text-emerald-700 disabled:text-emerald-200 font-semibold text-sm transition-colors"
                          >
                            {postingComment[post.id] ? '...' : 'Post'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}

            {/* ─── EMPTY STATE ───────────────────────────────────── */}
            {posts.length === 0 && !isLoading && (
              <div className="text-center py-20 px-4 bg-white">
                <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-emerald-900 mb-1">No posts yet</h3>
                <p className="text-emerald-500 text-sm mb-6">
                  When people share, you'll see their posts here.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Share your first post
                </button>
              </div>
            )}

            {/* ─── LOAD MORE ─────────────────────────────────────── */}
            {posts.length > 0 && page < totalPages && (
              <div className="text-center py-6">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="text-sm text-emerald-500 hover:text-emerald-700 font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Loading more...' : 'Load more'}
                </button>
              </div>
            )}

            {posts.length > 0 && page >= totalPages && (
              <div className="text-center py-8">
                <p className="text-sm text-emerald-400">You're all caught up</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── CREATE POST MODAL ───────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowCreateModal(false)
              resetCreateForm()
            }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100">
              <h2 className="text-base font-bold text-emerald-900">New post</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetCreateForm()
                }}
                className="p-2 rounded-full hover:bg-emerald-50 transition-colors text-emerald-400 hover:text-emerald-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-4 flex items-center gap-3">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(user?.firstName, user?.lastName)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-emerald-900 text-sm">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Public</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreatePost} className="px-4 py-3">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full resize-none border-0 text-[17px] placeholder:text-emerald-300 focus:ring-0 min-h-[120px] outline-none text-emerald-900"
                  disabled={isSubmitting || isUploading}
                  autoFocus
                />

                {(postType === 'image' || postType === 'video') && mediaFiles.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                    {mediaFiles.map((file, idx) => (
                      <div key={idx} className="relative aspect-square bg-emerald-50 group">
                        {postType === 'image' ? (
                          <img src={mediaPreviews[idx]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-900">
                            <Play className="w-10 h-10 text-white/80" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMediaFile(idx)}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {postType === 'link' && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-200 transition-all">
                      <LinkIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="Paste URL here..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-emerald-300 text-emerald-900"
                        disabled={isSubmitting}
                      />
                    </div>
                    {linkPreview && (
                      <div className="mt-2">
                        <LinkPreviewCard preview={linkPreview} compact />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-500 mb-2 uppercase tracking-wide">Add to your post</p>
                  <div className="flex items-center gap-2">
                    {Object.entries(POST_TYPES).map(([type, config]) => {
                      const Icon = config.icon
                      const isActive = postType === type
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setPostType(type)
                            setMediaFiles([])
                            setLinkUrl('')
                            setLinkPreview(null)
                            setError('')
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            isActive ? 'bg-white shadow-sm text-emerald-700 ring-1 ring-emerald-200' : 'text-emerald-500 hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="hidden sm:inline">{config.label}</span>
                        </button>
                      )
                    })}

                    <input
                      type="file"
                      id="media-upload"
                      accept={postType === 'image' ? 'image/*' : 'video/*'}
                      multiple={postType === 'image'}
                      onChange={handleMediaSelect}
                      className="hidden"
                    />
                    {(postType === 'image' || postType === 'video') && mediaFiles.length < (postType === 'image' ? 4 : 1) && (
                      <label
                        htmlFor="media-upload"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-500 hover:bg-white hover:shadow-sm transition-all cursor-pointer ml-auto"
                      >
                        <ImageIcon className="w-4 h-4" />
                        Upload
                      </label>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-4 py-3 border-t border-emerald-100 bg-white">
              <button
                type="submit"
                onClick={handleCreatePost}
                disabled={isCreateDisabled}
                className="w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                {isUploading ? 'Uploading...' : isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SHARE MODAL ─────────────────────────────────────────── */}
      {shareModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeShareModal}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100">
              <h2 className="text-base font-bold text-emerald-900">Share Post</h2>
              <button
                onClick={closeShareModal}
                className="p-2 rounded-full hover:bg-emerald-50 transition-colors text-emerald-400 hover:text-emerald-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-700">Shareable Link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-emerald-50 rounded-lg px-3 py-2.5 text-sm text-emerald-600 truncate border border-emerald-100">
                    {shareLink ? `${window.location.origin}/share/${shareLink}` : 'Generating...'}
                  </div>
                  <button
                    onClick={copyShareLink}
                    disabled={!shareLink}
                    className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    title="Copy link"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (shareLink) {
                      window.open(`${window.location.origin}/share/${shareLink}`, '_blank')
                    }
                  }}
                  disabled={!shareLink}
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 transition-colors disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open link
                </button>
              </div>

              <div className="border-t border-emerald-100" />

              <div className="space-y-3">
                <p className="text-sm font-semibold text-emerald-700">Send to a Connection</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-4 py-2.5 bg-emerald-50 rounded-lg text-sm text-emerald-900 placeholder:text-emerald-300 outline-none focus:ring-1 focus:ring-emerald-300 border border-emerald-100"
                  />
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => sendPostToUser(result.id)}
                        disabled={sendingToUser === result.id}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-emerald-50 transition-colors text-left"
                      >
                        {result.avatar ? (
                          <img src={result.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs">
                            {getInitials(result.firstName, result.lastName)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-emerald-900 truncate">
                            {result.firstName} {result.lastName}
                          </p>
                          {result.headline && (
                            <p className="text-xs text-emerald-400 truncate">{result.headline}</p>
                          )}
                        </div>
                        {sendingToUser === result.id ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 text-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-sm text-emerald-400 py-4">No users found</p>
                )}

                {!isSearching && searchQuery.length < 2 && (
                  <p className="text-center text-sm text-emerald-400 py-4">
                    Type at least 2 characters to search
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── IMAGE LIGHTBOX ─────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i - 1) }}
              className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <img
            src={lightboxImages[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIndex < lightboxImages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i + 1) }}
              className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {lightboxImages.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors ${idx === lightboxIndex ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────

function ActionButton({ active, activeColor, onClick, icon: Icon, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 p-2 rounded-full text-sm transition-all ${
        active ? `${activeColor}` : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
      }`}
    >
      <Icon className={`w-5 h-5 ${active && activeColor === 'text-rose-500' ? 'fill-current' : ''} ${active && activeColor === 'text-emerald-600' && Icon === Bookmark ? 'fill-current' : ''}`} />
      {count > 0 && <span className="text-[13px] font-medium">{count.toLocaleString()}</span>}
    </button>
  )
}

function LinkPreviewCard({ preview, compact }) {
  if (!preview) return null
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-3 border border-emerald-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-white group"
    >
      {preview.image && (
        <div className={`bg-emerald-50 overflow-hidden ${compact ? 'h-32' : 'h-40'}`}>
          <img
            src={preview.image}
            alt={preview.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-semibold text-emerald-900 line-clamp-2 group-hover:text-emerald-700 transition-colors">
          {preview.title}
        </p>
        {preview.description && <p className="text-xs text-emerald-500 mt-1 line-clamp-2">{preview.description}</p>}
        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
          <LinkIcon className="w-3 h-3" />
          {preview.domain || new URL(preview.url).hostname}
        </p>
      </div>
    </a>
  )
}

export default Feed