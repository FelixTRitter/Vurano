import { describe, it, expect } from 'vitest';
import { totpCode, verifyTotp, base32Decode, generateSecret, generateRecoveryCode, otpauthUrl } from '../src/auth/totp.js';
import { createLimiter } from '../src/auth/ratelimit.js';

// RFC-6238-Referenzgeheimnis: ASCII "12345678901234567890" in Base32
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP (RFC 6238, Anhang B)', () => {
  it('reproduziert die offiziellen Testvektoren (6-stellig)', () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe('287082');            // T=59s -> 94287082
    expect(totpCode(RFC_SECRET, 1111111109_000)).toBe('081804');    // -> 07081804
    expect(totpCode(RFC_SECRET, 1234567890_000)).toBe('005924');    // -> 89005924
  });
  it('verifyTotp toleriert ±1 Zeitschritt, sonst nicht', () => {
    const code = totpCode(RFC_SECRET, 1000 * 30_000);
    expect(verifyTotp(RFC_SECRET, code, 1000 * 30_000 + 29_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, 1000 * 30_000 + 61_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abc123', 0)).toBe(false);
  });
  it('Base32-Roundtrip und Geheimnis-Format', () => {
    expect(base32Decode(RFC_SECRET).toString('ascii')).toBe('12345678901234567890');
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateRecoveryCode()).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    expect(otpauthUrl('a@b.de', 'ABC')).toContain('otpauth://totp/');
  });
});

describe('Rate-Limiter', () => {
  it('blockiert nach maxVersuche im Fenster und erholt sich danach', () => {
    const l = createLimiter({ maxVersuche: 3, fensterMs: 1000 });
    const t = 1_000_000;
    expect(l.blockiert('k', t)).toBe(false);
    l.fehlversuch('k', t); l.fehlversuch('k', t); l.fehlversuch('k', t);
    expect(l.blockiert('k', t + 10)).toBe(true);
    expect(l.blockiert('k', t + 1500)).toBe(false); // Fenster abgelaufen
  });
  it('Erfolg setzt zurück', () => {
    const l = createLimiter({ maxVersuche: 2, fensterMs: 1000 });
    l.fehlversuch('k'); l.fehlversuch('k');
    expect(l.blockiert('k')).toBe(true);
    l.erfolg('k');
    expect(l.blockiert('k')).toBe(false);
  });
});
