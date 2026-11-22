<script lang="ts">
  import { STATUSES } from '../lib/api';
  import { i18n } from '../lib/i18n.svelte';
  import { quick } from '../lib/quick.svelte';
  import OptionList from './OptionList.svelte';
  import Sheet from './Sheet.svelte';
  import StatusIcon from './StatusIcon.svelte';

  const t = $derived(i18n.t);
  const issue = $derived(quick.issue);
</script>

<Sheet open={!!issue} onclose={() => (quick.issue = null)} title={issue ? `${issue.identifier} · ${issue.title}` : ''}>
  {#if issue}
    <OptionList
      options={[...STATUSES]}
      selected={issue.status}
      onpick={(s) => {
        const target = issue;
        quick.issue = null;
        quick.setStatus(target, s);
      }}
    >
      {#snippet item(s)}<StatusIcon status={s} />{t.statuses[s]}{/snippet}
    </OptionList>
  {/if}
</Sheet>
