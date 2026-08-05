/**
 * Ricava gli aeroporti delle destinazioni che non ce l'hanno, da OurAirports.
 *
 *   node scripts/resolve-airports.mjs
 *
 * NON scrive su data/destinations.json: produce data/staging/airports.json, da
 * fondere con merge-staging.mjs dopo aver guardato il diff (§7).
 *
 * **Il buco che colma.** Il campo `airports` esisteva su 23 destinazioni su
 * 158 — esattamente le 23 del seed scritto a mano. Le 135 aggiunte da
 * `expand-catalogue.mjs` non l'hanno mai ricevuto, e senza un codice aeroporto
 * né il filtro sul tempo di volo né le fasce prezzo della Fase 2 possono
 * esistere.
 *
 * **La regola, e come è stata scelta.** Misurata contro le 23 curate a mano,
 * il 2026-08-05, provando raggi fissi e adattivi:
 *
 *   | regola                       | ritrova | propone | senza nulla |
 *   |------------------------------|---------|---------|-------------|
 *   | 100 km fissi, primi 3        | 86%     | 49      | 1           |
 *   | radius_km + 60, primi 3      | 91%     | 52      | 0           |
 *   | radius_km + 80, primi 4      | 97%     | 63      | 0           |
 *
 * Vince la seconda: stessa copertura della terza sui casi difficili, con un
 * terzo di rumore in meno da scartare in revisione.
 *
 * **Perché il raggio è adattivo e non fisso.** Con 100 km fissi le cinque
 * scelte umane mancate erano tutte aree e isole vaste — Dolomiti, Lofoten,
 * Transilvania, Islanda del Sud — dove l'aeroporto vero sta a 102-153 km dal
 * centro. L'Islanda del Sud non ne aveva **nessuno** entro 100 km. Il raggio
 * di una destinazione dice quanto è larga: usarlo qui è gratis e risolve tutta
 * la categoria.
 *
 * **Quello che la regola non sa fare, e nessuna saprebbe.** Restano fuori 3
 * scelte umane su 35, e sono tutte dello stesso tipo: una persona ha preferito
 * un aeroporto grande e lontano a uno medio e vicino — Verona per le Dolomiti
 * invece di Bolzano. È una scelta sui voli che ci atterrano, non sulla
 * geografia, e il dato geografico non la contiene. Per questo l'output è
 * staging da rivedere, non un merge automatico.
 *
 * **Cosa NON tocca.** Le destinazioni che un `airports` ce l'hanno già: quella
 * lista è il giudizio di qualcuno, e un import che la sovrascrive cancella una
 * decisione senza dirlo. È lo stesso patto di `scores_source: "manual"`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'data/destinations.json')
const CACHE = resolve(ROOT, 'data/cache/ourairports.csv')
const STAGING = resolve(ROOT, 'data/staging/airports.json')

const CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const UA = 'beacon-destination-finder/0.1 (strumento personale, uso non commerciale)'

/** Quanti km oltre il raggio della destinazione si guarda. */
const EXTRA_KM = 60
/** Quanti candidati al massimo per destinazione. */
const MAX_PER_DEST = 3

/**
 * Un parser CSV minimo ma corretto per le virgolette: i nomi degli aeroporti
 * contengono virgole ("Paris Charles de Gaulle, Roissy") e uno `split(',')`
 * sfalserebbe tutte le colonne successive senza dare errore.
 */
function parseCsv(testo) {
  const righe = []
  let campo = ''
  let riga = []
  let dentroVirgolette = false

  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]
    if (dentroVirgolette) {
      if (c === '"') {
        if (testo[i + 1] === '"') { campo += '"'; i++ } else dentroVirgolette = false
      } else campo += c
    } else if (c === '"') dentroVirgolette = true
    else if (c === ',') { riga.push(campo); campo = '' }
    else if (c === '\n') { riga.push(campo); righe.push(riga); riga = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga) }
  return righe
}

