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

## Se qualcosa non torna

Annota il numero del controllo e cosa hai visto. I punti 4, 6, 7 e 8 sono
quelli dove il codice fa cose che nessuna prova automatica ha mai eseguito, ed
è lì che vale la pena guardare due volte. Dopo la rimozione del menu laterale
si aggiungono **7-bis**, **7-ter** (i due gestori di `removeFromHistory` e
`clearHistory` non sono mai stati eseguiti, come tutti gli altri `onClick` di
questo lavoro) e **11-bis** (nessuna prova automatica preme un tasto Tab
reale): sono gli stessi rischi di sempre, sulla superficie nuova di oggi.
