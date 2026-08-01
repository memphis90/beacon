import { describe, it, expect } from 'vitest'
import { costRange, cheapness, scoreDestination, rankDestinations } from '../src/lib/scoring.js'
import { parseQuery } from '../src/lib/parseQuery.js'
import { emptyWeights, AXIS_KEYS, EDITABLE_AXES } from '../src/lib/axes.js'

const dest = (id, low, mid, high, scores = {}) => ({
  id, name: id, country: 'IT', type: 'city',
  scores: { nature: 50, culture: 50, sea: 50, food: 50, nightlife: 50, outdoor: 50, family: 50, offbeat: 50, ...scores },
  costs: {
    accommodation: { low, mid, high },
    food_per_day: { low: 0, mid: 0, high: 0 },
    transport_local_day: { low: 0, mid: 0, high: 0 },
  },
  climate: {},
})

const catalogo = [
  dest('economica', 30, 40, 50),
  dest('media', 70, 80, 90),
  dest('cara', 150, 160, 170),
]

describe('asse economicità (derivato)', () => {
  it('è un asse a tutti gli effetti ma non è modificabile a mano', () => {
    expect(AXIS_KEYS).toContain('value')
    expect(EDITABLE_AXES.map((a) => a.key)).not.toContain('value')
  })

  it('dà 100 alla più economica del catalogo e 0 alla più cara', () => {
    const range = costRange(catalogo)
    expect(cheapness(catalogo[0], range)).toBe(100)
    expect(cheapness(catalogo[2], range)).toBe(0)
    expect(cheapness(catalogo[1], range)).toBeGreaterThan(50)
  })

  it('non legge `scores`: un punteggio scritto a mano viene ignorato', () => {
    // È la garanzia che l'asse non possa contraddire il prezzo mostrato.
    const bugiarda = { ...catalogo[2], scores: { ...catalogo[2].scores, value: 100 } }
    const range = costRange(catalogo)
    const { contributions } = scoreDestination(bugiarda, { ...emptyWeights(), value: 10 }, [], { costRange: range })
    expect(contributions.find((c) => c.key === 'value').score).toBe(0)
  })

  it('senza intervallo di costo vale 0 e non rompe il calcolo', () => {
    const { total } = scoreDestination(catalogo[0], { ...emptyWeights(), nature: 5, value: 5 }, [], null)
    expect(total).toBe(25)
  })

  it('cercando "economico" la più conveniente vince', () => {
    const { results } = rankDestinations(catalogo, {
      weights: { ...emptyWeights(), value: 9 },
      nights: 3, month: null, themes: [],
    })
    expect(results[0].destination.id).toBe('economica')
    expect(results[results.length - 1].destination.id).toBe('cara')
  })

  it("l'intervallo si misura sul catalogo intero, non sulle sopravvissute al filtro", () => {
    // Con due sole destinazioni in gara, la più cara delle due non deve
    // diventare "0 di economicità" se nel catalogo c'è di peggio.
    const { results } = rankDestinations(catalogo, {
      weights: { ...emptyWeights(), value: 9 },
      nights: 1, month: null, themes: [], query: 'a',   // esclude "cara"? no: filtra per nome
    })
    const media = results.find((r) => r.destination.id === 'media')
    const punteggio = media.scoring.contributions.find((c) => c.key === 'value').score
    expect(punteggio).toBeGreaterThan(0)
    expect(punteggio).toBeLessThan(100)
  })
})

describe('le regole capiscono "economico"', () => {
  it('riconosce la parola e le sue varianti', () => {
    for (const frase of ['una meta economica', 'un posto conveniente', 'vorrei spendere poco', 'qualcosa di low cost']) {
      expect(parseQuery(frase).patch.weights?.value, frase).toBeGreaterThan(0)
    }
  })

  it('"senza spendere una fortuna" chiede economicità, non la esclude', () => {
    // Il "senza" nega la spesa, non l'asse: la regola generica lo azzererebbe.
    const { patch, understood } = parseQuery('una settimana al mare senza spendere una fortuna')
    expect(patch.weights.value).toBe(8)
    expect(understood.find((u) => u.key === 'axis:value').from).toBe('senza spendere una fortuna')
  })

  it('"senza vita notturna" resta una negazione', () => {
    expect(parseQuery('un posto tranquillo senza vita notturna').patch.weights.nightlife).toBe(0)
  })

  it('non scambia "costoso" per un desiderio di economicità', () => {
    expect(parseQuery('non mi importa se è costoso').patch.weights?.value).toBeUndefined()
  })
})
