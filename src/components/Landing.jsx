import { useEffect, useMemo, useState } from 'react'
import InterpreterPicker from './InterpreterPicker.jsx'
import Logo from './Logo.jsx'
import SettingsModal from './SettingsModal.jsx'
import SideRail from './SideRail.jsx'
import { IconArrowUp, IconEuro, IconMenu, IconMountain, IconScale, IconWave } from './Icons.jsx'
import { parseQuery } from '../lib/parseQuery.js'
import { interpretWithModel, loadAgentConfig, saveAgentConfig } from '../lib/agent.js'
import { addToHistory, loadHistory } from '../lib/history.js'
import { countryName } from '../lib/format.js'

/**
 * La frase mostrata durante l'attesa del modello. **Una per ricerca**, estratta
 * a caso: prende il posto di un "sto caricando" fisso, e resta ferma fino alla
 * risposta. Farne scorrere una serie sembrava avanzamento — un contatore che
 * gira mentre in realtà non è successo niente — e chi legge finisce per
 * inseguire il testo invece di aspettare.
 *
 * Sono scritte, non generate: il modello in quel momento sta rispondendo alla
 * domanda vera, e una seconda chiamata per intrattenere durante la prima
 * raddoppierebbe l'attesa che dovrebbe alleggerire.
 *
 * Vincolo di contenuto: possono essere buffe, non possono mentire. Niente
 * battute su voli, prenotazioni o prezzi in tempo reale — sono esattamente le
 * cose che lo strumento NON fa, e una barra di caricamento che le nomina le
 * promette. I puntini di sospensione non ci vanno: ci pensano i tre punti
 * animati che seguono la frase.
 */
const attese = (catalogo) => [
  'Srotolo la mappa sul tavolo',
  `Metto in fila ${catalogo} destinazioni`,
  'Rileggo la frase per la terza volta',
  'Conto quante volte hai scritto «mare»',
  'Peso otto assi insieme, senza farne cadere nessuno',
  'Cerco il posto giusto, non quello famoso',
  'Chiedo al mappamondo, ma quello gira e basta',
  'Controllo che non sia tutto chiuso',
  'Tolgo la polvere dall’atlante',
  'Discuto con la bussola, rimasta ferma su nord',
  'Cerco di capire se «tranquillo» voleva dire natura o niente vita notturna',
]

const ESEMPI = [
  { Icon: IconWave, text: 'un’isola a settembre con mare balneabile e buon cibo' },
  { Icon: IconScale, text: 'weekend lungo a marzo, cultura e vita notturna, poco turistico' },
  { Icon: IconMountain, text: 'tutto l’anno, montagna e trekking, senza vita notturna' },
  { Icon: IconEuro, text: 'dove vado a giugno con 400 € e voglio il mare' },
]

