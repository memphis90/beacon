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

describe('card compatta — lo stato aperto sta nel markup', () => {
  it('senza «aperta» la card non porta la classe', () => {
    expect(card()).not.toContain('card--aperta')
  })

  it('con «aperta» la card porta la classe', () => {
    expect(card({ aperta: true })).toContain('card--aperta')
  })

  it('il bottone di apertura dichiara lo stato a chi non vede', () => {
    expect(card()).toContain('aria-expanded="false"')
    expect(card({ aperta: true })).toContain('aria-expanded="true"')
  })

  it('il bottone di apertura c’è anche senza che gli si passi onApri', () => {
    expect(card()).toContain('card__apri')
  })
})

describe('card compatta — App non ne apre nessuna da sola', () => {
  it('al primo render non c’è nessuna card aperta', async () => {
    const { default: App } = await import('../src/App.jsx')
    const html = renderToStaticMarkup(createElement(App))
    expect(html).not.toContain('card--aperta')
  })
})
