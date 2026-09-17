const { prisma } = require('../config/database');

const sendConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot connect with yourself', code: 'SELF_CONNECT' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // Prevent connecting with admin users
    if (targetUser.isAdmin === true) {
      return res.status(403).json({ message: 'Cannot connect with admin users', code: 'ADMIN_CONNECT_FORBIDDEN' });
    }

    const existingConnection = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id },
        ],
      },
    });

    if (existingConnection) {
      if (existingConnection.status === 'accepted') {
        return res.status(409).json({ message: 'Already connected', code: 'ALREADY_CONNECTED' });
      }
      if (existingConnection.status === 'pending') {
        return res.status(409).json({ message: 'Request already pending', code: 'PENDING_REQUEST' });
      }
    }

    const connection = await prisma.connection.create({
      data: {
        senderId: req.user.id,
        receiverId: userId,
        status: 'pending',
      },
      include: {
        receiver: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'connection_request',
        title: 'Connection Request',
        message: `${req.user.firstName} ${req.user.lastName} wants to connect`,
        link: `/connections`,
      },
    });

    return res.status(201).json({
      message: 'Connection request sent',
      connection,
    });
  } catch (error) {
    console.error('Send connection error:', error);
    return res.status(500).json({ message: 'Failed to send request', code: 'CONNECTION_ERROR' });
  }
};

const acceptConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found', code: 'CONNECTION_NOT_FOUND' });
    }

    if (connection.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed', code: 'ALREADY_PROCESSED' });
    }

    const updatedConnection = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: 'accepted' },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: connection.senderId,
        type: 'connection_accepted',
        title: 'Connection Accepted',
        message: `${req.user.firstName} ${req.user.lastName} accepted your connection request`,
        link: `/profile/${req.user.id}`,
      },
    });

    return res.status(200).json({
      message: 'Connection accepted',
      connection: updatedConnection,
    });
  } catch (error) {
    console.error('Accept connection error:', error);
    return res.status(500).json({ message: 'Failed to accept request', code: 'ACCEPT_ERROR' });
  }
};

const rejectConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found', code: 'CONNECTION_NOT_FOUND' });
    }

    if (connection.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    await prisma.connection.delete({
      where: { id: connectionId },
    });

    return res.status(200).json({ message: 'Connection request rejected' });
  } catch (error) {
    console.error('Reject connection error:', error);
    return res.status(500).json({ message: 'Failed to reject request', code: 'REJECT_ERROR' });
  }
};

const getMyConnections = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [connections, total] = await Promise.all([
      prisma.connection.findMany({
        where: {
          OR: [
            { senderId: req.user.id, status: 'accepted' },
            { receiverId: req.user.id, status: 'accepted' },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              headline: true,
              isOnline: true,
              isAdmin: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              headline: true,
              isOnline: true,
              isAdmin: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.connection.count({
        where: {
          OR: [
            { senderId: req.user.id, status: 'accepted' },
            { receiverId: req.user.id, status: 'accepted' },
          ],
        },
      }),
    ]);

    const formattedConnections = connections.map(c => {
      const isSender = c.senderId === req.user.id;
      const otherUser = isSender ? c.receiver : c.sender;
      return {
        connectionId: c.id,
        user: otherUser,
        connectedAt: c.updatedAt,
      };
    }).filter(c => c.user.isAdmin !== true);

    return res.status(200).json({
      connections: formattedConnections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: formattedConnections.length,
        pages: Math.ceil(formattedConnections.length / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get connections error:', error);
    return res.status(500).json({ message: 'Failed to fetch connections', code: 'FETCH_ERROR' });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const requests = await prisma.connection.findMany({
      where: {
        receiverId: req.user.id,
        status: 'pending',
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            headline: true,
            isAdmin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const filteredRequests = requests.filter(r => r.sender.isAdmin !== true);

    return res.status(200).json({ requests: filteredRequests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    return res.status(500).json({ message: 'Failed to fetch requests', code: 'FETCH_ERROR' });
  }
};

const removeConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found', code: 'CONNECTION_NOT_FOUND' });
    }

    if (connection.senderId !== req.user.id && connection.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized', code: 'UNAUTHORIZED' });
    }

    await prisma.connection.delete({
      where: { id: connectionId },
    });

    return res.status(200).json({ message: 'Connection removed' });
  } catch (error) {
    console.error('Remove connection error:', error);
    return res.status(500).json({ message: 'Failed to remove connection', code: 'REMOVE_ERROR' });
  }
};

const getConnectionSuggestions = async (req, res) => {
  try {
    const myConnections = await prisma.connection.findMany({
      where: {
        OR: [
          { senderId: req.user.id, status: 'accepted' },
          { receiverId: req.user.id, status: 'accepted' },
        ],
      },
    });

    const connectedIds = myConnections.map(c => 
      c.senderId === req.user.id ? c.receiverId : c.senderId
    );
    connectedIds.push(req.user.id);

    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: connectedIds },
        isVerified: true,
        isSuspended: false,
        isAdmin: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        headline: true,
        skills: true,
        location: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    return res.status(500).json({ message: 'Failed to fetch suggestions', code: 'FETCH_ERROR' });
  }
};

const checkConnectionStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id },
        ],
      },
    });

    return res.status(200).json({
      isConnected: connection?.status === 'accepted',
      isPending: connection?.status === 'pending',
      isSender: connection?.senderId === req.user.id,
      connectionId: connection?.id || null,
      status: connection?.status || null,
    });
  } catch (error) {
    console.error('Check connection error:', error);
    return res.status(500).json({ message: 'Failed to check connection', code: 'CHECK_ERROR' });
  }
};

module.exports = {
  sendConnectionRequest,
  acceptConnection,
  rejectConnection,
  getMyConnections,
  getPendingRequests,
  removeConnection,
  getConnectionSuggestions,
  checkConnectionStatus,
};