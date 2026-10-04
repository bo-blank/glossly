// utils/slop.ts
// The treatment plan's findings: patterns typical of machine-written prose
// ("AI slop"), found by rules — no model involved, so every finding is
// reproducible and points at a place in the text. The model only comes in
// when the writer asks for a rewrite of one finding (requestTreatment).
//
// Patterns that are normal in moderation (dashes, triads, intensifiers,
// "not X but Y") count only above a threshold; stock phrases and summary
// closings count every time.

import { splitSentences, wordsOf, type TextLanguage } from './textUnits';

export type SlopRule = 'phrase' | 'closer' | 'notOnly' | 'notThis' | 'exactly' | 'contrast' | 'triad' | 'dash' | 'intensifier' | 'rhetorical' | 'staccato' | 'rhythm';

/** A place in the text: offsets into the analysed block text, plus the block's document position. */
export interface SlopHit {
  /** Document position where the hit starts and ends. */
  from: number;
  to: number;
  quote: string;
}

export interface SlopFinding {
  rule: SlopRule;
  /** Empty for findings about the whole text (rhythm). */
  hits: SlopHit[];
  /** A measured figure, e.g. "9 auf 300 Wörter". */
  detail?: string;
}

/** A block of text and where its first character sits in the document. */
export interface TextBlock {
  text: string;
  pos: number;
  /** Headings and list items are not prose: they stay out of the rhythm rules. */
  kind?: 'text' | 'heading' | 'list';
  /** The block (section) it belongs to, by name or number: monotony is judged per block. */
  section?: string;
}

type Copy = Record<TextLanguage, string>;

export const SLOP_RULES: Record<SlopRule, { title: Copy; advice: Copy; instruction: string }> = {
  phrase: {
    title: { de: 'Floskel', en: 'Stock phrase' },
    advice: {
      de: 'Streichen oder durch das Konkrete ersetzen: wer, was, welche Zahl.',
      en: 'Cut it, or replace it with the specific thing: who, what, which number.'
    },
    instruction: 'Rewrite without the stock phrase "{quote}". Say the concrete thing instead.'
  },
  closer: {
    title: { de: 'Fazit-Schluss', en: 'Summary ending' },
    advice: {
      de: 'Nicht zusammenfassen. Mit einem Gedanken oder einem Schritt enden, der neu ist.',
      en: "Don't summarise. End with a thought or a next step that is new."
    },
    instruction: 'Rewrite so it does not open as a summary ("{quote}"). End on something specific instead of restating.'
  },
  notOnly: {
    title: { de: '„Nicht nur … sondern auch“', en: '"Not only … but also"' },
    advice: {
      de: 'Ein typisches KI-Muster. Meist reicht eine der beiden Hälften.',
      en: 'A typical machine pattern. One half is usually enough.'
    },
    instruction: 'Rewrite without the "not only … but also" construction. Keep the stronger half.'
  },
  notThis: {
    title: { de: '„Das ist nicht X“', en: '"This isn\'t X"' },
    advice: {
      de: 'Erst zu sagen, was etwas nicht ist, ist ein typisches KI-Muster. Direkt sagen, was es ist.',
      en: 'Saying first what something is not is a typical machine pattern. Say what it is.'
    },
    instruction: 'Rewrite without "{quote}". Say directly what it is instead of what it is not.'
  },
  exactly: {
    title: { de: '„Genau das“', en: '"Exactly that"' },
    advice: {
      de: '„Genau das.“ als Verstärker ist ein typisches KI-Muster. Streichen, die Aussage trägt sich selbst.',
      en: '"Exactly that." as an intensifier is a typical machine pattern. Cut it; the point carries itself.'
    },
    instruction: 'Rewrite without "{quote}". Make the point without pointing at it.'
  },
  contrast: {
    title: { de: '„Nicht X, sondern Y“', en: '"Not X, it\'s Y"' },
    advice: {
      de: 'Die Kontrastfigur wirkt wiederholt schablonenhaft. Einfach Y sagen.',
      en: 'The contrast figure sounds templated when repeated. Just say Y.'
    },
    instruction: 'Rewrite without the "not X but Y" contrast. State the point directly.'
  },
  triad: {
    title: { de: 'Dreierlisten', en: 'Lists of three' },
    advice: {
      de: 'Dreierlisten im Dauerton klingen generiert. Zwei Glieder reichen, oder ein konkretes Beispiel.',
      en: 'Constant lists of three sound generated. Two items will do, or one concrete example.'
    },
    instruction: 'Rewrite without the list of three ("{quote}"). Keep the one or two items that matter.'
  },
  dash: {
    title: { de: 'Gedankenstriche', en: 'Dashes' },
    advice: {
      de: 'Viele Gedankenstriche sind ein typisches KI-Merkmal. Durch Punkt oder Komma ersetzen.',
      en: 'Many dashes are a typical machine tell. Use a full stop or a comma instead.'
    },
    instruction: 'Rewrite without the dash. Use a full stop or a comma.'
  },
  intensifier: {
    title: { de: 'Leere Verstärker', en: 'Empty intensifiers' },
    advice: {
      de: 'Wörter wie „wirklich“ oder „absolut“ schwächen den Satz. Streichen und die Aussage tragen lassen.',
      en: 'Words like "really" or "absolutely" weaken the sentence. Cut them and let the claim carry itself.'
    },
    instruction: 'Rewrite without the intensifier "{quote}". Let the statement stand on its own.'
  },
  rhetorical: {
    title: { de: 'Frage-Antwort-Muster', en: 'Question-and-answer pattern' },
    advice: {
      de: '„Das Ergebnis? …“ ist ein beliebtes KI-Muster. Direkt sagen.',
      en: '"The result? …" is a favourite machine pattern. Just say it.'
    },
    instruction: 'Rewrite without the short rhetorical question ("{quote}"). Say the answer directly.'
  },
  staccato: {
    title: { de: 'Stakkato', en: 'Staccato' },
    advice: {
      de: 'Viele sehr kurze Sätze hintereinander wirken zerhackt. Zwei oder drei zu einem Satz verbinden, der den Zusammenhang sagt.',
      en: 'Many very short sentences in a row feel chopped. Join two or three into one sentence that says how they connect.'
    },
    instruction: 'Rewrite these short sentences ("{quote}") as one or two flowing sentences that show how the ideas connect.'
  },
  rhythm: {
    title: { de: 'Gleichförmiger Satzrhythmus', en: 'Monotonous rhythm' },
    advice: {
      de: 'Ein Satz ist fast so lang wie der nächste. Kurze Sätze einstreuen, ab und zu einen längeren.',
      en: 'Each sentence is almost as long as the next. Mix in short ones, and the odd long one.'
    },
    instruction: ''
  }
};

