<script lang="ts">
  // An issue in a list on small screens: title first, details underneath.
  // The status icon is its own button, so status changes without opening the issue.
  import type { Issue } from '../lib/api';
  import { fmtDay, i18n } from '../lib/i18n.svelte';
  import { quick } from '../lib/quick.svelte';
  import { store } from '../lib/store.svelte';
  import PriorityIcon from './PriorityIcon.svelte';
  import StatusIcon from './StatusIcon.svelte';

  let { issue, showParent = true }: { issue: Issue; showParent?: boolean } = $props();
  const t = $derived(i18n.t);
  const sub = $derived(store.subIssueCount(issue));
  const parent = $derived(showParent ? store.parentOf(issue) : null);
  const overdue = $derived(
    !!issue.due_date && issue.status !== 'done' && issue.status !== 'canceled' && issue.due_date < new Date().toISOString().slice(0, 10),
  );
  const closed = $derived(issue.status === 'done' || issue.status === 'canceled');
</script>

<div class="row" class:closed>
  <button class="st" onclick={() => (quick.issue = issue)} aria-label={`${t.status}: ${t.statuses[issue.status]}`}>
    <StatusIcon status={issue.status} size={18} />
  </button>
  <a class="body" href={`/i/${issue.identifier}`} data-row>
    <span class="title">{issue.title}</span>
    <span class="meta">
      {#if issue.priority !== 0}<PriorityIcon priority={issue.priority} size={12} />{/if}
      <span class="id mono">{issue.identifier}</span>
      {#if parent}<span class="dot">·</span><span class="parent">↳ {parent.title}</span>{/if}
      {#if sub}<span class="dot">·</span><span class="mono">{sub.done}/{sub.total}</span>{/if}
      {#if issue.due_date}<span class="due" class:overdue>{fmtDay(issue.due_date)}</span>{/if}
      {#each issue.labels.slice(0, 2) as l}<span class="label"><i></i>{l}</span>{/each}
    </span>
  </a>
</div>

<style>
  .row {
    display: flex;
    align-items: flex-start;
    min-height: 60px;
    color: var(--ink);
  }
  .row + :global(.row) {
    border-top: 1px solid var(--line);
  }
  .st {
    flex-shrink: 0;
    width: 46px;
    align-self: stretch;
    display: flex;
    justify-content: center;
    padding: 13px 0 0 4px;
    border: 0;
    background: transparent;
  }
  .st:active {
    background: var(--surface-2);
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 11px 14px 11px 2px;
    color: var(--ink);
    outline: none;
  }
  .body:active {
    background: var(--surface-2);
  }
  .body:focus-visible {
    background: var(--selected);
  }
  .title {
    font-size: 15px;
    line-height: 1.4;
    font-weight: 500;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .closed .title {
    color: var(--muted);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
  }
  .id {
    font-weight: 500;
  }
  .dot {
    color: var(--faint);
  }
  .parent {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex-shrink: 1;
  }
  .due {
    padding: 0 6px;
    border-radius: 5px;
    background: var(--surface-2);
    line-height: 18px;
  }
  .due.overdue {
    background: #fee2e2;
    color: #b91c1c;
  }
  :global(:root[data-theme='dark']) .due.overdue {
    background: rgb(239 68 68 / 0.16);
    color: #fca5a5;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .due.overdue {
      background: rgb(239 68 68 / 0.16);
      color: #fca5a5;
    }
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .label i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.7;
  }
</style>
