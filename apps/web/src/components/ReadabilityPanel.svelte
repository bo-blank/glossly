<!-- components/ReadabilityPanel.svelte -->
<script lang="ts">
  // How easy the text is to understand, and the barriers that make it hard,
  // measured against the yardstick of its text type (Hohenheim: specialist /
  // press texts or web texts). German gets the 0–20 comprehensibility index,
  // English Flesch Reading Ease. Labels follow the text's language.
  import { dashboardStore } from '../stores/dashboardStore';
  import { persistSettings, settingsStore } from '../stores/settingsStore';
  import { documentStore, setTextType } from '../storage/documentStore';
  import { textTypeFor } from '../editor/templates';
  import { BARRIER_LIMITS, MIN_WORDS_FOR_SCORE, TARGETS, type TextType } from '../utils/comprehensibility';
  import { labelForFleschScore } from '../utils/readability';

  const L = {
    de: {
      title: 'Verständlichkeit',
      score: 'Index',
      scoreHint: 'Angelehnt an den Hohenheimer Verständlichkeitsindex (0 = Dissertation, 20 = einfache Sprache); eigene Eichung, nicht der HIX selbst.',
      target: 'Ziel',
      type: { fach: 'Fachtext', web: 'Webtext' },
      typeHint: 'Fachtext: Ziel 12, höchstens 10 % lange Sätze. Webtext: Ziel 16, keine Sätze über 20 Wörter.',
      sentenceLength: 'Ø Satzlänge',
      wordsUnit: 'Wörter',
      longSentences: 'Lange Sätze',
      longSentencesHint: 'Sätze mit mehr als 20 Wörtern',
      longWords: 'Lange Wörter',
      longWordsHint: 'Wörter mit mehr als 16 Buchstaben',
      passive: 'Passiv',
      passiveHint: 'Sätze im Passiv (geschätzt)',
      of: 'von',
      max: 'max.',
      more: `Mehr Text nötig (ab ${MIN_WORDS_FOR_SCORE} Wörtern)`,
      details: 'Details',
      flagged: 'auffällig',
      empty: 'Noch kein Text'
    },
    en: {
      title: 'Readability',
      score: 'Flesch Reading Ease',
      scoreHint: 'Flesch Reading Ease, 0 (very hard) to 100 (very easy).',
      target: 'Target',
      type: { fach: 'Specialist', web: 'Web' },
      typeHint: 'Specialist: target 60, at most 10 % long sentences. Web: target 70, no sentence over 20 words.',
      sentenceLength: 'Avg. sentence',
      wordsUnit: 'words',
      longSentences: 'Long sentences',
      longSentencesHint: 'Sentences over 20 words',
      longWords: 'Long words',
      longWordsHint: 'Words over 16 letters',
      passive: 'Passive',
      passiveHint: 'Sentences in the passive voice (estimated)',
      of: 'of',
      max: 'max.',
      more: `More text needed (from ${MIN_WORDS_FOR_SCORE} words)`,
      details: 'Details',
      flagged: 'flagged',
      empty: 'No text yet'
    }
  };

  const r = $derived($dashboardStore);
  const t = $derived(L[r.language]);
  const doc = $derived($documentStore.documents.find((d) => d.id === $documentStore.activeId));
  const type = $derived(textTypeFor(doc));
  const target = $derived(TARGETS[r.language][type]);
  const limits = $derived(BARRIER_LIMITS[type]);
  const locale = $derived(r.language === 'de' ? 'de-DE' : 'en-US');

  const num = (n: number, digits = 1) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const percent = (n: number) => `${Math.round(n)} %`;

  // Missed target plus barriers over their limit: what the closed details would hide.
  const issues = $derived(
    (r.score !== null && r.score < target ? 1 : 0) +
      (r.barriers.longSentences.share > limits.longSentences ? 1 : 0) +
      (r.barriers.longWords.share > limits.longWords ? 1 : 0) +
      (r.barriers.passive.share > limits.passive ? 1 : 0)
  );

  function onToggle(e: Event) {
    const open = (e.currentTarget as HTMLDetailsElement).open;
    if (open === $settingsStore.readabilityDetails) return;
    settingsStore.update((s) => ({ ...s, readabilityDetails: open }));
    persistSettings($settingsStore);
  }

  function chooseType(next: TextType) {
    if (doc && next !== type) void setTextType(doc.id, next);
  }
