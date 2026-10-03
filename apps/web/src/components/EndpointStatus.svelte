<!-- components/EndpointStatus.svelte -->
<script lang="ts">
  import { classifyHost } from '@glossly/shared';
  import { settingsStore } from '../stores/settingsStore';
  import { settingsOpen } from '../stores/uiStore';

  // Shows the model endpoint, not the proxy: the proxy always runs on this
  // computer, the endpoint is where the text ends up. Only "local" is muted
  // like the rest of the footer; anything else has to stand out.
  let kind = $derived(classifyHost($settingsStore.endpointUrl));
  let host = $derived.by(() => {
    try {
      return new URL($settingsStore.endpointUrl).host;
    } catch {
      return '';
    }
  });

  const LABELS = {
    loopback: { text: 'local', tip: 'Your text stays on this computer.' },
    private: { text: 'network', tip: 'Your text leaves this computer but stays in your network.' },
    invalid: { text: 'invalid endpoint', tip: 'Glossly only talks to model servers on this computer or your network.' }
  } as const;
  let label = $derived(LABELS[kind ?? 'invalid']);
</script>

<button
  type="button"
  class="inline-flex items-center gap-1 min-w-0 max-w-full hover:underline focus-visible:opacity-100 hover:opacity-100"
  class:opacity-60={kind === 'loopback'}
  title={`${label.tip} Click to open settings.`}
  aria-label={`Model endpoint: ${label.text}${host ? ` at ${host}` : ''}. ${label.tip} Open settings.`}
  onclick={(e) => {
    // The App's outside-click handler would close the drawer again at once.
    e.stopPropagation();
    settingsOpen.set(true);
  }}
>
  {#if kind === 'loopback'}
    <span class="text-success" aria-hidden="true">●</span>
    <span>{label.text}</span>
  {:else}
    <!-- A badge, not coloured text: amber text on a light background is barely readable. -->
    <span class="badge badge-xs font-medium" class:badge-warning={kind === 'private'} class:badge-error={!kind}>{label.text}</span>
  {/if}
  {#if kind}
    <span class="truncate">· {host} · {$settingsStore.model}</span>
  {/if}
</button>
