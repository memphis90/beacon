import { describe, it, expect } from 'vitest'
import { critiquePayload, sanitiseCritique, sanitisePatch, sanitiseUnderstood } from '../src/lib/agent.js'

/**
 * Un modello sbaglia, allucina campi e a volte restituisce stringhe dove ci
 * vogliono numeri. Queste prove servono a garantire che nulla di tutto ciò
 * arrivi al motore di scoring.
 */
describe('sanitisePatch — l’output del modello non è creduto sulla parola', () => {
  it('accetta un oggetto ben formato', () => {
    const { patch, rejected } = sanitisePatch({
      month: 10, nights: 5, budgetMax: 600,
      weights: { nature: 9, culture: 3 },
      seaRequired: false, allowedTypes: ['island'],
    })
    expect(patch).toEqual({
      month: 10, nights: 5, budgetMax: 600,
      weights: { nature: 9, culture: 3 },
      seaRequired: false, allowedTypes: ['island'],
    })
    expect(rejected).toHaveLength(0)
  })

  it('scarta un mese fuori intervallo invece di propagarlo', () => {
    const { patch, rejected } = sanitisePatch({ month: 47 })
    expect(patch.month).toBeUndefined()
    expect(rejected[0]).toContain('47')
  })

  it('accetta month: null come “tutto l’anno”', () => {
    expect(sanitisePatch({ month: null }).patch.month).toBeNull()
  })

  it('riporta i pesi fuori scala dentro 0–10', () => {
    const { patch } = sanitisePatch({ weights: { nature: 99, culture: -5 } })
    expect(patch.weights).toEqual({ nature: 10, culture: 0 })
  })

  it('scarta gli assi inventati', () => {
    const { patch, rejected } = sanitisePatch({ weights: { nature: 7, teletrasporto: 9 } })
    expect(patch.weights).toEqual({ nature: 7 })
    expect(rejected.some((r) => r.includes('teletrasporto'))).toBe(true)
  })

  it('legge i numeri anche quando arrivano come stringhe', () => {
    const { patch } = sanitisePatch({ nights: '7', budgetMax: '600 €' })
    expect(patch.nights).toBe(7)
    expect(patch.budgetMax).toBe(600)
  })

  it('scarta i tipi di destinazione inesistenti', () => {
    const { patch } = sanitisePatch({ allowedTypes: ['island', 'pianeta'] })
    expect(patch.allowedTypes).toEqual(['island'])
  })

  it('ignora allowedTypes quando li elenca tutti: non è un filtro', () => {
    const { patch } = sanitisePatch({ allowedTypes: ['city', 'area', 'island'] })
    expect(patch.allowedTypes).toBeUndefined()
  })

  it('tronca una query lunghissima invece di accettarla', () => {
    const { patch } = sanitisePatch({ query: 'x'.repeat(500) })
    expect(patch.query.length).toBeLessThanOrEqual(60)
  })

  it('non esplode su risposte non oggetto', () => {
    expect(sanitisePatch(null).patch).toEqual({})
    expect(sanitisePatch('ciao').patch).toEqual({})
    expect(sanitisePatch(42).rejected).toHaveLength(1)
  })

  it('notti negative o zero vengono scartate', () => {
    expect(sanitisePatch({ nights: 0 }).patch.nights).toBeUndefined()
    expect(sanitisePatch({ nights: -3 }).patch.nights).toBeUndefined()
  })

  it('un budget non numerico viene scartato, non azzerato', () => {
    const { patch, rejected } = sanitisePatch({ budgetMax: 'tanti soldi' })
    expect(patch.budgetMax).toBeUndefined()
    expect(rejected).toHaveLength(1)
  })
})

describe('sanitiseUnderstood — la spiegazione', () => {
  it('tiene le voci ben formate', () => {
    const out = sanitiseUnderstood([{ label: 'Mese', value: 'ottobre', from: 'ottobre' }])
    expect(out).toHaveLength(1)
    expect(out[0].from).toBe('ottobre')
  })

  it('scarta le voci senza etichetta o valore', () => {
    expect(sanitiseUnderstood([{ from: 'x' }, { label: 'Mese' }])).toHaveLength(0)
  })

  it('tollera una spiegazione mancante', () => {
    expect(sanitiseUnderstood(undefined)).toEqual([])
    expect(sanitiseUnderstood('niente')).toEqual([])
  })

  it('mette un tetto al numero di voci', () => {
    const molte = Array.from({ length: 40 }, (_, i) => ({ label: `L${i}`, value: 'v', from: 'f' }))
    expect(sanitiseUnderstood(molte).length).toBeLessThanOrEqual(12)
  })
})

