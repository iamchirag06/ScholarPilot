import React from 'react';

interface IllustrationProps {
  className?: string;
  alt?: string;
}

export const HeroStudentIllustration: React.FC<IllustrationProps> = ({
  className = 'w-full max-w-[440px] h-auto',
  alt = 'ScholarPilot student at work desk with laptop, sleeping cat, books and tea',
}) => {
  return (
    <img
      src="/illustrations/hero-student.svg"
      alt={alt}
      className={`select-none transition-transform duration-300 hover:scale-[1.01] ${className}`}
      loading="eager"
    />
  );
};

export const StudentWithMugIllustration: React.FC<IllustrationProps> = ({
  className = 'w-36 h-auto',
  alt = 'Student smiling with a warm cup of chai',
}) => {
  return (
    <img
      src="/illustrations/student-with-mug.svg"
      alt={alt}
      className={`select-none ${className}`}
      loading="lazy"
    />
  );
};

export const BooksStackIllustration: React.FC<IllustrationProps> = ({
  className = 'w-48 sm:w-56 h-auto',
  alt = 'Stack of books titled Study Better, Dream Brighter, Apply Together',
}) => {
  return (
    <img
      src="/illustrations/books-stack.svg"
      alt={alt}
      className={`select-none transition-transform duration-300 hover:scale-105 ${className}`}
      loading="lazy"
    />
  );
};

export const CatIllustration: React.FC<IllustrationProps> = ({
  className = 'w-28 sm:w-36 h-auto',
  alt = 'Sleeping study cat with floating zzz',
}) => {
  return (
    <img
      src="/illustrations/cat.svg"
      alt={alt}
      className={`select-none animate-soft-float ${className}`}
      loading="lazy"
    />
  );
};

export const MugIllustration: React.FC<IllustrationProps> = ({
  className = 'w-16 h-16',
  alt = 'Warm steaming chai mug',
}) => {
  return (
    <img
      src="/illustrations/mug.svg"
      alt={alt}
      className={`select-none ${className}`}
      loading="lazy"
    />
  );
};

export const PlantLeftIllustration: React.FC<IllustrationProps> = ({
  className = 'w-24 h-auto',
  alt = 'Potted green study plant',
}) => {
  return (
    <img
      src="/illustrations/plant-left.svg"
      alt={alt}
      className={`select-none ${className}`}
      loading="lazy"
    />
  );
};

export const PlantRightIllustration: React.FC<IllustrationProps> = ({
  className = 'w-24 h-auto',
  alt = 'Potted green desk plant',
}) => {
  return (
    <img
      src="/illustrations/plant-right.svg"
      alt={alt}
      className={`select-none ${className}`}
      loading="lazy"
    />
  );
};
