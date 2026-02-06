import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchBadgeCounts, saveBadgeCounts } from '../../services/badgesService'
import { createUser, listUsers, deleteUser } from '../../services/usersService'

function BadgeBarChart({ counts }) {
  const series = useMemo(
    () => [
      { key: 'open', label: 'Open', color: 'bg-orange-500', value: Number(counts.open) || 0 },
      { key: 'permanent', label: 'Permanent', color: 'bg-teal-500', value: Number(counts.permanent) || 0 },
      { key: 'elderly', label: 'Elderly', color: 'bg-slate-700', value: Number(counts.elderly) || 0 },
      { key: 'sangat', label: 'Sangat', color: 'bg-amber-500', value: Number(counts.sangat) || 0 },
      { key: 'newProspects', label: 'New Prospects', color: 'bg-orange-400', value: Number(counts.newProspects) || 0 },
    ],
    [counts],
  )

  const maxValue = Math.max(...series.map((s) => s.value), 1)
  const chartHeight = 200

  return (
    <div className="flex h-56 items-end gap-4 px-2">
      {series.map((item) => {
        const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0
        return (
          <div key={item.key} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="flex w-full flex-1 flex-col justify-end"
              style={{ minHeight: chartHeight }}
            >
              <span className="mb-1 text-center text-xs font-semibold text-slate-700">{item.value}</span>
              <div
                className={`w-full min-w-[24px] rounded-t ${item.color} transition-all`}
                style={{
                  height: Math.max(barHeight, 4),
                }}
              />
            </div>
            <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
          </div>
        )
      })}
    </div>
  )
}

