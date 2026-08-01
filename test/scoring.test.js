import { describe, it, expect } from 'vitest'
import {
  FILTER,
  applyHardFilters,
  climateSummary,
  isUnscored,
  nightlyCost,
  rankDestinations,
  recommend,
  scoreDestination,
  summariseExclusions,
  tripCost,
} from '../src/lib/scoring.js'
import { emptyWeights } from '../src/lib/axes.js'

function makeDestination(overrides = {}) {
  return {
    id: 'test',
    name: 'Test',
    country: 'IT',
    type: 'city',
    scores: {
      nature: 50, culture: 50, sea: 50, food: 50,
      nightlife: 50, outdoor: 50, family: 50, offbeat: 50,
    },
    climate: { 7: { temp_avg: 25, sea_temp: 25, rain_days: 2 } },
    costs: {
      accommodation: { low: 40, mid: 60, high: 100 },
      food_per_day: { low: 20, mid: 30, high: 50 },
      transport_local_day: { low: 5, mid: 10, high: 20 },
      currency: 'EUR',
    },
    ...overrides,
  }
}

/**
 * Il bonus tematico è l'unico pezzo di punteggio che non viene dagli assi.
 * Queste prove tengono ferme le due cose che lo rendono accettabile: che resti
 * separato e leggibile nella scomposizione, e che non possa ribaltare il
 * ranking da solo.
 */
describe('temi — un bonus visibile, non un nono asse', () => {
  const pesi = { ...emptyWeights(0), culture: 10 }
  const gotica = makeDestination({ id: 'g', themes: ['gotico', 'medievale'] })
  const altra = makeDestination({ id: 'a', themes: ['balneare'] })

  it('somma il bonus solo a chi porta il tema, tenendolo separato dalla base', () => {
    const con = scoreDestination(gotica, pesi, ['gotico'])
    const senza = scoreDestination(altra, pesi, ['gotico'])
    expect(con.base).toBe(50)
    expect(con.themeBonus).toBe(8)
    expect(con.total).toBe(58)
    expect(con.matchedThemes).toEqual(['gotico'])
    expect(senza.themeBonus).toBe(0)
    expect(senza.total).toBe(50)
  })

  it('due temi che corrispondono valgono di più, ma con un tetto', () => {
    const due = scoreDestination(gotica, pesi, ['gotico', 'medievale'])
    expect(due.themeBonus).toBe(16)
  })

  it('non schiaccia l’ordine fra due destinazioni già alte', () => {
    // Il caso che ha fatto togliere il tetto a 100: con un tetto, 97 e 92
    // finivano appaiate proprio nel confronto che la ricerca deve dirimere.
    const alta = makeDestination({ id: 'alta', themes: ['gotico'], scores: { ...makeDestination().scores, culture: 97 } })
    const meno = makeDestination({ id: 'meno', themes: ['gotico'], scores: { ...makeDestination().scores, culture: 92 } })
    const r = rankDestinations([meno, alta], { weights: pesi, themes: ['gotico'] })
    expect(r.results[0].destination.id).toBe('alta')
    expect(r.results[0].scoring.total).toBeGreaterThan(r.results[1].scoring.total)
  })

  it('senza pesi non inventa un punteggio: il tema non crea un ranking', () => {
    const s = scoreDestination(gotica, emptyWeights(0), ['gotico'])
    expect(s.total).toBeNull()
    expect(s.themeBonus).toBe(0)
  })

  it('una destinazione senza etichette non è penalizzata, solo non premiata', () => {
    const nuda = makeDestination({ id: 'n' })
    expect(scoreDestination(nuda, pesi, ['gotico']).total).toBe(50)
  })

  it('il tema NON esclude: chi non ce l’ha resta nei risultati', () => {
    const r = rankDestinations([gotica, altra], { weights: pesi, themes: ['gotico'] })
    expect(r.results).toHaveLength(2)
    expect(r.results[0].destination.id).toBe('g')
    expect(r.excluded).toHaveLength(0)
  })

  it('non ribalta una differenza vera sugli assi', () => {
    // 20 punti di distacco sugli assi non si annullano con un'etichetta.
    const forte = makeDestination({ id: 'f', scores: { ...makeDestination().scores, culture: 80 } })
    const debole = makeDestination({ id: 'd', themes: ['gotico'], scores: { ...makeDestination().scores, culture: 55 } })
    const r = rankDestinations([forte, debole], { weights: pesi, themes: ['gotico'] })
    expect(r.results[0].destination.id).toBe('f')
  })

  it('un tema che nessuno porta non cambia niente', () => {
    const r = rankDestinations([gotica, altra], { weights: pesi, themes: ['artico'] })
    expect(r.results.every((x) => x.scoring.themeBonus === 0)).toBe(true)
  })
})

