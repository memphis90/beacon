/**
 * I temi: quello che una destinazione **è**, quando gli assi non bastano a dirlo.
 *
 * Gli otto assi misurano quanto una destinazione soddisfa un interesse — mare,
 * cultura, cibo. Ci sono però frasi che non parlano di interessi ma di
 * carattere: "una meta per Halloween" non chiede più cultura, chiede
 * un'atmosfera gotica. Con i soli assi, l'unica traduzione possibile era
 * "cultura 8, vita notturna 9", che porta in cima Barcellona: corretta rispetto
 * ai numeri, sbagliata rispetto alla domanda.
 *
 * Perché un vocabolario chiuso e non testo libero. Il tema è un ponte fra due
 * cose che non si conoscono: il modello, che sa cosa evoca Halloween, e il
 * seed, che sa com'è fatta Praga. Se il modello potesse scrivere qualunque
 * parola, il ponte reggerebbe solo quando indovina la parola esatta usata nel
 * seed, e fallirebbe in silenzio — nessuna corrispondenza è indistinguibile da
 * nessun tema. Con un elenco fisso, entrambe le sponde pescano dallo stesso
 * insieme, e un tema che il modello sceglie male resta visibile nel chip.
 *
 * Perché NON è un nono asse. Un asse è una scala 0-100 su cui ogni
 * destinazione ha un valore, e va stimato per tutte; un tema è un'etichetta che
 * una destinazione ha o non ha. "Gotico" non è una quantità che Creta possiede
 * in misura minore: semplicemente non è quella cosa lì.
 */
/**
 * `axes` è quello che il tema **implica** in termini di interessi.
 *
 * Serve a una sola cosa, ed è un ripiego: quando l'interprete restituisce un
 * tema e nessun peso — succede sulle frasi scarne, "meta per Halloween" ne è
 * l'esempio — senza questa tabella si finirebbe con tutti gli assi a 5, cioè
 * con la classifica generica di sempre più otto punti a chi ha l'etichetta. Il
 * risultato sarebbe la stessa risposta che dà una ricerca vuota, e chi legge
 * concluderebbe che il tema non ha funzionato.
 *
 * Non è il modello a decidere questi numeri e non cambiano da una frase
 * all'altra: finiscono negli slider, dove si vedono e si correggono. Un tema
 * che non implica un interesse preciso — "romantico" — lascia il campo vuoto,
 * e in quel caso il ripiego resta il predefinito.
 */
export const THEMES = [
  {
    key: 'gotico',
    label: 'Gotico',
    hint: 'Guglie, cattedrali, centri storici cupi. Halloween, atmosfere dark.',
    axes: { culture: 8 },
  },
  {
    key: 'medievale',
    label: 'Medievale',
    hint: 'Mura, borghi fortificati, castelli.',
    axes: { culture: 8 },
  },
  {
    key: 'imperiale',
    label: 'Imperiale',
    hint: 'Palazzi, caffè storici, capitali asburgiche e ottomane.',
    axes: { culture: 8 },
  },
  {
    key: 'vulcanico',
    label: 'Vulcanico',
    hint: 'Vulcani, geyser, sabbia nera, paesaggi lunari.',
    axes: { nature: 9, outdoor: 6 },
  },
  {
    key: 'termale',
    label: 'Termale',
    hint: 'Bagni, terme, sorgenti calde.',
    axes: {},
  },
  {
    key: 'alpino',
    label: 'Alpino',
    hint: 'Alta montagna, rifugi, sci, pareti di roccia.',
    axes: { outdoor: 9, nature: 8 },
  },
  {
    key: 'artico',
    label: 'Artico',
    hint: 'Grande nord, aurora boreale, sole di mezzanotte, fiordi.',
    axes: { nature: 9, offbeat: 6 },
  },
  {
    key: 'balneare',
    label: 'Balneare',
    hint: 'Vacanza da spiaggia nel senso classico: calette, lidi, bagni lunghi.',
    axes: { sea: 9 },
  },
  {
    key: 'gastronomico',
    label: 'Gastronomico',
    hint: 'Meta dove si va apposta per mangiare: stelle, mercati, tradizione forte.',
    axes: { food: 9 },
  },
  {
    key: 'romantico',
    label: 'Romantico',
    hint: 'Viaggio di coppia, anniversari, lune di miele.',
    axes: {},
  },
  {
    key: 'archeologico',
    label: 'Archeologico',
    hint: 'Rovine antiche, siti classici, scavi.',
    axes: { culture: 9 },
  },
  {
    key: 'nordico',
    label: 'Nordico',
    hint: 'Design, Baltico, Scandinavia, luce fredda.',
    axes: { culture: 6 },
  },
]

/**
 * Gli interessi impliciti in un insieme di temi. Su un asse chiesto da due
 * temi vince il valore più alto: sommarli porterebbe fuori scala una richiesta
 * che nella frase era una sola.
 */
export function axesFromThemes(keys = []) {
  const out = {}
  for (const key of keys) {
    const tema = THEMES.find((t) => t.key === key)
    for (const [asse, valore] of Object.entries(tema?.axes || {})) {
      out[asse] = Math.max(out[asse] || 0, valore)
    }
  }
  return out
}

export const THEME_KEYS = THEMES.map((t) => t.key)

export const themeLabel = (key) => THEMES.find((t) => t.key === key)?.label || key

/**
 * Quanto vale un tema che corrisponde, in punti sulla scala 0-100 del punteggio.
 *
 * Otto punti sono deliberatamente pochi: spostano l'ordine fra destinazioni
 * vicine — che è il caso in cui il tema è l'informazione che manca — ma non
 * ribaltano una differenza vera. Se Barcellona batte Praga di venti punti sugli
 * assi che hai chiesto, "gotico" non deve poterlo annullare: vorrebbe dire che
 * un'etichetta pesa più di tutto il resto messo insieme.
 */
export const THEME_BONUS = 8

/** Tetto al bonus complessivo: due temi che corrispondono valgono già molto. */
export const THEME_BONUS_MAX = 16
