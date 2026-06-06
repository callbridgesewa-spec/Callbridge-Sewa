import { useJathaLists } from '../context/JathaListsContext'

export function AssignDutySelect({
  value = '',
  onChange,
  disabled = false,
  className = 'w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50',
  id,
}) {
  const { assignDutyOptions } = useJathaLists()
  const trimmed = String(value ?? '').trim()
  const options =
    trimmed && !assignDutyOptions.includes(trimmed)
      ? [trimmed, ...assignDutyOptions]
      : assignDutyOptions

  return (
    <select
      id={id}
      value={trimmed}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      <option value="">Select duty</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
