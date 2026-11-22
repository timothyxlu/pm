<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueLine from '../components/IssueLine.svelte';
  import IssueRow from '../components/IssueRow.svelte';
  import { media } from '../lib/media.svelte';
  import { searchIssues } from '../lib/search';
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

  const results = $derived(searchIssues(store.live, q));
</script>

{#if media.desktop}
<div class="dpage">
  <header class="dhead">
    <div class="dbox">
      <Icon name="search" size={16} />
      <input
        type="search"
        bind:value={q}
        placeholder={t.searchPlaceholder}
        aria-label={t.search}
        autocomplete="off"
        {@attach (el) => el.focus()}
      />
      {#if results.length}<span class="cnt mono">{results.length}</span>{/if}
    </div>
  </header>
  <div class="dbody">
    {#if results.length}
      <div class="dlist">
        {#each results as issue (issue.id)}<IssueLine {issue} showProject />{/each}
      </div>
    {:else if q.trim()}
      <p class="empty">{t.noResults}</p>
    {/if}
  </div>
</div>
{:else}
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
{/if}

<style>
  .dbox {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    height: 100%;
  }
  .dbox input {
    font-size: 15px;
  }
  .cnt {
    font-size: 12px;
    color: var(--faint);
  }
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
