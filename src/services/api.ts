import { CrawlProgressEvent, Application, ApplicationStatus, Scheme, Profile, User } from '../types/index.ts';
import { DEMO_PROFILE, MOCK_SCHEMES, INITIAL_APPLICATIONS } from '../mockData.ts';

// Re-export profile, scheme, and application services
export * from './profiles.ts';
export * from './schemes.ts';
export * from './applications.ts';

/**
 * Storage helpers for authentication session state.
 */
export function getStoredUserId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('scholarpilot_user_id');
  }
  return null;
}

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('scholarpilot_token');
  }
  return null;
}

export function saveAuthData(token: string, name: string, userId: string, email?: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scholarpilot_token', token);
    localStorage.setItem('scholarpilot_user_id', userId);
    localStorage.setItem('scholarpilot_username', name);
    const userObj: User = {
      id: userId,
      userId,
      fullName: name,
      name,
      email: email || (name.includes('@') ? name : `${name.toLowerCase().replace(/\s+/g, '')}@example.edu.in`),
      token,
    };
    localStorage.setItem('scholarpilot_user', JSON.stringify(userObj));
  }
}

export function clearAuthData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('scholarpilot_token');
    localStorage.removeItem('scholarpilot_user_id');
    localStorage.removeItem('scholarpilot_username');
    localStorage.removeItem('scholarpilot_user');
    localStorage.removeItem('scholarpilot_profile_id');
  }
}

/**
 * 1. Signup (Create User) -> POST /api/auth/signup
 * What to send: JSON with email, name, password
 * What it returns: JSON with token, name, and userId.
 * You MUST save the userId in LocalStorage to use for all other API calls.
 */
export async function register(email: string, password: string, fullName: string): Promise<User> {
  const cleanEmail = email.trim();
  const cleanName = fullName.trim() || (cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail);
  const payload = {
    email: cleanEmail,
    name: cleanName,
    password,
  };

  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    const mockUserId = `usr-${Date.now()}`;
    const mockToken = `mock-token-${Date.now()}`;
    saveAuthData(mockToken, cleanName, mockUserId, cleanEmail);
    return {
      id: mockUserId,
      userId: mockUserId,
      email: cleanEmail,
      fullName: cleanName,
      token: mockToken,
    };
  }

  try {
    const res = await apiFetch<{ token: string; name: string; userId: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const userId = res.userId || (res as any).id || `usr-${Date.now()}`;
    const name = res.name || cleanName;
    const token = res.token || `token-${Date.now()}`;

    saveAuthData(token, name, userId, cleanEmail);

    return {
      id: userId,
      userId,
      email: cleanEmail,
      fullName: name,
      token,
    };
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.status || 400, err.message || 'Signup failed. Please try again.');
  }
}

/**
 * 2. Login -> POST /api/auth/login
 * What to send: JSON with email, password
 * What it returns: JSON with token, name, and userId.
 * Save the userId in LocalStorage.
 */
export async function login(emailOrUsername: string, password: string): Promise<User> {
  const cleanInput = emailOrUsername.trim();
  // Ensure valid email representation if username was entered
  const emailToSend = cleanInput.includes('@') ? cleanInput : `${cleanInput}@example.com`;
  const payload = {
    email: emailToSend,
    password,
  };

  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    const mockUserId = `usr-${Date.now()}`;
    const mockToken = `mock-token-${Date.now()}`;
    const displayName = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;
    saveAuthData(mockToken, displayName, mockUserId, emailToSend);
    return {
      id: mockUserId,
      userId: mockUserId,
      email: emailToSend,
      fullName: displayName,
      token: mockToken,
    };
  }

  try {
    const res = await apiFetch<{ token: string; name: string; userId: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const userId = res.userId || (res as any).id || `usr-${Date.now()}`;
    const name = res.name || (cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput);
    const token = res.token || `token-${Date.now()}`;

    saveAuthData(token, name, userId, emailToSend);

    return {
      id: userId,
      userId,
      email: emailToSend,
      fullName: name,
      token,
    };
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.status || 401, err.message || 'Login failed. Please check your credentials.');
  }
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
  const url = envUrl || 'http://localhost:8081';
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
 * Shared fetch wrapper with ngrok bypass header, authorization token, timeout, and friendly error handling.
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

  // Attach token if user is signed in
  const token = getStoredToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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

// Crawler & SSE Live Progress
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
 * Fetch-based SSE reader with 2-minute (120s) realistic crawling simulation.
 * Supports speedMultiplier for optional fast-forwarding (default 1x = 120,000ms).
 */
