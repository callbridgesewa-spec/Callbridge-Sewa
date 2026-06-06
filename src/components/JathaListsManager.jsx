import { useState } from 'react'
import { useJathaLists } from '../context/JathaListsContext'

function ListEditor({ title, description, items, onAdd, onRemove, onReset, disabled }) {
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await onAdd(input)
      if (result.added) {
        setInput('')
        setMessage('')
      } else {
        setMessage(result.error || 'Could not add.')
      }
    } catch (err) {
      setMessage(err?.message || 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (name) => {
    setBusy(true)
    setMessage('')
    try {
      await onRemove(name)
    } catch (err) {
      setMessage(err?.message || 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (!confirm(`Reset ${title.toLowerCase()} to the built-in default list?`)) return
    setBusy(true)
    setMessage('')
    try {
      await onReset()
    } catch (err) {
      setMessage(err?.message || 'Failed to save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled || busy}
          className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
        >
          Reset defaults
        </button>
      </div>

      <form onSubmit={handleAdd} className="mb-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setMessage('')
          }}
          disabled={disabled || busy}
          placeholder={`New ${title.toLowerCase().replace(/s$/, '')}…`}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={disabled || busy}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Add'}
        </button>
      </form>

      {message && <p className="mb-2 text-xs text-red-600">{message}</p>}

      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-white">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">No items yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800"
              >
                <span className="min-w-0 truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(name)}
                  disabled={disabled || busy}
                  className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{items.length} item(s)</p>
    </div>
  )
}

/** @param {{ embedded?: boolean }} props */
export function JathaListsManager({ embedded = false }) {
  const {
    departments,
    areas,
    loading,
    saving,
    error,
    addDepartment,
    removeDepartment,
    addArea,
    removeArea,
    resetDepartments,
    resetAreas,
    visitOptions,
    addVisitOption,
    removeVisitOption,
    resetVisitOptions,
  } = useJathaLists()

  const disabled = loading || saving

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-3'}>
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dropdown options</h2>
          <p className="mt-1 text-xs text-slate-500">
            Stored in the badge-counts document.
          </p>
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Loading lists…</p>}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {saving && !loading && <p className="text-xs text-slate-500">Saving…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <ListEditor
          title="Areas"
          description="badge-counts → area"
          items={areas}
          onAdd={addArea}
          onRemove={removeArea}
          onReset={resetAreas}
          disabled={disabled}
        />
        <ListEditor
          title="Departments"
          description="badge-counts → Departments"
          items={departments}
          onAdd={addDepartment}
          onRemove={removeDepartment}
          onReset={resetDepartments}
          disabled={disabled}
        />
        <ListEditor
          title="Visit Options"
          description="badge-counts / visitOptions"
          items={visitOptions}
          onAdd={addVisitOption}
          onRemove={removeVisitOption}
          onReset={resetVisitOptions}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
