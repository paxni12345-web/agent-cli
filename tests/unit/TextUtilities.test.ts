import {
  countTokensApprox,
  detectLanguageFromContent,
  diffTextLines,
  extractCodeBlocks,
  extractUrls,
  fuzzyMatch,
  jsonSafeParse,
  levenshteinDistance,
  maskPII,
  normalizeWhitespace,
  pluralize,
  redactSecretsInText,
  sanitizeHtmlOutput,
  slugify,
  splitByToken,
  stripAnsiCodes,
  templateInterpolate,
  truncateWithEllipsis,
  wordWrap,
  yamlSafeParse,
} from '../../src/utils/TextUtilities.js';

describe('TextUtilities (500-functions category B)', () => {
  it('truncates with an ellipsis and prefers word boundaries', () => {
    expect(truncateWithEllipsis('short', 10)).toBe('short');
    expect(truncateWithEllipsis('hello brave new world', 12)).toBe('hello brave…');
    expect(truncateWithEllipsis('abcdefghij', 5)).toHaveLength(5);
    expect(truncateWithEllipsis('abc', 0)).toBe('');
  });

  it('strips SGR colors, cursor codes and OSC hyperlinks', () => {
    expect(stripAnsiCodes('[31mred[0m plain')).toBe('red plain');
    expect(stripAnsiCodes('[2K[1Gprompt')).toBe('prompt');
    expect(stripAnsiCodes(']8;;https://example.comlink]8;;')).toBe('link');
  });

  it('wraps words and splits overlong words at the width', () => {
    expect(wordWrap('one two three', 7)).toEqual(['one two', 'three']);
    expect(wordWrap('supercalifragilistic', 5)).toEqual(['super', 'calif', 'ragil', 'istic']);
    expect(() => wordWrap('x', 0)).toThrow(/maxWidth/);
  });

  it('computes edit distance and normalized similarity', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('', '')).toBe(0);
    expect(fuzzyMatch('Hello', 'hello')).toBe(1);
    expect(fuzzyMatch('abc', 'xyz')).toBeLessThan(0.5);
  });

  it('interpolates dotted paths and keeps unknown keys', () => {
    expect(templateInterpolate('hi {{ user.name }}!', { user: { name: 'Ada' } })).toBe('hi Ada!');
    expect(templateInterpolate('{{ missing | fallback }}', {})).toBe('fallback');
    expect(templateInterpolate('{{ missing }}', {})).toBe('{{ missing }}');
  });

  it('slugifies unicode titles into url-safe slugs', () => {
    expect(slugify('Café au lait — v2!')).toBe('cafe-au-lait-v2');
    expect(slugify('  Hello__World  ')).toBe('hello-world');
  });

  it('extracts fenced code blocks with their language', () => {
    const markdown = 'docs\n```ts\nconst x = 1;\n```\nmore\n~~~python\nprint(1)\n~~~';
    expect(extractCodeBlocks(markdown)).toEqual([
      { language: 'ts', code: 'const x = 1;' },
      { language: 'python', code: 'print(1)' },
    ]);
  });

  it('redacts API keys, private keys and credential assignments', () => {
    expect(redactSecretsInText('key sk-ant-abcdefghijklmnop rest')).toContain('[REDACTED]');
    expect(redactSecretsInText('token: "secret-value-123"')).not.toContain('secret-value-123');
    expect(redactSecretsInText('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----')).toBe('[REDACTED]');
  });

  it('masks emails and long digit runs while keeping context readable', () => {
    expect(maskPII('contact ada@example.com now')).toBe('contact a***@example.com now');
    expect(maskPII('card 4111 1111 1111 1111')).not.toContain('4111 1111 1111 1111');
  });

  it('collapses whitespace runs and blank-line runs', () => {
    expect(normalizeWhitespace('  a   b\tc  \n\n\n\nnext  ')).toBe('a b c\n\nnext');
  });

  it('splits long text near boundaries and estimates tokens', () => {
    const text = `${'word '.repeat(40)}\n${'x'.repeat(100)}`;
    const chunks = splitByToken(text, 10, 4);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(text);
    expect(countTokensApprox('')).toBe(0);
    expect(countTokensApprox('abcd')).toBe(1);
    expect(() => splitByToken('x', 0)).toThrow(/maxTokens/);
  });

  it('guesses languages from fences and code hints', () => {
    expect(detectLanguageFromContent('```python\nprint(1)\n```')).toBe('python');
    expect(detectLanguageFromContent('interface User {\n  name: string;\n}')).toBe('typescript');
    expect(detectLanguageFromContent('just prose')).toBe('unknown');
  });

  it('removes scripts, handlers and javascript: URLs from HTML', () => {
    const html = '<div onclick="evil()"><script>alert(1)</script><a href="javascript:evil()">x</a>Hi</div>';
    const clean = sanitizeHtmlOutput(html);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Hi');
  });

  it('parses JSON safely and YAML subsets with fallbacks', () => {
    expect(jsonSafeParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(jsonSafeParse('nope', { ok: false })).toEqual({ ok: false });
    expect(yamlSafeParse('name: demo\nenabled: true\ncount: 3\ntags:\n  - a\n  - b\n', {})).toEqual({
      name: 'demo',
      enabled: true,
      count: 3,
      tags: ['a', 'b'],
    });
    expect(yamlSafeParse('::: not yaml :::', { fallback: true })).toEqual({ fallback: true });
  });

  it('extracts URLs without trailing punctuation', () => {
    expect(extractUrls('see https://example.com/a, and http://x.test/b.')).toEqual([
      'https://example.com/a',
      'http://x.test/b',
    ]);
  });

  it('diffs lines with a shared prefix/suffix context', () => {
    expect(diffTextLines('a\nb\nc', 'a\nB\nc')).toEqual([' a', '-b', '+B', ' c']);
  });

  it('pluralizes log nouns with irregular and regular forms', () => {
    expect(pluralize(1, 'file')).toBe('1 file');
    expect(pluralize(2, 'file')).toBe('2 files');
    expect(pluralize(2, 'city')).toBe('2 cities');
    expect(pluralize(2, 'box')).toBe('2 boxes');
    expect(pluralize(3, 'child', 'children')).toBe('3 children');
  });
});
