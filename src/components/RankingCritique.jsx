import { useEffect, useState } from 'react'
import { critiqueRanking } from '../lib/agent.js'

/**
 * Il modello guarda il ranking e propone dei pesi. Non lo riordina.
 *
 * La differenza non è di sfumatura: un modello che sceglie le destinazioni
 * ordinerebbe pescando dalla memoria di addestramento, contraddicendo il seed
 * e gli override dell'editor, e toglierebbe di mezzo la domanda su cui si
 * regge la Fase 0 — "quale asse è responsabile di questo risultato?". Qui
 * interviene su un numero che resta visibile nell'aritmetica del punteggio, e
 * che applichi tu.
 *
 * Parte da sola una volta per frase, non a ogni cambio di peso: una chiamata
 * locale costa una decina di secondi, e rilanciarla a ogni slider mosso la
 * renderebbe un fastidio invece di un aiuto.
 */
export default function RankingCritique({ phrase, entries, weights, agent, onApplyWeight }) {
  const [stato, setStato] = useState({ state: 'idle' })
  const [nonce, setNonce] = useState(0)
  const [applicati, setApplicati] = useState([])

  useEffect(() => {
    if (!phrase || !agent.enabled || !agent.baseUrl || !agent.model || entries.length < 2) {
      setStato({ state: 'idle' })
      return
    }

    const controller = new AbortController()
    let vivo = true
    setStato({ state: 'loading' })
    setApplicati([])

    critiqueRanking({ text: phrase, entries, weights, config: agent, signal: controller.signal })
      .then((result) => { if (vivo) setStato({ state: 'ok', ...result }) })
      .catch((error) => { if (vivo) setStato({ state: 'error', message: error.message }) })

    return () => { vivo = false; controller.abort() }
    // Volutamente NON dipende da `weights`: applicare un suggerimento cambia i
    // pesi, e rilanciare la critica a quel punto sarebbe un anello infinito da
    // dieci secondi a giro. Si rilancia a mano, col bottone.
  }, [phrase, agent.enabled, agent.baseUrl, agent.model, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  if (stato.state === 'idle') return null

  return (
    <aside className="critique">
      <p className="critique__title">
        Cosa nota il modello
        <button
          type="button"
          className="critique__again"
          disabled={stato.state === 'loading'}
          onClick={() => setNonce((n) => n + 1)}
        >
          Richiedi di nuovo
        </button>
      </p>

      {stato.state === 'loading' && (
        <p className="thinking" role="status" aria-live="polite">
          <span className="thinking__label">Il modello sta rileggendo la tua frase</span>
          <span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
        </p>
      )}

      {stato.state === 'error' && (
        <p className="critique__note">
          Il modello non ha risposto ({stato.message}). Il ranking qui sotto non cambia: è
          calcolato senza di lui.
        </p>
      )}

      {stato.state === 'ok' && (
        <>
          {stato.suggestions.length === 0 ? (
            <p className="critique__note">
              Niente da ridire: i pesi corrispondono a quello che hai scritto.
            </p>
          ) : (
            <ul className="critique__list">
              {stato.suggestions.map((s) => (
                <li key={s.axis}>
                  <p className="critique__why">{s.why}</p>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={applicati.includes(s.axis)}
                    onClick={() => { onApplyWeight(s.axis, s.to); setApplicati((l) => [...l, s.axis]) }}
                  >
                    {applicati.includes(s.axis)
                      ? `${s.label}: ${s.from} → ${s.to} applicato`
                      : `Porta ${s.label} da ${s.from} a ${s.to}`}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {stato.note && <p className="critique__note">{stato.note}</p>}

          {/* Cosa il sanitizzatore ha buttato via: interessa solo quando si sta
              mettendo a punto il prompt, come la lettura della frase sulla home. */}
          {agent.debug && stato.rejected.length > 0 && (
            <p className="critique__note">Scartati dalla risposta: {stato.rejected.join(' · ')}.</p>
          )}

          <p className="critique__foot">
            Il modello non ha toccato l’ordine: propone solo pesi, e li applichi tu. Il
            punteggio resta calcolato qui, con l’aritmetica visibile nel dettaglio.
          </p>
        </>
      )}
    </aside>
  )
}
