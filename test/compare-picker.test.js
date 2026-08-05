import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ComparePicker from '../src/components/ComparePicker.jsx'

const d = (id, name, country, type = 'city') => ({ id, name, country, type })
const lisbona = d('lisbona', 'Lisbona', 'PT')
const porto = d('porto', 'Porto', 'PT')
const catalogo = [lisbona, porto, d('siviglia', 'Siviglia', 'ES')]

const picker = (props = {}) =>
  renderToStaticMarkup(
    createElement(ComparePicker, {
      corrente: lisbona,
      aggiunte: [],
      catalogo,
      max: 4,
      onAggiungi: () => {},
      onTogli: () => {},
      onApri: () => {},
      ...props,
    }),
  )

describe('ComparePicker', () => {
  it('la destinazione aperta è un chip senza croce', () => {
    const html = picker()
    expect(html).toContain('Lisbona')
    expect(html).not.toContain('Togli Lisbona dal confronto')
  })

  it('le aggiunte hanno la croce', () => {
    const html = picker({ aggiunte: [porto] })
    expect(html).toContain('Porto')
    expect(html).toContain('Togli Porto dal confronto')
  })

  it('al tetto il campo lascia il posto a un avviso', () => {
    const html = picker({ aggiunte: [porto, d('a', 'Adalia', 'TR'), d('b', 'Bath', 'GB')] })
    expect(html).toContain('Il confronto è pieno')
    expect(html).not.toContain('Aggiungi una destinazione')
  })

  it('sotto il tetto il campo c’è', () => {
    const html = picker({ aggiunte: [porto] })
    expect(html).not.toContain('Il confronto è pieno')
    expect(html).toContain('Aggiungi una destinazione')
  })

  it('la destinazione aperta non si suggerisce da sola', () => {
    // Il chip c'è, ma nella lista dei suggerimenti no: sarebbe un confronto
    // con se stessa.
    const html = picker()
    expect(html.match(/Lisbona/g)).toHaveLength(1)
  })

  it('non promette un combobox che non è', () => {
    const html = picker()
    expect(html).not.toContain('role="combobox"')
    expect(html).not.toContain('aria-activedescendant')
  })

  it('«Apri il confronto» è spento con la sola destinazione aperta', () => {
    expect(picker()).toContain('disabled')
    expect(picker({ aggiunte: [porto] })).not.toContain('disabled')
  })
})
