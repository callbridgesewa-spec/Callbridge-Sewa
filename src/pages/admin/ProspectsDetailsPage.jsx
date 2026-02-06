import { useRef, useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  uploadProspectExcel,
  listProspects,
  createProspect,
  createProspectsBulk,
  assignProspectsToUser,
  unassignProspects,
  deleteProspect,
  deleteProspectsBulk,
  docToDisplay,
} from '../../services/prospectsService'
import { listUsers } from '../../services/usersService'

const SEARCH_BY_OPTIONS = ['Name', 'Address', 'Phone Number', 'Batch Number', 'Assigned To', 'Blood Group']

const HEADER_ALIASES = {
  name: ['name', 'prospect', 'client', 'full name', 'fullname'],
  address: ['address', 'location', 'addr'],
  phoneNumber: ['phone', 'phone number', 'mobile', 'contact', 'tel'],
  batchNumber: ['batch', 'batch number', 'batch no', 'batch no.'],
  assignedTo: ['assigned to', 'assigned', 'agent', 'user'],
  bloodGroup: ['blood group', 'blood', 'blood type', 'bg'],
}

function findHeaderIndex(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '').toLowerCase().trim()
    if (aliases.some((a) => h.includes(a) || a.includes(h))) return i
  }
  return -1
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
        if (!json.length) {
          resolve([])
          return
        }
        const headers = json[0].map((h) => String(h ?? ''))
        const nameIdx = findHeaderIndex(headers, HEADER_ALIASES.name)
        const addrIdx = findHeaderIndex(headers, HEADER_ALIASES.address)
        const phoneIdx = findHeaderIndex(headers, HEADER_ALIASES.phoneNumber)
        const batchIdx = findHeaderIndex(headers, HEADER_ALIASES.batchNumber)
        const assignedIdx = findHeaderIndex(headers, HEADER_ALIASES.assignedTo)
        const bloodIdx = findHeaderIndex(headers, HEADER_ALIASES.bloodGroup)

        const rows = json.slice(1)
        const prospects = rows
          .filter((row) => row.some((cell) => cell != null && String(cell).trim()))
          .map((row) => {
            const get = (idx) => (idx >= 0 && row[idx] != null ? String(row[idx]).trim() : '')
            return {
              id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: get(nameIdx) || (row[0] != null ? String(row[0]).trim() : ''),
              address: get(addrIdx),
              phoneNumber: get(phoneIdx),
              batchNumber: get(batchIdx),
              assignedTo: get(assignedIdx) || 'Unassigned',
              bloodGroup: get(bloodIdx) || '-',
            }
          })
        resolve(prospects)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function getImportSignature(prospects) {
  const rows = prospects
    .map((p) => [p.name, p.address, p.phoneNumber, p.batchNumber, p.assignedTo, p.bloodGroup].join('|'))
    .sort()
  return rows.join('\n')
}

