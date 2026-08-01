import { DESTINATION_TYPES } from '../lib/axes.js'
import { themeLabel } from '../lib/themes.js'
import { monthName } from '../lib/format.js'

/** Forma fissa "filtro: valore", così la riga si legge a colpo d'occhio. */
function Chip({ label, value, onRemove }) {
  return (
    <span className="chip">
      <span className="chip__label">{label}:</span> <strong>{value}</strong>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Rimuovi filtro ${label}`}>×</button>
      )}
    </span>
  )
}

/**
 * I criteri che divergono dai valori di partenza, uno per chip.
 *
 * La regola è una sola e vale per tutti: **un chip compare solo se c'è
 * qualcosa da togliere, e la sua × riporta al valore di partenza.** Periodo e
 * notti prima erano un'eccezione — sempre presenti e senza ×, perché "5 notti
 * a marzo" è pur sempre un criterio attivo. Ma un chip che non si può togliere
 * in una riga di chip che si tolgono è un bersaglio che tradisce, e soprattutto
 * lasciava in piedi due chip dopo un "Reimposta tutto", che è esattamente il
 * gesto con cui si chiede di non vederne più.
 */
export default function ActiveFilters({ criteria, defaults, onChange, onReset }) {
  const set = (patch) => onChange({ ...criteria, ...patch })
  const chips = []

  if (criteria.month !== defaults.month) {
    chips.push(
      <Chip
        key="month"
        label="Periodo"
        value={criteria.month ? monthName(criteria.month) : 'tutto l’anno'}
        onRemove={() => set({ month: defaults.month })}
      />
    )
  }

  if (criteria.nights !== defaults.nights) {
    chips.push(
      <Chip
        key="nights"
        label="Notti"
        value={criteria.nights}
        onRemove={() => set({ nights: defaults.nights })}
      />
    )
  }

  if (criteria.query.trim()) {
    chips.push(
      <Chip key="query" label="Ricerca" value={`“${criteria.query.trim()}”`} onRemove={() => set({ query: '' })} />
    )
  }

  if (criteria.budgetMax != null) {
    chips.push(
      <Chip key="budget" label="Budget" value={`${criteria.budgetMax} €`} onRemove={() => set({ budgetMax: null })} />
    )
  }

  if (criteria.seaRequired) {
    chips.push(
      <Chip
        key="sea"
        label="Mare almeno"
        value={`${criteria.seaTempMin} °C`}
        onRemove={() => set({ seaRequired: false })}
      />
    )
  }

  if (criteria.allowedTypes.length !== DESTINATION_TYPES.length) {
    const labels = DESTINATION_TYPES
      .filter((t) => criteria.allowedTypes.includes(t.key))
      .map((t) => t.label)
      .join(', ')
    chips.push(
      <Chip
        key="types"
        label="Tipo"
        value={labels || 'nessun tipo'}
        onRemove={() => set({ allowedTypes: DESTINATION_TYPES.map((t) => t.key) })}
      />
    )
  }

  /**
   * Un chip per tema, togliibile singolarmente.
   *
   * Il tema non esclude niente, ma sposta il punteggio: se non fosse qui, una
   * destinazione salita di otto punti perché "gotica" sarebbe salita senza che
   * si veda perché — e il chip è anche l'unico modo di dire al modello che
   * quel tema non era quello che intendevi.
   */
  for (const key of criteria.themes || []) {
    chips.push(
      <Chip
        key={`theme-${key}`}
        label="Tema"
        value={themeLabel(key)}
        onRemove={() => set({ themes: criteria.themes.filter((t) => t !== key) })}
      />
    )
  }

  // Niente da azzerare, niente riga: un "Reimposta tutto" da solo, con zero
  // chip accanto, è un bottone che non fa niente.
  if (chips.length === 0) return null

  return (
    <div className="chips">
      {chips}
      <button type="button" className="chip chip--reset" onClick={onReset}>
        Reimposta tutto
      </button>
    </div>
  )
}
