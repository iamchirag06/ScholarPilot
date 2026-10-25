import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  color?: 'forest' | 'orange' | 'mint';
  height?: number;
  showPercent?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  color = 'forest',
  height = 6,
  showPercent = true,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  const colorMap = {
    forest: 'bg-[#1F5A45]',
    orange: 'bg-[#E8622C]',
    mint: 'bg-[#2F8F6B]',
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium text-[#5E5A52]">
          <span>{label}</span>
          {showPercent && <span className="tabular-nums font-semibold text-[#1A1A1A]">{clamped}%</span>}
        </div>
      )}
      <div
        className="w-full bg-[#E9E1D3]/70 rounded-full overflow-hidden p-[1px]"
        style={{ height: `${height}px` }}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${colorMap[color]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
