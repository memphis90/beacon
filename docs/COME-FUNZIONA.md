# Come funziona, dentro

Il README è la presentazione. Qui c'è il dietro le quinte: il modello di
calcolo, i due interpreti, e le decisioni che hanno una ragione non ovvia.

---

## Il punteggio

```
punteggio = Σ (peso_asse × punteggio_asse) / Σ pesi   [+ bonus tematico]
```

Otto assi — natura, cultura, mare, cibo, vita notturna, outdoor, famiglia,
fuori rotta — con punteggi 0–100 nel seed e pesi 0–10 scelti dall'utente.

L'interfaccia mostra **sempre** il contributo di ogni asse, e il dettaglio ne
espone l'aritmetica per esteso: quando un risultato sorprende si deve poter
vedere subito quale asse ne è responsabile.

I **filtri duri** (mare come requisito, budget, tipo, ricerca testuale)
*escludono* invece di penalizzare, e agiscono prima del calcolo. Un peso a 0
non esclude: abbassa soltanto.

Il motivo di ogni esclusione è calcolato e disponibile (`rankDestinations` lo
restituisce in `excluded`) ma non è mostrato nella pagina: il banner che lo
elencava occupava spazio a ogni ricerca per un'informazione che serve solo
quando il risultato sorprende. `ExcludedNotice.jsx` è ancora nel progetto e si
rimonta con una riga.

## I temi

Accanto agli assi c'è un vocabolario chiuso di etichette (`src/lib/themes.js`)
— gotico, medievale, alpino, vulcanico, termale, balneare… — che dicono *cosa
una destinazione è*, non quanto soddisfa un interesse.

Servono perché esistono frasi che non parlano di interessi. *"Una meta per
Halloween"* non chiede più cultura, chiede un'atmosfera: con i soli assi
l'unica traduzione possibile era "cultura 8, vita notturna 9", che porta in
cima Barcellona — corretta rispetto ai numeri, sbagliata rispetto alla
domanda.

Un tema che corrisponde vale **8 punti**, al massimo 16, sommati *fuori* dalla
media pesata e mostrati come addendo separato: sulla card, nella didascalia
della barra e come riga propria nella tabella dell'aritmetica. Un totale che
sale senza che nessun asse lo spieghi sarebbe la scatola nera che il §5 del
planning rifiuta.

Il totale può superare 100. Il tetto è stato tolto perché appiattiva l'ordine
fra destinazioni già alte — Parigi (97) e Praga (92) finivano appaiate — e un
punteggio che perde l'ordine è peggio di uno che sfora la scala.

Non è un nono asse: un asse è una scala che ogni destinazione possiede in
qualche misura, un tema è un'etichetta che si ha o non si ha. I temi **non
escludono nessuno**, si tolgono dal chip come ogni altro criterio, e si mettono
anche a mano dai filtri.

Un tema porta con sé gli assi che implica (`axesFromThemes`). Serve solo come
ripiego: quando il modello restituisce un tema e nessun peso — succede sulle
frasi scarne — senza quella tabella si finirebbe con tutti gli assi a 5, cioè
con la classifica generica di sempre più otto punti a chi ha l'etichetta.

## I due interpreti

Si scelgono dal chip accanto al campo di testo, non dalle impostazioni: è una
decisione che si cambia spesso, tipicamente subito dopo aver visto
un'interpretazione sbagliata.

**Regole locali** (`parseQuery.js`) girano *mentre scrivi*: l'anteprima sotto
il campo è sempre la loro. Coprono mesi, durate, budget, gli otto assi con
l'intensità (*"soprattutto"*, *"un po' di"*, *"senza"*), il tipo di
destinazione e il mare come requisito.

**Modello** (`agent.js`) lavora *all'invio*, non a ogni tasto: una chiamata
locale costa una decina di secondi, e a ogni tasto sarebbe una raffica di
chiamate buttate via. Durante l'attesa l'app lo dice in primo piano e la si può
annullare. Timeout 180 s — misurato, `gemma4:26b` sulla stessa macchina impiega
98 s, e un minuto dichiarava guasto un endpoint che stava solo lavorando. Se
fallisce non porta ai risultati al buio: si resta sulla home, con l'errore e la
possibilità di proseguire con le regole.

### Al modello si dicono le regole vere

Insieme alla frase, il modello riceve il catalogo e l'effetto di ogni campo
(`describeRules`): quali destinazioni esistono, quali campi escludono invece di
ordinare, e — calcolato dal seed, non scritto a mano — quante destinazioni
superano la soglia del mare in ciascun mese, quanto costa una notte, quali temi
esistono e quante destinazioni li portano.

