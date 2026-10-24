import { Profile, Scheme, Application, CrawlProgressEvent, User, ApplicationStatus } from '../types/index.ts';
import { DEMO_USER, DEMO_PROFILE, MOCK_SCHEMES, INITIAL_APPLICATIONS } from '../mockData.ts';

// Check mock mode from environment or localStorage override (default true)
const isMockMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('scholarpilot_force_mock');
    if (stored !== null) return stored === 'true';
  }
  const envMock = (import.meta as any).env?.VITE_USE_MOCK ?? (import.meta as any).env?.NEXT_PUBLIC_USE_MOCK;
  if (envMock !== undefined) {
    return envMock === 'true' || envMock === true;
  }
  return true;
};

const getBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL ?? (import.meta as any).env?.NEXT_PUBLIC_API_BASE_URL;
  return envUrl || 'http://localhost:8080';
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const randomDelay = () => delay(Math.floor(Math.random() * 500) + 300);

// In-memory or localStorage cache for mock sessions so updates persist during user tests
const getStoredProfile = (): Profile => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('scholarpilot_profile');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
  }
  return DEMO_PROFILE;
};

const saveStoredProfile = (profile: Profile): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scholarpilot_profile', JSON.stringify(profile));
  }
};

const getStoredApplications = (): Application[] => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('scholarpilot_applications');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
  }
  return INITIAL_APPLICATIONS;
};

const saveStoredApplications = (apps: Application[]): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scholarpilot_applications', JSON.stringify(apps));
  }
};

function getAuthHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('scholarpilot_jwt') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 1. Auth
export async function login(email: string, _password: string): Promise<User> {
  if (isMockMode()) {
    await randomDelay();
    const user: User = {
      ...DEMO_USER,
      email: email || DEMO_USER.email,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('scholarpilot_jwt', user.token!);
      localStorage.setItem('scholarpilot_user', JSON.stringify(user));
    }
    return user;
  }

  const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: _password }),
  });
  if (!res.ok) throw new Error('Invalid email or password');
  const data = await res.json();
  if (typeof window !== 'undefined' && data.token) {
    localStorage.setItem('scholarpilot_jwt', data.token);
    localStorage.setItem('scholarpilot_user', JSON.stringify(data.user || data));
  }
  return data;
}

