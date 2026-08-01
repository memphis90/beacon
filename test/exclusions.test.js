import { describe, it, expect } from 'vitest'
import { parseQuery } from '../src/lib/parseQuery.js'
import { applyHardFilters, FILTER } from '../src/lib/scoring.js'
import { sanitisePatch } from '../src/lib/agent.js'

const dest = (id, name, country) => ({
  id, name, country, type: 'island',
  scores: { nature: 50, culture: 50, sea: 50, food: 50, nightlife: 50, outdoor: 50, family: 50, offbeat: 50 },
  costs: {
    accommodation: { low: 50, mid: 70, high: 90 },
    food_per_day: { low: 20, mid: 30, high: 40 },
    transport_local_day: { low: 5, mid: 8, high: 12 },
  },
  climate: {},
})

const catalogo = [
  { ...dest('sardegna', 'Sardegna', 'IT'), countryName: 'Italia' },
  { ...dest('sicilia', 'Sicilia', 'IT'), countryName: 'Italia' },
  { ...dest('puglia', 'Puglia', 'IT'), countryName: 'Italia' },
  { ...dest('creta', 'Creta', 'GR'), countryName: 'Grecia' },
]

const leggi = (frase) => parseQuery(frase, { destinations: catalogo })

describe('un luogo rifiutato non è un luogo cercato', () => {
  it('"ma non in Sardegna" la esclude invece di cercarla', () => {
    const { patch } = leggi('voglio una vacanza al mare ma non in Sardegna')
    expect(patch.excluded).toEqual(['Sardegna'])
    expect(patch.query).toBeUndefined()
  })

  it('la negazione si propaga lungo un elenco', () => {
    const { patch } = leggi('mare ma non in Sardegna, Sicilia o Puglia')
    expect(patch.excluded).toEqual(expect.arrayContaining(['Sardegna', 'Sicilia', 'Puglia']))
    expect(patch.query).toBeUndefined()
  })

  it('ma si ferma quando la frase riprende in positivo', () => {
    const { patch } = leggi('non in Sardegna, vorrei Creta')
    expect(patch.excluded).toEqual(['Sardegna'])
    expect(patch.query).toBe('Creta')
  })

  it('un luogo semplicemente nominato resta una ricerca', () => {
    const { patch } = leggi('cinque notti a Creta')
    expect(patch.query).toBe('Creta')
    expect(patch.excluded).toBeUndefined()
  })

  it('il motore toglie davvero le escluse, con un motivo dichiarato', () => {
    const { kept, excluded } = applyHardFilters(catalogo, { excluded: ['Sardegna'] })
    expect(kept.map((d) => d.id)).not.toContain('sardegna')
    expect(excluded.find((e) => e.destination.id === 'sardegna').filter).toBe(FILTER.EXCLUDED)
  })

  it('escludere un paese toglie tutte le sue destinazioni', () => {
    const { kept } = applyHardFilters(catalogo, { excluded: ['Grecia'] })
    expect(kept.map((d) => d.id)).not.toContain('creta')
    expect(kept).toHaveLength(3)
  })

  it('il veto batte la ricerca: una destinazione vietata non torna dalla query', () => {
    const { kept } = applyHardFilters(catalogo, { query: 'Sardegna', excluded: ['Sardegna'] })
    expect(kept).toHaveLength(0)
  })

  it('dal modello i veti si accettano ma non alla cieca', () => {
    expect(sanitisePatch({ excluded: ['Sardegna', 'x', '   ', 'Sicilia'] }).patch.excluded)
      .toEqual(['Sardegna', 'Sicilia'])
    expect(sanitisePatch({ excluded: 'Sardegna' }).patch.excluded).toBeUndefined()
  })
})

describe('la negazione riconosce i verbi coniugati', () => {
  it('"evito le discoteche" azzera la vita notturna invece di chiederla', () => {
    expect(parseQuery('un posto tranquillo, evito le discoteche').patch.weights.nightlife).toBe(0)
  })

  it('vale anche per escludo, odio, detesto', () => {
    for (const frase of ['escludo le discoteche', 'odio la movida', 'detesto la vita notturna']) {
      expect(parseQuery(frase).patch.weights.nightlife, frase).toBe(0)
    }
  })

  it('"mai" non è una negazione: negherebbe la frase sbagliata', () => {
    // "il mare più bello che abbia mai visto" chiede il mare, non lo esclude.
    expect(parseQuery('il mare più bello che abbia mai visto').patch.weights.sea).toBeGreaterThan(0)
  })
})
