import React from 'react';
import { HandUnderline } from '../decorative/HandUnderline.tsx';
import { Scribble } from '../decorative/Scribble.tsx';

interface SectionHeadingProps {
  eyebrow?: string;
  eyebrowStyle?: 'script' | 'tracked';
  title: string;
  underlineWord?: string;
  underlineColor?: string;
  subtitle?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  sparkle?: boolean;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  eyebrowStyle = 'script',
  title,
  underlineWord,
  underlineColor = '#E8622C',
  subtitle,
  align = 'left',
  className = '',
  sparkle = false,
}) => {
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center mx-auto',
    right: 'text-right items-end ml-auto',
  };

  // Render title with wobbly underline on target word if specified
  const renderTitle = () => {
    if (!underlineWord || !title.includes(underlineWord)) {
      return title;
    }

    const parts = title.split(underlineWord);
    return (
      <>
        {parts[0]}
        <span className="relative inline-block whitespace-nowrap">
          <span>{underlineWord}</span>
          <HandUnderline color={underlineColor} />
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <div className={`flex flex-col ${alignmentClasses[align]} ${className}`}>
      {eyebrow && (
        <div className="flex items-center gap-2 mb-2">
          {eyebrowStyle === 'script' ? (
            <span className="font-script text-xl sm:text-2xl text-[#E8622C] font-bold transform -rotate-1 tracking-wide">
              {eyebrow}
            </span>
          ) : (
            <span className="text-xs font-bold tracking-widest text-[#E8622C] uppercase font-sans">
              {eyebrow}
            </span>
          )}
          {sparkle && <Scribble variant="sparkle" size={20} color="#E8622C" />}
        </div>
      )}

      <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1A1A1A] leading-[1.15] text-balance">
        {renderTitle()}
      </h2>

      {subtitle && (
        <p className="mt-3 text-base sm:text-lg text-[#5E5A52] max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};
