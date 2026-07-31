/**
 * Unica fonte di verità per gli assi di interesse.
 *
 * L'ORDINE È SIGNIFICATIVO. I colori sono la palette categorica validata
 * (vedi docs/), le cui garanzie di separabilità per daltonismo valgono sulle
 * COPPIE ADIACENTI. La barra segmentata dei contributi disegna i segmenti in
 * quest'ordine, quindi riordinare gli assi qui invalida la validazione.
 * Se aggiungi un asse, ri-esegui il validatore della palette.
 */
export const AXES = [
  { key: 'nature',    label: 'Natura',     color: '#2a78d6', hint: 'Paesaggio, verde, panorami. La natura come cosa da guardare.' },
  { key: 'culture',   label: 'Cultura',    color: '#eb6834', hint: 'Musei, monumenti, centri storici, patrimonio.' },
  { key: 'sea',       label: 'Mare',       color: '#1baf7a', hint: 'Spiagge, balneabilità, vita di costa.' },
  { key: 'food',      label: 'Cibo',       color: '#eda100', hint: 'Cucina locale, mercati, qualità e varietà.' },
  { key: 'nightlife', label: 'Vita notturna', color: '#e87ba4', hint: 'Locali, concerti, movida.' },
  { key: 'outdoor',   label: 'Outdoor',    color: '#008300', hint: 'Trekking, sci, bici, sport acquatici. La natura come cosa da fare.' },
  { key: 'family',    label: 'Famiglia',   color: '#4a3aa7', hint: 'Adatto a bambini: distanze brevi, servizi, attrazioni non solo museali.' },
  { key: 'offbeat',   label: 'Fuori rotta', color: '#e34948', hint: 'Poco battuto dal turismo di massa. Correttivo esplicito alla notorietà.' },
]

export const AXIS_KEYS = AXES.map((a) => a.key)

export const DESTINATION_TYPES = [
  { key: 'city',   label: 'Città' },
  { key: 'area',   label: 'Area' },
  { key: 'island', label: 'Isola' },
]

export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export function emptyWeights(value = 0) {
  return Object.fromEntries(AXIS_KEYS.map((k) => [k, value]))
}

export function emptyScores(value = 50) {
  return Object.fromEntries(AXIS_KEYS.map((k) => [k, value]))
}
