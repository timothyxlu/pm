<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueRow from '../components/IssueRow.svelte';
  import ProjectForm from '../components/ProjectForm.svelte';
  import { fmtLongDate, i18n } from '../lib/i18n.svelte';
  import { issueOrder, store } from '../lib/store.svelte';

  const t = $derived(i18n.t);
  let showArchived = $state(false);
  let creating = $state(false);

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const stats = $derived({
    done: store.live.filter((i) => i.status === 'done' && i.completed_at && i.completed_at >= weekAgo).length,
    inProgress: store.live.filter((i) => i.status === 'in_progress').length,
    inReview: store.live.filter((i) => i.status === 'in_review').length,
  });
  const projects = $derived(store.projectList.filter((p) => showArchived || p.status !== 'archived'));
  const archivedCount = $derived(store.projectList.filter((p) => p.status === 'archived').length);
  const working = $derived(store.live.filter((i) => i.status === 'in_progress').sort(issueOrder));
</script>

<div class="page">
  <header class="head">
    <div>
      <span class="date">{fmtLongDate(new Date())}</span>
      <h1>{t.projects}</h1>
    </div>
    <a class="icon-btn" href="/settings" aria-label={t.settings}><Icon name="settings" /></a>
  </header>

  <div class="stats">
    <div class="stat"><span class="n mono">{stats.done}</span><span>{t.doneThisWeek}</span></div>
    <div class="stat"><span class="n mono">{stats.inProgress}</span><span>{t.inProgress}</span></div>
    <div class="stat"><span class="n mono">{stats.inReview}</span><span>{t.inReview}</span></div>
  </div>

  {#if store.loaded && projects.length === 0 && !store.syncing}
    <p class="empty">{t.noProjects}</p>
  {/if}

  <div class="projects">
    {#each projects as p (p.key)}
      {@const c = store.counts(p.key)}
      <a class="card project" href={`/p/${p.key}`} class:dim={p.status !== 'active'}>
        <div class="top">
          <div class="name">
            <span class="pname">{p.name}</span>
            <span class="key mono">{p.key}</span>
            {#if p.status !== 'active'}<span class="tag">{t.projectStatus[p.status]}</span>{/if}
          </div>
          <span class="ratio mono">{c.counts.done} / {c.total}</span>
        </div>
        <div class="bar" role="progressbar" aria-valuenow={Math.round(c.progress * 100)} aria-valuemin="0" aria-valuemax="100">
          <div style:width={`${c.progress * 100}%`}></div>
        </div>
        {#if p.status === 'active' && c.counts.in_progress + c.counts.in_review + c.counts.todo > 0}
          <div class="counts">
            {#if c.counts.in_progress}<span>{t.statuses.in_progress} {c.counts.in_progress}</span>{/if}
            {#if c.counts.in_review}<span>{t.statuses.in_review} {c.counts.in_review}</span>{/if}
            {#if c.counts.todo}<span>{t.statuses.todo} {c.counts.todo}</span>{/if}
          </div>
        {/if}
      </a>
    {/each}
  </div>

  <div class="links">
    <button class="link" onclick={() => (creating = true)}>+ {t.newProject}</button>
    {#if archivedCount > 0}
      <button class="link" onclick={() => (showArchived = !showArchived)}>
        {showArchived ? t.hide : `${t.showArchived} (${archivedCount})`}
      </button>
    {/if}
  </div>

  {#if working.length}
    <h2 class="section-title">{t.workingOn}</h2>
    <div class="list">
      {#each working as issue (issue.id)}
        <IssueRow {issue} />
      {/each}
    </div>
  {/if}
</div>

<ProjectForm bind:open={creating} />

<style>
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
  h1 {
    margin: 2px 0 0;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 16px 0;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    font-size: 12px;
    color: var(--muted);
  }
  .stat .n {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
  }
  .projects {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .project {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    color: var(--ink);
  }
  .project:active {
    background: var(--surface-2);
  }
  .project.dim {
    opacity: 0.7;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .name {
    display: flex;
    gap: 8px;
    align-items: baseline;
    min-width: 0;
  }
  .pname {
    font-weight: 600;
    font-size: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .key {
    font-size: 12px;
    color: var(--muted);
  }
  .ratio {
    font-size: 13px;
    color: var(--muted);
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s;
  }
  .counts {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--muted);
  }
  .links {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
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
