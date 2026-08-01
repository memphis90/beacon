/**
 * Risolve il `wikidata_id` di ogni destinazione.
 *
 *   node scripts/resolve-wikidata.mjs
 *
 * NON scrive su data/destinations.json. §7 del planning: gli script di
 * ingestione producono un file di staging che viene confrontato e fuso con
 * revisione. Qui è data/staging/wikidata.json, e il merge lo fai tu guardando
 * il diff (`node scripts/merge-staging.mjs data/staging/wikidata.json`).
 *
 * **Non cerca per nome.** Una ricerca testuale su "Roma" restituisce la città,
 * la provincia, il comune, un film e un asteroide, e sceglierne uno a
 * occhio significa avvelenare silenziosamente ogni import futuro che parte da
 * quell'identificatore — che è esattamente ciò che il commento in cima al seed
 * dice di non fare. Si parte invece dal titolo della voce di Wikipedia, che
 * nel seed c'è già ed è una scelta umana: Wikidata restituisce l'elemento
 * collegato a quella voce, senza ambiguità.
 *
 * **Poi verifica.** L'elemento trovato deve avere una coordinata (P625) vicina
 * a quella che il seed dichiara. Se il titolo puntava alla voce sbagliata — o
 * se qualcuno l'ha spostata — la distanza lo dice, e la riga finisce fra
 * quelle da rivedere invece che nel file di staging.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'data/destinations.json')
const STAGING = resolve(ROOT, 'data/staging/wikidata.json')

const UA =
  'DestinationFinder/0.1 (strumento personale, uso non commerciale; contatto: marco@noe.fi.it)'

/** §7: throttling obbligatorio e user-agent identificativo. */
const MIN_INTERVAL_MS = 1200
let lastCall = 0

async function polite(url, attempt = 0) {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now())
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })

  if (res.status === 429 && attempt < 4) {
    const backoff = 3000 * 2 ** attempt
    console.log(`      429, attendo ${backoff / 1000}s…`)
    await new Promise((r) => setTimeout(r, backoff))
    return polite(url, attempt + 1)
  }
  return res
}

/**
 * L'elemento Wikidata collegato a una voce di Wikipedia. `sites=itwiki` e
 * `titles=` fanno la risoluzione esatta: niente ricerca, niente scelta.
 */
/** Pagina di disambiguazione: un elenco di significati, non un luogo. */
const DISAMBIGUA = 'Q4167410'

const instanceOf = (entity) =>
  (entity?.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)

async function byArticle(site, title) {
  const url = 'https://www.wikidata.org/w/api.php'
    + '?action=wbgetentities&format=json&formatversion=2'
    + `&sites=${site}&titles=${encodeURIComponent(title)}`
    + '&props=labels|descriptions|claims&languages=it|en'
  const res = await polite(url)
  if (!res.ok) return null
  const data = await res.json()
  const entities = data?.entities || {}
  const id = Object.keys(entities).find((k) => /^Q\d+$/.test(k))
  if (!id || entities[id].missing !== undefined) return null

  /**
   * Una disambiguazione non è un candidato: è la prova che il titolo nel seed
   * è ambiguo. Restituire `null` fa provare il titolo successivo — ed è così
   * che "Creta" (disambiguazione su it.wikipedia) si è risolta passando da
   * "Crete" su en.wikipedia. Senza questo controllo passava la disambiguazione
   * stessa, salvata solo dal fatto che non ha coordinate.
   */
  if (instanceOf(entities[id]).includes(DISAMBIGUA)) return null

  return { id, entity: entities[id], site, title }
}

/** La coordinata dichiarata dall'elemento, se ce l'ha. */
function coordsOf(entity) {
  const claim = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value
  if (!claim || typeof claim.latitude !== 'number') return null
  return { lat: claim.latitude, lon: claim.longitude }
}

