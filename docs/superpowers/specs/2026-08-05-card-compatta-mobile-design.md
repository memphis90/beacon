# Card compatta nella classifica mobile — Design

> Riguarda **solo il mobile** (sotto i 901px), e dentro il mobile solo la card
> della classifica. Sopra quella soglia non cambia niente.
>
> Chiude il §4 della spec `2026-08-03-risultati-mobile-design.md` — «card più
> basse» — che è rimasto sulla carta: dei suoi obiettivi non è stato
> implementato nulla, e il §1 qui sotto lo misura.

---

## 1. Il problema: la card mobile è la card desktop

Nei blocchi `@media (max-width: 900px)` di `app.css` esiste **una sola** regola
che tocca la card:

```css
.card__fav { width: 44px; height: 44px; }   /* app.css:1393 */
```

Tutto il resto è identico al desktop. Sommando la geometria reale — immagine
alta `192px` (`app.css:505`), corpo con `--card-inset: 1rem` e quattro
`--stack-gap: 0.75rem`, bottoni a `min-height: 44px` su mobile
(`app.css:1389`) — una card sta attorno ai **450px**.

Su 390×844, tolte la fascia in alto (~100px) e la dock (`--bottomnav-h: 64px`),
restano ~680px utili: **una card e mezza**.

L'obiettivo dichiarato dal §4 dell'altra spec erano tre punteggi leggibili
insieme, e non è un vezzo grafico: è il §9 del planning, che valida la Fase 0
solo se — quando il ranking contraddice il giudizio — si riesce a identificare
l'asse responsabile. Confrontare 88, 85 e 91 richiede di vederli insieme.

---

## 2. La card compatta

**110px.** Padding 12 sopra e sotto, quindi 86px di contenuto, in tre colonne.

```
┌────────────────────────────────────────┐
│ ┌──────┐  Lisbona              ♡      │
│ │  1º  │  Portogallo · città           │
│ │ foto │  92–150 €              88     │
│ └──────┘  a persona · 5 notti  ▁▃▅▂    │
│           volo escluso                 │
└────────────────────────────────────────┘
```

| colonna | contenuto | altezza |
|---|---|---|
| sinistra, 80px | miniatura quadrata; rango `1º` sovrapposto in alto a sinistra | 80 |
| centro, elastica | nome (22) · `paese · tipo` (16) · fascia di costo (20) · nota (14), più i gap | ~80 |
| destra, 64px | cuore (44, touch target) · punteggio (28) · barra dei contributi (6) | 82 |

Tutte e tre stanno negli 86px disponibili.

**Quante se ne vedono.** Con `gap` di 8px fra le card, sei card occupano 700px
contro i ~680 disponibili: **cinque intere e la sesta quasi tutta**. È il triplo
di adesso, e soddisfa il requisito dei tre punteggi insieme con margine largo.

### Cosa esce dalla card

Le **due caselle del clima** — temperatura dell'aria e del mare
(`DestinationCard.jsx:74-87`). Sono l'unica cosa che si toglie.

Si toglie **dalla vista mobile, con il CSS**, non dal markup: sopra i 901px le
caselle restano quelle di oggi. `display: none` le leva anche dall'albero di
accessibilità, quindi non è una sparizione solo visiva. La conseguenza pratica
è che le prove non possono affermare «il markup non contiene il clima» — la
verifica di questo punto è a occhio, e sta nel §5.

> **Il costo, dichiarato.** Il mare è un filtro duro del §5 del planning: una
> destinazione di mare entra in classifica *perché* a quel mese l'acqua è
> abbastanza calda. Tolta la casella, il motivo per cui ci è entrata non si
> vede più in classifica e resta solo nel dettaglio. È una perdita reale, ed è
> stata accettata sapendolo: la densità la paga con l'unico dato della card che
> non è né identità, né prezzo, né punteggio.

### Cosa resta, e dove

