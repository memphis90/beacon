# Destination Finder — Design di Fase 0

> Spec derivata da `PLANNING.md`. Scioglie le decisioni marcate **[APERTA]** nel planning.
> Data: 2026-07-30

---

## 1. Decisioni sciolte

Il planning marca cinque decisioni come **[APERTA]** con istruzione di non implementarle
di iniziativa. Ecco come sono state risolte.

| # | Decisione (§ planning) | Risoluzione |
|---|---|---|
| 1 | Granularità destinazioni (§4) | Ibrido a **tre tipi**: `city` \| `area` \| `island` |
| 2 | Normalizzazione punteggi (§5) | **Non applicabile in Fase 0** — i punteggi sono manuali. Si ripresenta in Fase 1 |
| 3 | Set degli assi (§8.3) | 8 assi: `walkability` rimosso, `outdoor` e `family` aggiunti |
| 4 | Ambito geografico (§8.4) | Europa intera, nessun vincolo di distanza |
| 5 | Aeroporto di partenza (§8.5) | **Rimandata** — il filtro tempo di volo è Fase 2 |

### 1.1 Perché tre tipi e non due

`island` non è cosmetico. Un'isola ha stagionalità più rigida (collegamenti stagionali),
costi di trasporto interno strutturalmente diversi e un raggio di influenza che coincide
con la sua geografia anziché essere una scelta. Tenerla dentro `area` avrebbe costretto
a distinguerla comunque, ma implicitamente.

### 1.2 Perché `nature` e `outdoor` sono separati

`nature` è il paesaggio come oggetto di contemplazione (fiordi, parchi, viste).
`outdoor` è l'attività (trekking, sci, bici, sport acquatici). Le Dolomiti sono alte su
entrambi, Madeira pure; ma un parco urbano è alto su `nature` e basso su `outdoor`, e una
località sciistica anonima è l'inverso. Fonderli avrebbe reso l'asse non diagnosticabile,
contro il principio §5 del planning ("trasparente e debuggabile").

### 1.3 Perché `walkability` è stato rimosso

È un attributo di comfort, non un interesse, e nei centri storici europei correla
fortemente con `culture` — cioè contribuiva due volte allo stesso punteggio.
Sopravvive come nota testuale libera nel campo `notes`.

---

## 2. Divergenze dal planning, approvate

### 2.1 Costi come range esplicito

Il §6 del planning impone di mostrare **fasce** (`35-60 €/giorno`) perché un valore
puntuale comunica una precisione inesistente. Ma lo schema §4 memorizza un punto singolo
(`accommodation_mid: 85`).

Non si può derivare una fascia onesta da un punto: qualsiasi moltiplicatore applicato in UI
(`±30%`) è inventato quanto il numero puntuale che pretende di correggere.

**Risoluzione:** i costi sono memorizzati come `{low, mid, high}` per voce.
Il calcolo di budget usa `mid`; la UI mostra sempre `low–high`.

### 2.2 Formato del file dati — decisione ritirata

Una precedente versione di questa spec proponeva `data/destinations.js` (wrapper JS attorno
a JSON) perché `fetch()` su file locale è bloccato sotto `file://`.

**Ritirata.** Con l'adozione di Vite (§3) l'import di JSON è nativo e il problema non esiste.
Il file resta `data/destinations.json` come da planning §4.

### 2.3 Itinerari — fuori scope

La richiesta di mostrare "itinerari consigliati" nella vista mappa ricade in **Fase 3**
del planning (§3: "Generazione di bozze di itinerario"), il cui ordine è dichiarato vincolante.

**Risoluzione:** nessun generatore. La mappa di dettaglio mostra POI **curati a mano nel
dato** (campo `pois`), che è contenuto editoriale e non generazione automatica.
Il generatore si valuta dopo la validazione della Fase 0.

---

## 3. Stack

- **React 19 + Vite** — richiesto esplicitamente, per parità con i portali di annunci
  di riferimento (immobiliare.it / casa.it)
- **Leaflet** per la mappa di dettaglio
- **Vitest** per i test del modulo di scoring
- **Hanken Grotesk** self-hosted (vedi §3-bis.3)
- Nessun'altra dipendenza runtime, nessuna richiesta a host esterni salvo le tile
  OpenStreetMap della mappa e le foto risolte da Wikipedia — entrambe con fallback

