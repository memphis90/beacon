import { useState } from 'react'
import { IconPlus, IconTrash } from './Icons.jsx'
import {
  PRESETS, activeProfile, agentIsReady, interpretWithModel, isBlockedCombination,
  listModels, nextProfileId, normaliseAgentConfig, profileFromPreset, profileIsUsable,
  profileLabel, profileNeedsKey,
} from '../lib/agent.js'

/**
 * I modelli configurati: dove girano, quali, con che chiave.
 *
 * *Quale* usare non si decide qui — quello sta accanto al campo di testo, in
 * `InterpreterPicker`, perché è una scelta che si cambia spesso mentre questa
 * si tocca di rado. Tenerle insieme costringeva ad aprire una modale per
 * ricadere sulle regole dopo un'interpretazione sbagliata.
 *
 * Sono più d'uno perché confrontare due interpreti è il modo normale di
 * sceglierne uno: un modello locale piccolo e uno remoto grosso leggono la
 * stessa frase in modi che si giudicano solo affiancandoli. Con un endpoint
 * solo, il confronto costava riscrivere URL, nome del modello ed eventuale
 * chiave a ogni giro — e infatti non si faceva.
 */
/** Dove si prende la chiave, per i preset che ne vogliono una. */
const chiaviDove = {
  openrouter: 'https://openrouter.ai/keys',
  groq: 'https://console.groq.com/keys',
}

