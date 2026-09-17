import React from 'react';

const AudioWave = ({ isActive = false, color = 'emerald', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-3 gap-0.5',
    md: 'h-4 gap-0.5',
    lg: 'h-6 gap-1',
    xl: 'h-8 gap-1',
  };

  const barHeights = {
    sm: ['h-1', 'h-2', 'h-1.5', 'h-2.5', 'h-1'],
    md: ['h-1.5', 'h-3', 'h-2', 'h-3.5', 'h-1.5'],
    lg: ['h-2', 'h-4', 'h-3', 'h-5', 'h-2'],
    xl: ['h-3', 'h-6', 'h-4', 'h-7', 'h-3'],
  };

  const colorClasses = {
    emerald: isActive ? 'bg-emerald-400' : 'bg-emerald-400/30',
    white: isActive ? 'bg-white' : 'bg-white/30',
    gray: isActive ? 'bg-gray-400' : 'bg-gray-400/30',
  };

  const bars = [0, 1, 2, 3, 4];

  return (
    <div className={`flex items-end ${sizeClasses[size]}`}>
      {bars.map((i) => (
        <div
          key={i}
          className={`w-0.5 rounded-full transition-all duration-150 ${
            barHeights[size][i]
          } ${colorClasses[color]} ${
            isActive ? 'animate-pulse' : ''
          }`}
          style={{
            animationDelay: `${i * 120}ms`,
            animationDuration: '600ms',
          }}
        />
      ))}
    </div>
  );
};

// Compact inline version for cards/lists
export const AudioWaveDot = ({ isActive = false, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={`inline-block rounded-full ${
        sizeClasses[size]
      } ${
        isActive
          ? 'bg-emerald-400 animate-pulse'
          : 'bg-gray-400'
      }`}
    />
  );
};

export default AudioWave;