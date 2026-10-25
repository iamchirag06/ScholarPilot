# ScholarPilot — Frontend Integration Guide: Intelligent Scholarship Autofill & Form Discovery

This guide provides frontend engineers and AI agents with the complete specifications, API contracts, TypeScript definitions, UI/UX workflow, and code examples required to integrate the **ScholarPilot Autofill & Form Discovery** features into the frontend application.

---

## 1. System Overview & Architecture

ScholarPilot assists students in applying for government and institutional scholarships by:
1. **Discovering official application portals** (e.g., National Scholarship Portal, Bihar PMS, AICTE).
2. **Validating student eligibility** before sending them to external portals.
3. **Generating secure, short-lived autofill sessions** (15-minute TTL).
4. **Handoff to Chrome Extension**: The frontend opens the official portal with `?sp_session=<sessionId>`. The ScholarPilot Chrome Extension detects the query parameter, redeems the pre-verified student facts, and auto-fills the external portal form safely with zero auto-submission.

```
+-------------------+        1. POST /prepare        +-------------------------+
|                   | -----------------------------> |                         |
|   Frontend App    |                                |  ScholarPilot AI/ML     |
| (React / Next.js) | <----------------------------- |     Backend API         |
|                   |  2. Session Token + App URL    | (FastAPI @ :8000)       |
+-------------------+                                +-------------------------+
          |
          | 3. Opens Official Portal with
          |    ?sp_session=sess_abc123
          v
+-----------------------------+                      +-------------------------+
|                             |   4. Redeem Session  |                         |
|  Official Portal Form       | <------------------- |  Chrome Extension       |
| (scholarships.gov.in, etc.) | -------------------> |  (Background & Content) |
|                             |   5. Safe Autofill   |                         |
+-----------------------------+                      +-------------------------+
```

---

## 2. API Endpoints & Contracts

**Base URL**: `http://localhost:8000` (or your configured backend host / ngrok domain)  
**Required Request Header**:
* `ngrok-skip-browser-warning: true` (Prevents ngrok interstitial warning page)
* `Content-Type: application/json`
* `X-User-Id: <studentId>` (e.g. `prof-arjun-001` or authenticated user ID)
* `Authorization: Bearer <token>` (if JWT authentication is enabled)

---

### Endpoint 1: Prepare Autofill Session
Prepares the verified portal URL, evaluates student eligibility, and generates a single-use session token for the extension.

* **Route**: `POST /api/v1/autofill/prepare` (Alias: `POST /api/autofill/prepare`)
* **Request Body**:
  ```json
  {
    "schemeId": "scheme-bihar-postmatric-sc-002",
    "userId": "prof-arjun-001"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "schemeId": "scheme-bihar-postmatric-sc-002",
    "schemeTitle": "Bihar Post-Matric Scholarship for SC/ST Students",
    "status": "READY",
    "applicationUrl": "https://pmsonline.bih.nic.in/pmsedu/(S(pms))/StudentRegistration.aspx",
    "autofillSession": {
      "sessionId": "sess_8c5f6e80b87c47d7920ab48596f9e218",
      "expiresAt": "2026-10-25T07:15:00Z",
      "status": "ACTIVE"
    },
    "discovery": {
      "status": "DIRECT_APPLICATION_URL",
      "classification": "DIRECT_APPLICATION_URL",
      "requiresUserNavigation": false,
      "discoveredCandidates": []
    },
    "validation": {
      "missingFields": [],
      "requiresManualReview": [
        "aadhaar_number",
        "bank_account_number",
        "ifsc_code",
        "income_certificate_number"
      ],
      "unsupportedFields": ["captcha", "aadhaar_otp", "biometric"],
      "passedRules": [
        "rule_annual_family_income",
        "rule_eligible_states",
        "rule_education_levels",
        "rule_category"
      ],
      "failedRules": []
    },
    "instructions": "ScholarPilot Extension is ready to autofill verified fields on the official portal."
  }
  ```
* **Possible Status Values**:
  * `READY`: Scheme application URL and profile facts are verified; ready to launch.
  * `NEEDS_USER_SELECTION`: Multiple candidate application URLs discovered; user must choose.
  * `MISSING_REQUIRED_DATA`: Student profile is missing mandatory facts required for this scheme.
  * `LOGIN_REQUIRED`: Portal requires existing account login before form access.
  * `UNSUPPORTED_PORTAL`: Portal URL cannot be safely autofilled.
  * `DISCOVERY_FAILED`: Portal unreachable or blocked.