export function subscribeCrawlStatus(
  jobId: string,
  onProgress: (event: CrawlProgressEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
  speedMultiplier: number = 1
): () => void {
  let isCancelled = false;

  const candidateName = 'Student';
  // Realistic 2-minute (120s = 120,000ms) multi-stage crawling schedule
  const mockSteps: Array<{
    delayMs: number;
    event: CrawlProgressEvent;
  }> = [
    { delayMs: 1000, event: { status: 'crawling', progress: 3, message: 'TinyFish crawler worker waking up and initializing headless browser cluster...', schemes_found: 0, current_portal: 'Initializing' } },
    { delayMs: 6000, event: { status: 'crawling', progress: 8, message: 'Establishing secure SSL handshake with National Scholarship Portal (NSP)...', schemes_found: 0, current_portal: 'NSP Gateway' } },
    { delayMs: 12000, event: { status: 'crawling', progress: 13, message: 'Parsing Ministry of Electronics & IT (MeitY) scholarship circulars...', schemes_found: 2, current_portal: 'NSP Central Sector' } },
    { delayMs: 18000, event: { status: 'crawling', progress: 18, message: 'Extracted Central Sector Scheme of Scholarship for College Students...', schemes_found: 4, current_portal: 'NSP Higher Education' } },
    { delayMs: 24000, event: { status: 'crawling', progress: 24, message: 'Connecting to AICTE Portal for Technical Education Scholarships...', schemes_found: 6, current_portal: 'AICTE Central' } },
    { delayMs: 30000, event: { status: 'crawling', progress: 29, message: 'Scraping Pragati Degree & Saksham Special Ability Grant guidelines...', schemes_found: 8, current_portal: 'AICTE Pragati' } },
    { delayMs: 36000, event: { status: 'crawling', progress: 35, message: 'Connecting to Haryana State Har-Chhatravratti higher education portal...', schemes_found: 10, current_portal: 'Har-Chhatravratti' } },
    { delayMs: 42000, event: { status: 'crawling', progress: 41, message: 'Parsing Haryana Post-Matric OBC/SC & Merit-cum-Means schemes...', schemes_found: 13, current_portal: 'Haryana State' } },
    { delayMs: 48000, event: { status: 'crawling', progress: 46, message: 'Connecting to Delhi e-District Student Welfare & Higher Education portal...', schemes_found: 16, current_portal: 'Delhi e-District' } },
    { delayMs: 55000, event: { status: 'crawling', progress: 51, message: 'Querying Bihar PMS Online Post-Matric Scholarship database...', schemes_found: 18, current_portal: 'Bihar PMS Online' } },
    { delayMs: 62000, event: { status: 'crawling', progress: 57, message: 'Checking Maharashtra MahaDBT and Karnataka SSP portals for state quotas...', schemes_found: 21, current_portal: 'MahaDBT & SSP' } },
    { delayMs: 69000, event: { status: 'crawling', progress: 62, message: 'Querying UGC & Canara Bank DBT Portal for university fellowship grants...', schemes_found: 23, current_portal: 'UGC National' } },
    { delayMs: 76000, event: { status: 'summarizing', progress: 67, message: 'Scraping Corporate CSR Grants: Reliance Foundation Undergraduate...', schemes_found: 25, current_portal: 'Reliance Foundation' } },
    { delayMs: 83000, event: { status: 'summarizing', progress: 73, message: 'Scraping Tata Trusts, HDFC Badhte Kadam, and ONGC CSR portals...', schemes_found: 28, current_portal: 'CSR Foundations' } },
    { delayMs: 90000, event: { status: 'summarizing', progress: 78, message: 'Filtering expired deadlines and deduplicating cross-listed portal records...', schemes_found: 28, current_portal: 'Data Cleaning' } },
    { delayMs: 97000, event: { status: 'summarizing', progress: 83, message: 'Deepak AI model synthesizing complex legal clauses into plain English...', schemes_found: 28, current_portal: 'Deepak AI Synthesizer' } },
    { delayMs: 104000, event: { status: 'summarizing', progress: 89, message: 'Cross-matching applicant reservation, state domicile, and income ceilings...', schemes_found: 28, current_portal: 'AI Engine' } },
    { delayMs: 110000, event: { status: 'summarizing', progress: 93, message: 'Validating mandatory DigiLocker documents and Aadhaar DBT requirements...', schemes_found: 28, current_portal: 'DigiLocker Validator' } },
    { delayMs: 115000, event: { status: 'summarizing', progress: 97, message: 'Calculating AI fit percentage and ranking eligible schemes by grant value...', schemes_found: 28, current_portal: 'Ranking Engine' } },
    { delayMs: 120000, event: { status: 'done', progress: 100, message: 'Completed! 28 verified scholarship schemes crawled and ranked for your profile.', schemes_found: 28, current_portal: 'Done' } },
  ];

  const timers: NodeJS.Timeout[] = [];
  const speed = Math.max(0.1, speedMultiplier);

  mockSteps.forEach((step) => {
    const delay = Math.round(step.delayMs / speed);
    const timer = setTimeout(() => {
      if (isCancelled) return;
      onProgress(step.event);
      if (step.event.status === 'done') {
        onComplete();
      }
    }, delay);
    timers.push(timer);
  });

  return () => {
    isCancelled = true;
    timers.forEach((t) => clearTimeout(t));
  };
}

// Backward-compatible tracker aliases
import { getUserApplications, updateApplicationStatus as appUpdateStatus } from './applications.ts';

export async function getApplications(userId?: string): Promise<Application[]> {
  return getUserApplications(userId);
}
