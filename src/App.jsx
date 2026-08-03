import { useEffect, useMemo, useState } from 'react'
import ActiveFilters from './components/ActiveFilters.jsx'
import BottomNav from './components/BottomNav.jsx'
import ComparePanel from './components/ComparePanel.jsx'
import MobileTools from './components/MobileTools.jsx'
import DestinationCard from './components/DestinationCard.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import EditorPanel, { ParametersPage } from './components/EditorPanel.jsx'
import FilterPanel from './components/FilterPanel.jsx'
import Landing from './components/Landing.jsx'
import PanelTabs from './components/PanelTabs.jsx'
import RankingCritique from './components/RankingCritique.jsx'
import ResultsHeader from './components/ResultsHeader.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import SideRail from './components/SideRail.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import Toasts from './components/Toasts.jsx'
import { IconEdit, IconGitHub, IconHeart, IconMenu, IconScale } from './components/Icons.jsx'
import { REPO_URL } from './lib/project.js'
import { emptyWeights } from './lib/axes.js'
import { axesFromThemes } from './lib/themes.js'
import { rankDestinations, scoreDestination, tripCost, costRange } from './lib/scoring.js'
import { loadAgentConfig, saveAgentConfig } from './lib/agent.js'
import { loadHistory } from './lib/history.js'
import { useDismiss } from './lib/useDismiss.js'
import { useToasts } from './lib/useToasts.js'
import {
  countOverriddenDestinations,
  loadOverrides,
  mergedDestinations,
  saveOverrides,
} from './lib/store.js'

/* Quante card per volta. Ventiquattro riempiono due o tre schermate su
   desktop: abbastanza da non sembrare un elenco troncato, poche abbastanza da
   non chiedere al browser centocinquantanove immagini remote in un colpo. */
const PAGINA = 24

const CRITERIA_KEY = 'destination-finder:criteria:v1'
const FAVOURITES_KEY = 'destination-finder:favourites:v1'
const MAX_COMPARE = 4

// Residuo delle versioni in cui la schermata d'ingresso, una volta superata,
// non tornava più: oggi nessuno lo legge, e lasciarlo nello storage farebbe
// credere che serva ancora a qualcosa.
try { localStorage.removeItem('destination-finder:started:v1') } catch { /* niente da fare */ }

