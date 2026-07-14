/* Portiert 1:1 aus Immo Control public/app.js (Router + Shell).
   Änderungen: ES-Modul-Imports/Exports; Standardseite 'kontakte' statt
   'dashboard' (Dashboard existiert im ERP noch nicht); Detail-Basen leer. */
import { el, fmt, showFatal } from './helpers.js';

/* ----------------------------- Router ----------------------------- */
const Router = {
  pages: {},
  _current: null,
  // Basis-Seiten ohne eigenen Nav-Eintrag auf den passenden Nav-Punkt abbilden
  _navAlias: {},
  register(name, renderFn) { this.pages[name] = renderFn; },
  // Bases, die bei vorhandener ID (bzw. immer) eine Detailansicht mit Kontextleiste öffnen
  _detailBases: ['mitarbeiter', 'kontakte', 'rollen', 'verkaufsartikel'],
  _isDetail(hash) {
    const parts = (hash || '').slice(1).split('/');
    const base = parts[0];
        return this._detailBases.includes(base) && parts.length > 1 && parts[1] !== '';
  },
  _renderHash(hash) {
    hash = hash || '#dashboard';
    let base = hash.slice(1).split('/')[0];
    // Zugriffs-Guard: Steht eine Erlaubnisliste bereit (Nicht-Admin mit
    // eingeschränkten Modulrechten), dürfen nur freigegebene Module geöffnet
    // werden — auch nicht per direkter URL. Sonst Umleitung auf die erste
    // erlaubte Seite. (Der endgültige API-Schutz folgt serverseitig.)
    if (this._erlaubteModule && base && !this._erlaubteModule.has(base) && this.pages[base]) {
      const ziel = this._erlaubteModule.has('dashboard') ? 'dashboard'
        : (this._ersteErlaubteSeite() || 'einstellungen');
      hash = '#' + ziel;
      base = ziel;
      if (location.hash !== hash) location.hash = hash;
    }
    const name = this.pages[base] ? base : 'dashboard';
    this._current = hash;
    if (this._isDetail(hash)) Shell.softReset(); else Shell.exitDetail();
    const navName = this._navAlias[base] || (this.pages[base] ? base : name);
    const link = Array.from(document.querySelectorAll('.nav-link')).find(a => a.dataset.page === navName);
    if (link) document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a === link));
    const content = document.getElementById('content');
    content.innerHTML = '';
    const detailParam = hash.slice(1).split('/').slice(1).join('/') || undefined;
    Promise.resolve(this.pages[name](content, detailParam)).catch(err => showFatal('Seite "' + name + '" konnte nicht geladen werden: ' + err.message));
  },
  // Erlaubnisliste setzen (vom App-Kontext nach dem Login). Ohne Aufruf gilt
  // keine Einschränkung (z. B. für den Admin, der ohnehin alles darf).
  setErlaubteModule(keys) { this._erlaubteModule = keys instanceof Set ? keys : new Set(keys || []); },
  _ersteErlaubteSeite() {
    for (const a of document.querySelectorAll('.nav-link[data-page]')) {
      const k = a.dataset.page;
      if (this._erlaubteModule.has(k) && this.pages[k]) return k;
    }
    return null;
  },
  // Navigation MIT History-Eintrag (Browser „zurück" funktioniert) + sofortiges Rendern
  navigate(hash) {
    if (location.hash !== hash) location.hash = hash; // erzeugt History-Eintrag
    this._renderHash(hash);
  },
  go(name) { if (!name) return; this.navigate('#' + name); },
  init() {
    document.querySelectorAll('.nav-link').forEach(a => {
      // Gruppenköpfe haben kein data-page — sie klappen nur auf/zu (main.ts)
      if (!a.dataset.page) return;
      a.addEventListener('click', (e) => { e.preventDefault(); this.go(a.dataset.page); });
    });
    // Browser Zurück/Vorwärts: nur rendern, wenn sich der Hash gegenüber dem
    // zuletzt gerenderten Stand geändert hat (verhindert Doppel-Render bei navigate()).
    window.addEventListener('hashchange', () => {
      if (location.hash !== this._current) this._renderHash(location.hash);
    });
    this._renderHash(location.hash || '#dashboard');
  }
};

