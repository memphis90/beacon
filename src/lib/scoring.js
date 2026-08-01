/**
 * Filtri duri e calcolo del punteggio.
 *
 * Questo modulo è PURO: non importa React, non tocca il DOM, non legge
 * localStorage. È il pezzo che il §9 del planning chiede di correggere quando
 * il ranking contraddice il giudizio dell'utente, quindi deve restare
 * leggibile e testabile da solo.
 */
import { AXES, AXIS_KEYS } from './axes.js'
import { THEME_BONUS, THEME_BONUS_MAX } from './themes.js'
import { countryName } from './format.js'

export const FILTER = {
  QUERY: 'query',
  TYPE: 'type',
  SEA: 'sea',
  BUDGET: 'budget',
  UNSCORED: 'unscored',
}

export const FILTER_LABEL = {
  [FILTER.QUERY]: 'ricerca testuale',
  [FILTER.TYPE]: 'tipo di destinazione',
  [FILTER.SEA]: 'temperatura del mare',
  [FILTER.BUDGET]: 'budget massimo',
  [FILTER.UNSCORED]: 'non ancora valutate',
}

/**
 * Una destinazione entrata dagli script ma non ancora giudicata.
 *
 * La Fase 1 porta l'anagrafica — dov'è, che cos'è, come si chiama — e si ferma
 * lì: punteggi, costi e clima sono giudizi o misure, e riempirli d'ufficio
 * sarebbe inventare i dati su cui si regge tutto il resto. `todo` è la marca
 * che lo dichiara.
 *
 * Il ranking le tiene fuori. Non per severità: una destinazione senza punteggi
 * avrebbe zero su ogni asse e finirebbe ultima, dove si legge come "questa
 * vale poco" invece che "questa non l'ho ancora guardata". Escluderla con un
 * motivo dichiarato è l'unica lettura onesta.
 */
export const isUnscored = (destination) =>
  destination?.scores_source === 'todo' || !destination?.scores

/**
 * Punteggi scritti dall'assistente, non da chi usa lo strumento.
 *
 * Entrano nel ranking come tutti gli altri — un'opinione informata è meglio di
 * una destinazione invisibile — ma la provenienza resta scritta, perché la
 * domanda del §9 è se il ranking regge il confronto con il giudizio di CHI
 * CERCA, e su queste il confronto non è ancora stato fatto. Ogni correzione
 * dal pannello Parametri le porta a `manual`, cioè le fa diventare tue.
 */
export const isAssistantScored = (destination) =>
  destination?.scores_source === 'assistant'

/** Costo stimato per persona, per notte. Restituisce sempre una fascia. */
export function nightlyCost(destination) {
  const c = destination.costs
  // Le destinazioni non ancora valutate non hanno costi: senza questa guardia
  // il calcolo esplode invece di dire che il dato non c'è.
  if (!c?.accommodation || !c?.food_per_day || !c?.transport_local_day) {
    return { low: 0, mid: 0, high: 0 }
  }
  const sum = (field) =>
    c.accommodation[field] + c.food_per_day[field] + c.transport_local_day[field]
  return { low: sum('low'), mid: sum('mid'), high: sum('high') }
}

/**
 * Costo stimato del soggiorno, per persona.
 *
 * NON include il volo: non è nello schema fino alla Fase 2. Chi consuma
 * questo valore deve dirlo all'utente.
 */
export function tripCost(destination, nights) {
  const n = Math.max(0, nights)
  const per = nightlyCost(destination)
  return { low: per.low * n, mid: per.mid * n, high: per.high * n }
}

export function seaTemperature(destination, month) {
  const entry = destination.climate?.[String(month)]
  return entry && entry.sea_temp != null ? entry.sea_temp : null
}

/** Mese più caldo per il mare, o null se la destinazione non ha mare. */
export function warmestSeaMonth(destination) {
  let best = null
  for (let month = 1; month <= 12; month += 1) {
    const temp = seaTemperature(destination, month)
    if (temp != null && (best === null || temp > best.temp)) best = { month, temp }
  }
  return best
}

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

const mean = (values) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null

/**
 * Clima da mostrare per il periodo scelto.
 *
 * Con un mese preciso sono i valori di quel mese. Con "tutto l'anno" (`month`
 * nullo) non esiste una temperatura sola: si mostra la media dell'aria e il
 * MASSIMO del mare, perché la domanda sottintesa non è "quanto è caldo il mare
 * in media" ma "arriva mai a essere caldo". `scope` dice quale dei due casi è,
 * così la UI può etichettarli diversamente invece di far passare una media per
 * una misura puntuale.
 */
export function climateSummary(destination, month) {
  if (month) {
    return { ...(destination.climate?.[String(month)] || {}), scope: 'month' }
  }

  const months = Object.values(destination.climate || {})
  const values = (key) => months.map((m) => m?.[key]).filter((v) => v != null)
  const seas = values('sea_temp')

  return {
    temp_avg: mean(values('temp_avg')),
    temp_max: mean(values('temp_max')),
    sea_temp: seas.length ? Math.max(...seas) : null,
    rain_days: mean(values('rain_days')),
    scope: 'year',
  }
}

