import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Notifiche effimere.
 *
 * Ne restano al massimo tre a schermo: oltre, il messaggio più vecchio esce.
 * Una pila che cresce senza limite smette di essere una notifica e diventa un
 * elenco che nessuno legge.
 *
 * Ogni notifica può portare un'azione di annullamento. Serve: aggiungere ai
 * preferiti con un clic su un cuore piccolo è un gesto facile da sbagliare, e
 * "Annulla" costa meno che ritrovare la card e ri-cliccare.
 */
const MAX_VISIBLE = 3

export function useToasts(duration = 3600) {
  const [items, setItems] = useState([])
  const nextId = useRef(0)
  const timers = useRef(new Map())

  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [])

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((toast) => {
    nextId.current += 1
    const id = nextId.current

    setItems((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE))
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
    return id
  }, [duration, dismiss])

  return { items, push, dismiss }
}
