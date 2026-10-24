import React from 'react';
import { SectionHeading } from '../components/ui/SectionHeading.tsx';
import { Button } from '../components/ui/Button.tsx';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { BrushStroke } from '../components/decorative/BrushStroke.tsx';
import { Scribble } from '../components/decorative/Scribble.tsx';
import {
  HeroStudentIllustration,
  BooksStackIllustration,
} from '../components/illustrations/Illustrations.tsx';
import { MOCK_SCHEMES, formatINR } from '../mockData.ts';
import {
  FileText,
  Search,
  Sparkles,
  Zap,
  ArrowUpRight,
  Star,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  onExploreMatches: () => void;
  onAutoFillDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStart,
  onExploreMatches,
  onAutoFillDemo,
}) => {
  const featuredSchemes = MOCK_SCHEMES.slice(0, 3);

  const testimonials = [
    {
      quote:
        'I almost gave up navigating the NSP portal with its confusing PDF criteria. ScholarPilot explained the eligibility in one line and I received ₹15,000 for my college fee!',
      name: 'Pooja Verma',
      college: 'Government College for Women, Rohtak',
      avatarBg: '#F6B7C1',
      rating: 5,
    },
    {
      quote:
        'The Auto-Fill form feels like pure wizardry. It took 30 seconds to populate 8 official portal fields that used to take 2 hours of copy-pasting certificates.',
      name: 'Aditya Rao',
      college: 'Delhi Technological University (DTU)',
      avatarBg: '#F3DE9A',
      rating: 5,
    },
    {
      quote:
        'As an SC student from a rural district, finding scholarships that applied specifically to me was overwhelming. ScholarPilot made the whole process warm and kind.',
      name: 'Kavita Kumari',
      college: 'Kurukshetra University',
      avatarBg: '#A9DCC3',
      rating: 5,
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 bg-[#FBF6EE]">
        {/* Left vertical rotated script tagline */}
        <div className="hidden lg:block absolute left-3 top-44 transform -rotate-90 origin-left text-xs font-script font-bold tracking-widest text-[#E8622C] opacity-80 select-none pointer-events-none">
          ✦ CRAFTED WITH CARE FOR INDIAN STUDENTS ✦
        </div>

        {/* Decorative brush bleeding off side */}
        <BrushStroke side="left" color="#1F5A45" className="top-12 opacity-30" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Hero Column */}
            <div className="lg:col-span-7 flex flex-col items-start z-10">
              {/* Orange small-caps eyebrow */}
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="font-sans text-xs font-bold tracking-widest text-[#E8622C] uppercase bg-[#F8E4E0] px-3 py-1 rounded-full border border-[#E8622C]/20">
                  HEY STUDENT 👋
                </span>
                <Scribble variant="sparkle" size={20} color="#E8622C" />
              </div>

              {/* Big Serif Headline with wobbly orange underline */}
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1A1A1A] leading-[1.12] mb-6">
                Find Scholarships That{' '}
                <span className="relative inline-block whitespace-nowrap">
                  <span>Feel Human.</span>
                  {/* Wobbly brush underline */}
                  <svg
                    className="absolute left-0 -bottom-3 w-full overflow-visible pointer-events-none"
                    viewBox="0 0 160 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 9.5C28.5 4.5 75 3 105 5.5C124 7.1 146 11 158 8C140 10.5 102 11.5 62 10C35 9 12 11 4 12.5"
                      stroke="#E8622C"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* Friendly paragraph */}
              <p className="text-lg sm:text-xl text-[#5E5A52] leading-relaxed max-w-xl mb-8">
                ScholarPilot searches government portals and private trusts so you don't have to, and explains dense legal guidelines in one plain, reassuring sentence.
              </p>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-4 mb-12">
                <Button
                  variant="primary"
                  size="lg"
                  showArrow
                  onClick={onStart}
                  className="shadow-md"
                >
                  Find My Scholarships
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={onExploreMatches}
                >
                  See How It Works
                </Button>
              </div>

              {/* Stats Row with thin dividers */}
              <div className="w-full pt-6 border-t border-[#E9E1D3] flex items-center justify-between sm:justify-start sm:gap-10 text-left">
                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] tabular-nums">
                    500+
                  </div>
                  <div className="text-xs text-[#5E5A52] font-medium tracking-wide">
                    Schemes Tracked
                  </div>
                </div>

                <div className="h-8 w-px bg-[#E9E1D3]" />

                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] tabular-nums">
                    12+
                  </div>
                  <div className="text-xs text-[#5E5A52] font-medium tracking-wide">
                    Govt & Trust Portals
                  </div>
                </div>

                <div className="h-8 w-px bg-[#E9E1D3]" />

                <div>
                  <div className="font-serif text-2xl sm:text-3xl font-extrabold text-[#1F5A45] tabular-nums">
                    ₹2,00,000
                  </div>
                  <div className="text-xs text-[#5E5A52] font-medium tracking-wide">
                    Max Grant Available
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Illustration + Floating Sticky Notes */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              {/* Main hand-inked illustration */}
              <div className="relative w-full max-w-[420px]">
                <HeroStudentIllustration className="w-full h-auto drop-shadow-sm" />

                {/* Floating Sticky Note 1: Progress over perfection */}
                <div className="absolute -top-6 -left-4 sm:-left-8 z-20 w-44 sm:w-48">
                  <StickyNote color="yellow" rotation={-4} tape author="Riya's desk">
                    Progress over perfection ☕
                  </StickyNote>
                </div>

                {/* Floating Sticky Note 2: Plain English rules */}
                <div className="absolute -bottom-6 -right-2 sm:-right-6 z-20 w-48 sm:w-52">
                  <StickyNote color="pink" rotation={3} tape author="ScholarPilot AI">
                    No more 40-page PDFs. Just 1 simple sentence!
                  </StickyNote>
                </div>

                {/* Decorative scribble spark */}
                <div className="absolute top-2 right-4 pointer-events-none">
                  <Scribble variant="sparkle" size={28} color="#E8622C" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS (Styled like "What I Do" section) */}
      <section className="py-20 bg-[#FBF6EE] relative border-t border-[#E9E1D3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="A kinder approach"
            title="How ScholarPilot Works"
            underlineWord="Works"
            subtitle="Four intentional steps designed to remove stress, paperwork confusion, and missed deadlines."
            align="center"
            className="mb-16 text-center"
            sparkle
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="paper-card paper-card-interactive p-6 flex flex-col items-start relative">
              <div className="w-12 h-12 rounded-2xl bg-[#F6B7C1] flex items-center justify-center mb-5 border border-[#1A1A1A]/10 transform -rotate-3">
                <FileText className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              <span className="font-script text-base text-[#E8622C] font-bold mb-1">
                Step 01
              </span>
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mb-2">
                Tell us about you
              </h3>
              <p className="text-sm text-[#5E5A52] leading-relaxed">
                Enter your state, education level, marks percentage and category once in 90 seconds. We keep it completely private.
              </p>
            </div>

            {/* Step 2 */}
            <div className="paper-card paper-card-interactive p-6 flex flex-col items-start relative">
              <div className="w-12 h-12 rounded-2xl bg-[#F3DE9A] flex items-center justify-center mb-5 border border-[#1A1A1A]/10 transform rotate-2">
                <Search className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              <span className="font-script text-base text-[#E8622C] font-bold mb-1">
                Step 02
              </span>
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mb-2">
                We crawl portals
              </h3>
              <p className="text-sm text-[#5E5A52] leading-relaxed">
                TinyFish crawler checks NSP, Haryana Har-Chhatravratti, Delhi e-District, and private foundations simultaneously.
              </p>
            </div>

            {/* Step 3 */}
            <div className="paper-card paper-card-interactive p-6 flex flex-col items-start relative">
              <div className="w-12 h-12 rounded-2xl bg-[#A9DCC3] flex items-center justify-center mb-5 border border-[#1A1A1A]/10 transform -rotate-2">
                <Sparkles className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              <span className="font-script text-base text-[#E8622C] font-bold mb-1">
                Step 03
              </span>
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mb-2">
                AI explains simply
              </h3>
              <p className="text-sm text-[#5E5A52] leading-relaxed">
                Deepak AI converts pages of government legalese and clauses into one plain-English sentence you can understand instantly.
              </p>
            </div>

            {/* Step 4 */}
            <div className="paper-card paper-card-interactive p-6 flex flex-col items-start relative">
              <div className="w-12 h-12 rounded-2xl bg-[#F9C6A5] flex items-center justify-center mb-5 border border-[#1A1A1A]/10 transform rotate-3">
                <Zap className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              <span className="font-script text-base text-[#E8622C] font-bold mb-1">
                Step 04
              </span>
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mb-2">
                Apply with auto-fill
              </h3>
              <p className="text-sm text-[#5E5A52] leading-relaxed">
                Watch our magical typewriter populator fill out official portal forms field-by-field, complete with document status ticks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BLUSH BAND: FEATURED SCHOLARSHIPS ("Projects I'm Proud Of" layout) */}
      <section className="py-20 bg-[#F8E4E0] relative border-y border-[#E9E1D3]">
        <BrushStroke side="right" color="#E8622C" className="top-10 opacity-20" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <SectionHeading
              eyebrow="Curated Opportunities"
              title="Featured Scholarships"
              underlineWord="Scholarships"
              subtitle="High-impact grants actively open for Indian undergraduate, school, and professional students."
            />
            <Button
              variant="secondary"
              size="md"
              showArrow
              onClick={onExploreMatches}
              className="bg-[#FFFDF8]"
            >
              View All 5 Schemes
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredSchemes.map((scheme, idx) => (
              <div
                key={scheme.id}
                className="paper-card paper-card-interactive p-6 flex flex-col justify-between"
              >
                <div>
                  {/* Category Tag & Rank Pill */}
                  <div className="flex items-center justify-between mb-3 text-xs text-[#5E5A52]">
                    <span className="font-semibold text-[#E8622C] uppercase tracking-wider">
                      {scheme.source_portal}
                    </span>
                    <span className="font-script text-sm font-bold text-[#1F5A45]">
                      {scheme.rank_score}% Match Score
                    </span>
                  </div>

                  <h3 className="font-serif text-xl font-bold text-[#1A1A1A] mb-2 leading-snug">
                    {scheme.scheme_name}
                  </h3>

                  <div className="text-2xl font-bold text-[#1F5A45] font-serif mb-3">
                    {formatINR(scheme.award_amount)}
                  </div>

                  <p className="text-sm text-[#5E5A52] leading-relaxed mb-6 font-medium">
                    "{scheme.llm_summary}"
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E9E1D3] flex items-center justify-between">
                  <span className="text-xs text-[#5E5A52]">
                    Deadline: <span className="font-semibold text-[#1A1A1A]">{scheme.deadline}</span>
                  </span>
                  <button
                    onClick={onStart}
                    className="w-9 h-9 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center hover:bg-[#E8622C] transition-colors cursor-pointer"
                    title="View Scholarship"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. DARK GREEN "KIND WORDS" BAND WITH TORN EDGES & TESTIMONIALS */}
      <section className="bg-[#1F5A45] text-white py-24 relative overflow-hidden torn-divider-top torn-divider-bottom">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-script text-2xl text-[#F9C6A5] font-bold block mb-2 transform -rotate-1">
              Kind Words From Fellows ✦
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Real Students, Real Awards
            </h2>
            <p className="mt-4 text-base text-[#A9DCC3] leading-relaxed">
              Scholarships shouldn't require hiring an agent or getting lost in government PDF portals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="bg-[#FFFDF8] text-[#1A1A1A] rounded-2xl p-6 sm:p-7 shadow-lg border border-[#E9E1D3] flex flex-col justify-between"
              >
                <div>
                  {/* Rating Stars */}
                  <div className="flex items-center gap-1 mb-4 text-[#E8622C]">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>

                  <p className="text-sm sm:text-base text-[#1A1A1A] leading-relaxed mb-6 italic font-serif">
                    "{t.quote}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-[#E9E1D3]">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-sm text-[#1A1A1A] border border-[#1A1A1A]/10"
                    style={{ backgroundColor: t.avatarBg }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1A1A1A]">{t.name}</div>
                    <div className="text-xs text-[#5E5A52]">{t.college}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. CTA SECTION: "Let's Find Something Meaningful For You" */}
      <section className="py-20 md:py-28 bg-[#FBF6EE] relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <BooksStackIllustration className="w-48 sm:w-56 h-auto" />
          </div>

          <span className="font-script text-2xl sm:text-3xl text-[#E8622C] font-bold block mb-2 transform -rotate-1">
            Your education belongs to you
          </span>

          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-4 tracking-tight leading-tight">
            Let's Find Something Meaningful for You.
          </h2>

          <p className="text-base sm:text-lg text-[#5E5A52] max-w-xl mx-auto mb-8 leading-relaxed">
            Fill your academic and financial profile in under 2 minutes. We'll crawl 12+ government and private trust portals immediately.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              showArrow
              onClick={onStart}
            >
              Get Started with Profile
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={onAutoFillDemo}
            >
              Try Auto-Fill Demo ✨
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
