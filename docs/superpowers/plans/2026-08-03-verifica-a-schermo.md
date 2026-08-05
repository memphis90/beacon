# Verifica a schermo — dock mobile e attesa

> **Da eseguire a mano, da una persona davanti allo schermo.** Non è una
> formalità: nessun `onClick` di questo lavoro è mai stato eseguito, in nessun
> ambiente. Le prove automatiche montano i componenti con
> `renderToStaticMarkup` e verificano **quale markup esce**, mai **cosa succede
> al tocco** — il progetto non ha jsdom, e non lo si è voluto aggiungere per
> una schermata sola.
>
> Sei dei rilievi trovati dalla revisione finale si sarebbero visti al primo
> tocco.

Avvio: `npm run dev`, poi apri l'indirizzo che stampa.

Per il mobile: riduci la finestra **sotto i 900px** di larghezza (o usa la
modalità dispositivo del browser, 390×844). Per il desktop: **sopra i 901px**.

---

## Mobile — la barra inferiore

Nessuno di questi gestori è mai stato eseguito.

- [ ] **1.** Prima apertura, schermata di ricerca: `Elenco`, `Preferiti` e
      `Confronta` sono **spenti e attenuati**; `Nuova` e `Impostazioni` sono
      vivi. Il disco centrale **sporge sopra il bordo** della barra e non è
      tagliato.
- [ ] **2.** Scrivi qualcosa nel campo: `Nuova` si accende. Premilo: il campo si
      svuota e il cursore ci torna dentro.
- [ ] **3.** Fai una ricerca vera → risultati → premi `Nuova`: torni alla
      ricerca **col campo vuoto**. Poi rientra ai risultati con `Elenco`.
- [ ] **4.** **Il percorso «sfoglia tutto»** — è la correzione più delicata del
      lavoro e nessuna prova può coprirla. Sulla bottom nav della home, premi
      «Elenco» **senza aver scritto niente** — qui fa da «Scopri le
      destinazioni», la stessa voce che prima stava nel menu laterale e che
      ora non c'è più — → arrivi ai risultati → torna alla ricerca col centro
      della dock → **`Elenco`, `Preferiti` e `Confronta` devono essere
      vivi**, non spenti. Se sono spenti, la correzione `hasEntered` non
      regge.
- [ ] **5.** Dai risultati premi `Preferiti`: mostra la vista filtrata.
      Premilo di nuovo: **deve restare** sulla vista filtrata (non commuta
      più). Per tornare all'elenco completo si usa `Elenco`.
- [ ] **6.** Apri il **Confronto** (servono due destinazioni selezionate), poi
      premi `Elenco`: **deve chiudere il confronto** e riportarti all'elenco.
      Ripeti con la pagina Parametri aperta.
- [ ] **7.** Dai **risultati**, premi il centro della dock («Nuova») per
      tornare alla ricerca — il menu laterale non c'è più — poi tocca una
      voce della cronologia in linea sotto il campo: il campo deve riempirsi
      con **quella** frase, non con l'ultima usata.
- [ ] **7-bis.** Sulla stessa cronologia in linea: la **×** su una voce la
      rimuove soltanto — il campo **non** si riempie e non riparte una
      ricerca.
- [ ] **7-ter.** «Svuota la cronologia», in coda alla lista, le toglie
      **tutte**: gli esempi tornano al posto della lista, e **i preferiti
      restano quelli di prima** — l'azione tocca solo la cronologia.

## Mobile — il pannello Impostazioni a due schede

- [ ] **8.** Aprilo dalla dock: parte su **Parametri**. Passa a **Modello** e
      torna indietro: **il pannello non deve cambiare altezza né saltare**.
      Falla su **entrambe** le schermate, ricerca e risultati.
- [ ] **9.** Nella scheda Parametri tocca una destinazione: la scheda di
      modifica si apre sopra. Chiudila, cambia scheda, chiudi tutto — non deve
      restare niente aperto alle spalle.
- [ ] **10.** Guarda l'etichetta del pulsante che chiude la scheda Parametri
      **aperta dalla schermata di ricerca**: non deve promettere di tornare a
      dei risultati che lì non esistono.
- [ ] **11.** Dentro Impostazioni deve esserci l'azzeramento dei dati, e deve
      essere l'unico posto da cui si raggiunge.

## Mobile — barra in alto e attesa

- [ ] **11-bis.** Sotto i 900px, in **entrambe** le schermate: nessun
      pulsante di menu visibile, e premendo **Tab** dalla cima della pagina il
      fuoco non si ferma mai su un pulsante di menu né su una voce del
      vecchio cassetto — passa dritto agli elementi veri della pagina (campo,
      risultati). Nessuna prova automatica esegue un tab reale: è l'unica
      verifica che questo lavoro ha, e il rischio che copre è un pannello
      invisibile ma ancora raggiungibile da tastiera.
- [ ] **12.** Barra in alto dei risultati: **chiara**, non navy. Marchio e
      icona «Codice» leggibili sul fondo chiaro, hairline sotto. *Questa
      verifica non è mai stata eseguita da nessuno.*
- [ ] **12-bis.** Sulla home mobile: il faro **sostituisce** la scritta
      «Beacon» nell'angolo in alto a sinistra — non le sta accanto, non
      compaiono insieme. Sopra i 901px vale il contrario: resta solo la
      scritta.
- [ ] **13.** Con un modello configurato, lancia una ricerca e guarda l'attesa:
      velo, faro grande al centro, **nessun riquadro bianco**, la frase
      ironica coi tre puntini, sotto la riga col nome del modello, e Annulla.
      La lanterna ambra **pulsa senza ruotare**.
- [ ] **14.** Attiva la riduzione del movimento nel sistema operativo e rilancia
      una ricerca: il faro resta **acceso e fermo**, non invisibile.
- [ ] **15.** In entrambe le schermate, l'ultimo elemento della pagina non
      finisce sotto la barra inferiore.
- [ ] **15-bis.** Dal piede della pagina apri **Privacy** o **Termini**: su
      mobile ora sono **a tutto schermo** invece che alte 80vh col velo sopra e
      sotto. È un effetto collaterale accettato consapevolmente — allineare le
      due schede del pannello ha richiesto di togliere il tetto a
      `.panel--info`, che quelle pagine condividono. Guarda che si leggano bene
      e che la `×` sia raggiungibile.

## Desktop — quello che NON deve essere cambiato

Il vincolo dichiarato è che sopra i 901px non cambi niente. Una regressione qui
è già stata trovata e corretta una volta: vale la pena guardare.

- [ ] **16.** Home, menu laterale → Impostazioni: **non deve comparire nessuna
      striscia di schede**.
- [ ] **17.** Home, selettore dell'interprete accanto al campo → «Configura»:
      stessa verifica, nessuna striscia di schede.
- [ ] **18.** Risultati: «Parametri» dal menu resta la **pagina in flusso** di
      sempre, non un overlay a tutto schermo.
- [ ] **19.** La barra inferiore **non esiste**, e la barra in alto è quella di
      prima.
- [ ] **20.** In **entrambe** le schermate, sopra i 901px la barra laterale è
      esattamente quella di prima: colonna permanente sulla home, cassetto sui
      risultati, il faro in cima la apre e la chiude. Niente hamburger nuovo
      accanto al nome, in nessuna delle due schermate.

---

## Mobile — la card compatta della classifica

Aggiunta il 2026-08-05. A differenza di tutto il resto di questo file, **una
parte di questi controlli è già stata eseguita**: il 2026-08-05 l'app è stata
aperta a 390×844 dentro un iframe servito dal dev server, e le posizioni sono
state misurate sul DOM vero, non stimate. I punti già verificati portano
l'esito fra parentesi; restano nella lista perché una regressione futura li
riguarda comunque.

Quelli **senza** esito non sono mai stati eseguiti da nessuno.

