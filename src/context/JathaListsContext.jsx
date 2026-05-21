import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_AREAS,
  DEFAULT_DEPARTMENTS,
  addToList,
  loadJathaLists,
  removeFromList,
  saveJathaLists,
} from '../services/jathaListsStorage'

const JathaListsContext = createContext(null)

export function JathaListsProvider({ children }) {
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS)
  const [areas, setAreas] = useState(DEFAULT_AREAS)

  const applyLists = useCallback((lists) => {
    setDepartments(lists.departments)
    setAreas(lists.areas)
  }, [])

  useEffect(() => {
    applyLists(loadJathaLists())

    function onStorage(e) {
      if (e.key === 'cb-jatha-lists-v1' || e.key === null) {
        applyLists(loadJathaLists())
      }
    }

    function onCustom() {
      applyLists(loadJathaLists())
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('cb-jatha-lists-updated', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('cb-jatha-lists-updated', onCustom)
    }
  }, [applyLists])

  const persist = useCallback((nextDepartments, nextAreas) => {
    const lists = { departments: nextDepartments, areas: nextAreas }
    saveJathaLists(lists)
    applyLists(lists)
  }, [applyLists])

  const addDepartment = useCallback(
    (name) => {
      const result = addToList(departments, name)
      if (result.added) persist(result.list, areas)
      return result
    },
    [departments, areas, persist],
  )

  const removeDepartment = useCallback(
    (name) => {
      persist(removeFromList(departments, name), areas)
    },
    [departments, areas, persist],
  )

  const addArea = useCallback(
    (name) => {
      const result = addToList(areas, name)
      if (result.added) persist(departments, result.list)
      return result
    },
    [departments, areas, persist],
  )

  const removeArea = useCallback(
    (name) => {
      persist(departments, removeFromList(areas, name))
    },
    [departments, areas, persist],
  )

  const resetDepartments = useCallback(() => {
    persist(DEFAULT_DEPARTMENTS, areas)
  }, [areas, persist])

  const resetAreas = useCallback(() => {
    persist(departments, DEFAULT_AREAS)
  }, [departments, persist])

  const value = useMemo(
    () => ({
      departments,
      areas,
      addDepartment,
      removeDepartment,
      addArea,
      removeArea,
      resetDepartments,
      resetAreas,
    }),
    [
      departments,
      areas,
      addDepartment,
      removeDepartment,
      addArea,
      removeArea,
      resetDepartments,
      resetAreas,
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
