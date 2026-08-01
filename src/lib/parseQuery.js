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
  ['nightlife', /\bvita notturna\b|\bmovida\b|\bdiscotech\w*\b|\bnightlife\b|\blocali notturni\b|\bserate\b/],
  ['offbeat', /\bfuori rotta\b|\bpoco turistic\w+\b|\bnon turistic\w+\b|\bnon affollat\w+\b|\blontano dalla folla\b|\balternativ\w+\b|\binsolit\w+\b|\bautentic\w+\b|\bfuori dai circuiti\b/],
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
const NEGATED = /\bsenza\b|\bniente\b|\bnessun\w*\b|\bno\b|\bevitare\b|\bnon voglio\b/

/** Cose che il parser riconosce ma l'app non sa ancora fare. */
const OUT_OF_SCOPE = [
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
  } else if (/\bcitt[àa]\b/.test(text)) {
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

  // ---- nomi di destinazione o paese -----------------------------------
  const names = destinations.flatMap((d) => [d.name, d.countryName].filter(Boolean))
  const hit = names.find((name) => name && new RegExp(`\\b${normalise(name)}\\b`).test(text))
  if (hit) {
    patch.query = hit
    understood.push({ key: 'query', label: 'Ricerca', value: hit, from: hit.toLowerCase() })
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
