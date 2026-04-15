# Kanban Task Manager

Applicazione web locale per la gestione di progetti e task con kanban board.  
Database SQLite **cifrato con password**, installabile come **PWA**.

---

## Avvio

```bash
cd kanban-app
npm install
node server.js
```

Apri **http://localhost:3000** nel browser.

### Primo avvio
Viene mostrato il wizard di configurazione: scegli una password di almeno 6 caratteri.  
Questa password **cifra il file `data.db`** con SQLCipher — senza di essa il database è illeggibile.

### Avvii successivi
Inserisci la password per aprire il database cifrato.

> ⚠️ **Non esiste un recupero password.** Se la perdi, il database non è recuperabile (per design).

---

## Requisiti

- **Node.js** ≥ 18
- **npm** ≥ 8
- Windows 10 / macOS / Linux

Il pacchetto `better-sqlite3-multiple-ciphers` usa binari precompilati.  
Se l'installazione fallisce, assicurati di avere installato **Visual Studio Build Tools** (Windows) o `build-essential` (Linux).

---

## Struttura

```
kanban-app/
├── server.js           ← Server Express (porta 3000)
├── database.js         ← SQLite cifrato + migrazioni
├── data.db             ← Database (creato al primo avvio, cifrato)
├── routes/             ← API REST
└── public/             ← Frontend SPA + PWA
```

---

## Funzionalità principali

| Funzione | Dettaglio |
|---|---|
| Login | Password = chiave crittografica SQLCipher |
| Progetti | CRUD con colore, scadenza, barra progresso |
| Kanban | Colonne drag & drop, 3 default (TODO/IN WORKING/DONE) + personalizzabili |
| Task | Titolo, descrizione, colore, priorità, scadenza, ore stimate/effettive |
| Assegnazioni | "Assegnato a" (esecutore) + "Assegnato da" (responsabile riunione) |
| Timer | Real-time per task, storico sessioni |
| Collaboratori | Anagrafica con avatar colorato |
| Filtri | Per collaboratore, priorità, task in ritardo |
| Export | JSON strutturato + download file `.db` |
| Multilingua | Italiano / English (selettore in app) |
| PWA | Installabile da browser, cache offline per la shell |
| Responsive | Desktop, tablet, mobile |

---

## Export & Backup

- **Export JSON**: menu 📦 → "Scarica JSON" → tutti i dati gerarchici
- **Download .db**: menu 📦 → "Scarica .db" → file SQLite cifrato (stesso comportamento del login)

---

## Installazione come PWA

1. Apri http://localhost:3000 in **Chrome** o **Edge**
2. Clicca sul banner "Installa l'app" (o icona nella barra indirizzo)
3. L'app si apre in finestra standalone

> La PWA funziona pienamente con il server Node.js in esecuzione.  
> Offline mostra la UI cached ma non può modificare dati.
