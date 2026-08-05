import { useState } from 'react'
import { suggestDestinations } from '../lib/search.js'
import { DESTINATION_TYPES } from '../lib/axes.js'
import { countryName } from '../lib/format.js'

const typeLabel = (key) => DESTINATION_TYPES.find((t) => t.key === key)?.label || key

/**
 * Si compone il confronto da qui, non dalla classifica.
 *
 * Prima l'unico modo di aggiungere una destinazione era il bottone sulla sua
 * card, cioè tornare in classifica e cercarsela. Su mobile, dove la card
 * compatta non ha bottoni, non ci sarebbe stato modo affatto.
 *
 * Niente `role="combobox"`: un combobox ARIA fatto a metà — senza
 * `aria-activedescendant` coerente, senza le frecce, senza annunciare quanti
 * risultati ci sono — promette a un lettore di schermo un comportamento che
 * poi non trova. Qui c'è un campo che filtra e una lista di bottoni veri: il
 * Tab li raggiunge, Invio li attiva, ed è tutto ciò che serve.
 *
 * La destinazione aperta è la prima e non si toglie: un confronto che non la
 * contiene non è il confronto di questa scheda.
 */
export default function ComparePicker({
  corrente, aggiunte, catalogo, max, onAggiungi, onTogli, onApri,
}) {
  const [query, setQuery] = useState('')

  const scelte = [corrente, ...aggiunte]
  const pieno = scelte.length >= max
  const suggerimenti = pieno
    ? []
    : suggestDestinations(catalogo, query, { exclude: scelte.map((x) => x.id), limit: 6 })

  return (
    <section className="cpick">
      <h4 className="cpick__title">Confronta</h4>

      <ul className="cpick__chips">
        {scelte.map((x, i) => (
          <li key={x.id} className={`chip${i === 0 ? ' chip--fisso' : ''}`}>
            {x.name}
            {i > 0 && (
              <button
                type="button"
                className="chip__x"
                aria-label={`Togli ${x.name} dal confronto`}
                onClick={() => onTogli(x.id)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {pieno ? (
        <p className="cpick__pieno">
          Il confronto è pieno: {max} destinazioni. Togline una per cambiarla.
        </p>
      ) : (
        <>
          <label htmlFor="cpick-q" className="visually-hidden">
            Cerca una destinazione da aggiungere al confronto
          </label>
          <input
            id="cpick-q"
            type="search"
            className="control"
            placeholder="Aggiungi una destinazione…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <ul className="cpick__list">
            {suggerimenti.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => { onAggiungi(x.id); setQuery('') }}
                >
                  <b>{x.name}</b>
                  <span>{countryName(x.country)} · {typeLabel(x.type).toLowerCase()}</span>
                </button>
              </li>
            ))}
            {query && suggerimenti.length === 0 && (
              <li className="cpick__vuoto">Nessuna destinazione per «{query}»</li>
            )}
          </ul>
        </>
      )}

      {/* Con la sola destinazione aperta non c'è niente da confrontare, e il
          pannello mostrerebbe una colonna sola. */}
      <button
        type="button"
        className="btn btn--primary"
        onClick={onApri}
        disabled={scelte.length < 2}
      >
        Apri il confronto
      </button>
    </section>
  )
}
