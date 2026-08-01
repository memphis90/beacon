/**
 * Espande il catalogo con le destinazioni elencate in data/candidates.txt.
 *
 *   node scripts/expand-catalogue.mjs
 *
 * NON scrive su data/destinations.json. §7 del planning: produce
 * data/staging/catalogue.json, che si fonde con
 * `node scripts/merge-staging.mjs data/staging/catalogue.json` dopo aver
 * guardato il diff.
 *
 * **Cosa riempie e cosa no.** Riempie ciò che è un fatto: identificatore
 * Wikidata, coordinate, paese, titoli delle voci. NON riempie punteggi, costi
 * e clima — quelli sono giudizi o misure, e inventarli sarebbe esattamente ciò
 * che il §4 vieta. Le destinazioni entrano marcate `scores_source: "todo"`, e
 * finché restano tali l'app le tiene fuori dal ranking dicendo perché: una
 * destinazione senza punteggi non è una destinazione mediocre, è una
 * destinazione non ancora valutata.
 *
 * **Perché una lista scritta a mano.** La scoperta automatica — "tutte le
 * città europee sopra N" — l'ho provata: l'endpoint SPARQL pubblico rifiuta le
 * query aperte, e quando risponde ordina per popolazione, che premia i
 * capoluoghi amministrativi e mette Ankara prima di Firenze. Un catalogo di
 * viaggio non è un elenco di insediamenti: quali posti ci stiano è un
 * giudizio, e resta umano. Vedi il commento in cima a candidates.txt.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'data/destinations.json')
const CANDIDATES = resolve(ROOT, 'data/candidates.txt')
const STAGING = resolve(ROOT, 'data/staging/catalogue.json')

const UA =
  'DestinationFinder/0.1 (strumento personale, uso non commerciale; contatto: marco@noe.fi.it)'

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

const DISAMBIGUA = 'Q4167410'
const TIPI = new Set(['city', 'area', 'island'])

/** Raggio predefinito per tipo: una città non è una regione. */
const RAGGIO = { city: 25, area: 90, island: 60 }

const instanceOf = (entity) =>
  (entity?.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)

/**
 * Tutti i valori di una proprietà, quelli ancora validi per primi.
 *
 * `P17` (paese) non è un valore solo: Dublino elenca il Regno d'Irlanda, il
 * Regno Unito e l'Irlanda, perché Wikidata registra anche il passato. Prendere
 * il primo dava uno stato storico senza codice ISO — e la destinazione
 * risultava "senza paese" pur avendone uno ovvio. I claim con una data di fine
 * (P582) vanno in coda: sono quelli che non valgono più.
 */
function claimIds(entity, prop) {
  const claims = entity?.claims?.[prop] || []
  const attuali = []
  const passati = []
  for (const c of claims) {
    const id = c?.mainsnak?.datavalue?.value?.id
    if (!id) continue
    ;(c.qualifiers?.P582 ? passati : attuali).push(id)
  }
  return [...new Set([...attuali, ...passati])]
}

function coordsOf(entity) {
  const v = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value
  if (!v || typeof v.latitude !== 'number') return null
  return { lat: Number(v.latitude.toFixed(4)), lon: Number(v.longitude.toFixed(4)) }
}

/**
 * Il codice ISO a due lettere del paese, che è come il seed identifica i paesi.
 * Si provano i candidati in ordine e vince il primo che ha un codice: gli
 * stati storici non ne hanno, ed è proprio così che si scartano da soli.
 */
const cacheCodici = new Map()

async function countryCode(qids) {
  for (const qid of qids) {
    if (cacheCodici.has(qid)) {
      if (cacheCodici.get(qid)) return cacheCodici.get(qid)
      continue
    }
    const url = 'https://www.wikidata.org/w/api.php'
      + `?action=wbgetentities&format=json&formatversion=2&ids=${qid}&props=claims`
    const res = await polite(url)
    if (!res.ok) { cacheCodici.set(qid, null); continue }
    const data = await res.json()
    const code = data?.entities?.[qid]?.claims?.P297?.[0]?.mainsnak?.datavalue?.value || null
    cacheCodici.set(qid, code)
    if (code) return code
  }
  return null
}

/**
 * Il titolo canonico della voce, seguendo i redirect.
 *
 * `wbgetentities` NON segue i redirect: cerca il titolo esatto e, se quello è
 * un rimando, risponde "non esiste". Così "Isole Fær Øer" e "Zara (Croazia)"
 * risultavano introvabili pur essendo voci perfettamente raggiungibili — e la
 * diagnosi diceva "voce assente", che era falsa. Wikipedia invece i redirect
 * li risolve, quindi si chiede prima a lei come si chiama davvero.
 */
async function canonicalTitle(title) {
  const url = 'https://it.wikipedia.org/w/api.php'
    + '?action=query&format=json&formatversion=2&redirects=1'
    + `&titles=${encodeURIComponent(title)}`
  const res = await polite(url)
  if (!res.ok) return title
  const data = await res.json()
  const page = data?.query?.pages?.[0]
  if (!page || page.missing) return title
  return page.title || title
}

async function byArticle(site, title) {
  const url = 'https://www.wikidata.org/w/api.php'
    + '?action=wbgetentities&format=json&formatversion=2'
    + `&sites=${site}&titles=${encodeURIComponent(title)}`
    + '&props=labels|claims|sitelinks&languages=it|en&sitefilter=itwiki|enwiki'
  const res = await polite(url)
  if (!res.ok) return null
  const data = await res.json()
  const entities = data?.entities || {}
  const id = Object.keys(entities).find((k) => /^Q\d+$/.test(k))
  if (!id || entities[id].missing !== undefined) return null
  if (instanceOf(entities[id]).includes(DISAMBIGUA)) return null
  return { id, entity: entities[id] }
}

