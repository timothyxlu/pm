// A small history-API router. The Worker serves index.html for any unknown
// path (single-page-application mode), so deep links work on reload too.

export type Route =
  | { name: 'home' }
  | { name: 'active' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'project'; key: string }
  | { name: 'issue'; id: string }
  | { name: 'new'; project?: string; parent?: string; status?: string }
  | { name: 'notfound' };

function parse(url: URL): Route {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'home' };
  const [a, b] = parts;
  if (a === 'active' && !b) return { name: 'active' };
  if (a === 'search' && !b) return { name: 'search' };
  if (a === 'settings' && !b) return { name: 'settings' };
  if (a === 'p' && b) return { name: 'project', key: b.toUpperCase() };
  if (a === 'i' && b) return { name: 'issue', id: b.toUpperCase() };
  if (a === 'new' && !b)
    return {
      name: 'new',
      project: url.searchParams.get('project') ?? undefined,
      parent: url.searchParams.get('parent') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    };
  return { name: 'notfound' };
}

class Router {
  route = $state<Route>(parse(new URL(location.href)));
  /** How many in-app navigations deep we are, so "back" can fall back to a parent page. */
  depth = 0;

  constructor() {
    addEventListener('popstate', (e) => {
      this.depth = (e.state?.depth as number) ?? 0;
      this.route = parse(new URL(location.href));
    });
    history.replaceState({ depth: 0 }, '');
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      if (!a || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (/^\/(api|mcp|oauth|authorize|login|webhooks|\.well-known)(\/|$)/.test(url.pathname)) return;
      e.preventDefault();
      this.go(url.pathname + url.search);
    });
  }

  go(path: string, replace = false) {
    if (replace) history.replaceState({ depth: this.depth }, '', path);
    else history.pushState({ depth: ++this.depth }, '', path);
    this.route = parse(new URL(location.href));
    if (!replace) scrollTo(0, 0);
  }

  /** Go back if we navigated here in-app, else open the fallback page. */
  back(fallback = '/') {
    if (this.depth > 0) history.back();
    else this.go(fallback, true);
  }
}

export const router = new Router();
