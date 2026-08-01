import { useEffect, useRef, useState } from 'react'
import {
  IconClock, IconEdit, IconFilter, IconHeart, IconLogout, IconMenu, IconPlus,
  IconScale, IconSettings, IconTrash, IconUser,
} from './Icons.jsx'
import { LogoMark } from './Logo.jsx'
import { clearHistory, removeFromHistory, timeAgo } from '../lib/history.js'
import { activeProfile, agentIsReady, profileLabel } from '../lib/agent.js'

/**
 * Cronologia, navigazione e profilo: una barra sola per la home e i risultati.
 *
 * **Non sparisce mai.** Chiusa resta una colonna di icone larga quanto un
 * bersaglio; aperta si allarga e mostra le etichette e la cronologia per
 * esteso. Prima era un cassetto che usciva e rientrava, e da chiuso non
 * lasciava traccia: le uniche vie per Preferiti, Confronta ed Editor erano
 * dietro un hamburger, cioè invisibili finché non le cercavi. Una riga di
 * icone costa 64px e le tiene sotto il pollice.
 *
 * Sotto i 900px torna un cassetto: 64px di colonna su uno schermo stretto sono
 * un decimo della larghezza, e lì le stesse voci stanno già nella bottom nav.
 *
 * Il marchio sta in cima alla barra; il nome "Beacon" no — quello vive nella
 * barra in alto, accanto all'hamburger. Sono la stessa cosa in due pezzi, e
 * l'angolo in alto a sinistra li rimette insieme.
 */
