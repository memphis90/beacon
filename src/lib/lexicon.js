/**
 * Le altre lingue, senza riscrivere le regole.
 *
 * `parseQuery.js` è fatto di espressioni italiane: mesi, durate, negazioni,
 * parole per asse. Tradurle in ogni lingua vorrebbe dire mantenere N
 * grammatiche che divergono, e ogni correzione andrebbe fatta N volte.
 *
 * Qui si fa il contrario: la frase viene **normalizzata all'italiano** prima
 * di essere letta, sostituendo le sole parole che le regole conoscono. Non è
 * una traduzione — è un dizionario di parole-chiave, un centinaio per lingua,
 * e tutto il resto della frase passa intatto perché tanto le regole lo
 * ignorerebbero comunque.
 *
 * **Perché non usare il modello per tradurre.** Sarebbe più preciso, e
 * toglierebbe alle regole locali l'unica cosa per cui esistono: girare senza
 * rete, senza attesa e senza che tu abbia configurato niente. "Regole, ma solo
 * se hai un modello" non è un ripiego, è un ripiego rotto.
 *
 * **Il costo di una lingua nuova** è un oggetto di parole, non una grammatica.
 * Quello che il dizionario NON copre resta non capito, esattamente come una
 * parola italiana che le regole non conoscono: il comportamento degrada, non
 * si rompe.
 */

/**
 * Inglese. Le chiavi sono espressioni intere quando l'ordine delle parole
 * cambia ("long weekend" → "weekend lungo"), altrimenti parole singole.
 * L'ordine conta: le espressioni composte vanno prima delle parole che le
 * compongono, o "weekend" mangerebbe "long weekend".
 */
