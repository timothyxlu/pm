<script lang="ts">
  import IssueRow from '../components/IssueRow.svelte';
  import StatusIcon from '../components/StatusIcon.svelte';
  import { i18n } from '../lib/i18n.svelte';
  import { issueOrder, store } from '../lib/store.svelte';

  const t = $derived(i18n.t);
  const groups = $derived(
    (['in_progress', 'in_review'] as const).map((s) => ({
      status: s,
      issues: store.live.filter((i) => i.status === s).sort(issueOrder),
    })),
  );
</script>

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
  {#if store.loaded && groups.every((g) => !g.issues.length)}
    <p class="empty">{t.nothingActive}</p>
  {/if}
</div>

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
</style>
