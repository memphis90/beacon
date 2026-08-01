/**
 * Il marchio: un faro stilizzato, disegnato a tratto.
 *
 * Prima erano otto barre appoggiate a una linea — la barra segmentata dei
 * contributi, cioè il metodo reso in forma. Era vero ma non era leggibile: un
 * grafico a barre come marchio si legge come "dati", e la parte che portava il
 * nome — la barra ambra, il *beacon* — la vedeva solo chi già sapeva di doverla
 * cercare.
 *
 * Il faro dice la stessa cosa senza chiedere di essere spiegato: un punto fisso
 * che si guarda per orientarsi, non una destinazione dove si va. È l'esatto
 * mestiere di questo strumento, che non prenota niente e non porta da nessuna
 * parte: fa vedere dove sei rispetto a quello che cerchi.
 *
 * **L'ambra è la luce**, e resta l'unico colore fisso. Il resto del disegno è in
 * `currentColor`, quindi il marchio si adatta da solo: bianco sulla topbar navy,
 * navy sulla home chiara. La luce non si adatta perché è la cosa che si deve
 * vedere per prima, e un faro spento non è un faro.
 *
 * Perché la lanterna non ha pareti: a 26px una parete verticale a due pixel
 * accanto alla luce le si incolla addosso e il vetro diventa una macchia. Il
 * tetto e la balconata bastano a chiudere la forma, e l'occhio completa il
 * resto.
 */
export function LogoMark({ width = 28, height = 28, beams = true, ...rest }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {/* L'orizzonte, più largo della torre: continua oltre il disegno. */}
      <path d="M4.5 27.6h23" />

      {/* I due fianchi della torre, che convergono salendo. Non è un
          rettangolo: la rastremazione è ciò che rende un faro un faro e non
          una ciminiera. */}
      <path d="M10.2 27.6 12.9 15.2" />
      <path d="M21.8 27.6 19.1 15.2" />

      {/* La balconata: chiude la torre e regge la lanterna. */}
      <path d="M11.6 15.2h8.8" />

      {/* Il tetto, aperto in basso: la lanterna la chiude la balconata. */}
      <path d="M12.4 9.6 16 5.8 19.6 9.6" />

      {/* La luce. Unico elemento pieno e unico colore fisso di tutto il
          marchio: è la parte che porta il nome. */}
      <circle cx="16" cy="12.2" r="1.7" fill="var(--accent)" stroke="none" />

      {/* I fasci. Si tolgono con `beams={false}` dove il disegno è piccolo:
          sotto una certa dimensione due trattini obliqui non si leggono come
          luce, si leggono come sporco. */}
      {beams && (
        <g stroke="var(--accent)" strokeWidth="1.7">
          <path d="M20.4 11.1 24.6 9.4" />
          <path d="M11.6 11.1 7.4 9.4" />
        </g>
      )}
    </svg>
  )
}

/* Non c'è più un componente "marchio + nome": i due pezzi vivono in due posti
 * diversi — il faro in cima alla barra laterale, il nome nella barra in alto —
 * e tenerli insieme in un componente che nessuno usava avrebbe suggerito il
 * contrario a chi legge il codice. */