/* --------------------------- App-Hülle (Navigation + Kontext-Leiste) --------------------------- */
const Shell = {
  navCollapsed: false,
  _app() { return document.getElementById('app'); },
  _panel() { return document.getElementById('context-panel'); },
  _panel2() { return document.getElementById('context-panel-2'); },
  // Inhalt erst nach der Ausfahr-Transition leeren (verhindert stehengebliebene, unsichtbare Elemente)
  _clearLater(panel) { if (!panel) return; setTimeout(() => { if (panel.classList.contains('rail-off')) panel.innerHTML = ''; }, 260); },
  // Wechsel Detail -> Detail: nur eine evtl. laufende Stufen-Transition abbrechen; Navigation bleibt eingeklappt
  softReset() { this._seq = (this._seq || 0) + 1; },
  setCollapsed(v) { this.navCollapsed = !!v; const a = this._app(); if (a) a.classList.toggle('nav-collapsed', this.navCollapsed); },
  toggleNav() { this.setCollapsed(!this.navCollapsed); },
  // Ebene 2: Kontext-Leiste füllen, Hauptnavigation einklappen, evtl. Ebene 3 zurücksetzen
  enterDetail(node) {
    const p = this._panel(); if (!p) return;
    const p3 = this._panel2();
    this._seq = (this._seq || 0) + 1;
    p.classList.remove('rail-collapsed', 'rail-off', 'rail-fading', 'rail-anim-in');
    p.removeAttribute('hidden');
    p.innerHTML = '';
    p.appendChild(typeof node === 'string' ? el(`<div>${node}</div>`) : node);
    void p.offsetWidth; p.classList.add('rail-anim-in');
    if (p3) { p3.classList.add('rail-off'); p3.classList.remove('rail-anim-in'); p3.removeAttribute('hidden'); this._clearLater(p3); }
    const a = this._app();
    a.classList.add('detail-mode');
    a.classList.remove('detail-mode-2');
    this.setCollapsed(true);
  },
  // Ebene 3 (gestaffelt): 1) Text in Leiste 2 ausblenden 2) vertikaler Text + Leiste 2 einfahren / Leiste 3 ausfahren 3) Leiste-3-Inhalt von rechts einblenden
  enterDetail2(spineLabel, onSpineClick, node, spineSub) {
    const p = this._panel(), p3 = this._panel2(); if (!p || !p3) return;
    const seq = this._seq = (this._seq || 0) + 1;
    const a = this._app();
    a.classList.add('detail-mode');
    this.setCollapsed(true);
    // Stufe 1: aktuellen Inhalt der zweiten Leiste ausblenden (Breite bleibt noch voll)
    p.removeAttribute('hidden');
    p.classList.remove('rail-off', 'rail-anim-in');
    p.classList.add('rail-fading');
    setTimeout(() => {
      if (this._seq !== seq) return;
      // Stufe 2: vertikaler Text + gleichzeitig Leiste 2 einfahren und Leiste 3 ausfahren
      p.innerHTML = '';
      const spine = el(`<button class="rail-spine" title="Zurück">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span class="rail-spine-label">${fmt.esc(spineLabel || '')}</span>
        ${spineSub ? `<span class="rail-spine-sub">${fmt.esc(spineSub)}</span>` : ''}
      </button>`);
      if (onSpineClick) spine.addEventListener('click', onSpineClick);
      p.appendChild(spine);
      p.classList.remove('rail-fading');
      p.classList.add('rail-collapsed');
      // Stufe 3: dritte Leiste ausfahren, Inhalt von rechts einblenden
      p3.removeAttribute('hidden');
      p3.classList.remove('rail-anim-in');
      p3.innerHTML = '';
      p3.appendChild(typeof node === 'string' ? el(`<div>${node}</div>`) : node);
      void p3.offsetWidth; p3.classList.add('rail-anim-in');
      p3.classList.remove('rail-off');
      a.classList.add('detail-mode-2');
    }, 130);
  },
  // Zur Listen-/Modulansicht zurück: beide Kontext-Leisten ausblenden, Navigation ausklappen
  exitDetail() {
    const p = this._panel(), p3 = this._panel2(); if (!p) return;
    if (p.classList.contains('rail-off') && !this._app().classList.contains('detail-mode')) return;
    this._seq = (this._seq || 0) + 1;
    p.classList.add('rail-off');
    p.classList.remove('rail-collapsed', 'rail-fading', 'rail-anim-in');
    p.removeAttribute('hidden');
    this._clearLater(p);
    if (p3) { p3.classList.add('rail-off'); p3.classList.remove('rail-anim-in'); p3.removeAttribute('hidden'); this._clearLater(p3); }
    const a = this._app();
    a.classList.remove('detail-mode', 'detail-mode-2');
    this.setCollapsed(false);
  }
};

export { Router, Shell };
