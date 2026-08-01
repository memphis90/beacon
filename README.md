# Beacon

Uno strumento per scegliere **dove andare in vacanza**, che parte da una frase
scritta in italiano — *"cinque notti a ottobre, soprattutto cultura, poco
turistico"* — e restituisce una classifica di destinazioni con il punteggio
scomposto voce per voce.

Non è un motore di prenotazione, non cerca voli, non ha un account. È un
attrezzo per **decidere**, e la sua unica promessa è che ogni numero che mostra
si può risalire fino a chi l'ha prodotto.

> **Fase 0.** Il seed contiene 23 destinazioni europee con punteggi scritti a
> mano. Costi, clima e punteggi sono **stime iniziali**, dichiarate come tali
> nell'interfaccia e pensate per essere corrette dall'editor incorporato. Vedi
> [Le fasi](#le-fasi).

---

## L'idea

I motori di viaggio ordinano per popolarità o per prezzo, e non dicono perché.
Qui l'ordine viene da una media pesata di otto assi di interesse, e l'aritmetica
è visibile ovunque: sulla card, nella barra segmentata, e per esteso nella
tabella del dettaglio.

Quando un risultato sorprende, la domanda giusta è *quale asse l'ha prodotto* —
e si può rispondere. Se la risposta non convince, si corregge il punteggio nel
seed e si guarda di nuovo. È il ciclo per cui lo strumento esiste.

Un esempio, con il modello attivo:

```
"meta perfetta per halloween"

  → mese: ottobre        (Halloween è il 31)
  → tema: gotico         (dedotto da "halloween")
  → cultura: 8           (implicato dal tema)

  1. Parigi      105.0    97.0 + 8 tema gotico
  2. Praga       100.0    92.0 + 8 tema gotico
  3. Vienna      100.0    92.0 + 8 tema gotico
  4. Roma         98.0
  5. Budapest     96.0    88.0 + 8 tema gotico
```

Nessun passaggio è nascosto: il mese viene da una regola scritta nel prompt, il
tema da un vocabolario chiuso, gli otto punti sono un addendo separato che
compare nella tabella, e la classifica è aritmetica sui dati del seed.

---

## Provalo in locale

### Requisiti

- **Node 20+** ([nodejs.org](https://nodejs.org))
- Un browser recente
- *Facoltativo:* [Ollama](https://ollama.com) o [LM Studio](https://lmstudio.ai)
  se vuoi che a leggere la frase sia un modello linguistico

### Avvio

```bash
git clone https://github.com/memphis90/beacon.git
cd beacon
npm install
npm run dev          # http://localhost:5173
```

L'app ha bisogno di un server di sviluppo: `index.html` aperto con doppio clic
non funziona.

Altri comandi:

```bash
npm test             # 122 test: scoring, regole, sanitizzatori, render
npm run build        # bundle di produzione in dist/
npm run preview      # serve il bundle appena costruito
npm run images       # ri-risolve le foto → data/staging/images.json
```

### Funziona anche senza modello

Alla prima apertura l'interprete attivo è **Regole locali**: espressioni
scritte che girano nel browser, senza rete e senza attesa. Coprono mesi,
durate, budget, gli otto assi con l'intensità (*"soprattutto"*, *"un po' di"*,
*"senza"*), il tipo di destinazione e il mare come requisito. Per la maggior
parte delle frasi bastano, e sono istantanee.

Il modello serve per le frasi che le regole non coprono — quelle che parlano di
atmosfere, ricorrenze, o intenzioni implicite.

### Configurare un modello locale (Ollama)

```bash
# 1. installa Ollama, poi scarica un modello
ollama pull llama3.2          # ~2 GB, veloce
# oppure un modello più capace, se la macchina regge:
ollama pull gemma3:12b

# 2. verifica che l'endpoint risponda
curl http://localhost:11434/v1/models
```

Poi, nell'app:

1. clicca il chip accanto al campo di testo (dice *"Regole locali"*)
2. → **Configura un modello…**
3. *Dove gira*: **Ollama (locale)** — endpoint e modello si compilano da soli
4. correggi il nome del modello con quello che hai scaricato
5. **Prova la connessione** — manda una frase di esempio e riporta l'esito
6. **Salva**, poi scegli il modello dal chip

La chiave API non serve in locale. Con Ollama o LM Studio **nessuna frase esce
dal tuo computer**.

### Più modelli insieme

La configurazione tiene un **elenco** di profili, non uno solo: nome
facoltativo, endpoint, modello, chiave. Compaiono tutti nel menu accanto al
campo, sotto *Regole locali*, e si passa dall'uno all'altro in un clic.

È il modo in cui un interprete si sceglie davvero — guardando due modelli
leggere la stessa frase. L'elenco si gestisce dal profilo nel drawer →
*Modelli configurati*: si aggiunge, si rinomina, si prova, si cancella.

### Endpoint remoti

Va bene qualunque server compatibile con l'API OpenAI (`/chat/completions`):
Groq, OpenRouter, o un servizio tuo. I preset per i piani gratuiti sono già
nella tendina. L'app lo dice chiaramente quando l'endpoint è remoto: **la frase
che scrivi esce da questo computer**. La chiave resta in `localStorage`, perché
non c'è un server a cui mandarla.

### Dove finiscono i tuoi dati

Tutto in `localStorage`, su questa macchina: criteri, preferiti, cronologia,
modelli configurati e le modifiche dell'editor. Non c'è backend. *Esci e azzera
i dati*, nel menu del profilo, cancella tutto.

---

## Come funziona il punteggio

```
punteggio = Σ (peso_asse × punteggio_asse) / Σ pesi   [+ bonus tematico]
```

Otto assi — natura, cultura, mare, cibo, vita notturna, outdoor, famiglia,
fuori rotta — con punteggi 0–100 nel seed e pesi 0–10 scelti da te.

I **filtri duri** (mare come requisito, budget, tipo, ricerca testuale)
*escludono* invece di penalizzare, e agiscono prima del calcolo. Un peso a 0
non esclude: abbassa soltanto.

### I temi

Accanto agli assi ci sono i **temi** (`src/lib/themes.js`): un vocabolario
chiuso di etichette — gotico, medievale, alpino, vulcanico, termale,
balneare… — che dicono *cosa una destinazione è*, non quanto soddisfa un
interesse.

Servono perché esistono frasi che non parlano di interessi. *"Una meta per
Halloween"* non chiede più cultura, chiede un'atmosfera: con i soli assi
l'unica traduzione possibile era "cultura 8, vita notturna 9", che porta in
cima Barcellona — corretta rispetto ai numeri, sbagliata rispetto alla domanda.

Un tema che corrisponde vale **8 punti**, al massimo 16, sommati *fuori* dalla
media pesata e mostrati come addendo separato: sulla card, nella didascalia
della barra e come riga propria nella tabella dell'aritmetica. Un totale che
sale senza che nessun asse lo spieghi sarebbe esattamente la scatola nera che
questo progetto rifiuta.

Il totale può superare 100. Il tetto è stato tolto perché appiattiva l'ordine
fra destinazioni già alte — Parigi (97) e Praga (92) finivano appaiate — e un
punteggio che perde l'ordine è peggio di uno che sfora la scala.

Non è un nono asse: un asse è una scala che ogni destinazione possiede in
qualche misura, un tema è un'etichetta che si ha o non si ha. I temi **non
escludono nessuno**, si tolgono dal chip come ogni altro criterio, e si mettono
anche a mano dai filtri.

---

## Come si interpreta la frase

Due interpreti, scelti dal chip accanto al campo di testo — non dalle
impostazioni, perché è una scelta che si cambia spesso, tipicamente subito dopo
aver visto un'interpretazione sbagliata.

**Regole locali** (`parseQuery.js`) girano *mentre scrivi*: l'anteprima sotto
il campo è sempre la loro.

**Modello** (`agent.js`) lavora *all'invio*, non a ogni tasto: una chiamata
locale costa una decina di secondi. Durante l'attesa l'app lo dice in primo
piano e la si può annullare. Timeout 180 s — misurato, un modello da 26
miliardi di parametri sulla stessa macchina impiega 98 s, e un minuto
dichiarava guasto un endpoint che stava solo lavorando. Se fallisce non ti
porta ai risultati al buio: resti sulla home, con l'errore e la possibilità di
proseguire con le regole.

In entrambi i casi **l'interprete traduce la frase in criteri, non decide il
risultato**, e ogni criterio è mostrato con la parola da cui è stato dedotto.

### Al modello si dicono le regole vere

Insieme alla frase, il modello riceve il **catalogo e l'effetto di ogni campo**
(`describeRules`): quali destinazioni esistono, quali campi escludono invece di
ordinare, e — calcolato dal seed, non scritto a mano — quante destinazioni
superano la soglia del mare in ciascun mese, quanto costa una notte, quali temi
esistono e quante destinazioni li portano.

Non è cortesia. Prima, la parola "mare" in una frase di maggio diventava
`seaRequired: true`, che è un filtro duro, e cancellava tutte e 23 le
destinazioni: schermata vuota. Il modello non stava disobbedendo, **decideva al
buio**. Con il contesto, le stesse frasi danno risultati sensati in 3 prove su 3.

Nel prompt c'è anche l'aggancio delle **ricorrenze al mese** — capodanno 1,
carnevale 2, ferragosto 8, Halloween 10, Natale 12 — perché il mese è l'unico
appiglio temporale dello schema.

### Niente è creduto sulla parola

`sanitisePatch` scarta tutto ciò che non riconosce e riporta ai limiti tutto
ciò che è fuori scala: un modello che risponde `mese: 47` non può rompere il
ranking, un tema inventato non passa, un asse che non esiste viene buttato con
una nota. C'è una suite di test che lo verifica, injection comprese.

### La critica del ranking

Se il modello è attivo, in basso a destra compare un pulsante — *"Cosa nota il
modello"*. Rilegge la tua frase accanto ai pesi effettivi e alle prime cinque
destinazioni, e può proporre **solo pesi**: al massimo tre, ognuno con la
motivazione presa dalle parole che hai scritto, e li applichi tu.

Non può riordinare, e non è una questione di prompt: `sanitiseCritique` lascia
passare unicamente coppie asse/peso. Un `ranking` o un `winner` nella risposta
vengono ignorati, e c'è un test che lo verifica.

È deliberato. Il modello capisce la frase meglio delle regole, ma non conosce i
dati — costi, clima e POI vengono dal seed e dai tuoi override — e un ordine
prodotto da lui toglierebbe di mezzo la domanda su cui tutto si regge: *quale
asse è responsabile di questo risultato*. Intervenendo sui pesi, il suo
contributo resta visibile nell'aritmetica come qualunque altro peso.

---

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

### Override

L'editor non scrive mai su `data/destinations.json`. Le modifiche vivono in un
layer separato su `localStorage` (`destination-finder:overrides:v1`), con i
campi divergenti dal seed evidenziati e ripristinabili uno per uno. *Esporta
overrides.json* produce il file da versionare.

---

## Le fasi

L'ordine è vincolante: non si passa alla successiva finché la precedente non è
validata (`PLANNING.md`, §3).

| | Cosa aggiunge | Stato |
|---|---|---|
| **Fase 0** | Seed a mano, scoring, confronto, editor. Zero API, zero database | **qui** |
| **Fase 1** | Ingestione da Wikidata e OpenStreetMap, punteggi calcolati con override manuale, ~200 destinazioni | da fare |
| **Fase 2** | Clima reale (Open-Meteo), stime costi, fasce prezzo voli, filtro per tempo di volo dall'aeroporto di partenza | da fare |
| **Fase 3** | Ricerca semantica su descrizioni (embedding da Wikivoyage), bozze di itinerario, link affiliati | solo se le precedenti funzionano |

La Fase 0 si considera validata quando, su venti destinazioni che l'utente
conosce bene, il ranking regge il confronto con il suo giudizio, si riesce a
identificare l'asse responsabile quando non corrisponde, e lo strumento
suggerisce almeno una destinazione non ovvia che risulta sensata.

**Quello che manca non è il numero di destinazioni, è il giudizio.** I punteggi
attuali sono stime scritte dall'assistente, non da chi userà lo strumento:
finché restano tali, il ranking misura un'opinione che non è la sua, e il test
non è stato fatto — è stato solo reso possibile. Il modo di farlo è aprire
l'editor, prendere le destinazioni che si conoscono davvero e correggere finché
il ranking non smette di sorprendere.

Un'idea verificata ma **non pianificata** è depositata nel §3-bis del planning:
segnalare gli eventi in corso (incendi, alluvioni) che rendono una destinazione
una pessima risposta *oggi*, per ragioni che il seed non può contenere.

---

## Vincoli da non violare

Dal `PLANNING.md`, §2 e §10:

- Non diventa un booking engine, né un motore di ricerca voli live, né
  multi-utente
- Se lo strumento agevolasse l'acquisto combinato di volo + alloggio nello
  stesso processo, ricadrebbe nella Direttiva UE 2015/2302 con obblighi da tour
  operator. Restare su "informativo + link uscente" è deliberato
- Nessuna API commerciale a pagamento, in nessuna fase

---

## Struttura

```
data/destinations.json   seed versionato di 23 destinazioni — l'app non lo riscrive mai
src/lib/scoring.js       filtri duri + calcolo. Puro: niente React, niente DOM
src/lib/parseQuery.js    interprete a regole: dalla frase ai criteri, senza rete
src/lib/agent.js         interprete a modello + critica del ranking, con i sanitizzatori
src/lib/themes.js        vocabolario chiuso dei temi e loro peso
src/lib/store.js         merge seed + override, export/import
src/lib/images.js        risoluzione foto da Wikipedia + cache + fallback
src/components/          UI
src/assets/fonts/        Hanken Grotesk self-hosted (variabile 400–800, ~54 KB)
scripts/                 script di ingestione — scrivono in data/staging/, mai sul seed
test/                    scoring, regole, sanitizzatori, render statico dell'app
```

Gli script di ingestione **non toccano mai** `data/destinations.json`:
producono un file in `data/staging/` da confrontare e fondere a mano
(`node scripts/merge-staging.mjs`). Rispettano il rate limit delle API
pubbliche — intervallo minimo, backoff sul 429, user-agent identificativo:
Wikimedia e Overpass sono servizi gratuiti condivisi.

### Test

`npm test` copre il modello di scoring, le regole di parsing, i sanitizzatori
del modello e un **render statico** dell'app. Quest'ultimo esiste per un errore
vero: una prop rimasta a puntare a uno stato cancellato, invisibile ai test
sulle funzioni pure e a `vite build`, arrivata fino allo schermo bianco.

---

## Design

Design system *"Data-Centric Travel Navigator"*, dal mockup Stitch **Travel
Score & Compare**. Il mockup è mobile e governa il responsive sotto i 900px
(top bar fissa, barra sticky con ricerca e ordinamento, card a colonna singola,
bottom navigation, filtri a scomparsa). Sopra i 900px, layout a portale con
sidebar filtri sticky.

Nessuna richiesta a host esterni per i font: Hanken Grotesk è servito dal
progetto. Le uniche chiamate di rete sono le tile OpenStreetMap della mappa e
le foto su Wikimedia Commons — entrambe con fallback funzionante offline — più
l'endpoint del modello, se ne hai configurato uno.

### Il marchio

Un faro stilizzato disegnato a tratto (`src/components/Logo.jsx`): orizzonte,
torre rastremata, balconata, tetto, e la luce in ambra.

Un faro non è una destinazione: è un punto fisso che si guarda per capire dove
si è. È il mestiere di questo strumento, che non prenota niente e non porta da
nessuna parte — fa vedere dove sei rispetto a quello che cerchi.

**L'ambra è la luce**, cioè il nome, ed è l'unico colore che non cambia col
fondo: il resto del disegno è in `currentColor` e si adatta da solo — bianco
sulla topbar navy, navy sulla home chiara. La luce no, perché un faro spento
non è un faro.

Prima erano otto barre appoggiate a una linea: la barra segmentata dei
contributi, cioè il metodo reso in forma. Era vero ma non era leggibile — un
grafico a barre come marchio si legge come "dati", e la barra ambra che portava
il nome la notava solo chi sapeva di doverla cercare.

`LogoMark` accetta `beams={false}` per le dimensioni piccole: sotto una certa
misura due trattini obliqui non si leggono come luce, si leggono come sporco. È
la stessa ragione per cui `public/favicon.svg` è una variante senza fasci e
senza orizzonte, a tratto più spesso.

---

## Licenza

Il **codice** è sotto licenza [MIT](LICENSE): usalo, modificalo, ridistribuiscilo,
anche in prodotti commerciali, tenendo la nota di copyright.

Il resto non è coperto dalla MIT e ha condizioni proprie:

- **Le foto delle destinazioni** vengono da Wikimedia Commons, ognuna con la sua
  licenza (CC BY, CC BY-SA…) e con **attribuzione obbligatoria**. Il campo
  `image_credit` di ogni destinazione è quella attribuzione: se sostituisci
  un'immagine, sostituisci anche il credito.
- **Il font** Hanken Grotesk è sotto SIL Open Font License.
- **Le tile della mappa** sono OpenStreetMap, © i suoi contributori, ODbL.
- **I punteggi del seed** sono stime scritte a mano, non un dato di fonte: sono
  un'opinione, e vanno trattati come tale.

## Note

Il progetto si chiamava **Destination Finder**, un segnaposto. Le chiavi di
`localStorage` e il nome del pacchetto npm restano `destination-finder:*`:
rinominarle cancellerebbe override, preferiti e cronologia già salvati, in
cambio di nulla che si veda.

Documenti di contesto: `PLANNING.md` e
`docs/superpowers/specs/2026-07-30-destination-finder-design.md`.
