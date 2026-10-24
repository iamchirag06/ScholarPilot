import React, { useState, useMemo } from 'react';
import { Application, Scheme, ApplicationStatus } from '../types/index.ts';
import { formatINR, getDeadlineUrgency } from '../mockData.ts';
import { HandUnderline } from '../components/decorative/HandUnderline.tsx';
import { Scribble } from '../components/decorative/Scribble.tsx';
import { Button } from '../components/ui/Button.tsx';
import confetti from 'canvas-confetti';
import {
  Clock,
  Sparkles,
  Award,
  GripVertical,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface TrackerPageProps {
  schemes: Scheme[];
  applications: Application[];
  onUpdateStatus: (schemeId: string, newStatus: ApplicationStatus) => Promise<void>;
  onNavigateToAutoFill: (scheme: Scheme) => void;
}

const COLUMNS: Array<{
  id: ApplicationStatus;
  label: string;
  headerBg: string;
  borderColor: string;
}> = [
  { id: 'ELIGIBLE', label: 'Eligible', headerBg: '#F3DE9A', borderColor: '#E5CD7E' },
  { id: 'APPLIED', label: 'Applied', headerBg: '#F9C6A5', borderColor: '#F2AE81' },
  { id: 'PENDING', label: 'Pending Review', headerBg: '#F6B7C1', borderColor: '#EE94A4' },
  { id: 'APPROVED', label: 'Approved ✦', headerBg: '#A9DCC3', borderColor: '#81C7A5' },
  { id: 'REJECTED', label: 'Rejected', headerBg: '#E9E1D3', borderColor: '#D3C8B5' },
];

export const TrackerPage: React.FC<TrackerPageProps> = ({
  schemes,
  applications,
  onUpdateStatus,
  onNavigateToAutoFill,
}) => {
  const [draggedSchemeId, setDraggedSchemeId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [stampAnimationId, setStampAnimationId] = useState<string | null>(null);

  // Map scheme ID to scheme object
  const schemeMap = useMemo(() => {
    const map = new Map<string, Scheme>();
    schemes.forEach((s) => map.set(s.id, s));
    return map;
  }, [schemes]);

  // Group applications by status column
  const groupedApps = useMemo(() => {
    const groups: Record<ApplicationStatus, Application[]> = {
      ELIGIBLE: [],
      APPLIED: [],
      PENDING: [],
      APPROVED: [],
      REJECTED: [],
    };

    applications.forEach((app) => {
      if (groups[app.status]) {
        groups[app.status].push(app);
      }
    });

    return groups;
  }, [applications]);

  // Total potential pipeline award
  const totalPotentialAward = useMemo(() => {
    return applications
      .filter((a) => a.status !== 'REJECTED')
      .reduce((sum, app) => {
        const sch = schemeMap.get(app.scheme_id);
        return sum + (sch ? sch.award_amount : 0);
      }, 0);
  }, [applications, schemeMap]);

  // Total secured approved award
  const totalApprovedAward = useMemo(() => {
    return applications
      .filter((a) => a.status === 'APPROVED')
      .reduce((sum, app) => {
        const sch = schemeMap.get(app.scheme_id);
        return sum + (sch ? sch.award_amount : 0);
      }, 0);
  }, [applications, schemeMap]);

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, schemeId: string) => {
    e.dataTransfer.setData('text/plain', schemeId);
    setDraggedSchemeId(schemeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: ApplicationStatus) => {
    e.preventDefault();
    const schemeId = e.dataTransfer.getData('text/plain') || draggedSchemeId;
    setDraggedSchemeId(null);

    if (!schemeId) return;

    // Check if card is already in this status
    const currentApp = applications.find((a) => a.scheme_id === schemeId);
    if (currentApp && currentApp.status === targetStatus) return;

    if (targetStatus === 'APPROVED') {
      // Confetti burst!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1F5A45', '#E8622C', '#2F8F6B', '#F3DE9A'],
      });
      setStampAnimationId(schemeId);
      setTimeout(() => setStampAnimationId(null), 1500);
    }

    setIsUpdating(true);
    try {
      await onUpdateStatus(schemeId, targetStatus);
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick move status handler for buttons / mobile
  const handleQuickMove = async (schemeId: string, nextStatus: ApplicationStatus) => {
    if (nextStatus === 'APPROVED') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1F5A45', '#E8622C', '#2F8F6B', '#F3DE9A'],
      });
      setStampAnimationId(schemeId);
      setTimeout(() => setStampAnimationId(null), 1500);
    }
    await onUpdateStatus(schemeId, nextStatus);
  };

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header section with total potential award counter in handwritten style */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-[#E9E1D3]">
        <div>
          <span className="font-script text-2xl text-[#E8622C] font-bold block mb-1">
            Application Pipeline ✦
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] tracking-tight">
            Scholarship Tracker Board
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#5E5A52]">
            Drag and drop cards across columns to keep your government deadlines and grant reviews organized.
          </p>
        </div>

        {/* Total potential award counter in handwritten style */}
        <div className="bg-[#FFFDF8] rounded-2xl p-4 sm:p-5 border border-[#E9E1D3] shadow-xs flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-[#F8E4E0] flex items-center justify-center text-[#E8622C] shrink-0 transform -rotate-3">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="font-script text-lg text-[#E8622C] font-bold block leading-none">
              Total Potential in Pipeline:
            </span>
            <div className="font-serif text-2xl sm:text-3xl font-extrabold text-[#1F5A45] tabular-nums mt-0.5">
              {formatINR(totalPotentialAward)}
            </div>
            {totalApprovedAward > 0 && (
              <span className="text-[11px] text-[#2F8F6B] font-bold block">
                ✓ {formatINR(totalApprovedAward)} Secured in Approved!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board with 5 Columns (Horizontal Scroll on Mobile) */}
      <div className="overflow-x-auto pb-6 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-5 min-w-[1050px]">
          {COLUMNS.map((col) => {
            const apps = groupedApps[col.id] || [];

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex-1 bg-[#FBF6EE] rounded-2xl border border-[#E9E1D3] flex flex-col min-h-[580px] p-3 shadow-xs"
              >
                {/* Column Header */}
                <div
                  className="p-3 rounded-xl border mb-3 flex items-center justify-between shadow-xs select-none"
                  style={{
                    backgroundColor: col.headerBg,
                    borderColor: col.borderColor,
                  }}
                >
                  <span className="font-serif font-bold text-sm text-[#1A1A1A] tracking-tight">
                    {col.label}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-[#1A1A1A]/10 text-[#1A1A1A] text-xs font-bold flex items-center justify-center font-mono">
                    {apps.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3.5">
                  {apps.length === 0 && (
                    <div className="h-32 rounded-xl border border-dashed border-[#E9E1D3] flex items-center justify-center text-xs text-[#5E5A52]/60 p-4 text-center">
                      Drop scholarship here
                    </div>
                  )}

                  {apps.map((app, idx) => {
                    const scheme = schemeMap.get(app.scheme_id);
                    if (!scheme) return null;

                    const urgency = getDeadlineUrgency(scheme.deadline);
                    const rotation = (idx % 2 === 0 ? 0.8 : -0.8);
                    const isApprovedStamping = stampAnimationId === scheme.id;

                    return (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, scheme.id)}
                        style={{
                          transform: `rotate(${rotation}deg)`,
                        }}
                        className={`paper-card p-4 relative cursor-grab active:cursor-grabbing border border-[#E9E1D3] hover:rotate-0 hover:scale-[1.02] transition-all select-none group shadow-xs ${
                          draggedSchemeId === scheme.id ? 'opacity-40' : ''
                        }`}
                      >
                        {/* Tape Strip top detail */}
                        <div
                          className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-10 h-3.5 bg-white/70 border border-black/5 rounded-xs pointer-events-none"
                          style={{ backdropFilter: 'blur(2px)' }}
                        />

                        {/* Approved Stamp effect */}
                        {isApprovedStamping && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 rounded-xl animate-bounce">
                            <span className="px-3 py-1 rounded border-2 border-[#2F8F6B] text-[#2F8F6B] font-serif font-extrabold text-base tracking-widest uppercase transform -rotate-12">
                              APPROVED ✓
                            </span>
                          </div>
                        )}

                        {/* Top: Portal and Drag handle */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8622C]">
                            {scheme.source_portal}
                          </span>
                          <GripVertical className="w-3.5 h-3.5 text-[#5E5A52]/50 group-hover:text-[#1A1A1A]" />
                        </div>

                        {/* Scheme Title */}
                        <h4 className="font-serif text-sm font-bold text-[#1A1A1A] leading-snug mb-1 line-clamp-2">
                          {scheme.scheme_name}
                        </h4>

                        <div className="text-xs text-[#5E5A52] mb-2 truncate">
                          {scheme.provider}
                        </div>

                        {/* Amount */}
                        <div className="font-serif font-bold text-base text-[#1F5A45] mb-2.5">
                          {formatINR(scheme.award_amount)}
                        </div>

                        {/* Urgency Badge */}
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border mb-3"
                          style={{
                            backgroundColor: urgency.bg,
                            color: urgency.color,
                            borderColor: `${urgency.color}30`,
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{urgency.label}</span>
                        </div>

                        {/* Card bottom actions */}
                        <div className="pt-2 border-t border-[#E9E1D3] flex items-center justify-between text-xs">
                          {col.id === 'ELIGIBLE' && (
                            <button
                              onClick={() => onNavigateToAutoFill(scheme)}
                              className="text-[11px] font-bold text-[#E8622C] hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Auto-Fill</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}

                          {/* Quick stage advance for touch/mobile */}
                          <div className="flex items-center gap-1 ml-auto">
                            {col.id !== 'APPROVED' && (
                              <button
                                onClick={() => {
                                  const order: ApplicationStatus[] = [
                                    'ELIGIBLE',
                                    'APPLIED',
                                    'PENDING',
                                    'APPROVED',
                                  ];
                                  const currentIdx = order.indexOf(col.id);
                                  if (currentIdx >= 0 && currentIdx < order.length - 1) {
                                    handleQuickMove(scheme.id, order[currentIdx + 1]);
                                  }
                                }}
                                className="px-2 py-0.5 rounded bg-[#FBF6EE] hover:bg-[#E9E1D3] text-[10px] font-bold text-[#1A1A1A] border border-[#E9E1D3] cursor-pointer"
                              >
                                Advance →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
