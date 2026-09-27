import { describe, expect, it } from 'vitest';
import { buildMessages } from './prompt';

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

  it('never lets a custom instruction override a built-in modifier', () => {
    const [, user] = buildMessages(GERMAN_SELECTION, GERMAN_CONTEXT, 'tighter', undefined, 'Make it longer.');
    expect(user.content).toContain('more concise');
    expect(user.content).not.toContain('Make it longer.');
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
    const order = ['Document: Mein Roman', 'Section: Kapitel 2 › Der Bahnhof', 'Context:', 'Selected phrase:', 'Additional instruction:', 'Already suggested'];
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
