/**
 * cumstack JSX Utilities
 * helper functions for jsx rendering and dom manipulation
 */

/**
 * create an element
 * @param {string|Function} type - Element type or component
 * @param {Object} props - Element props
 * @param {...any} children - Child elements
 */
export function h(type, props, ...children) {
  if (typeof type === 'function') return type({ ...props, children });
  return {
    type,
    props: props || {},
    children: children.flat(),
  };
}

/**
 * fragment component
 */
export function Fragment({ children }) {
  return children;
}

/**
 * render jsx to dom (client-side)
 * @param {any} vnode - Virtual node
 * @param {HTMLElement} container - Container element
 */
export function render(vnode, container) {
  // clear container
  container.innerHTML = '';
  const element = createDOMElement(vnode);
  if (element) {
    container.appendChild(element);
  }
}

/**
 * create dom element from virtual node
 * @param {any} vnode - Virtual node
 * @returns {Node|null}
 */
function createDOMElement(vnode) {
  // handle null/undefined
  if (vnode == null || vnode === false) return null;
  // handle text nodes
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));
  // handle arrays
  if (Array.isArray(vnode)) {
    const fragment = document.createDocumentFragment();
    vnode.forEach((child) => {
      const element = createDOMElement(child);
      if (element) fragment.appendChild(element);
    });
    return fragment;
  }
  // handle components (already rendered)
  if (!vnode.type) return createDOMElement(vnode);
  // create element
  const element = document.createElement(vnode.type);
  // set props
  Object.entries(vnode.props || {}).forEach(([key, value]) => {
    if (key === 'className') element.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else if (value != null && value !== false) element.setAttribute(key, value);
  });
  // append children
  (vnode.children || []).forEach((child) => {
    const childElement = createDOMElement(child);
    if (childElement) element.appendChild(childElement);
  });
  return element;
}

/**
 * render to string (server-side)
 * @param {any} vnode - Virtual node
 * @returns {string}
 */
export function renderToString(vnode) {
  // handle null/undefined
  if (vnode == null || vnode === false) return '';
  // handle text nodes
  if (typeof vnode === 'string' || typeof vnode === 'number') return escapeHtml(String(vnode));
  // handle arrays
  if (Array.isArray(vnode)) return vnode.map(renderToString).join('');
  // handle components (already rendered) - but prevent infinite recursion
  if (!vnode.type) {
    // if it's an object without type, try to extract meaningful content
    if (typeof vnode === 'object') {
      // check for children property
      if (vnode.children !== undefined) return renderToString(vnode.children);
      // check for props.children
      if (vnode.props?.children !== undefined) return renderToString(vnode.props.children);
      // unknown structure - return empty
      console.warn('renderToString: Unknown vnode structure', vnode);
      return '';
    }
    return '';
  }
  // self-closing tags
  const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  // build attributes
  const attrs = Object.entries(vnode.props || {})
    .filter(([key, value]) => !key.startsWith('on') && value != null && value !== false)
    .map(([key, value]) => {
      const attrName = key === 'className' ? 'class' : key;
      if (typeof value === 'object' && key === 'style') {
        const styleStr = Object.entries(value)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        return `${attrName}="${escapeHtml(styleStr)}"`;
      }
      return `${attrName}="${escapeHtml(String(value))}"`;
    })
    .join(' ');
  const openTag = attrs ? `<${vnode.type} ${attrs}>` : `<${vnode.type}>`;
  if (selfClosing.includes(vnode.type)) return openTag.replace('>', ' />');
  const children = (vnode.children || []).map(renderToString).join('');
  return `${openTag}${children}</${vnode.type}>`;
}

/**
 * escape html
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * conditional rendering helper
 * @param {Object} props - Component props
 * @param {boolean} props.when - Condition to show children
 * @param {*} props.children - Children to show when condition is true
 * @param {*} [props.fallback] - Fallback content when condition is false
 * @returns {*} Rendered content
 */
export function Show({ when, children, fallback = null }) {
  return when ? children : fallback;
}

/**
 * list rendering helper
 * @param {Object} props - Component props
 * @param {Array} props.each - Array to iterate
 * @param {Function} props.children - Render function (item, index) => element
 * @returns {Array|null} Array of rendered elements
 */
export function For({ each, children }) {
  if (!Array.isArray(each)) return null;
  return each.map((item, index) => children(item, index));
}
