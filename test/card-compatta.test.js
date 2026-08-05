import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DestinationCard from '../src/components/DestinationCard.jsx'

// Come in render.test.js: Leaflet tocca `window` all'import e la mappa del
// dettaglio lo tira dentro tutta la catena di App.
vi.mock('leaflet', () => ({ default: {} }))

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k),
      clear: () => memoria.clear(),
    }
  }
})

/**
 * La card compatta è quasi tutta CSS, e `renderToStaticMarkup` non applica il
 * CSS. Queste prove coprono l'unica parte che si può provare qui — che lo
 * stato aperto esista nel markup e si annunci a chi non vede — e niente
 * altro. Il resto (110px, cinque card a schermo, dove atterrano punteggio e
 * cuore) sta nella lista a occhio del piano del 3 agosto, ed è lì apposta.
 */

const destinazione = {
  id: 'lisbona',
  name: 'Lisbona',
  country: 'PT',
  type: 'city',
  coords: { lat: 38.7223, lon: -9.1393 },
  radius_km: 40,
  climate: { 10: { temp_avg: 19, temp_max: 23, sea_temp: 20, rain_days: 9 } },
}

const punteggio = (extra = {}) => ({
  total: 88.4,
  base: 88.4,
  themeBonus: 0,
  matchedThemes: [],
  contributions: [
    { key: 'nature', label: 'Natura', weight: 5, score: 45, contribution: 11.2 },
    { key: 'culture', label: 'Cultura', weight: 8, score: 85, contribution: 34.0 },
  ],
  ...extra,
})

const card = (props = {}, extraPunteggio = {}) =>
  renderToStaticMarkup(
    createElement(DestinationCard, {
      entry: {
        destination: destinazione,
        scoring: punteggio(extraPunteggio),
        cost: { low: 92, high: 150 },
      },
      rank: 1,
      criteria: { nights: 5, month: 10, sortBy: 'score' },
      isFavourite: false,
      onToggleFavourite: () => {},
      inCompare: false,
      onToggleCompare: () => {},
      onOpen: () => {},
      ...props,
    }),
  )

describe('card compatta — il tocco apre la scheda', () => {
  it('la card non ha più uno stato aperto', () => {
    const html = card()
    expect(html).not.toContain('card--aperta')
    expect(html).not.toContain('aria-expanded')
  })

  it('il bottone sovrapposto dice che apre la scheda', () => {
    const html = card()
    expect(html).toContain('card__apri')
    expect(html).toContain('Apri la scheda di Lisbona')
  })
})

describe('card compatta — la coda della riga del paese', () => {
  it('il tipo si accoda al paese, oltre a restare nel chip', () => {
    const html = card()
    expect(html).toContain('card__meta')
    // Due forme dello stesso dato: il chip per il desktop, la coda per il
    // mobile. Il CSS le rende mutuamente esclusive.
    expect(html).toContain('card__type')
    expect(html).toContain('· città')
  })

  it('il «+N tema» è nel markup solo quando c’è un bonus', () => {
    expect(card()).not.toContain('card__metabonus')
    const conBonus = card({}, { themeBonus: 2, base: 86.4, matchedThemes: ['mare'] })
    expect(conBonus).toContain('card__metabonus')
    expect(conBonus).toContain('+2 tema')
  })
})
