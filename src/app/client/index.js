/**
 * cumstack Client
 * client-side rendering and hydration
 */

import { setLanguage, detectBrowserLanguage, clearPreferredLanguage, getUserLanguage } from "../shared/i18n.js";
import { initComponents } from "./components.js";
import { initHMR } from "./hmr.js";

export { Lust } from "./Lust.js";
export { Image } from "./Image.js";
export { configureHydration, useRouter } from "../client.js";
export { api } from "../shared/api.js";
export { cdn } from "../shared/cdn.js";
export { env } from "../shared/env.js";

/**
 * client entry wrapper component
 * @param {Object} props - Component props
 * @param {*} props.children - Child elements
 * @returns {*} Children
 */
export function CowgirlCreampie({ children }) {
  return children || null;
}

/**
 * mount and hydrate the app (client-side initialization)
 * @param {Function} app - App component function
 * @param {HTMLElement|string} container - Container element or selector
 * @returns {void}
 */
export function cowgirl(app, container) {
  initHMR();
  if (typeof window !== "undefined") window.initComponents = initComponents;
  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  let language = "en";
  let isExplicitRoute = false;

  if (pathSegments.length > 0 && pathSegments[0].length === 2) {
    // LANG ROUTE - (e.g., /en/, /sv/about)
    language = pathSegments[0];
    isExplicitRoute = true;
  } else {
    // ROOT ROUTE - check for user language first, then use auto-detection
    clearPreferredLanguage();
    const userLang = getUserLanguage();
    if (userLang) language = userLang;
    else language = detectBrowserLanguage();
  }
  setLanguage(language, isExplicitRoute);
  setupNavigation();
  initComponents();
}

/**
 * render virtual node to DOM element
 * @param {*} vnode - Virtual node to render
 * @param {HTMLElement} container - Container element
 * @returns {void}
 */
function renderElement(vnode, container) {
  if (vnode == null || vnode === false || vnode === true) return;
  if (typeof vnode === "string" || typeof vnode === "number") {
    container.appendChild(document.createTextNode(vnode));
    return;
  }
  if (Array.isArray(vnode)) {
    vnode.forEach((child) => renderElement(child, container));
    return;
  }
  if (typeof vnode === "function") {
    renderElement(vnode(), container);
    return;
  }
  if (vnode.type === "fragment") {
    vnode.children?.forEach((child) => renderElement(child, container));
    return;
  }
  if (typeof vnode.type === "function") {
    const result = vnode.type(vnode.props || {});
    renderElement(result, container);
    return;
  }

  const element = document.createElement(vnode.type);

  // set props
  if (vnode.props) {
    Object.entries(vnode.props).forEach(([key, value]) => {
      if (key === "children") return;
      if (key.startsWith("on") && typeof value === "function") {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === "className") element.className = value;
      else if (key === "style" && typeof value === "object") Object.assign(element.style, value);
      else if (key === "dangerouslySetInnerHTML") element.innerHTML = value.__html;
      else element.setAttribute(key, value);
    });
  }
  // render children
  if (vnode.children) vnode.children.forEach((child) => renderElement(child, element));
  container.appendChild(element);
}

/**
 * setup SPA navigation with language route handling
 * @returns {void}
 */
function setupNavigation() {
  // update all spa links to include language prefix if in a language route
  function updateLustsForLanguage() {
    const inLanguageRoute = window.location.pathname.match(/^\/([a-z]{2})(?:\/|$)/);
    if (!inLanguageRoute) return;
    const lang = inLanguageRoute[1];
    document.querySelectorAll("a[data-spa-link]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("//")) return;
      // if href doesn't already have language prefix, add it
      if (!href.match(/^\/[a-z]{2}(?:\/|$)/)) link.setAttribute("href", `/${lang}${href === "/" ? "" : href}`);
    });
  }

  // update on initial load
  updateLustsForLanguage();

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-spa-link]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("//")) return;
    e.preventDefault();
    window.history.pushState({}, "", href);
    window.location.reload();
  });
}
