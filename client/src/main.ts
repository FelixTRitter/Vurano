/**
 * Einstieg der SPA. Auth- und App-Init nach dem Muster von Immo Control
 * (App.init/enterApp), angepasst an das ERP-Backend:
 * - Anmeldung mit E-Mail statt Benutzername
 * - kein Setup-Modus (Benutzer werden per Seed/Verwaltung angelegt)
 * - kein "Beenden"-Knopf (gehosteter Server statt lokaler App)
 */
import { API, el, fmt, Modal, showFatal, qrSvgFor } from './ic/helpers.js';
import { Router, Shell } from './ic/router.js';
import './kontakte.js'; // Adressverwaltung
import './verkaufsartikel.js'; // Vertrieb > Verkaufsartikelstamm
import './teilestamm.js'; // Teilestamm (eigenständiges Modul)
import './mitarbeiter.js'; // Mitarbeiterverwaltung > Mitarbeiter
import './users.js'; // Mitarbeiterverwaltung > User Verwaltung
import './konfiguration.js'; // Konfiguration > Unternehmen / Arbeitszeitmodelle
import './rollen.js'; // Konfiguration > Rollen (Berechtigungen)
import './cruddoku.js'; // Systemverwaltung > CRUD-Dokumentation
import './stammdaten.js'; // Stammdaten > Qualifikation / Funktionen
import './einheiten.js'; // Stammdaten > Einheiten
import './sprachen.js'; // Stammdaten > Sprachen
import './einstellungen.js'; // Einstellungen (Darstellung)
import { APP_VERSION } from './version.js';
import { initNavGroups, syncNavGroups } from './nav.js';
import { applyTheme, setSavedTheme, loadStoredTheme } from './theme.js';
import { updateBranding } from './branding.js';
import { openMeineDaten } from './meine-daten.js';

/* ---------- Platzhalterseiten für die ERP-Module in Aufbau ---------- */
const MODULE: Array<[string, string]> = [
  ['projektabwicklung', 'Projektabwicklung'],
  ['materialwirtschaft', 'Materialwirtschaft'],
  ['produktionsplanung', 'Produktionsplanung'],
  ['warenlieferung', 'Warenlieferung'],
  ['montageverwaltung', 'Montageverwaltung'],
  ['service', 'Service'],
];

// Dashboard: Startseite nach der Anmeldung, Inhalt folgt
Router.register('dashboard', (root: HTMLElement) => {
  root.appendChild(
    el(`<div>
      <div class="page-header"><div><div class="page-title">Dashboard</div></div></div>
    </div>`),
  );
});

initNavGroups();
for (const [page, label] of MODULE) {
  Router.register(page, (root: HTMLElement) => {
    root.appendChild(
      el(`<div class="module-placeholder">
        <div class="page-header"><div><div class="page-title">${fmt.esc(label)}</div></div></div>
        <div class="card"><div class="empty-state">
          <h3>Modul in Aufbau</h3>
          <p>Der Bereich „${fmt.esc(label)}" wird in einer der nächsten Versionen umgesetzt.</p>
        </div></div>
      </div>`),
    );
  });
}

/* ------------------------------ Auth ------------------------------ */
const Auth = {
  show(step: 'login' | 'code' | 'setup' | 'recovery' = 'login'): void {
    document.getElementById('app')!.hidden = true;
    document.getElementById('auth-screen')!.hidden = false;
    for (const name of ['login', 'code', 'setup', 'recovery']) {
      document.getElementById('auth-step-' + name)!.hidden = name !== step;
    }
    this.error('');
  },
  error(msg: string): void {
    const box = document.getElementById('auth-error')!;
    box.textContent = msg;
    box.hidden = !msg;
  },

  /** Schritt 1: Passwort. Antwort entscheidet über Code, Einrichtung oder direkt rein. */
  async submit(): Promise<void> {
    const email = (document.getElementById('auth-username') as HTMLInputElement).value.trim();
    const password = (document.getElementById('auth-password') as HTMLInputElement).value;
    this.error('');
    if (!email || !password) return this.error('Bitte alle Felder ausfüllen.');
    try {
      const r = await API.post('/api/auth/login', { email, password });
      if (r.ok) return this.finish();
      if (r.zweiterFaktor) {
        this.show('code');
        (document.getElementById('auth-code') as HTMLInputElement).focus();
        return;
      }
      // Pflicht-Einrichtung beim ersten Login
      this.show('setup');
      const setup = await API.get('/api/auth/totp/setup');
      document.getElementById('auth-qr')!.innerHTML = qrSvgFor(setup.url);
      document.getElementById('auth-secret')!.textContent = setup.secret;
      (document.getElementById('auth-setup-code') as HTMLInputElement).focus();
    } catch (e: any) {
      this.error(e.message);
    }
  },

  /** Schritt 2a: TOTP- oder Wiederherstellungscode. */
  async submitCode(): Promise<void> {
    const code = (document.getElementById('auth-code') as HTMLInputElement).value;
    const geraetMerken = (document.getElementById('auth-code-merken') as HTMLInputElement).checked;
    this.error('');
    try {
      await API.post('/api/auth/totp', { code, geraetMerken });
      this.finish();
    } catch (e: any) { this.error(e.message); }
  },

  /** Schritt 2b: Erst-Code bestätigt die Einrichtung. */
  async submitSetup(): Promise<void> {
    const code = (document.getElementById('auth-setup-code') as HTMLInputElement).value;
    const geraetMerken = (document.getElementById('auth-setup-merken') as HTMLInputElement).checked;
    this.error('');
    try {
      const r = await API.post('/api/auth/totp/aktivieren', { code, geraetMerken });
      if (r.recoveryCodes?.length) {
        document.getElementById('auth-recovery-codes')!.innerHTML =
          r.recoveryCodes.map((c: string) => `<span>${fmt.esc(c)}</span>`).join('');
        this.show('recovery');
        return;
      }
      this.finish();
    } catch (e: any) { this.error(e.message); }
  },

  async finish(): Promise<void> {
    try {
      const me = await API.get('/api/auth/me');
      await App.applyUserContext(me);
      App.enterApp();
    } catch (e: any) { this.error(e.message); }
  },
};

