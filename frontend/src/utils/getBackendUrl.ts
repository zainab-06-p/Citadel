const configuredBackendUrl = String(import.meta.env.VITE_BACKEND_URL || '').trim();

// In production, use relative /api path which Vercel will rewrite to backend.
// In dev, use localhost:3000 or configured URL
export const BACKEND_URL = configuredBackendUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '/');

