<script lang="ts">
  import { api, type Project } from '../lib/api';
  import { i18n } from '../lib/i18n.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import Sheet from './Sheet.svelte';

  // Create a project, or edit one when `project` is given.
  let { open = $bindable(false), project }: { open: boolean; project?: Project } = $props();
  const t = $derived(i18n.t);

  let key = $state('');
  let name = $state('');
  let description = $state('');
  let status = $state<Project['status']>('active');
  let repos = $state('');
  let error = $state('');
  let busy = $state(false);

  $effect(() => {
    if (!open) return;
    key = project?.key ?? '';
    name = project?.name ?? '';
    description = project?.description ?? '';
    status = project?.status ?? 'active';
    repos = project?.github_repos.join('\n') ?? '';
    error = '';
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      status,
      github_repos: repos
        .split(/[\n,]/)
        .map((r) => r.trim())
        .filter(Boolean),
    };
    try {
      if (project) await api.updateProject(project.key, input);
      else await api.createProject({ ...input, key: key.trim().toUpperCase() });
      await store.sync();
      open = false;
      if (!project) router.go(`/p/${key.trim().toUpperCase()}`);
    } catch (err) {
      store.handleError(err);
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<Sheet bind:open title={project ? t.editProject : t.newProject}>
  <form onsubmit={submit}>
    {#if !project}
      <div class="field">
        <label for="pkey">{t.key}</label>
        <input
          id="pkey"
          class="input mono"
          bind:value={key}
          required
          pattern={'[A-Za-z][A-Za-z0-9]{0,9}'}
          autocapitalize="characters"
          autocomplete="off"
          maxlength="10"
        />
        <span class="hint">{t.keyHint}</span>
      </div>
    {/if}
    <div class="field">
      <label for="pname">{t.name}</label>
      <input id="pname" class="input" bind:value={name} required autocomplete="off" />
    </div>
    <div class="field">
      <label for="pdesc">{t.description}</label>
      <textarea id="pdesc" class="input" rows="2" bind:value={description}></textarea>
    </div>
    {#if project}
      <div class="field">
        <span class="label">{t.status}</span>
        <div class="seg" role="group">
          {#each ['active', 'paused', 'archived'] as const as s}
            <button type="button" aria-pressed={status === s} onclick={() => (status = s)}>{t.projectStatus[s]}</button>
          {/each}
        </div>
      </div>
    {/if}
    <div class="field">
      <label for="prepos">{t.githubRepos}</label>
      <textarea id="prepos" class="input mono" rows="2" bind:value={repos} autocapitalize="off" spellcheck="false"></textarea>
      <span class="hint">{t.githubReposHint}</span>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="actions">
      <button type="button" class="btn" onclick={() => (open = false)}>{t.cancel}</button>
      <button type="submit" class="btn primary" disabled={busy}>{project ? t.save : t.create}</button>
    </div>
  </form>
</Sheet>

<style>
  .actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .error {
    color: var(--danger);
    font-size: 14px;
  }
  .seg {
    display: flex;
    background: var(--surface-2);
    border-radius: 12px;
    padding: 3px;
  }
  .seg button {
    flex: 1;
    height: 38px;
    border: 0;
    background: transparent;
    border-radius: 9px;
    font-weight: 600;
    font-size: 14px;
    color: var(--muted);
  }
  .seg button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
</style>