/** Distanza in km fra due punti. Haversine: qui basta e non serve altro. */
function distanceKm(a, b) {
  const R = 6371
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Quanto lontano può stare il centroide di Wikidata da quello del seed.
 *
 * Per una città sono pochi chilometri; per un'area come la Transilvania o
 * l'Islanda del Sud il "centro" è una convenzione, e due convenzioni diverse
 * distano quanto è grande la regione. Il raggio dichiarato nel seed è la
 * misura giusta, con un minimo per le voci puntiformi e un margine perché
 * nessuno dei due centroidi è un fatto.
 */
const tolerance = (destination) => Math.max(25, (destination.radius_km || 0) * 1.5)

const doc = JSON.parse(readFileSync(SOURCE, 'utf8'))
const changes = {}
const daRivedere = []
let invariate = 0

for (const destination of doc.destinations) {
  const etichetta = destination.id.padEnd(21)

  // Un id già presente non si tocca: potrebbe essere stato messo a mano dopo
  // una verifica, e riscriverlo con quello che trova uno script cancella
  // quella verifica senza dirlo.
  if (destination.wikidata_id) {
    console.log(`${etichetta} già risolto (${destination.wikidata_id})`)
    invariate += 1
    continue
  }

  const tentativi = [
    ['itwiki', destination.wikipedia_title],
    ['enwiki', destination.wikipedia_title_en],
  ].filter(([, title]) => title)

  let trovato = null
  for (const [site, title] of tentativi) {
    trovato = await byArticle(site, title)
    if (trovato) break
  }

  if (!trovato) {
    console.log(`${etichetta} NESSUN ELEMENTO per "${destination.wikipedia_title}"`)
    daRivedere.push({ id: destination.id, motivo: 'nessun elemento collegato alla voce' })
    continue
  }

  const qui = coordsOf(trovato.entity)
  const label = trovato.entity.labels?.it?.value || trovato.entity.labels?.en?.value || '—'
  const descr = trovato.entity.descriptions?.it?.value || trovato.entity.descriptions?.en?.value || ''

  if (!qui) {
    // Senza coordinata non si può verificare niente: l'elemento potrebbe
    // essere giusto, ma dirlo sarebbe una supposizione travestita da dato.
    console.log(`${etichetta} ${trovato.id} SENZA COORDINATE — ${label}`)
    daRivedere.push({ id: destination.id, wikidata_id: trovato.id, label, motivo: 'nessuna coordinata su cui verificare' })
    continue
  }

  const km = distanceKm(destination.coords, qui)
  const limite = tolerance(destination)

  if (km > limite) {
    console.log(`${etichetta} ${trovato.id} LONTANO ${Math.round(km)} km (limite ${Math.round(limite)}) — ${label}`)
    daRivedere.push({
      id: destination.id, wikidata_id: trovato.id, label, descrizione: descr,
      distanza_km: Math.round(km), limite_km: Math.round(limite),
      motivo: 'coordinata troppo lontana da quella del seed',
    })
    continue
  }

  console.log(`${etichetta} ${trovato.id.padEnd(10)} ${Math.round(km)} km — ${label}${descr ? ` (${descr})` : ''}`)
  changes[destination.id] = { wikidata_id: trovato.id }
}

/* I dati diagnostici stanno FUORI da `changes`: merge-staging applica al seed
   ogni chiave che trova lì dentro, e una distanza in chilometri non è un campo
   della destinazione. */
mkdirSync(dirname(STAGING), { recursive: true })
writeFileSync(
  STAGING,
  `${JSON.stringify({ source: 'wikidata', changes, daRivedere }, null, 2)}\n`,
  'utf8'
)

const risolte = Object.keys(changes).length
console.log(`\n${risolte} risolte, ${invariate} già presenti, ${daRivedere.length} da rivedere.`)
console.log(`Staging: ${STAGING}`)
console.log('Nessuna modifica applicata a destinations.json: fondila con merge-staging.mjs.')
