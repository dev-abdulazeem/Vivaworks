const express = require('express');
const router = express.Router();

// Auth middleware exports an object — we need .authenticate
const { authenticate: auth } = require('../middleware/auth');

const {
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
} = require('../controllers/audioRoom.controller');

// Room management
router.post('/', auth, createRoom);
router.get('/live', auth, getLiveRooms);
router.get('/my-rooms', auth, getMyRooms);
router.get('/:id', auth, getRoomById);
router.post('/:id/join', auth, joinRoom);
router.post('/:id/leave', auth, leaveRoom);
router.post('/:id/end', auth, endRoom);

// Participant management
router.patch('/:roomId/participants/:participantId/role', auth, updateParticipantRole);
router.patch('/:roomId/mute', auth, toggleMute);
router.patch('/:roomId/hand', auth, toggleHand);

// Room chat
router.post('/:roomId/messages', auth, sendMessage);

module.exports = router;