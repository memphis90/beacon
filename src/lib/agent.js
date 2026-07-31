import { AXES, AXIS_KEYS } from './axes.js'

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

export const AGENT_KEY = 'destination-finder:agent:v1'

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
    id: 'groq',
    label: 'Groq (piano gratuito)',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    note: 'Remoto e gratuito entro quota. La frase esce dal tuo computer.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (modelli :free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    note: 'Remoto. Usa un modello con suffisso :free per restare a costo zero.',
  },
  { id: 'custom', label: 'Altro endpoint', baseUrl: '', model: '', note: 'Qualsiasi server compatibile OpenAI.' },
]

export function emptyAgentConfig() {
  return { enabled: false, preset: 'ollama', baseUrl: PRESETS[0].baseUrl, model: PRESETS[0].model, apiKey: '' }
}

export function loadAgentConfig() {
  try {
    const raw = localStorage.getItem(AGENT_KEY)
    return raw ? { ...emptyAgentConfig(), ...JSON.parse(raw) } : emptyAgentConfig()
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
  "seaRequired": true SOLO se la frase pone il mare come condizione necessaria ("voglio il mare", "balneabile"); un semplice interesse per il mare NON basta,
  "allowedTypes": sottoinsieme di ["city","area","island"],
  "query": nome di una destinazione o di un paese se esplicitamente nominato,
  "understood": [ { "label": "...", "value": "...", "from": "la parola esatta della frase da cui l'hai dedotto", "note": "opzionale" } ]
}

Assi ammessi: nature (paesaggio da guardare), culture, sea, food, nightlife, outdoor (attività: trekking, sci, sport), family, offbeat (poco turistico).

Regole:
- Scala dei pesi: menzione semplice 7, enfasi ("soprattutto", "molto") 9, attenuazione ("un po' di") 3, negazione ("senza") 0.
- Includi SOLO gli assi effettivamente nominati.
- "5 giorni" significa nights 5.
- Il campo "from" è obbligatorio per ogni voce di "understood" e deve contenere parole prese TESTUALMENTE dalla frase.
- Non inventare criteri non presenti nella frase.`

/**
 * Una chiamata al server, con il JSON già estratto e verificato.
 * Rilancia con un errore leggibile: la UI deve poter dire perché ha ripiegato
 * sulle regole invece di fallire in silenzio.
 */
async function askForJson(system, user, { config, signal, timeout }) {
  if (!config?.baseUrl || !config?.model) throw new Error('Endpoint o modello non configurati')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
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
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Chiede al modello di interpretare la frase. */
export async function interpretWithModel(text, { config, signal, timeout = 60000 } = {}) {
  const parsed = await askForJson(SYSTEM_PROMPT, text, { config, signal, timeout })
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

export async function critiqueRanking({ text, entries, weights, config, signal, timeout = 60000 }) {
  const parsed = await askForJson(
    CRITIQUE_PROMPT,
    critiquePayload({ text, entries, weights }),
    { config, signal, timeout }
  )
  return sanitiseCritique(parsed, weights)
}
