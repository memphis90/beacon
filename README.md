# Beacon — Fase 0

Strumento personale per scegliere una destinazione di viaggio in base a interessi,
budget e periodo dell'anno. Confronto ragionato con stima dei costi, **non** un
motore di prenotazione.

Il nome era **Destination Finder**, un segnaposto. Le chiavi di `localStorage` e il
nome del pacchetto npm restano `destination-finder:*`: rinominarle cancellerebbe
override, preferiti e cronologia già salvati su questa macchina, in cambio di
nulla che si veda.

## Marchio

Otto barre di altezza diversa appoggiate a una linea (`src/components/Logo.jsx`),
in `currentColor`, con la più alta in ambra. Si legge in due modi, ed è la ragione
per cui è questo e non una bussola: da vicino è la barra segmentata dei contributi
— otto assi, ognuno col suo peso, cioè il metodo; da lontano è un profilo contro
l'orizzonte.

**La barra ambra è il beacon**, cioè il nome: l'asse che in quella ricerca pesa più
di tutti, il punto verso cui stai andando. Il nome non ripete la forma del logo, ne
indica un pezzo — ed è per questo che è stato preferito a *Skyline*, che avrebbe
detto due volte la stessa cosa e avrebbe promesso città a un catalogo che contiene
anche isole e aree.

L'ambra è l'unico colore che non cambia col fondo: le barre in `currentColor` si
adattano (bianche sulla topbar navy, navy sulla home chiara), il beacon no.

`public/favicon.svg` è la variante compatta a **cinque** barre su fondo navy: a
16px otto segmenti da 2px diventano una macchia, e una favicon trasparente
sparisce sulle barre scure del browser.

Documento di contesto: `PLANNING.md`. Decisioni di progetto sciolte:
`docs/superpowers/specs/2026-07-30-destination-finder-design.md`.

## Avvio

```bash
npm install
npm run dev      # apre http://localhost:5173
npm test         # scoring, regole di parsing, sanitizzatori del modello
npm run build    # bundle di produzione in dist/
npm run images   # ri-risolve le foto → data/staging/images.json (non applica nulla)
```

Serve Node 20+. L'app richiede un server di sviluppo: non è apribile da doppio clic.

## Struttura

```
data/destinations.json   seed versionato di 21 destinazioni — l'app non lo riscrive mai
src/lib/scoring.js       filtri duri + calcolo. Puro: niente React, niente DOM
src/lib/parseQuery.js    interprete a regole: dalla frase ai criteri, senza rete
src/lib/agent.js         interprete a modello + critica del ranking, con i sanitizzatori
src/lib/store.js         merge seed + override, export/import
src/lib/images.js        risoluzione foto da Wikipedia + cache + fallback
src/components/          UI
src/assets/fonts/        Hanken Grotesk self-hosted (variabile 400–800, ~54 KB)
scripts/                 script di ingestione — scrivono in data/staging/, mai sul seed
test/scoring.test.js     asserzioni sul modello di scoring
```

Gli script di ingestione **non toccano mai** `data/destinations.json`: producono un file
in `data/staging/` che va confrontato e fuso a mano. Rispettano il rate limit delle API
pubbliche (intervallo minimo, backoff sul 429, user-agent identificativo): Wikimedia e
Overpass sono servizi gratuiti condivisi.

## Design

Design system **"Data-Centric Travel Navigator"**, dal mockup Stitch
*Travel Score & Compare*. Il mockup è mobile: governa il responsive sotto i 900px
(top bar fissa, barra sticky con ricerca e tab di ordinamento, card a colonna singola,
bottom navigation, filtri in pannello a scomparsa). Sopra i 900px resta il layout a
portale con sidebar filtri sticky.

Nessuna richiesta a host esterni per i font: Hanken Grotesk è servito dal progetto.
Le chiamate di rete sono le tile OpenStreetMap della mappa e le foto ospitate su
Wikimedia Commons, entrambe con fallback funzionante offline — più l'endpoint del
modello, **se** ne hai configurato uno (vedi sotto). Con Ollama o LM Studio anche
quello resta su questa macchina.

Le foto sono sotto licenza libera e **richiedono l'attribuzione**: `image_credit` è
mostrato nel dettaglio ed è la condizione d'uso, non un abbellimento. Se sostituisci
un'immagine, sostituisci anche il credito.

## Come funziona il punteggio

```
score_totale = Σ (peso_asse × punteggio_asse) / Σ pesi
```

Otto assi, punteggi 0–100, pesi 0–10 impostati dall'utente. L'interfaccia mostra
**sempre** il contributo di ogni asse, e il dettaglio ne espone l'aritmetica per
esteso: quando un risultato sorprende si deve poter vedere subito quale asse ne è
responsabile.

I filtri duri (mare, budget, tipo, ricerca) **escludono**, non penalizzano, e sono
applicati prima dello scoring.

Il motivo di ogni esclusione è calcolato e disponibile (`rankDestinations` lo
restituisce in `excluded`), ma **non è più mostrato nella pagina risultati**: il
banner che lo elencava è stato tolto perché occupava spazio a ogni ricerca per
un'informazione che serve solo quando il risultato sorprende. `ExcludedNotice.jsx`
è ancora nel progetto e si rimonta con una riga. Oggi, se una destinazione che ti
aspettavi non compare, l'app non ti dice perché: lo deduci dai chip dei filtri
attivi, che si tolgono uno per uno.

