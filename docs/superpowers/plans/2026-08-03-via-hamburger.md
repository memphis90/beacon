# Via l'hamburger da mobile — Piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Sotto i 901px la barra laterale sparisce, e tutte le sue voci hanno un altro posto — nessuna funzione persa.

**Architecture:** Nessun componente nuovo. `SideRail` e i due pulsanti che la aprono vengono nascosti sotto i 901px; le tre voci non ancora ricollocate trovano posto nella dock, nel pannello Impostazioni e in linea sotto il composer della home. Nessuna modifica sopra i 901px.

**Tech Stack:** React 19, Vite 7, Vitest 3. Nessuna dipendenza nuova. Le prove usano `renderToStaticMarkup` — non c'è jsdom e non va aggiunto.

## Global Constraints

- **Sopra i 901px non cambia niente.** La barra laterale resta esattamente com'è: colonna permanente sulla home, cassetto sui risultati. Ogni regola CSS di questo piano vive dentro `@media (max-width: 900px)`.
- **Spec di riferimento:** `docs/superpowers/specs/2026-08-03-risultati-mobile-design.md`, §2 («Niente hamburger, su nessuna schermata») e §6 («La home su mobile»). In caso di conflitto vince la spec.
- **Nessuna funzione può restare irraggiungibile.** È il criterio che decide se questo piano è finito: dopo, ogni voce che stava nel menu deve avere una strada su mobile.
- **Nessuna dipendenza nuova**, niente jsdom. Prove con `renderToStaticMarkup` e gli helper `bottone(html, etichetta)` e `spento(html, etichetta)` già in `test/dock.test.js`.
- **Colori e misure dai token** di `src/styles/tokens.css`. Nessun esadecimale scritto a mano.
- **Testo in italiano.** I commenti spiegano il perché, non il cosa.
- **Commit su `master`**, prosa italiana, nessun prefisso tipo `feat:`.

---

## Task 1: «Elenco» diventa anche «Scopri le destinazioni»

Prima di togliere l'hamburger va acceso ciò che lo sostituisce, o si resta un commit con la funzione irraggiungibile.

**Files:**
- Modify: `src/components/BottomNav.jsx` (icona dello slot)
- Modify: `src/components/Landing.jsx` (`onList` e il suo stato disattivo)
- Modify: `test/dock.test.js`

- [ ] **Step 1: L'icona diventa quella del menu laterale**

In `BottomNav.jsx`, lo slot `list` usa `IconList`. La barra laterale usa `IconPin` per «Scopri le destinazioni» (`SideRail.jsx:152`). Sono la stessa azione, e due icone diverse per la stessa cosa sono due cose per chi guarda: passa a `IconPin` e aggiorna l'import.

Lascia l'etichetta «Elenco»: è corta e vale in entrambe le schermate.

- [ ] **Step 2: Sulla home lo slot è sempre acceso**

Oggi in `Landing` lo slot è spento con `hasResults` falso. Ma lì «Elenco» significa «sfoglia tutto», che è il percorso `onSkip` e **non ha bisogno di risultati preesistenti**. `App` gli passa già `onList` che porta ai risultati; serve che porti a `onSkip` quando un ranking non c'è ancora.

Nei risultati il comportamento resta legato a `hasResults` come oggi.

- [ ] **Step 3: La prova**

Sulla home vergine, `Elenco` non dev'essere spento. È l'inverso di una prova esistente, che va aggiornata invece che affiancata.

- [ ] **Step 4: `npm test` verde, poi commit**

---

## Task 2: L'azzeramento dei dati entra nel pannello Impostazioni

**Files:**
- Modify: `src/components/SettingsModal.jsx` (in fondo al corpo)
- Modify: `src/App.jsx` e `src/components/Landing.jsx` (passaggio della funzione)
- Modify: `test/dock.test.js`

- [ ] **Step 1: Dov'è oggi**

`onLogout` arriva a `SideRail` e chiama `azzera()` in `App.jsx`. Non è un logout: cancella criteri, preferiti e cronologia da questa macchina, con una conferma.

- [ ] **Step 2: Spostarlo**

`SettingsModal` accetta una prop `onReset` opzionale e, quando c'è, disegna in fondo al `panel__body` una sezione separata con l'azione e la spiegazione di cosa cancella. Va **in fondo**, visivamente distinta: è l'unica azione distruttiva dell'applicazione, e deve stare dove la si cerca apposta, non dove ci si inciampa. La conferma esistente resta.

Passala da `App` e da `Landing`. Su desktop la voce resta **anche** nella barra laterale: lì non sparisce niente.

- [ ] **Step 3: La prova**

Che il pannello Modello contenga l'azione di azzeramento quando `onReset` è passata, e non la contenga quando non lo è.

- [ ] **Step 4: `npm test` verde, poi commit**

