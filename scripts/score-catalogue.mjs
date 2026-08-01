/**
 * Assegna i punteggi alle destinazioni che non ne hanno.
 *
 *   node scripts/score-catalogue.mjs
 *
 * NON scrive su data/destinations.json: produce data/staging/scores.json (§7).
 *
 * **Chi ha scritto questi numeri.** Li ha scritti l'assistente, non chi usa lo
 * strumento, e la marca `scores_source: "assistant"` lo dice. È una
 * distinzione che conta: `manual` significa "una persona ha guardato e
 * deciso", ed è il solo valore che un import non sovrascrive mai.
 *
 * **Perché scriverli comunque.** L'alternativa non era "i punteggi giusti":
 * era nessun punteggio, cioè settantanove destinazioni invisibili — il ranking
 * le esclude finché non sono valutate. Una stima discutibile che si può
 * correggere batte un vuoto che non si può correggere. E correggere è più
 * facile che compilare: davanti a un numero sbagliato si sa subito di quanto,
 * davanti a una casella vuota bisogna inventare la scala.
 *
 * **Come sono calibrati.** Sulla scala delle ventitré già presenti, che fanno
 * da ancore: Roma 98 di cultura, San Sebastián 97 di cibo, Dolomiti 97 di
 * outdoor, Lofoten 85 di fuori rotta, Creta 90 di mare. Un punteggio ha senso
 * solo in rapporto agli altri, quindi ogni voce qui sotto è stata scelta
 * chiedendosi "più o meno di quale ancora".
 *
 * **Cosa NON significano.** Non sono misure e non c'è una fonte: sono
 * un'opinione informata su come un posto si comporta rispetto agli altri del
 * catalogo. Il punto della Fase 0 è che tu li contraddica dove li conosci.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'data/destinations.json')
const STAGING = resolve(ROOT, 'data/staging/scores.json')

/* Ordine: natura, cultura, mare, cibo, vita notturna, outdoor, famiglia, fuori rotta. */
const A = ['nature', 'culture', 'sea', 'food', 'nightlife', 'outdoor', 'family', 'offbeat']

