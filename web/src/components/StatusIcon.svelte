<script lang="ts">
  import type { Status } from '../lib/api';
  let { status, size = 16 }: { status: Status; size?: number } = $props();
  const color = $derived(`var(--st-${status})`);
</script>

<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style="flex-shrink:0">
  {#if status === 'backlog'}
    <circle cx="8" cy="8" r="6" fill="none" stroke={color} stroke-width="1.6" stroke-dasharray="2.4 2" />
  {:else if status === 'todo'}
    <circle cx="8" cy="8" r="6" fill="none" stroke={color} stroke-width="1.6" />
  {:else if status === 'in_progress'}
    <circle cx="8" cy="8" r="6" fill="none" stroke={color} stroke-width="1.6" />
    <path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill={color} />
  {:else if status === 'in_review'}
    <circle cx="8" cy="8" r="6" fill="none" stroke={color} stroke-width="1.6" />
    <path d="M8 4.5a3.5 3.5 0 1 1-3.5 3.5H8z" fill={color} />
  {:else if status === 'done'}
    <circle cx="8" cy="8" r="7" fill={color} />
    <path d="M5 8.2l2 2 4-4.2" fill="none" stroke="var(--surface)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  {:else}
    <circle cx="8" cy="8" r="7" fill={color} />
    <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--surface)" stroke-width="1.6" stroke-linecap="round" />
  {/if}
</svg>
