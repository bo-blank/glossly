<!-- components/App.svelte -->
<script>
  import { onMount } from 'svelte';
  import Dashboard from './Dashboard.svelte';
  import Editor from './Editor.svelte';
  import MarginNote from './MarginNote.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import TableOfContents from './TableOfContents.svelte';
  import { themeStore, toggleTheme } from '../stores/themeStore';

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

<div class="min-h-screen p-4">
  <div class="max-w-[640px] mx-auto flex flex-col gap-4">
    <header class="flex justify-between items-center p-4 rounded-xl bg-base-200">
      <h1 class="text-2xl font-bold">Glossly</h1>
      <div class="flex items-center gap-1">
        <button
          class="btn btn-ghost btn-square btn-sm"
          aria-label="Toggle theme"
          onclick={toggleTheme}
        >
          {#if $themeStore === 'dark'}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          {/if}
        </button>
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
      </div>
    </header>

    <main class="relative min-h-[500px] bg-base-100 rounded-xl py-8">
      <TableOfContents />
      <Editor />
      <MarginNote />
      <Dashboard />
    </main>
  </div>

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
