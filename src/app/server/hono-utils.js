/**
 * cumstack Hono Utilities
 * helper functions for working with hono
 */

/**
 * create a middleware for i18n detection
 * @param {Object} config - i18n configuration
 * @param {string} config.fallbackLng - Fallback language
 * @param {boolean} config.explicitRouting - Enable explicit language routing
 * @param {Array<string>} config.supportedLanguages - Supported languages
 * @param {string} config.defaultLng - Default language setting
 * @returns {Function} Hono middleware function
 */
export function createI18nMiddleware(config) {
  return async (c, next) => {
    const url = new URL(c.req.url);
    let language = config.fallbackLng;

    // check url path first if explicit routing
    if (config.explicitRouting) {
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0 && config.supportedLanguages.includes(pathSegments[0])) language = pathSegments[0];
    }

    // check accept-language header if auto-detect
    if (language === config.fallbackLng && config.defaultLng === 'auto') {
      const acceptLang = c.req.header('accept-language');
      if (acceptLang) {
        const detected = acceptLang
          .split(',')
          .map((l) => l.split(';')[0].trim().split('-')[0])
          .find((l) => config.supportedLanguages.includes(l));
        if (detected) language = detected;
      }
    }
    c.set('language', language);
    await next();
  };
}

/**
 * create a middleware for CORS handling
 * @param {Object} [options] - CORS configuration options
 * @param {string} [options.origin] - Allowed origin
 * @param {Array<string>} [options.methods] - Allowed HTTP methods
 * @param {Array<string>} [options.allowHeaders] - Allowed headers
 * @param {Array<string>} [options.exposeHeaders] - Exposed headers
 * @param {boolean} [options.credentials] - Allow credentials
 * @param {number} [options.maxAge] - Max age for preflight cache
 * @returns {Function} Hono middleware function
 */
export function createCorsMiddleware(options = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders = ['Content-Type', 'Authorization'],
    exposeHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (c, next) => {
    // handle preflight
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': allowHeaders.join(', '),
          'Access-Control-Max-Age': maxAge.toString(),
          ...(credentials && { 'Access-Control-Allow-Credentials': 'true' }),
          ...(exposeHeaders.length && {
            'Access-Control-Expose-Headers': exposeHeaders.join(', '),
          }),
        },
      });
    }

    await next();

    // add cors headers to response
    c.header('Access-Control-Allow-Origin', origin);
    if (credentials) c.header('Access-Control-Allow-Credentials', 'true');
  };
}

/**
 * create a middleware for security headers
 * @returns {Function} Hono middleware function that adds security headers
 */
export function createSecurityHeadersMiddleware() {
  return async (c, next) => {
    await next();

    // security headers
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  };
}

/**
 * create a middleware for HTTP caching
 * @param {Object} [options] - Cache configuration
 * @param {number} [options.maxAge] - Max age in seconds
 * @param {number} [options.sMaxAge] - Shared cache max age
 * @param {number} [options.staleWhileRevalidate] - Stale while revalidate time
 * @param {number} [options.staleIfError] - Stale if error time
 * @param {boolean} [options.public] - Public cache
 * @param {boolean} [options.private] - Private cache
 * @param {boolean} [options.noCache] - No cache directive
 * @param {boolean} [options.noStore] - No store directive
 * @param {boolean} [options.mustRevalidate] - Must revalidate directive
 * @returns {Function} Hono middleware function
 */
