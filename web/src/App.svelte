<script lang="ts">
  import Banner from './components/Banner.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import { router } from './lib/router.svelte';
  import Active from './pages/Active.svelte';
  import Home from './pages/Home.svelte';
  import IssuePage from './pages/Issue.svelte';
  import NewIssue from './pages/NewIssue.svelte';
  import ProjectPage from './pages/Project.svelte';
  import Search from './pages/Search.svelte';
  import Settings from './pages/Settings.svelte';

  const r = $derived(router.route);
  const withNav = $derived(['home', 'active', 'search', 'project'].includes(r.name));
</script>

<Banner />
{#if r.name === 'home'}
  <Home />
{:else if r.name === 'active'}
  <Active />
{:else if r.name === 'search'}
  <Search />
{:else if r.name === 'settings'}
  <Settings />
{:else if r.name === 'project'}
  {#key r.key}<ProjectPage key={r.key} />{/key}
{:else if r.name === 'issue'}
  {#key r.id}<IssuePage id={r.id} />{/key}
{:else if r.name === 'new'}
  <NewIssue project={r.project} parent={r.parent} />
{:else}
  <Home />
{/if}
{#if withNav}<BottomNav />{/if}