export default function Landing({ destinations, onApply, onSkip, onLogout }) {
  const [text, setText] = useState('')
  const [agent, setAgent] = useState(loadAgentConfig)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [railOpen, setRailOpen] = useState(false)
  // Il controller della chiamata in corso: serve anche come "sta elaborando",
  // ed è l'unico modo per dare all'utente un Annulla che annulla davvero.
  const [inCorso, setInCorso] = useState(null)
  const [erroreModello, setErroreModello] = useState('')

  const catalogo = useMemo(
    () => destinations.map((d) => ({ name: d.name, countryName: countryName(d.country) })),
    [destinations]
  )

  const parsed = useMemo(() => parseQuery(text, { destinations: catalogo }), [text, catalogo])
  const conModello = Boolean(agent.enabled && agent.baseUrl && agent.model)

  const frasi = useMemo(() => attese(destinations.length), [destinations.length])
  const [frase, setFrase] = useState(0)

  // Estratta all'inizio dell'attesa e poi ferma: due ricerche di fila non
  // devono aprirsi con la stessa battuta, ma dentro la stessa attesa il testo
  // non si muove.
  useEffect(() => {
    if (!inCorso) return
    setFrase(Math.floor(Math.random() * frasi.length))
  }, [inCorso, frasi.length])

  /**
   * La scrittura in cronologia avviene QUI, non dentro l'aggiornatore di stato:
   * `onApply` smonta questo componente nello stesso gesto, e un aggiornamento
   * in coda su un componente che sparisce non viene mai eseguito — la ricerca
   * non finirebbe mai in cronologia.
   */
  const concludi = (patch, source) => {
    setHistory(addToHistory(history, { text, patch, source }))
    onApply(patch, text)
  }

  /**
   * Il modello lavora all'INVIO, non mentre scrivi.
   *
   * Prima girava su un debounce di 700 ms a ogni tasto: con un modello locale
   * da dieci secondi significa una raffica di chiamate buttate via, e
   * un'anteprima che cambia sotto le dita mentre la frase è ancora a metà. Le
   * regole invece restano in tempo reale — sono istantanee e non costano
   * niente, quindi l'anteprima sotto il campo continua a esserci.
   */
  const submit = async (event) => {
    event.preventDefault()
    if (inCorso || !text.trim()) return
    setErroreModello('')

    if (!conModello) {
      if (parsed.empty) return
      concludi(parsed.patch, 'regole')
      return
    }

    const controller = new AbortController()
    setInCorso(controller)
    try {
      const result = await interpretWithModel(text, { config: agent, signal: controller.signal })
      setInCorso(null)
      if (Object.keys(result.patch).length === 0) {
        setErroreModello('Il modello non ha riconosciuto nessun criterio in questa frase.')
        return
      }
      concludi(result.patch, 'modello')
    } catch (error) {
      setInCorso(null)
      // Annullato a mano: l'utente sa già cosa è successo, dirglielo con un
      // avviso rosso sarebbe rimproverarlo per aver premuto Annulla.
      if (controller.signal.aborted) return
      setErroreModello(error.message)
    }
  }

  const annulla = () => { inCorso?.abort(); setInCorso(null) }

  /**
   * L'interprete si sceglie accanto al campo, non più nelle impostazioni: va
   * scritto subito su disco, o cambiarlo e ricaricare la pagina lo perde.
   */
  const applyAgent = (next) => { setAgent(next); saveAgentConfig(next) }

  /** Una voce di cronologia riempie il campo: puoi ritoccarla prima di rilanciare. */
  const riprendi = (entry) => {
    setRailOpen(false)
    setText(entry.text)
    document.getElementById('landing-q')?.focus()
  }

  return (
    <div className="landing">
      <header className="landing__bar">
        <button
          type="button"
          className="landing__menu"
          aria-expanded={railOpen}
          aria-controls="side-rail"
          onClick={() => setRailOpen(true)}
        >
          <IconMenu width="22" height="22" />
          <span className="visually-hidden">Apri cronologia e menu</span>
        </button>

        <div className="landing__brand">
          <Logo size={26} phase phaseClass="landing__phase" />
        </div>
      </header>

      {railOpen && (
        <div className="drawer-scrim" onClick={() => setRailOpen(false)} role="presentation" />
      )}

      <SideRail
        variant="drawer"
        open={railOpen}
        onClose={() => setRailOpen(false)}
        history={history}
        onHistoryChange={setHistory}
        onPickHistory={riprendi}
        agent={agent}
        onOpenSettings={() => { setRailOpen(false); setSettingsOpen(true) }}
        onSkipToFilters={() => { setRailOpen(false); onSkip() }}
        onLogout={onLogout}
      />

      <div className="landing__body">
        <main className="landing__main">
          <div className="landing__hero">
            <h1>Dove andiamo?</h1>
            <p>
              {conModello
                ? 'Descrivi il viaggio a parole: all’invio lo interpreta il modello che hai configurato.'
                : 'Descrivi il viaggio a parole. Oppure salta e regola i filtri a mano.'}
            </p>
          </div>

          <form className="landing__box" onSubmit={submit}>
            <div className="landing__boxinner">
              <label htmlFor="landing-q" className="visually-hidden">Descrivi il viaggio</label>
              <textarea
                id="landing-q"
                autoFocus
                placeholder="Dove vuoi andare? Descrivi il viaggio ideale — es: 5 giorni a ottobre, budget 600 €, soprattutto natura e un po’ di cultura…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }}
              />

              <div className="landing__boxbar">
                <InterpreterPicker
                  agent={agent}
                  onChange={applyAgent}
                  onConfigure={() => setSettingsOpen(true)}
                />

                {/* Freccia sola: l'etichetta la dà il tooltip. Il gesto è
                    quello di qualunque campo prompt, e non ha bisogno di
                    essere spiegato ogni volta che guardi la schermata. */}
                <button
                  type="submit"
                  className="btn btn--primary landing__send"
                  title="Invia prompt"
                  aria-label="Invia prompt"
                  disabled={conModello ? !text.trim() : parsed.empty}
                >
                  <IconArrowUp width="20" height="20" />
                </button>
              </div>
            </div>

            {/* Solo in debug: è la lettura della frase, cioè materiale da messa
                a punto. In uso normale occupava il posto sotto il campo con una
                tabella che nessuno guarda finché tutto funziona. */}
            {agent.debug && parsed.understood.length > 0 && (
              <div className="landing__read">
                <p className="landing__readtitle">
                  {conModello ? 'Intanto le regole leggono così' : 'Ho capito così'}
                  <span className="landing__source landing__source--rules">regole locali</span>
                </p>
                <div className="chips">
                  {parsed.understood.map((u) => (
                    <span className="chip" key={u.key} title={u.note || `dalla parola “${u.from}”`}>
                      <span className="chip__label">{u.label}:</span> <strong>{u.value}</strong>
                      {u.from && <em className="chip__from">“{u.from}”</em>}
                    </span>
                  ))}
                </div>
                {parsed.understood.filter((u) => u.note).map((u) => (
                  <p className="landing__note" key={`n-${u.key}`}>{u.note}</p>
                ))}
                {conModello && (
                  <p className="landing__note">
                    Anteprima delle regole, gratuita e immediata. All’invio decide
                    <strong> {agent.model}</strong>, e quello che capisce può essere diverso.
                  </p>
                )}
              </div>
            )}
          </form>

          {agent.debug && parsed.ignored.length > 0 && (
            <div className="landing__ignored">
              <p className="landing__readtitle">Questo non lo so fare</p>
              <ul>
                {parsed.ignored.map((i) => (
                  <li key={i.from}><strong>“{i.from}”</strong> — {i.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {erroreModello && (
            <div className="notice notice--warn">
              <div>
                <strong>Il modello non ha risposto.</strong> {erroreModello}
                {!parsed.empty && (
                  <>
                    {' '}Le regole invece hanno capito qualcosa: puoi proseguire con quelle.
                    <p style={{ margin: '10px 0 0' }}>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => concludi(parsed.patch, 'regole')}
                      >
                        Continua con le regole
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {text.trim() && parsed.empty && !conModello && (
            <p className="landing__note landing__note--warn">
              Non ho riconosciuto nulla in questa frase. Prova con un mese, una durata, un budget
              o un interesse — oppure salta e usa i filtri.
            </p>
          )}

          <div className="landing__suggest">
            <p className="landing__suggesttitle">Oppure prova con</p>
            <div className="landing__grid">
              {ESEMPI.map(({ Icon, text: esempio }) => (
                <button key={esempio} type="button" onClick={() => setText(esempio)}>
                  <Icon width="20" height="20" />
                  <span>“{esempio}”</span>
                </button>
              ))}
            </div>
          </div>
        </main>

        <footer className="landing__foot">
          <p>
            {agent.enabled
              ? 'Il modello traduce solo la frase in criteri: punteggio, filtri duri e ranking restano calcolati qui.'
              : 'La frase è interpretata da regole scritte, che girano qui e che puoi vedere sbagliare.'}
            {' '}{destinations.length} destinazioni nel catalogo.
          </p>
        </footer>
      </div>

      {/* In primo piano, non in un angolo: finché il modello non risponde non
          c'è niente da fare in questa schermata, e un'attesa da dieci secondi
          nascosta sotto il campo si legge come un clic andato a vuoto. */}
      {inCorso && (
        <div className="overlay overlay--center overlay--veil" role="presentation">
          <div className="thinkbox" role="dialog" aria-modal="true" aria-label="Interpretazione in corso">
            <p className="thinking thinking--lg" role="status" aria-live="polite">
              <span className="thinking__label">{frasi[frase]}</span>
              <span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
            </p>

            <p className="thinkbox__phrase">“{text.trim()}”</p>
            <p className="thinkbox__meta">
              {agent.model} · in locale. La prima chiamata dopo l’avvio deve anche caricare il
              modello in memoria, e può metterci più di un minuto.
            </p>
            <button type="button" className="btn btn--sm" onClick={annulla}>Annulla</button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