/**
 * La critica è l'unico punto in cui il modello tocca il ranking, e lo tocca
 * solo attraverso un peso. Queste prove sono la garanzia che non possa fare
 * altro: nessuna via per riordinare, per inventare un asse o per far comparire
 * un bottone che non cambierebbe niente.
 */
describe('sanitiseCritique — il modello propone pesi, non risultati', () => {
  const pesi = { nature: 5, culture: 5, sea: 5, food: 5, nightlife: 5, outdoor: 5, family: 5, offbeat: 3 }

  it('tiene un suggerimento ben formato e ci allega il peso di partenza', () => {
    const { suggestions, rejected } = sanitiseCritique(
      { suggestions: [{ axis: 'offbeat', to: 9, why: 'hai scritto “poco turistico”' }] },
      pesi
    )
    expect(suggestions).toEqual([
      { axis: 'offbeat', label: 'Fuori rotta', from: 3, to: 9, why: 'hai scritto “poco turistico”' },
    ])
    expect(rejected).toHaveLength(0)
  })

  it('scarta gli assi inventati', () => {
    const { suggestions, rejected } = sanitiseCritique(
      { suggestions: [{ axis: 'teletrasporto', to: 9, why: 'perché sì' }] },
      pesi
    )
    expect(suggestions).toHaveLength(0)
    expect(rejected[0]).toContain('teletrasporto')
  })

  it('riporta i pesi fuori scala dentro 0–10', () => {
    const { suggestions } = sanitiseCritique(
      { suggestions: [{ axis: 'nature', to: 99, why: 'motivo' }] },
      pesi
    )
    expect(suggestions[0].to).toBe(10)
  })

  it('scarta un suggerimento che non cambierebbe nulla', () => {
    const { suggestions, rejected } = sanitiseCritique(
      { suggestions: [{ axis: 'nature', to: 5, why: 'motivo' }] },
      pesi
    )
    expect(suggestions).toHaveLength(0)
    expect(rejected[0]).toContain('già 5')
  })

  it('pretende una motivazione: senza, il suggerimento non è verificabile', () => {
    const { suggestions } = sanitiseCritique({ suggestions: [{ axis: 'sea', to: 9 }] }, pesi)
    expect(suggestions).toHaveLength(0)
  })

  it('non ripete lo stesso asse due volte', () => {
    const { suggestions } = sanitiseCritique(
      {
        suggestions: [
          { axis: 'sea', to: 9, why: 'primo' },
          { axis: 'sea', to: 2, why: 'secondo' },
        ],
      },
      pesi
    )
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].why).toBe('primo')
  })

  it('taglia a tre suggerimenti', () => {
    const molti = ['nature', 'culture', 'sea', 'food', 'nightlife'].map((axis) => ({
      axis, to: 9, why: 'motivo',
    }))
    expect(sanitiseCritique({ suggestions: molti }, pesi).suggestions).toHaveLength(3)
  })

  it('non lascia passare un ordinamento: campi estranei sono ignorati', () => {
    const { suggestions, note } = sanitiseCritique(
      { ranking: ['Lisbona', 'Porto'], winner: 'Lisbona', suggestions: [] },
      pesi
    )
    expect(suggestions).toHaveLength(0)
    expect(note).toBe('')
  })

  it('non esplode su risposte non oggetto', () => {
    expect(sanitiseCritique(null).suggestions).toEqual([])
    expect(sanitiseCritique('ciao').rejected).toHaveLength(1)
  })
})

describe('critiquePayload — cosa vede il modello', () => {
  const entry = {
    destination: { name: 'Lisbona' },
    scoring: { total: 72.345, contributions: [{ key: 'nature', score: 60 }, { key: 'sea', score: 80 }] },
  }

  it('manda frase, pesi e prime destinazioni con i punteggi per asse', () => {
    const payload = JSON.parse(critiquePayload({
      text: 'cinque giorni poco turistici',
      entries: [entry],
      weights: { offbeat: 3 },
    }))
    expect(payload.frase).toBe('cinque giorni poco turistici')
    expect(payload.pesi_attuali.find((p) => p.axis === 'offbeat').peso).toBe(3)
    expect(payload.prime_destinazioni[0]).toEqual({
      nome: 'Lisbona',
      punteggio: 72.3,
      punteggi_per_asse: { nature: 60, sea: 80 },
    })
  })

  it('si ferma alle prime cinque: il resto è contesto sprecato', () => {
    const payload = JSON.parse(critiquePayload({
      text: 'x', entries: Array.from({ length: 12 }, () => entry), weights: {},
    }))
    expect(payload.prime_destinazioni).toHaveLength(5)
  })
})
