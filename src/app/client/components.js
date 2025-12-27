/**
 * cumstack Client Components
 * utilities for component hydration
 */

/**
 * initialize all cumstack components on the page
 * override this in your app to add custom component initialization
 * @returns {void}
 */
export function initComponents() {
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
