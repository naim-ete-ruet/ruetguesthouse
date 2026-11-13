// Base backend URL: configured via VITE_BACKEND_URL in production,
// with automatic fallback to Render backend when accessed from remote hosts (e.g. Netlify)
const rawUrl = import.meta.env.VITE_BACKEND_URL;
const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = rawUrl 
  ? rawUrl.replace(/\/+$/, '') 
  : (!isLocalhost && isBrowser)
    ? 'https://ruetguesthouse-api.onrender.com'
    : 'http://localhost:5000';
