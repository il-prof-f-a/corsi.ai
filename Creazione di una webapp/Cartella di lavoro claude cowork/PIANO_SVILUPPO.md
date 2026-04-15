# Piano di Sviluppo — Task Manager Kanban con PWA

> Versione aggiornata con le scelte definitive del committente.

---

## Stack Tecnologico

| Layer | Tecnologia | Motivazione |
|---|---|---|
| Backend | Node.js + Express | Leggero, ideale per API REST locali |
| Database | SQLite cifrato via `better-sqlite3-multiple-ciphers` | File singolo protetto da password (SQLCipher) |
| Sessioni | `express-session` | Mantiene la sessione autenticata nel browser |
| Frontend | HTML + CSS + JavaScript vanilla | Nessun build tool, avvio immediato |
| i18n | JSON locale (`it`, `en`, estendibile) | Multilingua senza dipendenze esterne |
| PWA | Service Worker + Web App Manifest | Installabile da browser, funziona offline |
| Drag & Drop | SortableJS (CDN) | Matura, accessibile, mobile-friendly |

---

## Struttura del Progetto

```
kanban-app/
├── server.js                  # Server Express + middleware autenticazione
├── database.js                # Apertura DB cifrato + migrazioni
├── package.json
├── routes/
│   ├── auth.js                # Login / logout (password ↔ chiave SQLCipher)
│   ├── projects.js            # CRUD progetti
│   ├── columns.js             # CRUD colonne kanban
│   ├── tasks.js               # CRUD task + timer
│   ├── collaborators.js       # CRUD collaboratori
│   └── export.js              # Export JSON + download file SQLite
└── public/
    ├── index.html             # SPA single-page
    ├── style.css              # Stili + responsive
    ├── app.js                 # Logica frontend (router, state, i18n)
    ├── locales/
    │   ├── it.json            # Stringhe italiano
    │   └── en.json            # Stringhe inglese
    ├── manifest.json          # PWA manifest
    ├── sw.js                  # Service Worker per offline
    └── icons/                 # Icone PWA (192px, 512px)
```

---

## Autenticazione — Login con Password SQLite

### Flusso
1. L'app si avvia → il file `data.db` è cifrato con SQLCipher
2. Il browser mostra la schermata di login con campo password
3. Il frontend invia la password al backend (`POST /api/auth/login`)
4. Il backend tenta di aprire `data.db` con quella chiave SQLCipher
5. Se OK → crea sessione Express autenticata → redirect all'app
6. Se KO → messaggio "Password errata"
7. Tutte le route API sono protette da middleware `requireAuth`
8. Logout → distrugge la sessione + chiude il DB (richiede re-login)

### Prima configurazione
- Al primo avvio (DB non esistente) → wizard di setup: scegli password → crea DB cifrato
- La password non viene salvata da nessuna parte: è solo la chiave SQLCipher

> **Nota di sicurezza**: il file `data.db` è inutilizzabile senza la password. Non esiste reset password (per design: sicurezza locale).

---

## Modello Dati (SQLite)

### Tabella `projects`
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nome progetto |
| description | TEXT | Descrizione opzionale |
| color | TEXT | Colore hex per badge visivo |
| deadline | DATE | Scadenza opzionale |
| created_at | DATETIME | Auto |

### Tabella `columns`
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| project_id | INTEGER FK | |
| name | TEXT | Es. "TODO", "IN WORKING", "DONE" |
| position | INTEGER | Ordine visualizzazione |
| color | TEXT | Colore intestazione colonna |

### Tabella `collaborators`
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Nome e cognome |
| role | TEXT | Ruolo opzionale (es. "Developer") |
| avatar_color | TEXT | Colore avatar iniziali |

### Tabella `tasks`
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| column_id | INTEGER FK | Colonna corrente |
| project_id | INTEGER FK | |
| title | TEXT | Obbligatorio |
| description | TEXT | |
| color | TEXT | Colore card (indicatore visivo) |
| priority | TEXT | `low` / `medium` / `high` |
| assigned_to | INTEGER FK | → collaborators.id (chi esegue) |
| **assigned_by** | **INTEGER FK** | **→ collaborators.id (chi ha assegnato in riunione)** |
| estimated_hours | REAL | Ore stimate |
| actual_hours | REAL | Ore effettive cumulate (include timer) |
| timer_started_at | DATETIME | NULL se timer fermo, timestamp se in corso |
| due_date | DATE | Scadenza task |
| position | INTEGER | Ordine nella colonna |
| created_at | DATETIME | Auto |
| completed_at | DATETIME | Settato automaticamente quando → colonna DONE |

