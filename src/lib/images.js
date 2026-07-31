/**
 * Risoluzione delle foto delle destinazioni.
 *
 * Nel dato NON è memorizzato alcun URL di immagine: gli URL di Wikimedia
 * Commons non sono derivabili dal nome di una località, e inventarli produce
 * 404 di massa. È memorizzato il titolo Wikipedia, che è noto con certezza,
 * e la foto si risolve a runtime dall'API REST.
 *
 * §7 del planning: "ogni chiamata a fonti esterne va cachata su disco".
 * Qui la cache è localStorage, ed è negativa oltre che positiva: un titolo
 * che non ha immagine non deve essere richiesto a ogni render.
 *
 * Nota sull'user-agent identificativo richiesto dal §7: nel browser non è
 * impostabile via fetch. Vale per gli script di ingestione Python di Fase 1.
 */
const CACHE_KEY = 'destination-finder:images:v1'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* quota piena: la cache è un'ottimizzazione, non un requisito */
  }
}

async function fetchSummaryThumb(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) return null
  const data = await response.json()
  const source = data?.thumbnail?.source
  if (!source) return null
  // Le thumb di Wikimedia sono servite a larghezza arbitraria: chiediamo una
  // misura adatta all'header della card invece del 320px di default.
  return source.replace(/\/\d+px-/, '/640px-')
}

const inFlight = new Map()

/**
 * Restituisce l'URL della foto, o null se non c'è / non è raggiungibile.
 * Chi consuma deve avere un fallback grafico: l'app resta pienamente
 * usabile offline.
 */
export function resolveImage(destination) {
  // Percorso normale: l'URL è nel dato, già verificato e con l'attribuzione
  // accanto. Risolverlo a runtime non funzionava: per le città la lead image
  // di Wikipedia è lo stemma o la bandiera, non una foto del luogo.
  if (destination.image_url) return Promise.resolve(destination.image_url)

  // Ripiego per le destinazioni create nell'editor, che un URL non ce l'hanno.
  const { id, wikipedia_title: itTitle, wikipedia_title_en: enTitle } = destination
  if (!itTitle && !enTitle) return Promise.resolve(null)

  const cache = readCache()
  const hit = cache[id]
  if (hit && Date.now() - hit.ts < TTL_MS) return Promise.resolve(hit.url)

  if (inFlight.has(id)) return inFlight.get(id)

  const attempts = [
    itTitle && ['it', itTitle],
    enTitle && ['en', enTitle],
  ].filter(Boolean)

  const promise = (async () => {
    for (const [lang, title] of attempts) {
      try {
        const url = await fetchSummaryThumb(lang, title)
        if (url) return url
      } catch {
        /* offline o rete bloccata: prova la lingua successiva, poi rinuncia */
      }
    }
    return null
  })()
    .then((url) => {
      writeCache({ ...readCache(), [id]: { url, ts: Date.now() } })
      return url
    })
    .finally(() => inFlight.delete(id))

  inFlight.set(id, promise)
  return promise
}

export function clearImageCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* niente da fare */
  }
}