/** The model instruction for one hit, at most 300 characters (the server's limit). */
export function instructionFor(rule: SlopRule, quote: string): string {
  const short = quote.length > 80 ? `${quote.slice(0, 77)}…` : quote;
  return `${SLOP_RULES[rule].instruction.replace('{quote}', short)} Keep the meaning and the language of the text.`.slice(0, 300);
}

// Word boundaries that know umlauts: \b does not.
const W = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'giu');

const PHRASES: Record<TextLanguage, RegExp[]> = {
  de: [
    W('in der heutigen (?:schnelllebigen |digitalen |modernen |vernetzten )?(?:welt|zeit|gesellschaft)'),
    W('im (?:heutigen |digitalen )zeitalter'),
    W('in einer welt,? in der'),
    W('in zeiten wie diesen'),
    W('(?:es ist|ist es) (?:dabei |hier )?(?:wichtig|entscheidend|wesentlich|essenziell|unerlässlich),? (?:zu beachten|zu betonen|zu verstehen|zu erwähnen|hervorzuheben)'),
    // Up to three words between verb and role: "spielt Kommunikation dabei eine … Rolle".
    W('spiel(?:t|en) (?:[\\p{L}-]+ ){0,3}eine (?:entscheidende|zentrale|wichtige|wesentliche|große|maßgebliche|tragende) rolle'),
    W('von (?:entscheidender|zentraler|großer|immenser|unschätzbarer) bedeutung'),
    W('(?:zusammenfassend|abschließend) (?:lässt sich|kann man) (?:sagen|festhalten|feststellen)'),
    W('tauchen wir (?:tiefer )?ein|(?:lass(?:t)?|lassen sie) uns (?:eintauchen|einen (?:genaueren |näheren )?blick (?:darauf )?werfen)'),
    W('(?:begeben wir uns|nimmt (?:dich|euch|sie) mit) auf eine reise'),
    W('auf (?:das|ein) (?:nächste|neues) (?:level|niveau)'),
    W('game[ -]?changer'),
    W('nahtlose?[nrs]?'),
    W('maßgeschneiderte?[nrs]?'),
    W('ganzheitliche?[nrs]?'),
    W('facettenreiche?[nrs]?'),
    W('nicht zu unterschätzen(?:de[nr]?)?'),
    W('(?:sich )?(?:ständig|stetig) (?:wandelnde|verändernde)[nr]? (?:welt|landschaft)'),
    W('chancen und herausforderungen|herausforderungen und chancen'),
    W('mehr denn je|mehr als je zuvor'),
    W('(?:das|sein|ihr|dein|euer|unser) volle[ns]? potenzial'),
    W('bahnbrechende?[nrs]?|wegweisende?[nrs]?')
  ],
  en: [
    W("in today'?s (?:fast-paced |digital |ever-changing |modern )?(?:world|age|landscape)"),
    W('in a world where'),
    W("it'?s (?:important|crucial|essential|worth) (?:to note|noting|to remember|to mention|mentioning)"),
    W('plays? an? (?:crucial|pivotal|vital|key|significant|central) role'),
    W("let'?s (?:dive|delve) (?:in|into|deeper)|dive (?:deep|deeper) into|delv(?:e|es|ing)"),
    W('tapestry|testament to|the realm of'),
    W('navigat(?:e|ing) the (?:complexities|landscape|world)'),
    W('unlock(?:ing)? (?:the|your) (?:full )?(?:power|potential)'),
    W('elevat(?:e|es|ing) (?:your|the)'),
    W('seamless(?:ly)?|game[- ]changer|ever[- ](?:evolving|changing)|cutting[- ]edge'),
    W('leverag(?:e|es|ing)|harness(?:ing)? the'),
    W('embark(?:ing)? on a journey|a journey (?:of|through|into)'),
    W('more than ever'),
    W('revolutioni[sz](?:e|es|ing)|groundbreaking')
  ]
};

