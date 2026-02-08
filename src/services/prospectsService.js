import { databases, storage, APPWRITE_CONFIG } from './appwriteClient'

/** Read attribute with optional fallback for different casing (Appwrite may return Name vs name) */
function getAttr(doc, ...keys) {
  for (const k of keys) {
    if (doc[k] !== undefined && doc[k] !== null && String(doc[k]).trim() !== '') {
      return String(doc[k]).trim()
    }
  }
  return keys.length ? (doc[keys[0]] != null ? String(doc[keys[0]]) : '') : ''
}

/** Find first document key that matches (case-insensitive) and has a non-empty value */
function getAttrByKeyMatch(doc, ...targetKeys) {
  const lowerTargets = new Set(targetKeys.map((k) => k.toLowerCase()))
  for (const key of Object.keys(doc)) {
    if (key.startsWith('$')) continue // skip $id, $createdAt, etc.
    if (lowerTargets.has(key.toLowerCase())) {
      const v = doc[key]
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
    }
  }
  return ''
}

/** Convert Appwrite document to display format used in table */
export function docToDisplay(doc) {
  if (!doc || typeof doc !== 'object') {
    return { id: '', name: '-', address: '-', phoneNumber: '-', batchNumber: '-', assignedTo: 'Unassigned', bloodGroup: '-' }
  }
  const prospectName = getAttr(doc, 'fullName', 'fullname', 'FullName') || getAttrByKeyMatch(doc, 'fullName', 'fullname') || getAttr(doc, 'name', 'Name') || getAttrByKeyMatch(doc, 'name', 'Name') || '-'
  return {
    id: doc.$id ?? doc.id ?? '',
    name: prospectName,
    address: getAttr(doc, 'address', 'Address') || getAttrByKeyMatch(doc, 'address', 'Address') || '-',
    phoneNumber: getAttr(doc, 'mobile', 'Mobile', 'phoneNumber', 'Phone') || getAttrByKeyMatch(doc, 'mobile', 'Mobile', 'phoneNumber', 'Phone') || '-',
    batchNumber: getAttr(doc, 'batchNumber', 'BatchNumber') || getAttrByKeyMatch(doc, 'batchNumber', 'BatchNumber') || '-',
    assignedTo: getAttr(doc, 'assignedTo', 'AssignedTo') || getAttrByKeyMatch(doc, 'assignedTo', 'AssignedTo') || 'Unassigned',
    bloodGroup: getAttr(doc, 'bloodgroup', 'bloodGroup', 'BloodGroup') || getAttrByKeyMatch(doc, 'bloodgroup', 'bloodGroup', 'BloodGroup') || '-',
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
  if (!p || typeof p !== 'object') p = {}
  const address = p.address || (p.locality && p.fullAddress ? `${p.locality}, ${p.fullAddress}` : (p.fullAddress || p.locality || ''))
  const fullName = String(p.fullName ?? p.name ?? '').trim() || ''
  return {
    fullName,
    address: String(address ?? '').trim() || '',
    mobile: String(p.mobile ?? p.phoneNumber ?? p.mobileNumber ?? '').trim() || '',
    bloodgroup: String(p.bloodgroup ?? p.bloodGroup ?? '-').trim() || '-',
    aadhar: String(p.aadhar ?? p.aadharNumber ?? '').trim() || '',
    dateOfBirth: String(p.dateOfBirth ?? '').trim() || '',
    age: String(p.age ?? '').trim() || '',
    guardian: String(p.guardian ?? p.fathersName ?? '').trim() || '',
    batchNumber: String(p.batchNumber ?? p.badgeId ?? '').trim() || '',
    gender: String(p.gender ?? 'Male').trim() || 'Male',
    badgeStatus: String(p.badgeStatus ?? 'N/A').trim() || 'N/A',
    emergencyContact: String(p.emergencyContact ?? '').trim() || '',
    DeptFinalisedName: String(p.DeptFinalisedName ?? p.departmentName ?? '').trim() || '',
    maritalStatus: String(p.maritalStatus ?? 'N/A').trim() || 'N/A',
    locality: String(p.locality ?? '').trim() || '',
    assignedTo: String(p.assignedTo ?? '').trim() || '',
    NamdaanDOI: String(p.NamdaanDOI ?? p.dateOfInitiation ?? '').trim() || '',
    namdaanInitiated: String(p.namdaanInitiated ?? (p.initiated ? 'yes' : 'no') ?? 'no').trim() || 'no',
    NamdaanInitiationBy: String(p.NamdaanInitiationBy ?? p.initiationBy ?? '').trim() || '',
    NamdaanInitiationPlace: String(p.NamdaanInitiationPlace ?? p.initiationPlace ?? '').trim() || '',
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
