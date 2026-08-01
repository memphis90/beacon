import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Leaflet tocca `window` già all'import, e la mappa del dettaglio la tira
// dentro tutta la catena di `App`. Non è ciò che si sta provando qui.
vi.mock('leaflet', () => ({ default: {} }))

/**
 * La prova che mancava: che l'app **si disegni**.
 *
 * I test sulle funzioni pure non vedono un riferimento penzolante — una prop
 * rimasta a puntare a uno stato cancellato, un'icona non più importata — e
 * nemmeno `vite build` lo vede, perché è JavaScript valido fino al momento in
 * cui viene eseguito. Il risultato è una schermata bianca in un progetto con i
 * test verdi, che è il modo peggiore di scoprire una rimozione fatta a metà.
 *
 * Il render è quello statico del server: non servono jsdom né una libreria di
 * testing, `react-dom` c'è già. Gli effetti non partono, quindi non si prova il
 * comportamento — si prova che ogni componente raggiungibile compili e disegni
 * senza fare riferimento a cose che non esistono più. È poco, ed è esattamente
 * quello che è mancato.
 */

/**
 * Il render statico non esegue gli effetti, ma gli inizializzatori di stato sì,
 * e quelli leggono da `localStorage`. In Node non esiste: le funzioni di
 * caricamento lo gestiscono già con un try/catch, ma un finto oggetto rende la
 * prova indipendente da quella difesa invece di poggiarci sopra.
 */
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

const renderizza = async (modulo, props = {}) => {
  const { default: Componente } = await import(modulo)
  return renderToStaticMarkup(createElement(Componente, props))
}

describe('render — l’app si disegna senza riferimenti penzolanti', () => {
  it('App parte dalla home, con il campo della frase', async () => {
    const html = await renderizza('../src/App.jsx')
    expect(html).toContain('Dove andiamo?')
  })

  /**
   * L'altra metà dell'app. Questa prova esiste per un errore vero: una prop
   * rimasta a puntare a uno stato cancellato, invisibile ai test sulle
   * funzioni pure e a `vite build`, arrivata fino allo schermo bianco.
   */
  it('App disegna anche la schermata dei risultati', async () => {
    const html = await renderizza('../src/App.jsx', { startedInitially: true })
    expect(html).toContain('destinazioni')
    expect(html).toContain('Punteggio')
  })

  /**
   * La home è solo metà dell'app: i risultati vivono nell'altro ramo di `App`,
   * quello dietro `started`, e per errori come "setView non definito" è l'unico
   * che conta. Ci si arriva mettendo in `localStorage` una cronologia, che è
   * ciò che fa saltare la schermata d'ingresso... no: `started` è stato di
   * sessione. Quindi i componenti dei risultati si disegnano uno per uno, con
   * i dati veri del seed.
   */
  it('i componenti dei risultati si disegnano con i dati del seed', async () => {
    const { default: seed } = await import('../data/destinations.json', { with: { type: 'json' } })
    const { rankDestinations } = await import('../src/lib/scoring.js')
    const { emptyWeights } = await import('../src/lib/axes.js')

    const criteria = {
      query: '', month: 10, nights: 5, weights: emptyWeights(5),
      budgetMax: null, seaTempMin: 21, seaRequired: false,
      allowedTypes: ['city', 'area', 'island'], themes: ['gotico'], sortBy: 'score',
    }
    const ranking = rankDestinations(seed.destinations, criteria)
    // Una destinazione che porta davvero il tema: la prima in classifica non lo
    // è per forza, e la card deve mostrare il bonus dove c'è.
    const entry = ranking.results.find((r) => r.scoring.themeBonus > 0)
    expect(entry).toBeTruthy()

    const nulla = () => {}

    expect(await renderizza('../src/components/ResultsHeader.jsx', {
      count: ranking.results.length, total: seed.destinations.length, criteria, onSort: nulla,
    })).toContain('destinazioni')

    const card = await renderizza('../src/components/DestinationCard.jsx', {
      entry, rank: 1, criteria, isFavourite: false, inCompare: false,
      onToggleFavourite: nulla, onToggleCompare: nulla, onOpen: nulla,
    })
    expect(card).toContain(entry.destination.name)
    // Il bonus tematico deve comparire dove è stato promesso: la card è il
    // posto in cui si guarda il punteggio.
    expect(card).toContain(`+${entry.scoring.themeBonus} tema`)

    await renderizza('../src/components/ActiveFilters.jsx', {
      criteria, defaults: { ...criteria, themes: [] }, onChange: nulla, onReset: nulla,
    })
    await renderizza('../src/components/FilterPanel.jsx', {
      criteria, onChange: nulla, open: true, onClose: nulla, onReset: nulla,
    })
    await renderizza('../src/components/ScoreBreakdown.jsx', { scoring: entry.scoring })
    await renderizza('../src/components/BottomNav.jsx', {
      onlyFavourites: false, favouritesCount: 0, compareCount: 0,
      onSearch: nulla, onFavourites: nulla, onCompare: nulla, onEditor: nulla,
    })
  })

  it('il pannello della critica non si disegna senza un modello attivo', async () => {
    const html = await renderizza('../src/components/RankingCritique.jsx', {
      phrase: 'meta per halloween',
      entries: [],
      weights: {},
      agent: { enabled: false, profiles: [], activeId: null },
      onApplyWeight: () => {},
    })
    expect(html).toBe('')
  })
})
