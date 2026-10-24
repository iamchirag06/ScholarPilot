import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar, NavTab } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { AutoFillPage } from './pages/AutoFillPage.tsx';
import { TrackerPage } from './pages/TrackerPage.tsx';
import { ToastContainer, ToastMessage } from './components/ui/Toast.tsx';
import {
  Profile,
  Scheme,
  Application,
  ApplicationStatus,
} from './types/index.ts';
import { DEMO_PROFILE, MOCK_SCHEMES, INITIAL_APPLICATIONS, formatDisplayName } from './mockData.ts';
import {
  getProfile,
  createProfile,
  updateProfile,
  getMatchedSchemes,
  getApplications,
  updateApplicationStatus,
  startCrawl,
  ApiError,
} from './services/api.ts';

// Helper to parse current path and extract route and dynamic ID
function parseCurrentUrl(): { tab: NavTab; id: string | null } {
  if (typeof window === 'undefined') return { tab: 'home', id: null };
  const pathname = window.location.pathname;

  const dashboardMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  if (dashboardMatch) {
    return { tab: 'dashboard', id: dashboardMatch[1] };
  }
  if (pathname.startsWith('/dashboard')) {
    return { tab: 'dashboard', id: null };
  }
  if (pathname.startsWith('/profile') || pathname.startsWith('/onboarding')) {
    return { tab: 'profile', id: null };
  }
  if (pathname.startsWith('/autofill')) {
    return { tab: 'autofill', id: null };
  }
  if (pathname.startsWith('/tracker')) {
    return { tab: 'tracker', id: null };
  }
  return { tab: 'home', id: null };
}

