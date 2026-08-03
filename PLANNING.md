# Destination Finder — Documento di Planning

> Questo file è la base di contesto del progetto. Leggilo prima di scrivere codice.
> Se una decisione qui è marcata **[APERTA]**, non implementarla di iniziativa: chiedi.
>
> **Stato:** le decisioni aperte del §8 sono state sciolte con l'utente il 2026-07-30,
> tranne la §8.2 (normalizzazione), sciolta il 2026-08-03, e la §8.5 (aeroporto di
> partenza), tuttora **rimandata** alla Fase 2.
> Le risoluzioni, e le divergenze approvate rispetto a questo documento, sono in
> `docs/superpowers/specs/2026-07-30-destination-finder-design.md` e in
> `docs/superpowers/specs/2026-08-03-normalizzazione-e-raggio-design.md`.
> Questo file resta la fonte dei vincoli; le spec sono la fonte delle scelte.

---

## 1. Obiettivo

Strumento personale per **scegliere una destinazione di viaggio** in base a criteri di interesse
(natura, cultura, mare, gastronomia…), budget e periodo dell'anno.

Risponde a domande del tipo:

- "Dove vado 5 giorni a ottobre, budget 600 €, voglio soprattutto natura e un po' di cultura?"
- "Confrontami Lisbona, Praga e Budapest per un weekend lungo a marzo"
- "Destinazioni di mare raggiungibili in meno di 3 ore di volo dove a giugno l'acqua è già calda"

L'output è un **confronto ragionato con stima dei costi**, non una prenotazione.

---

## 2. Cosa questo progetto NON è

Vincoli forti. Non implementare queste cose, nemmeno se sembrano un miglioramento naturale.

| Non è | Perché |
|---|---|
| Un booking engine | Non finalizza acquisti. La transazione avviene sempre su siti terzi |
| Un motore di ricerca voli live | In fase di scoperta bastano fasce storiche. Le API live costano e complicano |
| Un prodotto multi-utente | Uso personale, locale. Niente auth, niente account, niente multi-tenancy |
| Un aggregatore globale | Meglio 50 destinazioni curate bene che 5.000 approssimative |
| Un chatbot | L'LLM può assistere l'ingestione dati, ma l'interfaccia principale è filtri + confronto |

**Implicazione legale da non violare:** se un giorno lo strumento agevolasse l'acquisto combinato
di due o più servizi turistici (volo + alloggio) nello stesso processo, ricadrebbe nella
Direttiva UE 2015/2302 con obblighi da tour operator. Restare sul lato "informativo + link
uscente" è una scelta deliberata, non una limitazione temporanea.

---

## 3. Approccio a fasi

Ordine vincolante. **Non saltare alla Fase 1 prima che la Fase 0 sia validata.**

### Fase 0 — Validazione manuale (obiettivo: 1-2 giorni)

- `data/destinations.json` con **30-50 destinazioni europee**, punteggi assegnati **a mano**
- Interfaccia minima: slider per i pesi, ricalcolo dinamico del ranking, vista confronto
- Zero API, zero database, zero ingestione automatica

**Scopo:** capire se l'output è utile *prima* di investire nell'automazione.
Test di validazione: inserire 20 destinazioni che l'utente conosce bene. Se il ranking
contraddice il suo giudizio, il problema è nel modello di scoring, non nei dati.

### Fase 1 — Ingestione semi-automatica

- Script di estrazione da Wikidata e OpenStreetMap
- Punteggi calcolati, con possibilità di **override manuale** persistente
- Espansione a ~200 destinazioni

### Fase 2 — Arricchimento

- Clima mensile (Open-Meteo)
- Stime costi (alloggio, cibo, trasporti locali)
- Fasce prezzo voli per rotta/mese
- Filtro per tempo di volo dall'aeroporto di partenza

### Fase 3 — Solo se le fasi precedenti funzionano

- Ricerca semantica su descrizioni (embedding da Wikivoyage)
- Generazione di bozze di itinerario
- Link affiliati uscenti

---

## 3-bis. Eventi in corso — opzione VERIFICATA, non pianificata

Idea: una destinazione può essere una pessima risposta *oggi* per ragioni che il seed non
può contenere — un incendio, un'alluvione. Verificato con chiamate reali il **31/07/2026**;
non è programmata per nessuna fase, è depositata qui perché il lavoro di verifica non vada
perso. **Non aprirla prima che la Fase 0 sia validata** (§9).

### Cosa è stato provato davvero