| elemento | oggi | nella card compatta |
|---|---|---|
| miniatura | fascia alta 192px | quadrato 80×80 a sinistra |
| rango `1º` | sovrapposto all'immagine | angolo alto-sinistra della miniatura |
| nome | riga propria | invariato |
| paese | bandiera + nome del paese | `paese · tipo`, una riga sola |
| tipo (`città`/`area`/`isola`) | chip sull'immagine | accorpato alla riga sopra |
| fascia di costo | riquadro con etichetta «Costo stimato» | numero nudo, senza etichetta |
| nota `a persona · N notti · volo escluso` | tre righe | una riga su due capi, 10px |
| punteggio | pillola sull'immagine | colonna destra, 28px |
| barra dei contributi | sotto «Interessi» | colonna destra, sotto il punteggio |
| cuore | sull'immagine | alto a destra della card |
| `+N tema` | dentro la pillola del punteggio | in coda alla riga `paese · tipo`, in ambra |
| clima | due caselle | **rimosso** (vedi sopra) |
| Dettaglio / Confronta | sempre visibili | solo nello stato aperto (§3) |

### Perché il `+N tema` va sulla riga del paese

È l'unico posto che non costa altezza. Sotto la barra dei contributi
servirebbero ~14px, spesi su **tutte** le card per servirne poche, e sei card
diventerebbero cinque. La riga `paese · tipo` esiste già, ha spazio a destra, e
il colore ambra la distingue senza aggiungere un rigo.

Resta un'aggiunta esplicita e leggibile, come vuole il §5: una risalita di otto
punti continua ad avere una ragione scritta accanto al punteggio.

### La barra dei contributi non cambia semantica

`ScoreBreakdown` resta quello che è: **un segmento per asse, sempre otto,
sempre nello stesso ordine**, colore per banda (alto ≥70 / medio ≥40 / basso) e
grigio per gli assi a peso 0. L'identità dell'asse la porta la posizione, non il
colore — con otto assi e tre colori non potrebbe essere altrimenti.

> Il mockup Stitch «Beacon V3» disegna la barra con quattordici segmenti tutti
> `bg-green-500`. È sbagliato due volte — numero e colore — e va ignorato: la
> banda è l'unica cosa che rende la barra leggibile a colpo d'occhio.

### Il rango segue l'ordinamento, come già fa

Il badge `1º` compare solo con `sortBy === 'score'` (`DestinationCard.jsx:25`).
Ordinando per costo o per nome sparisce e la miniatura resta pulita. Non è una
regola nuova: è quella attuale, che continua a valere nella forma compatta.

---

## 3. Lo stato aperto

Al tocco sulla card compaiono, **dentro la stessa card** e sotto un filo di
separazione:

- la riga **Asse guida** — `Asse guida Cultura 18,4 pt · 5 assi su 8`
- i due bottoni: **Dettaglio** (navy pieno) e **Confronta** (bianco bordato)

Card aperta: ~200px.

### Perché l'asse guida sta qui

Sulla card compatta `ScoreBreakdown` va montato con `showLegend={false}`: la
sua didascalia non entra in 86px. Ma quella didascalia è precisamente ciò che
il §5 del planning chiede — «si deve poter vedere subito quale asse ha
contribuito» — e il commento dentro `ScoreBreakdown.jsx` lo dice a chiare
lettere: la diagnosi vera sta nella riga dell'asse guida, non nella barra.

Metterla nello stato aperto la conserva a un tocco invece che a vista, insieme
alle azioni: chi apre una card ottiene le azioni **e** il perché di quel
punteggio, che sono le due ragioni per cui la si apre.

### Una sola aperta per volta

Aprire una card chiude quella già aperta. Con cinque o sei card a vista, due o
tre righe aperte insieme sposterebbero le altre sotto il pollice mentre le si
guarda, e la densità appena guadagnata se ne andrebbe.

Lo stato «quale card è aperta» è quindi una proprietà **della lista**, non della
card: vive nel componente che le monta, e la card riceve `aperta` e
`onApri` come props.

### Il cuore non apre la card

Resta un'azione indipendente, come oggi. Il tocco sul cuore non deve propagarsi
al contenitore.

### Il costo, dichiarato

Aprire il dettaglio passa **da uno a due tocchi**, ed è l'azione più frequente
della schermata. È il prezzo della densità, ed è stato scelto sapendolo: la
lista serve a scartare, e scartare vuol dire guardare molte righe senza aprirne
nessuna.

---

## 4. Cosa cambia nel codice

