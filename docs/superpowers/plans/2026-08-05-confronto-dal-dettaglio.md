# Il confronto si compone dal dettaglio — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riportare a un tocco l'apertura del dettaglio dalla card compatta, e spostare la composizione del confronto dentro il dettaglio, con un autocomplete sulle 158 destinazioni.

**Architecture:** Si smonta lo stato aperto introdotto stamattina (classe, props, stato in `App`, regole CSS) e il bottone sovrapposto cambia mestiere: da «apri le azioni» a «apri la scheda». La regola di corrispondenza nome/paese che oggi vive dentro `scoring.js` viene estratta in `src/lib/search.js` e usata da tutti e due i consumatori, così la ricerca in classifica e l'autocomplete non possono divergere. La sezione nuova del dettaglio è un campo di testo più una lista di bottoni veri, senza combobox ARIA.

**Tech Stack:** React 19, Vite 7, Vitest 3. Nessuna dipendenza nuova. `renderToStaticMarkup` per le prove dei componenti — **niente jsdom**.

## Global Constraints

- **Spec di riferimento:** `docs/superpowers/specs/2026-08-05-confronto-dal-dettaglio-design.md`. In caso di conflitto vince la spec.
- **Sopra i 901px cambia una cosa sola**, ed è un'aggiunta: la sezione «Confronta» nel dettaglio. Le card desktop tengono i loro due bottoni, la fascia alta, il clima. Nessuna regola CSS esistente fuori dai blocchi `@media (max-width: 900px)` va modificata.
- **La spec di stamattina resta valida** in tutto ciò che questo piano non tocca: card a 110px, tre colonne, clima fuori, `+N tema` sulla riga del paese, rango legato all'ordinamento.
- **Nessun `role="combobox"`**, nessun `aria-activedescendant`. Campo di testo e bottoni.
- **Il tetto del confronto resta 4** (`MAX_COMPARE`, `App.jsx:41`). Non va alzato né aggirato.
- **Nessuna dipendenza nuova.** Nessuna libreria di autocomplete, di fuzzy match, di testing.
- **Testo in italiano.** **Token, non valori** (`src/styles/tokens.css`).
- **Commit dopo ogni task**, messaggio in italiano, in prosa, senza prefissi.

---

## File Structure

| file | responsabilità | azione |
|---|---|---|
| `src/lib/search.js` | la regola di corrispondenza e i suggerimenti | **crea** |
| `src/lib/scoring.js` | usa la regola estratta invece della sua copia | modifica (`:279-292`) |
| `src/components/DestinationCard.jsx` | perde lo stato aperto; il bottone apre la scheda | modifica |
| `src/components/ComparePicker.jsx` | chip + campo + lista di suggerimenti | **crea** |
| `src/components/DetailPanel.jsx` | ospita `ComparePicker` | modifica |
| `src/App.jsx` | via `apertaId`; passa al dettaglio ciò che serve al picker | modifica |
| `src/styles/app.css` | via le regole dello stato aperto; stile del picker | modifica |
| `test/card-compatta.test.js` | via le prove sullo stato aperto, dentro quelle nuove | modifica |
| `test/search.test.js` | la regola di corrispondenza e i suggerimenti | **crea** |
| `docs/superpowers/plans/2026-08-03-verifica-a-schermo.md` | la lista a occhio | modifica |

---

### Task 1: La regola di corrispondenza, in un posto solo

**Files:**
- Create: `src/lib/search.js`
- Modify: `src/lib/scoring.js:279-292`
- Test: `test/search.test.js` (crea)

**Interfaces:**
- Produces: `matchesQuery(destination, query) => boolean` — vero se la query vuota o se compare in nome, codice paese o paese per esteso, tutto minuscolo.
- Produces: `suggestDestinations(destinations, query, { exclude = [], limit = 8 }) => Destination[]` — le corrispondenze, escluse quelle in `exclude` (array di id), tagliate a `limit`. Con query vuota restituisce le prime `limit` non escluse.

- [ ] **Step 1: Scrivi la prova che fallisce**

