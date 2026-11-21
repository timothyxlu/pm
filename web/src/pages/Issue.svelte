<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import IssueFields from '../components/IssueFields.svelte';
  import Sheet from '../components/Sheet.svelte';
  import StatusIcon from '../components/StatusIcon.svelte';
  import { api, ApiError, type IssueDetail, type Status } from '../lib/api';
  import { fmtAgo, i18n } from '../lib/i18n.svelte';
  import { renderMarkdown } from '../lib/markdown';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  let { id }: { id: string } = $props();
  const t = $derived(i18n.t);

  // Render the cached copy at once; the full issue (comments, activity,
  // GitHub links) arrives from the server.
  const cached = $derived(store.byIdentifier.get(id));
  let detail = $state<IssueDetail | null>(null);
  let notFound = $state(false);
  let error = $state('');

  const view = $derived({
    title: detail?.title ?? cached?.title ?? '',
    description: detail?.description ?? cached?.description ?? null,
    status: (detail?.status ?? cached?.status ?? 'todo') as Status,
    priority: detail?.priority ?? cached?.priority ?? 0,
    labels: detail?.labels ?? cached?.labels ?? [],
    due_date: detail?.due_date ?? cached?.due_date ?? null,
    project: detail?.project ?? cached?.project ?? id.split('-')[0],
  });
  const parent = $derived(
    detail ? detail.parent : cached?.parent_id ? (store.issues[cached.parent_id] ?? null) : null,
  );
  const children = $derived(
    detail?.children ?? (cached ? (store.childrenOf.get(cached.id) ?? []) : []),
  );
  const projectName = $derived(detail?.project_name ?? store.projects[view.project]?.name ?? view.project);

  async function load() {
    try {
      detail = await api.issue(id);
      notFound = false;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) notFound = true;
      else store.handleError(e);
    }
  }
  load();

  async function update(patch: Record<string, unknown>) {
    error = '';
    // Show the change right away; the server's answer replaces it.
    const { parent: _parent, ...shown } = patch;
    if (detail) detail = { ...detail, ...(shown as Partial<IssueDetail>) };
    try {
      detail = await api.updateIssue(id, patch);
      store.sync();
    } catch (e) {
      store.handleError(e);
      error = `${t.saveFailed}: ${(e as Error).message}`;
      load();
    }
  }

  // ----- title -----
  let editingTitle = $state(false);
  let titleDraft = $state('');
  function startTitle() {
    titleDraft = view.title;
    editingTitle = true;
  }
  function saveTitle() {
    editingTitle = false;
    const v = titleDraft.trim();
    if (v && v !== view.title) update({ title: v });
  }

  // ----- description -----
  let editingDesc = $state(false);
  let descDraft = $state('');
  function startDesc() {
    descDraft = view.description ?? '';
    editingDesc = true;
  }
  function saveDesc() {
    editingDesc = false;
    const v = descDraft.trim();
    if (v !== (view.description ?? '')) update({ description: v || null });
  }

  // ----- comments -----
  let comment = $state('');
  let sending = $state(false);
  async function send(e: SubmitEvent) {
    e.preventDefault();
    const body = comment.trim();
    if (!body) return;
    sending = true;
    try {
      await api.comment(id, body);
      comment = '';
      await load();
    } catch (err) {
      store.handleError(err);
      error = `${t.saveFailed}: ${(err as Error).message}`;
    } finally {
      sending = false;
    }
  }

  // ----- more menu -----
  let menu = $state(false);
  let confirmDelete = $state(false);
  let parentPicker = $state(false);
  let parentFilter = $state('');
  const parentCandidates = $derived.by(() => {
    const q = parentFilter.trim().toLowerCase();
    // Exclude this issue and its descendants (the server rejects cycles too).
    const blocked = new Set<string>();
    const self = cached;
    if (self) {
      const stack = [self.id];
      while (stack.length) {
        const x = stack.pop()!;
        blocked.add(x);
        for (const k of store.childrenOf.get(x) ?? []) stack.push(k.id);
      }
    }
    return store.live
      .filter((i) => i.project === view.project && !blocked.has(i.id) && i.status !== 'canceled')
      .filter((i) => !q || i.title.toLowerCase().includes(q) || i.identifier.toLowerCase().includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 30);
  });

  async function remove() {
    confirmDelete = false;
    try {
      await api.deleteIssue(id);
      await store.sync();
      router.back(`/p/${view.project}`);
    } catch (e) {
      store.handleError(e);
      error = `${t.saveFailed}: ${(e as Error).message}`;
    }
  }

  // ----- timeline -----
  type Entry = { kind: 'comment' | 'activity'; actor: string; created_at: string; body?: string; action?: string; data?: any };
  const timeline = $derived.by<Entry[]>(() => {
    if (!detail) return [];
    const entries: Entry[] = [
      ...detail.comments.map((c) => ({ kind: 'comment' as const, ...c })),
      ...detail.activity.filter((a) => a.action !== 'commented').map((a) => ({ kind: 'activity' as const, ...a })),
    ];
    return entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
  });

  function describe(e: Entry) {
    if (e.action === 'updated' && e.data && typeof e.data === 'object') {
      const parts = Object.entries(e.data as Record<string, { to: unknown }>).map(([field, ch]) => {
        if (field === 'status' && typeof ch?.to === 'string') return `${t.fields.status} → ${t.statuses[ch.to] ?? ch.to}`;
        if (field === 'priority' && typeof ch?.to === 'number') return `${t.fields.priority} → ${t.priorities[ch.to]}`;
        return t.fields[field] ?? field;
      });
      return `${t.actions.updated} ${parts.join(i18n.lang === 'zh' ? '、' : ', ')}`;
    }
    if (e.action === 'linked_github' && e.data) return `${t.actions.linked_github} ${e.data.repo}#${e.data.number}`;
    return t.actions[e.action ?? ''] ?? e.action ?? '';
  }
  const initial = (actor: string) => (t.actors[actor] ?? actor).slice(0, 1).toUpperCase();