// The opening words of a closing paragraph that only restates.
const CLOSERS: Record<TextLanguage, RegExp> = {
  de: /^\s*(zusammenfassend|abschließend|alles in allem|kurz gesagt|insgesamt|fazit:?|unterm strich)(?![\p{L}])/iu,
  en: /^\s*(in conclusion|to sum up|in summary|all in all|overall,|ultimately,|in short)(?![\p{L}])/iu
};

const NOT_ONLY: Record<TextLanguage, RegExp> = {
  de: W('nicht nur[^.!?]{1,80}?sondern auch'),
  en: W('not only[^.!?]{1,80}?but also')
};

// "Das ist nicht X." / "Das ist kein X." — what something is not, first.
const NOT_THIS: Record<TextLanguage, RegExp> = {
  de: W('(?:das|dies|es) ist (?:nicht|kein(?:e|en|er|es)?) [^.!?,;:]{1,50}'),
  en: W("(?:this|that|it) (?:is not|isn'?t|'s not|was not|wasn'?t) [^.!?,;:]{1,50}")
};

// "Genau das." / "Und genau das ist …" / "genau darum geht es".
const EXACTLY: Record<TextLanguage, RegExp> = {
  de: W('genau (?:das|dies|darum|deshalb|deswegen|hier|dort)'),
  en: W("(?:that'?s )?exactly (?:it|that|this|why|what)|(?<=^|[.!?]\\s)exactly\\.")
};

const CONTRAST: Record<TextLanguage, RegExp> = {
  // "nicht (um) X, sondern Y" without "nicht nur" — that one is notOnly.
  de: W('(?:es geht )?nicht (?!nur)(?:um )?[^.!?,;]{1,40}, sondern'),
  en: W("(?:it'?s|this is|that'?s|isn'?t) (?:not )?(?:just |only )?(?:about )?[^.!?,;]{1,40}[,;—–] (?:it'?s|but)")
};

