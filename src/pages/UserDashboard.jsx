import { useAuth } from '../services/AuthContext'

function UserDashboard() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white/90 p-8 text-center shadow-xl shadow-cyan-100/70">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, User</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are logged in successfully{user?.email ? ` as ${user.email}` : ''}.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          This is a limited user view with no editing permissions, used only to verify login.
        </p>
      </div>
    </div>
  )
}

export default UserDashboard