export async function register(email: string, _password: string, fullName: string): Promise<User> {
  if (isMockMode()) {
    await randomDelay();
    const user: User = {
      id: `usr-${Date.now()}`,
      email,
      full_name: fullName || 'Student',
      token: `mock-jwt-${Date.now()}`,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('scholarpilot_jwt', user.token!);
      localStorage.setItem('scholarpilot_user', JSON.stringify(user));
    }
    return user;
  }

  const res = await fetch(`${getBaseUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: _password, full_name: fullName }),
  });
  if (!res.ok) throw new Error('Registration failed');
  const data = await res.json();
  if (typeof window !== 'undefined' && data.token) {
    localStorage.setItem('scholarpilot_jwt', data.token);
    localStorage.setItem('scholarpilot_user', JSON.stringify(data.user || data));
  }
  return data;
}

// 2. Profile
export async function getProfile(): Promise<Profile> {
  if (isMockMode()) {
    await randomDelay();
    return getStoredProfile();
  }

  const res = await fetch(`${getBaseUrl()}/api/profile`, {
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function updateProfile(profile: Profile): Promise<Profile> {
  if (isMockMode()) {
    await randomDelay();
    saveStoredProfile(profile);
    return profile;
  }

  const res = await fetch(`${getBaseUrl()}/api/profile`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

// 3. Crawler & SSE Live Progress
export async function startCrawl(): Promise<{ job_id: string }> {
  if (isMockMode()) {
    await randomDelay();
    return { job_id: `job-${Date.now()}` };
  }

  const res = await fetch(`${getBaseUrl()}/api/crawl/start`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to start crawler job');
  return res.json();
}

/**
 * Fetch-based SSE reader with mock simulation fallback.
 * Allows sending Authorization headers unlike native browser EventSource.
 */
export function subscribeCrawlStatus(
  jobId: string,
  onProgress: (event: CrawlProgressEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void
): () => void {
  let isCancelled = false;

  if (isMockMode()) {
    // Simulated timeline:
    // 0-30% NSP -> 30-55% Haryana State -> 55-70% Delhi State -> 70-95% Summarizing -> Done
    const mockSteps: Array<{
      delayMs: number;
      event: CrawlProgressEvent;
    }> = [
      { delayMs: 400, event: { status: 'crawling', progress: 12, message: 'TinyFish connecting to National Scholarship Portal (NSP)...', schemes_found: 4, current_portal: 'NSP' } },
      { delayMs: 1100, event: { status: 'crawling', progress: 28, message: 'Parsed NSP Central Sector and AICTE schemes...', schemes_found: 7, current_portal: 'NSP' } },
      { delayMs: 1900, event: { status: 'crawling', progress: 42, message: 'Scraping Haryana State Har-Chhatravratti portal...', schemes_found: 11, current_portal: 'Haryana State' } },
      { delayMs: 2700, event: { status: 'crawling', progress: 58, message: 'Checking Delhi e-District & Private trust foundations...', schemes_found: 14, current_portal: 'Delhi State' } },
      { delayMs: 3500, event: { status: 'summarizing', progress: 75, message: 'Deepak AI model synthesizing eligibility into plain English...', schemes_found: 16, current_portal: 'AI Engine' } },
      { delayMs: 4400, event: { status: 'summarizing', progress: 92, message: 'Ranking schemes by criteria fit for Riya (SC, Haryana, UG)...', schemes_found: 16, current_portal: 'Ranking' } },
      { delayMs: 5200, event: { status: 'done', progress: 100, message: 'Completed! 5 high-confidence matching scholarships found.', schemes_found: 5, current_portal: 'Done' } },
    ];

    const timers: NodeJS.Timeout[] = [];
    mockSteps.forEach(step => {
      const timer = setTimeout(() => {
        if (isCancelled) return;
        onProgress(step.event);
        if (step.event.status === 'done') {
          onComplete();
        }
      }, step.delayMs);
      timers.push(timer);
    });

    return () => {
      isCancelled = true;
      timers.forEach(t => clearTimeout(t));
    };
  }

  // Real Backend SSE stream with fetch reader
  const abortController = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/crawl/status/${jobId}`, {
        headers: {
          ...getAuthHeader(),
          Accept: 'text/event-stream',
        },
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE stream connection failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const dataLine = block.split('\n').find(l => l.startsWith('data:'));
          if (dataLine) {
            try {
              const parsed: CrawlProgressEvent = JSON.parse(dataLine.replace(/^data:\s*/, ''));
              onProgress(parsed);
              if (parsed.status === 'done') {
                onComplete();
                return;
              }
            } catch (e) {
              console.warn('Failed parsing SSE payload', e);
            }
          }
        }
      }
    } catch (err: any) {
      if (!isCancelled && err.name !== 'AbortError') {
        onError(err);
      }
    }
  })();

  return () => {
    isCancelled = true;
    abortController.abort();
  };
}

// 4. Matched Schemes
export async function getMatchedSchemes(): Promise<Scheme[]> {
  if (isMockMode()) {
    await randomDelay();
    return MOCK_SCHEMES;
  }

  const res = await fetch(`${getBaseUrl()}/api/schemes/matched`, {
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch matched schemes');
  return res.json();
}

// 5. Applications (Tracker)
export async function getApplications(): Promise<Application[]> {
  if (isMockMode()) {
    await randomDelay();
    return getStoredApplications();
  }

  const res = await fetch(`${getBaseUrl()}/api/applications`, {
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to fetch applications');
  return res.json();
}

export async function updateApplicationStatus(
  schemeId: string,
  status: ApplicationStatus
): Promise<Application> {
  if (isMockMode()) {
    await randomDelay();
    const apps = getStoredApplications();
    const existingIndex = apps.findIndex(a => a.scheme_id === schemeId);
    let updatedApp: Application;

    if (existingIndex >= 0) {
      updatedApp = {
        ...apps[existingIndex],
        status,
        applied_at: status === 'APPLIED' ? new Date().toISOString() : apps[existingIndex].applied_at,
      };
      apps[existingIndex] = updatedApp;
    } else {
      updatedApp = {
        id: `app-${Date.now()}`,
        user_id: DEMO_USER.id,
        scheme_id: schemeId,
        status,
        applied_at: status === 'APPLIED' ? new Date().toISOString() : null,
      };
      apps.push(updatedApp);
    }
    saveStoredApplications(apps);
    return updatedApp;
  }

  const res = await fetch(`${getBaseUrl()}/api/applications/${schemeId}`, {
    method: 'PUT',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update application status');
  return res.json();
}
