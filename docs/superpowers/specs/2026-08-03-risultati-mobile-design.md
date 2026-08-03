# Schermata risultati su mobile — Design

> Riguarda **solo il mobile** (sotto i 901px): la schermata dei risultati e,
> dal §6, quella di ricerca. Sopra quella soglia non cambia niente.
>
> Va letta insieme a `2026-08-03-dock-mobile-e-attesa-design.md`, che ha
> introdotto la barra inferiore: alcuni problemi qui sotto esistono **perché**
> quella barra è arrivata, e uno di essi è la ragione per cui questa spec
> esiste.

---

## 1. Il problema: tre fasce di cromatura prima del primo risultato

Oggi, scendendo dall'alto:

| | | altezza |
|---|---|---|
| `.topbar` | marchio + hamburger + «Codice», **navy**, scorre via | 48px |
| `.mtools` riga 1 | campo di ricerca + pulsante «Filtri» | ~56px |
| `.mtools` riga 2 | tab di ordinamento: Punteggio · Costo · Nome | ~44px |
| | **prima che si veda un risultato** | **~148px** |

E in basso, sovrapposti nello stesso angolo: il pulsante flottante del
suggeritore (`.critique`, ancorato a `bottom: calc(var(--bottomnav-h) +
var(--inline-gap))`) e la barra inferiore col disco centrale che sporge. Due
elementi galleggianti che si contendono l'unico angolo dove arriva il pollice.

---

## 2. Una fascia sola

`.topbar` e `.mtools` diventano **una barra sola**, appiccicata in alto:

```
┌──────────────────────────────┐
│ 🗼  [🔍 Cerca una meta…]  [Filtri²] │
│ Punteggio · Costo · Nome     │
└──────────────────────────────┘
```

- **Riga 1:** il marchio (`LogoMark`), campo di ricerca, pulsante «Filtri» col
  badge dei filtri attivi. La scritta «Beacon» e il collegamento al codice
  **spariscono dai risultati**: in una schermata dove si guarda una classifica
  il nome del prodotto non è informazione, e «Codice» resta nel piede della
  pagina.
- **Riga 2:** i tre tab di ordinamento, compatti, quello attivo sottolineato.

La barra è **chiara** (`--surface` con hairline in basso), come già è quella
della schermata di ricerca. La navy sparisce — è la stessa correzione
descritta al §2 dell'altra spec, e qui vale a maggior ragione perché la barra
diventa permanente invece che scorrevole.

### Niente hamburger, su nessuna schermata

Sotto i 901px il pulsante del menu **sparisce ovunque**, e con lui la barra
laterale: non è raggiungibile, quindi non deve esistere. Il suo contenitore e
il suo velo vanno nascosti sotto quella soglia, non lasciati montati e
irraggiungibili — un cassetto che nessuno può aprire è una trappola per il
focus da tastiera, non un elemento invisibile.

Ogni voce che conteneva ha un posto, e li elenca il §6. Il percorso che
sembrava restare scoperto — raggiungere la cronologia **dai risultati** — si
chiude da sé: il «+» riporta alla schermata di ricerca, dove la cronologia è
in linea sotto il campo.

Questo cancella anche il limite noto del §7 dell'altra spec, che accettava un
hamburger irraggiungibile a metà pagina perché la topbar scorreva via. Non è
più irraggiungibile: non c'è.

Su desktop la barra laterale resta esattamente com'è.

---

## 3. Il suggeritore entra nel pannello dei filtri

> **Rivisto il 2026-08-03**, guardando l'app a schermo. La versione precedente
> — una card in linea sopra il primo risultato — è descritta in fondo alla
> sezione con il motivo per cui è stata abbandonata.

Il pulsante flottante sparisce. La proposta del modello va **in cima al
pannello dei filtri**, sopra gli slider dei pesi:

```
┌────────────────────────┐
│ Filtri              ✕ │
├────────────────────────┤
│ ✨ Il modello osserva   │
│ Hai chiesto natura ma   │
│ il peso è basso: 8?     │
│ [Applica]    Ignora     │
│ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
│ Natura     ●──── 7      │
│ Cultura  ──●──── 5      │
└────────────────────────┘
```

**Perché lì e non altrove.** Il suggeritore propone **pesi**, e i pesi vivono
in quel pannello: la proposta finisce accanto allo slider che cambierebbe,
dove chi la accetta può vederne subito l'effetto e chi la rifiuta ha la mano
già sul comando alternativo. Ed è l'unico posto dove una frase intera più due
pulsanti ci stanno senza comprimere nient'altro — in una barra alta 48px ci
sta un'icona, non un'osservazione.

