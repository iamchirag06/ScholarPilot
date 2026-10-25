import React from 'react';

interface BrushStrokeProps {
  color?: string; // e.g. '#1F5A45' or '#E8622C' or '#F8E4E0'
  side?: 'left' | 'right';
  className?: string;
  width?: number;
  height?: number;
}

export const BrushStroke: React.FC<BrushStrokeProps> = ({
  color = '#1F5A45',
  side = 'left',
  className = '',
  width = 240,
  height = 90,
}) => {
  const isLeft = side === 'left';

  return (
    <div
      className={`absolute pointer-events-none select-none z-0 opacity-80 overflow-hidden ${
        isLeft ? '-left-8' : '-right-8'
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 280 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isLeft ? '' : 'scale-x-[-1]'}
      >
        <path
          d="M0 25C30 20 70 12 110 15C160 18 210 32 255 24C270 21 280 29 275 42C270 55 248 68 220 74C175 84 125 76 80 88C45 97 18 102 0 105V25Z"
          fill={color}
          opacity="0.95"
        />
        {/* Secondary textured edge */}
        <path
          d="M0 45C40 38 90 40 140 48C190 56 240 60 260 52C250 68 210 75 160 76C110 77 60 84 0 92V45Z"
          fill={color}
          opacity="0.6"
        />
        <circle cx="265" cy="35" r="4" fill={color} opacity="0.7" />
        <circle cx="272" cy="48" r="2.5" fill={color} opacity="0.5" />
      </svg>
    </div>
  );
};
