// utils/textUnits.ts
// The units readability is measured in — sentences, clauses, words,
// syllables — and the passive voice, for German and English. Heuristics, so
// each is measured against hand-counted cases in textUnits.test.ts.

export type TextLanguage = 'de' | 'en';

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

/** A token is a word when it has a letter or digit: dashes, "·" and lone quotes are not. */
export const isWord = (token: string) => /[\p{L}\p{N}]/u.test(token);

export function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(isWord);
}

/** Letters and digits of a word, without the punctuation around it. */
export const lettersOf = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, '');

// A period after one of these does not end the sentence (compared lowercase,
// without the period). Single letters ("z. B.", "d. h.") are handled apart.
const ABBREVIATIONS = new Set([
  'bzw', 'ca', 'usw', 'etc', 'evtl', 'ggf', 'inkl', 'zzgl', 'bspw', 'vgl', 'sog', 'ggü', 'nr', 'abs', 'abb', 'tab', 'kap',
  'dr', 'prof', 'hr', 'fr', 'st', 'str', 'mio', 'mrd', 'tel', 'jh', 'jhd', 'gem', 'max', 'min', 'zb', 'dh', 'ua', 'uvm',
  'mr', 'mrs', 'ms', 'vs', 'no', 'approx', 'dept', 'est', 'fig', 'inc', 'ltd', 'co', 'jr', 'sr', 'mt'
]);

const MONTHS = new Set([
  'januar', 'jänner', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  'jan', 'feb', 'mär', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'okt', 'nov', 'dez', 'jahrhundert', 'jh'
]);

/**
 * Whether the period at `dot` in `text` ends a sentence. Not after an
 * abbreviation ("z. B.", "Dr.", "e.g."), not after an ordinal before a month
 * ("14. Oktober"), and not before a lowercase word ("ca. drei").
 */
// How far to look around a period for the word before and after it. Bounded,
// so a long document is split in linear time (slicing from the text's start
// at every period made 10 000 words take half a second).
const LOOK = 48;

function periodEndsSentence(text: string, dot: number): boolean {
  const before = text.slice(Math.max(0, dot - LOOK), dot).match(/(\S+)$/)?.[1] ?? '';
  const after = text.slice(dot + 1, dot + 1 + LOOK).match(/^\s+(\S+)/)?.[1] ?? '';
  const bare = before.replace(/^[„"“‚'(«»]+/, '').toLowerCase();
  if (/^\p{L}$/u.test(bare)) return false; // "z. B.", "d. h.", initials
  if (/^(\p{L}\.)+\p{L}$/u.test(bare)) return false; // "e.g", "i.e", "u.a"
  if (ABBREVIATIONS.has(bare)) return false;
  const next = after.replace(/^[„"“‚'(«»]+/, '');
  if (/^\d+$/.test(bare) && MONTHS.has(next.toLowerCase().replace(/[^\p{L}]/gu, ''))) return false;
  if (/^\p{Ll}/u.test(next)) return false;
  return true;
}

/**
 * Sentences with their offsets. A sentence ends at . ! ? … (plus closing
 * quotes or brackets) before whitespace, or at a line break — headings, list
 * items and lines split by <br> end there even without a period.
 */
export function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) spans.push({ text: body, start: start + lead, end: start + lead + body.length });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      push(i);
      continue;
    }
    if (!/[.!?…]/.test(ch)) continue;
    let end = i + 1;
    while (end < text.length && /[.!?…"“”'’»«)\]]/.test(text[end])) end++;
    if (end < text.length && !/\s/.test(text[end])) continue; // "2.5", "v2.0", "e.g"
    if (ch === '.' && end === i + 1 && !periodEndsSentence(text, i)) continue;
    // Direct speech: "„Wohin denn?“ fragte sie." goes on after the quote.
    if (/[“”"'’»«]/.test(text[end - 1]) && /^\s+\p{Ll}/u.test(text.slice(end, end + LOOK))) continue;
    push(end);
    i = end - 1;
  }
  push(text.length);
  return spans.filter((s) => isWord(s.text));
}

/** Clauses of one sentence: split at commas, semicolons, colons, brackets and spaced dashes. */
export function splitClauses(sentence: string): string[] {
  return sentence.split(/[,;:()]|\s[–—-]\s/).filter((part) => wordsOf(part).length > 0);
}

// German: diphthongs and doubled vowels are one syllable; a final -e is
// spoken ("Sei-te"), unlike English. "qu" is a consonant cluster.
const DE_NUCLEUS = /äu|eu|au|ei|ai|ey|ay|ie|aa|ee|oo|[aeiouyäöü]/g;

function syllablesDe(word: string): number {
  // "-tion"/"-sion" is one syllable ("Prä-sen-ta-tion").
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, '').replace(/qu/g, 'q').replace(/([ts])ion/g, '$1on');
  return Math.max(1, w.match(DE_NUCLEUS)?.length ?? 0);
}

// English: vowel groups, minus a silent final -e (but not consonant + "le":
// "sim-ple") and a silent -ed (but not after t/d: "want-ed"), plus a few
// vowel pairs that are usually two syllables ("i-de-a", "ru-in").
// Frequent words the rules get wrong, as in a dictionary.
const EN_EXCEPTIONS: Record<string, number> = {
  business: 2, create: 2, created: 3, really: 3, science: 2, experience: 4, every: 3, everyone: 4, different: 3, area: 3,
  idea: 3, ideas: 3, real: 1, people: 2, someone: 2, sometimes: 2, maybe: 2, cafe: 2, recipe: 3, poem: 2, quiet: 2
};

function syllablesEn(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w in EN_EXCEPTIONS) return EN_EXCEPTIONS[w];
  if (w.length <= 3) return 1;
  if (/[^aeiouy]ed$/.test(w) && !/[td]ed$/.test(w)) w = w.slice(0, -2);
  else if (/[^aeiouy]es$/.test(w) && !/(?:[sxz]|ch|sh|[cg])es$/.test(w)) w = w.slice(0, -2);
  else if (/e$/.test(w) && !/[^aeiouy]le$/.test(w) && !/ee$/.test(w)) w = w.slice(0, -1);
  let n = w.match(/[aeiouy]+/g)?.length ?? 0;
  n += w.match(/[^aeiou]ia|[^aeiou]io(?!n)|ua(?!g)|ea$|ui(?!ld|t)|eo(?!p)|iet|uen|[aeiouy]ing$/g)?.length ?? 0;
  return Math.max(1, n);
}

export function countSyllables(word: string, language: TextLanguage = 'en'): number {
  return language === 'de' ? syllablesDe(word) : syllablesEn(word);
}

// Passive: a form of "werden" / "to be" plus a past participle. Heuristic —
// it cannot tell "wird gehen" (future) from "wird gegeben" without a lexicon,
// so it only counts participles it can recognise, and errs towards missing.
const DE_WERDEN = new Set(['wird', 'werden', 'wurde', 'wurden', 'worden', 'werde', 'wirst', 'werdet', 'wurdest']);
const DE_GE_NOT_PARTICIPLE = new Set([
  'gegen', 'genug', 'genau', 'gern', 'gerne', 'gestern', 'geben', 'gehen', 'gelten', 'gewinnen', 'gehören', 'gelingen',
  'genießen', 'gestalten', 'gewähren', 'gebrauchen', 'geschehen', 'gefallen', 'gemeinsam', 'gesamt', 'gerecht', 'gesund', 'geschlecht', 'gewicht', 'gesicht', 'gericht', 'gedicht', 'geschichten'
]);
const DE_STRONG_PARTICIPLES = new Set([
  'beschlossen', 'besprochen', 'entschieden', 'verschoben', 'vergessen', 'verboten', 'verlassen', 'empfohlen', 'unterschrieben',
  'übersehen', 'übernommen', 'beschrieben', 'bewiesen', 'erfunden', 'gefunden', 'verstanden', 'betrieben', 'vertrieben', 'entworfen'
]);

function isParticipleDe(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-zäöüß]/g, '');
  if (w.length < 5) return false;
  if (DE_STRONG_PARTICIPLES.has(w)) return true;
  if (/iert$/.test(w)) return true;
  if (/^ge[a-zäöüß]{3,}(t|en)$/.test(w) && !DE_GE_NOT_PARTICIPLE.has(w)) return true;
  if (/^(?:be|ent|er|ver|zer|emp|miss)[a-zäöüß]{3,}t$/.test(w)) return true;
  // Separable verbs: "aus-ge-wertet", "ab-ge-schlossen"
  if (/^(?:ab|an|auf|aus|bei|ein|mit|nach|vor|weg|zu|zurück|um|durch|her|hin|fest|frei)ge[a-zäöüß]{3,}(t|en)$/.test(w)) return true;
  return false;
}

const EN_BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', "isn't", "aren't", "wasn't", "weren't"]);
const EN_IRREGULAR = new Set([
  'done', 'made', 'taken', 'given', 'seen', 'known', 'shown', 'built', 'sent', 'held', 'kept', 'left', 'told', 'found', 'thought',
  'brought', 'bought', 'paid', 'written', 'chosen', 'driven', 'eaten', 'forgotten', 'gotten', 'hidden', 'spoken', 'stolen', 'broken',
  'run', 'set', 'put', 'cut', 'read', 'said', 'sold', 'won', 'lost', 'meant', 'met', 'led', 'fed', 'hung', 'struck', 'understood', 'drawn', 'grown', 'thrown'
]);
const EN_ED_NOT_PARTICIPLE = new Set(['need', 'feed', 'speed', 'seed', 'bed', 'red', 'shed', 'indeed', 'proceed', 'exceed', 'succeed', 'breed', 'greed', 'hundred']);

function isParticipleEn(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (EN_IRREGULAR.has(w)) return true;
  return w.length > 3 && /ed$/.test(w) && !EN_ED_NOT_PARTICIPLE.has(w);
}

/** Whether a sentence is (very probably) in the passive voice. */
export function isPassive(sentence: string, language: TextLanguage): boolean {
  const words = wordsOf(sentence).map((w) => w.toLowerCase().replace(/[^\p{L}']/gu, ''));
  if (language === 'de') {
    if (!words.some((w) => DE_WERDEN.has(w))) return false;
    if (words.includes('worden')) return true;
    return words.some((w, i) => i > 0 && isParticipleDe(w));
  }
  // English: a form of "be", then a participle within the next three words ("was quickly approved").
  return words.some((w, i) => EN_BE.has(w) && words.slice(i + 1, i + 4).some(isParticipleEn));
}