Crea `test/search.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { matchesQuery, suggestDestinations } from '../src/lib/search.js'

const d = (id, name, country, type = 'city') => ({ id, name, country, type })

const catalogo = [
  d('lisbona', 'Lisbona', 'PT'),
  d('porto', 'Porto', 'PT'),
  d('dubrovnik', 'Dubrovnik', 'HR'),
  d('siviglia', 'Siviglia', 'ES'),
]

describe('matchesQuery — la stessa regola della classifica', () => {
  it('la query vuota passa tutto', () => {
    expect(matchesQuery(catalogo[0], '')).toBe(true)
    expect(matchesQuery(catalogo[0], '   ')).toBe(true)
  })

  it('corrisponde sul nome, senza badare alle maiuscole', () => {
    expect(matchesQuery(catalogo[0], 'lisb')).toBe(true)
    expect(matchesQuery(catalogo[0], 'LISB')).toBe(true)
    expect(matchesQuery(catalogo[0], 'madrid')).toBe(false)
  })

  it('corrisponde sul codice paese e sul paese per esteso', () => {
    // Il commento in scoring.js: cercando "croazia" ci si aspetta Dubrovnik,
    // non zero risultati perché nel dato c'è scritto "HR".
    expect(matchesQuery(catalogo[2], 'HR')).toBe(true)
    expect(matchesQuery(catalogo[2], 'croazia')).toBe(true)
  })
})

describe('suggestDestinations', () => {
  it('con query vuota propone le prime, fino al limite', () => {
    expect(suggestDestinations(catalogo, '', { limit: 2 }).map((x) => x.id))
      .toEqual(['lisbona', 'porto'])
  })

  it('filtra sulla query', () => {
    expect(suggestDestinations(catalogo, 'po').map((x) => x.id)).toEqual(['porto'])
  })

  it('esclude gli id già scelti', () => {
    expect(suggestDestinations(catalogo, 'PT', { exclude: ['lisbona'] }).map((x) => x.id))
      .toEqual(['porto'])
  })

  it('rispetta il limite', () => {
    expect(suggestDestinations(catalogo, '', { limit: 3 })).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Esegui: `npx vitest run test/search.test.js`
Atteso: FAIL — `Failed to resolve import "../src/lib/search.js"`.

- [ ] **Step 3: Scrivi il modulo**

Crea `src/lib/search.js`:

```js
import { countryName } from './format.js'

/**
 * La regola di corrispondenza nome/paese, in un posto solo.
 *
 * Viveva dentro il filtro della classifica (`scoring.js`) e serviva a un
 * consumatore solo. Da quando il dettaglio ha il suo autocomplete i
 * consumatori sono due, e due copie della stessa regola divergono: la
 * classifica troverebbe Dubrovnik cercando "croazia" e l'autocomplete no,
 * senza che niente lo segnali.
 */
export function matchesQuery(destination, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true

  // Il nome del paese per esteso, non solo il codice ISO: cercando "croazia"
  // ci si aspetta Dubrovnik, non zero risultati perché nel dato c'è "HR".
  const haystack = [
    destination.name,
    destination.country,
    countryName(destination.country),
  ].join(' ').toLowerCase()

  return haystack.includes(q)
}

/**
 * I suggerimenti dell'autocomplete: le corrispondenze meno quelle già scelte,
 * tagliate a `limit`. L'ordine è quello del catalogo — che è già l'ordine di
 * rilevanza con cui la classifica lo presenta.
 */
export function suggestDestinations(destinations, query, { exclude = [], limit = 8 } = {}) {
  const fuori = new Set(exclude)
  const out = []
  for (const destination of destinations) {
    if (fuori.has(destination.id)) continue
    if (!matchesQuery(destination, query)) continue
    out.push(destination)
    if (out.length >= limit) break
  }
  return out
}
```

- [ ] **Step 4: Esegui e verifica che passi**

Esegui: `npx vitest run test/search.test.js`
Atteso: PASS, 7 prove.

- [ ] **Step 5: Fai usare la regola anche alla classifica**

In `src/lib/scoring.js`, sostituisci il blocco `if (normalisedQuery) { … }` (`:279-292`) con:

```js
    if (!matchesQuery(destination, query)) {
      excluded.push({ destination, filter: FILTER.QUERY, detail: `non corrisponde a "${query.trim()}"` })
      continue
    }
