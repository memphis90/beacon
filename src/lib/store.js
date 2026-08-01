/**
 * Seed + override.
 *
 * §7 del planning: "persistenza override manuali: file separato, mai
 * sovrascritto dagli script di import". Qui l'invariante è speculare:
 * l'app non scrive MAI su data/destinations.json. Le modifiche dell'editor
 * vivono in un layer separato, e il seed resta la baseline con cui
 * confrontarle.
 */
import seedFile from '../../data/destinations.json'

export const STORAGE_KEY = 'destination-finder:overrides:v1'
export const SEED = seedFile.destinations

export function emptyOverrides() {
  return { version: 1, destinations: {} }
}

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyOverrides()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.destinations) return emptyOverrides()
    return parsed
  } catch {
    // Un override corrotto non deve impedire di consultare il seed.
    return emptyOverrides()
  }
}

export function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    return true
  } catch {
    return false
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return patch
  const out = isPlainObject(base) ? { ...base } : {}
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) ? deepMerge(out[key], value) : value
  }
  return out
}

/** Seed con gli override applicati sopra, più le destinazioni create ex novo. */
export function mergedDestinations(overrides) {
  const patches = overrides?.destinations || {}
  const merged = SEED.map((dest) =>
    patches[dest.id] ? deepMerge(dest, patches[dest.id]) : dest
  )
  const seedIds = new Set(SEED.map((d) => d.id))
  for (const [id, patch] of Object.entries(patches)) {
    if (!seedIds.has(id) && patch.__new) merged.push({ ...patch, id })
  }
  return merged
}

export function seedById(id) {
  return SEED.find((d) => d.id === id) || null
}

/** Un campo è "modificato" se compare nel patch di override per quella destinazione. */
export function isOverridden(overrides, id, path) {
  let node = overrides?.destinations?.[id]
  for (const key of path) {
    if (!isPlainObject(node) || !(key in node)) return false
    node = node[key]
  }
  return node !== undefined
}

export function setOverride(overrides, id, path, value) {
  const next = { ...overrides, destinations: { ...overrides.destinations } }
  const dest = { ...(next.destinations[id] || {}) }
  next.destinations[id] = dest

  let node = dest
  for (let i = 0; i < path.length - 1; i += 1) {
    node[path[i]] = isPlainObject(node[path[i]]) ? { ...node[path[i]] } : {}
    node = node[path[i]]
  }
  node[path[path.length - 1]] = value
  return next
}

/** Rimuove un singolo campo dall'override: il valore torna a quello del seed. */
export function clearOverride(overrides, id, path) {
  const patch = overrides?.destinations?.[id]
  if (!patch) return overrides

  const next = { ...overrides, destinations: { ...overrides.destinations } }
  const cloned = structuredClone(patch)
  let node = cloned
  for (let i = 0; i < path.length - 1; i += 1) {
    if (!isPlainObject(node[path[i]])) return overrides
    node = node[path[i]]
  }
  delete node[path[path.length - 1]]

  prune(cloned)
  if (Object.keys(cloned).length === 0) delete next.destinations[id]
  else next.destinations[id] = cloned
  return next
}

function prune(node) {
  for (const [key, value] of Object.entries(node)) {
    if (isPlainObject(value)) {
      prune(value)
      if (Object.keys(value).length === 0) delete node[key]
    }
  }
}

export function clearDestinationOverrides(overrides, id) {
  const next = { ...overrides, destinations: { ...overrides.destinations } }
  delete next.destinations[id]
  return next
}

/**
 * Quanti campi sono stati toccati su una destinazione: le foglie del patch.
 *
 * Serve all'elenco dell'editor, dove "modificata" da solo non dice se hai
 * corretto un punteggio o riscritto mezza scheda — ed è la differenza fra
 * ricordarsi cosa si è fatto e doverla riaprire per scoprirlo.
 */
export function countOverriddenFields(overrides, id) {
  const patch = overrides?.destinations?.[id]
  if (!isPlainObject(patch)) return 0

  let foglie = 0
  const visita = (node) => {
    for (const [key, value] of Object.entries(node)) {
      // Marcatore interno delle destinazioni create ex novo: non è un campo
      // che l'utente ha compilato.
      if (key === '__new') continue
      if (isPlainObject(value)) visita(value)
      else foglie += 1
    }
  }
  visita(patch)
  return foglie
}

export function countOverriddenDestinations(overrides) {
  return Object.keys(overrides?.destinations || {}).length
}

export function downloadOverrides(overrides) {
  const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'overrides.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function parseOverridesFile(text) {
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || !isPlainObject(parsed.destinations)) {
    throw new Error('File non valido: manca l’oggetto "destinations".')
  }
  return { version: parsed.version || 1, destinations: parsed.destinations }
}
