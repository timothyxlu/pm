<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { api, type GithubStatus, type Token } from '../lib/api';
  import { fmtAgo, i18n, type LangPref } from '../lib/i18n.svelte';
  import { media } from '../lib/media.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { theme, type ThemePref } from '../lib/theme.svelte';

  const t = $derived(i18n.t);
  let email = $state<string | null>(null);
  let tokens = $state<Token[] | null>(null);
  let newName = $state('');
  let created = $state<string | null>(null);
  let copied = $state(false);
  let error = $state('');

  api
    .me()
    .then((m) => (email = m.principal.email ?? null))
    .catch(() => {});
  async function loadTokens() {
    try {
      tokens = (await api.tokens()).filter((x) => !x.revoked_at);
    } catch (e) {
      store.handleError(e);
    }
  }
  loadTokens();

  async function createToken(e: SubmitEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    error = '';
    try {
      const res = await api.createToken(name);
      created = res.token;
      copied = false;
      newName = '';
      loadTokens();
    } catch (err) {
      store.handleError(err);
      error = (err as Error).message;
    }
  }
  async function revoke(id: string) {
    try {
      await api.revokeToken(id);
      loadTokens();
    } catch (err) {
      store.handleError(err);
      error = (err as Error).message;
    }
  }
  async function copy() {
    if (!created) return;
    await navigator.clipboard?.writeText(created);
    copied = true;
  }

  // ----- GitHub App -----
  let gh = $state<GithubStatus | null>(null);
  let ghBusy = $state(false);
  let ghNotice = $state('');
  let ghError = $state('');
  let ghConfirm = $state(false);

  // Back from GitHub: /settings?github=installed or ?github=error&message=…
  {
    const q = new URLSearchParams(location.search);
    const r = q.get('github');
    if (r === 'installed') ghNotice = t.githubInstalledToast;
    if (r === 'error') ghError = t.githubError(q.get('message') ?? '');
    if (r) history.replaceState(history.state, '', location.pathname);
  }
  let ghRepos = $state<Awaited<ReturnType<typeof api.githubRepos>> | null>(null);
  let ghReposFailed = $state(false);
  async function loadGithub() {
    try {
      gh = await api.github();
      if (gh.connected) {
        api
          .githubRepos()
          .then((r) => (ghRepos = r))
          .catch(() => (ghReposFailed = true));
      }
    } catch (e) {
      store.handleError(e);
    }
  }
  loadGithub();

  // GitHub's manifest flow wants a top-level form POST to github.com.
  async function connectGithub() {
    ghBusy = true;
    ghError = '';
    try {
      const { action, manifest } = await api.githubManifest();
      const form = document.createElement('form');
      form.method = 'post';
      form.action = action;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'manifest';
      input.value = JSON.stringify(manifest);
      form.append(input);
      document.body.append(form);
      form.submit();
    } catch (e) {
      store.handleError(e);
      ghError = (e as Error).message;
      ghBusy = false;
    }
  }
  async function disconnectGithub() {
    if (!ghConfirm) {
      ghConfirm = true;
      return;
    }
    ghConfirm = false;
    try {
      gh = await api.disconnectGithub();
      ghRepos = null;
      ghNotice = t.githubDisconnected;
    } catch (e) {
      store.handleError(e);
      ghError = (e as Error).message;
    }
  }

  const langs: { v: LangPref; label: () => string; sub?: () => string }[] = [
    { v: 'system', label: () => t.followSystem, sub: () => t.currentLang(i18n.systemLang === 'zh' ? '中文' : 'English') },
    { v: 'zh', label: () => '中文' },
    { v: 'en', label: () => 'English' },
  ];
  const themes: ThemePref[] = ['system', 'light', 'dark'];
</script>

