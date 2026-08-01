/**
 * Risolve una foto in licenza libera per ogni destinazione.
 *
 *   node scripts/resolve-images.mjs
 *
 * NON scrive su data/destinations.json. §7 del planning: "gli script di
 * ingestione non scrivono mai direttamente: producono un file di staging che
 * viene confrontato e fuso con revisione". Qui il file è
 * data/staging/images.json, e il merge lo fai tu guardando il diff.
 *
 * Perché serve uno script invece di risolvere a runtime: per le città la
 * "lead image" di Wikipedia è quasi sempre lo stemma o la bandiera, non una
 * foto del luogo. Vanno riconosciute e scartate, e va provata un'altra voce.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'data/destinations.json')
const STAGING = resolve(ROOT, 'data/staging/images.json')

const WIDTH = 1280

/**
 * Immagini tecnicamente corrette e inutili per scegliere un viaggio.
 * Oltre a stemmi e bandiere ci finiscono mappe e riprese satellitari: la voce
 * "Mallorca" restituisce uno scatto NASA dell'isola dallo spazio, "Santorini"
 * la mappa del comune di Thira.
 */
const NOT_A_PHOTO =
  /flag|bandeira|bandera|bandiera|coat.of.arms|stemma|wappen|escudo|seal|emblem|logo|map|mappa|mapa|karte|dimos|satellite|landsat|sentinel-\d|\.svg$/i

/**
 * Voci la cui immagine principale rappresenta un'entità amministrativa e non
 * un luogo. Si preferisce un posto rappresentativo dentro l'area.
 * `wikipedia_title*` NON viene mai riscritto: la destinazione resta quella.
 */
const ALTERNATES = {
  madeira: ['Funchal', 'Madeira Island'],
  creta: ['Chania', 'Rethymno'],
  // La voce "Iceland" ha come immagine guida una bandiera o una mappa.
  'islanda-sud': ['Skógafoss', 'Seljalandsfoss', 'Jökulsárlón'],
  // "Mallorca" restituisce una ripresa satellitare, "Santorini" una mappa.
  // "Mallorca" dà una ripresa satellitare; "Serra de Tramuntana" dà montagne
  // innevate, fuorvianti per un'isola il cui asse dominante è il mare.
  maiorca: ['Cala Deià', 'Sóller', 'Palma de Mallorca'],
  santorini: ['Oia, Greece', 'Fira, Greece', 'Santorini caldera'],
  // La voce "Algarve" restituisce un palazzo: l'asse dominante è il mare.
  algarve: ['Ponta da Piedade', 'Praia da Marinha', 'Lagos, Portugal'],
  // "Transilvania" è una regione storica: la sua voce ha per immagine guida la
  // bandiera, e "Sighișoara" la mappa della Romania. Il titolo inglese del
  // castello di Bran è l'unico che restituisce davvero una foto del luogo —
  // ed è anche l'immagine che chi cerca la Transilvania si aspetta.
  transilvania: ['Bran Castle', 'Sighișoara Citadel', 'Sibiu', 'Brașov'],
}

const UA =
  'DestinationFinder/0.1 (strumento personale, uso non commerciale; contatto: marco@noe.fi.it)'

/**
 * §7 del planning: throttling obbligatorio e user-agent identificativo.
 * Wikimedia risponde 429 senza preavviso, e un 429 scambiato per "immagine non
 * disponibile" fa scrivere un fallback che non serviva.
 */
const MIN_INTERVAL_MS = 1200
let lastCall = 0

async function polite(url, options = {}, attempt = 0) {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now())
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const res = await fetch(url, {
    ...options,
    headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...(options.headers || {}) },
  })

  if (res.status === 429 && attempt < 4) {
    const backoff = 3000 * 2 ** attempt
    console.log(`      429, attendo ${backoff / 1000}s…`)
    await new Promise((r) => setTimeout(r, backoff))
    return polite(url, options, attempt + 1)
  }
  return res
}

