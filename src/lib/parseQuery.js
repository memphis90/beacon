/**
 * Traduce una frase in italiano nei criteri di ricerca.
 *
 * Deterministico di proposito. Il §5 del planning stabilisce che il principio
 * guida è "trasparente e debuggabile, non accurato": un modello che imposta
 * otto pesi senza mostrare come ci è arrivato reintrodurrebbe la scatola nera
 * che questo progetto esiste per evitare — e non si saprebbe più se un
 * risultato strano viene dallo scoring o dall'interpretazione della frase.
 *
 * Qui ogni traduzione è ispezionabile: `understood` dice cosa ha agganciato e
 * grazie a quale parola, `ignored` dice cosa ha riconosciuto ma non sa fare.
 *
 * Il modulo è PURO e non importa React: se un giorno si volesse provare un
 * modello, basta che produca lo stesso oggetto `patch` e il resto dell'app non
 * cambia di una riga.
 */

import { restoreOriginal, toItalian } from './lexicon.js'

const MONTHS = [
  ['gennaio', 1], ['febbraio', 2], ['marzo', 3], ['aprile', 4],
  ['maggio', 5], ['giugno', 6], ['luglio', 7], ['agosto', 8],
  ['settembre', 9], ['ottobre', 10], ['novembre', 11], ['dicembre', 12],
]

const SEASONS = [
  ['primavera', 4], ['estate', 7], ['autunno', 10], ['inverno', 1],
]

/**
 * I numeri scritti in lettere.
 *
 * "cinque notti" è il modo normale di scrivere una durata in una frase — più
 * naturale di "5 notti" — e prima non produceva niente: la regola voleva
 * cifre. Chi scriveva così arrivava ai risultati con le notti predefinite,
 * senza che nulla dicesse che quel pezzo di frase era stato buttato.
 *
 * Si fermano a venti perché oltre non servono: `nights` è tagliato a 60 e una
 * vacanza scritta in lettere oltre le tre settimane non esiste.
 */
const NUMBER_WORDS = {
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6,
  sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13,
  quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18,
  diciannove: 19, venti: 20,
}

/**
 * Espressioni di durata che non sono un numero.
 *
 * "sette giorni", "dieci giorni" e "quindici giorni" stavano qui: ora li legge
 * la regola dei numeri, che vale per qualunque quantità invece che per tre
 * casi elencati. Tenerli avrebbe creato una divergenza silenziosa — la voce
 * diceva che "quindici giorni" vale 14 notti (l'idioma "due settimane"),
 * mentre "sette giorni" ne valeva 7 (i giorni contati come notti). Ora la
 * regola è una sola: N giorni sono N notti, e le settimane restano un idioma.
 */
const DURATIONS = [
  [/\bweekend lung[oh]\b|\bponte\b/, 3],
  [/\bweekend\b|\bfine settimana\b/, 2],
  [/\bdue settimane\b/, 14],
  [/\buna settimana\b/, 7],
]

/**
 * Parole per asse. L'ordine conta: la prima che combacia vince, quindi le
 * espressioni composte vanno prima delle singole ("vita notturna" prima di
 * "notte").
 */