---

### Endpoint 2: Redeem Autofill Session Payload
*(Primarily called by the Chrome Extension, but frontend can display preview payload if needed)*

* **Route**: `GET /api/v1/autofill/session/{session_id}` (Alias: `GET /api/autofill/session/{session_id}`)
* **Success Response (`200 OK`)**:
  ```json
  {
    "sessionId": "sess_8c5f6e80b87c47d7920ab48596f9e218",
    "schemeId": "scheme-bihar-postmatric-sc-002",
    "schemeName": "Bihar Post-Matric Scholarship for SC/ST Students",
    "studentId": "prof-arjun-001",
    "applicationUrl": "https://pmsonline.bih.nic.in/pmsedu/(S(pms))/StudentRegistration.aspx",
    "fieldValues": {
      "name": {
        "value": "Arjun Kumar",
        "source": "STUDENT_PROFILE",
        "verificationStatus": "PROFILE_VALUE"
      },
      "state": {
        "value": "BR",
        "source": "STUDENT_PROFILE",
        "verificationStatus": "PROFILE_VALUE"
      },
      "category": {
        "value": "SC",
        "source": "STUDENT_PROFILE",
        "verificationStatus": "PROFILE_VALUE"
      }
    },
    "missingFields": [],
    "manualReviewFields": ["aadhaar_number", "bank_account_number"],
    "unsupportedFields": ["captcha", "otp"],
    "expiresAt": "2026-10-25T07:15:00Z",
    "instructions": "Review pre-filled fields carefully. Enter any missing official document numbers manually before submission."
  }
  ```

---

### Endpoint 3: Supported Portal Registry
Lists pre-verified government portals and application adapters.

* **Route**: `GET /api/v1/autofill/registry` (Alias: `GET /api/autofill/registry`)
* **Success Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "total": 3,
    "supported_portals": [
      "National Scholarship Portal (NSP)",
      "Bihar Post-Matric Scholarship (PMS)",
      "AICTE Pragati Portal"
    ],
    "mappings": [ ... ]
  }
  ```

---

## 3. TypeScript Interfaces

```typescript
export interface AutofillSessionInfo {
  sessionId: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REDEEMED';
}

export interface AutofillDiscoveryInfo {
  status: string;
  classification: string;
  requiresUserNavigation: boolean;
  discoveredCandidates: Array<{
    url: string;
    title?: string;
    confidence?: number;
  }>;
}

export interface AutofillValidationInfo {
  missingFields: string[];
  requiresManualReview: string[];
  unsupportedFields: string[];
  passedRules: string[];
  failedRules: string[];
}

export interface AutofillPrepareResponse {
  success: boolean;
  schemeId: string;
  schemeTitle: string;
  status:
    | 'READY'
    | 'DISCOVERING'
    | 'NEEDS_USER_SELECTION'
    | 'LOGIN_REQUIRED'
    | 'MISSING_REQUIRED_DATA'
    | 'UNSUPPORTED_PORTAL'
    | 'DISCOVERY_FAILED';
  applicationUrl?: string | null;
  autofillSession?: AutofillSessionInfo | null;
  discovery: AutofillDiscoveryInfo;
  validation: AutofillValidationInfo;
  instructions: string;
}

