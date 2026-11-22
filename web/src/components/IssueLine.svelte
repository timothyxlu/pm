<script lang="ts">
  // A one-line issue row for wide screens, in the style of a table:
  // priority, ID, status, title, then tags and dates on the right.
  import type { Issue } from '../lib/api';
  import { fmtDay, i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import PriorityIcon from './PriorityIcon.svelte';
  import StatusIcon from './StatusIcon.svelte';

  let { issue, showParent = true, showProject = false }: { issue: Issue; showParent?: boolean; showProject?: boolean } = $props();
  const t = $derived(i18n.t);
  const sub = $derived(store.subIssueCount(issue));
  const parent = $derived(showParent ? store.parentOf(issue) : null);
  const overdue = $derived(
    !!issue.due_date && issue.status !== 'done' && issue.status !== 'canceled' && issue.due_date < new Date().toISOString().slice(0, 10),
  );
</script>

<a class="line" href={`/i/${issue.identifier}`} data-row>
  <span class="prio" title={t.priorities[issue.priority]}><PriorityIcon priority={issue.priority} /></span>
  <span class="id mono">{issue.identifier}</span>
  <span class="st" title={t.statuses[issue.status]}><StatusIcon status={issue.status} size={15} /></span>
  <span class="title">{issue.title}</span>
  {#if parent}<span class="ptitle" title={parent.title}>› {parent.title}</span>{/if}
  <span class="right">
    {#if sub}<span class="tag">{t.subCount(sub.done, sub.total)}</span>{/if}
    {#each issue.labels.slice(0, 3) as l}<span class="label"><i></i>{l}</span>{/each}
    {#if showProject}<span class="tag mono">{issue.project}</span>{/if}
    {#if issue.due_date}<span class="tag" class:urgent={overdue}>{t.due(fmtDay(issue.due_date))}</span>{/if}
    <span class="date">{fmtDay(issue.created_at.slice(0, 10))}</span>
  </span>
</a>

<style>
  .line {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 16px 0 14px;
    color: var(--ink);
    font-size: 13.5px;
    border-bottom: 1px solid var(--line-soft);
    outline: none;
  }
  .line:hover {
    background: var(--hover);
  }
  .line:focus-visible {
    background: var(--selected);
    box-shadow: inset 2px 0 0 var(--accent);
  }
  .prio {
    display: flex;
    width: 16px;
    flex-shrink: 0;
  }
  .id {
    width: 64px;
    flex-shrink: 0;
    font-size: 12.5px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .st {
    display: flex;
    flex-shrink: 0;
  }
  .title {
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
    flex-shrink: 1;
  }
  .ptitle {
    color: var(--faint);
    font-size: 12.5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 40px;
    flex-shrink: 3;
  }
  .right {
    margin-left: auto;
    padding-left: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 11px;
    font-size: 12px;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .label i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.7;
  }
  .date {
    width: 56px;
    text-align: right;
    font-size: 12px;
    color: var(--faint);
    white-space: nowrap;
  }
</style>
