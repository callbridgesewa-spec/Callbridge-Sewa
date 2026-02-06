import { databases, storage, APPWRITE_CONFIG } from './appwriteClient'

/** Convert Appwrite document to display format used in table */
export function docToDisplay(doc) {
  return {
    id: doc.$id,
    name: doc.name,
    address: doc.address,
    phoneNumber: doc.mobile,
    batchNumber: doc.batchNumber,
    assignedTo: doc.assignedTo || 'Unassigned',
    bloodGroup: doc.bloodgroup,
  }
}

export async function listProspects() {
  const { databaseId, prospectsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !prospectsCollectionId) {
    return { documents: [], total: 0 }
  }
  try {
    const response = await databases.listDocuments(databaseId, prospectsCollectionId)
    return response
  } catch (error) {
    console.error('Failed to list prospects', error)
    return { documents: [], total: 0 }
  }
}

function toDbProspect(p) {
  const address = p.address || (p.locality && p.fullAddress ? `${p.locality}, ${p.fullAddress}` : (p.fullAddress || p.locality || ''))
  return {
    name: p.name || '',
    address: address || '',
    mobile: p.mobile || p.phoneNumber || p.mobileNumber || '',
    bloodgroup: p.bloodgroup || p.bloodGroup || '-',
    aadhar: p.aadhar || p.aadharNumber || '',
    dateOfBirth: p.dateOfBirth || '',
    age: String(p.age || ''),
    guardian: p.guardian || p.fathersName || '',
    batchNumber: p.batchNumber || p.badgeId || '',
    gender: p.gender || 'Male',
    badgeStatus: p.badgeStatus || 'N/A',
    emergencyContact: p.emergencyContact || '',
    DeptFinalisedName: p.DeptFinalisedName || p.departmentName || '',
    maritalStatus: p.maritalStatus || 'N/A',
    locality: p.locality || '',
    assignedTo: p.assignedTo || '',
    NamdaanDOI: p.NamdaanDOI || p.dateOfInitiation || '',
    namdaanInitiated: p.namdaanInitiated ?? (p.initiated ? 'yes' : 'no'),
    NamdaanInitiationBy: p.NamdaanInitiationBy || p.initiationBy || '',
    NamdaanInitiationPlace: p.NamdaanInitiationPlace || p.initiationPlace || '',
  }
}

export async function createProspect(prospect) {
  const { databaseId, prospectsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !prospectsCollectionId) {
    throw new Error('Appwrite prospects collection is not configured.')
  }
  const docId = `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const data = toDbProspect(prospect)
  const created = await databases.createDocument(databaseId, prospectsCollectionId, docId, data)
  return created
}

export async function createProspectsBulk(prospects) {
  const results = []
  for (const p of prospects) {
    const created = await createProspect(p)
    results.push(created)
  }
  return results
}

export async function updateProspect(documentId, updates) {
  const { databaseId, prospectsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !prospectsCollectionId) {
    throw new Error('Appwrite prospects collection is not configured.')
  }
  await databases.updateDocument(databaseId, prospectsCollectionId, documentId, updates)
}

export async function assignProspectsToUser(prospectIds, userEmail) {
  for (const id of prospectIds) {
    await updateProspect(id, { assignedTo: userEmail || '' })
  }
}

export async function unassignProspects(prospectIds) {
  for (const id of prospectIds) {
    await updateProspect(id, { assignedTo: '' })
  }
}

export async function deleteProspect(documentId) {
  const { databaseId, prospectsCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !prospectsCollectionId) {
    throw new Error('Appwrite prospects collection is not configured.')
  }
  await databases.deleteDocument(databaseId, prospectsCollectionId, documentId)
}

export async function deleteProspectsBulk(prospectIds) {
  for (const id of prospectIds) {
    await deleteProspect(id)
  }
}

export async function uploadProspectExcel(file) {
  const { prospectsBucketId } = APPWRITE_CONFIG
  if (!prospectsBucketId) {
    throw new Error('Appwrite prospects bucket is not configured.')
  }
  const fileId = `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const result = await storage.createFile(prospectsBucketId, fileId, file)
  return result
}