/**
 * La Fase 1 porta l'anagrafica e si ferma lì: punteggi, costi e clima restano
 * da assegnare. Il ranking deve tenerle fuori DICENDOLO — se finissero in
 * fondo con zero punti si leggerebbero come "queste valgono poco" invece che
 * "queste non le ho ancora guardate".
 */
describe('destinazioni non ancora valutate', () => {
  const daValutare = {
    id: 'nuova', name: 'Nuova', country: 'IT', type: 'city',
    coords: { lat: 45, lon: 9 }, scores_source: 'todo', climate_source: 'todo',
  }

  it('le riconosce dalla marca o dall’assenza dei punteggi', () => {
    expect(isUnscored(daValutare)).toBe(true)
    expect(isUnscored({ ...daValutare, scores_source: undefined })).toBe(true)
    expect(isUnscored(makeDestination())).toBe(false)
  })

  it('restano fuori dal ranking, con il motivo dichiarato', () => {
    const r = rankDestinations([makeDestination(), daValutare], { weights: emptyWeights(5) })
    expect(r.results).toHaveLength(1)
    expect(r.excluded[0].filter).toBe(FILTER.UNSCORED)
    expect(summariseExclusions(r.excluded)[0].label).toBe('non ancora valutate')
  })

  it('il calcolo dei costi non esplode quando i costi non ci sono', () => {
    expect(() => tripCost(daValutare, 5)).not.toThrow()
    expect(nightlyCost(daValutare)).toEqual({ low: 0, mid: 0, high: 0 })
  })
})

describe('costi', () => {
  it('somma le tre voci in una fascia, senza collassarla in un punto', () => {
    expect(nightlyCost(makeDestination())).toEqual({ low: 65, mid: 100, high: 170 })
  })

  it('moltiplica per le notti', () => {
    expect(tripCost(makeDestination(), 5)).toEqual({ low: 325, mid: 500, high: 850 })
  })

  it('tratta zero notti come costo nullo invece che come errore', () => {
    expect(tripCost(makeDestination(), 0).mid).toBe(0)
  })
})

describe('scoreDestination', () => {
  it('calcola la media pesata', () => {
    const dest = makeDestination({ scores: { ...makeDestination().scores, culture: 100, nature: 0 } })
    const weights = { ...emptyWeights(), culture: 1, nature: 1 }
    expect(scoreDestination(dest, weights).total).toBe(50)
  })

  it('la somma dei contributi per asse è uguale al totale', () => {
    const weights = { ...emptyWeights(), nature: 3, culture: 7, food: 2 }
    const { total, contributions } = scoreDestination(makeDestination(), weights)
    const sum = contributions.reduce((acc, c) => acc + c.contribution, 0)
    expect(sum).toBeCloseTo(total, 10)
  })

  it('con tutti i pesi a zero il totale è null, non zero', () => {
    // Zero significherebbe "punteggio pessimo". null significa "non c'è
    // ranking": la UI deve poterli distinguere.
    const { total, weightSum } = scoreDestination(makeDestination(), emptyWeights())
    expect(total).toBeNull()
    expect(weightSum).toBe(0)
  })

  it('un asse con peso zero non contribuisce', () => {
    const weights = { ...emptyWeights(), culture: 5 }
    const { contributions } = scoreDestination(makeDestination(), weights)
    const nature = contributions.find((c) => c.key === 'nature')
    expect(nature.contribution).toBe(0)
  })

  it('restituisce un contributo per ogni asse anche quando il peso è zero', () => {
    const { contributions } = scoreDestination(makeDestination(), { ...emptyWeights(), food: 1 })
    expect(contributions).toHaveLength(8)
  })
})

describe('filtro mare', () => {
  const landlocked = makeDestination({ id: 'praga', climate: { 7: { temp_avg: 20, sea_temp: null } } })
  const cold = makeDestination({ id: 'freddo', climate: { 7: { temp_avg: 15, sea_temp: 12 } } })
  const warm = makeDestination({ id: 'caldo', climate: { 7: { temp_avg: 28, sea_temp: 26 } } })

  it('non si attiva se il mare non è stato richiesto', () => {
    const { kept } = applyHardFilters([landlocked, cold, warm], {
      month: 7, weights: emptyWeights(),
    })
    expect(kept).toHaveLength(3)
  })

  it('NON si attiva per il solo peso: interesse non è requisito', () => {
    // Un peso di 10 su "mare" dice quanto ti interessa, non che lo esigi.
    // Prima bastava a escludere ogni destinazione senza costa.
    const { kept } = applyHardFilters([landlocked, cold, warm], {
      month: 7, seaTempMin: 21, weights: { ...emptyWeights(), sea: 10 },
    })
    expect(kept).toHaveLength(3)
  })

  it('esclude sotto soglia quando il mare è un requisito', () => {
    const { kept, excluded } = applyHardFilters([landlocked, cold, warm], {
      month: 7, seaTempMin: 21, seaRequired: true, weights: emptyWeights(),
    })
    expect(kept.map((d) => d.id)).toEqual(['caldo'])
    expect(excluded.every((e) => e.filter === FILTER.SEA)).toBe(true)
  })

  it('esclude chi non ha mare del tutto, non lo tratta come 0 °C', () => {
    const { excluded } = applyHardFilters([landlocked], {
      month: 7, seaRequired: true, weights: emptyWeights(),
    })
    expect(excluded[0].detail).toContain('non ha accesso al mare')
  })

  it('valuta il mese richiesto, non un mese qualsiasi', () => {
    const seasonal = makeDestination({
      climate: { 1: { sea_temp: 14 }, 8: { sea_temp: 26 } },
    })
    const base = { seaRequired: true, seaTempMin: 21, weights: emptyWeights() }
    expect(applyHardFilters([seasonal], { ...base, month: 8 }).kept).toHaveLength(1)
    expect(applyHardFilters([seasonal], { ...base, month: 1 }).kept).toHaveLength(0)
  })
})

describe('stato predefinito', () => {
  it('con i criteri di partenza non esclude nulla', () => {
    // "Reimposta tutto" deve riportare a uno stato in cui non è escluso
    // niente: se dopo un reset restano destinazioni fuori, il bottone non ha
    // fatto quello che dice.
    const iniziali = {
      query: '',
      month: 7,
      nights: 5,
      weights: emptyWeights(5),
      budgetMax: null,
      seaTempMin: 21,
      seaRequired: false,
      allowedTypes: ['city', 'area', 'island'],
    }
    const destinazioni = [
      makeDestination({ id: 'costiera', type: 'area', climate: { 7: { sea_temp: 25 } } }),
      makeDestination({ id: 'praga', type: 'city', climate: { 7: { sea_temp: null } } }),
      makeDestination({ id: 'creta', type: 'island', climate: { 7: { sea_temp: 25 } } }),
    ]
    const { kept, excluded } = applyHardFilters(destinazioni, iniziali)
    expect(excluded).toHaveLength(0)
    expect(kept).toHaveLength(3)
  })
})

describe('filtro budget', () => {
  it('confronta il costo TOTALE del soggiorno, non quello giornaliero', () => {
    const dest = makeDestination() // 100 €/notte
    const criteria = { nights: 5, budgetMax: 400, weights: emptyWeights() }
    expect(applyHardFilters([dest], criteria).kept).toHaveLength(0)
    expect(applyHardFilters([dest], { ...criteria, budgetMax: 600 }).kept).toHaveLength(1)
  })

  it('è disattivo quando budgetMax è null', () => {
    const { kept } = applyHardFilters([makeDestination()], {
      nights: 30, budgetMax: null, weights: emptyWeights(),
    })
    expect(kept).toHaveLength(1)
  })
})

