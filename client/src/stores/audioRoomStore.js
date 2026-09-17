import { create } from 'zustand';

const useAudioRoomStore = create((set, get) => ({
  // ─── STATE ───────────────────────────────────────────────
  rooms: [],
  currentRoom: null,
  participants: [],
  messages: [],
  isInRoom: false,
  isHost: false,
  myRole: 'listener',
  isMuted: true,
  isSpeaking: false,
  handRaised: false,
  isCreating: false,
  createModalOpen: false,
  loading: false,
  error: null,

  // ─── SETTERS ─────────────────────────────────────────────
  setRooms: (rooms) => set({ rooms }),

  setCurrentRoom: (room) => set({
    currentRoom: room,
    isHost: room?.hostId === get().getUserId?.(),
    myRole: room?.participants?.find(p => p.userId === get().getUserId?.())?.role || 'listener',
  }),

  setParticipants: (participants) => set({ participants }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message].slice(-100),
  })),

  setIsInRoom: (isInRoom) => set({ isInRoom }),
  setIsHost: (isHost) => set({ isHost }),
  setMyRole: (myRole) => set({ myRole }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setHandRaised: (handRaised) => set({ handRaised }),
  setIsCreating: (isCreating) => set({ isCreating }),
  setCreateModalOpen: (open) => set({ createModalOpen: open }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // ─── PARTICIPANT ACTIONS ─────────────────────────────────
  updateParticipant: (userId, updates) => set((state) => ({
    participants: state.participants.map(p =>
      p.userId === userId ? { ...p, ...updates } : p
    ),
  })),

  addParticipant: (participant) => set((state) => {
    // Normalize participant shape — handle both full participant object and minimal data
    const normalizedParticipant = participant.participant || participant;
    const userId = normalizedParticipant.userId || normalizedParticipant.user?.id;

    if (!userId) return state;

    const exists = state.participants.some(p => p.userId === userId);
    if (exists) {
      // Update existing participant instead of adding duplicate
      return {
        participants: state.participants.map(p =>
          p.userId === userId ? { ...p, ...normalizedParticipant } : p
        ),
      };
    }

    return { participants: [...state.participants, normalizedParticipant] };
  }),

  removeParticipant: (userId) => set((state) => ({
    participants: state.participants.filter(p => p.userId !== userId),
  })),

  updateParticipantRole: (userId, role) => set((state) => ({
    participants: state.participants.map(p =>
      p.userId === userId ? { ...p, role } : p
    ),
    myRole: userId === get().getUserId?.() ? role : state.myRole,
    isHost: userId === get().getUserId?.() ? role === 'host' : state.isHost,
  })),

  // ─── RESET ───────────────────────────────────────────────
  resetRoom: () => set({
    currentRoom: null,
    participants: [],
    messages: [],
    isInRoom: false,
    isHost: false,
    myRole: 'listener',
    isMuted: true,
    isSpeaking: false,
    handRaised: false,
    error: null,
  }),

  // ─── HELPERS (set from outside) ──────────────────────────
  getUserId: null,
  setGetUserId: (fn) => set({ getUserId: fn }),
}));

export default useAudioRoomStore;