import { Query } from 'appwrite'
import { databases, APPWRITE_CONFIG } from './appwriteClient'

export async function createUser(email, password, role) {
  const { databaseId, usersCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !usersCollectionId) {
    throw new Error('Appwrite users collection is not configured.')
  }

  // Check if user with this email already exists
  try {
    const existing = await databases.listDocuments(databaseId, usersCollectionId, [
      Query.equal('email', email),
    ])

    if (existing.total > 0) {
      throw new Error('A user with this email already exists.')
    }
  } catch (error) {
    if (error.message.includes('already exists')) {
      throw error
    }
    // If query fails for other reasons, continue (might be permission issue)
  }

  // Generate unique document ID
  const documentId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const newUser = await databases.createDocument(
    databaseId,
    usersCollectionId,
    documentId,
    {
      email,
      password,
      role: role === 'admin' ? 'admin' : 'user',
    },
  )

  return newUser
}

export async function listUsers() {
  const { databaseId, usersCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !usersCollectionId) {
    return { documents: [], total: 0 }
  }

  try {
    const response = await databases.listDocuments(databaseId, usersCollectionId)
    return response
  } catch (error) {
    console.error('Failed to list users', error)
    return { documents: [], total: 0 }
  }
}

export async function deleteUser(userId) {
  const { databaseId, usersCollectionId } = APPWRITE_CONFIG
  if (!databaseId || !usersCollectionId) {
    throw new Error('Appwrite users collection is not configured.')
  }

  await databases.deleteDocument(databaseId, usersCollectionId, userId)
}
