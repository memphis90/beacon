/**
 * Sostituisce le stime di clima con misure vere, da Open-Meteo.
 *
 *   node scripts/fetch-climate.mjs
 *
 * NON scrive su data/destinations.json: produce data/staging/climate.json, da
 * fondere con merge-staging.mjs dopo aver guardato il diff (§7).
 *
 * **Cosa cambia rispetto a prima.** Il clima del seed era `seed_approx`: medie
 * scritte a mano, plausibili e non verificate. Qui diventano medie di dieci
 * anni di osservazioni (2015-2024) sul punto esatto della destinazione, il che
 * toglie di mezzo un'intera categoria di dubbi — quando il ranking sorprende,
 * il clima non è più fra i sospetti.
 *
 * **Il mare si dichiara da sé.** L'API marina, interrogata su un punto di
 * terra, risponde con una serie di valori nulli invece che con un errore:
 * Firenze restituisce zero valori validi, Rodi settecentotrentuno. Non serve
 * quindi una lista di chi ha la costa — la si chiede al dato, che è più
 * affidabile di un elenco scritto a mano e non invecchia.
 *
 * **Cosa NON tocca.** Le destinazioni con `climate_source: "manual"`: quella
 * marca dice che qualcuno ha guardato e deciso, e un import che la sovrascrive
 * cancella un giudizio senza dirlo. È lo stesso patto che vale per i punteggi.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'data/destinations.json')
const PUNTI = resolve(ROOT, 'data/climate-points.txt')
const STAGING = resolve(ROOT, 'data/staging/climate.json')

const UA =
  'DestinationFinder/0.1 (strumento personale, uso non commerciale; contatto: marco@noe.fi.it)'

/* Dieci anni per la terraferma: abbastanza da smussare l'annata anomala senza
   annacquare il clima recente. Per il mare quattro bastano — la temperatura
   dell'acqua varia molto meno da un anno all'altro, e la serie marina è più
   pesante da servire. */
const TERRA = { da: '2015-01-01', a: '2024-12-31' }
const MARE = { da: '2021-01-01', a: '2024-12-31' }

/** Pioggia: un giorno "piovoso" è un giorno con almeno un millimetro. Sotto,
    è umidità che non cambia i piani di nessuno. */
const SOGLIA_PIOGGIA_MM = 1

/* 2,5 secondi e sei tentativi: l'archivio di Open-Meteo è più severo di
   quanto dicano i limiti dichiarati — a 1,5 secondi rispondeva 429 dopo una
   decina di destinazioni. È un servizio gratuito, e la fretta la paga lui. */
const MIN_INTERVAL_MS = 2500
let lastCall = 0

async function polite(url, attempt = 0) {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now())
  if (wait) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  let res
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA } })
  } catch (error) {
    // Una connessione caduta non è diversa da un 503: si riprova.
    if (attempt < 5) {
      const backoff = 5000 * 2 ** attempt
      console.log(`      rete: ${error.message}, attendo ${backoff / 1000}s…`)
      await new Promise((r) => setTimeout(r, backoff))
      return polite(url, attempt + 1)
    }
    return null
  }

  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const backoff = 5000 * 2 ** attempt
    console.log(`      ${res.status}, attendo ${backoff / 1000}s…`)
    await new Promise((r) => setTimeout(r, backoff))
    return polite(url, attempt + 1)
  }
  return res
}

const mese = (giorno) => Number(giorno.slice(5, 7))
const media = (valori) => valori.reduce((a, b) => a + b, 0) / valori.length

/** Raggruppa una serie giornaliera per mese, scartando i buchi. */
function perMese(tempi, valori) {
  const out = new Map()
  tempi.forEach((giorno, i) => {
    const v = valori?.[i]
    if (v == null) return
    const m = mese(giorno)
    if (!out.has(m)) out.set(m, [])
    out.get(m).push(v)
  })
  return out
}

/**
 * Tre esiti, non due.
 *
 * `RIPROVA` è la distinzione che mancava: quando l'archivio rifiuta per
 * eccesso di richieste, la destinazione finiva fra quelle "senza dati per
 * questo punto" — una diagnosi falsa, e delle peggiori, perché archivia come
 * impossibile qualcosa che riuscirebbe fra un'ora. Ora quel caso non viene
 * scritto da nessuna parte, così la ripartenza lo ritenta.
 */
const RIPROVA = Symbol('riprova più tardi')

