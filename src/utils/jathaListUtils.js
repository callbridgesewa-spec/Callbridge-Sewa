import defaultDepartments from '../data/jathaDepartments.json'
import defaultAreas from '../data/jathaAreas.json'

export const DEFAULT_DEPARTMENTS = [...(defaultDepartments.departments ?? [])]
export const DEFAULT_AREAS = [...(defaultAreas.areas ?? [])]
export const DEFAULT_VISIT_OPTIONS = []

export function normalizeName(value) {
  return String(value ?? '').trim()
}

export function dedupeSorted(items) {
  const seen = new Set()
  const out = []
  for (const raw of items) {
    const name = normalizeName(raw)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/** Read list from badge document attribute (JSON string or array). */
export function parseListField(doc, keys) {
  if (!doc || typeof doc !== 'object') return null
  for (const key of keys) {
    const raw = doc[key]
    if (raw === undefined || raw === null) continue
    if (Array.isArray(raw)) return dedupeSorted(raw)
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return dedupeSorted(parsed)
      } catch {
        if (trimmed.includes(',')) {
          return dedupeSorted(trimmed.split(',').map((s) => s.trim()))
        }
        return dedupeSorted([trimmed])
      }
    }
  }
  return null
}

/** Serialize list for Appwrite string attribute. */
export function serializeListForDb(items) {
  return JSON.stringify(dedupeSorted(items))
}

export function addToList(list, name) {
  const trimmed = normalizeName(name)
  if (!trimmed) return { list, added: false, error: 'Name cannot be empty.' }
  const key = trimmed.toLowerCase()
  if (list.some((item) => item.toLowerCase() === key)) {
    return { list, added: false, error: 'Already in the list.' }
  }
  return { list: dedupeSorted([...list, trimmed]), added: true, error: '' }
}

export function removeFromList(list, name) {
  const key = normalizeName(name).toLowerCase()
  return dedupeSorted(list.filter((item) => item.toLowerCase() !== key))
}
