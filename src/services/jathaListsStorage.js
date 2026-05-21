import defaultDepartments from '../data/jathaDepartments.json'
import defaultAreas from '../data/jathaAreas.json'

const STORAGE_KEY = 'cb-jatha-lists-v1'

export const DEFAULT_DEPARTMENTS = [...(defaultDepartments.departments ?? [])]
export const DEFAULT_AREAS = [...(defaultAreas.areas ?? [])]

function normalizeName(value) {
  return String(value ?? '').trim()
}

function dedupeSorted(items) {
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

export function loadJathaLists() {
  if (typeof window === 'undefined') {
    return { departments: DEFAULT_DEPARTMENTS, areas: DEFAULT_AREAS }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { departments: DEFAULT_DEPARTMENTS, areas: DEFAULT_AREAS }
    }
    const parsed = JSON.parse(raw)
    return {
      departments: dedupeSorted(
        Array.isArray(parsed.departments) ? parsed.departments : DEFAULT_DEPARTMENTS,
      ),
      areas: dedupeSorted(Array.isArray(parsed.areas) ? parsed.areas : DEFAULT_AREAS),
    }
  } catch {
    return { departments: DEFAULT_DEPARTMENTS, areas: DEFAULT_AREAS }
  }
}

export function saveJathaLists(lists) {
  if (typeof window === 'undefined') return
  const payload = {
    departments: dedupeSorted(lists.departments),
    areas: dedupeSorted(lists.areas),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  window.dispatchEvent(new CustomEvent('cb-jatha-lists-updated', { detail: payload }))
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
