// Keyboard shortcuts. One listener on the document handles the global keys;
// a page can add its own single-key shortcuts while it is shown.

import { router } from './router.svelte';
import { store } from './store.svelte';

type Handler = () => void;

class Keys {
  palette = $state(false);
  help = $state(false);
  /** Keys handled by the page on screen, e.g. the issue page's "s" for status. */
  private page: Record<string, Handler> = {};
  private pendingG = 0;

  /** Register page shortcuts; returns a cleanup for $effect. */
  use(map: Record<string, Handler>) {
    this.page = map;
    return () => {
      if (this.page === map) this.page = {};
    };
  }

  /** Where "c" (new issue) should create, from the page on screen. */
  newIssueHref() {
    const r = router.route;
    if (r.name === 'project') return `/new?project=${r.key}`;
    if (r.name === 'issue') {
      const i = store.byIdentifier.get(r.id);
      if (i) return `/new?project=${i.project}`;
    }
    return '/new';
  }

  handle = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette = !this.palette;
      return;
    }
    if (e.defaultPrevented || mod || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
    // A dialog (sheet, palette) handles its own keys.
    if (document.querySelector('dialog[open]')) return;

    const k = e.key;
    if (this.pendingG && Date.now() - this.pendingG < 1200) {
      this.pendingG = 0;
      const to = { h: '/', p: '/', a: '/active', s: '/settings', f: '/search' }[k];
      if (to) {
        e.preventDefault();
        router.go(to);
      }
      return;
    }
    if (k === 'g') {
      this.pendingG = Date.now();
      return;
    }
    if (this.page[k]) {
      e.preventDefault();
      this.page[k]();
      return;
    }
    if (k === '/') {
      e.preventDefault();
      this.palette = true;
    } else if (k === 'c') {
      e.preventDefault();
      router.go(this.newIssueHref());
    } else if (k === '?') {
      e.preventDefault();
      this.help = true;
    } else if (k === 'j' || k === 'k' || k === 'ArrowDown' || k === 'ArrowUp') {
      if (moveFocus(k === 'j' || k === 'ArrowDown' ? 1 : -1)) e.preventDefault();
    }
  };
}

/** Move focus through the issue rows on screen (j/k), like a list selection. */
function moveFocus(dir: 1 | -1) {
  const rows = [...document.querySelectorAll<HTMLElement>('main [data-row]')];
  if (!rows.length) return false;
  const at = rows.indexOf(document.activeElement as HTMLElement);
  const next = at === -1 ? (dir === 1 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, at + dir));
  rows[next].focus({ preventScroll: true });
  rows[next].scrollIntoView({ block: 'nearest' });
  return true;
}

export const keys = new Keys();