const AXIS_WORDS = [
  ['nightlife', /\bvita notturna\b|\bmovida\b|\bdiscotech\w*\b|\bnightlife\b|\blocali notturni\b|\bserate\b|\blocali la sera\b|\bconoscere (?:gente|persone)\b|\battivit[àa](?![\p{L}]) serali?\b|\bballare\b/u],
  /* "turismo di massa" mancava, ed è il modo più comune di dire "fuori rotta"
     in una frase che chiede tranquillità: senza, "evito il turismo di massa"
     non spostava nulla e Mykonos restava nona. */
  ['offbeat', /\bfuori rotta\b|\bpoco turistic\w+\b|\bnon turistic\w+\b|\bnon affollat\w+\b|\bturismo di massa\b|\bpoca gente\b|\bpoca folla\b|\bzero turisti\b|\blontano dalla folla\b|\balternativ\w+\b|\binsolit\w+\b|\bautentic\w+\b|\bfuori dai circuiti\b/],
  ['outdoor', /\btrekking\b|\bescursion\w+\b|\bcammin\w+\b|\bsentier\w+\b|\bsci\b|\bsciare\b|\bbici\b|\bciclismo\b|\bkayak\b|\bsurf\b|\bimmersion\w+\b|\bsport\w*\b|\bavventura\b|\barrampic\w+\b/],
  ['family', /\bfamigl\w+\b|\bbambin\w+\b|\bfigli\b|\bbimb\w+\b/],
  ['nature', /\bnatur\w+\b|\bpaesagg\w+\b|\bpanoram\w+\b|\bmontagn\w+\b|\bparch\w+\b|\bverde\b|\bfiord\w+\b|\blagh\w+\b|\blago\b/],
  ['culture', /\bcultur\w+\b|\bmuse\w+\b|\bstoria\b|\bstoric\w+\b|\barte\b|\bmonument\w+\b|\barcheolog\w+\b|\bchies\w+\b|\bpatrimonio\b/],
  ['food', /\bcibo\b|\bmangiare\b|\bgastronom\w+\b|\bcucina\b|\bristorant\w+\b|\bvino\b|\bvini\b|\benogastronom\w+\b|\bmercati\b/],
  ['sea', /\bmare\b|\bspiagg\w+\b|\bbalnear\w+\b|\bbalneabil\w+\b|\bcosta\b|\bbagno\b|\bmarittim\w+\b/],
  /* "costoso" NON sta qui: è l'opposto. Solo "poco costoso" conta, e ci
     arriva col "poco" davanti attaccato all'espressione. */
  ['value', /\beconomic\w+\b|\bconvenient\w+\b|\blow ?cost\b|\bspendere poco\b|\bprezzi bassi\b|\bpoco costos\w+\b|\brisparmi\w+\b|\ba buon mercato\b|\bbudget ridott\w+\b/],
]

/**
 * "Senza spendere una fortuna" vuol dire ECONOMICO, non "niente economicità".
 *
 * La regola dell'intensità guarda indietro e trova "senza", che di norma nega
 * — ed è giusto per "senza vita notturna". Qui però il "senza" nega la spesa,
 * non l'asse, e il risultato sarebbe l'esatto contrario di quel che si chiede:
 * peso zero all'economicità proprio a chi ha detto di volerla. Sono poche
 * espressioni fatte, e conviene riconoscerle intere.
 */
const RISPARMIO_NEGATO = /\bsenza spendere (?:troppo|una fortuna|un patrimonio|tanto)\b|\bsenza svenarsi\b|\bsenza spese folli\b/

const AXIS_LABELS = {
  nature: 'Natura', culture: 'Cultura', sea: 'Mare', food: 'Cibo',
  nightlife: 'Vita notturna', outdoor: 'Outdoor', family: 'Famiglia', offbeat: 'Fuori rotta',
  value: 'Economicità',
}

/** Modificatori d'intensità cercati nelle vicinanze della parola dell'asse. */
const STRONG = /\bsoprattutto\b|\bprincipalmente\b|\bmolt[oa]\b|\btant[oa]\b|\bmassim\w+\b|\bsolo\b|\bsopra ?tutto\b/
const WEAK = /\bun po'? di\b|\bun poco di\b|\banche\b|\bqualche\b|\bleggerment\w+\b|\bmagari\b/
/**
 * `\bevit\w+\b` e non `\bevitare\b`: la regola cercava solo l'infinito, e
 * "evito le discoteche" — che è il modo normale di dirlo — passava come una
 * menzione qualsiasi, cioè peso 7 alla vita notturna. Un errore silenzioso e
 * dell'esatto segno opposto. Lo stesso vale per "escludo", "odio", "detesto":
 * sono verbi coniugati, e la negazione in italiano si scrive quasi sempre così.
 */
const NEGATED = /\bsenza\b|\bniente\b|\bnessun\w*\b|\bno\b|\bevit\w+\b|\besclud\w+\b|\besclus\w+\b|\bodio\b|\bdetesto\b|\bnon sopporto\b|\bnon voglio\b|\bnon mi interessa\w*\b/
/* "mai" è stato provato e scartato: in "il mare più bello che abbia mai
   visto" nega il mare, che è l'opposto di quel che dice la frase. */

/**
 * Richieste che escono dal catalogo, riconosciute senza passare dal modello.
 *
 * Scritto nel prompt il confine c'era già, e un modello piccolo l'ha ignorato
 * lo stesso: a "una vacanza al mare fuori Europa" ha risposto Cefalonia e
 * Cilento, con punteggi alti e nessun dubbio. Un'istruzione che si può
 * disobbedire non è una garanzia, quindi questa è una regola deterministica
 * che vale per tutti e due gli interpreti: la frase la incrocia prima che
 * qualcuno decida qualcosa.
 */
