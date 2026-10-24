import { Application, ApplicationStatus } from '../types/index.ts';
import { apiFetch, isMockMode, getStoredUserId } from './api.ts';
import { INITIAL_APPLICATIONS } from '../mockData.ts';

/**
 * Defensive normalizer for backend application objects.
 * Handles both camelCase and snake_case properties.
 */
export function normalizeApplication(raw: any): Application {
  return {
    id: String(raw.id ?? raw._id ?? `app-${Date.now()}`),
    user_id: String(raw.userId ?? raw.user_id ?? ''),
    scheme_id: String(raw.schemeId ?? raw.scheme_id ?? ''),
    status: (raw.status as ApplicationStatus) || 'ELIGIBLE',
    applied_at:
      raw.appliedAt ??
      raw.applied_at ??
      (raw.status === 'APPLIED' ? new Date().toISOString() : null),
  };
}

// In-memory / localStorage cache for mock sessions so updates persist during tests
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

/**
 * 10. Add to Tracker -> POST /api/applications/create
 * What to send: JSON with userId, schemeId, and status (e.g., "APPLIED", "ELIGIBLE")
 * What it returns: The created tracker object with an id.
 */
export async function createApplication(
  userId: string,
  schemeId: string,
  status: ApplicationStatus = 'ELIGIBLE'
): Promise<Application> {
  const effectiveUserId = userId || getStoredUserId() || 'usr-default';
  const payload = {
    userId: effectiveUserId,
    schemeId,
    status,
  };

  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 250));
    const apps = getStoredApplications();
    const existing = apps.find(
      (a) => a.scheme_id === schemeId && a.user_id === effectiveUserId
    );
    if (existing) {
      existing.status = status;
      if (status === 'APPLIED' && !existing.applied_at) {
        existing.applied_at = new Date().toISOString();
      }
      saveStoredApplications(apps);
      return existing;
    }
    const newApp: Application = {
      id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: effectiveUserId,
      scheme_id: schemeId,
      status,
      applied_at: status === 'APPLIED' ? new Date().toISOString() : null,
    };
    apps.push(newApp);
    saveStoredApplications(apps);
    return newApp;
  }

  const raw = await apiFetch<any>('/api/applications/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const normalized = normalizeApplication(raw);

  // Update local cache
  const apps = getStoredApplications();
  const existingIdx = apps.findIndex((a) => a.id === normalized.id || a.scheme_id === normalized.scheme_id);
  if (existingIdx >= 0) {
    apps[existingIdx] = normalized;
  } else {
    apps.push(normalized);
  }
  saveStoredApplications(apps);

  return normalized;
}

/**
 * 11. Get User's Tracker Items -> GET /api/applications/user/{userId}
 * What to send: The userId in the URL.
 * What it returns: An array of application objects. Use this to render the Kanban columns.
 */
export async function getUserApplications(userId?: string): Promise<Application[]> {
  const effectiveUserId = userId || getStoredUserId();

  if (isMockMode() || !effectiveUserId) {
    return getStoredApplications();
  }

  try {
    const rawList = await apiFetch<any>(`/api/applications/user/${effectiveUserId}`);
    let listData: any[] = [];
    if (Array.isArray(rawList)) {
      listData = rawList;
    } else if (rawList && typeof rawList === 'object' && Array.isArray(rawList.applications)) {
      listData = rawList.applications;
    } else if (rawList && typeof rawList === 'object' && Array.isArray(rawList.data)) {
      listData = rawList.data;
    } else {
      return getStoredApplications();
    }
    const list = listData.map(normalizeApplication);
    saveStoredApplications(list);
    return list;
  } catch (err) {
    console.warn('Failed to load user applications from backend, falling back to cached items', err);
    return getStoredApplications();
  }
}

/**
 * 12. Update Tracker Status -> PUT /api/applications/{id}/status?newStatus=APPROVED
 * What to send: The Application id in the URL, and the new status as a query parameter.
 * What it returns: The updated application object. Use this for drag-and-drop Kanban updates.
 */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus
): Promise<Application> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 200));
    const apps = getStoredApplications();
    const app = apps.find((a) => a.id === applicationId || a.scheme_id === applicationId);
    if (app) {
      app.status = newStatus;
      if (newStatus === 'APPLIED' && !app.applied_at) {
        app.applied_at = new Date().toISOString();
      }
      saveStoredApplications(apps);
      return app;
    }
    const created: Application = {
      id: applicationId.startsWith('app-') ? applicationId : `app-${Date.now()}`,
      user_id: getStoredUserId() || 'usr-default',
      scheme_id: applicationId,
      status: newStatus,
      applied_at: newStatus === 'APPLIED' ? new Date().toISOString() : null,
    };
    apps.push(created);
    saveStoredApplications(apps);
    return created;
  }

  const raw = await apiFetch<any>(
    `/api/applications/${applicationId}/status?newStatus=${encodeURIComponent(newStatus)}`,
    {
      method: 'PUT',
    }
  );

  const updated = normalizeApplication(raw);

  // Update local cache
  const apps = getStoredApplications();
  const idx = apps.findIndex((a) => a.id === updated.id || a.scheme_id === updated.scheme_id);
  if (idx >= 0) {
    apps[idx] = updated;
  } else {
    apps.push(updated);
  }
  saveStoredApplications(apps);

  return updated;
}
