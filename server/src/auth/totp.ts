/**
 * TOTP (Time-based One-Time Password, RFC 6238) — ohne Fremdbibliothek,
 * direkt auf node:crypto. Server und Authenticator-App teilen sich ein
 * Base32-Geheimnis und berechnen daraus im 30-Sekunden-Takt denselben
 * sechsstelligen Code (HMAC-SHA1 über den Zeitschritt-Zähler).
 * verifyTotp akzeptiert ±1 Zeitschritt (Uhrenabweichung Handy/Server).
 * Getestet gegen die offiziellen Testvektoren aus RFC 6238 Anhang B.
 */
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Neues Geheimnis: 20 Zufallsbytes, Base32-kodiert (Standard der Apps). */
export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = 0, wert = 0, out = '';
  for (const b of bytes) {
    wert = (wert << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(wert >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(wert << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const sauber = s.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0, wert = 0;
  const out: number[] = [];
  for (const c of sauber) {
    const idx = B32.indexOf(c);
    if (idx < 0) throw new Error('Ungültiges Base32-Zeichen');
    wert = (wert << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((wert >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Sechsstelliger Code für einen Zeitpunkt (Default: jetzt). */
export function totpCode(secret: string, zeitpunktMs: number = Date.now(), schrittSekunden = 30): string {
  const zaehler = Math.floor(zeitpunktMs / 1000 / schrittSekunden);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(zaehler));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** Code prüfen; toleriert ±1 Zeitschritt. */
export function verifyTotp(secret: string, code: unknown, zeitpunktMs: number = Date.now()): boolean {
  const c = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  return [-1, 0, 1].some((drift) => totpCode(secret, zeitpunktMs + drift * 30_000) === c);
}

/** otpauth-Adresse für den QR-Code (funktioniert mit jeder Standard-App). */
export function otpauthUrl(email: string, secret: string): string {
  const issuer = encodeURIComponent('Vurano ERP');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
}

/** Wiederherstellungscode "XXXX-XXXX" (A-Z, 2-7 — keine 0/O/1/I-Verwechsler). */
export function generateRecoveryCode(): string {
  const teil = () => Array.from(crypto.randomBytes(4)).map((b) => B32[b % 32]).join('');
  return `${teil()}-${teil()}`;
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase().trim()).digest('hex');
}
