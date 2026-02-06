import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

function LoginPage() {
  const navigate = useNavigate()
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { role } = await login(email, password)
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/user', { replace: true })
      }
    } catch (err) {
      const message = err?.message || 'Failed to log in. Please check your credentials.'
      setError(message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e0f2f7] px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-white">
            <span className="text-xl font-semibold">CS</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">C.S for Sangat</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Internal C.S for Sangat dashboard. Access restricted to authorized staff only.
        </p>
      </div>
    </div>
  )
}

export default LoginPage

