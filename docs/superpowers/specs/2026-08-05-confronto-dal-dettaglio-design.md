# Il confronto si compone dal dettaglio — Design

> Rivede una decisione presa e implementata la mattina del 2026-08-05, nella
> spec `2026-08-05-card-compatta-mobile-design.md`: la fisarmonica che al
> tocco mostrava «Dettaglio» e «Confronta» dentro la card.
>
> Quella spec resta valida in tutto il resto — la card a 110px, le tre colonne,
> il clima fuori, il `+N tema` sulla riga del paese. Cambia **come si esce
> dalla card**, e dove si compone il confronto.

---

## 1. Perché la fisarmonica se ne va

Era stata scelta sapendo il suo prezzo, ed è scritto nel §3 di quella spec:
aprire il dettaglio passava **da uno a due tocchi**, e il dettaglio è l'azione
più frequente della schermata.

Vista a schermo, quel prezzo non vale il ricavo. La riga rivelata conteneva due
bottoni: «Dettaglio», che duplicava il gesto appena fatto per farlo comparire, e
«Confronta», che è l'unica azione che aveva davvero bisogno di un posto — e che
un posto migliore ce l'ha.

Restano quindi due mosse, e sono indipendenti:

- il tocco sulla card **apre il dettaglio**, come in qualunque lista
- il confronto **si compone dal dettaglio**, con un autocomplete

---

## 2. La card compatta perde lo stato aperto

Si smontano: la classe `card--aperta`, le props `aperta` / `onApri`, lo stato
`apertaId` in `App` e il suo azzeramento, e tutte le regole CSS dello stato
aperto.

### Il bottone sovrapposto resta, e cambia mestiere

Non torna un `onClick` sull'`<article>`. La ragione è la stessa di stamattina e
non è cambiata: un articolo cliccabile non esiste per la tastiera e non si
annuncia a un lettore di schermo.

Il bottone perde `aria-expanded`, prende `onOpen`, e l'etichetta diventa
«Apri la scheda di Lisbona». Fa una cosa sola, e la dice.

### Su mobile spariscono tutti e due i bottoni in fondo

| bottone | perché esce |
|---|---|
| **Dettaglio** | duplica il tocco sulla card |
| **Confronta** | trasloca nel dettaglio (§3) |

`.card__actions` resta quindi `display: none` sotto i 901px, senza più la
controparte `.card--aperta` che lo riaccendeva.

### L'asse guida resta fuori dalla card

Sulla card compatta `ScoreBreakdown` continua a essere montato con la
didascalia spenta. La riga «Asse guida Cultura 18,4 pt» vive **solo nel
dettaglio**.

> **Il costo, dichiarato.** È la riga che il §5 del planning usa per
> identificare l'asse responsabile di un totale. In classifica resta la barra a
> otto segmenti, che dice il livello di ogni asse ma non quale ha vinto. La
> diagnosi è a un tocco — e ora è a *un* tocco, non a due, che è il motivo per
> cui questo scambio conviene.

---

## 3. Il confronto si compone dal dettaglio

### Cosa c'è già

`DetailPanel` riceve `inCompare` e `onCompare` (`App.jsx:613-614`) e mostra un
bottone «Aggiungi al confronto» (`DetailPanel.jsx:250`). Il tetto è quattro
(`MAX_COMPARE`, `App.jsx:41`).

Quindi la novità non è «il confronto nel dettaglio»: è **scegliere con chi**,
senza tornare in classifica a cercarle una per una.

### La sezione

```
┌──────────────────────────────────┐
│ Confronta                        │
│ ┌──────────┐ ┌──────────┐        │
│ │ Lisbona  │ │ Porto  × │        │
│ └──────────┘ └──────────┘        │
│ ┌──────────────────────────────┐ │
│ │ 🔍 Aggiungi una destinazione…│ │
│ ├──────────────────────────────┤ │
│ │ Siviglia    Spagna · città   │ │
│ │ Sintra      Portogallo · area│ │
│ └──────────────────────────────┘ │
│ [ Apri il confronto ]            │
└──────────────────────────────────┘
```

- **La destinazione aperta è la prima e non si toglie.** È la scheda che stai
  guardando: un confronto che non la contiene non è il confronto di questa
  scheda. Il suo chip non ha la ×.
