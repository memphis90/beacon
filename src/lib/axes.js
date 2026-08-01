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
  /**
   * L'unico asse che nessuno compila: si calcola.
   *
   * "Economico" era una parola che l'app non sapeva usare — il budget è un
   * filtro numerico, e senza una cifra non si attivava nulla. Serviva un modo
   * di dire "costa poco" come preferenza invece che come veto.
   *
   * Assegnarlo a mano però avrebbe creato due verità sullo stesso fatto: il
   * costo è già un numero nel dato, e un punteggio di economicità scritto a
   * parte potrebbe contraddire il prezzo mostrato sulla stessa card. Qui
   * invece viene DA quel prezzo: la destinazione più cara del catalogo vale 0,
   * la più economica 100. Non può contraddirlo perché è lui.
   *
   * Il grigio-ardesia lo distingue dagli otto interessi, che sono gusti: non
   * è un colore della palette categorica, ed è voluto — questo asse è di
   * un'altra natura, e la barra deve dirlo prima della didascalia.
   */
  { key: 'value', label: 'Economicità', color: '#6b7d8c', derived: true, hint: 'Quanto costa rispetto al resto del catalogo. Calcolato dai costi, non assegnato: si corregge il prezzo, non questo.' },
]

/** Gli assi che si compilano a mano: l'editor mostra questi. */
export const EDITABLE_AXES = AXES.filter((a) => !a.derived)

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
