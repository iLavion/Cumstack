/**
 * cumstack Client Module
 * client-side rendering and hydration
 */

import { render } from './server/jsx.js';
import { createRouter } from './shared/router.js';
import { initI18n, setLanguage, extractLanguageFromRoute } from './shared/i18n.js';
import { onClimax } from './shared/reactivity.js';

let clientRouter = null;
let i18nConfig = null;
const registeredRoutes = new WeakMap();
let isRouterInitialized = false;

// hydration configuration
const hydrationConfig = {
  isProduction: typeof window !== 'undefined' && window.location.hostname !== 'localhost',
  logMismatches: true,
  partialHydration: false,
};

// event delegation cache
const delegatedEvents = new Map();
const eventDelegationRoot = typeof document !== 'undefined' ? document : null;

/**
 * get initial data from server
 * @returns {Object|null} Parsed initial data or null
 */
function getInitialData() {
  if (typeof window === 'undefined') return null;
  const script = document.getElementById('cumstack-data');
  if (script && script.textContent) {
    try {
      return JSON.parse(script.textContent);
    } catch (e) {
      console.error('Failed to parse initial data:', e);
    }
  }
  return null;
}

/**
 * initialize i18n on client
 * @param {Object} config - i18n configuration
 */
function initializeI18n(config) {
  i18nConfig = config;
  const initialData = getInitialData();
  const initialLang = initialData?.language || config.fallbackLng || 'en';
  initI18n({
    defaultLanguage: initialLang,
    detectBrowser: config.defaultLng === 'auto',
  });
  setLanguage(initialLang);
  if (typeof window !== 'undefined') window.__HONMOON_I18N_CONFIG__ = config;
}

/**
 * router component (client)
 * @param {Object} props - Component props
 * @param {Object} [props.i18nOpt] - i18n options
 * @param {*} props.children - Child elements
 * @returns {*} Children
 */
export function Router({ i18nOpt, children }) {
  if (i18nOpt && !i18nConfig) initializeI18n(i18nOpt);
  return children;
}

/**
 * route component (client)
 * @param {Object} props - Component props
 * @param {string} props.path - Route path
 * @param {Function} [props.component] - Component function
 * @param {*} [props.element] - Element to render
 * @param {*} [props.children] - Child elements
 * @returns {null}
 */
export function Route({ path, component, element, children }) {
  if (!clientRouter) clientRouter = createRouter();
  const handler = () => {
    if (component) return component();
    if (element) return element;
    return children;
  };

  // prevent duplicate registration
  const routeKey = { path };
  if (!registeredRoutes.has(routeKey)) {
    clientRouter.register(path, handler);
    registeredRoutes.set(routeKey, true);
  }
  return null;
}

/**
 * CowgirlCreampie component
 * @param {Object} props - Component props
 * @param {*} props.children - Child elements
 * @returns {*} Children
 */
export function CowgirlCreampie({ children }) {
  return children;
}

/**
 * configure hydration behavior
 * @param {Object} config - Configuration options
 * @param {boolean} [config.isProduction] - Whether in production mode
 * @param {boolean} [config.logMismatches] - Whether to log hydration mismatches
 * @param {boolean} [config.partialHydration] - Enable partial hydration
 */
export function configureHydration(config) {
  Object.assign(hydrationConfig, config);
}

/**
 * log hydration warning (respects production mode)
 * @param {string} message - Warning message
 * @param {Object} [data] - Additional data
 */
function logHydrationWarning(message, data) {
  if (!hydrationConfig.isProduction && hydrationConfig.logMismatches) console.warn(`[Hydration] ${message}`, data || '');
}

/**
 * setup event delegation for better performance
 * @param {string} eventName - Event name (e.g., 'click')
 * @param {HTMLElement} element - Element to attach listener to
 * @param {Function} handler - Event handler
 * @returns {Function} Cleanup function
 */
function delegateEvent(eventName, element, handler) {
  if (!eventDelegationRoot) return () => {};
  const eventKey = `__cumstack_${eventName}_handler`;
  if (!element[eventKey]) element[eventKey] = [];
  element[eventKey].push(handler);
  // setup delegated listener if not already present
  if (!delegatedEvents.has(eventName)) {
    const delegatedHandler = (e) => {
      let target = e.target;
      while (target && target !== eventDelegationRoot) {
        const handlers = target[eventKey];
        if (handlers) {
          handlers.forEach((h) => h.call(target, e));
          if (e.cancelBubble) return;
        }
        target = target.parentElement;
      }
    };
    eventDelegationRoot.addEventListener(eventName, delegatedHandler, true);
    delegatedEvents.set(eventName, delegatedHandler);
  }
  // return cleanup function
  return () => {
    const handlers = element[eventKey];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  };
}

