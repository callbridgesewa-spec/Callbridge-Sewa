import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchJathaLists, saveJathaLists } from '../services/badgesService'
import {
  DEFAULT_AREAS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_VISIT_OPTIONS,
  addToList,
  removeFromList,
} from '../utils/jathaListUtils'

const JathaListsContext = createContext(null)

export function JathaListsProvider({ children }) {
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS)
  const [areas, setAreas] = useState(DEFAULT_AREAS)
  const [visitOptions, setVisitOptions] = useState(DEFAULT_VISIT_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const applyLists = useCallback((lists) => {
    setDepartments(lists.departments)
    setAreas(lists.areas)
    setVisitOptions(lists.visitOptions)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const lists = await fetchJathaLists()
      applyLists(lists)
    } catch (err) {
      console.error(err)
      setError('Unable to load area and department lists.')
      applyLists({
        departments: DEFAULT_DEPARTMENTS,
        areas: DEFAULT_AREAS,
        visitOptions: DEFAULT_VISIT_OPTIONS,
      })
    } finally {
      setLoading(false)
    }
  }, [applyLists])

  useEffect(() => {
    reload()

    function onListsUpdated() {
      reload()
    }

    window.addEventListener('cb-jatha-lists-updated', onListsUpdated)
    return () => window.removeEventListener('cb-jatha-lists-updated', onListsUpdated)
  }, [reload])

  const persist = useCallback(
    async (nextDepartments, nextAreas, nextVisitOptions) => {
      setSaving(true)
      setError('')
      try {
        await saveJathaLists({
          departments: nextDepartments,
          areas: nextAreas,
          visitOptions: nextVisitOptions,
        })
        applyLists({
          departments: nextDepartments,
          areas: nextAreas,
          visitOptions: nextVisitOptions,
        })
      } catch (err) {
        const message = err?.message || 'Failed to save lists to database.'
        setError(message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [applyLists],
  )

  const addDepartment = useCallback(
    async (name) => {
      const result = addToList(departments, name)
      if (result.added) await persist(result.list, areas, visitOptions)
      return result
    },
    [departments, areas, visitOptions, persist],
  )

  const removeDepartment = useCallback(
    async (name) => {
      await persist(removeFromList(departments, name), areas, visitOptions)
    },
    [departments, areas, visitOptions, persist],
  )

  const addArea = useCallback(
    async (name) => {
      const result = addToList(areas, name)
      if (result.added) await persist(departments, result.list, visitOptions)
      return result
    },
    [departments, areas, visitOptions, persist],
  )

  const removeArea = useCallback(
    async (name) => {
      await persist(departments, removeFromList(areas, name), visitOptions)
    },
    [departments, areas, visitOptions, persist],
  )

  const addVisitOption = useCallback(
    async (name) => {
      const result = addToList(visitOptions, name)
      if (result.added) await persist(departments, areas, result.list)
      return result
    },
    [visitOptions, departments, areas, persist],
  )

  const removeVisitOption = useCallback(
    async (name) => {
      await persist(departments, areas, removeFromList(visitOptions, name))
    },
    [departments, areas, visitOptions, persist],
  )

  const resetDepartments = useCallback(async () => {
    await persist(DEFAULT_DEPARTMENTS, areas, visitOptions)
  }, [areas, visitOptions, persist])

  const resetAreas = useCallback(async () => {
    await persist(departments, DEFAULT_AREAS, visitOptions)
  }, [departments, visitOptions, persist])

  const resetVisitOptions = useCallback(async () => {
    await persist(departments, areas, DEFAULT_VISIT_OPTIONS)
  }, [departments, areas, persist])

  const value = useMemo(
    () => ({
      departments,
      areas,
      visitOptions,
      loading,
      saving,
      error,
      addDepartment,
      removeDepartment,
      addArea,
      removeArea,
      resetDepartments,
      resetAreas,
      addVisitOption,
      removeVisitOption,
      resetVisitOptions,
      reload,
    }),
    [
      departments,
      areas,
      visitOptions,
      loading,
      saving,
      error,
      addDepartment,
      removeDepartment,
      addArea,
      removeArea,
      resetDepartments,
      resetAreas,
      addVisitOption,
      removeVisitOption,
      resetVisitOptions,
      reload,
    ],
  )

  return <JathaListsContext.Provider value={value}>{children}</JathaListsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useJathaLists() {
  const ctx = useContext(JathaListsContext)
  if (!ctx) {
    throw new Error('useJathaLists must be used within JathaListsProvider')
  }
  return ctx
}
