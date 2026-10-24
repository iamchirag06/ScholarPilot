import React, { useState, useEffect, useMemo } from 'react';
import { Profile, Category, CourseLevel, Gender } from '../types/index.ts';
import { INDIAN_STATES, formatINRWords, getStoredUsername, formatDisplayName } from '../mockData.ts';
import { Button } from '../components/ui/Button.tsx';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { CatIllustration } from '../components/illustrations/Illustrations.tsx';
import {
  Check,
  ArrowLeft,
  Sparkles,
  User,
  GraduationCap,
  IndianRupee,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ProfilePageProps {
  initialProfile: Profile;
  onSaveProfile: (profile: Profile) => Promise<void> | void;
  isEditMode?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  username?: string | null;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  initialProfile,
  onSaveProfile,
  isEditMode = false,
  isSubmitting = false,
  errorMessage = null,
  username = null,
}) => {
  // Helper to determine the effective full name: username from props/localStorage > non-riya initial name > ''
  const resolveFullName = (incoming: Profile): string => {
    const rawUsername = username || getStoredUsername();
    if (rawUsername && rawUsername.trim()) {
      return formatDisplayName(rawUsername);
    }
    if (
      incoming.fullName &&
      incoming.fullName.trim() &&
      incoming.fullName.trim().toLowerCase() !== 'riya'
    ) {
      return incoming.fullName.trim();
    }
    return '';
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [profile, setProfile] = useState<Profile>(() => ({
    ...initialProfile,
    fullName: resolveFullName(initialProfile),
    annualIncome: initialProfile.annualIncome ?? 0,
    marksPercentage: initialProfile.marksPercentage ?? 75,
    isDisabled: Boolean(initialProfile.isDisabled),
    state: initialProfile.state || 'Haryana',
    courseLevel: initialProfile.courseLevel || 'UG',
    category: initialProfile.category || 'GENERAL',
    gender: initialProfile.gender || 'MALE',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfile((prev) => ({
      ...initialProfile,
      fullName: prev.fullName || resolveFullName(initialProfile),
      annualIncome: initialProfile.annualIncome ?? prev.annualIncome ?? 0,
      marksPercentage: initialProfile.marksPercentage ?? prev.marksPercentage ?? 75,
      isDisabled: Boolean(initialProfile.isDisabled ?? prev.isDisabled),
      state: initialProfile.state || prev.state || 'Haryana',
      courseLevel: initialProfile.courseLevel || prev.courseLevel || 'UG',
      category: initialProfile.category || prev.category || 'GENERAL',
      gender: initialProfile.gender || prev.gender || 'MALE',
    }));
  }, [initialProfile, username]);

  const userGreetingName = useMemo(() => {
    const raw = profile.fullName || username || getStoredUsername();
    if (!raw || raw.trim().toLowerCase() === 'riya') return '';
    return formatDisplayName(raw);
  }, [profile.fullName, username]);

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
      text: 'Looking sharp! Submit to rank all live matching schemes against government criteria.',
      color: 'peach',
    },
  };

  const currentTip = stepTips[step] || stepTips[4] || {
    text: 'Review your details to rank matching scholarship schemes.',
    color: 'peach',
  };

  const validateStep = (currentStep: number): boolean => {
    const errs: Record<string, string> = {};

    if (currentStep === 1) {
      if (!profile.fullName || !profile.fullName.trim()) {
        errs.fullName = 'Please provide your full name';
      }
      if (!profile.state) {
        errs.state = 'Please select your state/UT';
      }
      if (!profile.gender) {
        errs.gender = 'Please select your gender';
      }
    } else if (currentStep === 2) {
      if (!profile.courseLevel) {
        errs.courseLevel = 'Please select your course level';
      }
      if (
        profile.marksPercentage === undefined ||
        profile.marksPercentage === null ||
        isNaN(Number(profile.marksPercentage)) ||
        Number(profile.marksPercentage) < 0 ||
        Number(profile.marksPercentage) > 100
      ) {
        errs.marksPercentage = 'Marks must be a valid number between 0% and 100%';
      }
    } else if (currentStep === 3) {
      if (!profile.category) {
        errs.category = 'Please select your category';
      }
      if (
        profile.annualIncome === undefined ||
        profile.annualIncome === null ||
        isNaN(Number(profile.annualIncome)) ||
        Number(profile.annualIncome) < 0
      ) {
        errs.annualIncome = 'Please enter a non-negative integer for family income';
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
      return;
    }

    // Comprehensive final validation before sending
    const v1 = validateStep(1);
    const v2 = validateStep(2);
    const v3 = validateStep(3);

    if (!v1) {
      setStep(1);
      return;
    }
    if (!v2) {
      setStep(2);
      return;
    }
    if (!v3) {
      setStep(3);
      return;
    }

    const cleanedProfile: Profile = {
      ...profile,
      fullName: (profile.fullName || userGreetingName || '').trim(),
      annualIncome: Math.round(Math.max(0, Number(profile.annualIncome) || 0)),
      marksPercentage: parseFloat((Number(profile.marksPercentage) || 0).toFixed(2)),
      isDisabled: Boolean(profile.isDisabled),
    };

    if (cleanedProfile.fullName && typeof window !== 'undefined') {
      localStorage.setItem('scholarpilot_username', cleanedProfile.fullName);
    }

    onSaveProfile(cleanedProfile);
  };

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Title & Eyebrow */}
      <div className="text-center mb-8">
        <span className="font-script text-2xl text-[#E8622C] font-bold block mb-1">
          {userGreetingName
            ? `Welcome, ${userGreetingName} ✦`
            : isEditMode
            ? 'Update Your Preferences ✦'
            : 'Your Eligibility Passport ✦'}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] tracking-tight">
          {isEditMode ? 'Edit Scholar Profile' : 'Set Up Your Scholar Profile'}
        </h1>
        <p className="mt-3 text-base text-[#5E5A52] max-w-xl mx-auto">
          {isEditMode
            ? 'Update your academic, income, or category details to discover refreshed scholarship matches.'
            : 'Fill in your academic and background details once. TinyFish will match 500+ government and private schemes.'}
        </p>
      </div>

      {/* Top Banner Error (e.g. Duplicate Profile Validation from Backend) */}
      {errorMessage && (
        <div className="mb-8 p-4 rounded-xl bg-[#FDECEB] border border-[#D64545]/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#D64545] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#D64545]">Submission Error</h4>
            <p className="text-xs text-[#D64545]/90 mt-0.5 font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 4-Step Paper Stepper */}
      <div className="mb-10 bg-[#FFFDF8] p-3 rounded-2xl border border-[#E9E1D3] shadow-xs max-w-2xl mx-auto">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { num: 1, label: 'Identity' },
            { num: 2, label: 'Academic' },
            { num: 3, label: 'Category' },
            { num: 4, label: 'Review' },
          ].map((s) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num < step || isEditMode) {
                    setStep(s.num as any);
                  }
                }}
                className={`py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1F5A45] text-white shadow-xs font-bold'
                    : isCompleted
                    ? 'bg-[#EDF8F3] text-[#1F5A45] font-semibold'
                    : 'text-[#5E5A52] hover:bg-[#FBF6EE]'
                }`}
              >
                <div className="text-xs">
                  {isCompleted ? '✓' : `0${s.num}`}
                </div>
                <div className="text-xs sm:text-sm truncate">{s.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Form Paper Card */}
        <div className="lg:col-span-8 paper-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} noValidate>
            {/* STEP 1: IDENTITY */}
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
                    Full Name <span className="text-[#D64545]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profile.fullName || ''}
                    onChange={(e) =>
                      setProfile({ ...profile, fullName: e.target.value })
                    }
                    placeholder={userGreetingName ? `e.g. ${userGreetingName}` : 'e.g. Abhi Sharma'}
                    className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-base focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">{errors.fullName}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                      Gender <span className="text-[#D64545]">*</span>
                    </label>
                    <select
                      value={profile.gender}
                      onChange={(e) =>
                        setProfile({ ...profile, gender: e.target.value as Gender })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-base focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all cursor-pointer"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                      Domicile / Home State <span className="text-[#D64545]">*</span>
                    </label>
                    <select
                      value={profile.state}
                      onChange={(e) =>
                        setProfile({ ...profile, state: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-base focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all cursor-pointer"
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
                      checked={profile.isDisabled}
                      onChange={(e) =>
                        setProfile({ ...profile, isDisabled: e.target.checked })
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
                    Current Course Level <span className="text-[#D64545]">*</span>
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
                      const isSelected = profile.courseLevel === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() =>
                            setProfile({ ...profile, courseLevel: lvl.id as CourseLevel })
                          }
                          className={`p-3 rounded-lg border text-sm font-semibold text-left transition-all cursor-pointer ${
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
                      Previous Exam Marks (%) <span className="text-[#D64545]">*</span>
                    </label>
                    <span className="font-serif text-lg font-bold text-[#1F5A45] tabular-nums">
                      {profile.marksPercentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="100"
                    step="0.5"
                    value={profile.marksPercentage}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        marksPercentage: parseFloat(e.target.value) || 0,
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
                  {errors.marksPercentage && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">
                      {errors.marksPercentage}
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
                    Social Category <span className="text-[#D64545]">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as Category[]).map((cat) => {
                      const isSelected = profile.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setProfile({ ...profile, category: cat })}
                          className={`py-3 px-2 rounded-lg border text-sm font-bold transition-all text-center cursor-pointer ${
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
                  {errors.category && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">{errors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5E5A52] mb-1.5">
                    Annual Family Income (INR) <span className="text-[#D64545]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={profile.annualIncome}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        annualIncome: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="w-full px-4 py-3 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] text-lg font-serif font-bold focus:outline-none focus:ring-2 focus:ring-[#1F5A45] focus:bg-[#FFFDF8] transition-all"
                  />
                  {/* Live ₹ Preview in Indian words */}
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#1F5A45] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#2F8F6B]" />
                    <span>Formatted: {formatINRWords(profile.annualIncome)}</span>
                  </div>
                  {errors.annualIncome && (
                    <p className="mt-1 text-xs text-[#D64545] font-medium">
                      {errors.annualIncome}
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
                        {profile.fullName || userGreetingName || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        State Domicile
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {profile.state || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Course Level
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {profile.courseLevel || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Marks Percentage
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1F5A45]">
                        {profile.marksPercentage ?? 0}%
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Category
                      </span>
                      <span className="font-serif text-lg font-bold text-[#E8622C]">
                        {profile.category || 'GENERAL'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#5E5A52] block uppercase font-bold">
                        Annual Income
                      </span>
                      <span className="font-serif text-lg font-bold text-[#1A1A1A]">
                        {formatINRWords(profile.annualIncome)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#EDF8F3] border border-[#2F8F6B]/30 text-xs text-[#1F5A45] font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#2F8F6B] shrink-0" />
                  <span>
                    Ready! Your details will be sent to the backend matching engine to find all qualified government and trust grants.
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
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back
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
                  disabled={isSubmitting}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  showArrow
                  disabled={isSubmitting}
                  className="bg-[#1A1A1A] text-white shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center">
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving Profile...
                    </span>
                  ) : isEditMode ? (
                    'Update Profile & View Matches'
                  ) : (
                    'Find Scholarships'
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Dynamic Sticky Note Tip + Cat Illustration */}
        <div className="lg:col-span-4 flex flex-col items-center gap-6">
          <div className="w-full">
            <StickyNote
              color={currentTip.color}
              rotation={step % 2 === 0 ? 3 : -3}
              tape
              author="ScholarPilot Advisor"
            >
              {currentTip.text}
            </StickyNote>
          </div>

          <div className="pt-2">
            <CatIllustration className="w-32 h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
};
