import { useJathaLists } from '../context/JathaListsContext'

export function InchargeSelect({
  value = '',
  onChange,
  disabled = false,
  className = 'w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50',
  id,
}) {
  const { inchargeOptions } = useJathaLists()
  const trimmed = String(value ?? '').trim()
  const options =
    trimmed && !inchargeOptions.includes(trimmed)
      ? [trimmed, ...inchargeOptions]
      : inchargeOptions

  return (
    <select
      id={id}
      value={trimmed}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      <option value="">Select incharge</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
