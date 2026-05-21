import { useJathaLists } from '../context/JathaListsContext'

/**
 * Select for Jatha Details "Department name" from configured department list.
 * Preserves legacy values not in the list when viewing/editing existing records.
 */
export function JathaDepartmentSelect({
  value = '',
  onChange,
  disabled = false,
  className = 'w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50',
  id,
}) {
  const { departments } = useJathaLists()
  const trimmed = String(value ?? '').trim()
  const options =
    trimmed && !departments.includes(trimmed)
      ? [trimmed, ...departments]
      : departments

  return (
    <select
      id={id}
      value={trimmed}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      <option value="">Select department</option>
      {options.map((dept) => (
        <option key={dept} value={dept}>
          {dept}
        </option>
      ))}
    </select>
  )
}
