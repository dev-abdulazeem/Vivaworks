import React, { useState } from 'react';
import { X, Crown, Mic, MicOff, Volume2, VolumeX, ChevronUp, UserMinus, User } from 'lucide-react';

const roleHierarchy = { host: 0, co_host: 1, speaker: 2, listener: 3 };

const Avatar = ({ src, alt, className = '' }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError || !src) {
    return (
      <div className={`bg-emerald-100 flex items-center justify-center ${className}`}>
        <User size={className.includes('w-9') ? 16 : 14} className="text-emerald-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'User'}
      className={`object-cover ${className}`}
      onError={() => setImgError(true)}
    />
  );
};

const ParticipantList = ({ participants, isHost, myRole, onPromote, onMute, onClose }) => {
  const canManage = isHost || myRole === 'co_host';

  const sortedParticipants = [...participants].sort((a, b) => {
    const roleDiff = roleHierarchy[a.role] - roleHierarchy[b.role];
    if (roleDiff !== 0) return roleDiff;
    return new Date(a.joinedAt) - new Date(b.joinedAt);
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'host': return 'text-yellow-600';
      case 'co_host': return 'text-emerald-600';
      case 'speaker': return 'text-blue-600';
      default: return 'text-gray-400';
    }
  };

  const getRoleLabel = (role) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-800">
          Participants <span className="text-gray-400 font-normal">· {participants.length}</span>
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {sortedParticipants.map((participant) => {
          const isSelf = participant.userId === participant.user?.id;
          const canManageThis = canManage && participant.role !== 'host' && !isSelf;

          return (
            <div
              key={participant.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors border-b border-gray-100"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <Avatar
                  src={participant.user?.avatar}
                  alt={participant.user?.firstName}
                  className="w-9 h-9 rounded-full"
                />
                {participant.isSpeaking && (
                  <div className="absolute inset-0 rounded-full ring-2 ring-emerald-400 ring-offset-1 ring-offset-white" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {participant.user?.firstName} {participant.user?.lastName}
                  </p>
                  {participant.role === 'host' && (
                    <Crown size={12} className="text-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-medium ${getRoleColor(participant.role)}`}>
                    {getRoleLabel(participant.role)}
                  </span>
                  {participant.handRaised && (
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
                      ✋ Raised
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {/* Mute indicator */}
                {participant.isMuted ? (
                  <MicOff size={14} className="text-red-400" />
                ) : (
                  <Mic size={14} className="text-emerald-500" />
                )}

                {/* Management actions */}
                {canManageThis && (
                  <div className="flex items-center gap-1 ml-1">
                    {/* Promote to speaker */}
                    {participant.role === 'listener' && (
                      <button
                        onClick={() => onPromote(participant.id, 'speaker')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                        title="Promote to speaker"
                      >
                        <ChevronUp size={14} />
                      </button>
                    )}
                    {/* Demote to listener */}
                    {participant.role === 'speaker' && (
                      <button
                        onClick={() => onPromote(participant.id, 'listener')}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                        title="Demote to listener"
                      >
                        <UserMinus size={14} />
                      </button>
                    )}

                    {/* Mute/Unmute */}
                    <button
                      onClick={() => onMute(participant.id, !participant.isMuted)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                        participant.isMuted
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-500 hover:bg-red-100'
                      }`}
                      title={participant.isMuted ? 'Unmute' : 'Mute'}
                    >
                      {participant.isMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {participants.length === 0 && (
          <div className="text-center py-10">
            <User size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No participants yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantList;