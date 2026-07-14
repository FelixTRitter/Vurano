import { describe, it, expect } from 'vitest';
import { validateDarstellung, istHexFarbe } from '../src/modules/einstellungen/validation.js';

describe('Darstellung validieren', () => {
  it('akzeptiert gültiges Schema + Hex-Farbe (normalisiert auf Großschreibung)', () => {
    const r = validateDarstellung({ theme: 'dunkel', akzentfarbe: '#f97316' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.akzentfarbe).toBe('#F97316');
  });
  it('weist unbekannte Schemas und kaputte Farben ab', () => {
    expect(validateDarstellung({ theme: 'neon', akzentfarbe: '#F97316' }).ok).toBe(false);
    expect(validateDarstellung({ theme: 'hell', akzentfarbe: 'orange' }).ok).toBe(false);
    expect(istHexFarbe('#12345')).toBe(false);
  });
});
