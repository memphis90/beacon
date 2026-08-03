import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BottomNav from '../src/components/BottomNav.jsx'
import PanelTabs from '../src/components/PanelTabs.jsx'
import { ParametersPage } from '../src/components/EditorPanel.jsx'
import SettingsModal from '../src/components/SettingsModal.jsx'
import App from '../src/App.jsx'
import Landing from '../src/components/Landing.jsx'
import { emptyAgentConfig } from '../src/lib/agent.js'
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

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8')

/**
 * Il foglio di stile spaccato in due: ciò che vale **solo** sotto i 900px e
 * tutto il resto.
 *
 * Serve alle regole che a schermo si vedono ma nel markup no. La distinzione
 * non è pignoleria: il vincolo del progetto è che sopra i 901px non cambi
 * niente, e una riga scritta fuori dal blocco mobile vale anche lì. Le graffe
 * si contano invece di cercare la chiusura col regex perché dentro il blocco
 * ce ne sono altri annidati.
 */
const spaccaCss = () => {
  const query = '@media (max-width: 900px)'
  let mobile = ''
  let resto = ''
  let da = 0
  for (;;) {
    const apre = css.indexOf(query, da)
    if (apre < 0) break
    const inizio = css.indexOf('{', apre)
    let livello = 0
    let fine = -1
    for (let i = inizio; i < css.length; i += 1) {
      if (css[i] === '{') livello += 1
      else if (css[i] === '}') {
        livello -= 1
        if (livello === 0) { fine = i; break }
      }
    }
    if (fine < 0) break
    resto += css.slice(da, apre)
    mobile += css.slice(inizio + 1, fine)
    da = fine + 1
  }
  return { mobile, resto: resto + css.slice(da) }
}

const { mobile: cssMobile, resto: cssResto } = spaccaCss()

