const { prisma } = require('../config/database');

// ==================== CREATE ROOM ====================
const createRoom = async (req, res) => {
  try {
    const { title, description, visibility } = req.body;
    const hostId = req.user.id;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ message: 'Title must be at least 3 characters' });
    }

    const room = await prisma.vivaRoom.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        visibility: visibility || 'public',
        hostId,
        participants: {
          create: {
            userId: hostId,
            role: 'host',
          }
        }
      },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        }
      }
    });

    res.status(201).json({ room, message: 'VivaRoom created successfully' });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Failed to create room' });
  }
};

// ==================== GET ALL LIVE ROOMS ====================
const getLiveRooms = async (req, res) => {
  try {
    const { visibility } = req.query;
    const userId = req.user?.id;

    const where = { status: 'live' };
    if (visibility) where.visibility = visibility;

    const rooms = await prisma.vivaRoom.findMany({
      where,
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    const filteredRooms = rooms.filter(room => {
      if (room.visibility !== 'followers_only') return true;
      if (!userId) return false;
      return true;
    });

    res.json({ rooms: filteredRooms });
  } catch (error) {
    console.error('Get live rooms error:', error);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
};

// ==================== GET ROOM BY ID ====================
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await prisma.vivaRoom.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          },
          orderBy: [
            { role: 'asc' },
            { joinedAt: 'asc' }
          ]
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Failed to fetch room' });
  }
};

// ==================== JOIN ROOM ====================
const joinRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const room = await prisma.vivaRoom.findUnique({
      where: { id },
      include: { participants: { where: { leftAt: null } } }
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ message: 'This room has ended' });
    }

    const existingParticipant = room.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      return res.json({ participant: existingParticipant, room });
    }

    const participant = await prisma.vivaRoomParticipant.create({
      data: {
        roomId: id,
        userId,
        role: 'listener',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        room: {
          include: {
            host: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            },
            participants: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, avatar: true }
                }
              }
            }
          }
        }
      }
    });

    res.json({ participant, room: participant.room });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Failed to join room' });
  }
};

// ==================== LEAVE ROOM ====================
const leaveRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const participant = await prisma.vivaRoomParticipant.findFirst({
      where: { roomId: id, userId, leftAt: null }
    });

    if (!participant) {
      return res.status(404).json({ message: 'Not in this room' });
    }

    if (participant.role === 'host') {
      await prisma.vivaRoom.update({
        where: { id },
        data: { status: 'ended', endedAt: new Date() }
      });
    }

    await prisma.vivaRoomParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() }
    });

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ message: 'Failed to leave room' });
  }
};

// ==================== UPDATE PARTICIPANT ROLE ====================
const updateParticipantRole = async (req, res) => {
  try {
    const { roomId, participantId } = req.params;
    const { role } = req.body;
    const userId = req.user.id;

    const room = await prisma.vivaRoom.findUnique({
      where: { id: roomId },
      include: { participants: { where: { leftAt: null } } }
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const requester = room.participants.find(p => p.userId === userId);
    if (!requester || (requester.role !== 'host' && requester.role !== 'co_host')) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const target = await prisma.vivaRoomParticipant.findUnique({
      where: { id: participantId }
    });

    if (target.role === 'host' && requester.role === 'co_host') {
      return res.status(403).json({ message: 'Cannot modify host' });
    }

    const updated = await prisma.vivaRoomParticipant.update({
      where: { id: participantId },
      data: { role },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        }
      }
    });

    res.json({ participant: updated, message: `Role updated to ${role}` });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Failed to update role' });
  }
};

// ==================== TOGGLE MUTE ====================
const toggleMute = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { participantId, mute } = req.body;
    const userId = req.user.id;

    const room = await prisma.vivaRoom.findUnique({
      where: { id: roomId },
      include: { participants: { where: { leftAt: null } } }
    });

    const requester = room?.participants.find(p => p.userId === userId);
    const target = await prisma.vivaRoomParticipant.findUnique({
      where: { id: participantId }
    });

    if (!target || target.roomId !== roomId) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    const canMute = target.userId === userId || 
                    (requester && (requester.role === 'host' || requester.role === 'co_host'));

    if (!canMute) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updated = await prisma.vivaRoomParticipant.update({
      where: { id: participantId },
      data: { isMuted: mute }
    });

    res.json({ participant: updated, message: mute ? 'Muted' : 'Unmuted' });
  } catch (error) {
    console.error('Toggle mute error:', error);
    res.status(500).json({ message: 'Failed to toggle mute' });
  }
};

// ==================== RAISE / LOWER HAND ====================
const toggleHand = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const participant = await prisma.vivaRoomParticipant.findFirst({
      where: { roomId, userId, leftAt: null }
    });

    if (!participant) {
      return res.status(404).json({ message: 'Not in this room' });
    }

    const updated = await prisma.vivaRoomParticipant.update({
      where: { id: participant.id },
      data: { handRaised: !participant.handRaised }
    });

    res.json({ participant: updated, handRaised: updated.handRaised });
  } catch (error) {
    console.error('Toggle hand error:', error);
    res.status(500).json({ message: 'Failed to toggle hand' });
  }
};

// ==================== SEND ROOM MESSAGE ====================
const sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    if (!content?.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const participant = await prisma.vivaRoomParticipant.findFirst({
      where: { roomId, userId: senderId, leftAt: null }
    });

    if (!participant) {
      return res.status(403).json({ message: 'Must be in the room to send messages' });
    }

    const message = await prisma.vivaRoomMessage.create({
      data: {
        roomId,
        senderId,
        content: content.trim()
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        }
      }
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// ==================== END ROOM (HOST ONLY) ====================
const endRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const room = await prisma.vivaRoom.findUnique({
      where: { id },
      include: { participants: { where: { leftAt: null } } }
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const isHost = room.participants.some(p => p.userId === userId && p.role === 'host');
    if (!isHost) {
      return res.status(403).json({ message: 'Only host can end the room' });
    }

    await prisma.vivaRoom.update({
      where: { id },
      data: { status: 'ended', endedAt: new Date() }
    });

    await prisma.vivaRoomParticipant.updateMany({
      where: { roomId: id, leftAt: null },
      data: { leftAt: new Date() }
    });

    res.json({ message: 'Room ended' });
  } catch (error) {
    console.error('End room error:', error);
    res.status(500).json({ message: 'Failed to end room' });
  }
};

// ==================== GET MY ROOMS ====================
const getMyRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    const rooms = await prisma.vivaRoom.findMany({
      where: {
        OR: [
          { hostId: userId },
          { participants: { some: { userId, leftAt: null } } }
        ]
      },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        },
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Get my rooms error:', error);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
};

module.exports = {
  createRoom,
  getLiveRooms,
  getRoomById,
  joinRoom,
  leaveRoom,
  updateParticipantRole,
  toggleMute,
  toggleHand,
  sendMessage,
  endRoom,
  getMyRooms
};