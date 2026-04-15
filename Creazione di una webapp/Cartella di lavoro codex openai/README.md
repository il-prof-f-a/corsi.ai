# Kanban Task Manager (SQLite locale + PWA)

Web app per gestione progetti e task in stile Kanban con database locale SQLite.

## Funzionalita principali

- Elenco progetti all'avvio.
- Ogni progetto parte con colonne `TODO`, `IN WORKING`, `DONE`.
- Aggiunta, rinomina, riordino ed eliminazione colonne.
- Aggiunta task e spostamento tra colonne tramite drag & drop.
- Dettaglio task con:
  - priorita e colore card
  - tempi stimati e consuntivi manuali
  - timer start/stop
  - assegnazione collaboratori locali
  - commenti
  - allegati file
- Tooltip su pulsanti/controlli principali (`title` hover).
- UI responsive desktop/tablet/mobile.
- Installabile come PWA via browser (manifest + service worker).

## Requisiti

- Node.js 20+ (testato con Node 24)
- npm 10+

## Avvio rapido

1. Installa dipendenze nella root:

```bash
npm install
```

2. Installa dipendenze client/server (se non gia presenti):

```bash
npm --prefix server install
npm --prefix client install
```

3. Avvia backend + frontend insieme:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API locale: `http://localhost:8787`

## Database e allegati

- SQLite locale: `server/data/app.db`
- Upload allegati: `server/data/uploads/`

## PWA

Da browser Chromium (Chrome/Edge):

1. Apri `http://localhost:5173`
2. Usa "Installa app" dal browser

## Build frontend

```bash
npm run build
```

