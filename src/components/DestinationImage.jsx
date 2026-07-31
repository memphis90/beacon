import { useEffect, useState } from 'react'
import { resolveImage } from '../lib/images.js'
import { initials } from '../lib/format.js'

/**
 * Il fallback non è un placeholder d'errore.
 *
 * Senza rete l'app deve restare pienamente usabile e presentabile, quindi
 * quando la foto manca disegniamo un'alternativa grafica dignitosa invece di
 * un rettangolo rotto.
 */
const GRADIENTS = {
  city: ['#123f66', '#2a78d6'],
  area: ['#14512c', '#3f9c5c'],
  island: ['#0c5265', '#1baf7a'],
}

function FallbackArt({ destination }) {
  const [from, to] = GRADIENTS[destination.type] || GRADIENTS.city
  const gradientId = `grad-${destination.id}`
  return (
    <svg viewBox="0 0 400 220" role="img" aria-label={destination.name} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#${gradientId})`} />
      <path d="M0 168 Q70 132 140 156 T290 142 T400 164 L400 220 L0 220 Z" fill="rgba(255,255,255,.13)" />
      <path d="M0 190 Q90 162 180 182 T400 178 L400 220 L0 220 Z" fill="rgba(255,255,255,.10)" />
      <text
        x="200" y="108" textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,.9)" fontSize="62" fontWeight="700"
        fontFamily="system-ui, sans-serif" letterSpacing="2"
      >
        {initials(destination.name)}
      </text>
    </svg>
  )
}

export default function DestinationImage({ destination }) {
  const [url, setUrl] = useState(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let alive = true
    setUrl(null)
    setBroken(false)
    resolveImage(destination).then((resolved) => {
      if (alive) setUrl(resolved)
    })
    return () => { alive = false }
  }, [destination.id, destination.wikipedia_title, destination.wikipedia_title_en])

  if (!url || broken) return <FallbackArt destination={destination} />

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  )
}
