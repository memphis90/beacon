# Dock mobile e schermata d'attesa — Design

> Spec derivata dalla conversazione del 2026-08-03. Riguarda **solo il mobile**
> (sotto i 901px). Sopra quella soglia non cambia niente: la dock non esiste, la
> topbar è già chiara, i pannelli stanno dove stanno.
>
> `PLANNING.md` resta la fonte dei vincoli. Questa spec non tocca il modello
> dati, lo scoring né le fasi: è lavoro di interfaccia su ciò che è già
> costruito.

---

## 1. Il problema

Tre difetti indipendenti, trovati guardando il codice, che si risolvono insieme
perché toccano gli stessi due componenti.

**La topbar dei risultati è navy su mobile e nessuno l'ha chiesta.**
`app.css:79` la dipinge `var(--primary)` (#00162a) e a 901px la riporta a
`--surface`; il commento accanto — «resta la topbar scura con la bottom nav» —
la marca come eredità di un mockup. Il punto non è che diverga dal desktop: è
che `.landing__bar` **è già chiara**, e lo dichiara (`app.css:1649`). Oggi le due
schermate mobile hanno due intestazioni di colore diverso. La nera è
l'eccezione, non la regola.

**La dock esiste in una schermata sola.** `BottomNav` è montata solo nei
risultati (`App.jsx:585`). Sulla schermata di ricerca la barra inferiore
scompare, e con lei preferiti e confronto.

**L'azione principale non ha un posto fisso.** Nella ricerca l'invio è una
freccia dentro il composer (`Landing.jsx:248`), in alto, lontano dal pollice.
Nei risultati non esiste affatto: per cambiare la frase bisogna passare dal
menu laterale.

---

## 2. Topbar

`.topbar` sotto i 901px prende `background: var(--surface)`, testo
`var(--primary)`, hairline `1px var(--border)` in basso — le stesse regole già
attive sopra i 901px. Il marchio e l'icona del codice seguono il colore del
testo.

Nessun'altra modifica: resta `position: static`, resta alta 48px, continua a
scorrere via. Il §7 spiega perché quella scelta ora costa meno.

---

## 3. La dock

Identica sulle due schermate — è la coerenza richiesta, e vale solo se le voci
sono le stesse e nello stesso ordine.

```
 ─────────────────────────────────
   ≡      ♡     ((✨))    ⚖      ⚙
 Elenco  Pref   Chiedi  Confr  Impost.
```

| slot | apre |
|---|---|
| Elenco | la vista risultati completa (spegne il filtro preferiti) |
| Preferiti | la vista filtrata, badge ambra col conteggio |
| **centro** | vedi §4 |
| Confronta | il pannello di confronto, badge col conteggio, disattivo sotto 2 |
| Impostazioni | il pannello a due schede del §5 |

Il centro è un cerchio di ~60px riempito `var(--primary)`, icona bianca, che
**sporge sopra il bordo superiore** della barra: è ciò che lo rende leggibile
come l'azione e non come la terza di cinque voci. Ombra molto diffusa (0 offset,
12px blur, 4%), l'unica del progetto.

Su `Landing` la dock è nuova: il suo corpo prende il `padding-bottom:
calc(var(--bottomnav-h) + …)` che i risultati hanno già (`app.css:1265`), o
l'ultima riga finisce sotto la barra.

L'ambra resta riservata ai badge. Il centro è navy: due colori forti nella
stessa barra si contendono l'occhio, e il badge deve poter urlare più del
fondo su cui sta.

### Quando non c'è ancora niente da mostrare

Elenco, Preferiti e Confronta lavorano tutti su `ranking.results`, che esiste
solo dopo una ricerca. Sulla schermata di ricerca, quindi, dipende da dove ci
si trova:

- **prima ricerca della sessione** — i tre slot sono disattivi e attenuati.
  Restano visibili: una dock che cambia forma fra le due schermate non sarebbe
  più la stessa dock, ed è tutto il punto. Vivi restano il centro e
  Impostazioni, che è quello che si può davvero fare in quel momento.
- **tornati alla ricerca dopo un risultato** — tutto vivo. Premere Elenco
  riporta ai risultati che ci sono già; è anche il modo per uscire dal composer
  senza aver cambiato la frase.

I preferiti sopravvivono in `localStorage` (`FAVOURITES_KEY`, `App.jsx:99`), ma
la loro **vista** è un filtro sul ranking: senza ranking non c'è niente da
filtrare, e mostrare i preferiti come schede sciolte vorrebbe dire una
schermata nuova che questa spec non introduce.

Lo stato disattivo non è un'invenzione: `Confronta` è già `disabled` sotto le
due selezioni (`BottomNav.jsx:14`).

---

## 4. Il pulsante centrale

> **Rivisto il 2026-08-03**, dopo aver visto i primi tre task a schermo. La
> versione precedente — il centro come invio, con la freccia tolta dal
> composer — è descritta in fondo a questa sezione insieme al motivo per cui
> è stata abbandonata.

**È «+ nuova ricerca», e significa la stessa cosa nelle due schermate.** Icona
`IconPlus`, etichetta «Nuova». Nella ricerca svuota il campo e vi riporta il
cursore; nei risultati azzera la frase e riporta alla schermata di ricerca
pulita.

**La freccia resta nel composer** (`Landing.jsx:248`), dove sta in qualunque
interfaccia a prompt e dove la memoria muscolare la cerca.
L'`InterpreterPicker` le resta accanto.