Sparendo il pulsante flottante si chiude anche il problema del §1: due
elementi galleggianti non si contendono più l'unico angolo dove arriva il
pollice.

### Come si fa sapere che c'è

Nascosto dietro un pannello, il suggerimento va annunciato, o esiste solo per
chi apre i filtri per caso. Il pulsante «Filtri» porta già un badge col numero
dei filtri attivi: **non va riusato** — un badge che conta due cose diverse non
conta niente.

Serve un secondo segno, distinto e più piccolo: un punto con la scintilla sul
pulsante «Filtri», presente solo finché c'è una proposta non ancora vista.
Sparisce quando il pannello viene aperto, non quando la proposta viene
accettata: dice «c'è qualcosa da leggere», non «c'è qualcosa da fare».

### Quando esiste e quando no

| stato | cosa compare |
|---|---|
| in attesa della risposta | **niente**, né sezione né segno |
| risposta arrivata, nessun rilievo | **niente** |
| errore o modello non configurato | **niente** |
| una o più proposte di peso | la sezione, e il segno sul pulsante |

Nessun segnaposto, nessuna rotella, nessuna sezione «nessun rilievo». Se il
modello non ha niente da dire, quello spazio non esiste e il pannello si apre
sugli slider come oggi.

### Perché non la card in linea

Era la versione precedente di questa sezione, e aveva un vantaggio: si legge
senza toccare niente. L'ha persa perché quel posto era già stato provato e
abbandonato, e il commento in cima a `RankingCritique.jsx` dice perché:

> Il riquadro occupava il posto migliore della pagina — quello dove si guarda
> per primo — con un contenuto che arriva dieci secondi dopo e che spesso è
> "niente da ridire": i risultati scendevano sotto la piega per fare spazio a
> un'attesa.

La condizione «si monta solo quando c'è una proposta» avrebbe neutralizzato
l'obiezione, ma resta che la card ruba una fascia sopra i risultati proprio
mentre il §1 di questa spec sta cercando di liberarne. Il pannello dei filtri
non ruba niente a nessuno.

**Il costo, dichiarato:** la proposta ora sta a due tocchi invece che a vista.
Chi non apre mai i filtri non la leggerà — ed è il motivo per cui il segno sul
pulsante non è un dettaglio ma un requisito.

**Quello che il suggeritore continua a non fare** resta invariato e non è
negoziabile: propone dei pesi, non riordina niente. Il §5 del planning vuole
che il punteggio resti aritmetica visibile e che sia l'utente ad applicare la
modifica.

### Sopra i 901px non cambia niente

Su desktop i filtri **non sono un pannello a scomparsa**: sono una colonna
sempre visibile accanto ai risultati. «Dentro il pannello dei filtri» lì
significherebbe una cosa diversa, e soprattutto non c'è nessun problema da
risolvere — il pulsante flottante non contende l'angolo a nessuna barra
inferiore, perché sopra i 901px la barra inferiore non esiste.

Quindi il suggeritore su desktop **resta esattamente dov'è oggi**, pulsante
flottante compreso. Tutto il §3 vive dentro `@media (max-width: 900px)`.

---

## 4. Card più basse

Le card della classifica perdono altezza senza perdere informazione:
miniatura, nome, sottotitolo (paese · tipo), fascia di costo, punteggio grande
a destra con la barra segmentata dei contributi sotto, cuore in alto a destra.
L'obiettivo dichiarato: **tre punteggi leggibili insieme senza scorrere**, su
uno schermo da 390×844.

Non è vezzo grafico, è il §9 del planning: la Fase 0 è validata se, quando il
ranking contraddice il giudizio, si riesce a identificare l'asse responsabile.
Confrontare 88, 85 e 91 richiede di vederli insieme.

---

## 5. Perché non un carosello, e perché non lo swipe

Valutati ed esclusi il 2026-08-03.

**Snap orizzontale:** in questa schermata l'ordine *è* il contenuto, e i
punteggi significano qualcosa solo incolonnati. Lo snap orizzontale serve
elementi pari fra loro — foto, storie — dove la posizione non porta
informazione. Con novanta risultati, poi, scorrerli uno alla volta è una
punizione.

**Modello a scorrimento secco (tipo Tinder):** funziona quando il giudizio è
istantaneo, emotivo e binario. Scegliere dove andare cinque giorni con un
budget a ottobre è deliberativo e multi-attributo. E confligge col prodotto:
lo swipe nasconde l'insieme, mentre «Confronta» esiste per affiancare, e la
barra dei contributi esiste perché il punteggio si possa **contestare**.
Un'interfaccia che fa scartare senza mostrare il perché è l'opposto del §5.

