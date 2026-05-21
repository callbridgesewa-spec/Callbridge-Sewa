import { useState } from 'react'
import { useJathaLists } from '../context/JathaListsContext'

function ListEditor({ title, description, items, onAdd, onRemove, onReset }) {
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')

  const handleAdd = (e) => {
    e.preventDefault()
    const result = onAdd(input)
    if (result.added) {
      setInput('')
      setMessage('')
    } else {
      setMessage(result.error || 'Could not add.')
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Reset ${title.toLowerCase()} to the built-in default list?`)) {
              onReset()
              setMessage('')
            }
          }}
          className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
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
          placeholder={`New ${title.toLowerCase().replace(/s$/, '')}…`}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Add
        </button>
      </form>

      {message && (
        <p className="mb-2 text-xs text-red-600">{message}</p>
      )}

      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50">
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
                  onClick={() => onRemove(name)}
                  className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
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

export function JathaListsManager() {
  const {
    departments,
    areas,
    addDepartment,
    removeDepartment,
    addArea,
    removeArea,
    resetDepartments,
    resetAreas,
  } = useJathaLists()

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Jatha area & department lists</h2>
        <p className="mt-1 text-xs text-slate-500">
          Options used in call forms (Jatha Details). Saved in this browser—no database. Same device
          and browser tabs stay in sync.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ListEditor
          title="Areas"
          description="Area name dropdown options"
          items={areas}
          onAdd={addArea}
          onRemove={removeArea}
          onReset={resetAreas}
        />
        <ListEditor
          title="Departments"
          description="Department name dropdown options"
          items={departments}
          onAdd={addDepartment}
          onRemove={removeDepartment}
          onReset={resetDepartments}
        />
      </div>
    </section>
  )
}
