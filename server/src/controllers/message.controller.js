const { prisma } = require('../config/database');
const { encryptSensitiveData, decryptSensitiveData } = require('../utils/security');
const { moderateContent, scanFile } = require('../utils/moderation');
const { uploadToCloudinary } = require('../utils/cloudinary');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const isEncrypted = (content) => {
  if (!content) return false;
  return !content.startsWith('💼') && content.length > 50;
};

const checkContentViolation = async (content, fileUrl, fileType, userId) => {
  const violations = [];
  
  const phoneRegex = /(?:\+?234|0)[7-9][0-1][0-9]{8}|\+?[1-9]\d{1,14}/g;
  const phones = content.match(phoneRegex);
  if (phones && phones.length > 0) {
    violations.push({ type: 'phone', confidence: 0.95 });
  }
  
  const scamPatterns = [
    /\b(send money|wire transfer|western union|gift card|crypto|bitcoin|urgent|act now|limited time|click here|verify account|suspended|locked)\b/gi,
    /\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,
  ];
  
  for (const pattern of scamPatterns) {
    if (pattern.test(content)) {
      violations.push({ type: 'scam', confidence: 0.85 });
      break;
    }
  }
  
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = content.match(urlRegex);
  if (urls && urls.length > 2) {
    violations.push({ type: 'suspicious_links', confidence: 0.7 });
  }
  
  if (fileUrl) {
    const fileScan = await scanFile(fileUrl, fileType);
    if (fileScan.violation) {
      violations.push({ type: fileScan.type, confidence: fileScan.confidence });
    }
  }
  
  if (violations.length > 0) {
    const autoBan = violations.some(v => v.type === 'nudity' || v.type === 'phone' || v.confidence > 0.9);
    
    await prisma.contentViolation.createMany({
      data: violations.map(v => ({
        userId,
        type: v.type,
        content: content.substring(0, 500),
        fileUrl: fileUrl || null,
        confidence: v.confidence,
        autoBanned: autoBan,
      })),
    });
    
    if (autoBan) {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'banned', isSuspended: true },
      });
      
      await prisma.notification.create({
        data: {
          userId: 'admin',
          type: 'user_banned',
          title: 'User Auto-Banned',
          message: `User ${userId} banned for ${violations.map(v => v.type).join(', ')}`,
        },
      });
    }
    
    return { violated: true, autoBan, types: violations.map(v => v.type) };
  }
  
  return { violated: false };
};

