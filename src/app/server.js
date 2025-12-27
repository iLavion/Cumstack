/**
 * cumstack Server Module
 * server-side rendering with hono
 */

import { Hono } from 'hono';
import { renderToString } from './server/jsx.js';
import { h } from './server/jsx.js';
import { initI18n, setLanguage, extractLanguageFromRoute } from './shared/i18n.js';

/**
 * escape html to prevent xss
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * create a new server context to avoid global state pollution
 */
function createServerContext() {
  return {
    routeRegistry: new Map(),
    i18nConfig: null,
    initialized: false,
  };
}

// server context - will be reset per foxgirl call
let serverContext = createServerContext();

/**
 * detect language from request
 * @param {Request} request - HTTP request
 * @param {Object} config - i18n configuration
 * @returns {string} Detected language code
 */
function detectLanguageFromRequest(request, config) {
  const url = new URL(request.url);

  // check url path first if explicit routing
  if (config.explicitRouting) {
    const { language } = extractLanguageFromRoute(url.pathname);
    if (language) return language;
  }

  // check accept-language header
  if (config.defaultLng === 'auto') {
    const acceptLang = request.headers.get('accept-language');
    if (acceptLang) {
      const detectedLang = acceptLang
        .split(',')
        .map((l) => l.split(';')[0].trim().split('-')[0])
        .find((l) => config.supportedLanguages.includes(l));
      if (detectedLang) return detectedLang;
    }
  }

  // use default or fallback
  return config.defaultLng === 'auto' ? config.fallbackLng : config.defaultLng;
}

/**
 * router component (server)
 * @param {Object} props - Component props
 * @param {Object} [props.i18nOpt] - i18n configuration
 * @param {*} props.children - Child elements
 * @returns {*} Children
 */
export function Router({ i18nOpt, children }) {
  if (i18nOpt) {
    serverContext.i18nConfig = i18nOpt;
    // initialize i18n on server
    if (!serverContext.initialized) {
      initI18n({
        defaultLanguage: i18nOpt.defaultLng || i18nOpt.fallbackLng || 'en',
        detectBrowser: false,
      });
      serverContext.initialized = true;
    }
  }
  return children;
}

/**
 * route component (server)
 * @param {Object} props - Component props
 * @param {string} props.path - Route path
 * @param {Function} [props.component] - Component function
 * @param {*} [props.element] - Element to render
 * @param {*} [props.children] - Child elements
 * @returns {null}
 */
export function Route({ path, component, element, children }) {
  // register route during server initialization
  // only register if not already registered to prevent duplicates
  if (!serverContext.routeRegistry.has(path)) {
    if (component) serverContext.routeRegistry.set(path, component);
    else if (element) serverContext.routeRegistry.set(path, () => element);
    else if (children) serverContext.routeRegistry.set(path, () => children);
  }
  return null;
}

/**
 * FoxgirlCreampie component
 * @param {Object} props - Component props
 * @param {*} props.children - Child elements
 * @returns {*} Children
 */
export function FoxgirlCreampie({ children }) {
  return children;
}

/**
 * html document template
 * @param {Object} props - Document props
 * @param {string} [props.title] - Page title
 * @param {string} props.content - Rendered HTML content
 * @param {string} props.language - Language code
 * @param {string} [props.theme] - Theme name
 * @param {Array<string>} [props.scripts] - Additional scripts
 * @param {Array<string>} [props.styles] - Additional stylesheets
 * @param {string} [props.appName] - Application name
 * @returns {Object} JSX element
 */
function Document({ content, language, theme = 'dark', scripts = [], styles = [], appName = 'cumstack App' }) {
  // sanitize data for json embedding to prevent xss
  const sanitizedData = {
    language: escapeHtml(language),
    theme: escapeHtml(theme),
  };

  return h(
    'html',
    { lang: language },
    h(
      'head',
      {},
      h('meta', { charset: 'utf-8' }),
      h('meta', {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      })
    ),
    h(
      'body',
      { className: `theme-${theme}`, style: 'margin: 0; padding: 0' },
      h('div', { id: 'app', 'data-cumstack-ssr': 'true', innerHTML: content }),
      h('script', {
        id: 'cumstack-data',
        type: 'application/json',
        innerHTML: JSON.stringify(sanitizedData),
      }),
      h('script', { type: 'module', src: '/main.client.js' }),
      ...scripts.map((src) => h('script', { type: 'module', src }))
    )
  );
}

/**
 * match and render route
 * @param {string} pathname - URL pathname
 * @param {string} language - Language code
 * @returns {Object|null} Rendered component and extracted params
 */
function matchAndRenderRoute(pathname, language) {
  // remove language prefix if present
  let cleanPath = pathname;
  if (serverContext.i18nConfig?.explicitRouting) {
    const { path } = extractLanguageFromRoute(pathname);
    cleanPath = path || '/';
  }

  // try exact match first
  if (serverContext.routeRegistry.has(cleanPath)) {
    const component = serverContext.routeRegistry.get(cleanPath);
    return {
      content: component ? component({ params: {} }) : null,
      params: {},
    };
  }

  // try wildcard match with param extraction
  for (const [pattern, component] of serverContext.routeRegistry.entries()) {
    if (pattern.includes(':') || pattern === '*') {
      // extract parameter names
      const paramNames = [];
      const regexPattern = pattern
        .replace(/:(\w+)/g, (_, name) => {
          paramNames.push(name);
          return '([^/]+)';
        })
        .replace('*', '(.*)');
      const regex = new RegExp('^' + regexPattern + '$');
      const match = cleanPath.match(regex);
      if (match) {
        // extract params
        const params = {};
        paramNames.forEach((name, i) => (params[name] = match[i + 1]));
        return { content: component ? component({ params }) : null, params };
      }
    }
  }

  // 404
  return {
    content: h(
      'div',
      { className: 'page not-found' },
      h('h1', {}, '404 - Not Found'),
      h('p', {}, 'The page you are looking for does not exist'),
      h('a', { href: '/' }, 'Go Home')
    ),
    params: {},
  };
}