async function summary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const res = await polite(url)
  if (!res.ok) return null
  const data = await res.json()
  if (data.type === 'disambiguation') return null
  const source = data.originalimage?.source || data.thumbnail?.source
  if (!source) return null
  // Wikimedia non fa upscaling: una thumb più larga dell'originale è 404.
  return { source, maxWidth: data.originalimage?.width || data.thumbnail?.width || WIDTH }
}

function commonsFile(source) {
  const decoded = decodeURIComponent(source.split('?')[0])
  const parts = decoded.split('/')
  return parts.includes('thumb') ? parts[parts.length - 2] : parts[parts.length - 1]
}

function thumbCandidates(source, maxWidth) {
  const clean = source.split('?')[0]
  const width = Math.min(WIDTH, maxWidth)
  const encodedFile = clean.includes('/thumb/')
    ? clean.split('/').slice(-2)[0]
    : clean.split('/').pop()

  const candidates = []
  if (clean.includes('/thumb/')) {
    candidates.push(clean.replace(/\/\d+px-[^/]+$/, `/${width}px-${encodedFile}`))
  } else {
    candidates.push(`${clean.replace('/commons/', '/commons/thumb/')}/${width}px-${encodedFile}`)
  }
  candidates.push(clean)
  return candidates
}

/** CC-BY e CC-BY-SA richiedono il credito: è la condizione d'uso. */
async function attribution(file) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo' +
    `&iiprop=extmetadata&titles=${encodeURIComponent('File:' + file)}`
  try {
    const res = await polite(url)
    if (!res.ok) return null
    const pages = (await res.json())?.query?.pages || {}
    const meta = Object.values(pages)[0]?.imageinfo?.[0]?.extmetadata
    if (!meta) return null
    const artist = (meta.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const licence = meta.LicenseShortName?.value || ''
    return [artist, licence].filter(Boolean).join(' · ') || null
  } catch {
    return null
  }
}

async function reachable(url) {
  try {
    return (await polite(url, { method: 'HEAD' })).ok
  } catch {
    return false
  }
}

const doc = JSON.parse(readFileSync(SOURCE, 'utf8'))
const staged = {}
const unchanged = []
let resolved = 0

for (const dest of doc.destinations) {
  const candidates = [
    ...(ALTERNATES[dest.id] || []).map((t) => ['en', t]),
    ['en', dest.wikipedia_title_en],
    ['it', dest.wikipedia_title],
  ].filter(([, title]) => title)

  let chosen = null
  for (const [lang, title] of candidates) {
    const found = await summary(lang, title)
    if (!found) continue
    const file = commonsFile(found.source)
    if (NOT_A_PHOTO.test(file)) continue
    for (const url of thumbCandidates(found.source, found.maxWidth)) {
      if (await reachable(url)) {
        chosen = { url, file, title, lang }
        break
      }
    }
    if (chosen) break
  }

  if (!chosen) {
    console.log(`${dest.id.padEnd(21)} nessuna foto — resterà il fallback grafico`)
    continue
  }

  const credit = (await attribution(chosen.file)) || 'Wikimedia Commons'
  resolved += 1

  if (dest.image_url === chosen.url && dest.image_credit === credit) {
    unchanged.push(dest.id)
    console.log(`${dest.id.padEnd(21)} invariata`)
    continue
  }

  staged[dest.id] = { image_url: chosen.url, image_credit: credit, source_title: chosen.title }
  console.log(`${dest.id.padEnd(21)} DA RIVEDERE  ${chosen.file.slice(0, 44)}`)
  console.log(`${' '.repeat(24)}${credit.slice(0, 74)}`)
}

mkdirSync(dirname(STAGING), { recursive: true })
writeFileSync(
  STAGING,
  JSON.stringify(
    {
      generated_for: 'data/destinations.json',
      note: 'File di staging. Non è caricato dall’app: va fuso a mano in destinations.json dopo revisione.',
      unchanged,
      changes: staged,
    },
    null,
    2
  ) + '\n',
  'utf8'
)

console.log(`\n${resolved}/${doc.destinations.length} risolte.`)
console.log(`${Object.keys(staged).length} da rivedere in data/staging/images.json`)
if (Object.keys(staged).length) {
  console.log('Nessuna modifica è stata applicata a destinations.json: fondile a mano.')
}
