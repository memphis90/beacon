import { describe, it, expect } from 'vitest'
import { parseQuery } from '../src/lib/parseQuery.js'

const value = (result, key) => result.understood.find((u) => u.key === key)?.value

describe('le tre query di esempio del planning (§1)', () => {
  it('“5 giorni a ottobre, budget 600 €, soprattutto natura e un po’ di cultura”', () => {
    const r = parseQuery('Dove vado 5 giorni a ottobre, budget 600 €, voglio soprattutto natura e un po\' di cultura?')
    expect(r.patch.month).toBe(10)
    expect(r.patch.nights).toBe(5)
    expect(r.patch.budgetMax).toBe(600)
    expect(r.patch.weights.nature).toBe(9)
    expect(r.patch.weights.culture).toBe(3)
  })

  it('“weekend lungo a marzo”', () => {
    const r = parseQuery('Confrontami Lisbona per un weekend lungo a marzo')
    expect(r.patch.month).toBe(3)
    expect(r.patch.nights).toBe(3)
  })

  it('“mare, meno di 3 ore di volo, a giugno l’acqua è già calda”', () => {
    const r = parseQuery('Destinazioni di mare raggiungibili in meno di 3 ore di volo dove a giugno l\'acqua è già calda')
    expect(r.patch.month).toBe(6)
    expect(r.patch.weights.sea).toBeGreaterThan(0)
    // Il tempo di volo è Fase 2: va dichiarato, non ignorato in silenzio.
    expect(r.ignored.some((i) => /tempo di volo/.test(i.reason))).toBe(true)
  })
})

describe('intensità', () => {
  it('“soprattutto” alza, “un po’ di” abbassa', () => {
    const r = parseQuery('soprattutto cibo e un po\' di vita notturna')
    expect(r.patch.weights.food).toBe(9)
    expect(r.patch.weights.nightlife).toBe(3)
  })

  it('una menzione semplice sta nel mezzo', () => {
    expect(parseQuery('cerco cultura').patch.weights.culture).toBe(7)
  })

  it('“senza” azzera invece di alzare', () => {
    // Senza questo, "senza vita notturna" alzerebbe proprio l'asse che
    // l'utente sta escludendo.
    expect(parseQuery('mare e senza vita notturna').patch.weights.nightlife).toBe(0)
  })
})

describe('periodo', () => {
  it('riconosce i mesi', () => {
    expect(parseQuery('ad agosto').patch.month).toBe(8)
  })

  it('“tutto l’anno” azzera il mese', () => {
    const r = parseQuery('mi va bene tutto l\'anno')
    expect(r.patch.month).toBeNull()
    expect(value(r, 'month')).toBe('tutto l’anno')
  })

  it('una stagione diventa un mese rappresentativo, e lo dichiara', () => {
    const r = parseQuery('vorrei partire in estate')
    expect(r.patch.month).toBe(7)
    expect(r.understood.find((u) => u.key === 'month').note).toContain('non è un mese')
  })
})

describe('budget', () => {
  it('legge l’importo con il simbolo', () => {
    expect(parseQuery('max 800 €').patch.budgetMax).toBe(800)
  })

  it('legge “euro” per esteso e i separatori di migliaia', () => {
    expect(parseQuery('budget 1.200 euro').patch.budgetMax).toBe(1200)
  })
})

describe('il mare: interesse o requisito', () => {
  it('una menzione qualsiasi è solo un interesse', () => {
    const r = parseQuery('un po\' di mare')
    expect(r.patch.weights.sea).toBe(3)
    expect(r.patch.seaRequired).toBeUndefined()
  })

  it('“voglio il mare” lo rende un requisito', () => {
    expect(parseQuery('voglio il mare').patch.seaRequired).toBe(true)
  })

  it('“balneabile” lo rende un requisito', () => {
    expect(parseQuery('qualcosa di balneabile').patch.seaRequired).toBe(true)
  })
})

describe('tipo e destinazione', () => {
  it('“isola” restringe il tipo', () => {
    expect(parseQuery('un\'isola a settembre').patch.allowedTypes).toEqual(['island'])
  })

  it('riconosce un nome di destinazione noto', () => {
    const r = parseQuery('vorrei andare a Creta', {
      destinations: [{ name: 'Creta', countryName: 'Grecia' }],
    })
    expect(r.patch.query).toBe('Creta')
  })

  it('riconosce anche il nome del paese', () => {
    const r = parseQuery('qualcosa in Croazia', {
      destinations: [{ name: 'Dubrovnik', countryName: 'Croazia' }],
    })
    expect(r.patch.query).toBe('Croazia')
  })
})

describe('robustezza', () => {
  it('su frase vuota non inventa nulla', () => {
    const r = parseQuery('')
    expect(r.empty).toBe(true)
    expect(r.patch).toEqual({})
  })

  it('su frase incomprensibile dichiara di non aver capito', () => {
    const r = parseQuery('asdf qwerty zxcv')
    expect(r.empty).toBe(true)
    expect(r.understood).toHaveLength(0)
  })

  it('non confonde “notte” dentro “vita notturna” con la durata', () => {
    const r = parseQuery('vita notturna a maggio')
    expect(r.patch.nights).toBeUndefined()
    expect(r.patch.weights.nightlife).toBe(7)
  })

  it('dichiara ciò che riconosce ma non sa fare', () => {
    const r = parseQuery('voglio un itinerario di 3 giorni')
    expect(r.ignored.some((i) => /Fase 3/.test(i.reason))).toBe(true)
  })
})
