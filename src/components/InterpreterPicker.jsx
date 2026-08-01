import { useEffect, useRef, useState } from 'react'
import { IconChevron, IconList, IconSettings, IconSparkle } from './Icons.jsx'
import {
  activeProfile, agentIsReady, endpointHost, profileIsUsable, profileLabel, profileNeedsKey,
} from '../lib/agent.js'

/**
 * Chi interpreta la frase, scelto dove la frase si scrive.
 *
 * Stava nelle impostazioni, ma è la stessa decisione che negli assistenti si
 * prende accanto al campo di testo: con che cosa viene letto quello che sto
 * scrivendo. Ed è una scelta che si cambia spesso — tipicamente subito dopo
 * aver visto un'interpretazione sbagliata, cioè nel momento in cui aprire una
 * modale è esattamente l'attrito di troppo. Nelle impostazioni resta la
 * configurazione degli endpoint, che invece si tocca di rado.
 *
 * Il menu elenca **tutti** i modelli configurati, non solo quello acceso: è la
 * stessa ragione di prima portata alle sue conseguenze. Se confrontare due
 * interpreti richiede di riaprire le impostazioni e riscrivere un URL, non lo
 * si fa, e si tiene il primo modello che si era messo.
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

  const profili = agent.profiles || []
  // Un `enabled` rimasto acceso su una configurazione svuotata non deve
  // mostrare il nome di un modello e poi fallire a ogni frase.
  const usaModello = agentIsReady(agent)
  const attivo = activeProfile(agent)

  const scegliRegole = () => { onChange({ ...agent, enabled: false }); setOpen(false) }
  const scegliModello = (id) => { onChange({ ...agent, enabled: true, activeId: id }); setOpen(false) }

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
        <span className="picker__now">{usaModello ? profileLabel(attivo) : 'Regole locali'}</span>
        <IconChevron width="14" height="14" />
      </button>

      {open && (
        <div className="picker__menu" role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!usaModello}
            onClick={scegliRegole}
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

          {profili.map((p) => {
            // Un remoto senza chiave sembra pronto e non lo è: lasciarlo
            // scegliere significa mandare ogni frase contro un 401.
            const manca = profileNeedsKey(p)
            const pronto = profileIsUsable(p) && !manca
            const scelto = usaModello && p.id === agent.activeId
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={scelto}
                disabled={!pronto}
                onClick={() => scegliModello(p.id)}
              >
                <IconSparkle width="17" height="17" />
                <span>
                  <strong>{profileLabel(p)}</strong>
                  <small>
                    {pronto
                      // L'host distingue due profili che girano lo stesso
                      // modello — il caso tipico: locale contro remoto.
                      ? `${endpointHost(p.baseUrl)}${p.label?.trim() ? ` · ${p.model}` : ''}`
                      : manca
                        ? `Manca la chiave API per ${endpointHost(p.baseUrl)}: mettila qui sotto.`
                        : 'Incompleto: manca l’endpoint o il nome del modello.'}
                  </small>
                </span>
              </button>
            )
          })}

          {profili.length === 0 && (
            <p className="picker__empty">
              Nessun modello configurato. Le regole locali bastano per mesi, durate, budget e
              interessi; un modello serve per le frasi che non coprono.
            </p>
          )}

          <button
            type="button"
            role="menuitem"
            className="picker__config"
            onClick={() => { setOpen(false); onConfigure() }}
          >
            <IconSettings width="16" height="16" />
            {profili.length ? 'Gestisci i modelli…' : 'Configura un modello…'}
          </button>
        </div>
      )}
    </div>
  )
}