{#if media.desktop}<header class="dhead"><h1>{t.settings}</h1></header>{/if}
<div class="page plain">
  {#if !media.desktop}
    <header class="topbar">
      <button class="icon-btn" onclick={() => router.back('/')} aria-label={t.back}><Icon name="back" /></button>
      <h1>{t.settings}</h1>
    </header>
  {/if}

  <fieldset>
    <legend class="section-title">{t.language}</legend>
    <div class="list">
      {#each langs as l}
        <label class="radio">
          <input type="radio" name="lang" value={l.v} checked={i18n.pref === l.v} onchange={() => i18n.setPref(l.v)} />
          <span class="lbl">
            <span>{l.label()}</span>
            {#if l.sub}<span class="sub">{l.sub()}</span>{/if}
          </span>
        </label>
      {/each}
    </div>
    <p class="hint note">{t.langNote}</p>
  </fieldset>

  <fieldset>
    <legend class="section-title">{t.appearance}</legend>
    <div class="seg" role="group" aria-label={t.appearance}>
      {#each themes as th}
        <button aria-pressed={theme.pref === th} onclick={() => theme.set(th)}>
          {th === 'system' ? t.followSystem : th === 'light' ? t.light : t.dark}
        </button>
      {/each}
    </div>
  </fieldset>

  <section>
    <h2 class="section-title">{t.connections} · {t.github}</h2>
    {#if gh}
      <div class="list">
        <div class="tokrow">
          <Icon name="github" size={20} />
          <div class="tokinfo">
            {#if gh.connected && gh.app}
              <span>{t.githubApp(gh.app.name)}</span>
              <span class="sub" class:warn={!gh.installed && !ghRepos?.selection}>
                {#if ghRepos?.selection === 'all'}{t.githubAllRepos(ghRepos.repos.length)}
                {:else if ghRepos?.selection}{t.githubSomeRepos(ghRepos.repos.length)}
                {:else if ghReposFailed}{t.githubReposError}
                {:else}{gh.installed ? t.githubInstalled : t.githubNotInstalled}{/if}
              </span>
            {:else}
              <span>GitHub</span>
              <span class="sub">{t.githubNote}</span>
            {/if}
          </div>
          {#if gh.connected && gh.app}
            <a class="btn" class:primary={!gh.installed} href={gh.installed && gh.installation_url ? gh.installation_url : gh.app.install_url} target="_blank" rel="noopener">
              {gh.installed ? t.githubManageRepos : t.githubInstall}
            </a>
          {:else}
            <button class="btn primary" onclick={connectGithub} disabled={ghBusy}>{ghBusy ? t.githubConnecting : t.connectGithub}</button>
          {/if}
        </div>
        {#each ghRepos?.repos ?? [] as r (r.full_name)}
          <a class="reporow" href={r.html_url} target="_blank" rel="noopener">
            <span>{r.full_name}</span>
            {#if r.private}<Icon name="lock" size={14} />{/if}
          </a>
        {/each}
      </div>
      {#if gh.connected && gh.app}
        <div class="ghlinks">
          <a class="hint" href={gh.app.settings_url} target="_blank" rel="noopener">{t.githubAppSettings}</a>
          <button class="linkbtn" onclick={disconnectGithub} onblur={() => (ghConfirm = false)}>
            {ghConfirm ? t.githubDisconnectConfirm : t.githubDisconnect}
          </button>
        </div>
      {/if}
    {/if}
    {#if ghNotice}<p class="hint note">{ghNotice}</p>{/if}
    {#if ghError}<p class="error">{ghError}</p>{/if}
  </section>

  <section>
    <h2 class="section-title">{t.connections} · {t.apiTokens}</h2>
    <p class="hint note top">{t.tokensNote}</p>
    {#if created}
      <div class="card created">
        <span class="hint">{t.tokenOnce}</span>
        <code class="token">{created}</code>
        <div class="row">
          <button class="btn" onclick={() => (created = null)}><Icon name="x" size={16} /></button>
          <button class="btn primary" onclick={copy}>{copied ? t.copied : t.copy}</button>
        </div>
      </div>
    {/if}
    {#if tokens?.length}
      <div class="list">
        {#each tokens as tk (tk.id)}
          <div class="tokrow">
            <div class="tokinfo">
              <span>{tk.name}</span>
              <span class="sub">{tk.last_used_at ? t.lastUsed(fmtAgo(tk.last_used_at)) : t.neverUsed}</span>
            </div>
            <button class="btn danger" onclick={() => revoke(tk.id)}>{t.revoke}</button>
          </div>
        {/each}
      </div>
    {/if}
    <form class="newtok" onsubmit={createToken}>
      <input class="input" bind:value={newName} placeholder={t.tokenName} aria-label={t.tokenName} autocomplete="off" />
      <button class="btn primary" disabled={!newName.trim()}>{t.createToken}</button>
    </form>
    {#if error}<p class="error">{error}</p>{/if}
  </section>

  {#if email}<p class="hint footer">{t.signedInAs(email)}</p>{/if}
</div>

<style>
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }
  legend {
    padding: 0;
  }
  fieldset + fieldset,
  fieldset + section {
    margin-top: 24px;
  }
  .radio {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 0 14px;
  }
  .radio + .radio {
    border-top: 1px solid var(--line);
  }
  .radio input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent);
    margin: 0;
  }
  .lbl {
    display: flex;
    flex-direction: column;
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
  }
  .note {
    margin: 8px 2px 0;
  }
  .note.top {
    margin: -2px 2px 10px;
  }
  .seg {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 3px;
  }
  .seg button {
    flex: 1;
    height: 40px;
    border: 0;
    background: transparent;
    border-radius: 9px;
    font-weight: 600;
    font-size: 14px;
    color: var(--muted);
  }
  .seg button[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .created {
    padding: 14px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .token {
    font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--surface-2);
    padding: 10px;
    border-radius: 8px;
    word-break: break-all;
    user-select: all;
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .tokrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 8px 8px 14px;
  }
  .tokrow + .tokrow {
    border-top: 1px solid var(--line);
  }
  .tokinfo {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .newtok {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .newtok .input {
    flex: 1;
    min-width: 0;
  }
  .error {
    color: var(--danger);
    font-size: 14px;
  }
  section + section {
    margin-top: 24px;
  }
  .ghlinks {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 2px 0;
    font-size: 13px;
  }
  .warn {
    color: var(--danger);
  }
  .reporow {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px 10px 46px;
    border-top: 1px solid var(--line);
    font-size: 14px;
    color: var(--text);
    text-decoration: none;
  }
  .reporow :global(svg) {
    color: var(--muted);
  }
  .linkbtn {
    border: 0;
    background: none;
    padding: 4px 2px;
    font-size: 13px;
    color: var(--danger);
  }
  a.btn {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    white-space: nowrap;
  }
  .footer {
    margin-top: 32px;
    text-align: center;
  }
</style>