function exportToExcel(prospects) {
  const headers = ['Name', 'Address', 'Phone Number', 'Batch Number', 'Assigned To', 'Blood Group']
  const rows = prospects.map((p) => [
    p.name,
    p.address,
    p.phoneNumber,
    p.batchNumber,
    p.assignedTo,
    p.bloodGroup,
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Prospects')
  XLSX.writeFile(wb, `prospects_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

const INITIAL_ADD_FORM = {
  name: '',
  fathersName: '',
  mobileNumber: '',
  age: '',
  departmentName: '',
  badgeStatus: 'N/A',
  badgeId: '',
  gender: 'Male',
  aadharNumber: '',
  dateOfBirth: '',
  emergencyContact: '',
  alternatePhone: '',
  locality: '',
  fullAddress: '',
  maritalStatus: 'N/A',
  initiated: false,
  dateOfInitiation: '',
  initiationBy: '',
  initiationPlace: '',
}

function ProspectsDetailsPage() {
  const [prospects, setProspects] = useState([])
  const [searchBy, setSearchBy] = useState('Name')
  const [searchQuery, setSearchQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importedSignatures, setImportedSignatures] = useState(new Set())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState(INITIAL_ADD_FORM)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [assignToUser, setAssignToUser] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [assignedFilterUser, setAssignedFilterUser] = useState('')
  const fileInputRef = useRef(null)

  const loadProspects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listProspects()
      const display = (res.documents || []).map(docToDisplay)
      setProspects(display)
    } catch (err) {
      setError(err.message || 'Failed to load prospects.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const res = await listUsers()
      setUsers(res.documents || [])
    } catch {
      setUsers([])
    }
  }, [])

  useEffect(() => {
    loadProspects()
    loadUsers()
  }, [loadProspects, loadUsers])

  const updateAddForm = (field) => (e) => setAddForm((f) => ({ ...f, [field]: e.target.value }))
  const updateAddFormRadio = (field) => (e) => setAddForm((f) => ({ ...f, [field]: e.target.value }))

  const baseFiltered = prospects.filter((p) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    const field = {
      Name: p.name,
      Address: p.address,
      'Phone Number': p.phoneNumber,
      'Batch Number': p.batchNumber,
      'Assigned To': p.assignedTo,
      'Blood Group': p.bloodGroup,
    }[searchBy]
    return String(field || '').toLowerCase().includes(q)
  })

  const filteredProspects =
    activeTab === 'assigned'
      ? baseFiltered.filter((p) => p.assignedTo && p.assignedTo !== 'Unassigned' && (!assignedFilterUser || p.assignedTo === assignedFilterUser))
      : baseFiltered

  const assignedUsers = [...new Set(prospects.map((p) => p.assignedTo).filter((e) => e && e !== 'Unassigned'))]
  const assignableUsers = users.map((u) => u.email).filter(Boolean)

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size >= filteredProspects.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProspects.map((p) => p.id)))
    }
  }

  const handleAssign = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one prospect.')
      return
    }
    if (assignToUser === '') {
      setError('Please select a user or choose "Unassign".')
      return
    }
    setAssigning(true)
    setError('')
    try {
      if (assignToUser === '__UNASSIGN__') {
        await unassignProspects([...selectedIds])
      } else {
        await assignProspectsToUser([...selectedIds], assignToUser)
      }
      setSelectedIds(new Set())
      setAssignToUser('')
      await loadProspects()
    } catch (err) {
      setError(err.message || 'Failed to assign/unassign prospects.')
    } finally {
      setAssigning(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this prospect? This action cannot be undone.')) {
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteProspect(id)
      await loadProspects()
    } catch (err) {
      setError(err.message || 'Failed to delete prospect.')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one prospect to delete.')
      return
    }
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} prospect(s)? This action cannot be undone.`)) {
      return
    }
    setDeleting(true)
    setError('')
    try {
      await deleteProspectsBulk([...selectedIds])
      setSelectedIds(new Set())
      await loadProspects()
    } catch (err) {
      setError(err.message || 'Failed to delete prospects.')
    } finally {
      setDeleting(false)
    }
  }

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const parsed = await parseExcelFile(file)
      const signature = getImportSignature(parsed)
      if (importedSignatures.has(signature)) {
        setError('This Excel file has already been imported. No duplicate data added.')
      } else {
        try {
          await createProspectsBulk(parsed)
          setImportedSignatures((prev) => new Set(prev).add(signature))
          await loadProspects()
        } catch (dbErr) {
          setError(dbErr.message || 'Failed to save prospects to database.')
        }
        try {
          await uploadProspectExcel(file)
        } catch {
          // Storage upload optional; DB is primary
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to import Excel.')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleExportExcel = () => {
    if (prospects.length === 0) {
      setError('No prospects to export.')
      return
    }
    exportToExcel(filteredProspects)
  }

  const handleSubmitProspect = async (e) => {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.mobileNumber.trim()) {
      setError('Name and Mobile Number are required.')
      return
    }
    setAddSubmitting(true)
    setError('')
    const prospect = { ...addForm }
    try {
      await createProspect(prospect)
      setAddForm(INITIAL_ADD_FORM)
      setAddModalOpen(false)
      await loadProspects()
    } catch (err) {
      setError(err.message || 'Failed to add prospect.')
    } finally {
      setAddSubmitting(false)
    }
  }

  const closeAddModal = () => {
    setAddModalOpen(false)
    setAddForm(INITIAL_ADD_FORM)
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Prospects Details</h1>
      </header>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        {/* Search and actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            >
              {SEARCH_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  Search by {opt}
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[180px]">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Prospect
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {importing ? 'Importing…' : 'Import Excel'}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50/50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                All Prospects
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assigned')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'assigned'
                    ? 'bg-sky-100 text-sky-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Assigned to Users
              </button>
            </div>
            {activeTab === 'assigned' && (
              <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <label className="text-sm font-medium text-sky-800">Filter by user:</label>
                <select
                  value={assignedFilterUser}
                  onChange={(e) => setAssignedFilterUser(e.target.value)}
                  className="rounded-md border border-sky-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                >
                  <option value="">All assigned users</option>
                  {assignedUsers.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

        </div>

        {/* Assign bar */}
        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <span className="text-sm text-slate-700">{selectedIds.size} selected</span>
            <select
              value={assignToUser}
              onChange={(e) => setAssignToUser(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">Select action...</option>
              <option value="__UNASSIGN__" className="text-red-600">Unassign</option>
              <optgroup label="Assign to user:">
                {assignableUsers.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              type="button"
              onClick={handleAssign}
              disabled={!assignToUser || assigning}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
                assignToUser === '__UNASSIGN__'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {assigning
                ? assignToUser === '__UNASSIGN__'
                  ? 'Unassigning…'
                  : 'Assigning…'
                : assignToUser === '__UNASSIGN__'
                  ? 'Unassign'
                  : 'Assign'}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Delete Selected'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Add Prospect Modal */}
        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-prospect-title"
            onClick={closeAddModal}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 id="add-prospect-title" className="text-lg font-semibold text-slate-900">Add Prospect Details</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Fill in the details for the new prospect.</p>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmitProspect} className="flex-1 overflow-y-auto px-5 py-4">
                {/* Profile Details */}
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Profile Details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Name of Sevadaar/Sevadarni *</label>
                    <input
                      type="text"
                      required
                      value={addForm.name}
                      onChange={updateAddForm('name')}
                      placeholder="Full name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Badge Status</label>
                    <select
                      value={addForm.badgeStatus}
                      onChange={updateAddForm('badgeStatus')}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="N/A">N/A</option>
                      <option value="Open">Open</option>
                      <option value="Permanent">Permanent</option>
                      <option value="Elderly">Elderly</option>
                      <option value="Sangat">Sangat</option>
                      <option value="New Prospects">New Prospects</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Father&apos;s/Husband&apos;s Name</label>
                    <input
                      type="text"
                      value={addForm.fathersName}
                      onChange={updateAddForm('fathersName')}
                      placeholder="Father's or Husband's name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Badge ID</label>
                    <input
                      type="text"
                      value={addForm.badgeId}
                      onChange={updateAddForm('badgeId')}
                      placeholder="Enter badge ID"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Mobile Number *</label>
                    <input
                      type="text"
                      required
                      value={addForm.mobileNumber}
                      onChange={updateAddForm('mobileNumber')}
                      placeholder="e.g., 9876543210"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Gender (M/F)</label>
                    <div className="flex gap-4 pt-2">
                      {['Male', 'Female', 'Other'].map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="gender"
                            value={opt}
                            checked={addForm.gender === opt}
                            onChange={updateAddFormRadio('gender')}
                            className="text-slate-700"
                          />
                          <span className="text-sm text-slate-600">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Age</label>
                    <input
                      type="text"
                      value={addForm.age}
                      onChange={updateAddForm('age')}
                      placeholder="Age (auto-calculated)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Aadhar Number</label>
                    <input
                      type="text"
                      value={addForm.aadharNumber}
                      onChange={updateAddForm('aadharNumber')}
                      placeholder="12-digit Aadhar number"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Department Finalised Name</label>
                    <input
                      type="text"
                      value={addForm.departmentName}
                      onChange={updateAddForm('departmentName')}
                      placeholder="Department name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Date of Birth</label>
                    <input
                      type="text"
                      value={addForm.dateOfBirth}
                      onChange={updateAddForm('dateOfBirth')}
                      placeholder="dd/mm/yyyy"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Emergency Contact Number</label>
                    <input
                      type="text"
                      value={addForm.emergencyContact}
                      onChange={updateAddForm('emergencyContact')}
                      placeholder="Emergency contact"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Alternate Phone Number</label>
                    <input
                      type="text"
                      value={addForm.alternatePhone}
                      onChange={updateAddForm('alternatePhone')}
                      placeholder="Alternate contact"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Marital Status</label>
                    <select
                      value={addForm.maritalStatus}
                      onChange={updateAddForm('maritalStatus')}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="N/A">N/A</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">R/O Village/Town/Locality/District</label>
                    <input
                      type="text"
                      value={addForm.locality}
                      onChange={updateAddForm('locality')}
                      placeholder="e.g., Model Town, Ludhiana"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Full Address</label>
                    <textarea
                      value={addForm.fullAddress}
                      onChange={updateAddForm('fullAddress')}
                      placeholder="Complete residential address"
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                </div>

                {/* Naam Dan Details */}
                <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Naam Dan Details</p>
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Has the prospect been initiated?</label>
                      <p className="mt-0.5 text-xs text-slate-500">Indicate if Naam Dan has been received.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={addForm.initiated}
                      onClick={() => setAddForm((f) => ({ ...f, initiated: !f.initiated }))}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                        addForm.initiated ? 'bg-sky-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          addForm.initiated ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {addForm.initiated && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Date of Initiation (DOI)</label>
                        <input
                          type="text"
                          value={addForm.dateOfInitiation}
                          onChange={updateAddForm('dateOfInitiation')}
                          placeholder="dd/mm/yyyy"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Initiation By</label>
                        <input
                          type="text"
                          value={addForm.initiationBy}
                          onChange={updateAddForm('initiationBy')}
                          placeholder="Name of initiator"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Initiation Place</label>
                        <input
                          type="text"
                          value={addForm.initiationPlace}
                          onChange={updateAddForm('initiationPlace')}
                          placeholder="Location of initiation"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
                  >
                    Submit Prospect
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <div className={`mt-4 overflow-x-auto rounded-xl ${activeTab === 'assigned' ? 'border-2 border-sky-200 bg-sky-50/30 p-4' : ''}`}>
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">Loading prospects…</p>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div className={`rounded-lg px-6 py-12 text-center ${activeTab === 'assigned' ? 'border-2 border-dashed border-sky-200 bg-sky-50/50' : 'border border-dashed border-slate-200 bg-slate-50/50'}`}>
              <p className="text-sm font-medium text-slate-600">
                {activeTab === 'assigned' ? 'No assigned prospects' : 'No prospects yet'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {activeTab === 'assigned'
                  ? 'Switch to All Prospects, select rows, choose a user, and click Assign. Assigned data will appear here.'
                  : 'Import an Excel file or add a prospect to get started.'}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="w-10 px-2 py-3">
                    <input
                      type="checkbox"
                      checked={filteredProspects.length > 0 && selectedIds.size >= filteredProspects.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Address</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Phone Number</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Batch Number</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Assigned To</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Blood Group</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProspects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="w-10 px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                        aria-label={`Select ${p.name || 'prospect'}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.address || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {p.phoneNumber || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.batchNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.assignedTo || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.bloodGroup || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting}
                        className="rounded p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Delete ${p.name || 'prospect'}`}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProspectsDetailsPage
