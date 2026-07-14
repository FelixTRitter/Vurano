import { describe, it, expect } from 'vitest';
import { sanitizeDateiname } from '../src/modules/mitarbeiter/dokumente.js';

describe('sanitizeDateiname', () => {
  it('entfernt Pfadbestandteile (Path-Traversal-Schutz)', () => {
    expect(sanitizeDateiname('../../etc/passwd')).toBe('passwd');
    expect(sanitizeDateiname('C:\\geheim\\lohn.pdf')).toBe('lohn.pdf');
  });
  it('entfernt Steuerzeichen und fängt Leernamen ab', () => {
    expect(sanitizeDateiname('a\u0000b.pdf')).toBe('ab.pdf');
    expect(sanitizeDateiname('   ')).toBe('unbenannt');
    expect(sanitizeDateiname(null)).toBe('unbenannt');
  });
  it('lässt normale Namen mit Umlauten unangetastet', () => {
    expect(sanitizeDateiname('Arbeitsvertrag Müller 2026.pdf')).toBe('Arbeitsvertrag Müller 2026.pdf');
  });
});
