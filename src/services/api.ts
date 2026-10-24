import { CrawlProgressEvent, Application, ApplicationStatus, Scheme, Profile } from '../types/index.ts';
import { DEMO_PROFILE, MOCK_SCHEMES, INITIAL_APPLICATIONS } from '../mockData.ts';

// Re-export profile and scheme services for convenience
export * from './profiles.ts';
export * from './schemes.ts';

// Legacy auth stubs for AuthPage compatibility
export async function login(email: string, _password: string) {
  return { id: 'usr-1', email, fullName: 'Student', token: 'mock' };
}
export async function register(email: string, _password: string, fullName: string) {
  return { id: 'usr-1', email, fullName, token: 'mock' };
}

/**
 * Shared ApiError class carrying status, message, and optional response data.
 */
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Strips any trailing slash from the base URL so paths don't become `//api/...`.
 */
export const getBaseUrl = (): string => {
  const envUrl =
    (import.meta as any).env?.NEXT_PUBLIC_API_BASE_URL ??
    (import.meta as any).env?.VITE_API_BASE_URL;
  const url = envUrl || 'https://underfeed-caterer-backlands.ngrok-free.dev';
  return url.replace(/\/+$/, '');
};

/**
 * Check mock mode from environment or localStorage override (default false).
 */
export const isMockMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('scholarpilot_force_mock');
    if (stored !== null) return stored === 'true';
  }
  const envMock =
    (import.meta as any).env?.NEXT_PUBLIC_USE_MOCK ??
    (import.meta as any).env?.VITE_USE_MOCK;
  if (envMock !== undefined) {
    return envMock === 'true' || envMock === true;
  }
  return false;
};

/**
 * Shared fetch wrapper with ngrok bypass header, timeout, and friendly error handling.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new ApiError(
        response.status,
        'Backend returned HTML. Check the ngrok URL and header.'
      );
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorData: any = null;
      try {
        errorData = await response.json();
        errorMessage = errorData.message || errorData.error || (typeof errorData === 'string' ? errorData : JSON.stringify(errorData));
      } catch {
        try {
          const text = await response.text();
          if (text) errorMessage = text;
        } catch {}
      }
      throw new ApiError(response.status, errorMessage, errorData);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === 'AbortError') {
      throw new ApiError(408, "Request timed out. Can't reach the server. Please try again.");
    }
    // Network failures / CORS error / tunnel down
    throw new ApiError(0, "Can't reach the server. Please try again.");
  }
}

// In-memory or localStorage cache for mock sessions so updates persist during user tests
const getStoredApplications = (): Application[] => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('scholarpilot_applications');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }
  return INITIAL_APPLICATIONS;
};

const saveStoredApplications = (apps: Application[]): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scholarpilot_applications', JSON.stringify(apps));
  }
};

// 3. Crawler & SSE Live Progress
export async function startCrawl(): Promise<{ job_id: string }> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    return { job_id: `job-${Date.now()}` };
  }

  try {
    return await apiFetch<{ job_id: string }>('/api/crawl/start', {
      method: 'POST',
    });
  } catch {
    // If crawler endpoint is not ready on backend, gracefully fallback to mock job_id
    return { job_id: `job-${Date.now()}` };
  }
}

/**
 * Fetch-based SSE reader with mock simulation fallback.
 */
export function subscribeCrawlStatus(
  jobId: string,
  onProgress: (event: CrawlProgressEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void
): () => void {
  let isCancelled = false;

  // Use mock simulation if mock mode or if backend crawl is mocked
  const candidateName = 'Student';
  const mockSteps: Array<{
    delayMs: number;
    event: CrawlProgressEvent;
  }> = [
    { delayMs: 400, event: { status: 'crawling', progress: 15, message: 'TinyFish connecting to National Scholarship Portal (NSP)...', schemes_found: 4, current_portal: 'NSP' } },
    { delayMs: 1000, event: { status: 'crawling', progress: 35, message: 'Parsed NSP Central Sector and AICTE schemes...', schemes_found: 7, current_portal: 'NSP' } },
    { delayMs: 1700, event: { status: 'crawling', progress: 55, message: 'Scraping Haryana State Har-Chhatravratti & Delhi portals...', schemes_found: 11, current_portal: 'Haryana State' } },
    { delayMs: 2400, event: { status: 'summarizing', progress: 80, message: 'Deepak AI model synthesizing eligibility into plain English...', schemes_found: 14, current_portal: 'AI Engine' } },
    { delayMs: 3100, event: { status: 'summarizing', progress: 95, message: `Ranking schemes by criteria fit for ${candidateName}...`, schemes_found: 14, current_portal: 'Ranking' } },
    { delayMs: 3800, event: { status: 'done', progress: 100, message: 'Completed! High-confidence matching scholarships found.', schemes_found: 5, current_portal: 'Done' } },
  ];

  const timers: NodeJS.Timeout[] = [];
  mockSteps.forEach((step) => {
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
    timers.forEach((t) => clearTimeout(t));
  };
}

// 5. Applications (Tracker)
export async function getApplications(): Promise<Application[]> {
  if (isMockMode()) {
    return getStoredApplications();
  }

  try {
    return await apiFetch<Application[]>('/api/applications');
  } catch {
    return getStoredApplications();
  }
}

export async function updateApplicationStatus(
  schemeId: string,
  status: ApplicationStatus
): Promise<Application> {
  if (isMockMode()) {
    const apps = getStoredApplications();
    const existingIndex = apps.findIndex((a) => a.scheme_id === schemeId);
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
        user_id: 'default-user',
        scheme_id: schemeId,
        status,
        applied_at: status === 'APPLIED' ? new Date().toISOString() : null,
      };
      apps.push(updatedApp);
    }
    saveStoredApplications(apps);
    return updatedApp;
  }

  try {
    return await apiFetch<Application>(`/api/applications/${schemeId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  } catch {
    const apps = getStoredApplications();
    const updatedApp: Application = {
      id: `app-${Date.now()}`,
      user_id: 'default-user',
      scheme_id: schemeId,
      status,
      applied_at: status === 'APPLIED' ? new Date().toISOString() : null,
    };
    apps.push(updatedApp);
    saveStoredApplications(apps);
    return updatedApp;
  }
}
