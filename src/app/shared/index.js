/**
 * cumstack Shared utilities
 * utilities that work on both server and client
 */

export { env } from './env.js';
export { api } from './api.js';
export { cdn } from './cdn.js';
export {
  t,
  registerTranslations,
  setLanguage,
  getLanguage,
  getSupportedLanguages,
  currentLanguage,
  localizeRoute,
  extractLanguageFromRoute,
  createLanguageSwitcher,
  getLanguageName,
} from './i18n.js';
