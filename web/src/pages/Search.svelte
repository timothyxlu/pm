<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueRow from '../components/IssueRow.svelte';
  import { i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';

  // Searches the local copy, so results appear as you type, even offline.
  const t = $derived(i18n.t);
  let q = $state(readQuery());

  function readQuery() {
    try {
      return sessionStorage.getItem('pm.search') ?? '';
    } catch {
      return '';
    }
  }
  $effect(() => {
    try {
      sessionStorage.setItem('pm.search', q);
    } catch {}
  });

  const results = $derived.by(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const scored = [];
    for (const i of store.live) {
      const id = i.identifier.toLowerCase();
      const title = i.title.toLowerCase();
      const hay = `${id} ${title} ${(i.description ?? '').toLowerCase()} ${i.labels.join(' ').toLowerCase()}`;
      if (!terms.every((term) => hay.includes(term))) continue;
      let score = 0;
      for (const term of terms) {
        if (id === term) score += 100;
        else if (id.startsWith(term)) score += 20;
        if (title.includes(term)) score += 10;
      }
      if (i.status === 'done' || i.status === 'canceled') score -= 5;
      scored.push({ i, score });
    }
    return scored
      .sort((a, b) => b.score - a.score || b.i.updated_at.localeCompare(a.i.updated_at))
      .slice(0, 100)
      .map((s) => s.i);
  });
</script>

<div class="page">
  <div class="box">
    <Icon name="search" size={18} />
    <input
      type="search"
      bind:value={q}
      placeholder={t.searchPlaceholder}
      aria-label={t.search}
      autocomplete="off"
      enterkeyhint="search"
      {@attach (el) => {
        if (!q) el.focus();
      }}
    />
  </div>
  {#if results.length}
    <div class="list">
      {#each results as issue (issue.id)}<IssueRow {issue} />{/each}
    </div>
  {:else if q.trim()}
    <p class="empty">{t.noResults}</p>
  {/if}
</div>

<style>
  .box {
    position: sticky;
    top: calc(var(--safe-t) + 8px);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 14px;
    margin: 12px 0 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    color: var(--muted);
    box-shadow: var(--shadow);
  }
  input {
    flex: 1;
    border: 0;
    background: transparent;
    font-size: 16px;
    color: var(--ink);
    outline: none;
    height: 100%;
  }
</style>