- **Le aggiunte sono chip removibili**, fino a tre — il tetto resta quattro.
- **L'autocomplete filtra le 158 in memoria** su nome e paese. Nessuna rete,
  nessun indice: è un `filter` su un array che sta già nello stato.
- Escluse dai suggerimenti: la destinazione aperta e quelle già aggiunte.
- Raggiunto il tetto, il campo si disabilita e lo dice.

### Niente combobox ARIA finto

Un campo di testo e una lista di **bottoni veri**. Un `role="combobox"` fatto a
metà — senza `aria-activedescendant` coerente, senza la gestione delle frecce,
senza annuncio del numero di risultati — è peggio che non averlo: promette a un
lettore di schermo un comportamento che poi non trova.

Il campo filtra, la lista è navigabile col Tab come qualunque lista di bottoni,
Invio attiva. È meno raffinato e funziona.

### «Apri il confronto»

Porta al pannello del confronto, che resta esattamente quello di oggi. Questa
spec cambia **come le destinazioni ci entrano**, non come si guarda il
risultato.

---

## 4. Il selettore esiste solo sotto i 901px

> **Corretto il 2026-08-05**, poco dopo l'implementazione. La prima versione di
> questa sezione lo metteva a ogni larghezza, dichiarandolo come aggiunta
> innocua. Non lo era: su desktop diventava il **terzo** modo di aggiungere al
> confronto, accanto al bottone sulla card e a quello nel piede del dettaglio.

Sotto i 901px vive il selettore. Sopra, restano i due comandi di sempre — il
bottone «Confronta» sulla card e «Aggiungi al confronto» nel piede del
dettaglio — ed è esattamente com'era prima di questo lavoro.

Le due forme convivono nel markup e si escludono nel CSS, con le classi
`section--solomobile` e `btn--solodesktop`. È lo stesso schema del chip del
tipo e della sua coda sulla riga del paese: due forme dello stesso comando, mai
visibili insieme.

> **Conseguenza da non perdere di vista:** il piede del dettaglio riprende il
> bottone che questo lavoro gli aveva tolto. Sopra i 901px il dettaglio torna
> quindi identico a prima, selettore a parte — che lì non c'è.

**Lo slot «Confronta» della dock resta com'è**: apre il pannello, spento finché
il confronto è vuoto.

---

## 5. Cosa cade della spec di stamattina

| punto | stato |
|---|---|
| §3 «Lo stato aperto» | **cade** per intero |
| §3 «Una sola aperta per volta» | **cade** |
| §3 «Il costo, dichiarato: due tocchi» | **cade** — torna a un tocco |
| §2 la card a 110px, tre colonne | resta |
| §2 il clima fuori | resta |
| §2 il `+N tema` sulla riga del paese | resta |
| §2 il rango legato all'ordinamento | resta |

Cadono anche le prove sullo stato aperto in `test/card-compatta.test.js` e i
punti **28-31** e **33-34** della lista di `2026-08-03-verifica-a-schermo.md`.

---

## 6. Come si prova

Con `renderToStaticMarkup`, come sempre:

- la card non porta più `card--aperta` in nessun caso, e il bottone sovrapposto
  non ha `aria-expanded`
- il bottone sovrapposto porta l'etichetta «Apri la scheda di …»
- il dettaglio contiene il chip della destinazione aperta, **senza** ×
- con due destinazioni nel confronto, il dettaglio mostra due chip e il secondo
  ha la ×
- al tetto di quattro, il campo dell'autocomplete è `disabled`
- il filtro dell'autocomplete è una funzione pura e si prova da sola: nome,
  paese, esclusione delle già presenti

A occhio, perché il render statico non esegue gli effetti:

- il tocco sulla card apre il dettaglio, a un tocco
- scrivere nel campo filtra la lista, e sceglierne una aggiunge il chip
- la × toglie il chip, e quello della destinazione aperta non ce l'ha
- **sopra i 901px le card sono ancora quelle di prima**, coi due bottoni

---

## 7. Fuori perimetro

Il pannello del confronto e le sue righe. Il modello dati, lo scoring, i filtri
duri. La Fase 2 sul tempo di volo, decisa a parte e non ancora scritta.