export const FUORI_CATALOGO =
  /\bfuori (?:dall')?\s?europa\b|\bextra ?europee?\b|\bnon in europa\b|\bcaraibi\b|\btropic\w+\b|\basia\b|\basiatic\w+\b|\bafrica\b|\bamerica\b|\bmaldive\b|\bthailandia\b|\bzanzibar\b|\bmauritius\b|\bcapo verde\b|\begitto\b|\bmar rosso\b|\bmessico\b|\bbali\b|\bindonesia\b|\bdubai\b|\bemirati\b|\bseychelles\b|\bpolinesia\b/

export const FUORI_CATALOGO_MOTIVO =
  'il catalogo copre solo Europa e Mediterraneo: per questa richiesta non esiste una risposta giusta, e i risultati qui sotto NON la soddisfano'

/** Cose che il parser riconosce ma l'app non sa ancora fare. */
const OUT_OF_SCOPE = [
  [FUORI_CATALOGO, FUORI_CATALOGO_MOTIVO],
  [/\bore di volo\b|\bvolo dirett\w+\b|\baeroporto di partenza\b|\bscal[oi]\b/, 'il filtro sul tempo di volo è previsto in Fase 2 e non è implementato'],
  [/\bhotel\b|\bprenot\w+\b|\bdisponibilit\w+\b/, 'non è un motore di prenotazione: nessuna disponibilità, nessun acquisto'],
  [/\bprezzo del volo\b|\bcosto del volo\b|\bvoli\b/, 'il costo del volo non è modellato: il budget copre solo alloggio, cibo e trasporti locali'],
  [/\bitinerari\w*\b|\btappe\b/, 'la generazione di itinerari è Fase 3 e non è implementata'],
]

/**
 * Gli accenti NON vengono rimossi: le espressioni cercano già entrambe le
 * forme dove serve (`citt[àa]`), e togliere gli accenti spezzerebbe i nomi
 * delle destinazioni ("San Sebastián") nel confronto finale.
 */
/* I nomi del catalogo finiscono dentro un'espressione regolare: "Cinque Terre"
   va bene, ma un nome con una parentesi o un punto la romperebbe. */
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalise = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Intensità di un asse: guarda le 30 battute che precedono la parola trovata,
 * dove in italiano stanno quasi sempre i modificatori ("soprattutto natura",
 * "un po' di cultura", "senza vita notturna").
 */
function intensity(text, index) {
  const before = text.slice(Math.max(0, index - 40), index)

  // Vince il modificatore PIÙ VICINO, non il primo che si trova. In
  // "soprattutto cibo e un po' di vita notturna" entrambi cadono nella
  // finestra, ma "un po' di" è quello che riguarda la vita notturna.
  const kinds = [
    { re: NEGATED, weight: 0, hint: 'escluso' },
    { re: STRONG, weight: 9, hint: 'molto' },
    { re: WEAK, weight: 3, hint: 'un po’' },
  ]

  let nearest = null
  for (const kind of kinds) {
    const last = [...before.matchAll(new RegExp(kind.re.source, 'g'))].pop()
    if (last && (nearest === null || last.index > nearest.at)) {
      nearest = { at: last.index, weight: kind.weight, hint: kind.hint }
    }
  }

  return nearest
    ? { weight: nearest.weight, hint: nearest.hint }
    : { weight: 7, hint: 'richiesto' }
}

export function parseQuery(input, { destinations = [] } = {}) {
  /**
   * La frase viene portata in italiano prima di essere letta, se non lo è già.
   * Le regole restano una sola grammatica; le altre lingue costano un
   * dizionario di parole-chiave. Vedi `lexicon.js`.
   */
  const { text: tradotto, lang, origini } = toItalian(normalise(input || ''))
  const text = tradotto
  const understood = []
  const ignored = []
  const patch = {}

  if (!text) return { patch, understood, ignored, empty: true }

  // ---- periodo -------------------------------------------------------
  if (/\btutto l'anno\b|\bsempre\b|\bqualsiasi mese\b|\bquando capita\b/.test(text)) {
    patch.month = null
    understood.push({ key: 'month', label: 'Periodo', value: 'tutto l’anno', from: 'tutto l’anno' })
  } else {
    const month = MONTHS.find(([name]) => new RegExp(`\\b${name}\\b`).test(text))
    const season = month ? null : SEASONS.find(([name]) => new RegExp(`\\b${name}\\b`).test(text))
    if (month) {
      patch.month = month[1]
      understood.push({ key: 'month', label: 'Mese', value: month[0], from: month[0] })
    } else if (season) {
      patch.month = season[1]
      understood.push({
        key: 'month', label: 'Mese', value: MONTHS[season[1] - 1][0],
        from: season[0], note: `"${season[0]}" non è un mese: uso ${MONTHS[season[1] - 1][0]} come rappresentativo`,
      })
    }
  }

  // ---- durata --------------------------------------------------------
  // Cifre o lettere: "5 notti" e "cinque notti" sono la stessa cosa detta in
  // due modi, e il secondo è quello che viene più naturale scrivendo.
  const explicitNights = text.match(
    new RegExp(`(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s*(nott[ei]|giorn[oi])`)
  )
  const phrase = DURATIONS.find(([re]) => re.test(text))
  if (explicitNights) {
    const scritto = explicitNights[1]
    const value = Math.max(1, /^\d+$/.test(scritto) ? Number(scritto) : NUMBER_WORDS[scritto])
    const isDays = /giorn/.test(explicitNights[2])
    patch.nights = value
    understood.push({
      key: 'nights', label: 'Notti', value: String(value), from: explicitNights[0],
      note: isDays ? `“${explicitNights[0]}” inteso come ${value} notti` : undefined,
    })
  } else if (phrase) {
    const [re, nights] = phrase
    patch.nights = nights
    understood.push({
      key: 'nights', label: 'Notti', value: String(nights),
      from: re.exec(text)?.[0] || '',
    })
  }

  // ---- budget --------------------------------------------------------
  const budget = text.match(/(\d[\d.]*)\s*(?:€|eur\b|euro\b)|(?:budget|max|massimo|entro|sotto i?)\s*(\d[\d.]*)/)
  if (budget) {
    const raw = (budget[1] || budget[2] || '').replace(/\./g, '')
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) {
      patch.budgetMax = value
      understood.push({ key: 'budget', label: 'Budget', value: `${value} €`, from: budget[0].trim() })
    }
  }

  // ---- tipo ----------------------------------------------------------
  if (/\bisol[ae]\b/.test(text)) {
    patch.allowedTypes = ['island']
    understood.push({ key: 'types', label: 'Solo', value: 'isole', from: 'isola' })
  /* Due difetti nella stessa riga, e il secondo è emerso correggendo il primo.
   *
   * Uno: `\bcitt[àa]\b` non scattava MAI su "città europea", perché `\b` in
   * JavaScript è ASCII e dopo la "à" non c'è confine di parola — identico a
   * "località di mare". Serve il confine Unicode.
   *
   * Due: corretto quello, la parola scattava troppo. "Storia, musei, città
   * antiche" chiede cose da vedere, non un tipo di destinazione, e riduceva la
   * ricerca alle sole città buttando fuori Sicilia, Creta e Rodi — che sono
   * esattamente le risposte giuste. Ci vuole l'articolo: "una città" dichiara
   * che la destinazione dev'essere quella, "città antiche" descrive cosa ci si
   * aspetta di trovarci. */
  } else if (/\b(?:una|in una|nella|la|di una|qualche)\s+citt[àa](?![\p{L}])/u.test(text)) {
    patch.allowedTypes = ['city']
    understood.push({ key: 'types', label: 'Solo', value: 'città', from: 'città' })
  }

  // ---- assi ----------------------------------------------------------
  const weights = {}
  for (const [axis, re] of AXIS_WORDS) {
    const match = re.exec(text)
    if (!match) continue
    const { weight, hint } = intensity(text, match.index)
    weights[axis] = weight
    understood.push({
      key: `axis:${axis}`, label: AXIS_LABELS[axis],
      value: weight === 0 ? 'escluso' : `peso ${weight}`,
      from: match[0], hint,
    })
  }

  /* Il requisito principale, quando la frase lo dichiara da sola.
   *
   * Le regole non "capiscono" una gerarchia, ma una gerarchia scritta la
   * riconoscono: "soprattutto il mare" mette il mare sopra gli altri, e la
   * scala dei pesi lo registrava già portandolo a 9. Se un asse solo arriva a
   * 9 mentre gli altri stanno più in basso, quello è il padrone della frase.
   * Se ce ne sono due, non c'è gerarchia: sono due cose importanti uguali, e
   * inventarne una sarebbe peggio che non averla. */
  const forti = Object.keys(weights).filter((k) => weights[k] >= 9)
  const secondari = Object.keys(weights).filter((k) => weights[k] > 0 && weights[k] < 9)
  if (forti.length === 1 && secondari.length > 0) {
    patch.primary = forti[0]
    understood.push({
      key: 'primary', label: 'Requisito principale', value: AXIS_LABELS[forti[0]],
      // Le parole vere della frase, prese dalla voce che ha alzato quel peso:
      // "requisito principale: mare <- soprattutto il mare" si verifica, la
      // chiave dell'asse no.
      from: understood.find((u) => u.key === `axis:${forti[0]}`)?.from || forti[0],
      hint: 'chi non lo soddisfa esce, non viene solo penalizzato',
    })
  }

  const risparmio = RISPARMIO_NEGATO.exec(text)
  if (risparmio) {
    weights.value = 8
    const gia = understood.findIndex((u) => u.key === 'axis:value')
    const voce = { key: 'axis:value', label: 'Economicità', value: 'peso 8', from: risparmio[0], hint: 'il «senza» qui nega la spesa, non l’asse' }
    if (gia >= 0) understood[gia] = voce
    else understood.push(voce)
  }

  if (Object.keys(weights).length) patch.weights = weights

  /* ---- il mare come requisito, non come interesse ---------------------
   *
   * Due famiglie di formule, ed è la seconda quella che mancava.
   *
   * La prima è il desiderio esplicito: "voglio il mare", "balneabile", "fare
   * il bagno". La seconda è il TIPO di posto — "una località di mare", "una
   * meta balneare", "un posto al mare": lì il mare non è un gusto fra gli
   * altri, è la categoria della destinazione, e trattarlo come un semplice
   * peso faceva comparire città che il mare ce l'hanno vicino senza esserne
   * fatte. Lisbona ha l'oceano a mezz'ora e non è una località di mare. */
  const MARE_REQUISITO =
    /\b(voglio|cerco|serve|deve esserci|solo)\b[^.]{0,20}\bmare\b|\bbalneabil\w+\b|\bfare il bagno\b|\bmare calda?\b|\bacqua calda\b/
  /* Nessun `\b` dopo il gruppo: in JavaScript è ASCII, e dopo la "à" di
     "località" — che word char non è — seguita da uno spazio non c'è alcun
     confine. La regola sembrava giusta e non scattava mai proprio sulla frase
     più comune. */
  const MARE_CATEGORIA =
    /\b(localit[àa]|meta|mete|destinazion\w+|posto|posti|luogo|luoghi|vacanza|vacanze)[^.]{0,15}(di |sul |al )?\bmare\b|\bmeta balneare\b|\bvacanza balneare\b|\bal mare\b/

  if (MARE_REQUISITO.test(text) || MARE_CATEGORIA.test(text)) {
    patch.seaRequired = true
    understood.push({
      key: 'seaRequired', label: 'Requisito', value: 'mare balneabile',
      from: (MARE_CATEGORIA.exec(text) || MARE_REQUISITO.exec(text) || [])[0]?.trim() || 'mare',
    })
  }

  /* ---- nomi di destinazione o paese, in positivo E in negativo ---------
   *
   * "Voglio il mare ma non in Sardegna" nominava la Sardegna, e nominare un
   * luogo voleva dire cercarlo: il risultato era la Sardegna in cima, cioè
   * l'esatto contrario. Un nome preceduto da una negazione non è una ricerca,
   * è un veto, e va trattato come tale — fuori dalla classifica, non in fondo.
   *
   * Gli elenchi si propagano. In "non in Sardegna, Sicilia o Puglia" la
   * negazione è scritta una volta sola e vale per tutti e tre: fra un nome e
   * il successivo ci devono stare solo separatori e preposizioni, altrimenti
   * il "non" ha smesso di riguardarli. */
  const names = destinations.flatMap((d) => [d.name, d.countryName].filter(Boolean))
  const trovati = []
  for (const name of new Set(names)) {
    if (!name) continue
    const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(normalise(name))})(?![\\p{L}])`, 'u')
    const m = re.exec(text)
    if (m) trovati.push({ name, at: m.index + m[1].length, end: m.index + m[1].length + m[2].length })
  }
  trovati.sort((a, b) => a.at - b.at)

  /** Solo separatori di elenco fra un nome escluso e il successivo. */
  const CATENA = /^[\s,;]*(?:o|e|oppure|né|ne)?[\s,;]*(?:in|a|ad|nel|nella|nelle|nei|sul|sulla)?\s*$/

  /* La negazione dei luoghi include il "non" nudo, che per gli assi invece non
     vale: "non voglio caos" nega, "un posto non turistico" no. */
  const VETO = /\bnon\b|\bsenza\b|\bniente\b|\bnessun\w*\b|\btranne\b|\beccetto\b|\bfuorché\b|\besclu\w+\b|\bevit\w+\b|\bmeno\b/g

  /* Fra la negazione e il nome ci possono stare solo parole di servizio.
     Senza questo controllo "un posto non turistico in Grecia" vieterebbe la
     Grecia: il "non" c'è, ma riguarda "turistico". */
  const PONTE = /^(?:\s*(?:in|a|ad|nel|nella|nelle|nei|negli|sul|sulla|sulle|il|lo|la|le|i|gli|l'|di|del|della|dei|delle|che|per|verso|zona))*\s*$/

  const esclusi = []
  let precedenteEscluso = null
  for (const t of trovati) {
    const inizio = Math.max(0, t.at - 30)
    const finestra = text.slice(inizio, t.at)
    const ultimaNeg = [...finestra.matchAll(VETO)].pop()
    const negato =
      (ultimaNeg != null && PONTE.test(finestra.slice(ultimaNeg.index + ultimaNeg[0].length))) ||
      (precedenteEscluso !== null && CATENA.test(text.slice(precedenteEscluso, t.at)))
    if (negato) {
      esclusi.push(t.name)
      precedenteEscluso = t.end
    } else {
      precedenteEscluso = null
    }
  }

  if (esclusi.length) {
    patch.excluded = esclusi
    understood.push({
      key: 'excluded', label: 'Escluse', value: esclusi.join(', '),
      from: esclusi[0].toLowerCase(), hint: 'tolte dai risultati, non solo penalizzate',
    })
  }

  /**
   * Un luogo messo a confronto non è un luogo cercato.
   *
   * "Sono indeciso tra Sardegna e Grecia" nominava la Sardegna, e nominare
   * voleva dire filtrare: il catalogo scendeva a UNA destinazione, cioè
   * proprio quella su cui la persona stava chiedendo un parere. Chi è indeciso
   * fra due cose vuole vederne altre che gli somiglino, non una sola delle due
   * imposta come unica risposta possibile.
   *
   * Il confronto lo dichiarano le parole della frase, non un'inferenza:
   * "indeciso tra", "meglio X o Y", "preferisco X o Y". In quel caso i pesi
   * restano — sono il vero contenuto della frase — e cade solo il filtro.
   */
  const CONFRONTO = /\bindecis\w+\b|\bmeglio\b[^.]{0,40}\bo\b|\bpreferisc\w+\b[^.]{0,30}\bo\b|\bo\b\s*(?:invece|piuttosto)\b|\bal posto di\b|\bcosa scelgo\b/
  const confronto = CONFRONTO.exec(text)

  const hit = confronto ? null : trovati.find((t) => !esclusi.includes(t.name))
  if (confronto && trovati.length > 1) {
    ignored.push({
      from: confronto[0],
      reason: `stai confrontando ${trovati.slice(0, 3).map((t) => t.name).join(' e ')}: non le ho usate come filtro, altrimenti resterebbe solo una risposta possibile`,
    })
  }
  if (hit) {
    patch.query = hit.name
    understood.push({ key: 'query', label: 'Ricerca', value: hit.name, from: hit.name.toLowerCase() })
  }

  // ---- fuori portata ---------------------------------------------------
  for (const [re, reason] of OUT_OF_SCOPE) {
    const match = re.exec(text)
    if (match) ignored.push({ from: match[0], reason })
  }

  /**
   * I chip tornano a parlare la lingua di chi ha scritto.
   *
   * Le regole hanno lavorato sulla frase tradotta, quindi ogni `from` è una
   * parola italiana. Mostrarla a chi ha scritto "hiking" romperebbe la sola
   * promessa che questa schermata fa — *ecco la parola da cui l'ho dedotto* —
   * proprio nel punto in cui chiede di essere creduta.
   */
  const inLinguaOriginale = (voce) => ({ ...voce, from: restoreOriginal(voce.from, origini) })

  return {
    patch,
    understood: understood.map(inLinguaOriginale),
    ignored: ignored.map(inLinguaOriginale),
    lang,
    empty: understood.length === 0,
  }
}