| Fonte | Esito |
|---|---|
| **NASA EONET v3** | `200` + `Access-Control-Allow-Origin: *`. **Leggibile dal browser.** |
| Wikipedia REST | `200` + ACAO `*` — usata come controllo della catena di prova |
| Wikinews IT | `200` + ACAO `*`, ma volume di notizie irrisorio |
| Google News RSS | `200` **senza** ACAO: il browser la blocca |
| GDELT DOC 2.0 | **`429` a due tentativi**, e sull'errore nemmeno gli header CORS |
| ReliefWeb (ONU) | `410 Gone` — endpoint dismesso |

Copertura verificata, non dedotta: **1.493 incendi nel mondo negli ultimi 60 giorni, 28 nel
bacino mediterraneo**, i più recenti Turchia 28/07, Portogallo 27/07, Spagna 24/07. La fonte
vede la regione che ci interessa.

### Trappole trovate provando

- **Serve `category=wildfires`.** Senza filtro, su 723 eventi aperti **465 sono ghiaccio marino
  polare**: due terzi di rumore.
- **`status=all`, non `status=open`.** Gli incendi si chiudono in fretta e sparirebbero proprio
  quando servono.
- **L'endpoint geojson dichiara `Content-Type: application/rss+xml`.** È sbagliato, il corpo è
  JSON: chi si fida dell'header si rompe.
- **Il raggio è la decisione vera, e non è stata presa.** Con 300 km, il giorno della prova
  nessuna delle 21 destinazioni risultava toccata — ma l'incendio in Portogallo era a ~510 km
  dall'Algarve. Il seed ha già `radius_km` per destinazione: è lì che va tarato.
  > **Aggiornamento 2026-08-03:** `radius_km` è stato deciso *per i punteggi* (§5) e non
  > serve a questo. Quello che serve qui è un raggio di **portata** — «un evento a X tocca
  > chi sta qui?» — che è una domanda diversa e resta aperta. Quando il §3-bis verrà
  > aperto, la strada probabile è il campo separato `reach_km` valutato e scartato nella
  > spec del 2026-08-03, scartato perché prematuro allora, non perché sbagliato.
- **Basta una chiamata sola**, non 21: EONET restituisce tutti gli eventi e l'abbinamento si fa
  in locale con l'haversine già in `scoring.js`.

### Il modello qui non serve

Era la premessa dell'idea ed è sbagliata. EONET dà dati strutturati — coordinate, categoria,
data: un confronto di distanza fa tutto, in modo deterministico e verificabile. La parte che
avrebbe bisogno di un modello — leggere notizie in prosa — è esattamente quella che il browser
**non** può raggiungere, perché le fonti di news non mandano gli header CORS e qui non c'è un
backend che faccia da proxy.

### Limiti da mettere in conto

- Copre **eventi naturali**: incendi, tempeste, vulcani, alluvioni. Non scioperi, non disordini,
  non un museo chiuso per restauro. Per quelli servirebbe un proxy, cioè un server, cioè il
  vincolo "gira in locale" che salta.
- Dipendenza da un servizio governativo statunitense, senza garanzie di continuità. Se sparisce,
  sparisce la funzione: non deve entrare in nessun calcolo che debba funzionare comunque.

### Come andrebbe integrata

Come la critica del ranking: **una segnalazione visibile, mai un punteggio che cala da solo.**
Un avviso sulla card — *"Incendio attivo a 40 km, rilevato il 28/07 (NASA EONET)"* — con la
fonte, la data e il bottone per escludere la destinazione. Un punteggio che cambia per una
notizia che non vedi è la scatola nera che il §5 rifiuta.

---

## 4. Modello dati

### Decisione strutturale [APERTA → risolta]

**Cosa è una "destinazione"?** Un comune? Un'area? La Costiera Amalfitana non è un comune ma è
la risposta corretta a certe query. Questa scelta condiziona l'intero schema ed è costosa da
cambiare dopo.

**Risolta:** entità geografica con centro e **raggio di influenza** in km, con un campo `type`
a **tre** valori: `city` | `area` | `island`.

### Schema `destinations.json`

