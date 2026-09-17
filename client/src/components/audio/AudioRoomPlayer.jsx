import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Hand,
  LogOut,
  Crown,
  MessageSquare,
  Users,
  Radio,
  X,
  Send,
  User,
} from 'lucide-react';
import { api } from '../../utils/api';
import useAudioRoomStore from '../../stores/audioRoomStore';
import { useAuthStore } from '../../stores/authStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import ParticipantList from './ParticipantList';
import { toast } from 'react-hot-toast';
import { connectSocket } from '../../socket';

const DEFAULT_AVATAR = '/default-avatar.png';

const Avatar = ({ src, alt, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError || !src) {
    return (
      <div className={`bg-emerald-100 flex items-center justify-center ${className}`}>
        <User size={className.includes('w-10') ? 16 : 24} className="text-emerald-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'User'}
      className={`object-cover ${className}`}
      onError={() => setImgError(true)}
    />
  );
};

const AudioRoomPlayer = ({ roomId }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentRoom,
    participants,
    messages,
    isInRoom,
    isHost,
    myRole,
    handRaised,
    isMuted,
    setCurrentRoom,
    setParticipants,
    setMessages,
    setIsInRoom,
    setIsHost,
    setMyRole,
    setHandRaised,
    setIsMuted,
    addMessage,
    updateParticipant,
    removeParticipant,
    updateParticipantRole,
    addParticipant,
    resetRoom,
  } = useAudioRoomStore();

  const { initialize, leaveRoom: leaveWebRTC } = useWebRTC(roomId);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const chatEndRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const socketRef = useRef(null);
  const setupDoneRef = useRef(false);
  const pendingJoinRef = useRef(false);

  // ─── SETUP SOCKET LISTENERS FIRST (before join) ─────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      toast.error('Please log in');
      navigate('/login');
      return;
    }

    const s = connectSocket(token);
    socketRef.current = s;

    // Define all handlers
    const handleUserJoined = ({ userId, participant }) => {
      if (participant) {
        addParticipant(participant);
      } else {
        // Fallback: fetch full participant list if partial data
        api.get(`/vivarooms/${roomId}`).then(res => {
          setParticipants(res.data.room.participants || []);
        }).catch(() => {});
      }
    };

    const handleUserLeft = ({ userId }) => {
      removeParticipant(userId);
    };

    const handleRoomEnded = () => {
      toast('The host has ended the room', { icon: '👋' });
      resetRoom();
      hasJoinedRef.current = false;
      setupDoneRef.current = false;
      navigate('/feed');
    };

    const handleSpeaking = ({ userId, isSpeaking: speaking }) => {
      updateParticipant(userId, { isSpeaking: speaking });
    };

    const handleMuted = ({ userId, isMuted: muted }) => {
      updateParticipant(userId, { isMuted: muted });
      if (userId === user.id) setIsMuted(muted);
    };

    const handleHand = ({ userId, handRaised: raised }) => {
      updateParticipant(userId, { handRaised: raised });
    };

    const handleRoleChanged = ({ userId, role }) => {
      updateParticipantRole(userId, role);
      if (userId === user.id) {
        setMyRole(role);
        setIsHost(role === 'host');
        toast.success(`You are now a ${role.replace('_', ' ')}`);
      }
    };

    const handleMessage = (msg) => addMessage(msg);

    // Attach listeners immediately
    s.on('viva-room:user-joined', handleUserJoined);
    s.on('viva-room:user-left', handleUserLeft);
    s.on('viva-room:room-ended', handleRoomEnded);
    s.on('viva-room:speaking', handleSpeaking);
    s.on('viva-room:muted', handleMuted);
    s.on('viva-room:hand', handleHand);
    s.on('viva-room:role-changed', handleRoleChanged);
    s.on('viva-room:message', handleMessage);

    const onConnect = () => {
      setSocketReady(true);
      // If we were waiting to join, do it now
      if (pendingJoinRef.current && !hasJoinedRef.current) {
        performJoin();
      }
    };

    const onDisconnect = () => {
      setSocketReady(false);
    };

    if (s.connected) {
      onConnect();
    } else {
      s.on('connect', onConnect);
    }
    s.on('disconnect', onDisconnect);

    // Cleanup function
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('viva-room:user-joined', handleUserJoined);
      s.off('viva-room:user-left', handleUserLeft);
      s.off('viva-room:room-ended', handleRoomEnded);
      s.off('viva-room:speaking', handleSpeaking);
      s.off('viva-room:muted', handleMuted);
      s.off('viva-room:hand', handleHand);
      s.off('viva-room:role-changed', handleRoleChanged);
      s.off('viva-room:message', handleMessage);
    };
  }, [roomId, user?.id]); // eslint-disable-line

  // ─── JOIN FUNCTION ───────────────────────────────────────
  const performJoin = async () => {
    if (hasJoinedRef.current || !socketRef.current?.connected) return;
    
    try {
      const s = socketRef.current;
      s.emit('viva-room:join', { roomId, userId: user.id });
      hasJoinedRef.current = true;
      pendingJoinRef.current = false;
    } catch (err) {
      console.error('Failed to emit join:', err);
    }
  };

  // ─── FETCH ROOM & INITIALIZE ─────────────────────────────
  useEffect(() => {
    if (!socketReady || !roomId || !user?.id || setupDoneRef.current) return;

    const setup = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/vivarooms/${roomId}`);
        const room = res.data.room;

        setCurrentRoom(room);
        setParticipants(room.participants || []);
        setMessages(room.messages || []);

        const myParticipant = room.participants?.find(p => p.userId === user.id);
        if (myParticipant) {
          setIsInRoom(true);
          setMyRole(myParticipant.role);
          setIsHost(myParticipant.role === 'host');
          setIsMuted(myParticipant.isMuted || false);
        } else {
          const joinRes = await api.post(`/vivarooms/${roomId}/join`);
          setIsInRoom(true);
          setMyRole(joinRes.data.participant.role);
          setIsHost(joinRes.data.participant.role === 'host');
          setIsMuted(joinRes.data.participant.isMuted || false);
          
          // Update participants with the new list including me
          if (joinRes.data.room?.participants) {
            setParticipants(joinRes.data.room.participants);
          } else {
            // Add myself to the list
            addParticipant(joinRes.data.participant);
          }
        }

        // Join socket room
        await performJoin();
        
        // Initialize WebRTC
        await initialize();
        setupDoneRef.current = true;
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to join room');
        navigate('/feed');
      } finally {
        setLoading(false);
      }
    };

    setup();
  }, [socketReady, roomId, user?.id]); // eslint-disable-line

  // ─── CLEANUP ON UNMOUNT ──────────────────────────────────
  useEffect(() => {
    return () => {
      const s = socketRef.current;
      if (s?.connected && hasJoinedRef.current) {
        s.emit('viva-room:leave', { roomId });
      }
      leaveWebRTC();
      resetRoom();
      hasJoinedRef.current = false;
      setupDoneRef.current = false;
      pendingJoinRef.current = false;
    };
  }, []); // eslint-disable-line

  // ─── SCROLL CHAT ─────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── HANDLERS ────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    try { await api.post(`/vivarooms/${roomId}/leave`); } catch (err) {}

    leaveWebRTC();

    const s = socketRef.current;
    if (s?.connected) {
      s.emit('viva-room:leave', { roomId });
    }

    resetRoom();
    hasJoinedRef.current = false;
    setupDoneRef.current = false;
    navigate('/feed');
  }, [roomId, navigate, leaveWebRTC, resetRoom]);

  const handleEndRoom = useCallback(async () => {
    if (!isHost) return;
    try {
      await api.post(`/vivarooms/${roomId}/end`);
      toast.success('Room ended');

      const s = socketRef.current;
      if (s?.connected) {
        s.emit('viva-room:end-room', { roomId });
      }

      handleLeave();
    } catch (err) {
      toast.error('Failed to end room');
    }
  }, [isHost, roomId, handleLeave]);

  const handleToggleMute = useCallback(async () => {
    try {
      const newMuted = !isMuted;
      await api.patch(`/vivarooms/${roomId}/mute`, { mute: newMuted });
      setIsMuted(newMuted);

      const s = socketRef.current;
      if (s?.connected) {
        s.emit('viva-room:muted', { roomId, userId: user.id, isMuted: newMuted });
      }
    } catch (err) {
      toast.error('Failed to toggle mute');
    }
  }, [isMuted, roomId, user?.id, setIsMuted]);

  const handleToggleHand = useCallback(async () => {
    try {
      const res = await api.patch(`/vivarooms/${roomId}/hand`);
      setHandRaised(res.data.handRaised);

      const s = socketRef.current;
      if (s?.connected) {
        s.emit('viva-room:hand', { roomId, userId: user.id, handRaised: res.data.handRaised });
      }
    } catch (err) {
      toast.error('Failed to raise hand');
    }
  }, [roomId, user?.id, setHandRaised]);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      const res = await api.post(`/vivarooms/${roomId}/messages`, { content: chatInput.trim() });
      addMessage(res.data.message);

      const s = socketRef.current;
      if (s?.connected) {
        s.emit('viva-room:message', { roomId, message: res.data.message });
      }

      setChatInput('');
    } catch (err) {
      toast.error('Failed to send message');
    }
  }, [chatInput, roomId, addMessage]);

  const handlePromote = useCallback(async (participantId, newRole) => {
    try {
      await api.patch(`/vivarooms/${roomId}/participants/${participantId}/role`, { role: newRole });
      const targetUser = participants.find(p => p.id === participantId);

      const s = socketRef.current;
      if (s?.connected) {
        s.emit('viva-room:role-changed', { roomId, userId: targetUser?.userId, role: newRole });
      }

      toast.success('Role updated');
    } catch (err) {
      toast.error('Failed to update role');
    }
  }, [roomId, participants]);

  const handleMuteUser = useCallback(async (participantId, mute) => {
    try {
      await api.patch(`/vivarooms/${roomId}/mute`, { participantId, mute });
      toast.success(mute ? 'User muted' : 'User unmuted');
    } catch (err) {
      toast.error('Failed to mute user');
    }
  }, [roomId]);

  // ─── GROUP PARTICIPANTS ──────────────────────────────────
  const speakers = participants.filter(p => p.role === 'host' || p.role === 'co_host' || p.role === 'speaker');
  const listeners = participants.filter(p => p.role === 'listener');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500">Joining room...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Radio size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate text-gray-900">{currentRoom?.title}</h1>
            <p className="text-xs text-gray-500 truncate">
              {currentRoom?.host?.firstName} {currentRoom?.host?.lastName} · {participants.length} listening
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              showParticipants ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            <Users size={18} />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              showChat ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={handleLeave}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Room Stage */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto bg-gray-50">
          <div className="w-full max-w-3xl">
            {/* Speakers Section */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5 text-center">
              Speakers · {speakers.length}
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5 mb-10">
              {speakers.map((participant) => (
                <div key={participant.id} className="flex flex-col items-center">
                  <div
                    className={`relative rounded-full p-1 transition-all ${
                      participant.isSpeaking
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-50'
                        : ''
                    }`}
                  >
                    <Avatar
                      src={participant.user?.avatar}
                      alt={participant.user?.firstName}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full"
                    />
                    {participant.role === 'host' && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <Crown size={12} className="text-yellow-800" />
                      </div>
                    )}
                    {participant.isMuted && (
                      <div className="absolute bottom-0 right-0 w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center border-2 border-white">
                        <MicOff size={10} className="text-white" />
                      </div>
                    )}
                    {participant.handRaised && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        <Hand size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-2 text-center truncate max-w-[90px]">
                    {participant.user?.firstName}
                  </p>
                  <p className="text-[11px] text-gray-400 capitalize">
                    {participant.role.replace('_', ' ')}
                  </p>
                </div>
              ))}
            </div>

            {/* Listeners Section */}
            {listeners.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5 text-center">
                  Listeners · {listeners.length}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {listeners.slice(0, 16).map((participant) => (
                    <div key={participant.id} className="flex flex-col items-center">
                      <div className="relative">
                        <Avatar
                          src={participant.user?.avatar}
                          alt={participant.user?.firstName}
                          className="w-11 h-11 rounded-full opacity-80"
                        />
                        {participant.handRaised && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            <Hand size={9} className="text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 truncate max-w-[70px]">
                        {participant.user?.firstName}
                      </p>
                    </div>
                  ))}
                  {listeners.length > 16 && (
                    <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 font-medium">
                      +{listeners.length - 16}
                    </div>
                  )}
                </div>
              </>
            )}

            {participants.length === 0 && (
              <div className="text-center py-20">
                <Users size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">No one is in the room yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
              <h3 className="text-sm font-semibold text-gray-800">Room Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 text-xs">No messages yet</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-2.5">
                  <Avatar
                    src={msg.sender?.avatar}
                    alt={msg.sender?.firstName}
                    className="w-7 h-7 rounded-full flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-600">
                      {msg.sender?.firstName} {msg.sender?.lastName}
                    </p>
                    <p className="text-sm text-gray-700 break-words leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 bg-white flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 rounded-xl flex items-center justify-center transition-colors"
              >
                <Send size={14} className="text-white" />
              </button>
            </form>
          </div>
        )}

        {/* Participants Panel */}
        {showParticipants && (
          <ParticipantList
            participants={participants}
            isHost={isHost}
            myRole={myRole}
            onPromote={handlePromote}
            onMute={handleMuteUser}
            onClose={() => setShowParticipants(false)}
          />
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleToggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
            isMuted
              ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {myRole === 'listener' && (
          <button
            onClick={handleToggleHand}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
              handRaised
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <Hand size={22} />
          </button>
        )}

        {isHost ? (
          <button
            onClick={handleEndRoom}
            className="px-8 h-14 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full transition-colors shadow-sm"
          >
            End Room
          </button>
        ) : (
          <button
            onClick={handleLeave}
            className="px-8 h-14 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-full transition-colors shadow-sm"
          >
            Leave
          </button>
        )}
      </div>
    </div>
  );
};

export default AudioRoomPlayer;