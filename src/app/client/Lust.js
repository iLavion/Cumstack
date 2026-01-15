/**
 * link component - client side
 */

import { getLanguage } from "../shared/i18n.js";

/**
 * check if currently in a language-prefixed route
 * @returns {boolean} True if in a language-prefixed route
 */
function isInLanguageRoute() {
  if (typeof window === "undefined") return false;
  return window.location.pathname.match(/^\/[a-z]{2}(?:\/|$)/);
}

/**
 * smart link component with automatic language prefix handling
 * @param {Object} props - Lust properties
 * @param {string} props.href - Lust URL
 * @param {string|boolean} [props.locale] - Language code or false to disable prefix
 * @param {string} [props.prefetch] - Prefetch mode ('hover' or 'visible')
 * @param {string} [props.access] - Access level for link
 * @param {boolean} [props.external] - Force external link behavior
 * @param {*} props.children - Lust content
 * @returns {Object} Virtual DOM element
 */
export function Lust(props) {
  const { href, locale, prefetch, access, external, children, ...rest } = props;
  if (!href) {
    return {
      type: "a",
      props: { ...rest, href: "#" },
      children: Array.isArray(children) ? children : [children],
    };
  }

  const currentLanguage = getLanguage();
  const isExternal = external || href.startsWith("http") || href.startsWith("//");

  // check if we're currently in a language-prefixed route
  // this will be evaluated at render time, so it will update on navigation
  const inLanguageRoute = isInLanguageRoute();

  // apply locale to internal links only if we're in a language route or locale is explicitly set
  let finalHref = href;
  if (!isExternal && (locale || (locale !== false && inLanguageRoute))) {
    const targetLocale = locale || currentLanguage;
    if (!href.startsWith(`/${targetLocale}`)) finalHref = `/${targetLocale}${href === "/" ? "" : href}`;
  }

  const linkProps = {
    ...rest,
    href: finalHref,
    "data-spa-link": !isExternal,
    ...(prefetch && { "data-prefetch": prefetch }),
    ...(access && { "data-link-access": access }),
    ...(isExternal && { target: "_blank", rel: "noopener noreferrer" }),
  };

  return {
    type: "a",
    props: linkProps,
    children: Array.isArray(children) ? children : [children],
  };
}
