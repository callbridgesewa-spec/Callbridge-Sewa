function UnderConstruction({ section = 'This section' }) {
  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-dashed border-cyan-200 bg-white/80 px-8 py-10 text-center shadow-sm shadow-cyan-100/70">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">
          Under Construction
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{section}</h1>
        <p className="mt-3 text-sm text-slate-600">
          This area is not available yet. The current build focuses on the main dashboard and badge
          management only.
        </p>
      </div>
    </div>
  )
}

export default UnderConstruction

