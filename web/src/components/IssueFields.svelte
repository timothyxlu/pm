<script lang="ts">
  // The chip row shared by the issue page and the create form: status,
  // priority, labels and due date. Each chip opens a bottom sheet.
  import { STATUSES, type Status } from '../lib/api';
  import { fmtDay, i18n } from '../lib/i18n.svelte';
  import { store } from '../lib/store.svelte';
  import OptionList from './OptionList.svelte';
  import PriorityIcon from './PriorityIcon.svelte';
  import Sheet from './Sheet.svelte';
  import StatusIcon from './StatusIcon.svelte';

  let {
    status,
    priority,
    labels,
    due_date,
    onchange,
    vertical = false,
  }: {
    vertical?: boolean;
    status: Status;
    priority: number;
    labels: string[];
    due_date: string | null;
    onchange: (patch: { status?: Status; priority?: number; labels?: string[]; due_date?: string | null }) => void;
  } = $props();
  const t = $derived(i18n.t);

  let sheet = $state<'status' | 'priority' | 'labels' | 'due' | null>(null);
  let labelDraft = $state('');
  let labelSet = $state<string[]>([]);
  let dueDraft = $state('');

  export function open(which: typeof sheet) {
    if (which === 'labels') {
      labelSet = [...labels];
      labelDraft = '';
    }
    if (which === 'due') dueDraft = due_date ?? '';
    sheet = which;
  }
  function toggleLabel(l: string) {
    labelSet = labelSet.includes(l) ? labelSet.filter((x) => x !== l) : [...labelSet, l];
  }
  function saveLabels() {
    const extra = labelDraft
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...new Set([...labelSet, ...extra])];
    sheet = null;
    if (next.join('\n') !== labels.join('\n')) onchange({ labels: next });
  }
  const allLabels = $derived([...new Set([...store.labels, ...labels, ...labelSet])].sort());
  const PRIORITIES = [1, 2, 3, 4, 0];
</script>

{#if vertical}
  <div class="rows">
    <div class="prop">
      <span class="plabel">{t.status}</span>
      <button type="button" class="pval" onclick={() => open('status')}><StatusIcon {status} size={14} />{t.statuses[status]}</button>
    </div>
    <div class="prop">
      <span class="plabel">{t.priority}</span>
      <button type="button" class="pval" onclick={() => open('priority')}>
        <PriorityIcon {priority} />{#if priority !== 0}{t.priorities[priority]}{:else}<span class="faint">{t.priorities[0]}</span>{/if}
      </button>
    </div>
    <div class="prop">
      <span class="plabel">{t.labels}</span>
      <button type="button" class="pval wrap" onclick={() => open('labels')}>
        {#each labels as l}<span class="lbl"><i></i>{l}</span>{:else}<span class="faint">+ {t.labels}</span>{/each}
      </button>
    </div>
    <div class="prop">
      <span class="plabel">{t.dueDate}</span>
      <button type="button" class="pval" onclick={() => open('due')}>
        {#if due_date}{fmtDay(due_date)}{:else}<span class="faint">+ {t.dueDate}</span>{/if}
      </button>
    </div>
  </div>
{:else}
<div class="chips">
  <button type="button" class="chip strong" onclick={() => open('status')}>
    <StatusIcon {status} size={14} />{t.statuses[status]}
  </button>
  <button type="button" class="chip" class:dashed={priority === 0} onclick={() => open('priority')}>
    {#if priority !== 0}<PriorityIcon {priority} />{t.priorities[priority]}{:else}{t.priority}{/if}
  </button>
  <button type="button" class="chip" class:dashed={!labels.length} onclick={() => open('labels')}>
    {labels.length ? labels.join(', ') : t.labels}
  </button>
  <button type="button" class="chip" class:dashed={!due_date} onclick={() => open('due')}>
    {due_date ? t.due(fmtDay(due_date)) : t.dueDate}
  </button>
</div>
{/if}

<Sheet open={sheet === 'status'} onclose={() => (sheet = null)} title={t.status}>
  <OptionList
    options={[...STATUSES]}
    selected={status}
    onpick={(s) => {
      sheet = null;
      if (s !== status) onchange({ status: s });
    }}
  >
    {#snippet item(s)}<StatusIcon status={s} />{t.statuses[s]}{/snippet}
  </OptionList>
</Sheet>

<Sheet open={sheet === 'priority'} onclose={() => (sheet = null)} title={t.priority}>
  <OptionList
    options={PRIORITIES}
    selected={priority}
    onpick={(p) => {
      sheet = null;
      if (p !== priority) onchange({ priority: p });
    }}
  >
    {#snippet item(p)}<PriorityIcon priority={p} />{t.priorities[p]}{/snippet}
  </OptionList>
</Sheet>

<Sheet open={sheet === 'labels'} onclose={() => (sheet = null)} title={t.labels}>
  <div class="labels">
    {#each allLabels as l}
      <button type="button" class="chip" class:on={labelSet.includes(l)} aria-pressed={labelSet.includes(l)} onclick={() => toggleLabel(l)}>{l}</button>
    {/each}
  </div>
  <div class="field">
    <input
      class="input"
      bind:value={labelDraft}
      placeholder={t.labelsHint}
      aria-label={t.labels}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveLabels();
        }
      }}
    />
  </div>
  <div class="actions"><button type="button" class="btn primary" onclick={saveLabels}>{t.save}</button></div>
</Sheet>

<Sheet open={sheet === 'due'} onclose={() => (sheet = null)} title={t.dueDate}>
  <div class="field"><input type="date" class="input" bind:value={dueDraft} aria-label={t.dueDate} /></div>
  <div class="actions">
    {#if due_date}
      <button
        type="button"
        class="btn"
        onclick={() => {
          sheet = null;
          onchange({ due_date: null });
        }}>{t.clear}</button>
    {/if}
    <button
      type="button"
      class="btn primary"
      onclick={() => {
        sheet = null;
        if ((dueDraft || null) !== due_date) onchange({ due_date: dueDraft || null });
      }}>{t.save}</button>
  </div>
</Sheet>


<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .prop {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr);
    align-items: center;
    min-height: 34px;
    gap: 4px;
  }
  .plabel {
    font-size: 12.5px;
    color: var(--muted);
    padding-left: 8px;
  }
  .pval {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    text-align: left;
    font-size: 13px;
    color: var(--ink);
    min-width: 0;
  }
  .pval.wrap {
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px;
  }
  .pval:hover {
    background: var(--hover);
  }
  .faint {
    color: var(--faint);
  }
  .lbl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 11px;
    font-size: 12px;
    background: var(--surface);
  }
  .lbl i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.7;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .strong {
    font-weight: 600;
  }
  .labels {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-text);
  }
  .actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
</style>