/**
 * match vnode with DOM node using keys for better reconciliation
 * @param {any} vnode - Virtual node
 * @param {Node} domNode - DOM node
 * @returns {boolean} Whether nodes match
 */
function nodesMatch(vnode, domNode) {
  // text nodes
  if (typeof vnode === 'string' || typeof vnode === 'number') return domNode.nodeType === Node.TEXT_NODE;
  // element nodes
  if (vnode.type && domNode.nodeType === Node.ELEMENT_NODE) {
    const tagMatch = domNode.tagName.toLowerCase() === vnode.type.toLowerCase();
    // check key if present for better matching
    if (vnode.props?.key && domNode.dataset?.key) return tagMatch && domNode.dataset.key === String(vnode.props.key);
    return tagMatch;
  }
  return false;
}

/**
 * hydrate existing dom with virtual node
 * @param {any} vnode - Virtual node
 * @param {Node} domNode - Existing DOM node
 * @returns {Node} Hydrated DOM node
 */
function hydrateDOMElement(vnode, domNode) {
  // handle null/undefined
  if (vnode == null || vnode === false) return domNode;
  // handle text nodes
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    if (domNode.nodeType === Node.TEXT_NODE) {
      const vnodeText = String(vnode);
      if (domNode.textContent !== vnodeText) {
        logHydrationWarning('Text node mismatch', { expected: vnodeText, got: domNode.textContent });
        domNode.textContent = vnodeText;
      }
      return domNode;
    }
    // mismatch: replace with text node
    logHydrationWarning('Expected text node, got element');
    const textNode = document.createTextNode(String(vnode));
    domNode.parentNode?.replaceChild(textNode, domNode);
    return textNode;
  }

  // handle arrays - arrays represent siblings, not a container
  if (Array.isArray(vnode)) {
    const fragment = document.createDocumentFragment();
    let currentNode = domNode;
    for (let i = 0; i < vnode.length; i++) {
      const child = vnode[i];
      if (child == null || child === false) continue;
      if (currentNode) {
        const nextNode = currentNode.nextSibling;
        const hydratedNode = hydrateDOMElement(child, currentNode);
        fragment.appendChild(hydratedNode);
        currentNode = nextNode;
      } else {
        // no more DOM nodes, create new ones
        const newNode = createDOMElementForHydration(child);
        if (newNode) fragment.appendChild(newNode);
      }
    }
    return fragment;
  }
  // handle fragments or already rendered components
  if (!vnode.type) {
    // if it's an object without a type, it's likely already rendered - treat as children
    if (typeof vnode === 'object') {
      // could be fragment result or component output
      if (vnode.children) return hydrateDOMElement(vnode.children, domNode);
      if (vnode.props?.children) return hydrateDOMElement(vnode.props.children, domNode);
      // fallback
      logHydrationWarning('Unknown vnode structure', vnode);
      return domNode;
    }
    return hydrateDOMElement(vnode, domNode);
  }
  // handle element nodes
  if (domNode.nodeType !== Node.ELEMENT_NODE) {
    logHydrationWarning('Expected element node', { vnode, domNode });
    const newElement = createDOMElementForHydration(vnode);
    domNode.parentNode?.replaceChild(newElement, domNode);
    return newElement;
  }
  const element = domNode;
  // check tag name matches
  if (element.tagName.toLowerCase() !== vnode.type.toLowerCase()) {
    logHydrationWarning('Tag name mismatch', {
      expected: vnode.type,
      got: element.tagName.toLowerCase(),
    });
    const newElement = createDOMElementForHydration(vnode);
    element.parentNode?.replaceChild(newElement, element);
    return newElement;
  }

  // check partial hydration marker
  if (hydrationConfig.partialHydration && element.hasAttribute('data-cumstack-static')) return element;
  // hydrate props
  const booleanAttrs = new Set(['checked', 'selected', 'disabled', 'readonly', 'multiple', 'autofocus']);
  Object.entries(vnode.props || {}).forEach(([key, value]) => {
    if (key === 'key') {
      // store key as data attribute for reconciliation
      if (!element.dataset.key) element.dataset.key = String(value);
    } else if (key === 'className') {
      if (element.className !== value) {
        logHydrationWarning('className mismatch', { expected: value, got: element.className });
        element.className = value;
      }
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      // use event delegation for better performance
      const eventName = key.slice(2).toLowerCase();
      delegateEvent(eventName, element, value);
    } else if (key === 'innerHTML') {
      // skip innerHTML during hydration - it's already set by SSR
    } else if (key === 'value' && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
      // special handling for form values
      if (element.value !== value) element.value = value;
    } else if (booleanAttrs.has(key)) {
      // boolean attributes - check property not attribute
      if (element[key] !== value) element[key] = value;
    } else if (key === 'ref' && typeof value === 'function') {
      // handle refs
      value(element);
    } else if (value != null && value !== false) {
      const currentValue = element.getAttribute(key);
      if (currentValue !== String(value)) {
        logHydrationWarning('Attribute mismatch', { key, expected: value, got: currentValue });
        element.setAttribute(key, value);
      }
    }
  });
  // hydrate children
  const vnodeChildren = vnode.children || [];
  let domChild = element.firstChild;
  let vnodeIndex = 0;
  // helper to skip whitespace-only text nodes
  const skipWhitespace = (node) => {
    while (node && node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) node = node.nextSibling;
    return node;
  };
  domChild = skipWhitespace(domChild);
  while (vnodeIndex < vnodeChildren.length || domChild) {
    if (vnodeIndex >= vnodeChildren.length) {
      // extra dom nodes - remove them (unless whitespace)
      const nextSibling = domChild.nextSibling;
      if (domChild.nodeType === Node.TEXT_NODE && !domChild.textContent.trim()) {
        domChild = skipWhitespace(nextSibling);
        continue;
      }
      logHydrationWarning('Extra DOM nodes', domChild);
      element.removeChild(domChild);
      domChild = skipWhitespace(nextSibling);
      continue;
    }
    if (!domChild) {
      // missing dom nodes - create them
      logHydrationWarning('Missing DOM nodes');
      const newChild = createDOMElementForHydration(vnodeChildren[vnodeIndex]);
      if (newChild) element.appendChild(newChild);
      vnodeIndex++;
      continue;
    }
    const vChild = vnodeChildren[vnodeIndex];
    // skip null/false vnodes
    if (vChild == null || vChild === false) {
      vnodeIndex++;
      continue;
    }
    // check if nodes match (using keys if available)
    if (!nodesMatch(vChild, domChild)) {
      // try to find matching node by key
      if (vChild.props?.key) {
        let foundNode = null;
        let tempNode = domChild.nextSibling;
        while (tempNode && !foundNode) {
          if (nodesMatch(vChild, tempNode)) {
            foundNode = tempNode;
            break;
          }
          tempNode = tempNode.nextSibling;
        }
        if (foundNode) {
          // move node to correct position
          element.insertBefore(foundNode, domChild);
          const nextSibling = foundNode.nextSibling;
          hydrateDOMElement(vChild, foundNode);
          domChild = skipWhitespace(nextSibling);
          vnodeIndex++;
          continue;
        }
      }
      // no match found - replace node
      logHydrationWarning('Node mismatch, replacing');
      const newChild = createDOMElementForHydration(vChild);
      if (newChild) element.replaceChild(newChild, domChild);
      domChild = skipWhitespace(domChild.nextSibling);
      vnodeIndex++;
      continue;
    }
    const nextSibling = domChild.nextSibling;
    hydrateDOMElement(vChild, domChild);
    domChild = skipWhitespace(nextSibling);
    vnodeIndex++;
  }
  return element;
}