Il centro è disattivo quando non c'è niente da azzerare: campo vuoto e nessun
ranking. Un pulsante che a premerlo non fa niente è peggio di un pulsante
spento, perché spento almeno lo dice.

### Perché non l'invio

La versione precedente metteva l'invio al centro, e aveva un vantaggio reale:
il gesto principale dove arriva il pollice. L'ha persa su un difetto più
grosso — **il centro significava due cose diverse.** Sulla ricerca «invia»,
nei risultati «riapri il composer»: un pulsante solo, due gesti, e la
somiglianza fra i due la vedeva solo chi aveva scritto il codice.

Con il «+» la dock diventa **tutta navigazione**: cinque slot che rispondono a
«dove vado», nessuno che fa. È un modello più netto di quattro navigazioni più
un'azione, ed è il gesto che chiunque riconosce dalle interfacce a chat.

Il prezzo è dichiarato: sulla schermata di ricerca il pulsante più grande
compie l'azione meno frequente. Accettato consapevolmente.

### La conseguenza da tenere d'occhio

Con il «+» che azzera, **il percorso per ritoccare una frase passa dalla
cronologia**: menu laterale → la voce precedente → il campo si riempie
(`riprendi()`, `Landing.jsx:153`). Prima era un tocco solo. Dopo aver letto un
elenco, correggere il budget o il mese è un caso frequente, e ora costa tre
tocchi attraverso un menu che su mobile scorre via (§7).

Se all'uso questo pesa, la strada **non** è rimettere l'invio al centro: è
rendere tappabile la frase mostrata nei risultati, che riporterebbe al composer
con il testo dentro senza togliere niente a nessuno. Fuori dal perimetro di
questa spec.

---

## 5. Impostazioni: un pannello, due schede

Lo slot apre un pannello a tutto schermo che si apre **sui Parametri**, con una
seconda scheda «Modello» accanto.

- **Parametri** — il contenuto attuale di `EditorPanel`: pesi degli otto assi,
  budget, mese, tipo. È ciò che si ritocca spesso, quindi è la scheda di
  partenza: un tocco.
- **Modello** — il contenuto attuale di `SettingsModal`: profili, endpoint,
  chiave, prova di connessione. Si tocca una volta e poi più, quindi paga il
  secondo tocco.

Le due cose restano due componenti separati: il pannello è un contenitore con
le schede, non una fusione. Su desktop niente cambia — `EditorPanel` e
`SettingsModal` si aprono da dove si aprono adesso, e la dock non c'è.

Questo è anche ciò che rende accettabile la topbar che scorre via: la
configurazione non dipende più dall'hamburger.

---

## 6. La schermata d'attesa

Oggi è già un velo in primo piano (`Landing.jsx:357`) con dentro un riquadro
bianco che contiene quattro cose: la frase ironica coi tre puntini animati, la
frase dell'utente fra virgolette, il nome del modello con l'avvertenza, e
Annulla.

**Cambia questo:** il riquadro bianco sparisce, resta il velo. Al centro il
faro di `LogoMark` a ~72px, sotto la frase ironica coi puntini, in fondo — in
piccolo — il nome del modello e Annulla.

**Sparisce una cosa sola:** la frase dell'utente fra virgolette. L'ha scritta
due secondi prima; ripeterla mentre aspetta non aggiunge niente.

**Resta, e non è negoziabile:** la riga `thinkbox__meta`. Dice *quale* modello
sta rispondendo — che è metà del motivo per configurarne più d'uno — e avverte
che in locale la prima chiamata deve caricare il modello in memoria e può
superare il minuto. Senza quella riga un'attesa di 90 secondi non è lunga: è
rotta.

### L'animazione

La lanterna ambra pulsa: opacità e alone, ciclo lento sui 2 secondi. Il resto
del disegno resta fermo.

**Nessuna rotazione, nessun fascio che gira.** Un raggio rotante si legge come
spinner, e uno spinner promette avanzamento — che è esattamente il motivo per
cui le frasi d'attesa sono state congelate invece di farle scorrere
(`Landing.jsx:16-19`). Una luce che respira dice «acceso», che è vero, e non
dice «ci siamo quasi», che non lo è.

L'ambra è già l'unico colore fisso del marchio e la sua ragione è dichiarata in
`Logo.jsx`: «un faro spento non è un faro». Accenderla mentre lo strumento
cerca è il marchio che fa il proprio mestiere.

**`prefers-reduced-motion`:** la pulsazione si spegne, il faro resta acceso
fisso. Va aggiunta al blocco di `app.css:1930`, dove i tre puntini si fermano
già.

---

## 7. Limiti noti, accettati

**La cronologia resta dietro un hamburger che scorre via.** La topbar mobile è
`position: static`: a metà pagina il menu è irraggiungibile finché non risali.
Le impostazioni escono da quel vincolo passando nella dock (§5); la cronologia
no. È una scelta consapevole per non allargare la dock a sei slot, non una
svista. Se il problema si presenterà nell'uso, la strada è rendere la topbar
`sticky` su mobile, non aggiungere una voce.

---

## 8. Fuori perimetro

Non toccati da questa spec: il desktop in ogni sua parte, il testo e la regola
delle undici frasi d'attesa (una per ricerca, ferma, mai promettere ciò che lo
strumento non fa), il comportamento di Annulla, il modello dati, lo scoring, e
la decisione aperta §8.2 del planning — che è una questione di punteggi e viaggia
per conto suo.
