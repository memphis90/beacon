import { describe, it, expect } from 'vitest'
import { COUNTRY_CODES, countryName } from '../src/lib/format.js'
import { matchesQuery } from '../src/lib/search.js'
import catalogo from '../data/destinations.json'

/**
 * Un codice paese senza nome per esteso non è un difetto di etichetta: è una
 * destinazione che non si trova scrivendo il suo paese, perché `matchesQuery`
 * cerca anche lì. Prima che la mappa fosse completa, «croazia» pescava
 * Dubrovnik e «germania» non pescava niente — in classifica e
 * nell'autocomplete del confronto insieme, visto che la regola è una sola.
 *
 * Questa prova esiste perché il buco si riapra rumorosamente: ogni ampliamento
 * del catalogo che porti un paese nuovo la fa fallire.
 */
describe('i nomi dei paesi coprono il catalogo', () => {
  const usati = [...new Set(catalogo.destinations.map((d) => d.country))].sort()

  it('nessun codice del catalogo resta senza nome per esteso', () => {
    const senzaNome = usati.filter((code) => !COUNTRY_CODES.includes(code))
    expect(senzaNome).toEqual([])
  })

  it('countryName non restituisce mai il codice così com’è', () => {
    for (const code of usati) {
      expect(countryName(code)).not.toBe(code)
    }
  })

  it('un codice sconosciuto ricade sul codice, senza esplodere', () => {
    expect(countryName('ZZ')).toBe('ZZ')
    expect(countryName(undefined)).toBe(undefined)
  })
})

describe('cercare un paese per nome trova le sue destinazioni', () => {
  const cerca = (query) =>
    catalogo.destinations.filter((d) => matchesQuery(d, query)).map((d) => d.name)

  it('«germania» adesso trova qualcosa', () => {
    const trovate = cerca('germania')
    expect(trovate.length).toBeGreaterThan(0)
    // Le stesse che hanno il codice DE, né una di più né una di meno.
    expect(trovate).toEqual(
      catalogo.destinations.filter((d) => d.country === 'DE').map((d) => d.name),
    )
  })

  it('vale per ogni paese del catalogo, non solo per quelli che ricordavamo', () => {
    for (const code of [...new Set(catalogo.destinations.map((d) => d.country))]) {
      const attese = catalogo.destinations.filter((d) => d.country === code).length
      const trovate = catalogo.destinations.filter((d) => matchesQuery(d, countryName(code))).length
      // Può trovarne di più — il nome di un paese può comparire dentro il nome
      // di una destinazione — ma mai di meno.
      expect(trovate).toBeGreaterThanOrEqual(attese)
    }
  })
})
