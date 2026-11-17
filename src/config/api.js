// Base backend URL configuration:
// In production (Netlify or remote host): uses VITE_BACKEND_URL or defaults to the deployed Render backend
// In local development: defaults to localhost:5000, with automated seamless fallback to Render backend if local port 5000 is inactive
const rawUrl = import.meta.env.VITE_BACKEND_URL;
const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const REMOTE_BACKEND_URL = 'https://ruetguesthouse-api.onrender.com';
export const LOCAL_BACKEND_URL = 'http://localhost:5000';

export const API_BASE_URL = rawUrl 
  ? rawUrl.replace(/\/+$/, '') 
  : (!isLocalhost && isBrowser)
    ? REMOTE_BACKEND_URL
    : LOCAL_BACKEND_URL;

/**
 * Resilient API Fetch:
 * Tries the primary backend (localhost in development, Render in production).
 * If the local dev server is offline (e.g. backend process stopped), it seamlessly
 * retries the request against the live Render backend so payments, emails, and OTPs never break.
 */
export async function apiFetch(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const primaryUrl = API_BASE_URL.replace(/\/+$/, '');
  const fallbackUrl = REMOTE_BACKEND_URL.replace(/\/+$/, '');

  // Automatically inject client_url so backend redirects back to the exact current origin
  let finalOptions = { ...options };
  if (isBrowser && finalOptions.body && typeof finalOptions.body === 'string' && finalOptions.body.startsWith('{')) {
    try {
      const parsed = JSON.parse(finalOptions.body);
      if (!parsed.client_url) {
        parsed.client_url = window.location.origin;
        finalOptions.body = JSON.stringify(parsed);
      }
    } catch (e) {}
  }

  try {
    const response = await fetch(`${primaryUrl}${cleanEndpoint}`, finalOptions);
    return response;
  } catch (err) {
    // If running in development and localhost:5000 connection refused, fallback to remote
    if (primaryUrl !== fallbackUrl) {
      console.warn(`[apiFetch] Primary backend (${primaryUrl}) unreachable. Retrying with live fallback (${fallbackUrl})...`);
      return await fetch(`${fallbackUrl}${cleanEndpoint}`, finalOptions);
    }
    throw err;
  }
}
