import { describe, expect, it } from 'vitest';
import { findSlop, instructionFor, type SlopRule, type TextBlock } from './slop';

// Blocks as the editor gives them: one per paragraph, at made-up positions.
const blocks = (...texts: string[]): TextBlock[] => texts.map((text, i) => ({ text, pos: 1000 * i + 1 }));
const rules = (b: TextBlock[], lang: 'de' | 'en' = 'de') => findSlop(b, lang).map((f) => f.rule);
const find = (b: TextBlock[], rule: SlopRule, lang: 'de' | 'en' = 'de') => findSlop(b, lang).find((f) => f.rule === rule);

// Plain, varied prose with none of the patterns: the baseline that must stay quiet.
const CLEAN_DE = [
  'Der Bus fährt ab Montag öfter.',
  'Das hat die Stadt am Freitag gesagt, nachdem sich im Frühjahr viele Pendler über volle Busse am Morgen beschwert hatten.',
  'Er kommt alle zehn Minuten.',
  'Die Fahrt kostet gleich viel.'
];

describe('stock phrases', () => {
  it('finds German and English ones, with their place', () => {
    const b = blocks('Wir leben in der heutigen schnelllebigen Welt.', 'Das spielt eine entscheidende Rolle.');
    const f = find(b, 'phrase')!;
    expect(f.hits.map((h) => h.quote)).toEqual(['in der heutigen schnelllebigen Welt', 'spielt eine entscheidende Rolle']);
    expect(f.hits[0].from).toBe(1 + 'Wir leben '.length);
    expect(f.hits[1].from).toBe(1001 + 'Das '.length);
    expect(find(blocks("In today's fast-paced world, let's dive into it."), 'phrase', 'en')!.hits).toHaveLength(2);
  });

  it('does not match inside other words', () => {
    expect(rules(blocks('Die Rolle passt nahtlosigkeitshalber nicht.'))).not.toContain('phrase');
  });
});

describe('summary ending', () => {
  it('flags a last paragraph that opens with a summary word, only there', () => {
    expect(find(blocks('Ein Absatz mit Inhalt.', 'Zusammenfassend lässt sich sagen, dass es gut war.'), 'closer')!.hits[0].quote).toBe('Zusammenfassend');
    expect(rules(blocks('Insgesamt waren es drei Tage.', 'Am Ende fuhren wir heim.'))).not.toContain('closer');
    expect(rules(blocks('First part here.', 'In conclusion, it worked well.'), 'en')).toContain('closer');
  });
});

