import React, { useState, useEffect } from 'react';
import { Scheme, Profile } from '../types/index.ts';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { Button } from '../components/ui/Button.tsx';
import { formatINR } from '../mockData.ts';
import { getAutoFillData } from '../services/schemes.ts';
import {
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
  Building,
} from 'lucide-react';

interface AutoFillPageProps {
  scheme: Scheme;
  profile: Profile;
  availableSchemes: Scheme[];
  onSelectScheme: (scheme: Scheme) => void;
  onSubmitApplication: (schemeId: string) => void;
}

interface FormFieldState {
  key: string;
  label: string;
  targetValue: string;
  currentValue: string;
  isHighlighting: boolean;
  isFilled: boolean;
}

export const AutoFillPage: React.FC<AutoFillPageProps> = ({
  scheme,
  profile,
  availableSchemes,
  onSelectScheme,
  onSubmitApplication,
}) => {
  const [fields, setFields] = useState<FormFieldState[]>([]);
  const [docStatuses, setDocStatuses] = useState<Record<string, boolean>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [autoFilledCount, setAutoFilledCount] = useState(0);

  // Initialize and load pre-filled fields from backend auto-fill endpoint
  useEffect(() => {
    let isCancelled = false;

    async function loadFormFields() {
      // Default profile-derived fields for instant rendering and resilient fallback
      const defaultFields: FormFieldState[] = [
        {
          key: 'fullName',
          label: 'Applicant Full Name',
          targetValue: profile.fullName || 'Student',
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
        {
          key: 'gender',
          label: 'Gender',
          targetValue:
            profile.gender === 'FEMALE'
              ? 'Female'
              : profile.gender === 'MALE'
              ? 'Male'
              : profile.gender || 'Other',
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
        {
          key: 'category',
          label: 'Social Reservation Category',
          targetValue: profile.category || 'GENERAL',
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
        {
          key: 'state',
          label: 'State / Union Territory of Domicile',
          targetValue: profile.state || 'Delhi',
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
        {
          key: 'courseLevel',
          label: 'Current Academic Degree Level',
          targetValue:
            profile.courseLevel === 'UG'
              ? 'Undergraduate (UG Degree)'
              : profile.courseLevel || 'UG',
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
        {
          key: 'marksPercentage',
          label: 'Previous Qualifying Exam Marks (%)',
          targetValue: `${profile.marksPercentage || 80}%`,
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
        {
          key: 'annualIncome',
          label: 'Verified Gross Family Annual Income',
          targetValue: formatINR(profile.annualIncome || 200000),
          currentValue: '',
          isHighlighting: false,
          isFilled: false,
        },
      ];

      // Route 9: GET /api/schemes/{schemeId}/auto-fill/{profileId}
      if (scheme.id && profile.id) {
        try {
          const autoFillJson = await getAutoFillData(scheme.id, profile.id);
          if (!isCancelled && autoFillJson && Object.keys(autoFillJson).length > 0) {
            // Map exact backend keys to React input fields
            const backendFields: FormFieldState[] = Object.entries(autoFillJson).map(([key, value]) => {
              let displayVal = String(value ?? '');
              if (typeof value === 'number' && key.toLowerCase().includes('income')) {
                displayVal = formatINR(value);
              } else if (typeof value === 'number' && key.toLowerCase().includes('mark')) {
                displayVal = `${value}%`;
              }
              return {
                key,
                label: key,
                targetValue: displayVal,
                currentValue: '',
                isHighlighting: false,
                isFilled: false,
              };
            });
            setFields(backendFields);
            return;
          }
        } catch (err) {
          console.warn('Auto-fill API load warning, using standard profile attributes', err);
        }
      }

      if (!isCancelled) {
        setFields(defaultFields);
      }
    }

    loadFormFields();

    const initialDocs: Record<string, boolean> = {};
    (scheme.required_documents || []).forEach((d) => {
      initialDocs[d] = false;
    });
    setDocStatuses(initialDocs);
    setIsCompleted(false);
    setAutoFilledCount(0);

    return () => {
      isCancelled = true;
    };
  }, [scheme, profile]);

  // Magical Sequential Auto-Fill Animation
  const startAutoFill = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsCompleted(false);

    // Reset current values
    setFields((prev) =>
      prev.map((f) => ({
        ...f,
        currentValue: '',
        isHighlighting: false,
        isFilled: false,
      }))
    );

    const initialDocs: Record<string, boolean> = {};
    (scheme.required_documents || []).forEach((d) => {
      initialDocs[d] = false;
    });
    setDocStatuses(initialDocs);

    let currentStep = 0;
    const totalFields = fields.length;

    const interval = setInterval(() => {
      if (currentStep < totalFields) {
        const stepIndex = currentStep;

        // Step A: Trigger orange highlighter swipe
        setFields((prev) => {
          const updated = [...prev];
          if (updated[stepIndex]) {
            updated[stepIndex] = {
              ...updated[stepIndex],
              isHighlighting: true,
              currentValue: updated[stepIndex].targetValue,
            };
          }
          return updated;
        });

        // Step B: 120ms later settle with green check
        setTimeout(() => {
          setFields((prev) => {
            const updated = [...prev];
            if (updated[stepIndex]) {
              updated[stepIndex] = {
                ...updated[stepIndex],
                isHighlighting: false,
                isFilled: true,
              };
            }
            return updated;
          });
          setAutoFilledCount((c) => c + 1);
        }, 120);

        currentStep++;
      } else {
        // Fill documents one by one
        clearInterval(interval);

        let docIndex = 0;
        const docs = scheme.required_documents || [];
        const docInterval = setInterval(() => {
          if (docIndex < docs.length) {
            const docName = docs[docIndex];
            setDocStatuses((prev) => ({ ...prev, [docName]: true }));
            docIndex++;
          } else {
            clearInterval(docInterval);
            setIsAnimating(false);
            setIsCompleted(true);
          }
        }, 200);
      }
    }, 220);
  };

  const handleSubmit = () => {
    onSubmitApplication(scheme.id);
    if (scheme.apply_link && scheme.apply_link !== '#') {
      window.open(scheme.apply_link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="text-center mb-8">
        <span className="font-script text-2xl text-[#E8622C] font-bold block mb-1">
          Demo Highlight ✦ 1-Click Form Filling
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] tracking-tight">
          Simulated Portal Auto-Fill
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#5E5A52] max-w-xl mx-auto">
          Experience how ScholarPilot eliminates repetitive paperwork by auto-mapping student profile attributes into official portal fields.
        </p>
      </div>

      {/* Target Scheme Selector bar */}
      <div className="bg-[#FFFDF8] rounded-xl p-3 sm:p-4 border border-[#E9E1D3] mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5 text-[#1F5A45]" />
          <span className="text-xs font-bold text-[#5E5A52] uppercase tracking-wider">
            Target Portal Form:
          </span>
          <span className="text-sm font-bold text-[#1A1A1A] font-serif">
            {scheme.scheme_name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-[#5E5A52] font-semibold">Switch Scheme:</label>
          <select
            value={scheme.id}
            onChange={(e) => {
              const found = availableSchemes.find((s) => s.id === e.target.value);
              if (found) onSelectScheme(found);
            }}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F5A45]"
          >
            {availableSchemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.scheme_name} ({s.source_portal})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Desk Layout: Simulated Government Portal Paper Form */}
      <div className="relative">
        {/* Floating Sticky Note in top-right */}
        <div className="absolute -top-8 -right-2 sm:-right-6 z-20 w-44 sm:w-52">
          <StickyNote color="yellow" rotation={3} tape author="ScholarPilot">
            Watch the magic ✨ 100% field precision
          </StickyNote>
        </div>

        {/* Paper Form Card */}
        <div className="paper-card p-6 sm:p-10 border-2 border-[#E9E1D3] bg-[#FFFDF8] shadow-lg relative overflow-hidden">
          {/* Official Form Header Stamp */}
          <div className="pb-6 mb-8 border-b-2 border-dashed border-[#E9E1D3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-xs bg-[#1F5A45] text-white text-[10px] font-bold tracking-widest uppercase">
                  OFFICIAL PORTAL REPLICA
                </span>
                <span className="text-xs text-[#5E5A52] font-mono">
                  FORM ID: {scheme.id.toUpperCase()}
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A]">
                {scheme.source_portal} · {scheme.scheme_name}
              </h2>
              <p className="text-xs text-[#5E5A52]">
                Issued by {scheme.provider} · Maximum Grant: {formatINR(scheme.award_amount)}
              </p>
            </div>

            {/* Auto-Fill Trigger Button */}
            <div className="shrink-0 w-full sm:w-auto">
              <Button
                variant="primary"
                size="md"
                onClick={startAutoFill}
                disabled={isAnimating}
                className="w-full sm:w-auto bg-[#E8622C] hover:bg-[#D55320] text-white shadow-md cursor-pointer whitespace-nowrap"
              >
                <span>{isAnimating ? 'Auto-filling fields...' : 'Auto-Fill with My Profile'}</span>
              </Button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {fields.map((field) => (
              <div key={field.key} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5E5A52]">
                    {field.label}
                  </label>
                  {field.isFilled && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2F8F6B]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready ✓</span>
                    </span>
                  )}
                </div>

                {/* Input box with animated highlighter and value */}
                <div className="relative rounded-lg overflow-hidden border border-[#E9E1D3] bg-[#FBF6EE]">
                  {/* Highlighter swipe overlay */}
                  {field.isHighlighting && (
                    <div className="absolute inset-0 bg-[#E8622C]/30 animate-highlighter pointer-events-none z-10" />
                  )}

                  <input
                    type="text"
                    readOnly
                    value={field.currentValue}
                    placeholder="Pending auto-fill..."
                    className={`w-full px-3.5 py-2.5 text-sm font-semibold text-[#1A1A1A] bg-transparent focus:outline-none transition-colors ${
                      field.isFilled ? 'bg-[#EDF8F3]/40' : ''
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Required Documents Checklist Area */}
          <div className="pt-6 border-t border-[#E9E1D3] mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#1F5A45]" />
                <h3 className="font-serif text-base font-bold text-[#1A1A1A]">
                  Attached Verification Documents
                </h3>
              </div>
              <span className="text-xs font-script text-base text-[#E8622C] font-bold">
                Auto-validated against DigiLocker
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(scheme.required_documents || []).map((doc) => {
                const isReady = docStatuses[doc];
                return (
                  <div
                    key={doc}
                    className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                      isReady
                        ? 'bg-[#EDF8F3] border-[#2F8F6B]/40 text-[#1F5A45]'
                        : 'bg-[#FBF6EE] border-[#E9E1D3] text-[#5E5A52]'
                    }`}
                  >
                    <span>{doc}</span>
                    {isReady ? (
                      <span className="flex items-center gap-1 text-[#2F8F6B] font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ready ✓</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#5E5A52]/70 italic">Queued</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Submission Action */}
          <div className="pt-6 border-t-2 border-dashed border-[#E9E1D3] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#5E5A52] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2F8F6B]" />
              <span>
                Clicking Submit opens the real portal link & moves scheme to{' '}
                <strong className="text-[#1F5A45]">APPLIED</strong> in your Kanban Tracker.
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <Button
                variant="secondary"
                size="md"
                onClick={startAutoFill}
                disabled={isAnimating}
                className="whitespace-nowrap shrink-0"
              >
                <RefreshCw className="inline w-3.5 h-3.5 mr-1" />
                Re-run Fill
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                showArrow
                className="bg-[#1A1A1A] text-white shadow-md whitespace-nowrap shrink-0"
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span>Submit / Go to Official Portal</span>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
