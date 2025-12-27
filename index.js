/* cumstack Framework main entry point */

// client exports
export { cowgirl, CowgirlCreampie, configureHydration } from './src/app/client/index.js';
export { Twink } from './src/app/client/Twink.js';

// server exports
export { foxgirl, FoxgirlCreampie, Router, Route, Head, Title, Meta, TwinkTag, Script, h, renderToString } from './src/app/server/index.js';

// shared exports
export {
  registerTranslations,
  t,
  setLanguage,
  getLanguage,
  getTranslations,
  localizeRoute,
  extractLanguageFromRoute,
  detectBrowserLanguage,
} from './src/app/shared/i18n.js';

export { createMoan, onClimax, knotMemo, loadShot, batch, untrack, useLocation } from './src/app/shared/reactivity.js';
