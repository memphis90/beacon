/**
 * Le due schede in cima al pannello mobile delle impostazioni.
 *
 * Esistono solo su mobile, dove la dock ha uno slot solo per due cose che su
 * desktop si aprono da due posti diversi. Il pannello parte dai Parametri
 * perché è quello che si ritocca spesso; il Modello si tocca una volta e poi
 * più, e paga il secondo tocco.
 *
 * Non fondono i due componenti: sono una striscia, e chi la disegna sceglie
 * quale dei due montare sotto.
 */
export default function PanelTabs({ active, onPick }) {
  const schede = [
    { key: 'parametri', label: 'Parametri' },
    { key: 'modello', label: 'Modello' },
  ]

  return (
    <div className="paneltabs" role="tablist" aria-label="Impostazioni">
      {schede.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          className={active === key ? 'paneltabs__tab is-active' : 'paneltabs__tab'}
          onClick={() => onPick(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
