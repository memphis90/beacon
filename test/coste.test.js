import { describe, it, expect } from 'vitest'
import seed from '../data/destinations.json'
import { PRIMARY_MIN, rankDestinations } from '../src/lib/scoring.js'
import { emptyWeights } from '../src/lib/axes.js'

/**
 * L'asse `mare` significa **spiagge e balneabilità**, non "il mare si vede da
 * qui".
 *
 * È la distinzione che lo stress test del 1 agosto ha visto saltare: sei città
 * portuali stavano sopra al cancello di `primary`, e una ricerca sul mare
 * restituiva Genova e Salonicco insieme alla Sardegna. La deriva era leggibile
 * nella definizione stessa dell'asse, che fino alla passata costiera del
 * 2026-08-04 diceva anche «vita di costa» — una porta abbastanza larga da
 * farci passare qualunque porto.
 *
 * Queste prove guardano i dati veri, non un campione costruito: un punteggio
 * scritto a mano si sposta con un carattere, e nessuna delle altre prove se ne
 * accorgerebbe.
 */

const byId = Object.fromEntries(seed.destinations.map((d) => [d.id, d]))
const mesiConMare = (d) => Object.values(d.climate || {}).filter((m) => m?.sea_temp != null).length

describe('l’asse mare vuole il bagno, non la vista', () => {
  /**
   * L'invariante è senza eccezioni, e ci è voluta una correzione per renderla
   * tale: Gargano, Bretagna e Oslo avevano mare vero e nessuna temperatura
   * marina, perché il baricentro da cui `fetch-climate.mjs` interrogava
   * Open-Meteo cadeva nell'entroterra — la Foresta Umbra, il centro della
   * penisola bretone — e per Oslo la griglia marina non risolve il fiordo
   * interno. Chiusa il 2026-08-04 con tre punti in `data/climate-points.txt`.
   *
   * Non era innocuo: senza `sea_temp` la rampa stagionale azzera l'asse per
   * QUALUNQUE mese, e il Gargano — che di mare vive, 82 — spariva da ogni
   * ricerca balneare con una data. Il difetto mordeva nel verso opposto a
   * quello che la passata costiera correggeva, ed è la ragione per cui questa
   * prova guarda la coerenza fra i due campi invece che i singoli numeri.
   */
  it('un punteggio di mare senza una temperatura del mare è una promessa non mantenuta', () => {
    const bugiarde = seed.destinations
      .filter((d) => d.scores?.sea > 0 && mesiConMare(d) === 0)
      .map((d) => d.id)

    expect(bugiarde).toEqual([])
  })

  it('il Gargano ha di nuovo un mare, e d’estate è caldo', () => {
    /* La prova del nove della correzione: prima erano dodici mesi a null, e
       l'asse valeva zero in agosto come in gennaio. */
    const gargano = seed.destinations.find((d) => d.id === 'gargano')
    expect(mesiConMare(gargano)).toBe(12)
    expect(gargano.climate['8'].sea_temp).toBeGreaterThan(25)
  })

  it('Ocrida è un lago e Amburgo sta sull’Elba: né l’uno né l’altro hanno mare', () => {
    expect(byId['comune-di-ocrida'].scores.sea).toBe(0)
    expect(byId.amburgo.scores.sea).toBe(0)
  })

  it('le città portuali stanno sotto il cancello di «soprattutto mare»', () => {
    /* Non sono destinazioni sbagliate: sono destinazioni sbagliate *per questa
       domanda*. Chi chiede il mare come requisito principale non deve trovarle,
       e il cancello di `primary` è esattamente il punto in cui vengono tolte. */
    const porti = ['genova', 'napoli', 'trieste', 'atene', 'salonicco', 'lisbona',
      'la-valletta', 'lecce', 'istanbul', 'bilbao', 'mont-saint-michel']

    for (const id of porti) {
      expect(byId[id].scores.sea, `${id} passerebbe il cancello`).toBeLessThan(PRIMARY_MIN)
    }
  })

  it('una ricerca «soprattutto mare» non restituisce più le città portuali', () => {
    const { results } = rankDestinations(seed.destinations, {
      weights: { ...emptyWeights(), sea: 9 },
      primary: 'sea',
    })
    const ids = results.map((r) => r.destination.id)

    expect(ids).not.toContain('genova')
    expect(ids).not.toContain('salonicco')
    expect(ids).not.toContain('lisbona')
    /* E continua a restituire quelle vere, altrimenti la correzione avrebbe
       solo svuotato la classifica. */
    expect(ids).toContain('sardegna')
    expect(ids).toContain('salento')
  })
})