const EN = {
  // Periodo
  january: 'gennaio', february: 'febbraio', march: 'marzo', april: 'aprile',
  may: 'maggio', june: 'giugno', july: 'luglio', august: 'agosto',
  september: 'settembre', october: 'ottobre', november: 'novembre', december: 'dicembre',
  jan: 'gennaio', feb: 'febbraio', mar: 'marzo', apr: 'aprile', jun: 'giugno',
  jul: 'luglio', aug: 'agosto', sep: 'settembre', sept: 'settembre',
  oct: 'ottobre', nov: 'novembre', dec: 'dicembre',
  spring: 'primavera', summer: 'estate', autumn: 'autunno', fall: 'autunno', winter: 'inverno',
  // Apostrofo DRITTO in tutti i valori: `normalise()` in parseQuery converte
  // quelli curvi prima di leggere, ma gira PRIMA di questa traduzione — un
  // apostrofo curvo inserito qui non verrebbe più normalizzato, e le regole
  // che lo cercano dritto non lo troverebbero. Costava un peso sbagliato su
  // "a bit of", che finiva contato come una menzione piena.
  'all year round': "tutto l'anno", 'all year': "tutto l'anno", 'any month': 'qualsiasi mese',
  'any time': 'sempre', anytime: 'sempre', whenever: 'sempre',
  'new year': 'capodanno', christmas: 'natale', easter: 'pasqua', halloween: 'halloween',

  // Durata
  'long weekend': 'weekend lungo', weekend: 'weekend',
  'two weeks': 'due settimane', fortnight: 'due settimane',
  'a week': 'una settimana', week: 'una settimana',
  'ten days': 'dieci giorni', 'seven days': 'sette giorni',
  nights: 'notti', night: 'notte', days: 'giorni', day: 'giorno',

  // I numeri in lettere: "five nights" è il modo normale di scriverlo, e
  // senza queste voci la durata andrebbe persa in silenzio. Le espressioni
  // composte ("seven days") restano più specifiche e vincono, perché la
  // sostituzione ordina le chiavi dalla più lunga.
  one: 'uno', two: 'due', three: 'tre', four: 'quattro', five: 'cinque',
  six: 'sei', seven: 'sette', eight: 'otto', nine: 'nove', ten: 'dieci',
  eleven: 'undici', twelve: 'dodici', thirteen: 'tredici', fourteen: 'quattordici',
  fifteen: 'quindici', twenty: 'venti',

  // Budget
  budget: 'budget', max: 'max', maximum: 'massimo', under: 'sotto', 'up to': 'entro',
  euros: 'euro', eur: 'euro', cheap: 'economico', 'low cost': 'economico',

  // Tipo di destinazione
  island: 'isola', islands: 'isole', city: 'città', cities: 'città', town: 'città',

  // Assi — vita notturna
  nightlife: 'vita notturna', clubs: 'discoteche', clubbing: 'discoteche',
  'night out': 'serate', bars: 'locali notturni', parties: 'serate',

  // Assi — fuori rotta
  'off the beaten track': 'poco turistico', 'off the beaten path': 'poco turistico',
  'not touristy': 'non turistico', touristy: 'turistico', uncrowded: 'non affollato',
  'few tourists': 'poco turistico', authentic: 'autentico', unusual: 'insolito',
  'hidden gem': 'insolito', quiet: 'poco affollato',

  // Assi — economicità
  cheap: 'economico', 'low cost': 'low cost', 'low-cost': 'low cost',
  affordable: 'conveniente', inexpensive: 'economico', budget: 'economico',
  'on a budget': 'economico', 'good value': 'conveniente',
  'without breaking the bank': 'senza spendere una fortuna',
  'value for money': 'conveniente', 'save money': 'risparmiare',

  // Assi — outdoor
  hiking: 'trekking', trekking: 'trekking', trails: 'sentieri', walking: 'camminare',
  skiing: 'sci', ski: 'sci', cycling: 'ciclismo', biking: 'bici', bike: 'bici',
  kayak: 'kayak', kayaking: 'kayak', surfing: 'surf', surf: 'surf',
  diving: 'immersioni', snorkeling: 'immersioni', snorkelling: 'immersioni',
  climbing: 'arrampicata', adventure: 'avventura', sports: 'sport', sport: 'sport',

  // Assi — famiglia
  family: 'famiglia', 'with kids': 'con bambini', kids: 'bambini', children: 'bambini',
  child: 'bambino', 'family friendly': 'famiglia',

  // Assi — natura
  nature: 'natura', landscape: 'paesaggio', landscapes: 'paesaggi', scenery: 'paesaggio',
  views: 'panorami', mountains: 'montagna', mountain: 'montagna', parks: 'parchi',
  greenery: 'verde', green: 'verde', fjords: 'fiordi', lakes: 'laghi', lake: 'lago',
  countryside: 'natura',

  // Assi — cultura
  culture: 'cultura', cultural: 'culturale', museums: 'musei', museum: 'museo',
  history: 'storia', historic: 'storico', historical: 'storico', art: 'arte',
  monuments: 'monumenti', archaeology: 'archeologia', archaeological: 'archeologico',
  churches: 'chiese', heritage: 'patrimonio', 'old town': 'centro storico',

  // Assi — cibo
  food: 'cibo', eating: 'mangiare', eat: 'mangiare', gastronomy: 'gastronomia',
  cuisine: 'cucina', restaurants: 'ristoranti', wine: 'vino', wines: 'vini',
  markets: 'mercati', foodie: 'gastronomia',

  // Assi — mare
  sea: 'mare', beach: 'spiaggia', beaches: 'spiagge', seaside: 'costa',
  coast: 'costa', coastal: 'costiero', swimming: 'fare il bagno', swim: 'bagno',
  'warm water': 'acqua calda', 'warm sea': 'mare caldo', swimmable: 'balneabile',

  // Intensità e negazione: sono ciò che dà il peso, e senza queste il
  // dizionario tradurrebbe gli interessi lasciandoli tutti allo stesso valore.
  'above all': 'soprattutto', especially: 'soprattutto', mainly: 'principalmente',
  mostly: 'principalmente', 'a lot of': 'molto', lots: 'molto', plenty: 'molto',
  'a bit of': "un po' di", 'a little': "un po' di", some: 'qualche', maybe: 'magari',
  slightly: 'leggermente', also: 'anche',
  without: 'senza', 'no ': 'niente ', none: 'nessuno', avoid: 'evitare',
  "don't want": 'non voglio', 'do not want': 'non voglio', not: 'non',

  // Verbi che rendono il mare un requisito
  'i want': 'voglio', want: 'voglio', looking: 'cerco', 'i need': 'serve',
  'must have': 'deve esserci', only: 'solo',
}