function baseCriteria() {
  return {
    query: '',
    month: new Date().getMonth() + 1,
    nights: 5,
    // Le date, quando ci sono, sono il modo in cui mese e notti sono stati
    // compilati: servono a ricostruire il campo, non al calcolo.
    dateFrom: null,
    dateTo: null,
    weights: emptyWeights(5),
    budgetMax: null,
    seaTempMin: 21,
    // Requisito esplicito, spento di default: reimpostare i criteri deve
    // riportare a uno stato in cui NON è escluso niente.
    seaRequired: false,
    allowedTypes: ['city', 'area', 'island'],
    // I veti espressi nella frase ("ma non in Sardegna"). Vuoti di default:
    // azzerare i criteri deve ridare tutto il catalogo.
    excluded: [],
    // L'asse che comanda la ricerca, quando la frase ne dichiara uno. Null di
    // default: senza gerarchia esplicita nessun asse deve escludere gli altri.
    primary: null,
    // I temi non sono un filtro: nessuna destinazione viene esclusa perché non
    // è gotica. Sono un bonus sul punteggio, e partono vuoti perché una
    // ricerca senza tema non deve favorire nessuno.
    themes: [],
    sortBy: 'score',
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/**
 * `startedInitially` è un appiglio per le prove, non una funzionalità.
 *
 * La schermata dei risultati sta dietro `started`, che parte sempre da false e
 * si supera solo scrivendo una frase: da un render statico è irraggiungibile, e
 * infatti un riferimento penzolante in quel ramo — una prop rimasta a puntare a
 * uno stato cancellato — è arrivato fino al browser con i test verdi. Con
 * questo, `test/render.test.js` disegna anche l'altra metà dell'app.
 */
export default function App({ startedInitially = false }) {
  const defaults = useMemo(baseCriteria, [])
  const [criteria, setCriteria] = useState(() => ({ ...baseCriteria(), ...readJson(CRITERIA_KEY, {}) }))
  const [overrides, setOverrides] = useState(loadOverrides)
  const [favourites, setFavourites] = useState(() => readJson(FAVOURITES_KEY, []))
  const [onlyFavourites, setOnlyFavourites] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  // Due stati distinti perché sono due cose distinte: la pagina dei parametri
  // si consulta — resta lì, non interrompe niente — e la scheda di una singola
  // destinazione si apre, si cambia e si chiude. Una modale sull'elenco diceva
  // "fai in fretta e torna indietro" a un'attività che è il lavoro principale.
  // Quante se ne stanno mostrando. Torna al tetto a ogni cambio di criteri o
  // di filtro preferiti: dopo una ricerca nuova, restare a novanta card
  // aperte è la coda della ricerca precedente.
  const [mostrate, setMostrate] = useState(PAGINA)
  const [parametri, setParametri] = useState(false)
  const [editor, setEditor] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /* Quale scheda del pannello mobile è aperta: 'parametri' | 'modello' | null.
     Su desktop resta sempre null — la dock che lo apre non esiste. */
  const [mobilePanel, setMobilePanel] = useState(null)
  const [agent, setAgent] = useState(loadAgentConfig)
  const [history, setHistory] = useState(loadHistory)
  /**
   * La frase che ha prodotto QUESTI criteri, e nessun'altra.
   *
   * Serve alla critica del modello, che confronta le parole scritte con i pesi
   * effettivi. Prima veniva inizializzata dall'ultima voce di cronologia, e
   * questo produceva un difetto sottile: chi entrava scavalcando la frase — per
   * sfogliare tutte le destinazioni — si trovava una critica che ragionava su
   * una ricerca vecchia, fatta magari il giorno prima e senza rapporto con
   * quello che aveva sotto gli occhi. Il modello non stava sbagliando: gli
   * veniva data la domanda sbagliata.
   *
   * Ora resta vuota finché una frase non c'è davvero, e senza frase la critica
   * non parte affatto — che è la risposta corretta a "non hai chiesto niente".
   */
  const [phrase, setPhrase] = useState('')
  /**
   * Ricaricare la pagina riporta alla home, cioè al campo della frase.
   *
   * Prima questo flag stava in `localStorage` e chi aveva già cercato una volta
   * si ritrovava per sempre nei risultati: un ricaricamento significa quasi
   * sempre "ricomincio", e riaprire una classifica calcolata da criteri decisi
   * chissà quando è disorientante — soprattutto perché la frase che l'aveva
   * prodotta non è più sotto gli occhi. I criteri restano salvati: da qui si
   * riscrive una frase, oppure si va ai filtri dal drawer e ci si ritrova
   * esattamente la ricerca di prima.
   */
  const [started, setStarted] = useState(startedInitially)
  /**
   * Se si è già "entrati" almeno una volta — via `onSkip` o via `onApply` —
   * e mai più tornato a `false`.
   *
   * `phrase` non basta: `onSkip` la azzera esplicitamente (è la modalità
   * "sfoglia tutto", senza frase), eppure porta a un ranking vero, con
   * preferiti e confronto che possono accumularsi da lì in poi. Un `hasResults`
   * legato a `phrase` spegnerebbe Elenco/Preferiti/Confronta nella home
   * riaperta dai risultati anche quando dietro c'è già tutto quel lavoro.
   */
  const [hasEntered, setHasEntered] = useState(false)
  const { items: toasts, push: pushToast, dismiss: dismissToast } = useToasts()

  useEffect(() => { localStorage.setItem(CRITERIA_KEY, JSON.stringify(criteria)) }, [criteria])
  useEffect(() => { setMostrate(PAGINA) }, [criteria, onlyFavourites])
  useEffect(() => { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites)) }, [favourites])

  const applyOverrides = (next) => { setOverrides(next); saveOverrides(next) }

  /**
   * La configurazione dell'interprete sta QUI, non anche dentro `Landing`.
   * Con due copie caricate separatamente da `localStorage`, il modello scelto
   * nel menu della home restava sconosciuto ai risultati fino al ricaricamento
   * della pagina: la critica del ranking girava sull'interprete precedente.
   */
  const applyAgent = (next) => { setAgent(next); saveAgentConfig(next) }

  /**
   * "Esci" su uno strumento senza account può voler dire una cosa sola:
   * cancellare quello che è rimasto su questa macchina. Va detto e confermato,
   * perché gli override dell'editor sono lavoro che non si recupera.
   */
  const azzera = () => {
    const conferma = window.confirm(
      'Cancello tutto quello che è salvato su questo computer: criteri, preferiti, cronologia, ' +
      'modelli configurati e le modifiche fatte nell’editor.\n\n' +
      'Le modifiche non esportate in overrides.json vanno perse. Procedo?'
    )
    if (!conferma) return
    try { localStorage.clear() } catch { /* niente da fare */ }
    window.location.reload()
  }

  const merged = useMemo(() => mergedDestinations(overrides), [overrides])
  const fasciaCosti = useMemo(() => costRange(merged), [merged])
  const ranking = useMemo(() => rankDestinations(merged, criteria), [merged, criteria])

  /**
   * Il dettaglio e il confronto valutano la destinazione anche quando i filtri
   * duri l'hanno esclusa: chiudere un pannello perché hai alzato uno slider
   * sarebbe ostile, e vedere PERCHÉ una destinazione è stata scartata è metà
   * del lavoro di calibrazione.
   */
  const entryFor = (id) => {
    const destination = merged.find((d) => d.id === id)
    if (!destination) return null
    return {
      destination,
      // Stesso intervallo del ranking: l'economicità di una destinazione non
      // può cambiare fra la card e il suo dettaglio.
      scoring: scoreDestination(destination, criteria.weights, criteria.themes, {
        costRange: fasciaCosti,
        month: criteria.month,
      }),
      cost: tripCost(destination, criteria.nights),
    }
  }

  const visible = onlyFavourites
    ? ranking.results.filter((r) => favourites.includes(r.destination.id))
    : ranking.results

  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  /**
   * Il cuore sulla card è un bersaglio piccolo e facile da colpire per sbaglio:
   * la notifica conferma cosa è successo e offre la via d'uscita immediata.
   */
  const toggleFavourite = (destination) => {
    const era = favourites.includes(destination.id)
    setFavourites((list) => toggle(list, destination.id))
    pushToast({
      tone: era ? 'neutral' : 'good',
      text: era
        ? `${destination.name} rimossa dai preferiti`
        : `${destination.name} aggiunta ai preferiti`,
      action: {
        label: 'Annulla',
        run: () => setFavourites((list) => toggle(list, destination.id)),
      },
    })
  }

  const toggleCompare = (id) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id)
      if (current.length >= MAX_COMPARE) return current
      return [...current, id]
    })
  }

  const [compareOpen, setCompareOpen] = useState(false)
  // Il pannello resta montato durante l'animazione di uscita: senza questo
  // React lo smonta subito e non c'è nulla da animare.
  const { closing: detailClosing, dismiss: dismissDetail } = useDismiss(() => setDetailId(null))
  const detailEntry = detailId ? entryFor(detailId) : null
  const compareEntries = compareIds.map(entryFor).filter(Boolean)
  // Il confronto ha senso da due in su: con una sola destinazione la pagina
  // esisterebbe per mostrare una colonna accanto a niente.
  const confrontoAperto = compareOpen && compareEntries.length >= 2
  const overriddenCount = countOverriddenDestinations(overrides)

  // Quanti criteri divergono dal default: alimenta il badge del bottone Filtri
  // su mobile, dove la sidebar non è visibile e serve un segnale che ci sia
  // qualcosa di attivo dietro.
  const activeFilterCount =
    (criteria.budgetMax != null ? 1 : 0) +
    (criteria.seaRequired ? 1 : 0) +
    (criteria.allowedTypes.length !== 3 ? 1 : 0) +
    (criteria.query.trim() ? 1 : 0) +
    (criteria.excluded?.length || 0) +
    (criteria.primary ? 1 : 0) +
    (criteria.themes?.length || 0) +
    Object.keys(criteria.weights).filter((k) => criteria.weights[k] !== defaults.weights[k]).length

  if (!started) {
    return (
      <Landing
        destinations={merged}
        agent={agent}
        onAgentChange={applyAgent}
        phrase={phrase}
        favouritesCount={favourites.length}
        compareCount={compareIds.length}
        // `ranking.hasRanking` da solo è vero già alla primissima apertura:
        // i pesi di default sono tutti a 5, non a zero, perché la modalità
        // "sfoglia tutto" è una ricerca valida. `hasEntered` è la guardia
        // giusta, non `phrase`: resta vera anche quando si torna qui da una
        // ricerca fatta con `onSkip`, che la frase la azzera apposta.
        hasResults={hasEntered && ranking.hasRanking}
        onList={() => { setOnlyFavourites(false); setStarted(true) }}
        onFavourites={() => { setOnlyFavourites(true); setStarted(true) }}
        onCompare={() => { setCompareOpen(true); setStarted(true) }}
        /* Servono al Task 4: il pannello delle impostazioni ha una scheda
           Parametri anche qui, e senza questi due sarebbe una scheda morta.
           `merged` la home ce l'ha già, si chiama `destinations`. */
        overrides={overrides}
        onOverridesChange={applyOverrides}
        onSkip={() => {
          // Entrare senza frase vuol dire anche azzerarla: se prima avevi
          // cercato, quella vecchia resterebbe attaccata ai risultati nuovi.
          setPhrase('')
          setHasEntered(true)
          setStarted(true)
        }}
        onLogout={azzera}
        onApply={(patch, text) => {
          setPhrase(text || '')
          setHasEntered(true)
          // Se la frase nomina degli interessi, contano SOLO quelli: partire
          // da tutti a 5 e alzarne due annacquerebbe ciò che hai chiesto.
          // Se non ne nomina nessuno, restano i predefiniti, altrimenti si
          // arriverebbe ai risultati con tutti i pesi a zero e nessun ranking.
          const chiesti = patch.weights && Object.keys(patch.weights).length > 0
          // Un tema senza interessi — "meta per Halloween" — cade sugli assi
          // che quel tema implica invece che sui predefiniti. Con tutti a 5 la
          // classifica sarebbe quella generica di sempre, spostata di otto
          // punti: chi legge concluderebbe che il tema non ha fatto niente.
          const daTema = !chiesti ? axesFromThemes(patch.themes) : null
          const impliciti = daTema && Object.keys(daTema).length > 0

          setCriteria({
            ...baseCriteria(),
            ...patch,
            weights: chiesti
              ? { ...emptyWeights(0), ...patch.weights }
              : impliciti ? { ...emptyWeights(0), ...daTema } : emptyWeights(5),
          })
          setStarted(true)
        }}
      />
    )
  }

  return (
    // Il guscio porta lo stato della barra laterale come classe: aprendola,
    // `--rail-w` cresce e tutto ciò che rientra a sinistra segue da solo. È il
    // modo per farla STRINGERE il contenuto invece di coprirlo, senza che
    // ogni regola debba sapere se la barra è aperta.
    <div className={`shell${railOpen ? ' is-railopen' : ''}`}>
      <header className="topbar">
        {/* Su desktop apre il faro in cima alla barra laterale; qui l'hamburger
            resta solo sotto i 900px, dove la barra è un cassetto fuori
            schermo e il suo comando sarebbe irraggiungibile. */}
        <button
          type="button"
          className="topbar__menu"
          aria-expanded={railOpen}
          aria-controls="side-rail"
          onClick={() => setRailOpen(true)}
        >
          <IconMenu width="22" height="22" />
          <span className="visually-hidden">Apri cronologia e menu</span>
        </button>

        {/* Solo il nome: il faro sta in cima alla barra laterale, subito a
            sinistra di qui. Ripeterlo sarebbe due volte lo stesso marchio a
            due centimetri di distanza. Riporta alla home, come ci si aspetta
            ovunque: i criteri restano dove sono, torna la schermata della
            frase. */}
        <button
          type="button"
          className="topbar__brand topbar__home"
          onClick={() => setStarted(false)}
          title="Torna alla home"
          aria-label="Beacon — torna alla home"
        >
          Beacon
        </button>

        {/* La ricerca per nome non è più qui: è un filtro come gli altri —
            esclude chi non corrisponde — e stava lontana dai suoi simili, in
            una barra che per il resto non contiene criteri. Ora è la prima
            voce del pannello filtri, dove si trova insieme a budget e tipo. */}

        {/* Il codice, in fondo alla barra. Uno strumento che si giustifica
            mostrando la propria aritmetica deve anche poter far leggere il
            codice che la calcola: senza il collegamento, "verificabile" resta
            una parola. */}
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
        onPickHistory={() => { setRailOpen(false); setStarted(false) }}
        agent={agent}
        onOpenSettings={() => { setRailOpen(false); setSettingsOpen(true) }}
        onLogout={azzera}
        nav={{
          onNewSearch: () => { setRailOpen(false); setStarted(false) },
          // Niente Preferiti qui: è un filtro sui risultati, e sta nella
          // barra dei risultati insieme all'ordinamento. Nel menu prometteva
          // una sezione propria e invece cambiava la lista alle spalle.
          compareCount: compareIds.length,
          onCompare: () => { setCompareOpen(true); setRailOpen(false) },
          overriddenCount,
          onEditor: () => { setParametri(true); setRailOpen(false) },
        }}
      />

      {/* Le pagine prendono il posto dei risultati invece di coprirli:
          parametri e confronto sono consultazioni, non interruzioni. */}
      {parametri && (
        <ParametersPage
          merged={merged}
          overrides={overrides}
          onOverridesChange={applyOverrides}
          onPick={(id) => setEditor({ id })}
          onClose={() => setParametri(false)}
        />
      )}

      {!parametri && confrontoAperto && (
        <ComparePanel
          entries={compareEntries}
          criteria={criteria}
          onRemove={(id) => {
            const next = compareIds.filter((x) => x !== id)
            setCompareIds(next)
            if (next.length < 2) setCompareOpen(false)
          }}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {!parametri && !confrontoAperto && (
      <div className="layout">
        <FilterPanel
          criteria={criteria}
          onChange={setCriteria}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onReset={() => { setCriteria(baseCriteria()); setFiltersOpen(false) }}
        />
        {filtersOpen && (
          <div className="sheet-scrim" onClick={() => setFiltersOpen(false)} role="presentation" />
        )}

        <main className="results">
          <MobileTools
            criteria={criteria}
            onChange={setCriteria}
            onOpenFilters={() => setFiltersOpen(true)}
            activeCount={activeFilterCount}
          />

          <ActiveFilters
            criteria={criteria}
            defaults={defaults}
            onChange={setCriteria}
            onReset={() => setCriteria(baseCriteria())}
          />

          <ResultsHeader
            count={visible.length}
            total={merged.length}
            criteria={criteria}
            onlyFavourites={onlyFavourites}
            favouritesCount={favourites.length}
            onFavourites={() => setOnlyFavourites(!onlyFavourites)}
            onSort={(sortBy) => setCriteria({ ...criteria, sortBy })}
          />

          {!ranking.hasRanking && (
            <div className="notice notice--warn">
              <div>
                <strong>Tutti i pesi sono a zero: non c’è un ranking.</strong> L’ordine qui sotto è
                alfabetico, non un giudizio. Alza almeno uno slider degli interessi per ottenere un
                punteggio.
              </div>
            </div>
          )}

          {/* Anche il banner delle escluse è stato tolto da qui: era un blocco
              lungo sopra ogni ricerca, per un'informazione che serve solo
              quando i risultati sorprendono. `ExcludedNotice.jsx` è ancora nel
              progetto e si rimonta con una riga. Quando i filtri non lasciano
              nulla resta il messaggio di lista vuota, e i filtri attivi sopra
              si tolgono uno per uno dalle loro chip. */}

          {/* "Cosa dicono i numeri" non sta più qui: la classifica sotto dice
              già qual è il punteggio più alto, e ripeterlo in un riquadro
              sopra le card era la stessa informazione due volte. Resta nel
              pannello Confronta, dove le destinazioni non sono ordinate e il
              fatto non è deducibile a colpo d'occhio. */}
          {/* La critica del modello non sta più qui: era un riquadro nel posto
              dove si guarda per primo, riempito dieci secondi dopo e spesso
              con "niente da ridire". Ora è il pulsante in basso a destra,
              montato in fondo alla pagina insieme alle notifiche. */}

          {visible.length === 0 ? (
            <div className="notice notice--empty">
              {onlyFavourites && favourites.length === 0 ? (
                <>Nessun preferito salvato. Usa il cuore sulle card per aggiungerne.</>
              ) : (
                <>Nessuna destinazione soddisfa i criteri correnti. Allenta un filtro qui sopra.</>
              )}
            </div>
          ) : (
            <>
              <div className="grid">
                {visible.slice(0, mostrate).map((entry, index) => (
                  <DestinationCard
                    key={entry.destination.id}
                    entry={entry}
                    rank={index + 1}
                    criteria={criteria}
                    isFavourite={favourites.includes(entry.destination.id)}
                    onToggleFavourite={() => toggleFavourite(entry.destination)}
                    inCompare={compareIds.includes(entry.destination.id)}
                    onToggleCompare={() => toggleCompare(entry.destination.id)}
                    onOpen={() => setDetailId(entry.destination.id)}
                  />
                ))}
              </div>

              {/* Un tetto e un bottone, non lo scroll infinito né le pagine.
                  Questa è una classifica: la risposta buona sta in cima, e chi
                  scorre fino in fondo non sta cercando, sta sfogliando. Lo
                  scroll infinito renderebbe irraggiungibile il piede della
                  pagina e toglierebbe il "quanti sono", che invece è scritto
                  qui sopra; le pagine chiederebbero di navigare una lista che
                  nessuno vuole navigare. */}
              {visible.length > mostrate && (
                <div className="grid__more">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setMostrate((n) => n + PAGINA)}
                  >
                    Mostra altre {Math.min(PAGINA, visible.length - mostrate)}
                  </button>
                  <span>
                    ne vedi {mostrate} di {visible.length}
                  </span>
                </div>
              )}
            </>
          )}

          <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Strumento informativo: nessuna prenotazione, nessun prezzo in tempo reale. Il clima è
            misurato; i costi e i punteggi sono stime, correggibili da <em>Parametri</em>. Il costo
            del volo non è modellato.
          </p>
        </main>

        {/* I pannelli stanno DENTRO il layout: sopra i 1600px smettono di
            essere overlay e diventano la terza colonna, così la sidebar dei
            filtri resta visibile e usabile mentre li consulti. Sotto quella
            soglia il CSS li rimette a coprire la pagina: non c'è spazio per
            tre colonne senza schiacciare la griglia dei risultati. */}
        {detailEntry && (
          <DetailPanel
            entry={detailEntry}
            criteria={criteria}
            closing={detailClosing}
            inCompare={compareIds.includes(detailEntry.destination.id)}
            onCompare={() => toggleCompare(detailEntry.destination.id)}
            onEdit={() => { setEditor({ id: detailEntry.destination.id }); dismissDetail() }}
            onClose={dismissDetail}
          />
        )}

      </div>
      )}

      {/* Fuori dal layout dei risultati: la scheda di una destinazione si apre
          sia da lì sia dalla pagina dei parametri, che il layout lo sostituisce. */}
      {editor && (
        <EditorPanel
          merged={merged}
          overrides={overrides}
          onOverridesChange={applyOverrides}
          initialId={editor.id}
          onClose={() => setEditor(null)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Il pannello che la dock apre: una cosa sola con due schede, invece
          delle due voci separate che su desktop stanno in due posti diversi. */}
      {mobilePanel === 'parametri' && (
        <ParametersPage
          merged={merged}
          overrides={overrides}
          onOverridesChange={applyOverrides}
          onPick={(id) => setEditor({ id })}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="parametri" onPick={setMobilePanel} />}
        />
      )}

      {mobilePanel === 'modello' && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="modello" onPick={setMobilePanel} />}
        />
      )}

      {ranking.hasRanking && (
        <RankingCritique
          phrase={phrase}
          entries={visible}
          weights={criteria.weights}
          agent={agent}
          onApplyWeight={(axis, value) =>
            setCriteria((c) => ({ ...c, weights: { ...c.weights, [axis]: value } }))}
        />
      )}

      <Toasts items={toasts} onDismiss={dismissToast} />

      <SiteFooter />

      <BottomNav
        onlyFavourites={onlyFavourites}
        favouritesCount={favourites.length}
        compareCount={compareIds.length}
        hasResults
        /* Nuova ricerca vuol dire anche azzerare la frase: altrimenti quella
           vecchia resterebbe attaccata ai risultati nuovi. È lo stesso gesto
           della voce omonima nel menu laterale. */
        onNew={() => { setPhrase(''); setStarted(false) }}
        newDisabled={false}
        onList={() => { setOnlyFavourites(false); setDetailId(null) }}
        onFavourites={() => setOnlyFavourites(!onlyFavourites)}
        onCompare={() => setCompareOpen(true)}
        onSettings={() => setMobilePanel('parametri')}
      />

    </div>
  )
}
