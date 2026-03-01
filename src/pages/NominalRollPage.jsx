import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../services/AuthContext'
import { listProspectsAssignedTo, docToDisplay } from '../services/prospectsService'
import { listCallLogsWithNominalList } from '../services/callLogsService'

function NominalRollPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState([]) // { prospect, log }[]

  const loadData = useCallback(async () => {
    const email = user?.email
    if (!email) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [prospectsRes, callLogsRes] = await Promise.all([
        listProspectsAssignedTo(email),
        listCallLogsWithNominalList(),
      ])
      const prospectDocs = prospectsRes.documents || []
      const assignedIds = new Set(prospectDocs.map((d) => d.$id))
      const prospectById = {}
      prospectDocs.forEach((d) => {
        prospectById[d.$id] = docToDisplay(d)
      })

      const logs = callLogsRes.documents || []
      const seen = new Set()
      const list = []
      logs.forEach((log) => {
        const id = log.prospectId
        if (!id || seen.has(id) || !assignedIds.has(id)) return
        seen.add(id)
        const prospect = prospectById[id] || {
          id,
          name: log.prospectName || '-',
          address: '-',
          phoneNumber: '-',
          badgeId: '-',
          assignedTo: '-',
          bloodGroup: '-',
        }
        list.push({ prospect, log })
      })
      setEntries(list)
    } catch (err) {
      setError(err.message || 'Failed to load nominal roll.')
    } finally {
      setLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Nominal Roll</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your assigned prospects marked &quot;Yes&quot; for Nominal List in submitted calling forms
        </p>
      </header>

      <div className="overflow-hidden rounded-lg bg-white p-4 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading nominal roll…</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No entries on the nominal list yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Submit calling forms with &quot;Nominal List Select&quot; set to &quot;Yes&quot; for your assigned prospects to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Badge ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Phone</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Address</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ prospect, log }, i) => (
                  <tr key={prospect.id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{prospect.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{prospect.badgeId || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{prospect.phoneNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{prospect.address || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.$createdAt ? new Date(log.$createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default NominalRollPage