/** Identificatore stabile e leggibile, come quelli scritti a mano nel seed. */
const slugify = (text) =>
  text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/* ---- lettura dei candidati ---------------------------------------------- */

const righe = readFileSync(CANDIDATES, 'utf8')
  .split(/\r?\n/)
  .map((r) => r.trim())
  .filter((r) => r && !r.startsWith('#'))

const candidati = []
const malformate = []
for (const riga of righe) {
  const [titolo, tipo, paese] = riga.split('|').map((p) => (p || '').trim())
  if (!titolo || !TIPI.has(tipo)) { malformate.push(riga); continue }
  if (candidati.some((c) => c.titolo === titolo)) continue // ripetizioni nel file
  /* Il terzo campo è facoltativo e forza il paese. Serve per i posti che ne
     hanno più d'uno: l'Istria sta in Croazia, Slovenia e Italia, e Wikidata li
     elenca tutti — qualunque scelta automatica sarebbe arbitraria, e il seed
     ha un campo solo. */
  candidati.push({ titolo, tipo, paese: /^[A-Z]{2}$/.test(paese || '') ? paese : null })
}

const doc = JSON.parse(readFileSync(SOURCE, 'utf8'))
const titoliEsistenti = new Set(doc.destinations.map((d) => d.wikipedia_title))
const idEsistenti = new Set(doc.destinations.map((d) => d.wikidata_id).filter(Boolean))
const slugEsistenti = new Set(doc.destinations.map((d) => d.id))

console.log(`${candidati.length} candidati, ${doc.destinations.length} già nel seed.\n`)
if (malformate.length) {
  console.log(`Righe ignorate perché malformate: ${malformate.length}`)
  for (const r of malformate) console.log(`  "${r}"`)
  console.log('')
}

/* ---- risoluzione --------------------------------------------------------- */

const additions = {}
const daRivedere = []
let saltate = 0

for (const { titolo, tipo, paese } of candidati) {
  const etichetta = titolo.padEnd(24)

  if (titoliEsistenti.has(titolo)) {
    saltate += 1
    continue
  }

  // Il titolo scritto può essere un rimando: si passa da quello canonico, o
  // Wikidata risponde "non esiste" per una voce che esiste benissimo.
  const canonico = await canonicalTitle(titolo)
  if (canonico !== titolo) console.log(`${etichetta} → "${canonico}"`)
  if (titoliEsistenti.has(canonico)) { saltate += 1; continue }

  const trovato = await byArticle('itwiki', canonico)
  if (!trovato) {
    console.log(`${etichetta} NESSUN ELEMENTO (voce assente o pagina di disambiguazione)`)
    daRivedere.push({ titolo, motivo: 'nessun elemento: voce inesistente o pagina di disambiguazione' })
    continue
  }

  if (idEsistenti.has(trovato.id)) {
    console.log(`${etichetta} ${trovato.id} già nel seed con un altro titolo`)
    saltate += 1
    continue
  }

  const coords = coordsOf(trovato.entity)
  if (!coords) {
    console.log(`${etichetta} ${trovato.id} SENZA COORDINATE`)
    daRivedere.push({ titolo, wikidata_id: trovato.id, motivo: 'nessuna coordinata' })
    continue
  }

  const cc = paese || await countryCode(claimIds(trovato.entity, 'P17'))
  if (!cc) {
    console.log(`${etichetta} ${trovato.id} SENZA PAESE`)
    daRivedere.push({ titolo, wikidata_id: trovato.id, motivo: 'paese non risolvibile in codice ISO' })
    continue
  }

  const nome = trovato.entity.labels?.it?.value || titolo
  let id = slugify(nome)
  // Due destinazioni diverse possono produrre lo stesso identificatore: meglio
  // un suffisso brutto che una sovrascrittura silenziosa.
  if (slugEsistenti.has(id)) id = `${id}-${trovato.id.toLowerCase()}`
  slugEsistenti.add(id)

  additions[id] = {
    id,
    name: nome,
    country: cc,
    type: tipo,
    coords,
    radius_km: RAGGIO[tipo],
    wikidata_id: trovato.id,
    // Il canonico, non quello scritto nel file: un redirect salvato nel seed
    // tornerebbe a fallire al prossimo script che parte da quel titolo.
    wikipedia_title: canonico,
    wikipedia_title_en: trovato.entity.sitelinks?.enwiki?.title || null,
    airports: [],
    /* Niente punteggi, costi, clima: sono giudizi o misure, e inventarli è
       ciò che il §4 vieta. `todo` è la marca che tiene la destinazione fuori
       dal ranking finché qualcuno non la valuta. */
    scores_source: 'todo',
    climate_source: 'todo',
    pois: [],
    notes: '',
    image_url: null,
    image_credit: null,
  }

  console.log(`${etichetta} ${trovato.id.padEnd(9)} ${cc}  ${tipo.padEnd(6)} ${coords.lat},${coords.lon}`)
}

mkdirSync(dirname(STAGING), { recursive: true })
writeFileSync(
  STAGING,
  `${JSON.stringify({ source: 'catalogue', additions, daRivedere }, null, 2)}\n`,
  'utf8'
)

console.log(`\n${Object.keys(additions).length} nuove, ${saltate} già presenti, ${daRivedere.length} da rivedere.`)
console.log(`Staging: ${STAGING}`)
console.log('Nessuna modifica applicata a destinations.json: fondila con merge-staging.mjs.')