/**
 * Le lingue riconosciute. L'italiano non c'è: è la lingua d'arrivo, e una
 * frase italiana non passa da nessuna sostituzione.
 */
export const LEXICONS = [
  { lang: 'en', label: 'English', words: EN },
]

/** Escapa una chiave per usarla dentro un'espressione regolare. */
const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * I confini di parola di JavaScript non funzionano con l'apostrofo e con le
 * chiavi che finiscono per spazio ("no "): si costruisce il confine a mano,
 * accettando inizio/fine stringa o un carattere non alfabetico.
 */
const boundary = (word) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(word)})(?=[^\\p{L}\\p{N}]|$)`, 'giu')

/**
 * Quante parole di questo dizionario compaiono nella frase. È il segnale con
 * cui si sceglie la lingua: non un rilevatore linguistico, un conteggio di
 * parole che le regole saprebbero comunque leggere.
 */
function hits(text, words) {
  let n = 0
  for (const word of Object.keys(words)) {
    if (boundary(word).test(text)) n += 1
  }
  return n
}

/**
 * La soglia esiste per una ragione precisa: "un weekend a Barcellona" contiene
 * "weekend", che è anche inglese. Con una sola corrispondenza si tradurrebbe
 * una frase italiana, e "no" italiano diventerebbe "niente" cambiando il senso
 * di quello che chi scrive ha chiesto.
 */
const SOGLIA = 2

/**
 * Porta la frase in italiano, se non lo è già.
 *
 * Restituisce anche `origini`: la mappa dalla parola italiana a quella
 * effettivamente scritta. Serve ai chip — l'app promette di mostrare **la
 * parola da cui ogni criterio è stato dedotto**, e mostrare una parola
 * italiana a chi ha scritto in inglese sarebbe una bugia piccola ma esatta nel
 * punto in cui l'app chiede di essere creduta.
 */
export function toItalian(text) {
  const originale = String(text || '')
  if (!originale.trim()) return { text: originale, lang: 'it', origini: new Map() }

  let migliore = null
  for (const lexicon of LEXICONS) {
    const n = hits(originale, lexicon.words)
    if (n >= SOGLIA && (!migliore || n > migliore.n)) migliore = { ...lexicon, n }
  }
  if (!migliore) return { text: originale, lang: 'it', origini: new Map() }

  const origini = new Map()
  let out = originale
  // Le chiavi più lunghe per prime: "long weekend" prima di "weekend", o la
  // seconda mangerebbe la prima lasciando "long" appeso.
  const chiavi = Object.keys(migliore.words).sort((a, b) => b.length - a.length)
  for (const chiave of chiavi) {
    const italiano = migliore.words[chiave]
    out = out.replace(boundary(chiave), (_, pre, trovato) => {
      origini.set(italiano.trim().toLowerCase(), trovato.trim())
      return `${pre}${italiano}`
    })
  }

  return { text: out, lang: migliore.lang, origini }
}

/**
 * Rimette le parole dell'utente dentro un frammento tradotto, per i chip.
 * Approssimazione dichiarata: si sostituisce parola per parola, quindi
 * l'ordine resta quello italiano. Meglio di mostrare una parola che chi legge
 * non ha scritto.
 */
export function restoreOriginal(fragment, origini) {
  if (!fragment || !origini?.size) return fragment
  let out = fragment
  for (const [italiano, originale] of origini) {
    out = out.replace(boundary(italiano), (_, pre) => `${pre}${originale}`)
  }
  return out
}
