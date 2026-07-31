import { useState } from 'react'

/**
 * Footer del mockup desktop, con le sue quattro voci.
 *
 * Ognuna apre contenuto reale invece di puntare a una pagina che non esiste:
 * in uno strumento personale e locale "Privacy" e "Termini" hanno una risposta
 * vera e breve, e vale la pena scriverla piuttosto che lasciare un link morto.
 */
const PAGES = {
  privacy: {
    title: 'Privacy',
    body: [
      'Nessun dato lascia questo computer. Non c’è un server, non c’è un account, non c’è analitica.',
      'I criteri di ricerca, i preferiti e le modifiche fatte nell’editor vivono in `localStorage`, cioè nel browser di questa macchina. Svuotare i dati del sito li cancella; esportare `overrides.json` dall’editor li mette al sicuro.',
      'Le uniche chiamate verso l’esterno sono le tile della mappa da OpenStreetMap e le foto ospitate su Wikimedia Commons. Entrambe partono solo quando apri la vista che le usa, ed entrambe hanno un ripiego che funziona offline. I font sono serviti dal progetto: nessuna richiesta a Google Fonts.',
    ],
  },
  termini: {
    title: 'Termini',
    body: [
      'Strumento informativo per uso personale. Non vende nulla, non prenota nulla, non si collega a nessun sistema di pagamento.',
      'La scelta di restare sul lato informativo è deliberata e non è una limitazione temporanea: agevolare l’acquisto combinato di due o più servizi turistici — per esempio volo e alloggio — nello stesso processo farebbe ricadere lo strumento nella Direttiva UE 2015/2302, con gli obblighi che spettano a un tour operator.',
      'I costi mostrati sono stime, non prezzi, e per questo appaiono sempre come fasce. Il costo del volo non è modellato: un budget impostato qui copre alloggio, cibo e trasporti locali, nient’altro.',
    ],
  },
  metodologia: {
    title: 'Metodologia',
    body: [
      'Il punteggio è una media pesata: si sommano i punteggi dei singoli assi moltiplicati per il peso che hai dato a ciascuno, e si divide per la somma dei pesi. Un asse con peso zero non entra nel calcolo.',
      'Prima dello scoring agiscono i filtri duri, che escludono invece di penalizzare: temperatura del mare nel mese scelto, tetto di spesa, tipo di destinazione. Il mare a dicembre non è mare con un punteggio più basso — non è mare. Le destinazioni escluse sono sempre elencate con il motivo.',
      'Il principio è la debuggabilità, non l’accuratezza: quando un risultato ti sorprende devi poter vedere subito quale asse l’ha prodotto. Per questo ogni card mostra l’asse guida e il dettaglio riporta l’aritmetica completa.',
      'I punteggi degli assi, i costi e i dati climatici del seed sono stime iniziali, non misure. Servono a essere corretti da te con l’editor: è quella correzione il vero test dello strumento.',
    ],
  },
  supporto: {
    title: 'Supporto',
    body: [
      'Non c’è un servizio di assistenza: questo è un progetto personale che gira sulla tua macchina.',
      'La documentazione è nel repository: `README.md` per l’avvio e la struttura, `PLANNING.md` per gli obiettivi e i vincoli, e la cartella `docs/` per le decisioni di progetto e il perché di ciascuna.',
      'Se il ranking contraddice il tuo giudizio, il posto da guardare è la tabella dell’aritmetica nel dettaglio: mostra quale asse ha prodotto il totale. La correzione si fa nell’editor, sui punteggi di quell’asse.',
    ],
  },
}

export default function SiteFooter() {
  const [page, setPage] = useState(null)
  const current = page ? PAGES[page] : null

  return (
    <>
      <footer className="sitefooter">
        <nav aria-label="Informazioni">
          {Object.entries(PAGES).map(([key, { title }]) => (
            <button key={key} type="button" onClick={() => setPage(key)}>
              {title}
            </button>
          ))}
        </nav>
        <p>Strumento personale · Fase 0 · nessun dato lascia questo computer</p>
      </footer>

      {current && (
        <div className="overlay overlay--center" onClick={() => setPage(null)} role="presentation">
          <section
            className="panel panel--info"
            role="dialog"
            aria-modal="true"
            aria-label={current.title}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="panel__head">
              <h2>{current.title}</h2>
              <button type="button" className="panel__close" onClick={() => setPage(null)} aria-label="Chiudi">
                ×
              </button>
            </header>
            <div className="panel__body">
              {current.body.map((paragraph, index) => (
                <p key={index} className="infotext">{paragraph}</p>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
