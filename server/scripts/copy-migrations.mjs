/**
 * BUILD-HELFER: MIGRATIONEN NACH dist/ KOPIEREN
 * ---------------------------------------------------------------
 * tsc kompiliert nur .ts-Dateien; die .sql-Migrationen müssen
 * separat nach dist/migrations. Bewusst als Node-Skript statt
 * rm/cp, damit der Build auf Windows UND Linux identisch läuft
 * (siehe CLAUDE.md: Skripte plattformneutral).
 */
import { rmSync, cpSync } from 'node:fs';

rmSync('dist/migrations', { recursive: true, force: true });
cpSync('src/migrations', 'dist/migrations', { recursive: true });
console.log('Migrationen nach dist/migrations kopiert.');