const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, type = 'text' } = req.body;
    let fileUrl = req.body.fileUrl || null;
    let fileName = req.body.fileName || null;
    let fileSize = req.body.fileSize || null;
    let mimeType = req.body.mimeType || null;

    if (req.body.fileData) {
      const result = await uploadToCloudinary(req.body.fileData, 'messages');
      fileUrl = result.secure_url;
      fileName = req.body.fileName || 'upload';
      fileSize = req.body.fileSize || 0;
      mimeType = req.body.mimeType || 'application/octet-stream';
    }

    if (req.file) {
      fileUrl = req.file.path;
      fileName = req.file.originalname;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    }

    if (!receiverId || (!content?.trim() && !fileUrl)) {
      return res.status(400).json({ message: 'Receiver and content or file required', code: 'MISSING_FIELDS' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ message: 'Cannot message yourself', code: 'SELF_MESSAGE' });
    }

    if (req.user.status === 'banned') {
      return res.status(403).json({ message: 'Your account has been banned for violating community guidelines', code: 'BANNED' });
    }

    // Check if blocked
    const isBlocked = await prisma.blockedContact.findFirst({
      where: {
        OR: [
          { blockerId: req.user.id, blockedId: receiverId },
          { blockerId: receiverId, blockedId: req.user.id },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({ message: 'Unable to send message', code: 'BLOCKED' });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const moderationResult = await checkContentViolation(
      content || '',
      fileUrl,
      mimeType,
      req.user.id
    );

    if (moderationResult.violated) {
      if (moderationResult.autoBan) {
        return res.status(403).json({
          message: 'Your account has been banned for sending prohibited content. Contact support.',
          code: 'BANNED',
          violations: moderationResult.types,
        });
      }
      return res.status(400).json({
        message: 'Message contains prohibited content',
        code: 'CONTENT_VIOLATION',
        violations: moderationResult.types,
      });
    }

    let messageType = type;
    if (fileUrl) {
      if (mimeType?.startsWith('image/')) messageType = 'image';
      else if (mimeType === 'application/pdf') messageType = 'pdf';
      else messageType = 'file';
    }

    const isOfferMessage = content?.startsWith('💼');
    const finalContent = isOfferMessage || fileUrl ? content : encryptSensitiveData(content, ENCRYPTION_KEY);

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId,
        content: finalContent || '',
        type: messageType,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // Unarchive if conversation was archived
    await prisma.archivedConversation.deleteMany({
      where: {
        OR: [
          { userId: req.user.id, otherUserId: receiverId },
          { userId: receiverId, otherUserId: req.user.id },
        ],
      },
    });

    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'new_message',
        title: 'New Message',
        message: `${req.user.firstName} ${req.user.lastName} sent you a ${messageType === 'text' ? 'message' : messageType}`,
        link: `/messages/${req.user.id}`,
      },
    });

    return res.status(201).json({
      message: 'Message sent',
      data: {
        id: message.id,
        sender: message.sender,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        mimeType: message.mimeType,
        createdAt: message.createdAt,
        isRead: message.isRead,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ message: 'Failed to send message', code: 'MESSAGE_ERROR' });
  }
};

const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 30 } = req.query;

    // Check if blocked
    const isBlocked = await prisma.blockedContact.findFirst({
      where: {
        OR: [
          { blockerId: req.user.id, blockedId: userId },
          { blockerId: userId, blockedId: req.user.id },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({ message: 'This conversation is unavailable', code: 'BLOCKED' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: userId },
            { senderId: userId, receiverId: req.user.id },
          ],
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
          offer: {
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
              receiver: { select: { id: true, firstName: true, lastName: true, avatar: true } },
              contract: { select: { id: true, status: true, dueDate: true, graceEndDate: true } },
              job: { select: { id: true, title: true } },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.count({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: userId },
            { senderId: userId, receiverId: req.user.id },
          ],
        },
      }),
    ]);

    const decryptedMessages = messages.map(msg => {
      if (msg.offer || msg.type !== 'text') {
        return { ...msg, content: msg.content };
      }
      if (msg.content && msg.content.startsWith('💼')) {
        return { ...msg, content: msg.content };
      }
      try {
        if (isEncrypted(msg.content)) {
          const decryptedContent = decryptSensitiveData(msg.content, ENCRYPTION_KEY);
          return { ...msg, content: decryptedContent };
        }
        return { ...msg, content: msg.content };
      } catch (err) {
        console.error('Decryption failed for message:', msg.id, err.message);
        return { ...msg, content: '[Unable to decrypt]' };
      }
    }).reverse();

    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.status(200).json({
      messages: decryptedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({ message: 'Failed to fetch messages', code: 'FETCH_ERROR' });
  }
};

