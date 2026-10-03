import { describe, expect, it } from 'vitest';
import { buildMessages, detectLanguage, styleDefaults } from './prompt';

const GERMAN_CONTEXT =
  'Sehr geehrte Frau Weber, vielen Dank für Ihre Nachricht. Die Ergebnisse sind in weiten Teilen zufriedenstellend.';
const GERMAN_SELECTION = 'in weiten Teilen zufriedenstellend';

describe('buildMessages', () => {
  it.each(['phrase', 'sentence'] as const)('tells the model to keep the selection language in %s mode', (mode) => {
    const [system] = buildMessages(GERMAN_SELECTION, GERMAN_CONTEXT, undefined, undefined, undefined, mode);
    expect(system.content).toMatch(/same language as the selected text/);
    expect(system.content).toMatch(/form of\s+address/);
  });

  it('passes German context and selection through unchanged', () => {
    const [, user] = buildMessages(GERMAN_SELECTION, GERMAN_CONTEXT);
    expect(user.content).toContain(`Context:\n${GERMAN_CONTEXT}`);
    expect(user.content).toContain(`Selected phrase: "${GERMAN_SELECTION}"`);
  });

  it("uses a custom chip's instruction, with the structured context too", () => {
    const context = { title: 'Notiz', headingPath: [], before: 'We should ', after: ' sometime next week.' };
    const [, user] = buildMessages('grab lunch', context, '463799fd-c129-433f-a8d4-91347abfc9cf', undefined, 'Make each alternative more formal in register.');
    expect(user.content).toContain('Style instruction: Make each alternative more formal in register.');
    expect(user.content).toContain('We should ⟦grab lunch⟧ sometime next week.');
  });

  it('never lets a custom instruction override a built-in modifier', () => {
    const [, user] = buildMessages(GERMAN_SELECTION, GERMAN_CONTEXT, 'tighter', undefined, 'Make it longer.');
    expect(user.content).toContain('more concise');
    expect(user.content).not.toContain('Make it longer.');
  });
});

describe('style choices', () => {
  const english = { title: 'Notes', headingPath: [], before: 'We should ', after: ' sometime next week.' };
  const german = { title: 'Mail', headingPath: [], before: 'Hi Tom, bin gerade unterwegs, ich ', after: ' bei dir.', address: 'du' as const };
  const STYLES = [
    'Make each alternative more formal in register.',
    'Make each alternative casual and colloquial, like talking to a friend.',
    'Make each alternative poetic and lyrical.',
    'Formuliere jede Alternative deutlich förmlicher.'
  ];

  it.each(STYLES)('lets "%s" override the context register', (instruction) => {
    const [, user] = buildMessages('grab lunch', english, 'custom-id', undefined, instruction);
    expect(user.content).toContain(`Style instruction: ${instruction}`);
    expect(user.content).toMatch(/takes priority over matching the tone and register/);
    expect(user.content).toMatch(/each clearly following the style instruction\.$/);
  });

  it.each(['tighter', 'vivid', 'plain'])('treats the built-in %s as a style too', (modifier) => {
    const [, user] = buildMessages('grab lunch', english, modifier);
    expect(user.content).toContain('Style instruction:');
  });

  it('names the language, so a German instruction does not turn English text German', () => {
    const [, user] = buildMessages('grab lunch', english, 'custom-id', undefined, 'Formuliere jede Alternative deutlich förmlicher.');
    expect(user.content).toContain('Language: the text is English. Every alternative must be in English.');
  });

  it('names German for German text with an English instruction', () => {
    const [, user] = buildMessages('melde mich später', german, 'custom-id', undefined, 'Rewrite each alternative in the voice of a pirate.');
    expect(user.content).toContain('Language: the text is German.');
    expect(user.content).toContain('Form of address: the text uses informal "du".');
  });

  it('keeps the style instruction in sentence mode', () => {
    const [, user] = buildMessages('We should grab lunch.', english, 'custom-id', undefined, 'Make it poetic.', 'sentence');
    expect(user.content).toContain('Style instruction: Make it poetic.');
    expect(user.content).toMatch(/rewrites of the selected sentence\(s\), each clearly following the style instruction\.$/);
  });

  it('adds no style or language lines without a style modifier', () => {
    for (const modifier of [undefined, 'more']) {
      const [, user] = buildMessages('grab lunch', english, modifier, ['have lunch']);
      expect(user.content).not.toContain('Style instruction:');
      expect(user.content).not.toContain('Language:');
      expect(user.content).toMatch(/Give exactly 3 alternative phrasings for the selected phrase\.$/);
    }
  });

  it('ignores a custom instruction sent without a modifier id', () => {
    const [, user] = buildMessages('grab lunch', english, undefined, undefined, 'Make it poetic.');
    expect(user.content).not.toContain('Make it poetic.');
  });
});

