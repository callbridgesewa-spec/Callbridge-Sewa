import { useCallback, useEffect, useMemo, useState } from 'react'
import { JathaListsModal } from '../components/JathaListsModal'
import { fetchBadgeCounts, saveBadgeCounts, saveRemarks } from '../services/badgesService'
import { createUser, listUsers, deleteUser } from '../services/usersService'

const BADGE_SERIES = [
  { key: 'open',         label: 'Open',             color: '#3b82f6', colorClass: 'bg-blue-500',   value: 0 },
  { key: 'permanent',    label: 'Permanent',         color: '#8B1A2E', colorClass: 'bg-[#8B1A2E]', value: 0 },
  { key: 'elderly',      label: 'Elderly',           color: '#22c55e', colorClass: 'bg-green-500',  value: 0 },
  { key: 'sangat',       label: 'Sangat',            color: '#f97316', colorClass: 'bg-orange-500', value: 0 },
  { key: 'newProspects', label: 'Open New Sewadar',  color: '#eab308', colorClass: 'bg-yellow-500', value: 0 },
]

function BadgePieChart({ counts }) {
  const total = BADGE_SERIES.reduce(
    (sum, s) => sum + (Number(counts[s.key]) || 0),
    0,
  )

  const background = useMemo(() => {
    if (total === 0) {
      return 'conic-gradient(#e2e8f0 0deg 360deg)'
    }

    let acc = 0
    const stops = BADGE_SERIES.map((s) => {
      const val = Number(counts[s.key]) || 0
      const start = (acc / total) * 360
      acc += val
      const end = (acc / total) * 360
      return `${s.color} ${start}deg ${end}deg`
    })

    return `conic-gradient(${stops.join(', ')})`
  }, [counts, total])

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="h-44 w-44 rounded-full border-4 border-white shadow-inner"
        style={{ background }}
      />
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px]">
        {BADGE_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${s.colorClass}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function BadgeBarChart({ counts }) {
  const series = useMemo(
    () =>
      BADGE_SERIES.map((s) => ({
        ...s,
        value: Number(counts[s.key]) || 0,
      })),
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
                className={`w-full min-w-[24px] rounded-t ${item.colorClass} transition-all`}
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

/**
 * Shared badge dashboard for admin (editable) and employees (read-only).
 * @param {boolean} readOnly
 * @param {function|null} setDashboardActions - admin layout registers action buttons
 */
function Dashboard({ readOnly = false, setDashboardActions = null }) {
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

  const displayCounts = readOnly ? counts : draft

  const totalBadges = useMemo(
    () =>
      displayCounts.open +
      displayCounts.permanent +
      displayCounts.elderly +
      displayCounts.sangat +
      displayCounts.newProspects,
    [displayCounts],
  )

  const [badgeModalOpen, setBadgeModalOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSubmitting, setUserSubmitting] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'user' })
  const [showAddUserPassword, setShowAddUserPassword] = useState(false)
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [existingUsersModalOpen, setExistingUsersModalOpen] = useState(false)
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false)
  const [jathaListsModalOpen, setJathaListsModalOpen] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [remarkDraft, setRemarkDraft] = useState('')
  const [remarkSaving, setRemarkSaving] = useState(false)
  const [remarkError, setRemarkError] = useState('')
  const [remarkSuccess, setRemarkSuccess] = useState('')

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
    setShowAddUserPassword(false)
  }

  function openAttendanceModal() {
    setAttendanceModalOpen(true)
  }

  function openJathaListsModal() {
    setJathaListsModalOpen(true)
  }

  async function openExistingUsersModal() {
    setExistingUsersModalOpen(true)
    setUserError('')
    await loadUsers()
  }

  useEffect(() => {
    if (readOnly || !setDashboardActions) return undefined

    setDashboardActions({
      openBadgeModal,
      openUserModal,
      openExistingUsersModal,
      openAttendanceModal,
      openJathaListsModal,
    })
    return () => setDashboardActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, setDashboardActions, counts])

  const loadCounts = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    setRemarkError('')
    try {
      const result = await fetchBadgeCounts()
      setCounts(result.counts)
      setDraft(result.counts)
      setSource(result.source)
      const loadedRemarks = result.remarks ?? ''
      setRemarks(loadedRemarks)
      setRemarkDraft(loadedRemarks)
    } catch (err) {
      console.error(err)
      setError('Unable to load badge counts right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  useEffect(() => {
    function onRemarksUpdated(e) {
      const text = e.detail?.remarks ?? ''
      setRemarks(text)
      if (readOnly) setRemarkDraft(text)
    }
    window.addEventListener('cb-remarks-updated', onRemarksUpdated)
    return () => window.removeEventListener('cb-remarks-updated', onRemarksUpdated)
  }, [readOnly])

  async function handleSaveRemark() {
    setRemarkSaving(true)
    setRemarkError('')
    setRemarkSuccess('')
    try {
      await saveRemarks(remarkDraft)
      setRemarks(remarkDraft.trim())
      setRemarkSuccess('Remark saved.')
    } catch (err) {
      setRemarkError(err?.message || 'Failed to save remark.')
    } finally {
      setRemarkSaving(false)
    }
  }

  async function handleResetRemark() {
    if (!confirm('Clear the dashboard remark for all users?')) return
    setRemarkSaving(true)
    setRemarkError('')
    setRemarkSuccess('')
    try {
      await saveRemarks('')
      setRemarks('')
      setRemarkDraft('')
      setRemarkSuccess('Remark cleared.')
    } catch (err) {
      setRemarkError(err?.message || 'Failed to clear remark.')
    } finally {
      setRemarkSaving(false)
    }
  }

  const handleChange = (field) => (e) => {
    const value = Number(e.target.value || 0)
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

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
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        {readOnly && (
          <p className="mt-1 text-sm text-slate-500">Badge overview (view only)</p>
        )}
      </header>

      {loading && (
        <p className="text-sm text-slate-500">Loading badge counts…</p>
      )}

      {error && !badgeModalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2 lg:grid-rows-2 lg:items-stretch">
        {/* Top left */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Badge Overview</h2>
          <BadgeBarChart counts={displayCounts} />
        </div>

        {/* Top right */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Badge Distribution</h2>
          <BadgePieChart counts={displayCounts} />
        </div>

        {/* Bottom left */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Total Badges</h2>
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '…' : totalBadges}</p>
          <p className="mt-1 text-xs text-slate-500">Sum of all badge categories.</p>
          {!readOnly && source === 'default' && !loading && (
            <p className="mt-2 text-[10px] text-amber-600">Using default values until saved to database.</p>
          )}
        </div>

        {/* Bottom right */}
        <div className="flex min-h-[10rem] flex-col rounded-xl bg-white p-5 shadow-sm">
          <h2 className="shrink-0 text-sm font-semibold text-slate-900">Remarks</h2>
          {readOnly ? (
            <div className="mt-3 flex flex-1 flex-col overflow-hidden">
              {loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : remarks ? (
                <p className="flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {remarks}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">No remark posted yet.</p>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={remarkDraft}
                onChange={(e) => {
                  setRemarkDraft(e.target.value)
                  setRemarkError('')
                  setRemarkSuccess('')
                }}
                placeholder="Add a remark for employees…"
                rows={4}
                className="mt-3 min-h-[5rem] flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
              {remarkError && (
                <p className="mt-2 text-xs text-red-600">{remarkError}</p>
              )}
              {remarkSuccess && (
                <p className="mt-2 text-xs text-emerald-600">{remarkSuccess}</p>
              )}
              <div className="mt-3 flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveRemark}
                  disabled={remarkSaving || loading}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {remarkSaving ? 'Saving…' : 'Save remark'}
                </button>
                <button
                  type="button"
                  onClick={handleResetRemark}
                  disabled={remarkSaving || loading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <JathaListsModal open={jathaListsModalOpen} onClose={() => setJathaListsModalOpen(false)} />

      {!readOnly && badgeModalOpen && (
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
                { key: 'newProspects', label: 'New Sewadars' },
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

      {!readOnly && userModalOpen && (
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
                <div className="relative mt-1">
                  <input
                    id="user-password"
                    type={showAddUserPassword ? 'text' : 'password'}
                    required
                    value={userForm.password}
                    onChange={handleUserInput('password')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddUserPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showAddUserPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAddUserPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
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

      {!readOnly && existingUsersModalOpen && (
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

      {!readOnly && attendanceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-modal-title"
          onClick={() => setAttendanceModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="attendance-modal-title" className="text-lg font-semibold text-slate-900">
                Attendance
              </h2>
              <button
                type="button"
                onClick={() => setAttendanceModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Under Construction</p>
              <p className="mt-2 text-sm text-slate-600">Attendance data is not available yet. This feature will be added soon.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
