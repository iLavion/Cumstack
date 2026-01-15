/**
 * cumstack i18n System
 * built-in internationalization support
 */

import { createMoan } from "./reactivity.js";
import { isValidLanguageCode, getLanguageName } from "./language-codes.js";

// translation store
const translations = new Map();
let i18nConfiguration = {
  supportedLanguages: null, // null means use all registered
  explicitRouting: false,
  defaultLanguage: null,
  fallbackLanguage: null,
  storageKeys: {
    page: "pLng",
    user: "uLng",
  },
};
let [currentLanguage, setCurrentLanguage] = createMoan(null);

/**
 * get supported languages from config or all registered translations
 * @returns {string[]}
 */
export function getSupportedLanguages() {
  const registered = Array.from(translations.keys());
  // if supportedLanguages is configured, filter registered translations
  if (i18nConfiguration.supportedLanguages && Array.isArray(i18nConfiguration.supportedLanguages)) {
    return registered.filter((lang) => i18nConfiguration.supportedLanguages.includes(lang));
  }
  return registered;
}

/**
 * register translations for a language
 * @param {string} lang - Language code (must be valid ISO 639-1)
 * @param {Record<string, string>} messages - Translation messages
 */
export function registerTranslations(lang, messages) {
  if (!isValidLanguageCode(lang)) {
    console.warn(`Invalid language code: ${lang}. Must be a valid ISO 639-1 code.`);
    return;
  }
  translations.set(lang, messages);
  //console.log(`[i18n] Registered translations for '${lang}':`, Object.keys(messages).slice(0, 10));
}

/**
 * get translation for a key
 * @param {string} key - Translation key (supports dot notation for nested keys)
 * @param {Record<string, any>} params - Interpolation params
 * @returns {string}
 */
export function t(key, params = {}) {
  const lang = currentLanguage();
  const fallback = i18nConfiguration.fallbackLanguage || getSupportedLanguages()[0];
  const messages = translations.get(lang) || translations.get(fallback) || {};
  // support dot notation for nested keys
  const keys = key.split(".");
  let message = messages;
  for (const k of keys) {
    if (message && typeof message === "object") message = message[k];
    else {
      message = undefined;
      break;
    }
  }
  // fallback to key if not found
  if (message === undefined) return key;
  // if message is a string, interpolate params
  if (typeof message === "string") {
    Object.keys(params).forEach((param) => (message = message.replace(new RegExp(`\\{${param}\\}`, "g"), params[param])));
  }
  return message;
}

/**
 * set current language
 * @param {string} lang - Language code
 * @param {boolean} isExplicitRoute - Whether this is from an explicit language route
 */
export function setLanguage(lang, isExplicitRoute = false) {
  const supportedLanguages = getSupportedLanguages();
  //console.log('[i18n] setLanguage called:', { lang, isExplicitRoute, supportedLanguages, isServer: typeof window === 'undefined' });
  if (supportedLanguages.includes(lang)) {
    setCurrentLanguage(lang);
    //console.log('[i18n] Language set to:', lang, 'current is now:', currentLanguage());
    // store in localstorage if available
    if (typeof window !== "undefined") {
      const pageKey = i18nConfiguration.storageKeys?.page || "pLng";
      const userKey = i18nConfiguration.storageKeys?.user || "uLng";
      localStorage.setItem("language", lang);
      // if it's an explicit route, store as preferred language
      if (isExplicitRoute) localStorage.setItem(pageKey, lang);
      // always update user language
      localStorage.setItem(userKey, lang);
      document.documentElement.lang = lang;
    }
  } else {
    //console.warn('[i18n] Language not supported:', lang, 'supported:', supportedLanguages);
  }
}

/**
 * get current language
 * @returns {string}
 */
export function getLanguage() {
  return currentLanguage();
}

/**
 * get all translations for a language
 * @param {string} lang - Language code
 * @returns {Record<string, string>}
 */
export function getTranslations(lang = null) {
  const targetLang = lang || currentLanguage();
  return translations.get(targetLang) || {};
}

/**
 * detect language from browser
 * @returns {string}
 */
export function detectBrowserLanguage() {
  if (typeof window === "undefined") return i18nConfiguration.fallbackLanguage || getSupportedLanguages()[0];
  const supportedLanguages = getSupportedLanguages();
  // check localstorage first
  const stored = localStorage.getItem("language");
  if (stored && supportedLanguages.includes(stored)) return stored;
  // check navigator language
  const browserLang = navigator.language.split("-")[0];
  return supportedLanguages.includes(browserLang) ? browserLang : i18nConfiguration.fallbackLanguage || getSupportedLanguages()[0];
}

/**
 * get user language from localstorage
 * @returns {string|null}
 */
export function getUserLanguage() {
  if (typeof window === "undefined") return null;
  const supportedLanguages = getSupportedLanguages();
  const userKey = i18nConfiguration.storageKeys?.user || "uLng";
  const userLang = localStorage.getItem(userKey);
  return userLang && supportedLanguages.includes(userLang) ? userLang : null;
}

