import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchJathaLists, saveJathaLists } from '../services/badgesService'
import {
  DEFAULT_AREAS,
  DEFAULT_DEPARTMENTS,
  addToList,
  removeFromList,
} from '../utils/jathaListUtils'

const JathaListsContext = createContext(null)

export function JathaListsProvider({ children }) {
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS)
  const [areas, setAreas] = useState(DEFAULT_AREAS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const applyLists = useCallback((lists) => {
    setDepartments(lists.departments)
    setAreas(lists.areas)
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
      applyLists({ departments: DEFAULT_DEPARTMENTS, areas: DEFAULT_AREAS })
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
    async (nextDepartments, nextAreas) => {
      setSaving(true)
      setError('')
      try {
        await saveJathaLists({
          departments: nextDepartments,
          areas: nextAreas,
        })
        applyLists({ departments: nextDepartments, areas: nextAreas })
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
      if (result.added) await persist(result.list, areas)
      return result
    },
    [departments, areas, persist],
  )

  const removeDepartment = useCallback(
    async (name) => {
      await persist(removeFromList(departments, name), areas)
    },
    [departments, areas, persist],
  )

  const addArea = useCallback(
    async (name) => {
      const result = addToList(areas, name)
      if (result.added) await persist(departments, result.list)
      return result
    },
    [departments, areas, persist],
  )

  const removeArea = useCallback(
    async (name) => {
      await persist(departments, removeFromList(areas, name))
    },
    [departments, areas, persist],
  )

  const resetDepartments = useCallback(async () => {
    await persist(DEFAULT_DEPARTMENTS, areas)
  }, [areas, persist])

  const resetAreas = useCallback(async () => {
    await persist(departments, DEFAULT_AREAS)
  }, [departments, persist])

  const value = useMemo(
    () => ({
      departments,
      areas,
      loading,
      saving,
      error,
      addDepartment,
      removeDepartment,
      addArea,
      removeArea,
      resetDepartments,
      resetAreas,
      reload,
    }),
    [
      departments,
      areas,
      loading,
      saving,
      error,
      addDepartment,
      removeDepartment,
      addArea,
      removeArea,
      resetDepartments,
      resetAreas,
      reload,
    ],
  )

  return <JathaListsContext.Provider value={value}>{children}</JathaListsContext.Provider>
}

export function useJathaLists() {
  const ctx = useContext(JathaListsContext)
  if (!ctx) {
    throw new Error('useJathaLists must be used within JathaListsProvider')
  }
  return ctx
}
