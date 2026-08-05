import DestinationImage from './DestinationImage.jsx'
import ScoreBreakdown from './ScoreBreakdown.jsx'
import { IconHeart, IconScale, IconThermo, IconWave } from './Icons.jsx'
import { DESTINATION_TYPES } from '../lib/axes.js'
import { climateSummary } from '../lib/scoring.js'
import { themeLabel } from '../lib/themes.js'
import { countryFlag, countryName, eurRange, temp } from '../lib/format.js'

const typeLabel = (key) => DESTINATION_TYPES.find((t) => t.key === key)?.label || key

export default function DestinationCard({
  entry, rank, criteria, isFavourite, onToggleFavourite, inCompare, onToggleCompare, onOpen,
}) {
  const { destination, scoring, cost } = entry
  const month = climateSummary(destination, criteria.month)
  // Su tutto l'anno i due numeri non sono la stessa cosa: l'aria è una media,
  // il mare è il suo massimo. Etichettarli uguali sarebbe una bugia comoda.
  const annuale = month.scope === 'year'

  return (
    <article className={`card${inCompare ? ' card--selected' : ''}`}>
      {/* Il tocco che apre la scheda è un bottone vero, non un gestore
          appiccicato all'articolo: così esiste anche per la tastiera e si
          annuncia a un lettore di schermo. Copre la card e sta sotto il cuore.
          Sopra i 901px non esiste: lì la card ha il suo bottone "Dettaglio". */}
      <button
        type="button"
        className="card__apri"
        aria-label={`Apri la scheda di ${destination.name}`}
        onClick={onOpen}
      />

      <div className="card__media">
        <DestinationImage destination={destination} />

        {criteria.sortBy === 'score' && scoring.total != null && (
          <div className="card__rank">{rank}º</div>
        )}

        <div className="card__scorepill">
          Punteggio <b>{scoring.total == null ? '—' : scoring.total.toFixed(1)}</b>
          {/* Il perché di una risalita, dove si guarda il punteggio: senza,
              una destinazione che scavalca le altre di otto punti lo fa per
              una ragione che sta solo nel dettaglio. */}
          {scoring.themeBonus > 0 && (
            <em className="card__themebonus" title={`+${scoring.themeBonus} per il tema ${scoring.matchedThemes.map(themeLabel).join(', ')}`}>
              +{scoring.themeBonus} tema
            </em>
          )}
        </div>

        <span className="card__type">{typeLabel(destination.type)}</span>

        <button
          type="button"
          className="card__fav"
          aria-pressed={isFavourite}
          aria-label={isFavourite ? `Togli ${destination.name} dai preferiti` : `Salva ${destination.name} nei preferiti`}
          onClick={(e) => { e.stopPropagation(); onToggleFavourite() }}
        >
          <IconHeart filled={isFavourite} />
        </button>
      </div>

      <div className="card__body">
        <div className="card__ident">
          <h3>{destination.name}</h3>
          <p className="card__where">
            {countryFlag(destination.country)} {countryName(destination.country)}
            {/* La coda della riga esiste solo sotto i 901px, dove il chip del
                tipo sovrapposto alla foto non ha più senso su una miniatura di
                80px e il "+N tema" non entra nella colonna del punteggio.
                Il tipo finisce così scritto due volte nel markup — qui e nel
                chip — ed è il prezzo per non toccare il desktop: le due forme
                sono mutuamente esclusive nel CSS, mai visibili insieme. */}
            <span className="card__meta">
              {' · '}{typeLabel(destination.type).toLowerCase()}
              {scoring.themeBonus > 0 && (
                <em className="card__metabonus">
                  {' · '}+{scoring.themeBonus} tema
                </em>
              )}
            </span>
          </p>
        </div>

        {/* Prezzo e clima affiancati con divisore, come nel mockup desktop.
            Il planning vieta di far passare una stima per un prezzo, e la
            Fase 0 non modella il volo: entrambe le cose vanno dette qui. */}
        <div className="card__head">
          <div className="card__pricebox">
            <span className="card__tilelabel">Costo stimato</span>
            <p className="card__price">{eurRange(cost.low, cost.high)}</p>
            <p className="card__pricenote">
              a persona · {criteria.nights} notti · volo escluso
            </p>
          </div>

          <div className="card__climate">
            <div className="card__tile">
              <IconThermo width="16" height="16" />
              <b>{temp(month.temp_avg)}</b>
              <span>{annuale ? 'aria, media' : 'aria'}</span>
            </div>
            <div className="card__tile">
              <IconWave width="16" height="16" />
              <b>{month.sea_temp == null ? '—' : temp(month.sea_temp)}</b>
              <span>
                {month.sea_temp == null ? 'no mare' : annuale ? 'mare, max' : 'mare'}
              </span>
            </div>
          </div>
        </div>

        <div className="card__interests">
          <span className="card__interestlabel">Interessi</span>
          <ScoreBreakdown scoring={scoring} />
        </div>

        <div className="card__actions">
          <button type="button" className="btn btn--primary btn--grow" onClick={onOpen}>
            Dettaglio
          </button>
          <button type="button" className="btn btn--outline" aria-pressed={inCompare} onClick={onToggleCompare}>
            <IconScale width="16" height="16" />
            {inCompare ? 'Nel confronto' : 'Confronta'}
          </button>
        </div>
      </div>
    </article>
  )
}
