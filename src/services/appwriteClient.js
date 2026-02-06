import { Client, Account, Databases } from 'appwrite'

const client = new Client()

// TODO: replace these with your real Appwrite endpoint and project ID.
client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '')

export const account = new Account(client)
export const databases = new Databases(client)

// Central place for IDs used across the app
export const APPWRITE_CONFIG = {
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || '',
  badgeCountsCollectionId: import.meta.env.VITE_APPWRITE_BADGE_COLLECTION_ID || '',
  usersCollectionId: import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID || '',
}

export default client

