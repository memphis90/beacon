import { AXES, AXIS_KEYS } from './axes.js'
import { THEMES, THEME_BONUS, THEME_BONUS_MAX, THEME_KEYS } from './themes.js'
import { countryName } from './format.js'
import { seaTemperature, tripCost } from './scoring.js'

/**
 * Interpretazione della frase tramite un modello linguistico.
 *
 * Parla il dialetto OpenAI (`/chat/completions`), che è quello esposto anche da
 * Ollama, LM Studio, Groq e OpenRouter: un solo percorso di codice copre sia i
 * modelli locali sia i piani gratuiti. Il §6 del planning vieta le API a
 * pagamento, non i modelli.
 *
 * Due invarianti, e sono la ragione per cui questo file è lungo quanto è:
 *
 * 1. **L'output del modello non è mai creduto sulla parola.** Passa da
 *    `sanitisePatch`, che scarta tutto ciò che non riconosce e riporta ai
 *    limiti tutto ciò che è fuori scala. Un modello che risponde `mese: 47`
 *    non deve poter rompere il ranking.
 * 2. **Il modello deve dire da quale parola ha dedotto ogni filtro.** Senza,
 *    torniamo alla scatola nera che il §5 rifiuta, e non si saprebbe più se un
 *    risultato strano viene dallo scoring o dall'interpretazione.
 */

export const AGENT_KEY = 'destination-finder:agent:v2'

/**
 * La chiave della configurazione a modello singolo. Letta una volta sola, per
 * travasare la vecchia configurazione nel primo profilo della lista: chi aveva
 * già un endpoint funzionante non deve riscriverlo.
 */
export const LEGACY_AGENT_KEY = 'destination-finder:agent:v1'

export const PRESETS = [
  {
    id: 'ollama',
    label: 'Ollama (locale)',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    note: 'Gira sulla tua macchina. Nessuna chiave, nessun dato che esce.',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (locale)',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    note: 'Come Ollama: server locale compatibile OpenAI.',
  },
  {
    id: 'google',
    label: 'Google AI Studio (Gemma, gratis)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemma-3-27b-it',
    note: 'Remoto, gratuito entro quota e senza carta. Chiave da aistudio.google.com/apikey. La frase esce dal tuo computer.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (modelli :free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    // Il catalogo dei modelli gratuiti cambia: quelli col suffisso :free
    // vengono aggiunti e ritirati. Se questo non risponde più, l'elenco
    // aggiornato è su openrouter.ai/models?q=free.
    model: 'google/gemma-4-31b-it:free',
    note: 'Remoto, gratuito entro quota. Chiave da openrouter.ai/keys. La frase esce dal tuo computer.',
  },
  {
    id: 'groq',
    label: 'Groq (piano gratuito)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    note: 'Remoto, gratuito entro quota. Chiave da console.groq.com. La frase esce dal tuo computer.',
  },
  { id: 'custom', label: 'Altro endpoint', baseUrl: '', model: '', note: 'Qualsiasi server compatibile OpenAI.' },
]

/* --------------------------------------------------------------------------
   I modelli configurati sono una lista, non uno.

   Un endpoint solo costringeva a riscrivere URL e nome del modello ogni volta
   che si voleva confrontare due interpreti — ed è esattamente la cosa che si fa
   spesso, perché quale modello legge la frase si giudica solo vedendolo
   sbagliare su una frase vera. Ora la configurazione tiene un elenco di profili
   e un `activeId`: cambiare interprete torna a essere un clic nel menu accanto
   al campo, che è dove la scelta si prende.

   Chi usa la configurazione non deve sapere se il profilo attivo è il primo o
   il quarto: passa l'intera configurazione e `activeProfile` risolve. La stessa
   funzione accetta anche un profilo singolo, così la prova di connessione nelle
   impostazioni può lavorare sulla riga che si sta modificando, che non è ancora
   quella attiva.
   -------------------------------------------------------------------------- */

/** Un profilo nuovo, ricavato da un preset. */
export function profileFromPreset(preset, id) {
  return {
    id,
    // Vuoto di proposito: finché non serve, il nome visibile è quello del
    // modello. Un "Modello 1" prestampato sarebbe un'etichetta che non
    // distingue nulla e che nessuno riscrive.
    label: '',
    preset: preset.id,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: '',
  }
}