```json
{
  "id": "lisbona",
  "name": "Lisbona",
  "country": "PT",
  "type": "city",
  "coords": { "lat": 38.7223, "lon": -9.1393 },
  "radius_km": 40,
  "wikidata_id": "Q597",
  "airports": ["LIS"],

  "scores": {
    "nature": 45,
    "culture": 85,
    "sea": 70,
    "food": 90,
    "nightlife": 80,
    "walkability": 75,
    "offbeat": 30
  },
  "scores_source": "manual",

  "climate": {
    "10": { "temp_avg": 19, "temp_max": 23, "sea_temp": 20, "rain_days": 9 }
  },

  "costs": {
    "accommodation_mid": 85,
    "food_per_day_mid": 35,
    "transport_local_day": 7,
    "currency": "EUR"
  },

  "notes": "Trasporto pubblico ottimo, molte salite. Alfama pedonale."
}
```

> **Divergenze approvate rispetto a questo schema** (dettaglio nella spec):
> gli assi sono otto (`walkability` rimosso, `outdoor` e `family` aggiunti), e i costi
> sono memorizzati come `{low, mid, high}` per voce — un valore puntuale non può
> produrre la fascia che il §6 richiede.

Note sullo schema:

- `scores` sono **0-100**, sempre. Nessun punteggio grezzo (conteggi, densità) nel file finale
- `scores_source` traccia se il punteggio è manuale o derivato: serve per non sovrascrivere
  override umani durante i re-import
- `climate` è indicizzato per mese (`"1"`–`"12"`)
- I costi sono **per persona, per notte/giorno**, fascia media

---

## 5. Sistema di scoring

### Principio guida

**Trasparente e debuggabile, non accurato.** Quando un risultato sembra sbagliato,
si deve poter vedere subito quale asse ha contribuito. Niente black box.

### Calcolo

```
score_totale(destinazione) = Σ (peso_asse × score_asse) / Σ pesi
```

I pesi li imposta l'utente (slider 0-10 per asse). L'UI mostra sempre il **contributo di
ogni asse** al totale, non solo il risultato.

### Filtri duri (esclusione, non penalizzazione)

Applicati **prima** dello scoring:

- **Stagionalità:** se l'utente chiede "mare" e la temperatura del mare nel mese scelto è
  sotto soglia, la destinazione esce. Il mare a dicembre non è mare con un punteggio più basso:
  non è mare
- **Budget:** costo stimato totale sopra il massimo → esclusa
- **Tempo di volo** massimo dall'origine

### Problema noto: normalizzazione [APERTA → risolta]

Il conteggio assoluto dei musei premia le capitali e schiaccia i centri minori.
La densità per abitante fa il contrario. La somma dei sitelink Wikipedia è un buon proxy di
rilevanza ma premia il turismo di massa — l'opposto di ciò che si vuole da questo strumento.

Nessuna soluzione è corretta a priori. Da decidere guardando output reali in Fase 0.
Ipotesi da testare: combinazione di rilevanza (top-N attrazioni per sitelink) e densità,
con l'asse `offbeat` a fare da correttivo esplicito.

> **Risolta il 2026-08-03** guardando output reali su 157 destinazioni —
> dettaglio, misure e alternative scartate in
> `docs/superpowers/specs/2026-08-03-normalizzazione-e-raggio-design.md`.
>
> **Metodo: somma dei sitelink Wikipedia dei primi cinque POI per rilevanza**
> (Spearman 0.90 contro il giudizio umano). Scartati il conteggio assoluto
> (0.38 — misura il raggio, non il posto) e la densità (0.59 — inverte il
> difetto invece di correggerlo). **Scartata anche l'ipotesi qui sopra**:
> rilevanza × densità si ferma a 0.63, e il valore migliore che mostrava in una
> prima misura era un artefatto da POI non deduplicati.
>
> Il correttivo `offbeat` resta come previsto, esplicito e visibile: il bias
> verso il turismo di massa è reale e va lasciato leggibile, non compensato
> dentro la formula.
>
> **Attribuzione dei POI:** un POI conta per la sola destinazione del catalogo
> che gli sta più vicina, e solo se rientra nel suo raggio. Senza questa regola
> Ischia, Capri e Procida ottengono gli identici monumenti di Napoli e battono
> Napoli stessa. Conseguenza: i punteggi derivati sono relativi al catalogo, e
> **ogni ampliamento richiede di rilanciare lo scoring su tutte** le
> destinazioni, non solo sulle nuove.

---

## 6. Fonti dati

Tutte gratuite. **Nessuna API commerciale a pagamento in nessuna fase.**