function AdminDashboard() {
  const { setDashboardActions } = useOutletContext()

  const [counts, setCounts] = useState({
    open: 0,
    permanent: 0,
    elderly: 0,
    sangat: 0,
    newProspects: 0,
  })
  const [draft, setDraft] = useState(counts)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState('default')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const totalBadges = useMemo(
    () => draft.open + draft.permanent + draft.elderly + draft.sangat + draft.newProspects,
    [draft],
  )

  useEffect(() => {
    loadCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setDashboardActions?.({
      openBadgeModal,
      openUserModal,
      openExistingUsersModal,
    })
    return () => setDashboardActions?.(null)
  }, [
    setDashboardActions,
    counts,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ])

  async function loadCounts() {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await fetchBadgeCounts()
      setCounts(result.counts)
      setDraft(result.counts)
      setSource(result.source)
    } catch (err) {
      console.error(err)
      setError('Unable to load badge counts right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field) => (e) => {
    const value = Number(e.target.value || 0)
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  const [badgeModalOpen, setBadgeModalOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSubmitting, setUserSubmitting] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'user' })
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')

  async function loadUsers() {
    setUsersLoading(true)
    try {
      const result = await listUsers()
      setUsers(result.documents || [])
    } catch (err) {
      console.error(err)
    } finally {
      setUsersLoading(false)
    }
  }

  function openBadgeModal() {
    setDraft(counts)
    setError('')
    setSuccess('')
    setBadgeModalOpen(true)
  }

  function closeBadgeModal() {
    setBadgeModalOpen(false)
    setDraft(counts)
  }

  function openUserModal() {
    setUserModalOpen(true)
    setUserError('')
    setUserSuccess('')
    setUserForm({ email: '', password: '', role: 'user' })
  }

  const handleUserInput = (field) => (e) => {
    setUserForm((prev) => ({ ...prev, [field]: e.target.value }))
    setUserError('')
    setUserSuccess('')
  }

  async function handleAddUser(e) {
    e.preventDefault()
    if (!userForm.email || !userForm.password) {
      setUserError('Email and password are required.')
      return
    }
    setUserSubmitting(true)
    setUserError('')
    setUserSuccess('')
    try {
      await createUser(userForm.email, userForm.password, userForm.role)
      setUserSuccess(`User "${userForm.email}" created.`)
      setUserForm({ email: '', password: '', role: 'user' })
    } catch (err) {
      setUserError(err.message || 'Failed to create user.')
    } finally {
      setUserSubmitting(false)
    }
  }

  async function handleSaveBadgeModal() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await saveBadgeCounts(draft)
      setCounts(draft)
      setSuccess('Badge counts saved successfully.')
      setSource('database')
      setBadgeModalOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to save badge counts.')
    } finally {
      setSaving(false)
    }
  }

  const [existingUsersModalOpen, setExistingUsersModalOpen] = useState(false)

  async function openExistingUsersModal() {
    setExistingUsersModalOpen(true)
    setUserError('')
    await loadUsers()
  }

  async function handleDeleteUserFromList(userId, email) {
    if (!confirm(`Delete user "${email}"?`)) return
    try {
      await deleteUser(userId)
      await loadUsers()
    } catch (err) {
      setUserError(err.message || 'Failed to delete user.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      </header>

      {/* Top row: Badge Overview (chart) + Total Badges */}
      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        {/* Badge Overview - large white card with bar chart */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Badge Overview</h2>
            <p className="mt-0.5 text-xs text-slate-500">Current distribution of various badges.</p>
          </div>
          <BadgeBarChart counts={draft} />
        </div>

        {/* Total Badges - white card */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Total Badges</h2>
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{totalBadges}</p>
          <p className="mt-1 text-xs text-slate-500">Sum of all badge categories.</p>
        </div>
      </section>

      {/* Edit Badge Counts modal */}
      {badgeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-modal-title"
          onClick={closeBadgeModal}
        >
        <div
          className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
            <h2 id="badge-modal-title" className="text-lg font-semibold text-slate-900">
              Edit Badge Counts
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Update numbers for each category and save.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'open', label: 'Open' },
                { key: 'permanent', label: 'Permanent' },
                { key: 'elderly', label: 'Elderly' },
                { key: 'sangat', label: 'Sangat' },
                { key: 'newProspects', label: 'New Prospects' },
              ].map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                  <span className="text-xs font-medium text-slate-600">{label}</span>
                  <input
                    type="number"
                    min="0"
                    value={draft[key]}
                    onChange={handleChange(key)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                  />
                </label>
              ))}
            </div>
            {error && (
              <div className="mt-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                {success}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBadgeModal}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBadgeModal}
                disabled={saving}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User modal - form only */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-modal-title"
          onClick={() => setUserModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="user-modal-title" className="text-lg font-semibold text-slate-900">
                Add User
              </h2>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Create a user. They will log in with email and password from the database.
            </p>
            <form onSubmit={handleAddUser} className="mt-4 space-y-3">
              <div>
                <label htmlFor="user-email" className="text-xs font-medium text-slate-600">Email</label>
                <input
                  id="user-email"
                  type="email"
                  required
                  value={userForm.email}
                  onChange={handleUserInput('email')}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label htmlFor="user-password" className="text-xs font-medium text-slate-600">Password</label>
                <input
                  id="user-password"
                  type="password"
                  required
                  value={userForm.password}
                  onChange={handleUserInput('password')}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="user-role" className="text-xs font-medium text-slate-600">Role</label>
                <select
                  id="user-role"
                  value={userForm.role}
                  onChange={handleUserInput('role')}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {userError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {userError}
                </div>
              )}
              {userSuccess && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {userSuccess}
                </div>
              )}
              <button
                type="submit"
                disabled={userSubmitting}
                className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
              >
                {userSubmitting ? 'Creating…' : 'Add User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Existing Users modal - scrollable list */}
      {existingUsersModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="existing-users-modal-title"
          onClick={() => setExistingUsersModalOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="existing-users-modal-title" className="text-lg font-semibold text-slate-900">
                Existing Users
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {usersLoading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setExistingUsersModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {usersLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading users…</p>
              ) : users.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No users yet. Add users using the Add User button.</p>
              ) : (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li
                      key={u.$id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{u.email}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Role: {u.role || 'user'} · Created {new Date(u.$createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteUserFromList(u.$id, u.email)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {userError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {userError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard

