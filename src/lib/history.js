/**
 * Cronologia delle ricerche.
 *
 * Vive in `localStorage` come tutto il resto: non c'è un account, non c'è un
 * server, e la cronologia non lascia questa macchina.
 *
 * Conserva anche i criteri già interpretati, non solo la frase: rieseguire una
 * ricerca vecchia deve dare lo stesso risultato di allora, anche se nel
 * frattempo le regole o il modello sono cambiati.
 */
export const HISTORY_KEY = 'destination-finder:history:v1'

const MAX = 20

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(entries) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    /* quota piena: la cronologia è una comodità, non un requisito */
  }
  return entries
}

/**
 * Aggiunge una ricerca in testa.
 * Una frase identica non viene duplicata: risale, con l'orario aggiornato.
 */
export function addToHistory(entries, { text, patch, source }) {
  const clean = String(text || '').trim()
  if (!clean) return entries

  const senzaDoppione = entries.filter((e) => e.text !== clean)
  const next = [
    { id: `${Date.now()}`, text: clean.slice(0, 200), patch, source, at: Date.now() },
    ...senzaDoppione,
  ].slice(0, MAX)

  return persist(next)
}

export function removeFromHistory(entries, id) {
  return persist(entries.filter((e) => e.id !== id))
}

export function clearHistory() {
  return persist([])
}

/** Etichetta relativa, senza librerie: "poco fa", "3 h", "ieri", "12 mar". */
export function timeAgo(timestamp, now = Date.now()) {
  const minuti = Math.floor((now - timestamp) / 60000)
  if (minuti < 2) return 'poco fa'
  if (minuti < 60) return `${minuti} min`

  const ore = Math.floor(minuti / 60)
  if (ore < 24) return `${ore} h`
  if (ore < 48) return 'ieri'

  return new Date(timestamp).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
