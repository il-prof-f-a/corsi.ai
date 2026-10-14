# ChatModelli

Piccola applicazione desktop WinForms in C# per chattare con i modelli definiti in `ChatModelli/settings.json`. Il progetto usa .NET Framework 4.7 e non richiede pacchetti NuGet.

## Avvio

1. Apri `ChatModelli.sln` in Visual Studio con il targeting pack di .NET Framework 4.7 installato.
2. Compila ed esegui il progetto con **F5**.
3. Seleziona provider e modello, scrivi il prompt e premi **Invia**. `Ctrl+Invio` invia il messaggio.
4. La cronologia resta nel contesto della chat corrente. Premi **Nuova chat** per azzerarla e cambiare provider o modello.

L'app cerca `settings.json` nella stessa cartella dell'eseguibile; il progetto lo copia automaticamente in `bin\Debug` e `bin\Release`.

## Chiavi API

Il file di esempio contiene riferimenti a variabili d'ambiente, non chiavi reali. Imposta nell'account Windows le variabili dei provider che userai:

```powershell
[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'inserisci-la-tua-chiave', 'User')
```

L'app cerca ogni variabile prima nell'ambiente del processo, poi nell'account Windows corrente e infine nelle variabili di sistema. Dopo aver modificato una chiave, riavvia l'app per aggiornare lo stato dei modelli; non serve riavviare Visual Studio.

Sono previsti `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` e `GEMINI_API_KEY`. Per Ollama locale, l'esempio usa la chiave segnaposto `ollama`. Puoi modificare provider, URL e modelli aprendo `settings.json` dal pulsante in alto; riavvia l'app dopo aver cambiato il file.

All'avvio l'app controlla che le variabili d'ambiente richieste esistano e non siano vuote. I modelli dei provider senza chiave appaiono in grigio e non possono essere selezionati; il nome della variabile mancante viene mostrato nella chat e nella barra di stato. Se la chiave è stata trovata nell'ambiente Utente o Computer, la barra di stato lo indica. Il controllo non verifica se la chiave è valida per il servizio: in caso di chiave scaduta o errata, l'errore viene mostrato dopo la richiesta.

## Provider supportati

- OpenAI e Ollama usano il formato compatibile con Chat Completions.
- Anthropic usa Messages API.
- Gemini usa `generateContent`.

Le risposte vengono mostrate al termine della chiamata, senza streaming. Il timeout è letto da `API_TIMEOUT_MS`. Se `LOG` è `true`, `logs\chat.log` registra provider, modello ed esito, senza salvare prompt, risposte o chiavi API.

## Verifica leggera

Dopo aver compilato la soluzione in configurazione Debug, esegui `verification\run-settings-smoke-test.cmd`. Il controllo verifica il parsing della configurazione, la risoluzione delle credenziali nell'ambiente del processo e nell'ambito Utente, la gestione delle chiavi letterali di Ollama e la disabilitazione dei modelli senza chiave.
