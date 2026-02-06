import { useEffect, useState } from 'react'
import { createUser, listUsers, deleteUser } from '../../services/usersService'

function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'user',
  })

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const result = await listUsers()
      setUsers(result.documents || [])
    } catch (err) {
      console.error(err)
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    if (!formData.email || !formData.password) {
      setError('Email and password are required.')
      setSubmitting(false)
      return
    }

    try {
      await createUser(formData.email, formData.password, formData.role)
      setSuccess(`User "${formData.email}" created successfully!`)
      setFormData({ email: '', password: '', role: 'user' })
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (userId, email) => {
    if (!confirm(`Are you sure you want to delete user "${email}"?`)) {
      return
    }

    try {
      await deleteUser(userId)
      setSuccess(`User "${email}" deleted successfully.`)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to delete user.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-xs text-slate-500">Manage user accounts and access</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr,1.5fr]">
        {/* Add User Form */}
        <div className="rounded-3xl bg-white/90 p-5 shadow-md shadow-cyan-100/70">
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Add New User
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Create a new user account. Users will log in with email and password stored in the
              database.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-medium text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange('email')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 outline-none ring-0 focus:border-cyan-400 focus:bg-white focus:shadow-md focus:shadow-cyan-100"
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-medium text-slate-600">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange('password')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 outline-none ring-0 focus:border-cyan-400 focus:bg-white focus:shadow-md focus:shadow-cyan-100"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="role" className="text-[11px] font-medium text-slate-600">
                Role
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={handleInputChange('role')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-100 outline-none ring-0 focus:border-cyan-400 focus:bg-white focus:shadow-md focus:shadow-cyan-100"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-cyan-400/60 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-300"
            >
              {submitting ? 'Creating...' : 'Add User'}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="rounded-3xl bg-white/90 p-5 shadow-md shadow-cyan-100/70">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Existing Users
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {loading ? 'Loading...' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-[11px] font-medium text-cyan-700 shadow-sm shadow-cyan-100/70 transition hover:border-cyan-200 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-slate-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No users found.</p>
              <p className="mt-1 text-xs text-slate-400">Add a user using the form on the left.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.$id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 shadow-sm shadow-slate-100/70"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{user.email}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-xl px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          user.role === 'admin'
                            ? 'bg-cyan-100 text-cyan-700 ring-1 ring-inset ring-cyan-200'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
                        }`}
                      >
                        {user.role || 'user'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Created {new Date(user.$createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(user.$id, user.email)}
                    className="ml-3 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600 shadow-sm shadow-red-100/70 transition hover:border-red-200 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UsersPage
