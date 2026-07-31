import { useEffect, useMemo, useState } from 'react'
import ActiveFilters from './components/ActiveFilters.jsx'
import BottomNav from './components/BottomNav.jsx'
import ComparePanel from './components/ComparePanel.jsx'
import MobileTools from './components/MobileTools.jsx'
import DestinationCard from './components/DestinationCard.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import EditorPanel from './components/EditorPanel.jsx'
import FilterPanel from './components/FilterPanel.jsx'
import Landing from './components/Landing.jsx'
import Logo from './components/Logo.jsx'
import RankingCritique from './components/RankingCritique.jsx'
import ResultsHeader from './components/ResultsHeader.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import SideRail from './components/SideRail.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import Toasts from './components/Toasts.jsx'
import { IconEdit, IconHeart, IconMenu, IconScale, IconSearch } from './components/Icons.jsx'
import { emptyWeights } from './lib/axes.js'
import { rankDestinations, scoreDestination, tripCost } from './lib/scoring.js'
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

const CRITERIA_KEY = 'destination-finder:criteria:v1'
const STARTED_KEY = 'destination-finder:started:v1'
const FAVOURITES_KEY = 'destination-finder:favourites:v1'
const MAX_COMPARE = 4

function baseCriteria() {
  return {
    query: '',
    month: new Date().getMonth() + 1,
    nights: 5,
    weights: emptyWeights(5),
    budgetMax: null,
    seaTempMin: 21,
    // Requisito esplicito, spento di default: reimpostare i criteri deve
    // riportare a uno stato in cui NON è escluso niente.
    seaRequired: false,
    allowedTypes: ['city', 'area', 'island'],
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

export default function App() {
  const defaults = useMemo(baseCriteria, [])
  const [criteria, setCriteria] = useState(() => ({ ...baseCriteria(), ...readJson(CRITERIA_KEY, {}) }))
  const [overrides, setOverrides] = useState(loadOverrides)
  const [favourites, setFavourites] = useState(() => readJson(FAVOURITES_KEY, []))
  const [onlyFavourites, setOnlyFavourites] = useState(false)
  const [view, setView] = useState('grid')
  const [detailId, setDetailId] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [editor, setEditor] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [agent, setAgent] = useState(loadAgentConfig)
  const [history, setHistory] = useState(loadHistory)
  // La frase che ha prodotto questi criteri: serve alla critica del modello,
  // che confronta le parole scritte con i pesi effettivi. Dopo un ricaricamento
  // la si ripesca dalla cronologia, che è dove l'ultima ricerca è già salvata.
  const [phrase, setPhrase] = useState(() => loadHistory()[0]?.text || '')
  // Chi ha già cercato una volta non rivede la schermata d'ingresso: sarebbe
  // un pedaggio quotidiano su uno strumento che si usa spesso.
  const [started, setStarted] = useState(() => readJson(STARTED_KEY, false))
  const { items: toasts, push: pushToast, dismiss: dismissToast } = useToasts()

  useEffect(() => { localStorage.setItem(CRITERIA_KEY, JSON.stringify(criteria)) }, [criteria])
  useEffect(() => { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites)) }, [favourites])
  useEffect(() => { localStorage.setItem(STARTED_KEY, JSON.stringify(started)) }, [started])

  const applyOverrides = (next) => { setOverrides(next); saveOverrides(next) }

  /**
   * "Esci" su uno strumento senza account può voler dire una cosa sola:
   * cancellare quello che è rimasto su questa macchina. Va detto e confermato,
   * perché gli override dell'editor sono lavoro che non si recupera.
   */
  const azzera = () => {
    const conferma = window.confirm(
      'Cancello tutto quello che è salvato su questo computer: criteri, preferiti, cronologia, ' +
      'configurazione del modello e le modifiche fatte nell’editor.\n\n' +
      'Le modifiche non esportate in overrides.json vanno perse. Procedo?'
    )
    if (!conferma) return
    try { localStorage.clear() } catch { /* niente da fare */ }
    window.location.reload()
  }

  const merged = useMemo(() => mergedDestinations(overrides), [overrides])
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
      scoring: scoreDestination(destination, criteria.weights),
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
  const overriddenCount = countOverriddenDestinations(overrides)

  // Quanti criteri divergono dal default: alimenta il badge del bottone Filtri
  // su mobile, dove la sidebar non è visibile e serve un segnale che ci sia
  // qualcosa di attivo dietro.
  const activeFilterCount =
    (criteria.budgetMax != null ? 1 : 0) +
    (criteria.seaRequired ? 1 : 0) +
    (criteria.allowedTypes.length !== 3 ? 1 : 0) +
    (criteria.query.trim() ? 1 : 0) +
    Object.keys(criteria.weights).filter((k) => criteria.weights[k] !== defaults.weights[k]).length

  if (!started) {
    return (
      <Landing
        destinations={merged}
        onSkip={() => setStarted(true)}
        onLogout={azzera}
        onApply={(patch, text) => {
          setPhrase(text || '')
          // Se la frase nomina degli interessi, contano SOLO quelli: partire
          // da tutti a 5 e alzarne due annacquerebbe ciò che hai chiesto.
          // Se non ne nomina nessuno, restano i predefiniti, altrimenti si
          // arriverebbe ai risultati con tutti i pesi a zero e nessun ranking.
          const chiesti = patch.weights && Object.keys(patch.weights).length > 0
          setCriteria({
            ...baseCriteria(),
            ...patch,
            weights: chiesti ? { ...emptyWeights(0), ...patch.weights } : emptyWeights(5),
          })
          setStarted(true)
        }}
      />
    )
  }

  return (
    <>
      <header className="topbar">
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

        {/* Il marchio riporta alla home, come ci si aspetta ovunque. Fa la
            stessa cosa di "Nuova ricerca" nel drawer: i criteri restano dove
            sono, torna solo la schermata della frase. */}
        <button
          type="button"
          className="topbar__brand topbar__home"
          onClick={() => setStarted(false)}
          title="Torna alla home"
          aria-label="Beacon — torna alla home"
        >
          <Logo size={26} phase />
        </button>

        <div className="topbar__search">
          <label htmlFor="q" className="visually-hidden">Cerca una destinazione</label>
          <input
            id="q"
            type="search"
            placeholder="Cerca per nome o paese…"
            value={criteria.query}
            onChange={(e) => setCriteria({ ...criteria, query: e.target.value })}
          />
          <IconSearch />
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
        onPickHistory={() => { setRailOpen(false); setStarted(false) }}
        agent={agent}
        onOpenSettings={() => { setRailOpen(false); setSettingsOpen(true) }}
        onLogout={azzera}
        nav={{
          onNewSearch: () => { setRailOpen(false); setStarted(false) },
          onlyFavourites,
          favouritesCount: favourites.length,
          onFavourites: () => { setOnlyFavourites(!onlyFavourites); setRailOpen(false) },
          compareCount: compareIds.length,
          onCompare: () => { setCompareOpen(true); setRailOpen(false) },
          overriddenCount,
          onEditor: () => { setEditor({ id: null }); setRailOpen(false) },
        }}
      />

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
            view={view}
            onView={setView}
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

          {visible.length === 0 ? (
            <div className="notice notice--empty">
              {onlyFavourites && favourites.length === 0 ? (
                <>Nessun preferito salvato. Usa il cuore sulle card per aggiungerne.</>
              ) : (
                <>Nessuna destinazione soddisfa i criteri correnti. Allenta un filtro qui sopra.</>
              )}
            </div>
          ) : (
            <div className={`grid${view === 'list' ? ' grid--list' : ''}`}>
              {visible.map((entry, index) => (
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
          )}

          <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Strumento informativo: nessuna prenotazione, nessun prezzo in tempo reale. Costi e clima
            sono stime iniziali da calibrare con l’editor. Il costo del volo non è modellato in
            Fase 0.
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

        {compareOpen && compareEntries.length > 0 && (
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

        {editor && (
          <EditorPanel
            merged={merged}
            overrides={overrides}
            onOverridesChange={applyOverrides}
            initialId={editor.id}
            onClose={() => setEditor(null)}
          />
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          config={agent}
          onChange={(next) => { setAgent(next); saveAgentConfig(next) }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <Toasts items={toasts} onDismiss={dismissToast} />

      <SiteFooter />

      <BottomNav
        onlyFavourites={onlyFavourites}
        favouritesCount={favourites.length}
        compareCount={compareIds.length}
        onSearch={() => { setOnlyFavourites(false); setDetailId(null) }}
        onFavourites={() => setOnlyFavourites(!onlyFavourites)}
        onCompare={() => setCompareOpen(true)}
        onEditor={() => setEditor({ id: null })}
      />

    </>
  )
}
