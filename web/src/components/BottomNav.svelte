<script lang="ts">
  import { i18n } from '../lib/i18n.svelte';
  import { router } from '../lib/router.svelte';
  import Icon from './Icon.svelte';

  const t = $derived(i18n.t);
  const name = $derived(router.route.name);
  const newHref = $derived(router.route.name === 'project' ? `/new?project=${router.route.key}` : '/new');
</script>

<a class="fab" href={newHref} aria-label={t.newIssue}><Icon name="plus" size={26} /></a>
<nav aria-label="Main">
  <a href="/" aria-current={name === 'home' || name === 'project' ? 'page' : undefined}><Icon name="grid" />{t.projects}</a>
  <a href="/active" aria-current={name === 'active' ? 'page' : undefined}><Icon name="bolt" />{t.active}</a>
  <a href="/search" aria-current={name === 'search' ? 'page' : undefined}><Icon name="search" />{t.search}</a>
</nav>

<style>
  nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid var(--line);
    padding-bottom: var(--safe-b);
    z-index: 10;
  }
  nav a {
    flex: 1;
    max-width: 200px;
    height: var(--nav-h);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--faint);
  }
  nav a :global(svg) {
    width: 22px;
    height: 22px;
  }
  nav a[aria-current='page'] {
    color: var(--accent);
  }
  .fab {
    position: fixed;
    right: max(20px, calc(50vw - 300px));
    bottom: calc(var(--nav-h) + var(--safe-b) + 16px);
    width: 56px;
    height: 56px;
    border-radius: 28px;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 20px rgb(79 70 229 / 0.35);
    z-index: 11;
  }
</style>