/** §7: ogni chiamata a fonti esterne va cachata su disco. Il file pesa ~12 MB. */
async function scaricaCatalogoAeroporti() {
  if (existsSync(CACHE)) {
    console.log(`cache: ${CACHE}`)
    return readFileSync(CACHE, 'utf8')
  }
  console.log(`scarico ${CSV_URL} …`)
  const risposta = await fetch(CSV_URL, { headers: { 'user-agent': UA } })
  if (!risposta.ok) throw new Error(`OurAirports ha risposto ${risposta.status}`)
  const testo = await risposta.text()
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, testo)
  console.log(`salvato in cache (${(testo.length / 1e6).toFixed(1)} MB)`)
  return testo
}

const R_TERRA = 6371
const rad = (gradi) => (gradi * Math.PI) / 180

/** Haversine, la stessa formula che scoring.js usa per i POI. */
function distanzaKm(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_TERRA * Math.asin(Math.sqrt(h))
}

const doc = JSON.parse(readFileSync(SOURCE, 'utf8'))
const righe = parseCsv(await scaricaCatalogoAeroporti())
const intestazione = righe[0]
const col = (nome) => {
  const i = intestazione.indexOf(nome)
  if (i < 0) throw new Error(`colonna "${nome}" assente: OurAirports ha cambiato schema`)
  return i
}

const C = {
  tipo: col('type'), lat: col('latitude_deg'), lon: col('longitude_deg'),
  paese: col('iso_country'), servizio: col('scheduled_service'),
  iata: col('iata_code'), nome: col('name'), comune: col('municipality'),
}

/**
 * `scheduled_service` e `type` sono la ragione per cui questa fonte è stata
 * scelta: senza, entrano aviosuperfici ed eliporti — 85.831 righe diventano
 * 3.270 aeroporti dove atterra davvero un volo di linea.
 */
const aeroporti = righe.slice(1)
  .filter((r) => r[C.iata] && r[C.servizio] === 'yes'
    && ['large_airport', 'medium_airport'].includes(r[C.tipo]))
  .map((r) => ({
    iata: r[C.iata],
    nome: r[C.nome],
    comune: r[C.comune],
    paese: r[C.paese],
    tipo: r[C.tipo],
    lat: Number(r[C.lat]),
    lon: Number(r[C.lon]),
  }))
  .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))

console.log(`aeroporti utilizzabili: ${aeroporti.length} su ${righe.length - 1}`)

const changes = {}
const saltate = []
const diagnostica = []

for (const d of doc.destinations) {
  if (Array.isArray(d.airports) && d.airports.length) {
    saltate.push(d.id)
    continue
  }
  if (!d.coords || !Number.isFinite(d.coords.lat)) {
    diagnostica.push(`${d.id}: senza coordinate, saltata`)
    continue
  }

  const limite = (d.radius_km || 25) + EXTRA_KM
  const vicini = aeroporti
    .map((a) => ({ ...a, km: distanzaKm(d.coords, a) }))
    .filter((a) => a.km <= limite)
    // Grande prima di medio, poi il più vicino: è l'ordine che riproduce
    // meglio le scelte umane dei 23 curati.
    .sort((x, y) => (x.tipo === y.tipo ? x.km - y.km : x.tipo === 'large_airport' ? -1 : 1))
    .slice(0, MAX_PER_DEST)

  if (!vicini.length) {
    diagnostica.push(`${d.id}: nessun aeroporto entro ${Math.round(limite)} km`)
    continue
  }

  changes[d.id] = {
    airports: vicini.map((a) => a.iata),
    airports_source: 'derived',
  }

  console.log(
    `${d.id.padEnd(24)} ${vicini.map((a) => `${a.iata} ${Math.round(a.km)}km`).join(', ')}`,
  )
}

mkdirSync(dirname(STAGING), { recursive: true })
writeFileSync(STAGING, `${JSON.stringify({
  source: 'ourairports',
  regola: `radius_km + ${EXTRA_KM} km, primi ${MAX_PER_DEST}, grande prima di medio`,
  changes,
}, null, 2)}\n`)

console.log(`\nproposti: ${Object.keys(changes).length}`)
console.log(`già presenti, non toccate: ${saltate.length}`)
if (diagnostica.length) {
  console.log('da guardare:')
  diagnostica.forEach((r) => console.log(`  ${r}`))
}
console.log(`\nstaging: ${STAGING}`)
console.log('Guarda il diff, poi: node scripts/merge-staging.mjs data/staging/airports.json')
