# ScholarPilot — Frontend

> **AI-powered scholarship discovery app for Indian students**, crafted with a warm, human, hand-drawn editorial aesthetic ("Lovish Creative" style).

---

## 1. Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (port 3000)
npm run dev

# 3. Build for production
npm run build
```

---

## 2. Environment Variables & Backend Integration

Configuration is stored in `.env.local` (or `.env`):

```bash
NEXT_PUBLIC_API_BASE_URL=https://underfeed-caterer-backlands.ngrok-free.dev
NEXT_PUBLIC_USE_MOCK=false
```

> [!IMPORTANT]
> **ngrok Tunnel Restarts:**
> The backend is served through an ngrok tunnel. Whenever the ngrok tunnel restarts, the URL changes. When that happens, **only `NEXT_PUBLIC_API_BASE_URL` needs updating** in `.env.local`.
> All requests automatically include the `ngrok-skip-browser-warning: true` header and a 15-second abort timeout.
> To fall back to offline mock mode at any time, simply set `NEXT_PUBLIC_USE_MOCK=true`.

---

## 3. Real Backend API Contract

All profile and scheme interactions use the live backend:
- `POST /api/profiles/create` → creates profile, validates duplicate (`fullName` + `state`), returns new profile with `id`.
- `GET /api/profiles/all` → lists all profiles (used by dev-only test picker on onboarding).
- `GET /api/profiles/{id}` → loads profile for `/dashboard/{id}` and prefills edit form.
- `PUT /api/profiles/{id}` → sends only modified fields (computes diff between original and edited form).
- `GET /api/schemes/matched/{id}` → retrieves ranked scholarship matches for the profile with defensive normalization.

---

## 4. Navigation & Flow

1. **Profile Guard**: If no profile ID exists in `localStorage` (`scholarpilot_profile_id`), the app guards protected routes and opens onboarding (`/profile`).
2. **Onboarding / Creation**: Fill the 4-step form or pick an existing profile using the dev-only dropdown (`NODE_ENV !== 'production'`).
3. **Redirect to Dashboard**: On submission, immediately redirects to `/dashboard/{id}` with personalized greeting *"Welcome, {fullName}"* and ranked scholarships.
4. **Edit Profile**: Click *"Edit Profile"* from the dashboard to prefill the form and submit only modified fields via `PUT /api/profiles/{id}`.
5. **Switch Profile**: In the navbar, the *"Switch Profile"* button clears the active ID and returns to onboarding.

