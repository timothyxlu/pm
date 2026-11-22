<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    open = $bindable(false),
    title,
    onclose,
    children,
  }: { open: boolean; title?: string; onclose?: () => void; children: Snippet } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  onclose={() => {
    open = false;
    onclose?.();
  }}
  onclick={(e) => {
    if (e.target === dialog) dialog.close();
  }}
>
  <div class="sheet">
    <div class="grip" aria-hidden="true"></div>
    {#if title}<h2>{title}</h2>{/if}
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    margin: auto auto 0;
    padding: 0;
    border: 0;
    width: 100%;
    max-width: 640px;
    max-height: 85dvh;
    background: transparent;
    color: var(--ink);
  }
  dialog:focus-visible {
    outline: none;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.35);
  }
  dialog[open] {
    animation: up 0.18s ease-out;
  }
  @keyframes up {
    from {
      transform: translateY(24px);
      opacity: 0.6;
    }
  }
  .sheet {
    background: var(--surface);
    border-radius: 18px 18px 0 0;
    padding: 8px 16px calc(16px + var(--safe-b));
    max-height: 85dvh;
    overflow-y: auto;
  }
  .grip {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
    margin: 0 auto 8px;
  }
  /* Wide screens: a centered dialog instead of a bottom sheet. */
  @media (min-width: 960px) {
    dialog {
      margin: 14vh auto auto;
      max-width: 460px;
      width: calc(100% - 32px);
      max-height: 72vh;
    }
    dialog[open] {
      animation: pop 0.12s ease-out;
    }
    .sheet {
      border-radius: 14px;
      border: 1px solid var(--line);
      box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
      padding: 16px 20px 20px;
      max-height: 72vh;
    }
    .grip {
      display: none;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.98);
      opacity: 0;
    }
  }
  h2 {
    font-size: 15px;
    margin: 4px 0 8px;
    color: var(--muted);
    font-weight: 600;
  }
</style>
