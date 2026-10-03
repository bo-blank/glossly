<!-- components/ProtectedWords.svelte -->
<script lang="ts">
  import { MAX_PROTECTED_TERM_CHARS, MAX_PROTECTED_TERMS } from '@glossly/shared';
  import { activeProtectedTerms, documentStore, setProtectedTerms } from '../storage/documentStore';
  import { withTerm, withoutTerm } from '../note/protectedTerms';

  let terms = $derived(activeProtectedTerms($documentStore));
  let draft = $state('');

  function save(next: string[]) {
    void setProtectedTerms($documentStore.activeId, next);
  }

  function add(e: SubmitEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    save(withTerm(terms, draft));
    draft = '';
  }
</script>

<div class="px-1">
  <p class="text-xs opacity-60 px-2 pb-2">
    Suggestions keep these words exactly as written — names, invented terms, a repetition you mean. They belong to this
    document and stay in Glossly; a Markdown file does not carry them.
  </p>
  {#if terms.length}
    <ul class="flex flex-wrap gap-1 px-2 pb-2" aria-label="Protected words">
      {#each terms as term (term)}
        <li class="badge badge-outline gap-1 pr-1">
          <span>{term}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle min-h-0 h-4 w-4"
            aria-label={`Stop protecting “${term}”`}
            onclick={() => save(withoutTerm(terms, term))}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-sm opacity-60 px-2 pb-2">None yet. Select a word and press “Protect”, or add one here.</p>
  {/if}
  <form class="flex gap-1 px-2" onsubmit={add}>
    <input
      class="input input-bordered input-sm flex-1 min-w-0"
      placeholder="Add a word"
      maxlength={MAX_PROTECTED_TERM_CHARS}
      bind:value={draft}
      aria-label="Word to protect"
      disabled={terms.length >= MAX_PROTECTED_TERMS}
    />
    <button class="btn btn-sm" type="submit" disabled={!draft.trim() || terms.length >= MAX_PROTECTED_TERMS}>Add</button>
  </form>
  {#if terms.length >= MAX_PROTECTED_TERMS}
    <p class="text-xs opacity-60 px-2 pt-1">That is the maximum of {MAX_PROTECTED_TERMS} for one document.</p>
  {/if}
</div>