> **`assigned_by`**: registra il collaboratore che ha proposto/assegnato il task durante la riunione di brainstorming. Campo opzionale, distinto da `assigned_to`.

### Tabella `task_time_logs` *(per storico sessioni timer)*
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | |
| task_id | INTEGER FK | |
| started_at | DATETIME | |
| stopped_at | DATETIME | NULL se sessione ancora aperta |
| duration_minutes | REAL | Calcolato alla chiusura |

---

## Funzionalità per Schermata

### Schermata 0 — Login
- [ ] Campo password + pulsante "Accedi"
- [ ] Primo avvio: wizard "Crea nuovo database" con scelta password
- [ ] Animazione shake su password errata
- [ ] Selettore lingua (IT / EN) già disponibile in questa schermata

### Schermata 1 — Lista Progetti (`/`)
- [ ] Griglia card con nome, colore, deadline, contatori task (totale / completate)
- [ ] Barra progresso task completate per ogni progetto
- [ ] Pulsante "Nuovo progetto" con form modale
- [ ] Edit/Delete su ogni card (tooltip al hover)
- [ ] Indicatore scadenza: verde / arancio / rosso in base alla vicinanza
- [ ] Menu hamburger o toolbar con: Collaboratori · Lingua · Export · Logout

### Schermata 2 — Kanban Board (`/project/:id`)
- [ ] Header: nome progetto + breadcrumb + pulsanti azione
- [ ] 3 colonne auto-create alla creazione del progetto: TODO · IN WORKING · DONE
- [ ] Scroll orizzontale con colonne affiancate
- [ ] Pulsante "+ Aggiungi colonna" sempre visibile a destra
- [ ] Edit/Delete colonna (warning se contiene task)
- [ ] Drag & drop task tra colonne (SortableJS)
- [ ] Drag & drop riordino colonne
- [ ] Contatore task per colonna
- [ ] Filtri rapidi: per collaboratore / per priorità / task in ritardo

