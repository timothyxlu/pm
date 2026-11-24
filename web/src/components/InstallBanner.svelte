<script lang="ts">
  import { i18n } from '../lib/i18n.svelte';
  import { install } from '../lib/pwa.svelte';
  const t = $derived(i18n.t);
</script>

{#if install.showBanner}
  <div class="install card" role="region" aria-label={t.installBannerTitle}>
    <img src="/icon.svg" alt="" width="40" height="40" />
    <div class="text">
      <strong>{t.installBannerTitle}</strong>
      <span>{install.platform === 'prompt' ? t.installBannerHint : t.installIos}</span>
    </div>
    <div class="actions">
      <button class="btn" onclick={() => install.dismissBanner()}>{t.installDismiss}</button>
      {#if install.platform === 'prompt'}
        <button class="btn primary" onclick={() => install.prompt()}>{t.installButton}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .install {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    margin: 8px 0 16px;
    background: var(--accent-soft);
    border-color: transparent;
  }
  img {
    flex-shrink: 0;
    border-radius: 10px;
  }
  .text {
    flex: 1;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    color: var(--muted);
  }
  strong {
    font-size: 15px;
    color: var(--ink);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .actions .btn:not(.primary) {
    background: transparent;
    border-color: transparent;
    color: var(--muted);
  }
  :global(.dbody) > .install {
    margin-top: 0;
  }
</style>
