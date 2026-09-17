import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Users, Mic, Lock, Globe, UserCheck, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const visibilityIcons = {
  public: Globe,
  followers_only: UserCheck,
  private: Lock,
};

const visibilityLabels = {
  public: 'Public',
  followers_only: 'Followers',
  private: 'Private',
};

const Avatar = ({ src, alt, className = '', ring = false }) => {
  const [imgError, setImgError] = useState(false);
  const isSmall = className.includes('w-7');

  if (imgError || !src) {
    return (
      <div
        className={`bg-emerald-100 flex items-center justify-center flex-shrink-0 ${
          ring ? 'ring-2 ring-emerald-500/40 ring-offset-2' : ''
        } ${className}`}
      >
        <User size={isSmall ? 12 : 14} className="text-emerald-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'User'}
      onError={() => setImgError(true)}
      className={`object-cover flex-shrink-0 ${
        ring ? 'ring-2 ring-emerald-500/40 ring-offset-2' : ''
      } ${className}`}
    />
  );
};

const AudioRoomCard = ({ room }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isHost = room.hostId === user?.id;

  const liveCount = room.participants?.filter((p) => !p.leftAt).length || 0;
  const speakerCount =
    room.participants?.filter(
      (p) =>
        !p.leftAt &&
        (p.role === 'host' || p.role === 'co_host' || p.role === 'speaker')
    ).length || 0;

  const activeSpeakers =
    room.participants
      ?.filter((p) => !p.leftAt && (p.role === 'host' || p.role === 'speaker'))
      .slice(0, 4) || [];

  const VisibilityIcon = visibilityIcons[room.visibility] || Globe;

  const handleJoin = () => {
    navigate(`/vivaroom/${room.id}`);
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_32px_-12px_rgba(16,185,129,0.25)]">
      {/* ── Header: Live badge · Visibility · Hosting tag ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-red-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            Live
          </span>
          <span className="flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-400">
            <VisibilityIcon size={11} />
            {visibilityLabels[room.visibility]}
          </span>
        </div>

        {isHost && (
          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Hosting
          </span>
        )}
      </div>

      {/* ── Title & description ── */}
      <h3 className="mb-1 text-[15px] font-semibold leading-snug text-gray-900 line-clamp-1">
        {room.title}
      </h3>

      {room.description && (
        <p className="mb-4 text-[13px] leading-relaxed text-gray-400 line-clamp-2">
          {room.description}
        </p>
      )}

      {/* ── Host ── */}
      <div className="mb-4 flex items-center gap-3">
        <Avatar
          src={room.host?.avatar}
          alt={room.host?.firstName}
          ring
          className="h-9 w-9 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-gray-800">
            {room.host?.firstName} {room.host?.lastName}
          </p>
          <p className="text-[11px] font-medium text-gray-400">Host</p>
        </div>
      </div>

      {/* ── Speakers ── */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50/80 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {activeSpeakers.map((p) => (
              <Avatar
                key={p.id}
                src={p.user?.avatar}
                alt={p.user?.firstName}
                className="h-7 w-7 rounded-full border-2 border-white"
              />
            ))}
            {speakerCount > 4 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-bold text-gray-500">
                +{speakerCount - 4}
              </div>
            )}
          </div>
          {speakerCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
              <Mic size={11} className="text-emerald-500" />
              {speakerCount} {speakerCount === 1 ? 'speaker' : 'speakers'}
            </span>
          )}
        </div>
      </div>

      {/* ── Footer: listeners + join ── */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3.5">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500">
          <Users size={14} className="text-gray-400" />
          <span>
            {liveCount} {liveCount === 1 ? 'listener' : 'listening'}
          </span>
        </div>

        <button
          onClick={handleJoin}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 hover:shadow-md active:scale-[0.97]"
        >
          <Radio size={14} />
          Join Room
        </button>
      </div>
    </div>
  );
};

export default AudioRoomCard;