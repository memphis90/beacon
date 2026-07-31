import { AXES, DESTINATION_TYPES } from '../lib/axes.js'
import Recommendation from './Recommendation.jsx'
import { climateSummary } from '../lib/scoring.js'
import { countryFlag, countryName, eurRange, monthName, temp } from '../lib/format.js'

const typeLabel = (key) => DESTINATION_TYPES.find((t) => t.key === key)?.label || key

/** Marca la cella migliore della riga. Con un solo valore distinto non c'è un vincitore. */
function bestIndexes(values, direction = 'max') {
  const numeric = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (numeric.length < 2 || new Set(numeric).size === 1) return new Set()
  const target = direction === 'max' ? Math.max(...numeric) : Math.min(...numeric)
  return new Set(values.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0))
}

function Row({ label, values, format, direction }) {
  const best = direction ? bestIndexes(values, direction) : new Set()
  return (
    <tr>
      <th scope="row">{label}</th>
      {values.map((value, index) => (
        <td key={index} className={best.has(index) ? 'best' : undefined}>
          {format ? format(value, index) : value}
        </td>
      ))}
    </tr>
  )
}

export default function ComparePanel({ entries, criteria, onClose, onRemove }) {
  const climates = entries.map((e) => climateSummary(e.destination, criteria.month))
  const periodo = criteria.month ? monthName(criteria.month).toLowerCase() : 'tutto l’anno'

  return (
    <div className="overlay overlay--center" onClick={onClose} role="presentation">
      <section
        className="panel panel--modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confronto destinazioni"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel__head">
          <div>
            <h2>Confronto</h2>
            <p>
              {entries.length} destinazioni · {criteria.nights} notti · {periodo} · la cella evidenziata è la migliore della riga
            </p>
          </div>
          <button type="button" className="panel__close" onClick={onClose} aria-label="Chiudi">×</button>
        </header>

        <div className="panel__body">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Criterio</span></th>
                {entries.map((e) => (
                  <th key={e.destination.id} scope="col" className="compare__head">
                    <h4>{e.destination.name}</h4>
                    <small>
                      {countryFlag(e.destination.country)} {countryName(e.destination.country)} ·{' '}
                      {typeLabel(e.destination.type)}
                    </small>
                    <br />
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ marginTop: 4 }}
                      onClick={() => onRemove(e.destination.id)}
                    >
                      Rimuovi
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row
                label="Punteggio totale"
                values={entries.map((e) => e.scoring.total)}
                direction="max"
                format={(v) => (v == null ? '—' : <strong>{v.toFixed(1)}</strong>)}
              />
              <Row
                label={`Costo stimato · ${criteria.nights} notti`}
                values={entries.map((e) => e.cost.mid)}
                direction="min"
                format={(_, i) => eurRange(entries[i].cost.low, entries[i].cost.high)}
              />
              <Row
                label={criteria.month ? 'Temperatura media aria' : 'Aria, media annua'}
                values={climates.map((c) => c.temp_avg ?? null)}
                direction="max"
                format={(v) => temp(v)}
              />
              <Row
                label={criteria.month ? 'Temperatura del mare' : 'Mare, massimo annuo'}
                values={climates.map((c) => c.sea_temp ?? null)}
                direction="max"
                format={(v) => (v == null ? 'no mare' : temp(v))}
              />
              <Row
                label={criteria.month ? 'Giorni di pioggia' : 'Giorni di pioggia, media'}
                values={climates.map((c) => c.rain_days ?? null)}
                direction="min"
                format={(v) => (v == null ? '—' : `${v} gg`)}
              />

              {AXES.map((axis) => (
                <Row
                  key={axis.key}
                  label={
                    <>
                      <span className="table__swatch" style={{ background: axis.color }} />
                      {axis.label}
                      {criteria.weights[axis.key] > 0 && (
                        <span className="badge badge--info" style={{ marginLeft: 6 }}>
                          peso {criteria.weights[axis.key]}
                        </span>
                      )}
                    </>
                  }
                  values={entries.map((e) => e.destination.scores?.[axis.key] ?? 0)}
                  direction="max"
                />
              ))}

              <Row
                label="Aeroporti"
                values={entries.map((e) => e.destination.airports?.join(', ') || '—')}
              />
              <Row
                label="Note"
                values={entries.map((e) => e.destination.notes || '—')}
                format={(v) => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{v}</span>}
              />
            </tbody>
          </table>

          <Recommendation entries={entries} nights={criteria.nights} />
        </div>
      </section>
    </div>
  )
}
