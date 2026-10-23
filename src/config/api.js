// Base backend URL: configured via VITE_BACKEND_URL in production, defaults to localhost in development
const rawUrl = import.meta.env.VITE_BACKEND_URL;
export const API_BASE_URL = rawUrl ? rawUrl.replace(/\/+$/, '') : 'http://localhost:5000';
