/**
 * Fonde un file di staging in data/destinations.json.
 *
 *   node scripts/merge-staging.mjs data/staging/images.json
 *
 * §7 del planning separa deliberatamente l'ingestione dalla scrittura: gli
 * script di estrazione producono staging, questo lo applica. La revisione è il
 * passo umano fra i due, e per questo il merge stampa ogni campo che cambia
 * prima di scrivere.
 *
 * Non tocca mai `scores` con `scores_source: "manual"`: un override umano non
 * va sovrascritto da un import, che è l'invariante del §4.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = resolve(ROOT, 'data/destinations.json')
const staging = resolve(ROOT, process.argv[2] || 'data/staging/images.json')

const doc = JSON.parse(readFileSync(TARGET, 'utf8'))
const patch = JSON.parse(readFileSync(staging, 'utf8'))
const byId = new Map(doc.destinations.map((d) => [d.id, d]))

let applied = 0
const skipped = []

for (const [id, fields] of Object.entries(patch.changes || {})) {
  const dest = byId.get(id)
  if (!dest) {
    skipped.push(`${id}: non esiste in destinations.json`)
    continue
  }

  for (const [key, value] of Object.entries(fields)) {
    // Campi diagnostici dello staging, non destinati al seed.
    if (key === 'source_title') continue

    if (key === 'scores' && dest.scores_source === 'manual') {
      skipped.push(`${id}: punteggi manuali, non sovrascritti`)
      continue
    }

    if (JSON.stringify(dest[key]) === JSON.stringify(value)) continue
    console.log(`${id.padEnd(20)} ${key}`)
    console.log(`${' '.repeat(22)}- ${JSON.stringify(dest[key] ?? null).slice(0, 72)}`)
    console.log(`${' '.repeat(22)}+ ${JSON.stringify(value).slice(0, 72)}`)
    dest[key] = value
    applied += 1
  }
}

/**
 * Le destinazioni NUOVE stanno in una sezione a parte.
 *
 * Aggiungere e correggere sono due gesti diversi e vanno guardati con occhi
 * diversi: una correzione la si confronta col valore di prima, un'aggiunta la
 * si giudica per intero. Tenerle nello stesso elenco avrebbe fatto scorrere
 * via le seconde in mezzo alle prime.
 *
 * Un id già esistente non viene mai sovrascritto: quello è un aggiornamento
 * travestito da aggiunta, e se serve si fa con `changes`.
 */
let aggiunte = 0
for (const [id, destination] of Object.entries(patch.additions || {})) {
  if (byId.has(id)) {
    skipped.push(`${id}: esiste già, un'aggiunta non lo sovrascrive`)
    continue
  }
  console.log(`+ ${id.padEnd(20)} ${destination.name} (${destination.country}, ${destination.type})`)
  doc.destinations.push({ ...destination, id })
  byId.set(id, destination)
  aggiunte += 1
}

// L'ordine alfabetico è quello del seed: mantenerlo tiene il diff leggibile
// anche quando le aggiunte sono molte.
if (aggiunte) doc.destinations.sort((a, b) => a.name.localeCompare(b.name, 'it'))

writeFileSync(TARGET, JSON.stringify(doc, null, 2) + '\n', 'utf8')
console.log(`\n${applied} campi applicati, ${aggiunte} destinazioni aggiunte. Totale: ${doc.destinations.length}.`)
skipped.forEach((s) => console.log(`  saltato — ${s}`))
