import React, { useState } from 'react';
import { Scheme } from '../types/index.ts';
import { formatINR, getDeadlineUrgency } from '../mockData.ts';
import { Button } from './ui/Button.tsx';
import { ProgressBar } from './ui/ProgressBar.tsx';
import {
  Landmark,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface SchemeCardProps {
  scheme: Scheme;
  onApply?: (scheme: Scheme) => void;
  onSaveToTracker?: (scheme: Scheme) => void;
  isSaved?: boolean;
}

export const SchemeCard: React.FC<SchemeCardProps> = ({
  scheme,
  onApply,
  onSaveToTracker,
  isSaved = false,
}) => {
  const [showLegalese, setShowLegalese] = useState(false);
  const urgency = getDeadlineUrgency(scheme.deadline);

  // Portal blob styling
  const getPortalBadge = () => {
    switch (scheme.source_portal) {
      case 'NSP':
        return {
          bg: '#F3DE9A',
          icon: <Landmark className="w-5 h-5 text-[#1A1A1A]" />,
        };
      case 'Haryana State':
        return {
          bg: '#A9DCC3',
          icon: <GraduationCap className="w-5 h-5 text-[#1A1A1A]" />,
        };
      case 'Delhi State':
        return {
          bg: '#F9C6A5',
          icon: <Building2 className="w-5 h-5 text-[#1A1A1A]" />,
        };
      case 'Private Trust':
      default:
        return {
          bg: '#F6B7C1',
          icon: <Sparkles className="w-5 h-5 text-[#1A1A1A]" />,
        };
    }
  };

  const portalBadge = getPortalBadge();
  const confidencePercent = Math.round(scheme.confidence_score * 100);

  return (
    <article className="paper-card paper-card-interactive p-6 flex flex-col justify-between relative overflow-hidden group">
      {/* Top Header: Portal Blob + Urgency badge */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {/* Organic pastel blob behind hand-inked icon */}
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center border border-[#1A1A1A]/10 shadow-xs shrink-0 transform -rotate-2"
              style={{ backgroundColor: portalBadge.bg }}
            >
              {portalBadge.icon}
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#E8622C] block">
                {scheme.source_portal}
              </span>
              <span className="text-xs text-[#5E5A52] font-medium block truncate max-w-[170px] sm:max-w-[220px]">
                {scheme.provider}
              </span>
            </div>
          </div>

          {/* Urgency countdown indicator */}
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border"
            style={{
              backgroundColor: urgency.bg,
              color: urgency.color,
              borderColor: `${urgency.color}30`,
            }}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{urgency.label}</span>
          </div>
        </div>

        {/* Scheme Name */}
        <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A] leading-snug tracking-tight mb-2 group-hover:text-[#1F5A45] transition-colors">
          {scheme.scheme_name}
        </h3>

        {/* Award Amount */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl sm:text-3xl font-extrabold text-[#1F5A45] font-serif tabular-nums tracking-tight">
            {formatINR(scheme.award_amount)}
          </span>
          <span className="text-xs text-[#5E5A52] font-medium uppercase tracking-wider">
            / scholarship grant
          </span>
        </div>

        {/* Plain-English AI Summary Card (Prominent & Human) */}
        <div className="bg-[#FBF6EE] rounded-xl p-3.5 border border-[#E9E1D3] mb-4 relative">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E8622C]" />
            <span className="font-script text-base text-[#E8622C] font-bold">
              AI Plain-English Summary
            </span>
          </div>
          <p className="text-sm text-[#1A1A1A] leading-relaxed font-sans font-medium">
            "{scheme.llm_summary}"
          </p>
        </div>

        {/* Required Documents list */}
        <div className="mb-4">
          <div className="text-xs text-[#5E5A52] font-semibold mb-1.5 uppercase tracking-wide flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-[#5E5A52]" />
            <span>Required Documents</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scheme.required_documents.map((doc, idx) => (
              <span
                key={idx}
                className="text-xs bg-[#FFFDF8] text-[#5E5A52] border border-[#E9E1D3] rounded-md px-2 py-0.5 font-medium"
              >
                {doc}
              </span>
            ))}
          </div>
        </div>

        {/* Confidence Meter (Thin skill-style bar) */}
        <div className="mb-4 pt-1">
          <ProgressBar
            value={confidencePercent}
            label="Match Fit Confidence"
            color={confidencePercent >= 95 ? 'mint' : 'forest'}
            height={6}
          />
        </div>

        {/* Legalese Expander ("See the original legalese") */}
        <div className="mb-5 border-t border-[#E9E1D3]/80 pt-3">
          <button
            type="button"
            onClick={() => setShowLegalese(!showLegalese)}
            className="flex items-center justify-between w-full text-xs font-semibold text-[#5E5A52] hover:text-[#1A1A1A] transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>{showLegalese ? 'Hide original legal wording' : 'See the original legalese'}</span>
              <span className="font-script text-sm text-[#E8622C] font-normal">(before AI simplification)</span>
            </span>
            {showLegalese ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showLegalese && (
            <div className="mt-2.5 p-3 rounded-lg bg-[#F8E4E0]/40 border-l-2 border-[#E8622C] text-xs text-[#5E5A52] font-mono leading-relaxed transition-all">
              <span className="font-script text-sm text-[#E8622C] block font-bold mb-1">
                Raw Government Portal Text:
              </span>
              <p className="italic">"{scheme.raw_eligibility_text}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Card Action Buttons */}
      <div className="flex items-center gap-2.5 pt-2">
        <Button
          variant="primary"
          size="md"
          showArrow
          className="flex-1"
          onClick={() => onApply?.(scheme)}
        >
          Apply Now
        </Button>
        <Button
          variant={isSaved ? 'forest' : 'secondary'}
          size="md"
          className="shrink-0"
          onClick={() => onSaveToTracker?.(scheme)}
        >
          {isSaved ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Saved</span>
            </span>
          ) : (
            'Save to Tracker'
          )}
        </Button>
      </div>
    </article>
  );
};
