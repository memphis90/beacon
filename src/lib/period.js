import { MONTHS } from './axes.js'

/**
 * Dalle date al periodo, dicendo cosa si perde per strada.
 *
 * Le date sono il modo in cui si pensa a un viaggio — "dal 12 al 19 agosto" —
 * ma i dati climatici hanno risoluzione MENSILE: medie di dieci anni, mese per
 * mese. Di "12-19 agosto" questo strumento sa esattamente quanto sa di tutto
 * agosto, né più né meno.
 *
 * Il rischio di un selettore di date è quindi promettere una precisione che
 * non c'è, che è la stessa bugia del prezzo puntuale al posto della fascia.
 * La soluzione non è rinunciare alle date: è accettarle in ingresso e
 * dichiarare in uscita su che cosa si sta davvero rispondendo. Chi legge
 * decide se gli basta.
 */

const GIORNO = 24 * 60 * 60 * 1000

const valida = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && !Number.isNaN(Date.parse(iso))

/**
 * @returns {null | { nights, month, spanning, months, label }}
 *   `null` se le date non sono utilizzabili. `spanning` dice che il periodo
 *   attraversa due mesi, e `month` è quello in cui cade la maggior parte dei
 *   giorni — non il primo, che su un 28 agosto-10 settembre sarebbe la
 *   risposta sbagliata.
 */
export function periodFromDates(from, to) {
  if (!valida(from) || !valida(to)) return null

  const inizio = new Date(`${from}T00:00:00Z`)
  const fine = new Date(`${to}T00:00:00Z`)
  const notti = Math.round((fine - inizio) / GIORNO)
  if (notti < 1) return null

  // Quante notti cadono in ciascun mese: è il conteggio che decide quale
  // media climatica rappresenta meglio il soggiorno.
  const perMese = new Map()
  for (let i = 0; i < notti; i += 1) {
    const g = new Date(inizio.getTime() + i * GIORNO)
    const m = g.getUTCMonth() + 1
    perMese.set(m, (perMese.get(m) || 0) + 1)
  }

  const mesi = [...perMese.entries()].sort((a, b) => b[1] - a[1])
  const month = mesi[0][0]
  const spanning = mesi.length > 1

  return {
    nights: Math.min(60, notti),
    month,
    spanning,
    months: mesi.map(([m, giorni]) => ({ month: m, nights: giorni })),
    label: spanning
      ? `${notti} notti a cavallo fra ${mesi.map(([m]) => MONTHS[m - 1].toLowerCase()).join(' e ')}: uso la media di ${MONTHS[month - 1].toLowerCase()}`
      : `${notti} notti · uso la media di ${MONTHS[month - 1].toLowerCase()}`,
  }
}

/** Le date di oggi e fra una settimana, per il valore iniziale del campo. */
export function defaultDates(oggi = new Date()) {
  const iso = (d) => d.toISOString().slice(0, 10)
  const partenza = new Date(oggi.getTime() + 30 * GIORNO)
  return { from: iso(partenza), to: iso(new Date(partenza.getTime() + 7 * GIORNO)) }
}
