import { IconFilter, IconSearch } from './Icons.jsx'

/**
 * Barra sticky del mockup mobile: ricerca, chip dei filtri attivi a scorrimento
 * orizzontale, tab di ordinamento.
 *
 * Su mobile la sidebar dei filtri non ha dove stare, quindi diventa un pannello
 * a scomparsa richiamato da qui. È l'unica differenza strutturale rispetto al
 * desktop: i criteri e il calcolo sono gli stessi.
 */
const SORT_TABS = [
  { key: 'score', label: 'Punteggio' },
  { key: 'cost_asc', label: 'Costo' },
  { key: 'name', label: 'Nome' },
]

export default function MobileTools({ criteria, onChange, onOpenFilters, activeCount }) {
  return (
    <div className="mtools">
      <div className="mtools__search">
        <IconSearch />
        <label htmlFor="mq" className="visually-hidden">Cerca una destinazione</label>
        <input
          id="mq"
          type="search"
          placeholder="Cerca una meta…"
          value={criteria.query}
          onChange={(e) => onChange({ ...criteria, query: e.target.value })}
        />
        <button type="button" className="mtools__filters" onClick={onOpenFilters}>
          <IconFilter width="17" height="17" />
          Filtri
          {activeCount > 0 && <span className="mtools__badge">{activeCount}</span>}
        </button>
      </div>

      <div className="mtools__tabs" role="tablist" aria-label="Ordina i risultati">
        {SORT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={criteria.sortBy === tab.key}
            onClick={() => onChange({ ...criteria, sortBy: tab.key })}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
