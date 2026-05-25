import { useEffect, useMemo, useState } from "react"
import { loadNominalRollMeta, saveNominalRollMeta } from "../services/nominalRollStorage"

const CELL_INPUT =
  "w-full border-0 bg-transparent px-1.5 py-2 text-[10px] outline-none transition-colors hover:bg-white/60 focus:bg-sky-50/80 sm:text-[11px]"
const META_INPUT =
  "inline-block min-w-[3rem] flex-1 border-0 border-b border-slate-400 bg-transparent px-1 pb-0.5 text-[10px] font-medium text-slate-900 outline-none transition-colors focus:border-slate-800 sm:text-[11px]"
const FOOTER_FIELD =
  "min-w-0 flex-1 border-0 border-b border-slate-400 bg-transparent px-0 pb-0.5 text-[10px] outline-none focus:border-slate-800 sm:text-[11px]"

function chunkRows(rows, size) {
  const chunks = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

function mapEntryToRow(entry, index) {
  const { prospect, log } = entry
  const raw = prospect?.raw || {}
  return {
    srNo: index + 1,
    name: prospect?.name || "-",
    guardian: raw.guardian || "-",
    gender: raw.gender || "-",
    age: raw.age || "-",
    aadhar: raw.aadhar || "-",
    locality: raw.locality || prospect?.address || "-",
    mobile: prospect?.phoneNumber || "-",
    badgeId: prospect?.badgeId || "-",
    submittedBy: log?.submittedBy || "-",
    date: log?.$createdAt ? new Date(log.$createdAt).toLocaleDateString() : "-",
  }
}

function SignatureBlock({ title, subtitle }) {
  return (
    <div className="flex min-h-[5.5rem] flex-col justify-between px-3 py-3 sm:min-h-[6rem]">
      <div className="flex-1 border-b border-dashed border-slate-400" aria-hidden="true" />
      <div className="pt-2 text-center">
        <p className="text-[10px] font-semibold leading-tight text-slate-800 sm:text-[11px]">
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[9px] leading-tight text-slate-600">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

function FooterFieldRow({ label, value, onChange }) {
  return (
    <div className="flex items-baseline gap-2 px-3 py-2">
      <span className="shrink-0 text-[10px] font-medium text-slate-700 sm:text-[11px]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={FOOTER_FIELD}
      />
    </div>
  )
}

function NominalRollSheet({ entries = [], title = "Nominal Roll Sewa Jatha" }) {
  const baseRows = useMemo(() => entries.map(mapEntryToRow), [entries])
  const [rows, setRows] = useState(baseRows)
  const [meta, setMeta] = useState(() => loadNominalRollMeta())

  useEffect(() => {
    setRows(baseRows)
    setMeta((prev) => ({
      ...prev,
      jathedar:
        baseRows[0]?.submittedBy && !prev.jathedar
          ? baseRows[0].submittedBy
          : prev.jathedar,
    }))
  }, [baseRows])

  useEffect(() => {
    saveNominalRollMeta(meta)
  }, [meta])

  const pages = chunkRows(rows, 5)
  const safePages = pages.length ? pages : [[]]
  const totalRows = rows.length
  const [currentPage, setCurrentPage] = useState(0)

  const updateRow = (rowIndex, field, value) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex ? { ...r, [field]: value, srNo: i + 1 } : { ...r, srNo: i + 1 },
      ),
    )
  }

  const addEntry = () => {
    setRows((prev) => {
      const nextRows = [
        ...prev.map((r, i) => ({ ...r, srNo: i + 1 })),
        {
          srNo: prev.length + 1,
          name: "",
          guardian: "",
          gender: "",
          age: "",
          aadhar: "",
          locality: "",
          mobile: "",
          badgeId: "",
          submittedBy: "",
          date: "",
        },
      ]
      setCurrentPage(Math.floor((nextRows.length - 1) / 5))
      return nextRows
    })
  }

  const removeLastEntry = () => {
    setRows((prev) => {
      if (!prev.length) return prev
      const pageStart = currentPage * 5
      const pageEnd = pageStart + 4
      const pageLastFilled = Math.min(pageEnd, prev.length - 1)
      const removeIndex =
        pageLastFilled >= pageStart ? pageLastFilled : prev.length - 1
      const nextRows = prev
        .filter((_, idx) => idx !== removeIndex)
        .map((r, i) => ({ ...r, srNo: i + 1 }))
      const maxPage = Math.max(0, Math.ceil(nextRows.length / 5) - 1)
      if (currentPage > maxPage) setCurrentPage(maxPage)
      return nextRows
    })
  }

  useEffect(() => {
    if (currentPage > safePages.length - 1) {
      setCurrentPage(Math.max(0, safePages.length - 1))
    }
  }, [safePages.length, currentPage])

  const setMetaField = (field) => (e) =>
    setMeta((m) => ({ ...m, [field]: e.target.value }))

  return (
    <div
      className="space-y-4"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <div className="print:hidden flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">Nominal roll sheet</p>
          <p className="text-xs text-slate-500">
            {totalRows} {totalRows === 1 ? "entry" : "entries"} · Page {currentPage + 1} of{" "}
            {safePages.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addEntry}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-900"
          >
            + Add entry
          </button>
          <button
            type="button"
            onClick={removeLastEntry}
            disabled={rows.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Remove last
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            Print
          </button>
        </div>
      </div>

      <div className="print:hidden flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-xs font-semibold tracking-wide text-slate-600">
          PAGE {currentPage + 1} / {safePages.length}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(safePages.length - 1, p + 1))}
          disabled={currentPage >= safePages.length - 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      {safePages
        .filter((_, idx) => idx === currentPage)
        .map(() => (
          <section
            key={currentPage}
            className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-md print:overflow-visible print:rounded-none print:border print:border-slate-800 print:shadow-none"
          >
            <div className="min-w-[960px] text-[10px] text-slate-900 sm:min-w-[1000px] sm:text-[11px] print:min-w-0 print:w-full">
              {/* Header */}
              <div className="border-b border-slate-800 bg-slate-100 py-2 text-center text-xs font-bold tracking-[0.2em] text-slate-800 sm:text-sm">
                SATSANG CENTRES IN INDIA
              </div>
              <div className="border-b border-slate-800 px-3 py-1">
                <input
                  type="text"
                  value={meta.headerBetweenTitles}
                  onChange={setMetaField("headerBetweenTitles")}
                  placeholder=""
                  className="mx-auto block w-full max-w-[90%] border-0 border-b border-slate-300 bg-transparent py-0.5 text-center text-[10px] font-normal text-slate-800 outline-none transition-colors placeholder:text-transparent focus:border-slate-500 sm:text-[11px] print:border-transparent print:placeholder:text-transparent"
                  aria-label="Text between Satsang Centres and Nominal Roll titles"
                />
              </div>
              <div className="border-b border-slate-800 bg-slate-50 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-900">
                {title}
              </div>

              {/* Meta block */}
              <div className="divide-y divide-slate-800 border-b border-slate-800 bg-white">
                <div className="grid grid-cols-12">
                  <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Name of Satsang Place:</span>
                    <input
                      value={meta.satsangPlace}
                      onChange={setMetaField("satsangPlace")}
                      className={META_INPUT}
                    />
                  </div>
                  <div className="col-span-3 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Area:</span>
                    <input value={meta.area} onChange={setMetaField("area")} className={META_INPUT} />
                  </div>
                  <div className="col-span-2 flex items-baseline gap-1 px-3 py-2">
                    <span className="shrink-0 text-slate-700">ZONE:</span>
                    <input value={meta.zone} onChange={setMetaField("zone")} className={META_INPUT} />
                  </div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Name of Jathedar:</span>
                    <input
                      value={meta.jathedar}
                      onChange={setMetaField("jathedar")}
                      className={META_INPUT}
                    />
                  </div>
                  <div className="col-span-5 flex items-baseline gap-1 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Name of Driver:</span>
                    <input
                      value={meta.driverName}
                      onChange={setMetaField("driverName")}
                      className={META_INPUT}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Type of Vehicle:</span>
                    <input
                      value={meta.vehicleType}
                      onChange={setMetaField("vehicleType")}
                      className={META_INPUT}
                    />
                  </div>
                  <div className="col-span-5 flex items-baseline gap-1 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Vehicle No.:</span>
                    <input
                      value={meta.vehicleNo}
                      onChange={setMetaField("vehicleNo")}
                      className={META_INPUT}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2">
                    <span className="shrink-0 text-slate-700">Place of Sewa:</span>
                    <input
                      value={meta.placeOfSewa}
                      onChange={setMetaField("placeOfSewa")}
                      className={META_INPUT}
                    />
                  </div>
                  <div className="col-span-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                    <span className="flex items-baseline gap-1">
                      <span className="text-slate-700">FROM:</span>
                      <input
                        value={meta.from}
                        onChange={setMetaField("from")}
                        className={`${META_INPUT} !min-w-[3rem] !flex-none`}
                      />
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className="text-slate-700">TO:</span>
                      <input
                        value={meta.to}
                        onChange={setMetaField("to")}
                        className={`${META_INPUT} !min-w-[3rem] !flex-none`}
                      />
                    </span>
                  </div>
                </div>
                <p className="px-3 py-1.5 text-center text-[10px] font-medium italic text-slate-600">
                  (Mention Beas Department or Centre As applicable)
                </p>
              </div>

              {/* Data table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    {[
                      "SR. NO.",
                      "Name of Sewadar / Sewadarni",
                      "Father's / Husband's Name",
                      "M / F",
                      "Age",
                      "Aadhar No.",
                      "R/o Village / Town / Locality / District",
                      "Mobile No.",
                      "BADGE ID",
                    ].map((h) => (
                      <th
                        key={h}
                        className="border-b border-r border-slate-800 px-1.5 py-2 text-center text-[9px] font-bold uppercase leading-tight last:border-r-0 sm:text-[10px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(5)].map((_, i) => {
                    const globalIndex = currentPage * 5 + i
                    const row = rows[globalIndex]
                    const stripe = i % 2 === 1 ? "bg-slate-50/80" : "bg-white"
                    return (
                      <tr key={i} className={`h-12 ${stripe}`}>
                        <td className="border-r border-b border-slate-800 px-1 text-center align-middle font-medium text-slate-700">
                          {row?.srNo || ""}
                        </td>
                        {[
                          "name",
                          "guardian",
                          "gender",
                          "age",
                          "aadhar",
                          "locality",
                          "mobile",
                          "badgeId",
                        ].map((field) => (
                          <td
                            key={field}
                            className={`border-r border-b border-slate-800 px-0.5 ${
                              field === "gender" || field === "age" ? "text-center" : ""
                            }`}
                          >
                            {row && (
                              <input
                                value={row[field]}
                                onChange={(e) =>
                                  updateRow(globalIndex, field, e.target.value)
                                }
                                className={`${CELL_INPUT} ${
                                  field === "gender" || field === "age" ? "text-center" : ""
                                }`}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Footer: empty left, signatures / date / contact on the right */}
              <div className="grid grid-cols-12 border-t border-slate-800">
                <div className="col-span-8 row-span-3 border-r border-slate-800" aria-hidden="true" />

                <div className="col-span-4 grid grid-rows-[auto_auto_auto]">
                  <div className="grid grid-cols-2 border-b border-slate-800">
                    <div className="border-r border-slate-800">
                      <SignatureBlock title="(Signature of Jathedar)" />
                    </div>
                    <SignatureBlock
                      title="(Signature of Functionary)"
                      subtitle="(Affix Rubber Stamp)"
                    />
                  </div>
                  <div className="grid grid-cols-2 border-b border-slate-800">
                    <div className="border-r border-slate-800">
                      <FooterFieldRow
                        label="Date:"
                        value={meta.leftDate}
                        onChange={setMetaField("leftDate")}
                      />
                    </div>
                    <FooterFieldRow
                      label="Date:"
                      value={meta.rightDate}
                      onChange={setMetaField("rightDate")}
                    />
                  </div>
                  <div className="grid grid-cols-2">
                    <div className="border-r border-slate-800">
                      <FooterFieldRow
                        label="Contact No.:"
                        value={meta.leftContact}
                        onChange={setMetaField("leftContact")}
                      />
                    </div>
                    <FooterFieldRow
                      label="Contact No.:"
                      value={meta.rightContact}
                      onChange={setMetaField("rightContact")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="print:hidden mt-2 text-right text-[10px] text-slate-400">
              Sheet page {currentPage + 1} of {safePages.length}
            </p>
          </section>
        ))}
    </div>
  )
}

export default NominalRollSheet