// "A, B und C" with short items (one to three words each).
const ITEM = '[\\p{L}\\p{N}][\\p{L}\\p{N}-]*(?: [\\p{L}\\p{N}][\\p{L}\\p{N}-]*){0,2}';
const TRIAD: Record<TextLanguage, RegExp> = {
  de: new RegExp(`(?<![\\p{L}\\p{N}])${ITEM}, ${ITEM},? (?:und|oder) ${ITEM}(?![\\p{L}\\p{N}])`, 'gu'),
  en: new RegExp(`(?<![\\p{L}\\p{N}])${ITEM}, ${ITEM},? (?:and|or) ${ITEM}(?![\\p{L}\\p{N}])`, 'gu')
};

// A dash used as punctuation: spaced en/em dash, or an unspaced em dash between words.
const DASH = /\s[–—]\s|(?<=\p{L})—(?=\p{L})/gu;

const INTENSIFIERS: Record<TextLanguage, RegExp> = {
  de: W('wirklich|absolut|unglaublich|enorm|extrem|äußerst|wahrhaft|zutiefst|definitiv|schlichtweg'),
  en: W('really|truly|incredibly|absolutely|extremely|deeply|definitely|literally|utterly')
};

// "Das Ergebnis? Mehr Zeit." — a question of at most four words, answered in the same block.
const RHETORICAL = /(?<=^|[.!?]\s)([\p{Lu}][^.!?]{0,40}\?)(?=\s+\p{Lu})/gu;

/** Thresholds for patterns that are fine in moderation. */
export const SLOP_LIMITS = {
  contrast: 2,
  rhetorical: 2,
  /** Lists of three: at least this many, and at least one per this many words. */
  triad: { count: 3, perWords: 120 },
  dash: { count: 3, perWords: 100 },
  intensifier: { count: 3, perWords: 100 },
  /** Staccato: at least `run` sentences in a row of at most `maxWords` words. */
  staccato: { maxWords: 4, run: 3 },
  /**
   * Monotony: enough sentences, and neighbours that differ in length by less
   * than this share of the mean. Measured 2026-10-04: an even machine text
   * 0.04; every template, press release and academic text 0.26 or more.
   */
  rhythm: { sentences: 8, change: 0.2 }
} as const;

function hitsOf(blocks: TextBlock[], re: RegExp, filter?: (m: RegExpExecArray) => boolean): SlopHit[] {
  const hits: SlopHit[] = [];
  for (const block of blocks) {
    for (const m of block.text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))) {
      if (filter && !filter(m as RegExpExecArray)) continue;
      const quote = m[1] ?? m[0];
      const start = m.index! + (m[1] ? m[0].indexOf(m[1]) : 0);
      const lead = quote.length - quote.trimStart().length;
      const text = quote.trim();
      hits.push({ from: block.pos + start + lead, to: block.pos + start + lead + text.length, quote: text });
    }
  }
  return hits;
}

const perWords = (count: number, words: number, per: number) => count >= 1 && words > 0 && words / count <= per;

