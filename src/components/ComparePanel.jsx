import { useState } from 'react'
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

/** Tutte le celle uguali: la riga non aiuta a scegliere. */
const tutteUguali = (values) =>
  new Set(values.map((v) => (v == null ? 'null' : String(v)))).size === 1

function Row({ label, values, format, direction, nascondi }) {
  if (nascondi && tutteUguali(values)) return null
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

/** Intestazione di gruppo: dà al confronto una struttura invece di 16 righe in fila. */
function Group({ title, span, hint }) {
  return (
    <tr className="compare__group">
      <th scope="colgroup" colSpan={span}>
        {title}
        {hint && <small>{hint}</small>}
      </th>
    </tr>
  )
}

/**
 * Il confronto, come pagina.
 *
 * Era una tabella dentro una modale: sedici righe di numeri nudi in una
 * finestra più stretta della pagina, con le note lunghe dentro una cella e gli
 * otto assi ridotti a una parete di cifre. Si poteva leggere, ma non si poteva
 * *guardare* — e un confronto serve proprio a farsi un'idea a colpo d'occhio.
 *
 * Tre cose cambiate, in ordine di effetto:
 *
 * 1. **Piena larghezza**, come la pagina dei parametri. Il confronto non è
 *    un'interruzione, è una consultazione.
 * 2. **Gli assi hanno una barra**, non solo un numero. La lunghezza È il
 *    valore: l'occhio confronta lunghezze molto meglio di cifre a tre
 *    caratteri, e il numero resta accanto per chi lo vuole.
 * 3. **Le righe sono raggruppate** e le note escono dalla tabella. Una prosa
 *    di trenta parole dentro una cella spezza il ritmo di tutte le altre.
 *
 * In più si possono nascondere le righe in cui le destinazioni sono identiche:
 * su un confronto fra due isole greche, metà tabella non aiuta a scegliere.
 */
export default function ComparePanel({ entries, criteria, onClose, onRemove }) {
  const [soloDifferenze, setSoloDifferenze] = useState(false)

  const climates = entries.map((e) => climateSummary(e.destination, criteria.month))
  const periodo = criteria.month ? monthName(criteria.month).toLowerCase() : 'tutto l’anno'
  const colonne = entries.length + 1

  return (
    <section className="page" aria-label="Confronto destinazioni">
      <header className="page__head">
        <div>
          <h2>Confronto</h2>
          <p>
            {entries.length} destinazioni · {criteria.nights} notti · {periodo} — la cella
            evidenziata è la migliore della riga
          </p>
        </div>
        <label className="checkline compare__toggle">
          <input
            type="checkbox"
            checked={soloDifferenze}
            onChange={(e) => setSoloDifferenze(e.target.checked)}
          />
          Solo le differenze
        </label>
        <button type="button" className="btn" onClick={onClose}>Torna ai risultati</button>
      </header>

      <div className="table--scroll">
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
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => onRemove(e.destination.id)}
                  >
                    Rimuovi
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <Group title="Risultato" span={colonne} />
            <Row
              label="Punteggio totale"
              values={entries.map((e) => e.scoring.total)}
              direction="max"
              format={(v, i) => (
                v == null ? '—' : (
                  <span className="compare__score">
                    <strong>{v.toFixed(1)}</strong>
                    {entries[i].scoring.themeBonus > 0 && (
                      <em>{entries[i].scoring.base.toFixed(1)} + {entries[i].scoring.themeBonus} tema</em>
                    )}
                  </span>
                )
              )}
            />
            <Row
              label={`Costo stimato · ${criteria.nights} notti`}
              values={entries.map((e) => e.cost.mid)}
              direction="min"
              format={(_, i) => eurRange(entries[i].cost.low, entries[i].cost.high)}
            />

            <Group title="Clima" span={colonne} hint={criteria.month ? `a ${periodo}` : 'sull’anno'} />
            <Row
              nascondi={soloDifferenze}
              label={criteria.month ? 'Aria' : 'Aria, media annua'}
              values={climates.map((c) => c.temp_avg ?? null)}
              direction="max"
              format={(v) => temp(v)}
            />
            <Row
              nascondi={soloDifferenze}
              label={criteria.month ? 'Mare' : 'Mare, massimo annuo'}
              values={climates.map((c) => c.sea_temp ?? null)}
              direction="max"
              format={(v) => (v == null ? 'no mare' : temp(v))}
            />
            <Row
              nascondi={soloDifferenze}
              label={criteria.month ? 'Giorni di pioggia' : 'Pioggia, media'}
              values={climates.map((c) => c.rain_days ?? null)}
              direction="min"
              format={(v) => (v == null ? '—' : `${v} gg`)}
            />

            <Group title="Interessi" span={colonne} hint="punteggio 0–100, il peso è quello della tua ricerca" />
            {AXES.map((axis) => {
              const peso = criteria.weights[axis.key] || 0
              return (
                <Row
                  key={axis.key}
                  nascondi={soloDifferenze}
                  label={
                    <span className={peso === 0 ? 'compare__axis is-muted' : 'compare__axis'}>
                      <span className="table__swatch" style={{ background: axis.color }} />
                      {axis.label}
                      {peso > 0 && <span className="badge badge--info">peso {peso}</span>}
                    </span>
                  }
                  /* Dal calcolo, non dai dati: l'economicità non sta in
                     `scores` e leggerla da lì la mostrerebbe sempre a zero. */
                  values={entries.map((e) =>
                    e.scoring?.contributions?.find((c) => c.key === axis.key)?.score
                    ?? e.destination.scores?.[axis.key] ?? 0
                  )}
                  direction="max"
                  /* La barra è il confronto, il numero è la verifica: l'occhio
                     legge la prima, chi controlla legge il secondo. */
                  format={(v) => (
                    <span className="compare__meter" title={`${v} su 100`}>
                      <span
                        className="compare__meterfill"
                        style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: axis.color }}
                      />
                      <b>{v}</b>
                    </span>
                  )}
                />
              )
            })}

            <Group title="Pratico" span={colonne} />
            <Row
              nascondi={soloDifferenze}
              label="Aeroporti"
              values={entries.map((e) => e.destination.airports?.join(', ') || '—')}
            />
          </tbody>
        </table>
      </div>

      <Recommendation entries={entries} nights={criteria.nights} />

      {/* Le note fuori dalla tabella: sono prose di trenta parole, e in una
          cella schiacciavano l'altezza di ogni altra riga. */}
      {entries.some((e) => e.destination.notes) && (
        <div className="compare__notes">
          <h3>Note</h3>
          {entries.filter((e) => e.destination.notes).map((e) => (
            <p key={e.destination.id}>
              <strong>{e.destination.name}</strong> — {e.destination.notes}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
