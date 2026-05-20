// ─── Backend URL Resolution ────────────────────────────────────────────────
//
// Production deployment topology:
//   Frontend  → https://frontend-six-livid-85.vercel.app
//   Backend   → https://backend-rouge-iota.vercel.app
//
// In DEVELOPMENT: use VITE_BACKEND_URL from .env (defaults to localhost:3000)
// In PRODUCTION:  always use the real deployed backend — never localhost
// ───────────────────────────────────────────────────────────────────────────

const PROD_BACKEND = 'https://backend-rouge-iota.vercel.app';

const configuredBackendUrl = String(import.meta.env.VITE_BACKEND_URL || '').trim();
const normalizedConfiguredBackendUrl = configuredBackendUrl.replace(/\/$/, '');

const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedConfiguredBackendUrl);

// In production: always use the hardcoded prod backend (strips any localhost value baked in at build time).
// In development: use configured URL or fall back to localhost:3000.
export const BACKEND_URL = import.meta.env.PROD
  ? PROD_BACKEND
  : (normalizedConfiguredBackendUrl && !isLocalUrl ? normalizedConfiguredBackendUrl : 'http://localhost:3000');
