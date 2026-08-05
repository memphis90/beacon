# Card compatta nella classifica mobile — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare la card della classifica da ~450px a 110px sotto i 901px, così che se ne vedano cinque intere invece di una e mezza, senza cambiare niente sopra quella soglia.

**Architecture:** Il markup non si riscrive. Gli elementi che devono spostarsi — `card__rank`, `card__scorepill`, `card__fav`, `card__type` — sono già in posizionamento assoluto dentro una `.card` che è già `position: relative`, quindi su mobile si ri-ancorano col solo CSS. Le uniche aggiunte al JSX sono le props `aperta` / `onApri`, la classe `card--aperta`, e un bottone di apertura sovrapposto che esiste solo su mobile. Lo stato «quale card è aperta» vive in `App`, non nella card, perché «una sola per volta» è una proprietà della lista.

**Tech Stack:** React 19, Vite 7, Vitest 3. Nessuna dipendenza nuova. I test dei componenti usano `renderToStaticMarkup` di `react-dom/server` — **non c'è jsdom e non va aggiunto**: si prova quale markup esce, non cosa succede al tocco.

## Global Constraints

- **Spec di riferimento:** `docs/superpowers/specs/2026-08-05-card-compatta-mobile-design.md`. In caso di conflitto vince la spec.
- **Sopra i 901px non deve cambiare nulla.** È il rischio principale del lavoro. Nessuna regola CSS esistente fuori dai blocchi `@media (max-width: 900px)` va modificata. L'unica eccezione ammessa è **aggiungere** regole per elementi nuovi che nascono già a `display: none` (il bottone di apertura del Task 1).
- **Il clima non si toglie dal markup**, si nasconde con `display: none` su mobile. Sopra i 901px le due caselle restano quelle di oggi.
- **Nessuna dipendenza nuova.** Né librerie di testing, né di animazione, né di icone.
- **Testo in italiano**, come tutto il resto dell'interfaccia.
- **Token, non valori:** colori e misure da `src/styles/tokens.css`. Nessun esadecimale scritto a mano nel CSS nuovo. L'ambra del `+N tema` è `--accent`, il navy dei bottoni è `--primary`.
- **Ogni animazione va spenta** dentro il blocco `@media (prefers-reduced-motion: reduce)` già presente in `src/styles/app.css`.
- **Commit dopo ogni task**, messaggio in italiano, in prosa, senza prefissi tipo `feat:` — è la convenzione di questo repo (`git log --oneline -5` per il tono).
- **Le prove non vedono il CSS.** `renderToStaticMarkup` produce markup senza stili: tutto ciò che questo piano fa in CSS si verifica a occhio, e il Task 6 raccoglie quella lista.

---

## File Structure

| file | responsabilità | azione |
|---|---|---|
| `src/components/DestinationCard.jsx` | la card; guadagna `aperta`, `onApri`, la classe e il bottone di apertura | modifica additiva |
| `src/App.jsx` | tiene l'id della card aperta e lo azzera quando cambiano i criteri | modifica |
| `src/styles/app.css` | il blocco mobile della card; una riga nuova nel CSS base per il bottone | modifica |
| `test/card-compatta.test.js` | le prove sul markup dei due stati | **crea** |
| `docs/superpowers/plans/2026-08-03-verifica-a-schermo.md` | la lista a occhio, che si allunga | modifica |

---

### Task 1: Lo stato «una sola aperta»

**Files:**
- Modify: `src/components/DestinationCard.jsx:11-21` (firma e contenitore), `:43-51` (il cuore)
- Modify: `src/App.jsx:546` (dove monta la lista)
- Modify: `src/styles/app.css` (una regola base per `.card__apri`)
- Test: `test/card-compatta.test.js` (crea)

**Interfaces:**
- Produces: `DestinationCard` accetta due props nuove — `aperta: boolean` (default `false`) e `onApri: () => void` (default no-op). Aggiunge `card--aperta` alla `className` quando `aperta` è vero, e monta `<button className="card__apri" aria-expanded={aperta}>`.
- Produces: `App` tiene `apertaId: string | null` e passa `aperta={apertaId === entry.destination.id}` a ogni card.

- [ ] **Step 1: Scrivi la prova che fallisce**

Crea `test/card-compatta.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DestinationCard from '../src/components/DestinationCard.jsx'

const destinazione = {
  id: 'lisbona',
  name: 'Lisbona',
  country: 'PT',
  type: 'city',
  coords: { lat: 38.7223, lon: -9.1393 },
  radius_km: 40,
  climate: { 10: { temp_avg: 19, temp_max: 23, sea_temp: 20, rain_days: 9 } },
}

const punteggio = (extra = {}) => ({
  total: 88.4,
  base: 88.4,
  themeBonus: 0,
  matchedThemes: [],
  contributions: [
    { key: 'nature', label: 'Natura', weight: 5, score: 45, contribution: 11.2 },
    { key: 'culture', label: 'Cultura', weight: 8, score: 85, contribution: 34.0 },
  ],
  ...extra,
})

const card = (props = {}, extraPunteggio = {}) =>
  renderToStaticMarkup(
    createElement(DestinationCard, {
      entry: {
        destination: destinazione,
        scoring: punteggio(extraPunteggio),
        cost: { low: 92, high: 150 },
      },
      rank: 1,
      criteria: { nights: 5, month: 10, sortBy: 'score' },
      isFavourite: false,
      onToggleFavourite: () => {},
      inCompare: false,
      onToggleCompare: () => {},
      onOpen: () => {},
      ...props,
    }),
  )

describe('card compatta — lo stato aperto sta nel markup', () => {
  it('senza «aperta» la card non porta la classe', () => {
    expect(card()).not.toContain('card--aperta')
  })

  it('con «aperta» la card porta la classe', () => {
    expect(card({ aperta: true })).toContain('card--aperta')
  })

  it('il bottone di apertura dichiara lo stato a chi non vede', () => {
    expect(card()).toContain('aria-expanded="false"')
    expect(card({ aperta: true })).toContain('aria-expanded="true"')
  })

  it('il bottone di apertura c’è anche senza che gli si passi onApri', () => {
    expect(card()).toContain('card__apri')
  })
})
```

- [ ] **Step 2: Esegui la prova e verifica che fallisca**

Esegui: `npx vitest run test/card-compatta.test.js`
Atteso: FAIL — nessuna occorrenza di `card--aperta` né di `card__apri`, perché non esistono ancora.

- [ ] **Step 3: Aggiungi props, classe e bottone alla card**

In `src/components/DestinationCard.jsx`, cambia la firma e il contenitore:

```jsx
export default function DestinationCard({
  entry, rank, criteria, isFavourite, onToggleFavourite, inCompare, onToggleCompare, onOpen,
  aperta = false, onApri = () => {},
}) {
  const { destination, scoring, cost } = entry
  const month = climateSummary(destination, criteria.month)
  const annuale = month.scope === 'year'

  return (
    <article
      className={`card${inCompare ? ' card--selected' : ''}${aperta ? ' card--aperta' : ''}`}
    >
      {/* Il tocco che apre la card è un bottone vero, non un gestore
          appiccicato all'articolo: così esiste per la tastiera e si annuncia
          da sé con aria-expanded. Copre la card, sta sotto il cuore e sotto i
          due bottoni delle azioni, e sopra i 901px non esiste — lì le azioni
          sono già a vista e non c'è niente da aprire. */}
      <button
        type="button"
        className="card__apri"
        aria-expanded={aperta}
        aria-label={aperta ? `Chiudi le azioni di ${destination.name}` : `Mostra le azioni di ${destination.name}`}
        onClick={onApri}
      />

      <div className="card__media">
```

Il resto del corpo resta **identico**. Aggiungi solo lo `stopPropagation` sul cuore, perché il cuore non deve aprire la card (`:48`):

```jsx
          onClick={(e) => { e.stopPropagation(); onToggleFavourite() }}
```

- [ ] **Step 4: Nascondi il bottone sopra i 901px**

In `src/styles/app.css`, **subito dopo** la regola `.card--selected` (`:503`), aggiungi:

```css
/* Il bottone che apre le azioni esiste solo sotto i 901px: sopra, le azioni
   sono già a vista in fondo alla card e non c'è niente da rivelare.
   Nasce spento, e il blocco mobile lo accende. */
.card__apri { display: none; }
```

È l'unica riga che questo piano aggiunge fuori dai media query, e non cambia niente a schermo perché nasce a `display: none`.

- [ ] **Step 5: Esegui la prova e verifica che passi**

Esegui: `npx vitest run test/card-compatta.test.js`
Atteso: PASS, 4 prove.

- [ ] **Step 6: Aggiungi lo stato in App**

In `src/App.jsx`, accanto agli altri `useState` della schermata risultati:

```jsx
  // Quale card mostra le sue azioni. Sta qui e non nella card perché «una
  // sola aperta per volta» è una proprietà della lista: con cinque card a
  // vista, due righe di bottoni aperte insieme sposterebbero le altre sotto
  // il pollice mentre le si guarda.
  const [apertaId, setApertaId] = useState(null)
```

Azzera quando cambia ciò che riordina la lista, altrimenti resta aperta una card che nel frattempo è finita altrove:

```jsx
  useEffect(() => { setApertaId(null) }, [criteria, onlyFavourites])
```

E al montaggio della card (`:546`):

```jsx
                    aperta={apertaId === entry.destination.id}
                    onApri={() =>
                      setApertaId((id) => (id === entry.destination.id ? null : entry.destination.id))
                    }
```

- [ ] **Step 7: Aggiungi la prova che all'avvio nessuna card è aperta**

In coda a `test/card-compatta.test.js`:

```js
describe('card compatta — App non ne apre nessuna da sola', () => {
  it('al primo render non c’è nessuna card aperta', async () => {
    const { default: App } = await import('../src/App.jsx')
    const html = renderToStaticMarkup(createElement(App))
    expect(html).not.toContain('card--aperta')
  })
})
```

Se questa prova fallisce all'import di `leaflet` o di `localStorage`, copia le due difese già presenti in cima a `test/render.test.js` (il `vi.mock('leaflet', …)` e il `beforeAll` che finge `localStorage`) — sono lì per lo stesso motivo.

- [ ] **Step 8: Esegui tutta la suite**

Esegui: `npx vitest run`
Atteso: PASS, tutte. Le 239 prove esistenti non devono cambiare: finora il markup è solo cresciuto.

- [ ] **Step 9: Commit**

```bash
git add src/components/DestinationCard.jsx src/App.jsx src/styles/app.css test/card-compatta.test.js
git commit -m "La card impara ad avere uno stato aperto, e la lista a tenerne una sola"
```

---

### Task 2: La card in riga, alta 110px

**Files:**
- Modify: `src/styles/app.css`, dentro il blocco `@media (max-width: 900px)` che contiene già `.card__fav` (`:1393`)

**Interfaces:**
- Consumes: la classe `card--aperta` del Task 1.
- Produces: `.card` alta 110px in riga con la miniatura a 80×80; `.card--aperta` ad altezza libera. I Task 3, 4 e 5 posizionano i pezzi dentro questa scatola.

- [ ] **Step 1: Metti la card in riga**

Dentro il blocco mobile, **dopo** la regola `.card__fav { width: 44px; height: 44px; }`, apri una sezione nuova:

```css
  /* ---- La card della classifica: 110px, tre colonne ---- */
  /* Il §1 della spec del 5 agosto: qui dentro c'era una regola sola, e la
     card mobile era la card desktop da ~450px, cioè una e mezza a schermo.
     L'altezza è FISSA, ed è ciò che rende lecito il posizionamento assoluto
     dei Task 3 e 5: le posizioni sono note in anticipo perché non dipendono
     dal contenuto. */
  .grid { gap: 8px; }

  .card {
    flex-direction: row;
    align-items: flex-start;
    height: 110px;
    padding: 12px;
    gap: 12px;
  }

  /* Aperta cresce: l'altezza fissa vale solo da chiusa. */
  .card--aperta { height: auto; }

  .card:hover { transform: none; }

  .card__apri {
    display: block;
    position: absolute; inset: 0;
    z-index: 1;
    padding: 0; border: 0; background: none;
    border-radius: var(--radius);
  }
```

`.card:hover { transform: none }` toglie il sollevamento di un pixel al passaggio del mouse (`app.css:502`): su un dispositivo touch non c'è passaggio del mouse, e con cinque card affiancate quel salto diventa rumore quando il dito sfiora.

- [ ] **Step 2: Riduci la miniatura e libera il corpo**

Nella stessa sezione:

```css
  .card__media {
    width: 80px; height: 80px;
    flex: none;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .card__body {
    padding: 0;
    gap: 2px;
    padding-right: 64px;   /* la colonna del punteggio, Task 3 */
    min-width: 0;
  }
```

- [ ] **Step 3: Nascondi il clima e il chip del tipo**

