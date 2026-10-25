import React from 'react';

type ScribbleVariant = 'sparkle' | 'tick' | 'squiggle' | 'loop' | 'arrow' | 'burst';

interface ScribbleProps {
  variant?: ScribbleVariant;
  color?: string;
  size?: number;
  className?: string;
}

export const Scribble: React.FC<ScribbleProps> = ({
  variant = 'sparkle',
  color = '#E8622C',
  size = 24,
  className = '',
}) => {
  switch (variant) {
    case 'sparkle':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`inline-block ${className}`}
          aria-hidden="true"
        >
          <path
            d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'burst':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`inline-block ${className}`}
          aria-hidden="true"
        >
          <path d="M14 2V6M14 22V26M2 14H6M22 14H26M5.5 5.5L8.5 8.5M19.5 19.5L22.5 22.5M5.5 22.5L8.5 19.5M19.5 8.5L22.5 5.5"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'tick':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`inline-block ${className}`}
          aria-hidden="true"
        >
          <path
            d="M4 13.5L9.5 18.5C11 15 16.5 7 21 5"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'squiggle':
      return (
        <svg
          width={size * 1.8}
          height={size * 0.8}
          viewBox="0 0 48 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`inline-block ${className}`}
          aria-hidden="true"
        >
          <path
            d="M3 10C8 4 14 14 19 8C24 3 30 15 35 9C39 4 43 11 46 8"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'loop':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`inline-block ${className}`}
          aria-hidden="true"
        >
          <path
            d="M6 22C12 25 22 24 24 16C26 8 16 6 11 11C6 16 12 23 20 25"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'arrow':
      return (
        <svg
          width={size * 1.5}
          height={size}
          viewBox="0 0 40 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`inline-block ${className}`}
          aria-hidden="true"
        >
          <path
            d="M3 14C12 8 26 10 35 12M35 12L28 6M35 12L29 18"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
};
