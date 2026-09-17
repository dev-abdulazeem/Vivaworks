import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { apiPublic } from '../utils/api'
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ArrowLeft,
  Loader2,
  BadgeCheck,
  Link as LinkIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

function SharePage() {
  const { shareLink } = useParams()
  const navigate = useNavigate()
  const [share, setShare] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchShare = async () => {
      try {
        setIsLoading(true)
        const response = await apiPublic.get(`/posts/share/${shareLink}`)
        setShare(response.data.share)
      } catch (err) {
        setError(err.response?.data?.message || 'Share link not found or expired')
      } finally {
        setIsLoading(false)
      }
    }
    fetchShare()
  }, [shareLink])

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (error || !share) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <LinkIcon className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-emerald-900 mb-2">Link Not Found</h1>
        <p className="text-emerald-500 text-sm mb-6 text-center">{error || 'This share link is invalid or has expired.'}</p>
        <button
          onClick={() => navigate('/feed')}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to Feed
        </button>
      </div>
    )
  }

  const post = share.post
  const sharedBy = share.sharedBy

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-emerald-100">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/feed')}
            className="p-2 rounded-full hover:bg-emerald-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-emerald-600" />
          </button>
          <h1 className="text-lg font-bold text-emerald-800">Shared Post</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto">
        {/* Shared by info */}
        <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-100">
          <p className="text-sm text-emerald-600">
            Shared by{' '}
            <Link to={`/profile/${sharedBy?.id}`} className="font-semibold text-emerald-800 hover:underline">
              {sharedBy?.firstName} {sharedBy?.lastName}
            </Link>
          </p>
        </div>

        {/* Post */}
        <article className="bg-white border-b border-emerald-50">
          {/* Post Header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-start gap-3">
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
          </div>

          {/* Post Content */}
          <div className="px-4 pb-1">
            {post.content && (
              <p className="text-emerald-900 text-[15px] leading-relaxed whitespace-pre-line">{post.content}</p>
            )}

            {post.type === 'image' && post.media && post.media.length > 0 && (
              <div className={`mt-3 grid gap-0.5 rounded-lg overflow-hidden ${post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.media.map((url, idx) => (
                  <div
                    key={idx}
                    className={`relative bg-emerald-50 overflow-hidden ${post.media.length === 3 && idx === 0 ? 'row-span-2' : ''} ${post.media.length === 1 ? 'max-h-[500px]' : 'aspect-square'}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}

            {post.type === 'video' && post.media && post.media.length > 0 && (
              <div className="mt-3 rounded-lg overflow-hidden bg-emerald-900">
                <video src={post.media[0]} controls className="w-full max-h-[500px]" preload="metadata" />
              </div>
            )}

            {post.type === 'link' && post.linkUrl && (
              <a
                href={post.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 hover:underline break-all"
              >
                <LinkIcon className="w-4 h-4 shrink-0" />
                {post.linkUrl}
              </a>
            )}
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-emerald-400 hover:text-rose-500 transition-colors">
              <Heart className="w-6 h-6" />
              <span className="text-[13px] font-medium">{post.likes || 0}</span>
            </button>
            <button className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-600 transition-colors">
              <MessageCircle className="w-6 h-6" />
              <span className="text-[13px] font-medium">{post.comments || 0}</span>
            </button>
            <button className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-600 transition-colors">
              <Share2 className="w-6 h-6" />
              <span className="text-[13px] font-medium">{post.shares || 0}</span>
            </button>
            <button className="ml-auto text-emerald-400 hover:text-emerald-600 transition-colors">
              <Bookmark className="w-6 h-6" />
            </button>
          </div>
        </article>

        {/* CTA */}
        <div className="px-4 py-6 text-center">
          <p className="text-emerald-500 text-sm mb-4">Join VivaWork to interact with this post</p>
          <Link
            to="/feed"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feed
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SharePage