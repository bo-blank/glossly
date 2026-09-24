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