/** Every finding, in a fixed order: per-place patterns first, the whole-text one last. */
export function findSlop(blocks: TextBlock[], language: TextLanguage): SlopFinding[] {
  const words = blocks.reduce((n, b) => n + wordsOf(b.text).length, 0);
  const findings: SlopFinding[] = [];
  const add = (rule: SlopRule, hits: SlopHit[], detail?: string) => {
    if (hits.length || detail) findings.push({ rule, hits, detail });
  };

  add('phrase', PHRASES[language].flatMap((re) => hitsOf(blocks, re)).sort((a, b) => a.from - b.from));

  // The last block with prose: a closing that only restates.
  const last = [...blocks].reverse().find((b) => wordsOf(b.text).length >= 3);
  if (last) add('closer', hitsOf([last], CLOSERS[language]));

  // Every time, on the writer's word: these three read as machine prose even alone.
  add('notOnly', hitsOf(blocks, NOT_ONLY[language]));
  const notThis = hitsOf(blocks, NOT_THIS[language]);
  add('notThis', notThis);
  add('exactly', hitsOf(blocks, EXACTLY[language]));

  // "Das ist nicht X, sondern Y" is already a notThis finding; count it once.
  const overlaps = (h: SlopHit) => notThis.some((n) => h.from < n.to && n.from < h.to);
  const contrast = hitsOf(blocks, CONTRAST[language]).filter((h) => !overlaps(h));
  if (contrast.length >= SLOP_LIMITS.contrast) add('contrast', contrast);

  const counted = (rule: 'triad' | 'dash' | 'intensifier', hits: SlopHit[], unit: Copy) => {
    const limit = SLOP_LIMITS[rule];
    if (hits.length >= limit.count && perWords(hits.length, words, limit.perWords)) {
      add(rule, hits, `${hits.length} ${language === 'de' ? 'auf' : 'in'} ${words} ${unit[language]}`);
    }
  };
  const wordsUnit = { de: 'Wörter', en: 'words' };
  counted('triad', hitsOf(blocks, TRIAD[language]), wordsUnit);
  counted('dash', hitsOf(blocks, DASH), wordsUnit);
  counted('intensifier', hitsOf(blocks, INTENSIFIERS[language]), wordsUnit);

  const rhetorical = hitsOf(blocks, RHETORICAL, (m) => wordsOf(m[1]).length <= 4);
  if (rhetorical.length >= SLOP_LIMITS.rhetorical) add('rhetorical', rhetorical);

  // Prose sentences in order, with their place: headings and list items break the flow.
  const prose: ({ words: number; from: number; to: number; text: string; short: boolean; section?: string } | null)[] = [];
  for (const b of blocks) {
    if (b.kind === 'heading' || b.kind === 'list') {
      prose.push(null);
      continue;
    }
    for (const sentence of splitSentences(b.text)) {
      const words = wordsOf(sentence.text).length;
      // A real sentence (ends with . ! ? …), not a greeting line or a name, and not direct speech.
      const closed = /[.!?…]["“”'’»«)]*$/.test(sentence.text);
      const speech = /^["„“«‚'’]/.test(sentence.text);
      const short = closed && !speech && words <= SLOP_LIMITS.staccato.maxWords;
      prose.push({ words, from: b.pos + sentence.start, to: b.pos + sentence.end, text: sentence.text, short, section: b.section });
    }
  }

  const runs: SlopHit[] = [];
  let run: { from: number; to: number; text: string }[] = [];
  const closeRun = () => {
    if (run.length >= SLOP_LIMITS.staccato.run) {
      runs.push({ from: run[0].from, to: run[run.length - 1].to, quote: run.map((r) => r.text).join(' ') });
    }
    run = [];
  };
  for (const p of prose) {
    if (p?.short) run.push(p);
    else closeRun();
  }
  closeRun();
  if (runs.length) {
    const sentences = prose.filter((p) => p).length;
    const short = prose.filter((p) => p?.short).length;
    add('staccato', runs, language === 'de' ? `${short} von ${sentences} Sätzen mit höchstens ${SLOP_LIMITS.staccato.maxWords} Wörtern` : `${short} of ${sentences} sentences of ${SLOP_LIMITS.staccato.maxWords} words or fewer`);
  }

  // Per block: a machine-written section stays even in itself, however varied
  // the rest of the text is. Without blocks, the whole text is one.
  const groups = new Map<string, number[]>();
  for (const p of prose) {
    if (!p || p.words < 3) continue;
    const key = p.section ?? '';
    groups.set(key, [...(groups.get(key) ?? []), p.words]);
  }
  const even: string[] = [];
  for (const [section, lengths] of groups) {
    if (lengths.length < SLOP_LIMITS.rhythm.sentences) continue;
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    let change = 0;
    for (let i = 1; i < lengths.length; i++) change += Math.abs(lengths[i] - lengths[i - 1]);
    change /= (lengths.length - 1) * mean;
    if (change >= SLOP_LIMITS.rhythm.change) continue;
    const sorted = [...lengths].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.2)];
    const hi = sorted[Math.ceil(sorted.length * 0.8) - 1];
    const span = language === 'de' ? `meist ${lo}–${hi} Wörter pro Satz` : `mostly ${lo}–${hi} words a sentence`;
    const where = section && groups.size > 1 ? (language === 'de' ? `Block „${section}“: ` : `block "${section}": `) : '';
    even.push(where + span);
  }
  if (even.length) add('rhythm', [], even.join('; '));
  return findings;
}
