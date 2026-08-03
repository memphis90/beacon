import { IconHeart, IconPin, IconPlus, IconScale, IconSettings } from './Icons.jsx'

/**
 * La barra inferiore, identica nelle due schermate.
 *
 * Cinque slot, e quello di mezzo non è un sesto tab: è il «ricomincia», e
 * sporge sopra il bordo perché è l'unico modo di dire "questo non è come gli
 * altri quattro" senza scriverlo.
 *
 * Non è l'invio, ed è stata una scelta rivista: da invio, il centro
 * significava "manda" sulla ricerca e "riapri il composer" nei risultati —
 * un pulsante, due gesti. Così invece la dock è tutta navigazione, e la
 * freccia sta nel composer, dove qualunque interfaccia a prompt la mette.
 *
 * `hasResults` è falso solo alla prima apertura, prima che una ricerca esista:
 * Preferiti e Confronta lavorano sul ranking, e senza ranking non hanno
 * niente da mostrare. Restano visibili e spenti invece di sparire — una dock
 * che cambia forma fra le due schermate non sarebbe più la stessa dock, che è
 * tutto il motivo per cui esiste così.
 *
 * Elenco no: nei risultati porta all'elenco che già c'è, sulla home a
 * sfogliarlo tutto senza frase — un percorso che non ha bisogno di un
 * ranking preesistente, quindi resta acceso anche a `hasResults` falso.
 * Stessa icona della voce omonima nella barra laterale (`IconPin`): sono la
 * stessa azione raggiunta da due strade.
 */
export default function BottomNav({
  onlyFavourites, favouritesCount, compareCount, hasResults = true,
  onNew, newDisabled = false,
  onList, onFavourites, onCompare, onSettings,
}) {
  // `fillable` esiste perché solo il cuore ha una versione piena: passare
  // `filled` a tutte le icone lo faceva finire come attributo sull'`svg`, e
  // React lo segnalava a ogni render.
  const sinistra = [
    { key: 'list', label: 'Elenco', Icon: IconPin, active: hasResults && !onlyFavourites, onClick: onList },
    { key: 'fav', label: 'Preferiti', Icon: IconHeart, fillable: true, active: hasResults && onlyFavourites, badge: favouritesCount, disabled: !hasResults, onClick: onFavourites },
  ]
  const destra = [
    { key: 'cmp', label: 'Confronta', Icon: IconScale, badge: compareCount, disabled: !hasResults || compareCount < 2, onClick: onCompare },
    { key: 'set', label: 'Impostazioni', Icon: IconSettings, onClick: onSettings },
  ]

  const tab = ({ key, label, Icon, fillable, active, badge, disabled, onClick }) => (
    <button
      key={key}
      type="button"
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="bottomnav__icon">
        <Icon {...(fillable ? { filled: active } : {})} width="22" height="22" />
        {badge > 0 && <span className="bottomnav__badge">{badge}</span>}
      </span>
      {label}
    </button>
  )

  return (
    <nav className="bottomnav" aria-label="Navigazione principale">
      {sinistra.map(tab)}

      <button
        type="button"
        className="bottomnav__new"
        disabled={newDisabled}
        onClick={onNew}
      >
        <span className="bottomnav__newdisc">
          <IconPlus width="26" height="26" />
        </span>
        Nuova
      </button>

      {destra.map(tab)}
    </nav>
  )
}
