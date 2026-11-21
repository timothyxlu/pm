<script lang="ts">
  import type { Issue } from '../lib/api';
  import { fmtDay, i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import StatusIcon from './StatusIcon.svelte';

  let { issue, showParent = true }: { issue: Issue; showParent?: boolean } = $props();
  const t = $derived(i18n.t);
  const sub = $derived(store.subIssueCount(issue));
  const parent = $derived(showParent ? store.parentOf(issue) : null);
  const overdue = $derived(
    !!issue.due_date && issue.status !== 'done' && issue.status !== 'canceled' && issue.due_date < new Date().toISOString().slice(0, 10),
  );
</script>

<a class="row" href={`/i/${issue.identifier}`}>
  <StatusIcon status={issue.status} />
  <div class="body">
    <div class="meta">
      <span class="id mono">{issue.identifier}</span>
      {#if issue.priority === 1}<span class="tag urgent">{t.priorities[1]}</span>{/if}
      {#if issue.priority === 2}<span class="tag high">{t.priorities[2]}</span>{/if}
      {#if parent}<span class="tag">↳ {parent.identifier}</span>{/if}
      {#if sub}<span class="tag">{t.subCount(sub.done, sub.total)}</span>{/if}
      {#if issue.due_date}<span class="tag" class:urgent={overdue}>{t.due(fmtDay(issue.due_date))}</span>{/if}
      {#each issue.labels.slice(0, 2) as l}<span class="tag">{l}</span>{/each}
    </div>
    <span class="title">{issue.title}</span>
  </div>
</a>

<style>
  .row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    color: var(--ink);
    min-height: 56px;
  }
  .row + :global(.row) {
    border-top: 1px solid var(--line);
  }
  .row:active {
    background: var(--surface-2);
  }
  .row :global(svg) {
    margin-top: 2px;
  }
  .body {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .meta {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .id {
    font-size: 12px;
    color: var(--muted);
    font-weight: 500;
  }
  .title {
    font-size: 15px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
</style>
