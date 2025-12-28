/**
 * cumstack Server
 * server-side rendering with hono
 */

import { Hono } from 'hono';
import { setLanguage, extractLanguageFromRoute } from '../shared/i18n.js';
import { raw } from 'hono/html';

const routeRegistry = new Map();
let globalI18nConfig = null;
let honoApp = null;

/**
 * render to string (ssr) - convert JSX to HTML string
 * Handles both Hono JSX nodes and cumstack's plain object format
 */
export async function renderToString(vnode) {
  if (vnode === null || vnode === undefined) return '';
  if (typeof vnode === 'string') return vnode;
  if (typeof vnode === 'number') return String(vnode);
  if (typeof vnode === 'boolean') return '';

  // Handle Hono HTML strings (String objects with isEscaped property)
  // These are the pre-rendered strings that Hono JSX produces
  if (vnode && typeof vnode === 'object' && vnode instanceof String) {
    const htmlString = vnode.toString();
    // Convert className to class since Hono doesn't do this
    const fixedHtml = htmlString.replace(/\sclassName=/g, ' class=');
    return fixedHtml;
  }

  // Handle arrays
  if (Array.isArray(vnode)) {
    const results = await Promise.all(vnode.map((child) => renderToString(child)));
    return results.join('');
  }

  // For plain objects from cumstack components (like Lust)
  if (vnode && typeof vnode === 'object' && vnode.type && vnode.props !== undefined && !vnode.toStringToBuffer) {
    const { type, props, children } = vnode;

    // Handle function components - call them
    if (typeof type === 'function') {
      const result = type({ ...props, children });
      return await renderToString(result);
    }

    // Render as HTML element
    const attrs = Object.entries(props || {})
      .map(([k, v]) => {
        if (k === 'children' || k === 'dangerouslySetInnerHTML') return '';
        if (v === true) return k;
        if (v === false || v === null || v === undefined) return '';
        // Convert JSX attributes to HTML attributes
        const attrName = k === 'className' ? 'class' : k === 'htmlFor' ? 'for' : k;
        // Escape attribute values
        const escaped = String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return `${attrName}="${escaped}"`;
      })
      .filter(Boolean)
      .join(' ');

    const openTag = attrs ? `<${type} ${attrs}>` : `<${type}>`;

    // Handle dangerous HTML
    if (props.dangerouslySetInnerHTML && props.dangerouslySetInnerHTML.__html) {
      return `${openTag}${props.dangerouslySetInnerHTML.__html}</${type}>`;
    }

    // Self-closing tags
    if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(type)) {
      return `<${type}${attrs ? ' ' + attrs : ''} />`;
    }

    const childrenHtml = await renderToString(children);
    return `${openTag}${childrenHtml}</${type}>`;
  }

  // For Hono JSX nodes - convert to plain HTML manually to avoid the str.search bug
  if (vnode && typeof vnode === 'object' && (vnode.tag !== undefined || vnode.toStringToBuffer)) {
    // This is a Hono JSX node - manually convert to HTML instead of using toString()
    // to avoid the bug where non-string values cause errors in escapeToBuffer

    const tag = vnode.tag;
    const props = vnode.props || {};
    const children = vnode.children || [];

    // Handle fragments
    if (!tag || tag === '') {
      return await renderToString(children);
    }

    // Handle function components
    if (typeof tag === 'function') {
      const result = tag(props);
      return await renderToString(result);
    }

    // Build attributes
    const attrs = Object.entries(props)
      .map(([k, v]) => {
        if (k === 'children' || k === 'dangerouslySetInnerHTML') return '';
        if (v === true) return k;
        if (v === false || v === null || v === undefined) return '';
        // Convert JSX attributes to HTML attributes
        const attrName = k === 'className' ? 'class' : k === 'htmlFor' ? 'for' : k;
        // Escape attribute values
        const escaped = String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return `${attrName}="${escaped}"`;
      })
      .filter(Boolean)
      .join(' ');

    // Handle dangerous HTML
    if (props.dangerouslySetInnerHTML && props.dangerouslySetInnerHTML.__html) {
      const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
      return `${openTag}${props.dangerouslySetInnerHTML.__html}</${tag}>`;
    }

    // Self-closing tags
    if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tag)) {
      return `<${tag}${attrs ? ' ' + attrs : ''} />`;
    }

    const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
    const childrenHtml = await renderToString(children);
    return `${openTag}${childrenHtml}</${tag}>`;
  }

  // Fallback for unexpected types
  console.warn('[renderToString] Unexpected type:', typeof vnode, vnode);
  return '';
}