describe('patterns that count from a threshold', () => {
  it('"nicht nur … sondern auch" every time', () => {
    expect(find(blocks('Er ist nicht nur schnell, sondern auch billig.'), 'notOnly')!.hits).toHaveLength(1);
    expect(rules(blocks('It is not only fast but also cheap.'), 'en')).toContain('notOnly');
  });

  it('"Das ist nicht X" every time, counted once when it goes on with "sondern"', () => {
    expect(find(blocks('Das ist kein Zufall.'), 'notThis')!.hits[0].quote).toBe('Das ist kein Zufall');
    expect(find(blocks('Es war keine Frage, und er wusste es.'), 'notThis')!.hits[0].quote).toBe('Es war keine Frage');
    const b = blocks('Das ist nicht Bürokratie, sondern Haltung.');
    expect(rules(b)).toContain('notThis');
    expect(rules(b)).not.toContain('contrast');
    expect(rules(blocks("This isn't a trick.") , 'en')).toContain('notThis');
  });

  it('"Genau das" every time', () => {
    expect(find(blocks('Und genau das ist der Punkt.'), 'exactly')!.hits[0].quote).toBe('genau das');
    expect(rules(blocks('Genau darum geht es.'))).toContain('exactly');
    expect(rules(blocks("That's exactly why it works."), 'en')).toContain('exactly');
    expect(rules(blocks('Er kam genau um acht.'))).not.toContain('exactly');
  });

  it('"nicht X, sondern Y" from twice, without counting "nicht nur"', () => {
    const b = blocks('Es geht nicht um Geld, sondern um Zeit.', 'Wir fahren nicht heute, sondern morgen.');
    expect(rules(b)).toContain('contrast');
    expect(rules(blocks('Es geht nicht um Geld, sondern um Zeit.'))).not.toContain('contrast');
    // In English the figure opens with "it's not" — so it counts once, as notThis.
    const en = rules(blocks("It's not about the money, it's about time.", "This isn't a bug; it's a feature."), 'en');
    expect(en).toContain('notThis');
    expect(en).not.toContain('contrast');
  });

  it('lists of three only when they pile up', () => {
    const triads = blocks('Wir wollen schnell, klar und einfach sein.', 'Das gilt für Text, Bild und Ton.', 'Es braucht Mut, Zeit und Geduld.');
    expect(find(triads, 'triad')!.hits).toHaveLength(3);
    expect(rules(blocks('Wir wollen schnell, klar und einfach sein.', ...CLEAN_DE))).not.toContain('triad');
  });

  it('dashes only when dense', () => {
    const dashy = blocks('Das ist gut – sehr gut. Es geht weiter – immer weiter. Am Ende – endlich – Ruhe.');
    const f = find(dashy, 'dash')!;
    expect(f.hits).toHaveLength(4);
    expect(f.hits.every((h) => h.quote === '–')).toBe(true);
    expect(rules(blocks('Ein Satz – mit Strich.', ...CLEAN_DE, ...CLEAN_DE))).not.toContain('dash');
  });

  it('intensifiers only when dense', () => {
    expect(rules(blocks('Das ist wirklich gut. Absolut klar. Unglaublich schnell.'))).toContain('intensifier');
    expect(rules(blocks('Das ist wirklich gut.', ...CLEAN_DE))).not.toContain('intensifier');
  });

  it('short question and answer from twice', () => {
    const b = blocks('Das Ergebnis? Mehr Zeit. Der Preis? Gering.');
    expect(find(b, 'rhetorical')!.hits.map((h) => h.quote)).toEqual(['Das Ergebnis?', 'Der Preis?']);
    expect(rules(blocks('Wohin fahren wir eigentlich morgen früh mit dem Zug? Nach Berlin.'))).not.toContain('rhetorical');
  });
});

describe('staccato', () => {
  it('finds runs of three or more very short sentences, as one place each', async () => {
    const { STACCATO_DE } = await import('./slop.fixtures');
    const f = find(blocks(...STACCATO_DE.split('\n')), 'staccato')!;
    expect(f.hits).toHaveLength(2);
    expect(f.hits[0].quote).toBe('Dann kam der Wendepunkt. Ein Kunde. Ein Satz. Alles anders.');
    // A run across paragraphs is one place, from its first sentence to its last.
    expect(f.hits[0].from).toBe(1001);
    expect(f.hits[0].to).toBe(2001 + 'Ein Kunde. Ein Satz. Alles anders.'.length);
  });

  it('leaves greetings, names, direct speech, headings and lists out', () => {
    expect(rules(blocks('Ich lese jede Antwort.', 'Bis nächste Woche', 'Jana'))).not.toContain('staccato');
    expect(rules(blocks('„Wohin denn?“', '„Nach Hause.“', '„Jetzt?“'))).not.toContain('staccato');
    const withHeading: TextBlock[] = [
      { text: 'Kurz gesagt.', pos: 1 },
      { text: 'Ein Titel', pos: 100, kind: 'heading' },
      { text: 'Gut so.', pos: 200 },
      { text: 'Weiter.', pos: 300 }
    ];
    expect(rules(withHeading)).not.toContain('staccato');
    const list: TextBlock[] = ['Kürzer.', 'Ehrlicher.', 'Mutiger.'].map((text, i) => ({ text, pos: 100 * i + 1, kind: 'list' }));
    expect(rules(list)).not.toContain('staccato');
  });

  it('is quiet on the templates, the press release and easy-language news', async () => {
    const { PRESS_DE, PLAIN_DE } = await import('./comprehensibility.fixtures');
    expect(rules(blocks(PRESS_DE))).not.toContain('staccato');
    expect(rules(blocks(PLAIN_DE))).not.toContain('staccato');
  });
});

