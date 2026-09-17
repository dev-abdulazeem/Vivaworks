import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../utils/api'
import { io } from 'socket.io-client'
import {
  Loader2,
  AlertCircle,
  Search,
  Check,
  CheckCheck,
  X,
  Trash2,
  Send,
  Clock,
  User,
  MessageSquare,
  Star,
  MoreVertical,
  Phone,
  HandCoins,
  CheckCircle2,
  XCircle,
  Briefcase,
  ChevronLeft,
  MoreHorizontal,
  BadgeCheck,
  PhoneCall,
  Video,
  Paperclip,
  Smile,
  Heart,
  Bookmark,
  MessageCircle,
  FileText,
  Image,
  File,
  Download,
  Eye,
  Calendar,
  ListChecks,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Wallet,
  UserCheck,
  ArrowRight,
  Shield,
  Banknote,
  Ban,
  Archive,
  ArchiveRestore,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

const Messages = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId: urlUserId } = useParams()
  const { user, isAuthenticated } = useAuthStore()

  // ─── CONVERSATION STATE ────────────────────────────────────────────────
  const [conversations, setConversations] = useState([])
  const [archivedConversations, setArchivedConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const [blockedContacts, setBlockedContacts] = useState([])

  // File upload
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef(null)

  // Offer modal
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerData, setOfferData] = useState({
    amount: '',
    title: '',
    description: '',
    type: 'direct_hire',
    durationDays: 7,
    revisions: 3,
    deliverables: [''],
  })
  const [sendingOffer, setSendingOffer] = useState(false)
  const [milestones, setMilestones] = useState([])

  // Menu
  const [showChatMenu, setShowChatMenu] = useState(false)
  const chatMenuRef = useRef(null)

  const processedUserId = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // ─── SOCKET.IO STATE ───────────────────────────────────────────────────
  const [socket, setSocket] = useState(null)
  const [typingUser, setTypingUser] = useState(null)
  const typingTimeoutRef = useRef(null)

  // ─── CALL STATE ────────────────────────────────────────────────────────
  const [isInCall, setIsInCall] = useState(false)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callStatus, setCallStatus] = useState('idle')
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentCallRoom, setCurrentCallRoom] = useState(null)
  const [currentCallId, setCurrentCallId] = useState(null)
  const [callType, setCallType] = useState('video')
  const [callDuration, setCallDuration] = useState(0)
  const [callTimerRef, setCallTimerRef] = useState(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const callStartTimeRef = useRef(null)
  const ringtoneRef = useRef(null)

  // ─── FIX: BUFFER FOR PENDING OFFERS ─────────────────────────────────────
  const pendingOffersRef = useRef([])

  // ─── SOCKET.IO SETUP ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      auth: {
        token: localStorage.getItem('accessToken') || '',
      },
      forceNew: true,
    })

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      newSocket.emit('join-user-room', user.id)
    })

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
    })

    // ── REAL-TIME MESSAGE ──
    newSocket.on('new_message', (message) => {
      if (selectedUser && message.senderId === selectedUser.id) {
        setMessages((prev) => [...prev, message])
        api.patch(`/messages/read/${message.senderId}`).catch(() => {})
      }
      fetchConversations()
    })

    // ── MESSAGE READ RECEIPT ──
    newSocket.on('messages_read', ({ by }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.senderId === user.id && msg.receiverId === by
            ? { ...msg, isRead: true }
            : msg
        )
      )
    })

    // ── USER TYPING ──
    newSocket.on('user_typing', (data) => {
      if (selectedUser && data.userId === selectedUser.id) {
        setTypingUser(data.firstName)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null)
        }, 3000)
      }
    })

    // ── INCOMING CALL ──
    newSocket.on('incoming-call', async (data) => {
      let callerName = data.callerName
      let callerAvatar = data.callerAvatar

      if (!callerName && data.callerId) {
        const conv = conversations.find(c => c.user.id === data.callerId)
        if (conv) {
          callerName = `${conv.user.firstName} ${conv.user.lastName}`
          callerAvatar = conv.user.avatar
        } else {
          try {
            const res = await api.get(`/users/profile/${data.callerId}`)
            const u = res.data.user
            callerName = `${u.firstName} ${u.lastName}`
            callerAvatar = u.avatar
          } catch (e) {
            callerName = 'Someone'
          }
        }
      }

      setIncomingCall({
        ...data,
        callerName: callerName || 'Someone',
        callerAvatar: callerAvatar || null,
      })
      setCallStatus('ringing')
      playRingtone()
    })

    // ── CALL ACCEPTED ──
    newSocket.on('call-accepted', (data) => {
      setCallStatus('ongoing')
      setIsInCall(true)
      callStartTimeRef.current = Date.now()
      startCallTimer()
      stopRingtone()
    })

    // ── CALL DECLINED ──
    newSocket.on('call-declined', () => {
      toast.error('Call declined')
      stopRingtone()
      resetCallState()
    })

    // ── CALL ENDED ──
    newSocket.on('call-ended', (data) => {
      toast.info('Call ended')
      stopRingtone()
      handleCallEnd(data.duration)
    })

    // ── WEBRTC SIGNALING ──
    newSocket.on('webrtc-offer', async (data) => {
      console.log('Received webrtc-offer for room:', data.roomId)

      if (!peerConnectionRef.current) {
        console.log('Peer connection not ready, queuing offer')
        pendingOffersRef.current.push(data)
        return
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))
        const answer = await peerConnectionRef.current.createAnswer()
        await peerConnectionRef.current.setLocalDescription(answer)
        newSocket.emit('webrtc-answer', { roomId: data.roomId, answer })
        console.log('Sent webrtc-answer')
      } catch (err) {
        console.error('Error handling offer:', err)
      }
    })

    newSocket.on('webrtc-answer', async (data) => {
      console.log('Received webrtc-answer')
      if (!peerConnectionRef.current) return
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        console.log('Set remote description from answer')
      } catch (err) {
        console.error('Error handling answer:', err)
      }
    })

    newSocket.on('webrtc-ice-candidate', async (data) => {
      if (!peerConnectionRef.current) return
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
      } catch (err) {
        console.error('Error adding ICE candidate:', err)
      }
    })

    newSocket.on('peer-toggle-audio', (data) => {
      // Handle remote audio toggle UI
    })

    newSocket.on('peer-toggle-video', (data) => {
      // Handle remote video toggle UI
    })

    setSocket(newSocket)

    return () => {
      clearTimeout(typingTimeoutRef.current)
      newSocket.disconnect()
      endLocalCall()
    }
  }, [isAuthenticated, user?.id, selectedUser?.id, conversations])

  // ─── HANDLE INCOMING CALL FROM NOTIFICATION LINK ─────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    const params = new URLSearchParams(location.search)
    const callId = params.get('call')

    if (!callId) return

    const handleCallFromNotification = async () => {
      try {
        const { data } = await api.get(`/messages/call/${callId}`)
        const call = data.call

        if (!call || call.status !== 'ringing') {
          navigate('/messages', { replace: true })
          return
        }

        setIncomingCall({
          callId: call.id,
          roomId: call.roomId,
          callerId: call.callerId,
          callerName: `${call.caller?.firstName || ''} ${call.caller?.lastName || ''}`.trim() || 'Someone',
          callerAvatar: call.caller?.avatar || null,
          callType: call.callType || 'video',
        })
        setCallStatus('ringing')
        playRingtone()

        const callerId = call.callerId
        const conv = conversations.find(c => c.user.id === callerId)
        if (conv) {
          selectConversation(conv.user)
        } else {
          await fetchUserAndStartChat(callerId)
        }

        navigate(`/messages/${callerId}`, { replace: true })
      } catch (err) {
        console.error('Handle call from notification error:', err)
        navigate('/messages', { replace: true })
      }
    }

    handleCallFromNotification()
  }, [isAuthenticated, user?.id, location.search, conversations, navigate])

  // ─── RINGTONE ──────────────────────────────────────────────────────────
  const playRingtone = () => {
    try {
      const audio = new Audio('/ringtone.mp3')
      audio.loop = true
      audio.volume = 0.7
      audio.play().catch(() => {})
      ringtoneRef.current = audio
    } catch (e) {
      console.error('Ringtone error:', e)
    }
  }

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause()
      ringtoneRef.current.currentTime = 0
      ringtoneRef.current = null
    }
  }

  // ─── CALL TIMER ────────────────────────────────────────────────────────
  const startCallTimer = () => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
    setCallTimerRef(timer)
  }

  const stopCallTimer = () => {
    if (callTimerRef) {
      clearInterval(callTimerRef)
      setCallTimerRef(null)
    }
  }

  // ─── WEBRTC SETUP ──────────────────────────────────────────────────────
  const startWebRTC = async (roomId, isCaller) => {
    try {
      console.log('Starting WebRTC, isCaller:', isCaller, 'roomId:', roomId)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true,
      })
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      console.log('Got local stream, tracks:', stream.getTracks().map(t => t.kind))

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
        console.log('Added track to peer connection:', track.kind)
      })

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('Sending ICE candidate')
          socket.emit('webrtc-ice-candidate', { roomId, candidate: event.candidate })
        }
      }

      pc.ontrack = (event) => {
        console.log('Received remote track:', event.streams[0].getTracks().map(t => t.kind))
        setRemoteStream(event.streams[0])
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState)
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          handleCallEnd()
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState)
      }

      peerConnectionRef.current = pc
      console.log('Peer connection created')

      if (!isCaller && pendingOffersRef.current.length > 0) {
        console.log('Processing pending offers:', pendingOffersRef.current.length)
        for (const pendingData of pendingOffersRef.current) {
          if (pendingData.roomId === roomId) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(pendingData.offer))
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              socket.emit('webrtc-answer', { roomId, answer })
              console.log('Processed pending offer and sent answer')
            } catch (err) {
              console.error('Error processing pending offer:', err)
            }
          }
        }
        pendingOffersRef.current = []
      }

      if (isCaller) {
        console.log('Creating offer as caller...')
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('webrtc-offer', { roomId, offer })
        console.log('Sent webrtc-offer')
      }

      socket.emit('join-call-room', roomId)
      console.log('Joined call room:', roomId)
    } catch (err) {
      console.error('WebRTC error:', err)
      toast.error('Could not access camera/microphone')
      handleCallEnd()
    }
  }

  // ─── END CALL ────────────────────────────────────────────────────────
  const endLocalCall = useCallback(async () => {
    stopCallTimer()
    const duration = callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      setLocalStream(null)
    }
    setRemoteStream(null)
    setIsInCall(false)
    setCallStatus('idle')
    setIncomingCall(null)
    setCurrentCallRoom(null)
    setCurrentCallId(null)
    setIsMinimized(false)
    setCallDuration(0)
    callStartTimeRef.current = null
    stopRingtone()
    pendingOffersRef.current = []

    if (currentCallId) {
      try {
        await api.patch(`/messages/call/${currentCallId}/end`, { duration })
      } catch (err) {
        console.error('Error ending call:', err)
      }
    }
  }, [localStream, currentCallId, callTimerRef])

  const resetCallState = () => {
    stopCallTimer()
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      setLocalStream(null)
    }
    setRemoteStream(null)
    setIsInCall(false)
    setCallStatus('idle')
    setIncomingCall(null)
    setCurrentCallRoom(null)
    setCurrentCallId(null)
    setIsMinimized(false)
    setCallDuration(0)
    callStartTimeRef.current = null
    pendingOffersRef.current = []
  }

  // ─── HANDLE CALL END ───────────────────────────────────────────────────
  const handleCallEnd = async (serverDuration) => {
    const duration = serverDuration || (callStartTimeRef.current
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0)

    stopRingtone()
    resetCallState()

    const wasOutgoing = incomingCall === null
    const otherUserId = selectedUser?.id || incomingCall?.callerId

    const callHistoryMsg = {
      id: `call-${Date.now()}`,
      content: wasOutgoing
        ? `📞 Outgoing ${callType === 'video' ? 'video' : 'voice'} call`
        : `📞 Incoming ${callType === 'video' ? 'video' : 'voice'} call`,
      senderId: wasOutgoing ? user.id : (incomingCall?.callerId || otherUserId),
      createdAt: new Date().toISOString(),
      isRead: true,
      isCallHistory: true,
      callDuration: duration,
      callType: callType,
      callDirection: wasOutgoing ? 'outgoing' : 'incoming',
      sender: wasOutgoing ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      } : {
        id: incomingCall?.callerId || otherUserId,
        firstName: incomingCall?.callerName?.split(' ')[0] || selectedUser?.firstName || 'Someone',
        lastName: incomingCall?.callerName?.split(' ')[1] || selectedUser?.lastName || '',
        avatar: incomingCall?.callerAvatar || selectedUser?.avatar,
      },
    }

    setMessages((prev) => [...prev, callHistoryMsg])

    try {
      await api.post('/messages/call-history', {
        receiverId: otherUserId,
        duration,
        callType,
        direction: wasOutgoing ? 'outgoing' : 'incoming',
      })
    } catch (err) {
      console.error('Error saving call history:', err)
    }
  }

  // ─── INITIATE CALL ─────────────────────────────────────────────────────
  const initiateCall = async (type = 'video') => {
    if (!selectedUser || !socket) return
    setCallType(type)

    try {
      const response = await api.post('/messages/call/initiate', {
        receiverId: selectedUser.id,
        callType: type,
      })

      const { call } = response.data
      setCurrentCallRoom(call.roomId)
      setCurrentCallId(call.id)
      setCallStatus('ringing')
      setIsInCall(true)

      await startWebRTC(call.roomId, true)

      socket.emit('call-initiate', {
        callId: call.id,
        roomId: call.roomId,
        callerId: user.id,
        receiverId: selectedUser.id,
        callType: type,
        callerName: `${user.firstName} ${user.lastName}`,
        callerAvatar: user.avatar,
      })
    } catch (err) {
      console.error('Initiate call error:', err)
      toast.error(err.response?.data?.message || 'Failed to start call')
      resetCallState()
    }
  }

  // ─── ACCEPT INCOMING CALL ──────────────────────────────────────────────
  const acceptIncomingCall = async () => {
    if (!incomingCall || !socket) return

    setCallType(incomingCall.callType || 'video')
    setCurrentCallRoom(incomingCall.roomId)
    setCurrentCallId(incomingCall.callId)
    setCallStatus('ongoing')
    setIsInCall(true)
    callStartTimeRef.current = Date.now()
    startCallTimer()
    stopRingtone()

    await startWebRTC(incomingCall.roomId, false)

    socket.emit('call-accept', {
      roomId: incomingCall.roomId,
      receiverId: user.id,
      callId: incomingCall.callId,
    })

    setIncomingCall(null)
  }

  // ─── DECLINE INCOMING CALL ─────────────────────────────────────────────
  const declineIncomingCall = () => {
    if (!incomingCall || !socket) return

    socket.emit('call-decline', {
      roomId: incomingCall.roomId,
      callId: incomingCall.callId,
    })

    const missedCallMsg = {
      id: `missed-${Date.now()}`,
      content: `❌ Missed ${incomingCall.callType === 'video' ? 'video' : 'voice'} call`,
      senderId: incomingCall.callerId,
      createdAt: new Date().toISOString(),
      isRead: true,
      isCallHistory: true,
      callDuration: 0,
      callType: incomingCall.callType,
      callDirection: 'missed',
      sender: {
        id: incomingCall.callerId,
        firstName: incomingCall.callerName?.split(' ')[0] || 'Someone',
        lastName: incomingCall.callerName?.split(' ')[1] || '',
        avatar: incomingCall.callerAvatar,
      },
    }

    setMessages((prev) => [...prev, missedCallMsg])
    setIncomingCall(null)
    setCallStatus('idle')
    stopRingtone()
  }

  // ─── TOGGLE AUDIO/VIDEO ────────────────────────────────────────────────
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
        if (socket && currentCallRoom) {
          socket.emit('call-toggle-audio', { roomId: currentCallRoom, enabled: audioTrack.enabled })
        }
      }
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
        if (socket && currentCallRoom) {
          socket.emit('call-toggle-video', { roomId: currentCallRoom, enabled: videoTrack.enabled })
        }
      }
    }
  }

  // ─── FETCH CONVERSATIONS ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchConversations()
    fetchBlockedContacts()
  }, [isAuthenticated, navigate])

  // Handle initial user selection from URL
  useEffect(() => {
    if (!isAuthenticated) return
    if (loadingConversations) return

    let targetUserId = null
    if (urlUserId) {
      targetUserId = urlUserId
    } else {
      const params = new URLSearchParams(location.search)
      targetUserId = params.get('to')
    }

    if (!targetUserId) return
    if (processedUserId.current === targetUserId) return
    processedUserId.current = targetUserId

    const conv = conversations.find((c) => c.user.id === targetUserId)
    if (conv) {
      selectConversation(conv.user)
    } else {
      fetchUserAndStartChat(targetUserId)
    }
  }, [isAuthenticated, loadingConversations, urlUserId, location.search, conversations])

  const fetchUserAndStartChat = async (userId) => {
    try {
      setLoadingMessages(true)
      const response = await api.get(`/users/profile/${userId}`)
      const userData = response.data.user
      if (userData) {
        const newUser = {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          avatar: userData.avatar,
          headline: userData.headline,
          isVerified: userData.isVerified,
          role: userData.role,
        }
        setSelectedUser(newUser)
        setShowMobileChat(true)
        setMessages([])
      }
    } catch (err) {
      console.error('Fetch user error:', err)
      toast.error('Failed to load user')
    } finally {
      setLoadingMessages(false)
    }
  }

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true)
      setError(null)
      const response = await api.get('/messages/conversations')
      setConversations(response.data.conversations || [])
      setArchivedConversations(response.data.archivedConversations || [])
    } catch (err) {
      console.error('Fetch conversations error:', err)
      setError(err.response?.data?.message || 'Failed to load conversations')
    } finally {
      setLoadingConversations(false)
    }
  }

  const fetchBlockedContacts = async () => {
    try {
      const response = await api.get('/messages/blocked')
      setBlockedContacts(response.data.blockedContacts || [])
    } catch (err) {
      console.error('Fetch blocked contacts error:', err)
    }
  }

  const fetchMessages = useCallback(async (otherUserId) => {
    try {
      setLoadingMessages(true)
      const response = await api.get(`/messages/conversation/${otherUserId}`)
      setMessages(response.data.messages || [])
    } catch (err) {
      console.error('Fetch messages error:', err)
      if (err.response?.data?.code === 'BLOCKED') {
        toast.error('This conversation is unavailable')
        setSelectedUser(null)
        setShowMobileChat(false)
      } else {
        toast.error('Failed to load messages')
      }
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const selectConversation = useCallback((otherUser) => {
    setSelectedUser(otherUser)
    setShowMobileChat(true)
    fetchMessages(otherUser.id)
    api.patch(`/messages/read/${otherUser.id}`).catch(() => {})
    if (socket) {
      socket.emit('messages_read', { senderId: otherUser.id })
    }
  }, [fetchMessages, socket])

  // ─── BLOCK / UNBLOCK ───────────────────────────────────────────────────
  const blockContact = async () => {
    if (!selectedUser) return
    if (!window.confirm(`Block ${selectedUser.firstName} ${selectedUser.lastName}? They won't be able to message or call you.`)) return

    try {
      await api.post(`/messages/block/${selectedUser.id}`)
      toast.success(`${selectedUser.firstName} has been blocked`)
      setSelectedUser(null)
      setShowMobileChat(false)
      setMessages([])
      fetchConversations()
      fetchBlockedContacts()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block contact')
    }
  }

  const unblockContact = async (blockedUserId) => {
    if (!blockedUserId || blockedUserId === 'undefined') {
      toast.error('Invalid user ID')
      return
    }
    try {
      await api.delete(`/messages/block/${blockedUserId}`)
      toast.success('User unblocked')
      fetchBlockedContacts()
      fetchConversations()
    } catch (err) {
      console.error('Unblock error:', err)
      toast.error(err.response?.data?.message || 'Failed to unblock contact')
    }
  }

  // ─── ARCHIVE / UNARCHIVE ───────────────────────────────────────────────
  const archiveConversation = async () => {
    if (!selectedUser) return
    try {
      await api.post(`/messages/archive/${selectedUser.id}`)
      toast.success('Conversation archived')
      setSelectedUser(null)
      setShowMobileChat(false)
      setMessages([])
      fetchConversations()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to archive conversation')
    }
  }

  const unarchiveConversation = async (userId) => {
    try {
      await api.delete(`/messages/archive/${userId}`)
      toast.success('Conversation unarchived')
      fetchConversations()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unarchive conversation')
    }
  }

  // ─── SEND MESSAGE ──────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setMessageInput(e.target.value)
    if (socket && selectedUser && e.target.value.trim()) {
      socket.emit('typing', { receiverId: selectedUser.id })
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!messageInput.trim() || !selectedUser) return

    const tempId = Date.now()
    const content = messageInput.trim()

    const tempMessage = {
      id: tempId,
      content: content,
      senderId: user.id,
      receiverId: selectedUser.id,
      createdAt: new Date().toISOString(),
      isRead: false,
      sender: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      },
    }

    setMessages((prev) => [...prev, tempMessage])
    setMessageInput('')
    scrollToBottom()

    if (socket) {
      socket.emit('send_message', {
        receiverId: selectedUser.id,
        content: content,
      })
    }

    try {
      setSending(true)
      const response = await api.post('/messages', {
        receiverId: selectedUser.id,
        content: content,
      })

      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? { ...response.data.data, content } : msg))
      )
      fetchConversations()
    } catch (err) {
      console.error('Send message error:', err)
      toast.error(err.response?.data?.message || 'Failed to send message')
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  // ─── FILE UPLOAD ───────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedUser) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only images (JPG, PNG, GIF, WebP) and PDF files are allowed')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    const tempId = Date.now()
    const isImage = file.type.startsWith('image/')

    const tempMessage = {
      id: tempId,
      content: isImage ? '📎 Image' : '📎 Document',
      senderId: user.id,
      createdAt: new Date().toISOString(),
      isRead: false,
      fileUrl: URL.createObjectURL(file),
      fileName: file.name,
      fileType: file.type,
      isUploading: true,
      sender: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      },
    }

    setMessages((prev) => [...prev, tempMessage])
    scrollToBottom()

    try {
      setUploadingFile(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('receiverId', selectedUser.id)

      const response = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...response.data.data, isUploading: false, fileUrl: response.data.data.fileUrl }
            : msg
        )
      )
      fetchConversations()
      toast.success('File sent')
    } catch (err) {
      console.error('Upload error:', err)
      toast.error(err.response?.data?.message || 'Failed to upload file')
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── SEND OFFER ────────────────────────────────────────────────────────
  const sendOffer = async (e) => {
    e.preventDefault()
    if (!selectedUser) return

    const amount = parseFloat(offerData.amount)
    if (!amount || amount < 100) {
      toast.error('Minimum offer amount is ₦100')
      return
    }

    const deliverablesList = offerData.deliverables.filter((d) => d.trim() !== '')

    try {
      setSendingOffer(true)
      const response = await api.post('/messages/offers', {
        receiverId: selectedUser.id,
        amount,
        title: offerData.title,
        description: offerData.description,
        type: offerData.type,
        durationDays: parseInt(offerData.durationDays) || 7,
        revisions: parseInt(offerData.revisions) || 3,
        deliverables: deliverablesList,
        milestones: milestones.length > 0 ? milestones : undefined,
      })

      const offerMsg = {
        id: response.data.offer.messageId,
        content: `💼 JOB OFFER`,
        senderId: user.id,
        createdAt: new Date().toISOString(),
        isRead: false,
        sender: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
        },
        offer: response.data.offer,
      }

      setMessages((prev) => [...prev, offerMsg])
      setShowOfferModal(false)
      setOfferData({
        amount: '',
        title: '',
        description: '',
        type: 'direct_hire',
        durationDays: 7,
        revisions: 3,
        deliverables: [''],
      })
      setMilestones([])
      toast.success('Offer sent!')
      fetchConversations()
    } catch (err) {
      console.error('Send offer error:', err)
      toast.error(err.response?.data?.message || 'Failed to send offer')
    } finally {
      setSendingOffer(false)
    }
  }

  // ─── ACCEPT OFFER ──────────────────────────────────────────────
  const acceptOffer = async (offerId) => {
    try {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'accepted' } }
            : msg
        )
      )

      const response = await api.patch(`/messages/offers/${offerId}/accept`)

      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'accepted', contractId: response.data.contract?.id } }
            : msg
        )
      )

      toast.success('Offer accepted! Contract created and payment secured.')

      if (response.data.contract?.id) {
        setTimeout(() => {
          navigate(`/contracts/${response.data.contract.id}`)
        }, 800)
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'pending' } }
            : msg
        )
      )

      console.error('Accept offer error:', err)
      const msg = err.response?.data?.message || 'Failed to accept offer'
      if (err.response?.data?.code === 'INSUFFICIENT_BALANCE') {
        toast.error(
          `${msg} (Need ₦${err.response.data.required?.toLocaleString()}, have ₦${err.response.data.current?.toLocaleString()})`
        )
      } else {
        toast.error(msg)
      }
    }
  }

  // ─── REJECT OFFER ──────────────────────────────────────────────
  const rejectOffer = async (offerId) => {
    try {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'rejected' } }
            : msg
        )
      )

      await api.patch(`/messages/offers/${offerId}/reject`)

      toast.success('Offer rejected')
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'pending' } }
            : msg
        )
      )

      console.error('Reject offer error:', err)
      toast.error(err.response?.data?.message || 'Failed to reject offer')
    }
  }

  // ─── CANCEL OFFER ──────────────────────────────────────────────
  const cancelOffer = async (offerId) => {
    if (!window.confirm('Cancel this offer? The recipient will be notified.')) return

    try {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'cancelled' } }
            : msg
        )
      )

      await api.patch(`/messages/offers/${offerId}/cancel`)

      toast.success('Offer cancelled')
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'pending' } }
            : msg
        )
      )

      console.error('Cancel offer error:', err)
      toast.error(err.response?.data?.message || 'Failed to cancel offer')
    }
  }

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await api.delete(`/messages/${messageId}`)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      toast.success('Message deleted')
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete message')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return formatDate(dateString)
  }

  const formatCallDuration = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const groupMessagesByDate = (msgs) => {
    const groups = {}
    msgs.forEach((msg) => {
      const dateKey = new Date(msg.createdAt).toDateString()
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(msg)
    })
    return Object.entries(groups)
  }

  const filteredConversations = conversations.filter((conv) => {
    const fullName = `${conv.user.firstName} ${conv.user.lastName}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase())
  })

  const canSendOffer = selectedUser && user?.id !== selectedUser?.id

  const getInitials = (firstName, lastName) => {
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase()
  }

  // Deliverables helpers
  const addDeliverable = () => {
    setOfferData((prev) => ({ ...prev, deliverables: [...prev.deliverables, ''] }))
  }

  const updateDeliverable = (index, value) => {
    setOfferData((prev) => {
      const updated = [...prev.deliverables]
      updated[index] = value
      return { ...prev, deliverables: updated }
    })
  }

  const removeDeliverable = (index) => {
    setOfferData((prev) => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index),
    }))
  }

  // Milestones helpers
  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      { title: '', amount: '', dueDays: '' },
    ])
  }

  const updateMilestone = (index, field, value) => {
    setMilestones((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeMilestone = (index) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <Image className="w-5 h-5" />
    if (fileType === 'application/pdf') return <FileText className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  // ─── CONTRACT CARD COMPONENT ───────────────────────────────────────────
  const ContractCard = ({ msg, isMe }) => {
    const offer = msg.offer
    if (!offer) return null

    const isInitiatedByMe = msg.senderId === user?.id
    const initiatorLabel = isInitiatedByMe ? 'You' : `${msg.sender?.firstName || 'They'}`
    const recipientLabel = isInitiatedByMe
      ? `${selectedUser?.firstName || 'Freelancer'}`
      : 'You'

    const iAmBuyer = isInitiatedByMe
    const iAmFreelancer = !isInitiatedByMe

    const statusConfig = {
      pending: {
        bg: isMe ? 'bg-emerald-500' : 'bg-white border border-gray-200',
        icon: Clock,
        iconColor: isMe ? 'text-white/80' : 'text-amber-500',
        text: 'Pending',
        textColor: isMe ? 'text-emerald-100' : 'text-amber-600',
        badgeBg: isMe ? 'bg-white/20' : 'bg-amber-50',
      },
      accepted: {
        bg: isMe ? 'bg-emerald-500' : 'bg-white border border-gray-200',
        icon: CheckCircle2,
        iconColor: isMe ? 'text-white' : 'text-emerald-500',
        text: 'Accepted — Active',
        textColor: isMe ? 'text-white' : 'text-emerald-600',
        badgeBg: isMe ? 'bg-white/20' : 'bg-emerald-50',
      },
      rejected: {
        bg: isMe ? 'bg-emerald-500' : 'bg-white border border-gray-200',
        icon: XCircle,
        iconColor: isMe ? 'text-red-200' : 'text-red-500',
        text: 'Rejected',
        textColor: isMe ? 'text-red-200' : 'text-red-500',
        badgeBg: isMe ? 'bg-red-500/20' : 'bg-red-50',
      },
      cancelled: {
        bg: isMe ? 'bg-emerald-500' : 'bg-white border border-gray-200',
        icon: X,
        iconColor: isMe ? 'text-gray-300' : 'text-gray-500',
        text: 'Cancelled',
        textColor: isMe ? 'text-gray-300' : 'text-gray-500',
        badgeBg: isMe ? 'bg-gray-500/20' : 'bg-gray-100',
      },
    }

    const status = statusConfig[offer.status] || statusConfig.pending
    const StatusIcon = status.icon

    return (
      <div className={`w-full sm:max-w-[80%] md:max-w-[65%] rounded-2xl overflow-hidden shadow-sm ${status.bg}`}>
        {/* Card Header */}
        <div className={`px-4 py-3 sm:px-5 sm:py-4 ${isMe ? 'bg-emerald-600/30' : 'bg-gray-50 border-b border-gray-100'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-emerald-100'}`}>
              <Briefcase className={`w-4.5 h-4.5 ${isMe ? 'text-white' : 'text-emerald-600'}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold uppercase tracking-wider ${isMe ? 'text-emerald-100' : 'text-emerald-600'}`}>
                JOB OFFER
              </p>
              <p className={`text-[11px] ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                {offer.type?.replace(/_/g, ' ').toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Amount */}
          <div>
            <p className={`text-[11px] font-medium uppercase tracking-wider mb-1 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
              Offer Amount
            </p>
            <p className={`text-2xl sm:text-3xl font-bold ${isMe ? 'text-white' : 'text-gray-900'}`}>
              ₦{offer.amount?.toLocaleString() || '0'}
            </p>
          </div>

          {/* Direction / Who pays who */}
          <div className={`rounded-xl p-3 sm:p-4 ${isMe ? 'bg-white/10' : 'bg-gray-50 border border-gray-100'}`}>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-emerald-100'}`}>
                  <UserCheck className={`w-3.5 h-3.5 ${isMe ? 'text-white' : 'text-emerald-600'}`} />
                </div>
                <span className={`text-xs font-semibold truncate ${isMe ? 'text-white' : 'text-gray-700'}`}>
                  {initiatorLabel}
                </span>
              </div>
              <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isMe ? 'text-emerald-300' : 'text-gray-400'}`} />
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-emerald-100'}`}>
                  <Banknote className={`w-3.5 h-3.5 ${isMe ? 'text-white' : 'text-emerald-600'}`} />
                </div>
                <span className={`text-xs font-semibold truncate ${isMe ? 'text-white' : 'text-gray-700'}`}>
                  {recipientLabel}
                </span>
              </div>
            </div>
            <p className={`text-[11px] mt-2 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
              {iAmBuyer
                ? `You're hiring ${selectedUser?.firstName || 'this freelancer'} for ₦${offer.amount?.toLocaleString()}`
                : `${msg.sender?.firstName || 'This freelancer'} wants to work with you for ₦${offer.amount?.toLocaleString()}`}
            </p>
          </div>

          {/* Description */}
          {offer.description && (
            <div>
              <p className={`text-[11px] font-medium uppercase tracking-wider mb-1.5 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                Description
              </p>
              <p className={`text-sm leading-relaxed ${isMe ? 'text-emerald-50' : 'text-gray-600'}`}>
                {offer.description}
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {offer.durationDays && (
              <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl ${isMe ? 'bg-white/10' : 'bg-gray-50'}`}>
                <Calendar className={`w-4 h-4 shrink-0 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <p className={`text-[10px] ${isMe ? 'text-emerald-300' : 'text-gray-400'}`}>Duration</p>
                  <p className={`text-xs font-semibold ${isMe ? 'text-white' : 'text-gray-700'}`}>{offer.durationDays}d</p>
                </div>
              </div>
            )}
            {offer.revisions !== undefined && (
              <div className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl ${isMe ? 'bg-white/10' : 'bg-gray-50'}`}>
                <RotateCcw className={`w-4 h-4 shrink-0 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <p className={`text-[10px] ${isMe ? 'text-emerald-300' : 'text-gray-400'}`}>Revisions</p>
                  <p className={`text-xs font-semibold ${isMe ? 'text-white' : 'text-gray-700'}`}>{offer.revisions}</p>
                </div>
              </div>
            )}
          </div>

          {/* Deliverables */}
          {offer.deliverables && offer.deliverables.length > 0 && offer.deliverables[0] !== '' && (
            <div>
              <p className={`text-[11px] font-medium uppercase tracking-wider mb-2 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                Deliverables
              </p>
              <div className="space-y-1.5">
                {offer.deliverables.map((d, i) => (
                  <div key={i} className={`flex items-start gap-2 ${isMe ? 'text-emerald-100' : 'text-gray-600'}`}>
                    <ListChecks className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isMe ? 'text-emerald-300' : 'text-emerald-500'}`} />
                    <span className="text-xs break-words">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          {offer.milestones && offer.milestones.length > 0 && (
            <div>
              <p className={`text-[11px] font-medium uppercase tracking-wider mb-2 ${isMe ? 'text-emerald-200' : 'text-gray-400'}`}>
                Milestones
              </p>
              <div className="space-y-2">
                {offer.milestones.map((m, i) => (
                  <div key={i} className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl ${isMe ? 'bg-white/10' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold shrink-0 ${isMe ? 'text-emerald-300' : 'text-emerald-600'}`}>{i + 1}</span>
                      <span className={`text-xs truncate ${isMe ? 'text-white' : 'text-gray-700'}`}>{m.title}</span>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${isMe ? 'text-emerald-200' : 'text-gray-500'}`}>₦{m.amount?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Contract Link */}
          {offer.contractId && (
            <Link
              to={`/contracts/${offer.contractId}`}
              className={`flex items-center justify-center gap-2 w-full px-3 sm:px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              View Contract
            </Link>
          )}

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${status.badgeBg}`}>
            <StatusIcon className={`w-4 h-4 shrink-0 ${status.iconColor}`} />
            <span className={`text-xs font-semibold ${status.textColor}`}>{status.text}</span>
          </div>

          {/* Action Buttons */}
          {offer.status === 'pending' && !isInitiatedByMe && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => acceptOffer(offer.id)}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-emerald-600 transition-all shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Accept
              </button>
              <button
                onClick={() => rejectOffer(offer.id)}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-gray-100 text-gray-600 text-xs sm:text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                Decline
              </button>
            </div>
          )}

          {offer.status === 'pending' && isInitiatedByMe && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl w-full sm:w-auto ${isMe ? 'bg-white/10' : 'bg-gray-100'}`}>
                <Clock className={`w-3.5 h-3.5 shrink-0 ${isMe ? 'text-emerald-300' : 'text-gray-400'}`} />
                <span className={`text-xs font-medium truncate ${isMe ? 'text-emerald-200' : 'text-gray-500'}`}>Awaiting response</span>
              </div>
              <button
                onClick={() => cancelOffer(offer.id)}
                className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-xl transition-all w-full sm:w-auto ${isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
            </div>
          )}

          {offer.status === 'accepted' && (
            <div className={`flex items-center gap-2 pt-1 px-3 py-2 rounded-xl ${isMe ? 'bg-white/10' : 'bg-emerald-50'}`}>
              <Shield className={`w-4 h-4 shrink-0 ${isMe ? 'text-white' : 'text-emerald-500'}`} />
              <span className={`text-xs font-semibold ${isMe ? 'text-white' : 'text-emerald-600'}`}>
                Payment secured
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── CALL HISTORY MESSAGE COMPONENT ────────────────────────────────────
  const CallHistoryMessage = ({ msg, isMe }) => {
    const direction = msg.callDirection || 'outgoing'
    const isMissed = direction === 'missed'
    const duration = msg.callDuration || 0

    let Icon
    if (isMissed) {
      Icon = PhoneMissed
    } else if (direction === 'incoming') {
      Icon = PhoneIncoming
    } else {
      Icon = PhoneOutgoing
    }

    const iconColor = isMissed
      ? 'text-red-500'
      : (direction === 'incoming' ? 'text-emerald-500' : 'text-blue-500')

    const bgColor = isMissed
      ? 'bg-red-50 border-red-100'
      : 'bg-gray-50 border-gray-100'

    const textColor = isMissed
      ? 'text-red-600'
      : 'text-gray-600'

    const labelText = isMissed
      ? `Missed ${msg.callType === 'video' ? 'video' : 'voice'} call`
      : `${msg.callType === 'video' ? 'Video' : 'Voice'} call ${direction === 'incoming' ? 'received' : 'made'}`

    return (
      <div className="flex justify-center my-3 px-2">
        <div className={`flex items-center gap-2 flex-wrap px-3 sm:px-4 py-2.5 rounded-2xl border ${bgColor} shadow-sm`}>
          <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className={`text-xs font-medium ${textColor}`}>
              {labelText}
            </span>
            {duration > 0 && (
              <span className="text-[10px] text-gray-400">
                {formatCallDuration(duration)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 ml-auto sm:ml-1 shrink-0">
            {formatTime(msg.createdAt)}
          </span>
          <button
            onClick={() => initiateCall(msg.callType || 'video')}
            className="p-1.5 sm:p-1 rounded-full hover:bg-gray-200 transition-colors shrink-0"
            title="Call back"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
          </button>
        </div>
      </div>
    )
  }

  // ─── INCOMING CALL OVERLAY ─────────────────────────────────────────────
  const IncomingCallOverlay = () => {
    if (!incomingCall) return null

    const isVideoCall = incomingCall.callType === 'video'
    const callerInitials = getInitials(
      incomingCall.callerName?.split(' ')[0],
      incomingCall.callerName?.split(' ')[1]
    )

    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="mb-6 sm:mb-8">
          {incomingCall.callerAvatar ? (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-emerald-500/30 shadow-2xl">
              <img
                src={incomingCall.callerAvatar}
                alt={incomingCall.callerName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-3xl sm:text-4xl shadow-2xl ring-4 ring-emerald-500/30">
              {callerInitials}
            </div>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">
          {incomingCall.callerName}
        </h2>

        <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 flex items-center gap-2">
          {isVideoCall ? (
            <>
              <Video className="w-5 h-5 text-emerald-400" />
              Incoming video call...
            </>
          ) : (
            <>
              <PhoneCall className="w-5 h-5 text-emerald-400" />
              Incoming voice call...
            </>
          )}
        </p>

        <div className="flex items-center gap-2 mb-8 sm:mb-12">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <div className="flex items-center gap-8 sm:gap-10">
          <button
            onClick={declineIncomingCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:bg-red-600 transition-all group-hover:scale-105">
              <PhoneOff className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <span className="text-xs sm:text-sm text-red-400 font-medium">Decline</span>
          </button>

          <button
            onClick={acceptIncomingCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:bg-emerald-600 transition-all group-hover:scale-105">
              {isVideoCall ? (
                <Video className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              ) : (
                <PhoneCall className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              )}
            </div>
            <span className="text-xs sm:text-sm text-emerald-400 font-medium">Accept</span>
          </button>
        </div>

        <p className="absolute bottom-6 sm:bottom-8 text-gray-500 text-xs">
          Tap to answer or decline
        </p>
      </div>
    )
  }

  // ─── OUTGOING CALL OVERLAY ─────────────────────────────────────────────
  const OutgoingCallOverlay = () => {
    if (!isInCall || callStatus !== 'ringing' || incomingCall) return null

    const isVideoCall = callType === 'video'
    const calleeInitials = getInitials(selectedUser?.firstName, selectedUser?.lastName)

    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="mb-6 sm:mb-8">
          {selectedUser?.avatar ? (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-emerald-500/30 shadow-2xl">
              <img
                src={selectedUser.avatar}
                alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-3xl sm:text-4xl shadow-2xl ring-4 ring-emerald-500/30">
              {calleeInitials}
            </div>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">
          {selectedUser?.firstName} {selectedUser?.lastName}
        </h2>

        <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 flex items-center gap-2">
          {isVideoCall ? (
            <>
              <Video className="w-5 h-5 text-emerald-400" />
              Calling...
            </>
          ) : (
            <>
              <PhoneCall className="w-5 h-5 text-emerald-400" />
              Calling...
            </>
          )}
        </p>

        <div className="flex items-center gap-2 mb-8 sm:mb-12">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <button
          onClick={endLocalCall}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:bg-red-600 transition-all group-hover:scale-105">
            <PhoneOff className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <span className="text-xs sm:text-sm text-red-400 font-medium">Cancel</span>
        </button>
      </div>
    )
  }

  // ─── ACTIVE VIDEO CALL OVERLAY ─────────────────────────────────────────
  const VideoCallOverlay = () => {
    if (!isInCall || callStatus !== 'ongoing') return null

    return (
      <div className={`fixed z-[90] ${isMinimized ? 'bottom-4 right-4 w-64 h-40 sm:w-72 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20' : 'inset-0 bg-gray-900'}`}>
        {!isMinimized && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 bg-white/10 backdrop-blur-sm rounded-xl text-white hover:bg-white/20 transition-all"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <div className="bg-black/50 backdrop-blur-sm text-white px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-mono">
              {formatCallDuration(callDuration)}
            </div>
          </div>
        )}

        {isMinimized && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-mono">
              {formatCallDuration(callDuration)}
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-all"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${!remoteStream ? 'hidden' : ''}`}
        />

        {!remoteStream && !isMinimized && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gray-700 flex items-center justify-center mb-3 shrink-0">
                {selectedUser?.avatar ? (
                  <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <span className="text-white text-xl sm:text-2xl font-bold">
                    {getInitials(selectedUser?.firstName, selectedUser?.lastName)}
                  </span>
                )}
              </div>
              <p className="text-white font-medium text-sm sm:text-base">{selectedUser?.firstName} {selectedUser?.lastName}</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">Connecting...</p>
            </div>
          </div>
        )}

        <div className={`absolute ${isMinimized ? 'bottom-2 right-2 w-20 h-14' : 'bottom-4 right-4 w-32 h-24 sm:w-40 sm:h-28'} rounded-xl overflow-hidden shadow-lg border-2 border-white/20`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-3 sm:gap-4 ${isMinimized ? 'bottom-2' : 'bottom-6 sm:bottom-8'}`}>
          <button
            onClick={toggleAudio}
            className={`p-3 sm:p-4 rounded-full transition-all shrink-0 ${isAudioEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5 sm:w-6 sm:h-6" /> : <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-3 sm:p-4 rounded-full transition-all shrink-0 ${isVideoEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            {isVideoEnabled ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
          <button
            onClick={endLocalCall}
            className="p-3 sm:p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 shrink-0"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    )
  }

  if (loadingConversations && !selectedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          <p className="text-gray-500 text-sm">Loading messages...</p>
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
            onClick={fetchConversations}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full hover:shadow-lg hover:shadow-emerald-500/25 transition-all font-medium text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/80 relative">
      {/* INCOMING CALL OVERLAY */}
      <IncomingCallOverlay />

      {/* OUTGOING CALL OVERLAY */}
      <OutgoingCallOverlay />

      {/* ACTIVE VIDEO CALL OVERLAY */}
      <VideoCallOverlay />

      <div className="max-w-6xl mx-auto h-screen sm:h-[calc(100vh-2rem)] sm:py-4 sm:px-3 md:px-4">
        <div className="flex h-full bg-white sm:rounded-3xl sm:border sm:border-gray-200 overflow-hidden shadow-sm">
          {/* ─── CONVERSATIONS SIDEBAR ───────────────────────────────── */}
          <div className={`w-full sm:w-72 md:w-96 border-r border-gray-100 flex flex-col ${showMobileChat ? 'hidden sm:flex' : 'flex'}`}>
            {/* Sidebar Header */}
            <div className="p-3 sm:p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Messages</h1>
                <button
                  onClick={() => navigate('/feed')}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative mb-3 sm:mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Archive / Blocked Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => { setShowArchived(false); setShowBlocked(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${!showArchived && !showBlocked ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Active
                </button>
                <button
                  onClick={() => { setShowArchived(true); setShowBlocked(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${showArchived ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Archive className="w-3 h-3" />
                  Archived
                </button>
                <button
                  onClick={() => { setShowArchived(false); setShowBlocked(true) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1 ${showBlocked ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Ban className="w-3 h-3" />
                  Blocked
                </button>
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {showBlocked ? (
                /* Blocked Contacts List */
                blockedContacts.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Ban className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">No blocked contacts</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {blockedContacts.map((blocked) => {
                      const blockedUser = blocked.blockedUser || {}
                      const userId = blockedUser.id || blocked.blockedId || blocked.blockedUserId
                      const firstName = blockedUser.firstName || 'Unknown'
                      const lastName = blockedUser.lastName || 'User'
                      const avatar = blockedUser.avatar || null
                      const createdAt = blocked.createdAt

                      return (
                        <div key={blocked.id || userId || Math.random()} className="flex items-center gap-3 p-3 sm:p-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-gray-100 shrink-0">
                            {avatar ? (
                              <img src={avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                                {getInitials(firstName, lastName)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-gray-700 truncate">
                              {firstName} {lastName}
                            </h3>
                            <p className="text-xs text-gray-400">
                              {createdAt ? `Blocked ${formatTimeAgo(createdAt)}` : 'Blocked'}
                            </p>
                          </div>
                          <button
                            onClick={() => unblockContact(userId)}
                            disabled={!userId}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 ${
                              userId
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            Unblock
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : showArchived ? (
                /* Archived Conversations List */
                archivedConversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Archive className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">No archived conversations</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {archivedConversations.map((conv) => (
                      <div key={conv.user.id} className="flex items-center gap-3 p-3 sm:p-4 group hover:bg-gray-50 transition-all">
                        <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-gray-100 shrink-0">
                          {conv.user.avatar ? (
                            <img src={conv.user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-sm">
                              {getInitials(conv.user.firstName, conv.user.lastName)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-gray-700 truncate">
                            {conv.user.firstName} {conv.user.lastName}
                          </h3>
                          <p className="text-xs text-gray-400 truncate">{conv.lastMessage?.preview || 'No messages'}</p>
                        </div>
                        <button
                          onClick={() => unarchiveConversation(conv.user.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">
                    {searchQuery ? 'No conversations found' : 'No messages yet'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {searchQuery ? 'Try a different search' : 'Start chatting!'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredConversations.map((conv) => {
                    const isSelected = selectedUser?.id === conv.user.id
                    const isOfferPreview = conv.lastMessage?.offer
                    const isCallHistory = conv.lastMessage?.isCallHistory
                    return (
                      <button
                        key={conv.user.id}
                        onClick={() => selectConversation(conv.user)}
                        className={`w-full flex items-start gap-3 p-3 sm:p-4 transition-all text-left group ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-gray-100">
                            {conv.user.avatar ? (
                              <img src={conv.user.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                                {getInitials(conv.user.firstName, conv.user.lastName)}
                              </div>
                            )}
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5 gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <h3 className={`font-semibold text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                {conv.user.firstName} {conv.user.lastName}
                              </h3>
                              {conv.user.isVerified && (
                                <BadgeCheck className="w-3 h-3 text-blue-500 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 shrink-0">
                              {formatTimeAgo(conv.lastMessage.createdAt)}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                            {isOfferPreview ? (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="truncate">₦{conv.lastMessage.offer?.amount?.toLocaleString()}</span>
                              </span>
                            ) : isCallHistory ? (
                              <span className="flex items-center gap-1">
                                {conv.lastMessage.callType === 'video' ? (
                                  <Video className="w-3 h-3 text-emerald-500 shrink-0" />
                                ) : (
                                  <PhoneCall className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                                <span className="truncate">{conv.lastMessage.preview || conv.lastMessage.content}</span>
                              </span>
                            ) : (
                              <>
                                {conv.lastMessage.isFromMe && <span className="text-gray-400">You: </span>}
                                <span className="truncate">{conv.lastMessage.preview}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── CHAT AREA ─────────────────────────────────────────── */}
          <div className={`flex-1 flex flex-col bg-gray-50/30 ${showMobileChat ? 'flex' : 'hidden sm:flex'}`}>
            {!selectedUser ? (
              /* Empty State */
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mb-4 sm:mb-5">
                    <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Select a conversation</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Choose someone to start chatting
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="sm:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <Link to={`/profile/${selectedUser.id}`} className="shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-100">
                      {selectedUser.avatar ? (
                        <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                          {getInitials(selectedUser.firstName, selectedUser.lastName)}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${selectedUser.id}`} className="flex items-center gap-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </h3>
                      {selectedUser.isVerified && (
                        <BadgeCheck className="w-3 h-3 text-blue-500 shrink-0" />
                      )}
                    </Link>
                    <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      {typingUser ? `${typingUser} typing` : 'Active'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      onClick={() => initiateCall('video')}
                      disabled={isInCall}
                      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors ${isInCall ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                      title="Video call"
                    >
                      <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => initiateCall('audio')}
                      disabled={isInCall}
                      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors ${isInCall ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                      title="Audio call"
                    >
                      <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={() => setShowOfferModal(true)}
                      className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all ${canSendOffer ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'text-gray-300 cursor-not-allowed'}`}
                      title="Send Offer"
                      disabled={!canSendOffer}
                    >
                      <HandCoins className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="relative" ref={chatMenuRef}>
                      <button
                        onClick={() => setShowChatMenu(!showChatMenu)}
                        className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                      >
                        <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      {showChatMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20">
                          <button
                            onClick={() => { archiveConversation(); setShowChatMenu(false) }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
                          >
                            <Archive className="w-4 h-4 shrink-0" />
                            Archive Chat
                          </button>
                          <button
                            onClick={() => { blockContact(); setShowChatMenu(false) }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <Ban className="w-4 h-4 shrink-0" />
                            Block Contact
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-4 space-y-1">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-400 font-medium">No messages yet</p>
                      <p className="text-xs text-gray-400 mt-1">Say hello to start!</p>
                    </div>
                  ) : (
                    groupMessagesByDate(messages).map(([dateKey, dateMessages]) => (
                      <div key={dateKey}>
                        <div className="flex items-center justify-center my-3 sm:my-4">
                          <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">
                            {formatDate(dateKey)}
                          </span>
                        </div>
                        {dateMessages.map((msg) => {
                          const isMe = msg.senderId === user?.id
                          const isOffer = !!msg.offer
                          const isFile = msg.fileUrl || msg.fileType
                          const isCallHistoryMsg = msg.isCallHistory

                          return (
                            <div key={msg.id} className={`flex mb-2 sm:mb-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              {!isMe && !isOffer && !isCallHistoryMsg && (
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden shrink-0 mr-2 mt-1 ring-2 ring-gray-100">
                                  {msg.sender?.avatar ? (
                                    <img src={msg.sender.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-[10px] font-bold">
                                      {getInitials(msg.sender?.firstName, msg.sender?.lastName)}
                                    </div>
                                  )}
                                </div>
                              )}

                              {isCallHistoryMsg ? (
                                <CallHistoryMessage msg={msg} isMe={isMe} />
                              ) : isOffer ? (
                                <ContractCard msg={msg} isMe={isMe} />
                              ) : isFile ? (
                                <div className="group relative max-w-xs sm:max-w-sm">
                                  <div className={`px-3 sm:px-4 py-2.5 rounded-xl shadow-sm ${isMe ? 'bg-emerald-500 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                                    {msg.fileType?.startsWith('image/') ? (
                                      <div className="space-y-2">
                                        {msg.isUploading ? (
                                          <div className="w-40 sm:w-48 h-28 sm:h-32 bg-emerald-400/20 rounded-lg flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                                          </div>
                                        ) : (
                                          <img
                                            src={msg.fileUrl}
                                            alt={msg.fileName}
                                            className="w-40 sm:w-48 h-auto rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(msg.fileUrl, '_blank')}
                                          />
                                        )}
                                        <p className="text-xs opacity-80 truncate">{msg.fileName}</p>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-gray-100'}`}>
                                          {getFileIcon(msg.fileType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{msg.fileName}</p>
                                          {!msg.isUploading && (
                                            <a
                                              href={msg.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`text-xs flex items-center gap-1 mt-0.5 ${isMe ? 'text-emerald-200 hover:text-white' : 'text-emerald-600 hover:text-emerald-700'}`}
                                            >
                                              <Download className="w-3 h-3" />
                                              Download
                                            </a>
                                          )}
                                        </div>
                                        {msg.isUploading && (
                                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <span className={`text-[10px] ${isMe ? 'text-emerald-400' : 'text-gray-400'}`}>
                                      {formatTime(msg.createdAt)}
                                    </span>
                                    {isMe && (
                                      msg.isRead ? (
                                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Check className="w-3 h-3 text-emerald-300" />
                                      )
                                    )}
                                  </div>
                                  <button
                                    onClick={() => deleteMessage(msg.id)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-red-600 shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="group relative max-w-xs sm:max-w-sm">
                                  <div className={`px-3 sm:px-4 py-2.5 rounded-xl shadow-sm ${isMe ? 'bg-emerald-500 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                                    <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                                  </div>
                                  <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <span className={`text-[10px] ${isMe ? 'text-emerald-400' : 'text-gray-400'}`}>
                                      {formatTime(msg.createdAt)}
                                    </span>
                                    {isMe && (
                                      msg.isRead ? (
                                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Check className="w-3 h-3 text-emerald-300" />
                                      )
                                    )}
                                  </div>
                                  <button
                                    onClick={() => deleteMessage(msg.id)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-red-600 shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area - Mobile Optimized */}
                <div className="px-2 py-2.5 sm:px-4 sm:py-4 bg-white border-t border-gray-100">
                  <form onSubmit={sendMessage} className="flex items-end gap-1.5 sm:gap-2">
                    {/* File Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* Message Input */}
                    <div className="flex-1 min-w-0 relative">
                      <textarea
                        ref={inputRef}
                        value={messageInput}
                        onChange={handleInputChange}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter' && !e.shiftKey) { 
                            e.preventDefault()
                            sendMessage(e) 
                          } 
                        }}
                        placeholder={`Message ${selectedUser.firstName}...`}
                        rows={1}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-gray-100 border-0 rounded-lg sm:rounded-2xl resize-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                        style={{ 
                          minHeight: '40px', 
                          maxHeight: '100px',
                          lineHeight: '1.5'
                        }}
                      />
                    </div>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!messageInput.trim() || sending}
                      className="p-2 sm:p-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg sm:rounded-2xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
                      title="Send message (Shift+Enter for new line)"
                    >
                      {sending ? (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── OFFER MODAL ───────────────────────────────────────────── */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                  <HandCoins className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Send Offer</h2>
                  <p className="text-xs text-gray-400 truncate">To {selectedUser?.firstName} {selectedUser?.lastName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowOfferModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={sendOffer} className="p-4 sm:p-6 space-y-5">
              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₦</span>
                  <input
                    type="number"
                    value={offerData.amount}
                    onChange={(e) => setOfferData({ ...offerData, amount: e.target.value })}
                    placeholder="50,000"
                    min="100"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-sm font-semibold transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Minimum ₦100</p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={offerData.title}
                  onChange={(e) => setOfferData({ ...offerData, title: e.target.value })}
                  placeholder="e.g. Mobile App Development"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-sm font-semibold transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Duration & Revisions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (days)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="number"
                      value={offerData.durationDays}
                      onChange={(e) => setOfferData({ ...offerData, durationDays: e.target.value })}
                      min="1"
                      max="365"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-sm font-semibold transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Revisions</label>
                  <div className="relative">
                    <RotateCcw className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="number"
                      value={offerData.revisions}
                      onChange={(e) => setOfferData({ ...offerData, revisions: e.target.value })}
                      min="0"
                      max="20"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-sm font-semibold transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={offerData.description}
                  onChange={(e) => setOfferData({ ...offerData, description: e.target.value })}
                  placeholder="Describe the work..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none text-sm resize-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Deliverables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Deliverables</label>
                  <button
                    type="button"
                    onClick={addDeliverable}
                    className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {offerData.deliverables.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateDeliverable(index, e.target.value)}
                        placeholder={`Deliverable ${index + 1}`}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition-all"
                      />
                      {offerData.deliverables.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDeliverable(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Milestones (Optional)</label>
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Milestone {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeMilestone(index)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={milestone.title}
                        onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                        placeholder="Title"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                          <input
                            type="number"
                            value={milestone.amount}
                            onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                            placeholder="₦"
                            className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none"
                          />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          <input
                            type="number"
                            value={milestone.dueDays}
                            onChange={(e) => updateMilestone(index, 'dueDays', e.target.value)}
                            placeholder="Days"
                            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Offer Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'direct_hire', label: 'Direct Hire', icon: Briefcase },
                    { value: 'custom_job', label: 'Custom Job', icon: Star },
                    { value: 'milestone', label: 'Milestone', icon: CheckCircle2 },
                  ].map((type) => {
                    const Icon = type.icon
                    const isActive = offerData.type === type.value
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setOfferData({ ...offerData, type: type.value })}
                        className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl text-xs font-medium transition-all border ${isActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sendingOffer}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {sendingOffer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <HandCoins className="w-4 h-4" />
                      Send Offer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Messages