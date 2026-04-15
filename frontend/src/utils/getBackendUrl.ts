const configuredBackendUrl = String(import.meta.env.VITE_BACKEND_URL || '').trim();

// Normalize configured URL so template strings like `${BACKEND_URL}/api/...` stay valid.
const normalizedConfiguredBackendUrl = configuredBackendUrl.replace(/\/$/, '');

// In production, default to same-origin path (`/api/...`) by using empty base URL.
// In development, default to local backend.
export const BACKEND_URL = normalizedConfiguredBackendUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');

