import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../services/AuthContext'
import { listProspectsAssignedTo, docToDisplay } from '../services/prospectsService'
import { createCallLog, listCallLogsForUser } from '../services/callLogsService'

const SEARCH_BY_OPTIONS = ['Name of Sewadar/Sewadarni', 'Address', 'Phone Number', 'Badge ID', 'Blood Group']

function getAttr(doc, ...keys) {
  if (!doc || typeof doc !== 'object') return ''
  for (const k of keys) {
    const v = doc[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

const INITIAL_FORM = {
  select: '',
  callBack: '',
  notInterest: '',
  needToWork: '',
  notes1: '',
  notes2: '',
  notes3: '',
  nominalListSelect: '',
  visitSelect: '',
  freeSewa: 'N/A',
  jathaDetails: [],
}

const INITIAL_JATHA = { areaName: '', departmentName: '', jathaTotalDay: '', dateFrom: '', dateTo: '' }

function UserDashboard() {
  const { user } = useAuth()
  const [prospects, setProspects] = useState([])
  const [prospectDocs, setProspectDocs] = useState({})
  const [searchBy, setSearchBy] = useState('Name of Sewadar/Sewadarni')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [userCallLogsByProspect, setUserCallLogsByProspect] = useState({})

  const loadAssigned = useCallback(async () => {
    const email = user?.email
    if (!email) {
      setProspects([])
      setProspectDocs({})
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await listProspectsAssignedTo(email)
      const docs = res.documents || []
      const display = docs.map(docToDisplay)
      const byId = {}
      docs.forEach((d) => { byId[d.$id] = d })
      setProspects(display)
      setProspectDocs(byId)
    } catch (err) {
      setError(err.message || 'Failed to load assigned prospects.')
    } finally {
      setLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    loadAssigned()
  }, [loadAssigned])

  useEffect(() => {
    async function loadUserCallLogs() {
      const email = user?.email
      if (!email) {
        setUserCallLogsByProspect({})
        return
      }
      try {
        const res = await listCallLogsForUser(email)
        const docs = res.documents || []
        const byProspect = {}
        docs.forEach((d) => {
          if (!d.prospectId) return
          if (!byProspect[d.prospectId]) byProspect[d.prospectId] = d
        })
        setUserCallLogsByProspect(byProspect)
      } catch {
        // ignore; user can still submit forms
      }
    }
    loadUserCallLogs()
  }, [user?.email])

  const baseFiltered = prospects.filter((p) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const field = {
      'Name of Sewadar/Sewadarni': p.name,
      Address: p.address,
      'Phone Number': p.phoneNumber,
      'Badge ID': p.badgeId,
      'Blood Group': p.bloodGroup,
    }[searchBy]
    return String(field || '').toLowerCase().includes(q)
  })

  const updateForm = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function openForm(prospect, options = {}) {
    const mode = options.mode || 'edit'
    setSelectedProspect(prospect)
    setSelectedDoc(prospectDocs[prospect.id] || null)
    const existingLog = userCallLogsByProspect[prospect.id]
    if (mode === 'view' && existingLog) {
      let jatha = []
      try {
        jatha =
          typeof existingLog.jathaDetails === 'string'
            ? JSON.parse(existingLog.jathaDetails || '[]')
            : existingLog.jathaDetails || []
      } catch {
        jatha = []
      }
      setForm({
        select: existingLog.select || '',
        callBack: existingLog.callBack || '',
        notInterest: existingLog.notInterest || '',
        needToWork: existingLog.needToWork || '',
        notes1: existingLog.notes1 || '',
        notes2: existingLog.notes2 || '',
        notes3: existingLog.notes3 || '',
        nominalListSelect: existingLog.nominalListSelect || '',
        visitSelect: existingLog.visitSelect || '',
        freeSewa: existingLog.freeSewa || 'N/A',
        jathaDetails: Array.isArray(jatha) ? jatha : [],
      })
      setViewOnly(true)
    } else {
      setForm(INITIAL_FORM)
      setViewOnly(false)
    }
    setSuccess('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setSelectedProspect(null)
    setSelectedDoc(null)
    setForm(INITIAL_FORM)
    setViewOnly(false)
  }

  function addJatha() {
    setForm((f) => ({ ...f, jathaDetails: [...f.jathaDetails, { ...INITIAL_JATHA }] }))
  }

  function updateJatha(index, field, value) {
    setForm((f) => ({
      ...f,
      jathaDetails: f.jathaDetails.map((j, i) => (i === index ? { ...j, [field]: value } : j)),
    }))
  }

  function removeJatha(index) {
    setForm((f) => ({ ...f, jathaDetails: f.jathaDetails.filter((_, i) => i !== index) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (viewOnly) return
    if (!selectedProspect || !user?.email) return
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await createCallLog({
        prospectId: selectedProspect.id,
        prospectName: selectedProspect.name,
        submittedBy: user.email,
        select: form.select,
        callBack: form.callBack,
        notInterest: form.notInterest,
        needToWork: form.needToWork,
        notes1: form.notes1,
        notes2: form.notes2,
        notes3: form.notes3,
        nominalListSelect: form.nominalListSelect,
        visitSelect: form.visitSelect,
        freeSewa: form.freeSewa,
        jathaDetails: form.jathaDetails,
      })
      setSuccess('Form submitted successfully. Admin can view it in the dashboard.')
      setTimeout(() => closeForm(), 1500)
    } catch (err) {
      setError(err.message || 'Failed to submit form.')
    } finally {
      setSubmitting(false)
    }
  }

  const doc = selectedDoc

  return (
    <div className="space-y-3 sm:space-y-5">
        <header>
          <h1 className="text-base font-semibold text-slate-900 sm:text-xl">Prospects Details</h1>
        </header>

        <div className="overflow-hidden rounded-lg bg-white p-2.5 shadow-sm sm:rounded-xl sm:p-4">
          {/* Search */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm"
              >
                {SEARCH_BY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>Search by {opt}</option>
                ))}
              </select>
              <div className="relative w-full sm:min-w-[180px] sm:flex-1">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-slate-400 sm:rounded-lg sm:pl-9 sm:pr-3 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* Table / Cards */}
          <div className="mt-3 overflow-x-auto rounded-lg sm:mt-4 sm:overflow-visible sm:rounded-xl">
            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                <p className="text-sm text-slate-500">Loading your assigned prospects…</p>
              </div>
            ) : baseFiltered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-600">No prospects assigned to you yet</p>
                <p className="mt-1 text-sm text-slate-500">The admin will assign prospects from the Prospects Details page.</p>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="flex flex-col gap-2 md:hidden">
                  {baseFiltered.map((p) => {
                    const existingLog = userCallLogsByProspect[p.id]
                    const hasLog = !!existingLog
                    return (
                      <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{p.name || '-'}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-600">{p.address || '-'}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{p.phoneNumber || '-'}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">ID:{p.badgeId || '-'} · {p.bloodGroup || '-'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openForm(p, { mode: hasLog ? 'view' : 'edit' })}
                          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white ${
                            hasLog ? 'bg-slate-600 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {hasLog ? 'View Form' : 'Fill Form'}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-4 py-3 font-semibold text-slate-700">Name of Sewadar/Sewadarni</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Address</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Phone Number</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Badge ID</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Blood Group</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseFiltered.map((p) => {
                        const existingLog = userCallLogsByProspect[p.id]
                        const hasLog = !!existingLog
                        return (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-900">{p.name || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{p.address || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{p.phoneNumber || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{p.badgeId || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{p.bloodGroup || '-'}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => openForm(p, { mode: hasLog ? 'view' : 'edit' })}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                                  hasLog ? 'bg-slate-600 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                {hasLog ? 'View Form' : 'Fill Form'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

      {/* Call Form Modal - matches image layout */}
      {formOpen && selectedProspect && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="call-form-title"
          onClick={closeForm}
        >
          <div
            className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
              <button type="button" onClick={closeForm} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                ← Back
              </button>
              <h2 id="call-form-title" className="text-lg font-semibold text-slate-900">
                Prospect Details – {selectedProspect.name}
              </h2>
              <span className="w-14" />
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-sky-100/80 p-4 sm:p-6">
              {/* Read-only prospect info (top section from image) */}
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Mobile</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'mobile', 'Mobile') || selectedProspect.phoneNumber || '-'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Date of Birth</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'dateOfBirth', 'dateOfBirth') || '-'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Dept Finalised Name</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'DeptFinalisedName', 'DeptFinalisedName', 'departmentName') || '-'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Marital Status</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'maritalStatus', 'maritalStatus') || '-'}</p>
                </div>
              </div>
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <label className="mb-1 block text-xs font-semibold text-slate-700">R/O Village/Town/Locality/District</label>
                <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'locality', 'locality') || '-'}</p>
              </div>
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <label className="mb-2 block text-sm font-bold text-slate-900 underline">ADDRESS</label>
                <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'address', 'Address') || selectedProspect.address || '-'}</p>
              </div>

              {/* Namdaan Details - bold red header */}
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">Namdaan Details</p>
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Doi</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'NamdaanDOI', 'NamdaanDOI', 'dateOfInitiation') || '-'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Is Initiated</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'namdaanInitiated', 'namdaanInitiated') || '-'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Initiation By</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'NamdaanInitiationBy', 'NamdaanInitiationBy', 'initiationBy') || '-'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Initiation Place</label>
                  <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">{getAttr(doc, 'NamdaanInitiationPlace', 'NamdaanInitiationPlace', 'initiationPlace') || '-'}</p>
                </div>
              </div>

              {/* Calling Data Select Option + Transfer Data - layout side by side */}
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">Calling Data Select Option</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Select</label>
                      <select
                        value={form.select}
                        onChange={updateForm('select')}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Call Back</label>
                      <select
                        value={form.callBack}
                        onChange={updateForm('callBack')}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Not Interest</label>
                      <select
                        value={form.notInterest}
                        onChange={updateForm('notInterest')}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">Transfer Data</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Nominal List Select</label>
                      <select
                        value={form.nominalListSelect}
                        onChange={updateForm('nominalListSelect')}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Visit Select</label>
                      <select
                        value={form.visitSelect}
                        onChange={updateForm('visitSelect')}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Free Sewa</label>
                      <select
                        value={form.freeSewa}
                        onChange={updateForm('freeSewa')}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="N/A">N/A</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Need to Work notes */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">Need to Work</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Good participation</label>
                    <textarea
                      value={form.notes1}
                      onChange={updateForm('notes1')}
                      disabled={viewOnly}
                      rows={2}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Positive</label>
                    <textarea
                      value={form.notes2}
                      onChange={updateForm('notes2')}
                      disabled={viewOnly}
                      rows={2}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">VIP prospect</label>
                    <textarea
                      value={form.notes3}
                      onChange={updateForm('notes3')}
                      disabled={viewOnly}
                      rows={2}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* Jatha Details - bold red header */}
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">Jatha Details</p>
              {!viewOnly && (
              <button type="button" onClick={addJatha} className="mb-3 flex items-center gap-1.5 rounded-lg border border-sky-400 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                + Add Jatha
              </button>
              )}
              {form.jathaDetails.length > 0 && (
                <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-2 font-semibold text-slate-700">Area Name</th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Department name</th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Jatha total Day</th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Date From..To..</th>
                        <th className="w-10 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.jathaDetails.map((j, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="px-3 py-2"><input type="text" value={j.areaName} onChange={(e) => updateJatha(i, 'areaName', e.target.value)} placeholder="e.g. North Hall" disabled={viewOnly} className="w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50" /></td>
                          <td className="px-3 py-2"><input type="text" value={j.departmentName} onChange={(e) => updateJatha(i, 'departmentName', e.target.value)} placeholder="e.g. Langar Seva" disabled={viewOnly} className="w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50" /></td>
                          <td className="px-3 py-2"><input type="text" value={j.jathaTotalDay} onChange={(e) => updateJatha(i, 'jathaTotalDay', e.target.value)} placeholder="Days" disabled={viewOnly} className="w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50" /></td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <input type="date" value={j.dateFrom} onChange={(e) => updateJatha(i, 'dateFrom', e.target.value)} disabled={viewOnly} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50" />
                              <input type="date" value={j.dateTo} onChange={(e) => updateJatha(i, 'dateTo', e.target.value)} disabled={viewOnly} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50" />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {!viewOnly && (
                            <button type="button" onClick={() => removeJatha(i)} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Remove"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
              {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

              {!viewOnly && (
                <div className="flex justify-center pt-4">
                  <button type="submit" disabled={submitting} className="w-full max-w-xs rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {submitting ? 'Submitting…' : 'SUBMIT'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDashboard
