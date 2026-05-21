import { useJathaLists } from '../context/JathaListsContext'

/**
 * Select for Jatha Details "Area name" from configured area list.
 * Preserves legacy values not in the list when viewing/editing existing records.
 */
export function JathaAreaSelect({
  value = '',
  onChange,
  disabled = false,
  className = 'w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50',
  id,
}) {
  const { areas } = useJathaLists()
  const trimmed = String(value ?? '').trim()
  const options =
    trimmed && !areas.includes(trimmed) ? [trimmed, ...areas] : areas

  return (
    <select
      id={id}
      value={trimmed}
      onChange={onChange}
      disabled={disabled}
      className={className}
    >
      <option value="">Select area</option>
      {options.map((area) => (
        <option key={area} value={area}>
          {area}
        </option>
      ))}
    </select>
  )
}