Se la lista pesa, il problema non è il paradigma: sono le fasce di cromatura
del §1 e la densità delle card del §4.

---

## 6. La home su mobile

Deciso il 2026-08-03, insieme al resto. Riguarda `Landing`, non i risultati, ma
nasce dallo stesso problema — troppa cromatura, e un menu che nasconde le cose
che servono.

### Sparisce l'hamburger, arriva il faro

La barra della home mobile perde il pulsante del menu — come tutte le
schermate, §2 — e guadagna il **marchio** (`LogoMark`), perché il faro vive in
cima alla barra laterale e senza hamburger quella barra non si apre più:
resterebbe irraggiungibile su mobile.

**Marchio e nome stanno insieme**, faro a sinistra e «Beacon» accanto:

```
🗼 Beacon
```

> **Rivisto il 2026-08-03** guardando l'app a schermo. La prima versione faceva
> *sostituire* la scritta dal marchio, ed è stata implementata così (i due sono
> resi mutuamente esclusivi in `Landing.jsx` e `app.css`). Va cambiato: si
> affiancano.

Non contraddice il commento di `App.jsx` che vietava «due volte lo stesso
marchio a due centimetri di distanza»: quello parlava del faro in cima alla
barra laterale **più** il nome nella barra in alto, cioè due elementi separati
in due posti. Affiancati e allineati sono una cosa sola — un lockup — ed è la
forma in cui un marchio si presenta normalmente.

**Solo sotto i 901px.** Sopra, la barra della home resta come oggi: la scritta
nella barra in alto e il faro in cima alla colonna laterale, che lì c'è ancora.

### Dove vanno le voci del menu

Vale per **entrambe** le schermate: sotto i 901px la barra laterale non
esiste, quindi ogni sua voce deve avere un altro posto o sparire.

| voce del menu laterale | su mobile, dopo |
|---|---|
| Nuova ricerca | il «+» al centro della dock |
| Impostazioni | lo slot «Impostazioni» della dock |
| **Scopri le destinazioni** | lo slot «Elenco» della dock — stesso posto d'arrivo |
| **Cronologia** | in linea sotto il composer della home |
| **Azzera i dati** | dentro il pannello Impostazioni |

Dai risultati la cronologia si raggiunge in due tocchi — «+» e poi la voce —
invece del tocco solo che ha chi è già sulla home. È il costo accettato per
non avere un sesto slot né un menu.

Sullo slot «Elenco» servono due precisazioni. Prende **l'icona della barra
laterale** (`IconPin`, `SideRail.jsx:152`) al posto di `IconList`: è la stessa
azione, e due icone diverse per la stessa cosa sono due cose per chi guarda. E
sulla home deve essere **acceso anche senza ranking** — lì significa «sfoglia
tutto», che è il percorso `onSkip` e non ha bisogno di risultati preesistenti.
Nei risultati resta legato a `hasResults` come oggi.

L'azzeramento non è un logout: `azzera()` cancella tutto ciò che è salvato su
questa macchina — criteri, preferiti, cronologia. Sta nel pannello
Impostazioni perché è configurazione, ed è l'unica azione distruttiva
dell'applicazione: va dove la si cerca apposta, non dove ci si inciampa.

### La cronologia prende il posto dei suggerimenti

Sotto il composer la home mostra oggi quattro frasi d'esempio. Diventano il
**caso vuoto**: appena esiste una cronologia, al loro posto compare l'elenco
verticale scorrevole delle ricerche recenti, ognuna toccabile per riprenderla —
lo stesso gesto di `riprendi()` (`Landing.jsx:172`), che riempie il campo
lasciandoti ritoccare.

| stato | sotto il composer |
|---|---|
| cronologia vuota | le quattro frasi d'esempio |
| cronologia piena | le ricerche recenti, scorrevoli |

**Perché questo chiude un debito invece di aprirne uno.** Il §4 dell'altra spec
accettava un prezzo: dal momento che il «+» azzera, ritoccare una frase passa
dalla cronologia, cioè da tre tocchi attraverso un menu che scorre via. Con la
cronologia in linea quel percorso torna a **un tocco solo**, e senza rimettere
l'invio al centro. Il prezzo dichiarato lì è pagato qui.

---

## 7. Fuori perimetro

Il desktop in ogni sua parte. La logica del suggeritore (quando parte, cosa
chiede al modello, come sanifica la risposta): cambia **dove** compare e a
quali condizioni, non cosa fa. Il modello dati, lo scoring, i filtri duri.
