<script lang="ts">
  let { priority, size = 14 }: { priority: number; size?: number } = $props();
  // 1 urgent, 2 high, 3 medium, 4 low, 0 none
  const filled = $derived(priority === 2 ? 3 : priority === 3 ? 2 : priority === 4 ? 1 : 0);
</script>

<svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" style="flex-shrink:0">
  {#if priority === 1}
    <rect x="1" y="1" width="12" height="12" rx="3" fill="#EA580C" />
    <path d="M7 3.8v4M7 10.2v.1" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
  {:else if priority === 0}
    <path d="M2 7h2M6 7h2M10 7h2" stroke="var(--faint)" stroke-width="1.6" stroke-linecap="round" />
  {:else}
    <rect x="1" y="8" width="3" height="5" rx="1" fill={filled >= 1 ? 'var(--muted)' : 'var(--line)'} />
    <rect x="5.5" y="5" width="3" height="8" rx="1" fill={filled >= 2 ? 'var(--muted)' : 'var(--line)'} />
    <rect x="10" y="2" width="3" height="11" rx="1" fill={filled >= 3 ? 'var(--muted)' : 'var(--line)'} />
  {/if}
</svg>