| Dato | Fonte | Endpoint / accesso |
|---|---|---|
| Musei, monumenti, UNESCO | Wikidata | SPARQL: `https://query.wikidata.org/sparql` |
| Spiagge, sentieri, parchi | OpenStreetMap | Overpass API |
| Aree protette | Protected Planet (WDPA) | Download dataset |
| Descrizioni testuali | Wikivoyage | API MediaWiki, licenza CC |
| Clima mensile e temperatura mare | Open-Meteo | API gratuita, storico incluso |
| Anagrafica geografica | GeoNames | Dump scaricabile |
| Costo della vita | Numbeo / Eurostat | Qualità variabile — vedi sotto |
| Fasce prezzo voli | Travelpayouts Data API | Account affiliato gratuito |

### Tag OSM rilevanti

```
natural=beach
leisure=nature_reserve
boundary=protected_area
route=hiking
tourism=viewpoint / museum / attraction
historic=*
```

### Sketch query Wikidata

Musei entro un raggio da un punto, ordinati per rilevanza (sitelink):

```sparql
SELECT ?item ?itemLabel ?coord ?sitelinks WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(-9.1393 38.7223)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "40" .
  }
  ?item wdt:P31/wdt:P279* wd:Q33506 .   # istanza di museo
  ?item wikibase:sitelinks ?sitelinks .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 50
```

### Avvertenza sulla precisione

I costi di cibo e trasporti **non sono dati, sono stime**. L'interfaccia deve mostrare
**fasce** (`35-60 €/giorno`) e non valori puntuali. Un numero come `47,30 €` comunica
una precisione inesistente e distrugge la fiducia nell'output appena l'utente lo verifica.

---

## 7. Stack tecnico

Preferenze, non vincoli assoluti — se hai una ragione forte per divergere, proponila.

- **Frontend:** single page, framework leggero. Il ricalcolo dinamico dei punteggi è
  gestione di stato banale, non serve nulla di elaborato
- **Dati:** JSON su filesystem in Fase 0-1. Database solo quando il JSON diventa ingestibile
- **Script di ingestione:** Python, eseguiti manualmente, output versionato in git
- **Persistenza override manuali:** file separato, mai sovrascritto dagli script di import

> **Scelto:** React + Vite, su richiesta esplicita dell'utente, per parità visiva con i
> portali di annunci immobiliari. Costo accettato: serve `npm run dev`.

### Regole

- Gli script di ingestione **non scrivono mai direttamente** su `destinations.json`:
  producono un file di staging che viene confrontato e fuso con revisione
- Ogni chiamata a fonti esterne va **cachata su disco**. Rieseguire uno script non deve
  ripetere centinaia di query a Wikidata
- Rispettare i rate limit delle API pubbliche (Overpass e Wikidata sono servizi gratuiti
  condivisi: throttling obbligatorio, user-agent identificativo)

---

## 8. Decisioni aperte

Da risolvere con l'utente, non da assumere. **Risolte il 2026-07-30**, tranne dove indicato.

1. **Granularità delle destinazioni** — ibrido a tre tipi: `city` | `area` | `island`
2. **Metodo di normalizzazione dei punteggi** — **risolta il 2026-08-03**: somma dei
   sitelink dei primi cinque POI, con attribuzione di ogni POI alla destinazione più
   vicina. Vedi §5 e la spec del 2026-08-03
3. **Set degli assi di interesse** — otto: `nature`, `culture`, `sea`, `food`, `nightlife`,
   `outdoor`, `family`, `offbeat`. `walkability` rimosso
4. **Ambito geografico iniziale** — Europa intera, nessun vincolo di distanza
5. **Aeroporto di partenza** — **rimandata**: il filtro tempo di volo è Fase 2

---

## 9. Criteri di successo

La Fase 0 è validata quando, su 20 destinazioni note all'utente:

- il ranking corrisponde al suo giudizio nella maggior parte dei casi
- quando non corrisponde, si riesce a **identificare l'asse responsabile** e correggerlo
- lo strumento suggerisce almeno una destinazione **non ovvia** che risulta sensata

Se il terzo punto non si verifica, lo strumento è un modo complicato di confermare cose
già note e va ripensato prima di procedere.

---

## 10. Monetizzazione (solo ipotesi futura)

Non implementare nulla in questa direzione senza richiesta esplicita.

Se un giorno lo strumento uscisse dall'uso personale: **affiliazione, non pubblicità.**
Una prenotazione alloggio da 600 € al 4-6% rende quanto 1.500-3.000 pagine viste di
banner. L'implementazione è un link uscente contestuale, senza toccare l'architettura.

Vincolo da mantenere: nessuna proposta mirata di un secondo servizio turistico dopo la
conferma di una prenotazione — è la definizione di "servizio turistico collegato" e farebbe
scattare gli obblighi della direttiva UE.