export function sumWeights(weights) {
  return AXIS_KEYS.reduce((acc, key) => acc + (Number(weights?.[key]) || 0), 0)
}

/**
 * Filtri duri. Escludono, non penalizzano.
 *
 * Applicati PRIMA dello scoring e in quest'ordine, così che una destinazione
 * esclusa venga attribuita al primo filtro che la respinge. L'attribuzione
 * serve alla UI per spiegare l'esclusione all'utente.
 */
export function applyHardFilters(destinations, criteria) {
  const {
    query = '',
    month = 1,
    nights = 1,
    weights = {},
    budgetMax = null,
    seaTempMin = 21,
    seaRequired = false,
    allowedTypes = null,
  } = criteria || {}

  const normalisedQuery = query.trim().toLowerCase()
  /**
   * Il filtro mare è governato da una scelta ESPLICITA, non dal peso.
   *
   * Prima si attivava con `weights.sea > 0`, cioè un interesse qualsiasi per il
   * mare bastava a escludere ogni destinazione senza costa. Ma un peso di 5 su
   * 10 vuol dire "mi piace anche il mare", non "esigo il mare": con tutti i
   * pesi al valore predefinito il filtro partiva da solo e tagliava metà del
   * catalogo, Praga e Vienna comprese.
   *
   * Interesse e requisito sono cose diverse e ora sono due controlli diversi.
   */
  const seaRequested = Boolean(seaRequired)

  const kept = []
  const excluded = []

  for (const destination of destinations) {
    // Prima di ogni altro filtro: non ha senso dire che è stata esclusa dal
    // budget una destinazione di cui non conosciamo ancora il costo.
    if (isUnscored(destination)) {
      excluded.push({
        destination,
        filter: FILTER.UNSCORED,
        detail: 'anagrafica importata, punteggi non ancora assegnati',
      })
      continue
    }

    if (normalisedQuery) {
      // Il nome del paese per esteso, non solo il codice ISO: cercando
      // "croazia" ci si aspetta Dubrovnik, non zero risultati perché nel
      // dato c'è scritto "HR".
      const haystack = [
        destination.name,
        destination.country,
        countryName(destination.country),
      ].join(' ').toLowerCase()
      if (!haystack.includes(normalisedQuery)) {
        excluded.push({ destination, filter: FILTER.QUERY, detail: `non corrisponde a "${query.trim()}"` })
        continue
      }
    }

    if (allowedTypes && !allowedTypes.includes(destination.type)) {
      excluded.push({ destination, filter: FILTER.TYPE, detail: `è di tipo "${destination.type}"` })
      continue
    }

    if (seaRequested) {
      // Senza un mese preciso la domanda cambia: non "il mare è caldo adesso"
      // ma "arriva mai a essere caldo". Basta un mese sopra soglia.
      if (!month) {
        const best = warmestSeaMonth(destination)
        if (!best) {
          excluded.push({ destination, filter: FILTER.SEA, detail: 'non ha accesso al mare' })
          continue
        }
        if (best.temp < seaTempMin) {
          excluded.push({
            destination,
            filter: FILTER.SEA,
            detail: `mai sopra i ${seaTempMin} °C — al massimo ${best.temp} °C ad ${MONTH_NAMES[best.month - 1]}`,
          })
          continue
        }
      } else {
        const temp = seaTemperature(destination, month)
        if (temp == null) {
          excluded.push({ destination, filter: FILTER.SEA, detail: 'non ha accesso al mare' })
          continue
        }
        if (temp < seaTempMin) {
          excluded.push({ destination, filter: FILTER.SEA, detail: `mare a ${temp} °C, sotto la soglia di ${seaTempMin} °C` })
          continue
        }
      }
    }

    if (budgetMax != null) {
      const cost = tripCost(destination, nights)
      if (cost.mid > budgetMax) {
        excluded.push({ destination, filter: FILTER.BUDGET, detail: `stima ${Math.round(cost.mid)} €, oltre i ${budgetMax} €` })
        continue
      }
    }

    kept.push(destination)
  }

  return { kept, excluded }
}

/**
 * Media pesata degli assi.
 *
 * Restituisce sempre la scomposizione per asse: il totale da solo non è
 * debuggabile, ed è il totale da solo che rende un motore di ranking una
 * scatola nera.
 */