/**
 *  router component
 */
export function Router({ children, i18nOpt }) {
  if (i18nOpt) globalI18nConfig = i18nOpt;

  // extract routes from children
  if (Array.isArray(children)) {
    children.forEach((child) => {
      if (child && child.type === Route && child.props) routeRegistry.set(child.props.path, child.props.component);
    });
  } else if (children && children.type === Route && children.props) {
    routeRegistry.set(children.props.path, children.props.component);
  }
  return children;
}

/**
 *  route component
 */
export function Route({ path, component }) {
  if (component) routeRegistry.set(path, component);
  return null;
}

/**
 *  FoxgirlCreampie component
 */
export function FoxgirlCreampie({ children }) {
  return children;
}

/**
 *  head component - collect metadata for page
 */
const headContext = {
  title: 'App',
  meta: [],
  links: [],
  scripts: [],
  cache: null,
};

export function Head({ children }) {
  // extract head elements during ssr
  if (Array.isArray(children)) children.forEach((child) => processHeadChild(child));
  else if (children) processHeadChild(children);
  return null;
}

export function Title({ children }) {
  headContext.title = children;
  return null;
}

export function Meta(props) {
  headContext.meta.push(props);
  return null;
}

export function LustTag(props) {
  headContext.links.push(props);
  return null;
}

export function Script(props) {
  headContext.scripts.push(props);
  return null;
}

function processHeadChild(child) {
  if (!child) return;
  if (child.type === 'title') headContext.title = child.children?.[0] || 'App';
  else if (child.type === 'meta') headContext.meta.push(child.props);
  else if (child.type === 'link') headContext.links.push(child.props);
  else if (child.type === 'script') headContext.scripts.push(child.props);
  else if (child.type === Title) headContext.title = child.children?.[0] || 'App';
  else if (child.type === Meta) headContext.meta.push(child.props);
  else if (child.type === LustTag) headContext.links.push(child.props);
  else if (child.type === Script) headContext.scripts.push(child.props);
}

function resetHeadContext() {
  headContext.title = 'App';
  headContext.meta = [];
  headContext.links = [];
  headContext.scripts = [];
  headContext.cache = null;
}

export function getHeadContext() {
  return headContext;
}

export function setCache(cacheConfig) {
  headContext.cache = cacheConfig;
}

/**
 * MilkStorage - Cache presets for common use cases
 * Use with setCache() or in metadata.cache
 *
 * Simple syntax:
 * cache: { app: 3600, cdn: 3600 }
 *
 * @example
 * const metadata = {
 *   title: 'Home',
 *   cache: MilkStorage.medium
 * };
 *
 * Or custom:
 * cache: { app: 3600, cdn: 86400 }
 */
export const MilkStorage = {
  // No caching - always fetch fresh
  none: { app: 0 },
  // Short cache - 5 minutes
  short: { app: 300, cdn: 300 },
  // Medium cache - 1 hour app, 6 hours CDN
  medium: { app: 3600, cdn: 21600 },
  // Long cache - 1 hour app, 1 day CDN
  long: { app: 3600, cdn: 86400 },
  // Static content - 1 day app, 1 week CDN
  static: { app: 86400, cdn: 604800 },
  // Dynamic with revalidation - serve stale while updating
  revalidate: {
    app: 60,
    cdn: 3600,
    staleWhileRevalidate: 86400,
  },
  // Resilient - serve stale on errors
  resilient: {
    app: 3600,
    cdn: 86400,
    staleWhileRevalidate: 86400,
    staleIfError: 604800,
  },
};

