import { Navigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cyan-50">
        <div className="rounded-xl bg-white px-6 py-4 shadow-md">
          <p className="text-sm font-medium text-slate-600">Checking access…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole) {
    // Redirect to correct dashboard if logged in with different role
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (role === 'user') return <Navigate to="/user/prospects-details" replace />
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute

