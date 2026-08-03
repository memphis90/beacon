import { useEffect, useMemo, useState } from 'react'
import BottomNav from './BottomNav.jsx'
import InterpreterPicker from './InterpreterPicker.jsx'
import SettingsModal from './SettingsModal.jsx'
import SideRail from './SideRail.jsx'
import { IconEuro, IconGitHub, IconMenu, IconMountain, IconScale, IconWave } from './Icons.jsx'
import { REPO_URL } from '../lib/project.js'
import { parseQuery } from '../lib/parseQuery.js'
import {
  activeProfile, agentIsReady, interpretWithModel, isLocalEndpoint, profileLabel,
} from '../lib/agent.js'
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

export default function Landing({
  destinations, agent, onAgentChange, onApply, onSkip, onLogout,
  phrase = '', favouritesCount = 0, compareCount = 0, hasResults = false,
  onList, onFavourites, onCompare,
}) {
  // Arrivando dai risultati il campo è già pieno: è il centro della dock che
  // ha riportato qui, e il gesto che segue è correggere, non riscrivere.
  const [text, setText] = useState(phrase)
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
  // Il profilo scelto nel menu: il resto della schermata lo nomina, e la
  // chiamata parte da lui.
  const interprete = activeProfile(agent)
  const conModello = agentIsReady(agent)

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
  const submit = async (e) => {
    e?.preventDefault?.()
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
      // Il catalogo va al modello insieme alla frase: senza, decide al buio su
      // campi che escludono — vedi `describeRules`.
      const result = await interpretWithModel(text, {
        config: agent,
        destinations,
        // La lingua la stabiliscono già le regole, che girano a ogni tasto:
        // serve al modello per rispondere nella lingua in cui hai scritto.
        lang: parsed.lang,
        signal: controller.signal,
      })
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
   * L'interprete si sceglie accanto al campo, non più nelle impostazioni. Lo
   * stato però vive in `App`, che lo scrive su disco: tenerne una copia qui
   * significava che il modello scelto nel menu non arrivava ai risultati.
   */
  const applyAgent = (next) => onAgentChange(next)

  /** Una voce di cronologia riempie il campo: puoi ritoccarla prima di rilanciare. */
  const riprendi = (entry) => {
    setRailOpen(false)
    setText(entry.text)
    document.getElementById('landing-q')?.focus()
  }

  return (
    <div className={`landing shell${railOpen ? ' is-railopen' : ''}`}>
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

        {/* Come nei risultati: qui il nome, il faro in cima alla barra
            laterale. La pastiglia della fase sta accanto al faro, non qui. */}
        <div className="landing__brand">Beacon</div>

        {/* Anche qui, non solo nei risultati: è la prima schermata che vede
            chi arriva, ed è dove la domanda "cos'è questa cosa" si pone. */}
        <a
          className="topbar__repo"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          title="Il codice di Beacon su GitHub"
        >
          <IconGitHub width="20" height="20" />
          <span className="topbar__repolabel">Codice</span>
        </a>
      </header>

      {railOpen && (
        <div className="drawer-scrim" onClick={() => setRailOpen(false)} role="presentation" />
      )}

      <SideRail
        open={railOpen}
        onOpen={() => setRailOpen(true)}
        onClose={() => setRailOpen(false)}
        history={history}
        onHistoryChange={setHistory}
        onPickHistory={riprendi}
        // Sulla home "Nuova ricerca" vuol dire svuotare il campo: è lo stesso
        // gesto della voce omonima nei risultati — si riparte dalla frase —
        // e nella stessa posizione della colonna.
        nav={{
          onNewSearch: () => {
            setText('')
            setErroreModello('')
            setRailOpen(false)
            document.getElementById('landing-q')?.focus()
          },
        }}
        agent={agent}
        onOpenSettings={() => { setRailOpen(false); setSettingsOpen(true) }}
        onSkipToFilters={() => { setRailOpen(false); onSkip() }}
        onLogout={onLogout}
      />

      <div className="landing__body">
        <main className="landing__main">
          <div className="landing__hero">
            <h1>Dove andiamo?</h1>
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
                    <strong> {profileLabel(interprete)}</strong>, e quello che capisce può essere
                    diverso.
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
            {conModello
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
            {/* Il modello che sta rispondendo, per nome: con più di uno
                configurato, sapere quale è al lavoro è metà del motivo per cui
                se ne tiene più di uno. L'avvertenza sul primo caricamento vale
                solo in locale — su un endpoint remoto sarebbe una scusa per
                un'attesa che ha altre cause. */}
            <p className="thinkbox__meta">
              {profileLabel(interprete)} · {isLocalEndpoint(interprete?.baseUrl)
                ? 'in locale. La prima chiamata dopo l’avvio deve anche caricare il modello in memoria, e può metterci più di un minuto.'
                : 'endpoint remoto: la frase è uscita da questo computer.'}
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

      <BottomNav
        onlyFavourites={false}
        favouritesCount={favouritesCount}
        compareCount={compareCount}
        hasResults={hasResults}
        askLabel={conModello ? 'Chiedi' : 'Cerca'}
        /* Gli stessi criteri della freccia che sostituisce: col modello serve
           del testo, con le regole serve che le regole ci abbiano capito
           qualcosa. */
        askDisabled={conModello ? !text.trim() : parsed.empty}
        onAsk={submit}
        onList={onList}
        onFavourites={onFavourites}
        onCompare={onCompare}
        onSettings={() => setSettingsOpen(true)}
      />
    </div>
  )
}