### Componente Task Card
- [ ] Bordo sinistro colorato (colore scelto dall'utente)
- [ ] Titolo + descrizione troncata (espandibile al click)
- [ ] Avatar **"assegnato a"** + avatar **"assegnato da"** (con tooltip nome)
- [ ] Badge scadenza (con colore urgenza)
- [ ] Badge priorità (icona + testo)
- [ ] Indicatore ore: stimate vs effettive
- [ ] **Pulsante timer** ▶/⏸ sulla card (avvia/ferma conteggio tempo)
- [ ] Indicatore visivo "timer attivo" (bordo pulsante animato)
- [ ] Azioni al hover: ✏️ Modifica · 🗂 Sposta · 🗑 Elimina (con tooltip)

### Modale Task (crea/modifica)
- [ ] Titolo (obbligatorio)
- [ ] Descrizione (textarea)
- [ ] Selettore colore card (palette 8 colori)
- [ ] Priorità: Bassa / Media / Alta
- [ ] **Assegnato a**: dropdown collaboratori (chi esegue)
- [ ] **Assegnato da**: dropdown collaboratori (chi ha assegnato in riunione)
- [ ] Ore stimate
- [ ] Ore effettive (aggiornate automaticamente dal timer o inseribili manualmente)
- [ ] Storico sessioni timer (collassabile)
- [ ] Data scadenza
- [ ] Colonna (modificabile come alternativa al drag)

### Gestione Collaboratori (modale da toolbar)
- [ ] Lista con avatar, nome, ruolo e contatore task attive
- [ ] Aggiungi / Modifica / Elimina (con warning se ha task assegnate)

### Export (modale da toolbar)
- [ ] Export tutto in JSON (struttura gerarchica: progetti → colonne → task)
- [ ] Download file `data.db` (copia del database SQLite cifrato)
- [ ] Indicazione: "Il file .db richiede la stessa password per essere aperto"

---

## Timer Real-Time

- Click ▶ su una card → salva `timer_started_at = NOW()` nel DB
- Il frontend mostra un contatore che incrementa ogni secondo (calcola `NOW - timer_started_at`)
- Click ⏸ → calcola la durata, aggiorna `actual_hours`, inserisce riga in `task_time_logs`, azzera `timer_started_at`
- Se il server viene riavviato con timer attivi → al prossimo caricamento il frontend li rileva e li ripristina
- Solo una task per volta può avere il timer attivo *(opzionale: configurabile)*

---

## i18n — Multilingua

- Stringhe UI in `public/locales/it.json` e `public/locales/en.json`
- Selettore lingua nella toolbar (e nella schermata di login)
- La scelta viene salvata in `localStorage`
- Struttura estendibile: aggiungere `fr.json`, `de.json` ecc. senza toccare il codice

---

## UX / Accessibilità

- **Tooltip** custom CSS su tutti i pulsanti icona (non solo `title=""`)
- **Colori semantici**: rosso = urgente/elimina, verde = OK/completato, giallo = attenzione
- **Feedback visivo**: toast notification su salvataggio/errore (angolo in basso a destra)
- **Conferma eliminazione**: modale dedicato, non `window.confirm()`
- **Stato vuoto**: placeholder illustrativo + call-to-action
- **Keyboard navigation**: Esc chiude i modali, Tab naviga i form

---

## Responsive Design

| Breakpoint | Layout |
|---|---|
| Desktop (>1024px) | Colonne kanban affiancate con scroll orizzontale |
| Tablet (768–1024px) | Colonne scorrevoli con scroll snap |
| Mobile (<768px) | Una colonna per volta + selettore colonna in alto + swipe |

---

## PWA — Progressive Web App

1. **`manifest.json`**: nome app, icone, `display: standalone`, colore tema, `start_url: /`
2. **`sw.js`** (Service Worker):
   - Cache-first per HTML, CSS, JS, icone
   - Network-first per chiamate API (fallback su cache se offline)
3. **Icone**: SVG base convertita in 192×192 e 512×512 PNG
4. **Install prompt**: banner "Installa l'app" che intercetta `beforeinstallprompt`

> Il file SQLite è sul server locale. La PWA funziona pienamente con il server attivo; offline mostra i dati in cache ma non permette modifiche.

---

## Fasi di Sviluppo (aggiornate)

### ✅ Fase 1 — Backend & Database cifrato
1. ✅ Setup `package.json` + dipendenze (`express`, `better-sqlite3-multiple-ciphers`, `express-session`)
2. ✅ `database.js`: apertura DB cifrato + creazione tabelle + seed dati esempio
3. ✅ `routes/auth.js`: login, logout, primo setup
4. ✅ Middleware `requireAuth` su tutte le route API in `server.js`
5. ✅ API REST: progetti, colonne, task (con `assigned_by`), collaboratori, export

### ✅ Fase 2 — Frontend Base + Login
6. ✅ Schermata login + wizard primo avvio (`index.html`)
7. ✅ Lista progetti con barra progresso e card colorate
8. ✅ Kanban board con colonne e task (`app.js` + `style.css`)

### ✅ Fase 3 — CRUD Completo + i18n
9. ✅ Modali task (con `assigned_to` + `assigned_by`)
10. ✅ Gestione collaboratori (modale con CRUD)
11. ✅ Filtri rapidi sulla board (collaboratore, priorità, in ritardo)
12. ✅ Sistema i18n IT + EN (`locales/it.json`, `locales/en.json`)

### ✅ Fase 4 — Timer & Export
13. ✅ Timer real-time su card + storico sessioni (`task_time_logs`)
14. ✅ Export JSON strutturato
15. ✅ Download file `.db` cifrato

### ✅ Fase 5 — PWA & Responsive
16. ✅ `manifest.json` + icona SVG
17. ✅ `sw.js` Service Worker (cache-first assets, network-first API)
18. ✅ CSS responsive (desktop/tablet/mobile con scroll snap)
19. ✅ Install prompt personalizzato (`beforeinstallprompt`)

### ✅ Fase 6 — Rifinitura
20. ✅ Tooltip su tutti i controlli, toast notification, animazioni CSS
21. ✅ Modale di conferma eliminazione (no `window.confirm`)
22. ✅ Stati vuoti con placeholder
23. ⬜ Test end-to-end manuale
24. ⬜ `README.md` con istruzioni di avvio

---

## Avvio dell'Applicazione

```bash
npm install
node server.js
# Primo avvio → wizard creazione password
# Avvii successivi → schermata login
# Apri http://localhost:3000
```

---

## Riepilogo Scelte Definitive

| Punto | Scelta |
|---|---|
| Autenticazione | Password = chiave SQLCipher del file .db |
| Collaboratori | Solo anagrafica per assegnazioni (no login) |
| Colonne default | TODO / IN WORKING / DONE auto-create per ogni progetto |
| Timer | Real-time con storico sessioni per task |
| Export | JSON strutturato + download file .db |
| Lingua | IT + EN (estendibile), selettore in app |
| Responsabile assegnazione | Campo `assigned_by` distinto da `assigned_to` sulla task |
