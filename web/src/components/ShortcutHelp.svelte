<script lang="ts">
  import { i18n } from '../lib/i18n.svelte';
  import { keys } from '../lib/keys.svelte';
  import Sheet from './Sheet.svelte';
  const t = $derived(i18n.t);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const fmt = (k: string) => (mac ? k : k.replace('⌘', 'Ctrl+'));
</script>

<Sheet bind:open={keys.help} title={t.shortcuts}>
  <dl>
    {#each t.keyHelp as [k, what]}
      <div>
        <dt>{#each fmt(k).split(' ') as part}{#if part === '/' && k !== '/' || part === 'then' || part === '然后'}<span>{part}</span>{:else}<kbd>{part}</kbd>{/if}{/each}</dt>
        <dd>{what}</dd>
      </div>
    {/each}
  </dl>
</Sheet>

<style>
  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
  }
  dl div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 36px;
    border-bottom: 1px solid var(--line-soft);
  }
  dt {
    order: 2;
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  dd {
    margin: 0;
    font-size: 14px;
  }
  kbd {
    font: 11.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    border: 1px solid var(--line);
    border-bottom-width: 2px;
    border-radius: 5px;
    padding: 3px 6px;
    background: var(--surface-2);
    color: var(--ink-2);
  }
</style>