Non è cortesia. Prima, la parola "mare" in una frase di maggio diventava
`seaRequired: true`, che è un filtro duro, e cancellava tutte le destinazioni:
schermata vuota, 3 volte su 3. Il modello non stava disobbedendo, **decideva al
buio**. Con il contesto — e con la conseguenza spostata dentro la riga dello
schema, dove il modello guarda — le stesse frasi danno risultati sensati 3
volte su 3.

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
modello"*. Rilegge la frase accanto ai pesi effettivi e alle prime cinque
destinazioni, e può proporre **solo pesi**: al massimo tre, ognuno con la
motivazione presa dalle parole scritte, applicati con un clic.

Non può riordinare, e non è una questione di prompt: `sanitiseCritique` lascia
passare unicamente coppie asse/peso. Un `ranking` o un `winner` nella risposta
vengono ignorati, e c'è un test che lo verifica.

È deliberato. Il modello capisce la frase meglio delle regole, ma non conosce i
dati — costi, clima e POI vengono dal seed e dagli override — e un ordine
prodotto da lui toglierebbe di mezzo la domanda su cui tutto si regge: *quale
asse è responsabile di questo risultato*.

## Cosa è stimato e cosa no

| Dato | Stato |
|---|---|
| Punteggi degli assi | Stime iniziali, da correggere dal pannello Parametri |
| Costi | Stime, mostrate **sempre** come fascia. Mai valori puntuali |
| Clima | `climate_source: "seed_approx"` — stime, non Open-Meteo. Badge visibile in UI |
| Costo del volo | **Non modellato.** Entra in Fase 2 |
| `wikidata_id` | `null` per tutte: lo risolveranno gli script di Fase 1 |
| Foto | URL verificati salvati nel dato, con attribuzione. Fallback grafico offline |
| POI | Curati a mano. Non è un generatore di itinerari (Fase 3) |

## Override

Il pannello *Parametri* non scrive mai su `data/destinations.json`. Le
modifiche vivono in un layer separato su `localStorage`
(`destination-finder:overrides:v1`), con i campi divergenti dal seed
evidenziati e ripristinabili uno per uno. *Esporta overrides.json* produce il
file da versionare.

Il pannello si apre sull'**elenco** delle destinazioni, con le corrette in cima
e il conto dei campi toccati. Prima partiva dalla prima del catalogo con una
tendina per cambiarla: chi ne aveva corrette tre su ventitré riapriva il
pannello e ne trovava una sola, senza un posto dove ritrovare le altre.

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

## Design

Design system *"Data-Centric Travel Navigator"*, dal mockup Stitch **Travel
Score & Compare**. Il mockup è mobile e governa il responsive sotto i 900px
(top bar fissa, barra sticky con ricerca e ordinamento, card a colonna singola,
bottom navigation, filtri a scomparsa). Sopra i 900px, layout a portale con
barra laterale a icone e sidebar filtri sticky.

Nessuna richiesta a host esterni per i font: Hanken Grotesk è servito dal
progetto. Le uniche chiamate di rete sono le tile OpenStreetMap della mappa e
le foto su Wikimedia Commons — entrambe con fallback funzionante offline — più
l'endpoint del modello, se configurato.

### Il marchio

Un faro stilizzato disegnato a tratto (`src/components/Logo.jsx`): orizzonte,
torre rastremata, balconata, tetto, e la luce in ambra.

Un faro non è una destinazione: è un punto fisso che si guarda per capire dove
si è. È il mestiere di questo strumento, che non prenota niente e non porta da
nessuna parte — fa vedere dove sei rispetto a quello che cerchi.

**L'ambra è la luce**, cioè il nome, ed è l'unico colore che non cambia col
fondo: il resto del disegno è in `currentColor` e si adatta da solo. La luce
no, perché un faro spento non è un faro.

Prima erano otto barre appoggiate a una linea: la barra segmentata dei
contributi, cioè il metodo reso in forma. Era vero ma non era leggibile — un
grafico a barre come marchio si legge come "dati", e la barra ambra che portava
il nome la notava solo chi sapeva di doverla cercare.

`LogoMark` accetta `beams={false}` per le dimensioni piccole: sotto una certa
misura due trattini obliqui non si leggono come luce, si leggono come sporco.

## Nota sul nome

Il progetto si chiamava **Destination Finder**, un segnaposto. Le chiavi di
`localStorage` e il nome del pacchetto npm restano `destination-finder:*`:
rinominarle cancellerebbe override, preferiti e cronologia già salvati, in
cambio di nulla che si veda.
