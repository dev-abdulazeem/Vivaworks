import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  User,
  Briefcase,
  MessageSquare,
  Send,
  Check,
  XCircle,
  Upload,
  FileText,
  Image as ImageIcon,
  Download,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  CalendarDays,
  ListChecks,
  ChevronRight,
  Trash2,
  Eye,
  X,
  Timer,
  PackageOpen,
  HandCoins,
  Flag,
  BadgeCheck,
  CreditCard,
  Ban,
  CalendarClock,
  Truck,
  FileImage,
  File,
  ZoomIn,
  Lock,
  Package,
  Gavel,
  Scale,
  Star,
  Hourglass,
  Gift,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const ContractDetail = () => {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [requestingRevision, setRequestingRevision] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [showRevisionModal, setShowRevisionModal] = useState(false)

  // Delivery upload state
  const [deliveryFiles, setDeliveryFiles] = useState([])
  const [uploadingDelivery, setUploadingDelivery] = useState(false)
  const [deliveryNote, setDeliveryNote] = useState('')

  // Countdown
  const [timeLeft, setTimeLeft] = useState(null)
  const [disputeWindowTime, setDisputeWindowTime] = useState(null)

  // Quick message
  const [messageInput, setMessageInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  // Payment
  const [paying, setPaying] = useState(false)

 
  // Image preview modal
  const [previewImage, setPreviewImage] = useState(null)

  // ─── DISPUTE STATE ─────────────────────────────────────────────────────
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeEvidence, setDisputeEvidence] = useState([])
  const [filingDispute, setFilingDispute] = useState(false)

  // ─── DISPUTE REPLY STATE ───────────────────────────────────────────────
  const [disputeReplies, setDisputeReplies] = useState([])
  const [replyContent, setReplyContent] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [submittingReply, setSubmittingReply] = useState(false)
  const [showReplyModal, setShowReplyModal] = useState(false)

  // ─── REVIEW STATE ──────────────────────────────────────────────────────
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)

  // ─── EXTENSION STATE ───────────────────────────────────────────────────
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [extensionDays, setExtensionDays] = useState(3)
  const [extensionReason, setExtensionReason] = useState('')
  const [requestingExtension, setRequestingExtension] = useState(false)
  const [pendingExtension, setPendingExtension] = useState(null)

  // ─── TIP STATE ─────────────────────────────────────────────────────────
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [tipMessage, setTipMessage] = useState('')
  const [sendingTip, setSendingTip] = useState(false)
  const [hasTipped, setHasTipped] = useState(false)

  useEffect(() => {
    fetchContract()
    checkIfReviewed()
  }, [contractId])

  // Countdown timer
  useEffect(() => {
    if (!contract?.deadline) return

    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const deadline = new Date(contract.deadline).getTime()
      const diff = deadline - now

      if (diff <= 0) {
        setTimeLeft({ expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 })
        if (contract.status === 'active' || contract.status === 'revision_requested') {
          handleAutoCancel()
        }
        return
      }

      setTimeLeft({
        expired: false,
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [contract?.deadline, contract?.status])

  // Dispute window countdown timer
  useEffect(() => {
    if (!contract?.disputeWindowEndsAt) return

    const calculateDisputeWindow = () => {
      const now = new Date().getTime()
      const windowEnd = new Date(contract.disputeWindowEndsAt).getTime()
      const diff = windowEnd - now

      if (diff <= 0) {
        setDisputeWindowTime({ expired: true, days: 0, hours: 0, minutes: 0 })
        return
      }

      setDisputeWindowTime({
        expired: false,
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      })
    }

    calculateDisputeWindow()
    const interval = setInterval(calculateDisputeWindow, 60000)
    return () => clearInterval(interval)
  }, [contract?.disputeWindowEndsAt])

  const checkIfReviewed = async () => {
    try {
      const res = await api.get(`/reviews/contract/${contractId}`)
      setHasReviewed(res.data.hasReviewed)
    } catch {
      setHasReviewed(false)
    }
  }

  const fetchContract = async () => {
    try {
      setLoading(true)
      setPendingExtension(null)
      const response = await api.get(`/contracts/${contractId}`)
      setContract(response.data.contract)

             // Fetch pending extension
      try {
        const extRes = await api.get(`/contracts/${contractId}/extension/pending`)
        console.log('Extension API response:', extRes.data)
        setPendingExtension(extRes.data.extension || extRes.data)
      } catch (err) {
        console.log('Extension API failed:', err.response?.status, err.response?.data)
        // Fallback: check if embedded in contract
               // Fallback: check if embedded in contract
        const contractExt = response.data.contract?.extension || 
                           response.data.contract?.pendingExtension ||
                           (response.data.contract?.extensions?.length > 0 
                             ? response.data.contract.extensions[response.data.contract.extensions.length - 1] 
                             : null)
        setPendingExtension(contractExt || null)
      }

      // Check if buyer already tipped
      if (response.data.contract?.status === 'completed') {
        try {
          const tipRes = await api.get(`/wallet/tip-status?contractId=${contractId}`)
          setHasTipped(tipRes.data.hasTipped)
        } catch {
          setHasTipped(false)
        }
      }

      // Fetch dispute details if contract is disputed
      if (response.data.contract?.dispute?.id) {
        try {
          const disputeRes = await api.get(`/disputes/${response.data.contract.dispute.id}`)
          setDisputeReplies(disputeRes.data.dispute?.replies || [])
        } catch (err) {
          // silently fail
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contract')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoCancel = async () => {
    try {
      await api.patch(`/contracts/${contractId}/auto-cancel`)
      toast.error('Contract auto-cancelled: deadline exceeded')
      fetchContract()
    } catch (err) {
      fetchContract()
    }
  }

  const handleRequestExtension = async () => {
    if (!extensionDays || extensionDays < 1) {
      toast.error('Please enter valid extension days')
      return
    }

    try {
      setRequestingExtension(true)
      await api.post(`/contracts/${contractId}/extension`, {
        days: parseInt(extensionDays),
        reason: extensionReason.trim(),
      })
           toast.success('Extension request sent to client')
      setShowExtensionModal(false)
      setExtensionDays(3)
      setExtensionReason('')
      setPendingExtension(null) // ADD THIS LINE
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request extension')
    } finally {
      setRequestingExtension(false)
    }
  }

    const [processingExtension, setProcessingExtension] = useState(false)

const handleApproveExtension = async (action) => {
    if (processingExtension) return
    try {
      setProcessingExtension(true)
      await api.patch(`/contracts/${contractId}/extension/respond`, { action })
      toast.success(action === 'approve' ? 'Extension approved' : 'Extension rejected')
      setPendingExtension(null) // ADD THIS LINE
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process extension')
    } finally {
      setProcessingExtension(false)
    }
  }

  const handleSendTip = async () => {
    const amount = parseFloat(tipAmount)
    if (!amount || amount < 500) {
      toast.error('Minimum tip is ₦500')
      return
    }

    try {
      setSendingTip(true)
      await api.post('/wallet/tip', {
        contractId,
        amount,
        message: tipMessage.trim(),
      })
      toast.success(`₦${amount.toLocaleString()} tip sent successfully!`)
      setShowTipModal(false)
      setTipAmount('')
      setTipMessage('')
      setHasTipped(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send tip')
    } finally {
      setSendingTip(false)
    }
  }

  const handleComplete = async () => {
    if (!window.confirm('Mark this contract as complete? Payment will be released to the freelancer.')) return

    try {
      setCompleting(true)
      await api.patch(`/contracts/${contractId}/confirm`)
      toast.success('Contract completed! Payment released to freelancer.')
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete contract')
    } finally {
      setCompleting(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this contract? This action cannot be undone.')) return

    try {
      setCancelling(true)
      await api.patch(`/contracts/${contractId}/cancel`)
      toast.success('Contract cancelled')
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel contract')
    } finally {
      setCancelling(false)
    }
  }

  const handleRequestRevision = async () => {
    if (!revisionFeedback.trim()) {
      toast.error('Please provide feedback for the revision')
      return
    }

    try {
      setRequestingRevision(true)
      await api.patch(`/contracts/${contractId}/revision`, {
        feedback: revisionFeedback.trim(),
      })
      toast.success('Revision requested')
      setShowRevisionModal(false)
      setRevisionFeedback('')
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request revision')
    } finally {
      setRequestingRevision(false)
    }
  }

  const handleSubmitReview = async () => {
    if (reviewRating < 1) {
      toast.error('Please select a rating')
      return
    }
    try {
      setSubmittingReview(true)
      await api.post(`/reviews/contract/${contractId}`, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      })
      toast.success('Review submitted successfully!')
      setHasReviewed(true)
      setReviewRating(0)
      setReviewComment('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  // ─── FILE DISPUTE ──────────────────────────────────────────────────────
  const handleFileDispute = async () => {
    if (!disputeReason.trim() || disputeReason.trim().length < 10) {
      toast.error('Please provide a detailed reason (at least 10 characters)')
      return
    }

    try {
      setFilingDispute(true)

      const formData = new FormData()
      formData.append('reason', disputeReason.trim())

      // Append evidence files
      disputeEvidence.forEach((fileObj) => {
        formData.append('evidence', fileObj.file)
      })

      await api.post(`/contracts/${contractId}/dispute`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.success('Dispute filed successfully. Admin will review.')
      setShowDisputeModal(false)
      setDisputeReason('')
      setDisputeEvidence([])
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to file dispute')
    } finally {
      setFilingDispute(false)
    }
  }

  // ─── DISPUTE REPLY ─────────────────────────────────────────────────────
  const handleAddReply = async () => {
    if (!replyContent.trim() && replyFiles.length === 0) {
      toast.error('Please add a message or upload evidence')
      return
    }

    try {
      setSubmittingReply(true)

      const formData = new FormData()
      if (replyContent.trim()) {
        formData.append('content', replyContent.trim())
      }

      replyFiles.forEach((fileObj) => {
        formData.append('files', fileObj.file)
      })

      await api.post(`/disputes/${contract.dispute.id}/reply`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.success('Reply submitted')
      setReplyContent('')
      setReplyFiles([])
      setShowReplyModal(false)

      // Refresh dispute data
      const disputeRes = await api.get(`/disputes/${contract.dispute.id}`)
      setDisputeReplies(disputeRes.data.dispute?.replies || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit reply')
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleReplyFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const maxSize = 20 * 1024 * 1024 // 20MB
    const validFiles = []

    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 20MB limit`)
        continue
      }
      validFiles.push(file)
    }

    setReplyFiles((prev) => [
      ...prev,
      ...validFiles.map((f) => ({
        file: f,
        name: f.name,
        type: f.type,
        size: f.size,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })),
    ])

    e.target.value = ''
  }

  const removeReplyFile = (index) => {
    setReplyFiles((prev) => {
      const file = prev[index]
      if (file.preview) URL.revokeObjectURL(file.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleDisputeFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const maxSize = 20 * 1024 * 1024 // 20MB
    const validFiles = []

    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 20MB limit`)
        continue
      }
      validFiles.push(file)
    }

    setDisputeEvidence((prev) => [
      ...prev,
      ...validFiles.map((f) => ({
        file: f,
        name: f.name,
        type: f.type,
        size: f.size,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })),
    ])

    e.target.value = ''
  }

  const removeDisputeFile = (index) => {
    setDisputeEvidence((prev) => {
      const file = prev[index]
      if (file.preview) URL.revokeObjectURL(file.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  // ─── FILE UPLOAD ───────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const maxSize = 20 * 1024 * 1024 // 20MB
    const validFiles = []

    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 20MB limit`)
        continue
      }
      validFiles.push(file)
    }

    setDeliveryFiles((prev) => [
      ...prev,
      ...validFiles.map((f) => ({
        file: f,
        name: f.name,
        type: f.type,
        size: f.size,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })),
    ])

    e.target.value = ''
  }

  const removeDeliveryFile = (index) => {
    setDeliveryFiles((prev) => {
      const file = prev[index]
      if (file.preview) URL.revokeObjectURL(file.preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmitDelivery = async () => {
    if (deliveryFiles.length === 0) {
      toast.error('Please upload at least one delivery file')
      return
    }

    try {
      setUploadingDelivery(true)

      const formData = new FormData()
      deliveryFiles.forEach((fileObj) => {
        formData.append('files', fileObj.file)
      })
      formData.append('note', deliveryNote.trim())

      await api.post(`/contracts/${contractId}/deliver`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.success('Work submitted successfully!')
      setDeliveryFiles([])
      setDeliveryNote('')
      fetchContract()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit delivery')
    } finally {
      setUploadingDelivery(false)
    }
  }

  const handlePay = async () => {
    try {
      setPaying(true)
      const response = await api.post(`/contracts/${contractId}/pay`)
      if (response.data.authorizationUrl) {
        window.location.href = response.data.authorizationUrl
      } else {
        toast.success('Payment processed')
        fetchContract()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!messageInput.trim() || !contract) return

    const otherUserId = contract.buyerId === user?.id ? contract.freelancerId : contract.buyerId

    try {
      setSendingMessage(true)
      await api.post('/messages', {
        receiverId: otherUserId,
        content: messageInput.trim(),
      })
      setMessageInput('')
      toast.success('Message sent')
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  // ─── FIXED: FORMAT FILE SIZE ───────────────────────────────────────────
  const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || bytes === '' || isNaN(Number(bytes))) {
      return 'Unknown size'
    }

    const numBytes = Number(bytes)
    if (numBytes === 0) return '0 B'

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(numBytes) / Math.log(1024))
    if (i < 0) return '0 B'

    const size = (numBytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)
    return `${size} ${sizes[i]}`
  }

  // ─── FIXED: HANDLE FILE DOWNLOAD ──────────────────────────────────────
  const handleDownload = (fileUrl, fileName) => {
    if (!fileUrl) {
      toast.error('File not available')
      return
    }

    try {
      // For direct URLs (Cloudinary, S3, etc.)
      if (fileUrl.startsWith('http')) {
        const link = document.createElement('a')
        link.href = fileUrl
        link.download = fileName || 'download'
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return
      }

      // For protected API endpoints
      api
        .get(fileUrl, { responseType: 'blob' })
        .then((response) => {
          const blob = new Blob([response.data])
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = fileName || 'download'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        })
        .catch(() => {
          toast.error('Failed to download file')
        })
    } catch (err) {
      toast.error('Failed to download file')
      console.error('Download error:', err)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatRelativeTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return formatDateTime(dateString)
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return {
          color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Active',
        }
      case 'pending_payment':
        return {
          color: 'bg-amber-100 text-amber-700 border-amber-200',
          icon: <DollarSign className="w-3.5 h-3.5" />,
          label: 'Pending Payment',
        }
      case 'completed':
        return {
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: 'Completed',
        }
      case 'cancelled':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: 'Cancelled',
        }
      case 'disputed':
        return {
          color: 'bg-purple-100 text-purple-700 border-purple-200',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: 'Disputed',
        }
      case 'delivered':
        return {
          color: 'bg-sky-100 text-sky-700 border-sky-200',
          icon: <PackageOpen className="w-3.5 h-3.5" />,
          label: 'Delivered',
        }
      case 'in_revision':
        return {
          color: 'bg-orange-100 text-orange-700 border-orange-200',
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          label: 'In Revision',
        }
      case 'revision_requested':
        return {
          color: 'bg-orange-100 text-orange-700 border-orange-200',
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          label: 'Revision Requested',
        }
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: <Clock className="w-3.5 h-3.5" />,
          label: status?.replace('_', ' ') || 'Unknown',
        }
    }
  }

  const getFileIcon = (type, url) => {
    if (isImageFile(type, url)) return <FileImage className="w-5 h-5 text-emerald-500" />
    return <File className="w-5 h-5 text-blue-500" />
  }

  const isImageFile = (type, url) => {
    if (type?.startsWith('image/')) return true
    if (!url) return false
    const ext = url.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
  }

  const getFileExtension = (filename) => {
    if (!filename) return ''
    return filename.split('.').pop()?.toUpperCase()
  }

  const getInitials = (firstName, lastName) => {
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase()
  }

  // Calculate expected delivery date based on contract start + duration
  const getExpectedDeliveryDate = () => {
    if (!contract?.startDate || (!contract?.duration && !contract?.proposal?.proposedDuration)) return null
    const start = new Date(contract.startDate)
    const expected = new Date(start)
    expected.setDate(start.getDate() + parseInt(contract.duration || contract.proposal?.proposedDuration || 0))
    return expected
  }

  // Calculate days remaining until expected delivery
  const getDeliveryCountdown = () => {
    const expected = getExpectedDeliveryDate()
    if (!expected) return null
    const now = new Date()
    const diff = expected - now
    if (diff <= 0) return { expired: true, days: 0, label: 'Overdue' }
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return { expired: false, days, label: `${days} day${days !== 1 ? 's' : ''} left` }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm">Loading contract...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/80 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => navigate('/contracts')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full hover:shadow-lg hover:shadow-emerald-500/25 transition-all font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </button>
        </div>
      </div>
    )
  }

  if (!contract) return null

  const isBuyer = contract.buyerId === user?.id
  const isFreelancer = contract.freelancerId === user?.id
  const otherParty = isBuyer ? contract.freelancer : contract.buyer
  const statusConfig = getStatusConfig(contract.status)

  const revisionsUsed = contract.revisionsUsed || 0
  const revisionsTotal = contract.revisionsTotal || 0
  const revisionsLeft = Math.max(0, revisionsTotal - revisionsUsed)

  const deliverables = contract.deliverables || []
  const milestones = contract.milestones || []
  const deliveries = contract.deliveries || []

  const canSubmitDelivery = isFreelancer && (contract.status === 'active' || contract.status === 'revision_requested')
  const canComplete = isBuyer && contract.status === 'delivered'
  const canRequestRevision = isBuyer && contract.status === 'delivered' && revisionsLeft > 0
  const canCancel = contract.status === 'active' || contract.status === 'revision_requested' || contract.status === 'pending_payment'
  const canPay = isBuyer && contract.status === 'pending_payment'
  const now = new Date()
  const isInDisputeWindow = contract.status === 'completed' && contract.disputeWindowEndsAt && new Date(contract.disputeWindowEndsAt) > now

  const canFileDispute =
    (isBuyer || isFreelancer) &&
    (['active', 'delivered', 'revision_requested', 'completed'].includes(contract.status) || isInDisputeWindow) &&
    !contract.dispute
  const canReview = isBuyer && contract.status === 'completed' && !hasReviewed
  const canRequestExtension = isFreelancer && (contract.status === 'active' || contract.status === 'revision_requested')
  const canRespondExtension = isBuyer && pendingExtension && pendingExtension.status === 'pending'
  const canSendTip = isBuyer && contract.status === 'completed' && !hasTipped

  // Offer tracking data
  const offerAmount = contract.proposal?.amount || contract.amount || 0
  const offerDuration = contract.duration || contract.proposal?.proposedDuration || contract.proposal?.duration || 0
  const offerRevisions = contract.proposal?.revisions || contract.revisionsTotal || 0

  // Delivery countdown
  const deliveryCountdown = getDeliveryCountdown()
  const expectedDeliveryDate = getExpectedDeliveryDate()

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => navigate('/contracts')}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
                {contract.escrowAmount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    ₦{contract.escrowAmount.toLocaleString()} in escrow
                  </span>
                )}

                {isInDisputeWindow && (
                  <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full font-medium">
                    <Scale className="w-3 h-3" />
                    Dispute window: {disputeWindowTime?.days || 0}d {disputeWindowTime?.hours || 0}h left
                  </span>
                )}

                {timeLeft && !timeLeft.expired && (contract.status === 'active' || contract.status === 'revision_requested') && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
                    <Timer className="w-3 h-3" />
                    {timeLeft.days}d {timeLeft.hours}h left
                  </span>
                )}
                {timeLeft?.expired && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Overdue
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {contract.job?.title || 'Direct Hire Contract'}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Created {formatDate(contract.createdAt)} · Contract #{contract.id?.slice(-8)?.toUpperCase()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {canComplete && (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 font-medium text-sm"
                >
                  {completing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm Delivery
                </button>
              )}

              {canRequestRevision && (
                <button
                  onClick={() => setShowRevisionModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Request Revision
                </button>
              )}

              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all disabled:opacity-50 font-medium text-sm"
                >
                  {cancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancel
                </button>
              )}

              {canFileDispute && (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 transition-all font-medium text-sm"
                >
                  <Gavel className="w-4 h-4" />
                  File Dispute
                </button>
              )}

              {canRequestExtension && (
                <button
                  onClick={() => setShowExtensionModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-50 transition-all font-medium text-sm"
                >
                  <Hourglass className="w-4 h-4" />
                  Request Extension
                </button>
              )}

              {canSendTip && (
                <button
                  onClick={() => setShowTipModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl hover:shadow-lg hover:shadow-pink-500/25 transition-all font-medium text-sm"
                >
                  <Gift className="w-4 h-4" />
                  Send Tip
                </button>
              )}

              <Link
                to={`/messages?to=${otherParty?.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── MAIN CONTENT ───────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
                       {/* Extension Alert */}
                       {pendingExtension && pendingExtension.status && (
              <div className={`rounded-2xl border p-6 ${
                pendingExtension.status.toLowerCase() === 'pending' 
                  ? 'bg-amber-50 border-amber-200' 
                  : pendingExtension.status.toLowerCase() === 'approved'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    pendingExtension.status.toLowerCase() === 'pending' 
                      ? 'bg-amber-100' 
                      : pendingExtension.status.toLowerCase() === 'approved'
                      ? 'bg-emerald-100'
                      : 'bg-red-100'
                  }`}>
                    <Hourglass className={`w-5 h-5 ${
                      pendingExtension.status.toLowerCase() === 'pending' 
                        ? 'text-amber-600' 
                        : pendingExtension.status.toLowerCase() === 'approved'
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h2 className={`font-bold mb-1 ${
                      pendingExtension.status.toLowerCase() === 'pending' 
                        ? 'text-amber-900' 
                        : pendingExtension.status.toLowerCase() === 'approved'
                        ? 'text-emerald-900'
                        : 'text-red-900'
                    }`}>
                      {pendingExtension.status.toLowerCase() === 'pending' 
                        ? 'Extension Request' 
                        : pendingExtension.status.toLowerCase() === 'approved'
                        ? 'Extension Approved'
                        : 'Extension Rejected'}
                    </h2>
                    <p className={`text-sm mb-2 ${
                      pendingExtension.status.toLowerCase() === 'pending' 
                        ? 'text-amber-700' 
                        : pendingExtension.status.toLowerCase() === 'approved'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}>
                      {pendingExtension.status.toLowerCase() === 'pending' 
                        ? (isFreelancer
                          ? `You requested a ${pendingExtension.days || '?'} day extension${pendingExtension.reason ? `: "${pendingExtension.reason}"` : ''}`
                          : `${contract.freelancer?.firstName || 'Freelancer'} requested a ${pendingExtension.days || '?'} day extension${pendingExtension.reason ? `: "${pendingExtension.reason}"` : ''}`)
                        : pendingExtension.status.toLowerCase() === 'approved'
                        ? (isFreelancer
                          ? `Your ${pendingExtension.days || '?'} day extension was approved. New deadline applied.`
                          : `You approved a ${pendingExtension.days || '?'} day extension for ${contract.freelancer?.firstName || 'the freelancer'}.`)
                        : (isFreelancer
                          ? `Your ${pendingExtension.days || '?'} day extension was rejected.`
                          : `You rejected the extension request from ${contract.freelancer?.firstName || 'the freelancer'}.`)
                      }
                    </p>
                    
                    {/* Approve/Reject buttons — only for buyer when pending */}
                    {isBuyer && pendingExtension.status.toLowerCase() === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApproveExtension('approve')}
                          disabled={processingExtension}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {processingExtension ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproveExtension('reject')}
                          disabled={processingExtension}
                          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {processingExtension ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Status badge — shown when not pending */}
                    {pendingExtension.status.toLowerCase() !== 'pending' && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        pendingExtension.status.toLowerCase() === 'approved' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {pendingExtension.status.toLowerCase() === 'approved' 
                          ? <CheckCircle2 className="w-3 h-3" /> 
                          : <XCircle className="w-3 h-3" />}
                        {pendingExtension.status.toLowerCase() === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dispute Alert Banner */}
            {contract.status === 'disputed' && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-purple-900 mb-1">Under Dispute Review</h2>
                    <p className="text-sm text-purple-700 mb-2">
                      This contract is currently under admin review. An admin will investigate and make a fair decision.
                    </p>
                    {contract.disputeReason && (
                      <div className="bg-white rounded-xl p-3 border border-purple-200 mt-2">
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Dispute Reason</p>
                        <p className="text-sm text-gray-700">{contract.disputeReason}</p>
                      </div>
                    )}
                    {contract.disputeEvidence?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Evidence</p>
                        <div className="flex flex-wrap gap-2">
                          {contract.disputeEvidence.map((ev, i) => (
                            <span key={i} className="text-xs bg-white border border-purple-200 px-2 py-1 rounded-md text-purple-700">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-xs text-purple-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Filed: {formatDateTime(contract.disputedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dispute Thread */}
            {contract.status === 'disputed' && disputeReplies.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  Dispute Thread
                </h2>
                <div className="space-y-4">
                  {disputeReplies.map((reply, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${reply.senderId === user?.id ? 'bg-purple-50 border-purple-200 ml-8' : 'bg-gray-50 border-gray-200 mr-8'}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-purple-600">
                            {reply.sender?.firstName?.[0]}{reply.sender?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {reply.sender?.firstName} {reply.sender?.lastName}
                            {reply.senderId === user?.id && <span className="text-xs text-purple-500 ml-1">(You)</span>}
                          </p>
                          <p className="text-xs text-gray-400">{formatDateTime(reply.createdAt)}</p>
                        </div>
                      </div>
                      {reply.content && <p className="text-sm text-gray-700 mb-3">{reply.content}</p>}
                      {reply.files?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {reply.files.map((file, fi) => (
                            <button
                              key={fi}
                              onClick={() => (isImageFile(file.type, file.url) ? setPreviewImage(file.url) : handleDownload(file.url, file.name))}
                              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs hover:border-purple-300 transition-colors"
                            >
                              {isImageFile(file.type, file.url) ? <ImageIcon className="w-3 h-3" /> : <File className="w-3 h-3" />}
                              <span className="truncate max-w-[150px]">{file.name || `File ${fi + 1}`}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Reply button */}
                {(isBuyer || isFreelancer) && contract.dispute?.status !== 'resolved' && (
                  <button
                    onClick={() => setShowReplyModal(true)}
                    className="mt-4 w-full py-2.5 border-2 border-dashed border-purple-200 text-purple-600 rounded-xl hover:bg-purple-50 transition-all font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Add Reply with Evidence
                  </button>
                )}
              </div>
            )}

            {/* Countdown Timer Card */}
            {contract.deadline && (contract.status === 'active' || contract.status === 'revision_requested') && (
              <div className={`rounded-2xl border p-6 ${timeLeft?.expired ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Timer className={`w-5 h-5 ${timeLeft?.expired ? 'text-red-500' : 'text-emerald-600'}`} />
                  <h2 className={`font-bold ${timeLeft?.expired ? 'text-red-900' : 'text-emerald-900'}`}>
                    {timeLeft?.expired ? 'Deadline Exceeded' : 'Time Remaining'}
                  </h2>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: timeLeft?.days || 0, label: 'Days' },
                    { value: timeLeft?.hours || 0, label: 'Hours' },
                    { value: timeLeft?.minutes || 0, label: 'Minutes' },
                    { value: timeLeft?.seconds || 0, label: 'Seconds' },
                  ].map((item, i) => (
                    <div key={i} className={`text-center p-3 rounded-xl ${timeLeft?.expired ? 'bg-white border border-red-200' : 'bg-white border border-emerald-200'}`}>
                      <div className={`text-2xl font-bold ${timeLeft?.expired ? 'text-red-600' : 'text-emerald-700'}`}>
                        {String(item.value).padStart(2, '0')}
                      </div>
                      <div className={`text-xs mt-1 ${timeLeft?.expired ? 'text-red-400' : 'text-emerald-500'}`}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <p className={`text-sm mt-3 ${timeLeft?.expired ? 'text-red-600' : 'text-emerald-600'}`}>
                  Deadline: {formatDateTime(contract.deadline)}
                </p>
              </div>
            )}

            {/* Expected Delivery Timer */}
            {expectedDeliveryDate && (contract.status === 'active' || contract.status === 'revision_requested' || contract.status === 'pending_payment') && (
              <div className={`rounded-2xl border p-6 ${deliveryCountdown?.expired ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Truck className={`w-5 h-5 ${deliveryCountdown?.expired ? 'text-red-500' : 'text-blue-600'}`} />
                  <h2 className={`font-bold ${deliveryCountdown?.expired ? 'text-red-900' : 'text-blue-900'}`}>
                    Expected Delivery
                  </h2>
                </div>
                <div className="flex items-center gap-6">
                  <div className={`flex-1 text-center p-4 rounded-xl ${deliveryCountdown?.expired ? 'bg-white border border-red-200' : 'bg-white border border-blue-200'}`}>
                    <div className={`text-3xl font-bold ${deliveryCountdown?.expired ? 'text-red-600' : 'text-blue-700'}`}>
                      {deliveryCountdown?.days || 0}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${deliveryCountdown?.expired ? 'text-red-400' : 'text-blue-500'}`}>
                      DAY{deliveryCountdown?.days !== 1 ? 'S' : ''} LEFT
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarClock className={`w-4 h-4 ${deliveryCountdown?.expired ? 'text-red-500' : 'text-blue-500'}`} />
                      <span className={deliveryCountdown?.expired ? 'text-red-700' : 'text-blue-700'}>
                        Expected by: <strong>{formatDate(expectedDeliveryDate)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className={`w-4 h-4 ${deliveryCountdown?.expired ? 'text-red-500' : 'text-blue-500'}`} />
                      <span className={deliveryCountdown?.expired ? 'text-red-700' : 'text-blue-700'}>
                        Duration: <strong>{offerDuration} day{offerDuration !== 1 ? 's' : ''}</strong>
                      </span>
                    </div>
                    {contract.startDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className={`w-4 h-4 ${deliveryCountdown?.expired ? 'text-red-500' : 'text-blue-500'}`} />
                        <span className={deliveryCountdown?.expired ? 'text-red-700' : 'text-blue-700'}>
                          Started: <strong>{formatDate(contract.startDate)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {deliveryCountdown?.expired && (
                  <p className="text-sm text-red-600 mt-3 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Delivery is overdue. Please submit your work as soon as possible.
                  </p>
                )}
              </div>
            )}

            {/* Contract Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-500" />
                Contract Details
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Amount</p>
                    <p className="font-bold text-gray-900">{formatCurrency(contract.amount)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Start Date</p>
                    <p className="font-bold text-gray-900">{formatDate(contract.startDate)}</p>
                  </div>
                </div>

                {contract.deadline && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Deadline</p>
                      <p className="font-bold text-gray-900">{formatDateTime(contract.deadline)}</p>
                    </div>
                  </div>
                )}

                {contract.endDate && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Completed</p>
                      <p className="font-bold text-gray-900">{formatDate(contract.endDate)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Revisions</p>
                    <p className="font-bold text-gray-900">
                      {revisionsUsed} used · {revisionsLeft} left
                    </p>
                  </div>
                </div>

                {(contract.duration || contract.proposal?.proposedDuration) && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Duration</p>
                      <p className="font-bold text-gray-900">{contract.duration || contract.proposal?.proposedDuration || 0} days</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Deliverables Checklist */}
            {deliverables.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-emerald-500" />
                  Deliverables
                </h2>
                <div className="space-y-2">
                  {deliverables.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${item.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                      )}
                      <span className={`text-sm ${item.completed ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>
                        {item.name || item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-emerald-500" />
                  Milestones
                </h2>
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${milestone.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {milestone.completed ? <Check className="w-4 h-4" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`font-semibold ${milestone.completed ? 'text-emerald-700 line-through' : 'text-gray-900'}`}>
                            {milestone.name || milestone.title}
                          </p>
                          {milestone.amount && <span className="text-sm font-bold text-emerald-600">{formatCurrency(milestone.amount)}</span>}
                        </div>
                        {milestone.description && <p className="text-sm text-gray-500 mt-1">{milestone.description}</p>}
                        {milestone.dueDate && <p className="text-xs text-gray-400 mt-1">Due: {formatDate(milestone.dueDate)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── FREELANCER: DELIVERY UPLOAD ──────────────────────── */}
            {canSubmitDelivery && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-500" />
                  Submit Work
                </h2>

                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-all">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="delivery-upload"
                    disabled={uploadingDelivery}
                  />
                  <label htmlFor="delivery-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Click to upload files</p>
                    <p className="text-xs text-gray-400">Images or PDFs up to 20MB each</p>
                  </label>
                </div>

                {/* Selected Files */}
                {deliveryFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {deliveryFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        {file.preview ? (
                          <img src={file.preview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          getFileIcon(file.type)
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          onClick={() => removeDeliveryFile(index)}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Delivery Note */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Note</label>
                  <textarea
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="Describe what you're delivering..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <button
                  onClick={handleSubmitDelivery}
                  disabled={uploadingDelivery || deliveryFiles.length === 0}
                  className="mt-4 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploadingDelivery ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Submit Work
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ─── DELIVERY HISTORY — BUYER & FREELANCER ────────────── */}
            {deliveries.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <PackageOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Deliveries</h2>
                    <p className="text-xs text-gray-400">{deliveries.length} submission{deliveries.length !== 1 ? 's' : ''} received</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {deliveries.map((delivery, index) => (
                    <div key={index} className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50">
                      {/* Delivery Header */}
                      <div className="px-5 py-4 bg-white border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-emerald-600">#{index + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">Delivery #{index + 1}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>{formatDateTime(delivery.createdAt)}</span>
                                <span>·</span>
                                <span>{formatRelativeTime(delivery.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          {delivery.status && (
                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${delivery.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : delivery.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                              {delivery.status === 'approved' ? 'Approved' : delivery.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delivery Note */}
                      {delivery.note && (
                        <div className="px-5 py-3 bg-amber-50/50 border-b border-gray-100">
                          <p className="text-sm text-gray-700 leading-relaxed">{delivery.note}</p>
                        </div>
                      )}

                      {/* Files — Image Gallery + Document List */}
                      {delivery.files?.length > 0 && (
                        <div className="p-5">
                          {(() => {
                            const imageFiles = delivery.files.filter((f) => isImageFile(f.type, f.url))
                            const docFiles = delivery.files.filter((f) => !isImageFile(f.type, f.url))

                            return (
                              <>
                                {/* Images Grid */}
                                {imageFiles.length > 0 && (
                                  <div className="mb-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      Images ({imageFiles.length})
                                    </p>
                                    <div className={`grid gap-3 ${imageFiles.length === 1 ? 'grid-cols-1' : imageFiles.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                                      {imageFiles.map((file, fIndex) => (
                                        <div
                                          key={fIndex}
                                          className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 cursor-pointer bg-gray-100"
                                          onClick={() => setPreviewImage(file.url)}
                                        >
                                          <img
                                            src={file.url}
                                            alt={file.name || 'Delivery image'}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                            onError={(e) => {
                                              e.target.style.display = 'none'
                                              e.target.nextSibling.style.display = 'flex'
                                            }}
                                          />
                                          {/* Fallback on error */}
                                          <div className="hidden absolute inset-0 items-center justify-center bg-gray-100">
                                            <ImageIcon className="w-8 h-8 text-gray-300" />
                                          </div>
                                          {/* Hover Overlay */}
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <div className="flex items-center gap-2 text-white">
                                              <ZoomIn className="w-5 h-5" />
                                              <span className="text-xs font-medium">View</span>
                                            </div>
                                          </div>
                                          {/* Filename overlay at bottom */}
                                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[10px] text-white truncate">{file.name}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Documents List */}
                                {docFiles.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <File className="w-3.5 h-3.5" />
                                      Documents ({docFiles.length})
                                    </p>
                                    <div className="space-y-2">
                                      {docFiles.map((file, fIndex) => (
                                        <div
                                          key={fIndex}
                                          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group cursor-pointer"
                                          onClick={() => handleDownload(file.url, file.name)}
                                        >
                                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                            <FileText className="w-5 h-5 text-blue-500" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 truncate">{file.name || 'Document'}</p>
                                            <p className="text-xs text-gray-400">
                                              {getFileExtension(file.name)} · {formatFileSize(file.size)}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded-md">
                                              {getFileExtension(file.name)}
                                            </span>
                                            <Download className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      )}

                      {/* Delivery Footer */}
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <User className="w-3.5 h-3.5" />
                          <span>From {delivery.submittedBy?.firstName || contract.freelancer?.firstName || 'Freelancer'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{delivery.files?.length || 0} file{(delivery.files?.length || 0) !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Buyer Actions - Confirm/Revision */}
                      {isBuyer && delivery.status === 'pending' && contract.status === 'delivered' && index === deliveries.length - 1 && (
                        <div className="px-5 py-3 bg-white border-t border-gray-100 flex gap-2">
                          <button
                            onClick={handleComplete}
                            disabled={completing}
                            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
                          >
                            {completing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Approve & Release Payment
                          </button>
                          <button
                            onClick={() => setShowRevisionModal(true)}
                            disabled={requestingRevision || revisionsLeft <= 0}
                            className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 font-medium text-sm flex items-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Revision
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── REVIEW SECTION ───────────────────────────────────── */}
            {canReview && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Rate Freelancer
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  How was your experience working with {contract.freelancer?.firstName || 'the freelancer'}?
                </p>

                {/* Star Rating */}
                <div className="flex items-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)} className="transition-transform hover:scale-110">
                      <Star
                        className={`w-8 h-8 ${
                          star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-medium text-gray-600">
                    {reviewRating > 0 ? `${reviewRating} star${reviewRating !== 1 ? 's' : ''}` : 'Select a rating'}
                  </span>
                </div>

                {/* Comment */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Comment <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview || reviewRating < 1}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl hover:shadow-lg hover:shadow-amber-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4" />
                      Submit Review
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Review Submitted Message */}
            {isBuyer && contract.status === 'completed' && hasReviewed && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <h3 className="font-bold text-emerald-900">Review Submitted</h3>
                  <p className="text-sm text-emerald-700">Thank you for your feedback!</p>
                </div>
              </div>
            )}

            {/* Quick Message */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                Quick Message
              </h2>
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={`Message ${otherParty?.firstName || 'user'}...`}
                  className="flex-1 px-4 py-3 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendingMessage}
                  className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </div>

          {/* ─── SIDEBAR ────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Escrow Card with Payment */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-100" />
                <h3 className="font-bold">Escrow Protected</h3>
              </div>
              <p className="text-3xl font-bold mb-1">₦{contract.escrowAmount?.toLocaleString() || '0'}</p>
              <p className="text-sm text-emerald-100 mb-4">held securely in escrow</p>

              {isInDisputeWindow && (
                <div className="mt-3 p-3 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Scale className="w-4 h-4 text-white/80" />
                    <span className="text-sm font-medium text-white">Dispute Window Open</span>
                  </div>
                  <p className="text-xs text-white/70">
                    Funds held for {disputeWindowTime?.days || 0}d {disputeWindowTime?.hours || 0}h more
                  </p>
                </div>
              )}

              {/* Payment Button inside Escrow Card */}
              {canPay && (
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full mb-4 py-2.5 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {paying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  {paying ? 'Processing...' : 'Pay Now'}
                </button>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-emerald-100">
                  <Check className="w-4 h-4" />
                  <span>Payment protected</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-100">
                  <Check className="w-4 h-4" />
                  <span>Released on completion</span>
                </div>
              </div>
            </div>

            {/* Offer Tracking Counter */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-emerald-500" />
                Offer Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-gray-600">Offer Amount</span>
                  </div>
                  <span className="font-bold text-gray-900">₦{offerAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Duration</span>
                  </div>
                  <span className="font-bold text-gray-900">{offerDuration} days</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-600">Revisions</span>
                  </div>
                  <span className="font-bold text-gray-900">{revisionsUsed} / {offerRevisions}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-gray-600">Status</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Buyer Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider">Buyer</h3>
              <Link to={`/profile/${contract.buyer?.id}`} className="flex items-center gap-3 group">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {contract.buyer?.avatar ? (
                    <img src={contract.buyer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(contract.buyer?.firstName, contract.buyer?.lastName)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                      {contract.buyer?.firstName} {contract.buyer?.lastName}
                    </p>
                    {contract.buyer?.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-500">Client</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors ml-auto shrink-0" />
              </Link>
            </div>

            {/* Freelancer Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider">Freelancer</h3>
              <Link to={`/profile/${contract.freelancer?.id}`} className="flex items-center gap-3 group">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {contract.freelancer?.avatar ? (
                    <img src={contract.freelancer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(contract.freelancer?.firstName, contract.freelancer?.lastName)
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                      {contract.freelancer?.firstName} {contract.freelancer?.lastName}
                    </p>
                    {contract.freelancer?.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-500">Contractor</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors ml-auto shrink-0" />
              </Link>
            </div>

            {/* Role-based Guide */}
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
              <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                <Flag className="w-4 h-4" />
                {isBuyer ? 'Buyer Guide' : 'Freelancer Guide'}
              </h3>
              <ul className="space-y-3 text-sm text-emerald-700">
                {isBuyer ? (
                  <>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Review delivery and confirm when satisfied</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Request revisions if changes are needed ({revisionsLeft} left)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Payment held for 2 days after confirmation for dispute protection</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Upload deliverables before the deadline</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Wait for buyer review and confirmation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Payment releases to your wallet on approval</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Contract Timeline */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wider">Timeline</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-2 bg-emerald-500 rounded-full shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Contract Created</p>
                    <p className="text-xs text-gray-400">{formatDateTime(contract.createdAt)}</p>
                  </div>
                </div>
                {contract.startDate && (
                  <div className="flex gap-3">
                    <div className="w-2 bg-emerald-500 rounded-full shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Started</p>
                      <p className="text-xs text-gray-400">{formatDateTime(contract.startDate)}</p>
                    </div>
                  </div>
                )}
                {expectedDeliveryDate && (
                  <div className="flex gap-3">
                    <div className={`w-2 rounded-full shrink-0 ${deliveryCountdown?.expired ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Expected Delivery</p>
                      <p className={`text-xs ${deliveryCountdown?.expired ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {formatDate(expectedDeliveryDate)} {deliveryCountdown?.expired && '(Overdue)'}
                      </p>
                    </div>
                  </div>
                )}
                {contract.deliveredAt && (
                  <div className="flex gap-3">
                    <div className="w-2 bg-sky-500 rounded-full shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Delivered</p>
                      <p className="text-xs text-gray-400">{formatDateTime(contract.deliveredAt)}</p>
                    </div>
                  </div>
                )}
                {contract.endDate && (
                  <div className="flex gap-3">
                    <div className="w-2 bg-blue-500 rounded-full shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Completed</p>
                      <p className="text-xs text-gray-400">{formatDateTime(contract.endDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── IMAGE PREVIEW MODAL ──────────────────────────────── */}
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

      {/* ─── REVISION MODAL ─────────────────────────────────────── */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Request Revision</h2>
                  <p className="text-xs text-gray-400">{revisionsLeft} revision{revisionsLeft !== 1 ? 's' : ''} remaining</p>
                </div>
              </div>
              <button
                onClick={() => setShowRevisionModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Feedback</label>
                <textarea
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  placeholder="Describe what needs to be changed or improved..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setShowRevisionModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestRevision}
                  disabled={requestingRevision || !revisionFeedback.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl hover:shadow-lg hover:shadow-orange-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {requestingRevision ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Request Revision
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DISPUTE MODAL ─────────────────────────────────────── */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Gavel className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">File a Dispute</h2>
                  <p className="text-xs text-gray-400">Admin will review and make a fair decision</p>
                </div>
              </div>
              <button
                onClick={() => setShowDisputeModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <div className="flex items-start gap-2">
                  <Scale className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-700 leading-relaxed">
                    Filing a dispute will freeze the contract and escrow. An admin will investigate. If the freelancer is found at fault, the full escrow amount will be refunded to your wallet.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Dispute <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why you are filing this dispute. Be detailed and specific..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 10 characters required</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Evidence Files (optional)</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-purple-300 hover:bg-purple-50/30 transition-all">
                  <input
                    type="file"
                    multiple
                    onChange={handleDisputeFileSelect}
                    className="hidden"
                    id="dispute-upload"
                  />
                  <label htmlFor="dispute-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    <p className="text-xs font-medium text-gray-700">Click to upload evidence files</p>
                    <p className="text-xs text-gray-400">Images or PDFs up to 20MB each</p>
                  </label>
                </div>

                {/* Selected Files */}
                {disputeEvidence.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {disputeEvidence.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        {file.preview ? (
                          <img src={file.preview} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <File className="w-4 h-4 text-blue-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          onClick={() => removeDisputeFile(index)}
                          className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileDispute}
                  disabled={filingDispute || !disputeReason.trim() || disputeReason.trim().length < 10}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl hover:shadow-lg hover:shadow-purple-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {filingDispute ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Filing...
                    </>
                  ) : (
                    <>
                      <Gavel className="w-4 h-4" />
                      File Dispute
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── REPLY MODAL ───────────────────────────────────────── */}
      {showReplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add Reply</h2>
                  <p className="text-xs text-gray-400">Respond to the dispute with evidence</p>
                </div>
              </div>
              <button
                onClick={() => setShowReplyModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type your response to the dispute..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Evidence Files (optional)</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-purple-300 hover:bg-purple-50/30 transition-all">
                  <input
                    type="file"
                    multiple
                    onChange={handleReplyFileSelect}
                    className="hidden"
                    id="reply-upload"
                  />
                  <label htmlFor="reply-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    <p className="text-xs font-medium text-gray-700">Click to upload files</p>
                    <p className="text-xs text-gray-400">Images or PDFs up to 20MB each</p>
                  </label>
                </div>

                {/* Selected Files */}
                {replyFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {replyFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        {file.preview ? (
                          <img src={file.preview} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <File className="w-4 h-4 text-blue-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          onClick={() => removeReplyFile(index)}
                          className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReply}
                  disabled={submittingReply || (!replyContent.trim() && replyFiles.length === 0)}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl hover:shadow-lg hover:shadow-purple-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {submittingReply ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── EXTENSION REQUEST MODAL ──────────────────────────── */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Hourglass className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Request Extension</h2>
                  <p className="text-xs text-gray-400">Ask client for more time</p>
                </div>
              </div>
              <button
                onClick={() => setShowExtensionModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Days</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none text-sm transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">Maximum 30 days</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Explain why you need more time..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setShowExtensionModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestExtension}
                  disabled={requestingExtension || !extensionDays}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl hover:shadow-lg hover:shadow-amber-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {requestingExtension ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Hourglass className="w-4 h-4" />
                      Request Extension
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SEND TIP MODAL ───────────────────────────────────── */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Send a Tip</h2>
                  <p className="text-xs text-gray-400">Optional appreciation for great work</p>
                </div>
              </div>
              <button
                onClick={() => setShowTipModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                <p className="text-sm text-pink-700 text-center">
                  Show your appreciation to <strong>{contract.freelancer?.firstName}</strong> for their great work!
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₦)</label>
                <input
                  type="number"
                  min={500}
                  max={100000}
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Enter amount (min ₦500)"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 outline-none text-sm transition-all placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Min ₦500 · Max ₦100,000</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={tipMessage}
                  onChange={(e) => setTipMessage(e.target.value)}
                  placeholder="Add a personal note..."
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setShowTipModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTip}
                  disabled={sendingTip || !tipAmount || parseFloat(tipAmount) < 500}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl hover:shadow-lg hover:shadow-pink-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {sendingTip ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Send Tip
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContractDetail