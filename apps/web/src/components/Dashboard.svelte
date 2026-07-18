<!-- components/Dashboard.svelte -->
<script>
  import { dashboardStore, aiLikenessStore } from '../stores/dashboardStore';
  import { editorStore } from '../stores/noteStore';
  import { analyzeAiLikeness } from '../dashboard/requestAiLikeness';

  const MIN_WORDS_FOR_ANALYSIS = 30;

  let canAnalyze = $derived($dashboardStore.words >= MIN_WORDS_FOR_ANALYSIS);
  let isStale = $derived(
    $aiLikenessStore.status === 'success' && $aiLikenessStore.analyzedWordCount !== $dashboardStore.words
  );

  function handleAnalyze() {
    const editor = $editorStore.editor;
    if (!editor || !canAnalyze) return;
    analyzeAiLikeness(editor.getText(), editor.storage.characterCount.words());
  }

  function formatMinutes(minutes) {
    if (minutes < 1) return '< 1 min read';
    return `${Math.round(minutes)} min read`;
  }

  function formatScore(score) {
    return score === null ? '—' : Math.round(score);
  }
</script>

<aside
  class="fixed top-24 hidden xl:block w-60 max-h-[70vh] overflow-y-auto text-sm space-y-4"
  style="right: max(1rem, calc(50% - 320px - 16rem));"
  aria-label="Document stats"
>
  <div>
    <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1.5">Stats</h3>
    <div class="flex flex-col gap-0.5 opacity-90">
      <div class="flex justify-between"><span>Words</span><span>{$dashboardStore.words}</span></div>
      <div class="flex justify-between"><span>Characters</span><span>{$dashboardStore.characters}</span></div>
      <div class="flex justify-between">
        <span>Reading time</span><span>{formatMinutes($dashboardStore.readingTimeMinutes)}</span>
      </div>
    </div>
  </div>

  <div>
    <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1.5">Readability</h3>
    {#if $dashboardStore.fleschReadingEase === null}
      <p class="opacity-60">Not enough text</p>
    {:else}
      <div class="flex flex-col gap-0.5 opacity-90">
        <div class="flex justify-between">
          <span>Flesch Reading Ease</span><span>{Math.round($dashboardStore.fleschReadingEase)}</span>
        </div>
        <div class="flex justify-between">
          <span>Grade level</span><span>{Math.round($dashboardStore.fleschKincaidGrade)}</span>
        </div>
      </div>
      <div class="badge badge-sm badge-outline mt-1.5">{$dashboardStore.readabilityLabel}</div>
    {/if}
  </div>

  <div>
    <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1.5">AI likeness</h3>

    {#if $aiLikenessStore.status === 'loading'}
      <div class="flex items-center gap-2 opacity-90">
        <span class="loading loading-spinner loading-xs"></span>
        <span>Analyzing…</span>
      </div>
    {:else if $aiLikenessStore.status === 'success'}
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center">
          <span class="font-medium">{$aiLikenessStore.label}</span>
          <span class="badge badge-sm">{formatScore($aiLikenessStore.score)}%</span>
        </div>
        <p class="opacity-70 text-xs leading-snug">{$aiLikenessStore.rationale}</p>
        {#if isStale}
          <p class="opacity-50 text-xs italic">Document changed since this analysis.</p>
        {/if}
        <button class="btn btn-xs btn-ghost btn-outline mt-1 self-start" onclick={handleAnalyze} disabled={!canAnalyze}>
          Re-analyze
        </button>
      </div>
    {:else}
      {#if $aiLikenessStore.status === 'error'}
        <p class="text-error text-xs mb-1.5">{$aiLikenessStore.error}</p>
      {/if}
      <button class="btn btn-xs btn-outline" onclick={handleAnalyze} disabled={!canAnalyze}>
        Analyze
      </button>
      {#if !canAnalyze}
        <p class="opacity-50 text-xs mt-1">Write at least {MIN_WORDS_FOR_ANALYSIS} words to analyze.</p>
      {/if}
    {/if}
  </div>
</aside>