```css
  /* Il clima esce dalla card ed è l'unica perdita di questo lavoro. È
     dichiarata nella spec: il mare è un filtro duro del §5 del planning,
     quindi il motivo per cui una meta di mare è in classifica resta solo nel
     dettaglio. `display: none` la toglie anche dall'albero di accessibilità,
     quindi non è una sparizione soltanto visiva.
     Sopra i 901px le due caselle restano quelle di sempre. */
  .card__climate { display: none; }

  /* Il tipo non sparisce: si accorpa alla riga del paese (Task 5), e il chip
     sull'immagine non serve più. */
  .card__type { display: none; }

  /* La fascia con i bordi sopra e sotto era la riga prezzo+clima: senza il
     clima non è più una fascia, è solo il prezzo. */
  .card__head { padding: 0; border: 0; }
  .card__tilelabel { display: none; }
  .card__ident h3 { font-size: 18px; line-height: 22px; margin: 0; }
  .card__price { font-size: 16px; line-height: 20px; }
  .card__pricenote { font-size: 10px; line-height: 13px; }
```

- [ ] **Step 4: Esegui la suite**

Esegui: `npx vitest run`
Atteso: PASS, invariata. Questo task è solo CSS e nessuna prova lo vede — è previsto, ed è il motivo per cui esiste il Task 6.

- [ ] **Step 5: Guarda a schermo**

Esegui `npm run dev`, riduci la finestra sotto i 900px (o modalità dispositivo, 390×844), fai una ricerca.
Atteso: le card sono righe basse con la foto quadrata a sinistra; il clima non c'è; **sopra i 901px la card è identica a prima**. Punteggio e cuore sono ancora fuori posto: li sistema il Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css
git commit -m "La card della classifica si sdraia: centodieci pixel e la foto in un quadrato"
```

---

### Task 3: Punteggio, rango, cuore e barra al loro posto

**Files:**
- Modify: `src/styles/app.css`, stessa sezione del Task 2

**Interfaces:**
- Consumes: `.card` alta 110px con `padding: 12px` del Task 2.
- Produces: la colonna destra da 64px occupata da cuore, punteggio e barra; il rango sull'angolo della miniatura.

- [ ] **Step 1: Ri-ancora gli elementi già assoluti**

Sono già `position: absolute` dentro una `.card` che è già `position: relative` (`app.css:492`): basta ridire dove stanno.

```css
  /* ---- La colonna destra: cuore, punteggio, barra ---- */
  /* Nessuno di questi elementi cambia posto nel markup: erano sovrapposti
     all'immagine perché l'immagine era una fascia alta 192px. Ora l'immagine
     è un quadrato di 80px e loro si ri-ancorano alla card. */

  .card__fav {
    top: 4px; right: 4px;
    bottom: auto; left: auto;
    z-index: 2;
  }

  .card__rank {
    top: 6px; left: 6px;
    bottom: auto; right: auto;
  }

  .card__scorepill {
    top: 52px; right: 12px;
    bottom: auto; left: auto;
    width: 56px;
    padding: 0;
    background: none; box-shadow: none;
    display: flex; flex-direction: column; align-items: flex-end;
    font-size: 0;            /* la parola «Punteggio» non entra in 56px */
  }
  .card__scorepill b {
    font-size: 28px; line-height: 30px;
    font-variant-numeric: tabular-nums;
  }

  .card__interests {
    position: absolute;
    top: 84px; right: 12px;
    width: 56px;
    gap: 0;
  }
  .card__interestlabel { display: none; }
