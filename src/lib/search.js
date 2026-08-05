import { countryName } from './format.js'

/**
 * La regola che riconosce una destinazione da un nome o da un paese, in un
 * posto solo.
 *
 * Viveva dentro il filtro della classifica (`scoring.js`) e serviva un
 * consumatore solo. Da quando il dettaglio ha il suo autocomplete i
 * consumatori sono due, e due copie della stessa regola divergono senza che
 * niente lo segnali: la classifica troverebbe Dubrovnik cercando "croazia" e
 * l'autocomplete no.
 */
export function matchesQuery(destination, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true

  // Il nome del paese per esteso, non solo il codice ISO: cercando "croazia"
  // ci si aspetta Dubrovnik, non zero risultati perché nel dato c'è "HR".
  const haystack = [
    destination.name,
    destination.country,
    countryName(destination.country),
  ].join(' ').toLowerCase()

  return haystack.includes(q)
}

/**
 * I suggerimenti dell'autocomplete: le corrispondenze meno quelle già scelte,
 * tagliate a `limit`.
 *
 * L'ordine è quello del catalogo che arriva, non un ordine di rilevanza
 * calcolato qui: chi chiama passa già la lista nell'ordine che gli interessa.
 */
export function suggestDestinations(destinations, query, { exclude = [], limit = 8 } = {}) {
  const fuori = new Set(exclude)
  const out = []

  for (const destination of destinations) {
    if (fuori.has(destination.id)) continue
    if (!matchesQuery(destination, query)) continue
    out.push(destination)
    if (out.length >= limit) break
  }

  return out
}
