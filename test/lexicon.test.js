import { describe, it, expect } from 'vitest'
import { parseQuery } from '../src/lib/parseQuery.js'
import { restoreOriginal, toItalian } from '../src/lib/lexicon.js'

const chip = (result, key) => result.understood.find((u) => u.key === key)

/**
 * Le regole restano una grammatica sola: le altre lingue passano da un
 * dizionario di parole-chiave che porta la frase in italiano prima della
 * lettura. Queste prove coprono le due cose che possono rompersi in silenzio —
 * una frase italiana tradotta per sbaglio, e i chip che smettono di mostrare
 * le parole di chi ha scritto.
 */
describe('lexicon — l’inglese senza riscrivere le regole', () => {
  it('legge una frase inglese come leggerebbe la stessa in italiano', () => {
    const en = parseQuery('5 nights in october, mostly culture and a bit of food')
    const it = parseQuery('5 notti a ottobre, principalmente cultura e un po’ di cibo')

    expect(en.patch.month).toBe(10)
    expect(en.patch.nights).toBe(5)
    expect(en.patch).toEqual(it.patch)
    expect(en.lang).toBe('en')
    expect(it.lang).toBe('it')
  })

  it('riconosce la negazione, che è ciò che dà il peso', () => {
    const r = parseQuery('mountains and hiking in february, without nightlife')
    expect(r.patch.weights.outdoor).toBeGreaterThan(0)
    expect(r.patch.weights.nature).toBeGreaterThan(0)
    expect(r.patch.weights.nightlife).toBe(0)
  })

  it('traduce le espressioni composte prima delle parole che le compongono', () => {
    // "long weekend" vale 3 notti, "weekend" ne vale 2: se vincesse la seconda
    // resterebbe "long" appeso e la durata sarebbe sbagliata.
    expect(parseQuery('a long weekend in may with museums').patch.nights).toBe(3)
  })

  it('“off the beaten track” arriva su offbeat', () => {
    const r = parseQuery('somewhere off the beaten track in september with good food')
    expect(r.patch.weights.offbeat).toBeGreaterThan(0)
    expect(r.patch.weights.food).toBeGreaterThan(0)
  })

  /**
   * Il caso che rende pericoloso un dizionario: l'italiano contiene parole che
   * esistono anche in inglese. Sotto la soglia non si traduce niente — e "no"
   * italiano non diventa "niente", che cambierebbe il senso della frase.
   */
  it('non traduce una frase italiana con dentro una parola inglese', () => {
    const r = parseQuery('un weekend a maggio con musei e buon cibo')
    expect(r.lang).toBe('it')
    expect(r.patch.month).toBe(5)
    expect(r.patch.nights).toBe(2)
  })

  it('una frase senza parole conosciute resta com’è', () => {
    expect(toItalian('qualcosa di indefinito').lang).toBe('it')
    expect(toItalian('').lang).toBe('it')
  })

  it('i chip mostrano le parole scritte, non quelle tradotte', () => {
    const r = parseQuery('5 nights in october, mostly culture')
    expect(chip(r, 'month').from).toBe('october')
    expect(chip(r, 'axis:culture').from).toBe('culture')
    // Il valore resta in italiano: è l'app che parla, non l'utente.
    expect(chip(r, 'month').value).toBe('ottobre')
  })

  it('legge i numeri in lettere, che è come si scrivono davvero', () => {
    expect(parseQuery('cinque notti a ottobre').patch.nights).toBe(5)
    expect(parseQuery('tre giorni a marzo').patch.nights).toBe(3)
    expect(parseQuery('un giorno a Roma').patch.nights).toBe(1)
    expect(parseQuery('five nights in october').patch.nights).toBe(5)
  })

  it('“undici” non viene letto come “un”', () => {
    // L'alternanza contiene sia "un" sia "undici": senza backtracking la
    // prima vincerebbe e undici notti diventerebbero una.
    expect(parseQuery('undici notti a giugno').patch.nights).toBe(11)
  })

  it('le settimane restano un idioma, i giorni contano come notti', () => {
    expect(parseQuery('due settimane ad agosto').patch.nights).toBe(14)
    expect(parseQuery('una settimana a maggio').patch.nights).toBe(7)
    expect(parseQuery('quindici giorni a luglio').patch.nights).toBe(15)
  })

  /**
   * "Località di mare" non è un interesse per il mare: è la categoria della
   * destinazione. Trattarlo come un peso faceva comparire città che il mare
   * ce l'hanno vicino senza esserne fatte.
   */
  it('“località di mare” accende il requisito, “vista sul mare” no', () => {
    expect(parseQuery('una località di mare a luglio').patch.seaRequired).toBe(true)
    expect(parseQuery('cerco una meta balneare ad agosto').patch.seaRequired).toBe(true)
    expect(parseQuery('un posto al mare a giugno').patch.seaRequired).toBe(true)
    expect(parseQuery('una casa con vista sul mare').patch.seaRequired).toBeUndefined()
    expect(parseQuery('un po’ di mare e molta cultura').patch.seaRequired).toBeUndefined()
  })

  it('restoreOriginal lascia stare ciò che non ha tradotto', () => {
    const { origini } = toItalian('museums and beaches in july')
    expect(restoreOriginal('ottobre', origini)).toBe('ottobre')
    expect(restoreOriginal('', origini)).toBe('')
  })
})
