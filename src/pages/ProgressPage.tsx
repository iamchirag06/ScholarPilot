import React, { useEffect, useState, useRef } from 'react';
import { CrawlProgressEvent } from '../types/index.ts';
import { subscribeCrawlStatus } from '../services/api.ts';
import { CatIllustration } from '../components/illustrations/Illustrations.tsx';
import { StickyNote } from '../components/decorative/StickyNote.tsx';
import { Button } from '../components/ui/Button.tsx';
import {
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Database,
  FileCheck,
  Clock,
  FastForward,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

interface ProgressPageProps {
  jobId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

interface ActivityLogItem {
  id: string;
  time: string;
  portal: string;
  message: string;
  progress: number;
}

const TOTAL_CRAWL_SECONDS = 120; // Exact 2 minutes

export const ProgressPage: React.FC<ProgressPageProps> = ({
  jobId,
  onComplete,
  onCancel,
}) => {
  const [progress, setProgress] = useState<number>(3);
  const [statusMessage, setStatusMessage] = useState<string>(
    'TinyFish crawler worker waking up and initializing headless browser cluster...'
  );
  const [schemesFound, setSchemesFound] = useState<number>(0);
  const [currentPortal, setCurrentPortal] = useState<string>('Initializing');
  const [errorState, setErrorState] = useState<string | null>(null);

  // Speed multiplier for testing convenience (default 1 = full 2 minutes)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: 'init',
      time: '00:01',
      portal: 'Cluster Node',
      message: 'Worker initialized · starting 2-minute comprehensive scholarship crawl',
      progress: 3,
    },
  ]);

  // Stepper stages mapped across the 2-minute cycle
  const stages = [
    { id: 1, name: 'Crawling Portals', threshold: 30, icon: <Database className="w-4 h-4" /> },
    { id: 2, name: 'Processing Data', threshold: 65, icon: <FileCheck className="w-4 h-4" /> },
    { id: 3, name: 'AI Summarizing', threshold: 88, icon: <Sparkles className="w-4 h-4" /> },
    { id: 4, name: 'Personalized Ranking', threshold: 100, icon: <Check className="w-4 h-4" /> },
  ];

  const getActiveStageIndex = () => {
    if (progress < 30) return 0;
    if (progress < 65) return 1;
    if (progress < 88) return 2;
    return 3;
  };

  const activeStageIndex = getActiveStageIndex();

  // Seconds countdown & elapsed timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_CRAWL_SECONDS && progress < 100) {
          setProgress(100);
        }
        return next;
      });
    }, Math.round(1000 / speedMultiplier));

    return () => clearInterval(timerInterval);
  }, [speedMultiplier, progress]);

  // Format time display (MM:SS)
  const formatTime = (totalSec: number) => {
    const safeSec = Math.max(0, Math.floor(totalSec));
    const mins = Math.floor(safeSec / 60);
    const secs = safeSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const remainingSeconds = Math.max(0, TOTAL_CRAWL_SECONDS - secondsElapsed);

  // Subscribe to multi-step crawler timeline
  useEffect(() => {
    setErrorState(null);
    setSecondsElapsed(0);

    const unsubscribe = subscribeCrawlStatus(
      jobId,
      (evt: CrawlProgressEvent) => {
        setProgress(evt.progress);
        if (evt.message) {
          setStatusMessage(evt.message);
          // Add to rolling live log
          setActivityLogs((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              time: formatTime(secondsElapsed),
              portal: evt.current_portal || 'Crawler',
              message: evt.message || '',
              progress: evt.progress,
            },
            ...prev.slice(0, 5), // Keep latest 6 logs
          ]);
        }
        if (evt.schemes_found !== undefined) setSchemesFound(evt.schemes_found);
        if (evt.current_portal) setCurrentPortal(evt.current_portal);
      },
      (err: Error) => {
        setErrorState(err.message || 'Network error streaming crawler progress');
      },
      () => {
        // Smooth 600ms transition to dashboard on done
        setTimeout(() => {
          onComplete();
        }, 700);
      },
      speedMultiplier
    );

    return () => {
      unsubscribe();
    };
  }, [jobId, speedMultiplier]);

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Centered Paper Card */}
      <div className="paper-card p-6 sm:p-10 relative text-center">
        {/* Cat Illustration serenely sleeping while TinyFish works */}
        <div className="flex justify-center mb-5">
          <CatIllustration className="w-32 sm:w-40 h-auto" />
        </div>

        {/* 2-Minute Simulation Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF8EA] border border-[#E8622C]/30 text-xs font-bold text-[#E8622C] mb-3">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>2-Minute Deep Crawl Simulation</span>
          <span className="text-[#5E5A52]">·</span>
          <span className="font-mono text-[#1F5A45]">{formatTime(remainingSeconds)} remaining</span>
        </div>

        {/* Eyebrow & Headline */}
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight mb-2">
          TinyFish is Crawling for You
        </h1>
        <p className="text-sm text-[#5E5A52] max-w-lg mx-auto mb-6">
          Scanning NSP Central Sector, Haryana State Har-Chhatravratti, Delhi e-District, AICTE, and Reliance Foundation portals.
        </p>

        {/* 4-Stage Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
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
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
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
          <div className="flex justify-between text-xs font-bold text-[#5E5A52] mb-1.5 px-1 font-mono">
            <span>Elapsed: {formatTime(secondsElapsed)}</span>
            <span>Target: 02:00</span>
          </div>

          <div className="w-full bg-[#E9E1D3] rounded-full h-5 sm:h-6 p-1 border-2 border-[#1A1A1A]/10 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
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
        <div className="bg-[#FBF6EE] rounded-xl p-4 border border-[#E9E1D3] mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#E8622C] animate-pulse shrink-0" />
            <div>
              <span className="font-script text-lg text-[#1A1A1A] font-bold block leading-snug">
                "{statusMessage}"
              </span>
              <span className="text-xs text-[#5E5A52] font-semibold">
                Current source: <span className="text-[#1F5A45] font-bold">{currentPortal}</span>
              </span>
            </div>
          </div>

          <div className="shrink-0 bg-[#FFFDF8] px-3.5 py-1.5 rounded-lg border border-[#E9E1D3] text-center shadow-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5E5A52] block">
              Schemes Found
            </span>
            <span className="font-serif text-xl font-extrabold text-[#1F5A45] tabular-nums">
              {schemesFound}
            </span>
          </div>
        </div>

        {/* Live Terminal / Crawl Activity Log */}
        <div className="bg-[#1A1A1A] rounded-xl p-3.5 text-left text-white font-mono text-xs mb-6 border border-[#333] shadow-inner overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#333] text-[11px] text-[#A9DCC3]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#2F8F6B]" />
              <span className="font-bold tracking-wider uppercase">Crawler Activity Log</span>
            </div>
            <span className="text-[#888]">{speedMultiplier > 1 ? `${speedMultiplier}x Speed` : '2-Min Pace'}</span>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                <span className="text-[#E8622C] shrink-0">[{log.time}]</span>
                <span className="text-[#F3DE9A] shrink-0 font-bold">[{log.portal}]:</span>
                <span className="text-[#E0E0E0] truncate">{log.message}</span>
              </div>
            ))}
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
              onClick={() => {
                setErrorState(null);
                setSecondsElapsed(0);
              }}
              className="border-[#D64545] text-[#D64545] hover:bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Action Controls: Skip button and Speed multiplier */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#E9E1D3]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5E5A52] font-semibold">Crawl Pace:</span>
            <button
              type="button"
              onClick={() => setSpeedMultiplier(1)}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                speedMultiplier === 1
                  ? 'bg-[#1F5A45] text-white shadow-xs'
                  : 'bg-[#FBF6EE] text-[#5E5A52] hover:text-[#1A1A1A] border border-[#E9E1D3]'
              }`}
            >
              1x (2 Min)
            </button>
            <button
              type="button"
              onClick={() => setSpeedMultiplier(10)}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                speedMultiplier === 10
                  ? 'bg-[#E8622C] text-white shadow-xs'
                  : 'bg-[#FBF6EE] text-[#5E5A52] hover:text-[#1A1A1A] border border-[#E9E1D3]'
              }`}
            >
              <FastForward className="w-3 h-3" />
              10x Fast
            </button>
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="text-xs font-bold text-[#E8622C] hover:text-[#D55320] underline cursor-pointer"
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
