import React, { useState } from 'react';
import { X, Mic, Globe, UserCheck, Lock } from 'lucide-react';
import { api } from '../../utils/api';
import useAudioRoomStore from '../../stores/audioRoomStore';
import { toast } from 'react-hot-toast';

const visibilityOptions = [
  { value: 'public', label: 'Public', icon: Globe, desc: 'Anyone can join' },
  { value: 'followers_only', label: 'Followers', icon: UserCheck, desc: 'Only your followers' },
  { value: 'private', label: 'Private', icon: Lock, desc: 'Invite only' },
];

const AudioRoomCreator = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      toast.error('Title must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/vivarooms', {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      toast.success('VivaRoom created!');
      onCreated?.(res.data.room);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Mic size={18} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Create VivaRoom</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Room Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the topic?"
              maxLength={100}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what you'll be discussing..."
              rows={3}
              maxLength={280}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/280</p>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Who can join?
            </label>
            <div className="space-y-2">
              {visibilityOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isSelected ? 'text-emerald-600' : 'text-gray-400'}
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-400">{option.desc}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-emerald-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Mic size={18} />
                Go Live
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AudioRoomCreator;