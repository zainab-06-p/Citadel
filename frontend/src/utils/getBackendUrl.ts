// ─── Backend URL Resolution ────────────────────────────────────────────────
//
// Uses RUNTIME hostname detection — 100% reliable regardless of how
// Vercel handles VITE_* environment variables at build time.
//
// Production backend: https://backend-rouge-iota.vercel.app
// ───────────────────────────────────────────────────────────────────────────

const PROD_BACKEND = 'https://backend-rouge-iota.vercel.app';

// Detect at RUNTIME whether we are running on localhost or a deployed domain.
// This cannot be fooled by env vars baked into the bundle at build time.
const isRunningOnLocalhost: boolean =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '');

// Dev fallback from .env — only used when actually on localhost
const devBackend = String(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// ALWAYS use the real backend when deployed; only use local backend on localhost.
export const BACKEND_URL: string = isRunningOnLocalhost ? devBackend : PROD_BACKEND;