describe('detectLanguage', () => {
  it.each([
    ['Wir haben drei Wochen getestet und die Ergebnisse sind gut.', 'German'],
    ['We should grab lunch sometime next week.', 'English'],
    ['Hi Tom, bin gerade unterwegs, ich melde mich später bei dir.', 'German'],
    ['Okay.', null],
    ['Das Meeting mit the team and the board', null]
  ] as const)('%s → %s', (text, expected) => {
    expect(detectLanguage(text)).toBe(expected);
  });
});

describe('structured context', () => {
  const context = {
    title: 'Mein Roman',
    headingPath: ['Kapitel 2', 'Der Bahnhof'],
    before: 'Der Zug hielt. ',
    after: ' und sah sich um.'
  };

  it('marks the selection where it sits in the passage', () => {
    const [, user] = buildMessages('Sie stieg langsam aus', context);
    expect(user.content).toContain('Context:\nDer Zug hielt. ⟦Sie stieg langsam aus⟧ und sah sich um.');
  });

  it('orders the prompt from most to least stable', () => {
    const [, user] = buildMessages('Sie stieg langsam aus', context, 'tighter', ['Sie stieg aus']);
    const order = ['Document: Mein Roman', 'Section: Kapitel 2 › Der Bahnhof', 'Context:', 'Selected phrase:', 'Style instruction:', 'Already suggested'];
    const positions = order.map((part) => user.content.indexOf(part));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('leaves out an empty title and heading path', () => {
    const [, user] = buildMessages('stieg', { title: '', headingPath: [], before: 'Sie ', after: ' aus.' });
    expect(user.content).not.toContain('Document:');
    expect(user.content).not.toContain('Section:');
    expect(user.content.startsWith('Context:\nSie ⟦stieg⟧ aus.')).toBe(true);
  });

  it.each(['phrase', 'sentence'] as const)('explains the marker in %s mode', (mode) => {
    const [system] = buildMessages('stieg', context, undefined, undefined, undefined, mode);
    expect(system.content).toContain('⟦like this⟧');
  });
});

describe('form of address', () => {
  const base = { title: '', headingPath: [], before: 'Wer sie nicht ', after: ', verliert sie.' };

  it.each([
    ['du', '"du"', 'never "Sie"'],
    ['Sie', '"Sie"', 'never "du"']
  ] as const)('states %s before the passage', (address, form, never) => {
    const [, user] = buildMessages('einlöst', { ...base, address });
    const line = user.content.split('\n').find((l) => l.startsWith('Form of address:'))!;
    expect(line).toContain(form);
    expect(line).toContain(never);
    expect(line).toMatch(/If an alternative addresses someone/);
    expect(user.content.indexOf('Form of address:')).toBeLessThan(user.content.indexOf('Context:'));
  });

  it('says nothing when the client could not tell', () => {
    const [, user] = buildMessages('einlöst', base);
    expect(user.content).not.toContain('Form of address');
  });
});

describe('instruction override', () => {
  const english = { title: 'Notes', headingPath: [], before: 'We should ', after: ' sometime next week.' };

  it('replaces a built-in instruction only when given explicitly', () => {
    const [, user] = buildMessages('grab lunch', english, 'plain', undefined, undefined, 'phrase', 'Change as little as possible.');
    expect(user.content).toContain('Style instruction: Change as little as possible.');
    expect(user.content).not.toContain('plainer and more direct');
  });

  it('still never lets a custom chip named "tighter" override the built-in', () => {
    const [, user] = buildMessages('grab lunch', english, 'tighter', undefined, 'Make it longer.');
    expect(user.content).toContain('more concise');
    expect(user.content).not.toContain('Make it longer.');
  });

  it('replaces a custom chip instruction too', () => {
    const [, user] = buildMessages('grab lunch', english, 'custom-id', undefined, 'Make it poetic.', 'phrase', 'Make it rhyme.');
    expect(user.content).toContain('Style instruction: Make it rhyme.');
    expect(user.content).not.toContain('Make it poetic.');
  });

  it('is ignored for "more" and without a modifier', () => {
    for (const modifier of ['more', undefined]) {
      const [, user] = buildMessages('grab lunch', english, modifier, undefined, undefined, 'phrase', 'Make it rhyme.');
      expect(user.content).not.toContain('Make it rhyme.');
    }
  });

  it('exposes the style defaults without the "more" action', () => {
    expect(Object.keys(styleDefaults())).toEqual(['tighter', 'vivid', 'plain']);
    expect(styleDefaults().tighter).toMatch(/more concise/);
  });
});
