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
  Activity,
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

const TOTAL_CRAWL_SECONDS = 120; // 2-minute safety ceiling

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

  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: 'init',
      time: 'Just now',
      portal: 'Cluster Node',
      message: 'TinyFish crawler initialized · starting multi-portal scholarship discovery',
      progress: 3,
    },
  ]);

  // Stepper stages mapped across the discovery cycle
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

  const startTimeRef = useRef<number>(Date.now());

  // Portal pill styling matching the ScholarPilot warm pastel design system
  const getPortalStyle = (portal: string) => {
    const p = (portal || '').toUpperCase();
    if (p.includes('NSP') || p.includes('CENTRAL')) {
      return { bg: '#F3DE9A', text: '#1A1A1A', border: '#E5CD7E' }; // Butter yellow
    }
    if (p.includes('HARYANA') || p.includes('HAR-')) {
      return { bg: '#A9DCC3', text: '#17261F', border: '#8ECDAE' }; // Mint
    }
    if (p.includes('DELHI') || p.includes('DISTRICT')) {
      return { bg: '#F9C6A5', text: '#1A1A1A', border: '#F4B086' }; // Peach
    }
    if (p.includes('AICTE') || p.includes('PRAGATI')) {
      return { bg: '#F6B7C1', text: '#1A1A1A', border: '#EFA0AD' }; // Rose pink
    }
    if (p.includes('RELIANCE') || p.includes('CSR') || p.includes('TATA')) {
      return { bg: '#E0D4FD', text: '#1A1A1A', border: '#CBB8F8' }; // Lavender
    }
    return { bg: '#EDF8F3', text: '#1F5A45', border: '#A9DCC3' }; // Sage forest
  };

  // Seconds countdown & elapsed safety timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_CRAWL_SECONDS) {
          setProgress((p) => (p < 100 ? 100 : p));
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // Subscribe to multi-step crawler timeline
  useEffect(() => {
    setErrorState(null);
    setSecondsElapsed(0);
    startTimeRef.current = Date.now();

    const unsubscribe = subscribeCrawlStatus(
      jobId,
      (evt: CrawlProgressEvent) => {
        setProgress(evt.progress);
        if (evt.message) {
          setStatusMessage(evt.message);
          const now = new Date();
          const timestamp = now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          // Add to rolling live themed activity log
          setActivityLogs((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              time: timestamp,
              portal: evt.current_portal || 'Crawler',
              message: evt.message || '',
              progress: evt.progress,
            },
            ...prev.slice(0, 7), // Keep latest 8 logs
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
      1
    );

    return () => {
      unsubscribe();
    };
  }, [jobId]);

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Centered Paper Card */}
      <div className="paper-card p-6 sm:p-10 relative text-center">
        {/* Cat Illustration serenely sleeping while TinyFish works */}
        <div className="flex justify-center mb-5">
          <CatIllustration className="w-32 sm:w-40 h-auto" />
        </div>

        {/* Live Scan Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FEF8EA] border border-[#E9E1D3] text-xs font-bold text-[#1F5A45] mb-3 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F8F6B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F8F6B]"></span>
          </span>
          <span>Live Multi-Portal Scholarship Scan</span>
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
          <div className="flex justify-between items-center text-xs font-semibold text-[#5E5A52] mb-1.5 px-1">
            <span className="flex items-center gap-1.5 text-[#1F5A45] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#2F8F6B] animate-pulse" />
              Autonomous Deep Discovery
            </span>
            <span className="font-bold text-[#E8622C] font-mono">{progress}% Complete</span>
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

        {/* Live Themed Crawler Activity Log - Dispatch Ledger */}
        <div className="relative bg-[#FFFDF8] rounded-2xl p-4 sm:p-5 text-left mb-6 border-2 border-[#E9E1D3] shadow-xs overflow-hidden">
          {/* Decorative washi tape badge in top corner */}
          <div className="absolute -top-2.5 left-7 px-3 py-0.5 bg-[#F3DE9A] border border-[#E5CD7E] rounded-xs text-[10px] font-bold text-[#1A1A1A] tracking-wider uppercase shadow-2xs rotate-[-1deg] select-none">
            Live Stream
          </div>

          {/* Log Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E9E1D3]/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#EDF8F3] border border-[#A9DCC3] flex items-center justify-center text-[#1F5A45] shadow-2xs">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-sm text-[#1A1A1A] tracking-tight">
                    Crawler Activity Log
                  </h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF8EA] text-[#E8622C] border border-[#E8622C]/20 font-mono">
                    TinyFish Spider
                  </span>
                </div>
                <p className="text-[11px] text-[#5E5A52]">
                  Real-time portal parser & criteria discovery stream
                </p>
              </div>
            </div>

            {/* Live radar badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EDF8F3] border border-[#A9DCC3]/70 text-[11px] font-bold text-[#1F5A45] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F8F6B] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F8F6B]"></span>
              </span>
              <span>Live Feed</span>
            </div>
          </div>

          {/* Activity Log Stream */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 select-text">
            {activityLogs.map((log, idx) => {
              const portalStyle = getPortalStyle(log.portal);
              const isLatest = idx === 0;

              return (
                <div
                  key={log.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border transition-all duration-300 ${
                    isLatest
                      ? 'bg-[#FEF8EA]/90 border-[#E8622C]/35 shadow-xs ring-1 ring-[#E8622C]/15'
                      : 'bg-[#FBF6EE]/70 hover:bg-[#FBF6EE] border-[#E9E1D3]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Timestamp */}
                    <span className="text-[10px] font-mono font-medium text-[#5E5A52] shrink-0 bg-white px-2 py-0.5 rounded border border-[#E9E1D3] shadow-2xs">
                      {log.time}
                    </span>

                    {/* Portal Badge with Pastel Site Colors */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: portalStyle.bg,
                        color: portalStyle.text,
                        borderColor: portalStyle.border,
                      }}
                    >
                      {log.portal}
                    </span>

                    {/* Log Message */}
                    <span className="text-xs text-[#1A1A1A] font-medium truncate">
                      {log.message}
                    </span>
                  </div>

                  {/* Right Status Badge */}
                  <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-center">
                    {isLatest ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E8622C] bg-white px-2 py-0.5 rounded-full border border-[#E8622C]/30 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-[#E8622C] animate-spin" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#2F8F6B] font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3 text-[#2F8F6B]" />
                        OK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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

        {/* Skip waiting action */}
        <div className="flex items-center justify-center pt-3 border-t border-[#E9E1D3]">
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E8622C] hover:text-[#D55320] hover:underline cursor-pointer transition-colors"
          >
            <span>Skip waiting & go straight to matched results</span>
            <span className="text-sm">→</span>
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
