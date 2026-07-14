/**
 * Tests des zentralen Audit-Logs: sensible Felder werden maskiert,
 * Schreibfehler eskalieren nicht (best effort), korrekte INSERT-Struktur.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));

describe('Audit-Log', () => {
  beforeEach(() => queryMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('schreibt einen Eintrag mit allen Feldern als INSERT', async () => {
    queryMock.mockResolvedValue([]);
    const { auditLog } = await import('../src/audit/log.js');
    await auditLog({
      tabelle: 'kontakte', datensatzId: 42, aktion: 'update',
      actor: { id: 7, name: 'Admin' }, vorher: { a: 1 }, nachher: { a: 2 },
    });
    expect(queryMock).toHaveBeenCalledOnce();
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('INSERT INTO audit_log');
    expect(params[0]).toBe('kontakte');
    expect(params[1]).toBe('42');          // datensatz_id als Text
    expect(params[2]).toBe('update');
    expect(params[3]).toBe(7);             // user_id
    expect(params[4]).toBe('Admin');       // user_name
    expect(JSON.parse(params[5])).toEqual({ a: 1 }); // vorher
    expect(JSON.parse(params[6])).toEqual({ a: 2 }); // nachher
  });

  it('eskaliert Schreibfehler NICHT (best effort)', async () => {
    queryMock.mockRejectedValue(new Error('DB weg'));
    const { auditLog } = await import('../src/audit/log.js');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // darf nicht werfen
    await expect(auditLog({ tabelle: 't', datensatzId: 1, aktion: 'create' })).resolves.toBeUndefined();
  });

  it('maskiert sensible Felder im Snapshot', async () => {
    queryMock.mockResolvedValue([{ id: 1, name: 'Max', password_hash: 'secret', totp_secret: 'abc', email: 'a@b.c' }]);
    const { ladeSnapshot } = await import('../src/audit/log.js');
    const snap = await ladeSnapshot('users', 1) as Record<string, unknown>;
    expect(snap.name).toBe('Max');
    expect(snap.email).toBe('a@b.c');
    expect(snap.password_hash).toBe('***');   // maskiert
    expect(snap.totp_secret).toBe('***');     // maskiert
  });

  it('null bleibt null (kein *** für leere Geheimnisse)', async () => {
    queryMock.mockResolvedValue([{ id: 1, password_hash: null }]);
    const { ladeSnapshot } = await import('../src/audit/log.js');
    const snap = await ladeSnapshot('users', 1) as Record<string, unknown>;
    expect(snap.password_hash).toBeNull();
  });
});
