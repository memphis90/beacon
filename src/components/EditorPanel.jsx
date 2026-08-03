import { useRef, useState } from 'react'
import { EDITABLE_AXES, DESTINATION_TYPES, MONTHS, emptyScores } from '../lib/axes.js'
import {
  clearDestinationOverrides,
  clearOverride,
  countOverriddenDestinations,
  countOverriddenFields,
  downloadOverrides,
  isOverridden,
  parseOverridesFile,
  seedById,
  setOverride,
} from '../lib/store.js'
import { countryName } from '../lib/format.js'
import { isAssistantScored, isUnscored } from '../lib/scoring.js'
import { IconChevron, IconSearch, IconTrash } from './Icons.jsx'

const typeLabel = (key) => DESTINATION_TYPES.find((t) => t.key === key)?.label || key

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function blankDestination(name) {
  return {
    __new: true,
    name,
    country: 'IT',
    type: 'city',
    coords: { lat: 41.9, lon: 12.5 },
    radius_km: 30,
    wikidata_id: null,
    wikipedia_title: name,
    wikipedia_title_en: '',
    airports: [],
    scores: emptyScores(50),
    scores_source: 'manual',
    climate_source: 'manual',
    climate: Object.fromEntries(
      MONTHS.map((_, i) => [String(i + 1), { temp_avg: null, temp_max: null, sea_temp: null, rain_days: null }])
    ),
    costs: {
      accommodation: { low: 50, mid: 80, high: 130 },
      food_per_day: { low: 20, mid: 32, high: 55 },
      transport_local_day: { low: 4, mid: 8, high: 15 },
      currency: 'EUR',
    },
    pois: [],
    notes: '',
  }
}

/**
 * Campo con stato di override.
 *
 * Il ripristino sta DENTRO il riquadro insieme al controllo, non accanto
 * all'etichetta: il riquadro accento è ciò che segnala "questo valore non è più
 * quello del seed", e l'azione per annullarlo deve stare dove si vede il
 * problema.
 */
function OField({ label, changed, onReset, children }) {
  return (
    <div className={`ofield${changed ? ' ofield--changed' : ''}`}>
      <span className="ofield__label">{label}</span>
      <div className="ofield__box">
        {children}
        {changed && (
          <button
            type="button"
            className="ofield__reset"
            onClick={onReset}
            title="Riporta questo campo al valore del seed"
          >
            ripristina
          </button>
        )}
      </div>
    </div>
  )
}

const COST_ROWS = [
  ['accommodation', 'Alloggio, a notte'],
  ['food_per_day', 'Cibo, al giorno'],
  ['transport_local_day', 'Trasporti locali, al giorno'],
]

/**
 * L'elenco delle destinazioni: una pagina, non una modale.
 *
 * Consultare cosa si è già corretto non è un'operazione da interrompere e
 * chiudere — è il punto di partenza del lavoro sui parametri. Una modale dice
 * l'opposto: "fai in fretta e torna da dove sei venuto". La modale resta per
 * la modifica vera, che invece È un'operazione: si apre su una destinazione,
 * si cambia, si chiude.
 */
