<script lang="ts">
  // Desktop navigation: always-visible sidebar with views, projects and
  // settings. Replaces the bottom tab bar and the floating "+" button.
  import { i18n } from '../lib/i18n.svelte';
  import { keys } from '../lib/keys.svelte';
  import { router } from '../lib/router.svelte';
  import { OPEN, store } from '../lib/store.svelte';
  import { theme } from '../lib/theme.svelte';
  import Icon from './Icon.svelte';
  import ProjectForm from './ProjectForm.svelte';

  const t = $derived(i18n.t);
  const r = $derived(router.route);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = mac ? '⌘' : 'Ctrl ';
  let creating = $state(false);

  const currentProject = $derived(
    r.name === 'project' ? r.key : r.name === 'issue' ? (store.byIdentifier.get(r.id)?.project ?? null) : null,
  );
  const projects = $derived(store.projectList.filter((p) => p.status !== 'archived'));
  const openCounts = $derived.by(() => {
    const m = new Map<string, number>();
    for (const i of store.live) if (OPEN.includes(i.status)) m.set(i.project, (m.get(i.project) ?? 0) + 1);
    return m;
  });
  const activeCount = $derived(store.live.filter((i) => i.status === 'in_progress' || i.status === 'in_review').length);

  function toggleTheme() {
    const dark =
      theme.pref === 'dark' || (theme.pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    theme.set(dark ? 'light' : 'dark');
  }
</script>

<aside class="sidebar" aria-label="Sidebar">
  <div class="brand">
    <a class="logo" href="/"><img src="/icon.svg" alt="" width="22" height="22" />MyPM</a>
    <a class="new" href={keys.newIssueHref()} title={`${t.newIssue} (C)`} aria-label={t.newIssue}><Icon name="edit" size={16} /></a>
  </div>

  <button class="searchbox" onclick={() => (keys.palette = true)}>
    <Icon name="search" size={15} />
    <span>{t.search}</span>
    <kbd>{modKey}K</kbd>
  </button>

  <nav class="views" aria-label="Main">
    <a href="/" aria-current={r.name === 'home' ? 'page' : undefined}><Icon name="grid" size={16} />{t.overview}</a>
    <a href="/active" aria-current={r.name === 'active' ? 'page' : undefined}>
      <Icon name="bolt" size={16} />{t.active}
      {#if activeCount}<span class="count mono">{activeCount}</span>{/if}
    </a>
    <a href="/search" aria-current={r.name === 'search' ? 'page' : undefined}><Icon name="search" size={16} />{t.search}</a>
  </nav>

  <div class="group">
    <span>{t.projects}</span>
    <button class="add" onclick={() => (creating = true)} aria-label={t.newProject} title={t.newProject}><Icon name="plus" size={14} /></button>
  </div>
  <nav class="projects" aria-label={t.projects}>
    {#each projects as p (p.key)}
      <a href={`/p/${p.key}`} aria-current={currentProject === p.key ? 'page' : undefined} class:dim={p.status !== 'active'}>
        <span class="key mono">{p.key}</span>
        <span class="name">{p.name}</span>
        {#if openCounts.get(p.key)}<span class="count mono">{openCounts.get(p.key)}</span>{/if}
      </a>
    {/each}
  </nav>

  <div class="foot">
    <a href="/settings" aria-current={r.name === 'settings' ? 'page' : undefined}><Icon name="settings" size={16} />{t.settings}</a>
    <div class="tools">
      <span class="sync" class:busy={store.syncing} class:off={!store.online || !!store.syncError}>
        <i></i>{!store.online ? t.offlineShort : store.syncing ? t.syncingNow : store.syncError ? t.syncFailed : t.synced}
      </span>
      <button class="tool" onclick={toggleTheme} aria-label={t.switchTheme} title={t.switchTheme}><Icon name="sun" size={15} /></button>
      <button class="tool" onclick={() => (keys.help = true)} aria-label={t.shortcuts} title={`${t.shortcuts} (?)`}><Icon name="keyboard" size={15} /></button>
    </div>
  </div>
</aside>

<ProjectForm bind:open={creating} />

<style>
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--sidebar-w);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 10px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--line);
    overflow-y: auto;
    z-index: 15;
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px 10px 6px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
  }
  .logo img {
    border-radius: 6px;
  }
  .new {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 1px rgb(0 0 0 / 0.04);
  }
  .new:hover {
    border-color: var(--line-strong);
  }
  .searchbox {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px;
    margin-bottom: 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--muted);
    font-size: 13px;
    text-align: left;
  }
  .searchbox span {
    flex: 1;
  }
  .searchbox:hover {
    border-color: var(--line-strong);
  }
  kbd {
    font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--faint);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 3px 4px;
    background: var(--surface-2);
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  nav a,
  .foot > a {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 30px;
    padding: 0 8px;
    border-radius: 7px;
    color: var(--ink-2);
    font-size: 13.5px;
    font-weight: 500;
    min-width: 0;
  }
  nav a :global(svg),
  .foot > a :global(svg) {
    color: var(--muted);
    flex-shrink: 0;
  }
  nav a:hover,
  .foot > a:hover {
    background: var(--hover);
  }
  nav a[aria-current='page'],
  .foot > a[aria-current='page'] {
    background: var(--selected);
    color: var(--ink);
  }
  .count {
    margin-left: auto;
    font-size: 11.5px;
    color: var(--faint);
  }
  .group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0 4px;
    padding: 0 4px 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--faint);
  }
  .add {
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--faint);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .add:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .projects .key {
    flex-shrink: 0;
    min-width: 34px;
    height: 18px;
    padding: 0 4px;
    border-radius: 4px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .projects .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .projects .dim {
    opacity: 0.6;
  }
  .foot {
    margin-top: auto;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 4px 0 8px;
    border-top: 1px solid var(--line);
  }
  .sync {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--faint);
    white-space: nowrap;
    overflow: hidden;
  }
  .sync i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--st-in_review);
    flex-shrink: 0;
  }
  .sync.busy i {
    background: var(--st-in_progress);
  }
  .sync.off i {
    background: var(--danger);
  }
  .tool {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .tool:hover {
    background: var(--hover);
    color: var(--ink);
  }
</style>
