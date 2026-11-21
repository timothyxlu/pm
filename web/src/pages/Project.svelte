<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueRow from '../components/IssueRow.svelte';
  import ProjectForm from '../components/ProjectForm.svelte';
  import StatusIcon from '../components/StatusIcon.svelte';
  import type { Issue, Status } from '../lib/api';
  import { i18n } from '../lib/i18n.svelte';
  import { router } from '../lib/router.svelte';
  import { issueOrder, store } from '../lib/store.svelte';

  let { key }: { key: string } = $props();
  const t = $derived(i18n.t);
  const project = $derived(store.projects[key]);
  const c = $derived(store.counts(key));

  let view = $state<'list' | 'board'>(readView());
  let editing = $state(false);
  // Groups that start collapsed, and how many rows the open ones show.
  let expanded = $state<Record<string, boolean>>({ backlog: false, done: false, canceled: false });
  let limit = $state<Record<string, number>>({});

  function readView(): 'list' | 'board' {
    try {
      return localStorage.getItem('pm.view') === 'board' ? 'board' : 'list';
    } catch {
      return 'list';
    }
  }
  function setView(v: 'list' | 'board') {
    view = v;
    try {
      localStorage.setItem('pm.view', v);
    } catch {}
  }

  const ORDER: Status[] = ['in_progress', 'in_review', 'todo', 'backlog', 'done', 'canceled'];
  const groups = $derived.by(() => {
    const by = new Map<Status, Issue[]>(ORDER.map((s) => [s, []]));
    for (const i of store.projectIssues(key)) by.get(i.status)!.push(i);
    for (const [s, list] of by) {
      if (s === 'done' || s === 'canceled') list.sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));
      else list.sort(issueOrder);
    }
    return ORDER.map((s) => ({ status: s, issues: by.get(s)! }));
  });

  const PAGE = 8;
  const isOpen = (s: string) => expanded[s] ?? true;
</script>

<div class="page">
  <header class="topbar">
    <button class="icon-btn" onclick={() => router.back('/')} aria-label={t.back}><Icon name="back" /></button>
    <h1>
      {project?.name ?? key}
      <span class="key mono">{key}</span>
    </h1>
    {#if project}
      <button class="icon-btn" onclick={() => (editing = true)} aria-label={t.editProject}><Icon name="more" size={20} /></button>
    {/if}
  </header>

  {#if project?.description}<p class="desc">{project.description}</p>{/if}

  <div class="toolbar">
    <div class="progress">
      <div class="bar"><div style:width={`${c.progress * 100}%`}></div></div>
      <span class="mono">{Math.round(c.progress * 100)}% · {c.counts.done} / {c.total}</span>
    </div>
    <div class="seg" role="group" aria-label="View">
      <button aria-pressed={view === 'list'} onclick={() => setView('list')}>{t.list}</button>
      <button aria-pressed={view === 'board'} onclick={() => setView('board')}>{t.board}</button>
    </div>
  </div>

  {#if view === 'list'}
    {#each groups as g (g.status)}
      {#if g.issues.length}
        {#if isOpen(g.status)}
          {@const max = limit[g.status] ?? PAGE}
          <h2 class="section-title group">
            <StatusIcon status={g.status} size={14} />
            {t.statuses[g.status]} · {g.issues.length}
            {#if expanded[g.status] !== undefined}
              <button class="mini" onclick={() => (expanded[g.status] = false)}>{t.hide}</button>
            {/if}
          </h2>
          <div class="list">
            {#each g.issues.slice(0, max) as issue (issue.id)}
              <IssueRow {issue} />
            {/each}
          </div>
          {#if g.issues.length > max}
            <button class="more" onclick={() => (limit[g.status] = max + 50)}>{t.showMore(g.issues.length - max)}</button>
          {/if}
        {:else}
          <button class="more collapsed" onclick={() => (expanded[g.status] = true)}>
            <StatusIcon status={g.status} size={14} />
            {t.showStatus(t.statuses[g.status], g.issues.length)}
          </button>
        {/if}
      {/if}
    {/each}
    {#if c.total === 0 && c.counts.canceled === 0}
      <p class="empty">{t.noneYet}</p>
    {/if}
  {:else}
    <div class="board">
      {#each groups.filter((g) => g.status !== 'canceled') as g (g.status)}
        <section class="col">
          <h2 class="section-title group"><StatusIcon status={g.status} size={14} />{t.statuses[g.status]} · {g.issues.length}</h2>
          <div class="list">
            {#each g.issues.slice(0, 50) as issue (issue.id)}
              <IssueRow {issue} />
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<ProjectForm bind:open={editing} {project} />

<style>
  h1 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .key {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }
  .desc {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 14px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0 4px;
  }
  .progress {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--accent);
  }
  .seg {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 2px;
  }
  .seg button {
    height: 32px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }
  .seg button[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mini {
    margin-left: auto;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    min-height: 32px;
  }
  .more {
    width: 100%;
    min-height: 44px;
    margin-top: 8px;
    border: 1px dashed var(--line-strong);
    border-radius: 12px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .more.collapsed {
    margin-top: 12px;
  }
  .board {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    margin: 0 -16px;
    padding: 0 16px 8px;
  }
  .col {
    flex: 0 0 82%;
    max-width: 320px;
    scroll-snap-align: start;
  }
</style>
