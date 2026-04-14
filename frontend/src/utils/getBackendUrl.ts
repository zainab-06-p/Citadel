const configuredBackendUrl = String(import.meta.env.VITE_BACKEND_URL || '').trim();

// In production, default to same-origin so we never hardcode localhost.
export const BACKEND_URL = configuredBackendUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');