/** Identificatore libero: progressivo sul massimo già assegnato, mai riusato. */
export function nextProfileId(profiles = []) {
  const massimo = profiles.reduce((acc, p) => {
    const n = Number(String(p?.id ?? '').replace(/^m/, ''))
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `m${massimo + 1}`
}

/**
 * Il profilo di partenza dipende da dove gira la pagina.
 *
 * In locale è Ollama: è la scelta giusta — niente chiave, niente frase che
 * esce — ed è a portata di `ollama pull`. Da un sito, però, un endpoint locale
 * è quello che il browser blocca sempre: partire da lì significa aprire le
 * impostazioni su una configurazione che non può funzionare, e far sospettare
 * a chi prova di aver sbagliato qualcosa.
 *
 * Quello che NON si può fare è precompilare anche la chiave. Una chiave dentro
 * il client è una chiave regalata: il bundle è pubblico, si legge in dieci
 * secondi, e la quota gratuita di chi l'ha messa finisce il giorno dopo. Resta
 * un campo da riempire — ma uno solo, e l'app dice dove prenderlo.
 */
const presetIniziale = () =>
  PRESETS.find((p) => p.id === (isHostedPage() ? 'openrouter' : 'ollama')) || PRESETS[0]

export function emptyAgentConfig() {
  const primo = profileFromPreset(presetIniziale(), 'm1')
  return {
    enabled: false,
    activeId: primo.id,
    profiles: [primo],
    // Mostra come la frase è stata letta prima di applicarla. Spento di
    // default: è materiale da messa a punto, e in uso normale occupa il posto
    // sotto il campo con una tabella che non si guarda.
    debug: false,
  }
}

const asProfile = (raw, id) => ({
  id,
  label: typeof raw?.label === 'string' ? raw.label : '',
  preset: PRESETS.some((p) => p.id === raw?.preset) ? raw.preset : 'custom',
  baseUrl: typeof raw?.baseUrl === 'string' ? raw.baseUrl : '',
  model: typeof raw?.model === 'string' ? raw.model : '',
  apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : '',
})

/**
 * Riporta alla forma corrente qualunque cosa arrivi da `localStorage`, inclusa
 * la configurazione a modello singolo di prima. Un `activeId` che punta a un
 * profilo cancellato ricade sul primo: meglio un interprete diverso da quello
 * atteso che una configurazione che non risolve e fallisce a ogni frase.
 */
export function normaliseAgentConfig(raw) {
  if (!raw || typeof raw !== 'object') return emptyAgentConfig()

  const lista = Array.isArray(raw.profiles)
    // Una lista vuota è una scelta — l'ultimo profilo cancellato — e va
    // rispettata: rimettere il preset di default farebbe ricomparire da solo
    // un modello appena tolto.
    ? raw.profiles
    : (raw.baseUrl || raw.model ? [raw] : emptyAgentConfig().profiles)

  const profiles = []
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue
    const id = typeof item.id === 'string' && item.id && !profiles.some((p) => p.id === item.id)
      ? item.id
      : nextProfileId(profiles)
    profiles.push(asProfile(item, id))
  }

  return {
    enabled: Boolean(raw.enabled) && profiles.length > 0,
    activeId: profiles.some((p) => p.id === raw.activeId) ? raw.activeId : (profiles[0]?.id ?? null),
    profiles,
    debug: Boolean(raw.debug),
  }
}

/** Un profilo utilizzabile ha almeno endpoint e nome del modello. */
export const profileIsUsable = (profile) => Boolean(profile?.baseUrl && profile?.model)

/** Come si chiama nel menu: il nome dato, o il modello, che è già distintivo. */
export function profileLabel(profile) {
  if (!profile) return ''
  const nome = typeof profile.label === 'string' ? profile.label.trim() : ''
  return nome || profile.model || 'Senza nome'
}

/** L'host dell'endpoint: distingue due profili sullo stesso modello. */
export function endpointHost(baseUrl) {
  try {
    return new URL(baseUrl).host
  } catch {
    return String(baseUrl || '')
  }
}

export const isLocalEndpoint = (baseUrl) => /^https?:\/\/(localhost|127\.|\[::1\])/i.test(baseUrl || '')

/**
 * La pagina è servita da un sito, non aperta in locale.
 *
 * Distinzione che conta più di quanto sembri: un modello che gira sulla tua
 * macchina è raggiungibile dalla pagina solo se la pagina viene dalla tua
 * macchina. Da un sito, il browser mette in mezzo due difese — una regola che
 * chiede al server il permesso di rispondere a quell'origine, e un controllo
 * che impedisce ai siti pubblici di frugare nella rete locale — e la seconda
 * non si disattiva dal lato del sito, che è esattamente il punto.
 */
export const isHostedPage = () =>
  typeof window !== 'undefined'
  && /^https?:$/.test(window.location?.protocol || '')
  && !/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location?.hostname || '')

/** Un endpoint locale chiamato da un sito: è il caso che fallisce sempre. */
export const isBlockedCombination = (baseUrl) => isLocalEndpoint(baseUrl) && isHostedPage()

/**
 * Un endpoint remoto senza chiave è configurato a metà.
 *
 * Sembra pronto — endpoint e modello ci sono — e invece ogni frase muore con
 * un 401 che parla la lingua del fornitore: OpenRouter risponde "No cookie
 * auth credentials found", che a chi legge non dice né cosa manca né dove
 * metterlo. Meglio non partire, e dirlo.
 *
 * Un endpoint locale non ne ha bisogno: Ollama e LM Studio non chiedono nulla.
 */
export const profileNeedsKey = (profile) =>
  Boolean(profile?.baseUrl) && !isLocalEndpoint(profile.baseUrl) && !profile.apiKey

/** Il messaggio d'errore quando `fetch` muore senza dire perché. */
export function localEndpointHint(baseUrl) {
  if (isBlockedCombination(baseUrl)) {
    return 'Il browser ha bloccato la chiamata: questa pagina arriva da un sito e il modello gira '
      + 'sul tuo computer. Un sito non può raggiungere un servizio locale, e non è una cosa che '
      + 'si aggiusta dal sito. Usa l’app in locale (npm run dev), oppure configura un endpoint '
      + 'remoto.'
  }
  if (isLocalEndpoint(baseUrl)) {
    return 'Nessuna risposta dall’endpoint locale. Controlla che il server sia acceso e che '
      + 'l’indirizzo sia giusto (per Ollama: http://localhost:11434/v1).'
  }
  return 'Nessuna risposta dall’endpoint. Controlla l’indirizzo, la connessione, e che il '
    + 'server accetti chiamate da questa pagina.'
}

/**
 * Il profilo su cui si lavora. Accetta sia la configurazione intera sia un
 * profilo singolo, così tutte le chiamate passano di qui senza sapere quale
 * delle due hanno in mano.
 */
export function activeProfile(config) {
  if (!config || typeof config !== 'object') return null
  if (Array.isArray(config.profiles)) {
    return config.profiles.find((p) => p.id === config.activeId) || config.profiles[0] || null
  }
  return config.baseUrl || config.model ? config : null
}

/**
 * Acceso *e* davvero utilizzabile: un `enabled` su un profilo vuoto non è un
 * modello, e nemmeno un endpoint remoto a cui manca la chiave — quello
 * fallirebbe a ogni frase con un errore del fornitore.
 */
export const agentIsReady = (config) => {
  const profile = activeProfile(config)
  return Boolean(config?.enabled && profileIsUsable(profile) && !profileNeedsKey(profile))
}

export function loadAgentConfig() {
  try {
    const raw = localStorage.getItem(AGENT_KEY)
    if (raw) return normaliseAgentConfig(JSON.parse(raw))

    const legacy = localStorage.getItem(LEGACY_AGENT_KEY)
    if (legacy) {
      const migrata = normaliseAgentConfig(JSON.parse(legacy))
      saveAgentConfig(migrata)
      try { localStorage.removeItem(LEGACY_AGENT_KEY) } catch { /* resta lì, innocua */ }
      return migrata
    }

    return emptyAgentConfig()
  } catch {
    return emptyAgentConfig()
  }
}

export function saveAgentConfig(config) {
  try {
    localStorage.setItem(AGENT_KEY, JSON.stringify(config))
  } catch {
    /* niente da fare: la configurazione resta solo per questa sessione */
  }
}

const TYPES = ['city', 'area', 'island']

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const asNumber = (value) => {
  const n = typeof value === 'string' ? Number(value.replace(/[^\d.-]/g, '')) : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Ripulisce la risposta del modello.
 *
 * Tutto ciò che non è riconosciuto viene scartato in silenzio; tutto ciò che è
 * fuori scala viene riportato ai limiti. Restituisce anche `rejected`, così la
 * UI può dire cosa è stato buttato invece di far finta di niente.
 */
export function sanitisePatch(raw) {
  const patch = {}
  const rejected = []
  if (!raw || typeof raw !== 'object') return { patch, rejected: ['risposta non interpretabile'] }

  if ('month' in raw) {
    if (raw.month === null) patch.month = null
    else {
      const m = asNumber(raw.month)
      if (m !== null && m >= 1 && m <= 12) patch.month = Math.round(m)
      else rejected.push(`mese "${raw.month}" fuori intervallo`)
    }
  }

  if ('nights' in raw) {
    const n = asNumber(raw.nights)
    if (n !== null && n >= 1) patch.nights = clamp(Math.round(n), 1, 60)
    else rejected.push(`notti "${raw.nights}" non valide`)
  }

  if ('budgetMax' in raw && raw.budgetMax !== null) {
    const b = asNumber(raw.budgetMax)
    if (b !== null && b > 0) patch.budgetMax = Math.round(b)
    else rejected.push(`budget "${raw.budgetMax}" non valido`)
  }

  if (raw.weights && typeof raw.weights === 'object') {
    const weights = {}
    for (const [key, value] of Object.entries(raw.weights)) {
      if (!AXIS_KEYS.includes(key)) { rejected.push(`asse sconosciuto "${key}"`); continue }
      const w = asNumber(value)
      if (w === null) { rejected.push(`peso non numerico per "${key}"`); continue }
      weights[key] = clamp(Math.round(w), 0, 10)
    }
    if (Object.keys(weights).length) patch.weights = weights
  }

  if ('seaRequired' in raw) patch.seaRequired = Boolean(raw.seaRequired)

  if (Array.isArray(raw.allowedTypes)) {
    const types = raw.allowedTypes.filter((t) => TYPES.includes(t))
    if (types.length && types.length < TYPES.length) patch.allowedTypes = types
    else if (!types.length) rejected.push('tipi di destinazione non riconosciuti')
  }

  if (typeof raw.query === 'string' && raw.query.trim()) patch.query = raw.query.trim().slice(0, 60)

  /**
   * I temi passano solo se stanno nel vocabolario chiuso. Un tema inventato non
   * corrisponderebbe a nessuna etichetta del seed e sparirebbe in silenzio: chi
   * legge vedrebbe un chip "tema: spettrale" che non ha spostato niente, cioè
   * la peggiore delle due possibilità — sembra che l'abbia capito, e invece no.
   */
  if (Array.isArray(raw.themes)) {
    const themes = []
    for (const value of raw.themes) {
      const key = typeof value === 'string' ? value.trim().toLowerCase() : ''
      if (!THEME_KEYS.includes(key)) { rejected.push(`tema sconosciuto "${value}"`); continue }
      if (!themes.includes(key)) themes.push(key)
    }
    // Due bastano: il tetto al bonus è lo stesso, e un elenco più lungo è un
    // modello che sta buttando dentro tutto quello che gli somiglia.
    if (themes.length) patch.themes = themes.slice(0, 2)
  }

  return { patch, rejected }
}

/** Normalizza la spiegazione, scartando le voci senza la parola d'origine. */
export function sanitiseUnderstood(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((u) => u && typeof u.label === 'string' && typeof u.value !== 'undefined')
    .slice(0, 12)
    .map((u, i) => ({
      key: `model:${i}:${u.label}`,
      label: String(u.label).slice(0, 40),
      value: String(u.value).slice(0, 40),
      from: typeof u.from === 'string' ? u.from.slice(0, 60) : '',
      note: typeof u.note === 'string' ? u.note.slice(0, 160) : undefined,
    }))
}

const SYSTEM_PROMPT = `Sei un traduttore da frasi in italiano a criteri di ricerca per uno strumento di scelta di destinazioni di viaggio. Rispondi SOLO con JSON valido, nessun testo attorno.

Schema:
{
  "month": 1-12 oppure null se la frase dice "tutto l'anno"/"sempre"; ometti il campo se non è indicato,
  "nights": intero >= 1,
  "budgetMax": intero in euro, costo A TERRA per persona (alloggio+cibo+trasporti locali, volo ESCLUSO),
  "weights": { asse: 0-10 },
  "seaRequired": true SOLO se la frase pone il mare come condizione NECESSARIA ("voglio il mare", "deve essere balneabile"). ATTENZIONE: è un filtro che CANCELLA le destinazioni troppo fredde nel mese chiesto, e nei mesi freddi le cancella tutte. "sul mare", "mare tranquillo", "snorkeling", "spiagge" sono interessi: per quelli ometti il campo e alza il peso "sea",
  "allowedTypes": sottoinsieme di ["city","area","island"],
  "query": nome di una destinazione o di un paese se esplicitamente nominato,
  "themes": sottoinsieme dell'elenco dei temi, al massimo 2. Serve quando la frase evoca un CARATTERE che gli assi non sanno dire — "Halloween" non chiede più cultura, chiede atmosfera gotica. Non escludono niente: danno un bonus a chi ha quell'etichetta. Ometti il campo se la frase parla solo di interessi,
  "understood": [ { "label": "...", "value": "...", "from": "la parola esatta della frase da cui l'hai dedotto", "note": "opzionale" } ]
}

Assi ammessi: nature (paesaggio da guardare), culture, sea, food, nightlife, outdoor (attività: trekking, sci, sport), family, offbeat (poco turistico).

Assi e temi rispondono a due domande diverse: l'asse dice QUANTO ti interessa una cosa, il tema dice CHE COSA deve essere il posto. "Halloween" è tema gotico e assi cultura/vita notturna insieme, non l'uno al posto degli altri.

Regole:
- Scala dei pesi: menzione semplice 7, enfasi ("soprattutto", "molto") 9, attenuazione ("un po' di") 3, negazione ("senza") 0.
- Includi SOLO gli assi effettivamente nominati.
- "5 giorni" significa nights 5.
- Una festa o una ricorrenza nominata FISSA il mese, ed è l'unico modo che hai per collocarla nel tempo: capodanno 1, San Valentino 2, carnevale 2, Pasqua 4, 25 aprile 4, primo maggio 5, ferragosto 8, Halloween 10, Ognissanti 11, Natale 12. "Ponte del 2 giugno" è 6. Se la ricorrenza non è in questo elenco ma ha una data fissa che conosci, usa quella; se cade a cavallo di due mesi, scegli quello in cui cade il giorno principale.
- Una festa dice anche CHE TIPO di viaggio è, e va tradotta anche in pesi: sono due deduzioni diverse dalla stessa parola, non una alternativa all'altra.
- Un tema NON sostituisce i pesi. Il tema vale pochi punti e serve a distinguere fra destinazioni vicine; sono i pesi a decidere l'ordine. Se metti un tema senza pesi, il risultato è la classifica generica di sempre con uno scarto minimo: includi SEMPRE anche gli assi che quel carattere implica.
- Il campo "from" è obbligatorio per ogni voce di "understood" e deve contenere parole prese TESTUALMENTE dalla frase.
- Non inventare criteri non presenti nella frase.
- Se metti "seaRequired": true, in "understood" ci deve essere una voce con label "Mare obbligatorio" e "from" con le parole esatte che lo rendono una condizione. Se non riesci a citarle, non è una condizione: ometti il campo.

Esempio. Frase: "qualche giorno sul mare ad aprile, con buon vino"
{"month":4,"weights":{"sea":7,"food":7},"understood":[{"label":"Mare","value":"interesse, non requisito","from":"sul mare"},{"label":"Cibo","value":"7","from":"buon vino"}]}
Niente "seaRequired": "sul mare" dice che il mare piace, non che senza mare la vacanza non va bene. Il peso a 7 porta comunque il mare in cima ai risultati, senza cancellare le altre destinazioni.

Esempio con un tema. Frase: "una fuga fra geyser e sorgenti calde a marzo"
{"month":3,"weights":{"nature":9,"outdoor":7},"themes":["vulcanico","termale"],"understood":[{"label":"Natura","value":"9","from":"geyser"},{"label":"Tema","value":"vulcanico, termale","from":"geyser e sorgenti calde"}]}
I temi ci sono E i pesi anche: il tema dice che carattere deve avere il posto, i pesi dicono su cosa ordinarli. Un tema da solo lascia la classifica generica.`

const TIPO_IT = { city: 'città', area: 'area', island: 'isola' }
const MESI_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

/**
 * Il catalogo e le conseguenze dei campi, calcolati dai dati veri.
 *
 * Nasce da una campagna di prove sul modello locale: gli errori che facevano
 * male non erano disobbedienze ma decisioni prese al buio. `seaRequired: true`
 * su "una meta sul mare a maggio" svuotava i risultati — non perché il modello
 * ignorasse l'istruzione, ma perché non poteva sapere che quel campo è un
 * filtro duro e che a maggio non c'è una sola destinazione sopra i 21 °C. Lo
 * stesso per `query: "isola greca"`, che è un confronto testuale contro nomi
 * che quella frase non contiene.
 *
 * Quindi invece di correggere l'output a valle con altre euristiche, il
 * contesto dice al modello **cosa esiste e cosa succede**: sono le stesse
 * regole che poi applica `scoring.js`, lette dagli stessi dati, così non
 * possono divergere da sole quando il seed cambia.
 *
 * Quello che il contesto NON è: un invito a scegliere la destinazione. Il
 * catalogo serve a sapere quali nomi esistono, non a selezionarne uno — la
 * scelta resta del punteggio, che è verificabile.
 */
export function describeRules(destinations, { seaTempMin = 21 } = {}) {
  if (!Array.isArray(destinations) || destinations.length === 0) return ''

  const catalogo = destinations
    .map((d) => `${d.name} (${countryName(d.country)}, ${TIPO_IT[d.type] || d.type})`)
    .join(' · ')

  const perTipo = Object.entries(
    destinations.reduce((acc, d) => ({ ...acc, [d.type]: (acc[d.type] || 0) + 1 }), {})
  ).map(([tipo, n]) => `${n} ${TIPO_IT[tipo] || tipo}`).join(', ')

  const perMese = MESI_IT.map((nome, i) => {
    const quante = destinations.filter((d) => {
      const t = seaTemperature(d, i + 1)
      return t != null && t >= seaTempMin
    }).length
    return `${nome} ${quante}`
  }).join(', ')

  const mesiVuoti = MESI_IT.filter((_, i) =>
    destinations.every((d) => {
      const t = seaTemperature(d, i + 1)
      return t == null || t < seaTempMin
    })
  )

  const notti = destinations.map((d) => tripCost(d, 1).mid).sort((a, b) => a - b)
  const minimo = Math.round(notti[0])
  const massimo = Math.round(notti[notti.length - 1])

  // I temi arrivano col loro conteggio, non con l'elenco di chi li porta: al
  // modello serve sapere che "gotico" non è un'etichetta vuota, non quali
  // destinazioni scegliere — quello resta lavoro del punteggio.
  const elencoTemi = THEMES.map((t) => {
    const quante = destinations.filter((d) => (d.themes || []).includes(t.key)).length
    return `- ${t.key}: ${t.hint} (${quante} destinazioni)`
  }).join('\n')

  return `CONTESTO — il catalogo su cui la tua risposta sarà applicata. Sono ${destinations.length} destinazioni (${perTipo}) e non ne esistono altre:
${catalogo}

COSA FA OGNI CAMPO. "month", "nights" e "weights" ordinano soltanto e non tolgono niente. Gli altri tre ESCLUDONO: una destinazione esclusa sparisce dai risultati, e se escludono tutto la persona vede una schermata vuota.

- "query" è un confronto testuale su nome e paese, e va usato quando la frase nomina un luogo: "cinque notti in Grecia" → "Grecia", "un weekend a Lisbona" → "Lisbona", "un'isola greca" → "Grecia" insieme ad allowedTypes ["island"]. Il luogo deve comparire nell'elenco qui sopra, come nome o come paese: se non c'è, il confronto non trova niente e i risultati sono zero. Una descrizione che non è un luogo ("una capitale del nord", "una meta romantica", "un posto tranquillo") non va MAI in "query": per quella usa "allowedTypes" e i pesi. Il catalogo ti dice quali nomi esistono, non quale destinazione proporre: la scelta non è tua.
- "allowedTypes" tiene solo i tipi elencati.
- "seaRequired": true tiene solo chi ha il mare ad almeno ${seaTempMin} °C NEL MESE CHIESTO. Quante destinazioni lo superano, mese per mese: ${perMese}.${mesiVuoti.length ? ` In ${mesiVuoti.join(', ')} non ne passa NESSUNA: metterlo a true su uno di quei mesi svuota la ricerca.` : ''} Se la frase non pone il mare come condizione necessaria, ometti il campo e alza il peso "sea": ottieni le stesse destinazioni in cima senza cancellare le altre.
- "budgetMax" è il costo a terra per persona per l'INTERO soggiorno, confrontato con la stima media del catalogo. Una notte costa fra ${minimo} € e ${massimo} €: un budget sotto ${minimo} € per notte non lascia passare niente. Se la frase dice "economico" senza una cifra, non inventarla — usa il campo solo quando un numero c'è.

TEMI DISPONIBILI, con quante destinazioni li portano. Un tema che corrisponde vale ${THEME_BONUS} punti in più sul punteggio (massimo ${THEME_BONUS_MAX}): sposta l'ordine fra destinazioni vicine, non ribalta una differenza vera, e non esclude nessuno. Usa SOLO queste parole, al massimo due, e solo se la frase evoca davvero quel carattere:
${elencoTemi}`
}

/**
 * Cosa cambia quando la frase non è italiana.
 *
 * Lo schema e le regole restano in italiano — riscriverli per lingua è la
 * stessa trappola che il dizionario di `lexicon.js` evita alle regole locali,
 * e un modello capace di leggere una frase inglese è capace di leggere anche
 * istruzioni italiane. Cambia una cosa sola: **cosa esce**. Le etichette dei
 * chip e la parola citata devono tornare nella lingua di chi ha scritto, o
 * l'app risponde in italiano a chi non l'ha usato.
 */
const OUTPUT_LANG = {
  en: `\n\nIMPORTANTE: l'utente scrive in INGLESE. Lo schema e queste istruzioni restano in italiano, ma la risposta no: nel campo "understood" scrivi "label" e "value" in inglese, e copia in "from" le parole ESATTE della frase inglese. I nomi dei campi JSON, le chiavi degli assi e quelle dei temi restano quelli elencati sopra: sono identificatori, non testo da tradurre.`,
}

/** Il prompt di sistema, con il contesto in coda se il chiamante lo fornisce. */
export const buildSystemPrompt = (contesto, lang = 'it') => {
  const base = contesto ? `${SYSTEM_PROMPT}\n\n${contesto}` : SYSTEM_PROMPT
  return OUTPUT_LANG[lang] ? `${base}${OUTPUT_LANG[lang]}` : base
}

/**
 * Una chiamata al server, con il JSON già estratto e verificato.
 * Rilancia con un errore leggibile: la UI deve poter dire perché ha ripiegato
 * sulle regole invece di fallire in silenzio.
 */
async function askForJson(system, user, { config, signal, timeout }) {
  // `config` può essere la configurazione intera o il singolo profilo che si
  // sta provando nelle impostazioni: risolve `activeProfile`.
  const profile = activeProfile(config)
  if (!profileIsUsable(profile)) throw new Error('Endpoint o modello non configurati')
  // Prima di partire, non dopo: la risposta del fornitore a una chiamata senza
  // chiave è un 401 che parla di cookie e non dice cosa manca.
  if (profileNeedsKey(profile)) {
    throw new Error(
      `Manca la chiave API per ${endpointHost(profile.baseUrl)}. È un endpoint remoto: senza `
      + 'chiave rifiuta ogni richiesta. Aprila dalle impostazioni del modello e incollala lì.'
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })

  const url = `${profile.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const chiama = (jsonMode) => fetch(url, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: profile.model,
      temperature: 0,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  try {
    let response = await chiama(true)

    /**
     * `response_format: json_object` non è supportato da tutti i modelli, e
     * chi non lo supporta risponde 400 rifiutando l'intera richiesta. Capita
     * soprattutto sui modelli gratuiti, cioè proprio dove serve che funzioni.
     *
     * Si riprova una volta senza. Non è una perdita: il JSON viene comunque
     * estratto dal testo poco sotto, perché già oggi alcuni server accettano
     * il parametro e poi lo ignorano — la difesa c'era prima di questo
     * ripiego, e questo ripiego la usa.
     */
    if (response.status === 400) response = await chiama(false)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      // 401 e 403 hanno una sola causa pratica, e il corpo della risposta la
      // dice con le parole del fornitore invece che con quelle di chi legge.
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `${endpointHost(profile.baseUrl)} ha rifiutato la chiave (${response.status}). `
          + 'Controlla che sia quella giusta per questo endpoint e che non sia scaduta.'
        )
      }
      throw new Error(`Il modello ha risposto ${response.status}${body ? `: ${body.slice(0, 120)}` : ''}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('Risposta vuota dal modello')

    // Alcuni server ignorano response_format e incorniciano il JSON nel testo.
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('La risposta non contiene JSON')

    return JSON.parse(match[0])
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Il modello non ha risposto in tempo')
    // `fetch` fallisce con un TypeError secco — "Failed to fetch" — sia quando
    // il server non c'è, sia quando c'è ma il browser ha rifiutato la
    // risposta. Il motivo vero non arriva alla pagina, per progetto: dirlo
    // sarebbe dire a un sito cosa gira sulla tua macchina. Qui si nomina la
    // causa di gran lunga più probabile invece di lasciare un errore che non
    // suggerisce niente.
    if (error instanceof TypeError) throw new Error(localEndpointHint(profile.baseUrl))
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * I modelli che quell'endpoint offre davvero, chiesti a lui.
 *
 * Nasce da un problema ricorrente: il nome del modello scritto in un preset
 * invecchia. Il catalogo gratuito di OpenRouter cambia di mese in mese, Google
 * rinomina le versioni di Gemma, e un preset che punta a un modello ritirato
 * fallisce con un 404 che chi legge attribuisce all'app. Un elenco chiesto al
 * fornitore non può invecchiare: se un modello non c'è più, non compare.
 *
 * `/models` fa parte del dialetto OpenAI e lo espone chiunque l'app supporti.
 * Chi non lo espone dà errore, e il campo resta un campo di testo come prima:
 * si degrada, non si rompe.
 */
export async function listModels(profile, { signal, timeout = 20000 } = {}) {
  if (!profile?.baseUrl) throw new Error('Endpoint non configurato')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })

  try {
    const res = await fetch(`${profile.baseUrl.replace(/\/+$/, '')}/models`, {
      signal: controller.signal,
      headers: profile.apiKey ? { Authorization: `Bearer ${profile.apiKey}` } : {},
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error(`${endpointHost(profile.baseUrl)} ha rifiutato la chiave (${res.status}).`)
    }
    if (!res.ok) throw new Error(`L’endpoint ha risposto ${res.status} all’elenco dei modelli.`)

    const data = await res.json()
    const ids = (data?.data || data?.models || [])
      .map((m) => m?.id || m?.name)
      .filter((id) => typeof id === 'string')
      // Google restituisce "models/gemma-3-27b-it": la chiamata vuole il nome
      // senza il prefisso della collezione.
      .map((id) => id.replace(/^models\//, ''))
      .sort((a, b) => a.localeCompare(b))

    if (!ids.length) throw new Error('L’endpoint non ha elencato nessun modello.')
    return ids
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('L’elenco dei modelli non è arrivato in tempo')
    if (error instanceof TypeError) throw new Error(localEndpointHint(profile.baseUrl))
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Chiede al modello di interpretare la frase.
 *
 * Il timeout è tre minuti, non uno: misurato, un modello locale di taglia
 * media impiega una decina di secondi, ma `gemma4:26b` sulla stessa macchina
 * ne mette 98 — e la prima chiamata dopo l'avvio deve anche caricare i pesi in
 * memoria. Un minuto dichiarava guasto un endpoint che stava solo lavorando, e
 * chi aspettava aveva già l'Annulla per decidere da sé quando è troppo.
 *
 * `destinations` è facoltativo ma cambia la qualità della risposta: senza, il
 * modello decide senza sapere cosa esiste nel catalogo né quali campi
 * escludono. Vedi `describeRules`.
 */
export async function interpretWithModel(
  text,
  { config, signal, timeout = 180000, destinations, seaTempMin, lang = 'it' } = {}
) {
  const system = buildSystemPrompt(describeRules(destinations, { seaTempMin }), lang)
  const parsed = await askForJson(system, text, { config, signal, timeout })
  const { patch, rejected } = sanitisePatch(parsed)
  return { patch, understood: sanitiseUnderstood(parsed.understood), rejected, source: 'model' }
}

/* ==========================================================================
   Critica del ranking
   ========================================================================== */

/**
 * Il modello guarda il ranking già calcolato e dice se i pesi tradiscono la
 * frase. Non riordina: **non può**. L'unica cosa che questa funzione lascia
 * passare è una proposta di peso, che l'utente applica o ignora.
 *
 * È il compromesso fra due cose vere: il modello capisce la frase meglio delle
 * regole, ma non conosce i dati (costi, clima, POI vengono dal seed e dagli
 * override dell'editor) e non deve poter sostituire un calcolo verificabile
 * con un giudizio non riproducibile — §5 del planning, "niente black box".
 * Intervenendo sui pesi, il suo contributo resta visibile nell'aritmetica del
 * punteggio come qualunque altro peso.
 */
const CRITIQUE_PROMPT = `Sei un revisore critico di una ricerca di destinazioni di viaggio. Rispondi SOLO con JSON valido, nessun testo attorno.

L'utente ha scritto una frase. Un algoritmo deterministico ha ordinato le destinazioni usando pesi 0-10 sugli assi di interesse. Il tuo compito NON è riordinare, né scegliere una destinazione: è dire se i PESI tradiscono la frase.

Schema:
{
  "suggestions": [ { "axis": "chiave dell'asse", "to": 0-10, "why": "una frase, citando le parole della frase dell'utente" } ],
  "note": "opzionale, una frase: qualcosa che la frase chiede e che i pesi non possono esprimere"
}

Regole:
- Al massimo 3 suggerimenti. Zero suggerimenti è una risposta valida, ed è preferibile all'inventarne.
- ORDINE DI PRIORITÀ, e va rispettato perché i posti sono solo tre:
  1. un asse NOMINATO nella frase che ha un peso troppo basso per come è stato nominato;
  2. un asse NEGATO nella frase ("senza…") che non è a 0;
  3. solo dopo, e solo se avanza posto, un asse non nominato con un peso alto.
- Proponi un peso solo se hai una ragione presa dalle parole della frase.
- Non proporre un peso uguale a quello attuale.
- Non dire quale destinazione scegliere. Puoi nominarne una solo come prova che un peso non sta funzionando.`

/**
 * Ripulisce la critica. Scarta assi sconosciuti, pesi fuori scala, suggerimenti
 * senza motivazione e quelli che non cambierebbero nulla; taglia a tre.
 */
export function sanitiseCritique(raw, weights = {}) {
  const suggestions = []
  const rejected = []
  if (!raw || typeof raw !== 'object') return { suggestions, note: '', rejected: ['risposta non interpretabile'] }

  const visti = new Set()
  for (const item of Array.isArray(raw.suggestions) ? raw.suggestions : []) {
    if (!item || typeof item !== 'object') continue

    const axis = AXES.find((a) => a.key === item.axis)
    if (!axis) { rejected.push(`asse sconosciuto "${item.axis}"`); continue }
    if (visti.has(axis.key)) { rejected.push(`asse ripetuto "${axis.key}"`); continue }

    const to = asNumber(item.to)
    if (to === null) { rejected.push(`peso non numerico per "${axis.key}"`); continue }

    const clamped = clamp(Math.round(to), 0, 10)
    const attuale = Number(weights?.[axis.key]) || 0
    // Un "porta Cibo a 7" quando Cibo è già 7 è rumore: sembra un consiglio,
    // e il bottone non farebbe niente.
    if (clamped === attuale) { rejected.push(`"${axis.key}" è già ${attuale}`); continue }

    const why = typeof item.why === 'string' ? item.why.trim() : ''
    if (!why) { rejected.push(`nessuna motivazione per "${axis.key}"`); continue }

    visti.add(axis.key)
    suggestions.push({ axis: axis.key, label: axis.label, from: attuale, to: clamped, why: why.slice(0, 240) })
    if (suggestions.length === 3) break
  }

  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 240) : ''
  return { suggestions, note, rejected }
}

/** Costruisce il messaggio: la frase, i pesi correnti, le prime destinazioni. */
export function critiquePayload({ text, entries, weights }) {
  return JSON.stringify({
    frase: String(text || '').slice(0, 400),
    pesi_attuali: AXES.map((a) => ({ axis: a.key, label: a.label, peso: Number(weights?.[a.key]) || 0 })),
    prime_destinazioni: (entries || []).slice(0, 5).map((entry) => ({
      nome: entry.destination.name,
      punteggio: entry.scoring.total == null ? null : Number(entry.scoring.total.toFixed(1)),
      punteggi_per_asse: Object.fromEntries(
        entry.scoring.contributions.map((c) => [c.key, c.score])
      ),
    })),
  })
}

export async function critiqueRanking({ text, entries, weights, config, signal, timeout = 180000 }) {
  const parsed = await askForJson(
    CRITIQUE_PROMPT,
    critiquePayload({ text, entries, weights }),
    { config, signal, timeout }
  )
  return sanitiseCritique(parsed, weights)
}
