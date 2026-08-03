import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BottomNav from '../src/components/BottomNav.jsx'
import PanelTabs from '../src/components/PanelTabs.jsx'
import { ParametersPage } from '../src/components/EditorPanel.jsx'
import App from '../src/App.jsx'
import { mergedDestinations } from '../src/lib/store.js'
import { LogoMark } from '../src/components/Logo.jsx'

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
  onNew: nulla, newDisabled: false,
  onList: nulla, onFavourites: nulla, onCompare: nulla, onSettings: nulla,
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
    for (const voce of ['Elenco', 'Preferiti', 'Nuova', 'Confronta', 'Impostazioni']) {
      expect(html).toContain(voce)
    }
    expect(html).not.toContain('Parametri')
  })

  it('il centro è «Nuova» e non cambia nome', () => {
    const html = dock()
    expect(html).toContain('Nuova')
    expect(html).not.toContain('Chiedi')
    expect(html).not.toContain('Cerca')
  })

  it('il centro è spento quando non c’è niente da azzerare', () => {
    expect(spento(dock({ newDisabled: true }), 'Nuova')).toBe(true)
    expect(spento(dock({ newDisabled: false }), 'Nuova')).toBe(false)
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
    expect(spento(html, 'Nuova')).toBe(false)
    expect(spento(html, 'Impostazioni')).toBe(false)
  })

  it('con risultati solo Confronta resta spento, e solo sotto le due selezioni', () => {
    const html = dock({ hasResults: true, compareCount: 1 })
    expect(spento(html, 'Elenco')).toBe(false)
    expect(spento(html, 'Confronta')).toBe(true)
    expect(spento(dock({ hasResults: true, compareCount: 2 }), 'Confronta')).toBe(false)
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

  it('sulla home vergine il centro è spento, nei risultati no', () => {
    expect(spento(renderToStaticMarkup(createElement(App)), 'Nuova')).toBe(true)
    expect(spento(renderToStaticMarkup(createElement(App, { startedInitially: true })), 'Nuova')).toBe(false)
  })
})

describe('ricerca — la stessa dock, e un invio solo', () => {
  it('la home monta la dock, spenta dove non c’è ancora niente', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('bottomnav__ask')
    // Nessun ranking esiste ancora: i tre slot che ci lavorano sopra sono spenti.
    expect(spento(html, 'Elenco')).toBe(true)
    expect(spento(html, 'Preferiti')).toBe(true)
    expect(spento(html, 'Confronta')).toBe(true)
    expect(spento(html, 'Impostazioni')).toBe(false)
  })

  it('il composer ha di nuovo la sua freccia', () => {
    expect(renderToStaticMarkup(createElement(App))).toContain('landing__send')
  })
})

describe('PanelTabs — le due schede del pannello mobile', () => {
  it('disegna le due voci e segna quella attiva', () => {
    const html = renderToStaticMarkup(
      createElement(PanelTabs, { active: 'parametri', onPick: nulla }),
    )
    expect(html).toContain('Parametri')
    expect(html).toContain('Modello')
    expect(html).toContain('aria-selected="true"')
  })
})

/**
 * La scheda «Parametri» del pannello mobile monta `ParametersPage`, non
 * `EditorPanel` con un `initialId` inesistente: quest'ultimo tornava `null` e
 * disegnava un pannello vuoto — vuoto anche nella striscia delle schede, dato
 * che `tabs` sta dentro lo stesso `return null`. Questa prova naviga proprio
 * il caso che l'avrebbe superata senza farsi notare: verifica che compaia
 * l'elenco vero delle destinazioni, non solo la striscia sopra di esso.
 */
describe('ParametersPage — la scheda «Parametri» mostra l’elenco vero', () => {
  it('disegna una riga per destinazione insieme alle schede', () => {
    const merged = mergedDestinations({})
    const html = renderToStaticMarkup(
      createElement(ParametersPage, {
        merged,
        overrides: { destinations: {} },
        onOverridesChange: nulla,
        onPick: nulla,
        onClose: nulla,
        tabs: createElement(PanelTabs, { active: 'parametri', onPick: nulla }),
      }),
    )
    expect(html).toContain('paneltabs')
    expect(html).toContain('destlist__pick')
    expect(html).toContain(merged[0].name)
  })
})

/**
 * Le due schede del pannello mobile devono essere la stessa superficie:
 * `SettingsModal` è sempre un overlay a tutto schermo, e prima di questa
 * modifica `ParametersPage` era sempre una pagina in flusso — passando da una
 * scheda all'altra il tipo di contenitore cambiava sotto gli occhi. `overlay`
 * è la prop esplicita che sceglie il contenitore, senza toccare né il corpo
 * né la pagina desktop che la monta senza questa prop.
 */
describe('il faro ha un appiglio per l’animazione', () => {
  it('la lanterna e i fasci hanno una classe propria', () => {
    const html = renderToStaticMarkup(createElement(LogoMark, {}))
    expect(html).toContain('logo__light')
    expect(html).toContain('logo__beams')
  })
})

describe('ParametersPage — `overlay` sceglie il contenitore, non il contenuto', () => {
  const monta = (overlay) =>
    renderToStaticMarkup(
      createElement(ParametersPage, {
        merged: mergedDestinations({}),
        overrides: { destinations: {} },
        onOverridesChange: nulla,
        onPick: nulla,
        onClose: nulla,
        tabs: createElement(PanelTabs, { active: 'parametri', onPick: nulla }),
        overlay,
      }),
    )

  it('con `overlay` disegna lo stesso guscio di SettingsModal: overlay, panel, dialog', () => {
    const html = monta(true)
    expect(html).toContain('overlay overlay--center')
    expect(html).toContain('panel panel--modal')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).not.toContain('class="page"')
  })

  it('senza `overlay` resta la pagina in flusso di sempre', () => {
    const html = monta(false)
    expect(html).toContain('class="page"')
    expect(html).not.toContain('overlay overlay--center')
    expect(html).not.toContain('role="dialog"')
  })
})
