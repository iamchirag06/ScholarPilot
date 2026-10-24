import React, { useEffect, useState } from 'react';
import { CrawlProgressEvent } from '../types/index.ts';
import { subscribeCrawlStatus } from '../services/api.ts';
import { CatIllustration } from '../components/illustrations/Illustrations.tsx';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { Scribble } from '../components/decorative/Scribble.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Check, Loader2, AlertCircle, RefreshCw, Sparkles, Database, FileCheck } from 'lucide-react';

interface ProgressPageProps {
  jobId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export const ProgressPage: React.FC<ProgressPageProps> = ({
  jobId,
  onComplete,
  onCancel,
}) => {
  const [progress, setProgress] = useState<number>(5);
  const [statusMessage, setStatusMessage] = useState<string>(
    'TinyFish worker waking up and pinging scholarship portals...'
  );
  const [schemesFound, setSchemesFound] = useState<number>(0);
  const [currentPortal, setCurrentPortal] = useState<string>('Initializing');
  const [errorState, setErrorState] = useState<string | null>(null);

  // Four-stage stepper
  const stages = [
    { id: 1, name: 'Crawling Portals', threshold: 30, icon: <Database className="w-4 h-4" /> },
    { id: 2, name: 'Processing Data', threshold: 60, icon: <FileCheck className="w-4 h-4" /> },
    { id: 3, name: 'AI Summarizing', threshold: 85, icon: <Sparkles className="w-4 h-4" /> },
    { id: 4, name: 'Personalized Ranking', threshold: 100, icon: <Check className="w-4 h-4" /> },
  ];

  const getActiveStageIndex = () => {
    if (progress < 30) return 0;
    if (progress < 65) return 1;
    if (progress < 90) return 2;
    return 3;
  };

  const activeStageIndex = getActiveStageIndex();

  const startListening = () => {
    setErrorState(null);
    return subscribeCrawlStatus(
      jobId,
      (evt: CrawlProgressEvent) => {
        setProgress(evt.progress);
        if (evt.message) setStatusMessage(evt.message);
        if (evt.schemes_found !== undefined) setSchemesFound(evt.schemes_found);
        if (evt.current_portal) setCurrentPortal(evt.current_portal);
      },
      (err: Error) => {
        setErrorState(err.message || 'Network error streaming crawler progress');
      },
      () => {
        // smooth 600ms transition to dashboard on done
        setTimeout(() => {
          onComplete();
        }, 700);
      }
    );
  };

  useEffect(() => {
    const unsubscribe = startListening();
    return () => {
      unsubscribe();
    };
  }, [jobId]);

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Centered Paper Card */}
      <div className="paper-card p-6 sm:p-12 relative text-center">
        {/* Cat Illustration sleeping serenely while TinyFish works */}
        <div className="flex justify-center mb-6">
          <CatIllustration className="w-36 sm:w-44 h-auto" />
        </div>

        {/* Eyebrow & Headline */}
        <span className="font-script text-2xl text-[#E8622C] font-bold block mb-1">
          Sit back with a cup of tea
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight mb-2">
          TinyFish is Crawling for You
        </h1>
        <p className="text-sm text-[#5E5A52] max-w-lg mx-auto mb-8">
          Checking NSP Central Sector, Haryana State Har-Chhatravratti, Delhi e-District, and Reliance Foundation portals.
        </p>

        {/* 4-Stage Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
          {stages.map((stage, idx) => {
            const isCompleted = activeStageIndex > idx || progress === 100;
            const isCurrent = activeStageIndex === idx && progress < 100;

            return (
              <div
                key={stage.id}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isCompleted
                    ? 'bg-[#EDF8F3] border-[#2F8F6B]/40 text-[#1F5A45]'
                    : isCurrent
                    ? 'bg-[#FEF8EA] border-[#E8622C]/40 text-[#1A1A1A] ring-2 ring-[#E8622C]/20'
                    : 'bg-[#FFFDF8] border-[#E9E1D3] text-[#5E5A52]/60'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-[#2F8F6B]" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-[#E8622C] animate-spin" />
                  ) : (
                    <span className="text-xs">{stage.icon}</span>
                  )}
                  <span className="text-xs font-bold">{stage.name}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hand-drawn thick progress bar with orange-to-green gradient texture */}
        <div className="relative mb-6">
          <div className="w-full bg-[#E9E1D3] rounded-full h-5 sm:h-6 p-1 border-2 border-[#1A1A1A]/10 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
              style={{
                width: `${Math.min(100, Math.max(8, progress))}%`,
                background: 'linear-gradient(90deg, #E8622C 0%, #F3DE9A 50%, #2F8F6B 100%)',
              }}
            >
              <span className="text-[10px] font-bold text-white drop-shadow-xs font-mono">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Live Handwritten Status Line & Schemes Found Counter */}
        <div className="bg-[#FBF6EE] rounded-xl p-4 border border-[#E9E1D3] mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#E8622C] animate-pulse shrink-0" />
            <div>
              <span className="font-script text-lg text-[#1A1A1A] font-bold block leading-snug">
                "{statusMessage}"
              </span>
              <span className="text-xs text-[#5E5A52] font-semibold">
                Current source: <span className="text-[#1F5A45]">{currentPortal}</span>
              </span>
            </div>
          </div>

          <div className="shrink-0 bg-[#FFFDF8] px-3.5 py-1.5 rounded-lg border border-[#E9E1D3] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5E5A52] block">
              Schemes Found
            </span>
            <span className="font-serif text-xl font-extrabold text-[#1F5A45] tabular-nums">
              {schemesFound}
            </span>
          </div>
        </div>

        {/* Error & Retry State */}
        {errorState && (
          <div className="p-4 rounded-xl bg-[#FDECEB] border border-[#D64545]/40 text-[#D64545] text-xs font-semibold mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorState}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startListening()}
              className="border-[#D64545] text-[#D64545] hover:bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Manual Skip or Cancel button for quick demo control */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={onComplete}
            className="text-xs font-semibold text-[#5E5A52] hover:text-[#1A1A1A] underline cursor-pointer"
          >
            Skip waiting & go straight to matched results →
          </button>
        </div>

        {/* Floating sticky note with encouragement */}
        <div className="hidden sm:block absolute -top-4 -right-4 z-20 w-44">
          <StickyNote color="yellow" rotation={4} tape author="TinyFish">
            Looking for grants you don't even know exist! ✨
          </StickyNote>
        </div>
      </div>
    </div>
  );
};
