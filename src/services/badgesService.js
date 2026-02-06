import { databases, APPWRITE_CONFIG } from './appwriteClient'

const DEFAULT_BADGES = {
  open: 40,
  permanent: 22,
  elderly: 8,
  sangat: 15,
  newProspects: 18,
}

async function getBadgeDocument() {
  const { databaseId, badgeCountsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !badgeCountsCollectionId) {
    // No DB configured, caller will fall back to defaults
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
    if (!doc) return { counts: DEFAULT_BADGES, source: 'default' }

    const counts = {
      open: Number(doc.open ?? DEFAULT_BADGES.open),
      permanent: Number(doc.permanent ?? DEFAULT_BADGES.permanent),
      elderly: Number(doc.elderly ?? DEFAULT_BADGES.elderly),
      sangat: Number(doc.sangat ?? DEFAULT_BADGES.sangat),
      newProspects: Number(doc.newProspects ?? DEFAULT_BADGES.newProspects),
    }

    return { counts, source: 'database', documentId: doc.$id }
  } catch (error) {
    console.error('Failed to fetch badge counts', error)
    return { counts: DEFAULT_BADGES, source: 'default' }
  }
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