/**
 * html document template
 * user provides head and body, cumstack handles structure and script injection
 */
let customHead = null;
let customBody = null;

export function setDocumentHead(headFn) {
  customHead = headFn;
}

export function setDocumentBody(bodyFn) {
  customBody = bodyFn;
}

async function Document({ content, language }) {
  // render custom head or use default
  let headHtml;
  if (customHead) {
    const headElements = customHead({ context: headContext });
    headHtml = await renderToString(headElements);
  } else {
    // render meta tags as strings
    const metaTags = headContext.meta
      .map((m) => {
        const attrs = Object.entries(m)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ');
        return `<meta ${attrs} />`;
      })
      .join('\n    ');

    const linkTags = headContext.links
      .map((l) => {
        const attrs = Object.entries(l)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ');
        return `<link ${attrs} />`;
      })
      .join('\n    ');

    headHtml = `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${metaTags}
    <title>${headContext.title}</title>
    <link rel="stylesheet" href="/main.css" />
    ${linkTags}`;
  }

  // render custom body or use default
  let bodyHtml;
  if (customBody) {
    const bodyContent = customBody({ content, language });
    bodyHtml = await renderToString(bodyContent);
  } else {
    bodyHtml = `<body>
    <div id="app">${content}</div>
  </body>`;
  }

  const scriptTags = headContext.scripts
    .map((s) => {
      const attrs = Object.entries(s)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<script ${attrs}></script>`;
    })
    .join('\n    ');

  // Build full HTML document as string
  return `<!DOCTYPE html>
<html lang="${language}">
  <head>
    ${headHtml}
  </head>
  ${bodyHtml}
    <script>
    window.__ENV__ = ${JSON.stringify(globalThis.__ENV__ || {})};
    window.__ENVIRONMENT__ = ${JSON.stringify(globalThis.__ENVIRONMENT__ || 'production')};
    window.__HMR_PORT__ = ${globalThis.__HMR_PORT__ || 8790};
    window.__BUILD_TIMESTAMP__ = ${globalThis.__BUILD_TIMESTAMP__ || Date.now()};
  </script>
    <script type="module" src="/main.client.js"></script>
    ${scriptTags}
</html>`;
}

/**
 *  detect language from request
 */
function detectLanguageFromRequest(request, config) {
  const url = new URL(request.url);
  // check url path first if explicit routing
  if (config.explicitRouting) {
    const { language } = extractLanguageFromRoute(url.pathname);
    if (language && config.supportedLanguages?.includes(language)) return language;
  }

  // check accept-language header if auto-detection is enabled
  if (config.defaultLanguage === 'auto') {
    const acceptLang = request.headers.get('accept-language');
    if (acceptLang) {
      // parse all language preferences
      const languages = acceptLang.split(',').map((lang) => lang.split(';')[0].trim().split('-')[0]);
      // find first supported language
      for (const lang of languages) {
        if (config.supportedLanguages?.includes(lang)) {
          return lang;
        }
      }
    }
  }

  // use fallback
  return config.fallbackLanguage || 'en';
}

/**
 *  create server handler with hono
 */
export async function foxgirl(app, options = {}) {
  honoApp = new Hono();
  // call app to execute router and extract routes
  const appStructure = app();
  // process the structure to extract routes
  if (appStructure && appStructure.type === FoxgirlCreampie) {
    const routerNode = Array.isArray(appStructure.children)
      ? appStructure.children.find((child) => child && child.type === Router)
      : appStructure.children && appStructure.children.type === Router
        ? appStructure.children
        : null;
    if (routerNode && routerNode.props) Router(routerNode.props);
  }

  // note: register translations in your entry.server.jsx using registertranslations()
  // before calling foxgirl

  // environment middleware
  honoApp.use('*', async (c, next) => {
    globalThis.__DEPLOYMENT__ = c.env?.CF_VERSION_METADATA ?? null;
    globalThis.__ENV__ = c.env ?? {};
    globalThis.__ENVIRONMENT__ = c.env?.ENVIRONMENT ?? 'development';
    globalThis.__HMR_PORT__ = c.env?.DEV_RELOAD_PORT || 8790;
    await next();
  });

  // custom middlewares
  if (options.middlewares) options.middlewares(honoApp);

  // language detection
  honoApp.use('*', async (c, next) => {
    const language = detectLanguageFromRequest(
      c.req.raw,
      globalI18nConfig || {
        supportedLanguages: ['en'],
        defaultLanguage: 'en',
        fallbackLanguage: 'en',
      }
    );
    setLanguage(language);
    c.set('language', language);
    await next();
  });

  // register jsx routes
  for (const [path, component] of routeRegistry.entries()) {
    const patterns = [];
    if (globalI18nConfig?.explicitRouting) {
      globalI18nConfig.supportedLanguages.forEach((lang) => {
        patterns.push(`/${lang}${path === '/' ? '' : path}`);
        if (path === '/') patterns.push(`/${lang}`);
      });
    }
    patterns.push(path);
    patterns.forEach((pattern) => {
      honoApp.get(pattern, async (c) => {
        try {
          resetHeadContext();
          const language = c.get('language');
          const pageContent = component();
          // convert pageContent to string first before passing to Document
          const contentHtml = await renderToString(pageContent);
          const html = await Document({ content: contentHtml, language });
          // Set cache headers if configured
          const headers = { 'Content-Type': 'text/html; charset=utf-8' };
          const isDev = globalThis.__ENVIRONMENT__ === 'development';

          // Always set cache control headers
          if (isDev) headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          else if (headContext.cache) {
            const { app = 0, cdn = null, staleWhileRevalidate = null, staleIfError = null, tags = null, mustRevalidate = false } = headContext.cache;

            const directives = [];
            if (app === 0 && cdn === null) directives.push('no-cache', 'no-store', 'must-revalidate');
            else {
              // If CDN cache is set, make it public; otherwise private
              const isPublic = cdn !== null;
              directives.push(isPublic ? 'public' : 'private');
              if (app > 0) directives.push(`max-age=${app}`);
              if (cdn !== null) directives.push(`s-maxage=${cdn}`);
              if (staleWhileRevalidate !== null) directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
              if (staleIfError !== null) directives.push(`stale-if-error=${staleIfError}`);
              if (mustRevalidate) directives.push('must-revalidate');
            }
            headers['Cache-Control'] = directives.join(', ');
            // cloudflare-specific: Cache tags for purging
            if (tags && Array.isArray(tags)) headers['Cache-Tag'] = tags.join(',');
            // add vary header for i18n if using explicit routing
            if (globalI18nConfig?.explicitRouting) headers['Vary'] = 'Accept-Language';
          } else headers['Cache-Control'] = 'private, no-cache';
          return new Response(html, { headers });
        } catch (error) {
          console.error('Route error:', error);
          return c.text('Internal Server Error', 500);
        }
      });
    });
  }
  // custom api routes
  if (options.routes) options.routes(honoApp);
  // 404 handler
  honoApp.notFound(async (c) => {
    const html = await Document({
      content: '<div><h1>404 - Not Found</h1></div>',
      language: c.get('language') || 'en',
    });
    // Return with 404 status
    return new Response(html, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
  // error handler
  honoApp.onError((err, c) => {
    console.error('Server error:', err);
    return c.text('Internal Server Error', 500);
  });
  return honoApp;
}

export function getRouteRegistry() {
  return routeRegistry;
}

export function getI18nConfig() {
  return globalI18nConfig;
}

/**
 * get environment variable (server-side only)
 * @param {string} key - environment variable name
 * @param {string} [fallback] - fallback value if not found
 * @returns {string|undefined} environment variable value
 */
export function env(key, fallback) {
  const envVars = globalThis.__ENV__ || {};
  return envVars[key] ?? fallback;
}