/**
 * get preferred language from localstorage
 * @returns {string|null}
 */
export function getPreferredLanguage() {
  if (typeof window === "undefined") return null;
  const supportedLanguages = getSupportedLanguages();
  const pageKey = i18nConfiguration.storageKeys?.page || "pLng";
  const prefLang = localStorage.getItem(pageKey);
  return prefLang && supportedLanguages.includes(prefLang) ? prefLang : null;
}

/**
 * set preferred language
 * @param {string} lang - Language code
 */
export function setPreferredLanguage(lang) {
  const supportedLanguages = getSupportedLanguages();
  const pageKey = i18nConfiguration.storageKeys?.page || "pLng";
  if (typeof window !== "undefined" && supportedLanguages.includes(lang)) localStorage.setItem(pageKey, lang);
}

/**
 * clear preferred language from localstorage
 */
export function clearPreferredLanguage() {
  if (typeof window !== "undefined") {
    const pageKey = i18nConfiguration.storageKeys?.page || "pLng";
    localStorage.removeItem(pageKey);
  }
}

/**
 * initialize i18n system
 * @param {Object} options - Initialization options
 * @param {Array<string>} [options.supportedLanguages] - List of supported language codes
 * @param {boolean} [options.explicitRouting] - Enable language prefix in routes
 * @param {string} [options.defaultLanguage] - Default language ('auto' for detection)
 * @param {string} [options.fallbackLanguage] - Fallback language
 * @param {Object} [options.storageKeys] - Custom localStorage keys
 * @param {boolean} [options.detectBrowser] - Enable browser language detection
 * @returns {Object} i18n utilities (language signal, setLanguage, t)
 */
export function initI18n(options = {}) {
  // merge configuration
  i18nConfiguration = {
    ...i18nConfiguration,
    supportedLanguages: options.supportedLanguages || null,
    explicitRouting: options.explicitRouting !== undefined ? options.explicitRouting : false,
    defaultLanguage: options.defaultLanguage || options.defaultLng || null,
    fallbackLanguage: options.fallbackLanguage || options.fallbackLng || null,
    storageKeys: {
      page: options.storageKeys?.page || options.storageKeys?.preferred || "pLng",
      user: options.storageKeys?.user || "uLng",
    },
  };
  const supportedLanguages = getSupportedLanguages();
  const configDefaultLang = i18nConfiguration.defaultLanguage;
  const fallbackLang = i18nConfiguration.fallbackLanguage || supportedLanguages[0];
  const { detectBrowser = true } = options;
  let initialLang = fallbackLang;
  // handle 'auto' detection or browser detection
  if (configDefaultLang === "auto" || (detectBrowser && typeof window !== "undefined")) initialLang = detectBrowserLanguage();
  else if (configDefaultLang && configDefaultLang !== "auto") initialLang = configDefaultLang;
  setCurrentLanguage(initialLang);
  if (typeof window !== "undefined") document.documentElement.lang = initialLang;
  return {
    language: currentLanguage,
    setLanguage,
    t,
  };
}

/**
 * localize a route path with language prefix
 * @param {string} path - Route path
 * @param {string|null} [lang] - Language code (defaults to current language)
 * @returns {string} Localized route path
 */
export function localizeRoute(path, lang = null) {
  const language = lang || currentLanguage();
  const defaultLang = i18nConfiguration.fallbackLanguage || getSupportedLanguages()[0];
  if (!i18nConfiguration.explicitRouting && language === defaultLang) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${language}${normalizedPath}`;
}

/**
 * extract language from localized route
 * @param {string} path - Route path
 * @returns {{ language: string, path: string }}
 */
export function extractLanguageFromRoute(path) {
  const segments = path.split("/").filter(Boolean);
  const supportedLanguages = getSupportedLanguages();
  if (segments.length > 0 && supportedLanguages.includes(segments[0])) {
    return {
      language: segments[0],
      path: "/" + segments.slice(1).join("/"),
    };
  }
  return {
    language: i18nConfiguration.fallbackLanguage || getSupportedLanguages()[0],
    path,
  };
}

/**
 * create language switcher helper
 * @param {Function} navigate - Navigation function
 * @returns {Function} Language switcher function
 */
export function createLanguageSwitcher(navigate) {
  return (lang) => {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
    const { path } = extractLanguageFromRoute(currentPath);
    const newPath = localizeRoute(path, lang);
    setLanguage(lang);
    navigate?.(newPath);
  };
}

/**
 * get the configured default language
 * @returns {string}
 */
export function getDefaultLanguage() {
  return i18nConfiguration.fallbackLanguage || getSupportedLanguages()[0];
}

/**
 * get the i18n configuration
 * @returns {Object}
 */
export function getI18nConfiguration() {
  return i18nConfiguration;
}

export { currentLanguage, getLanguageName };
