import { describe, it, expect } from 'vitest'
import { periodFromDates } from '../src/lib/period.js'

/**
 * Le date entrano, il mese esce — e quello che si perde per strada va detto.
 * Queste prove tengono ferme le due cose che rendono onesto il selettore: che
 * il mese scelto sia quello in cui si passano più notti, e che un periodo a
 * cavallo lo dichiari invece di far finta di niente.
 */
describe('periodFromDates — dalle date al periodo', () => {
  it('ricava notti e mese da un soggiorno dentro un mese solo', () => {
    const p = periodFromDates('2026-08-12', '2026-08-19')
    expect(p.nights).toBe(7)
    expect(p.month).toBe(8)
    expect(p.spanning).toBe(false)
    expect(p.label).toContain('agosto')
  })

  /**
   * Il caso che rende sbagliato "prendi il mese della prima data": su
   * 28 agosto-10 settembre le notti di settembre sono il doppio, e la media
   * di agosto risponderebbe alla domanda sbagliata.
   */
  it('a cavallo di due mesi sceglie quello con più notti, e lo dice', () => {
    const p = periodFromDates('2026-08-28', '2026-09-10')
    expect(p.nights).toBe(13)
    expect(p.month).toBe(9)
    expect(p.spanning).toBe(true)
    expect(p.label).toContain('a cavallo')
    expect(p.months).toEqual([
      { month: 9, nights: 9 },
      { month: 8, nights: 4 },
    ])
  })

  it('una notte sola è un periodo valido', () => {
    expect(periodFromDates('2026-05-01', '2026-05-02').nights).toBe(1)
  })

  it('taglia a sessanta notti, come il resto dell’app', () => {
    expect(periodFromDates('2026-01-01', '2026-12-31').nights).toBe(60)
  })

  it('date incoerenti o incomplete non producono un periodo', () => {
    expect(periodFromDates('2026-08-19', '2026-08-12')).toBeNull()
    expect(periodFromDates('2026-08-12', '2026-08-12')).toBeNull()
    expect(periodFromDates('2026-08-12', '')).toBeNull()
    expect(periodFromDates(null, null)).toBeNull()
    expect(periodFromDates('non è una data', '2026-08-12')).toBeNull()
  })
})
