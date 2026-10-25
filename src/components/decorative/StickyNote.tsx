import React from 'react';

export type StickyColor = 'yellow' | 'pink' | 'mint' | 'peach';

interface StickyNoteProps {
  children: React.ReactNode;
  color?: StickyColor;
  rotation?: number; // degrees, e.g. -3 to 3
  tape?: boolean;
  pin?: boolean;
  className?: string;
  author?: string;
}

const colorMap: Record<StickyColor, { bg: string; border: string; tape: string }> = {
  yellow: {
    bg: '#FDF7C3',
    border: '#E8DE94',
    tape: 'rgba(255, 255, 255, 0.65)',
  },
  pink: {
    bg: '#FDE2E8',
    border: '#F2B9C8',
    tape: 'rgba(255, 255, 255, 0.65)',
  },
  mint: {
    bg: '#DCF5E8',
    border: '#B6E5CB',
    tape: 'rgba(255, 255, 255, 0.65)',
  },
  peach: {
    bg: '#FEE5D4',
    border: '#F5C4A6',
    tape: 'rgba(255, 255, 255, 0.65)',
  },
};

export const StickyNote: React.FC<StickyNoteProps> = ({
  children,
  color = 'yellow',
  rotation = -2,
  tape = true,
  pin = false,
  className = '',
  author,
}) => {
  const theme = colorMap[color] || colorMap.yellow;

  return (
    <div
      style={{
        transform: `rotate(${rotation}deg)`,
        backgroundColor: theme.bg,
        borderColor: theme.border,
      }}
      className={`relative p-3.5 sm:p-4 rounded-sm border shadow-sm transition-transform duration-200 hover:rotate-0 hover:scale-[1.02] select-none ${className}`}
    >
      {/* Tape strip on top */}
      {tape && !pin && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 sm:w-16 h-5 border border-black/5 rounded-xs pointer-events-none"
          style={{
            backgroundColor: theme.tape,
            backdropFilter: 'blur(2px)',
            transform: 'rotate(-1deg)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        />
      )}

      {/* Pushpin alternative */}
      {pin && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#E8622C] border-2 border-white shadow-sm flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white" />
        </div>
      )}

      {/* Handwritten text content */}
      <div className="font-script text-base sm:text-lg text-[#1A1A1A] leading-tight pt-1 font-semibold">
        {children}
      </div>

      {author && (
        <div className="font-script text-xs sm:text-sm text-[#E8622C] text-right mt-1 font-bold">
          — {author}
        </div>
      )}
    </div>
  );
};
