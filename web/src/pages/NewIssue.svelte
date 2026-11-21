<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueFields from '../components/IssueFields.svelte';
  import OptionList from '../components/OptionList.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { api, type Status } from '../lib/api';
  import { i18n } from '../lib/i18n.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  let { project: initialProject, parent }: { project?: string; parent?: string } = $props();
  const t = $derived(i18n.t);

  const activeProjects = $derived(store.projectList.filter((p) => p.status !== 'archived'));
  const parentIssue = $derived(parent ? store.byIdentifier.get(parent.toUpperCase()) : undefined);

  let project = $state(startProject());
  let title = $state('');
  let description = $state('');
  let fields = $state({ status: 'todo' as Status, priority: 0, labels: [] as string[], due_date: null as string | null });
  let picking = $state(false);
  let busy = $state(false);
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
      router.go(`/i/${created.identifier}`, true);
    } catch (err) {
      store.handleError(err);
      error = `${t.saveFailed}: ${(err as Error).message}`;
    } finally {
      busy = false;
    }
  }
</script>

<form class="page plain" onsubmit={submit} aria-label={t.newIssue}>
  <header class="bar">
    <button type="button" class="text-btn" onclick={() => router.back(project ? `/p/${project}` : '/')}>{t.cancel}</button>
    <h1>{t.newIssue}</h1>
    <button type="submit" class="text-btn strong" disabled={busy || !title.trim() || !project}>{t.create}</button>
  </header>

  {#if parent}
    <div class="parent">
      <Icon name="parent" size={14} />
      <span class="muted">{t.parent}</span>
      <b class="mono">{parent.toUpperCase()}</b>
      {#if parentIssue}<span class="ellipsis">{parentIssue.title}</span>{/if}
    </div>
  {/if}

  <div class="field">
    <label for="title">{t.title}</label>
    <input
      id="title"
      class="input big"
      bind:value={title}
      required
      autocomplete="off"
      enterkeyhint="done"
      {@attach (el) => el.focus()}
    />
  </div>
  <div class="field">
    <label for="desc">{t.descriptionHint}</label>
    <textarea id="desc" class="input" rows="5" bind:value={description} placeholder={t.descriptionPlaceholder}></textarea>
  </div>

  <div class="chips">
    <button type="button" class="chip strong" onclick={() => (picking = true)} disabled={!!parent}>
      {#if store.projects[project]}
        <span class="mono key">{project}</span>{store.projects[project].name}
      {:else}
        {t.chooseProject}
      {/if}
    </button>
  </div>
  <IssueFields {...fields} onchange={(p) => (fields = { ...fields, ...p })} />

  {#if nextId}<p class="hint next">{t.willCreateAs(nextId)}</p>{/if}
  {#if !activeProjects.length && store.loaded}<p class="hint">{t.noProjects}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</form>

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
  .text-btn.strong {
    font-weight: 700;
  }
  .text-btn:disabled {
    opacity: 0.4;
  }
  .big {
    font-size: 18px;
    font-weight: 600;
  }
  .chips {
    margin-bottom: 8px;
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
  .next {
    margin-top: 16px;
  }
  .error {
    color: var(--danger);
    font-size: 14px;
  }
</style>
