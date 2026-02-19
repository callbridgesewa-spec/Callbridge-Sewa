import { Query } from 'appwrite'
import { databases, APPWRITE_CONFIG } from './appwriteClient'

/** Create a new call log (prospect call form submission) */
export async function createCallLog(data) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !callLogsCollectionId) {
    throw new Error('Appwrite call logs collection is not configured.')
  }
  const docId = `calllog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const payload = {
    prospectId: String(data.prospectId ?? '').trim() || '',
    prospectName: String(data.prospectName ?? '').trim() || '',
    submittedBy: String(data.submittedBy ?? '').trim() || '',
    select: String(data.select ?? '').trim() || '',
    callBack: String(data.callBack ?? '').trim() || '',
    notInterest: String(data.notInterest ?? '').trim() || '',
    needToWork: String(data.needToWork ?? '').trim() || '',
    notes1: String(data.notes1 ?? '').trim() || '',
    notes2: String(data.notes2 ?? '').trim() || '',
    notes3: String(data.notes3 ?? '').trim() || '',
    nominalListSelect: String(data.nominalListSelect ?? '').trim() || '',
    visitSelect: String(data.visitSelect ?? '').trim() || '',
    freeSewa: String(data.freeSewa ?? '').trim() || '',
    jathaDetails: typeof data.jathaDetails === 'string' ? data.jathaDetails : JSON.stringify(data.jathaDetails || []),
  }
  const created = await databases.createDocument(databaseId, callLogsCollectionId, docId, payload)
  return created
}

/** List all call logs (for admin) */
export async function listCallLogs() {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !callLogsCollectionId) {
    return { documents: [], total: 0 }
  }
  try {
    const response = await databases.listDocuments(databaseId, callLogsCollectionId, [
      Query.orderDesc('$createdAt'),
    ])
    return response
  } catch (error) {
    console.error('Failed to list call logs', error)
    return { documents: [], total: 0 }
  }
}

/** List call logs submitted by a specific user (for user dashboard) */
export async function listCallLogsForUser(submittedBy) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !callLogsCollectionId || !submittedBy) {
    return { documents: [], total: 0 }
  }
  try {
    const response = await databases.listDocuments(databaseId, callLogsCollectionId, [
      Query.equal('submittedBy', submittedBy),
      Query.orderDesc('$createdAt'),
    ])
    return response
  } catch (error) {
    console.error('Failed to list call logs for user', error)
    return { documents: [], total: 0 }
  }
}

/** List call logs for a particular prospect (for admin view per prospect) */
export async function listCallLogsForProspect(prospectId) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !callLogsCollectionId || !prospectId) {
    return { documents: [], total: 0 }
  }
  try {
    const response = await databases.listDocuments(databaseId, callLogsCollectionId, [
      Query.equal('prospectId', prospectId),
      Query.orderDesc('$createdAt'),
    ])
    return response
  } catch (error) {
    console.error('Failed to list call logs for prospect', error)
    return { documents: [], total: 0 }
  }
}
