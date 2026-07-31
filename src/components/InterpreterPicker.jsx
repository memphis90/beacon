import { useEffect, useRef, useState } from 'react'
import { IconChevron, IconList, IconSettings, IconSparkle } from './Icons.jsx'

/**
 * Chi interpreta la frase, scelto dove la frase si scrive.
 *
 * Stava nelle impostazioni, ma è la stessa decisione che negli assistenti si
 * prende accanto al campo di testo: con che cosa viene letto quello che sto
 * scrivendo. Ed è una scelta che si cambia spesso — tipicamente subito dopo
 * aver visto un'interpretazione sbagliata, cioè nel momento in cui aprire una
 * modale è esattamente l'attrito di troppo. Nelle impostazioni resta la
 * configurazione dell'endpoint, che invece si tocca una volta sola.
 */
export default function InterpreterPicker({ agent, onChange, onConfigure }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Si chiude cliccando altrove o con Esc: senza, resta aperto sopra il campo
  // che stai per usare.
  useEffect(() => {
    if (!open) return
    const viaClic = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const viaTasto = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', viaClic)
    document.addEventListener('keydown', viaTasto)
    return () => {
      document.removeEventListener('mousedown', viaClic)
      document.removeEventListener('keydown', viaTasto)
    }
  }, [open])

  const configurato = Boolean(agent.baseUrl && agent.model)
  // Un `enabled` rimasto acceso su una configurazione svuotata non deve
  // mostrare "modello" e poi fallire a ogni frase.
  const usaModello = agent.enabled && configurato

  const scegli = (enabled) => { onChange({ ...agent, enabled }); setOpen(false) }

  return (
    <div className="picker" ref={ref}>
      <button
        type="button"
        className="picker__btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {usaModello ? <IconSparkle width="16" height="16" /> : <IconList width="16" height="16" />}
        <span className="picker__now">{usaModello ? agent.model : 'Regole locali'}</span>
        <IconChevron width="14" height="14" />
      </button>

      {open && (
        <div className="picker__menu" role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!usaModello}
            onClick={() => scegli(false)}
          >
            <IconList width="17" height="17" />
            <span>
              <strong>Regole locali</strong>
              <small>
                Espressioni scritte che girano qui, senza rete: mesi, durate, budget, gli otto
                assi con l’intensità, il tipo di destinazione.
              </small>
            </span>
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={usaModello}
            disabled={!configurato}
            onClick={() => scegli(true)}
          >
            <IconSparkle width="17" height="17" />
            <span>
              <strong>{configurato ? agent.model : 'Modello'}</strong>
              <small>
                {configurato
                  ? 'Capisce frasi che le regole non coprono. Se non risponde si torna alle regole, e l’app lo dice.'
                  : 'Nessun endpoint configurato: apri la configurazione qui sotto.'}
              </small>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="picker__config"
            onClick={() => { setOpen(false); onConfigure() }}
          >
            <IconSettings width="16" height="16" />
            Configura endpoint e modello…
          </button>
        </div>
      )}
    </div>
  )
}
