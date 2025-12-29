/**
 * cumstack CDN utility
 * generate CDN URLs for assets
 */

import { env } from './env.js';

/**
 * Get the full CDN URL for a path
 * @param {string} path - The path to the asset (e.g., "/assets/logo.png")
 * @returns {string} The full CDN URL
 */
export function cdn(path) {
  const domain = env('CDN_DOMAIN');
  if (!domain) throw new Error('CDN_DOMAIN environment variable not set');
  const protocol = domain.includes('127.0.0.1') || domain.includes('localhost') ? 'http://' : 'https://';
  return `${protocol}${domain}${path}`;
}
