import { describe, it, expect } from 'vitest'
import { parseQuery, FUORI_CATALOGO } from '../src/lib/parseQuery.js'

const catalogo = [
  { name: 'Sardegna', countryName: 'Italia' },
  { name: 'Creta', countryName: 'Grecia' },
]
const leggi = (frase) => parseQuery(frase, { destinations: catalogo })

describe('"città": tipo di destinazione o cosa da vedere', () => {
  it('con l’articolo è il tipo', () => {
    // `\b` è ASCII: dopo la "à" non c'è confine di parola, e per questo la
    // regola non partiva mai sulla frase più comune.
    expect(leggi('voglio visitare una città europea sul mare').patch.allowedTypes).toEqual(['city'])
    expect(leggi('tre notti in una città del nord').patch.allowedTypes).toEqual(['city'])
  })

  it('senza articolo descrive cosa ci si trova, e non filtra', () => {
    // "storia, musei, città antiche" buttava fuori Sicilia, Creta e Rodi:
    // esattamente le risposte giuste.
    expect(leggi('mare, storia, musei, città antiche e buon cibo').patch.allowedTypes).toBeUndefined()
  })
})

describe('un luogo messo a confronto non è un filtro', () => {
  it('"indeciso tra Sardegna e Grecia" non riduce il catalogo a una risposta', () => {
    const { patch, ignored } = leggi('sono indeciso tra Sardegna e Grecia, voglio mare spettacolare')
    expect(patch.query).toBeUndefined()
    expect(ignored.some((i) => /confront/.test(i.reason))).toBe(true)
  })

  it('ma un luogo voluto resta un filtro', () => {
    expect(leggi('cinque notti in Sardegna').patch.query).toBe('Sardegna')
  })
})

describe('parole che mancavano al vocabolario', () => {
  it('"turismo di massa" è fuori rotta', () => {
    expect(leggi('mare tranquillo, evito il turismo di massa').patch.weights.offbeat).toBe(0)
    expect(leggi('poca gente e mare bello').patch.weights.offbeat).toBeGreaterThan(0)
  })

  it('"locali la sera" e "conoscere persone" sono vita notturna', () => {
    expect(leggi('mare di giorno e locali la sera').patch.weights.nightlife).toBeGreaterThan(0)
    expect(leggi('un posto per conoscere persone nuove').patch.weights.nightlife).toBeGreaterThan(0)
  })
})

describe('il confine del catalogo', () => {
  it('riconosce le richieste che non può soddisfare', () => {
    for (const frase of ['una vacanza al mare fuori Europa', 'due settimane ai Caraibi', 'mare in Thailandia']) {
      expect(FUORI_CATALOGO.test(frase.toLowerCase()), frase).toBe(true)
    }
    expect(FUORI_CATALOGO.test('una vacanza al mare in grecia')).toBe(false)
  })

  it('e lo dichiara invece di rispondere lo stesso', () => {
    const { ignored } = leggi('voglio una vacanza al mare fuori Europa a settembre')
    expect(ignored.some((i) => /solo Europa e Mediterraneo/.test(i.reason))).toBe(true)
  })
})