- [x] **21.** La card è alta **110px** da chiusa. *(misurato: 110)*
- [x] **22.** Si vedono **quattro card intere e la quinta quasi tutta**.
      *(misurato: 4 intere, 1 parziale; 543px utili, passo 118px)*
- [x] **23.** **Il clima non c'è**: nessun termometro, nessuna temperatura.
      *(`.card__climate` risulta `display: none`)*
- [x] **24.** Foto 80×80 a sinistra, rango sul suo angolo, cuore in alto a
      destra della card, punteggio grande e barra sotto di lui.
      *(misurato: foto 13,13 · rango 17,17 · cuore 292,5 · punteggio 272,46 ·
      barra 272,82)*
- [x] **25.** La riga del paese porta il tipo: `Italia · isola`. *(verificato)*
- [x] **26.** Ordina per **Costo**: il badge del rango sparisce da tutte le
      foto. Torna su **Punteggio**: riappare. *(misurato: 24 badge con
      punteggio, 0 con costo)*
- [x] **27.** «Santiago di Compostela» **tronca coi puntini e non passa sotto
      il punteggio**. *(misurato: nome fino a 297px, punteggio da 305px)*
- [x] **28.** Tocca una card: compaiono l'asse guida e i due bottoni, e la card
      sale a ~200px. *(misurato: 204px, azioni `flex`, didascalia `block`)*
- [x] **29.** Tocca una seconda card: **la prima si chiude**. Mai due aperte.
      *(verificato: sempre una sola `.card--aperta`)*
- [x] **30.** Tocca il cuore: il preferito cambia e **la card non si apre**.
      *(verificato: `aria-pressed` passa a true, l'aperta resta l'altra)*
- [x] **31.** Con una card aperta, cambia l'ordinamento: **si richiude**.
      *(verificato: da 1 aperta a 0)*
- [x] **32.** **Sopra i 901px la card è identica a prima**: foto a fascia alta
      192px, chip ISOLA/AREA/CITTÀ, clima, asse guida, due bottoni sempre
      visibili, e il bottone di apertura assente. *(misurato: card 468px,
      `.card__apri` `display: none`, clima e azioni presenti)*

Questi invece **restano da fare a mano**, perché nessuno strumento qui li
raggiunge:

- [ ] **33.** Su un **dispositivo touch vero**: il bottone che apre la card
      risponde al dito su tutta la sua superficie, e non ruba il tocco al
      cuore né ai due bottoni quando la card è aperta.
- [ ] **34.** Con la **tastiera**: il Tab arriva sul bottone di apertura, Invio
      lo apre, e il Tab successivo entra su «Dettaglio» — non lo scavalca.
- [ ] **35.** Con un **lettore di schermo**: aprendo la card, l'`aria-expanded`
      viene annunciato, e le due caselle del clima **non** vengono lette
      (`display: none` le toglie dall'albero, ma va sentito).
- [ ] **36.** Una destinazione con **bonus tematico** in classifica mostra
      `+N tema` in ambra accanto al tipo. La prova automatica copre il markup;
      nessuna delle destinazioni in vista durante la verifica aveva un bonus,
      quindi **a schermo non è mai stato visto**.
- [ ] **37.** A **scroll lungo** (novanta risultati): il posizionamento
      assoluto della colonna destra regge anche in fondo alla lista.

---

## Se qualcosa non torna

Annota il numero del controllo e cosa hai visto. I punti 4, 6, 7 e 8 sono
quelli dove il codice fa cose che nessuna prova automatica ha mai eseguito, ed
è lì che vale la pena guardare due volte. Dopo la rimozione del menu laterale
si aggiungono **7-bis**, **7-ter** (i due gestori di `removeFromHistory` e
`clearHistory` non sono mai stati eseguiti, come tutti gli altri `onClick` di
questo lavoro) e **11-bis** (nessuna prova automatica preme un tasto Tab
reale): sono gli stessi rischi di sempre, sulla superficie nuova di oggi.