export function ParametersPage({ merged, overrides, onOverridesChange, onPick, onClose, tabs }) {
  const [filtro, setFiltro] = useState('')
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState(null)
  const fileInput = useRef(null)

  /**
   * Le modificate in cima, poi le altre in ordine alfabetico.
   *
   * Non è un vezzo di ordinamento: è la risposta alla domanda con cui si apre
   * questa pagina, "cosa ho già corretto". In fondo a un elenco alfabetico di
   * ventitré voci, tre destinazioni toccate sono invisibili.
   */
  const cercato = filtro.trim().toLowerCase()
  const elenco = merged
    .filter((d) => !cercato || `${d.name} ${countryName(d.country)}`.toLowerCase().includes(cercato))
    .map((d) => ({
      destination: d,
      campi: countOverriddenFields(overrides, d.id),
      nuova: !seedById(d.id),
      daValutare: isUnscored(d),
      daConfermare: isAssistantScored(d) && countOverriddenFields(overrides, d.id) === 0,
    }))
    /* Da valutare in cima, poi le corrette, poi il resto. È l'ordine del
       lavoro: quelle importate dagli script non compaiono nei risultati
       finché qualcuno non le guarda, quindi sono la coda da smaltire. */
    .sort((a, b) =>
      (b.daValutare) - (a.daValutare)
      || (b.campi > 0) - (a.campi > 0)
      || a.destination.name.localeCompare(b.destination.name, 'it'))

  const modificate = elenco.filter((r) => r.campi > 0).length
  const daValutare = elenco.filter((r) => r.daValutare).length
  const daConfermare = elenco.filter((r) => r.daConfermare).length

  const createDestination = (event) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    const slug = slugify(name)
    if (!slug) return
    if (merged.some((d) => d.id === slug)) {
      setMessage({ tone: 'warn', text: `Esiste già una destinazione con id "${slug}".` })
      return
    }
    onOverridesChange({
      ...overrides,
      destinations: { ...overrides.destinations, [slug]: blankDestination(name) },
    })
    setNewName('')
    // Dritti nella scheda: una destinazione appena creata è vuota, e lasciarla
    // nell'elenco vorrebbe dire cercarla per compilarla.
    onPick(slug)
  }

  const importFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseOverridesFile(await file.text())
      onOverridesChange(parsed)
      setMessage({
        tone: 'info',
        text: `Importate le modifiche di ${countOverriddenDestinations(parsed)} destinazioni.`,
      })
    } catch (error) {
      setMessage({ tone: 'warn', text: `Import fallito: ${error.message}` })
    }
    event.target.value = ''
  }

  return (
    <section className="page" aria-label="Parametri delle destinazioni">
      <header className="page__head">
        <div>
          <h2>Parametri delle destinazioni</h2>
          <p>
            Punteggi, costi e clima del catalogo. Le modifiche restano in un layer separato:
            <code> data/destinations.json</code> non viene mai riscritto dall’app.
          </p>
        </div>
        <button type="button" className="btn" onClick={onClose}>Torna ai risultati</button>
      </header>

      {tabs}

      {message && (
        <div className={`notice${message.tone === 'warn' ? ' notice--warn' : ''}`}>{message.text}</div>
      )}

      <div className="inline inline--wrap" style={{ marginBottom: 12 }}>
        <label htmlFor="ed-filtro" className="visually-hidden">Cerca una destinazione</label>
        <span className="filters__search" style={{ flex: 1, minWidth: 200 }}>
          <IconSearch />
          <input
            id="ed-filtro"
            type="search"
            className="control"
            placeholder="Cerca per nome o paese…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </span>
        <form onSubmit={createDestination} className="inline" style={{ marginLeft: 'auto' }}>
          <label htmlFor="ed-new" className="visually-hidden">Nome nuova destinazione</label>
          <input
            id="ed-new"
            className="control"
            style={{ width: 200 }}
            placeholder="Nome nuova destinazione"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn--accent" disabled={!newName.trim()}>
            Aggiungi
          </button>
        </form>
      </div>

      <p className="filters__note" style={{ marginBottom: 12 }}>
        {modificate === 0
          ? `${merged.length} destinazioni, nessuna ancora corretta. I punteggi del seed sono stime: correggere quelle che conosci è il lavoro che rende utile il ranking.`
          : `${modificate} ${modificate === 1 ? 'destinazione corretta' : 'destinazioni corrette'} su ${merged.length}. Sono in cima all’elenco.`}
        {daValutare > 0 && (
          <>
            {' '}<strong>{daValutare} sono da valutare</strong>: hanno solo l’anagrafica importata
            dagli script e restano fuori dai risultati finché non ricevono i punteggi.
          </>
        )}
        {daConfermare > 0 && (
          <>
            {' '}<strong>{daConfermare} sono da confermare</strong>: i punteggi li ha scritti
            l’assistente e sono in classifica, ma nessuno li ha ancora verificati. Correggerne
            una la fa diventare tua.
          </>
        )}
      </p>

      <ul className="destlist">
        {elenco.map(({ destination: d, campi, nuova, daValutare: manca, daConfermare }) => (
          <li
            key={d.id}
            className={`destlist__row${campi > 0 ? ' destlist__row--touched' : ''}${manca ? ' destlist__row--todo' : ''}`}
          >
            <button type="button" className="destlist__pick" onClick={() => onPick(d.id)}>
              <span className="destlist__name">
                {d.name}
                {manca && <span className="badge badge--warn">da valutare</span>}
                {/* La provenienza resta scritta: questi punteggi sono
                    un'opinione dell'assistente, non un giudizio di chi cerca —
                    e il §9 chiede il secondo. Correggerli li fa diventare tuoi. */}
                {daConfermare && <span className="badge badge--info">da confermare</span>}
                {nuova && !manca && <span className="badge badge--edit">creata da te</span>}
                {!nuova && campi > 0 && (
                  <span className="badge badge--edit">
                    {campi} {campi === 1 ? 'campo' : 'campi'}
                  </span>
                )}
              </span>
              <small>{countryName(d.country)} · {typeLabel(d.type)}</small>
            </button>

            {/* Il ripristino sta qui e non solo dentro la scheda: da qui si
                vede cosa si è toccato, ed è il momento in cui viene da disfare
                una correzione sbagliata. */}
            {campi > 0 && (
              <button
                type="button"
                className="destlist__reset"
                title={`Riporta ${d.name} ai valori del seed`}
                aria-label={`Riporta ${d.name} ai valori del seed`}
                onClick={() => onOverridesChange(clearDestinationOverrides(overrides, d.id))}
              >
                <IconTrash width="15" height="15" />
              </button>
            )}

            <IconChevron width="16" height="16" className="destlist__go" />
          </li>
        ))}
      </ul>

      {elenco.length === 0 && (
        <p className="hside__empty">Nessuna destinazione corrisponde a “{filtro.trim()}”.</p>
      )}

      <div className="page__foot">
        <button type="button" className="btn btn--primary" onClick={() => downloadOverrides(overrides)}>
          Esporta overrides.json
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          Importa…
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
      </div>
    </section>
  )
}

