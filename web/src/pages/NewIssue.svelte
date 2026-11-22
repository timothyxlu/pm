<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueFields from '../components/IssueFields.svelte';
  import OptionList from '../components/OptionList.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { api, type Status } from '../lib/api';
  import { i18n } from '../lib/i18n.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  let { project: initialProject, parent, modal = false }: { project?: string; parent?: string; modal?: boolean } = $props();
  const t = $derived(i18n.t);

  const activeProjects = $derived(store.projectList.filter((p) => p.status !== 'archived'));
  const parentIssue = $derived(parent ? store.byIdentifier.get(parent.toUpperCase()) : undefined);

  let project = $state(startProject());
  let title = $state('');
  let description = $state('');
  let fields = $state({ status: 'todo' as Status, priority: 0, labels: [] as string[], due_date: null as string | null });
  let picking = $state(false);
  let busy = $state(false);
  let more = $state(false);
  let createdId = $state('');
  let error = $state('');

  function startProject() {
    return (initialProject ?? '').toUpperCase() || readLastProject();
  }
  function readLastProject() {
    try {
      return localStorage.getItem('pm.lastProject') ?? '';
    } catch {
      return '';
    }
  }

  // A sub-issue lives in its parent's project. (Migrated identifiers like
  // ENG-42 do not always match the project key, so look the parent up.)
  $effect(() => {
    if (parentIssue) project = parentIssue.project;
  });

  // Fall back to the first active project once projects are loaded.
  $effect(() => {
    if ((!project || !store.projects[project]) && activeProjects.length && !initialProject && !parent) project = activeProjects[0].key;
  });

  const nextId = $derived(store.projects[project] ? `${project}-${store.projects[project].next_number}` : '');

  const close = () => router.back(project ? `/p/${project}` : '/');
  function cmdEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  async function submit(e?: Event) {
    e?.preventDefault();
    if (!title.trim() || !project || busy) return;
    busy = true;
    error = '';
    try {
      const created = await api.createIssue({
        project,
        title: title.trim(),
        description: description.trim() || null,
        status: fields.status,
        priority: fields.priority,
        labels: fields.labels,
        due_date: fields.due_date,
        ...(parent ? { parent: parent.toUpperCase() } : {}),
      });
      try {
        localStorage.setItem('pm.lastProject', project);
      } catch {}
      store.sync();
      if (more) {
        // "Create another": stay here with the same project and fields.
        title = '';
        description = '';
        createdId = created.identifier;
        document.querySelector<HTMLElement>('.mtitle, .dtitle')?.focus();
      } else router.go(`/i/${created.identifier}`, true);
    } catch (err) {
      store.handleError(err);
      error = `${t.saveFailed}: ${(err as Error).message}`;
    } finally {
      busy = false;
    }
  }
</script>

{#if modal}
  <dialog
    class="newdlg"
    aria-label={t.newIssue}
    {@attach (d: HTMLDialogElement) => d.showModal()}
    oncancel={(e) => {
      e.preventDefault();
      close();
    }}
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
  >
    <form class="dform" onsubmit={submit}>
      <header class="dbar">
        <button type="button" class="pchip" onclick={() => (picking = true)} disabled={!!parent}>
          {#if store.projects[project]}<span class="mono">{project}</span>{store.projects[project].name}{:else}{t.chooseProject}{/if}
        </button>
        <Icon name="arrow" size={12} />
        <span class="dtitle-sm">{t.newIssue}</span>
        {#if parent}
          <span class="dparent"><Icon name="parent" size={13} />{t.parent} <b class="mono">{parent.toUpperCase()}</b>{#if parentIssue}<span class="ellipsis">{parentIssue.title}</span>{/if}</span>
        {/if}
        <span class="spacer"></span>
        <button type="button" class="xbtn" onclick={close} aria-label={t.cancel}><Icon name="x" size={16} /></button>
      </header>
      <!-- svelte-ignore a11y_autofocus (the dialog opens to type a title) -->
      <input class="dtitle" bind:value={title} placeholder={t.title} aria-label={t.title} required autocomplete="off" autofocus onkeydown={cmdEnter} />
      <textarea class="ddesc" rows="6" bind:value={description} placeholder={t.descriptionPlaceholder} aria-label={t.description} onkeydown={cmdEnter}></textarea>
      <div class="dfields">
        <IssueFields {...fields} onchange={(p) => (fields = { ...fields, ...p })} />
      </div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <footer class="dfoot">
        {#if nextId}<span class="hint">{t.willCreateAs(nextId)}</span>{/if}
        {#if !activeProjects.length && store.loaded}<span class="hint">{t.noProjects}</span>{/if}
        {#if createdId}<span class="hint ok"><Icon name="check" size={14} />{t.createdAs(createdId)}</span>{/if}
        <span class="spacer"></span>
        <label class="moremode"><input type="checkbox" bind:checked={more} />{t.createMore}</label>
        <button type="button" class="btn" onclick={close}>{t.cancel}</button>
        <button type="submit" class="btn primary" disabled={busy || !title.trim() || !project}>{t.create} <kbd>⌘↵</kbd></button>
      </footer>
    </form>
  </dialog>
{:else}
<form class="page plain mnew" onsubmit={submit} aria-label={t.newIssue}>
  <header class="bar">
    <button type="button" class="text-btn" onclick={close}>{t.cancel}</button>
    <h1>{t.newIssue}{#if nextId}<span class="nid mono">{nextId}</span>{/if}</h1>
    <button type="submit" class="create" disabled={busy || !title.trim() || !project}>{t.create}</button>
  </header>

  {#if parent}
    <div class="parent">
      <Icon name="parent" size={14} />
      <span class="muted">{t.parent}</span>
      <b class="mono">{parent.toUpperCase()}</b>
      {#if parentIssue}<span class="ellipsis">{parentIssue.title}</span>{/if}
    </div>
  {/if}

  <textarea
    class="mtitle"
    rows="1"
    bind:value={title}
    placeholder={t.title}
    aria-label={t.title}
    required
    enterkeyhint="next"
    onkeydown={(e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) submit();
        else (e.currentTarget.form?.querySelector('.mdesc') as HTMLElement | null)?.focus();
      }
    }}
    {@attach (el) => el.focus()}
  ></textarea>

  <div class="mfields">
    <IssueFields {...fields} onchange={(p) => (fields = { ...fields, ...p })}>
      {#snippet lead()}
        <button type="button" class="chip strong" onclick={() => (picking = true)} disabled={!!parent}>
          {#if store.projects[project]}<span class="mono key">{project}</span>{store.projects[project].name}{:else}{t.chooseProject}{/if}
        </button>
      {/snippet}
    </IssueFields>
  </div>

  <textarea class="mdesc" rows="6" bind:value={description} placeholder={t.descriptionHint} aria-label={t.description} onkeydown={cmdEnter}></textarea>

  <label class="moremode"><input type="checkbox" bind:checked={more} />{t.createMore}</label>
  {#if createdId}<p class="hint ok"><Icon name="check" size={14} />{t.createdAs(createdId)}</p>{/if}
  {#if !activeProjects.length && store.loaded}<p class="hint">{t.noProjects}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</form>
{/if}

<Sheet bind:open={picking} title={t.project}>
  <OptionList
    options={activeProjects.map((p) => p.key)}
    selected={project}
    onpick={(k) => {
      project = k;
      picking = false;
    }}
  >
    {#snippet item(k)}<span class="mono key">{k}</span>{store.projects[k]?.name}{/snippet}
  </OptionList>
</Sheet>

<style>
  .mnew .bar {
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--bg);
    margin: calc(-8px - var(--safe-t)) -16px 4px;
    padding: var(--safe-t) 12px 0;
  }
  .nid {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
    margin-left: 6px;
  }
  .create {
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 17px;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
    font-size: 15px;
  }
  .create:disabled {
    opacity: 0.4;
  }
  .mtitle,
  .mdesc {
    width: 100%;
    border: 0;
    outline: none;
    background: transparent;
    resize: none;
    padding: 0;
    color: var(--ink);
    field-sizing: content;
  }
  .mtitle {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    margin: 12px 0 14px;
    min-height: 1.3em;
  }
  .mdesc {
    font-size: 16px;
    line-height: 1.55;
    min-height: 140px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .mtitle::placeholder,
  .mdesc::placeholder {
    color: var(--faint);
  }
  .moremode {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-size: 14px;
    color: var(--muted);
  }
  .moremode input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
    margin: 0;
  }
  .dfoot .moremode {
    min-height: 0;
    font-size: 13px;
    margin-right: 6px;
  }
  .dfoot .moremode input {
    width: 15px;
    height: 15px;
  }
  .hint.ok {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--st-in_review);
  }
  .newdlg {
    margin: 10vh auto auto;
    padding: 0;
    border: 0;
    width: min(720px, calc(100vw - 48px));
    background: transparent;
    color: var(--ink);
    overflow: visible;
  }
  .newdlg::backdrop {
    background: rgb(0 0 0 / 0.3);
  }
  .newdlg[open] {
    animation: pop 0.12s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(0.98);
      opacity: 0;
    }
  }
  .dform {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.22);
    padding: 14px 18px 14px;
    display: flex;
    flex-direction: column;
  }
  .dbar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    min-width: 0;
  }
  .pchip {
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface-2);
    font-size: 12.5px;
    font-weight: 600;
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .pchip .mono {
    color: var(--muted);
  }
  .dtitle-sm {
    color: var(--ink-2);
  }
  .dparent {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    min-width: 0;
    margin-left: 6px;
  }
  .spacer {
    flex: 1;
  }
  .xbtn {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .xbtn:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .dtitle {
    border: 0;
    outline: none;
    background: transparent;
    font-size: 20px;
    font-weight: 600;
    padding: 14px 0 6px;
  }
  .ddesc {
    border: 0;
    outline: none;
    background: transparent;
    resize: vertical;
    font-size: 14px;
    line-height: 1.55;
    padding: 4px 0 10px;
    min-height: 96px;
  }
  .dtitle::placeholder,
  .ddesc::placeholder {
    color: var(--faint);
  }
  .dfields {
    padding: 6px 0 12px;
  }
  .dfoot {
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 1px solid var(--line);
    padding-top: 12px;
    margin: 0 -18px;
    padding-left: 18px;
    padding-right: 18px;
  }
  .dfoot kbd {
    opacity: 0.75;
    margin-left: 4px;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    margin-bottom: 8px;
  }
  h1 {
    font-size: 17px;
    margin: 0;
  }
  .text-btn {
    border: 0;
    background: transparent;
    color: var(--accent-text);
    font-size: 16px;
    min-height: 44px;
    padding: 0 4px;
  }
  .text-btn:disabled {
    opacity: 0.4;
  }
  .strong {
    font-weight: 600;
  }
  .key {
    font-size: 12px;
    color: var(--muted);
    margin-right: 2px;
  }
  .parent {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    margin-bottom: 14px;
    min-width: 0;
  }
  .muted {
    color: var(--muted);
  }
  .ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .error {
    color: var(--danger);
    font-size: 14px;
  }
</style>
