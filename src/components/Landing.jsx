import { useEffect, useMemo, useState } from 'react'
import BottomNav from './BottomNav.jsx'
import EditorPanel, { ParametersPage } from './EditorPanel.jsx'
import InterpreterPicker from './InterpreterPicker.jsx'
import { LogoMark } from './Logo.jsx'
import PanelTabs from './PanelTabs.jsx'
import SettingsModal from './SettingsModal.jsx'
import SideRail from './SideRail.jsx'
import {
  IconArrowUp, IconEuro, IconGitHub, IconMenu, IconMountain, IconScale, IconWave,
} from './Icons.jsx'
import { REPO_URL } from '../lib/project.js'
import { parseQuery } from '../lib/parseQuery.js'
import {
  activeProfile, agentIsReady, interpretWithModel, isLocalEndpoint, profileLabel,
} from '../lib/agent.js'
import { addToHistory, clearHistory, loadHistory, removeFromHistory, timeAgo } from '../lib/history.js'
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

/**
 * `panelInitially` è un appiglio per le prove, non una funzionalità — lo stesso
 * ruolo che `startedInitially` ha in `App`.
 *
 * I pannelli di questa schermata si aprono solo premendo qualcosa, e il render
 * statico non preme niente: senza questo, il ramo che monta le impostazioni è
 * irraggiungibile da una prova, ed è proprio il ramo in cui è già passata una
 * regressione desktop (il menu laterale che apriva il pannello a schede).
 * Vale `'impostazioni'` per il pannello del menu, `'parametri'` o `'modello'`
 * per le due schede della dock.
 */
