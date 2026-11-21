<script lang="ts">
  import { i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  const t = $derived(i18n.t);
</script>

{#if store.sessionExpired}
  <div class="banner warn" role="alert">
    <span>{t.sessionExpired}</span>
    <!-- A full navigation, so Cloudflare Access can show its sign-in page. -->
    <a href="/login" class="action">{t.signIn}</a>
  </div>
{:else if !store.online}
  <div class="banner" role="status">{t.offline}</div>
{:else if store.syncError}
  <div class="banner warn" role="alert">
    <span>{t.syncFailed}: {store.syncError}</span>
    <button class="action" onclick={() => store.sync()}>{t.retry}</button>
  </div>
{/if}

<style>
  .banner {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: calc(var(--safe-t) + 8px) 16px 8px;
    font-size: 13px;
    background: var(--surface-2);
    color: var(--muted);
    border-bottom: 1px solid var(--line);
  }
  .warn {
    color: var(--warn);
  }
  .action {
    border: 0;
    background: transparent;
    color: var(--accent-text);
    font-weight: 600;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }
</style>
