import { describe, expect, it } from 'vitest';
import { classifyHost, MAX_CONTEXT_CHARS } from '@glossly/shared';
import { parseContext, parseInstruction, parseProtectedTerms, parseTemperature, validateLocalBaseUrl } from './validate';

const valid = { title: 'T', headingPath: ['A', 'B'], before: 'vorher ', after: ' nachher' };

describe('parseContext', () => {
  it('accepts a string from older clients, and a missing context', () => {
    expect(parseContext('Kontext')).toBe('Kontext');
    expect(parseContext(undefined)).toBe('');
  });

  it('accepts the structured shape and drops unknown fields', () => {
    expect(parseContext({ ...valid, extra: 'x' })).toEqual(valid);
  });

  it.each([
    ['a number', 42],
    ['an array', ['a']],
    ['a missing field', { title: 'T', headingPath: [], before: '' }],
    ['a non-string heading', { ...valid, headingPath: ['A', 3] }],
    ['too many headings', { ...valid, headingPath: ['1', '2', '3', '4', '5', '6', '7'] }],
    ['a non-string title', { ...valid, title: null }]
  ])('rejects %s', (_label, raw) => {
    expect(parseContext(raw)).toBeNull();
  });

  it('accepts only du or Sie as the form of address', () => {
    expect(parseContext({ ...valid, address: 'du' })).toEqual({ ...valid, address: 'du' });
    expect(parseContext({ ...valid, address: 'Sie' })).toEqual({ ...valid, address: 'Sie' });
    expect(parseContext({ ...valid, address: 'ihr' })).toBeNull();
    expect(parseContext({ ...valid, address: 1 })).toBeNull();
  });

  it('caps the total size', () => {
    const half = 'x'.repeat(MAX_CONTEXT_CHARS / 2);
    expect(parseContext({ ...valid, title: '', headingPath: [], before: half, after: half })).not.toBeNull();
    expect(parseContext({ ...valid, title: 'T', headingPath: [], before: half, after: half })).toBeNull();
    expect(parseContext('x'.repeat(MAX_CONTEXT_CHARS + 1))).toBeNull();
  });
});

describe('parseTemperature', () => {
  it.each([0, 0.2, 0.8, 1.5])('accepts %s', (t) => expect(parseTemperature(t)).toBe(t));
  it('is undefined when absent', () => expect(parseTemperature(undefined)).toBeUndefined());
  it.each([-0.1, 1.6, Number.NaN, Infinity, '0.8', null, true])('rejects %s', (t) => expect(parseTemperature(t)).toBeNull());
});

describe('parseInstruction', () => {
  it('accepts a string up to 300 characters', () => {
    expect(parseInstruction('Keep it short.')).toBe('Keep it short.');
    expect(parseInstruction('x'.repeat(300))).toHaveLength(300);
  });
  it('is undefined when absent', () => expect(parseInstruction(undefined)).toBeUndefined());
  it.each(['', '   ', 'x'.repeat(301), 42, null, ['a']])('rejects %s', (raw) => expect(parseInstruction(raw)).toBeNull());
});

describe('classifyHost', () => {
  it.each(['http://localhost:8080/v1', 'http://LOCALHOST', 'http://127.0.0.1:8080/v1', 'http://127.1.2.3', 'http://[::1]:8080', 'https://localhost', 'http://2130706433/'])(
    '%s → loopback',
    (url) => expect(classifyHost(url)).toBe('loopback')
  );
  it.each(['http://10.0.0.5:11434', 'http://192.168.1.20:8080/v1', 'http://172.16.0.1', 'http://172.31.255.255'])('%s → private', (url) =>
    expect(classifyHost(url)).toBe('private')
  );
  it.each([
    'http://172.32.0.1',
    'http://172.15.0.1',
    'http://localhost.example.com',
    'http://127.0.0.1.nip.io',
    'http://example.com',
    'http://0.0.0.0:8080',
    'ftp://127.0.0.1',
    'file:///etc/passwd',
    'http://::1/',
    'not a url',
    ''
  ])('%s → null', (url) => expect(classifyHost(url)).toBeNull());
});

describe('validateLocalBaseUrl', () => {
  it('passes local and private URLs through unchanged', () => {
    expect(validateLocalBaseUrl('http://127.0.0.1:8080/v1')).toBe('http://127.0.0.1:8080/v1');
    expect(validateLocalBaseUrl('http://192.168.1.20:8080/v1/')).toBe('http://192.168.1.20:8080/v1/');
  });
  it.each(['http://example.com/v1', 'http://169.254.169.254/latest', 42, undefined, null, ''])('rejects %s', (url) =>
    expect(validateLocalBaseUrl(url)).toBeNull()
  );
});

describe('parseProtectedTerms', () => {
  it('accepts up to 30 words of up to 40 characters', () => {
    expect(parseProtectedTerms(['Anna', 'Quellwerk'])).toEqual(['Anna', 'Quellwerk']);
    expect(parseProtectedTerms(Array.from({ length: 30 }, (_, i) => `w${i}`))).toHaveLength(30);
    expect(parseProtectedTerms(['x'.repeat(40)])).toHaveLength(1);
  });
  it('is undefined when absent', () => expect(parseProtectedTerms(undefined)).toBeUndefined());
  it.each([
    ['too many', Array.from({ length: 31 }, (_, i) => `w${i}`)],
    ['too long', ['x'.repeat(41)]],
    ['blank', ['Anna', '  ']],
    ['not strings', ['Anna', 7]],
    ['not an array', 'Anna'],
    ['null', null]
  ])('rejects %s', (_name, raw) => expect(parseProtectedTerms(raw)).toBeNull());
});