/**
 * create dom element from virtual node (used during hydration mismatches)
 * @param {any} vnode - Virtual node
 * @returns {Node|null}
 */
function createDOMElementForHydration(vnode) {
  // handle null/undefined
  if (vnode == null || vnode === false) return null;
  // handle text nodes
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));
  // handle arrays
  if (Array.isArray(vnode)) {
    const fragment = document.createDocumentFragment();
    vnode.forEach((child) => {
      const element = createDOMElementForHydration(child);
      if (element) fragment.appendChild(element);
    });
    return fragment;
  }
  // handle components (already rendered)
  if (!vnode.type) return createDOMElementForHydration(vnode);
  // create element
  const element = document.createElement(vnode.type);
  // set props
  Object.entries(vnode.props || {}).forEach(([key, value]) => {
    if (key === 'key') element.dataset.key = String(value);
    else if (key === 'className') element.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      // use event delegation
      const eventName = key.slice(2).toLowerCase();
      delegateEvent(eventName, element, value);
    } else if (key === 'innerHTML') element.innerHTML = value;
    else if (key === 'ref' && typeof value === 'function') value(element);
    else if (value != null && value !== false) element.setAttribute(key, value);
  });

  // append children
  (vnode.children || []).forEach((child) => {
    const childElement = createDOMElementForHydration(child);
    if (childElement) element.appendChild(childElement);
  });
  return element;
}

/**
 * cowgirl - mount and hydrate app
 * @param {Function} app - App component function
 * @param {HTMLElement|string} container - Container element or selector
 * @returns {Function} Cleanup function to dispose the app
 */
