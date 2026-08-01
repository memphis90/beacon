import { describe, it, expect } from 'vitest'
import { seaSeasonFactor, scoreDestination, rankDestinations } from '../src/lib/scoring.js'
import { emptyWeights } from '../src/lib/axes.js'

const clima = (temps) =>
  Object.fromEntries(temps.map((t, i) => [String(i + 1), { sea_temp: t, temp_avg: 20 }]))

const dest = (id, sea, temps) => ({
  id, name: id, country: 'IT', type: 'island',
  scores: { nature: 50, culture: 50, sea, food: 50, nightlife: 50, outdoor: 50, family: 50, offbeat: 50 },
  costs: {
    accommodation: { low: 50, mid: 70, high: 90 },
    food_per_day: { low: 20, mid: 30, high: 40 },
    transport_local_day: { low: 5, mid: 8, high: 12 },
  },
  climate: clima(temps),
})

// Due destinazioni con lo stesso mare "fermo": una che a ottobre è ancora
// calda, una che a ottobre è fredda. È il caso del test 9.
const calda = dest('canarie', 80, [19, 19, 19, 20, 21, 22, 23, 24, 25, 24, 22, 20])
const fredda = dest('adriatico', 90, [10, 9, 11, 14, 19, 23, 25, 26, 23, 18, 15, 12])
const entroterra = { ...dest('praga', 5, []), climate: {} }

describe('il mare ha una stagione', () => {
  it('vale tutto sopra i 25 gradi e niente sotto i 16', () => {
    expect(seaSeasonFactor(calda, 9)).toBe(1)
    expect(seaSeasonFactor(fredda, 1)).toBe(0)
  })

  it('in mezzo scala in proporzione', () => {
    // ottobre: 24 °C contro 18 °C
    expect(seaSeasonFactor(calda, 10)).toBeCloseTo(8 / 9, 2)
    expect(seaSeasonFactor(fredda, 10)).toBeCloseTo(2 / 9, 2)
  })

  it('senza mese non c’è stagione: il punteggio resta quello fermo', () => {
    const { contributions } = scoreDestination(fredda, { ...emptyWeights(), sea: 9 }, [], {})
    expect(contributions.find((c) => c.key === 'sea').score).toBe(90)
  })

  it('un buco nei dati non è un mare freddo', () => {
    // Manca il mese, ma la destinazione il mare ce l'ha negli altri mesi:
    // condannarla per un dato assente sarebbe inventare una misura.
    const bucata = { ...calda, climate: { ...calda.climate, 10: { temp_avg: 20 } } }
    expect(seaSeasonFactor(bucata, 10)).toBe(1)
  })

  it('chi non ha mai il mare vale zero, in qualunque mese', () => {
    expect(seaSeasonFactor(entroterra, 7)).toBe(0)
  })

  it('a ottobre vince la calda, ad agosto la fredda', () => {
    const criteri = { weights: { ...emptyWeights(), sea: 10 }, nights: 5, themes: [] }
    const ottobre = rankDestinations([calda, fredda], { ...criteri, month: 10 })
    expect(ottobre.results[0].destination.id).toBe('canarie')

    const agosto = rankDestinations([calda, fredda], { ...criteri, month: 8 })
    expect(agosto.results[0].destination.id).toBe('adriatico')
  })

  it('la riduzione resta leggibile: punteggio fermo, punteggio del mese, motivo', () => {
    const { contributions } = scoreDestination(fredda, { ...emptyWeights(), sea: 9 }, [], { month: 10 })
    const mare = contributions.find((c) => c.key === 'sea')
    expect(mare.baseScore).toBe(90)
    expect(mare.score).toBe(20)
    expect(mare.seasonal.temp).toBe(18)
  })

  it('tocca il mare e nient’altro', () => {
    const { contributions } = scoreDestination(fredda, { ...emptyWeights(5) }, [], { month: 1 })
    for (const c of contributions.filter((c) => c.key !== 'sea')) {
      expect(c.seasonal, c.key).toBeUndefined()
    }
  })
})