describe('ricerca testuale', () => {
  const dubrovnik = makeDestination({ id: 'dubrovnik', name: 'Dubrovnik', country: 'HR' })
  const praga = makeDestination({ id: 'praga', name: 'Praga', country: 'CZ' })

  const search = (query) =>
    applyHardFilters([dubrovnik, praga], { query, weights: emptyWeights() }).kept.map((d) => d.id)

  it('trova per nome', () => {
    expect(search('dubro')).toEqual(['dubrovnik'])
  })

  it('trova per codice ISO', () => {
    expect(search('HR')).toEqual(['dubrovnik'])
  })

  it('trova per nome del paese per esteso', () => {
    // Cercando "croazia" ci si aspetta Dubrovnik: nel dato c'è scritto "HR",
    // ma nessuno cerca una vacanza digitando un codice ISO.
    expect(search('croazia')).toEqual(['dubrovnik'])
  })

  it('ignora maiuscole e spazi ai bordi', () => {
    expect(search('  CROAZIA  ')).toEqual(['dubrovnik'])
  })
})

describe('filtro tipo', () => {
  it('esclude i tipi non ammessi', () => {
    const city = makeDestination({ id: 'c', type: 'city' })
    const island = makeDestination({ id: 'i', type: 'island' })
    const { kept, excluded } = applyHardFilters([city, island], {
      allowedTypes: ['city'], weights: emptyWeights(),
    })
    expect(kept.map((d) => d.id)).toEqual(['c'])
    expect(excluded[0].filter).toBe(FILTER.TYPE)
  })
})

describe('attribuzione delle esclusioni', () => {
  it('attribuisce ogni esclusione al primo filtro che respinge', () => {
    // Un'isola fuori budget: il filtro tipo viene prima, quindi è quello
    // che deve essere riportato all'utente.
    const island = makeDestination({ type: 'island' })
    const { excluded } = applyHardFilters([island], {
      allowedTypes: ['city'], nights: 5, budgetMax: 1, weights: emptyWeights(),
    })
    expect(excluded).toHaveLength(1)
    expect(excluded[0].filter).toBe(FILTER.TYPE)
  })

  it('riassume i conteggi per filtro', () => {
    const destinations = [
      makeDestination({ id: 'a', type: 'island' }),
      makeDestination({ id: 'b', type: 'island' }),
      makeDestination({ id: 'c', type: 'city' }),
    ]
    const summary = summariseExclusions(
      applyHardFilters(destinations, { allowedTypes: ['city'], weights: emptyWeights() }).excluded
    )
    expect(summary).toEqual([{ filter: FILTER.TYPE, count: 2, label: 'tipo di destinazione' }])
  })
})

describe('rankDestinations', () => {
  const alta = makeDestination({ id: 'alta', name: 'Alta', scores: { ...makeDestination().scores, culture: 90 } })
  const bassa = makeDestination({ id: 'bassa', name: 'Bassa', scores: { ...makeDestination().scores, culture: 10 } })

  it('ordina per punteggio decrescente', () => {
    const { results } = rankDestinations([bassa, alta], { weights: { ...emptyWeights(), culture: 5 } })
    expect(results.map((r) => r.destination.id)).toEqual(['alta', 'bassa'])
  })

  it('segnala che non c’è ranking quando tutti i pesi sono a zero', () => {
    const { hasRanking } = rankDestinations([alta, bassa], { weights: emptyWeights() })
    expect(hasRanking).toBe(false)
  })

  it('senza pesi ripiega sull’ordine alfabetico, non su quello del file', () => {
    // L'ordine del file sembrerebbe una classifica pur non essendolo.
    const { results } = rankDestinations([bassa, alta], { weights: emptyWeights() })
    expect(results.map((r) => r.destination.name)).toEqual(['Alta', 'Bassa'])
  })

  it('ordina per costo crescente su richiesta', () => {
    const economica = makeDestination({
      id: 'economica',
      costs: { ...makeDestination().costs, accommodation: { low: 10, mid: 20, high: 30 } },
    })
    const { results } = rankDestinations([alta, economica], {
      weights: { ...emptyWeights(), culture: 1 }, nights: 3, sortBy: 'cost_asc',
    })
    expect(results[0].destination.id).toBe('economica')
  })

  it('non assegna punteggio alle destinazioni escluse', () => {
    const { results, excluded } = rankDestinations([alta, bassa], {
      weights: { ...emptyWeights(), culture: 5 },
      allowedTypes: ['island'],
    })
    expect(results).toHaveLength(0)
    expect(excluded).toHaveLength(2)
  })
})