```

`font-size: 0` sulla pillola spegne la parola «Punteggio» senza toglierla dal markup: sotto c'è il numero, e in 56px di larghezza la parola non ci sta. Il `b` si riprende la sua dimensione.

- [ ] **Step 2: Verifica che il testo del corpo non finisca sotto la colonna**

Il `padding-right: 64px` su `.card__body` del Task 2 è ciò che tiene il nome lontano dal punteggio. Con un nome lungo — «Santiago de Compostela» — il nome deve andare a capo o troncare, mai passare sotto il numero.

```css
  .card__ident h3 {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
```

- [ ] **Step 3: Esegui la suite**

Esegui: `npx vitest run`
Atteso: PASS, invariata.

- [ ] **Step 4: Guarda a schermo**

A 390×844: il punteggio è grande, a destra, con la barra dei contributi sotto; il cuore è nell'angolo in alto a destra della card; il rango è sull'angolo della foto. **Sopra i 901px niente è cambiato.** Prova anche una destinazione dal nome lungo.

- [ ] **Step 5: Commit**

```bash
git add src/styles/app.css
git commit -m "Il punteggio prende la colonna di destra, e il rango l’angolo della foto"
```

---

### Task 4: Lo stato aperto — asse guida e azioni

**Files:**
- Modify: `src/styles/app.css`, stessa sezione

**Interfaces:**
- Consumes: `.card--aperta` del Task 1.
- Produces: le azioni e la didascalia dell'asse guida visibili solo da aperta.

- [ ] **Step 1: Nascondi azioni e didascalia da chiusa, mostrale da aperta**

```css
  /* ---- Lo stato aperto ---- */
  /* Da chiusa la card mostra solo ciò che serve a scartare: identità,
     prezzo, punteggio. Le azioni e il perché del punteggio arrivano al
     tocco. Il costo è dichiarato nella spec: il dettaglio passa da uno a due
     tocchi, ed è il prezzo della densità. */
  .card__actions,
  .card__interests .segbar__caption {
    display: none;
  }

  .card--aperta .card__actions {
    display: flex;
    position: absolute;
    left: 12px; right: 12px; bottom: 12px;
    z-index: 2;
  }

  /* L'asse guida è ciò che il §5 del planning usa per capire quale asse ha
     prodotto il totale: senza, la barra da sola non basta — lo dice il
     commento in cima a ScoreBreakdown.jsx. Sta qui e non sulla card chiusa
     perché in 86px non entra, e chi apre una card vuole esattamente questo. */
  .card--aperta .card__interests {
    position: static;
    width: auto;
    margin-top: 4px;
  }
  .card--aperta .card__interests .segbar__caption {
    display: block;
    font-size: 11px; line-height: 14px;
  }

  .card--aperta { padding-bottom: 68px; }
```

- [ ] **Step 2: Esegui la suite**

Esegui: `npx vitest run`
Atteso: PASS, invariata.

- [ ] **Step 3: Guarda a schermo**

A 390×844: tocca una card → compaiono l'asse guida e i due bottoni; tocca un'altra → la prima si richiude; tocca il cuore → **la card non si apre** e il preferito cambia; tocca «Dettaglio» → si apre il dettaglio.

- [ ] **Step 4: Commit**

```bash
git add src/styles/app.css
git commit -m "Al tocco la card mostra le azioni e il perché di quel punteggio"
```

---

### Task 5: Il «+N tema» in coda alla riga del paese

**Files:**
- Modify: `src/styles/app.css`, stessa sezione
- Modify: `test/card-compatta.test.js`

**Interfaces:**
- Consumes: `.card__where` e `.card__themebonus`, già nel markup.
- Produces: nessuna interfaccia nuova.

- [ ] **Step 1: Scrivi la prova che fallisce**

In coda a `test/card-compatta.test.js`, dentro il primo `describe`:

```js
  it('il «+N tema» è nel markup solo quando c’è un bonus', () => {
    expect(card()).not.toContain('tema')
    expect(card({}, { themeBonus: 2, base: 86.4, matchedThemes: ['mare'] })).toContain('+2 tema')
  })

  it('la riga del paese porta il tipo accanto al paese', () => {
    expect(card()).toContain('Portogallo')
  })
```

- [ ] **Step 2: Esegui e verifica**

Esegui: `npx vitest run test/card-compatta.test.js`
Atteso: la prova sul `+N tema` **passa già** — l'elemento è nel markup dall'inizio (`DestinationCard.jsx:34-38`). La seconda fallisce se il tipo non è nella riga del paese.

Se la prima passa subito, va bene: è una prova di non-regressione, e serve perché il Task 5 sposta quell'elemento col CSS e la sua presenza nel markup non deve cambiare.

- [ ] **Step 3: Porta tipo e bonus sulla riga del paese**

`DestinationCard.jsx:57-59` — aggiungi il tipo alla riga del paese, che su desktop oggi mostra solo bandiera e paese. **Questo cambia anche il desktop**, ed è l'unica modifica visibile sopra i 901px di tutto il piano: il chip del tipo era sull'immagine, e sulla riga del paese diventa `Portogallo · città`.

Fermati e chiedi conferma prima di farlo. L'alternativa, se il desktop non deve cambiare, è tenere il chip `.card__type` e ri-ancorarlo su mobile come gli altri assoluti del Task 3 — costa una regola in più e non tocca il desktop:

```css
  .card__type {
    display: block;
    top: 34px; left: 104px;
    bottom: auto; right: auto;
    background: none; padding: 0;
    color: var(--ink-2);
    font-size: 11px; line-height: 14px;
  }
  .card__where { padding-left: 0; }
```

- [ ] **Step 4: Ri-ancora il «+N tema»**

```css
  /* Il bonus tematico non può stare sotto la barra: costerebbe ~14px a tutte
     le card per servirne poche, e le cinque intere diventerebbero quattro.
     Va accanto al paese, dove lo spazio a destra c'è già. */
  .card__themebonus {
    position: absolute;
    top: 34px; right: 76px;
    font-size: 10px; line-height: 13px;
    color: var(--accent-dark);
    white-space: nowrap;
  }
```

`--accent-dark` e non `--accent`: l'ambra piena su fondo bianco non arriva al contrasto richiesto per un testo di 10px.

- [ ] **Step 5: Esegui la suite**

Esegui: `npx vitest run`
Atteso: PASS, tutte.

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css test/card-compatta.test.js
git commit -m "Il tipo e il bonus di tema si accodano alla riga del paese"
```

---

### Task 6: La lista da guardare a occhio

**Files:**
- Modify: `docs/superpowers/plans/2026-08-03-verifica-a-schermo.md`

Tutto ciò che i Task 2-5 hanno fatto è CSS, e `renderToStaticMarkup` non applica il CSS: nessuna prova automatica di questo piano ha visto una card alta 110px. Questa lista non è una formalità.

- [ ] **Step 1: Aggiungi la sezione in coda al file**

```markdown
## Mobile — la card compatta della classifica

Da fare a 390×844. Niente di questo è coperto dalle prove automatiche: è tutto CSS.

- [ ] **20.** La classifica mostra **cinque card intere e la sesta quasi tutta**
      senza scorrere. Se se ne vedono tre, l'altezza fissa non ha preso.
- [ ] **21.** Ogni card: foto quadrata a sinistra, nome, `paese · tipo`, fascia
      di costo, la nota «a persona · N notti · volo escluso», e a destra il
      punteggio grande con la barra dei contributi sotto.
- [ ] **22.** **Il clima non c'è.** Nessun termometro, nessuna temperatura.
- [ ] **23.** Ordina per **Costo**: il badge del rango sparisce da tutte le
      foto. Torna su **Punteggio**: riappare, e riparte da 1º.
- [ ] **24.** Una destinazione col bonus tematico mostra `+2 tema` accanto al
      paese, in ambra, **non** sotto la barra.
- [ ] **25.** Un nome lungo (Santiago de Compostela) tronca con i puntini e
      **non passa sotto il punteggio**.
- [ ] **26.** Tocca una card: compaiono l'asse guida e i due bottoni.
- [ ] **27.** Tocca una seconda card: **la prima si chiude**. Mai due aperte.
- [ ] **28.** Tocca il cuore di una card chiusa: il preferito cambia e **la
      card non si apre**.
- [ ] **29.** Con una card aperta, cambia un filtro: **si richiude**.
- [ ] **30.** Con la tastiera: il tab arriva sul bottone di apertura, Invio lo
      apre, e il lettore di schermo annuncia lo stato (`aria-expanded`).
- [ ] **31.** **Sopra i 901px la card è identica a prima**: foto a fascia alta,
      clima, due bottoni sempre visibili. È il rischio principale del lavoro
      e va guardato per ultimo, con calma.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-08-03-verifica-a-schermo.md
git commit -m "La lista a occhio si allunga con la card compatta"
```

---

## Note per chi esegue

**Il numero da battere.** Prima: una card e mezza a schermo. Dopo: cinque intere e la sesta quasi tutta. Se al Task 2 non se ne vedono almeno quattro, qualcosa non ha preso e non ha senso proseguire coi Task 3-5.

**Il rischio è il desktop.** Nessuna prova lo protegge. Ogni volta che un task tocca `app.css`, allarga la finestra sopra i 901px e guarda una card prima di committare.

**Il Task 5 ha un bivio** — cambiare la riga del paese anche su desktop, o tenere il chip e ri-ancorarlo su mobile. Chiedi prima di scegliere: è l'unico punto del piano dove il desktop potrebbe cambiare.
