const STORAGE_KEY = 'cb-nominal-roll-meta-v1'

export const DEFAULT_NOMINAL_META = {
  headerBetweenTitles: '',
  satsangPlace: '',
  area: '',
  zone: 'III',
  jathedar: '',
  driverName: '',
  vehicleType: '',
  vehicleNo: '',
  placeOfSewa: '',
  from: '',
  to: '',
  leftDate: '',
  leftContact: '',
  rightDate: '',
  rightContact: '',
}

export function loadNominalRollMeta() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_NOMINAL_META }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_NOMINAL_META }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_NOMINAL_META, ...parsed }
  } catch {
    return { ...DEFAULT_NOMINAL_META }
  }
}

export function saveNominalRollMeta(meta) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  } catch {
    // ignore quota errors
  }
}
