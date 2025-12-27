/**
 * cumstack Router
 * simple manual routing with params and navigation
 */

import { createMoan } from './reactivity.js';

/**
 * parse route pattern to regex with params
 * @param {string} pattern - Route pattern like "/user/:id"
 * @returns {{ regex: RegExp, params: string[] }}
 */
function parseRoute(pattern) {
  const params = [];
  const regexPattern = pattern.replace(/\*/g, '.*').replace(/:(\w+)/g, (_, param) => {
    params.push(param);
    return '([^/]+)';
  });
  return {
    regex: new RegExp(`^${regexPattern}$`),
    params,
  };
}

/**
 * match a path against a pattern
 * @param {string} path - Current path
 * @param {string} pattern - Route pattern
 * @returns {{ matched: boolean, params: Record<string, string> }}
 */
export function matchRoute(path, pattern) {
  const { regex, params: paramNames } = parseRoute(pattern);
  const match = path.match(regex);
  if (!match) return { matched: false, params: {} };
  const params = {};
  paramNames.forEach((name, index) => (params[name] = match[index + 1]));
  return { matched: true, params };
}

/**
 * create a router instance
 */
export function createRouter() {
  const routes = new Map();
  const [currentPath, setCurrentPath] = createMoan(typeof window !== 'undefined' ? window.location.pathname : '/');
  const [currentParams, setCurrentParams] = createMoan({});

  /**
   * register a route
   * @param {string} pattern - Route pattern
   * @param {Function} handler - Route handler
   */
  function register(pattern, handler) {
    routes.set(pattern, handler);
  }

  /**
   * navigate to a path
   * @param {string} path - Target path
   * @param {Object} options - Navigation options
   */
  function navigate(path, options = {}) {
    if (typeof window === 'undefined') return;
    const { replace = false, state = null } = options;
    if (replace) window.history.replaceState(state, '', path);
    else window.history.pushState(state, '', path);
    setCurrentPath(path);
    matchCurrentRoute();
  }

  /**
   * match current route and extract params
   */
  function matchCurrentRoute() {
    const path = currentPath();
    for (const [pattern, handler] of routes) {
      const { matched, params } = matchRoute(path, pattern);
      if (matched) {
        setCurrentParams(params);
        return { handler, params };
      }
    }
    return null;
  }

  /**
   * handle browser navigation events
   */
  function handlePopState() {
    setCurrentPath(window.location.pathname);
    matchCurrentRoute();
  }

  /**
   * initialize router
   */
  function init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      matchCurrentRoute();
    }
  }

  return {
    register,
    navigate,
    init,
    currentPath,
    currentParams,
    matchRoute: matchCurrentRoute,
  };
}

/**
 * create a link component helper
 * @param {string} href - Twink href
 * @param {Object} options - Twink options
 */
export function createTwink(href, options = {}) {
  return {
    href,
    onClick: (e) => {
      if (options.onClick) options.onClick(e);
      if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        options.navigate?.(href);
      }
    },
  };
}

/**
 * parse query string
 * @param {string} search - Query string
 * @returns {Record<string, string>}
 */
export function parseQuery(search) {
  const params = new URLSearchParams(search);
  const result = {};
  for (const [key, value] of params) result[key] = value;
  return result;
}

/**
 * build query string
 * @param {Record<string, string>} params - Query params
 * @returns {string}
 */
export function buildQuery(params) {
  const searchParams = new URLSearchParams(params);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