Conseguenza accettata: l'app richiede `npm run dev` (o `npm run build` + `npm run preview`),
non è più apribile da doppio clic.

---

## 3-bis. Design system — mockup Stitch

Fonte: progetto Stitch **"Travel Score & Compare"** (`projects/16109484660465653212`),
tema *Data-Centric Travel Navigator*. Quattro schermi mobile a 390px:
Ricerca e Risultati, Dettaglio Destinazione, Confronto Destinazioni, Editor Dati.

### 3-bis.1 Ambito dell'adozione

Il mockup è **mobile**. L'app era stata costruita come portale desktop.

**Risoluzione:** il mockup governa il **responsive sotto i 900px**; il layout desktop
resta quello a portale (topbar + sidebar filtri sticky) in attesa del layout web
dedicato, in preparazione da parte dell'utente. I token — colori, tipografia, raggi,
spaziature — si applicano a entrambi.

Impianto mobile derivato dal mockup: top app bar fissa, barra sticky con ricerca e
tab di ordinamento, chip dei filtri a scorrimento orizzontale, banner delle esclusioni,
card a colonna singola, bottom navigation a 4 voci, sidebar filtri convertita in
pannello a scomparsa.

### 3-bis.2 Barra del punteggio — impianto sostituito

Il mockup specifica una barra a **8 segmenti di larghezza fissa** colorati su tre
livelli (verde `#00a658`, blu `#47617a`, ambra `#f59e0b`, grigio `#e3e2e4` per i vuoti).
Sostituisce la barra impilata a 8 colori in cui la larghezza del segmento era il
contributo dell'asse.

**Conseguenza accettata, e sua mitigazione.** Con 8 assi e 3 colori il colore non può
più identificare l'asse. L'identità passa a due canali diversi:

- la **posizione**: un segmento per asse, sempre nello stesso ordine
- il colore ora codifica il *livello* del punteggio, e il grigio segnala peso 0

Il requisito §5 del planning ("si deve vedere subito quale asse ha contribuito") è
retto altrove: dalla riga **"asse guida"** sotto ogni card e dalla **tabella
dell'aritmetica** nel dettaglio.

La palette categorica a 8 colori validata per il daltonismo **non è stata buttata**:
sopravvive dove l'identità dell'asse conta ancora, cioè i pallini di legenda negli
slider e gli swatch nelle tabelle di dettaglio e confronto.

### 3-bis.3 Tipografia

**Hanken Grotesk**, variabile 400–800, **self-hosted** in `src/assets/fonts/`
(subset latin + latin-ext, ~54 KB totali). Nessuna richiesta a Google Fonts:
l'app non contatta host esterni per i font, e il latin-ext serve per Petřín,
Henningsvær, Vyšehrad.

### 3-bis.4 Contrasto — verificato dopo il cambio di palette

Sostituire l'intera palette ha invalidato ogni verifica precedente. Rifatta su tutte le
coppie testo/sfondo realmente usate. Difetti trovati e corretti:

