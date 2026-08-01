/**
 * Barra segmentata del punteggio — impianto del mockup Stitch.
 *
 * Un segmento per asse, SEMPRE nello stesso ordine: con 8 assi e 3 colori il
 * colore non può portare l'identità dell'asse, quindi la porta la posizione.
 * Il colore codifica il livello del punteggio (alto / medio / basso), e il
 * grigio segnala un asse con peso 0, cioè escluso dal calcolo.
 *
 * La diagnosi vera — "quale asse ha prodotto questo totale" — sta nella riga
 * dell'asse guida qui sotto e nella tabella dell'aritmetica del dettaglio.
 * §5 del planning resta soddisfatto lì, non qui.
 */
import { themeLabel } from '../lib/themes.js'

function band(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

export default function ScoreBreakdown({ scoring, tall = false, showLegend = true }) {
  if (scoring.total == null) {
    return <p className="segbar__caption">Nessun peso impostato: non c’è un ranking.</p>
  }

  const active = scoring.contributions.filter((c) => c.weight > 0)
  const leader = active.length
    ? active.reduce((best, c) => (c.contribution > best.contribution ? c : best))
    : null

  return (
    <div className={`segbar-wrap${tall ? ' segbar-wrap--tall' : ''}`}>
      <div
        className="segbar"
        role="img"
        aria-label={
          active.length
            ? `Punteggio ${scoring.total.toFixed(1)}. ` +
              active.map((c) => `${c.label} ${c.score}`).join(', ') +
              (scoring.themeBonus > 0 ? `. Più ${scoring.themeBonus} punti di tema` : '')
            : 'Nessun asse attivo'
        }
      >
        {scoring.contributions.map((c) => (
          <span
            key={c.key}
            className={`segbar__seg segbar__seg--${c.weight === 0 ? 'off' : band(c.score)}`}
            title={
              c.weight === 0
                ? `${c.label} — peso 0, non conta`
                : `${c.label} — peso ${c.weight} × punteggio ${c.score} = ${c.contribution.toFixed(1)} punti`
            }
          />
        ))}
      </div>

      {showLegend && (
        <p className="segbar__caption">
          {leader ? (
            <>
              Asse guida <b style={{ color: 'var(--ink)' }}>{leader.label}</b>{' '}
              {leader.contribution.toFixed(1)} pt · {active.length} assi su 8
            </>
          ) : (
            'Nessun asse attivo'
          )}
          {/* Il bonus tematico non entra nella barra: la barra è la media
              pesata degli assi, e infilarci dentro un'aggiunta che non viene
              da un asse renderebbe illeggibili entrambe le cose. Sta scritto
              accanto, come somma esplicita. */}
          {scoring.themeBonus > 0 && (
            <>
              {' · '}
              <b style={{ color: 'var(--ink)' }}>
                {scoring.base.toFixed(1)} + {scoring.themeBonus} tema{' '}
                {scoring.matchedThemes.map(themeLabel).join(' e ').toLowerCase()}
              </b>
            </>
          )}
        </p>
      )}
    </div>
  )
}