describe('periodo "tutto l’anno"', () => {
  const mediterraneo = makeDestination({
    id: 'med',
    climate: { 1: { sea_temp: 15, temp_avg: 10 }, 8: { sea_temp: 26, temp_avg: 26 } },
  })
  const baltico = makeDestination({
    id: 'baltico',
    climate: { 1: { sea_temp: 3, temp_avg: -4 }, 8: { sea_temp: 18, temp_avg: 18 } },
  })
  const senzaMare = makeDestination({
    id: 'senza',
    climate: { 1: { sea_temp: null, temp_avg: 0 }, 8: { sea_temp: null, temp_avg: 20 } },
  })

  const criteri = { month: null, seaRequired: true, seaTempMin: 21, weights: emptyWeights() }

  it('basta un solo mese sopra soglia', () => {
    // La domanda non è "il mare è caldo adesso" ma "arriva mai a esserlo".
    const { kept } = applyHardFilters([mediterraneo, baltico], criteri)
    expect(kept.map((d) => d.id)).toEqual(['med'])
  })

  it('dice in che mese il mare arriva al massimo', () => {
    const { excluded } = applyHardFilters([baltico], criteri)
    expect(excluded[0].detail).toContain('18 °C ad agosto')
  })

  it('chi non ha mare resta escluso', () => {
    const { excluded } = applyHardFilters([senzaMare], criteri)
    expect(excluded[0].detail).toContain('non ha accesso al mare')
  })

  it('senza requisito mare non esclude nessuno', () => {
    const { excluded } = applyHardFilters([mediterraneo, baltico, senzaMare], {
      ...criteri, seaRequired: false,
    })
    expect(excluded).toHaveLength(0)
  })

  it('il riepilogo climatico usa la media per l’aria e il MASSIMO per il mare', () => {
    // Due grandezze diverse: la media risponde a "come si sta", il massimo a
    // "si può fare il bagno". Etichettarle uguali sarebbe una bugia comoda.
    const annuale = climateSummary(mediterraneo, null)
    expect(annuale.scope).toBe('year')
    expect(annuale.sea_temp).toBe(26)
    expect(annuale.temp_avg).toBe(18)

    const agosto = climateSummary(mediterraneo, 8)
    expect(agosto.scope).toBe('month')
    expect(agosto.sea_temp).toBe(26)
  })
})

describe('recommend — fatti derivati, non prosa generata', () => {
  const make = (id, total, costo) => ({
    destination: { id, name: id },
    scoring: { total },
    cost: { low: costo * 0.7, mid: costo, high: costo * 1.4 },
  })

  it('serve più di una destinazione per raccomandare', () => {
    expect(recommend([make('a', 70, 500)])).toBeNull()
    expect(recommend([])).toBeNull()
  })

  it('indica il punteggio più alto', () => {
    const r = recommend([make('a', 70, 500), make('b', 82, 900)])
    expect(r.best.destination.id).toBe('b')
  })

  it('il miglior rapporto può NON essere il punteggio più alto', () => {
    // È il punto della funzione: 70 punti a 300 € rendono più di 82 a 900 €.
    const r = recommend([make('caro', 82, 900), make('conveniente', 70, 300)])
    expect(r.best.destination.id).toBe('caro')
    expect(r.value.destination.id).toBe('conveniente')
    expect(r.coincidono).toBe(false)
  })

  it('dichiara quando le due risposte coincidono', () => {
    const r = recommend([make('a', 90, 300), make('b', 40, 800)])
    expect(r.coincidono).toBe(true)
  })

  it('il rapporto è punti ogni 100 €', () => {
    const r = recommend([make('a', 60, 300), make('b', 10, 1000)])
    expect(r.ratio).toBeCloseTo(20, 5)
  })

  it('un costo a zero non diventa un affare infinito', () => {
    // Costo zero è un dato mancante, non una destinazione gratis.
    const r = recommend([make('gratis', 50, 0), make('normale', 60, 400)])
    expect(r.value.destination.id).toBe('normale')
  })

  it('ignora chi non ha punteggio', () => {
    const senza = { destination: { id: 'x', name: 'x' }, scoring: { total: null }, cost: { mid: 100 } }
    expect(recommend([senza, make('a', 70, 500)])).toBeNull()
  })
})
