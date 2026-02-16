import { Client, Account, Databases, Storage } from 'appwrite'

const client = new Client()

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '')

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)

// Central place for IDs used across the app
export const APPWRITE_CONFIG = {
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || '',
  badgeCountsCollectionId: import.meta.env.VITE_APPWRITE_BADGE_COLLECTION_ID || '',
  usersCollectionId: import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID || '',
  prospectsBucketId: import.meta.env.VITE_APPWRITE_PROSPECTS_BUCKET_ID || '',
  prospectsCollectionId: import.meta.env.VITE_APPWRITE_PROSPECTS_COLLECTION_ID || '',
  callLogsCollectionId: import.meta.env.VITE_APPWRITE_CALLLOGS_COLLECTION_ID || '',
}

export default client

