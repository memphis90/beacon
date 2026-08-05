import { MONTHS } from './axes.js'

const EUR = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function eur(value) {
  return EUR.format(Math.round(value))
}

/**
 * I costi si mostrano SEMPRE come fascia.
 *
 * §6 del planning: un valore puntuale comunica una precisione inesistente e
 * distrugge la fiducia nell'output appena l'utente lo verifica.
 */
export function eurRange(low, high) {
  return `${Math.round(low)}–${Math.round(high)} €`
}

export function monthName(month) {
  return MONTHS[month - 1] || ''
}

export function temp(value) {
  return value == null ? '—' : `${Math.round(value)} °C`
}

export function initials(name) {
  return name
    .split(/[\s'-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

/**
 * Copre tutti i paesi presenti in `destinations.json`, e la prova in
 * `test/paesi.test.js` è lì per farlo restare vero: un'espansione del catalogo
 * che porti un paese nuovo la fa fallire.
 *
 * Non è solo etichetta. `matchesQuery` cerca anche sul nome per esteso, quindi
 * un codice senza nome è una destinazione che non si trova scrivendo il suo
 * paese: prima di questa mappa completa, "croazia" pescava Dubrovnik e
 * "germania" non pescava niente.
 */
const COUNTRY_NAMES = {
  PT: 'Portogallo', CZ: 'Rep. Ceca', ES: 'Spagna', EE: 'Estonia',
  IT: 'Italia', ME: 'Montenegro', GR: 'Grecia', NO: 'Norvegia',
  HR: 'Croazia', FR: 'Francia', NL: 'Paesi Bassi', TR: 'Turchia',
  AT: 'Austria', IS: 'Islanda',
  BA: 'Bosnia ed Erzegovina', BE: 'Belgio', BG: 'Bulgaria', CH: 'Svizzera',
  CY: 'Cipro', DE: 'Germania', DK: 'Danimarca', FI: 'Finlandia',
  GB: 'Regno Unito', HU: 'Ungheria', IE: 'Irlanda', LT: 'Lituania',
  LV: 'Lettonia', MK: 'Macedonia del Nord', MT: 'Malta', PL: 'Polonia',
  RO: 'Romania', RS: 'Serbia', SE: 'Svezia', SI: 'Slovenia',
  SK: 'Slovacchia',
}

/** I codici coperti, per la prova che il catalogo non ne porti di nuovi. */
export const COUNTRY_CODES = Object.keys(COUNTRY_NAMES)

export function countryName(code) {
  return COUNTRY_NAMES[code] || code
}

/** Bandiera come emoji, derivata dal codice ISO. Nessun asset da caricare. */
export function countryFlag(code) {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}
