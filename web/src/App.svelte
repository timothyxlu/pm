<script lang="ts">
  import Banner from './components/Banner.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import Palette from './components/Palette.svelte';
  import QuickStatus from './components/QuickStatus.svelte';
  import ShortcutHelp from './components/ShortcutHelp.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import { keys } from './lib/keys.svelte';
  import { media } from './lib/media.svelte';
  import { router, type Route } from './lib/router.svelte';
  import Active from './pages/Active.svelte';
  import Home from './pages/Home.svelte';
  import IssuePage from './pages/Issue.svelte';
  import NewIssue from './pages/NewIssue.svelte';
  import ProjectPage from './pages/Project.svelte';
  import Search from './pages/Search.svelte';
  import Settings from './pages/Settings.svelte';

  const r = $derived(router.route);
  const withNav = $derived(['home', 'active', 'search', 'project'].includes(r.name));

  // On wide screens "new issue" opens as a dialog over the page you were on.
  let behind = $state<Route>(router.route.name === 'new' ? { name: 'home' } : router.route);
  $effect(() => {
    if (r.name !== 'new') behind = r;
  });
  const modal = $derived(media.desktop && r.name === 'new');
  const page = $derived(modal ? behind : r);
</script>

<svelte:document onkeydown={keys.handle} />

<div class="shell" class:desktop={media.desktop}>
  {#if media.desktop}<Sidebar />{/if}
  <main>
    <Banner />
    {#if page.name === 'home'}
      <Home />
    {:else if page.name === 'active'}
      <Active />
    {:else if page.name === 'search'}
      <Search />
    {:else if page.name === 'settings'}
      <Settings />
    {:else if page.name === 'project'}
      {#key page.key}<ProjectPage key={page.key} />{/key}
    {:else if page.name === 'issue'}
      {#key page.id}<IssuePage id={page.id} />{/key}
    {:else if page.name === 'new'}
      <NewIssue project={page.project} parent={page.parent} />
    {:else}
      <Home />
    {/if}
  </main>
  {#if modal && r.name === 'new'}
    {#key `${r.project}|${r.parent}`}<NewIssue project={r.project} parent={r.parent} modal />{/key}
  {/if}
  {#if withNav && !media.desktop}<BottomNav />{/if}
</div>

<Palette />
<QuickStatus />
<ShortcutHelp />
