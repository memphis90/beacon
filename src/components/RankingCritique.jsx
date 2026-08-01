import { useEffect, useRef, useState } from 'react'
import { IconSparkle } from './Icons.jsx'
import { activeProfile, agentIsReady, critiqueRanking } from '../lib/agent.js'

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
 *
 * Sta in un pulsante in basso a destra, non più in un riquadro sopra le card.
 * Il riquadro occupava il posto migliore della pagina — quello dove si guarda
 * per primo — con un contenuto che arriva dieci secondi dopo e che spesso è
 * "niente da ridire": i risultati scendevano sotto la piega per fare spazio a
 * un'attesa. Da qui il commento resta raggiungibile in un clic e il pallino
 * dice quando c'è qualcosa da leggere, senza spostare niente.
 */
export default function RankingCritique({ phrase, entries, weights, agent, onApplyWeight }) {
  const [stato, setStato] = useState({ state: 'idle' })
  const [nonce, setNonce] = useState(0)
  const [applicati, setApplicati] = useState([])
  const [aperto, setAperto] = useState(false)
  const ref = useRef(null)

  const interprete = activeProfile(agent)
  const pronto = agentIsReady(agent)

  useEffect(() => {
    if (!phrase || !pronto || entries.length < 2) {
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
    //
    // Dipende invece dall'endpoint e dal modello del profilo attivo, non dal
    // suo id: cambiare interprete deve rifare la critica, ma rinominare un
    // profilo no — è la stessa risposta, con un'etichetta diversa.
  }, [phrase, pronto, interprete?.baseUrl, interprete?.model, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // Una nuova frase riparte a pannello chiuso: aprirlo da solo sopra i
  // risultati rifarebbe, in peggio, quello che faceva il riquadro.
  useEffect(() => { setAperto(false) }, [phrase])

  // Si chiude con Esc o cliccando fuori, come il menu dell'interprete.
  useEffect(() => {
    if (!aperto) return
    const viaClic = (e) => { if (!ref.current?.contains(e.target)) setAperto(false) }
    const viaTasto = (e) => { if (e.key === 'Escape') setAperto(false) }
    document.addEventListener('mousedown', viaClic)
    document.addEventListener('keydown', viaTasto)
    return () => {
      document.removeEventListener('mousedown', viaClic)
      document.removeEventListener('keydown', viaTasto)
    }
  }, [aperto])

  if (stato.state === 'idle') return null

  // Quanti consigli restano da applicare: è il solo numero che vale la pena
  // mostrare chiusi. Zero suggerimenti non merita un pallino — è una risposta
  // valida, ma non è una cosa da fare.
  const daLeggere = stato.state === 'ok'
    ? stato.suggestions.filter((s) => !applicati.includes(s.axis)).length
    : 0

  return (
    <div className="critique" ref={ref}>
      {aperto && (
        <section className="critique__panel" role="dialog" aria-label="Cosa nota il modello">
          <header className="critique__head">
            <span className="critique__title">Cosa nota il modello</span>
            <button
              type="button"
              className="critique__again"
              disabled={stato.state === 'loading'}
              onClick={() => setNonce((n) => n + 1)}
            >
              Richiedi di nuovo
            </button>
            <button
              type="button"
              className="panel__close"
              onClick={() => setAperto(false)}
              aria-label="Chiudi"
            >
              ×
            </button>
          </header>

          <div className="critique__body">
            {stato.state === 'loading' && (
              <p className="thinking" role="status" aria-live="polite">
                <span className="thinking__label">Il modello sta rileggendo la tua frase</span>
                <span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
              </p>
            )}

            {stato.state === 'error' && (
              <p className="critique__note">
                Il modello non ha risposto ({stato.message}). Il ranking non cambia: è
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
          </div>
        </section>
      )}

      <button
        type="button"
        className={`critique__fab${stato.state === 'loading' ? ' critique__fab--busy' : ''}`}
        aria-expanded={aperto}
        aria-haspopup="dialog"
        onClick={() => setAperto((v) => !v)}
        title={stato.state === 'loading' ? 'Il modello sta rileggendo la tua frase' : 'Cosa nota il modello'}
      >
        <IconSparkle width="22" height="22" />
        <span className="visually-hidden">
          {daLeggere > 0 ? `Cosa nota il modello: ${daLeggere} consigli` : 'Cosa nota il modello'}
        </span>
        {daLeggere > 0 && !aperto && <span className="critique__badge">{daLeggere}</span>}
      </button>
    </div>
  )
}
