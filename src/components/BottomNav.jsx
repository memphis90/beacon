import { IconEdit, IconHeart, IconScale, IconSearch } from './Icons.jsx'

/** Barra di navigazione inferiore del mockup mobile. Nascosta da CSS su desktop. */
export default function BottomNav({
  onlyFavourites, favouritesCount, compareCount,
  onSearch, onFavourites, onCompare, onEditor,
}) {
  const tabs = [
    { key: 'search', label: 'Cerca', Icon: IconSearch, active: !onlyFavourites, onClick: onSearch },
    { key: 'fav', label: 'Preferiti', Icon: IconHeart, active: onlyFavourites, badge: favouritesCount, onClick: onFavourites },
    { key: 'cmp', label: 'Confronta', Icon: IconScale, badge: compareCount, disabled: compareCount < 2, onClick: onCompare },
    { key: 'edit', label: 'Editor', Icon: IconEdit, onClick: onEditor },
  ]

  return (
    <nav className="bottomnav" aria-label="Navigazione principale">
      {tabs.map(({ key, label, Icon, active, badge, disabled, onClick }) => (
        <button
          key={key}
          type="button"
          aria-current={active ? 'page' : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <span className="bottomnav__icon">
            <Icon filled={active} width="22" height="22" />
            {badge > 0 && <span className="bottomnav__badge">{badge}</span>}
          </span>
          {label}
        </button>
      ))}
    </nav>
  )
}
