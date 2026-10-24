import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { AutoFillPage } from './pages/AutoFillPage.tsx';
import { TrackerPage } from './pages/TrackerPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ToastContainer, ToastMessage } from './components/ui/Toast.tsx';
import {
  Profile,
  Scheme,
  Application,
  User,
  ApplicationStatus,
} from './types/index.ts';
import { DEMO_PROFILE, DEMO_USER, MOCK_SCHEMES, INITIAL_APPLICATIONS } from './mockData.ts';
import {
  getProfile,
  updateProfile,
  startCrawl,
  getMatchedSchemes,
  getApplications,
  updateApplicationStatus,
} from './services/api.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentUser, setCurrentUser] = useState<User | null>(DEMO_USER);
  const [profile, setProfile] = useState<Profile>(DEMO_PROFILE);
  const [schemes, setSchemes] = useState<Scheme[]>(MOCK_SCHEMES);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [selectedSchemeForAutoFill, setSelectedSchemeForAutoFill] = useState<Scheme>(MOCK_SCHEMES[0]);
  const [savedSchemeIds, setSavedSchemeIds] = useState<Set<string>>(
    new Set(['uuid-5555-6666', 'uuid-3333-4444', 'uuid-1111-2222'])
  );

  // Crawler Live Progress State
  const [isCrawling, setIsCrawling] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string>('job-init');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'info' | 'error', title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial data loading on mount
  useEffect(() => {
    (async () => {
      try {
        const storedUser = localStorage.getItem('scholarpilot_user');
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        } else {
          setCurrentUser(DEMO_USER);
        }

        const prof = await getProfile();
        setProfile(prof);

        const loadedSchemes = await getMatchedSchemes();
        setSchemes(loadedSchemes);
        if (loadedSchemes.length > 0) {
          setSelectedSchemeForAutoFill(loadedSchemes[0]);
        }

        const apps = await getApplications();
        setApplications(apps);
        setSavedSchemeIds(new Set(apps.map((a) => a.scheme_id)));
      } catch (e) {
        console.warn('Initial data load fallback to mock', e);
      }
    })();
  }, []);

  // Handler: Start Crawl from Profile Form
  const handleSaveProfileAndStartCrawl = async (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    setIsLoadingData(true);
    try {
      await updateProfile(updatedProfile);
      addToast('success', 'Profile Updated', 'Initiating live portal search...');
      const { job_id } = await startCrawl();
      setActiveJobId(job_id);
      setIsCrawling(true);
    } catch (err: any) {
      addToast('error', 'Crawl start failed', err.message);
      setIsCrawling(false);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handler: Crawler Completed -> Transition to Dashboard
  const handleCrawlComplete = async () => {
    setIsCrawling(false);
    setActiveTab('dashboard');
    try {
      const freshSchemes = await getMatchedSchemes();
      setSchemes(freshSchemes);
      addToast('success', 'Crawling Complete ✦', `Found ${freshSchemes.length} matching scholarships.`);
    } catch (e) {
      console.warn('Error refreshing schemes', e);
    }
  };

  // Handler: Apply Scheme from Card
  const handleApplyScheme = (scheme: Scheme) => {
    setSelectedSchemeForAutoFill(scheme);
    setActiveTab('autofill');
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
    // Optimistic Update
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
          user_id: currentUser ? currentUser.id : 'usr-riya-2026',
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
    } catch (err) {
      // Rollback on failure
      setApplications(prevApps);
      addToast('error', 'Status Update Failed', 'Rolled back to previous column');
    }
  };

  // Handler: Form Submission in Auto-Fill
  const handleAutoFillSubmitted = async (schemeId: string) => {
    await handleUpdateApplicationStatus(schemeId, 'APPLIED');
    addToast('success', 'Application Recorded!', 'Redirected to official government portal.');
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('scholarpilot_jwt');
    localStorage.removeItem('scholarpilot_user');
    setCurrentUser(null);
    setActiveTab('home');
    addToast('info', 'Signed Out', 'You can sign back in or test as Riya anytime.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF6EE] text-[#1A1A1A] selection:bg-[#F9C6A5]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onNavigate={(tab) => {
          setIsCrawling(false);
          setActiveTab(tab);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
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
                onStart={() => setActiveTab('profile')}
                onExploreMatches={() => setActiveTab('dashboard')}
                onAutoFillDemo={() => setActiveTab('autofill')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfilePage
                initialProfile={profile}
                onSaveAndStartCrawl={handleSaveProfileAndStartCrawl}
                isEditMode={true}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardPage
                schemes={schemes}
                profile={profile}
                savedSchemeIds={savedSchemeIds}
                onApplyScheme={handleApplyScheme}
                onSaveToTracker={handleSaveToTracker}
                onGoToAutoFill={() => setActiveTab('autofill')}
                onGoToTracker={() => setActiveTab('tracker')}
                onReCrawl={() => handleSaveProfileAndStartCrawl(profile)}
                isLoading={isLoadingData}
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

            {activeTab === 'auth' && (
              <AuthPage
                onSuccess={(user) => {
                  setCurrentUser(user);
                  setActiveTab('dashboard');
                  addToast('success', `Welcome, ${user.full_name}!`, 'Signed into ScholarPilot.');
                }}
                onCancel={() => setActiveTab('home')}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={(tab) => setActiveTab(tab)} />

      {/* Sticky Note Styled Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
