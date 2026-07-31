import { FILTER, summariseExclusions } from '../lib/scoring.js'

/**
 * Le destinazioni escluse non spariscono in silenzio.
 *
 * Un budget troppo stretto che azzera i risultati deve leggersi come un filtro
 * troppo stretto, non come un bug dello strumento.
 */
export default function ExcludedNotice({ excluded, criteria, onChange, resultsCount }) {
  if (excluded.length === 0) return null

  const summary = summariseExclusions(excluded)
  const relax = (filter) => {
    if (filter === FILTER.BUDGET) onChange({ ...criteria, budgetMax: null })
    if (filter === FILTER.QUERY) onChange({ ...criteria, query: '' })
    // Allentare il filtro mare vuol dire smettere di esigerlo, non abbassare
    // la soglia a un valore che nessuno ha scelto.
    if (filter === FILTER.SEA) onChange({ ...criteria, seaRequired: false })
    if (filter === FILTER.TYPE) onChange({ ...criteria, allowedTypes: ['city', 'area', 'island'] })
  }

  return (
    <div className={`notice${resultsCount === 0 ? ' notice--warn' : ''}`}>
      <div>
        <strong>
          {excluded.length} {excluded.length === 1 ? 'destinazione esclusa' : 'destinazioni escluse'} dai filtri duri
        </strong>
        {resultsCount === 0 && ' — non è rimasto nulla da classificare.'}
        <ul>
          {summary.map((s) => (
            <li key={s.filter}>
              {s.count} per <em>{s.label}</em>{' '}
              <button type="button" className="notice__link" onClick={() => relax(s.filter)}>
                allenta
              </button>
              <br />
              <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                {excluded
                  .filter((e) => e.filter === s.filter)
                  .slice(0, 4)
                  .map((e) => `${e.destination.name} (${e.detail})`)
                  .join(' · ')}
                {s.count > 4 && ` · e altre ${s.count - 4}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
