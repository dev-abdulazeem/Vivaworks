const { Server } = require('socket.io');
const prisma = require('../config/database'); // <-- FIXED: remove destructuring, use default export
const { verifyAccessToken } = require('../middleware/auth');

let io;

// Module-level tracking for VivaRooms
const activeVivaRooms = new Map();

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  io.engine.on('connection_error', (err) => {
    console.log('Socket.IO connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        socket.userId = null;
        socket.user = null;
        return next();
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        socket.userId = null;
        socket.user = null;
        return next();
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          isSuspended: true,
        },
      });

      if (!user || user.isSuspended) {
        socket.userId = null;
        socket.user = null;
        return next();
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      socket.userId = null;
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.userId || 'anonymous'}`);

    if (socket.userId) {
      socket.join(`user_${socket.userId}`);

      prisma.user.update({
        where: { id: socket.userId },
        data: { isOnline: true, lastActive: new Date() },
      }).catch(err => console.error('Update online status error:', err));
    }

    // ─── ROOM MANAGEMENT ───────────────────────────────────────────────
    socket.on('join-user-room', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('join-call-room', (roomId) => {
      socket.join(roomId);
    });

    socket.on('leave-call-room', (roomId) => {
      socket.leave(roomId);
    });

    // ─── VIVAROOM SOCKET EVENTS ────────────────────────────────────────
    socket.on('viva-room:join', async ({ roomId, userId }) => {
      if (!socket.userId || socket.userId !== userId) {
        socket.emit('viva-room:error', { message: 'Authentication required' });
        return;
      }

      socket.join(`viva-room:${roomId}`);
      socket.vivaRoomId = roomId;
      socket.vivaUserId = userId;

      if (!activeVivaRooms.has(roomId)) {
        activeVivaRooms.set(roomId, new Set());
      }
      activeVivaRooms.get(roomId).add({ socketId: socket.id, userId });

      // Fetch full participant data with user info for instant display
      let participant = null;
      try {
        participant = await prisma.roomParticipant.findFirst({
          where: { roomId, userId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        });
      } catch (err) {
        console.error('Failed to fetch participant on join:', err);
      }

      // Broadcast to others in room with full participant data
      socket.to(`viva-room:${roomId}`).emit('viva-room:user-joined', {
        userId,
        socketId: socket.id,
        participant,
      });
    });

    socket.on('viva-room:leave', ({ roomId }) => {
      socket.leave(`viva-room:${roomId}`);

      if (activeVivaRooms.has(roomId)) {
        const participants = activeVivaRooms.get(roomId);
        for (const p of participants) {
          if (p.socketId === socket.id) {
            participants.delete(p);
            break;
          }
        }
        if (participants.size === 0) {
          activeVivaRooms.delete(roomId);
        }
      }

      socket.to(`viva-room:${roomId}`).emit('viva-room:user-left', {
        userId: socket.vivaUserId,
        socketId: socket.id,
      });

      delete socket.vivaRoomId;
      delete socket.vivaUserId;
    });

    // ─── HOST ENDS ROOM ──────────────────────────────────────────────────
    socket.on('viva-room:end-room', async ({ roomId }) => {
      if (!socket.userId || !socket.vivaRoomId || socket.vivaRoomId !== roomId) {
        socket.emit('viva-room:error', { message: 'Not in this room' });
        return;
      }

      // Verify this user is the host
      let room = null;
      try {
        room = await prisma.vivaRoom.findUnique({
          where: { id: roomId },
          select: { hostId: true },
        });
      } catch (err) {
        console.error('Failed to fetch room for end:', err);
        socket.emit('viva-room:error', { message: 'Failed to end room' });
        return;
      }

      if (!room || room.hostId !== socket.userId) {
        socket.emit('viva-room:error', { message: 'Only host can end room' });
        return;
      }

      // Broadcast to EVERYONE in room (including sender) that room ended
      io.to(`viva-room:${roomId}`).emit('viva-room:room-ended', {
        roomId,
        endedBy: socket.userId,
      });

      // Clean up active room tracking
      activeVivaRooms.delete(roomId);

      // Mark room as ended in DB
      try {
        await prisma.vivaRoom.update({
          where: { id: roomId },
          data: { status: 'ended', endedAt: new Date() },
        });
      } catch (err) {
        console.error('End room DB error:', err);
      }
    });

    socket.on('viva-room:offer', ({ roomId, targetSocketId, offer }) => {
      socket.to(targetSocketId).emit('viva-room:offer', {
        offer,
        senderSocketId: socket.id,
        senderUserId: socket.vivaUserId,
      });
    });

    socket.on('viva-room:answer', ({ roomId, targetSocketId, answer }) => {
      socket.to(targetSocketId).emit('viva-room:answer', {
        answer,
        senderSocketId: socket.id,
      });
    });

    socket.on('viva-room:ice-candidate', ({ roomId, targetSocketId, candidate }) => {
      socket.to(targetSocketId).emit('viva-room:ice-candidate', {
        candidate,
        senderSocketId: socket.id,
      });
    });

    socket.on('viva-room:speaking', ({ roomId, isSpeaking }) => {
      socket.to(`viva-room:${roomId}`).emit('viva-room:speaking', {
        userId: socket.vivaUserId,
        isSpeaking,
      });
    });

    socket.on('viva-room:muted', ({ roomId, userId, isMuted }) => {
      socket.to(`viva-room:${roomId}`).emit('viva-room:muted', {
        userId,
        isMuted,
      });
    });

    socket.on('viva-room:hand', ({ roomId, userId, handRaised }) => {
      socket.to(`viva-room:${roomId}`).emit('viva-room:hand', {
        userId,
        handRaised,
      });
    });

    socket.on('viva-room:role-changed', ({ roomId, userId, role }) => {
      socket.to(`viva-room:${roomId}`).emit('viva-room:role-changed', {
        userId,
        role,
      });
    });

    socket.on('viva-room:message', ({ roomId, message }) => {
      socket.to(`viva-room:${roomId}`).emit('viva-room:message', message);
    });

    // ─── REAL-TIME MESSAGING ─────────────────────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, content } = data;
        if (!socket.userId) {
          socket.emit('message_error', { code: 'AUTH_REQUIRED', message: 'Please log in' });
          return;
        }
        if (!receiverId || !content?.trim()) {
          socket.emit('message_error', { code: 'INVALID_DATA', message: 'Receiver and content required' });
          return;
        }

        const isBlocked = await prisma.blockedContact.findFirst({
          where: {
            OR: [
              { blockerId: receiverId, blockedUserId: socket.userId },
              { blockerId: socket.userId, blockedUserId: receiverId },
            ],
          },
        });

        if (isBlocked) {
          socket.emit('message_error', { code: 'BLOCKED', message: 'Cannot message this user' });
          return;
        }

        const { encryptSensitiveData } = require('./security');
        const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
        const encryptedContent = encryptSensitiveData(content.trim(), ENCRYPTION_KEY);

        const message = await prisma.message.create({
          data: {
            senderId: socket.userId,
            receiverId,
            content: encryptedContent,
          },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, avatar: true },
            },
          },
        });

        const messagePayload = {
          id: message.id,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: content.trim(),
          createdAt: message.createdAt,
          isRead: message.isRead,
          sender: message.sender,
        };

        io.to(`user_${receiverId}`).emit('new_message', messagePayload);
        socket.emit('message_sent', messagePayload);

        await prisma.notification.create({
          data: {
            userId: receiverId,
            type: 'new_message',
            title: 'New Message',
            message: `${socket.user.firstName} sent you a message`,
            link: `/messages/${socket.userId}`,
          },
        });

        io.to(`user_${receiverId}`).emit('new_notification', {
          type: 'new_message',
          title: 'New Message',
          message: `${socket.user.firstName} sent you a message`,
        });

      } catch (error) {
        console.error('Socket send message error:', error);
        socket.emit('message_error', { code: 'SERVER_ERROR', message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      if (!socket.userId) return;
      const { receiverId } = data;
      if (!receiverId) return;
      io.to(`user_${receiverId}`).emit('user_typing', {
        userId: socket.userId,
        firstName: socket.user.firstName,
      });
    });

    socket.on('messages_read', async (data) => {
      if (!socket.userId) return;
      try {
        const { senderId } = data;
        if (!senderId) return;
        await prisma.message.updateMany({
          where: {
            senderId,
            receiverId: socket.userId,
            isRead: false,
          },
          data: { isRead: true },
        });
        io.to(`user_${senderId}`).emit('messages_read', {
          by: socket.userId,
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // ─── REAL-TIME OFFERS ────────────────────────────────────────────────
    socket.on('send_offer', async (data) => {
      try {
        const { receiverId, offerId } = data;
        if (!socket.userId || !receiverId || !offerId) return;
        const offer = await prisma.offer.findUnique({
          where: { id: offerId },
          include: {
            message: {
              include: {
                sender: {
                  select: { id: true, firstName: true, lastName: true, avatar: true },
                },
              },
            },
          },
        });
        if (!offer) return;
        io.to(`user_${receiverId}`).emit('new_offer', {
          offer,
          sender: offer.message.sender,
        });
      } catch (error) {
        console.error('Socket send offer error:', error);
      }
    });

    socket.on('offer_accepted', (data) => {
      const { receiverId, offerId, contractId } = data;
      if (!socket.userId || !receiverId || !offerId) return;
      io.to(`user_${receiverId}`).emit('offer_status_update', {
        offerId,
        status: 'accepted',
        contractId,
      });
    });

    socket.on('offer_rejected', (data) => {
      const { receiverId, offerId } = data;
      if (!socket.userId || !receiverId || !offerId) return;
      io.to(`user_${receiverId}`).emit('offer_status_update', {
        offerId,
        status: 'rejected',
      });
    });

    socket.on('offer_cancelled', (data) => {
      const { receiverId, offerId } = data;
      if (!socket.userId || !receiverId || !offerId) return;
      io.to(`user_${receiverId}`).emit('offer_status_update', {
        offerId,
        status: 'cancelled',
      });
    });

    // ─── CALL SYSTEM ───────────────────────────────────────────────────
    const activeCalls = new Map();

    socket.on('call-initiate', async (data) => {
      try {
        const { callId, roomId, callerId, receiverId, callType, callerName, callerAvatar } = data;
        if (!socket.userId) {
          socket.emit('call-error', { message: 'Authentication required' });
          return;
        }
        if (callerId !== socket.userId) {
          socket.emit('call-error', { message: 'Unauthorized' });
          return;
        }

        const isBlocked = await prisma.blockedContact.findFirst({
          where: {
            OR: [
              { blockerId: receiverId, blockedUserId: callerId },
              { blockerId: callerId, blockedUserId: receiverId },
            ],
          },
        });

        if (isBlocked) {
          socket.emit('call-declined', { reason: 'blocked' });
          return;
        }

        socket.join(roomId);
        await prisma.videoCall.update({
          where: { id: callId },
          data: { status: 'ringing' },
        }).catch(err => console.error('Update call status error:', err));

        activeCalls.set(callId, {
          callerId,
          receiverId,
          roomId,
          callType,
          callerName: callerName || 'Someone',
          callerAvatar: callerAvatar || null,
          status: 'ringing',
          startedAt: Date.now(),
        });

        io.to(`user_${receiverId}`).emit('incoming-call', {
          callId,
          roomId,
          callerId,
          callerName: callerName || 'Someone',
          callerAvatar: callerAvatar || null,
          callType,
        });
      } catch (error) {
        console.error('Call initiate error:', error);
        socket.emit('call-error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('call-accept', async (data) => {
      const { roomId, receiverId, callId } = data;
      if (!socket.userId || socket.userId !== receiverId) {
        socket.emit('call-error', { message: 'Unauthorized' });
        return;
      }
      socket.join(roomId);
      if (activeCalls.has(callId)) {
        activeCalls.get(callId).status = 'ongoing';
      }
      if (callId) {
        await prisma.videoCall.update({
          where: { id: callId },
          data: { status: 'ongoing' },
        }).catch(err => console.error('Update call status error:', err));
      }
      io.to(roomId).emit('call-accepted', { roomId, receiverId, callId });
    });

    socket.on('call-decline', async (data) => {
      const { roomId, callId } = data;
      if (activeCalls.has(callId)) {
        activeCalls.get(callId).status = 'declined';
      }
      if (callId) {
        await prisma.videoCall.update({
          where: { id: callId },
          data: { status: 'declined', endedAt: new Date() },
        }).catch(err => console.error('Update call status error:', err));
      }
      io.to(roomId).emit('call-declined', { reason: 'declined', roomId, callId });
      socket.leave(roomId);
      setTimeout(() => activeCalls.delete(callId), 30000);
    });

    socket.on('call-end', async (data) => {
      const { roomId, duration, callId } = data;
      if (activeCalls.has(callId)) {
        activeCalls.get(callId).status = 'ended';
      }
      if (callId) {
        await prisma.videoCall.update({
          where: { id: callId },
          data: {
            status: 'ended',
            endedAt: new Date(),
            duration: duration || 0,
          },
        }).catch(err => console.error('Update call status error:', err));
      }
      io.to(roomId).emit('call-ended', { roomId, duration, callId });
      socket.leave(roomId);
      setTimeout(() => activeCalls.delete(callId), 30000);
    });

    // ─── WEBRTC SIGNALING ──────────────────────────────────────────────
    socket.on('webrtc-offer', (data) => {
      const { roomId, offer } = data;
      socket.to(roomId).emit('webrtc-offer', { roomId, offer });
    });

    socket.on('webrtc-answer', (data) => {
      const { roomId, answer } = data;
      socket.to(roomId).emit('webrtc-answer', { roomId, answer });
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { roomId, candidate } = data;
      socket.to(roomId).emit('webrtc-ice-candidate', { roomId, candidate });
    });

    socket.on('call-toggle-audio', (data) => {
      const { roomId, enabled } = data;
      socket.to(roomId).emit('peer-toggle-audio', { enabled });
    });

    socket.on('call-toggle-video', (data) => {
      const { roomId, enabled } = data;
      socket.to(roomId).emit('peer-toggle-video', { enabled });
    });

    // ─── DISCONNECT ──────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);

      if (socket.vivaRoomId && socket.vivaUserId) {
        socket.to(`viva-room:${socket.vivaRoomId}`).emit('viva-room:user-left', {
          userId: socket.vivaUserId,
          socketId: socket.id,
        });

        if (activeVivaRooms.has(socket.vivaRoomId)) {
          const participants = activeVivaRooms.get(socket.vivaRoomId);
          for (const p of participants) {
            if (p.socketId === socket.id) {
              participants.delete(p);
              break;
            }
          }
          if (participants.size === 0) {
            activeVivaRooms.delete(socket.vivaRoomId);
          }
        }
      }

      if (socket.userId) {
        await prisma.user.update({
          where: { id: socket.userId },
          data: { isOnline: false, lastActive: new Date() },
        }).catch(err => console.error('Update offline status error:', err));
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
};