/* ------------------------------ App ------------------------------ */
const App = {
  async init(): Promise<void> {
    loadStoredTheme(); // zuletzt genutztes Schema — gilt auch für die Anmeldeseite
    document.getElementById('app-version')!.textContent = APP_VERSION;

    document.getElementById('auth-submit')!.addEventListener('click', () => Auth.submit());
    document.getElementById('auth-password')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') Auth.submit();
    });
    document.getElementById('auth-code-submit')!.addEventListener('click', () => Auth.submitCode());
    document.getElementById('auth-code')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') Auth.submitCode();
    });
    document.getElementById('auth-setup-submit')!.addEventListener('click', () => Auth.submitSetup());
    document.getElementById('auth-setup-code')!.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') Auth.submitSetup();
    });
    document.getElementById('auth-recovery-weiter')!.addEventListener('click', () => Auth.finish());

    document.getElementById('btn-logout')!.addEventListener('click', async () => {
      try { await API.post('/api/auth/logout'); } catch (_) { /* ignorieren */ }
      // Sauber neu laden ohne alten URL-Hash (verhindert hängende Detailansichten)
      window.location.href = window.location.pathname;
    });
    document.getElementById('btn-nav-toggle')!.addEventListener('click', () => Shell.toggleNav());

    // Platzhalter — Funktionen werden später umgesetzt
    const folgt = (titel: string) =>
      Modal.open(titel, `<p style="color:var(--text-muted)">Diese Funktion folgt in einer späteren Version.</p>`, { hideOk: true });
    document.getElementById('btn-user-settings')!.title = 'Meine Daten';
    document.getElementById('btn-user-settings')!.addEventListener('click', () => {
      openMeineDaten().catch((e: any) => alert(e.message));
    });
    document.getElementById('btn-arbeitszeit')!.addEventListener('click', () => folgt('Arbeitszeitanmeldung'));
    (document.getElementById('global-suche') as HTMLInputElement).addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') folgt('Suche');
    });

    // Status prüfen; Darstellung des Benutzers anwenden
    try {
      const me = await API.get('/api/auth/me');
      await this.applyUserContext(me);
      this.enterApp();
    } catch (_) {
      Auth.show();
    }
  },

  /** Nach erfolgreichem Login: Darstellung, "Angemeldet als", Firmen-Branding. */
  async applyUserContext(me: any): Promise<void> {
    setSavedTheme(me.theme, me.akzentfarbe);
    document.getElementById('whoami')!.textContent = `Angemeldet als ${me.name}`;
    // Navigation nach den tatsächlich freigegebenen Modulen der Zugriffsrolle
    // filtern. Der Admin bekommt vom Server alle Module; eine normale Rolle
    // nur die in ihr angehakten (plus 'einstellungen' als persönlicher Bereich).
    // (Sichtbarkeit in der Navigation; der endgültige Schutz der API-Endpunkte
    // ist der nächste Ausbauschritt — siehe Hinweis unten.)
    const erlaubt = new Set<string>(Array.isArray(me.module) ? me.module : []);
    // Nicht-Admin: Guard im Router aktivieren, damit auch direkte URLs auf
    // gesperrte Module umgeleitet werden. Admin sieht alle Module ohnehin.
    if (me.role !== 'admin') (Router as any).setErlaubteModule(erlaubt);
    document.querySelectorAll('.nav-link[data-page]').forEach((link) => {
      const key = (link as HTMLElement).dataset.page!;
      const li = link.closest('li');
      if (li) (li as HTMLElement).hidden = !erlaubt.has(key);
    });
    // Gruppen ohne sichtbares Submodul ganz ausblenden.
    document.querySelectorAll('.nav-group').forEach((g) => {
      const sichtbar = [...g.querySelectorAll('.nav-sub-link[data-page]')]
        .some((l) => erlaubt.has((l as HTMLElement).dataset.page!));
      (g as HTMLElement).hidden = !sichtbar;
    });
    try {
      updateBranding(await API.get('/api/konfiguration/firma'));
    } catch {
      updateBranding(null);
    }
  },

  enterApp(): void {
    try {
      document.getElementById('auth-screen')!.hidden = true;
      document.getElementById('app')!.hidden = false;
      Router.init();
      setTimeout(syncNavGroups, 0);
    } catch (e: any) {
      showFatal('Start fehlgeschlagen: ' + e.message);
    }
  },
};

App.init();