const getConversationsList = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        offer: {
          select: { id: true, amount: true, status: true, durationDays: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get blocked users
    const blockedContacts = await prisma.blockedContact.findMany({
      where: {
        OR: [
          { blockerId: req.user.id },
          { blockedId: req.user.id },
        ],
      },
    });
    const blockedUserIds = new Set(blockedContacts.map(b => b.blockerId === req.user.id ? b.blockedId : b.blockerId));

    // Get archived conversations
    const archivedConversations = await prisma.archivedConversation.findMany({
      where: { userId: req.user.id },
    });
    const archivedUserIds = new Set(archivedConversations.map(a => a.otherUserId));

    const conversationMap = new Map();

    for (const msg of messages) {
      const otherUser = msg.senderId === req.user.id ? msg.receiver : msg.sender;
      const conversationId = otherUser.id;

      // Skip blocked conversations
      if (blockedUserIds.has(conversationId)) continue;

      if (!conversationMap.has(conversationId)) {
        let preview = 'New message';

        if (msg.offer) {
          preview = `💼 Offer: ₦${msg.offer.amount?.toLocaleString()} — ${msg.offer.status} (${msg.offer.durationDays} days)`;
        } else if (msg.type === 'image') {
          preview = '📷 Image';
        } else if (msg.type === 'pdf') {
          preview = '📄 PDF Document';
        } else if (msg.type === 'file') {
          preview = `📎 ${msg.fileName || 'File'}`;
        } else if (msg.content && msg.content.startsWith('💼')) {
          preview = msg.content.split('\n')[0];
        } else {
          try {
            if (isEncrypted(msg.content)) {
              const decrypted = decryptSensitiveData(msg.content, ENCRYPTION_KEY);
              preview = decrypted.length > 60 ? decrypted.substring(0, 60) + '...' : decrypted;
            } else {
              preview = msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
            }
          } catch (err) {
            preview = '[Encrypted message]';
          }
        }

        const unreadCount = await prisma.message.count({
          where: {
            senderId: conversationId,
            receiverId: req.user.id,
            isRead: false,
          },
        });

        conversationMap.set(conversationId, {
          user: otherUser,
          lastMessage: {
            preview,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
            isFromMe: msg.senderId === req.user.id,
            type: msg.type,
          },
          unreadCount,
          isArchived: archivedUserIds.has(conversationId),
        });
      }
    }

    // Separate active and archived
    const allConversations = Array.from(conversationMap.values());
    const activeConversations = allConversations.filter(c => !c.isArchived);
    const archived = allConversations.filter(c => c.isArchived);

    return res.status(200).json({
      conversations: activeConversations,
      archivedConversations: archived,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({ message: 'Failed to fetch conversations', code: 'FETCH_ERROR' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.message.updateMany({
      where: {
        senderId: userId,
        receiverId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({ message: 'Failed to mark as read', code: 'UPDATE_ERROR' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found', code: 'MESSAGE_NOT_FOUND' });
    }

    if (message.senderId !== req.user.id && message.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    return res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ message: 'Failed to delete message', code: 'DELETE_ERROR' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
    });

    return res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    return res.status(500).json({ message: 'Failed to get unread count', code: 'FETCH_ERROR' });
  }
};

// ═══════════════════════════════════════════════════════════════
// BLOCK / UNBLOCK CONTACTS
// ═══════════════════════════════════════════════════════════════

const blockContact = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot block yourself', code: 'SELF_BLOCK' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const existing = await prisma.blockedContact.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: req.user.id,
          blockedId: userId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ message: 'User already blocked', code: 'ALREADY_BLOCKED' });
    }

    await prisma.blockedContact.create({
      data: {
        blockerId: req.user.id,
        blockedId: userId,
      },
    });

    // Also archive the conversation
    await prisma.archivedConversation.upsert({
      where: {
        userId_otherUserId: {
          userId: req.user.id,
          otherUserId: userId,
        },
      },
      update: {},
      create: {
        userId: req.user.id,
        otherUserId: userId,
      },
    });

    return res.status(201).json({
      message: `${targetUser.firstName} ${targetUser.lastName} has been blocked`,
      blockedUser: targetUser,
    });
  } catch (error) {
    console.error('Block contact error:', error);
    return res.status(500).json({ message: 'Failed to block contact', code: 'BLOCK_ERROR' });
  }
};

const unblockContact = async (req, res) => {
  try {
    const { userId } = req.params;

    const existing = await prisma.blockedContact.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: req.user.id,
          blockedId: userId,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: 'User not blocked', code: 'NOT_BLOCKED' });
    }

    await prisma.blockedContact.delete({
      where: {
        blockerId_blockedId: {
          blockerId: req.user.id,
          blockedId: userId,
        },
      },
    });

    return res.status(200).json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock contact error:', error);
    return res.status(500).json({ message: 'Failed to unblock contact', code: 'UNBLOCK_ERROR' });
  }
};

