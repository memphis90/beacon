import { describe, it, expect } from 'vitest'
import {
  activeProfile, agentIsReady, buildSystemPrompt, critiquePayload, describeRules,
  emptyAgentConfig, isBlockedCombination, isLocalEndpoint, localEndpointHint,
  nextProfileId, normaliseAgentConfig, profileLabel, profileNeedsKey, sanitiseCritique,
  sanitisePatch, sanitiseUnderstood,
} from '../src/lib/agent.js'

/**
 * Il contesto passato al modello è calcolato dai dati, non scritto a mano:
 * queste prove servono a garantire che resti vero quando il seed cambia. Un
 * contesto che dichiara mesi balneabili sbagliati è peggio di nessun contesto,
 * perché il modello lo prende per buono.
 */
describe('describeRules — le regole vere, dette al modello', () => {
  const dest = (over) => ({
    name: 'Prova', country: 'IT', type: 'island',
    // I punteggi ci vogliono: senza, la destinazione è "non ancora valutata" e
    // il contesto la tiene fuori — che è il comportamento voluto, ma qui
    // stiamo provando altro.
    scores: { nature: 50, culture: 50, sea: 50, food: 50, nightlife: 50, outdoor: 50, family: 50, offbeat: 50 },
    scores_source: 'manual',
    climate: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [String(i + 1), { sea_temp: 10 }])
    ),
    costs: {
      accommodation: { low: 50, mid: 80, high: 120 },
      food_per_day: { low: 20, mid: 30, high: 50 },
      transport_local_day: { low: 5, mid: 10, high: 15 },
    },
    ...over,
  })

  const caldo = dest({
    name: 'Caldo', country: 'GR', type: 'island',
    climate: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [String(i + 1), { sea_temp: i + 1 === 8 ? 26 : 15 }])
    ),
  })
  const freddo = dest({ name: 'Freddo', country: 'NO', type: 'city' })

  it('elenca ogni destinazione con paese e tipo', () => {
    const testo = describeRules([caldo, freddo])
    expect(testo).toContain('Caldo (Grecia, isola)')
    expect(testo).toContain('Freddo (Norvegia, città)')
    expect(testo).toContain('2 destinazioni')
  })

  it('conta quante destinazioni superano la soglia del mare, mese per mese', () => {
    const testo = describeRules([caldo, freddo])
    expect(testo).toContain('agosto 1')
    expect(testo).toContain('luglio 0')
    // I mesi senza nemmeno una destinazione vanno detti: sono quelli in cui
    // seaRequired svuota la ricerca.
    expect(testo).toMatch(/In gennaio.*non ne passa NESSUNA/)
    expect(testo).not.toMatch(/In gennaio[^.]*agosto[^.]*non ne passa NESSUNA/)
  })

  it('ricava la fascia di costo dai costi veri', () => {
    // 80 + 30 + 10 = 120 € a notte per entrambe le destinazioni di prova.
    expect(describeRules([caldo, freddo])).toContain('fra 120 € e 120 €')
  })

  it('elenca i temi con quante destinazioni li portano', () => {
    const gotica = dest({ name: 'Gotica', themes: ['gotico'] })
    const testo = describeRules([gotica, caldo, freddo])
    expect(testo).toContain('- gotico:')
    expect(testo).toContain('(1 destinazioni)')
    // Il conteggio deve dire anche quando un tema è vuoto: al modello serve
    // per non sceglierlo.
    expect(testo).toContain('(0 destinazioni)')
  })

  it('non rivela quale destinazione porta quale tema', () => {
    const gotica = dest({ name: 'Gotica', themes: ['gotico'] })
    const righeTemi = describeRules([gotica, caldo]).split('TEMI DISPONIBILI')[1]
    expect(righeTemi).not.toContain('Gotica')
  })

  it('rispetta una soglia del mare diversa', () => {
    expect(describeRules([caldo, freddo], { seaTempMin: 30 })).toContain('almeno 30 °C')
  })

  /**
   * Il catalogo raccontato al modello deve contenere solo ciò che può
   * comparire. Un posto elencato ma escluso dal ranking è la bugia peggiore:
   * il modello lo userebbe come `query`, e la ricerca darebbe zero risultati.
   */
  it('non racconta al modello le destinazioni non ancora valutate', () => {
    const daValutare = dest({ name: 'Nonvalutata', scores_source: 'todo' })
    const testo = describeRules([caldo, freddo, daValutare])
    expect(testo).not.toContain('Nonvalutata')
    expect(testo).toContain('2 destinazioni')
  })

  it('senza destinazioni valutate non inventa un contesto', () => {
    expect(describeRules([dest({ scores_source: 'todo' })])).toBe('')
  })

  it('senza catalogo non inventa un contesto', () => {
    expect(describeRules(undefined)).toBe('')
    expect(describeRules([])).toBe('')
    expect(buildSystemPrompt('')).toBe(buildSystemPrompt(undefined))
  })

  it('il contesto si aggiunge al prompt, non lo sostituisce', () => {
    const prompt = buildSystemPrompt(describeRules([caldo]))
    expect(prompt).toContain('Rispondi SOLO con JSON valido')
    expect(prompt).toContain('CONTESTO')
  })
})

