import React, { useState, useEffect } from 'react';
import { Profile, Category, CourseLevel, Gender } from '../types/index.ts';
import { INDIAN_STATES, formatINRWords } from '../mockData.ts';
import { Button } from '../components/ui/Button.tsx';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { Scribble } from '../components/decorative/Scribble.tsx';
import { CatIllustration } from '../components/illustrations/Illustrations.tsx';
import { Check, ArrowLeft, ArrowRight, Sparkles, User, GraduationCap, IndianRupee } from 'lucide-react';

interface ProfilePageProps {
  initialProfile: Profile;
  onSaveAndStartCrawl: (profile: Profile) => void;
  isEditMode?: boolean;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  initialProfile,
  onSaveAndStartCrawl,
  isEditMode = false,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  // Step Tips
  const stepTips: Record<number, { text: string; color: 'yellow' | 'pink' | 'mint' | 'peach' }> = {
    1: {
      text: 'State domicile opens state-exclusive welfare quotas, like Haryana Har-Chhatravratti!',
      color: 'yellow',
    },
    2: {
      text: 'Merit cutoffs differ by stream. NSP requires top 20% board ranks.',
      color: 'mint',
    },
    3: {
      text: 'We never share your income details with third parties. Used strictly for threshold matching.',
      color: 'pink',
    },
    4: {
      text: 'Looking sharp! Click below to trigger the crawler across 12 portals.',
      color: 'peach',
    },
  };

