import { useState } from 'react'
import { IconSearch } from './Icons.jsx'
import { AXES, DESTINATION_TYPES, MONTHS, emptyWeights } from '../lib/axes.js'
import { THEMES, THEME_BONUS, THEME_BONUS_MAX } from '../lib/themes.js'
import { periodFromDates } from '../lib/period.js'

/**
 * Scorciatoie a chip, come nel mockup desktop.
 *
 * I chip NON sostituiscono il controllo continuo: scrivono nello stesso stato
 * e restano affiancati allo slider e al campo in euro. Mare e budget sono
 * filtri DURI — escludono destinazioni — quindi ridurli a due valori fissi
 * toglierebbe all'utente la possibilità di esprimere "23 °C" o "740 €".
 * I chip danno la velocità, il controllo sotto dà la risoluzione.
 */
function Presets({ label, options, value, onPick }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="segctl segctl--wrap" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            title={option.hint}
            onClick={() => onPick(option.value)}
          >
            {option.label}
            {/* Il valore sta nell'etichetta, non solo nel tooltip: su touch il
                tooltip non esiste, e un preset che non dice quanto vale non è
                una scorciatoia, è un'incognita. */}
            {option.sub && <small>{option.sub}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Soglie mare in °C. 21 è il default: sotto, il bagno è per stoici. */
const SEA_PRESETS = [
  { label: '18 °C+', value: 18, hint: 'Acqua fresca: nuotabile ma non piacevole a lungo' },
  { label: '21 °C+', value: 21, hint: 'Soglia predefinita' },
  { label: '24 °C+', value: 24, hint: 'Acqua decisamente calda' },
  { label: '26 °C+', value: 26, hint: 'Solo alta stagione mediterranea' },
]

/** Costo a terra per persona, per notte. Moltiplicato per le notti scelte. */
const BUDGET_PER_NIGHT = [
  { label: 'Economico', perNight: 55, hint: '~55 € a notte fra alloggio, cibo e trasporti' },
  { label: 'Medio', perNight: 100, hint: '~100 € a notte' },
  { label: 'Alto', perNight: 170, hint: '~170 € a notte' },
]

function Group({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="filters__group">
      <button type="button" className="filters__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {title}
      </button>
      {open && <div className="filters__body">{children}</div>}
    </div>
  )
}

export default function FilterPanel({ criteria, onChange, open = false, onClose, onReset }) {
  const set = (patch) => onChange({ ...criteria, ...patch })
  const setWeight = (key, value) => set({ weights: { ...criteria.weights, [key]: value } })

  const seaRequested = Boolean(criteria.seaRequired)
  const toggleType = (key) => {
    const current = criteria.allowedTypes
    const next = current.includes(key) ? current.filter((t) => t !== key) : [...current, key]
    set({ allowedTypes: next })
  }

  /**
   * Le date scrivono mese e notti, non li affiancano.
   *
   * `month` e `nights` restano il modello su cui gira tutto il calcolo: le
   * date sono un modo comodo di compilarli, non un terzo criterio. Tenerle
   * come dato separato avrebbe voluto dire due verità sullo stesso periodo,
   * che prima o poi divergono.
   */
  const periodo = periodFromDates(criteria.dateFrom, criteria.dateTo)

  const applicaDate = (from, to) => {
    const p = periodFromDates(from, to)
    set(p
      ? { dateFrom: from, dateTo: to, month: p.month, nights: p.nights }
      : { dateFrom: from || null, dateTo: to || null })
  }

  /**
   * Il terzo tema scaccia il più vecchio invece di essere rifiutato in
   * silenzio: il tetto al bonus è di due temi, e un bottone che si preme senza
   * che succeda niente è peggio di un limite dichiarato dal comportamento.
   */
  const toggleTheme = (key) => {
    const current = criteria.themes || []
    if (current.includes(key)) return set({ themes: current.filter((t) => t !== key) })
    set({ themes: [...current, key].slice(-2) })
  }

  return (
    <aside className={`filters${open ? ' filters--open' : ''}`} aria-label="Criteri di ricerca">
      {/* Intestazione del pannello a scomparsa: visibile solo su mobile */}
      <div className="filters__sheetbar">
        <strong>Filtri</strong>
        <button type="button" className="btn btn--sm" onClick={onClose}>Chiudi</button>
      </div>

      {/* Prima voce del pannello: la ricerca per nome è un filtro duro come il
          budget o il tipo, e nella barra in alto stava da sola, lontana dagli
          altri criteri e senza il chip che la spiega accanto. */}
      <Group title="Nome o paese">
        <div className="field">
          <label htmlFor="f-query" className="visually-hidden">Cerca una destinazione</label>
          <div className="filters__search">
            <IconSearch />
            <input
              id="f-query"
              type="search"
              className="control"
              placeholder="Creta, Grecia, Lisbona…"
              value={criteria.query}
              onChange={(e) => set({ query: e.target.value })}
            />
          </div>
          <p className="filters__note">
            Confronto testuale su nome e paese. <strong>Esclude</strong> chi non corrisponde:
            è il filtro più stretto del pannello.
          </p>
        </div>

        {/* I veti nascono dalla frase, non da questo pannello: non c'è un
            campo per scriverli, ma devono essere visibili e togliibili. Un
            filtro che toglie destinazioni senza comparire da nessuna parte è
            esattamente la scatola nera che l'app evita. */}
        {criteria.excluded?.length > 0 && (
          <div className="field">
            <span className="filters__label">Escluse dalla tua frase</span>
            <div className="chips">
              {criteria.excluded.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="chip chip--removable"
                  onClick={() => set({ excluded: criteria.excluded.filter((x) => x !== v) })}
                  title={`Rimetti in gioco ${v}`}
                >
                  {v} <span aria-hidden="true">×</span>
                  <span className="visually-hidden">, rimuovi l’esclusione</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Periodo e durata">
        {/* Le date sono il modo in cui si pensa a un viaggio, e danno due
            informazioni al prezzo di una: quando e per quanto. Ma i dati
            climatici hanno risoluzione mensile — di "12-19 agosto" sappiamo
            quanto sappiamo di tutto agosto — quindi la riga sotto dichiara su
            che cosa si sta davvero rispondendo, invece di lasciar credere a
            una precisione che non c'è.
            I due controlli qui sotto restano per chi le date non le ha
            ancora: non sono un doppione, sono l'altro stato in cui si arriva
            a cercare una vacanza. */}
        <div className="field">
          <span className="field__label">Date, se le hai</span>
          <div className="filters__dates">
            <label htmlFor="f-from" className="visually-hidden">Dal</label>
            <input
              id="f-from" type="date" className="control"
              value={criteria.dateFrom || ''}
              onChange={(e) => applicaDate(e.target.value, criteria.dateTo)}
            />
            <span aria-hidden="true">→</span>
            <label htmlFor="f-to" className="visually-hidden">Al</label>
            <input
              id="f-to" type="date" className="control"
              value={criteria.dateTo || ''}
              min={criteria.dateFrom || undefined}
              onChange={(e) => applicaDate(criteria.dateFrom, e.target.value)}
            />
          </div>
          {periodo && <p className="filters__note filters__note--ok">{periodo.label}</p>}
          {criteria.dateFrom && criteria.dateTo && !periodo && (
            <p className="filters__note filters__note--warn">
              La seconda data deve venire dopo la prima.
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="f-month">Mese del viaggio</label>
          <select
            id="f-month"
            className="control"
            value={criteria.month ?? ''}
            /* Scegliere il mese a mano toglie le date: erano il modo per
               ricavarlo, e lasciarle lì direbbe una cosa che non è più vera. */
            onChange={(e) => set({
              month: e.target.value === '' ? null : Number(e.target.value),
              dateFrom: null, dateTo: null,
            })}
          >
            {/* Senza un mese il filtro di stagionalità non sparisce: cambia
                domanda, e chiede se il mare arriva mai a essere caldo. */}
            <option value="">Tutto l’anno</option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-nights">Notti</label>
          <input
            id="f-nights"
            type="number"
            className="control"
            min="1"
            max="60"
            value={criteria.nights}
            onChange={(e) => set({
              nights: Math.max(1, Number(e.target.value) || 1),
              dateFrom: null, dateTo: null,
            })}
          />
        </div>
      </Group>

      <Group title="Budget a terra">
        <p className="filters__note">
          <strong>Il volo non è incluso.</strong> Le fasce prezzo dei voli entrano in Fase 2:
          qui il budget copre solo alloggio, cibo e trasporti locali, per persona.
        </p>
        <div className="checkline">
          <input
            id="f-budget-on"
            type="checkbox"
            checked={criteria.budgetMax != null}
            onChange={(e) => set({ budgetMax: e.target.checked ? 100 * criteria.nights : null })}
          />
          <label htmlFor="f-budget-on">Applica un tetto di spesa</label>
        </div>

        {criteria.budgetMax != null && (
          <Presets
            label="Fasce rapide"
            value={criteria.budgetMax}
            options={BUDGET_PER_NIGHT.map((b) => ({
              label: b.label,
              sub: `${b.perNight * criteria.nights} €`,
              value: b.perNight * criteria.nights,
              hint: `${b.hint} × ${criteria.nights} notti`,
            }))}
            onPick={(value) => set({ budgetMax: value })}
          />
        )}

        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="f-budget">Massimo per persona (€)</label>
          <input
            id="f-budget"
            type="number"
            className="control"
            min="0"
            step="50"
            disabled={criteria.budgetMax == null}
            value={criteria.budgetMax ?? ''}
            onChange={(e) => set({ budgetMax: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </Group>

      <Group title="Interessi (peso 0–10)">
        <p className="filters__note">
          Un peso a <strong>0</strong> esclude l’asse dal calcolo. Il ranking è la media dei
          punteggi pesata su questi valori.
        </p>
        {AXES.map((axis) => {
          const weight = criteria.weights[axis.key] ?? 0
          return (
            <div className="weight" key={axis.key}>
              <div className="weight__top">
                <span className="weight__dot" style={{ background: axis.color }} />
                <label className="weight__label" htmlFor={`w-${axis.key}`}>{axis.label}</label>
                <span className={`weight__value${weight === 0 ? ' weight__value--zero' : ''}`}>{weight}</span>
              </div>
              <input
                id={`w-${axis.key}`}
                type="range"
                min="0"
                max="10"
                step="1"
                value={weight}
                onChange={(e) => setWeight(axis.key, Number(e.target.value))}
              />
              <p className="weight__hint">{axis.hint}</p>
            </div>
          )
        })}
        <div className="inline" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--sm" onClick={() => set({ weights: emptyWeights(0) })}>
            Azzera
          </button>
          <button type="button" className="btn btn--sm" onClick={() => set({ weights: emptyWeights(5) })}>
            Tutti a 5
          </button>
        </div>
      </Group>

      <Group title="Il mare è un requisito?">
        <p className="filters__note">
          Diverso dal <strong>peso</strong> di “Mare”, che dice quanto ti interessa. Qui dici
          che senza mare balneabile la destinazione non ti va bene affatto: è un filtro{' '}
          <strong>duro</strong>, esclude invece di penalizzare. Il mare a dicembre non è mare
          con un punteggio più basso.
        </p>

        <div className="checkline">
          <input
            id="f-sea-on"
            type="checkbox"
            checked={seaRequested}
            onChange={(e) => set({ seaRequired: e.target.checked })}
          />
          <label htmlFor="f-sea-on">Voglio solo destinazioni con mare balneabile</label>
        </div>

        {seaRequested && (
          <Presets
            label="Soglie rapide"
            value={criteria.seaTempMin}
            options={SEA_PRESETS}
            onPick={(value) => set({ seaTempMin: value })}
          />
        )}

        <div className="field">
          <label htmlFor="f-sea">
            Temperatura minima dell’acqua: <strong>{criteria.seaTempMin} °C</strong>
          </label>
          <input
            id="f-sea"
            type="range"
            min="10"
            max="28"
            step="1"
            style={{ width: '100%', accentColor: 'var(--brand-600)' }}
            disabled={!seaRequested}
            value={criteria.seaTempMin}
            onChange={(e) => set({ seaTempMin: Number(e.target.value) })}
          />
        </div>
      </Group>

      <Group title="Tipo di destinazione">
        {DESTINATION_TYPES.map((type) => (
          <div className="checkline" key={type.key}>
            <input
              id={`t-${type.key}`}
              type="checkbox"
              checked={criteria.allowedTypes.includes(type.key)}
              onChange={() => toggleType(type.key)}
            />
            <label htmlFor={`t-${type.key}`}>{type.label}</label>
          </div>
        ))}
      </Group>

      {/* Anche a mano, non solo dal modello. Un criterio raggiungibile per la
          sola via dell'interprete sarebbe invisibile a chi entra dai filtri, e
          impossibile da correggere per chi non ha un modello configurato. */}
      <Group title="Carattere del posto" defaultOpen={false}>
        <p className="filters__note">
          Non escludono nessuno: aggiungono <strong>{THEME_BONUS} punti</strong> a chi porta
          quell’etichetta (al massimo {THEME_BONUS_MAX}). Servono a separare destinazioni vicine
          quando gli interessi da soli non bastano — “gotico” per Halloween, “alpino” per la
          settimana bianca.
        </p>
        <div className="segctl segctl--wrap" role="group" aria-label="Carattere del posto">
          {THEMES.map((tema) => (
            <button
              key={tema.key}
              type="button"
              aria-pressed={(criteria.themes || []).includes(tema.key)}
              title={tema.hint}
              onClick={() => toggleTheme(tema.key)}
            >
              {tema.label}
            </button>
          ))}
        </div>
      </Group>

      {/* Ancorato in fondo alla sidebar, come nel mockup desktop. */}
      <div className="filters__reset">
        <button type="button" className="btn btn--primary btn--block" onClick={onReset}>
          Reimposta filtri
        </button>
      </div>
    </aside>
  )
}
