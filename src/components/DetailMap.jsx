import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pinIcon = (n) =>
  L.divIcon({ className: '', iconSize: [24, 24], iconAnchor: [12, 12], html: `<span class="mapmarker">${n}</span>` })

/**
 * I colori dei marker vengono dai design token, non da hex scritti qui.
 * Leaflet disegna il cerchio centrale come SVG con attributi di presentazione,
 * quindi il valore va passato: non basta una classe.
 */
const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Mappa del solo dettaglio.
 *
 * I POI mostrati sono curati a mano nel dato: non è un generatore di itinerari,
 * che il planning colloca in Fase 3.
 *
 * Le tile arrivano da OpenStreetMap: l'attribuzione è obbligatoria per licenza
 * ODbL, non decorativa. Senza rete la mappa resta vuota e il resto del pannello
 * continua a funzionare.
 */
export default function DetailMap({ destination }) {
  const container = useRef(null)

  useEffect(() => {
    const map = L.map(container.current, { scrollWheelZoom: false })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const center = [destination.coords.lat, destination.coords.lon]
    const points = [center]

    L.circleMarker(center, {
      radius: 7,
      weight: 3,
      color: token('--surface-container-lowest') || '#ffffff',
      fillColor: token('--accent') || '#f59e0b',
      fillOpacity: 1,
      className: 'mapmarker--origin',
    })
      .addTo(map)
      .bindTooltip(destination.name, { direction: 'top' })

    ;(destination.pois || []).forEach((poi, index) => {
      const point = [poi.lat, poi.lon]
      points.push(point)
      L.marker(point, { icon: pinIcon(index + 1) })
        .addTo(map)
        .bindTooltip(`${poi.name} — ${poi.kind}`, { direction: 'top' })
    })

    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.25))
    else map.setView(center, 10)

    return () => map.remove()
  }, [destination.id, destination.pois, destination.coords.lat, destination.coords.lon])

  return <div className="map" ref={container} />
}