</script>

<div class="page plain issue">
  <header class="topbar">
    <button class="icon-btn" onclick={() => router.back(`/p/${view.project}`)} aria-label={t.back}><Icon name="back" /></button>
    <a class="crumb" href={`/p/${view.project}`}>{projectName} · {id}</a>
    <button class="icon-btn" onclick={() => (menu = true)} aria-label={t.moreActions}><Icon name="more" size={20} /></button>
  </header>

  {#if notFound && !cached}
    <p class="empty">{t.notFound}</p>
  {:else if !cached && !detail}
    <p class="empty">{t.loading}</p>
  {:else}
    {#if parent}
      <a class="parent" href={`/i/${parent.identifier}`}>
        <Icon name="parent" size={14} />
        <span class="muted">{t.parent}</span>
        <span class="pid mono">{parent.identifier}</span>
        <span class="ptitle">{parent.title}</span>
      </a>
    {/if}

    {#if editingTitle}
      <textarea
        class="input title-input"
        bind:value={titleDraft}
        rows="2"
        aria-label={t.title}
        onblur={saveTitle}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
          }
          if (e.key === 'Escape') editingTitle = false;
        }}
        {@attach (el) => el.focus()}
      ></textarea>
    {:else}
      <h1 class="title"><button class="plain-btn" onclick={startTitle}>{view.title}</button></h1>
    {/if}

    <IssueFields status={view.status} priority={view.priority} labels={view.labels} due_date={view.due_date} onchange={update} />

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <section class="desc">
      {#if editingDesc}
        <textarea class="input" rows="8" bind:value={descDraft} aria-label={t.description} {@attach (el) => el.focus()}></textarea>
        <div class="row-actions">
          <button class="btn" onclick={() => (editingDesc = false)}>{t.cancel}</button>
          <button class="btn primary" onclick={saveDesc}>{t.save}</button>
        </div>
      {:else if view.description}
        <div class="md">{@html renderMarkdown(view.description)}</div>
        <button class="link" onclick={startDesc}><Icon name="edit" size={14} />{t.edit}</button>
      {:else}
        <button class="placeholder" onclick={startDesc}>{t.addDescription}</button>
      {/if}
    </section>

    <section>
      <div class="sec-head">
        <h2 class="section-title">{t.subIssues}{children.length ? ` · ${children.filter((c) => c.status === 'done').length}/${children.length}` : ''}</h2>
        <a class="link" href={`/new?project=${view.project}&parent=${id}`}>+ {t.add}</a>
      </div>
      {#if children.length}
        <div class="list">
          {#each children as c (c.identifier)}
            <a class="sub" href={`/i/${c.identifier}`}>
              <StatusIcon status={c.status} />
              <span class="pid mono">{c.identifier}</span>
              <span class="ptitle">{c.title}</span>
            </a>
          {/each}
        </div>
      {:else}
        <p class="none">{t.noneYet}</p>
      {/if}
    </section>

    {#if detail?.github.length}
      <section>
        <h2 class="section-title">GitHub</h2>
        <div class="list">
          {#each detail.github as g}
            <a class="sub" href={g.url} target="_blank" rel="noopener noreferrer">
              <Icon name="github" size={16} />
              <span class="pid mono">{g.repo}#{g.number}</span>
              <span class="ptitle">{g.title ?? ''}</span>
              {#if g.state}<span class="tag">{g.state}</span>{/if}
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h2 class="section-title">{t.activity}</h2>
      <ol class="timeline">
        {#each timeline as e}
          <li class:comment={e.kind === 'comment'}>
            <span class="avatar" data-actor={e.actor}>{initial(e.actor)}</span>
            <div class="entry">
              {#if e.kind === 'comment'}
                <div class="who"><b>{t.actors[e.actor] ?? e.actor}</b> <span class="when">{fmtAgo(e.created_at)}</span></div>
                <div class="md bubble">{@html renderMarkdown(e.body ?? '')}</div>
              {:else}
                <span><b>{t.actors[e.actor] ?? e.actor}</b> {describe(e)}</span>
                <span class="when">{fmtAgo(e.created_at)}</span>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</div>

{#if cached || detail}
  <form class="composer" onsubmit={send}>
    <label for="comment" class="sr-only">{t.comment}</label>
    <textarea
      id="comment"
      rows="1"
      bind:value={comment}
      placeholder={t.writeComment}
      onkeydown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
      }}
    ></textarea>
    <button class="send" aria-label={t.send} disabled={sending || !comment.trim()}><Icon name="send" size={18} /></button>
  </form>
{/if}

<Sheet bind:open={menu}>
  <div class="menu">
    <button
      onclick={() => {
        menu = false;
        parentFilter = '';
        parentPicker = true;
      }}><Icon name="parent" size={18} />{t.setParent}</button
    >
    {#if parent}
      <button
        onclick={() => {
          menu = false;
          update({ parent: null });
        }}><Icon name="x" size={18} />{t.removeParent}</button
      >
    {/if}
    <button
      onclick={() => {
        menu = false;
        navigator.clipboard?.writeText(id);
      }}><Icon name="check" size={18} />{t.copyLink}</button
    >
    <button
      class="danger"
      onclick={() => {
        menu = false;
        confirmDelete = true;
      }}><Icon name="x" size={18} />{t.deleteIssue}</button
    >
  </div>
</Sheet>

<Sheet bind:open={parentPicker} title={t.setParent}>
  <div class="field"><input class="input" bind:value={parentFilter} placeholder={t.filterIssues} aria-label={t.filterIssues} /></div>
  <div class="menu">
    {#each parentCandidates as c (c.id)}
      <button
        onclick={() => {
          parentPicker = false;
          update({ parent: c.identifier });
        }}
      >
        <StatusIcon status={c.status} />
        <span class="pid mono">{c.identifier}</span>
        <span class="ptitle">{c.title}</span>
      </button>
    {:else}
      <p class="none">{t.noResults}</p>
    {/each}
  </div>
</Sheet>

<Sheet bind:open={confirmDelete} title={t.deleteConfirm(id)}>
  <div class="row-actions">
    <button class="btn" onclick={() => (confirmDelete = false)}>{t.cancel}</button>
    <button class="btn primary danger-fill" onclick={remove}>{t.delete}</button>
  </div>
</Sheet>

<style>
  .issue {
    padding-bottom: calc(var(--safe-b) + 96px);
  }
  .crumb {
    flex: 1;
    font-size: 14px;
    color: var(--muted);
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .parent {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--ink);
    font-size: 13px;
    margin: 4px 0 8px;
  }
  .parent :global(svg) {
    color: var(--muted);
    flex-shrink: 0;
  }
  .muted {
    color: var(--muted);
  }
  .pid {
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }
  .ptitle {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .title {
    margin: 4px 0 14px;
    font-size: 24px;
    line-height: 1.3;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .plain-btn {
    all: unset;
    cursor: text;
    overflow-wrap: anywhere;
  }
  .title-input {
    font-size: 20px;
    font-weight: 700;
    margin: 4px 0 14px;
  }
  .error {
    color: var(--danger);
    font-size: 14px;
  }
  .desc {
    margin-top: 18px;
  }
  .placeholder {
    width: 100%;
    text-align: left;
    border: 1px dashed var(--line-strong);
    border-radius: 12px;
    background: transparent;
    color: var(--muted);
    min-height: 48px;
    padding: 0 14px;
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    background: transparent;
    color: var(--accent-text);
    font-size: 13px;
    font-weight: 600;
    min-height: 44px;
    padding: 0;
  }
  .row-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 10px;
  }
  .sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sec-head .section-title {
    margin-bottom: 0;
  }
  .none {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .sub {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    color: var(--ink);
    font-size: 14px;
  }
  .sub + .sub {
    border-top: 1px solid var(--line);
  }
  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .timeline li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 14px;
  }
  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .avatar[data-actor='claude'] {
    background: #f3e8d8;
    color: #92400e;
  }
  .avatar[data-actor='github'] {
    background: var(--surface-2);
    color: var(--ink);
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .entry b {
    font-weight: 600;
  }
  .when {
    font-size: 12px;
    color: var(--muted);
  }
  .bubble {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
    margin-top: 4px;
  }
  .composer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding: 10px max(12px, calc(50vw - 308px)) calc(10px + var(--safe-b));
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .composer textarea {
    flex: 1;
    min-height: 44px;
    max-height: 160px;
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 11px 16px;
    font-size: 16px;
    background: var(--surface-2);
    resize: none;
    field-sizing: content;
  }
  .send {
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 22px;
    background: var(--accent);
    color: var(--accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .send:disabled {
    opacity: 0.4;
  }
  .menu {
    display: flex;
    flex-direction: column;
  }
  .menu button {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 0 4px;
    border-radius: 10px;
    font-size: 15px;
  }
  .menu button:active {
    background: var(--surface-2);
  }
  .menu .danger {
    color: var(--danger);
  }
  .danger-fill {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }
</style>