</script>

<div>
  <h3 class="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1.5">{t.title}</h3>
  {#if r.words === 0}
    <p class="opacity-60">{t.empty}</p>
  {:else}
    <div class="flex flex-col gap-0.5 opacity-90">
      {#if r.score === null}
        <p class="opacity-60">{t.more}</p>
      {:else}
        <div class="flex justify-between" title={t.scoreHint}>
          <span>{t.score}</span>
          <span class="font-semibold" class:met={r.score >= target} class:over={r.score < target}>
            {r.language === 'de' ? `${num(r.score)} / 20` : Math.round(r.score)}
          </span>
        </div>
      {/if}

      <!-- Everything else on demand; the summary says when something is off, so closing it hides nothing. -->
      <details class="group mt-0.5" open={$settingsStore.readabilityDetails} ontoggle={onToggle}>
        <summary class="cursor-pointer select-none list-none flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100">
          <span class="inline-block transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
          {t.details}
          {#if issues > 0}<span class="over">· {issues} {t.flagged}</span>{/if}
        </summary>
        <div class="flex flex-col gap-0.5 pt-1.5">
          {#if r.score !== null}
            <div class="flex justify-between items-center text-xs">
              <!-- A badge, not coloured text: amber on white is unreadable. -->
              <span class="badge badge-sm" class:badge-success={r.score >= target} class:badge-warning={r.score < target}>
                {t.target} ≥ {target}
                {r.score >= target ? '✓' : '✗'}
              </span>
              {#if r.language === 'en'}<span class="opacity-60">{labelForFleschScore(r.score)}</span>{/if}
            </div>
          {/if}

          <div class="join mt-1 mb-1" role="group" aria-label={t.typeHint} title={t.typeHint}>
            {#each ['fach', 'web'] as const as option}
              <button
                type="button"
                class="join-item btn btn-xs"
                class:btn-active={type === option}
                aria-pressed={type === option}
                onclick={() => chooseType(option)}>{t.type[option]}</button
              >
            {/each}
          </div>

          <div class="flex justify-between">
            <span>{t.sentenceLength}</span><span>{num(r.sentenceLength)} {t.wordsUnit}</span>
          </div>
          {@render barrier(t.longSentences, t.longSentencesHint, r.barriers.longSentences.share, limits.longSentences, `${r.barriers.longSentences.count} ${t.of} ${r.sentences}`)}
          {@render barrier(t.longWords, t.longWordsHint, r.barriers.longWords.share, limits.longWords)}
          {@render barrier(t.passive, t.passiveHint, r.barriers.passive.share, limits.passive, `${r.barriers.passive.count} ${t.of} ${r.sentences}`)}
        </div>
      </details>
    </div>
  {/if}
</div>

{#snippet barrier(label: string, hint: string, share: number, limit: number, count?: string)}
  <div class="flex justify-between gap-2" title="{hint} — {t.max} {limit} %">
    <span>{label}</span>
    <span class="text-right" class:over={share > limit}>
      {#if count}<span class="opacity-60">{count} ·</span>{/if}
      {percent(share)}
      <span class="opacity-50 text-xs">/ {limit} %</span>
    </span>
  </div>
{/snippet}

<style>
  /* Over a limit (or the index below its target): the warning hue, darkened
     towards the text colour so it stays readable on white (and lightens in
     dark mode). */
  .over {
    font-weight: 600;
    color: color-mix(in oklab, var(--color-warning) 55%, var(--color-base-content));
  }

  /* The index at or above the target of its text type, darkened the same way. */
  .met {
    color: color-mix(in oklab, var(--color-success) 60%, var(--color-base-content));
  }
</style>
