<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueLine from '../components/IssueLine.svelte';
  import IssueRow from '../components/IssueRow.svelte';
  import { keys } from '../lib/keys.svelte';
  import { media } from '../lib/media.svelte';
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

  const PAGE = $derived(media.desktop ? 50 : 8);
  const isOpen = (s: string) => expanded[s] ?? true;
</script>

{#if media.desktop}
<div class="dpage">
  <header class="dhead">
    <h1>
      <a class="crumb" href="/">{t.projects}</a>
      <Icon name="arrow" size={12} />
      <span class="dkey mono">{key}</span>
      {project?.name ?? key}
    </h1>
    {#if project}
      <button class="icon-btn" onclick={() => (editing = true)} aria-label={t.editProject} title={t.editProject}><Icon name="more" size={16} /></button>
    {/if}
    <span class="spacer"></span>
    <span class="dprog" title={t.progress}>
      <span class="ring" style:--p={c.progress}></span>
      <span class="mono">{Math.round(c.progress * 100)}% · {c.counts.done}/{c.total}</span>
    </span>
    <div class="seg-d" role="group" aria-label="View">
      <button aria-pressed={view === 'list'} onclick={() => setView('list')}>{t.list}</button>
      <button aria-pressed={view === 'board'} onclick={() => setView('board')}>{t.board}</button>
    </div>
    <a class="hbtn primary" href={keys.newIssueHref()}><Icon name="plus" size={14} />{t.newIssue}<kbd>C</kbd></a>
  </header>
  {#if view === 'list'}
    <div class="dbody">
      {#if project?.description}<p class="ddesc">{project.description}</p>{/if}
      <div class="dlist">
        {#each groups as g (g.status)}
          {#if g.issues.length}
            {@const max = limit[g.status] ?? PAGE}
            <div class="dgroup">
              <button
                class="fold"
                aria-expanded={isOpen(g.status)}
                onclick={() => (expanded[g.status] = !isOpen(g.status))}
              ><span class="chev" class:closed={!isOpen(g.status)}><Icon name="chevron" size={13} /></span></button>
              <StatusIcon status={g.status} size={14} />
              {t.statuses[g.status]}
              <span class="n">{g.issues.length}</span>
              <span class="spacer"></span>
              <a class="addin" href={`/new?project=${key}`} aria-label={t.newIssue} title={t.newIssue}><Icon name="plus" size={14} /></a>
            </div>
            {#if isOpen(g.status)}
              {#each g.issues.slice(0, max) as issue (issue.id)}
                <IssueLine {issue} />
              {/each}
              {#if g.issues.length > max}
                <button class="dmore" onclick={() => (limit[g.status] = max + 100)}>{t.showMore(g.issues.length - max)}</button>
              {/if}
            {/if}
          {/if}
        {/each}
      </div>
      {#if c.total === 0 && c.counts.canceled === 0}
        <p class="empty">{t.noneYet}</p>
      {/if}
    </div>
  {:else}
    <div class="dboard">
      {#each groups.filter((g) => g.status !== 'canceled') as g (g.status)}
        <section class="dcol">
          <h2 class="dcolhead"><StatusIcon status={g.status} size={14} />{t.statuses[g.status]}<span class="n">{g.issues.length}</span></h2>
          <div class="dcards">
            {#each g.issues.slice(0, 100) as issue (issue.id)}
              <div class="dcard"><IssueRow {issue} /></div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>
{:else}
<div class="page">
  <header class="topbar mtop">
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
    {#if c.total === 0 && c.counts.canceled === 0}
      <p class="empty">{t.noneYet}</p>
    {:else}
      <div class="mlist">
        {#each groups as g (g.status)}
          {#if g.issues.length}
            {@const max = limit[g.status] ?? PAGE}
            <section class="mg">
            <div class="mgroup">
              <button class="mfold" aria-expanded={isOpen(g.status)} onclick={() => (expanded[g.status] = !isOpen(g.status))}>
                <span class="chev" class:closed={!isOpen(g.status)}><Icon name="chevron" size={14} /></span>
                <StatusIcon status={g.status} size={14} />
                {t.statuses[g.status]}
                <span class="n">{g.issues.length}</span>
              </button>
              <a class="madd" href={`/new?project=${key}`} aria-label={t.newIssue}><Icon name="plus" size={18} /></a>
            </div>
            {#if isOpen(g.status)}
              {#each g.issues.slice(0, max) as issue (issue.id)}
                <IssueRow {issue} />
              {/each}
              {#if g.issues.length > max}
                <button class="mmore" onclick={() => (limit[g.status] = max + 50)}>{t.showMore(g.issues.length - max)}</button>
              {/if}
            {/if}
            </section>
          {/if}
        {/each}
      </div>
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
{/if}

<ProjectForm bind:open={editing} {project} />

<style>
  .mtop {
    position: sticky;
    top: 0;
    z-index: 6;
    background: var(--bg);
    padding-top: var(--safe-t);
    margin-top: calc(-8px - var(--safe-t));
  }
  .mlist {
    margin-top: 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: clip;
  }
  .mg > :global(.row) {
    border-top: 1px solid var(--line);
  }
  .mg + .mg {
    border-top: 1px solid var(--line);
  }
  .mgroup {
    position: sticky;
    top: calc(52px + var(--safe-t));
    z-index: 3;
    display: flex;
    align-items: center;
    background: var(--surface-2);
  }
  .mfold {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px 0 12px;
    border: 0;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-2);
    text-align: left;
  }
  .mfold .n {
    color: var(--faint);
    font-weight: 500;
  }
  .mfold :global(svg) {
    flex-shrink: 0;
  }
  .chev {
    display: flex;
    color: var(--faint);
    transition: transform 0.15s;
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .madd {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }
  .mmore {
    width: 100%;
    min-height: 44px;
    border: 0;
    border-top: 1px solid var(--line);
    background: transparent;
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 600;
  }
  .crumb {
    color: var(--muted);
    font-weight: 500;
  }
  .crumb:hover {
    color: var(--ink);
  }
  .dhead :global(svg) {
    color: var(--faint);
  }
  .dkey {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    padding: 1px 5px;
    border-radius: 5px;
    border: 1px solid var(--line);
    background: var(--surface-2);
  }
  .spacer {
    flex: 1;
  }
  .dprog {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--muted);
    margin-right: 4px;
  }
  .ring {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--line) 0);
    -webkit-mask: radial-gradient(circle, transparent 4px, #000 4.5px);
    mask: radial-gradient(circle, transparent 4px, #000 4.5px);
  }
  .ddesc {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 13.5px;
    max-width: 760px;
  }
  .fold {
    margin-left: -6px;
    padding: 4px !important;
  }
  .chev {
    display: flex;
    transition: transform 0.12s;
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .addin {
    display: flex;
    padding: 4px;
    border-radius: 6px;
    color: var(--muted);
  }
  .addin:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .dmore {
    width: 100%;
    height: 36px;
    border: 0;
    border-bottom: 1px solid var(--line-soft);
    background: transparent;
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 600;
  }
  .dmore:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .dboard {
    display: flex;
    gap: 12px;
    padding: 16px 24px 32px;
    overflow-x: auto;
    flex: 1;
    align-items: flex-start;
  }
  .dcol {
    flex: 1 1 0;
    min-width: 220px;
    max-width: 380px;
    background: var(--surface-2);
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    padding: 4px 8px 8px;
  }
  .dcolhead {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    height: 38px;
    padding: 0 6px;
  }
  .dcolhead .n {
    color: var(--faint);
    font-weight: 500;
  }
  .dcards {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .dcard {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
  }
  .dcard:hover {
    border-color: var(--line-strong);
  }
  .dcard :global(.row) {
    min-height: 0;
  }
  .dcard :global(.st) {
    width: 36px;
    padding: 11px 0 0 6px;
  }
  .dcard :global(.body) {
    padding: 10px 12px 10px 2px;
  }
  .dcard :global(.title) {
    font-size: 13.5px;
  }
  .dcard :global(.meta) {
    flex-wrap: wrap;
    row-gap: 4px;
  }
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
