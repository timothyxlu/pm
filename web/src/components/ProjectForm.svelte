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
  // Repos the GitHub App can see. null: not loaded or not connected → free text.
  let installed = $state<string[] | null>(null);
  let picked = $state<string[]>([]);
  let error = $state('');
  let busy = $state(false);

  $effect(() => {
    if (!open) return;
    key = project?.key ?? '';
    name = project?.name ?? '';
    description = project?.description ?? '';
    status = project?.status ?? 'active';
    repos = project?.github_repos.join('\n') ?? '';
    picked = [...(project?.github_repos ?? [])];
    error = '';
    api
      .githubRepos()
      .then((r) => (installed = r.repos.length ? r.repos.map((x) => x.full_name) : null))
      .catch(() => (installed = null));
  });

  // Installed repos first, then any bound repo the app can't see (kept so it isn't lost).
  const choices = $derived(installed ? [...installed, ...picked.filter((r) => !installed!.includes(r))] : []);
  function toggle(r: string) {
    picked = picked.includes(r) ? picked.filter((x) => x !== r) : [...picked, r];
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      status,
      github_repos: installed
        ? picked
        : repos
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
    {#if installed}
      <fieldset class="field">
        <legend class="label">{t.githubRepos}</legend>
        <div class="repos">
          {#each choices as r (r)}
            <label class="repo">
              <input type="checkbox" checked={picked.includes(r)} onchange={() => toggle(r)} />
              <span class="mono">{r}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {:else}
      <div class="field">
        <label for="prepos">{t.githubRepos}</label>
        <textarea id="prepos" class="input mono" rows="2" bind:value={repos} autocapitalize="off" spellcheck="false"></textarea>
        <span class="hint">{t.githubReposHint}</span>
      </div>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
    <div class="actions">
      <button type="button" class="btn" onclick={() => (open = false)}>{t.cancel}</button>
      <button type="submit" class="btn primary" disabled={busy}>{project ? t.save : t.create}</button>
    </div>
  </form>
</Sheet>

<style>
  fieldset {
    border: 0;
    margin-inline: 0;
    padding: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
  }
  .repos {
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
  }
  .repo {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    font-size: 14px;
  }
  .repo + .repo {
    border-top: 1px solid var(--line);
  }
  .repo input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--accent);
  }
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
