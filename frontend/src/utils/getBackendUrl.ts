// ─── Backend URL Resolution ────────────────────────────────────────────────
//
// Architecture:
//   PRODUCTION  → BACKEND_URL = '' (empty)
//                 fetch('/api/...') → Vercel edge rewrites → backend-rouge-iota.vercel.app
//                 Same-origin — ZERO CORS issues.
//
//   DEVELOPMENT → BACKEND_URL = 'http://localhost:3000'
//                 fetch('http://localhost:3000/api/...') → local backend
//
// The vercel.json rewrite rule handles the production proxy:
//   { "source": "/api/:path*", "destination": "https://backend-rouge-iota.vercel.app/api/:path*" }
// ───────────────────────────────────────────────────────────────────────────

// Detect at RUNTIME whether we are running on localhost or a deployed domain.
const isRunningOnLocalhost: boolean =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '');

// Dev fallback: use VITE_BACKEND_URL from .env, or default to localhost:3000
const devBackend = String(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// Production: empty string → all fetch('/api/...') calls go same-origin → Vercel proxy.
// Development: direct to local backend.
export const BACKEND_URL: string = isRunningOnLocalhost ? devBackend : '';