export default function SettingsModal({ config, onChange, onClose }) {
  const [draft, setDraft] = useState(() => normaliseAgentConfig(config))
  // Quale riga si sta modificando. È indipendente da `activeId`: si aggiusta
  // un profilo senza per questo metterlo in uso.
  const [editId, setEditId] = useState(() => activeProfile(config)?.id ?? null)
  const [probe, setProbe] = useState(null)
  // L'elenco dei modelli è per profilo e non si porta dietro il cambio di
  // riga: quelli di un endpoint non sono quelli di un altro.
  const [modelli, setModelli] = useState([])
  const [elencoStato, setElencoStato] = useState(null)

  const profilo = draft.profiles.find((p) => p.id === editId) || draft.profiles[0] || null
  const preset = PRESETS.find((p) => p.id === profilo?.preset) || PRESETS[PRESETS.length - 1]
  const remoto = /^https?:\/\/(?!localhost|127\.)/i.test(profilo?.baseUrl || '')

  /** Modifica solo il profilo aperto: gli altri restano intatti. */
  const patch = (campi) => {
    setDraft((d) => ({
      ...d,
      profiles: d.profiles.map((p) => (p.id === profilo.id ? { ...p, ...campi } : p)),
    }))
    setProbe(null)
  }

  const pickPreset = (id) => {
    const found = PRESETS.find((p) => p.id === id)
    patch({
      preset: id,
      baseUrl: found && found.baseUrl ? found.baseUrl : profilo.baseUrl,
      model: found && found.model ? found.model : profilo.model,
    })
  }

  /**
   * Il profilo nuovo nasce vuoto, non copiato dal preset di default: chi
   * aggiunge un secondo modello sta quasi sempre puntando altrove, e trovare
   * Ollama già scritto vorrebbe dire cancellarlo prima di scrivere il proprio.
   */
  const aggiungi = () => {
    const nuovo = profileFromPreset(
      PRESETS[PRESETS.length - 1],
      nextProfileId(draft.profiles)
    )
    setDraft((d) => ({ ...d, profiles: [...d.profiles, nuovo] }))
    setEditId(nuovo.id)
    setProbe(null)
  }

  /**
   * Togliere il profilo in uso spegne anche il modello: lasciarlo acceso su
   * qualcos'altro sceglierebbe al posto di chi legge quale interprete usare.
   */
  const rimuovi = (id) => {
    setDraft((d) => {
      const profiles = d.profiles.filter((p) => p.id !== id)
      const eraAttivo = d.activeId === id
      return {
        ...d,
        profiles,
        activeId: eraAttivo ? (profiles[0]?.id ?? null) : d.activeId,
        enabled: eraAttivo ? false : d.enabled && profiles.length > 0,
      }
    })
    if (editId === id) setEditId(null)
    setProbe(null)
  }

  /** Scorciatoia: mette in uso la riga aperta senza passare dal menu. */
  const usaQuesto = () => {
    setDraft((d) => ({ ...d, activeId: profilo.id, enabled: true }))
  }

  const caricaModelli = async () => {
    setElencoStato('loading')
    try {
      const ids = await listModels(profilo)
      setModelli(ids)
      setElencoStato(null)
    } catch (error) {
      setModelli([])
      setElencoStato(error.message)
    }
  }

  const test = async () => {
    setProbe({ state: 'loading' })
    try {
      // Nessun timeout suo: la prova deve concedere quanto la ricerca vera,
      // altrimenti dichiara guasto un endpoint che poi funziona. Un modello
      // locale alla prima chiamata deve anche caricarsi in memoria.
      // Senza catalogo di proposito: qui si prova che l'endpoint risponde e che
      // il JSON è valido, non la qualità dell'interpretazione — e il prompt
      // corto è anche il più veloce, che su un modello locale conta.
      const result = await interpretWithModel(
        '3 giorni a maggio, budget 400 €, soprattutto cultura',
        { config: profilo }
      )
      setProbe({
        state: 'ok',
        text: `Risposta valida: ${Object.keys(result.patch).length} criteri riconosciuti${
          result.rejected.length ? `, ${result.rejected.length} scartati` : ''
        }.`,
      })
    } catch (error) {
      setProbe({ state: 'error', text: error.message })
    }
  }

  /**
   * Svuotare la configurazione del profilo in uso spegne anche il modello:
   * lasciarlo acceso su un endpoint che non c'è più farebbe fallire ogni
   * frase, con la barra che continua ad annunciare un modello.
   */
  const salva = () => {
    const normalizzata = normaliseAgentConfig(draft)
    onChange({ ...normalizzata, enabled: agentIsReady(normalizzata) })
    onClose()
  }

  return (
    <div className="overlay overlay--center" onClick={onClose} role="presentation">
      <section
        className="panel panel--info"
        role="dialog"
        aria-modal="true"
        aria-label="Impostazioni"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel__head">
          <h2>Modelli configurati</h2>
          <button type="button" className="panel__close" onClick={onClose} aria-label="Chiudi">×</button>
        </header>

        <div className="panel__body">
          <div className="section">
            <p className="infotext">
              Dove girano i modelli e come raggiungerli. Puoi tenerne più d’uno — per esempio
              uno locale e uno remoto — e <strong>quale usare</strong> si sceglie accanto al
              campo di testo, nella home: lì si passa da uno all’altro, o si torna alle regole,
              in un clic.
            </p>
            <p className="infotext">
              In tutti i casi l’interpretazione è mostrata prima di essere applicata, con
              accanto la parola che ha fatto scattare ogni criterio. Punteggio, filtri duri e
              ranking restano calcolati qui: l’interprete traduce la frase, non decide il
              risultato.
            </p>
          </div>

          <div className="section">
            <div className="models__head">
              <span className="models__title">
                {draft.profiles.length === 0
                  ? 'Nessun modello'
                  : `${draft.profiles.length} ${draft.profiles.length === 1 ? 'modello' : 'modelli'}`}
              </span>
              <button type="button" className="btn btn--sm" onClick={aggiungi}>
                <IconPlus width="14" height="14" />
                Aggiungi
              </button>
            </div>

            {draft.profiles.length === 0 ? (
              <p className="hside__empty">
                Senza modelli l’app usa le regole locali, che coprono mesi, durate, budget e
                interessi. Aggiungine uno per le frasi che le regole non capiscono.
              </p>
            ) : (
              <ul className="models">
                {draft.profiles.map((p) => (
                  <li
                    key={p.id}
                    className={`models__row${p.id === profilo?.id ? ' models__row--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="models__pick"
                      aria-pressed={p.id === profilo?.id}
                      onClick={() => { setEditId(p.id); setProbe(null); setModelli([]); setElencoStato(null) }}
                    >
                      <strong>{profileLabel(p)}</strong>
                      <small>
                        {profileIsUsable(p) ? p.baseUrl : 'endpoint o modello mancante'}
                      </small>
                    </button>
                    {draft.enabled && p.id === draft.activeId && (
                      <span className="models__badge">in uso</span>
                    )}
                    <button
                      type="button"
                      className="models__del"
                      onClick={() => rimuovi(p.id)}
                      aria-label={`Rimuovi ${profileLabel(p)}`}
                      title="Rimuovi"
                    >
                      <IconTrash width="15" height="15" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {profilo && (
            <div className="section">
              <div className="field">
                <label htmlFor="ag-label">Nome</label>
                <input
                  id="ag-label" className="control" placeholder={profilo.model || 'come chiamarlo nel menu'}
                  value={profilo.label}
                  onChange={(e) => patch({ label: e.target.value })}
                />
                <p className="landing__note">
                  Facoltativo: senza, nel menu compare il nome del modello.
                </p>
              </div>

              <div className="field">
                <label htmlFor="ag-preset">Dove gira</label>
                <select id="ag-preset" className="control" value={profilo.preset} onChange={(e) => pickPreset(e.target.value)}>
                  {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <p className="landing__note">{preset.note}</p>
              </div>

              <div className="editor__grid">
                <div className="field">
                  <label htmlFor="ag-url">Endpoint (compatibile OpenAI)</label>
                  <input
                    id="ag-url" className="control" placeholder="http://localhost:11434/v1"
                    value={profilo.baseUrl}
                    onChange={(e) => patch({ baseUrl: e.target.value, preset: 'custom' })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="ag-model">Modello</label>
                  {/* Il datalist si riempie con l'elenco chiesto all'endpoint:
                      i nomi dei modelli invecchiano, e un preset che punta a
                      uno ritirato fallisce con un 404 che sembra colpa
                      dell'app. Resta un campo di testo, così un endpoint che
                      non espone /models non toglie niente. */}
                  <input
                    id="ag-model" className="control" placeholder="llama3.2"
                    list={modelli.length ? 'ag-modelli' : undefined}
                    value={profilo.model}
                    onChange={(e) => patch({ model: e.target.value })}
                  />
                  {modelli.length > 0 && (
                    <datalist id="ag-modelli">
                      {modelli.map((m) => <option key={m} value={m} />)}
                    </datalist>
                  )}
                  <p className="landing__note">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={!profilo.baseUrl || elencoStato === 'loading'}
                      onClick={caricaModelli}
                    >
                      {elencoStato === 'loading' ? 'Chiedo l’elenco…' : 'Quali modelli ha?'}
                    </button>
                    {modelli.length > 0 && ` ${modelli.length} disponibili: scrivi per filtrare.`}
                    {elencoStato && elencoStato !== 'loading' && ` ${elencoStato}`}
                  </p>
                </div>
              </div>

              <div className="field">
                <label htmlFor="ag-key">Chiave API {remoto ? '' : '(non serve in locale)'}</label>
                <input
                  id="ag-key" className="control" type="password" autoComplete="off"
                  placeholder={remoto ? 'incolla la chiave' : 'lascia vuoto'}
                  value={profilo.apiKey}
                  onChange={(e) => patch({ apiKey: e.target.value })}
                />
                <p className="landing__note">
                  Resta in <code>localStorage</code> su questa macchina: non c’è un server a cui
                  mandarla. {chiaviDove[profilo.preset] && (
                    <>
                      La ottieni da{' '}
                      <a href={chiaviDove[profilo.preset]} target="_blank" rel="noreferrer noopener">
                        {new URL(chiaviDove[profilo.preset]).host}
                      </a>, gratis.
                    </>
                  )}
                </p>
                {/* Perché la chiave la devi mettere tu, e non è pigrizia di
                    chi ha scritto l'app: una chiave dentro il client è una
                    chiave regalata — il codice della pagina è pubblico e si
                    legge in dieci secondi. */}
                {profileNeedsKey(profilo) && (
                  <p className="landing__note landing__note--warn">
                    <strong>Senza chiave questo endpoint rifiuta ogni richiesta.</strong> Serve la
                    tua, non ce n’è una condivisa: il codice di questa pagina è pubblico, e una
                    chiave scritta dentro sarebbe leggibile da chiunque — con la quota di chi
                    l’ha messa.
                  </p>
                )}
              </div>

              {/* Detto PRIMA di provare, non dopo: questa combinazione non
                  fallisce a volte, fallisce sempre, e scoprirlo dall'errore
                  fa sospettare la propria configurazione invece della causa
                  vera. */}
              {isBlockedCombination(profilo.baseUrl) && (
                <div className="notice notice--warn">
                  <div>
                    <strong>Da qui non funzionerà.</strong> Questa pagina arriva da un sito, e
                    l’endpoint che hai scritto è sul tuo computer: il browser non lascia che un
                    sito raggiunga un servizio locale, ed è una difesa che non si disattiva dal
                    lato del sito.
                    <p style={{ margin: '8px 0 0' }}>
                      Le strade sono due: usare l’app <strong>in locale</strong> — clonare il
                      repo e <code>npm run dev</code>, così pagina e modello stanno sulla stessa
                      macchina — oppure configurare qui un <strong>endpoint remoto</strong>,
                      accettando che la frase esca da questo computer.
                    </p>
                  </div>
                </div>
              )}

              {remoto && (
                <div className="notice notice--warn">
                  <div>
                    <strong>Endpoint remoto.</strong> La frase che scrivi esce da questo computer e
                    arriva al fornitore del modello. Con Ollama o LM Studio non succede.
                  </div>
                </div>
              )}

              {probe && (
                <div className={`notice${probe.state === 'error' ? ' notice--warn' : ''}`}>
                  <div>{probe.state === 'loading' ? 'Provo una frase di esempio…' : probe.text}</div>
                </div>
              )}

              <div className="models__actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={test}
                  disabled={!profileIsUsable(profilo) || profileNeedsKey(profilo)}
                  title={profileNeedsKey(profilo) ? 'Manca la chiave API' : undefined}
                >
                  Prova la connessione
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={usaQuesto}
                  disabled={!profileIsUsable(profilo) || (draft.enabled && draft.activeId === profilo.id)}
                >
                  {draft.enabled && draft.activeId === profilo.id ? 'Già in uso' : 'Usa questo'}
                </button>
              </div>
            </div>
          )}

          <div className="section">
            <div className="checkline">
              <input
                id="ag-debug"
                type="checkbox"
                checked={Boolean(draft.debug)}
                onChange={(e) => setDraft({ ...draft, debug: e.target.checked })}
              />
              <label htmlFor="ag-debug">Debug: mostra come viene interpretata la frase</label>
            </div>
            <p className="landing__note">
              Sotto il campo compaiono i criteri riconosciuti, ognuno con la parola da cui è
              stato dedotto. Serve a capire perché una ricerca ha dato quel risultato: se una
              destinazione non c'è, di solito è qui che si vede il motivo.
            </p>
          </div>
        </div>

        <footer className="panel__foot">
          <button type="button" className="btn btn--primary" onClick={salva}>
            Salva
          </button>
          <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Annulla
          </button>
        </footer>
      </section>
    </div>
  )
}
