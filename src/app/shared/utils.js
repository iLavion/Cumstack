/**
 * cumstack Utilities
 * common helper functions
 */

/**
 * class names helper (similar to clsx)
 * @param {...any} args - Class arguments
 * @returns {string}
 */
export function cn(...args) {
  return args
    .flat()
    .filter(Boolean)
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object')
        return Object.entries(arg)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key)
          .join(' ');
      return '';
    })
    .join(' ')
    .trim();
}

/**
 * debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * throttle function
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Delay in ms
 * @returns {Function}
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * generate unique id
 * @returns {string}
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * deep clone object
 * @template T
 * @param {T} obj - Object to clone
 * @returns {T}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  const cloned = {};
  for (const key in obj) if (obj.hasOwnProperty(key)) cloned[key] = deepClone(obj[key]);
  return cloned;
}

/**
 * check if value is empty
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * format date
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale
 * @returns {string}
 */
export function formatDate(date, locale = 'en-US') {
  const d = new Date(date);
  return d.toLocaleDateString(locale);
}

/**
 * format currency
 * @param {number} amount - Amount
 * @param {string} currency - Currency code
 * @param {string} locale - Locale
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
