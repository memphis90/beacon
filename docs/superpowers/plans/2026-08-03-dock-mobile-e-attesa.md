# Dock mobile e schermata d'attesa — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere la barra inferiore mobile identica nelle due schermate, con un pulsante centrale che è l'unica azione d'invio, e sostituire il riquadro d'attesa con il faro acceso su velo.

**Architecture:** Nessun componente nuovo tranne due piccoli (`PanelTabs`, e il corpo dell'attesa resta dentro `Landing`). `BottomNav` guadagna uno slot centrale e cambia due voci. `App` e `Landing` montano entrambi la dock; `Landing` riceve da `App` le props che oggi non ha. `EditorPanel` e `SettingsModal` accettano un nodo `tabs` opzionale che disegnano sotto la loro testata — nessun refactor dei loro corpi.

**Tech Stack:** React 19, Vite 7, Vitest 3. Nessuna dipendenza nuova. I test dei componenti usano `renderToStaticMarkup` di `react-dom/server` — **non c'è jsdom e non va aggiunto**: si prova che il markup contenga ciò che deve, non il comportamento.

## Global Constraints

- **Sopra i 901px non deve cambiare nulla.** La dock è `display: none`, la topbar è già chiara, i pannelli non ricevono `tabs`. Le regole CSS che riguardano la dock e la topbar vivono dentro `@media (max-width: 900px)`; quelle dell'attesa e delle schede **no**, e non è una svista: il velo dell'attesa compare a ogni larghezza, e le schede esistono dove vengono montate. Ogni task dice quale dei due casi è il suo.
- **Spec di riferimento:** `docs/superpowers/specs/2026-08-03-dock-mobile-e-attesa-design.md`. In caso di conflitto vince la spec.
- **Nessuna dipendenza nuova.** Né librerie di testing, né di animazione, né di icone: `IconSparkle`, `IconSearch`, `IconList`, `IconHeart`, `IconScale`, `IconSettings` esistono già in `src/components/Icons.jsx`.
- **Testo in italiano**, come tutto il resto dell'interfaccia.
- **Ogni animazione va spenta** dentro il blocco `@media (prefers-reduced-motion: reduce)` esistente a `src/styles/app.css:1930`.
- **Token, non valori:** colori e misure da `src/styles/tokens.css` (`--primary`, `--surface`, `--border`, `--accent`, `--bottomnav-h`, `--radius-pill`). Nessun esadecimale scritto a mano nel CSS nuovo.
- **Commit dopo ogni task**, messaggio in italiano, in prosa, senza prefissi tipo `feat:` — è la convenzione di questo repo (`git log --oneline -5` per il tono).

---

## File Structure

| file | responsabilità | azione |
|---|---|---|
| `src/components/BottomNav.jsx` | i cinque slot, il centro che sporge, gli stati disattivi | modifica |
| `src/components/PanelTabs.jsx` | la striscia a due schede dentro la testata di un pannello | **crea** |
| `src/components/EditorPanel.jsx` | invariato, tranne che disegna `tabs` se lo riceve | modifica (2 righe) |
| `src/components/SettingsModal.jsx` | idem | modifica (2 righe) |
| `src/App.jsx` | stato `mobilePanel`, monta la dock nei risultati, passa le props a `Landing` | modifica |
| `src/components/Landing.jsx` | monta la dock, perde la freccia del composer, nuovo blocco d'attesa | modifica |
| `src/components/Logo.jsx` | due `className` sugli elementi ambra, per dare un appiglio al CSS | modifica (2 righe) |
| `src/styles/app.css` | topbar chiara, dock a cinque, attesa col faro, `prefers-reduced-motion` | modifica |
| `test/dock.test.js` | le prove di markup di tutto questo piano | **crea** |

`test/render.test.js` resta com'è: è la prova fumo generale e non va gonfiata. Una sua chiamata a `BottomNav` (riga ~113) userà props cambiate e **va aggiornata nel Task 1**, o il test rosseggia.

---

## Task 1: BottomNav a cinque slot

**Files:**
- Modify: `src/components/BottomNav.jsx` (tutto il file)
- Modify: `test/render.test.js:113-116` (la chiamata esistente a `BottomNav`)
- Modify: `src/styles/app.css:1305-1330` (blocco `.bottomnav`)
- Test: `test/dock.test.js` (crea)

**Interfaces:**
- Consumes: `IconList`, `IconHeart`, `IconScale`, `IconSettings`, `IconSparkle`, `IconSearch` da `./Icons.jsx`
- Produces: il componente `BottomNav` con questa firma esatta, usata dal Task 2 e dal Task 3:

```js
BottomNav({
  onlyFavourites,      // bool — quale delle due viste è attiva
  favouritesCount,     // number — badge
  compareCount,        // number — badge
  hasResults,          // bool — false = i tre slot di vista sono disattivi
  askLabel,            // 'Chiedi' | 'Cerca'
  askDisabled,         // bool
  onAsk,               // () => void
  onList,              // () => void   (era onSearch)
  onFavourites,        // () => void
  onCompare,           // () => void
  onSettings,          // () => void   (era onEditor)
})
```

- [ ] **Step 1: Scrivi la prova che fallisce**

Crea `test/dock.test.js`:

```js
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BottomNav from '../src/components/BottomNav.jsx'

/**
 * Due difese copiate da render.test.js, e servono entrambe dal Task 2 in poi,
 * quando queste prove montano `App`:
 *
 * - Leaflet tocca `window` già all'import, e la mappa del dettaglio lo tira
 *   dentro tutta la catena di App. Non è ciò che si sta provando qui.
 * - Il render statico non esegue gli effetti, ma gli inizializzatori di stato
 *   sì, e quelli leggono da `localStorage`, che in Node non esiste.
 */
vi.mock('leaflet', () => ({ default: {} }))

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const memoria = new Map()
    globalThis.localStorage = {
      getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
      setItem: (k, v) => memoria.set(k, String(v)),
      removeItem: (k) => memoria.delete(k),
      clear: () => memoria.clear(),
    }
  }
})

const nulla = () => {}
const base = {
  onlyFavourites: false, favouritesCount: 0, compareCount: 0, hasResults: true,
  askLabel: 'Chiedi', askDisabled: false,
  onAsk: nulla, onList: nulla, onFavourites: nulla, onCompare: nulla, onSettings: nulla,
}
const dock = (over = {}) => renderToStaticMarkup(createElement(BottomNav, { ...base, ...over }))

/**
 * Il bottone che porta questa etichetta, isolato dal resto del markup.
 *
 * Senza jsdom si lavora sulla stringa, ma contare le occorrenze di "disabled"
 * nell'intera pagina si romperebbe al primo bottone spento aggiunto altrove,
 * per ragioni che non c'entrano con ciò che si sta provando.
 */
const bottone = (html, etichetta) =>
  html.match(new RegExp(`<button(?:(?!</button>).)*?${etichetta}</button>`))?.[0] ?? ''

const spento = (html, etichetta) => / disabled(=|>| )/.test(bottone(html, etichetta))

describe('BottomNav — cinque slot, il centro è l’azione', () => {
  it('disegna le cinque voci, con Impostazioni al posto di Parametri', () => {
    const html = dock()
    for (const voce of ['Elenco', 'Preferiti', 'Chiedi', 'Confronta', 'Impostazioni']) {
      expect(html).toContain(voce)
    }
    expect(html).not.toContain('Parametri')
  })

  it('il centro cambia nome secondo chi risponderà', () => {
    expect(dock({ askLabel: 'Cerca' })).toContain('Cerca')
    expect(dock({ askLabel: 'Cerca' })).not.toContain('Chiedi')
  })

  /**
   * Il centro deve essere riconoscibile nel markup, non solo a schermo: è la
   * classe su cui poggia tutta la regola CSS che lo fa sporgere.
   */
  it('il centro ha la sua classe e non è un tab come gli altri', () => {
    expect(dock()).toContain('bottomnav__ask')
  })

  it('senza risultati i tre slot di vista sono disattivi, gli altri due no', () => {
    const html = dock({ hasResults: false })
    expect(spento(html, 'Elenco')).toBe(true)
    expect(spento(html, 'Preferiti')).toBe(true)
    expect(spento(html, 'Confronta')).toBe(true)
    // Il centro e le impostazioni sono le uniche due cose che in quel momento
    // si possono fare davvero.
    expect(spento(html, 'Chiedi')).toBe(false)
    expect(spento(html, 'Impostazioni')).toBe(false)
  })

  it('con risultati solo Confronta resta spento, e solo sotto le due selezioni', () => {
    const html = dock({ hasResults: true, compareCount: 1 })
    expect(spento(html, 'Elenco')).toBe(false)
    expect(spento(html, 'Confronta')).toBe(true)
    expect(spento(dock({ hasResults: true, compareCount: 2 }), 'Confronta')).toBe(false)
  })

  it('il centro si disattiva quando non c’è niente da chiedere', () => {
    expect(spento(dock({ askDisabled: true }), 'Chiedi')).toBe(true)
    expect(spento(dock({ askDisabled: false }), 'Chiedi')).toBe(false)
  })

  it('i badge compaiono solo se c’è qualcosa da contare', () => {
    expect(dock({ favouritesCount: 3, compareCount: 2 })).toContain('bottomnav__badge')
    expect(dock()).not.toContain('bottomnav__badge')
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm test -- dock`
Expected: FAIL — «Elenco» non compare (il componente attuale dice «Cerca»), e `bottomnav__ask` non esiste.

- [ ] **Step 3: Riscrivi il componente**

Sostituisci **tutto** `src/components/BottomNav.jsx`:

```jsx
import { IconHeart, IconList, IconScale, IconSearch, IconSettings, IconSparkle } from './Icons.jsx'

/**
 * La barra inferiore, identica nelle due schermate.
 *
 * Cinque slot, e quello di mezzo non è un sesto tab: è l'azione. Sporge sopra
 * il bordo della barra perché è l'unico modo di dire "questo non è come gli
 * altri quattro" senza scriverlo. La freccia che stava nel composer è sparita:
 * un invio solo, in basso, dove arriva il pollice.
 *
 * `hasResults` è falso solo alla prima apertura, prima che una ricerca esista:
 * Elenco, Preferiti e Confronta lavorano tutti sul ranking, e senza ranking non
 * hanno niente da mostrare. Restano visibili e spenti invece di sparire —
 * una dock che cambia forma fra le due schermate non sarebbe più la stessa
 * dock, che è tutto il motivo per cui esiste così.
 */
export default function BottomNav({
  onlyFavourites, favouritesCount, compareCount, hasResults = true,
  askLabel = 'Cerca', askDisabled = false,
  onAsk, onList, onFavourites, onCompare, onSettings,
}) {
  // `fillable` esiste perché solo il cuore ha una versione piena: passare
  // `filled` a tutte le icone lo faceva finire come attributo sull'`svg`, e
  // React lo segnalava a ogni render.
  const sinistra = [
    { key: 'list', label: 'Elenco', Icon: IconList, active: hasResults && !onlyFavourites, disabled: !hasResults, onClick: onList },
    { key: 'fav', label: 'Preferiti', Icon: IconHeart, fillable: true, active: hasResults && onlyFavourites, badge: favouritesCount, disabled: !hasResults, onClick: onFavourites },
  ]
  const destra = [
    { key: 'cmp', label: 'Confronta', Icon: IconScale, badge: compareCount, disabled: !hasResults || compareCount < 2, onClick: onCompare },
    { key: 'set', label: 'Impostazioni', Icon: IconSettings, onClick: onSettings },
  ]

  const tab = ({ key, label, Icon, fillable, active, badge, disabled, onClick }) => (
    <button
      key={key}
      type="button"
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="bottomnav__icon">
        <Icon {...(fillable ? { filled: active } : {})} width="22" height="22" />
        {badge > 0 && <span className="bottomnav__badge">{badge}</span>}
      </span>
      {label}
    </button>
  )

  // Scintilla col modello, lente con le regole: l'icona dice chi risponderà
  // prima ancora dell'etichetta.
  const AskIcon = askLabel === 'Chiedi' ? IconSparkle : IconSearch

  return (
    <nav className="bottomnav" aria-label="Navigazione principale">
      {sinistra.map(tab)}

      <button
        type="button"
        className="bottomnav__ask"
        disabled={askDisabled}
        onClick={onAsk}
      >
        <span className="bottomnav__askdisc">
          <AskIcon width="26" height="26" />
        </span>
        {askLabel}
      </button>

      {destra.map(tab)}
    </nav>
  )
}
```

- [ ] **Step 4: Aggiorna la chiamata in `render.test.js`**

In `test/render.test.js`, sostituisci il blocco che monta `BottomNav` (cerca `components/BottomNav.jsx`) con:

```js
    await renderizza('../src/components/BottomNav.jsx', {
      onlyFavourites: false, favouritesCount: 0, compareCount: 0, hasResults: true,
      askLabel: 'Cerca', askDisabled: false,
      onAsk: nulla, onList: nulla, onFavourites: nulla, onCompare: nulla, onSettings: nulla,
    })
```

- [ ] **Step 5: Esegui e verifica che passi**

Run: `npm test`
Expected: PASS su tutto, `dock.test.js` incluso.

- [ ] **Step 6: Il CSS dei cinque slot**

In `src/styles/app.css`, dentro il `@media (max-width: 900px)` che contiene già `.bottomnav` (~riga 1305), **dopo** la regola `.bottomnav__badge`, aggiungi:

```css
  /* Il centro non è un tab: è l'azione, e lo dice sporgendo.
     `overflow: visible` sulla barra è obbligatorio — senza, il disco viene
     tagliato dal bordo superiore ed è il modo più silenzioso di far fallire
     tutto questo. */
  .bottomnav { overflow: visible; }

  .bottomnav__ask {
    flex: 1; min-height: 44px;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    gap: 2px; padding-bottom: 6px;
    border: 0; background: none; color: var(--primary);
    font-size: 11px; line-height: 14px; font-weight: 700;
  }
  .bottomnav__askdisc {
    display: grid; place-items: center;
    width: 56px; height: 56px;
    margin-top: -26px;               /* quanto sporge sopra la barra */
    border-radius: var(--radius-pill);
    background: var(--primary); color: var(--on-primary);
    box-shadow: 0 12px 24px rgb(0 22 42 / 18%);
  }
  .bottomnav__ask:disabled { opacity: 0.45; }
```

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomNav.jsx test/dock.test.js test/render.test.js src/styles/app.css
git commit -F - <<'EOF'
La barra inferiore prende un centro, e il centro non è un tab

Cinque slot invece di quattro. Quello di mezzo sporge sopra il bordo perché
è l'azione e non una voce fra le altre, e cambia nome secondo chi
risponderà: «Chiedi» col modello, «Cerca» a regole.

«Cerca» diventa «Elenco»: da quando l'invio ha un posto suo, quella voce
non è più un'azione ma una vista. «Parametri» diventa «Impostazioni», che
le conterrà entrambe.

`hasResults` spegne i tre slot che lavorano sul ranking finché un ranking
non esiste. Spenti e visibili, non nascosti: una dock che cambia forma fra
le due schermate non sarebbe più la stessa dock.
EOF
```

---

## Task 2: La dock nei risultati, col centro che riapre la frase

**Files:**
- Modify: `src/App.jsx` (blocco `<BottomNav>` in fondo, ~riga 585)
- Test: `test/dock.test.js` (aggiungi)

**Interfaces:**
- Consumes: `BottomNav` col contratto del Task 1
- Produces: niente per i task successivi

**Contesto:** `App` tiene già `phrase` (la frase che ha prodotto i risultati) e `setStarted`. Il centro qui deve riportare alla schermata di ricerca **senza svuotare `phrase`** — `Landing` la ripescherà nel Task 3.

- [ ] **Step 1: Scrivi la prova che fallisce**

In `test/dock.test.js`, aggiungi l'import **in cima al file** insieme agli altri:

```js
import App from '../src/App.jsx'
```

e il blocco di prove in fondo:

```js
describe('risultati — la dock c’è e il centro riapre la frase', () => {
  it('la schermata dei risultati monta la dock col centro', () => {
    const html = renderToStaticMarkup(createElement(App, { startedInitially: true }))
    expect(html).toContain('bottomnav__ask')
    expect(html).toContain('Impostazioni')
    expect(html).toContain('Elenco')
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm test -- dock`
Expected: FAIL — `App` passa ancora `onSearch`/`onEditor`, quindi `Elenco` e `Impostazioni` non compaiono.

- [ ] **Step 3: Aggiorna il montaggio in `App.jsx`**

Sostituisci il blocco `<BottomNav …>` in fondo a `src/App.jsx`:

```jsx
      <BottomNav
        onlyFavourites={onlyFavourites}
        favouritesCount={favourites.length}
        compareCount={compareIds.length}
        hasResults
        /* Nei risultati il modello ha già risposto: l'etichetta resta quella
           di chi risponderebbe se ripremessi, che è anche chi ha risposto. */
        askLabel={agentIsReady(agent) ? 'Chiedi' : 'Cerca'}
        /* Riapre il composer con dentro la frase che ha prodotto questi
           risultati: `phrase` non viene toccata, e Landing la ripesca. Dopo
           aver letto un elenco si corregge il budget, non si ricomincia. */
        onAsk={() => setStarted(false)}
        onList={() => { setOnlyFavourites(false); setDetailId(null) }}
        onFavourites={() => setOnlyFavourites(!onlyFavourites)}
        onCompare={() => setCompareOpen(true)}
        onSettings={() => setMobilePanel('parametri')}
      />
```

Nella stessa modifica aggiungi lo stato, accanto agli altri `useState` di `App` (vicino a `const [settingsOpen, setSettingsOpen] = useState(false)`):

```jsx
  /* Quale scheda del pannello mobile è aperta: 'parametri' | 'modello' | null.
     Su desktop resta sempre null — la dock che lo apre non esiste. */
  const [mobilePanel, setMobilePanel] = useState(null)
```

Verifica che `agentIsReady` sia importato in `App.jsx`; se non lo è, aggiungilo all'import esistente da `./lib/agent.js`.

**Nota:** `setMobilePanel` non ha ancora un consumatore — il pannello arriva nel Task 4. Fino ad allora premere Impostazioni non apre niente, ed è atteso.

- [ ] **Step 4: Esegui e verifica che passi**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx test/dock.test.js
git commit -F - <<'EOF'
Nei risultati il centro riporta alla frase, senza cancellarla

`phrase` non viene toccata: Landing la ripescherà nel campo, col cursore in
fondo. Dopo aver visto un elenco si aggiusta il mese o il budget, e
ricominciare da zero era il gesto sbagliato da offrire per primo.

Chi vuole ripartire pulito ha ancora «Nuova ricerca» nel menu laterale.
EOF
```

---

## Task 3: La dock nella schermata di ricerca

**Files:**
- Modify: `src/App.jsx` (le props passate a `<Landing>`, ~riga 261)
- Modify: `src/components/Landing.jsx` (import, props, freccia rimossa, dock montata)
- Modify: `src/styles/app.css` (padding in fondo al corpo della ricerca)
- Test: `test/dock.test.js` (aggiungi)

**Interfaces:**
- Consumes: `BottomNav` (Task 1)
- Produces: `Landing` accetta le props nuove `phrase`, `favouritesCount`, `compareCount`, `hasResults`, `onList`, `onCompare`, `onOpenPanel` — usate dal Task 4

- [ ] **Step 1: Scrivi la prova che fallisce**

Aggiungi in `test/dock.test.js`:

```js
describe('ricerca — la stessa dock, e un invio solo', () => {
  it('la home monta la dock, spenta dove non c’è ancora niente', () => {
    const html = renderToStaticMarkup(createElement(App))
    expect(html).toContain('bottomnav__ask')
    // Nessun ranking esiste ancora: i tre slot che ci lavorano sopra sono spenti.
    expect(spento(html, 'Elenco')).toBe(true)
    expect(spento(html, 'Preferiti')).toBe(true)
    expect(spento(html, 'Confronta')).toBe(true)
    expect(spento(html, 'Impostazioni')).toBe(false)
  })

  /**
   * La freccia del composer deve sparire, o l'invio resta in due posti a un
   * centimetro di distanza. `landing__send` era la sua classe.
   */
  it('il composer non ha più la sua freccia', () => {
    expect(renderToStaticMarkup(createElement(App))).not.toContain('landing__send')
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm test -- dock`
Expected: FAIL — `bottomnav__ask` non c'è sulla home, e `landing__send` c'è ancora.

- [ ] **Step 3: Passa le props da `App` a `Landing`**

In `src/App.jsx`, nel `return` dentro `if (!started)`, aggiungi a `<Landing>` (mantenendo quelle esistenti):

```jsx
        phrase={phrase}
        favouritesCount={favourites.length}
        compareCount={compareIds.length}
        hasResults={ranking.hasRanking}
        onList={() => { setOnlyFavourites(false); setStarted(true) }}
        onFavourites={() => { setOnlyFavourites(true); setStarted(true) }}
        onCompare={() => { setCompareOpen(true); setStarted(true) }}
        /* Servono al Task 4: il pannello delle impostazioni ha una scheda
           Parametri anche qui, e senza questi due sarebbe una scheda morta.
           `merged` la home ce l'ha già, si chiama `destinations`. */
        overrides={overrides}
        onOverridesChange={applyOverrides}
```

- [ ] **Step 4: Monta la dock in `Landing` e togli la freccia**

In `src/components/Landing.jsx`:

**4a.** Aggiungi l'import in cima, accanto agli altri componenti:

```jsx
import BottomNav from './BottomNav.jsx'
```

**4b.** Estendi la firma del componente:

```jsx
export default function Landing({
  destinations, agent, onAgentChange, onApply, onSkip, onLogout,
  phrase = '', favouritesCount = 0, compareCount = 0, hasResults = false,
  onList, onFavourites, onCompare,
}) {
```

**4c.** Il campo parte dalla frase precedente. Sostituisci l'inizializzatore dello stato del testo:

```jsx
  // Arrivando dai risultati il campo è già pieno: è il centro della dock che
  // ha riportato qui, e il gesto che segue è correggere, non riscrivere.
  const [text, setText] = useState(phrase)
```

**4d.** Rimuovi il `<button type="submit" className="btn btn--primary landing__send" …>` dentro `.landing__boxbar`, lasciando solo `<InterpreterPicker …/>`. Il `<form>` e il suo `onSubmit` restano: `Enter` continua a inviare.

**4e.** Prima della chiusura del `</div>` più esterno del componente — **dopo** il blocco `{settingsOpen && …}` — monta la dock:

```jsx
      <BottomNav
        onlyFavourites={false}
        favouritesCount={favouritesCount}
        compareCount={compareCount}
        hasResults={hasResults}
        askLabel={conModello ? 'Chiedi' : 'Cerca'}
        /* Gli stessi criteri della freccia che sostituisce: col modello serve
           del testo, con le regole serve che le regole ci abbiano capito
           qualcosa. */
        askDisabled={conModello ? !text.trim() : parsed.empty}
        onAsk={submit}
        onList={onList}
        onFavourites={onFavourites}
        onCompare={onCompare}
        onSettings={() => setSettingsOpen(true)}
      />
```

**4f.** `submit` oggi si aspetta un evento e chiama `e.preventDefault()`. Rendilo tollerante a essere chiamato senza — cerca la sua definizione e cambia la prima riga in:

```jsx
  const submit = (e) => {
    e?.preventDefault?.()
```

- [ ] **Step 5: Il corpo della ricerca non finisce sotto la barra**

In `src/styles/app.css`, dentro il `@media (max-width: 900px)` che contiene già la regola con `--bottomnav-h` (~riga 1265), aggiungi:

```css
  /* La dock è fissa: senza questo, l'ultima riga della home ci finisce sotto.
     È lo stesso rimedio già applicato ai risultati. */
  .landing__body { padding-bottom: calc(var(--bottomnav-h) + var(--container-margin)); }
```

- [ ] **Step 6: Esegui e verifica che passi**

Run: `npm test`
Expected: PASS. Se `render.test.js` fallisce su «Dove andiamo?», la dock è stata montata fuori dal `<div className="landing shell">`: rientrala.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/Landing.jsx src/styles/app.css test/dock.test.js
git commit -F - <<'EOF'
La dock arriva anche nella ricerca, e l'invio resta uno solo

La freccia dentro il composer sparisce: era in alto, lontana dal pollice, e
teneva l'azione principale in un posto diverso da quello dei risultati. Ora
l'invio è il centro della barra, uguale nelle due schermate.

Arrivando dai risultati il campo parte già pieno con la frase precedente.

Elenco, Preferiti e Confronta restano spenti finché un ranking non esiste —
alla prima apertura non hanno niente da mostrare.
EOF
```

---

## Task 4: Impostazioni, un pannello a due schede

**Files:**
- Create: `src/components/PanelTabs.jsx`
- Modify: `src/components/EditorPanel.jsx` (firma + una riga nel markup)
- Modify: `src/components/SettingsModal.jsx` (firma + una riga nel markup)
- Modify: `src/App.jsx` (monta il pannello secondo `mobilePanel`)
- Modify: `src/styles/app.css` (stile della striscia)
- Test: `test/dock.test.js` (aggiungi)

**Interfaces:**
- Consumes: lo stato `mobilePanel` creato nel Task 2
- Produces: `PanelTabs({ active, onPick })` dove `active` è `'parametri' | 'modello'`

- [ ] **Step 1: Scrivi la prova che fallisce**

Aggiungi in `test/dock.test.js`:

```js
import PanelTabs from '../src/components/PanelTabs.jsx'

describe('PanelTabs — le due schede del pannello mobile', () => {
  it('disegna le due voci e segna quella attiva', () => {
    const html = renderToStaticMarkup(
      createElement(PanelTabs, { active: 'parametri', onPick: nulla }),
    )
    expect(html).toContain('Parametri')
    expect(html).toContain('Modello')
    expect(html).toContain('aria-selected="true"')
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm test -- dock`
Expected: FAIL — «Failed to resolve import ../src/components/PanelTabs.jsx».

- [ ] **Step 3: Crea `PanelTabs.jsx`**

```jsx
/**
 * Le due schede in cima al pannello mobile delle impostazioni.
 *
 * Esistono solo su mobile, dove la dock ha uno slot solo per due cose che su
 * desktop si aprono da due posti diversi. Il pannello parte dai Parametri
 * perché è quello che si ritocca spesso; il Modello si tocca una volta e poi
 * più, e paga il secondo tocco.
 *
 * Non fondono i due componenti: sono una striscia, e chi la disegna sceglie
 * quale dei due montare sotto.
 */
export default function PanelTabs({ active, onPick }) {
  const schede = [
    { key: 'parametri', label: 'Parametri' },
    { key: 'modello', label: 'Modello' },
  ]

  return (
    <div className="paneltabs" role="tablist" aria-label="Impostazioni">
      {schede.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          className={active === key ? 'paneltabs__tab is-active' : 'paneltabs__tab'}
          onClick={() => onPick(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Fai accettare `tabs` ai due pannelli**

In `src/components/EditorPanel.jsx`, riga ~299, cambia la firma:

```jsx
export default function EditorPanel({ merged, overrides, onOverridesChange, initialId, onClose, tabs }) {
```

e subito **dopo** la chiusura di `</header>` (la `panel__head`, riga ~333) inserisci:

```jsx
        {tabs}
```

In `src/components/SettingsModal.jsx`, riga ~29:

```jsx
export default function SettingsModal({ config, onChange, onClose, tabs }) {
```

e subito dopo la chiusura di `</header>` (riga ~160):

```jsx
        {tabs}
```

Su desktop `tabs` è `undefined` e React non disegna nulla: nessuna regressione.

- [ ] **Step 5: Monta il pannello in `App.jsx`**

Aggiungi, accanto ai blocchi `{editor && …}` e `{settingsOpen && …}`:

```jsx
      {/* Il pannello che la dock apre: una cosa sola con due schede, invece
          delle due voci separate che su desktop stanno in due posti diversi. */}
      {mobilePanel === 'parametri' && (
        <EditorPanel
          merged={merged}
          overrides={overrides}
          onOverridesChange={applyOverrides}
          initialId={null}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="parametri" onPick={setMobilePanel} />}
        />
      )}

      {mobilePanel === 'modello' && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="modello" onPick={setMobilePanel} />}
        />
      )}
```

Aggiungi l'import in cima a `App.jsx`:

```jsx
import PanelTabs from './components/PanelTabs.jsx'
```

- [ ] **Step 6: Lo stesso in `Landing.jsx`, e con due schede vere**

`Landing` ha già `settingsOpen` e monta `SettingsModal`. Deve avere **entrambe** le schede funzionanti come nei risultati, o la dock aprirebbe due pannelli diversi nelle due schermate — che è esattamente ciò che questo piano sta togliendo.

**6a.** Estendi la firma con le due props aggiunte nel Task 3:

```jsx
export default function Landing({
  destinations, agent, onAgentChange, onApply, onSkip, onLogout,
  phrase = '', favouritesCount = 0, compareCount = 0, hasResults = false,
  onList, onFavourites, onCompare,
  overrides = {}, onOverridesChange = () => {},
}) {
```

**6b.** Sostituisci `settingsOpen` (booleano) con lo stesso stato a tre valori che ha `App`. Cerca `const [settingsOpen, setSettingsOpen] = useState(false)` e mettici:

```jsx
  /* Quale scheda del pannello è aperta: 'parametri' | 'modello' | null.
     Come in App: è la dock ad aprirlo, e la dock è la stessa. */
  const [mobilePanel, setMobilePanel] = useState(null)
```

Poi aggiorna i tre punti che usavano `setSettingsOpen(true)` — l'`onConfigure` dell'`InterpreterPicker`, la voce del menu laterale `onOpenSettings`, e l'`onSettings` della dock del Task 3 — passando a `setMobilePanel('modello')` per i primi due e `setMobilePanel('parametri')` per la dock.

**6c.** Sostituisci il blocco `{settingsOpen && …}` con i due pannelli:

```jsx
      {mobilePanel === 'parametri' && (
        <EditorPanel
          merged={destinations}
          overrides={overrides}
          onOverridesChange={onOverridesChange}
          initialId={null}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="parametri" onPick={setMobilePanel} />}
        />
      )}

      {mobilePanel === 'modello' && (
        <SettingsModal
          config={agent}
          onChange={applyAgent}
          onClose={() => setMobilePanel(null)}
          tabs={<PanelTabs active="modello" onPick={setMobilePanel} />}
        />
      )}
```

**6d.** Aggiungi gli import mancanti in `Landing.jsx`:

```jsx
import EditorPanel from './EditorPanel.jsx'
import PanelTabs from './PanelTabs.jsx'
```

**Attenzione:** `EditorPanel` importa Leaflet nella sua catena? Verificalo con `grep -n "leaflet" src/components/EditorPanel.jsx src/components/DetailMap.jsx`. Se `EditorPanel` tira dentro la mappa, il mock `vi.mock('leaflet')` in `dock.test.js` copre già il caso — ma segnalalo nel report.

- [ ] **Step 7: Il CSS della striscia**

In `src/styles/app.css`, **fuori** dai media query (la striscia esiste solo dove viene montata, non serve limitarla per larghezza):

```css
/* Le due schede del pannello mobile delle impostazioni. */
.paneltabs {
  display: flex; gap: 4px;
  padding: 0 var(--container-margin) 8px;
  border-bottom: 1px solid var(--border);
}
.paneltabs__tab {
  padding: 8px 14px;
  border: 0; border-bottom: 2px solid transparent; background: none;
  color: var(--ink-2); font-size: 14px; font-weight: 500;
}
.paneltabs__tab.is-active {
  color: var(--primary); font-weight: 700;
  border-bottom-color: var(--primary);
}
```

- [ ] **Step 8: Esegui e verifica che passi**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/PanelTabs.jsx src/components/EditorPanel.jsx src/components/SettingsModal.jsx src/App.jsx src/components/Landing.jsx src/styles/app.css test/dock.test.js
git commit -F - <<'EOF'
Impostazioni contiene i parametri e il modello, in due schede

Su mobile la dock ha uno slot solo per due cose che su desktop si aprono da
due posti diversi. Il pannello parte dai Parametri, che si ritoccano spesso;
il Modello paga il secondo tocco, che è giusto per una cosa che si configura
una volta.

I due pannelli non sono stati fusi: accettano un nodo `tabs` che disegnano
sotto la testata, e su desktop è undefined. Nessuna regressione fuori dal
mobile.

Effetto collaterale utile: la configurazione non dipende più dall'hamburger,
che su mobile scorre via con la topbar.
EOF
```

---

## Task 5: La topbar torna chiara su mobile

**Files:**
- Modify: `src/styles/app.css:1191-1200` (blocco `.topbar` dentro `@media (max-width: 900px)`)
- Test: nessuno — è solo colore, e il render statico non vede il CSS. Si verifica a schermo (Step 3).

**Interfaces:** nessuna.

- [ ] **Step 1: Cambia il colore**

In `src/styles/app.css`, nel blocco `@media (max-width: 900px)`, la regola `.topbar` che oggi è:

```css
  .topbar {
    position: static;
    height: 48px;
    padding: 0 var(--container-margin);
  }
```

diventa:

```css
  /* Chiara come su desktop, e come la barra della home — che è già chiara e
     lo dichiara più in basso. La navy era eredità di un mockup: teneva le due
     schermate mobile con due intestazioni di colore diverso. */
  .topbar {
    position: static;
    height: 48px;
    padding: 0 var(--container-margin);
    background: var(--surface);
    color: var(--primary);
    border-bottom: 1px solid var(--border);
  }
  .topbar__brand { color: var(--primary); }
  .topbar__repo { color: var(--ink-2); }
  .topbar__repo:hover { background: var(--surface-2); color: var(--ink); }
```

- [ ] **Step 2: Aggiorna il commento ormai falso**

Poco sopra il `@media (min-width: 901px)` (~riga 1357) c'è: «Il mobile, sopra, non cambia: resta la topbar scura con la bottom nav.» Sostituiscilo con:

```css
   desktop del mockup (Ricerca, Dettaglio, Confronto, Editor). Il mobile ha
   ormai la stessa topbar chiara: qui restano solo le differenze di altezza e
   di bordo. */
```

- [ ] **Step 3: Guardala**

Run: `npm run dev`
Apri `http://localhost:5173`, riduci la finestra sotto i 900px, fai una ricerca. Verifica: intestazione chiara in **entrambe** le schermate, marchio leggibile, icona «Codice» leggibile, e sopra i 901px niente di cambiato.

- [ ] **Step 4: Commit**

```bash
git add src/styles/app.css
git commit -F - <<'EOF'
La topbar dei risultati smette di essere l'unica cosa scura

Era navy per eredità di un mockup, mentre la barra della home è chiara e lo
dichiara nel commento accanto. Due intestazioni di colore diverso nelle due
schermate della stessa app: la scura era l'eccezione, non la regola.
EOF
```

---

## Task 6: L'attesa — il faro grande sul velo

**Files:**
- Modify: `src/components/Logo.jsx` (due `className`)
- Modify: `src/components/Landing.jsx` (il blocco `{inCorso && …}`)
- Modify: `src/styles/app.css` (attesa, animazione, `prefers-reduced-motion`)
- Test: `test/dock.test.js` (aggiungi)

**Interfaces:**
- Consumes: `LogoMark` da `./Logo.jsx`
- Produces: niente

- [ ] **Step 1: Scrivi la prova che fallisce**

Aggiungi in `test/dock.test.js`:

```js
import { LogoMark } from '../src/components/Logo.jsx'

describe('il faro ha un appiglio per l’animazione', () => {
  it('la lanterna e i fasci hanno una classe propria', () => {
    const html = renderToStaticMarkup(createElement(LogoMark, {}))
    expect(html).toContain('logo__light')
    expect(html).toContain('logo__beams')
  })
})
```

- [ ] **Step 2: Esegui e verifica che fallisca**

Run: `npm test -- dock`
Expected: FAIL — nessuna delle due classi esiste.

- [ ] **Step 3: Dai le classi al marchio**

In `src/components/Logo.jsx`, dentro `LogoMark`:

```jsx
      <circle className="logo__light" cx="16" cy="12.2" r="1.7" fill="var(--accent)" stroke="none" />
```

e:

```jsx
        <g className="logo__beams" stroke="var(--accent)" strokeWidth="1.7">
```

Nient'altro cambia: senza CSS che le nomini, le classi non fanno niente e il marchio resta identico ovunque.

- [ ] **Step 4: Riscrivi il blocco d'attesa**

In `src/components/Landing.jsx`, sostituisci **tutto** il blocco `{inCorso && ( … )}`:

```jsx
      {/* In primo piano, non in un angolo: finché il modello non risponde non
          c'è niente da fare in questa schermata, e un'attesa da dieci secondi
          nascosta sotto il campo si legge come un clic andato a vuoto.
          Il riquadro bianco è sparito: il faro acceso dice già tutto quello
          che una scatola diceva col bordo. */}
      {inCorso && (
        <div className="overlay overlay--center overlay--veil attesa" role="presentation">
          <div className="attesa__box" role="dialog" aria-modal="true" aria-label="Interpretazione in corso">
            <LogoMark className="attesa__faro" width="72" height="72" />

            <p className="thinking thinking--lg" role="status" aria-live="polite">
              <span className="thinking__label">{frasi[frase]}</span>
              <span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
            </p>

            {/* Quale modello sta rispondendo, e perché in locale può metterci
                molto. Senza questa riga novanta secondi non sono lunghi:
                sembrano rotti. La frase dell'utente invece è sparita —
                l'ha scritta due secondi fa. */}
            <p className="attesa__meta">
              {profileLabel(interprete)} · {isLocalEndpoint(interprete?.baseUrl)
                ? 'in locale. La prima chiamata dopo l’avvio deve anche caricare il modello in memoria, e può metterci più di un minuto.'
                : 'endpoint remoto: la frase è uscita da questo computer.'}
            </p>

            <button type="button" className="btn btn--sm" onClick={annulla}>Annulla</button>
          </div>
        </div>
      )}
```

Verifica che `LogoMark` sia importato in `Landing.jsx`; se non lo è, aggiungi `import { LogoMark } from './Logo.jsx'`.

- [ ] **Step 5: Il CSS dell'attesa**

In `src/styles/app.css`, sostituisci le regole `.thinkbox`, `.thinkbox__phrase` e `.thinkbox__meta` (~righe 1906-1919) con:

```css
/* L'attesa: velo, faro, frase. Niente scatola. */
.attesa__box {
  display: flex; flex-direction: column; align-items: center;
  gap: 16px; padding: 24px; max-width: 420px; text-align: center;
}
.attesa__meta { margin: 0; font-size: 11px; line-height: 16px; color: var(--ink-3); }

/* La lanterna respira: opacità e alone, ciclo lento. Nessuna rotazione — un
   raggio che gira si legge come spinner, e uno spinner promette avanzamento.
   È lo stesso motivo per cui la frase d'attesa è ferma e non scorre. */
.attesa__faro .logo__light { animation: faro 2s ease-in-out infinite; transform-origin: 16px 12.2px; }
.attesa__faro .logo__beams { animation: faro-fasci 2s ease-in-out infinite; }

@keyframes faro {
  0%, 100% { opacity: 0.55; filter: none; }
  50%      { opacity: 1; filter: drop-shadow(0 0 4px var(--accent)); }
}
@keyframes faro-fasci {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 1; }
}
```

Poi, nel blocco `@media (prefers-reduced-motion: reduce)` che contiene già `.thinking__dots i { animation: none; … }` (~riga 1930), aggiungi:

```css
  /* Il faro resta acceso, smette solo di respirare: un faro spento non è un
     faro, ma nemmeno una luce che pulsa a chi ha chiesto meno movimento. */
  .attesa__faro .logo__light,
  .attesa__faro .logo__beams { animation: none; opacity: 1; }
```

- [ ] **Step 6: Cerca riferimenti rimasti**

Run: `grep -rn "thinkbox" src/`
Expected: nessun risultato. Se ne restano, sono classi orfane: rimuovile.

- [ ] **Step 7: Esegui e verifica che passi**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Guardala davvero**

Run: `npm run dev`
Configura un modello (o usa le regole), invia una frase e guarda l'attesa: faro grande, lanterna che pulsa, frase coi puntini, riga del modello, Annulla. Poi attiva la riduzione del movimento nel sistema e ricontrolla: faro acceso e fermo.

- [ ] **Step 9: Commit**

```bash
git add src/components/Logo.jsx src/components/Landing.jsx src/styles/app.css test/dock.test.js
git commit -F - <<'EOF'
Il faro si accende mentre lo strumento cerca

Via il riquadro bianco, resta il velo: al centro il marchio grande con la
lanterna che respira. È l'unica animazione che dice qualcosa di vero —
Logo.jsx stabilisce già che l'ambra è la luce e che un faro spento non è un
faro.

Nessuna rotazione: un raggio che gira si legge come spinner, e uno spinner
promette avanzamento. È lo stesso motivo per cui le frasi d'attesa erano
state congelate invece di farle scorrere.

Sparisce la frase dell'utente fra virgolette, scritta due secondi prima.
Resta la riga che nomina il modello e avverte del primo caricamento in
locale: senza quella, novanta secondi sembrano un blocco.

La pulsazione si spegne sotto prefers-reduced-motion, dove i tre puntini si
fermavano già.
EOF
```

---

## Task 7: Verifica finale

**Files:** nessuno — è solo verifica.

- [ ] **Step 1: Tutta la batteria**

Run: `npm test`
Expected: PASS su tutti i file di `test/`.

- [ ] **Step 2: La build**

Run: `npm run build`
Expected: nessun errore, nessun avviso su import non risolti.

- [ ] **Step 3: A mano, sotto i 900px**

Run: `npm run dev`, finestra sotto i 900px.

- [ ] Prima apertura: dock presente, tre slot spenti, centro acceso
- [ ] Il centro dice «Cerca» senza modello e «Chiedi» con un modello configurato
- [ ] Scrivere una frase e premere il centro fa la ricerca
- [ ] Nei risultati: il centro riporta al campo **con la frase dentro**
- [ ] Impostazioni apre il pannello sui Parametri, la scheda Modello funziona
- [ ] Preferiti e Confronta si accendono quando hanno qualcosa
- [ ] L'ultima card non finisce sotto la barra, in **entrambe** le schermate
- [ ] Intestazione chiara in entrambe
- [ ] Il disco centrale sporge e non è tagliato dal bordo

- [ ] **Step 4: Sopra i 901px, che è quello che non deve cambiare**

- [ ] Nessuna dock
- [ ] Topbar identica a prima
- [ ] Parametri e Impostazioni si aprono da dove si aprivano, **senza** striscia di schede

- [ ] **Step 5: Aggiorna la spec e commita**

Aggiungi in fondo a `docs/superpowers/specs/2026-08-03-dock-mobile-e-attesa-design.md`:

```markdown
---

## Stato

Implementata, piano in `docs/superpowers/plans/2026-08-03-dock-mobile-e-attesa.md`.
```

```bash
git add docs/superpowers/specs/2026-08-03-dock-mobile-e-attesa-design.md
git commit -m "La spec della dock è implementata"
```

---

## Task 8: Il centro diventa «+», la freccia torna nel composer

> **Revisione decisa il 2026-08-03**, dopo aver visto i Task 1-3 a schermo. Va
> eseguito **prima** del Task 7. Non annulla i tre task precedenti: corregge in
> avanti. La motivazione sta nel §4 della spec, riscritto.

**Files:**
- Modify: `src/components/BottomNav.jsx` (lo slot centrale e la firma)
- Modify: `src/App.jsx` (il blocco `<BottomNav>`)
- Modify: `src/components/Landing.jsx` (freccia ripristinata, `<BottomNav>`)
- Modify: `test/dock.test.js` (le asserzioni sul centro)

**Interfaces:**
- Produces: la firma definitiva di `BottomNav`, usata dai Task 4-7:

```js
BottomNav({
  onlyFavourites, favouritesCount, compareCount, hasResults,
  onNew,           // () => void  — sostituisce onAsk
  newDisabled,     // bool        — sostituisce askDisabled
  onList, onFavourites, onCompare, onSettings,
})
```
  Spariscono `askLabel` e `askDisabled`: il centro non cambia più nome.

- [ ] **Step 1: Aggiorna le prove**

In `test/dock.test.js`:

**1a.** Nel `describe` di `BottomNav`, sostituisci le prove che parlano di `askLabel` con:

```js
  it('il centro è «Nuova» e non cambia nome', () => {
    const html = dock()
    expect(html).toContain('Nuova')
    expect(html).not.toContain('Chiedi')
    expect(html).not.toContain('Cerca')
  })

  it('il centro è spento quando non c’è niente da azzerare', () => {
    expect(spento(dock({ newDisabled: true }), 'Nuova')).toBe(true)
    expect(spento(dock({ newDisabled: false }), 'Nuova')).toBe(false)
  })
```

Aggiorna anche l'oggetto `base` in cima al file: togli `askLabel` e `askDisabled`, metti `onNew: nulla, newDisabled: false`. E nella prova «cinque voci» sostituisci `'Chiedi'` con `'Nuova'`.

**1b.** La prova del giro di correzione precedente asseriva su `Chiedi`/`Cerca` via `AGENT_KEY`: non ha più senso, il centro non nomina più l'interprete. Sostituiscila con questa, che copre `newDisabled` — l'unica cosa che questo task rende osservabile nel markup statico:

```js
  it('sulla home vergine il centro è spento, nei risultati no', () => {
    expect(spento(renderToStaticMarkup(createElement(App)), 'Nuova')).toBe(true)
    expect(spento(renderToStaticMarkup(createElement(App, { startedInitially: true })), 'Nuova')).toBe(false)
  })
```

Se l'import di `AGENT_KEY` e il blocco `afterEach` che lo ripulisce restano senza usi, rimuovili.

**1c.** Il Task 3 aveva asserito che `landing__send` fosse sparito. Inverti:

```js
  it('il composer ha di nuovo la sua freccia', () => {
    expect(renderToStaticMarkup(createElement(App))).toContain('landing__send')
  })
```

- [ ] **Step 2: Esegui e verifica che falliscano**

Run: `npm test -- dock`
Expected: FAIL — «Nuova» non esiste, `landing__send` non c'è più.

- [ ] **Step 3: Il centro in `BottomNav.jsx`**

Sostituisci l'import delle icone e lo slot centrale. L'import diventa:

```jsx
import { IconHeart, IconList, IconPlus, IconScale, IconSettings } from './Icons.jsx'
```

La firma:

```jsx
export default function BottomNav({
  onlyFavourites, favouritesCount, compareCount, hasResults = true,
  onNew, newDisabled = false,
  onList, onFavourites, onCompare, onSettings,
}) {
```

E il blocco centrale, al posto di quello che calcolava `AskIcon`:

```jsx
      <button
        type="button"
        className="bottomnav__ask"
        disabled={newDisabled}
        onClick={onNew}
      >
        <span className="bottomnav__askdisc">
          <IconPlus width="26" height="26" />
        </span>
        Nuova
      </button>
```

Sostituisci anche il commento in cima al componente, che parla di un invio che non c'è più:

```jsx
/**
 * La barra inferiore, identica nelle due schermate.
 *
 * Cinque slot, e quello di mezzo non è un sesto tab: è il «ricomincia», e
 * sporge sopra il bordo perché è l'unico modo di dire "questo non è come gli
 * altri quattro" senza scriverlo.
 *
 * Non è l'invio, ed è stata una scelta rivista: da invio, il centro
 * significava "manda" sulla ricerca e "riapri il composer" nei risultati —
 * un pulsante, due gesti. Così invece la dock è tutta navigazione, e la
 * freccia sta nel composer, dove qualunque interfaccia a prompt la mette.
 *
 * `hasResults` è falso solo alla prima apertura, prima che una ricerca esista:
 * Elenco, Preferiti e Confronta lavorano tutti sul ranking, e senza ranking non
 * hanno niente da mostrare. Restano visibili e spenti invece di sparire —
 * una dock che cambia forma fra le due schermate non sarebbe più la stessa
 * dock, che è tutto il motivo per cui esiste così.
 */
```

- [ ] **Step 4: Il collegamento in `App.jsx`**

Nel blocco `<BottomNav>`, sostituisci le tre righe del centro:

```jsx
        /* Nuova ricerca vuol dire anche azzerare la frase: altrimenti quella
           vecchia resterebbe attaccata ai risultati nuovi. È lo stesso gesto
           della voce omonima nel menu laterale. */
        onNew={() => { setPhrase(''); setStarted(false) }}
        newDisabled={false}
```

togliendo `askLabel` e `askDisabled`. Se `agentIsReady` resta senza usi in `App.jsx`, rimuovilo dall'import.

- [ ] **Step 5: La freccia torna in `Landing.jsx`**

**5a.** Dentro `.landing__boxbar`, dopo l'`<InterpreterPicker …/>`, rimetti il pulsante d'invio:

```jsx
                {/* Freccia sola: l'etichetta la dà il tooltip. Il gesto è
                    quello di qualunque campo prompt, e non ha bisogno di
                    essere spiegato ogni volta che guardi la schermata. */}
                <button
                  type="submit"
                  className="btn btn--primary landing__send"
                  title="Invia prompt"
                  aria-label="Invia prompt"
                  disabled={conModello ? !text.trim() : parsed.empty}
                >
                  <IconArrowUp width="20" height="20" />
                </button>
```

Verifica che `IconArrowUp` sia importato; se il Task 3 l'aveva tolto, rimettilo.

**5b.** Nel blocco `<BottomNav>` di `Landing`, sostituisci le tre righe del centro:

```jsx
        /* Svuota il campo e ci riporta il cursore: è lo stesso gesto della
           voce «Nuova ricerca» del menu laterale, ora a portata di pollice. */
        onNew={() => {
          setText('')
          setErroreModello('')
          document.getElementById('landing-q')?.focus()
        }}
        /* Niente da azzerare: campo vuoto e nessun ranking alle spalle. */
        newDisabled={!text.trim() && !hasResults}
```

**5c.** `submit` era stato reso tollerante a essere chiamato senza evento (`e?.preventDefault?.()`). Lascialo così: non fa male, e il `<form>` lo chiama comunque con l'evento.

- [ ] **Step 6: Esegui e verifica che passino**

Run: `npm test`
Expected: PASS su tutta la batteria.

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomNav.jsx src/App.jsx src/components/Landing.jsx test/dock.test.js
git commit -F - <<'EOF'
Il centro della dock diventa «+», e la freccia torna dove la si cerca

Da invio, il centro significava due cose: «manda» sulla ricerca e «riapri il
composer» nei risultati. Un pulsante, due gesti, e la parentela fra i due la
vedeva solo chi aveva scritto il codice.

Adesso è «+ nuova ricerca» e vuol dire la stessa cosa ovunque: la dock è
tutta navigazione, cinque slot che rispondono a «dove vado» e nessuno che
fa. La freccia d'invio torna nel composer, dove qualunque interfaccia a
prompt la mette.

Il prezzo è dichiarato nella spec: sulla schermata di ricerca il pulsante
più grande compie l'azione meno frequente, e ritoccare una frase adesso
passa dalla cronologia invece che da un tocco.
EOF
```

---

## Cosa questo piano non fa

- **La cronologia resta dietro l'hamburger che scorre via.** È il limite noto del §7 della spec, accettato consapevolmente per non allargare la dock a sei slot. Se si presenterà nell'uso, la strada è rendere `.topbar` sticky su mobile — non aggiungere una voce.
- **Nessun test di comportamento.** `renderToStaticMarkup` non esegue effetti né gestori: si prova che il markup contenga ciò che deve. I clic si verificano a mano nel Task 7. Aggiungere jsdom per questo sarebbe una dipendenza nuova per una schermata sola.
