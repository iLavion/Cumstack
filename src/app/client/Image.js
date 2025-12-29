/**
 * cumstack Image component
 * smart image component with CDN support
 */

import { cdn } from '../shared/cdn.js';

/**
 * Image component with optional CDN URL handling
 * @param {Object} props - Image properties
 * @param {string} props.src - Image source URL or path
 * @param {string} props.alt - Alternative text
 * @param {boolean} [props.cdn] - Whether to use CDN domain
 * @param {string} [props.className] - CSS class names
 * @param {string|Object} [props.style] - Inline styles
 * @param {string} [props.loading] - Loading strategy ('lazy' or 'eager')
 * @param {string} [props.decoding] - Decoding hint ('async' or 'sync')
 * @param {number} [props.width] - Image width
 * @param {number} [props.height] - Image height
 * @returns {Object} Virtual DOM element
 */
export function Image(props) {
  const { src, alt, cdn: useCdn, className, style, loading = 'lazy', decoding = 'async', width, height, ...rest } = props;
  let finalSrc = src;
  if (useCdn && src) if (src.startsWith('/')) finalSrc = cdn(src);
  const imgProps = {
    ...rest,
    src: finalSrc,
    alt: alt || '',
    ...(className && { class: className }),
    ...(style && {
      style:
        typeof style === 'string'
          ? style
          : Object.entries(style)
              .map(([k, v]) => `${k}: ${v}`)
              .join('; '),
    }),
    ...(loading && { loading }),
    ...(decoding && { decoding }),
    ...(width && { width }),
    ...(height && { height }),
  };
  return {
    type: 'img',
    props: imgProps,
    children: [],
  };
}