## Come si interpreta la frase

Due interpreti, scelti dal chip accanto al campo di testo — non nelle
impostazioni, perché è una scelta che si cambia spesso:

- **Regole locali** (`parseQuery.js`): espressioni scritte che girano qui, senza
  rete e senza attesa. Coprono mesi, durate, budget, gli otto assi con l'intensità
  (“soprattutto”, “un po' di”, “senza”), il tipo di destinazione e il mare come
  requisito. Girano **mentre scrivi**: l'anteprima sotto il campo è sempre la loro.
- **Modello** (`agent.js`): un endpoint compatibile OpenAI — Ollama, LM Studio,
  o un servizio remoto. Lavora **all'invio**, non mentre scrivi: una chiamata
  locale costa una decina di secondi, e a ogni tasto sarebbe una raffica di
  chiamate buttate via. Durante l'attesa l'app lo dice in primo piano, e la si
  può annullare. Timeout 60 s. Se fallisce non ti porta ai risultati al buio:
  resti sulla home, con l'errore e la possibilità di proseguire con le regole.

L'endpoint si configura dal profilo nel drawer → *Configurazione del modello*.
La chiave, se serve, resta in `localStorage`: non c'è un server a cui mandarla.

La home ha un campo, un selettore d'interprete e una freccia d'invio: il bottone
“Salta e usa i filtri” non è più nella barra del prompt. Chi sa già cosa cercare
entra dal drawer, voce *Vai ai filtri, senza frase*. Una volta dentro, i filtri si
regolano dalla sidebar e si torna alla home da *Nuova ricerca*, sempre nel drawer.

In entrambi i casi **l'interprete traduce la frase in criteri, non decide il
risultato**, e ogni criterio è mostrato con la parola da cui è stato dedotto.

### La critica del ranking

Se il modello è attivo, nei risultati compare *"Cosa nota il modello"*: rilegge la
tua frase accanto ai pesi effettivi e alle prime 5 destinazioni, e può proporre
**solo pesi** — al massimo tre, ognuno con la sua motivazione presa dalle parole
che hai scritto, e li applichi tu con un bottone.

Non può riordinare, e non è una questione di prompt: `sanitiseCritique` lascia
passare unicamente coppie asse/peso, scarta assi inventati, pesi fuori scala,
suggerimenti senza motivazione e quelli che non cambierebbero nulla. Un eventuale
`ranking` o `winner` nella risposta viene ignorato, e c'è un test che lo verifica.

È deliberato: il modello capisce la frase meglio delle regole, ma non conosce i
dati — costi, clima e POI vengono dal seed e dai tuoi override — e un ordine
prodotto da lui toglierebbe di mezzo la domanda su cui si regge la Fase 0,
*quale asse è responsabile di questo risultato*. Intervenendo sui pesi, il suo
contributo resta visibile nell'aritmetica del punteggio come qualunque altro peso.

## Cosa è stimato e cosa no

| Dato | Stato |
|---|---|
| Punteggi degli assi | Stime iniziali, da correggere con l'editor |
| Costi | Stime, mostrate **sempre** come fascia. Mai valori puntuali |
| Clima | `climate_source: "seed_approx"` — stime, non Open-Meteo. Badge visibile in UI |
| Costo del volo | **Non modellato.** Entra in Fase 2 |
| `wikidata_id` | `null` per tutte: lo risolveranno gli script di Fase 1 |
| Foto | URL verificati salvati nel dato, con attribuzione. Fallback grafico offline |
| POI | Curati a mano. Non è un generatore di itinerari (Fase 3) |

## Override

L'editor non scrive mai su `data/destinations.json`. Le modifiche vivono in un layer
separato su `localStorage`, con i campi divergenti dal seed evidenziati e
ripristinabili uno per uno. `Esporta overrides.json` produce il file da versionare.

Chiave di storage: `destination-finder:overrides:v1`.

## Vincoli da non violare

Dal `PLANNING.md`, §2 e §10:

- Non diventa un booking engine, né un motore di ricerca voli live, né multi-utente
- Se lo strumento agevolasse l'acquisto combinato di volo + alloggio nello stesso
  processo, ricadrebbe nella Direttiva UE 2015/2302 con obblighi da tour operator.
  Restare su "informativo + link uscente" è deliberato
- Nessuna API commerciale a pagamento, in nessuna fase

## Stato della Fase 0

Il §9 del planning considera la fase validata quando, su **20** destinazioni note
all'utente, il ranking regge il confronto con il suo giudizio, si riesce a identificare
l'asse responsabile quando non corrisponde, e lo strumento suggerisce almeno una
destinazione non ovvia che risulta sensata.

Il seed contiene **21** destinazioni in 14 paesi: la soglia numerica è superata.

**Quello che manca non è il numero, è il giudizio.** I punteggi sono stime scritte
dall'assistente, non il giudizio dell'utente. Finché restano tali, il ranking misura
un'opinione che non è la sua, e il test del §9 non è stato fatto — è stato solo reso
possibile.

Il modo di farlo: aprire l'editor, prendere le destinazioni che si conoscono davvero e
correggere i punteggi finché il ranking non smette di sorprendere. Ogni correzione è
un'ipotesi sul modello, e la tabella dell'aritmetica nel dettaglio dice su quale asse
intervenire.
