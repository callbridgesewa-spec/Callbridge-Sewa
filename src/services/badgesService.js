import { databases, APPWRITE_CONFIG } from './appwriteClient'
import {
  DEFAULT_AREAS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_VISIT_OPTIONS,
  DEFAULT_ASSIGN_DUTY_OPTIONS,
  DEFAULT_INCHARGE_OPTIONS,
  dedupeSorted,
  parseListField,
  serializeListForDb,
} from '../utils/jathaListUtils'

const DEFAULT_BADGES = {
  open: 40,
  permanent: 22,
  elderly: 8,
  sangat: 15,
  newProspects: 18,
}

/** Appwrite attribute keys on badge-counts collection */
const ATTR_DEPARTMENTS = 'Departments'
const ATTR_AREA = 'area'
const ATTR_VISIT_OPTIONS = 'visitOptions'
const ATTR_ASSIGN_DUTY_OPTIONS = 'assignDutyOptions'
const ATTR_INCHARGE_OPTIONS = 'inchargeOptions'
const ATTR_REMARKS = 'remarks'

function parseRemark(doc) {
  if (!doc) return ''
  for (const key of [ATTR_REMARKS, 'Remarks', 'remark']) {
    const raw = doc[key]
    if (raw !== undefined && raw !== null && String(raw).trim()) {
      return String(raw).trim()
    }
  }
  return ''
}

function dispatchRemarksUpdated(remarks) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cb-remarks-updated', { detail: { remarks } }),
    )
  }
}

async function getBadgeDocument() {
  const { databaseId, badgeCountsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !badgeCountsCollectionId) {
    return null
  }

  const response = await databases.listDocuments(databaseId, badgeCountsCollectionId)
  if (response.total === 0) {
    return null
  }
  return response.documents[0]
}

export async function fetchBadgeCounts() {
  try {
    const doc = await getBadgeDocument()
    if (!doc) return { counts: DEFAULT_BADGES, remarks: '', source: 'default' }

    const counts = {
      open: Number(doc.open ?? DEFAULT_BADGES.open),
      permanent: Number(doc.permanent ?? DEFAULT_BADGES.permanent),
      elderly: Number(doc.elderly ?? DEFAULT_BADGES.elderly),
      sangat: Number(doc.sangat ?? DEFAULT_BADGES.sangat),
      newProspects: Number(doc.newProspects ?? DEFAULT_BADGES.newProspects),
    }

    return {
      counts,
      remarks: parseRemark(doc),
      source: 'database',
      documentId: doc.$id,
    }
  } catch (error) {
    console.error('Failed to fetch badge counts', error)
    return { counts: DEFAULT_BADGES, remarks: '', source: 'default' }
  }
}

/** Save dashboard remark to badge-counts `remarks` attribute. */
export async function saveRemarks(remarksText) {
  const { databaseId, badgeCountsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !badgeCountsCollectionId) {
    throw new Error('Appwrite badge counts collection is not configured.')
  }

  const remarks = String(remarksText ?? '').trim()
  const payload = { [ATTR_REMARKS]: remarks }
  const doc = await getBadgeDocument()

  if (doc) {
    await databases.updateDocument(databaseId, badgeCountsCollectionId, doc.$id, payload)
    dispatchRemarksUpdated(remarks)
    return doc.$id
  }

  const created = await databases.createDocument(
    databaseId,
    badgeCountsCollectionId,
    'badge-counts',
    { ...DEFAULT_BADGES, ...payload },
  )
  dispatchRemarksUpdated(remarks)
  return created.$id
}

export async function saveBadgeCounts(updatedCounts) {
  const { databaseId, badgeCountsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !badgeCountsCollectionId) {
    throw new Error('Appwrite badge counts collection is not configured.')
  }

  const doc = await getBadgeDocument()

  if (doc) {
    await databases.updateDocument(databaseId, badgeCountsCollectionId, doc.$id, updatedCounts)
    return doc.$id
  }

  const created = await databases.createDocument(
    databaseId,
    badgeCountsCollectionId,
    'badge-counts',
    updatedCounts,
  )
  return created.$id
}

