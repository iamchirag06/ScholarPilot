import React from 'react';

interface HandUnderlineProps {
  color?: string; // e.g. '#E8622C' (orange) or '#F6B7C1' (pink) or '#1F5A45'
  className?: string;
  strokeWidth?: number;
}

export const HandUnderline: React.FC<HandUnderlineProps> = ({
  color = '#E8622C',
  className = '',
  strokeWidth = 4,
}) => {
  return (
    <svg
      className={`absolute left-0 -bottom-2.5 w-full overflow-visible pointer-events-none ${className}`}
      viewBox="0 0 160 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M2 9.5C28.5 4.5 75 3 105 5.5C124 7.1 146 11 158 8C140 10.5 102 11.5 62 10C35 9 12 11 4 12.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
