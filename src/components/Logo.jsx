/**
 * Il marchio: otto barre di altezza diversa appoggiate a una linea, con la più
 * alta in ambra.
 *
 * Si legge in due modi, ed è il motivo per cui è questo e non una bussola.
 * Da vicino è la barra segmentata dei contributi — otto assi, ognuno col suo
 * peso: il marchio è il metodo. Da lontano è un profilo contro l'orizzonte,
 * e la barra ambra che lo supera è il **beacon**: l'asse che in quella ricerca
 * pesa più di tutti, il punto verso cui stai andando. Il nome non ripete la
 * forma del logo, ne indica un pezzo.
 *
 * Le barre usano `currentColor`, quindi il marchio si adatta da solo: bianco
 * sulla topbar navy, navy sulla home chiara. L'unica costante è l'ambra, che
 * è la parte che porta il nome e non può cambiare col fondo.
 */

// x, y, altezza. Bordo inferiore a 28.6, cioè dentro la linea: così gli angoli
// arrotondati in basso spariscono sotto l'orizzonte e le barre ci poggiano
// sopra invece di galleggiare.
const BARRE = [
  { x: 2.6, y: 19.0, h: 9.6 },
  { x: 6.05, y: 14.2, h: 14.4 },
  { x: 9.5, y: 21.4, h: 7.2 },
  { x: 12.95, y: 9.4, h: 19.2 },
  { x: 16.4, y: 16.6, h: 12.0 },
  { x: 19.85, y: 5.0, h: 23.6, accento: true },
  { x: 23.3, y: 17.8, h: 10.8 },
  { x: 26.75, y: 12.6, h: 16.0 },
]

export function LogoMark({ width = 28, height = 28, ...rest }) {
  return (
    <svg viewBox="0 0 32 32" width={width} height={height} aria-hidden="true" focusable="false" {...rest}>
      {BARRE.map((b) => (
        <rect
          key={b.x}
          x={b.x} y={b.y} width="2.55" height={b.h} rx="1.27"
          fill={b.accento ? 'var(--accent)' : 'currentColor'}
        />
      ))}
      {/* L'orizzonte sborda di poco dalle barre: continua oltre il profilo. */}
      <path
        d="M3 28.6h26" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" fill="none"
      />
    </svg>
  )
}

/**
 * Marchio e nome insieme. `phase` aggiunge la pastiglia della fase, che sta
 * nel prodotto solo finché la fase è aperta.
 */
export default function Logo({ size = 28, phase = false, phaseClass = '' }) {
  return (
    <>
      <LogoMark width={size} height={size} />
      Beacon
      {phase && <span className={phaseClass}>Fase 0</span>}
    </>
  )
}