/** Load Jatha area & department lists from badge-counts document. */
export async function fetchJathaLists() {
  try {
    const doc = await getBadgeDocument()
    if (!doc) {
      return {
        departments: DEFAULT_DEPARTMENTS,
        areas: DEFAULT_AREAS,
        visitOptions: DEFAULT_VISIT_OPTIONS,
        source: 'default',
        documentId: null,
      }
    }

    const departments =
      parseListField(doc, [ATTR_DEPARTMENTS, 'departments', 'Departments']) ??
      DEFAULT_DEPARTMENTS
    const areas =
      parseListField(doc, [ATTR_AREA, 'areas', 'Area', 'Areas']) ?? DEFAULT_AREAS
    const visitOptions =
      parseListField(doc, [ATTR_VISIT_OPTIONS, 'VisitOptions', 'visit_options']) ??
      DEFAULT_VISIT_OPTIONS
    const assignDutyOptions =
      parseListField(doc, [ATTR_ASSIGN_DUTY_OPTIONS, 'AssignDutyOptions', 'assign_duty_options']) ??
      DEFAULT_ASSIGN_DUTY_OPTIONS
    const inchargeOptions =
      parseListField(doc, [ATTR_INCHARGE_OPTIONS, 'InchargeOptions', 'incharge_options']) ??
      DEFAULT_INCHARGE_OPTIONS

    return {
      departments,
      areas,
      visitOptions,
      assignDutyOptions,
      inchargeOptions,
      source: 'database',
      documentId: doc.$id,
    }
  } catch (error) {
    console.error('Failed to fetch jatha lists from badge-counts', error)
    return {
      departments: DEFAULT_DEPARTMENTS,
      areas: DEFAULT_AREAS,
      visitOptions: DEFAULT_VISIT_OPTIONS,
      assignDutyOptions: DEFAULT_ASSIGN_DUTY_OPTIONS,
      inchargeOptions: DEFAULT_INCHARGE_OPTIONS,
      source: 'default',
      documentId: null,
    }
  }
}

/** Save Jatha lists to badge-counts `Departments` and `area` attributes (JSON strings). */
export async function saveJathaLists(lists) {
  const { databaseId, badgeCountsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !badgeCountsCollectionId) {
    throw new Error('Appwrite badge counts collection is not configured.')
  }

  const departments = dedupeSorted(lists.departments)
  const areas = dedupeSorted(lists.areas)
  const visitOptions = dedupeSorted(lists.visitOptions)
  const assignDutyOptions = dedupeSorted(lists.assignDutyOptions)
  const inchargeOptions = dedupeSorted(lists.inchargeOptions)
  const payload = {
    [ATTR_DEPARTMENTS]: serializeListForDb(departments),
    [ATTR_AREA]: serializeListForDb(areas),
    [ATTR_VISIT_OPTIONS]: serializeListForDb(visitOptions),
    [ATTR_ASSIGN_DUTY_OPTIONS]: serializeListForDb(assignDutyOptions),
    [ATTR_INCHARGE_OPTIONS]: serializeListForDb(inchargeOptions),
  }

  const doc = await getBadgeDocument()

  if (doc) {
    await databases.updateDocument(databaseId, badgeCountsCollectionId, doc.$id, payload)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cb-jatha-lists-updated', {
          detail: { departments, areas, visitOptions, assignDutyOptions, inchargeOptions },
        }),
      )
    }
    return doc.$id
  }

  const created = await databases.createDocument(
    databaseId,
    badgeCountsCollectionId,
    'badge-counts',
    { ...DEFAULT_BADGES, ...payload },
  )
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cb-jatha-lists-updated', {
        detail: { departments, areas, visitOptions, assignDutyOptions, inchargeOptions },
      }),
    )
  }
  return created.$id
}
