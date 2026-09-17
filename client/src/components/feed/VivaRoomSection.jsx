import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, X, Plus, Users, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { api } from '../../utils/api'
import { useAuthStore } from '../../stores/authStore'
import AudioRoomCard from '../audio/AudioRoomCard'
import AudioRoomCreator from '../audio/AudioRoomCreator'
import useAudioRoomStore from '../../stores/audioRoomStore'

const VivaRoomSection = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createModalOpen, setCreateModalOpen } = useAudioRoomStore()
  const [showModal, setShowModal] = useState(false)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (showModal) {
      fetchRooms()
    }
  }, [showModal])

  const fetchRooms = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.get('/vivarooms/live')
      setRooms(res.data.rooms || [])
    } catch (err) {
      console.error('Failed to fetch rooms:', err)
      setError(err.response?.data?.message || 'Failed to load rooms')
      setRooms([])
    } finally {
      setLoading(false)
    }
  }

  const handleRoomCreated = (room) => {
    setRooms((prev) => [room, ...prev])
    setShowModal(false)
    navigate(`/vivaroom/${room.id}`)
  }

  const handleJoinRoom = (room) => {
    setShowModal(false)
    navigate(`/vivaroom/${room.id}`)
  }

  return (
    <>
      {/* ─── FLOATING MICROPHONE BUTTON ─────────────────────────────── */}
      <div className="sticky top-20 z-20 mx-4 mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-full hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          {/* Microphone with pulse animation */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            <div className="relative w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
              <Mic className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-emerald-900">Live VivaRooms</p>
            <p className="text-xs text-emerald-500">Join or create a room</p>
          </div>

          {/* Arrow indicator */}
          <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </button>
      </div>

      {/* ─── ROOMS MODAL ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* ─── HEADER ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-emerald-900">Live VivaRooms</h2>
                  <p className="text-xs text-emerald-500">Connect and converse in real-time</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-white/50 transition-colors text-emerald-400 hover:text-emerald-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ─── CONTENT ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  <p className="text-sm text-emerald-600">Loading rooms...</p>
                </div>
              ) : error ? (
                <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">{error}</p>
                    <button
                      onClick={fetchRooms}
                      className="text-xs text-red-600 hover:text-red-800 mt-2 font-medium"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : rooms.length > 0 ? (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {rooms.map((room) => (
                      <div
                        key={room.id}
                        className="border border-emerald-100 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all bg-white group cursor-pointer"
                        onClick={() => handleJoinRoom(room)}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-emerald-900 truncate line-clamp-1">
                                {room.title}
                              </h3>
                              {room.isLive && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded-full flex-shrink-0">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                  <span className="text-[10px] font-semibold text-red-700">LIVE</span>
                                </div>
                              )}
                            </div>
                            {room.description && (
                              <p className="text-xs text-emerald-500 truncate line-clamp-1">
                                {room.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleJoinRoom(room)
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0 whitespace-nowrap"
                          >
                            Join
                          </button>
                        </div>

                        {/* Room stats */}
                        <div className="flex items-center gap-3 text-xs text-emerald-500">
                          <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>{room.participantCount || room.listeners || 0} listening</span>
                          </div>
                          {room.host && (
                            <>
                              <span className="text-emerald-300">·</span>
                              <span>hosted by {room.host?.firstName || 'Host'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 px-6">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                    <Mic className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-emerald-900 text-center">No active rooms</p>
                  <p className="text-xs text-emerald-500 text-center mt-1">Be the first to start a conversation</p>
                </div>
              )}
            </div>

            {/* ─── FOOTER ────────────────────────────────────────────── */}
            {user && (
              <div className="px-6 py-4 border-t border-emerald-100 bg-white">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setCreateModalOpen(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Start a VivaRoom
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── CREATE MODAL ──────────────────────────────────────────── */}
      {createModalOpen && (
        <AudioRoomCreator
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleRoomCreated}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.7;
          }
        }
      `}</style>
    </>
  )
}

export default VivaRoomSection