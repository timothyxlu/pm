<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let {
    options,
    selected,
    onpick,
    item,
  }: { options: T[]; selected: T; onpick: (v: T) => void; item: Snippet<[T]> } = $props();
</script>

<div
  class="opts"
  role="listbox"
  tabindex="-1"
  onkeydown={(e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const opts = [...e.currentTarget.querySelectorAll<HTMLElement>('.opt')];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    opts[(at + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]?.focus();
  }}
>
  {#each options as o}
    <button type="button" role="option" aria-selected={o === selected} class="opt" onclick={() => onpick(o)}>
      <span class="label">{@render item(o)}</span>
      {#if o === selected}<span class="check"><Icon name="check" size={18} /></span>{/if}
    </button>
  {/each}
</div>

<style>
  .opts {
    display: flex;
    flex-direction: column;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 0 4px;
    border-radius: 10px;
  }
  .opt:focus-visible {
    outline: none;
    background: var(--selected);
  }
  @media (hover: hover) {
    .opt:hover {
      background: var(--hover);
    }
  }
  .opt:active {
    background: var(--surface-2);
  }
  .label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .check {
    color: var(--accent);
    display: flex;
  }
</style>
