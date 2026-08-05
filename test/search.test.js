import { describe, it, expect } from 'vitest'
import { matchesQuery, suggestDestinations } from '../src/lib/search.js'

const d = (id, name, country, type = 'city') => ({ id, name, country, type })

const catalogo = [
  d('lisbona', 'Lisbona', 'PT'),
  d('porto', 'Porto', 'PT'),
  d('dubrovnik', 'Dubrovnik', 'HR'),
  d('siviglia', 'Siviglia', 'ES'),
]

describe('matchesQuery — la stessa regola della classifica', () => {
  it('la query vuota passa tutto', () => {
    expect(matchesQuery(catalogo[0], '')).toBe(true)
    expect(matchesQuery(catalogo[0], '   ')).toBe(true)
    expect(matchesQuery(catalogo[0], undefined)).toBe(true)
  })

  it('corrisponde sul nome, senza badare alle maiuscole', () => {
    expect(matchesQuery(catalogo[0], 'lisb')).toBe(true)
    expect(matchesQuery(catalogo[0], 'LISB')).toBe(true)
    expect(matchesQuery(catalogo[0], 'madrid')).toBe(false)
  })

  it('corrisponde sul codice paese e sul paese per esteso', () => {
    // Il commento in scoring.js: cercando "croazia" ci si aspetta Dubrovnik,
    // non zero risultati perché nel dato c'è scritto "HR".
    expect(matchesQuery(catalogo[2], 'HR')).toBe(true)
    expect(matchesQuery(catalogo[2], 'croazia')).toBe(true)
    expect(matchesQuery(catalogo[3], 'croazia')).toBe(false)
  })

  /**
   * Il pagliaio contiene il paese, quindi "porto" pesca anche Lisbona
   * attraverso "Portogallo". Non è un difetto da correggere qui: è la regola
   * della classifica, e il punto di questo modulo è che ce ne sia UNA. Se un
   * giorno si vorrà più precisione, si cambia qui e cambia in tutti e due i
   * posti — che è esattamente ciò che prima non era possibile.
   */
  it('il paese fa parte del pagliaio, con le conseguenze del caso', () => {
    expect(matchesQuery(catalogo[0], 'porto')).toBe(true)
  })
})

describe('suggestDestinations', () => {
  it('con query vuota propone le prime, fino al limite', () => {
    expect(suggestDestinations(catalogo, '', { limit: 2 }).map((x) => x.id))
      .toEqual(['lisbona', 'porto'])
  })

  it('filtra sulla query', () => {
    expect(suggestDestinations(catalogo, 'siv').map((x) => x.id)).toEqual(['siviglia'])
  })

  it('esclude gli id già scelti', () => {
    expect(suggestDestinations(catalogo, 'PT', { exclude: ['lisbona'] }).map((x) => x.id))
      .toEqual(['porto'])
  })

  it('rispetta il limite', () => {
    expect(suggestDestinations(catalogo, '', { limit: 3 })).toHaveLength(3)
  })

  it('senza opzioni non esplode', () => {
    expect(suggestDestinations(catalogo, 'dubrov').map((x) => x.id)).toEqual(['dubrovnik'])
  })
})
