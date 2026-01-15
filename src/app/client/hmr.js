/**
 * cumstack HMR (Hot Module Reload)
 * built-in hmr for wrangler development
 */

let hmrWebSocket = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
const maxReconnectAttempts = 10;

/**
 * initialize hmr connection for development
 * @returns {void}
 */
export function initHMR() {
  if (typeof window === "undefined" || !globalThis.__ENVIRONMENT__?.includes("dev")) return;
  const hmrPort = globalThis.__HMR_PORT__ || 8790;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.hostname}:${hmrPort}`;
  connectHMR(wsUrl);
}

/**
 * establish websocket connection to HMR server
 * @param {string} wsUrl - WebSocket URL
 * @returns {void}
 */
function connectHMR(wsUrl) {
  try {
    hmrWebSocket = new WebSocket(wsUrl);
    hmrWebSocket.addEventListener("open", () => {
      console.log("[WS] Established connection to HMR server");
      reconnectAttempts = 0;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    hmrWebSocket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "server-update") handleServerUpdate(data);
      else if (data.type === "full-reload") window.location.reload();
      else if (data.type === "css-update") handleCSSUpdate(data);
      else if (data.type === "js-update") handleJSUpdate(data);
      else if (data.type === "reload") window.location.reload();
      else if (data.type === "update") handleHotUpdate(data);
    });

    hmrWebSocket.addEventListener("close", () => {
      console.log("[WS] Connection closed");
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      // debounced reconnection
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * reconnectAttempts, 5000);
        console.log(`[WS] Reconnecting...`);
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          connectHMR(wsUrl);
        }, delay);
      }
    });
    hmrWebSocket.addEventListener("error", (error) => console.error("[HMR] WebSocket error:", error));
  } catch (error) {
    console.error("[HMR] Failed to connect:", error);
  }
}

/**
 * handle server update from HMR
 * @param {Object} data - Update data
 * @returns {void}
 */
function handleServerUpdate(data) {
  const currentTimestamp = window.__BUILD_TIMESTAMP__;
  const pollForNewBuild = (attempt = 1, maxAttempts = 40) => {
    fetch(window.location.href, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } })
      .then((response) => response.text())
      .then((html) => {
        // extract build timestamp from new html
        const timestampMatch = html.match(/window\.__BUILD_TIMESTAMP__\s*=\s*(\d+)/);
        const newTimestamp = timestampMatch ? parseInt(timestampMatch[1]) : null;
        if (!newTimestamp || newTimestamp === currentTimestamp) {
          // build not ready yet, poll
          if (attempt < maxAttempts) setTimeout(() => pollForNewBuild(attempt + 1, maxAttempts), 100);
          else window.location.reload();
          return;
        }
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, "text/html");
        const newApp = newDoc.getElementById("app");
        const currentApp = document.getElementById("app");
        if (newApp && currentApp) {
          currentApp.innerHTML = newApp.innerHTML;
          // update build timestamp
          window.__BUILD_TIMESTAMP__ = newTimestamp;
          // re-initialize client-side components
          if (window.initComponents) window.initComponents();
        }
      })
      .catch((error) => {
        if (attempt < maxAttempts) setTimeout(() => pollForNewBuild(attempt + 1, maxAttempts), 100);
        else {
          console.error("[HMR] Failed to fetch updated HTML:", error);
          window.location.reload();
        }
      });
  };
  // small delay to let wrangler start reloading, then start polling
  setTimeout(() => pollForNewBuild(), 150);
}

/**
 * handle hot module update
 * @param {Object} data - Update data
 * @returns {void}
 */
function handleHotUpdate(data) {
  window.location.reload();
}

/**
 * handle CSS update from HMR
 * @param {Object} data - Update data with timestamp
 * @returns {void}
 */
function handleCSSUpdate(data) {
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach((link) => {
    const href = link.href;
    const url = new URL(href);
    // add timestamp to bust cache
    url.searchParams.set("t", data.timestamp);
    link.href = url.toString();
  });
}

/**
 * handle JavaScript update from HMR
 * @param {Object} data - Update data
 * @returns {void}
 */
function handleJSUpdate(data) {
  window.location.reload();
}

/**
 * dispose hmr connection and cleanup
 * @returns {void}
 */
export function disposeHMR() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (hmrWebSocket) {
    hmrWebSocket.close();
    hmrWebSocket = null;
  }
}
