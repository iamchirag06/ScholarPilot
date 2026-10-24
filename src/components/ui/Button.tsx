import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'forest';
  size?: 'sm' | 'md' | 'lg';
  showArrow?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  showArrow = false,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3.5 gap-1.5',
    md: 'text-sm py-2.5 px-5 gap-2',
    lg: 'text-base py-3 px-6 gap-2.5',
  };

  const variantClasses = {
    // Primary: solid ink black, white text, 8px radius or pill, trailing arrow nudges on hover
    primary:
      'bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] shadow-sm hover:shadow active:scale-[0.98] transition-all duration-150 rounded-lg group font-medium',
    // Secondary: transparent with a 1.5px ink outline
    secondary:
      'bg-transparent text-[#1A1A1A] border-[1.5px] border-[#1A1A1A] hover:bg-[#1A1A1A]/5 active:scale-[0.98] transition-all duration-150 rounded-lg group font-medium',
    // Tertiary link: small text with orange underline styling
    tertiary:
      'bg-transparent text-[#1A1A1A] hover:text-[#E8622C] p-0 font-medium group transition-colors inline-flex items-center',
    ghost:
      'bg-transparent text-[#5E5A52] hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 rounded-lg transition-colors font-medium',
    forest:
      'bg-[#1F5A45] text-white hover:bg-[#174635] shadow-sm hover:shadow active:scale-[0.98] transition-all duration-150 rounded-lg group font-medium',
  };

  const arrow = (showArrow || variant === 'primary') ? (
    <ArrowRight
      className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 ${
        variant === 'tertiary' ? 'text-[#E8622C]' : ''
      }`}
    />
  ) : null;

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
      {...props}
    >
      <span>{children}</span>
      {arrow}
    </button>
  );
};
