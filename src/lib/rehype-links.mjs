// src/lib/rehype-links.mjs
// Build-time link hardening for all markdown/MDX content:
//  - external links     -> rel="nofollow noopener noreferrer" target="_blank"
//  - DOFOLLOW_PARTNERS   -> rel="noopener noreferrer"          target="_blank" (no nofollow)
//  - /go/ affiliate links -> rel="sponsored noopener"        target="_blank"
// No runtime cost, no dependencies (manual hast walk).

const SITE = 'linuxcore.dev';

// Reciprocal editorial-link partners: earned placement, not paid/affiliate,
// so nofollow is deliberately dropped for these hosts only.
const DOFOLLOW_PARTNERS = ['racknotes.pro'];

export default function rehypeLinks() {
  return (tree) => {
    const walk = (node) => {
      if (node.type === 'element' && node.tagName === 'a' && node.properties) {
        const href = String(node.properties.href || '');
        if (/^https?:\/\//i.test(href) && DOFOLLOW_PARTNERS.some((h) => href.includes(h))) {
          node.properties.rel = ['noopener', 'noreferrer'];
          node.properties.target = '_blank';
        } else if (/^https?:\/\//i.test(href) && !href.includes(SITE)) {
          node.properties.rel = ['nofollow', 'noopener', 'noreferrer'];
          node.properties.target = '_blank';
        } else if (href.startsWith('/go/')) {
          node.properties.rel = ['sponsored', 'noopener'];
          node.properties.target = '_blank';
        }
      }
      if (node.children) node.children.forEach(walk);
    };
    walk(tree);
  };
}