async function clima(lat, lon) {
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${lat}&longitude=${lon}&start_date=${TERRA.da}&end_date=${TERRA.a}`
    + '&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=UTC'
  const res = await polite(url)
  // `polite` restituisce null quando la rete cede dopo tutti i tentativi.
  if (!res) return RIPROVA
  if (res.status === 429 || res.status >= 500) return RIPROVA
  if (!res.ok) return null
  const d = (await res.json()).daily
  if (!d?.time?.length) return null

  const medie = perMese(d.time, d.temperature_2m_mean)
  const massime = perMese(d.time, d.temperature_2m_max)
  const piogge = perMese(d.time, d.precipitation_sum)
  const anni = new Set(d.time.map((g) => g.slice(0, 4))).size

  const out = {}
  for (let m = 1; m <= 12; m += 1) {
    const avg = medie.get(m)
    const max = massime.get(m)
    const rain = piogge.get(m) || []
    if (!avg?.length || !max?.length) return null
    out[m] = {
      temp_avg: Math.round(media(avg)),
      temp_max: Math.round(media(max)),
      // Giorni di pioggia in un mese medio: quelli sopra soglia divisi per gli
      // anni osservati, non il totale del decennio.
      rain_days: Math.round(rain.filter((mm) => mm >= SOGLIA_PIOGGIA_MM).length / anni),
    }
  }
  return out
}

async function mare(lat, lon) {
  const url = 'https://marine-api.open-meteo.com/v1/marine'
    + `?latitude=${lat}&longitude=${lon}&start_date=${MARE.da}&end_date=${MARE.a}`
    + '&daily=sea_surface_temperature_mean&timezone=UTC'
  const res = await polite(url)
  // `polite` restituisce null quando la rete cede dopo tutti i tentativi.
  if (!res?.ok) return null
  const d = (await res.json()).daily
  if (!d?.time?.length) return null

  const gruppi = perMese(d.time, d.sea_surface_temperature_mean)
  // Nessun valore valido = punto di terraferma. È la risposta, non un errore.
  if (gruppi.size === 0) return null

  const out = {}
  for (let m = 1; m <= 12; m += 1) {
    const v = gruppi.get(m)
    out[m] = v?.length ? Math.round(media(v)) : null
  }
  return out
}

/* ---- esecuzione ---------------------------------------------------------- */

const doc = JSON.parse(readFileSync(SOURCE, 'utf8'))

/**
 * Dove chiedere il clima, quando il baricentro non rappresenta il posto.
 *
 * Per un'isola o una regione montuosa il punto medio della superficie cade in
 * quota: il centroide di Tenerife sta sul Teide, e l'archivio risponde con la
 * temperatura di 3700 metri. Non è un errore della misura — è la domanda che
 * era sbagliata. Vedi data/climate-points.txt.
 */
const riferimenti = new Map()

/**
 * E dove chiedere il MARE, quando è solo quello a non tornare.
 *
 * La griglia marina è larga una manciata di chilometri, e un fiordo stretto,
 * una laguna o un golfo interno le passano fra le maglie: su Oslo — che sul
 * suo fiordo ci nuota — l'API risponde "punto di terra" anche stando in
 * acqua, a Huk. Spostare per questo il punto del clima **terrestre** sarebbe
 * una cura peggiore del male: il clima di Oslo è quello di Oslo, e prenderlo
 * trenta chilometri più a valle vuol dire misurare un altro posto.
 *
 * Quindi due punti distinti, e solo dove serve: `id #mare` nel file dichiara
 * dove chiedere l'acqua, lasciando la terra al suo posto.
 */
const riferimentiMare = new Map()

try {
  for (const riga of readFileSync(PUNTI, 'utf8').split(/\r?\n/)) {
    const pulita = riga.trim()
    if (!pulita || pulita.startsWith('#')) continue
    const [etichetta, lat, lon] = pulita.split('|').map((p) => p.trim())
    if (!etichetta || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) continue

    const soloMare = etichetta.endsWith('#mare')
    const id = soloMare ? etichetta.slice(0, -'#mare'.length).trim() : etichetta
    const punto = { lat: Number(lat), lon: Number(lon) }
    if (soloMare) riferimentiMare.set(id, punto)
    else riferimenti.set(id, punto)
  }
  const totale = riferimenti.size + riferimentiMare.size
  if (totale) {
    const dettaglio = riferimentiMare.size ? `, di cui ${riferimentiMare.size} per il solo mare` : ''
    console.log(`${totale} punti di riferimento climatico dichiarati${dettaglio}.\n`)
  }
} catch { /* il file è facoltativo */ }

/**
 * Filtro facoltativo: `node scripts/fetch-climate.mjs gargano bretagna`.
 *
 * Serve quando si corregge un punto di riferimento e si vuole rimisurare
 * quella destinazione soltanto. Senza, la correzione di tre schede costerebbe
 * trecentosedici chiamate a un servizio gratuito e un diff di
 * centocinquantotto climi da rileggere per trovarci dentro le tre che
 * contano.
 */
const soloQuesti = new Set(process.argv.slice(2).filter((a) => !a.startsWith('-')))
if (soloQuesti.size) {
  const ignoti = [...soloQuesti].filter((id) => !doc.destinations.some((d) => d.id === id))
  if (ignoti.length) {
    console.error(`ID inesistenti: ${ignoti.join(', ')}`)
    process.exit(1)
  }
  console.log(`Solo: ${[...soloQuesti].join(', ')}\n`)
}

/**
 * Ripartenza: quello che è già in staging non si richiede.
 *
 * Centodue destinazioni per due chiamate ciascuna, a due secondi e mezzo
 * l'una, sono più di otto minuti di rete altrui. Se cade a metà — ed è caduto
 * — ricominciare da capo significa chiedere di nuovo cose già ottenute, che è
 * scortese verso un servizio gratuito prima ancora che lento.
 */
let changes = {}
let daRivedere = []
try {
  const prima = JSON.parse(readFileSync(STAGING, 'utf8'))
  changes = prima.changes || {}
  daRivedere = prima.daRivedere || []
  const fatte = Object.keys(changes).length
  if (fatte) console.log(`Riprendo: ${fatte} già in staging, non le richiedo.\n`)
} catch { /* nessuno staging precedente: si parte da zero */ }

const salva = () => {
  mkdirSync(dirname(STAGING), { recursive: true })
  writeFileSync(
    STAGING,
    `${JSON.stringify({ source: 'open-meteo', finestra: { terra: TERRA, mare: MARE }, changes, daRivedere }, null, 2)}\n`,
    'utf8'
  )
}

let saltate = 0
let fermate = 0

for (const d of doc.destinations) {
  const etichetta = d.name.padEnd(22)

  if (soloQuesti.size && !soloQuesti.has(d.id)) { saltate += 1; continue }

  if (changes[d.id]) { saltate += 1; continue }

  if (d.climate_source === 'manual') {
    console.log(`${etichetta} clima manuale, non lo tocco`)
    saltate += 1
    continue
  }
  if (!d.coords?.lat) {
    daRivedere.push({ id: d.id, motivo: 'nessuna coordinata' })
    continue
  }

  const punto = riferimenti.get(d.id) || d.coords
  const terra = await clima(punto.lat, punto.lon)
  if (terra === RIPROVA) {
    console.log(`${etichetta} limite di frequenza — la lascio per la prossima passata`)
    fermate += 1
    continue
  }
  if (!terra) {
    console.log(`${etichetta} ARCHIVIO SENZA DATI per questo punto`)
    daRivedere.push({ id: d.id, motivo: 'archivio meteo senza dati per questo punto' })
    continue
  }

  const puntoMare = riferimentiMare.get(d.id) || punto
  const acqua = await mare(puntoMare.lat, puntoMare.lon)

  /**
   * La misura aggiorna i numeri del mare, non decide SE il mare c'è.
   *
   * La griglia del modello marino è larga una manciata di chilometri, e su
   * una città vicina alla costa risponde con dei valori anche quando al mare
   * non ci si va a piedi: Roma, a venticinque chilometri dal Tirreno, ne
   * riceveva uno. Accettarlo l'avrebbe fatta passare per il filtro "mare
   * balneabile", che è una promessa che quella destinazione non mantiene.
   *
   * Per chi un clima ce l'aveva già, il verdetto precedente resta: se non
   * aveva mare, non ne acquista uno. Per le destinazioni nuove non c'è un
   * verdetto da rispettare — entrano comunque come "da valutare", e chi
   * assegna i punteggi guarderà anche questo.
   *
   * **Salvo che il punto sia dichiarato.** Il "verdetto precedente" del
   * Gargano era un no ottenuto chiedendo alla Foresta Umbra, venti chilometri
   * dentro terra: non un giudizio da rispettare, lo stesso difetto di prima
   * cristallizzato in un dato. Una riga in `climate-points.txt` è una persona
   * che ha scelto dove chiedere, ed è esattamente l'atto umano che la guardia
   * pretende — la guardia esiste per impedire che a decidere sia la griglia
   * per conto suo, non per impedire a noi di correggere la domanda.
   */
  const dichiarato = riferimenti.has(d.id) || riferimentiMare.has(d.id)
  const avevaClima = Boolean(d.climate?.['7'])
  const avevaMare = avevaClima
    && Object.values(d.climate).some((m) => m?.sea_temp != null)
  const accettaMare = dichiarato || (avevaClima ? avevaMare : true)

  const climate = {}
  for (let m = 1; m <= 12; m += 1) {
    climate[m] = { ...terra[m], sea_temp: acqua && accettaMare ? acqua[m] : null }
  }

  changes[d.id] = { climate, climate_source: 'open-meteo' }
  // Si salva a ogni destinazione, non alla fine: è ciò che rende la
  // ripartenza possibile invece che teorica.
  salva()

  const estate = climate[7]
  const marino = acqua ? `mare ${climate[7].sea_temp}°` : 'senza mare'
  console.log(`${etichetta} luglio ${String(estate.temp_avg).padStart(2)}°/${estate.temp_max}° · ${String(estate.rain_days).padStart(2)} gg pioggia · ${marino}`)
}

salva()

console.log(`\n${Object.keys(changes).length} climi misurati, ${saltate} lasciati stare, ${daRivedere.length} da rivedere.`)
if (fermate) {
  console.log(`${fermate} fermate dal limite di frequenza: rilancia lo script fra un'ora e riprenderà da lì.`)
}
console.log(`Staging: ${STAGING}`)
console.log('Nessuna modifica applicata a destinations.json: fondila con merge-staging.mjs.')
