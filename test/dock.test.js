import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BottomNav from '../src/components/BottomNav.jsx'
import App from '../src/App.jsx'
import { AGENT_KEY } from '../src/lib/agent.js'

/**
 * Due difese copiate da render.test.js, e servono entrambe dal Task 2 in poi,
 * quando queste prove montano `App`:
 *
 * - Leaflet tocca `window` già all'import, e la mappa del dettaglio lo tira
 *   dentro tutta la catena di App. Non è ciò che si sta provando qui.
 * - Il render statico non esegue gli effetti, ma gli inizializzatori di stato
 *   sì, e quelli leggono da `localStorage`, che in Node non esiste.
 */
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

const nulla = () => {}
const base = {
  onlyFavourites: false, favouritesCount: 0, compareCount: 0, hasResults: true,
  askLabel: 'Chiedi', askDisabled: false,
  onAsk: nulla, onList: nulla, onFavourites: nulla, onCompare: nulla, onSettings: nulla,
}
const dock = (over = {}) => renderToStaticMarkup(createElement(BottomNav, { ...base, ...over }))

/**
 * Il bottone che porta questa etichetta, isolato dal resto del markup.
 *
 * Senza jsdom si lavora sulla stringa, ma contare le occorrenze di "disabled"
 * nell'intera pagina si romperebbe al primo bottone spento aggiunto altrove,
 * per ragioni che non c'entrano con ciò che si sta provando.
 */
const bottone = (html, etichetta) =>
  html.match(new RegExp(`<button(?:(?!</button>).)*?${etichetta}</button>`))?.[0] ?? ''

const spento = (html, etichetta) => / disabled(=|>| )/.test(bottone(html, etichetta))

describe('BottomNav — cinque slot, il centro è l’azione', () => {
  it('disegna le cinque voci, con Impostazioni al posto di Parametri', () => {
    const html = dock()
    for (const voce of ['Elenco', 'Preferiti', 'Chiedi', 'Confronta', 'Impostazioni']) {
      expect(html).toContain(voce)
    }
    expect(html).not.toContain('Parametri')
  })

  it('il centro cambia nome secondo chi risponderà', () => {
    expect(dock({ askLabel: 'Cerca' })).toContain('Cerca')
    expect(dock({ askLabel: 'Cerca' })).not.toContain('Chiedi')
  })

  /**
   * Il centro deve essere riconoscibile nel markup, non solo a schermo: è la
   * classe su cui poggia tutta la regola CSS che lo fa sporgere.
   */
  it('il centro ha la sua classe e non è un tab come gli altri', () => {
    expect(dock()).toContain('bottomnav__ask')
  })

  it('senza risultati i tre slot di vista sono disattivi, gli altri due no', () => {
    const html = dock({ hasResults: false })
    expect(spento(html, 'Elenco')).toBe(true)
    expect(spento(html, 'Preferiti')).toBe(true)
    expect(spento(html, 'Confronta')).toBe(true)
    // Il centro e le impostazioni sono le uniche due cose che in quel momento
    // si possono fare davvero.
    expect(spento(html, 'Chiedi')).toBe(false)
    expect(spento(html, 'Impostazioni')).toBe(false)
  })

  it('con risultati solo Confronta resta spento, e solo sotto le due selezioni', () => {
    const html = dock({ hasResults: true, compareCount: 1 })
    expect(spento(html, 'Elenco')).toBe(false)
    expect(spento(html, 'Confronta')).toBe(true)
    expect(spento(dock({ hasResults: true, compareCount: 2 }), 'Confronta')).toBe(false)
  })

  it('il centro si disattiva quando non c’è niente da chiedere', () => {
    expect(spento(dock({ askDisabled: true }), 'Chiedi')).toBe(true)
    expect(spento(dock({ askDisabled: false }), 'Chiedi')).toBe(false)
  })

  it('i badge compaiono solo se c’è qualcosa da contare', () => {
    expect(dock({ favouritesCount: 3, compareCount: 2 })).toContain('bottomnav__badge')
    expect(dock()).not.toContain('bottomnav__badge')
  })
})

describe('risultati — la dock c’è e il centro riapre la frase', () => {
  it('la schermata dei risultati monta la dock col centro', () => {
    const html = renderToStaticMarkup(createElement(App, { startedInitially: true }))
    expect(html).toContain('bottomnav__ask')
    expect(html).toContain('Impostazioni')
    expect(html).toContain('Elenco')
  })

  /**
   * L'unica cosa che il Task 2 ha introdotto e che sia osservabile nel markup
   * statico: prima del diff `App` non passava `askLabel` a `BottomNav`, quindi
   * valeva sempre il default `'Cerca'`. Ora lo calcola da `agentIsReady(agent)`
   * — con un profilo locale acceso e utilizzabile deve leggersi «Chiedi», non
   * «Cerca». Scrivo e rimuovo la chiave dentro la prova stessa: le altre
   * prove del file montano `App` senza aspettarsi un agente configurato, e non
   * devono trovarne uno lasciato in giro da questa.
   */
  describe('col profilo locale pronto', () => {
    afterEach(() => {
      try { localStorage.removeItem(AGENT_KEY) } catch { /* niente da fare */ }
    })

    it('il centro dice «Chiedi», non «Cerca»', () => {
      localStorage.setItem(AGENT_KEY, JSON.stringify({
        enabled: true,
        activeId: 'm1',
        profiles: [{
          id: 'm1', label: '', preset: 'ollama',
          baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '',
        }],
        debug: false,
      }))
      const html = renderToStaticMarkup(createElement(App, { startedInitially: true }))
      expect(bottone(html, 'Chiedi')).not.toBe('')
      expect(bottone(html, 'Cerca')).toBe('')
    })
  })
})
