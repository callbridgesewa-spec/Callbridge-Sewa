import { createContext, useContext, useEffect, useState } from 'react'
import { Query } from 'appwrite'
import { account, databases, APPWRITE_CONFIG } from './appwriteClient'

const AuthContext = createContext(null)

const LOCAL_AUTH_KEY = 'cb-local-auth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null) // 'admin' | 'user'
  const [loading, setLoading] = useState(true)

  // Fetch current session on mount
  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      setLoading(true)
      try {
        // 1) Try Appwrite session (admin)
        const sessionUser = await account.get()
        if (cancelled) return
        setUser({ ...sessionUser, source: 'appwrite' })
        setRole('admin')
      } catch {
        // 2) Fallback to local DB-based session
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem(LOCAL_AUTH_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed?.email && parsed?.role) {
                setUser({ email: parsed.email, id: parsed.id, source: 'database' })
                setRole(parsed.role)
                setLoading(false)
                return
              }
            }
          } catch {
            // ignore
          }
        }

        if (!cancelled) {
          setUser(null)
          setRole(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  async function login(email, password) {
    setLoading(true)
    try {
      // Clear existing Appwrite sessions first
      try {
        await account.deleteSessions()
      } catch {
        // ignore if none
      }

      // 1) Try Appwrite auth (admin)
      try {
        await account.createEmailPasswordSession(email, password)
        const sessionUser = await account.get()
        const adminUser = { ...sessionUser, source: 'appwrite' }
        setUser(adminUser)
        setRole('admin')

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(LOCAL_AUTH_KEY)
        }

        return { user: adminUser, role: 'admin' }
      } catch (appwriteError) {
        // 2) Fallback to database-backed users
        const { databaseId, usersCollectionId } = APPWRITE_CONFIG
        if (!databaseId || !usersCollectionId) {
          throw appwriteError
        }

        const result = await databases.listDocuments(databaseId, usersCollectionId, [
          Query.equal('email', email),
          Query.equal('password', password),
        ])

        if (!result.total) {
          throw appwriteError
        }

        const doc = result.documents[0]
        const userRole = doc.role === 'admin' || doc.role === 'user' ? doc.role : 'user'
        const dbUser = { email: doc.email, id: doc.$id, source: 'database' }

        setUser(dbUser)
        setRole(userRole)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            LOCAL_AUTH_KEY,
            JSON.stringify({ email: doc.email, id: doc.$id, role: userRole }),
          )
        }

        return { user: dbUser, role: userRole }
      }
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    setLoading(true)
    try {
      await account.deleteSessions()
    } catch {
      // ignore
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LOCAL_AUTH_KEY)
      }
      setUser(null)
      setRole(null)
      setLoading(false)
    }
  }

  const value = {
    user,
    role,
    loading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

