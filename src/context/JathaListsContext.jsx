import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchJathaLists, saveJathaLists } from '../services/badgesService'
import {
  DEFAULT_AREAS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_VISIT_OPTIONS,
  DEFAULT_ASSIGN_DUTY_OPTIONS,
  DEFAULT_INCHARGE_OPTIONS,
  addToList,
  removeFromList,
} from '../utils/jathaListUtils'

const JathaListsContext = createContext(null)

export function JathaListsProvider({ children }) {
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS)
  const [areas, setAreas] = useState(DEFAULT_AREAS)
  const [visitOptions, setVisitOptions] = useState(DEFAULT_VISIT_OPTIONS)
  const [assignDutyOptions, setAssignDutyOptions] = useState(DEFAULT_ASSIGN_DUTY_OPTIONS)
  const [inchargeOptions, setInchargeOptions] = useState(DEFAULT_INCHARGE_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const applyLists = useCallback((lists) => {
    setDepartments(lists.departments)
    setAreas(lists.areas)
    setVisitOptions(lists.visitOptions)
    setAssignDutyOptions(lists.assignDutyOptions ?? DEFAULT_ASSIGN_DUTY_OPTIONS)
    setInchargeOptions(lists.inchargeOptions ?? DEFAULT_INCHARGE_OPTIONS)
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
        assignDutyOptions: DEFAULT_ASSIGN_DUTY_OPTIONS,
        inchargeOptions: DEFAULT_INCHARGE_OPTIONS,
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
    async (nextDepartments, nextAreas, nextVisitOptions, nextAssignDutyOptions, nextInchargeOptions) => {
      setSaving(true)
      setError('')
      try {
        await saveJathaLists({
          departments: nextDepartments,
          areas: nextAreas,
          visitOptions: nextVisitOptions,
          assignDutyOptions: nextAssignDutyOptions,
          inchargeOptions: nextInchargeOptions,
        })
        applyLists({
          departments: nextDepartments,
          areas: nextAreas,
          visitOptions: nextVisitOptions,
          assignDutyOptions: nextAssignDutyOptions,
          inchargeOptions: nextInchargeOptions,
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
      if (result.added) await persist(result.list, areas, visitOptions, assignDutyOptions, inchargeOptions)
      return result
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const removeDepartment = useCallback(
    async (name) => {
      await persist(removeFromList(departments, name), areas, visitOptions, assignDutyOptions, inchargeOptions)
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const addArea = useCallback(
    async (name) => {
      const result = addToList(areas, name)
      if (result.added) await persist(departments, result.list, visitOptions, assignDutyOptions, inchargeOptions)
      return result
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const removeArea = useCallback(
    async (name) => {
      await persist(departments, removeFromList(areas, name), visitOptions, assignDutyOptions, inchargeOptions)
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const addVisitOption = useCallback(
    async (name) => {
      const result = addToList(visitOptions, name)
      if (result.added) await persist(departments, areas, result.list, assignDutyOptions, inchargeOptions)
      return result
    },
    [visitOptions, departments, areas, assignDutyOptions, inchargeOptions, persist],
  )

  const removeVisitOption = useCallback(
    async (name) => {
      await persist(departments, areas, removeFromList(visitOptions, name), assignDutyOptions, inchargeOptions)
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const addAssignDutyOption = useCallback(
    async (name) => {
      const result = addToList(assignDutyOptions, name)
      if (result.added) await persist(departments, areas, visitOptions, result.list, inchargeOptions)
      return result
    },
    [assignDutyOptions, departments, areas, visitOptions, inchargeOptions, persist],
  )

  const removeAssignDutyOption = useCallback(
    async (name) => {
      await persist(departments, areas, visitOptions, removeFromList(assignDutyOptions, name), inchargeOptions)
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const addInchargeOption = useCallback(
    async (name) => {
      const result = addToList(inchargeOptions, name)
      if (result.added) await persist(departments, areas, visitOptions, assignDutyOptions, result.list)
      return result
    },
    [inchargeOptions, departments, areas, visitOptions, assignDutyOptions, persist],
  )

  const removeInchargeOption = useCallback(
    async (name) => {
      await persist(departments, areas, visitOptions, assignDutyOptions, removeFromList(inchargeOptions, name))
    },
    [departments, areas, visitOptions, assignDutyOptions, inchargeOptions, persist],
  )

  const resetDepartments = useCallback(async () => {
    await persist(DEFAULT_DEPARTMENTS, areas, visitOptions, assignDutyOptions, inchargeOptions)
  }, [areas, visitOptions, assignDutyOptions, inchargeOptions, persist])

  const resetAreas = useCallback(async () => {
    await persist(departments, DEFAULT_AREAS, visitOptions, assignDutyOptions, inchargeOptions)
  }, [departments, visitOptions, assignDutyOptions, inchargeOptions, persist])

  const resetVisitOptions = useCallback(async () => {
    await persist(departments, areas, DEFAULT_VISIT_OPTIONS, assignDutyOptions, inchargeOptions)
  }, [departments, areas, assignDutyOptions, inchargeOptions, persist])

  const resetAssignDutyOptions = useCallback(async () => {
    await persist(departments, areas, visitOptions, DEFAULT_ASSIGN_DUTY_OPTIONS, inchargeOptions)
  }, [departments, areas, visitOptions, inchargeOptions, persist])

  const resetInchargeOptions = useCallback(async () => {
    await persist(departments, areas, visitOptions, assignDutyOptions, DEFAULT_INCHARGE_OPTIONS)
  }, [departments, areas, visitOptions, assignDutyOptions, persist])

  const value = useMemo(
    () => ({
      departments,
      areas,
      visitOptions,
      assignDutyOptions,
      inchargeOptions,
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
      addAssignDutyOption,
      removeAssignDutyOption,
      resetAssignDutyOptions,
      addInchargeOption,
      removeInchargeOption,
      resetInchargeOptions,
      reload,
    }),
    [
      departments,
      areas,
      visitOptions,
      assignDutyOptions,
      inchargeOptions,
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
      addAssignDutyOption,
      removeAssignDutyOption,
      resetAssignDutyOptions,
      addInchargeOption,
      removeInchargeOption,
      resetInchargeOptions,
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
