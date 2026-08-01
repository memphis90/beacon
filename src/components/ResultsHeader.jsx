import { IconHeart } from './Icons.jsx'
import { monthName } from '../lib/format.js'

/**
 * Controllo di ordinamento segmentato, come nel mockup desktop.
 *
 * Il mockup ha tre bottoni, noi quattro ordinamenti: "Costo" al secondo clic
 * inverte la direzione invece di perderne una. La freccia lo dichiara, così
 * non è una scorciatoia nascosta.
 */
const TABS = [
  { key: 'score', label: 'Punteggio' },
  { key: 'cost', label: 'Costo' },
  { key: 'name', label: 'Nome' },
]

const isCost = (sort) => sort === 'cost_asc' || sort === 'cost_desc'

export default function ResultsHeader({
  count, total, criteria, onSort, onlyFavourites, favouritesCount, onFavourites,
}) {
  const activeTab = isCost(criteria.sortBy) ? 'cost' : criteria.sortBy

  const pick = (key) => {
    if (key !== 'cost') return onSort(key)
    onSort(criteria.sortBy === 'cost_asc' ? 'cost_desc' : 'cost_asc')
  }

  const costArrow = criteria.sortBy === 'cost_desc' ? ' ↓' : ' ↑'

  return (
    <div className="results__head">
      <div className="results__count">
        {count} {count === 1 ? 'destinazione' : 'destinazioni'}{' '}
        <span>
          su {total} · {criteria.nights} notti
          {criteria.month ? ` a ${monthName(criteria.month).toLowerCase()}` : ', tutto l’anno'}
        </span>
      </div>

      <div className="results__tools">
        <div className="segctl" role="group" aria-label="Ordina i risultati">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={activeTab === tab.key}
              title={tab.key === 'cost' ? 'Clicca di nuovo per invertire la direzione' : undefined}
              onClick={() => pick(tab.key)}
            >
              {tab.label}
              {tab.key === 'cost' && activeTab === 'cost' && costArrow}
            </button>
          ))}
        </div>

        {/* I preferiti stanno QUI e non nel menu laterale: non sono una
            sezione dove si va, sono un filtro su questa lista — "di tutte
            queste, mostrami solo le mie". Nel menu, accanto a Confronta e
            Parametri, prometteva una pagina propria e invece cambiava i
            risultati alle spalle di chi l'aveva aperto. */}
        <button
          type="button"
          className="btn btn--sm results__fav"
          aria-pressed={onlyFavourites}
          disabled={!onlyFavourites && favouritesCount === 0}
          title={favouritesCount === 0 ? 'Nessun preferito salvato: usa il cuore sulle card' : undefined}
          onClick={onFavourites}
        >
          <IconHeart filled={onlyFavourites} width="15" height="15" />
          Preferiti
          {favouritesCount > 0 && <span className="results__favcount">{favouritesCount}</span>}
        </button>

        {/* Niente più selettore griglia/lista: la lista mostrava le stesse
            informazioni della griglia su una riga più larga, e la scelta fra
            due rese equivalenti è un controllo in più da capire senza niente
            da decidere. Le card restano una griglia che si adatta da sola. */}
      </div>
    </div>
  )
}
