<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueLine from '../components/IssueLine.svelte';
  import IssueRow from '../components/IssueRow.svelte';
  import StatusIcon from '../components/StatusIcon.svelte';
  import { i18n } from '../lib/i18n.svelte';
  import { media } from '../lib/media.svelte';
  import { issueOrder, store } from '../lib/store.svelte';

  // The issue-level view: what is moving now, and what got finished this week.
  // The Overview tab stays at the project level.
  const t = $derived(i18n.t);
  const groups = $derived(
    (['in_progress', 'in_review'] as const).map((s) => ({
      status: s,
      issues: store.live.filter((i) => i.status === s).sort(issueOrder),
    })),
  );
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const done = $derived(
    store.live
      .filter((i) => i.status === 'done' && i.completed_at && i.completed_at >= weekAgo)
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
  );
  const idle = $derived(store.loaded && groups.every((g) => !g.issues.length));
  let showDone = $state(false);
</script>

{#if media.desktop}
<div class="dpage">
  <header class="dhead"><h1>{t.active}</h1></header>
  <div class="dbody">
    {#if idle}<p class="empty">{t.nothingActive}</p>{/if}
    {#if !idle || done.length}
      <div class="dlist">
        {#each groups as g (g.status)}
          {#if g.issues.length}
            <div class="dgroup"><StatusIcon status={g.status} size={14} />{t.statuses[g.status]}<span class="n">{g.issues.length}</span></div>
            {#each g.issues as issue (issue.id)}<IssueLine {issue} showProject />{/each}
          {/if}
        {/each}
        {#if done.length}
          <button class="dgroup toggle" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
            <StatusIcon status="done" size={14} />{t.doneThisWeek}<span class="n">{done.length}</span>
            <span class="chev" class:open={showDone}><Icon name="arrow" size={14} /></span>
          </button>
          {#if showDone}
            {#each done as issue (issue.id)}<IssueLine {issue} showProject />{/each}
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>
{:else}
<div class="page">
  <header class="topbar"><h1 class="pad">{t.active}</h1></header>
  {#each groups as g (g.status)}
    {#if g.issues.length}
      <h2 class="section-title group"><StatusIcon status={g.status} size={14} />{t.statuses[g.status]} · {g.issues.length}</h2>
      <div class="list">
        {#each g.issues as issue (issue.id)}<IssueRow {issue} />{/each}
      </div>
    {/if}
  {/each}
  {#if idle}<p class="empty">{t.nothingActive}</p>{/if}
  {#if done.length}
    <button class="section-title group toggle" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
      <StatusIcon status="done" size={14} />{t.doneThisWeek} · {done.length}
      <span class="chev" class:open={showDone}><Icon name="arrow" size={14} /></span>
    </button>
    {#if showDone}
      <div class="list">
        {#each done as issue (issue.id)}<IssueRow {issue} />{/each}
      </div>
    {/if}
  {/if}
</div>
{/if}

<style>
  .pad {
    padding-left: 8px;
    font-size: 28px !important;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .toggle {
    width: 100%;
    text-align: left;
    cursor: pointer;
    border-width: 0 0 1px;
  }
  button.section-title {
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    min-height: 32px;
  }
  .chev {
    display: inline-flex;
    color: var(--faint);
    transition: transform 0.15s;
  }
  .chev.open {
    transform: rotate(90deg);
  }
</style>