export default function SideRail({
  open = false,
  onOpen,
  onClose,
  history,
  onHistoryChange,
  onPickHistory,
  agent,
  onOpenSettings,
  onLogout,
  nav,
  onSkipToFilters,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const profileRef = useRef(null)

  // Il menu del profilo si chiude cliccando altrove o con Esc: senza, resta
  // aperto alle spalle di qualunque cosa si faccia dopo.
  useEffect(() => {
    if (!menuOpen) return
    const viaClic = (e) => { if (!profileRef.current?.contains(e.target)) setMenuOpen(false) }
    const viaTasto = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', viaClic)
    document.addEventListener('keydown', viaTasto)
    return () => {
      document.removeEventListener('mousedown', viaClic)
      document.removeEventListener('keydown', viaTasto)
    }
  }, [menuOpen])

  // Richiudendo la barra il menu del profilo non deve restare aperto: da
  // chiusa uscirebbe da una colonna di 64px, sospeso sul nulla.
  useEffect(() => { if (!open) setMenuOpen(false) }, [open])

  /**
   * Una voce della barra: icona sempre, etichetta solo da aperta.
   * `fillable` perché solo il cuore ha una versione piena — passare `filled`
   * alle altre icone lo farebbe finire come attributo sull'`svg`.
   */
  const Voce = ({ Icon, label, count, pressed, fillable, disabled, onClick, danger }) => (
    <button
      type="button"
      className={danger ? 'hside__menudanger' : undefined}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      // Da chiusa l'etichetta è nascosta: il title è l'unico modo per sapere
      // cosa fa un'icona prima di premerla.
      title={open ? undefined : label}
    >
      <Icon width="19" height="19" {...(fillable ? { filled: pressed } : {})} />
      <span className="hside__label">{label}</span>
      {count > 0 && <span className="hside__count">{count}</span>}
    </button>
  )

  return (
    <aside
      id="side-rail"
      className={`hside hside--rail${open ? ' hside--open' : ''}`}
      aria-label="Cronologia e menu"
    >
      {/* Il faro È il comando che apre e chiude.
          Fermo mostra il marchio; sotto il puntatore diventa l'hamburger, che
          è il segno universale per "qui si apre". Due bersagli separati —
          marchio inerte più hamburger accanto — sarebbero due cose nello
          stesso angolo che fanno quasi la stessa cosa. */}
      <div className="hside__head">
        <button
          type="button"
          className="hside__toggle"
          aria-expanded={open}
          aria-controls="side-rail"
          onClick={() => (open ? onClose() : onOpen())}
          title={open ? 'Chiudi la barra' : 'Apri la barra'}
        >
          <span className="hside__mark"><LogoMark width="26" height="26" beams={false} /></span>
          <span className="hside__burger"><IconMenu width="22" height="22" /></span>
          <span className="visually-hidden">{open ? 'Chiudi la barra' : 'Apri la barra'}</span>
        </button>
        <span className="hside__label landing__phase">Fase 0</span>
      </div>

      {/* Un blocco solo, e ogni voce compare se il chiamante la passa: due
          `nav` separati mettevano le icone della home a un'altezza diversa da
          quelle dei risultati, e passando da una schermata all'altra la stessa
          colonna si spostava sotto il puntatore. */}
      <nav className="hside__nav">
        {nav?.onNewSearch && (
          <Voce Icon={IconPlus} label="Nuova ricerca" onClick={nav.onNewSearch} />
        )}
        {nav?.onFavourites && (
          <Voce
            Icon={IconHeart} label="Preferiti" fillable
            count={nav.favouritesCount} pressed={nav.onlyFavourites}
            onClick={nav.onFavourites}
          />
        )}
        {nav?.onCompare && (
          <Voce
            Icon={IconScale} label="Confronta"
            count={nav.compareCount} disabled={nav.compareCount < 2}
            onClick={nav.onCompare}
          />
        )}
        {/* "Parametri" e non "Editor": dice cosa si cambia là dentro —
            punteggi, costi, clima — mentre "Editor" dice solo che si può
            scrivere. E non "Configurazioni", che si confonderebbe con le
            Impostazioni del modello, che sono un'altra cosa. */}
        {nav?.onEditor && (
          <Voce Icon={IconEdit} label="Parametri" count={nav.overriddenCount} onClick={nav.onEditor} />
        )}

        {/* Rientro rapido dalla home: senza il vecchio "Salta e usa i filtri"
            la frase sarebbe l'unico modo di entrare, e chi sa già cosa cercare
            dovrebbe scriverne una finta per arrivare agli slider. */}
        {onSkipToFilters && (
          <Voce Icon={IconFilter} label="Vai ai filtri, senza frase" onClick={onSkipToFilters} />
        )}
      </nav>

      {/* Da chiusa la cronologia è un'icona che apre la barra: l'elenco delle
          frasi ha bisogno di larghezza per essere leggibile, e troncato a 64px
          non direbbe niente. Il numero sull'icona dice che c'è qualcosa. */}
      {!open ? (
        <nav className="hside__nav">
          <Voce Icon={IconClock} label="Cronologia" count={history.length} onClick={onOpen} />
        </nav>
      ) : (
        <div className="hside__section">
          <p className="hside__title">
            <IconClock width="14" height="14" />
            Cronologia
            {history.length > 0 && (
              <button
                type="button"
                className="hside__clear"
                onClick={() => onHistoryChange(clearHistory())}
                title="Svuota la cronologia"
              >
                Svuota
              </button>
            )}
          </p>

          {history.length === 0 ? (
            <p className="hside__empty">
              Le ricerche che fai restano qui, su questo computer. Nessuna ancora.
            </p>
          ) : (
            <ul className="hside__list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="hside__item" onClick={() => onPickHistory(entry)}>
                    <span className="hside__text">{entry.text}</span>
                    <span className="hside__meta">{timeAgo(entry.at)} · {entry.source}</span>
                  </button>
                  <button
                    type="button"
                    className="hside__remove"
                    onClick={() => onHistoryChange(removeFromHistory(history, entry.id))}
                    aria-label={`Rimuovi "${entry.text}" dalla cronologia`}
                  >
                    <IconTrash width="14" height="14" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="hside__profile" ref={profileRef}>
        <button
          type="button"
          className="hside__profilebtn"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
          title={open ? undefined : 'Profilo locale'}
        >
          <span className="hside__avatar"><IconUser width="18" height="18" /></span>
          <span className="hside__who hside__label">
            <strong>Profilo locale</strong>
            <small>
              {agentIsReady(agent) ? `modello · ${profileLabel(activeProfile(agent))}` : 'regole locali'}
            </small>
          </span>
        </button>

        {menuOpen && (
          <div className="hside__menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); onOpenSettings() }}
            >
              <IconSettings width="17" height="17" />
              Impostazioni
            </button>
            <button
              type="button"
              role="menuitem"
              className="hside__menudanger"
              onClick={() => { setMenuOpen(false); onLogout() }}
            >
              <IconLogout width="17" height="17" />
              Esci e azzera i dati
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