| file | cosa |
|---|---|
| `DestinationCard.jsx` | **aggiunte**, non riscrittura: le props `aperta` / `onApri`, la classe `card--aperta`, il gestore sul contenitore |
| `App.jsx` (`:546`, dove monta la lista) | tiene l'id della card aperta e lo azzera quando cambiano criteri o ordinamento |
| `app.css` | un blocco nuovo dentro `@media (max-width: 900px)`; sopra i 901px non si tocca **nessuna** regola |

Dentro quel media query oggi c'è una regola sola (`app.css:1393`): non c'è
nessuna sovrascrittura da smontare prima.

### Perché il markup non si riscrive

Riscrivere la struttura obbligherebbe a rifare anche il CSS desktop che la
impagina, e il desktop non ha nessuna prova che lo protegga: si romperebbe a
occhio, o non si romperebbe per fortuna. Non è un rischio che questo lavoro
debba correre.

Non serve. Gli elementi che devono cambiare posto — `card__rank`,
`card__scorepill`, `card__fav`, `card__type` — sono **già in posizionamento
assoluto** dentro una `.card` che è già `position: relative` (`app.css:492`).
Su mobile si ri-ancorano dove li vuole il §2 con il solo CSS. Il resto è
mettere `.card` in riga, ridurre `.card__media` a 80×80, nascondere il clima, e
portare in colonna destra la barra dei contributi.

Con la card a **altezza fissa** il posizionamento assoluto è la scelta giusta e
non un espediente: le posizioni sono note in anticipo perché l'altezza non
dipende dal contenuto.

### Token, non valori

Colori e misure dai token esistenti (`tokens.css`). Nessun esadecimale scritto a
mano: l'ambra del `+N tema` è `--accent`, il navy dei bottoni è `--primary`.

### L'HTML di Stitch non si copia

Il mockup «Beacon V3» conferma la geometria — `h-[110px]`, `w-[80px] h-[80px]`,
colonna destra `w-16`, punteggio `text-[28px]`, barra `h-1.5` — e serve a
quello. Il suo markup no: è Tailwind, e porta un `<link>` a
`fonts.googleapis.com` per Manrope, Plus Jakarta Sans e le Material Symbols.

L'app self-hosta **Hanken Grotesk** e `tokens.css:1` dichiara che non contatta
host esterni per i font; le icone stanno già in `Icons.jsx`. Quei riferimenti
vanno scartati, non adattati.

---

## 5. Come si prova

I test montano con `renderToStaticMarkup` e **non c'è jsdom, e non va
aggiunto** — è la stessa regola del lavoro del 2026-08-03. Si prova quindi
quale markup esce, non cosa succede al tocco:

- la card senza `aperta` **non** ha la classe `card--aperta`; con `aperta` ce l'ha
- la card continua a contenere nome, fascia, nota, punteggio e barra in tutti e
  due gli stati — la differenza fra chiusa e aperta è di CSS, non di markup
- il badge del rango c'è con `sortBy === 'score'` e non c'è con `cost_asc`
- il `+N tema` è nel markup quando `themeBonus > 0` e assente quando è 0
- `App` passa a ogni card un `aperta` coerente: vero per una sola, falso per le
  altre

Quello che le prove **non** possono coprire, e che va guardato a occhio a
390×844 — perché è tutto CSS, e `renderToStaticMarkup` non applica il CSS:

- le cinque card intere con la sesta quasi tutta
- il clima sparito su mobile e ancora presente sopra i 901px
- rango, punteggio, cuore e barra atterrati dove li vuole il §2
- il `+N tema` in coda alla riga del paese, non altrove
- l'apertura al tocco, la chiusura dell'altra card, il cuore che non propaga
- **il desktop identico a prima**, che è il rischio principale di questo lavoro

Vanno in coda a `docs/superpowers/plans/2026-08-03-verifica-a-schermo.md`,
insieme ai punti di quel piano ancora da spuntare.

---

## 6. Fuori perimetro

Il desktop, in ogni sua parte. La fascia in alto e la dock, che il lavoro del
2026-08-03 ha già sistemato. Il pannello dei filtri e il suggeritore. Il modello
dati, lo scoring, i filtri duri: questa spec cambia **come si mostra** un
risultato, non come si calcola.
