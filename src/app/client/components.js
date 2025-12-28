/**
 * cumstack Client Components
 * utilities for component hydration
 */

// cache for prefetched pages
const prefetchCache = new Set();

/**
 * prefetch a page
 * @param {string} href - URL to prefetch
 * @returns {void}
 */
function prefetchPage(href) {
  if (prefetchCache.has(href)) return;
  prefetchCache.add(href);
  
  fetch(href, { 
    method: 'GET',
    headers: { 'X-Prefetch': 'true' }
  }).catch(() => {
    // silently fail, remove from cache so it can be retried
    prefetchCache.delete(href);
  });
}

/**
 * initialize prefetch listeners
 * @returns {void}
 */
function initPrefetch() {
  // handle hover prefetch
  document.querySelectorAll('a[data-prefetch="hover"]').forEach((link) => {
    link.addEventListener('mouseenter', () => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('//')) prefetchPage(href);
    }, { once: false });
  });
  // handle visible prefetch (intersection observer)
  const visibleLinks = document.querySelectorAll('a[data-prefetch="visible"]');
  if (visibleLinks.length > 0 && 'IntersectionObserver' in window) {
    const linksByMargin = new Map();
    visibleLinks.forEach((link) => {
      const margin = link.getAttribute('prefetch-margin') || '0px';
      if (!linksByMargin.has(margin)) linksByMargin.set(margin, []);
      linksByMargin.get(margin).push(link);
    });
    // create observer for each unique margin
    linksByMargin.forEach((links, margin) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const href = entry.target.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
              prefetchPage(href);
              observer.unobserve(entry.target);
            }
          }
        });
      }, { rootMargin: margin });
      links.forEach((link) => observer.observe(link));
    });
  }
}

/**
 * initialize all cumstack components on the page
 * override this in your app to add custom component initialization
 * @returns {void}
 */
export function initComponents() {
  // initialize prefetch
  initPrefetch();

  // counter button example
  document.querySelectorAll('button[onclick*="setCount"]').forEach((button) => {
    let count = 0;
    const match = button.textContent.match(/Clicks: (\d+)/);
    if (match) count = parseInt(match[1]);
    button.removeAttribute('onclick');
    button.addEventListener('click', () => {
      count++;
      button.textContent = `Clicks: ${count}`;
    });
  });
}

// auto-initialize components on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initComponents);
  else initComponents();
}