describe('rhythm', () => {
  it('judges each block on its own and names it', async () => {
    const { MONOTONE_DE, STACCATO_DE } = await import('./slop.fixtures');
    const mixed: TextBlock[] = [
      ...STACCATO_DE.split('\n').map((text, i) => ({ text, pos: 10 * i + 1, section: 'Einstieg' })),
      { text: MONOTONE_DE, pos: 1000, section: 'Bericht' }
    ];
    expect(find(mixed, 'rhythm')!.detail).toMatch(/^Block „Bericht“: meist/);
  });

  it('flags machine-even prose: neighbours of nearly the same length', async () => {
    const { MONOTONE_DE } = await import('./slop.fixtures');
    expect(find(blocks(MONOTONE_DE), 'rhythm')!.detail).toMatch(/^meist \d+–\d+ Wörter pro Satz$/);
  });

  it('flags many sentences of nearly the same length', () => {
    const same = Array.from({ length: 10 }, (_, i) => `Das ist Satz Nummer ${i} mit genau neun Wörtern hier.`);
    expect(find(blocks(same.join(' ')), 'rhythm')!.detail).toMatch(/Wörter pro Satz/);
  });

  it('leaves varied prose alone', () => {
    expect(rules(blocks(...CLEAN_DE, ...CLEAN_DE))).not.toContain('rhythm');
  });
});

describe('clean prose', () => {
  it('has no findings', () => {
    expect(findSlop(blocks(...CLEAN_DE), 'de')).toEqual([]);
  });
});

describe('instructionFor', () => {
  it('names the quote and stays within the server limit', () => {
    expect(instructionFor('phrase', 'in der heutigen Welt')).toContain('"in der heutigen Welt"');
    expect(instructionFor('phrase', 'x'.repeat(500)).length).toBeLessThanOrEqual(300);
  });
});

describe('a typical machine-written text', () => {
  it('shows most of the patterns, the press release and the templates far fewer', async () => {
    const { SLOP_DE } = await import('./slop.fixtures');
    const { PRESS_DE } = await import('./comprehensibility.fixtures');
    const slop = findSlop(blocks(...SLOP_DE.split('\n')), 'de');
    expect(slop.map((f) => f.rule)).toEqual(expect.arrayContaining(['phrase', 'closer', 'contrast', 'triad', 'dash', 'intensifier', 'rhetorical']));
    expect(slop.find((f) => f.rule === 'phrase')!.hits.length).toBeGreaterThanOrEqual(8);
    expect(findSlop(blocks(PRESS_DE), 'de')).toEqual([]);
  });
});

describe('templates', () => {
  // Blocks as the editor gives them, with headings and list items marked.
  const templateBlocks = (html: string): TextBlock[] =>
    [...html.matchAll(/<(h[1-6]|p)[^>]*>([\s\S]*?)<\/\1>/g)].map((m, i) => ({
      text: m[2].replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/[ \t\n]+/g, ' ').trim(),
      pos: 1000 * i + 1,
      kind: m[1].startsWith('h') ? 'heading' : /<li[^>]*>\s*$/.test(html.slice(0, m.index)) ? 'list' : 'text'
    }));

  it('have neither staccato nor monotonous rhythm', async () => {
    const { DE } = await import('../editor/templates/de');
    const { EN } = await import('../editor/templates/en');
    for (const [lang, list] of [['de', DE], ['en', EN]] as const) {
      for (const t of list.filter((t) => t.id !== 'blank')) {
        expect(rules(templateBlocks(t.content), lang), `${lang} ${t.id}`).not.toEqual(expect.arrayContaining(['staccato']));
        expect(rules(templateBlocks(t.content), lang), `${lang} ${t.id}`).not.toEqual(expect.arrayContaining(['rhythm']));
      }
    }
  });
});
