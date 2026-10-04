<!-- components/TreatmentPlan.svelte -->
<script lang="ts">
  // The treatment plan against machine-sounding prose: patterns found by rules
  // (utils/slop.ts), each with advice and its places in the text. A click on a
  // place selects its sentence and asks the model for three rewrites by the
  // finding's instruction, in the margin note. Open, the places are marked in
  // the text too.
  import { slopStore } from '../stores/slopStore';
  import { editorStore } from '../stores/noteStore';
  import { dashboardStore } from '../stores/dashboardStore';
  import { setSlopPlan } from '../note/slopHighlight';
  import { expandToSentenceSelection } from '../note/sentenceExpansion';
  import { requestTreatment } from '../note/requestSuggestions';
  import { revealRange } from '../editor/blockNav';
  import { instructionFor, SLOP_RULES, type SlopFinding, type SlopHit } from '../utils/slop';
  import { MAX_SENTENCE_CHARS } from '@glossly/shared';

  const L = {
    de: {
      open: 'Behandlungsplan',
      close: 'Plan schließen',
      buttonHint: 'Typische KI-Muster im Text finden, mit konkreten Vorschlägen',
      none: 'Keine typischen KI-Muster gefunden.',
      count: (n: number) => (n === 1 ? '1 Befund' : `${n} Befunde`),
      howTo: 'Klick auf eine Stelle: der Satz wird markiert, Umformulierungen erscheinen am Rand.',
      more: (n: number) => `+ ${n} weitere`,
      placeHint: 'Stelle zeigen und umformulieren lassen'
    },
    en: {
      open: 'Treatment plan',
      close: 'Close plan',
      buttonHint: 'Find typical machine patterns in the text, with concrete advice',
      none: 'No typical machine patterns found.',
      count: (n: number) => (n === 1 ? '1 finding' : `${n} findings`),
      howTo: 'Click a place: its sentence is selected and rewrites appear in the margin.',
      more: (n: number) => `+ ${n} more`,
      placeHint: 'Show the place and get rewrites'
    }
  };

  /** Places listed per finding; the rest are marked in the text all the same. */
  const MAX_PLACES = 5;

  const editor = $derived($editorStore.editor);
  const open = $derived($slopStore.open);
  const language = $derived(open ? $slopStore.language : $dashboardStore.language);
  const t = $derived(L[language]);
  const findings = $derived($slopStore.findings);

  function toggle() {
    setSlopPlan(!open, editor?.view);
  }

  /** A short quote (a dash, one word) needs the words around it to be found. */
  function label(hit: SlopHit): string {
    if (hit.quote.length >= 12 || !editor) return `„${hit.quote}“`;
    const doc = editor.state.doc;
    const block = doc.resolve(hit.from);
    const before = doc.textBetween(Math.max(block.start(), hit.from - 24), hit.from, ' ', ' ').replace(/^\S*\s/, '');
    const after = doc.textBetween(hit.to, Math.min(block.end(), hit.to + 24), ' ', ' ').replace(/\s\S*$/, '');
    return `…${before}${hit.quote}${after}…`;
  }

  function treat(finding: SlopFinding, hit: SlopHit) {
    if (!editor) return;
    // The whole sentence, so the model can rebuild it rather than patch a phrase.
    // A staccato run can span paragraphs; then the run itself is the selection.
    const sentence = expandToSentenceSelection(editor.state.doc, hit.from, hit.to);
    const covers = sentence && sentence.from <= hit.from && sentence.to >= hit.to;
    const range = covers && sentence.to - sentence.from <= MAX_SENTENCE_CHARS ? sentence : hit;
    revealRange(editor, range.from, range.to);
    requestTreatment(instructionFor(finding.rule, hit.quote));
  }
</script>

<div class="mt-2">
  <button type="button" class="btn btn-xs btn-outline" aria-expanded={open} title={t.buttonHint} onclick={toggle}>
    {open ? t.close : t.open}
  </button>

  {#if open}
    <div class="mt-2 flex flex-col gap-2.5">
      {#if findings.length === 0}
        <p class="text-xs opacity-60">{t.none}</p>
      {:else}
        <p class="text-xs opacity-60 leading-snug">{t.count(findings.length)} · {t.howTo}</p>
        {#each findings as finding (finding.rule)}
          {@const rule = SLOP_RULES[finding.rule]}
          <div>
            <div class="font-medium leading-snug">
              {rule.title[language]}
              {#if finding.hits.length > 1}<span class="opacity-60 font-normal">× {finding.hits.length}</span>{/if}
              {#if finding.detail}<span class="opacity-60 font-normal text-xs">· {finding.detail}</span>{/if}
            </div>
            <p class="text-xs opacity-70 leading-snug">{rule.advice[language]}</p>
            {#if finding.hits.length}
              <ul class="mt-1 flex flex-col gap-0.5">
                {#each finding.hits.slice(0, MAX_PLACES) as hit (hit.from)}
                  <li>
                    <button type="button" class="slop-place" data-opens-note title={t.placeHint} onclick={() => treat(finding, hit)}>{label(hit)}</button>
                  </li>
                {/each}
                {#if finding.hits.length > MAX_PLACES}
                  <li class="text-xs opacity-60">{t.more(finding.hits.length - MAX_PLACES)}</li>
                {/if}
              </ul>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .slop-place {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 0.75rem;
    line-height: 1.35;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    border-left: 2px solid color-mix(in oklab, var(--color-warning) 70%, transparent);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover,
    &:focus-visible {
      background-color: var(--gray-2);
    }
  }
</style>
