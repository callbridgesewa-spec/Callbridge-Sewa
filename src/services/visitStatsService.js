import { ID, Query } from 'appwrite'
import { databases, APPWRITE_CONFIG } from './appwriteClient'

function parseJathaDetails(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function pct(count, total) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0
}

/**
 * Classifies each jathaDetails[].areaName into Bhati, Beas, or Other Major Centres.
 * Groups by badgeId across all call logs.
 */
export function computeVisitStats(entries) {
  const byBadgeId = new Map()

  for (const { prospect, log } of entries) {
    const badgeId = String(prospect.badgeId || '').trim()
    if (!badgeId || badgeId === '-') continue

    if (!byBadgeId.has(badgeId)) {
      byBadgeId.set(badgeId, {
        badgeId,
        prospectId: prospect.id || '',
        prospectName: prospect.name || '-',
        bhatiCount: 0,
        beasCount: 0,
        otherCount: 0,
      })
    }

    const entry = byBadgeId.get(badgeId)
    for (const jatha of parseJathaDetails(log.jathaDetails)) {
      const area = String(jatha.areaName || '').trim().toLowerCase()
      if (!area || area === '-') continue
      if (area === 'bhati') entry.bhatiCount++
      else if (area === 'beas') entry.beasCount++
      else entry.otherCount++
    }
  }

  const result = []
  for (const [, entry] of byBadgeId) {
    const totalVisits = entry.bhatiCount + entry.beasCount + entry.otherCount
    if (totalVisits === 0) continue
    result.push({
      badgeId: entry.badgeId,
      prospectId: entry.prospectId,
      prospectName: entry.prospectName,
      bhatiCount: entry.bhatiCount,
      bhatiPercentage: pct(entry.bhatiCount, totalVisits),
      beasCount: entry.beasCount,
      beasPercentage: pct(entry.beasCount, totalVisits),
      otherCount: entry.otherCount,
      otherPercentage: pct(entry.otherCount, totalVisits),
      totalVisits,
    })
  }

  return result
}

/** Upsert computed stats into the visitStats collection, keyed by badgeId. */
export async function saveVisitStats(statsArray) {
  const { databaseId, visitStatsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !visitStatsCollectionId) {
    throw new Error('Visit stats collection is not configured.')
  }

  const existing = await databases.listDocuments(databaseId, visitStatsCollectionId, [
    Query.limit(500),
  ])
  const existingByBadgeId = new Map()
  existing.documents.forEach((doc) => existingByBadgeId.set(doc.badgeId, doc.$id))

  for (const stat of statsArray) {
    const payload = {
      badgeId: stat.badgeId,
      prospectName: stat.prospectName,
      bhatiCount: stat.bhatiCount,
      bhatiPercentage: stat.bhatiPercentage,
      beasCount: stat.beasCount,
      beasPercentage: stat.beasPercentage,
      otherCount: stat.otherCount,
      otherPercentage: stat.otherPercentage,
      totalVisits: stat.totalVisits,
    }

    if (existingByBadgeId.has(stat.badgeId)) {
      await databases.updateDocument(
        databaseId,
        visitStatsCollectionId,
        existingByBadgeId.get(stat.badgeId),
        payload,
      )
    } else {
      await databases.createDocument(databaseId, visitStatsCollectionId, ID.unique(), payload)
    }
  }
}

/** Fetch all stored visit stats from the collection. */
export async function fetchVisitStats() {
  const { databaseId, visitStatsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !visitStatsCollectionId) return []

  const res = await databases.listDocuments(databaseId, visitStatsCollectionId, [
    Query.limit(500),
  ])
  return res.documents.map((doc) => ({
    badgeId: doc.badgeId,
    prospectName: doc.prospectName,
    bhatiCount: doc.bhatiCount || 0,
    bhatiPercentage: doc.bhatiPercentage || 0,
    beasCount: doc.beasCount || 0,
    beasPercentage: doc.beasPercentage || 0,
    otherCount: doc.otherCount || 0,
    otherPercentage: doc.otherPercentage || 0,
    totalVisits: doc.totalVisits || 0,
  }))
}
