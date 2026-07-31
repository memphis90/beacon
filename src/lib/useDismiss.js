import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ritarda la chiusura di un pannello quel tanto che basta all'animazione di
 * uscita.
 *
 * Senza questo React smonta il nodo nell'istante in cui lo stato cambia, e
 * un'animazione di uscita non ha nulla su cui girare: l'elemento è già sparito.
 * Il ciclo diventa: marca "in chiusura" → il CSS anima → allo scadere chiude
 * davvero.
 *
 * Con `prefers-reduced-motion: reduce` la chiusura è immediata: chi ha chiesto
 * meno movimento non deve aspettare un'animazione che non vedrà.
 */
export function useDismiss(close, duration = 200) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  const latestClose = useRef(close)

  latestClose.current = close

  useEffect(() => () => clearTimeout(timer.current), [])

  const dismiss = useCallback(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      latestClose.current()
      return
    }

    clearTimeout(timer.current)
    setClosing(true)
    timer.current = setTimeout(() => {
      setClosing(false)
      latestClose.current()
    }, duration)
  }, [duration])

  return { closing, dismiss }
}