describe('BottomNav — cinque slot, e il centro ricomincia', () => {
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
    expect(dock()).toContain('bottomnav__new')
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

describe('risultati — la dock c’è, e il centro riporta alla frase', () => {
  it('la schermata dei risultati monta la dock col centro', () => {
    const html = renderToStaticMarkup(createElement(App, { startedInitially: true }))
    expect(html).toContain('bottomnav__new')
    expect(html).toContain('Impostazioni')
    expect(html).toContain('Elenco')
  })

  it('sulla home vergine il centro è spento, nei risultati no', () => {
    expect(spento(renderToStaticMarkup(createElement(App)), 'Nuova')).toBe(true)
    expect(spento(renderToStaticMarkup(createElement(App, { startedInitially: true })), 'Nuova')).toBe(false)
  })
})

describe('ricerca — la stessa dock, e l’invio sta nel composer', () => {
  it('la home monta la dock, spenta dove non c’è ancora niente', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('bottomnav__new')
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

describe('il faro ha un appiglio per l’animazione', () => {
  it('la lanterna e i fasci hanno una classe propria', () => {
    const html = renderToStaticMarkup(createElement(LogoMark, {}))
    expect(html).toContain('logo__light')
    expect(html).toContain('logo__beams')
  })
})

/**
 * Le due schede del pannello mobile devono essere **la stessa superficie**: si
 * cambia scheda, non pannello.
 *
 * Queste prove asseriscono ciò che deve restare vero a schermo, non quale
 * classe lo produce. La versione precedente si intitolava «lo stesso guscio di
 * SettingsModal» e asseriva `panel panel--modal` su `ParametersPage`:
 * `SettingsModal` quella classe non ce l'ha — monta `panel--info` — quindi la
 * prova certificava una somiglianza che non aveva mai verificato, e ha lasciato
 * passare due giri con le due schede di altezza diversa.
 *
 * L'ultimo punto — che entrambe riempiano lo schermo sotto i 900px — è una
 * regola CSS e nel markup non si vede: si legge dal foglio. E si legge dentro
 * il blocco mobile, perché sopra i 901px `.panel--info` deve restare la
 * colonna centrata a lunghezza di lettura delle pagine informative.
 */
describe('le due schede del pannello mobile sono la stessa superficie', () => {
  const schede = {
    parametri: renderToStaticMarkup(
      createElement(ParametersPage, {
        merged: mergedDestinations({}),
        overrides: { destinations: {} },
        onOverridesChange: nulla,
        onPick: nulla,
        onClose: nulla,
        tabs: createElement(PanelTabs, { active: 'parametri', onPick: nulla }),
        overlay: true,
      }),
    ),
    modello: renderToStaticMarkup(
      createElement(SettingsModal, {
        config: emptyAgentConfig(),
        onChange: nulla,
        onClose: nulla,
        tabs: createElement(PanelTabs, { active: 'modello', onPick: nulla }),
      }),
    ),
  }

  it('sono due dialoghi su velo, non una pagina e un dialogo', () => {
    for (const [nome, html] of Object.entries(schede)) {
      expect(html, nome).toContain('overlay overlay--center')
      expect(html, nome).toContain('role="dialog"')
      expect(html, nome).toContain('aria-modal="true"')
      expect(html, nome).not.toContain('class="page"')
    }
  })

  it('portano tutte e due la striscia delle schede, e la stessa chiusura', () => {
    for (const [nome, html] of Object.entries(schede)) {
      expect(html, nome).toContain('paneltabs')
      // La × in testata, non un bottone etichettato in una e la × nell'altra:
      // due schede che si chiudono in due modi diversi non sono un pannello solo.
      expect(bottone(html, '×')).toContain('panel__close')
      expect(bottone(html, '×')).toContain('aria-label="Chiudi"')
    }
    // «Torna ai risultati» resta alla pagina desktop, dove è vero: aperta dalla
    // home, questa scheda non ha risultati a cui tornare.
    expect(schede.parametri).not.toContain('Torna ai risultati')
  })

  it('sotto i 900px nessuna delle due è più bassa dell’altra', () => {
    // Se questa fallisce per prima, il foglio non è stato spaccato: il resto
    // delle asserzioni su `cssMobile` non direbbe niente.
    expect(cssMobile).not.toBe('')
    // `.panel { height: 100% }` vale già per entrambe; a `.panel--info`
    // restava il tetto di 80vh, e la scheda Modello si apriva bassa e
    // centrata accanto a una scheda Parametri a tutto schermo.
    expect(cssMobile).toMatch(/\.panel--info\s*\{[^}]*max-height:\s*none/)
  })

  it('sopra i 901px il tetto di `.panel--info` resta dov’era', () => {
    // Il vincolo del progetto: sopra i 901px non cambia niente. Lì
    // `.panel--info` è la colonna centrata delle pagine informative del
    // footer, e senza tetto crescerebbe oltre lo schermo.
    expect(cssResto).toMatch(/\.panel--info\s*\{[^}]*max-height:\s*80vh/)
  })
})

describe('ParametersPage — `overlay` sceglie il contenitore, non il contenuto', () => {
  it('senza `overlay` resta la pagina in flusso di sempre', () => {
    const html = renderToStaticMarkup(
      createElement(ParametersPage, {
        merged: mergedDestinations({}),
        overrides: { destinations: {} },
        onOverridesChange: nulla,
        onPick: nulla,
        onClose: nulla,
        tabs: createElement(PanelTabs, { active: 'parametri', onPick: nulla }),
        overlay: false,
      }),
    )
    expect(html).toContain('class="page"')
    expect(html).not.toContain('overlay overlay--center')
    expect(html).not.toContain('role="dialog"')
    // Il bottone etichettato vive qui e solo qui.
    expect(html).toContain('Torna ai risultati')
  })
})

/**
 * Il pannello Impostazioni della home ha due strade, e non sono la stessa cosa.
 *
 * Il menu laterale e il «configura» del selettore esistono a **ogni**
 * larghezza — sopra i 901px la barra laterale è la colonna permanente, e il
 * selettore sta accanto al composer sempre. La dock invece sotto i 901px non
 * c'è. Aprendo dalle prime due il pannello a schede, il desktop si ritrovava
 * una striscia che non ha mai avuto e una scheda «Parametri» che lì è una
 * pagina in flusso, non un overlay a tutto schermo: è la regressione che
 * queste due prove chiudono, e che nessuna prova copriva.
 */
describe('Landing — il pannello del menu non è quello della dock', () => {
  const landing = (over = {}) =>
    renderToStaticMarkup(
      createElement(Landing, {
        destinations: mergedDestinations({}),
        agent: emptyAgentConfig(),
        overrides: { destinations: {} },
        onAgentChange: nulla, onOverridesChange: nulla,
        onApply: nulla, onSkip: nulla, onLogout: nulla,
        onList: nulla, onFavourites: nulla, onCompare: nulla,
        ...over,
      }),
    )

  it('il percorso «menu laterale → Impostazioni» non monta le schede', () => {
    const html = landing({ panelInitially: 'impostazioni' })
    // Il pannello si è aperto davvero: senza questa riga la prova passerebbe
    // anche se non comparisse niente.
    expect(html).toContain('Modelli configurati')
    expect(html).not.toContain('paneltabs')
  })

  it('la stessa schermata, aperta dalla dock, le schede ce le ha', () => {
    expect(landing({ panelInitially: 'modello' })).toContain('paneltabs')
    expect(landing({ panelInitially: 'parametri' })).toContain('paneltabs')
  })
})
