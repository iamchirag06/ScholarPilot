import React, { useState, useMemo } from 'react';
import { Scheme, Profile } from '../types/index.ts';
import { SchemeCard } from '../components/SchemeCard.tsx';
import { formatINR, formatDisplayName } from '../mockData.ts';
import { HandUnderline } from '../components/decorative/HandUnderline.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Search, RefreshCw, AlertCircle, Edit3, ArrowRight } from 'lucide-react';

interface DashboardPageProps {
  schemes: Scheme[];
  profile: Profile;
  profileId?: string | number | null;
  savedSchemeIds: Set<string>;
  onApplyScheme: (scheme: Scheme) => void;
  onSaveToTracker: (scheme: Scheme) => void;
  onGoToAutoFill: () => void;
  onGoToTracker: () => void;
  onGoToEditProfile?: () => void;
  onReCrawl: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  schemes,
  profile,
  profileId,
  savedSchemeIds,
  onApplyScheme,
  onSaveToTracker,
  onGoToAutoFill,
  onGoToTracker,
  onGoToEditProfile,
  onReCrawl,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPortal, setSelectedPortal] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<number>(0);

  // Capitalized display name for user
  const displayName = useMemo(
    () => formatDisplayName(profile.fullName),
    [profile.fullName]
  );

  const totalGrantAmount = useMemo(() => {
    return schemes.reduce((sum, s) => sum + (s.award_amount || 0), 0);
  }, [schemes]);

  // Unique portals for filter chips
  const portalOptions = useMemo(() => {
    const list = Array.from(new Set(schemes.map((s) => s.source_portal || 'National Portal')));
    return ['ALL', ...list];
  }, [schemes]);

  // Filtered schemes
  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      const name = s.scheme_name || '';
      const provider = s.provider || '';
      const summary = s.llm_summary || '';
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        name.toLowerCase().includes(query) ||
        provider.toLowerCase().includes(query) ||
        summary.toLowerCase().includes(query);

      const matchesPortal =
        selectedPortal === 'ALL' || s.source_portal === selectedPortal;

      const matchesAmount = (s.award_amount || 0) >= minAmount;

      return matchesSearch && matchesPortal && matchesAmount;
    });
  }, [schemes, searchQuery, selectedPortal, minAmount]);

  return (
    <div className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header section with orange eyebrow and serif headline */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-[#E9E1D3]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="font-script text-2xl text-[#E8622C] font-bold tracking-wide transform -rotate-1">
              Welcome, {displayName || 'Scholar'} ✦
            </span>
            <span className="text-xs bg-[#EDF8F3] text-[#1F5A45] font-bold px-2.5 py-0.5 rounded-full border border-[#2F8F6B]/30">
              Personalized for {displayName || profile.fullName}
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] leading-tight text-balance">
            {schemes.length} Scholarships Worth{' '}
            <span className="relative inline-block text-[#1F5A45]">
              <span>{formatINR(totalGrantAmount)}</span>
              <HandUnderline color="#E8622C" />
            </span>{' '}
            Found for You, {displayName || profile.fullName}.
          </h1>

          <p className="mt-3 text-base sm:text-lg text-[#5E5A52] leading-relaxed">
            AI synthesized 500+ government eligibility clauses against your {profile.state} domicile, {profile.category} category, and {profile.courseLevel} studies.
          </p>
        </div>

        {/* Quick action buttons on top right */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onGoToEditProfile && (
            <Button
              variant="secondary"
              size="md"
              onClick={onGoToEditProfile}
              className="bg-[#FFFDF8]"
            >
              <Edit3 className="inline w-4 h-4 mr-1.5" />
              Edit Profile
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            onClick={onReCrawl}
            className="bg-[#FFFDF8]"
          >
            <RefreshCw className="inline w-4 h-4 mr-1.5" />
            Re-crawl Portals
          </Button>

          <Button
            variant="primary"
            size="md"
            showArrow
            onClick={onGoToTracker}
          >
            Open Tracker Board
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFDF8] rounded-2xl p-4 sm:p-5 border border-[#E9E1D3] shadow-xs mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5E5A52] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scheme name, provider, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FBF6EE] border border-[#E9E1D3] text-sm text-[#1A1A1A] placeholder:text-[#5E5A52]/70 focus:outline-none focus:ring-2 focus:ring-[#1F5A45]"
            />
          </div>

          {/* Portal Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#5E5A52] uppercase tracking-wider mr-1">
              Portal:
            </span>
            {portalOptions.map((portal) => {
              const isSelected = selectedPortal === portal;
              return (
                <button
                  key={portal}
                  type="button"
                  onClick={() => setSelectedPortal(portal)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1F5A45] text-white shadow-xs'
                      : 'bg-[#FBF6EE] text-[#5E5A52] hover:bg-[#E9E1D3]/50 hover:text-[#1A1A1A]'
                  }`}
                >
                  {portal === 'ALL' ? 'All Portals' : portal}
                </button>
              );
            })}
          </div>

          {/* Min Amount dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#5E5A52] uppercase tracking-wider whitespace-nowrap">
              Min Award:
            </span>
            <select
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-[#FBF6EE] border border-[#E9E1D3] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F5A45]"
            >
              <option value="0">Any Amount</option>
              <option value="15000">₹15,000+</option>
              <option value="50000">₹50,000+</option>
              <option value="100000">₹1,00,000+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State with Retry Button */}
      {!isLoading && error && (
        <div className="paper-card p-10 text-center max-w-lg mx-auto mb-10 border-[#D64545]/40 bg-[#FFFDF8]">
          <AlertCircle className="w-12 h-12 text-[#D64545] mx-auto mb-3" />
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-2">
            Could Not Load Scholarships
          </h3>
          <p className="text-sm text-[#5E5A52] mb-6">
            {error}
          </p>
          <div className="flex items-center justify-center gap-3">
            {onRetry && (
              <Button variant="primary" size="md" onClick={onRetry}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Retry Connection
              </Button>
            )}
            {onGoToEditProfile && (
              <Button variant="secondary" size="md" onClick={onGoToEditProfile}>
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="paper-card p-6 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E9E1D3] rounded-xl" />
                <div className="h-4 bg-[#E9E1D3] rounded w-28" />
              </div>
              <div className="h-6 bg-[#E9E1D3] rounded w-3/4" />
              <div className="h-8 bg-[#E9E1D3] rounded w-1/2" />
              <div className="h-16 bg-[#E9E1D3] rounded" />
              <div className="h-10 bg-[#E9E1D3] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Scheme Cards Grid */}
      {!isLoading && !error && filteredSchemes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredSchemes.map((scheme) => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              onApply={() => onApplyScheme(scheme)}
              onSaveToTracker={() => onSaveToTracker(scheme)}
              isSaved={savedSchemeIds.has(scheme.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredSchemes.length === 0 && (
        <div className="paper-card p-12 text-center max-w-lg mx-auto">
          <AlertCircle className="w-12 h-12 text-[#E8622C] mx-auto mb-3" />
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-2">
            No Matching Scholarships Found
          </h3>
          <p className="text-sm text-[#5E5A52] mb-6">
            Try adjusting your search query or portal filters, or update your profile criteria to explore more opportunities.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSearchQuery('');
                setSelectedPortal('ALL');
                setMinAmount(0);
              }}
            >
              Reset Filters
            </Button>
            {onGoToEditProfile && (
              <Button variant="primary" size="md" onClick={onGoToEditProfile}>
                Edit Eligibility Profile
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Demo Callout Banner */}
      <div className="mt-16 bg-[#F8E4E0] rounded-2xl p-6 sm:p-8 border border-[#E9E1D3] flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="font-script text-xl text-[#E8622C] font-bold block mb-1">
            Demo Highlight ✨
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-1">
            Ready to experience 1-click Auto-Fill?
          </h3>
          <p className="text-sm text-[#5E5A52] max-w-xl">
            Watch our simulated government portal form populates {displayName || profile.fullName}’s details, marks, and certificate status automatically in seconds.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          showArrow
          onClick={onGoToAutoFill}
          className="shrink-0"
        >
          Launch Auto-Fill Demo
        </Button>
      </div>
    </div>
  );
};
