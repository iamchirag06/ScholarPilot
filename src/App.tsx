import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar, NavTab } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { AutoFillPage } from './pages/AutoFillPage.tsx';
import { TrackerPage } from './pages/TrackerPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ChatbotPage } from './pages/ChatbotPage.tsx';
import { ToastContainer, ToastMessage } from './components/ui/Toast.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx';
import {
  Profile,
  Scheme,
  Application,
  ApplicationStatus,
  User,
} from './types/index.ts';
import { DEMO_PROFILE, MOCK_SCHEMES, INITIAL_APPLICATIONS, formatDisplayName, getStoredUsername } from './mockData.ts';
import {
  getProfile,
  getProfileByUserId,
  createProfile,
  updateProfile,
  getMatchedSchemes,
  createApplication,
  getUserApplications,
  updateApplicationStatus,
  getStoredUserId,
  clearAuthData,
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
  if (pathname.startsWith('/auth') || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    return { tab: 'auth', id: null };
  }
  if (pathname.startsWith('/chat') || pathname.startsWith('/chatbot')) {
    return { tab: 'chat', id: null };
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

  // Profile ID stored in localStorage ('scholarpilot_profile_id')
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

  // Current authenticated user session (from localStorage)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('scholarpilot_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
      const storedUserId = localStorage.getItem('scholarpilot_user_id');
      const storedUsername = localStorage.getItem('scholarpilot_username');
      if (storedUserId || storedUsername) {
        const name = storedUsername || 'Scholar';
        return {
          id: storedUserId || 'usr-local',
          userId: storedUserId || 'usr-local',
          email: `${name.toLowerCase()}@example.edu.in`,
          fullName: name,
        };
      }
    }
    return null;
  });

  const [profile, setProfile] = useState<Profile>(() => {
    const stored = getStoredUsername();
    return {
      ...DEMO_PROFILE,
      fullName: stored ? formatDisplayName(stored) : '',
    };
  });
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
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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

  // Automatically scroll to top whenever the active tab changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [activeTab]);

  // Listen to popstate (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      const { tab, id } = parseCurrentUrl();
      if (id) {
        setProfileId(id);
        localStorage.setItem('scholarpilot_profile_id', String(id));
      }
      setActiveTab(tab);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch Dashboard Data for specific profile ID & user ID
  const loadDashboardData = useCallback(
    async (id: string | number) => {
      setIsLoadingData(true);
      setDashboardError(null);

      try {
        const storedUserId = getStoredUserId() || currentUser?.id || String(id);
        const [loadedProfile, loadedSchemes] = await Promise.all([
          getProfile(id),
          getMatchedSchemes(storedUserId),
        ]);

        setProfile(loadedProfile);
        setSchemes(loadedSchemes);
        if (loadedSchemes.length > 0) {
          setSelectedSchemeForAutoFill(loadedSchemes[0]);
        }
      } catch (err: any) {
        if (err.status === 404) {
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
    [currentUser?.id, navigate]
  );

  // Route Guard & Initial Load
  useEffect(() => {
    const { tab, id } = parseCurrentUrl();
    const storedId = typeof window !== 'undefined' ? localStorage.getItem('scholarpilot_profile_id') : null;
    const effectiveId = id || profileId || storedId;

    if (effectiveId && !profileId) {
      setProfileId(effectiveId);
    }

    const uid = getStoredUserId() || currentUser?.id || currentUser?.userId;

    // If user is authenticated but profileId is missing, automatically fetch user's profile from DB
    if (uid && !effectiveId) {
      getProfileByUserId(uid)
        .then((existing) => {
          if (existing && existing.id) {
            setProfile(existing);
            setProfileId(existing.id);
            if (typeof window !== 'undefined') {
              localStorage.setItem('scholarpilot_profile_id', String(existing.id));
              if (existing.fullName) {
                localStorage.setItem('scholarpilot_username', existing.fullName);
              }
            }
            if (tab === 'dashboard' || id) {
              loadDashboardData(existing.id);
            }
          }
        })
        .catch(() => {});
    }

    // Route Guard: Before setting up profile, use authpage for signup and login
    if (tab === 'profile' && !currentUser && !effectiveId) {
      addToast('info', 'Sign In or Sign Up', 'Please create an account or sign in before setting up your profile.');
      navigate('/auth', 'auth');
      return;
    }

    // Route Guard: If navigating to dashboard/tracker/autofill without a profile id, redirect
    if ((tab === 'dashboard' || tab === 'tracker' || tab === 'autofill') && !effectiveId) {
      if (!currentUser) {
        addToast('info', 'Sign In Required', 'Please sign in or create an account first.');
        navigate('/auth', 'auth');
      } else {
        addToast('info', 'Profile Required', 'Please complete your scholar profile first.');
        navigate('/profile', 'profile');
      }
      return;
    }

    if (effectiveId && (tab === 'dashboard' || id)) {
      loadDashboardData(effectiveId);
    } else if (effectiveId && tab === 'profile') {
      getProfile(effectiveId)
        .then((p) => setProfile(p))
        .catch(() => {});
    }

    // Route 11: GET /api/applications/user/{userId}
    if (uid) {
      getUserApplications(uid)
        .then((apps) => {
          setApplications(apps);
          setSavedSchemeIds(new Set(apps.map((a) => a.scheme_id)));
        })
        .catch(() => {});
    }
  }, [currentUser, loadDashboardData, navigate, profileId]);

  // When profileId changes and user is on dashboard, reload data
  useEffect(() => {
    if (activeTab === 'dashboard' && profileId) {
      loadDashboardData(profileId);
    }
  }, [activeTab, profileId, loadDashboardData]);

  // Check if current profile view is in edit mode
  const isEditMode = Boolean(profileId && profile.id);

  // Handler: Save profile (Route 3: POST /api/profiles/create or Route 6: PUT /api/profiles/{id})
  const handleSaveProfile = async (formProfile: Profile) => {
    setIsSubmittingProfile(true);
    setProfileErrorMessage(null);

    try {
      if (isEditMode && profileId) {
        // Route 6: PUT /api/profiles/{id} sending ONLY changed fields
        const updated = await updateProfile(profileId, formProfile, profile);
        setProfile(updated);
        addToast('success', 'Profile Updated!', 'Your criteria and matched schemes have been refreshed.');
        navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
        loadDashboardData(profileId);
      } else {
        // Route 3: POST /api/profiles/create with userId
        const created = await createProfile(formProfile);
        setProfile(created);
        const newId = created.id!;
        setProfileId(newId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('scholarpilot_profile_id', String(newId));
        }
        addToast('success', 'Profile Created! ✦', `Welcome, ${created.fullName}! TinyFish is crawling portals for you.`);

        // Step 13: Call POST /api/crawl/start with urls: ["NSP", "Haryana", "AICTE", "Delhi"]
        let jId = `job-${Date.now()}`;
        try {
          const res = await startCrawl(['NSP', 'Haryana', 'AICTE', 'Delhi']);
          jId = res.job_id || jId;
        } catch {}
        setActiveJobId(jId);
        setIsCrawling(true);
      }
    } catch (err: any) {
      const msg = err.message || "Can't reach the server. Please try again.";
      setProfileErrorMessage(msg);
      addToast('error', 'Profile Error', msg);
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // Handler: Switch Profile / Sign Out
  const handleSwitchProfile = () => {
    clearAuthData();
    setProfileId(null);
    setCurrentUser(null);
    setProfile({
      ...DEMO_PROFILE,
      fullName: '',
    });
    setApplications([]);
    navigate('/auth', 'auth', null);
    addToast('info', 'Signed Out', 'You have been signed out. Please sign in or register to set up your profile.');
  };

  // Handler: Start Crawl from Dashboard (Route 13: POST /api/crawl/start)
  const handleStartCrawl = async () => {
    setIsLoadingData(true);
    try {
      const res = await startCrawl(['NSP', 'Haryana', 'AICTE', 'Delhi']);
      const jId = res.job_id || `job-${Date.now()}`;
      setActiveJobId(jId);
      setIsCrawling(true);
    } catch {
      setActiveJobId(`job-${Date.now()}`);
      setIsCrawling(true);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handler: Crawler Completed -> Fetch /api/schemes/matched/{userId} to show the final results
  const handleCrawlComplete = async () => {
    setIsCrawling(false);
    const uid = getStoredUserId() || currentUser?.id || profileId;
    if (uid) {
      try {
        const matched = await getMatchedSchemes(uid);
        setSchemes(matched);
        if (matched.length > 0) {
          setSelectedSchemeForAutoFill(matched[0]);
        }
      } catch (err) {
        console.warn('Failed to load matched schemes after crawl:', err);
      }
    }
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

  // Handler: Save Scheme to Tracker -> Route 10: POST /api/applications/create
  const handleSaveToTracker = async (scheme: Scheme) => {
    const userId = getStoredUserId() || currentUser?.id || 'usr-default';
    try {
      const existingApp = applications.find((a) => a.scheme_id === scheme.id);
      if (existingApp) {
        // Route 12: PUT /api/applications/{id}/status?newStatus=ELIGIBLE
        await updateApplicationStatus(existingApp.id, 'ELIGIBLE');
      } else {
        // Route 10: POST /api/applications/create
        await createApplication(userId, scheme.id, 'ELIGIBLE');
      }
      setSavedSchemeIds((prev) => new Set([...prev, scheme.id]));
      const updatedApps = await getUserApplications(userId);
      setApplications(updatedApps);
      addToast('success', 'Saved to Tracker', `Added "${scheme.scheme_name}" to your Eligible column.`);
    } catch (err: any) {
      addToast('error', 'Failed to save', err.message);
    }
  };

  // Handler: Update Tracker Status -> Route 12: PUT /api/applications/{id}/status?newStatus=...
  const handleUpdateApplicationStatus = async (
    schemeId: string,
    newStatus: ApplicationStatus
  ) => {
    const userId = getStoredUserId() || currentUser?.id || 'usr-default';
    const prevApps = [...applications];
    const existingApp = applications.find((a) => a.scheme_id === schemeId || a.id === schemeId);

    // Optimistic UI update
    let optimistic: Application[];
    if (existingApp) {
      optimistic = applications.map((a) =>
        a.id === existingApp.id
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
          user_id: userId,
          scheme_id: schemeId,
          status: newStatus,
          applied_at: newStatus === 'APPLIED' ? new Date().toISOString() : null,
        },
      ];
    }
    setApplications(optimistic);

    try {
      if (existingApp) {
        // Route 12: PUT /api/applications/{id}/status?newStatus={status}
        await updateApplicationStatus(existingApp.id, newStatus);
      } else {
        // Route 10: POST /api/applications/create
        await createApplication(userId, schemeId, newStatus);
      }

      // Refresh applications from backend
      const refreshed = await getUserApplications(userId);
      setApplications(refreshed);

      const targetScheme = schemes.find((s) => s.id === schemeId);
      const title = targetScheme ? targetScheme.scheme_name : 'Scholarship';
      addToast('info', `Status Changed → ${newStatus}`, `Updated ${title}`);
    } catch (err: any) {
      setApplications(prevApps);
      addToast('error', 'Status Update Failed', err.message || 'Rolled back to previous column');
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
            if (!currentUser) {
              addToast('info', 'Sign In Required', 'Please sign in or create an account first.');
              navigate('/auth', 'auth');
            } else {
              addToast('info', 'Profile Required', 'Please set up your profile first.');
              navigate('/profile', 'profile');
            }
          } else if (tab === 'profile') {
            if (!currentUser && !profileId) {
              navigate('/auth', 'auth');
            } else {
              navigate('/profile', 'profile');
            }
          } else if (tab === 'home') {
            navigate('/', 'home');
          } else {
            navigate(`/${tab}`, tab);
          }
        }}
        profileId={profileId}
        profileName={profile?.fullName || currentUser?.fullName}
        isAuthenticated={Boolean(currentUser || profileId)}
        onSwitchProfile={handleSwitchProfile}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        <ErrorBoundary>
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
                    } else if (currentUser) {
                      navigate('/profile', 'profile');
                    } else {
                      navigate('/auth', 'auth');
                    }
                  }}
                  onExploreMatches={() => {
                    if (profileId) {
                      navigate(`/dashboard/${profileId}`, 'dashboard', profileId);
                    } else if (currentUser) {
                      navigate('/profile', 'profile');
                    } else {
                      addToast('info', 'Sign In Required', 'Please sign in or create an account first.');
                      navigate('/auth', 'auth');
                    }
                  }}
                  onAutoFillDemo={() => navigate('/autofill', 'autofill')}
                />
              )}

              {activeTab === 'auth' && (
                <AuthPage
                  onSuccess={async (user) => {
                    setCurrentUser(user);
                    const formatted = formatDisplayName(user.fullName);
                    const uid = user.id || user.userId || getStoredUserId();

                    // Preload user's tracker applications
                    if (uid) {
                      getUserApplications(uid)
                        .then((apps) => {
                          setApplications(apps);
                          setSavedSchemeIds(new Set(apps.map((a) => a.scheme_id)));
                        })
                        .catch(() => {});
                    }

                    // Automatically fetch user's profile from DB by their userId
                    if (uid) {
                      try {
                        const existing = await getProfileByUserId(uid);
                        if (existing && existing.id) {
                          setProfile(existing);
                          setProfileId(existing.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('scholarpilot_profile_id', String(existing.id));
                            if (existing.fullName) {
                              localStorage.setItem('scholarpilot_username', existing.fullName);
                            }
                          }
                          addToast(
                            'success',
                            `Welcome back, ${formatDisplayName(existing.fullName || user.fullName)}!`,
                            'Found your profile in database. Details auto-filled!'
                          );
                          // Seamlessly navigate to dashboard with pre-filled profile
                          navigate(`/dashboard/${existing.id}`, 'dashboard', existing.id);
                          loadDashboardData(existing.id);
                          return;
                        }
                      } catch (err) {
                        console.warn('Could not auto-fetch profile on login:', err);
                      }
                    }

                    // Brand new user without an existing profile:
                    setProfile((prev) => ({
                      ...prev,
                      fullName: formatted,
                    }));
                    addToast('success', `Welcome, ${formatted}!`, 'Account ready! Now set up your scholar profile.');
                    navigate('/profile', 'profile');
                  }}
                  onCancel={() => navigate('/', 'home')}
                />
              )}

              {activeTab === 'profile' && (
                <ProfilePage
                  initialProfile={profile}
                  onSaveProfile={handleSaveProfile}
                  isEditMode={isEditMode}
                  username={getStoredUsername() ? formatDisplayName(getStoredUsername()) : null}
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

              {activeTab === 'chat' && (
                <ChatbotPage
                  userId={getStoredUserId() || currentUser?.id || profileId}
                  userName={profile?.fullName || currentUser?.fullName}
                />
              )}
            </>
          )}
        </ErrorBoundary>
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
