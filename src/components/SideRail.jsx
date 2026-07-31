import { useEffect, useRef, useState } from 'react'
import {
  IconClock, IconEdit, IconFilter, IconHeart, IconLogout, IconPlus,
  IconScale, IconSettings, IconTrash, IconUser,
} from './Icons.jsx'
import { LogoMark } from './Logo.jsx'
import { clearHistory, removeFromHistory, timeAgo } from '../lib/history.js'

/**
 * Cronologia, navigazione e profilo: un solo pannello per la home e per i
 * risultati.
 *
 * Averne uno solo evita che cronologia e navigazione vivano in due posti che
 * poi divergono. Entrambe le pagine lo aprono in `variant="drawer"`, da
 * sinistra e dallo stesso hamburger: lo stesso gesto deve dare lo stesso
 * pannello dallo stesso lato, o si perde l'orientamento passando da una
 * schermata all'altra. `variant="static"` resta la resa a colonna fissa, oggi
 * non usata da nessuna pagina.
 */
export default function SideRail({
  variant = 'static',
  open = false,
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

  const isDrawer = variant === 'drawer'

  return (
    <aside
      id="side-rail"
      className={`hside${isDrawer ? ' hside--drawer' : ''}${isDrawer && open ? ' hside--open' : ''}`}
      aria-label="Cronologia e menu"
      aria-hidden={isDrawer && !open}
    >
      <div className="hside__head">
        <span className="hside__brand"><LogoMark width="22" height="22" /> Beacon</span>
        <span className="landing__phase">Fase 0</span>
        {isDrawer && (
          <button type="button" className="panel__close" onClick={onClose} aria-label="Chiudi">×</button>
        )}
      </div>

      {nav && (
        <nav className="hside__nav">
          <button type="button" onClick={nav.onNewSearch}>
            <IconPlus width="17" height="17" />
            Nuova ricerca
          </button>
          <button type="button" aria-pressed={nav.onlyFavourites} onClick={nav.onFavourites}>
            <IconHeart filled={nav.onlyFavourites} width="17" height="17" />
            Preferiti
            {nav.favouritesCount > 0 && <span className="hside__count">{nav.favouritesCount}</span>}
          </button>
          <button type="button" disabled={nav.compareCount < 2} onClick={nav.onCompare}>
            <IconScale width="17" height="17" />
            Confronta
            {nav.compareCount > 0 && <span className="hside__count">{nav.compareCount}</span>}
          </button>
          <button type="button" onClick={nav.onEditor}>
            <IconEdit width="17" height="17" />
            Editor
            {nav.overriddenCount > 0 && <span className="hside__count">{nav.overriddenCount}</span>}
          </button>
        </nav>
      )}

      {/* Rientro rapido dalla home: senza il vecchio "Salta e usa i filtri" la
          frase sarebbe l'unico modo di entrare, e chi sa già cosa cercare
          dovrebbe scriverne una finta per arrivare agli slider. */}
      {onSkipToFilters && (
        <nav className="hside__nav">
          <button type="button" onClick={onSkipToFilters}>
            <IconFilter width="17" height="17" />
            Vai ai filtri, senza frase
          </button>
        </nav>
      )}

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

      <div className="hside__profile" ref={profileRef}>
        <button
          type="button"
          className="hside__profilebtn"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="hside__avatar"><IconUser width="18" height="18" /></span>
          <span className="hside__who">
            <strong>Profilo locale</strong>
            <small>{agent?.enabled ? `modello · ${agent.model}` : 'regole locali'}</small>
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