const PUNTEGGI = {
  // --- Italia ------------------------------------------------------------
  firenze:            [30, 96,  0, 88, 55, 30, 58, 5],
  venezia:            [45, 95, 30, 78, 50, 25, 55, 8],
  napoli:             [45, 90, 55, 95, 72, 35, 50, 35],
  torino:             [42, 82,  0, 88, 65, 40, 58, 45],
  bologna:            [30, 82,  0, 95, 75, 28, 58, 30],
  palermo:            [42, 88, 62, 92, 62, 38, 50, 45],
  verona:             [35, 82,  0, 80, 55, 35, 62, 25],
  siena:              [55, 88,  0, 82, 35, 45, 60, 30],
  matera:             [50, 90,  0, 72, 32, 45, 45, 62],
  lecce:              [40, 82, 60, 82, 60, 35, 55, 55],
  trieste:            [45, 72, 45, 72, 50, 45, 55, 62],
  genova:             [40, 75, 55, 85, 55, 40, 55, 50],
  'val-d-orcia':      [92, 62,  0, 88, 15, 62, 60, 35],
  'cinque-terre':     [85, 60, 70, 75, 25, 72, 50, 12],
  salento:            [55, 55, 88, 82, 65, 40, 68, 42],
  langhe:             [82, 55,  0, 97, 20, 58, 50, 48],
  'lago-di-como':     [88, 62,  0, 75, 30, 65, 62, 25],
  'val-gardena':      [92, 30,  0, 68, 18, 95, 78, 35],
  sicilia:            [72, 92, 82, 92, 55, 62, 65, 30],
  sardegna:           [80, 55, 95, 78, 55, 68, 78, 35],
  'isola-d-ischia':   [62, 45, 82, 75, 40, 55, 68, 30],
  'isole-eolie':      [85, 45, 85, 72, 45, 72, 45, 62],

  // --- Penisola iberica --------------------------------------------------
  madrid:             [30, 88,  0, 88, 92, 32, 62, 12],
  siviglia:           [35, 92,  0, 88, 82, 32, 60, 18],
  granada:            [58, 95,  0, 82, 70, 62, 55, 25],
  valencia:           [40, 75, 72, 85, 78, 48, 70, 25],
  bilbao:             [45, 78, 45, 92, 62, 50, 58, 42],
  porto:              [42, 85, 35, 88, 78, 40, 58, 30],
  ibiza:              [50, 35, 85, 65, 98, 45, 40, 5],
  tenerife:           [82, 35, 78, 62, 60, 82, 78, 20],
  formentera:         [62, 20, 92, 60, 35, 45, 55, 35],

  // --- Francia e Benelux -------------------------------------------------
  lione:              [38, 82,  0, 96, 68, 38, 60, 32],
  marsiglia:          [50, 75, 70, 82, 72, 55, 50, 38],
  nizza:              [58, 68, 78, 78, 68, 55, 62, 15],
  bordeaux:           [42, 78,  0, 92, 65, 40, 58, 30],
  bruges:             [40, 88,  0, 72, 40, 32, 62, 15],
  gand:               [38, 82,  0, 75, 68, 32, 58, 45],
  provenza:           [88, 75,  0, 88, 30, 62, 62, 25],
  'costa-azzurra':    [62, 65, 80, 78, 72, 55, 60, 10],
  bretagna:           [85, 62, 55, 78, 32, 72, 65, 45],

  // --- Europa centrale ---------------------------------------------------
  berlino:            [35, 88,  0, 78, 95, 35, 55, 30],
  'monaco-di-baviera':[42, 80,  0, 82, 78, 45, 68, 22],
  amburgo:            [35, 72, 20, 75, 82, 35, 58, 35],
  dresda:             [40, 85,  0, 65, 55, 35, 58, 45],
  salisburgo:         [62, 88,  0, 72, 45, 55, 68, 25],
  innsbruck:          [80, 68,  0, 68, 52, 88, 70, 30],
  lubiana:            [58, 72,  0, 72, 62, 55, 65, 52],
  zagabria:           [42, 72,  0, 72, 65, 40, 60, 55],
  cracovia:           [40, 92,  0, 78, 82, 35, 58, 32],
  bratislava:         [40, 68,  0, 65, 68, 38, 55, 55],
  'foresta-nera':     [88, 45,  0, 72, 15, 82, 72, 42],
  baviera:            [82, 72,  0, 78, 30, 78, 75, 32],

  // --- Nord --------------------------------------------------------------
  copenaghen:         [42, 80, 25, 92, 78, 48, 72, 20],
  stoccolma:          [58, 82, 30, 78, 75, 50, 70, 22],
  oslo:               [62, 72, 25, 70, 62, 62, 65, 32],
  helsinki:           [52, 72, 25, 72, 65, 48, 65, 45],
  reykjavik:          [70, 62, 12, 68, 72, 78, 55, 42],
  edimburgo:          [55, 92,  0, 72, 75, 55, 62, 22],
  dublino:            [45, 78, 15, 72, 88, 45, 58, 25],
  riga:               [45, 80, 35, 68, 72, 42, 58, 55],
  vilnius:            [45, 78,  0, 68, 65, 42, 58, 62],
  lapponia:           [95, 32,  0, 45, 12, 92, 68, 82],
  'f-r-er':           [97, 35, 15, 45, 10, 88, 40, 92],

  // --- Sud-est e Mediterraneo --------------------------------------------
  atene:              [30, 97, 45, 85, 82, 32, 52, 15],
  salonicco:          [32, 78, 55, 90, 85, 32, 52, 45],
  spalato:            [55, 78, 82, 72, 68, 58, 58, 25],
  zara:               [52, 72, 82, 68, 60, 55, 58, 40],
  cattaro:            [80, 72, 70, 60, 45, 70, 52, 55],
  sarajevo:           [55, 82,  0, 78, 55, 58, 50, 72],
  belgrado:           [32, 65,  0, 72, 92, 35, 48, 58],
  sofia:              [58, 68,  0, 68, 65, 68, 52, 65],
  bucarest:           [30, 65,  0, 72, 82, 30, 45, 62],
  'la-valletta':      [35, 90, 62, 70, 58, 35, 55, 30],
  rodi:               [55, 78, 88, 70, 65, 50, 68, 22],
  corfu:              [72, 65, 85, 70, 62, 55, 68, 30],
  malta:              [42, 85, 75, 68, 62, 45, 62, 28],
  cipro:              [58, 72, 88, 70, 62, 55, 70, 32],
  peloponneso:        [82, 88, 78, 78, 25, 68, 58, 58],
  istria:             [68, 68, 78, 82, 45, 62, 65, 45],
}

/**
 * I costi, per fasce e non uno per uno.
 *
 * Settecento numeri scritti a mano sarebbero settecento occasioni di
 * incoerenza — Bratislava più cara di Vienna per una distrazione, e nessun
 * modo di accorgersene. Le fasce impongono invece una domanda sola per
 * destinazione, che è anche l'unica a cui so rispondere onestamente: *quanto
 * costa rispetto alle altre*. Dentro una fascia i rapporti fra alloggio, cibo
 * e trasporti restano quelli delle ventitré ancore.
 *
 * I valori sono a persona, per notte: bassa / media / alta.
 */
const FASCE = {
  //                 alloggio        cibo          trasporti
  economica:    { a: [30, 52, 90],  c: [13, 22, 38], t: [3, 5, 9] },   // Balcani, baltici dell'est
  contenuta:    { a: [40, 68, 115], c: [16, 27, 46], t: [3, 6, 11] },  // Europa centro-orientale, Portogallo
  media:        { a: [55, 92, 150], c: [20, 35, 58], t: [4, 8, 14] },  // Italia, Spagna, Grecia
  alta:         { a: [70, 115, 190], c: [25, 44, 74], t: [5, 9, 16] }, // capitali occidentali
  altissima:    { a: [90, 148, 245], c: [30, 55, 92], t: [6, 12, 21] },// nord, isole di lusso, alta stagione
}

/* Le aree e le isole hanno trasporti locali più cari: senza auto o traghetto
   non ci si muove, ed è una differenza che si sente sul totale. */
const TRASPORTO_EXTRA = { area: 1.8, island: 1.6, city: 1 }

const FASCIA = {
  // economica
  sarajevo: 'economica', sofia: 'economica', bucarest: 'economica', belgrado: 'economica',
  // contenuta
  cracovia: 'contenuta', bratislava: 'contenuta', zagabria: 'contenuta', lubiana: 'contenuta',
  vilnius: 'contenuta', riga: 'contenuta', porto: 'contenuta', salonicco: 'contenuta',
  cattaro: 'contenuta', dresda: 'contenuta', matera: 'contenuta', lecce: 'contenuta',
  salento: 'contenuta', palermo: 'contenuta', atene: 'contenuta', rodi: 'contenuta',
  corfu: 'contenuta', malta: 'contenuta', 'la-valletta': 'contenuta', cipro: 'contenuta',
  peloponneso: 'contenuta', sicilia: 'contenuta', istria: 'contenuta', zara: 'contenuta',
  // media
  firenze: 'media', bologna: 'media', torino: 'media', verona: 'media', siena: 'media',
  genova: 'media', trieste: 'media', napoli: 'media', madrid: 'media', siviglia: 'media',
  granada: 'media', valencia: 'media', bilbao: 'media', lione: 'media', marsiglia: 'media',
  bordeaux: 'media', gand: 'media', bruges: 'media', 'monaco-di-baviera': 'media',
  amburgo: 'media', berlino: 'media', salisburgo: 'media', innsbruck: 'media',
  baviera: 'media', 'foresta-nera': 'media', bretagna: 'media', provenza: 'media',
  edimburgo: 'media', dublino: 'media', helsinki: 'media', spalato: 'media',
  'val-d-orcia': 'media', langhe: 'media', 'cinque-terre': 'media', 'lago-di-como': 'media',
  sardegna: 'media', 'isola-d-ischia': 'media', 'isole-eolie': 'media', tenerife: 'media',
  // alta
  venezia: 'alta', nizza: 'alta', 'costa-azzurra': 'alta', copenaghen: 'alta',
  stoccolma: 'alta', oslo: 'alta', ibiza: 'alta', formentera: 'alta', 'val-gardena': 'alta',
  // altissima
  reykjavik: 'altissima', lapponia: 'altissima', 'f-r-er': 'altissima',
}

const arrotonda = (v) => Math.round(v)

function costiPer(id, tipo) {
  const fascia = FASCE[FASCIA[id]]
  if (!fascia) return null
  const k = TRASPORTO_EXTRA[tipo] ?? 1
  const banda = (valori, moltiplicatore = 1) => ({
    low: arrotonda(valori[0] * moltiplicatore),
    mid: arrotonda(valori[1] * moltiplicatore),
    high: arrotonda(valori[2] * moltiplicatore),
  })
  return {
    accommodation: banda(fascia.a),
    food_per_day: banda(fascia.c),
    transport_local_day: banda(fascia.t, k),
    currency: 'EUR',
  }
}

const doc = JSON.parse(readFileSync(SOURCE, 'utf8'))
const changes = {}
const mancanti = []
const senzaFascia = []

for (const d of doc.destinations) {
  if (d.scores) continue
  const valori = PUNTEGGI[d.id]
  if (!valori) { mancanti.push(`${d.id} (${d.name})`); continue }

  const patch = {
    scores: Object.fromEntries(A.map((asse, i) => [asse, valori[i]])),
    scores_source: 'assistant',
  }

  /* Senza costi `tripCost` restituisce zero, e una destinazione a costo zero
     vince qualunque ordinamento per prezzo e passa qualunque budget. Sarebbe
     un dato falso più dannoso di un dato assente. */
  if (!d.costs) {
    const costs = costiPer(d.id, d.type)
    if (!costs) { senzaFascia.push(`${d.id} (${d.name})`); continue }
    patch.costs = costs
    patch.costs_source = 'assistant'
  }

  changes[d.id] = patch
}

/* Un asse fuori scala sarebbe un errore di battitura che passa inosservato
   fino a comparire in una classifica. */
const fuoriScala = Object.entries(changes)
  .flatMap(([id, c]) => Object.entries(c.scores)
    .filter(([, v]) => !Number.isInteger(v) || v < 0 || v > 100)
    .map(([asse, v]) => `${id}.${asse} = ${v}`))

mkdirSync(dirname(STAGING), { recursive: true })
writeFileSync(STAGING, `${JSON.stringify({ source: 'assistant', changes }, null, 2)}\n`, 'utf8')

console.log(`${Object.keys(changes).length} schede compilate.`)
if (mancanti.length) console.log(`Senza punteggi: ${mancanti.join(', ')}`)
if (senzaFascia.length) console.log(`SENZA FASCIA DI COSTO: ${senzaFascia.join(', ')}`)
if (fuoriScala.length) console.log(`FUORI SCALA: ${fuoriScala.join(', ')}`)
console.log(`Staging: ${STAGING}`)
console.log('Nessuna modifica applicata a destinations.json: fondila con merge-staging.mjs.')