---

## Task 3: La cronologia in linea sotto il composer

È la parte grossa: senza, togliere l'hamburger fa perdere l'unica strada per ritoccare una frase.

**Files:**
- Modify: `src/components/Landing.jsx`
- Modify: `src/styles/app.css`
- Modify: `test/dock.test.js`

- [ ] **Step 1: Il caso vuoto e il caso pieno**

Sotto il composer la home mostra oggi quattro frasi d'esempio (`ESEMPI`). Diventano il **caso vuoto**: si vedono solo quando la cronologia è vuota. Appena esiste una cronologia, al loro posto compare l'elenco verticale scorrevole delle ricerche recenti.

| stato | sotto il composer |
|---|---|
| cronologia vuota | le quattro frasi d'esempio |
| cronologia piena | le ricerche recenti |

- [ ] **Step 2: Ogni voce riprende la ricerca**

Toccare una voce chiama `riprendi(entry)` (`Landing.jsx:172`), che riempie il campo lasciando ritoccare. È già scritta e già usata dal menu laterale: riusala, non riscriverla.

Mostra per ogni voce il testo della ricerca e da quanto tempo (`timeAgo` da `../lib/history.js`, già usata in `SideRail`).

- [ ] **Step 3: Solo su mobile**

Su desktop la cronologia resta nella barra laterale, che lì è una colonna permanente. L'elenco in linea è mobile: la regola che lo mostra sta dentro `@media (max-width: 900px)`.

- [ ] **Step 4: Le prove**

Con cronologia vuota compaiono gli esempi e non l'elenco; con cronologia piena l'inverso, e il testo di una voce compare nel markup.

- [ ] **Step 5: `npm test` verde, poi commit**

---

## Task 4: Via l'hamburger e la barra laterale

Solo adesso, quando niente resta orfano.

**Files:**
- Modify: `src/styles/app.css`
- Modify: `test/dock.test.js`

- [ ] **Step 1: Nascondere i due pulsanti**

`.topbar__menu` (`App.jsx:357`) e `.landing__menu` (`Landing.jsx:212`) oggi sono nascosti **sopra** i 901px — cioè sono elementi solo-mobile. Va invertito: `display: none` sotto i 901px, visibili sopra.

Attenzione: cerca **tutte** le regole che li riguardano prima di scrivere, ce n'è più di una e sono in blocchi diversi (`app.css:1501` e `:2378` fra le altre).

- [ ] **Step 2: Nascondere anche il cassetto**

Non basta togliere il pulsante. `SideRail` e il suo velo (`drawer-scrim`) vanno nascosti sotto i 901px: un cassetto che nessuno può aprire col dito resta raggiungibile col tab da tastiera, e diventa una trappola per il focus invece di un elemento invisibile.

Se `display: none` sul contenitore basta a toglierlo dal flusso del focus, è sufficiente; verificalo e scrivilo nel rapporto.

- [ ] **Step 3: Il marchio prende il posto della scritta**

Sulla home, `Landing.jsx:193` disegna `<div className="landing__brand">Beacon</div>`. Sotto i 901px va sostituito dal marchio `LogoMark` (`./Logo.jsx`). Sopra i 901px resta la scritta.

Il faro vive in cima alla barra laterale: senza hamburger quella barra non si apre, e il marchio resterebbe irraggiungibile su mobile. Portandolo qui si recupera.

- [ ] **Step 4: La prova**

Che sotto i 901px nessuna delle due schermate esponga il pulsante del menu. Attenzione: `renderToStaticMarkup` non vede il CSS, quindi una prova sul markup **non** può verificare un `display: none`. O si nasconde in JSX invece che in CSS, o la prova verifica altro e il resto va nella lista manuale — decidi tu e **dichiara quale delle due hai fatto**, senza scrivere una prova che finge di coprire ciò che non copre.

- [ ] **Step 5: `npm test` verde, `npm run build` pulito, poi commit**

---

## Verifica a schermo

Non copribile dalle prove. Da aggiungere alla lista in `2026-08-03-verifica-a-schermo.md`:

- sotto i 900px, in **entrambe** le schermate, nessun pulsante di menu e nessun cassetto raggiungibile col tab da tastiera
- sulla home vergine, `Elenco` è **acceso** e porta a sfogliare tutte le destinazioni
- la cronologia compare sotto il campo appena esiste, e toccarne una riempie il campo con quella frase
- l'azzeramento dei dati si raggiunge da Impostazioni, e la conferma funziona
- sopra i 901px la barra laterale è esattamente quella di prima, in entrambe le schermate

---

## Cosa questo piano non fa

Il resto della spec dei risultati — barra unica in cima, suggeritore AI in linea, card più basse — resta da fare. Questo piano tocca solo ciò che serve a far sparire l'hamburger senza perdere funzioni.