```

Aggiungi l'import in cima: `import { matchesQuery } from './search.js'`.

Se `normalisedQuery` e `countryName` restano senza altri usi nel file, toglili — un import e una variabile morti sono rumore. Se hanno altri usi, lasciali.

- [ ] **Step 6: Esegui tutta la suite**

Esegui: `npx vitest run`
Atteso: PASS, tutte. Le 51 prove di `scoring.test.js` sono la rete che dice se l'estrazione ha cambiato comportamento: **devono passare senza toccarle**. Se una fallisce, la regola estratta non è identica all'originale — correggi la regola, non la prova.

- [ ] **Step 7: Commit**

```bash
git add src/lib/search.js src/lib/scoring.js test/search.test.js
git commit -m "La regola che riconosce un nome o un paese vive in un posto solo"
```

---

### Task 2: La card torna a un tocco

**Files:**
- Modify: `src/components/DestinationCard.jsx`
- Modify: `src/App.jsx` (via `apertaId` e il suo azzeramento)
- Modify: `src/styles/app.css` (via le regole dello stato aperto)
- Modify: `test/card-compatta.test.js`

**Interfaces:**
- Produces: `DestinationCard` **non** accetta più `aperta` / `onApri`. Il bottone sovrapposto resta `.card__apri`, senza `aria-expanded`, con `onClick={onOpen}` e `aria-label={"Apri la scheda di " + destination.name}`.

- [ ] **Step 1: Riscrivi le prove**

In `test/card-compatta.test.js`, **cancella** il blocco `describe('card compatta — lo stato aperto sta nel markup', …)` e quello `describe('card compatta — App non ne apre nessuna da sola', …)`, e mettine uno nuovo al loro posto:

```js
describe('card compatta — il tocco apre la scheda', () => {
  it('la card non ha più uno stato aperto', () => {
    const html = card()
    expect(html).not.toContain('card--aperta')
    expect(html).not.toContain('aria-expanded')
  })

  it('il bottone sovrapposto dice che apre la scheda', () => {
    const html = card()
    expect(html).toContain('card__apri')
    expect(html).toContain('Apri la scheda di Lisbona')
  })
})
```

Togli anche `aperta: true` da ogni chiamata rimasta e le due props dal costruttore di `card()` se ci sono.

- [ ] **Step 2: Esegui e verifica che fallisca**

Esegui: `npx vitest run test/card-compatta.test.js`
Atteso: FAIL — il markup contiene ancora `aria-expanded`, e l'etichetta è «Mostra le azioni di Lisbona».

- [ ] **Step 3: Smonta lo stato aperto nella card**

In `src/components/DestinationCard.jsx`, la firma torna senza le due props:

```jsx
export default function DestinationCard({
  entry, rank, criteria, isFavourite, onToggleFavourite, inCompare, onToggleCompare, onOpen,
}) {
```

Il contenitore torna a una classe sola:

```jsx
    <article className={`card${inCompare ? ' card--selected' : ''}`}>
```

E il bottone cambia mestiere — commento compreso, perché il vecchio spiegava una cosa che non fa più:

```jsx
      {/* Il tocco che apre la scheda è un bottone vero, non un gestore
          appiccicato all'articolo: così esiste anche per la tastiera e si
          annuncia a un lettore di schermo. Copre la card e sta sotto il cuore.
          Sopra i 901px non esiste: lì la card ha il suo bottone "Dettaglio". */}
      <button
        type="button"
        className="card__apri"
        aria-label={`Apri la scheda di ${destination.name}`}
        onClick={onOpen}
      />
```

- [ ] **Step 4: Togli lo stato da App**

In `src/App.jsx`:

- cancella `const [apertaId, setApertaId] = useState(null)` e il commento sopra
- nell'effetto, torna a `useEffect(() => { setMostrate(PAGINA) }, [criteria, onlyFavourites])` e togli il commento sul doppio innesco
- al montaggio della card, togli le righe `aperta={…}` e `onApri={…}`

- [ ] **Step 5: Togli le regole CSS dello stato aperto**

In `src/styles/app.css`, dentro il blocco mobile, cancella l'intera sezione `/* ---- Lo stato aperto ---- */` **tranne** la riga che nasconde le azioni, che resta e cambia commento:

```css
  /* I due bottoni in fondo non servono più su mobile: "Dettaglio" duplica il
     tocco sulla card, e "Confronta" si compone dal dettaglio. L'asse guida
     resta spento qui e vive nel dettaglio. */
  .card__actions,
  .card__interests .segbar__caption {
    display: none;
  }
```

Vanno via: `.card--aperta { height: auto; }`, `.card--aperta .card__actions`, `.card--aperta .card__interests`, `.card--aperta .card__interests .segbar__caption`, `.card--aperta { padding-bottom: 68px; }`.

- [ ] **Step 6: Esegui la suite**

Esegui: `npx vitest run`
Atteso: PASS, tutte.

- [ ] **Step 7: Cerca i resti**

Esegui: `npx rg -n "aperta|onApri|apertaId|card--aperta" src/ test/`
Atteso: **nessuna riga**. Se ne resta una, è un riferimento penzolante: il render statico non lo vedrebbe, e `render.test.js` esiste proprio perché di quelli ne sono già sfuggiti.

- [ ] **Step 8: Commit**

```bash
git add src/components/DestinationCard.jsx src/App.jsx src/styles/app.css test/card-compatta.test.js
git commit -m "Il tocco sulla card torna ad aprire la scheda, e basta"
```

---

### Task 3: Il selettore del confronto

**Files:**
- Create: `src/components/ComparePicker.jsx`
- Modify: `src/styles/app.css` (regole nuove, fuori dai media query)
- Test: `test/compare-picker.test.js` (crea)

**Interfaces:**
- Consumes: `suggestDestinations` dal Task 1.
- Produces: `ComparePicker({ corrente, aggiunte, catalogo, max, onAggiungi, onTogli, onApri })` — `corrente` è la destinazione della scheda aperta, `aggiunte` è l'array delle altre già scelte, `catalogo` l'array completo, `max` il tetto totale (4). Disegna i chip, il campo, la lista e il bottone «Apri il confronto».

- [ ] **Step 1: Scrivi le prove che falliscono**

Crea `test/compare-picker.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ComparePicker from '../src/components/ComparePicker.jsx'

const d = (id, name, country, type = 'city') => ({ id, name, country, type })
const lisbona = d('lisbona', 'Lisbona', 'PT')
const porto = d('porto', 'Porto', 'PT')
const catalogo = [lisbona, porto, d('siviglia', 'Siviglia', 'ES')]

const picker = (props = {}) =>
  renderToStaticMarkup(
    createElement(ComparePicker, {
      corrente: lisbona,
      aggiunte: [],
      catalogo,
      max: 4,
      onAggiungi: () => {},
      onTogli: () => {},
      onApri: () => {},
      ...props,
    }),
  )

describe('ComparePicker', () => {
  it('la destinazione aperta è un chip senza croce', () => {
    const html = picker()
    expect(html).toContain('Lisbona')
    expect(html).not.toContain('Togli Lisbona dal confronto')
  })

  it('le aggiunte hanno la croce', () => {
    const html = picker({ aggiunte: [porto] })
    expect(html).toContain('Porto')
    expect(html).toContain('Togli Porto dal confronto')
  })

  it('al tetto il campo è disabilitato e lo dice', () => {
    const html = picker({ aggiunte: [porto, d('a', 'A', 'IT'), d('b', 'B', 'IT')] })
    expect(html).toContain('disabled')
    expect(html).toContain('Il confronto è pieno')
  })

  it('sotto il tetto il campo è attivo', () => {
    expect(picker({ aggiunte: [porto] })).not.toContain('Il confronto è pieno')
  })

  it('non promette un combobox che non è', () => {
    expect(picker()).not.toContain('role="combobox"')
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Esegui: `npx vitest run test/compare-picker.test.js`
Atteso: FAIL — `Failed to resolve import`.

- [ ] **Step 3: Scrivi il componente**

Crea `src/components/ComparePicker.jsx`:

```jsx
import { useState } from 'react'
import { suggestDestinations } from '../lib/search.js'
import { DESTINATION_TYPES } from '../lib/axes.js'
import { countryName } from '../lib/format.js'

const typeLabel = (key) => DESTINATION_TYPES.find((t) => t.key === key)?.label || key

/**
 * Si compone il confronto da qui, non dalla classifica.
 *
 * Niente `role="combobox"`: un combobox ARIA fatto a metà — senza
 * `aria-activedescendant` coerente, senza le frecce, senza annunciare quanti
 * risultati ci sono — promette a un lettore di schermo un comportamento che
 * poi non trova. Qui c'è un campo che filtra e una lista di bottoni veri:
 * il Tab li raggiunge, Invio li attiva, ed è tutto ciò che serve.
 *
 * La destinazione aperta è la prima e non si toglie: un confronto che non la
 * contiene non è il confronto di questa scheda.
 */
export default function ComparePicker({
  corrente, aggiunte, catalogo, max, onAggiungi, onTogli, onApri,
}) {
  const [query, setQuery] = useState('')

  const scelte = [corrente, ...aggiunte]
  const pieno = scelte.length >= max
  const suggerimenti = pieno
    ? []
    : suggestDestinations(catalogo, query, { exclude: scelte.map((x) => x.id), limit: 6 })

  return (
    <section className="cpick">
      <h4 className="cpick__title">Confronta</h4>

      <ul className="cpick__chips">
        {scelte.map((x, i) => (
          <li key={x.id} className={`chip${i === 0 ? ' chip--fisso' : ''}`}>
            {x.name}
            {i > 0 && (
              <button
                type="button"
                className="chip__x"
                aria-label={`Togli ${x.name} dal confronto`}
                onClick={() => onTogli(x.id)}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {pieno ? (
        <p className="cpick__pieno">
          Il confronto è pieno: {max} destinazioni. Togline una per cambiarla.
        </p>
      ) : (
        <>
          <label htmlFor="cpick-q" className="visually-hidden">
            Cerca una destinazione da aggiungere al confronto
          </label>
          <input
            id="cpick-q"
            type="search"
            className="control"
            placeholder="Aggiungi una destinazione…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <ul className="cpick__list">
            {suggerimenti.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => { onAggiungi(x.id); setQuery('') }}>
                  <b>{x.name}</b>
                  <span>{countryName(x.country)} · {typeLabel(x.type).toLowerCase()}</span>
                </button>
              </li>
            ))}
            {query && suggerimenti.length === 0 && (
              <li className="cpick__vuoto">Nessuna destinazione per «{query}»</li>
            )}
          </ul>
        </>
      )}

      <button type="button" className="btn btn--primary" onClick={onApri} disabled={scelte.length < 2}>
        Apri il confronto
      </button>
    </section>
  )
}
```

- [ ] **Step 4: Esegui e verifica che passi**

Esegui: `npx vitest run test/compare-picker.test.js`
Atteso: PASS, 5 prove.

> Se la prova del tetto fallisce perché `disabled` non compare: al tetto il
> campo non viene proprio montato, e il testo «Il confronto è pieno» prende il
> suo posto. Cambia la prova per cercare solo quel testo — è quello il
> comportamento voluto, e `disabled` era un'aspettativa sbagliata di chi ha
> scritto il piano.

- [ ] **Step 5: Stile**

In `src/styles/app.css`, in coda alla sezione dei componenti del dettaglio, aggiungi le regole di `.cpick`. Valgono a ogni larghezza — la sezione esiste su desktop e su mobile.

```css
/* ---------- Selettore del confronto, dentro il dettaglio ---------- */

.cpick { display: flex; flex-direction: column; gap: var(--inline-gap); }
.cpick__title {
  margin: 0;
  font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.02em;
  color: var(--ink-2);
}
.cpick__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.cpick__chips .chip--fisso { background: var(--brand-tint); border-color: var(--brand-600); }
.chip__x {
  margin-left: 4px; padding: 0; width: 18px; height: 18px;
  border: 0; background: none; color: var(--ink-2);
  font-size: 14px; line-height: 1; cursor: pointer;
}
.chip__x:hover { color: var(--crit); }

.cpick__list { margin: 0; padding: 0; list-style: none; max-height: 180px; overflow-y: auto; }
.cpick__list button {
  display: flex; flex-direction: column; gap: 1px;
  width: 100%; padding: 7px 9px;
  border: 0; border-radius: var(--radius-sm);
  background: none; text-align: left; cursor: pointer;
}
.cpick__list button:hover { background: var(--surface-3); }
.cpick__list b { font-size: 13px; line-height: 17px; font-weight: 600; }
.cpick__list span { font-size: 11px; line-height: 14px; color: var(--ink-2); }
.cpick__vuoto, .cpick__pieno {
  margin: 0; padding: 7px 0;
  font-size: 11px; line-height: 14px; color: var(--ink-2);
}
```

Su mobile i target toccabili: dentro `@media (max-width: 900px)`, in coda alla sezione della card, aggiungi

```css
  .cpick__list button { min-height: 44px; }
  .chip__x { width: 28px; height: 28px; }
```

- [ ] **Step 6: Esegui la suite e commit**

```bash
npx vitest run
git add src/components/ComparePicker.jsx src/styles/app.css test/compare-picker.test.js
git commit -m "Un selettore per comporre il confronto, senza fingersi un combobox"
```

---

### Task 4: Il selettore entra nel dettaglio

**Files:**
- Modify: `src/components/DetailPanel.jsx:17` (firma) e `:245-255` (il piede)
- Modify: `src/App.jsx:613-614` (cosa passa al dettaglio)
- Test: `test/card-compatta.test.js` (una prova in coda)

**Interfaces:**
- Consumes: `ComparePicker` dal Task 3.
- Produces: `DetailPanel` accetta `catalogo`, `compareEntries`, `onAggiungiAlConfronto`, `onTogliDalConfronto`, `onApriConfronto` al posto di `onCompare` / `inCompare`.

- [ ] **Step 1: Monta il selettore nel dettaglio**

In `src/components/DetailPanel.jsx`, la firma:

```jsx
export default function DetailPanel({
  entry, criteria, onClose, onEdit, closing = false,
  catalogo, aggiunte, onAggiungiAlConfronto, onTogliDalConfronto, onApriConfronto,
}) {
```

Nel piede, **al posto** del bottone «Aggiungi al confronto» (`:250-252`):

```jsx
          <ComparePicker
            corrente={destination}
            aggiunte={aggiunte}
            catalogo={catalogo}
            max={4}
            onAggiungi={onAggiungiAlConfronto}
            onTogli={onTogliDalConfronto}
            onApri={onApriConfronto}
          />
```

Import in cima: `import ComparePicker from './ComparePicker.jsx'`.

> Il piede è una riga orizzontale di bottoni: il selettore è alto e non ci sta.
> Mettilo **sopra** il piede, come ultima sezione del corpo, e lascia nel piede
> il solo «Chiudi».

- [ ] **Step 2: Cabla App**

In `src/App.jsx`, dove monta `DetailPanel` (`:610-615`), sostituisci `inCompare` e `onCompare` con:

```jsx
            catalogo={destinations}
            aggiunte={compareIds
              .filter((id) => id !== detailEntry.destination.id)
              .map((id) => entryFor(id)?.destination)
              .filter(Boolean)}
            onAggiungiAlConfronto={(id) => {
              // La scheda aperta entra nel confronto insieme alla prima
              // aggiunta: prima di allora un confronto con se stessa non
              // esiste, e infilarcela all'apertura del dettaglio riempirebbe
              // il pannello di destinazioni solo guardate.
              setCompareIds((current) => {
                const base = current.includes(detailEntry.destination.id)
                  ? current
                  : [...current, detailEntry.destination.id]
                return base.includes(id) || base.length >= MAX_COMPARE ? base : [...base, id]
              })
            }}
            onTogliDalConfronto={(id) => setCompareIds((current) => current.filter((x) => x !== id))}
            onApriConfronto={() => { setDetailId(null); setCompareOpen(true) }}
```

Il nome vero della variabile del catalogo e quello dello stato che apre il pannello del confronto vanno letti nel file: `destinations` e `setCompareOpen` sono le ipotesi di chi ha scritto il piano, non due certezze. Se si chiamano diversamente, usa i nomi veri.

- [ ] **Step 3: Prova che il dettaglio monta il selettore**

In coda a `test/card-compatta.test.js`:

```js
describe('il dettaglio ospita il selettore del confronto', () => {
  it('DetailPanel disegna i chip e il campo', async () => {
    const { default: DetailPanel } = await import('../src/components/DetailPanel.jsx')
    const html = renderToStaticMarkup(
      createElement(DetailPanel, {
        entry: { destination: destinazione, scoring: punteggio(), cost: { low: 92, high: 150 } },
        criteria: { nights: 5, month: 10, sortBy: 'score' },
        onClose: () => {}, onEdit: () => {},
        catalogo: [destinazione], aggiunte: [],
        onAggiungiAlConfronto: () => {}, onTogliDalConfronto: () => {}, onApriConfronto: () => {},
      }),
    )
    expect(html).toContain('Confronta')
    expect(html).toContain('Aggiungi una destinazione')
  })
})
```

Se `DetailPanel` tira dentro Leaflet, il `vi.mock('leaflet', …)` in cima al file lo copre già.

- [ ] **Step 4: Esegui la suite**

Esegui: `npx vitest run`
Atteso: PASS, tutte. Occhio a `render.test.js`: monta `App` intero, e una prop rinominata a metà si vede lì.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailPanel.jsx src/App.jsx test/card-compatta.test.js
git commit -m "Il dettaglio smette di avere un bottone e guadagna un selettore"
```

---

### Task 5: Guardarlo davvero, e aggiornare la lista

**Files:**
- Modify: `docs/superpowers/plans/2026-08-03-verifica-a-schermo.md`

- [ ] **Step 1: Avvia e guarda**

`npm run dev`, poi l'app a 390×844 (finestra stretta o modalità dispositivo). Controlla nell'ordine:

1. il tocco su una card apre **subito** il dettaglio, a un tocco
2. la card non ha più bottoni in fondo, ed è ancora alta 110px
3. nel dettaglio c'è «Confronta» col chip della destinazione aperta, **senza ×**
4. scrivi tre lettere: la lista filtra; scegline una: compare un chip con la ×
5. la × lo toglie; quello della destinazione aperta non ce l'ha
6. arrivato a quattro, il campo lascia il posto a «Il confronto è pieno»
7. «Apri il confronto» porta al pannello, ed è spento con una sola destinazione
8. **sopra i 901px** le card hanno ancora fascia alta, clima e i due bottoni, e il dettaglio ha il selettore nuovo

- [ ] **Step 2: Aggiorna la lista a occhio**

In `docs/superpowers/plans/2026-08-03-verifica-a-schermo.md`:

- i punti **28-31** e **33-34** riguardano lo stato aperto, che non esiste più: cancellali e scrivi al loro posto una riga sola che dice perché non ci sono più, con la data e il rimando a questa spec
- aggiungi gli otto controlli del passo 1 come punti nuovi, marcando con l'esito quelli che hai davvero eseguito

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-08-03-verifica-a-schermo.md
git commit -m "La lista a occhio perde lo stato aperto e guadagna il selettore"
```

---

## Note per chi esegue

**Il Task 1 è quello che può rompere cose lontane.** Estrarre la regola da `scoring.js` tocca il filtro della classifica: le 51 prove di `scoring.test.js` sono la rete, e vanno passate senza modificarle.

**Il Task 4 contiene due ipotesi sui nomi** (`destinations`, `setCompareOpen`) che chi ha scritto il piano non ha verificato. Leggi `App.jsx` prima di scrivere.

**Il rischio resta il desktop**, ma stavolta è più contenuto: l'unica cosa che si vede sopra i 901px è la sezione nuova nel dettaglio. Le card non si toccano.
