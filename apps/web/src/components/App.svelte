<!-- components/App.svelte -->
<script>
  import Editor from './Editor.svelte';
  import MarginNote from './MarginNote.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
</script>

<div class="app" data-theme="light">
  <header class="app-header">
    <h1>Glossly</h1>
    <button class="settings-toggle" aria-label="Toggle settings">
      ⚙️
    </button>
  </header>
  
  <main class="app-main">
    <Editor />
    <MarginNote />
  </main>
  
  <aside class="settings-sidebar">
    <SettingsPanel />
  </aside>
</div>

<style>
.app {
  font-family: system-ui, sans-serif;
  min-height: 100vh;
  display: grid;
  grid-template-areas: 'header header' 'main settings';
  grid-template-columns: 1fr 300px;
  gap: 1rem;
  padding: 1rem;
}

.app-header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f8f8;
  border-radius: 8px;
}

.app-main {
  grid-area: main;
  position: relative;
  min-height: 500px;
  background: #fff;
  border-radius: 8px;
  padding: 2rem;
}

.settings-sidebar {
  grid-area: settings;
  min-height: 500px;
}

@media (max-width: 900px) {
  .app {
    grid-template-areas: 'header' 'main' 'settings';
    grid-template-columns: 1fr;
  }
  
  .settings-sidebar {
    margin-top: 1rem;
  }
}
</style>
