import { useState } from 'react'
import { PRESETS, interpretWithModel } from '../lib/agent.js'

/**
 * Configurazione dell'endpoint: dove gira il modello, quale, con che chiave.
 *
 * *Se* usarlo non si decide qui — quello sta accanto al campo di testo, in
 * `InterpreterPicker`, perché è una scelta che si cambia spesso mentre questa
 * si tocca una volta. Tenerle insieme costringeva ad aprire una modale per
 * ricadere sulle regole dopo un'interpretazione sbagliata.
 */
export default function SettingsModal({ config, onChange, onClose }) {
  const [draft, setDraft] = useState(config)
  const [probe, setProbe] = useState(null)

  const preset = PRESETS.find((p) => p.id === draft.preset) || PRESETS[PRESETS.length - 1]
  const remoto = /^https?:\/\/(?!localhost|127\.)/i.test(draft.baseUrl || '')

  const pickPreset = (id) => {
    const found = PRESETS.find((p) => p.id === id)
    setDraft((d) => ({
      ...d,
      preset: id,
      baseUrl: found && found.baseUrl ? found.baseUrl : d.baseUrl,
      model: found && found.model ? found.model : d.model,
    }))
    setProbe(null)
  }

  const test = async () => {
    setProbe({ state: 'loading' })
    try {
      // Nessun timeout suo: la prova deve concedere quanto la ricerca vera,
      // altrimenti dichiara guasto un endpoint che poi funziona. Un modello
      // locale alla prima chiamata deve anche caricarsi in memoria.
      const result = await interpretWithModel(
        '3 giorni a maggio, budget 400 €, soprattutto cultura',
        { config: draft }
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
   * Svuotare la configurazione spegne anche l'uso del modello: lasciarlo acceso
   * su un endpoint che non c'è più farebbe fallire ogni frase, con la barra che
   * continua ad annunciare un modello.
   */
  const salva = () => {
    const completo = Boolean(draft.baseUrl && draft.model)
    onChange({ ...draft, enabled: draft.enabled && completo })
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
          <h2>Configurazione del modello</h2>
          <button type="button" className="panel__close" onClick={onClose} aria-label="Chiudi">×</button>
        </header>

        <div className="panel__body">
          <div className="section">
            <p className="infotext">
              Dove gira il modello e come raggiungerlo. <strong>Se</strong> usarlo si sceglie
              accanto al campo di testo, nella home: lì si torna alle regole in un clic.
            </p>
            <p className="infotext">
              In entrambi i casi l’interpretazione è mostrata prima di essere applicata, con
              accanto la parola che ha fatto scattare ogni criterio. Punteggio, filtri duri e
              ranking restano calcolati qui: l’interprete traduce la frase, non decide il
              risultato.
            </p>
          </div>

          <div className="section">
            <div className="field">
              <label htmlFor="ag-preset">Dove gira</label>
              <select id="ag-preset" className="control" value={draft.preset} onChange={(e) => pickPreset(e.target.value)}>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <p className="landing__note">{preset.note}</p>
            </div>

            <div className="editor__grid">
              <div className="field">
                <label htmlFor="ag-url">Endpoint (compatibile OpenAI)</label>
                <input
                  id="ag-url" className="control" placeholder="http://localhost:11434/v1"
                  value={draft.baseUrl}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value, preset: 'custom' })}
                />
              </div>

              <div className="field">
                <label htmlFor="ag-model">Modello</label>
                <input
                  id="ag-model" className="control" placeholder="llama3.2"
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ag-key">Chiave API {remoto ? '' : '(non serve in locale)'}</label>
              <input
                id="ag-key" className="control" type="password" autoComplete="off"
                placeholder={remoto ? 'incolla la chiave' : 'lascia vuoto'}
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              />
              <p className="landing__note">
                Resta in <code>localStorage</code> su questa macchina: non c’è un server a cui
                mandarla.
              </p>
            </div>

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
          </div>
        </div>

        <footer className="panel__foot">
          <button type="button" className="btn" onClick={test} disabled={!draft.baseUrl || !draft.model}>
            Prova la connessione
          </button>
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
