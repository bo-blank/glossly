<!-- components/App.svelte -->
<script>
  import { onMount } from 'svelte';
  import Editor from './Editor.svelte';
  import MarginNote from './MarginNote.svelte';
  import SettingsPanel from './SettingsPanel.svelte';

  let settingsOpen = $state(false);
  let settingsPanel;

  onMount(() => {
    const handleClick = (e) => {
      if (settingsOpen && settingsPanel && !settingsPanel.contains(e.target)) {
        settingsOpen = false;
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  });
</script>

<div class="min-h-screen p-4" data-theme="light">
  <header class="flex justify-between items-center p-4 rounded-xl bg-base-200">
    <h1 class="text-2xl font-bold">Glossly</h1>
    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Toggle settings"
      onclick={(e) => {
        e.stopPropagation();
        settingsOpen = !settingsOpen;
      }}
    >
      ⚙️
    </button>
  </header>
  
  <main class="relative min-h-[500px] bg-base-100 rounded-xl p-8">
    <Editor />
    <MarginNote />
  </main>
  
  <div class="fixed top-0 right-0 z-[100]" bind:this={settingsPanel}>
    <div
      class="fixed top-0 right-0 h-screen w-72 md:w-96 bg-base-200 border-l border-base-300 overflow-y-auto transition-transform duration-200"
      class:translate-x-0={settingsOpen}
      class:translate-x-full={!settingsOpen}
      style="top: 5rem;"
    >
      <div class="flex items-center justify-between p-4 border-b border-base-300">
        <h2 class="text-lg font-bold">Settings</h2>
        <button
          class="btn btn-ghost btn-square btn-sm"
          aria-label="Close settings"
          onclick={() => settingsOpen = false}
        >
          ✕
        </button>
      </div>
      <div class="p-4">
        <SettingsPanel />
      </div>
    </div>
  </div>
</div>