export default function App() {
  const initialUrl = useMemo(() => parseCurrentUrl(), []);

  // Profile ID replaces JWT in localStorage
  const [profileId, setProfileId] = useState<string | number | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('scholarpilot_profile_id');
      return initialUrl.id || stored || null;
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    return initialUrl.tab;
  });

  const [profile, setProfile] = useState<Profile>(DEMO_PROFILE);
  const [schemes, setSchemes] = useState<Scheme[]>(MOCK_SCHEMES);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [selectedSchemeForAutoFill, setSelectedSchemeForAutoFill] = useState<Scheme>(MOCK_SCHEMES[0]);
  const [savedSchemeIds, setSavedSchemeIds] = useState<Set<string>>(
    new Set(['uuid-5555-6666', 'uuid-3333-4444', 'uuid-1111-2222'])
  );

  // Loading & Error states
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);

  // Crawler Live Progress State
  const [isCrawling, setIsCrawling] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string>('job-init');

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'info' | 'error', title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // URL Navigation helper
  const navigate = useCallback(
    (url: string, tab: NavTab, targetProfileId?: string | number | null) => {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', url);
      }
      if (targetProfileId !== undefined) {
        setProfileId(targetProfileId);
        if (targetProfileId) {
          localStorage.setItem('scholarpilot_profile_id', String(targetProfileId));
        } else {
          localStorage.removeItem('scholarpilot_profile_id');
        }
      }
      setIsCrawling(false);
      setActiveTab(tab);
    },
    []
  );

  // Listen to popstate (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      const { tab, id } = parseCurrentUrl();
      if (id) {
        setProfileId(id);
        localStorage.setItem('scholarpilot_profile_id', String(id));
      }
      setActiveTab(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch Dashboard Data for specific profile ID
  const loadDashboardData = useCallback(
    async (id: string | number) => {
      setIsLoadingData(true);
      setDashboardError(null);

      try {
        const [loadedProfile, loadedSchemes] = await Promise.all([
          getProfile(id),
          getMatchedSchemes(id),
        ]);

        setProfile(loadedProfile);
        setSchemes(loadedSchemes);
        if (loadedSchemes.length > 0) {
          setSelectedSchemeForAutoFill(loadedSchemes[0]);
        }
      } catch (err: any) {
        if (err.status === 404) {
          // If profile ID is not found (404), clear localStorage and send to onboarding
          if (typeof window !== 'undefined') {
            localStorage.removeItem('scholarpilot_profile_id');
          }
          setProfileId(null);
          navigate('/profile', 'profile');
          addToast('error', 'Profile Not Found (404)', 'Profile does not exist. Please create your profile.');
        } else {
          const msg = err.message || "Can't reach the server. Please try again.";
          setDashboardError(msg);
          addToast('error', 'Server Connection Error', msg);
        }
      } finally {
        setIsLoadingData(false);
      }
    },
    [navigate]
  );

  // Route Guard & Initial Load
  useEffect(() => {
    const { tab, id } = parseCurrentUrl();
    const storedId = typeof window !== 'undefined' ? localStorage.getItem('scholarpilot_profile_id') : null;
    const effectiveId = id || profileId || storedId;

    if (effectiveId && !profileId) {
      setProfileId(effectiveId);
    }

    // Route Guard: If navigating to dashboard/tracker/autofill without a profile id, redirect to onboarding
    if ((tab === 'dashboard' || tab === 'tracker' || tab === 'autofill') && !effectiveId) {
      addToast('info', 'Profile Required', 'Please complete your scholar profile first.');
      navigate('/profile', 'profile');
      return;
    }

    if (effectiveId && (tab === 'dashboard' || id)) {
      loadDashboardData(effectiveId);
    } else if (effectiveId && tab === 'profile') {
      // Prefill edit form
      getProfile(effectiveId)
        .then((p) => setProfile(p))
        .catch(() => {});
    }

    // Load initial applications for tracker
    getApplications()
      .then((apps) => {
        setApplications(apps);
        setSavedSchemeIds(new Set(apps.map((a) => a.scheme_id)));
      })
      .catch(() => {});
  }, [loadDashboardData, navigate]);

  // When profileId changes and user is on dashboard, reload data
  useEffect(() => {
    if (activeTab === 'dashboard' && profileId) {
      loadDashboardData(profileId);
    }
  }, [activeTab, profileId, loadDashboardData]);

  // Check if current profile view is in edit mode
  const isEditMode = Boolean(profileId && profile.id);

  // Handler: Save profile (Create or Update)
  const handleSaveProfile = async (formProfile: Profile) => {
    setIsSubmittingProfile(true);
    setProfileErrorMessage(null);

    try {
      if (isEditMode && profileId) {
        // Edit Mode: updateProfile sending ONLY changed fields
        const updated = await updateProfile(profileId, formProfile, profile);
        setProfile(updated);
        addToast('success', 'Profile Updated!', 'Your criteria and matched schemes have been refreshed.');
        navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
        loadDashboardData(profileId);
      } else {
        // Create Mode: createProfile
        const created = await createProfile(formProfile);
        setProfile(created);
        const newId = created.id!;
        setProfileId(newId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('scholarpilot_profile_id', String(newId));
        }
        addToast('success', 'Profile Created! ✦', `Welcome, ${created.fullName}!`);

        // Immediately redirect to /dashboard/{id}
        navigate(`/dashboard/${newId}`, 'dashboard', newId);
        loadDashboardData(newId);
      }
    } catch (err: any) {
      // Duplicate validation or network error: keep user on form, do NOT redirect
      const msg = err.message || "Can't reach the server. Please try again.";
      setProfileErrorMessage(msg);
      addToast('error', 'Profile Error', msg);
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // Handler: Dev Mode Quick Select Profile
  const handleSelectExistingProfile = async (selectedId: string | number) => {
    setProfileId(selectedId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('scholarpilot_profile_id', String(selectedId));
    }
    addToast('info', 'Profile Loaded', `Switched to Profile #${selectedId}`);
    navigate(`/dashboard/${selectedId}`, 'dashboard', selectedId);
    loadDashboardData(selectedId);
  };

  // Handler: Switch Profile (clears saved ID and returns to onboarding)
  const handleSwitchProfile = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('scholarpilot_profile_id');
    }
    setProfileId(null);
    setProfile(DEMO_PROFILE);
    navigate('/profile', 'profile', null);
    addToast('info', 'Profile Cleared', 'You can now set up a new profile or pick an existing test profile.');
  };

  // Handler: Start Crawl from Dashboard
  const handleStartCrawl = async () => {
    setIsLoadingData(true);
    try {
      const { job_id } = await startCrawl();
      setActiveJobId(job_id);
      setIsCrawling(true);
    } catch {
      setActiveJobId(`job-${Date.now()}`);
      setIsCrawling(true);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handler: Crawler Completed -> Transition to Dashboard
  const handleCrawlComplete = async () => {
    setIsCrawling(false);
    if (profileId) {
      navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
      loadDashboardData(profileId);
    } else {
      navigate('/dashboard', 'dashboard');
    }
    addToast('success', 'Crawl Completed ✦', 'Loaded updated scholarship matches.');
  };

  // Handler: Apply Scheme from Card
  const handleApplyScheme = (scheme: Scheme) => {
    setSelectedSchemeForAutoFill(scheme);
    navigate('/autofill', 'autofill');
    addToast('info', 'Switched to Auto-Fill', `Ready to populate ${scheme.scheme_name}`);
  };

  // Handler: Save Scheme to Tracker
  const handleSaveToTracker = async (scheme: Scheme) => {
    try {
      await updateApplicationStatus(scheme.id, 'ELIGIBLE');
      setSavedSchemeIds((prev) => new Set([...prev, scheme.id]));
      const updatedApps = await getApplications();
      setApplications(updatedApps);
      addToast('success', 'Saved to Tracker', `Added "${scheme.scheme_name}" to your Eligible column.`);
    } catch (err: any) {
      addToast('error', 'Failed to save', err.message);
    }
  };

  // Handler: Update Tracker Status (Kanban Drop or Advance)
  const handleUpdateApplicationStatus = async (
    schemeId: string,
    newStatus: ApplicationStatus
  ) => {
    const prevApps = [...applications];
    const existingIndex = applications.findIndex((a) => a.scheme_id === schemeId);
    let optimistic: Application[];

    if (existingIndex >= 0) {
      optimistic = applications.map((a, idx) =>
        idx === existingIndex
          ? {
              ...a,
              status: newStatus,
              applied_at: newStatus === 'APPLIED' ? new Date().toISOString() : a.applied_at,
            }
          : a
      );
    } else {
      optimistic = [
        ...applications,
        {
          id: `app-${Date.now()}`,
          user_id: String(profileId || 'default-user'),
          scheme_id: schemeId,
          status: newStatus,
          applied_at: newStatus === 'APPLIED' ? new Date().toISOString() : null,
        },
      ];
    }
    setApplications(optimistic);

    try {
      await updateApplicationStatus(schemeId, newStatus);
      const targetScheme = schemes.find((s) => s.id === schemeId);
      const title = targetScheme ? targetScheme.scheme_name : 'Scholarship';
      addToast('info', `Status Changed → ${newStatus}`, `Updated ${title}`);
    } catch {
      setApplications(prevApps);
      addToast('error', 'Status Update Failed', 'Rolled back to previous column');
    }
  };

  // Handler: Form Submission in Auto-Fill
  const handleAutoFillSubmitted = async (schemeId: string) => {
    await handleUpdateApplicationStatus(schemeId, 'APPLIED');
    addToast('success', 'Application Recorded!', 'Redirected to official government portal.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF6EE] text-[#1A1A1A] selection:bg-[#F9C6A5]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onNavigate={(tab, targetId) => {
          setIsCrawling(false);
          const idToUse = targetId || profileId;
          if (tab === 'dashboard' && idToUse) {
            navigate(`/dashboard/${idToUse}`, 'dashboard', idToUse);
          } else if (tab === 'dashboard' && !idToUse) {
            // Guard
            addToast('info', 'Profile Required', 'Please set up your profile first.');
            navigate('/profile', 'profile');
          } else if (tab === 'profile') {
            navigate('/profile', 'profile');
          } else if (tab === 'home') {
            navigate('/', 'home');
          } else {
            navigate(`/${tab}`, tab);
          }
        }}
        profileId={profileId}
        profileName={profile?.fullName}
        onSwitchProfile={handleSwitchProfile}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Render Crawler Progress if in active crawling state */}
        {isCrawling ? (
          <ProgressPage
            jobId={activeJobId}
            onComplete={handleCrawlComplete}
            onCancel={() => setIsCrawling(false)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <LandingPage
                onStart={() => {
                  if (profileId) {
                    navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
                  } else {
                    navigate('/profile', 'profile');
                  }
                }}
                onExploreMatches={() => {
                  if (profileId) {
                    navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
                  } else {
                    addToast('info', 'Profile Required', 'Please create your profile to explore matches.');
                    navigate('/profile', 'profile');
                  }
                }}
                onAutoFillDemo={() => navigate('/autofill', 'autofill')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfilePage
                initialProfile={profile}
                onSaveProfile={handleSaveProfile}
                isEditMode={isEditMode}
                onSelectExistingProfile={handleSelectExistingProfile}
                isSubmitting={isSubmittingProfile}
                errorMessage={profileErrorMessage}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardPage
                schemes={schemes}
                profile={profile}
                profileId={profileId}
                savedSchemeIds={savedSchemeIds}
                onApplyScheme={handleApplyScheme}
                onSaveToTracker={handleSaveToTracker}
                onGoToAutoFill={() => navigate('/autofill', 'autofill')}
                onGoToTracker={() => navigate('/tracker', 'tracker')}
                onGoToEditProfile={() => navigate('/profile', 'profile', profileId)}
                onReCrawl={handleStartCrawl}
                isLoading={isLoadingData}
                error={dashboardError}
                onRetry={() => {
                  if (profileId) {
                    loadDashboardData(profileId);
                  }
                }}
              />
            )}

            {activeTab === 'autofill' && (
              <AutoFillPage
                scheme={selectedSchemeForAutoFill}
                profile={profile}
                availableSchemes={schemes}
                onSelectScheme={(s) => setSelectedSchemeForAutoFill(s)}
                onSubmitApplication={handleAutoFillSubmitted}
              />
            )}

            {activeTab === 'tracker' && (
              <TrackerPage
                schemes={schemes}
                applications={applications}
                onUpdateStatus={handleUpdateApplicationStatus}
                onNavigateToAutoFill={handleApplyScheme}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={(tab) => {
          if (tab === 'dashboard' && profileId) {
            navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
          } else if (tab === 'profile') {
            navigate('/profile', 'profile');
          } else if (tab === 'home') {
            navigate('/', 'home');
          } else {
            navigate(`/${tab}`, tab as NavTab);
          }
        }}
      />

      {/* Sticky Note Styled Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
