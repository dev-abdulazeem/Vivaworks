import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../socket';
import useAudioRoomStore from '../stores/audioRoomStore';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (roomId) => {
  const socket = getSocket();
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const audioElementsRef = useRef(new Map());

  const { setIsMuted, setIsSpeaking, myRole } = useAudioRoomStore();

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const shouldBeMuted = myRole === 'listener';
      stream.getAudioTracks().forEach(track => { track.enabled = !shouldBeMuted; });
      setIsMuted(shouldBeMuted);
      return stream;
    } catch (err) {
      console.error('Failed to get microphone:', err);
      throw err;
    }
  }, [myRole, setIsMuted]);

  const createPeerConnection = useCallback((targetSocketId, userId, isInitiator) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('viva-room:ice-candidate', { roomId, targetSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      let audioEl = audioElementsRef.current.get(userId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.id = `audio-${userId}`;
        document.body.appendChild(audioEl);
        audioElementsRef.current.set(userId, audioEl);
      }
      audioEl.srcObject = remoteStream;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        peersRef.current.delete(targetSocketId);
      }
    };

    return pc;
  }, [socket, roomId]);

  const initiateConnection = useCallback(async (targetSocketId, userId) => {
    if (!socket) return;
    const pc = createPeerConnection(targetSocketId, userId, true);
    peersRef.current.set(targetSocketId, { peerConnection: pc, userId });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('viva-room:offer', { roomId, targetSocketId, offer });
  }, [createPeerConnection, socket, roomId]);

  const handleOffer = useCallback(async ({ offer, senderSocketId, senderUserId }) => {
    if (!socket) return;
    const pc = createPeerConnection(senderSocketId, senderUserId, false);
    peersRef.current.set(senderSocketId, { peerConnection: pc, userId: senderUserId });
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('viva-room:answer', { roomId, targetSocketId: senderSocketId, answer });
  }, [createPeerConnection, socket, roomId]);

  const handleAnswer = useCallback(async ({ answer, senderSocketId }) => {
    const peer = peersRef.current.get(senderSocketId);
    if (peer) await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIceCandidate = useCallback(async ({ candidate, senderSocketId }) => {
    const peer = peersRef.current.get(senderSocketId);
    if (peer && candidate) {
      try { await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch (err) {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const currentMuted = !localStreamRef.current.getAudioTracks()[0]?.enabled;
    const newMuted = !currentMuted;
    localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = !newMuted; });
    useAudioRoomStore.getState().setIsMuted(newMuted);
    if (socket) {
      socket.emit('viva-room:muted', { roomId, isMuted: newMuted });
    }
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    peersRef.current.forEach(({ peerConnection }) => peerConnection.close());
    peersRef.current.clear();
    audioElementsRef.current.forEach((el) => el.remove());
    audioElementsRef.current.clear();
    if (socket) {
      socket.emit('viva-room:leave', { roomId });
    }
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;
    
    socket.on('viva-room:offer', handleOffer);
    socket.on('viva-room:answer', handleAnswer);
    socket.on('viva-room:ice-candidate', handleIceCandidate);
    socket.on('viva-room:user-joined', ({ userId, socketId }) => {
      if (socketId !== socket.id) initiateConnection(socketId, userId);
    });

    return () => {
      socket.off('viva-room:offer', handleOffer);
      socket.off('viva-room:answer', handleAnswer);
      socket.off('viva-room:ice-candidate', handleIceCandidate);
      socket.off('viva-room:user-joined');
    };
  }, [socket, roomId, handleOffer, handleAnswer, handleIceCandidate, initiateConnection]);

  const initialize = useCallback(async () => {
    try { await getLocalStream(); } catch (err) { console.error('WebRTC init failed:', err); }
  }, [getLocalStream]);

  return { initialize, toggleMute, leaveRoom, localStreamRef };
};