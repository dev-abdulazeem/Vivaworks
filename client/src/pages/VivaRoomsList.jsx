import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import AudioRoomCard from '../components/audio/AudioRoomCard';
import AudioRoomCreator from '../components/audio/AudioRoomCreator';
import useAudioRoomStore from '../stores/audioRoomStore';
import { Radio, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VivaRoomsList = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const { createModalOpen, setCreateModalOpen } = useAudioRoomStore();

  const fetchRooms = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/vivarooms/live');
      const newRooms = res.data.rooms || [];
      
      // Only update if data actually changed (prevents unnecessary re-renders)
      setRooms(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newRooms)) {
          return newRooms;
        }
        return prev;
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms(); // Initial load
    
    // Poll every 5 seconds for live updates
    const interval = setInterval(() => fetchRooms(true), 5000);
    
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={18} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Live VivaRooms
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </h1>
              <p className="text-sm text-gray-500">Join ongoing conversations</p>
            </div>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
          >
            <Plus size={18} />
            Start Room
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => (
              <AudioRoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Radio size={28} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-1">No live rooms</h3>
            <p className="text-sm text-gray-500">Start the first conversation!</p>
          </div>
        )}
      </div>

      {createModalOpen && (
        <AudioRoomCreator
          onClose={() => setCreateModalOpen(false)}
          onCreated={(room) => navigate(`/vivaroom/${room.id}`)}
        />
      )}
    </div>
  );
};

export default VivaRoomsList;