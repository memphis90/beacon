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
│ ☰   [🔍 Cerca una meta…]  [Filtri²] │
│ Punteggio · Costo · Nome     │
└──────────────────────────────┘
```

- **Riga 1:** hamburger, campo di ricerca, pulsante «Filtri» col badge dei
  filtri attivi. Il marchio e il collegamento al codice **spariscono dai
  risultati**: il marchio ha già il suo posto in cima alla barra laterale, e
  «Codice» è raggiungibile da lì e dal piede della pagina. In una schermata
  dove si guarda una classifica, il nome del prodotto non è informazione.
- **Riga 2:** i tre tab di ordinamento, compatti, quello attivo sottolineato.

La barra è **chiara** (`--surface` con hairline in basso), come già è quella
della schermata di ricerca. La navy sparisce — è la stessa correzione
descritta al §2 dell'altra spec, e qui vale a maggior ragione perché la barra
diventa permanente invece che scorrevole.

**Chiara e sticky, non scura e scorrevole.** Oggi la topbar scorre via
portandosi dietro l'hamburger, che a metà pagina diventa irraggiungibile — è
il limite noto del §7 dell'altra spec. Fondendo le due barre il problema si
chiude da solo: l'hamburger vive nella barra che resta.

---

## 3. Il suggeritore esce dall'angolo

Il pulsante flottante lascia il posto a una **card in linea**, sopra il primo
risultato:

```
┌──────────────────────────────┐
│ ✨ Il modello osserva      ✕ │
│ Hai chiesto natura ma il      │
│ peso è basso: alzo a 8?       │
│ [Applica]   Ignora            │
└──────────────────────────────┘
```

### La condizione che rende questo diverso dall'ultima volta

Il riquadro in linea **c'era già ed è stato rimosso di proposito**. Il commento
in cima a `RankingCritique.jsx` spiega perché, e l'obiezione è valida:

> Il riquadro occupava il posto migliore della pagina — quello dove si guarda
> per primo — con un contenuto che arriva dieci secondi dopo e che spesso è
> "niente da ridire": i risultati scendevano sotto la piega per fare spazio a
> un'attesa.

**Quindi la card si monta solo quando c'è una proposta concreta da mostrare.**
Non esiste in nessuno degli altri stati:

| stato | cosa compare |
|---|---|
| in attesa della risposta | **niente** |
| risposta arrivata, nessun rilievo | **niente** |
| errore o modello non configurato | **niente** |
| una o più proposte di peso | la card |

Nessun segnaposto, nessuna rotella, nessuna card «nessun rilievo». Se il
modello non ha niente da dire, quello spazio non esiste e i risultati partono
da sotto la barra. È questa condizione — non la posizione — a decidere se
questa scelta ripete l'errore o lo evita.

La `✕` chiude la card per quella ricerca. Riapparirà alla ricerca successiva se
avrà qualcosa da dire: non è una preferenza da ricordare, è un congedo.

**Quello che il suggeritore continua a non fare** resta invariato e non è
negoziabile: propone dei pesi, non riordina niente. Il §5 del planning vuole
che il punteggio resti aritmetica visibile e che sia l'utente ad applicare la
modifica.

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

La barra della home mobile perde il pulsante del menu e sostituisce la scritta
«Beacon» con il **marchio** (`LogoMark`). Le due cose vanno insieme: il faro
vive in cima alla barra laterale, e senza hamburger quella barra non si apre —
il marchio resterebbe irraggiungibile su mobile. Portandolo nella barra si
recupera, e il commento di `App.jsx` che vietava di ripetere marchio e nome a
due centimetri di distanza resta rispettato, perché adesso ce n'è uno solo.

### Dove vanno le voci del menu

| voce del menu laterale | su mobile, dopo |
|---|---|
| Nuova ricerca | il «+» al centro della dock |
| Impostazioni | lo slot «Impostazioni» della dock |
| **Scopri le destinazioni** | lo slot «Elenco» della dock — stesso posto d'arrivo |
| **Cronologia** | in linea sotto il composer (sotto) |
| **Logout** | dentro il pannello Impostazioni |

Sullo slot «Elenco» servono due precisazioni. Prende **l'icona della barra
laterale** (`IconPin`, `SideRail.jsx:152`) al posto di `IconList`: è la stessa
azione, e due icone diverse per la stessa cosa sono due cose per chi guarda. E
sulla home deve essere **acceso anche senza ranking** — lì significa «sfoglia
tutto», che è il percorso `onSkip` e non ha bisogno di risultati preesistenti.
Nei risultati resta legato a `hasResults` come oggi.

Il «logout» non è un logout: `azzera()` cancella tutto ciò che è salvato su
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