export interface AutofillPrepareRequest {
  schemeId: string;
  userId?: string;
}
```

---

## 4. Frontend User Flow & UI/UX Requirements

### Step 1: Scheme Card CTA
Each recommended scholarship card should feature an autofill button:
* Button label: `⚡ Apply with Autofill` or `⚡ Fill Application`
* When clicked, opens the `AutofillModal` or Drawer and calls `prepareAutofill(schemeId)`.

### Step 2: Autofill Preparation Modal (`AutofillModal`)
Display a sleek modal with the following states:
1. **Loading State**:
   * Animated spinner: *"Verifying official portal and student eligibility facts..."*
2. **Success State (`status === 'READY'`)**:
   * **Status Badge**: Green pill `READY FOR AUTOFILL`
   * **Verification Checklist**:
     * ✅ Student profile facts verified & authorized
     * ✅ Official application URL verified (`applicationUrl`)
     * ✅ Short-lived session token generated (15 min validity)
   * **Privacy & Safety Notice**:
     * Highlights fields requiring manual entry: Aadhaar, Bank Details, CAPTCHA (ScholarPilot adheres to zero-auto-submit and data privacy rules).
   * **Action Buttons**:
     * `Cancel`: Closes modal.
     * `Proceed to Official Portal`: 
       1. Stores `sessionId` in `localStorage.setItem('scholarpilot_active_session', sessionId)`.
       2. Opens target URL in new tab with parameter:  
          `${applicationUrl}?sp_session=${sessionId}`.
       3. Closes or updates modal with a success confirmation.
3. **Missing Data State (`status === 'MISSING_REQUIRED_DATA'`)**:
   * Lists specific missing fields from `validation.missingFields`.
   * Displays button: `Update Profile` redirecting student to profile form.
4. **Needs Selection State (`status === 'NEEDS_USER_SELECTION'`)**:
   * Renders `discovery.discoveredCandidates` as clickable radio options so user can choose the exact regional/category portal.

---

## 5. API Client Implementation (e.g. `services/autofillService.ts`)

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function prepareAutofill(
  schemeId: string,
  userId?: string
): Promise<AutofillPrepareResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/v1/autofill/prepare`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ schemeId, userId }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Autofill preparation failed with status ${response.status}`);
  }

  return response.json();
}

export function launchOfficialPortal(applicationUrl: string, sessionId?: string): void {
  const url = new URL(applicationUrl);
  if (sessionId) {
    url.searchParams.set('sp_session', sessionId);
    localStorage.setItem('scholarpilot_active_session', sessionId);
  }
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}
```

---

## 6. React Component Example (`components/AutofillModal.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { prepareAutofill, launchOfficialPortal } from '../services/autofillService';
import type { AutofillPrepareResponse } from '../types/autofill';

interface AutofillModalProps {
  isOpen: boolean;
  schemeId: string;
  schemeTitle: string;
  userId: string;
  onClose: () => void;
}

export const AutofillModal: React.FC<AutofillModalProps> = ({
  isOpen,
  schemeId,
  schemeTitle,
  userId,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AutofillPrepareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);

    prepareAutofill(schemeId, userId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to prepare application session.');
        setLoading(false);
      });
  }, [isOpen, schemeId, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 p-6 text-white shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-xs uppercase font-semibold text-blue-400 tracking-wider">
              ScholarPilot Autofill
            </span>
            <h3 className="text-lg font-bold text-gray-100">{schemeTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center text-gray-400">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent mb-3" />
            <p className="text-sm">Verifying eligibility and official application portal...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-950/60 border border-red-800 p-4 text-red-200 text-sm mb-4">
            <p className="font-semibold">Preparation Failed</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && data && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                data.status === 'READY'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}>
                {data.status === 'READY' ? 'READY FOR AUTOFILL' : data.status}
              </span>
            </div>

            <div className="space-y-2.5 rounded-xl bg-gray-800/60 p-4 border border-gray-700/60 text-sm mb-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span className="text-gray-200">Student profile facts verified & authorized</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span className="text-gray-200">
                  Official Portal: <strong className="text-white">{new URL(data.applicationUrl || 'https://scholarships.gov.in').hostname}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span className="text-gray-200">Single-use secure session created (15m validity)</span>
              </div>
            </div>

            {data.validation.requiresManualReview.length > 0 && (
              <div className="rounded-lg bg-amber-950/30 border border-amber-900/50 p-3 text-xs text-amber-300/90 mb-5">
                <strong>Manual Review Required:</strong> Sensitive fields ({data.validation.requiresManualReview.join(', ')}) and CAPTCHAs must be filled manually by the applicant.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300"
              >
                Cancel
              </button>
              <button
                disabled={!data.applicationUrl}
                onClick={() => {
                  if (data.applicationUrl) {
                    launchOfficialPortal(data.applicationUrl, data.autofillSession?.sessionId);
                    onClose();
                  }
                }}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white flex items-center gap-2 shadow-lg shadow-blue-500/25"
              >
                <span>Proceed to Official Website</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## 7. Quality & Verification Checklist for Frontend Agent

Before marking the integration complete, verify:
* [ ] `ngrok-skip-browser-warning: true` header is sent with all API calls.
* [ ] `X-User-Id` header is passed with the active student persona/profile ID.
* [ ] Triggering `prepareAutofill` displays responsive loading, success, and error states.
* [ ] Clicking `Proceed to Official Website` generates a URL with `?sp_session=sess_...`.
* [ ] The session ID is stored in `localStorage` under `scholarpilot_active_session`.
* [ ] Sensitive fields (Aadhaar, Bank details) are clearly labeled as requiring manual review.