export function cowgirl(app, container) {
  // validate container
  const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
  if (!containerEl || !(containerEl instanceof HTMLElement)) throw new Error('cumstack: Container must be a valid HTMLElement or selector');
  if (!clientRouter) clientRouter = createRouter();
  // initialize router only once
  if (!isRouterInitialized) {
    clientRouter.init();
    isRouterInitialized = true;
  }
  // check if we're hydrating ssr content
  const isHydrating = containerEl.hasAttribute('data-cumstack-ssr') || containerEl.querySelector('[data-cumstack-ssr]') !== null;
  // cleanup functions
  const cleanupFns = [];
  // track if first render (for hydration)
  let isFirstRender = true;
  // create effect with error boundary
  const disposeEffect = onClimax(() => {
    try {
      const path = clientRouter.currentPath();
      const match = clientRouter.matchRoute();
      if (match) {
        const content = match.handler({
          path,
          params: clientRouter.currentParams(),
        });
        if (isHydrating && isFirstRender && containerEl.firstChild) {
          if (!hydrationConfig.isProduction) console.log('Hydrating existing content');
          const appRoot = containerEl.querySelector('.app-root') || containerEl.firstChild;
          hydrateDOMElement(content, appRoot);
          isFirstRender = false;
        } else render(content, containerEl);
      }
    } catch (error) {
      console.error('cumstack render error:', error);
      containerEl.innerHTML = `<div style="color: red; padding: 20px;">Render Error: ${error.message}</div>`;
    }
  });
  cleanupFns.push(disposeEffect);
  // handle navigation clicks
  const clickHandler = (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    const isSpaTwink = link.hasAttribute('data-spa-link');
    const isNoSpa = link.hasAttribute('data-no-spa');
    if (isNoSpa) return;
    const isInternal = href.startsWith('/') && !href.startsWith('//');
    if (isInternal || isSpaTwink) {
      e.preventDefault();
      if (i18nConfig?.explicitRouting) {
        const { language } = extractLanguageFromRoute(href);
        if (language) setLanguage(language);
      }
      clientRouter.navigate(href);
    }
  };
  document.addEventListener('click', clickHandler);
  cleanupFns.push(() => document.removeEventListener('click', clickHandler));
  // setup prefetching with cleanup
  const prefetchCleanup = setupPrefetching();
  cleanupFns.push(prefetchCleanup);
  // return cleanup function
  return () => cleanupFns.forEach((fn) => fn());
}

/**
 * setup link prefetching
 * @returns {Function} Cleanup function
 */
const prefetchedUrls = new Set();
function setupPrefetching() {
  const observedTwinks = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const link = entry.target;
        const prefetchMode = link.getAttribute('data-prefetch');
        const href = link.getAttribute('href');
        if (prefetchMode === 'visible' && href && !prefetchedUrls.has(href)) prefetchUrl(href);
      } else {
        // unobserve links that leave viewport
        const link = entry.target;
        if (!entry.isIntersecting && observedTwinks.has(link)) {
          observer.unobserve(link);
          observedTwinks.delete(link);
        }
      }
    });
  });
  const observeTwinks = () => {
    // observe new links
    document.querySelectorAll('a[data-prefetch="visible"]').forEach((link) => {
      if (!observedTwinks.has(link)) {
        observer.observe(link);
        observedTwinks.add(link);
      }
    });
    // clean up removed links
    observedTwinks.forEach((link) => {
      if (!document.contains(link)) {
        observer.unobserve(link);
        observedTwinks.delete(link);
      }
    });
  };
  observeTwinks();
  const mutationObserver = new MutationObserver(observeTwinks);
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  const mouseoverHandler = (e) => {
    const link = e.target.closest('a[data-prefetch="hover"]');
    if (link) {
      const href = link.getAttribute('href');
      if (href && !prefetchedUrls.has(href)) {
        prefetchUrl(href);
      }
    }
  };
  document.addEventListener('mouseover', mouseoverHandler);
  // return cleanup function
  return () => {
    observer.disconnect();
    mutationObserver.disconnect();
    observedTwinks.clear();
    document.removeEventListener('mouseover', mouseoverHandler);
  };
}

/**
 * prefetch url
 * @param {string} href - URL to prefetch
 * @param {number} [timeout=3000] - Timeout in milliseconds
 */
async function prefetchUrl(href, timeout = 3000) {
  if (!href || prefetchedUrls.has(href)) return;
  prefetchedUrls.add(href);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    await fetch(href, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch (e) {
    // only remove from cache if it's not an abort (which is expected)
    if (e.name !== 'AbortError') {
      prefetchedUrls.delete(href);
      console.debug('Prefetch failed:', href, e.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * get current router
 * @returns {Object|null} Router instance
 */
export function useRouter() {
  return clientRouter;
}

/**
 * get i18n config
 * @returns {Object|null} i18n configuration
 */
export function useI18nConfig() {
  return i18nConfig || (typeof window !== 'undefined' ? window.__HONMOON_I18N_CONFIG__ : null);
}
