import DestinationImage from './DestinationImage.jsx'
import DetailMap from './DetailMap.jsx'
import ScoreBreakdown from './ScoreBreakdown.jsx'
import ComparePicker from './ComparePicker.jsx'
import { DESTINATION_TYPES, MONTHS } from '../lib/axes.js'
import { climateSummary } from '../lib/scoring.js'
import { themeLabel } from '../lib/themes.js'
import { countryFlag, countryName, eurRange, monthName, temp } from '../lib/format.js'

const typeLabel = (key) => DESTINATION_TYPES.find((t) => t.key === key)?.label || key

const COST_ROWS = [
  ['accommodation', 'Alloggio', 'a notte'],
  ['food_per_day', 'Cibo', 'al giorno'],
  ['transport_local_day', 'Trasporti locali', 'al giorno'],
]

export default function DetailPanel({
  entry, criteria, onClose, onEdit, closing = false,
  catalogo, aggiunte, onAggiungiAlConfronto, onTogliDalConfronto, onApriConfronto,
}) {
  const { destination, scoring, cost } = entry
  const monthClimate = climateSummary(destination, criteria.month)
  const isApprox = destination.climate_source === 'seed_approx'

  return (
    /**
     * Al centro, non di lato.
     *
     * Il pannello laterale nasceva quando i risultati restavano visibili
     * accanto, e aveva senso: confrontavi la scheda con la griglia. Da quando
     * il pulsante della critica sta in basso a destra, però, quella colonna
     * gli finisce sopra — e resta comunque la finestra più stretta della
     * pagina per il contenuto più denso che l'app ha, con la tabella
     * dell'aritmetica e la mappa dentro.
     */
    <div
      className={`overlay overlay--center${closing ? ' overlay--closing' : ''}`}
      onClick={onClose}
      role="presentation"
    >
      <section
        className="panel panel--modal panel--detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Dettaglio di ${destination.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel__head">
          <div>
            <h2>{destination.name}</h2>
            <p>
              {countryFlag(destination.country)} {countryName(destination.country)} ·{' '}
              {typeLabel(destination.type)} · raggio {destination.radius_km} km
            </p>
          </div>
          <button type="button" className="panel__close" onClick={onClose} aria-label="Chiudi">×</button>
        </header>

        <div className="panel__body">
          <div className="card__media" style={{ height: 220, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <DestinationImage destination={destination} />
            <span className="card__type">{typeLabel(destination.type)}</span>
          </div>
          {/* Le licenze CC-BY richiedono l'attribuzione: non è un dettaglio
              facoltativo, è la condizione per poter usare la foto. */}
          {destination.image_credit && destination.image_url && (
            <p className="imagecredit">Foto: {destination.image_credit} — Wikimedia Commons</p>
          )}

          <div className="section">
            <h3>Punteggio</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>
                {scoring.total == null ? '—' : scoring.total.toFixed(1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ScoreBreakdown scoring={scoring} tall showLegend={false} />
              </div>
            </div>

            {/* L'aritmetica per esteso. Da quando la barra segmentata usa tre
                soli colori, questa tabella è l'UNICO posto in cui si vede quale
                asse ha prodotto il totale — cioè ciò che il §9 del planning
                chiede di poter correggere. Lo swatch colorato porta l'identità
                dell'asse; il colore non codifica mai il valore. */}
            <div className="scorecard">
              <div className="scorecard__head">Come nasce questo punteggio</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Asse</th>
                    <th className="num">Peso</th>
                    <th className="num">Punteggio</th>
                    <th className="num">Contributo</th>
                  </tr>
                </thead>
                <tbody>
                  {scoring.contributions.map((c) => (
                    <tr key={c.key} className={c.weight === 0 ? 'is-muted' : undefined}>
                      <td>
                        <span className="table__swatch" style={{ background: c.color }} />
                        {c.label}
                      </td>
                      <td className="num">{c.weight}</td>
                      {/* Quando la stagione ha ridotto il mare, si vedono
                          tutti e due i numeri e il perché: un punteggio che
                          cambia senza spiegazione è un punteggio di cui non
                          ci si può fidare. */}
                      <td className="num">
                        {c.seasonal ? (
                          <>
                            <s className="scorecard__was">{c.baseScore}</s> {c.score}
                            <small className="scorecard__why">
                              {c.seasonal.temp != null
                                ? `mare a ${c.seasonal.temp} °C in ${MONTHS[c.seasonal.month - 1].toLowerCase()}`
                                : 'senza mare'}
                            </small>
                          </>
                        ) : c.score}
                      </td>
                      <td className="num">{c.weight === 0 ? '—' : c.contribution.toFixed(1)}</td>
                    </tr>
                  ))}
                  {/* Il bonus tematico ha una riga sua, con la sua origine
                      scritta accanto: è l'unico punto in cui il totale si
                      scosta dalla somma dei contributi, e senza questa riga
                      l'aritmetica non tornerebbe — che è il modo peggiore di
                      perdere la fiducia di chi la sta controllando. */}
                  {scoring.themeBonus > 0 && (
                    <tr className="scorecard__theme">
                      <td>
                        <span className="table__swatch table__swatch--theme" />
                        Tema {scoring.matchedThemes.map(themeLabel).join(', ').toLowerCase()}
                      </td>
                      <td className="num">—</td>
                      <td className="num">—</td>
                      <td className="num">+{scoring.themeBonus.toFixed(1)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="scorecard__total">
                    <td>Totale</td>
                    <td className="num">{scoring.weightSum}</td>
                    <td className="num" />
                    <td className="num">
                      <span className="scorecard__totalvalue">
                        {scoring.total == null ? '—' : scoring.total.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="section">
            <h3>Costi stimati <span className="badge badge--warn">stime, non dati</span></h3>
            <table className="table">
              <thead>
                <tr><th>Voce</th><th className="num">Fascia</th><th>Unità</th></tr>
              </thead>
              <tbody>
                {COST_ROWS.map(([key, label, unit]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td className="num">{eurRange(destination.costs[key].low, destination.costs[key].high)}</td>
                    <td style={{ color: 'var(--ink-3)' }}>{unit}, a persona</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{criteria.nights} notti</td>
                  <td className="num">{eurRange(cost.low, cost.high)}</td>
                  <td style={{ color: 'var(--ink-3)', fontWeight: 400 }}>volo escluso</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="section">
            <h3>
              Clima mensile{' '}
              {isApprox && <span className="badge badge--warn">stime del seed, non Open-Meteo</span>}
            </h3>
            <div className="climate">
              {MONTHS.map((name, index) => {
                const m = destination.climate?.[String(index + 1)] || {}
                const active = criteria.month === index + 1
                const seaCold = m.sea_temp != null && m.sea_temp < criteria.seaTempMin
                return (
                  <div key={name} className={`climate__cell${active ? ' climate__cell--active' : ''}`}>
                    <b>{name.slice(0, 3).toUpperCase()}</b>
                    {m.temp_avg ?? '—'}°
                    <div className={m.sea_temp == null || seaCold ? 'climate__sea--cold' : 'climate__sea'}>
                      {m.sea_temp == null ? '–' : `${m.sea_temp}°`}
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
              Riga alta: temperatura media dell’aria. Riga bassa: temperatura del mare.{' '}
              {criteria.month ? (
                <>
                  A {monthName(criteria.month).toLowerCase()} il mare è a{' '}
                  <strong>{temp(monthClimate.sea_temp)}</strong>, con{' '}
                  {monthClimate.rain_days ?? '—'} giorni di pioggia attesi.
                </>
              ) : (
                <>
                  Senza un mese scelto: il mare arriva al massimo a{' '}
                  <strong>{temp(monthClimate.sea_temp)}</strong>, e la media annua è di{' '}
                  {monthClimate.rain_days ?? '—'} giorni di pioggia al mese.
                </>
              )}
            </p>
          </div>

          {destination.pois?.length > 0 && (
            <div className="section">
              <h3>Punti di interesse <span className="badge">curati a mano</span></h3>
              <DetailMap destination={destination} />
              <ol className="poilist">
                {destination.pois.map((poi, index) => (
                  <li key={poi.name}>
                    <span className="poi__n">{index + 1}</span>
                    {poi.name}
                    <span className="poi__kind">{poi.kind}</span>
                  </li>
                ))}
              </ol>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
                Elenco editoriale, non un itinerario generato: la generazione di itinerari è
                prevista in Fase 3 e non è implementata.
              </p>
            </div>
          )}

          {destination.notes && (
            <div className="section">
              <h3>Note</h3>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>{destination.notes}</p>
            </div>
          )}
          {/* Il selettore sta nel corpo e non nel piede: il piede è una riga
              orizzontale di bottoni, e questa è una sezione alta. */}
          <div className="section">
            <ComparePicker
              corrente={destination}
              aggiunte={aggiunte}
              catalogo={catalogo}
              max={4}
              onAggiungi={onAggiungiAlConfronto}
              onTogli={onTogliDalConfronto}
              onApri={onApriConfronto}
            />
          </div>
        </div>

        <footer className="panel__foot">
          <button type="button" className="btn btn--primary" onClick={onEdit}>
            Modifica punteggi
          </button>
          <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Chiudi
          </button>
        </footer>
      </section>
    </div>
  )
}