/**
 * create server handler with hono
 * @param {Function} app - App component function
 * @param {Object} [options] - Server options
 * @param {Function} [options.middlewares] - Custom middleware function
 * @param {Function} [options.routes] - Custom API routes function
 * @param {string} [options.appName] - Application name
 * @param {string} [options.theme] - Default theme
 * @param {Array<string>} [options.scripts] - Additional scripts
 * @param {Array<string>} [options.styles] - Additional stylesheets
 * @returns {Function} Hono fetch handler
 */
export function foxgirl(app, options = {}) {
  serverContext = createServerContext();
  const honoApp = new Hono();
  const { appName = 'cumstack App', theme = 'dark', scripts = [], styles = [] } = options;
  app();
  // middleware: set request context (avoid global pollution)
  honoApp.use('*', async (c, next) => {
    // store env in request context instead of global
    c.set('deployment', c.env?.CF_VERSION_METADATA ?? null);
    c.set('env', c.env ?? {});
    c.set('environment', c.env?.ENVIRONMENT ?? 'development');
    await next();
  });
  if (options.middlewares && typeof options.middlewares === 'function') options.middlewares(honoApp);
  honoApp.use('*', async (c, next) => {
    const language = detectLanguageFromRequest(
      c.req.raw,
      serverContext.i18nConfig || {
        supportedLanguages: ['en'],
        explicitRouting: false,
        defaultLng: 'en',
        fallbackLng: 'en',
      }
    );
    setLanguage(language);
    c.set('language', language);
    await next();
  });
  // register all routes with hono
  const registeredPatterns = new Set();
  for (const [path, component] of serverContext.routeRegistry.entries()) {
    // handle both explicit language routes and base routes
    const patterns = [];
    if (serverContext.i18nConfig?.explicitRouting) {
      serverContext.i18nConfig.supportedLanguages.forEach((lang) => {
        patterns.push(`/${lang}${path === '/' ? '' : path}`);
        if (path === '/') patterns.push(`/${lang}`);
      });
    }
    patterns.push(path);
    patterns.forEach((pattern) => {
      if (!registeredPatterns.has(pattern)) {
        registeredPatterns.add(pattern);
        honoApp.get(pattern, async (c) => {
          try {
            const language = c.get('language');
            const url = new URL(c.req.url);
            const { content, params } = matchAndRenderRoute(url.pathname, language);
            const appContent = h('div', { className: 'app-root' }, content);
            const html = renderToString(
              Document({
                title: appName,
                content: renderToString(appContent),
                language,
                theme,
                scripts,
                styles,
                appName,
              })
            );
            const response = c.html('<!DOCTYPE html>' + html);
            response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
            return response;
          } catch (error) {
            console.error(`Route error [${c.req.method} ${c.req.url}]:`, error);
            const errorHtml = `
              <!DOCTYPE html>
              <html>
                <head><title>500 - Server Error</title></head>
                <body>
                  <h1>Internal Server Error</h1>
                  <p>An error occurred while processing your request.</p>
                  ${c.get('environment') !== 'production' ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}
                </body>
              </html>
            `;
            return c.html(errorHtml, 500);
          }
        });
      }
    });
  }
  if (options.routes && typeof options.routes === 'function') options.routes(honoApp);
  // 404 handler
  honoApp.notFound((c) => {
    const language = c.get('language') || 'en';
    const notFoundContent = h(
      'div',
      { className: 'page not-found' },
      h('h1', {}, '404 - Not Found'),
      h('p', {}, 'The page you are looking for does not exist'),
      h('a', { href: '/' }, 'Go Home')
    );
    const html = renderToString(
      Document({
        title: '404 - Not Found',
        content: renderToString(notFoundContent),
        language,
        theme,
        appName,
      })
    );
    return c.html('<!DOCTYPE html>' + html, 404);
  });

  // error handler
  honoApp.onError((err, c) => {
    console.error(`Server error [${c.req.method} ${c.req.url}]:`, err);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>500 - Server Error</title></head>
        <body>
          <h1>Internal Server Error</h1>
          <p>An unexpected error occurred.</p>
          ${c.get('environment') !== 'production' ? `<pre>${escapeHtml(err.stack || err.message)}</pre>` : ''}
        </body>
      </html>
    `;
    return c.html(errorHtml, 500);
  });
  // return hono's fetch handler
  return honoApp.fetch.bind(honoApp);
}

/**
 * export route registry for client access
 * @returns {Map} Current route registry
 */
export function getRouteRegistry() {
  return serverContext.routeRegistry;
}

/**
 * get i18n configuration
 * @returns {Object|null} Current i18n config
 */
export function getI18nConfig() {
  return serverContext.i18nConfig;
}
