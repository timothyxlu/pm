<script lang="ts">
  // ⌘K: search issues and projects, or run a command, from anywhere.
  import { i18n } from '../lib/i18n.svelte';
  import { keys } from '../lib/keys.svelte';
  import { router } from '../lib/router.svelte';
  import { searchIssues } from '../lib/search';
  import { store } from '../lib/store.svelte';
  import { theme } from '../lib/theme.svelte';
  import Icon from './Icon.svelte';
  import StatusIcon from './StatusIcon.svelte';
  import type { Status } from '../lib/api';

  const t = $derived(i18n.t);
  let dialog: HTMLDialogElement | undefined = $state();
  let q = $state('');
  let at = $state(0);

  type Item = { id: string; group: string; label: string; hint?: string; icon?: string; status?: Status; run: () => void };

  $effect(() => {
    if (!dialog) return;
    if (keys.palette && !dialog.open) {
      q = '';
      at = 0;
      dialog.showModal();
    }
    if (!keys.palette && dialog.open) dialog.close();
  });

  const go = (path: string) => () => router.go(path);
  const commands = $derived<Item[]>([
    { id: 'new', group: t.commands, label: t.newIssue, hint: 'C', icon: 'plus', run: go(keys.newIssueHref()) },
    { id: 'home', group: t.commands, label: t.goTo(t.overview), hint: 'G H', icon: 'grid', run: go('/') },
    { id: 'active', group: t.commands, label: t.goTo(t.active), hint: 'G A', icon: 'bolt', run: go('/active') },
    { id: 'settings', group: t.commands, label: t.goTo(t.settings), hint: 'G S', icon: 'settings', run: go('/settings') },
    {
      id: 'theme',
      group: t.commands,
      label: t.switchTheme,
      icon: 'sun',
      run: () => {
        const dark = theme.pref === 'dark' || (theme.pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        theme.set(dark ? 'light' : 'dark');
      },
    },
    { id: 'lang', group: t.commands, label: i18n.lang === 'zh' ? 'Switch to English' : '切换到中文', icon: 'arrow', run: () => i18n.setPref(i18n.lang === 'zh' ? 'en' : 'zh') },
    { id: 'keys', group: t.commands, label: t.shortcuts, hint: '?', icon: 'keyboard', run: () => (keys.help = true) },
  ]);

  const items = $derived.by<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const projects = store.projectList
      .filter((p) => p.status !== 'archived' || s)
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.key.toLowerCase().includes(s))
      .slice(0, s ? 5 : 8)
      .map<Item>((p) => ({ id: `p:${p.key}`, group: t.projects, label: p.name, hint: p.key, icon: 'folder', run: go(`/p/${p.key}`) }));
    const issues = s
      ? searchIssues(store.live, s, 12).map<Item>((i) => ({
          id: `i:${i.id}`,
          group: t.issues,
          label: i.title,
          hint: i.identifier,
          status: i.status,
          run: go(`/i/${i.identifier}`),
        }))
      : [];
    const cmds = s ? commands.filter((c) => c.label.toLowerCase().includes(s)) : commands;
    return [...issues, ...projects, ...cmds];
  });

  $effect(() => {
    // Keep the highlight inside the list as results change.
    if (at >= items.length) at = Math.max(0, items.length - 1);
  });

  function pick(item: Item | undefined) {
    if (!item) return;
    keys.palette = false;
    item.run();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      at = (at + 1) % Math.max(1, items.length);
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      at = (at - 1 + items.length) % Math.max(1, items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(items[at]);
    }
  }

  $effect(() => {
    void at;
    dialog?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
</script>

<dialog
  bind:this={dialog}
  class="palette"
  aria-label={t.searchOrJump}
  onclose={() => (keys.palette = false)}
  onclick={(e) => {
    if (e.target === dialog) keys.palette = false;
  }}
>
  <div class="box">
    <div class="input">
      <Icon name="search" size={17} />
      <input
        bind:value={q}
        placeholder={t.searchOrJump}
        aria-label={t.searchOrJump}
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        oninput={() => (at = 0)}
        {onkeydown}
      />
      <kbd>Esc</kbd>
    </div>
    <div class="list" id="palette-list" role="listbox">
      {#each items as item, n (item.id)}
        {#if n === 0 || items[n - 1].group !== item.group}<div class="group">{item.group}</div>{/if}
        <button
          role="option"
          aria-selected={n === at}
          class="item"
          onmousemove={() => (at = n)}
          onclick={() => pick(item)}
        >
          {#if item.status}<StatusIcon status={item.status} size={15} />{:else if item.icon}<Icon name={item.icon} size={15} />{/if}
          <span class="label">{item.label}</span>
          {#if item.hint}<span class="hint mono">{item.hint}</span>{/if}
        </button>
      {:else}
        <p class="none">{t.noResults}</p>
      {/each}
    </div>
  </div>
</dialog>

<style>
  .palette {
    margin: 12vh auto auto;
    padding: 0;
    border: 0;
    width: min(640px, calc(100vw - 32px));
    background: transparent;
    color: var(--ink);
    overflow: visible;
  }
  .palette::backdrop {
    background: rgb(0 0 0 / 0.3);
  }
  .palette[open] {
    animation: pop 0.12s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(0.98);
      opacity: 0;
    }
  }
  .box {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
    overflow: hidden;
  }
  .input {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    height: 54px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
  }
  input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    font-size: 16px;
    color: var(--ink);
    height: 100%;
  }
  kbd {
    font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--faint);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 3px 5px;
  }
  .list {
    max-height: min(420px, 60vh);
    overflow-y: auto;
    padding: 6px;
  }
  .group {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--faint);
    padding: 8px 10px 4px;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    text-align: left;
    font-size: 14px;
    color: var(--ink);
  }
  .item :global(svg) {
    color: var(--muted);
  }
  .item[aria-selected='true'] {
    background: var(--selected);
  }
  .label {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .hint {
    font-size: 12px;
    color: var(--faint);
  }
  .none {
    color: var(--muted);
    font-size: 14px;
    padding: 12px 10px;
    margin: 0;
  }
</style>
