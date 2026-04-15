# Piano Dettagliato - Web App Task/Project Manager (SQLite + Kanban + PWA)

## 1. Obiettivi funzionali

1. Mostrare all'avvio l'elenco dei progetti disponibili.
2. Entrare in un progetto e visualizzare una board Kanban con colonne iniziali:
   - TODO
   - IN WORKING
   - DONE
3. Permettere personalizzazione completa della board:
   - aggiunta/rinomina/ordinamento colonne
   - aggiunta/modifica/eliminazione task
   - spostamento task tra colonne (drag & drop)
4. Gestire metadati task:
   - tempi stimati/consuntivi
   - assegnazione collaboratori
   - priorita/stato colore
5. UX semplice e guidata:
   - tooltips su pulsanti/controlli (hover mouse)
   - interfaccia pulita e intuitiva
6. App responsive (desktop/tablet/mobile).
7. Installabile come PWA (manifest + service worker + offline base).

## 2. Scelte tecniche proposte

1. Frontend: React + TypeScript + Vite.
2. UI: libreria leggera per componenti + drag&drop + tooltip accessibili.
3. Backend locale: Node.js + Express (o Fastify) con DB SQLite locale.
4. ORM/Query layer: Prisma oppure Drizzle (da confermare).
5. API: REST JSON per progetti, board, colonne, task, collaboratori.
6. PWA: plugin Vite PWA con caching asset e fallback offline.
7. Packaging desktop locale (opzionale fase 2): Tauri/Electron se serve app installabile "desktop" oltre PWA.

## 3. Architettura applicativa

1. Client SPA
   - route progetto list
   - route board progetto
   - componenti riusabili (card task, colonna, modale task, filtri)
2. API locale
   - CRUD progetti
   - CRUD colonne per progetto
   - CRUD task + assegnatari + tempi
   - endpoint ordinamento/spostamento task
3. DB SQLite
   - file locale unico (`data/app.db`)
   - migrazioni versionate
4. Strato sincronizzazione UI
   - optimistic update per drag&drop
   - rollback su errore API

## 4. Modello dati (prima versione)

1. `projects`
   - id, nome, descrizione, colore, created_at, updated_at
2. `users`
   - id, nome, email (opzionale), avatar_color
3. `columns`
   - id, project_id, nome, posizione, colore, is_default
4. `tasks`
   - id, project_id, column_id, titolo, descrizione, priorita, colore, posizione
   - tempo_stimato_min, tempo_consuntivo_min
   - data_inizio, scadenza, completed_at
   - created_at, updated_at
5. `task_assignees`
   - id, task_id, user_id
6. `task_activity` (opzionale ma consigliata)
   - id, task_id, tipo_evento, payload, created_at

## 5. Flussi UX principali

1. Avvio app
   - schermata "Progetti" con ricerca + bottone "Nuovo progetto"
2. Entrata in un progetto
   - caricamento board con 3 colonne default se progetto nuovo
3. Gestione task
   - creazione rapida task in colonna
   - apertura dettaglio task in modale/drawer
4. Gestione colonne
   - aggiungi colonna
   - menu colonna (rinomina, colore, elimina con regole)
5. Assegnazioni e tempi
   - selettore collaboratori multi-selezione
   - campi tempo stimato/consuntivo
6. Accessibilita e aiuto contestuale
   - tooltip su azioni critiche
   - label e aria-attributes minimi

## 6. Piano di implementazione per fasi

### Fase 0 - Setup progetto

1. Bootstrap repository (client/server condivisi o monorepo leggero).
2. Config TypeScript, lint, formatter, env locale.
3. Setup SQLite + migrazioni + seed iniziale.

### Fase 1 - Fondamenta backend

1. Implementazione schema DB e migrazioni.
2. Endpoint CRUD `projects`.
3. Endpoint CRUD `columns` con creazione automatica colonne default.
4. Endpoint CRUD `tasks` + spostamento/riordino.
5. Endpoint `users` + assegnazioni task.

### Fase 2 - UI base funzionante

1. Pagina elenco progetti.
2. Pagina Kanban per progetto.
3. Drag&drop task tra colonne.
4. Creazione/modifica task e colonne.

### Fase 3 - UX avanzata

1. Tooltip su pulsanti/controlli principali.
2. Palette colori task/colonne.
3. Indicatori tempi (stimato/consuntivo).
4. Feedback utente (toast, loader, error state).

### Fase 4 - Responsive e PWA

1. Ottimizzazione layout mobile/tablet.
2. Manifest web app (nome, icone, colori).
3. Service worker e strategia cache.
4. Test installabilita su Chrome/Edge mobile/desktop.

### Fase 5 - Qualita e rilascio

1. Test funzionali core (progetti, task, drag&drop, assegnazioni).
2. Test minimi API + smoke UI.
3. Hardening errori e fallback offline.
4. Documentazione avvio locale e uso.

## 7. Requisiti non funzionali

1. Performance: board con almeno 300 task senza degrado marcato.
2. Affidabilita: consistenza ordine task/colonne dopo refresh.
3. Usabilita: operazioni principali con max 2 click dalla board.
4. Manutenibilita: separazione chiara componenti UI/API/DB.
5. Portabilita: esecuzione locale su Windows/macOS/Linux.

## 8. Criteri di accettazione (MVP)

1. All'avvio si vede elenco progetti e si puo creare/aprire progetto.
2. Ogni nuovo progetto nasce con TODO/IN WORKING/DONE.
3. Si possono aggiungere colonne custom e riordinarle.
4. Si possono creare task, assegnare collaboratori, impostare tempi e colori.
5. Si possono trascinare task tra colonne mantenendo ordine persistente.
6. Tooltip presenti su controlli azione principali.
7. UI usabile su mobile e desktop.
8. App installabile come PWA.

## 9. Rischi principali e mitigazioni

1. Complessita drag&drop + persistenza ordine
   - mitigazione: algoritmo posizione incrementale + endpoint dedicato reorder
2. UX mobile su board larga
   - mitigazione: scroll orizzontale ottimizzato + sticky header colonne
3. Offline PWA con dati locali
   - mitigazione: iniziare da offline shell + gestione esplicita stato rete
4. Crescita schema dati
   - mitigazione: migrazioni versionate fin dall'inizio

## 10. Domande aperte prima dello sviluppo

1. Vuoi stack confermato `React + TypeScript + Node + SQLite` oppure preferisci altro (es. solo frontend + backend embedded)?
2. L'app deve supportare multi-utente reale con login/password, oppure collaboratori solo come anagrafica locale senza autenticazione?
3. I tempi task devono essere in ore/minuti manuali, oppure vuoi anche timer start/stop?
4. Serve allegare file/commenti ai task gia in MVP oppure in una fase successiva?
5. Preferisci tema grafico chiaro, scuro o entrambi (toggle)?
6. Vuoi lingua UI solo italiano o italiano + inglese?
7. La PWA ti basta via browser, oppure vuoi anche pacchetto desktop installabile (Tauri/Electron)?
8. Hai vincoli di licenza su librerie UI/drag&drop da evitare?

## 11. Output atteso dopo conferma

1. Scaffolding completo progetto.
2. Prima versione funzionante MVP locale con DB SQLite.
3. Istruzioni di esecuzione in README.
4. Backlog miglioramenti post-MVP.
