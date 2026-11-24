<script lang="ts">
  import InstallBanner from '../components/InstallBanner.svelte';
  import Icon from '../components/Icon.svelte';
  import { keys } from '../lib/keys.svelte';
  import { media } from '../lib/media.svelte';
  import ProjectForm from '../components/ProjectForm.svelte';
  import { fmtLongDate, i18n } from '../lib/i18n.svelte';
  import { OPEN, store } from '../lib/store.svelte';

  const t = $derived(i18n.t);
  let showArchived = $state(false);
  let creating = $state(false);

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  // Project-level numbers only; the issues themselves live on the Active tab.
  const stats = $derived({
    done: store.live.filter((i) => i.status === 'done' && i.completed_at && i.completed_at >= weekAgo).length,
    projects: store.projectList.filter((p) => p.status === 'active').length,
    open: store.live.filter((i) => OPEN.includes(i.status)).length,
  });
  const projects = $derived(store.projectList.filter((p) => showArchived || p.status !== 'archived'));
  const archivedCount = $derived(store.projectList.filter((p) => p.status === 'archived').length);
</script>

{#if media.desktop}
<div class="dpage">
  <header class="dhead">
    <h1>{t.overview}</h1>
    <span class="today">{fmtLongDate(new Date())}</span>
    <span class="spacer"></span>
    <button class="hbtn" onclick={() => (creating = true)}><Icon name="plus" size={14} />{t.newProject}</button>
    <a class="hbtn primary" href={keys.newIssueHref()}><Icon name="plus" size={14} />{t.newIssue}<kbd>C</kbd></a>
  </header>
  <div class="dbody">
    <InstallBanner />
    <div class="dstats">
      <div class="dstat"><span class="lbl">{t.activeProjects}</span><span class="n mono">{stats.projects}</span></div>
      <div class="dstat"><span class="lbl">{t.openIssues}</span><span class="n mono">{stats.open}</span></div>
      <a class="dstat" href="/active"><span class="lbl">{t.doneThisWeek}</span><span class="n mono">{stats.done}</span></a>
    </div>

    <h2 class="dsection">
      {t.projects}
      <span class="spacer"></span>
      {#if archivedCount > 0}
        <button class="minilink" onclick={() => (showArchived = !showArchived)}>
          {showArchived ? t.hide : `${t.showArchived} (${archivedCount})`}
        </button>
      {/if}
    </h2>
    {#if store.loaded && projects.length === 0 && !store.syncing}
      <p class="empty">{t.noProjects}</p>
    {:else}
      <div class="dlist ptable">
        <div class="prow phead">
          <span>{t.name}</span>
          <span>{t.progress}</span>
          <span class="num">{t.statuses.in_progress}</span>
          <span class="num">{t.statuses.in_review}</span>
          <span class="num">{t.statuses.todo}</span>
          <span class="num">{t.statuses.backlog}</span>
          <span class="num">{t.statuses.done}</span>
        </div>
        {#each projects as p (p.key)}
          {@const c = store.counts(p.key)}
          <a class="prow" href={`/p/${p.key}`} class:dim={p.status !== 'active'} data-row>
            <span class="pcell">
              <span class="pkey mono">{p.key}</span>
              <span class="pname">{p.name}</span>
              {#if p.status !== 'active'}<span class="tag">{t.projectStatus[p.status]}</span>{/if}
              {#if p.description}<span class="pdesc">{p.description}</span>{/if}
            </span>
            <span class="pprog">
              <span class="bar"><span style:width={`${c.progress * 100}%`}></span></span>
              <span class="mono pct">{Math.round(c.progress * 100)}%</span>
            </span>
            <span class="num mono" class:zero={!c.counts.in_progress}>{c.counts.in_progress}</span>
            <span class="num mono" class:zero={!c.counts.in_review}>{c.counts.in_review}</span>
            <span class="num mono" class:zero={!c.counts.todo}>{c.counts.todo}</span>
            <span class="num mono" class:zero={!c.counts.backlog}>{c.counts.backlog}</span>
            <span class="num mono">{c.counts.done}<span class="of">/{c.total}</span></span>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
{:else}
<div class="page">
  <header class="head">
    <div>
      <span class="date">{fmtLongDate(new Date())}</span>
      <h1>{t.overview}</h1>
    </div>
  </header>

  <InstallBanner />

  <div class="mstats card">
    <div><span class="n mono">{stats.projects}</span><span>{t.activeProjects}</span></div>
    <div><span class="n mono">{stats.open}</span><span>{t.openIssues}</span></div>
    <a href="/active"><span class="n mono">{stats.done}</span><span>{t.doneThisWeek}</span></a>
  </div>

  <div class="sec-row">
    <h2 class="section-title">{t.projects}</h2>
    <button class="link" onclick={() => (creating = true)}><Icon name="plus" size={14} />{t.newProject}</button>
  </div>
  {#if store.loaded && projects.length === 0 && !store.syncing}
    <p class="empty">{t.noProjects}</p>
  {:else}
    <div class="list">
      {#each projects as p (p.key)}
        {@const c = store.counts(p.key)}
        {@const open = c.counts.todo + c.counts.in_progress + c.counts.in_review + c.counts.backlog}
        <a class="prow-m" href={`/p/${p.key}`} class:dim={p.status !== 'active'}>
          <span class="ring" style:--p={c.progress} role="progressbar" aria-valuenow={Math.round(c.progress * 100)} aria-valuemin="0" aria-valuemax="100" aria-label={t.progress}></span>
          <span class="pinfo">
            <span class="pname">{p.name}</span>
            <span class="psub">
              <span class="mono">{p.key}</span>
              {#if p.status !== 'active'}· {t.projectStatus[p.status]}{/if}
              {#if c.counts.in_progress}· {t.statuses.in_progress} {c.counts.in_progress}{/if}
              · {Math.round(c.progress * 100)}%
            </span>
          </span>
          {#if open}<span class="open mono">{open}</span>{/if}
          <Icon name="arrow" size={16} />
        </a>
      {/each}
    </div>
  {/if}
  {#if archivedCount > 0}
    <button class="link more" onclick={() => (showArchived = !showArchived)}>
      {showArchived ? t.hide : `${t.showArchived} (${archivedCount})`}
    </button>
  {/if}
</div>
{/if}

<ProjectForm bind:open={creating} />

<style>
  .mstats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 16px 0 4px;
    padding: 4px 0;
  }
  .mstats > * {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 14px;
    color: var(--muted);
    font-size: 12px;
  }
  .mstats > * + * {
    border-left: 1px solid var(--line);
  }
  .mstats span:last-child {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mstats .n {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.2;
  }
  .sec-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sec-row .section-title {
    margin-bottom: 8px;
  }
  .sec-row .link {
    margin-top: 16px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 13px;
  }
  .prow-m {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 8px 12px 8px 14px;
    color: var(--ink);
  }
  .prow-m + .prow-m {
    border-top: 1px solid var(--line);
  }
  .prow-m:active {
    background: var(--surface-2);
  }
  .prow-m.dim {
    opacity: 0.65;
  }
  .prow-m :global(svg) {
    color: var(--faint);
    flex-shrink: 0;
  }
  .ring {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--line) 0);
    -webkit-mask: radial-gradient(circle, transparent 6.5px, #000 7px);
    mask: radial-gradient(circle, transparent 6.5px, #000 7px);
  }
  .pinfo {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .prow-m .pname {
    font-size: 15px;
    font-weight: 600;
  }
  .psub {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .open {
    font-size: 12px;
    color: var(--muted);
    background: var(--surface-2);
    border-radius: 10px;
    padding: 1px 8px;
  }
  .more {
    margin-top: 4px;
  }
  .today {
    font-size: 13px;
    color: var(--faint);
  }
  .spacer {
    flex: 1;
  }
  .dstats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .dstat {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  a.dstat {
    color: inherit;
  }
  a.dstat:hover {
    border-color: var(--line-strong, var(--faint));
  }
  .dstat .lbl {
    font-size: 12.5px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dstat .n {
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .dsection .n {
    color: var(--faint);
    font-weight: 500;
  }
  .minilink {
    border: 0;
    background: transparent;
    color: var(--accent-text);
    font-size: 12.5px;
    font-weight: 600;
    padding: 2px 4px;
  }
  .prow {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 200px repeat(5, 72px);
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 6px 16px;
    border-bottom: 1px solid var(--line-soft);
    color: var(--ink);
    font-size: 13.5px;
    outline: none;
  }
  a.prow:hover {
    background: var(--hover);
  }
  a.prow:focus-visible {
    background: var(--selected);
    box-shadow: inset 2px 0 0 var(--accent);
  }
  .phead {
    min-height: 34px;
    font-size: 12px;
    font-weight: 600;
    color: var(--faint);
    background: var(--surface-2);
  }
  .prow.dim {
    opacity: 0.6;
  }
  .pcell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .pkey {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    min-width: 44px;
    height: 20px;
    padding: 0 5px;
    border-radius: 5px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .prow .pname {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
  }
  .pdesc {
    color: var(--faint);
    font-size: 12.5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .pprog {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pprog .bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
    display: block;
  }
  .pprog .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }
  .pct {
    width: 36px;
    text-align: right;
    font-size: 12px;
    color: var(--muted);
  }
  .num {
    text-align: right;
  }
  .num.zero {
    color: var(--faint);
  }
  .of {
    color: var(--faint);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-top: 12px;
  }
  .date {
    font-size: 13px;
    color: var(--muted);
  }
  .head h1 {
    margin: 2px 0 0;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .pname {
    font-weight: 600;
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--accent-text);
    font-size: 14px;
    font-weight: 600;
    min-height: 44px;
    padding: 0 4px;
  }
</style>