  const validateStep = (currentStep: number): boolean => {
    const errs: Record<string, string> = {};

    if (currentStep === 1) {
      if (!profile.full_name.trim()) errs.full_name = 'Please provide your full name';
      if (!profile.state) errs.state = 'Please select your state/UT';
      if (!profile.gender) errs.gender = 'Please select your gender';
    } else if (currentStep === 2) {
      if (!profile.course_level) errs.course_level = 'Please select your course level';
      if (
        profile.marks_percentage === undefined ||
        profile.marks_percentage < 0 ||
        profile.marks_percentage > 100
      ) {
        errs.marks_percentage = 'Marks must be between 0% and 100%';
      }
    } else if (currentStep === 3) {
      if (!profile.category) errs.category = 'Please select your category';
      if (profile.annual_income === undefined || profile.annual_income < 0) {
        errs.annual_income = 'Please enter a valid family income';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => (Math.min(4, prev + 1) as any));
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => (Math.max(1, prev - 1) as any));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      handleNext();
    } else {
      onSaveAndStartCrawl(profile);
    }
  };

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Title & Eyebrow */}
      <div className="text-center mb-8">
        <span className="font-script text-2xl text-[#E8622C] font-bold block mb-1">
          {isEditMode ? 'Update Your Scholar Profile' : 'Step Into Your Journey'}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] tracking-tight">
          {step === 4 ? 'Review & Launch Search' : 'Tell Us About You'}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#5E5A52]">
          Our matching engine filters through 500+ government and trust criteria for your exact profile.
        </p>
      </div>

      {/* Stepper: Hand-drawn dots joined by a wobbly line */}
      <div className="max-w-md mx-auto mb-10 relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-6 right-6 h-1 bg-[#E9E1D3] -z-0">
          <div
            className="h-full bg-[#1F5A45] transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between relative z-10">
          {[
            { num: 1, label: 'Personal' },
            { num: 2, label: 'Academic' },
            { num: 3, label: 'Financial' },
            { num: 4, label: 'Review' },
          ].map((item) => {
            const isCompleted = step > item.num;
            const isCurrent = step === item.num;

            return (
              <div key={item.num} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (item.num < step) setStep(item.num as any);
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? 'bg-[#1F5A45] text-white'
                      : isCurrent
                      ? 'bg-[#E8622C] text-white ring-4 ring-[#E8622C]/20 scale-110'
                      : 'bg-[#FFFDF8] text-[#5E5A52] border border-[#E9E1D3]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : item.num}
                </button>
                <span
                  className={`mt-1.5 text-xs font-semibold ${
                    isCurrent ? 'text-[#E8622C]' : 'text-[#5E5A52]'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Form Card + Sticky Note Tip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Card */}
        <div className="lg:col-span-8 paper-card p-6 sm:p-10 relative">
          <form onSubmit={handleSubmit} noValidate>
            {/* STEP 1: PERSONAL */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-[#E9E1D3]">
                  <User className="w-5 h-5 text-[#1F5A45]" />
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                    Personal Information
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                    placeholder="e.g. Riya Sharma"
                    className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-base focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">{errors.full_name}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                      Gender
                    </label>
                    <select
                      value={profile.gender}
                      onChange={(e) =>
                        setProfile({ ...profile, gender: e.target.value as Gender })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-base focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all"
                    >
                      <option value="FEMALE">Female</option>
                      <option value="MALE">Male</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                      Domicile / Home State
                    </label>
                    <select
                      value={profile.state}
                      onChange={(e) =>
                        setProfile({ ...profile, state: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-base focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    {errors.state && (
                      <p className="mt-1 text-xs text-[#D64545] font-medium">{errors.state}</p>
                    )}
                  </div>
                </div>

                {/* Disability Toggle */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 p-3.5 rounded-lg border border-[#E9E1D3] bg-[#FBF6EE]/60 cursor-pointer hover:bg-[#FBF6EE]">
                    <input
                      type="checkbox"
                      checked={profile.is_disabled}
                      onChange={(e) =>
                        setProfile({ ...profile, is_disabled: e.target.checked })
                      }
                      className="w-5 h-5 rounded text-[#1F5A45] focus:ring-[#1F5A45] accent-[#1F5A45] cursor-pointer"
                    />
                    <div>
                      <span className="text-sm font-bold text-[#1A1A1A] block">
                        Person with Benchmark Disability (PwD)
                      </span>
                      <span className="text-xs text-[#5E5A52]">
                        Unlocks special reservation quotas and assistive technology equipment allowances
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 2: ACADEMIC */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-[#E9E1D3]">
                  <GraduationCap className="w-5 h-5 text-[#1F5A45]" />
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                    Academic Status
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                    Current Course Level
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(
                      [
                        { id: 'CLASS_10', label: 'Class 10' },
                        { id: 'CLASS_12', label: 'Class 12' },
                        { id: 'UG', label: 'Undergraduate (UG)' },
                        { id: 'PG', label: 'Postgraduate (PG)' },
                        { id: 'PHD', label: 'PhD / Research' },
                      ] as const
                    ).map((lvl) => {
                      const isSelected = profile.course_level === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() =>
                            setProfile({ ...profile, course_level: lvl.id as CourseLevel })
                          }
                          className={`p-3 rounded-lg border text-sm font-semibold text-left transition-all ${
                            isSelected
                              ? 'bg-[#1F5A45] text-white border-[#1F5A45] shadow-xs'
                              : 'bg-[#FBF6EE] text-[#1A1A1A] border-[#E9E1D3] hover:border-[#1F5A45]'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5E5A52]">
                      Previous Exam Marks (%)
                    </label>
                    <span className="font-serif text-lg font-bold text-[#1F5A45] tabular-nums">
                      {profile.marks_percentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="100"
                    step="0.5"
                    value={profile.marks_percentage}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        marks_percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-[#E8622C] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#5E5A52] font-semibold mt-1">
                    <span>35% (Pass)</span>
                    <span>60% (First Class)</span>
                    <span>75% (Distinction)</span>
                    <span>100%</span>
                  </div>
                  {errors.marks_percentage && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">
                      {errors.marks_percentage}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: FINANCIAL & CATEGORY */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-[#E9E1D3]">
                  <IndianRupee className="w-5 h-5 text-[#1F5A45]" />
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                    Financial & Social Category
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                    Social Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as Category[]).map((cat) => {
                      const isSelected = profile.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setProfile({ ...profile, category: cat })}
                          className={`py-3 px-2 rounded-lg border text-sm font-bold transition-all text-center ${
                            isSelected
                              ? 'bg-[#E8622C] text-white border-[#E8622C] shadow-xs'
                              : 'bg-[#FBF6EE] text-[#1A1A1A] border-[#E9E1D3] hover:border-[#E8622C]'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                    Annual Family Income (INR)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={profile.annual_income}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        annual_income: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-lg font-serif font-bold focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all"
                  />
                  {/* Live ₹ Preview in Indian words */}
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#1F5A45] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#2F8F6B]" />
                    <span>Formatted: {formatINRWords(profile.annual_income)}</span>
                  </div>
                  {errors.annual_income && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">
                      {errors.annual_income}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW SUMMARY */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-3 border-b border-[#E9E1D3]">
                  <Sparkles className="w-5 h-5 text-[#E8622C]" />
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                    Review Your Profile Summary
                  </h2>
                </div>

                <div className="bg-[#FBF6EE] rounded-xl p-5 border border-[#E9E1D3] space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Full Name
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {profile.full_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        State Domicile
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {profile.state}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Course Level
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {profile.course_level}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Marks Percentage
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1F5A45]">
                        {profile.marks_percentage}%
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Category
                      </span>
                      <span className="font-serif text-lg font-bold text-[#E8622C]">
                        {profile.category}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Annual Income
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {formatINRWords(profile.annual_income)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#EDF8F3] border border-[#2F8F6B]/30 text-xs text-[#1F5A45] font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2F8F6B] shrink-0" />
                  <span>
                    Ready! TinyFish worker and AI summarizer will rank the best matched schemes immediately.
                  </span>
                </div>
              </div>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="pt-8 mt-6 border-t border-[#E9E1D3] flex items-center justify-between">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleBack}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </span>
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNext}
                  showArrow
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  showArrow
                  className="bg-[#1A1A1A] text-white shadow-md"
                >
                  Find Scholarships
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Dynamic Sticky Note Tip + Cat Illustration */}
        <div className="lg:col-span-4 flex flex-col items-center gap-6">
          <div className="w-full">
            <StickyNote
              color={stepTips[step].color}
              rotation={step % 2 === 0 ? 3 : -3}
              tape
              author="ScholarPilot Advisor"
            >
              {stepTips[step].text}
            </StickyNote>
          </div>

          {/* Quick preset button for demo convenience */}
          <div className="w-full p-4 rounded-xl bg-[#FFFDF8] border border-[#E9E1D3] text-center shadow-xs">
            <span className="font-script text-base text-[#E8622C] font-bold block mb-1">
              Demo Persona Shortcut
            </span>
            <p className="text-xs text-[#5E5A52] mb-3">
              Load official test persona: Riya (SC, Haryana, UG, ₹2 Lakh income).
            </p>
            <button
              type="button"
              onClick={() => {
                setProfile({
                  user_id: 'usr-riya-2026',
                  full_name: 'Riya',
                  category: 'SC',
                  annual_income: 200000,
                  state: 'Haryana',
                  course_level: 'UG',
                  gender: 'FEMALE',
                  is_disabled: false,
                  marks_percentage: 78.0,
                });
                setStep(4);
              }}
              className="text-xs font-semibold text-[#1F5A45] hover:text-[#E8622C] underline cursor-pointer"
            >
              Load Riya's Pre-agreed Profile ✦
            </button>
          </div>

          <div className="pt-2">
            <CatIllustration className="w-32 h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
};