export function createCacheMiddleware(options = {}) {
  const {
    maxAge = 0,
    sMaxAge,
    staleWhileRevalidate,
    staleIfError,
    public: isPublic = true,
    private: isPrivate = false,
    noCache = false,
    noStore = false,
    mustRevalidate = false,
  } = options;

  return async (c, next) => {
    await next();
    const directives = [];
    if (noStore) directives.push('no-store');
    if (noCache) directives.push('no-cache');
    if (isPublic) directives.push('public');
    if (isPrivate) directives.push('private');
    if (mustRevalidate) directives.push('must-revalidate');
    if (maxAge !== undefined) directives.push(`max-age=${maxAge}`);
    if (sMaxAge !== undefined) directives.push(`s-maxage=${sMaxAge}`);
    if (staleWhileRevalidate !== undefined) directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    if (staleIfError !== undefined) directives.push(`stale-if-error=${staleIfError}`);
    if (directives.length > 0) c.header('Cache-Control', directives.join(', '));
  };
}

/**
 * create a middleware for response compression
 * @returns {Function} Hono middleware function that adds compression headers
 */
export function createCompressionMiddleware() {
  return async (c, next) => {
    await next();
    const acceptEncoding = c.req.header('accept-encoding') || '';
    if (acceptEncoding.includes('gzip')) c.header('Content-Encoding', 'gzip');
    else if (acceptEncoding.includes('deflate')) c.header('Content-Encoding', 'deflate');
  };
}

/**
 * create a middleware for request logging
 * @returns {Function} Hono middleware function that logs requests
 */
export function createLoggerMiddleware() {
  return async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const url = c.req.url;
    await next();
    const duration = Date.now() - start;
    const status = c.res.status;
    console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} ${duration}ms`);
  };
}

/**
 * create a middleware for rate limiting
 * @param {Object} [options] - Rate limit configuration
 * @param {number} [options.windowMs] - Time window in milliseconds
 * @param {number} [options.max] - Maximum requests per window
 * @param {Function} [options.keyGenerator] - Function to generate rate limit key
 * @returns {Function} Hono middleware function that enforces rate limits
 */
export function createRateLimitMiddleware(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    max = 60, // 60 requests per window
    keyGenerator = (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
  } = options;

  const requests = new Map();

  return async (c, next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    // clean old entries
    for (const [k, data] of requests.entries()) if (now - data.resetTime > windowMs) requests.delete(k);

    // get or create entry
    let entry = requests.get(key);
    if (!entry || now - entry.resetTime > windowMs) {
      entry = { count: 0, resetTime: now };
      requests.set(key, entry);
    }

    entry.count++;

    // check limit
    if (entry.count > max) return c.text('Too Many Requests', 429);

    // rate limit headers
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', (max - entry.count).toString());
    c.header('X-RateLimit-Reset', new Date(entry.resetTime + windowMs).toISOString());

    await next();
  };
}

/**
 * create error response helper
 * @param {Object} c - Hono context
 * @param {Error} error - Error object
 * @param {number} [status=500] - HTTP status code
 * @returns {Response} JSON error response
 */
export function errorResponse(c, error, status = 500) {
  console.error('Error:', error);
  const isDev = globalThis.__ENVIRONMENT__ === 'development';
  return c.json(
    {
      error: {
        message: error.message || 'Internal Server Error',
        status,
        ...(isDev && { stack: error.stack }),
      },
    },
    status
  );
}

/**
 * create success response helper
 * @param {Object} c - Hono context
 * @param {*} data - Response data
 * @param {number} [status=200] - HTTP status code
 * @returns {Response} JSON success response
 */
export function successResponse(c, data, status = 200) {
  return c.json(
    {
      success: true,
      data,
    },
    status
  );
}

/**
 * redirect helper
 * @param {Object} c - Hono context
 * @param {string} location - Redirect URL
 * @param {number} [status=302] - HTTP status code
 * @returns {Response} Redirect response
 */
export function redirect(c, location, status = 302) {
  return c.redirect(location, status);
}

/**
 * stream HTML response
 * @param {Object} c - Hono context
 * @param {Function} generator - Async generator function that yields HTML chunks
 * @returns {Promise<Response>} Streaming HTML response
 */
export async function streamHTML(c, generator) {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(new TextEncoder().encode('<!DOCTYPE html>'));
      for await (const chunk of generator()) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