export function scoreDestination(destination, weights, themes = []) {
  const weightSum = sumWeights(weights)

  const contributions = AXES.map((axis) => {
    const weight = Number(weights?.[axis.key]) || 0
    const score = Number(destination.scores?.[axis.key]) || 0
    return {
      key: axis.key,
      label: axis.label,
      color: axis.color,
      weight,
      score,
      contribution: weightSum === 0 ? 0 : (weight * score) / weightSum,
    }
  })

  const base = weightSum === 0 ? null : contributions.reduce((acc, c) => acc + c.contribution, 0)

  /**
   * Il bonus tematico è tenuto SEPARATO dalla media pesata, e i due numeri
   * restano entrambi visibili nel dettaglio.
   *
   * Sommarlo dentro i contributi lo avrebbe reso invisibile: il totale sarebbe
   * salito senza che nessun asse lo spiegasse, che è esattamente la scatola
   * nera che il §5 rifiuta. Così invece la riga si legge come un'aggiunta —
   * "83.2 di media pesata, più 8 perché è gotica" — e si può contestare l'una
   * o l'altra parte.
   *
   * Senza pesi non c'è punteggio, e il bonus non lo inventa: sommare 8 a "non
   * c'è ranking" darebbe un ordine fondato solo sulle etichette.
   */
  const matched = Array.isArray(themes)
    ? themes.filter((t) => (destination.themes || []).includes(t))
    : []
  const themeBonus = base === null ? 0 : Math.min(matched.length * THEME_BONUS, THEME_BONUS_MAX)

  return {
    /**
     * Nessun tetto a 100, ed è una scelta pagata: "105" su una scala che
     * altrove è 0-100 si legge male.
     *
     * L'alternativa la si è provata e costava di più. Con il tetto, Parigi
     * (97 di cultura) e Praga (92) finivano entrambe a 100 su una ricerca a
     * tema gotico: cinque punti di differenza reale cancellati proprio fra le
     * due destinazioni che quella ricerca deve confrontare. Un punteggio che
     * perde l'ordine è peggio di un punteggio che sfora la scala, perché
     * l'ordine è tutto ciò per cui serve.
     */
    total: base === null ? null : base + themeBonus,
    base,
    themeBonus,
    matchedThemes: matched,
    weightSum,
    contributions,
  }
}

const SORTERS = {
  score: (a, b) => (b.scoring.total ?? -1) - (a.scoring.total ?? -1),
  cost_asc: (a, b) => a.cost.mid - b.cost.mid,
  cost_desc: (a, b) => b.cost.mid - a.cost.mid,
  name: (a, b) => a.destination.name.localeCompare(b.destination.name, 'it'),
}

/**
 * Pipeline completa: filtri duri, poi scoring, poi ordinamento.
 *
 * `weightSum === 0` non è un errore ma non produce un ranking: la UI deve
 * dirlo invece di mostrare un ordine arbitrario spacciandolo per un risultato.
 */
export function rankDestinations(destinations, criteria = {}) {
  const { kept, excluded } = applyHardFilters(destinations, criteria)
  const { weights = {}, nights = 1, sortBy = 'score', themes = [] } = criteria

  const results = kept.map((destination) => ({
    destination,
    scoring: scoreDestination(destination, weights, themes),
    cost: tripCost(destination, nights),
  }))

  const weightSum = sumWeights(weights)
  // Senza pesi non esiste un ordine per punteggio. Ripiegare sull'ordine del
  // file spaccerebbe l'arbitrio per un risultato: si ordina per nome, che è
  // visibilmente non un giudizio.
  const effectiveSort = sortBy === 'score' && weightSum === 0 ? 'name' : sortBy
  results.sort(SORTERS[effectiveSort] || SORTERS.score)

  return {
    results,
    excluded,
    weightSum,
    hasRanking: weightSum > 0,
  }
}

/** Conteggio delle esclusioni per filtro, per la riga di spiegazione in UI. */
export function summariseExclusions(excluded) {
  const counts = new Map()
  for (const item of excluded) {
    counts.set(item.filter, (counts.get(item.filter) || 0) + 1)
  }
  return [...counts.entries()].map(([filter, count]) => ({
    filter,
    count,
    label: FILTER_LABEL[filter] || filter,
  }))
}

/**
 * Raccomandazione derivata dai dati, non generata.
 *
 * Il mockup proponeva una prosa in stile assistente con una "percentuale di
 * allineamento" inventata. Qui non c'è nessun motore di raccomandazione e non
 * si finge che ci sia: si dicono due fatti calcolati, con i numeri in chiaro,
 * che l'utente può verificare guardando la tabella.
 *
 * Il "rapporto" è punti di punteggio ogni 100 € di costo stimato: risponde a
 * "quanto rende ogni euro", che è una domanda diversa da "qual è il migliore"
 * e spesso dà una risposta diversa. È lì che sta il valore.
 */
export function recommend(results) {
  const valid = (results || []).filter((r) => r?.scoring?.total != null && r.cost?.mid >= 0)
  if (valid.length < 2) return null

  const best = valid.reduce((a, b) => (b.scoring.total > a.scoring.total ? b : a))

  const withRatio = valid.map((r) => ({
    entry: r,
    // Costo zero non è un affare infinito: è un dato mancante, e va escluso.
    ratio: r.cost.mid > 0 ? (r.scoring.total / r.cost.mid) * 100 : null,
  })).filter((x) => x.ratio != null)

  if (!withRatio.length) return { best, value: null }

  const value = withRatio.reduce((a, b) => (b.ratio > a.ratio ? b : a))

  return {
    best,
    value: value.entry,
    ratio: value.ratio,
    coincidono: value.entry.destination.id === best.destination.id,
  }
}
