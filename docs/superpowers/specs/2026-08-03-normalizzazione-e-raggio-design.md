# Normalizzazione dei punteggi e attribuzione dei POI — Design

> Scioglie la decisione **§8.2** di `PLANNING.md` — l'ultima rimasta aperta — e
> la questione del raggio che il §3-bis aveva depositato senza risolverla.
>
> Deciso con l'utente il **2026-08-03**, guardando output reali come il §5 del
> planning richiede. Le misure sono riproducibili: una query
> `wikibase:around` per destinazione su Wikidata, otto tipi culturali
> (`Q33506` museo, `Q4989906` monumento, `Q23413` castello, `Q839954` sito
> archeologico, `Q16970` chiesa, `Q16560` palazzo, `Q2977` cattedrale,
> `Q109607` rovina), 157 destinazioni su 158.

---

## 1. Il metodo: rilevanza, non conteggio

**Deciso: la somma dei sitelink Wikipedia dei primi cinque POI per rilevanza.**

I tre candidati del §5 messi sugli stessi dati, misurati come somiglianza di
rango (Spearman) col giudizio umano — cioè con le sole 23 destinazioni marcate
`scores_source: manual`, le uniche in cui una persona ha davvero deciso:

| metodo | sulle 23 ancore umane |
|---|---|
| conteggio assoluto dei POI | 0.38 |
| densità per km² | 0.59 |
| **somma sitelink dei primi 5** | **0.90** |
| rilevanza × densità *(l'ipotesi del §5)* | 0.63 |

### Perché non gli altri

**Il conteggio assoluto misura il raggio, non il posto.** Il lago di Como conta
9.553 POI contro i 1.905 di Roma, cinque volte tanti, per il solo fatto di
avere `radius_km: 90`. Nella classifica per conteggio le Dolomiti risultano
quarte *per cultura*: un cerchio da 60 km raccoglie ogni chiesa di valle. Il §5
temeva che il conteggio premiasse le capitali; fa di peggio, premia chi ha il
cerchio più largo.

**La densità inverte il difetto invece di correggerlo.** Dividendo per l'area,
tutto ciò che è grande è penalizzato per costruzione: in cima arrivano Milano e
Bergamo, davanti a Firenze. La densità di edifici di culto non è interesse
culturale.

**L'ipotesi rilevanza × densità non regge la deduplicazione.** In una prima
misura dava 0.77 e sembrava competitiva. Quel valore era un artefatto: la query
non deduplicava, un monumento con due tipi (`castello` e `palazzo`) contava due
volte, e le due componenti si sostenevano a vicenda proprio dove la densità era
alta. Su dati deduplicati scende a 0.63 e resta lì per qualunque N.

### Perché cinque

Il valore di N è su un pianoro, il che è la cosa migliore che si possa dire di
un parametro:

| top-N | 1 | 3 | **5** | 10 | 20 | 50 |
|---|---|---|---|---|---|---|
| Spearman | 0.86 | 0.91 | **0.90** | 0.90 | 0.87 | 0.81 |

Cinque sta a metà del pianoro: meno esposto di N=3 a una singola voce mancante,
meno diluito di N=20 dalla coda lunga di chiese minori.

### Il difetto che resta, e va lasciato visibile

Sulle 23 ancore lo scarto massimo è di sei posizioni, e cade sempre sullo
stesso tipo di posto: **Barcellona +6, Dubrovnik +6, Baia di Kotor +5,
Costiera Amalfitana −6.** Il metodo sottovaluta i luoghi la cui cultura non è
fatta di monumenti censiti — una città murata, una costa — e sopravvaluta chi
ha molte voci Wikipedia.

È il bias verso il turismo di massa che il §5 aveva previsto. Il correttivo
resta quello già previsto: l'asse `offbeat`, esplicito e visibile, **non** una
compensazione nascosta dentro la formula. Un punteggio che si corregge da solo
per ragioni che non si vedono è la scatola nera che il §5 rifiuta.

### Un bias della fonte, non del metodo

I centri minori crollano con **ogni** metodo, e più a est si va peggio è:
Toledo passa dall'8° posto a mano al 102° calcolato, Mostar dal 41° al 123°,
Carcassonne dal 18° al 137°. Non è normalizzazione: Wikidata è densa dove
qualcuno la compila, e misurare la cultura contando voci Wikidata misura anche
chi scrive su Wikidata. Spagna interna, sud Italia e Balcani lo pagano.

Conseguenza operativa: **i punteggi derivati non sono un'autorità.** La regola
del §7 — nessun import sovrascrive un `scores_source: manual` — non è
un'accortezza tecnica, è il rimedio a questo.

---

## 2. Il raggio: un POI conta per la destinazione più vicina

**Deciso: il cerchio resta per pescare i candidati, ma un POI viene attribuito
alla sola destinazione del catalogo che gli sta più vicina, e solo se rientra
nel raggio di quella destinazione.**

### Il caso che ha imposto la decisione

Con l'attribuzione per solo cerchio, tre isole diverse ottenevano gli identici
otto monumenti — quelli di Napoli — perché `radius_km: 60` fa arrivare i loro
cerchi sulla terraferma:

```
isola d'Ischia   122,72,55,48,34,33,32,29
Isola di Capri   122,72,55,48,34,33,32,29
Procida          122,72,55,48,34,33,32,29
```

Non è un caso isolato: nel catalogo ci sono **51 coppie** in cui il centro di
una destinazione cade dentro il cerchio di un'altra, 14 delle quali reciproche.

Il grappolo napoletano, prima e dopo (somma dei primi 5 sitelink):

| | oggi | con attribuzione al più vicino |
|---|---|---|
| Napoli | 308 | 194 |
| isola d'Ischia | 331 | 22 |
| Isola di Capri | 331 | 59 |
| Procida | 331 | 99 |
| Costiera Amalfitana | 251 | 251 |

Oggi le tre isole non solo si equivalgono: **battono Napoli**, 331 contro 308,
usando i monumenti di Napoli. Dopo tornano tre valori distinti e ordinati in
modo plausibile, con Ischia ultima — che è anche l'ordine dei giudizi scritti a
mano. Napoli e la Costiera Amalfitana perdono quasi nulla, perché quei
monumenti sono davvero loro.

### Perché non le alternative

**Raggi più stretti per tipo** (città 20, isola 25, area 50) lasciano intatti
gli annidamenti veri — Malta contiene La Valletta a 6 km, il Salento contiene
Lecce a 14 km — e tolgono alle aree ciò che le rende aree. Ischia a 25 km
escluderebbe Napoli ma continuerebbe a prendersi Procida a 11 km.

**Due raggi distinti nello schema** (`radius_km` stretto per l'identità,
`reach_km` largo per escursioni ed eventi) risolve il conflitto alla radice ed
è probabilmente dove si finirà quando il §3-bis verrà aperto. Ma sono 316
valori da decidere a mano quando oggi ne sbagliamo già 158.

### Il prezzo, accettato consapevolmente

**I punteggi diventano relativi al catalogo.** Aggiungere Pompei domani
cambierebbe il punteggio di Napoli, perché alcuni POI passerebbero di mano.
Due conseguenze da tenere in conto:

1. Ogni ampliamento del catalogo richiede di **rilanciare lo scoring su tutte**
   le destinazioni, non solo sulle nuove.
2. La regola «`manual` non si sovrascrive mai» diventa più importante, non meno:
   è l'unico strato che non si muove sotto i piedi.

Questo non contraddice il §5: i punteggi erano già dichiaratamente relativi
(«un punteggio ha senso solo in rapporto agli altri»). La novità è che ora lo
sono anche meccanicamente.

### Il caso che questa regola non risolve

Un POI più vicino a una destinazione minore che a quella a cui appartiene
davvero verrà attribuito alla minore. Il rimedio è lo stesso di sempre —
correggerlo a mano e marcarlo `manual` — e la ragione per cui i punteggi
derivati restano marcati `assistant`: sono una stima da contraddire, non una
misura.

---

## 3. Limiti di questa decisione

**Si chiude su 23 punti di giudizio umano, e sono ancore, non validazioni.**
Il §9 del planning chiede che 20 destinazioni note siano confrontate col
giudizio dell'utente, e di quel confronto non risulta traccia. Le 23 `manual`
sono state *scritte* come scala di riferimento, non *verificate* una per una.
Il metodo vince nettamente, ma vince su un campione che è anche il debito
aperto del §9.

Se quella validazione verrà fatta e contraddirà queste 23, il numero da rifare
è lo Spearman, e questa decisione va riaperta. Gli script per rifarlo sono
deterministici: stessa query, stessi tipi, stesso N.

---

## 4. Fuori perimetro

Non toccati: lo schema del §4, i filtri duri del §5, le fonti del §6, la
struttura delle fasi. Il §3-bis (eventi naturali) resta chiuso e non
programmato — ma la sua nota «il raggio è la decisione vera, e non è stata
presa» va letta insieme al §2 qui sopra: per gli eventi servirà comunque un
raggio di *portata*, che è una domanda diversa da quella risolta qui.