| Difetto | Prima | Dopo |
|---|---|---|
| Testo bianco sul bottone ambra | 2.15:1 | 8.52:1 (testo navy) |
| Testo accento su fondo accento tinto (badge, "ripristina") | 3.34:1 | 8.49:1 (testo `--ink-2`, l'accento resta sul bordo) |
| `--ink-3` come testo piccolo in 6 punti | 3.68–4.29:1 | 8.45–9.35:1 (`--ink-2`) |

`--ink-3` resta legittimo dove non è testo: placeholder, icone, bordi, stati disabilitati.

**Barra segmentata.** Validata con `--pairs all`, non solo sulle coppie adiacenti: in una
barra ordinata per asse qualunque coppia di livelli può ritrovarsi affiancata.

- separazione per daltonismo: peggior coppia **alto↔basso a ΔE 7.2 sotto protanopia**,
  nella banda 6–8 che è ammessa **solo con codifica secondaria**. L'app la fornisce:
  ordine fisso dei segmenti più tabella numerica. Se un giorno la barra comparisse
  isolata, senza tabella né etichette accanto, questo diventerebbe un difetto reale
- il segmento ambra resta sotto 3:1 contro la superficie: mitigato dal bordo interno
  hairline, e il valore è comunque leggibile in cifre nella tabella
- il segmento grigio "peso 0" esce dalla banda di luminosità e dal minimo di croma **per
  costruzione**: non è un livello di dato, è un marcatore di assenza. Nei controlli futuri
  vanno validati i tre livelli reali, non quattro

**Palette categorica residua.** I pallini da 9-10px di `--series-3/4/5` (Mare, Cibo, Vita
notturna) hanno contrasto 2.06–2.68:1: deboli in sé. Non è un difetto di accessibilità
perché in tutti e quattro i punti d'uso il pallino è **sempre** seguito dall'etichetta
testuale dell'asse. Nessun uso "a colore nudo" nel codice.

### 3-bis.5 Layout desktop — quattro schermi aggiunti

Arrivati dopo il mobile, a 2560px. Divergono strutturalmente, non solo nella pelle:
top bar chiara con tab orizzontali, ordinamento a controllo segmentato, banner delle
esclusioni in rosso, footer, sidebar con reset ancorato in fondo.

**Decisioni prese con l'utente:**

| Questione | Decisione |
|---|---|
| Marchio "VoyagerMetrics" del mockup | Resta **Destination Finder**: era un segnaposto generato |
| Mare e budget come chip a valori fissi | **Chip come scorciatoie**, sopra i controlli continui che restano visibili |
| Footer con quattro voci | **Adottato**, ma con contenuto reale dietro ognuna, non link morti |

Sui chip: mare e budget sono filtri **duri**, escludono destinazioni. Ridurli a due valori
fissi toglierebbe la possibilità di esprimere "23 °C" o "740 €". I chip scrivono nello
stesso stato continuo e restano affiancati allo slider e al campo in euro, che non vengono
nascosti — la scoperta dei valori intermedi dipende dal fatto che si vedano.
I preset di budget si moltiplicano per le notti scelte, quindi "Medio" vale 500 € a cinque
notti e 1000 € a dieci.

**Decisione presa senza consultazione, dichiarata qui:** la sidebar del mockup mostra solo
interessi, mare e budget. **Mese e notti** non compaiono in nessuno dei quattro schermi.
Sono stati tenuti: senza il mese la domanda del §1 del planning — "dove vado 5 giorni a
ottobre" — non è esprimibile, e il filtro di stagionalità non ha su cosa lavorare.

**Ordinamento:** il mockup ha tre bottoni, il modello ne ha quattro (punteggio, costo
crescente, costo decrescente, nome). "Costo" inverte la direzione al secondo clic, con una
freccia che lo dichiara, invece di perdere un ordinamento.

**Le "due barre" della card non esistono.** L'HTML ha **una** barra con due etichette
affiancate — "Score Breakdown" e "Weighted Analysis" — sopra di essa. La barra ha cinque
segmenti a larghezza variabile e colori che cambiano da una card all'altra per la stessa
posizione: il colore non porta identità. È ridondanza del prototipo. La barra dell'app
resta com'è.

**Rimasto aperto:** nel mockup la sidebar resta visibile accanto a dettaglio, confronto ed
editor, che nell'app sono overlay a tutta pagina. È la modifica strutturale più costosa del
lotto e va valutata guardando il desktop restilizzato girare: su 1440px il dettaglio del
mockup è già a due colonne dentro al contenuto, più 320px di sidebar.

### 3-bis.6 Pannelli agganciati — provato e ritirato

Il mockup tiene la sidebar dei filtri visibile accanto a dettaglio, confronto ed editor.
È stato implementato sopra i 1600px — dove l'aritmetica dello spazio lo consente — e poi
**ritirato dopo averlo visto funzionare**.

L'argomento a favore era reale: con i filtri raggiungibili mentre leggi il dettaglio,
alzi il peso di un asse e vedi il punteggio ricalcolarsi. È il ciclo stretto fra criterio
ed effetto, cioè il gesto per cui lo strumento esiste. Funzionava: verificato con clic
reali, sidebar interattiva e contributo aggiornato in tempo reale.

Non è bastato. Il dettaglio ridotto a una colonna fra altre due perde il primo piano, e
il primo piano è ciò che serve quando stai leggendo perché una destinazione ha quel
punteggio. Il ciclo stretto è un guadagno teorico; l'attenzione contesa è un costo che si
paga a ogni apertura.

**Stato attuale:** dettaglio, confronto ed editor sono pannelli in primo piano con velo,
identici a ogni larghezza. Il velo blocca lo sfondo, il clic fuori chiude.

I pannelli restano montati dentro `.layout` nel DOM — resto dell'esperimento, innocuo
perché un elemento `position: fixed` non partecipa alla griglia. Se un giorno si volesse
riprovare, il punto di partenza è lì.

### 3-bis.7 Animazione del pannello di dettaglio

Ingresso e uscita in scivolamento da destra, con velo in dissolvenza.

Il pezzo non ovvio è l'uscita: React smonta il nodo nell'istante in cui lo stato cambia,
e un'animazione di uscita non ha nulla su cui girare. `src/lib/useDismiss.js` interpone
un passo — marca il pannello "in chiusura", lascia girare il CSS, e chiude davvero allo
scadere. La durata nell'hook e quella nel CSS devono restare allineate.

Le curve sono asimmetriche di proposito: ingresso decelerato (parte veloce, si posa),
uscita accelerata (parte piano, se ne va). Entrare è un arrivo, uscire è un congedo.

Con `prefers-reduced-motion: reduce` l'animazione è disattivata **e** l'hook salta
l'attesa: chi ha chiesto meno movimento non deve aspettare qualcosa che non vedrà.

### 3-bis.8 Topbar mobile

Sotto i 900px la topbar contiene **solo il marchio**: ricerca e azioni sono passate alla
barra sticky e alla bottom nav. Tenerla fissa significava spendere 56px di viewport
permanentemente per un titolo.

Ora è alta 48px e scorre via; al suo posto resta ancorata la barra che serve davvero,
con ricerca e ordinamento.

### 3-bis.9 Cosa del mockup NON è stato adottato

| Elemento | Perché no |
|---|---|
| Material Symbols Outlined | Font icone esterno da centinaia di KB per una manciata di glifi. Restano le SVG inline già presenti |
| Punteggi in scala /10 | I punteggi degli assi sono 0-100 per schema (§4). Mostrare il totale su 10 e la tabella su 100 creerebbe un'incoerenza tra i due |
| CTA "Vedi Offerta" | Linguaggio da booking engine, vietato dal §2 del planning. Diventa "Dettaglio" |
| "voli inc." sulle card | Falso: il volo non è modellato in Fase 0. Resta "volo escluso" ovunque |
| Tailwind CDN | Il mockup è un artefatto di prototipazione. L'app usa CSS proprio con custom properties |
| Icona account nella top bar | Non esiste un login. È uno strumento locale a utente singolo: implicherebbe una funzione assente |
| "14 utenti stanno confrontando…" | Dato inventato. Non c'è backend, non ci sono altri utenti |
| "Smart Recommendation" con percentuali di allineamento | Nessun motore di raccomandazione esiste. Se un giorno si costruisse, dovrà dire un fatto derivato dai dati, non simulare una prosa da IA |
| "Category Breakdown": Safety, Connectivity, Accessibility, Sustainability | Quattro metriche senza alcuna base nei dati e senza una fonte per popolarle |
| "Draft Changes" / "Save Changes" nell'editor | Non esiste uno stato non salvato: ogni modifica scrive subito. Un bottone Salva farebbe credere che il lavoro possa andare perso |
| "42 entries synced" | Non c'è alcuna sincronizzazione: JSON statico più override locali |
| Breadcrumb "Destinations > Paese > Nome" | Implica pagine e URL gerarchici che questa SPA non ha. Sarebbe una traccia morta |
| Descrizione e link esterno per ogni POI | Campi che non esistono nel modello: i POI hanno nome, tipo e coordinate |
| Icone meteo differenziate (sole, nuvole, pioggia) | Implicherebbero dati sulle condizioni del cielo. Abbiamo solo temperature stimate: il termometro uniforme è onesto, quelle no |
| "7 giorni di permanenza media" | Statistica aggregata inventata. `nights` è un input dell'utente, non una media storica |
| Rosso per "campo modificato" nell'editor desktop | Il mockup mobile usa l'ambra per lo stesso concetto: si contraddicono. Resta l'ambra, e il rosso continua a significare errore vero |

---

## 3-ter. Schermata d'ingresso e interpretazione della frase

### 3-ter.1 Perché una schermata d'ingresso

Senza, l'app si apriva su una classifica calcolata con criteri che nessuno aveva scelto:
otto pesi a 5 e il mese deciso dal calendario. È la stessa radice del difetto per cui
"Reimposta tutto" lasciava dodici destinazioni escluse. Chiedere prima rende la prima
classifica dell'utente.

Compare solo alla prima visita: chi ha già cercato va dritto ai risultati. Si torna alla
schermata da **Menu → Nuova ricerca**.

### 3-ter.2 Due interpreti, uno di ripiego

La frase viene tradotta in criteri da uno di due motori, selezionabile:

| | Regole | Modello |
|---|---|---|
| Dove gira | Qui, sempre | Endpoint compatibile OpenAI: Ollama, LM Studio, Groq, OpenRouter |
| Rete | Non serve | Serve, e con un endpoint remoto **la frase esce dal computer** |
| Copertura | Mesi, durate, budget, otto assi con intensità, tipo, requisito mare, nomi | Più ampia, ma variabile |

**Il §6 del planning vieta le API a pagamento, non i modelli.** Un modello locale o un
piano gratuito rispetta il vincolo.

Le regole non sono state rimosse quando è arrivato il modello: restano il ripiego quando
il modello non è configurato, non risponde, va in timeout o restituisce un formato
sbagliato. In tutti quei casi la UI dice **perché** ha ripiegato, invece di fallire in
silenzio.

### 3-ter.3 Le due condizioni che rendono il modello accettabile

Il §5 del planning impone "trasparente e debuggabile". Un modello che imposta otto pesi
senza mostrare come ci è arrivato sarebbe la scatola nera che il progetto rifiuta — e non
si saprebbe più se un risultato strano viene dallo scoring o dall'interpretazione.

1. **L'output non è mai creduto sulla parola.** Passa da `sanitisePatch`, che scarta gli
   assi inventati, riporta i pesi dentro 0–10, rifiuta un mese fuori intervallo, tronca le
   stringhe. Un modello che risponde `mese: 47` non può rompere il ranking. Ciò che viene
   scartato è mostrato all'utente.
2. **Il modello deve dichiarare da quale parola ha dedotto ogni filtro.** Il campo `from`
   è obbligatorio nel prompt, e la UI lo mostra accanto a ogni criterio. Vale per
   entrambi i motori, e accanto ai criteri c'è sempre scritto **chi** li ha prodotti.

Il modello traduce la frase in criteri, e basta: punteggio, filtri duri e ranking restano
calcolati qui dalle stesse regole di sempre.

### 3-ter.4 Il prezzo dell'endpoint remoto

Con Groq o OpenRouter la frase lascia il computer. L'app lo dice esplicitamente nel
pannello di configurazione quando l'endpoint non è locale — è l'unica affermazione della
sezione Privacy del footer che il modello remoto rende falsa, e va detto lì dove si
compie la scelta.

---

## 4. Schema dati

```jsonc
{
  "id": "lisbona",
  "name": "Lisbona",
  "country": "PT",
  "type": "city",                  // city | area | island
  "coords": { "lat": 38.7223, "lon": -9.1393 },
  "radius_km": 40,
  "wikidata_id": "Q597",
  "wikipedia_title": "Lisbona",    // chiave per risolvere la foto a runtime
  "airports": ["LIS"],

  "scores": {                      // 0-100, sempre
    "nature": 45, "culture": 85, "sea": 70, "food": 90,
    "nightlife": 80, "outdoor": 45, "family": 65, "offbeat": 30
  },
  "scores_source": "manual",       // manual | derived — non sovrascrivere i manual

  "climate": {                     // indicizzato "1".."12"
    "10": { "temp_avg": 19, "temp_max": 23, "sea_temp": 20, "rain_days": 9 }
  },
  "climate_source": "seed_approx", // seed_approx | open_meteo

  "costs": {                       // per persona, per notte/giorno
    "accommodation": { "low": 60, "mid": 85, "high": 130 },
    "food_per_day":  { "low": 25, "mid": 35, "high": 55 },
    "transport_local_day": { "low": 4, "mid": 7, "high": 12 },
    "currency": "EUR"
  },

  "pois": [                        // curati a mano, non generati
    { "name": "Alfama", "lat": 38.7118, "lon": -9.1300, "kind": "quartiere" }
  ],

  "notes": "Trasporto pubblico ottimo, molte salite. Alfama pedonale."
}
```

### 4.1 Provenienza dei dati del seed

I valori `climate` del seed sono **stime dell'assistente**, non dati Open-Meteo.
Sono marcati `climate_source: "seed_approx"` e la UI mostra un badge esplicito.
Questo evita che numeri stimati vengano scambiati per misure.

Lo stesso vale per `scores` e `costs`: sono un punto di partenza calibrante, destinato
a essere corretto dall'utente tramite l'editor.

---

## 5. Immagini

Gli URL sono **memorizzati nel dato**, uno per destinazione, con l'attribuzione accanto.

### 5.1 Perché non a runtime — lezione appresa

La prima implementazione risolveva la foto a runtime dalla REST API di Wikipedia, per non
inventare URL di Commons. Non funzionava: **per le città la "lead image" di Wikipedia è lo
stemma o la bandiera**, non una foto del luogo. Su 10 destinazioni del seed, 5 mostravano un
vessillo — Lisbona, Praga, San Sebastián, Tallinn, Madeira.

Il difetto era invisibile ai test e al build. È emerso solo guardando la pagina renderizzata.

### 5.2 Meccanismo attuale

Uno script di risoluzione, eseguito manualmente, per ogni destinazione:

1. interroga la REST API partendo da `wikipedia_title_en`, poi `wikipedia_title`
2. **scarta** i file che sono stemmi, bandiere, sigilli o SVG
3. dove la voce principale è un'entità amministrativa e non un luogo, usa un titolo
   alternativo rappresentativo dell'area (Chania per Creta, Funchal per Madeira) —
   senza mai riscrivere `wikipedia_title*`, che continua a puntare alla destinazione
4. **verifica l'URL con una HEAD** prima di scriverlo, provando larghezze decrescenti
   (Wikimedia non fa upscaling: una thumb più larga dell'originale è 404)
5. recupera autore e licenza da Commons e li scrive in `image_credit`

Risultato: 10 su 10 con foto verificata.

### 5.3 Throttling — regola violata e poi rispettata

La prima esecuzione dello script otteneva 4 fallimenti che sembravano "immagine non
disponibile". Erano **429**: stavo interrogando Wikimedia senza throttling, contro il §7
esplicito del planning. Un 429 scambiato per assenza di immagine fa scrivere nel dato un
fallback che non serviva.

Lo script ora ha intervallo minimo fisso fra le richieste, backoff esponenziale sul 429 e
user-agent identificativo con contatto.

### 5.4 Attribuzione

Le licenze CC-BY e CC-BY-SA **richiedono** il credito: è la condizione d'uso, non un
abbellimento. `image_credit` è mostrato nel pannello di dettaglio sotto la foto.

### 5.5 Fallback

Resta la risoluzione a runtime, con cache in `localStorage`, per le destinazioni create
nell'editor, che un `image_url` non ce l'hanno. Se anche quella non produce nulla, o si è
offline, si disegna un **SVG generato**: gradiente per `type` più iniziali.

Il fallback non è un placeholder d'errore: l'app resta pienamente presentabile senza rete.

---

## 6. Sistema di scoring

### 6.1 Filtri duri — applicati PRIMA dello scoring

Escludono, non penalizzano.

| Filtro | Regola |
|---|---|
| Stagionalità mare | Se `peso(sea) > 0` e `climate[mese].sea_temp < soglia` → esclusa |
| Budget | Se `costo_stimato_totale > budget_max` → esclusa |
| Tipo | Se `type` non è tra i tipi ammessi → esclusa |

Soglia mare predefinita: **21 °C**, regolabile dall'utente.

Il filtro mare si attiva **solo se il peso di `sea` è maggiore di zero**. Chi non ha chiesto
il mare non deve vedersi escludere Praga perché la Moldava è fredda.

### 6.2 Trasparenza delle esclusioni

Le destinazioni escluse non spariscono in silenzio. La UI mostra sempre quante sono state
escluse e **da quale filtro**. Un budget troppo stretto che azzera i risultati deve leggersi
come un filtro troppo stretto, non come un bug.

### 6.3 Calcolo

```
score_totale(d) = Σ (peso_asse × score_asse(d)) / Σ pesi
```

Pesi impostati dall'utente con slider 0-10 per asse. Se tutti i pesi sono zero, il ranking
è indefinito e la UI lo dice, invece di mostrare un ordine arbitrario.

La UI mostra **sempre il contributo di ogni asse**, non solo il totale:
una barra segmentata per riga, e l'aritmetica completa (`peso × punteggio`) nel dettaglio.

### 6.4 Budget di Fase 0 — cosa copre

```
costo_stimato = (accommodation.mid + food_per_day.mid + transport_local_day.mid) × notti
```

**Il volo non è incluso.** Non è nello schema fino alla Fase 2. La UI lo dichiara
esplicitamente accanto al campo budget: `600 €` filtrati qui non sono `600 €` di vacanza.

---

## 7. Persistenza degli override

Il planning §7 impone: "persistenza override manuali: file separato, mai sovrascritto
dagli script di import".

- `data/destinations.json` è il **seed versionato**, sola lettura per l'app
- Le modifiche dell'editor vivono in un layer separato su `localStorage`
- L'editor evidenzia i campi divergenti dal seed e permette di ripristinarli singolarmente
- Export dell'override come file JSON, per il commit in git

L'app non scrive mai sul seed. Gli script di ingestione di Fase 1 scriveranno sul seed ma
mai sull'override.

---

## 8. Architettura

```
clients/vacanze/
├── package.json
├── vite.config.js
├── index.html
├── README.md
├── data/
│   └── destinations.json          seed di 10, fonte di verità versionata
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── lib/
│   │   ├── axes.js                definizione degli 8 assi, unica fonte
│   │   ├── scoring.js             filtri duri + calcolo. PURO, zero DOM
│   │   ├── store.js               merge seed + override, export
│   │   ├── images.js              risoluzione foto + cache + fallback
│   │   └── format.js              formattazione range e valute
│   ├── components/
│   │   ├── FilterPanel.jsx        slider pesi, mese, notti, budget, tipi
│   │   ├── ActiveFilters.jsx      chip rimovibili
│   │   ├── ResultsHeader.jsx      conteggio, ordinamento, toggle vista
│   │   ├── DestinationCard.jsx    card in stile portale annunci
│   │   ├── ScoreBreakdown.jsx     barra segmentata dei contributi
│   │   ├── ExcludedNotice.jsx     quante escluse e da quale filtro
│   │   ├── DetailPanel.jsx        dettaglio + aritmetica + POI
│   │   ├── DetailMap.jsx          Leaflet, solo nel dettaglio
│   │   ├── ComparePanel.jsx       fino a 4 affiancate
│   │   └── EditorPanel.jsx        data entry e override
│   └── styles/
│       ├── tokens.css
│       └── app.css
└── test/
    └── scoring.test.js
```

`src/lib/scoring.js` non importa React e non tocca il DOM. È il modulo che il §9 del
planning chiede di correggere quando il ranking contraddice il giudizio dell'utente,
quindi deve essere leggibile e testabile isolatamente.

---

## 9. Interfaccia

Impianto visivo e di interazione dei portali di annunci immobiliari.

- **Sidebar filtri a sinistra**, sticky, con sezioni comprimibili
- **Lista risultati a destra**, card con header immagine, titolo, "prezzo" (costo stimato)
  in evidenza, riga di attributi con icona
- **Barra chip** dei filtri attivi, ognuno rimovibile singolarmente
- **Header risultati** con conteggio ("8 destinazioni"), ordinamento, toggle griglia/lista
- **Preferiti** (cuore) e **selezione per confronto** (checkbox) sulla card
- **Vista dettaglio** in pannello laterale, con mappa e POI
- Palette: blu profondo istituzionale + accento caldo, superfici chiare, densità informativa alta

---

## 10. Seed — 21 destinazioni

Partito da 10 destinazioni scelte per calibrare il modello, esteso su richiesta con la
Croazia e dieci mete fra le più frequentate d'Europa. Composizione finale: 11 città,
5 aree, 5 isole, in 14 paesi.

Le undici aggiunte sono deliberatamente **note e affollate** — Roma, Parigi, Barcellona,
Santorini, Dubrovnik hanno `offbeat` fra 5 e 12. Servono come contrappeso: se con un peso
alto su "fuori rotta" queste restano in cima, il correttivo previsto dal §5 del planning
non funziona.

Alcune sono state scelte per il valore diagnostico:

| Destinazione | Cosa mette alla prova |
|---|---|
| Roma | `sea: 0` con litorale a 25 km: la modellazione dice "non è una destinazione di mare", e il filtro la esclude |
| Amsterdam | Ha il mare ma il Mare del Nord tocca i 19 °C solo ad agosto: distingue "ha accesso al mare" da "è mare" |
| Algarve | Oceano, non Mediterraneo: a giugno esce con soglia 21 °C mentre la Costiera resta |
| Istanbul | Cultura e cibo altissimi a costi bassissimi: il caso in cui il ranking sorprende di più |
| Vienna | `family: 78`, il massimo fra le città, contro il 45 della Costiera Amalfitana |
| Islanda del Sud | `nature: 99`, il massimo del seed, con il costo di trasporti locali più alto |

### 10.1 Seed originale — le 10 di calibrazione

| ID | Nome | Paese | Tipo |
|---|---|---|---|
| `lisbona` | Lisbona | PT | city |
| `praga` | Praga | CZ | city |
| `san-sebastian` | San Sebastián | ES | city |
| `tallinn` | Tallinn | EE | city |
| `costiera-amalfitana` | Costiera Amalfitana | IT | area |
| `dolomiti` | Dolomiti | IT | area |
| `baia-di-kotor` | Baia di Kotor | ME | area |
| `creta` | Creta | GR | island |
| `madeira` | Madeira | PT | island |
| `lofoten` | Lofoten | NO | island |

Composizione voluta: quattro destinazioni molto note (per calibrare il giudizio dell'utente
contro il ranking) e tre poco ovvie — Kotor, Madeira, Lofoten — per dare al criterio §9.3
del planning ("suggerisce almeno una destinazione non ovvia che risulta sensata")
qualcosa su cui verificarsi.

---

## 11. Test

`test/scoring.test.js` copre il modulo puro:

- media pesata corretta, pesi a zero gestiti
- filtro mare attivo solo con `peso(sea) > 0`
- filtro budget su costo totale, non giornaliero
- filtro tipo
- conteggio delle esclusioni attribuito al filtro giusto
- somma dei contributi per asse uguale al totale

I componenti React non sono testati: in Fase 0 il rischio è nel modello di scoring,
non nel rendering.

---

## 12. Criteri di completamento della Fase 0

Dal §9 del planning. La fase è validata quando, su 20 destinazioni note all'utente:

1. il ranking corrisponde al suo giudizio nella maggior parte dei casi
2. quando non corrisponde, si identifica l'asse responsabile e lo si corregge
3. lo strumento suggerisce almeno una destinazione non ovvia che risulta sensata

Il punto 2 è ciò che giustifica l'intero impianto di trasparenza dei contributi.
Il punto 3 è la condizione di sopravvivenza del progetto: se non si verifica, lo strumento
è un modo complicato di confermare cose già note.

Il seed contiene 21 destinazioni: **la soglia numerica è superata, il test no.**

I punteggi sono stime dell'assistente. Finché restano tali, il ranking misura un giudizio
che non è quello dell'utente, e il §9 non è stato verificato — è stato solo reso
verificabile. Il punto 1 richiede il *suo* giudizio come metro, e quel metro non è ancora
nel dato.

Il lavoro che resta non è aggiungere destinazioni: è correggere i punteggi di quelle che
l'utente conosce davvero, con l'editor, finché il ranking smette di sorprendere. Ogni
correzione è un'ipotesi sul modello, e la tabella dell'aritmetica dice su quale asse
intervenire.
