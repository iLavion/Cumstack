/**
 * cumstack API utility
 * making requests to API domain with automatic auth token handling
 */

import { env } from "./env.js";

/**
 * get auth token from storage or context
 * @param {string|null} explicitToken - explicitly provided token
 * @returns {string|null}
 */
function getAuthToken(explicitToken) {
  if (explicitToken) return explicitToken;
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

/**
 * API utility for making requests to the API domain
 */
export const api = {
  /**
   * Make a GET request to the API
   * @param {string} endpoint - The API endpoint (e.g., "/users")
   * @param {Object} options - Additional fetch options
   * @param {string} [options.token] - Optional auth token (for server-side)
   * @returns {Promise<any>} The response JSON
   */
  async get(endpoint, options = {}) {
    const { token: explicitToken, ...fetchOptions } = options;
    const domain = env("API_DOMAIN");
    if (!domain) throw new Error("API_DOMAIN environment variable not set");
    const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http://" : "https://";
    const token = getAuthToken(explicitToken);
    const headers = { ...fetchOptions.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetch(`${protocol}${domain}${endpoint}`, { ...fetchOptions, headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  },

  /**
   * Make a POST request to the API
   * @param {string} endpoint - The API endpoint (e.g., "/users")
   * @param {any} payload - The payload to send
   * @param {Object} options - Additional fetch options
   * @param {string} [options.token] - Optional auth token (for server-side)
   * @returns {Promise<any>} The response JSON
   */
  async post(endpoint, payload, options = {}) {
    const { token: explicitToken, ...fetchOptions } = options;
    const domain = env("API_DOMAIN");
    if (!domain) throw new Error("API_DOMAIN environment variable not set");
    const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http://" : "https://";
    const token = getAuthToken(explicitToken);
    const headers = {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch(`${protocol}${domain}${endpoint}`, {
      ...fetchOptions,
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  },

  /**
   * Make a PUT request to the API
   * @param {string} endpoint - The API endpoint
   * @param {any} payload - The payload to send
   * @param {Object} options - Additional fetch options
   * @param {string} [options.token] - Optional auth token (for server-side)
   * @returns {Promise<any>} The response JSON
   */
  async put(endpoint, payload, options = {}) {
    const { token: explicitToken, ...fetchOptions } = options;
    const domain = env("API_DOMAIN");
    if (!domain) throw new Error("API_DOMAIN environment variable not set");
    const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http://" : "https://";
    const token = getAuthToken(explicitToken);
    const headers = {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const response = await fetch(`${protocol}${domain}${endpoint}`, {
      ...fetchOptions,
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  },

  /**
   * Make a DELETE request to the API
   * @param {string} endpoint - The API endpoint
   * @param {Object} options - Additional fetch options
   * @param {string} [options.token] - Optional auth token (for server-side)
   * @returns {Promise<any>} The response JSON
   */
  async delete(endpoint, options = {}) {
    const { token: explicitToken, ...fetchOptions } = options;
    const domain = env("API_DOMAIN");
    if (!domain) throw new Error("API_DOMAIN environment variable not set");
    const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http://" : "https://";
    const token = getAuthToken(explicitToken);
    const headers = { ...fetchOptions.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetch(`${protocol}${domain}${endpoint}`, {
      ...fetchOptions,
      method: "DELETE",
      headers,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  },
};
