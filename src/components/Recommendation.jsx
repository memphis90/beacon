import { recommend } from '../lib/scoring.js'
import { eur } from '../lib/format.js'

/**
 * Due fatti calcolati, non una raccomandazione generata.
 *
 * Il mockup proponeva una prosa in stile assistente con una "percentuale di
 * allineamento" inventata. Qui ogni affermazione è un numero che l'utente può
 * ritrovare nella tabella accanto: se non è d'accordo, sa esattamente dove
 * guardare.
 *
 * Il secondo fatto è quello che vale: il miglior rapporto punteggio/costo
 * spesso NON è il punteggio più alto, ed è la cosa che una classifica ordinata
 * per punteggio nasconde.
 */
export default function Recommendation({ entries, nights }) {
  const result = recommend(entries)
  if (!result) return null

  const { best, value, ratio, coincidono } = result

  return (
    <aside className="reco">
      <p className="reco__title">Cosa dicono i numeri</p>

      <div className="reco__facts">
        <div className="reco__fact">
          <span className="reco__label">Punteggio più alto con i tuoi pesi</span>
          <strong>{best.destination.name}</strong>
          <span className="reco__num">{best.scoring.total.toFixed(1)} su 100</span>
        </div>

        {value && !coincidono && (
          <div className="reco__fact">
            <span className="reco__label">Miglior rapporto punteggio / costo</span>
            <strong>{value.destination.name}</strong>
            <span className="reco__num">
              {ratio.toFixed(1)} punti ogni 100 € · {eur(value.cost.mid)} per {nights} notti
            </span>
          </div>
        )}
      </div>

      {coincidono ? (
        <p className="reco__note">
          È anche quella che rende di più per euro speso: le due risposte coincidono.
        </p>
      ) : (
        <p className="reco__note">
          Le due risposte non coincidono, ed è il caso interessante: la seconda costa meno
          di quanto perde in punteggio.
        </p>
      )}
    </aside>
  )
}
