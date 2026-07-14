/**
 * Legt den ersten Admin-Benutzer an (idempotent).
 * Aufruf: npm run seed  (ADMIN_EMAIL / ADMIN_PASSWORD aus .env oder Umgebung)
 */
import bcrypt from 'bcryptjs';
import { query, pool } from './db.js';
import { migrate } from './migrate.js';

const email = (process.env.ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? 'change-me';

await migrate();
const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
if (existing.length > 0) {
  console.log(`Benutzer ${email} existiert bereits — nichts zu tun.`);
} else {
  const hash = await bcrypt.hash(password, 12);
  await query(
    "INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Administrator', $2, 'admin')",
    [email, hash],
  );
  console.log(`Admin angelegt: ${email}`);
}
await pool.end();