export default function Landing({
  destinations, agent, onAgentChange, onApply, onSkip, onLogout,
  phrase = '', onlyFavourites = false, favouritesCount = 0, compareCount = 0,
  hasResults = false,
  onList, onFavourites, onCompare,
  overrides = {}, onOverridesChange = () => {},
  panelInitially = null,
}) {
  // Arrivando dai risultati il campo è già pieno: è il centro della dock che
  // ha riportato qui, e il gesto che segue è correggere, non riscrivere.
  const [text, setText] = useState(phrase)
  /* Il pannello Impostazioni del menu laterale, che esiste a ogni larghezza.
     È tenuto separato da `mobilePanel` di proposito: quello monta la striscia
     delle schede, che sopra i 901px non è mai esistita. */
  const [settingsOpen, setSettingsOpen] = useState(panelInitially === 'impostazioni')
  /* Quale scheda del pannello è aperta: 'parametri' | 'modello' | null.
     Come in App: lo apre solo la dock, che sopra i 901px è `display: none`.
     Riservato a lei, quindi: da qualunque altra strada le schede non compaiono. */
  const [mobilePanel, setMobilePanel] = useState(
    panelInitially === 'parametri' || panelInitially === 'modello' ? panelInitially : null
  )
  // La scheda di una singola destinazione, sopra l'elenco dei parametri: come
  // in App, scegliere una voce dall'elenco apre questa, indipendente dalla
  // scheda del pannello mobile che resta 'parametri' sotto.
  const [editor, setEditor] = useState(null)
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

  /**
   * Cambiare scheda chiude anche la scheda di una destinazione.
   *
   * Senza `setEditor(null)` l'editor resta aperto sotto il Modello, che lo
   * copre: chiudendo il Modello riaffiora sopra la home, come se lo avesse
   * riaperto la scheda che si è appena chiusa.
   */
  const cambiaScheda = (scheda) => { setEditor(null); setMobilePanel(scheda) }

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

        {/* Sopra i 901px, il nome: il faro sta in cima alla barra laterale,
            che lì è la colonna permanente e resta raggiungibile.
            Sotto i 901px il cassetto non c'è più (vedi app.css), e con lui
            sparisce l'unico modo di raggiungere quel faro: il marchio prende
            il posto della scritta, non le sta accanto. I due, testo e
            marchio, sono sempre nel markup — la CSS sceglie quale mostrare,
            come per `.landing__recent`/gli esempi qui sotto.
            `beams={false}`, come il faro della barra laterale (`SideRail.jsx`)
            alla stessa dimensione: sotto una certa taglia i due fasci non si
            leggono come luce, si leggono come sporco (vedi `Logo.jsx`). */}
        <div className="landing__brand">
          <span className="landing__brandtext">Beacon</span>
          <LogoMark className="landing__brandmark" width="26" height="26" beams={false} />
        </div>

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
        /* Il pannello Impostazioni SENZA schede, di proposito: questa voce è
           raggiungibile anche sopra i 901px, dove la barra laterale è la
           colonna permanente e non un cassetto. Aprendo di qui il pannello a
           schede, il desktop si troverebbe una striscia che non ha mai avuto e
           una scheda «Parametri» che lì è una pagina in flusso, non un
           overlay. Chi volesse «uniformare» le due strade riaprirebbe proprio
           quella regressione. */
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
                {/* Il selettore sta accanto al campo a OGNI larghezza, quindi
                    anche il suo «configura» apre il pannello senza schede: le
                    schede sono roba della dock, che sopra i 901px non c'è. */}
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

          {/* Le frasi d'esempio sono il caso vuoto, non un blocco fisso: chi ha
              già cercato non ha bisogno di uno spunto, ha le sue frasi vere.
              Sotto i 900px questo è l'unica strada rimasta per ritoccarne
              una — il menu laterale lì è un cassetto, non una colonna — ma lo
              scambio non guarda la larghezza: sopra i 901px la cronologia
              resta com'era, nella colonna permanente, e qui semplicemente non
              compare (vedi `.landing__recent` in app.css, spenta di default e
              riaccesa solo dentro `@media (max-width: 900px)`). */}
          {history.length === 0 ? (
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
          ) : (
            <div className="landing__recent">
              <p className="landing__suggesttitle">Le tue ricerche recenti</p>
              <ul className="landing__recentlist">
                {history.map((entry) => (
                  <li key={entry.id}>
                    {/* `riprendi` è la stessa funzione del menu laterale: riempie
                        il campo e lascia ritoccare, non rilancia da sola. */}
                    <button
                      type="button"
                      className="landing__recentitem"
                      onClick={() => riprendi(entry)}
                    >
                      <span className="landing__recenttext">{entry.text}</span>
                      <span className="landing__recentmeta">{timeAgo(entry.at)}</span>
                    </button>
                    {/* Bersaglio suo, accanto al bottone che riprende la
                        ricerca — non dentro: annidare i due vorrebbe dire che
                        un tocco impreciso cancella invece di riprendere, o il
                        contrario. Stessa funzione di `SideRail`, non
                        riscritta: lo stato risultante si tratta allo stesso
                        modo, `setHistory` invece di `onHistoryChange`. */}
                    <button
                      type="button"
                      className="landing__recentremove"
                      onClick={() => setHistory(removeFromHistory(history, entry.id))}
                      aria-label={`Rimuovi "${entry.text}" dalla cronologia`}
                    >
                      ×
                    </button>
                  </li>
                ))}
                <li>
                  {/* In coda alla lista, come un'altra voce: non un pulsante
                      separato fuori dall'elenco. Nessuna conferma: cancella
                      solo la cronologia — non i criteri, non i preferiti, non
                      le modifiche dell'editor — ed è la stessa azione che
                      `SideRail` fa già senza chiederla. Chi la vuole più
                      cauta ha comunque l'azzeramento totale, che la conferma
                      ce l'ha. */}
                  <button
                    type="button"
                    className="landing__recentclear"
                    onClick={() => setHistory(clearHistory())}
                  >
                    Svuota la cronologia
                  </button>
                </li>
              </ul>
            </div>
          )}
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
          nascosta sotto il campo si legge come un clic andato a vuoto.
          Il riquadro bianco è sparito: il faro acceso dice già tutto quello
          che una scatola diceva col bordo. */}
      {inCorso && (
        <div className="overlay overlay--center overlay--veil" role="presentation">
          <div className="attesa__box" role="dialog" aria-modal="true" aria-label="Interpretazione in corso">
            <LogoMark className="attesa__faro" width="72" height="72" />

            <p className="thinking thinking--lg" role="status" aria-live="polite">
              <span className="thinking__label">{frasi[frase]}</span>
              <span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
            </p>

            {/* Quale modello sta rispondendo, e perché in locale può metterci
                molto. Senza questa riga novanta secondi non sono lunghi:
                sembrano rotti. La frase dell'utente invece è sparita —
                l'ha scritta due secondi fa. */}
            <p className="attesa__meta">
              {profileLabel(interprete)} · {isLocalEndpoint(interprete?.baseUrl)
                ? 'in locale. La prima chiamata dopo l’avvio deve anche caricare il modello in memoria, e può metterci più di un minuto.'
                : 'endpoint remoto: la frase è uscita da questo computer.'}
            </p>

            <button type="button" className="btn btn--sm" onClick={annulla}>Annulla</button>
          </div>
        </div>
      )}

      {mobilePanel === 'parametri' && (
        <ParametersPage
          merged={destinations}
          overrides={overrides}
          onOverridesChange={onOverridesChange}
          onPick={(id) => setEditor({ id })}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="parametri" onPick={cambiaScheda} />}
          overlay
        />
      )}

      {/* La scheda della singola destinazione, sopra l'elenco: stesso
          meccanismo di App, qui locale perché la home non ha altrove uno
          stato che apra l'editor di una destinazione. */}
      {editor && (
        <EditorPanel
          merged={destinations}
          overrides={overrides}
          onOverridesChange={onOverridesChange}
          initialId={editor.id}
          onClose={() => setEditor(null)}
        />
      )}

      {mobilePanel === 'modello' && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="modello" onPick={cambiaScheda} />}
          onReset={onLogout}
        />
      )}

      {/* Lo stesso pannello, senza schede: qui ci arrivano il menu laterale e
          il «configura» del selettore, due strade che esistono anche su
          desktop. Vedi il commento su `onOpenSettings`. Niente `onReset` per
          lo stesso motivo: sopra i 901px questo È il pannello, non una sua
          variante mobile, e l'azzeramento lì non c'è mai stato. */}
      {settingsOpen && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <BottomNav
        onlyFavourites={onlyFavourites}
        favouritesCount={favouritesCount}
        compareCount={compareCount}
        hasResults={hasResults}
        /* Svuota il campo e ci riporta il cursore: è lo stesso gesto della
           voce «Nuova ricerca» del menu laterale, ora a portata di pollice. */
        onNew={() => {
          setText('')
          setErroreModello('')
          document.getElementById('landing-q')?.focus()
        }}
        /* Niente da azzerare: campo vuoto e nessun ranking alle spalle. */
        newDisabled={!text.trim() && !hasResults}
        /* «Elenco» qui è sempre acceso (vedi BottomNav), ma senza un ranking
           `onList` porterebbe a risultati che non esistono ancora: quando
           `hasResults` è falso il percorso giusto è `onSkip`, lo stesso
           "sfoglia tutto senza frase" della barra laterale. Con un ranking
           già in piedi resta `onList`, che ci torna dentro. */
        onList={hasResults ? onList : onSkip}
        onFavourites={onFavourites}
        onCompare={onCompare}
        onSettings={() => setMobilePanel('parametri')}
      />
    </div>
  )
}