const getBlockedContacts = async (req, res) => {
  try {
    const blocked = await prisma.blockedContact.findMany({
      where: { blockerId: req.user.id },
      include: {
        blocked: {
          select: { id: true, firstName: true, lastName: true, avatar: true, headline: true, isVerified: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

        return res.status(200).json({
      blockedContacts: blocked.map(b => ({
        id: b.id,
        blockedId: b.blocked.id,      // <-- ADD THIS
        blockedAt: b.createdAt,
        blockedUser: b.blocked,        // <-- CHANGE "user" to "blockedUser"
      })),
    });
    
  } catch (error) {
    console.error('Get blocked contacts error:', error);
    return res.status(500).json({ message: 'Failed to fetch blocked contacts', code: 'FETCH_ERROR' });
  }
};

// ═══════════════════════════════════════════════════════════════
// ARCHIVE / UNARCHIVE CONVERSATIONS
// ═══════════════════════════════════════════════════════════════

const archiveConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot archive your own conversation', code: 'SELF_ARCHIVE' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    await prisma.archivedConversation.upsert({
      where: {
        userId_otherUserId: {
          userId: req.user.id,
          otherUserId: userId,
        },
      },
      update: {},
      create: {
        userId: req.user.id,
        otherUserId: userId,
      },
    });

    return res.status(200).json({
      message: `Conversation with ${targetUser.firstName} archived`,
      archivedUser: targetUser,
    });
  } catch (error) {
    console.error('Archive conversation error:', error);
    return res.status(500).json({ message: 'Failed to archive conversation', code: 'ARCHIVE_ERROR' });
  }
};

const unarchiveConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.archivedConversation.deleteMany({
      where: {
        userId: req.user.id,
        otherUserId: userId,
      },
    });

    return res.status(200).json({ message: 'Conversation unarchived' });
  } catch (error) {
    console.error('Unarchive conversation error:', error);
    return res.status(500).json({ message: 'Failed to unarchive conversation', code: 'UNARCHIVE_ERROR' });
  }
};

const getArchivedConversations = async (req, res) => {
  try {
    const archived = await prisma.archivedConversation.findMany({
      where: { userId: req.user.id },
      include: {
        otherUser: {
          select: { id: true, firstName: true, lastName: true, avatar: true, headline: true, isVerified: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get last message for each archived conversation
    const archivedWithPreview = await Promise.all(
      archived.map(async (a) => {
        const lastMsg = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: req.user.id, receiverId: a.otherUserId },
              { senderId: a.otherUserId, receiverId: req.user.id },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            type: true,
            createdAt: true,
            senderId: true,
          },
        });

        let preview = 'No messages';
        if (lastMsg) {
          if (lastMsg.type === 'image') preview = '📷 Image';
          else if (lastMsg.type === 'pdf') preview = '📄 PDF';
          else if (lastMsg.type === 'file') preview = '📎 File';
          else {
            try {
              preview = isEncrypted(lastMsg.content)
                ? decryptSensitiveData(lastMsg.content, ENCRYPTION_KEY)
                : lastMsg.content;
              preview = preview.length > 60 ? preview.substring(0, 60) + '...' : preview;
            } catch {
              preview = '[Encrypted]';
            }
          }
        }

        return {
          id: a.id,
          archivedAt: a.createdAt,
          user: a.otherUser,
          lastMessage: lastMsg ? {
            preview,
            createdAt: lastMsg.createdAt,
            isFromMe: lastMsg.senderId === req.user.id,
          } : null,
        };
      })
    );

    return res.status(200).json({ archivedConversations: archivedWithPreview });
  } catch (error) {
    console.error('Get archived conversations error:', error);
    return res.status(500).json({ message: 'Failed to fetch archived conversations', code: 'FETCH_ERROR' });
  }
};

// ═══════════════════════════════════════════════════════════════
// VIDEO CALL
// ═══════════════════════════════════════════════════════════════

const initiateVideoCall = async (req, res) => {
  try {
    const { receiverId, callType = 'video' } = req.body;

    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required', code: 'MISSING_FIELDS' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ message: 'Cannot call yourself', code: 'SELF_CALL' });
    }

    // Check if blocked
    const isBlocked = await prisma.blockedContact.findFirst({
      where: {
        OR: [
          { blockerId: req.user.id, blockedId: receiverId },
          { blockerId: receiverId, blockedId: req.user.id },
        ],
      },
    });

    if (isBlocked) {
      return res.status(403).json({ message: 'Cannot call this user', code: 'BLOCKED' });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, firstName: true, lastName: true, avatar: true },
    });

    if (!receiver) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const roomId = `call_${req.user.id}_${receiverId}_${Date.now()}`;

    const call = await prisma.videoCall.create({
      data: {
        callerId: req.user.id,
        receiverId,
        roomId,
        callType,
        status: 'ringing',
        startedAt: new Date(),
      },
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'incoming_call',
        title: 'Incoming Call',
        message: `${req.user.firstName} ${req.user.lastName} is calling you`,
        link: `/messages/${req.user.id}?call=${call.id}`,
      },
    });

    return res.status(201).json({
      message: 'Call initiated',
      call: {
        id: call.id,
        roomId: call.roomId,
        callType: call.callType,
        status: call.status,
        receiver,
      },
    });
  } catch (error) {
    console.error('Initiate video call error:', error);
    return res.status(500).json({ message: 'Failed to initiate call', code: 'CALL_ERROR' });
  }
};

const endVideoCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { duration } = req.body;

    const call = await prisma.videoCall.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return res.status(404).json({ message: 'Call not found', code: 'CALL_NOT_FOUND' });
    }

    if (call.callerId !== req.user.id && call.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    const updatedCall = await prisma.videoCall.update({
      where: { id: callId },
      data: {
        status: 'ended',
        endedAt: new Date(),
        duration: duration || Math.floor((new Date() - new Date(call.startedAt)) / 1000),
      },
    });

    return res.status(200).json({
      message: 'Call ended',
      call: updatedCall,
    });
  } catch (error) {
    console.error('End video call error:', error);
    return res.status(500).json({ message: 'Failed to end call', code: 'CALL_ERROR' });
  }
};

const getCallById = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await prisma.videoCall.findUnique({
      where: { id: callId },
      include: {
        caller: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    if (!call) {
      return res.status(404).json({ message: 'Call not found', code: 'CALL_NOT_FOUND' });
    }

    // Only caller or receiver can view
    if (call.callerId !== req.user.id && call.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    return res.status(200).json({ call });
  } catch (error) {
    console.error('Get call by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch call', code: 'FETCH_ERROR' });
  }
};

const getCallHistory = async (req, res) => {
  try {
    const calls = await prisma.videoCall.findMany({
      where: {
        OR: [
          { callerId: req.user.id },
          { receiverId: req.user.id },
        ],
      },
      include: {
        caller: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formattedCalls = calls.map(call => {
      const isCaller = call.callerId === req.user.id;
      const otherUser = isCaller ? call.receiver : call.caller;

      return {
        id: call.id,
        roomId: call.roomId,
        callType: call.callType,
        status: call.status,
        duration: call.duration,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        isCaller,
        otherUser,
      };
    });

    return res.status(200).json({ calls: formattedCalls });
  } catch (error) {
    console.error('Get call history error:', error);
    return res.status(500).json({ message: 'Failed to fetch call history', code: 'FETCH_ERROR' });
  }
};

  

module.exports = {
  getCallById,
  sendMessage,
  getConversation,
  getConversationsList,
  markAsRead,
  deleteMessage,
  getUnreadCount,
  blockContact,
  unblockContact,
  getBlockedContacts,
  archiveConversation,
  unarchiveConversation,
  getArchivedConversations,
  initiateVideoCall,
  endVideoCall,
  getCallHistory,
};