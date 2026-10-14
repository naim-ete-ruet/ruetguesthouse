// Base backend URL: defaults to localhost in development, configurable via VITE_BACKEND_URL for production
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