/** La modifica vera: una destinazione per volta, in una modale. */
export default function EditorPanel({ merged, overrides, onOverridesChange, initialId, onClose, tabs }) {
  const [message, setMessage] = useState(null)

  const destination = merged.find((d) => d.id === initialId)
  if (!destination) return null

  const fromSeed = Boolean(seedById(destination.id))
  const read = (path) => path.reduce((node, key) => (node == null ? undefined : node[key]), destination)
  // Per una destinazione creata ex novo tutto vive nell'override: marcare ogni
  // campo come "modificato" sarebbe rumore senza informazione.
  const changed = (path) => fromSeed && isOverridden(overrides, destination.id, path)
  const write = (path, value) => onOverridesChange(setOverride(overrides, destination.id, path, value))
  const reset = (path) => onOverridesChange(clearOverride(overrides, destination.id, path))

  const numberOrNull = (raw) => (raw === '' ? null : Number(raw))

  return (
    <div className="overlay overlay--center" onClick={onClose} role="presentation">
      <section
        className="panel panel--modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Parametri di ${destination.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel__head">
          <div>
            <h2>{destination.name}</h2>
            <p>
              {countryName(destination.country)} · {typeLabel(destination.type)} — punteggi,
              costi e clima. Ogni campo corretto resta segnato.
            </p>
          </div>
          <button type="button" className="panel__close" onClick={onClose} aria-label="Chiudi">×</button>
        </header>

        {tabs}

        <div className="panel__body">
          {message && (
            <div className={`notice${message.tone === 'warn' ? ' notice--warn' : ''}`}>{message.text}</div>
          )}

          <div className="section">
            <div className="inline inline--wrap">
              {!fromSeed && <span className="badge badge--edit">creata da te</span>}
              {fromSeed && countOverriddenFields(overrides, destination.id) > 0 && (
                <span className="badge badge--edit">
                  {countOverriddenFields(overrides, destination.id)} campi corretti
                </span>
              )}
            </div>
          </div>

          <div className="section">
            <h3>Anagrafica</h3>
            <div className="editor__grid">
              <OField label="Nome" changed={changed(['name'])} onReset={() => reset(['name'])}>
                <input className="control" value={read(['name']) ?? ''} onChange={(e) => write(['name'], e.target.value)} />
              </OField>
              <OField label="Paese (ISO 2)" changed={changed(['country'])} onReset={() => reset(['country'])}>
                <input
                  className="control"
                  maxLength={2}
                  value={read(['country']) ?? ''}
                  onChange={(e) => write(['country'], e.target.value.toUpperCase())}
                />
              </OField>
              <OField label="Tipo" changed={changed(['type'])} onReset={() => reset(['type'])}>
                <select className="control" value={read(['type'])} onChange={(e) => write(['type'], e.target.value)}>
                  {DESTINATION_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </OField>
              <OField label="Raggio (km)" changed={changed(['radius_km'])} onReset={() => reset(['radius_km'])}>
                <input
                  type="number" className="control" min="1"
                  value={read(['radius_km']) ?? ''}
                  onChange={(e) => write(['radius_km'], Number(e.target.value) || 1)}
                />
              </OField>
              <OField label="Latitudine" changed={changed(['coords', 'lat'])} onReset={() => reset(['coords', 'lat'])}>
                <input
                  type="number" step="0.0001" className="control"
                  value={read(['coords', 'lat']) ?? ''}
                  onChange={(e) => write(['coords', 'lat'], Number(e.target.value))}
                />
              </OField>
              <OField label="Longitudine" changed={changed(['coords', 'lon'])} onReset={() => reset(['coords', 'lon'])}>
                <input
                  type="number" step="0.0001" className="control"
                  value={read(['coords', 'lon']) ?? ''}
                  onChange={(e) => write(['coords', 'lon'], Number(e.target.value))}
                />
              </OField>
              <OField label="Titolo Wikipedia (it)" changed={changed(['wikipedia_title'])} onReset={() => reset(['wikipedia_title'])}>
                <input
                  className="control"
                  value={read(['wikipedia_title']) ?? ''}
                  onChange={(e) => write(['wikipedia_title'], e.target.value)}
                />
              </OField>
              <OField label="Titolo Wikipedia (en)" changed={changed(['wikipedia_title_en'])} onReset={() => reset(['wikipedia_title_en'])}>
                <input
                  className="control"
                  value={read(['wikipedia_title_en']) ?? ''}
                  onChange={(e) => write(['wikipedia_title_en'], e.target.value)}
                />
              </OField>
              <OField label="Aeroporti (separati da virgola)" changed={changed(['airports'])} onReset={() => reset(['airports'])}>
                <input
                  className="control"
                  value={(read(['airports']) || []).join(', ')}
                  onChange={(e) =>
                    write(['airports'], e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
                  }
                />
              </OField>
            </div>
          </div>

          <div className="section">
            <h3>Punteggi (0–100)</h3>
            {EDITABLE_AXES.map((axis) => {
              const path = ['scores', axis.key]
              const value = read(path) ?? 0
              const isChanged = changed(path)
              return (
                <div className={`scorerow${isChanged ? ' scorerow--changed' : ''}`} key={axis.key}>
                  <span className="scorerow__dot" style={{ background: axis.color }} />
                  <label className="scorerow__name" htmlFor={`s-${axis.key}`}>
                    {axis.label}
                    {isChanged && (
                      <button type="button" className="ofield__reset" style={{ marginLeft: 8 }} onClick={() => reset(path)}>
                        ripristina
                      </button>
                    )}
                  </label>
                  <input
                    id={`s-${axis.key}`}
                    type="range" min="0" max="100" step="1"
                    value={value}
                    onChange={(e) => write(path, Number(e.target.value))}
                  />
                  <input
                    type="number" className="control" min="0" max="100"
                    aria-label={`${axis.label}, valore numerico`}
                    value={value}
                    onChange={(e) => write(path, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  />
                </div>
              )
            })}
            {/* Il nono asse non ha un cursore, e la ragione va detta qui e non
                in un README: chi apre questa pagina per correggerlo deve
                capire in trenta secondi dove si corregge davvero. */}
            <div className="scorerow scorerow--derived">
              <span className="scorerow__dot" style={{ background: '#6b7d8c' }} />
              <span className="scorerow__name">Economicità</span>
              <p className="scorerow__note">
                Calcolata dai costi qui sopra, rispetto al resto del catalogo. Non si modifica:
                se una destinazione risulta troppo cara o troppo economica, il numero da correggere è il prezzo.
              </p>
            </div>
            <OField
              label="Origine dei punteggi"
              changed={changed(['scores_source'])}
              onReset={() => reset(['scores_source'])}
            >
              <select
                className="control"
                style={{ maxWidth: 260 }}
                value={read(['scores_source']) ?? 'manual'}
                onChange={(e) => write(['scores_source'], e.target.value)}
              >
                <option value="manual">manual — non sovrascrivibile dagli import</option>
                <option value="derived">derived — rigenerabile dagli script</option>
              </select>
            </OField>
          </div>

          <div className="section">
            <h3>Costi, per persona <span className="badge badge--warn">sempre una fascia</span></h3>
            <table className="table">
              <thead>
                <tr><th>Voce</th><th className="num">Bassa</th><th className="num">Media</th><th className="num">Alta</th></tr>
              </thead>
              <tbody>
                {COST_ROWS.map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    {['low', 'mid', 'high'].map((band) => {
                      const path = ['costs', key, band]
                      return (
                        <td className={`num numcell${changed(path) ? ' numcell--changed' : ''}`} key={band}>
                          <input
                            type="number" min="0" className="control"
                            style={{ width: 90, textAlign: 'right' }}
                            aria-label={`${label}, fascia ${band}`}
                            value={read(path) ?? ''}
                            onChange={(e) => write(path, Number(e.target.value) || 0)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section">
            <h3>
              Clima mensile
              {read(['climate_source']) === 'seed_approx' && (
                <span className="badge badge--warn" style={{ marginLeft: 8 }}>stime del seed</span>
              )}
            </h3>
            <div className="table--scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mese</th>
                    <th className="num">T. media</th>
                    <th className="num">T. max</th>
                    <th className="num">Mare</th>
                    <th className="num">Gg pioggia</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((name, index) => {
                    const month = String(index + 1)
                    return (
                      <tr key={name}>
                        <td>{name}</td>
                        {['temp_avg', 'temp_max', 'sea_temp', 'rain_days'].map((field) => {
                          const path = ['climate', month, field]
                          return (
                            <td className={`num numcell${changed(path) ? ' numcell--changed' : ''}`} key={field}>
                              <input
                                type="number" className="control"
                                style={{ width: 78, textAlign: 'right' }}
                                aria-label={`${name}, ${field}`}
                                value={read(path) ?? ''}
                                placeholder={field === 'sea_temp' ? 'no mare' : '—'}
                                onChange={(e) => write(path, numberOrNull(e.target.value))}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
              Lasciare vuoto il campo <strong>Mare</strong> significa “non ha accesso al mare”, non
              “acqua a 0 °C”: con il filtro mare attivo la destinazione viene esclusa in ogni mese.
            </p>
          </div>

          <div className="section">
            <h3>Note</h3>
            <OField label="Testo libero" changed={changed(['notes'])} onReset={() => reset(['notes'])}>
              <textarea
                className="control"
                rows={3}
                value={read(['notes']) ?? ''}
                onChange={(e) => write(['notes'], e.target.value)}
              />
            </OField>
          </div>
        </div>

        <footer className="panel__foot">
          {/* Esporta e importa sono passati alla pagina: riguardano tutte le
              destinazioni, non quella aperta qui. */}
          <button
            type="button"
            className="btn"
            disabled={!overrides.destinations[destination.id]}
            onClick={() => {
              const wasNew = !fromSeed
              onOverridesChange(clearDestinationOverrides(overrides, destination.id))
              // Una destinazione creata da te, eliminata, non esiste più:
              // restare sulla sua scheda mostrerebbe campi vuoti.
              if (wasNew) onClose()
              else setMessage({ tone: 'info', text: 'Valori riportati al seed.' })
            }}
          >
            {fromSeed ? 'Ripristina dal seed' : 'Elimina destinazione'}
          </button>
          <button type="button" className="btn btn--primary" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Chiudi
          </button>
        </footer>
      </section>
    </div>
  )
}