/**
 * La configurazione è passata da un endpoint solo a una lista di profili.
 * Queste prove coprono le due cose che si rompono in silenzio: la vecchia
 * configurazione che va travasata senza perdere niente, e un `activeId` che
 * punta a un profilo non più esistente.
 */
describe('normaliseAgentConfig — più modelli, uno attivo', () => {
  it('travasa la configurazione a modello singolo nel primo profilo', () => {
    const migrata = normaliseAgentConfig({
      enabled: true, preset: 'ollama', baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2', apiKey: '', debug: true,
    })
    expect(migrata.profiles).toHaveLength(1)
    expect(migrata.profiles[0].baseUrl).toBe('http://localhost:11434/v1')
    expect(migrata.profiles[0].model).toBe('llama3.2')
    expect(migrata.activeId).toBe(migrata.profiles[0].id)
    expect(migrata.enabled).toBe(true)
    expect(migrata.debug).toBe(true)
  })

  it('tiene la lista e il profilo attivo scelto', () => {
    const config = normaliseAgentConfig({
      enabled: true,
      activeId: 'm2',
      profiles: [
        { id: 'm1', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', preset: 'ollama' },
        { id: 'm2', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant', preset: 'groq' },
      ],
    })
    expect(config.profiles).toHaveLength(2)
    expect(activeProfile(config).model).toBe('llama-3.1-8b-instant')
    expect(profileLabel(activeProfile(config))).toBe('Groq')
  })

  it('ricade sul primo profilo se l’attivo è stato cancellato', () => {
    const config = normaliseAgentConfig({
      enabled: true, activeId: 'sparito',
      profiles: [{ id: 'm1', baseUrl: 'http://x/v1', model: 'a' }],
    })
    expect(config.activeId).toBe('m1')
  })

  it('rispetta una lista svuotata invece di rimettere il preset di default', () => {
    const config = normaliseAgentConfig({ enabled: true, profiles: [] })
    expect(config.profiles).toHaveLength(0)
    expect(config.activeId).toBeNull()
    expect(config.enabled).toBe(false)
  })

  it('assegna un id ai profili che non ce l’hanno, senza duplicarli', () => {
    const config = normaliseAgentConfig({
      profiles: [{ baseUrl: 'http://a/v1', model: 'a' }, { id: 'm1', baseUrl: 'http://b/v1', model: 'b' }],
    })
    const ids = config.profiles.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('non esplode su una configurazione illeggibile', () => {
    expect(normaliseAgentConfig(null)).toEqual(emptyAgentConfig())
    expect(normaliseAgentConfig('boh').profiles).toHaveLength(1)
  })

  it('nextProfileId non riusa un identificatore già assegnato', () => {
    expect(nextProfileId([{ id: 'm1' }, { id: 'm4' }])).toBe('m5')
    expect(nextProfileId([])).toBe('m1')
  })
})

/**
 * Un endpoint locale chiamato da una pagina servita da un sito non fallisce a
 * volte: fallisce sempre, ed è il browser a deciderlo. L'app deve dirlo con
 * parole sue, perché `fetch` restituisce solo "Failed to fetch".
 */
describe('endpoint locali e pagine ospitate', () => {
  it('riconosce gli indirizzi locali', () => {
    expect(isLocalEndpoint('http://localhost:11434/v1')).toBe(true)
    expect(isLocalEndpoint('http://127.0.0.1:1234/v1')).toBe(true)
    expect(isLocalEndpoint('https://api.groq.com/openai/v1')).toBe(false)
  })

  it('fuori dal browser non dichiara nessun blocco', () => {
    // Nei test `window` non esiste: la pagina non è "ospitata", quindi il
    // messaggio è quello del server che non risponde, non quello del divieto.
    expect(isBlockedCombination('http://localhost:11434/v1')).toBe(false)
    expect(localEndpointHint('http://localhost:11434/v1')).toContain('server sia acceso')
  })

  it('per un endpoint remoto il suggerimento cambia', () => {
    expect(localEndpointHint('https://api.groq.com/openai/v1')).toContain('accetti chiamate')
  })
})

describe('agentIsReady — acceso non basta, deve anche essere configurato', () => {
  it('è falso su un profilo attivo a metà', () => {
    const config = normaliseAgentConfig({
      enabled: true, activeId: 'm1', profiles: [{ id: 'm1', baseUrl: 'http://x/v1', model: '' }],
    })
    expect(agentIsReady(config)).toBe(false)
  })

  it('è vero solo con endpoint, modello e interruttore acceso', () => {
    const profiles = [{ id: 'm1', baseUrl: 'http://localhost:11434/v1', model: 'a' }]
    expect(agentIsReady(normaliseAgentConfig({ enabled: false, profiles }))).toBe(false)
    expect(agentIsReady(normaliseAgentConfig({ enabled: true, profiles }))).toBe(true)
  })

  /**
   * Un remoto senza chiave sembra configurato e non lo è: ogni frase morirebbe
   * con un 401 che parla la lingua del fornitore. Meglio non dichiararlo
   * pronto — così il menu non lo lascia nemmeno scegliere.
   */
  it('un endpoint remoto senza chiave non è pronto', () => {
    const senza = [{ id: 'm1', baseUrl: 'https://openrouter.ai/api/v1', model: 'a' }]
    const con = [{ ...senza[0], apiKey: 'sk-qualcosa' }]
    expect(profileNeedsKey(senza[0])).toBe(true)
    expect(agentIsReady(normaliseAgentConfig({ enabled: true, profiles: senza }))).toBe(false)
    expect(agentIsReady(normaliseAgentConfig({ enabled: true, profiles: con }))).toBe(true)
  })

  it('un endpoint locale non chiede nessuna chiave', () => {
    expect(profileNeedsKey({ baseUrl: 'http://localhost:11434/v1', model: 'a' })).toBe(false)
    expect(profileNeedsKey({ baseUrl: 'http://127.0.0.1:1234/v1', model: 'a' })).toBe(false)
  })

  it('profileLabel ripiega sul nome del modello quando manca l’etichetta', () => {
    expect(profileLabel({ label: '  ', model: 'llama3.2' })).toBe('llama3.2')
    expect(profileLabel({ label: 'Il grosso', model: 'llama3.2' })).toBe('Il grosso')
  })
})

/**
 * Un modello sbaglia, allucina campi e a volte restituisce stringhe dove ci
 * vogliono numeri. Queste prove servono a garantire che nulla di tutto ciò
 * arrivi al motore di scoring.
 */
describe('sanitisePatch — l’output del modello non è creduto sulla parola', () => {
  it('accetta un oggetto ben formato', () => {
    const { patch, rejected } = sanitisePatch({
      month: 10, nights: 5, budgetMax: 600,
      weights: { nature: 9, culture: 3 },
      seaRequired: false, allowedTypes: ['island'],
    })
    expect(patch).toEqual({
      month: 10, nights: 5, budgetMax: 600,
      weights: { nature: 9, culture: 3 },
      seaRequired: false, allowedTypes: ['island'],
    })
    expect(rejected).toHaveLength(0)
  })

  it('scarta un mese fuori intervallo invece di propagarlo', () => {
    const { patch, rejected } = sanitisePatch({ month: 47 })
    expect(patch.month).toBeUndefined()
    expect(rejected[0]).toContain('47')
  })

  it('accetta month: null come “tutto l’anno”', () => {
    expect(sanitisePatch({ month: null }).patch.month).toBeNull()
  })

  it('riporta i pesi fuori scala dentro 0–10', () => {
    const { patch } = sanitisePatch({ weights: { nature: 99, culture: -5 } })
    expect(patch.weights).toEqual({ nature: 10, culture: 0 })
  })

  it('scarta gli assi inventati', () => {
    const { patch, rejected } = sanitisePatch({ weights: { nature: 7, teletrasporto: 9 } })
    expect(patch.weights).toEqual({ nature: 7 })
    expect(rejected.some((r) => r.includes('teletrasporto'))).toBe(true)
  })

  it('legge i numeri anche quando arrivano come stringhe', () => {
    const { patch } = sanitisePatch({ nights: '7', budgetMax: '600 €' })
    expect(patch.nights).toBe(7)
    expect(patch.budgetMax).toBe(600)
  })

  it('scarta i tipi di destinazione inesistenti', () => {
    const { patch } = sanitisePatch({ allowedTypes: ['island', 'pianeta'] })
    expect(patch.allowedTypes).toEqual(['island'])
  })

  it('ignora allowedTypes quando li elenca tutti: non è un filtro', () => {
    const { patch } = sanitisePatch({ allowedTypes: ['city', 'area', 'island'] })
    expect(patch.allowedTypes).toBeUndefined()
  })

  it('tronca una query lunghissima invece di accettarla', () => {
    const { patch } = sanitisePatch({ query: 'x'.repeat(500) })
    expect(patch.query.length).toBeLessThanOrEqual(60)
  })

  it('tiene i temi del vocabolario e scarta gli inventati', () => {
    const { patch, rejected } = sanitisePatch({ themes: ['gotico', 'spettrale'] })
    expect(patch.themes).toEqual(['gotico'])
    expect(rejected.some((r) => r.includes('spettrale'))).toBe(true)
  })

  it('normalizza maiuscole e spazi nei temi, senza duplicarli', () => {
    expect(sanitisePatch({ themes: [' Gotico ', 'GOTICO'] }).patch.themes).toEqual(['gotico'])
  })

  it('taglia a due i temi: il tetto al bonus è lo stesso', () => {
    const { patch } = sanitisePatch({ themes: ['gotico', 'medievale', 'imperiale'] })
    expect(patch.themes).toHaveLength(2)
  })

  it('non mette il campo temi quando nessuno è riconosciuto', () => {
    expect(sanitisePatch({ themes: ['spettrale'] }).patch.themes).toBeUndefined()
  })

  it('non esplode su risposte non oggetto', () => {
    expect(sanitisePatch(null).patch).toEqual({})
    expect(sanitisePatch('ciao').patch).toEqual({})
    expect(sanitisePatch(42).rejected).toHaveLength(1)
  })

  it('notti negative o zero vengono scartate', () => {
    expect(sanitisePatch({ nights: 0 }).patch.nights).toBeUndefined()
    expect(sanitisePatch({ nights: -3 }).patch.nights).toBeUndefined()
  })

  it('un budget non numerico viene scartato, non azzerato', () => {
    const { patch, rejected } = sanitisePatch({ budgetMax: 'tanti soldi' })
    expect(patch.budgetMax).toBeUndefined()
    expect(rejected).toHaveLength(1)
  })
})

describe('sanitiseUnderstood — la spiegazione', () => {
  it('tiene le voci ben formate', () => {
    const out = sanitiseUnderstood([{ label: 'Mese', value: 'ottobre', from: 'ottobre' }])
    expect(out).toHaveLength(1)
    expect(out[0].from).toBe('ottobre')
  })

  it('scarta le voci senza etichetta o valore', () => {
    expect(sanitiseUnderstood([{ from: 'x' }, { label: 'Mese' }])).toHaveLength(0)
  })

  it('tollera una spiegazione mancante', () => {
    expect(sanitiseUnderstood(undefined)).toEqual([])
    expect(sanitiseUnderstood('niente')).toEqual([])
  })

  it('mette un tetto al numero di voci', () => {
    const molte = Array.from({ length: 40 }, (_, i) => ({ label: `L${i}`, value: 'v', from: 'f' }))
    expect(sanitiseUnderstood(molte).length).toBeLessThanOrEqual(12)
  })
})

/**
 * La critica è l'unico punto in cui il modello tocca il ranking, e lo tocca
 * solo attraverso un peso. Queste prove sono la garanzia che non possa fare
 * altro: nessuna via per riordinare, per inventare un asse o per far comparire
 * un bottone che non cambierebbe niente.
 */
describe('sanitiseCritique — il modello propone pesi, non risultati', () => {
  const pesi = { nature: 5, culture: 5, sea: 5, food: 5, nightlife: 5, outdoor: 5, family: 5, offbeat: 3 }

  it('tiene un suggerimento ben formato e ci allega il peso di partenza', () => {
    const { suggestions, rejected } = sanitiseCritique(
      { suggestions: [{ axis: 'offbeat', to: 9, why: 'hai scritto “poco turistico”' }] },
      pesi
    )
    expect(suggestions).toEqual([
      { axis: 'offbeat', label: 'Fuori rotta', from: 3, to: 9, why: 'hai scritto “poco turistico”' },
    ])
    expect(rejected).toHaveLength(0)
  })

  it('scarta gli assi inventati', () => {
    const { suggestions, rejected } = sanitiseCritique(
      { suggestions: [{ axis: 'teletrasporto', to: 9, why: 'perché sì' }] },
      pesi
    )
    expect(suggestions).toHaveLength(0)
    expect(rejected[0]).toContain('teletrasporto')
  })

  it('riporta i pesi fuori scala dentro 0–10', () => {
    const { suggestions } = sanitiseCritique(
      { suggestions: [{ axis: 'nature', to: 99, why: 'motivo' }] },
      pesi
    )
    expect(suggestions[0].to).toBe(10)
  })

  it('scarta un suggerimento che non cambierebbe nulla', () => {
    const { suggestions, rejected } = sanitiseCritique(
      { suggestions: [{ axis: 'nature', to: 5, why: 'motivo' }] },
      pesi
    )
    expect(suggestions).toHaveLength(0)
    expect(rejected[0]).toContain('già 5')
  })

  it('pretende una motivazione: senza, il suggerimento non è verificabile', () => {
    const { suggestions } = sanitiseCritique({ suggestions: [{ axis: 'sea', to: 9 }] }, pesi)
    expect(suggestions).toHaveLength(0)
  })

  it('non ripete lo stesso asse due volte', () => {
    const { suggestions } = sanitiseCritique(
      {
        suggestions: [
          { axis: 'sea', to: 9, why: 'primo' },
          { axis: 'sea', to: 2, why: 'secondo' },
        ],
      },
      pesi
    )
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].why).toBe('primo')
  })

  it('taglia a tre suggerimenti', () => {
    const molti = ['nature', 'culture', 'sea', 'food', 'nightlife'].map((axis) => ({
      axis, to: 9, why: 'motivo',
    }))
    expect(sanitiseCritique({ suggestions: molti }, pesi).suggestions).toHaveLength(3)
  })

  it('non lascia passare un ordinamento: campi estranei sono ignorati', () => {
    const { suggestions, note } = sanitiseCritique(
      { ranking: ['Lisbona', 'Porto'], winner: 'Lisbona', suggestions: [] },
      pesi
    )
    expect(suggestions).toHaveLength(0)
    expect(note).toBe('')
  })

  it('non esplode su risposte non oggetto', () => {
    expect(sanitiseCritique(null).suggestions).toEqual([])
    expect(sanitiseCritique('ciao').rejected).toHaveLength(1)
  })
})

describe('critiquePayload — cosa vede il modello', () => {
  const entry = {
    destination: { name: 'Lisbona' },
    scoring: { total: 72.345, contributions: [{ key: 'nature', score: 60 }, { key: 'sea', score: 80 }] },
  }

  it('manda frase, pesi e prime destinazioni con i punteggi per asse', () => {
    const payload = JSON.parse(critiquePayload({
      text: 'cinque giorni poco turistici',
      entries: [entry],
      weights: { offbeat: 3 },
    }))
    expect(payload.frase).toBe('cinque giorni poco turistici')
    expect(payload.pesi_attuali.find((p) => p.axis === 'offbeat').peso).toBe(3)
    expect(payload.prime_destinazioni[0]).toEqual({
      nome: 'Lisbona',
      punteggio: 72.3,
      punteggi_per_asse: { nature: 60, sea: 80 },
    })
  })

  it('si ferma alle prime cinque: il resto è contesto sprecato', () => {
    const payload = JSON.parse(critiquePayload({
      text: 'x', entries: Array.from({ length: 12 }, () => entry), weights: {},
    }))
    expect(payload.prime_destinazioni).toHaveLength(5)
  })
})
