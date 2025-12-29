/**
 * cumstack Environment utility
 * get environment variables on both server and client
 */

/**
 * Get environment variable - works on both server and client
 * @param {string} key - environment variable name
 * @param {string} [fallback] - fallback value if not found
 * @returns {string|undefined} environment variable value
 */
export function env(key, fallback) {
  // Server-side (globalThis.__ENV__)
  if (typeof window === 'undefined') {
    const envVars = globalThis.__ENV__ || {};
    return envVars[key] ?? fallback;
  }
  // Client-side (window.__ENV__)
  const envVars = window.__ENV__ || {};
  return envVars[key] ?? fallback;
}
