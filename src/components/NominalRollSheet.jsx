import { useEffect, useMemo, useState } from "react"

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

function NominalRollSheet({ entries = [], title = "Nominal Roll Sewa Jatha" }) {
  const baseRows = useMemo(() => entries.map(mapEntryToRow), [entries])
  const [rows, setRows] = useState(baseRows)
  const [meta, setMeta] = useState({
    satsangPlace: "",
    area: "",
    zone: "III",
    jathedar: "",
    driverName: "",
    vehicleType: "",
    vehicleNo: "",
    placeOfSewa: "",
    from: "",
    to: "",
    leftDate: "",
    leftContact: "",
    rightDate: "",
    rightContact: "",
  })

  useEffect(() => {
    setRows(baseRows)
    setMeta((prev) => ({
      ...prev,
      jathedar: baseRows[0]?.submittedBy && prev.jathedar === "" ? baseRows[0].submittedBy : prev.jathedar,
    }))
  }, [baseRows])

  const pages = chunkRows(rows, 5)
  const safePages = pages.length ? pages : [[]]
  const totalRows = rows.length
  const [currentPage, setCurrentPage] = useState(0)

  const updateRow = (rowIndex, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, [field]: value, srNo: i + 1 } : { ...r, srNo: i + 1 })),
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
      const newEntryIndex = nextRows.length - 1
      const targetPage = Math.floor(newEntryIndex / 5)
      setCurrentPage(targetPage)
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
      if (currentPage > maxPage) {
        setCurrentPage(maxPage)
      }
      return nextRows
    })
  }

  useEffect(() => {
    if (currentPage > safePages.length - 1) {
      setCurrentPage(Math.max(0, safePages.length - 1))
    }
  }, [safePages.length, currentPage])

  return (
    <div
      className="space-y-4 sm:space-y-6"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      <div className="print:hidden flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Editable nominal roll sheet. Total entries:{" "}
          <span className="font-semibold text-slate-900">{totalRows}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addEntry}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-900"
          >
            + Add Nominal Entry
          </button>
          <button
            type="button"
            onClick={removeLastEntry}
            disabled={rows.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Remove Last
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Print
          </button>
        </div>
      </div>

      <p className="print:hidden text-xs text-slate-500 md:hidden">
        Tip: scroll left/right to fill the full nominal roll sheet.
      </p>

      <div className="print:hidden flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Previous Page
        </button>
        <p className="text-xs font-medium text-slate-700">
          Page {currentPage + 1} of {safePages.length}
        </p>
        <button
          type="button"
          onClick={() =>
            setCurrentPage((p) => Math.min(safePages.length - 1, p + 1))
          }
          disabled={currentPage >= safePages.length - 1}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Next Page
        </button>
      </div>

      {safePages
        .filter((_, idx) => idx === currentPage)
        .map((pageRows, pageIndex) => (
          <section
            key={currentPage}
            className="overflow-x-auto rounded-lg border border-slate-300 bg-white p-1.5 sm:p-2 print:overflow-visible print:rounded-none print:border-0 print:p-0"
          >
          <div className="min-w-[960px] border border-slate-800 text-[10px] text-slate-900 sm:min-w-[1000px] sm:text-[11px] print:min-w-0 print:w-full">
            <div className="border-b border-slate-800 py-1 text-center font-semibold">
              SATSANG CENTRES IN INDIA
            </div>
            <div className="border-b border-slate-800 py-2" aria-hidden="true" />
            <div className="border-b border-slate-800 py-1 text-center font-semibold uppercase">
              {title}
            </div>

            <div className="grid grid-cols-12 border-b border-slate-800">
              <div className="col-span-7 border-r border-slate-800 px-2 py-1">
                Name of Satsang Place:{" "}
                <input
                  value={meta.satsangPlace}
                  onChange={(e) => setMeta((m) => ({ ...m, satsangPlace: e.target.value }))}
                  className="w-44 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-56 sm:text-[11px]"
                />
              </div>
              <div className="col-span-3 border-r border-slate-800 px-2 py-1">
                Area:{" "}
                <input
                  value={meta.area}
                  onChange={(e) => setMeta((m) => ({ ...m, area: e.target.value }))}
                  className="w-20 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-24 sm:text-[11px]"
                />
              </div>
              <div className="col-span-2 px-2 py-1">
                ZONE:{" "}
                <input
                  value={meta.zone}
                  onChange={(e) => setMeta((m) => ({ ...m, zone: e.target.value }))}
                  className="w-8 border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-12 border-b border-slate-800">
              <div className="col-span-7 border-r border-slate-800 px-2 py-1">
                Name of Jathedar:{" "}
                <input
                  value={meta.jathedar}
                  onChange={(e) => setMeta((m) => ({ ...m, jathedar: e.target.value }))}
                  className="w-44 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-64 sm:text-[11px]"
                />
              </div>
              <div className="col-span-5 px-2 py-1">
                Name of Driver:{" "}
                <input
                  value={meta.driverName}
                  onChange={(e) => setMeta((m) => ({ ...m, driverName: e.target.value }))}
                  className="w-32 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-40 sm:text-[11px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-12 border-b border-slate-800">
              <div className="col-span-7 border-r border-slate-800 px-2 py-1">
                Type of Vehicle:{" "}
                <input
                  value={meta.vehicleType}
                  onChange={(e) => setMeta((m) => ({ ...m, vehicleType: e.target.value }))}
                  className="w-36 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-44 sm:text-[11px]"
                />
              </div>
              <div className="col-span-5 px-2 py-1">
                Vehicle No.:{" "}
                <input
                  value={meta.vehicleNo}
                  onChange={(e) => setMeta((m) => ({ ...m, vehicleNo: e.target.value }))}
                  className="w-32 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-40 sm:text-[11px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-12 border-b border-slate-800">
              <div className="col-span-7 border-r border-slate-800 px-2 py-1">
                Place of Sewa:{" "}
                <input
                  value={meta.placeOfSewa}
                  onChange={(e) => setMeta((m) => ({ ...m, placeOfSewa: e.target.value }))}
                  className="w-36 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-44 sm:text-[11px]"
                />
              </div>
              <div className="col-span-5 px-2 py-1">
                FROM:{" "}
                <input
                  value={meta.from}
                  onChange={(e) => setMeta((m) => ({ ...m, from: e.target.value }))}
                  className="w-16 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-20 sm:text-[11px]"
                />{" "}
                TO:{" "}
                <input
                  value={meta.to}
                  onChange={(e) => setMeta((m) => ({ ...m, to: e.target.value }))}
                  className="w-16 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-20 sm:text-[11px]"
                />
              </div>
            </div>
            <div className="border-b border-slate-800 px-2 py-1 text-[10px] font-semibold">
              (Mention Beas Department or Centre As applicable)
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
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
                      className="border-r border-b border-slate-800 px-1 py-1 text-center font-semibold last:border-r-0"
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
                  return (
                    <tr key={i} className="h-11">
                      <td className="border-r border-b border-slate-800 px-1 text-center align-middle">
                        {row?.srNo || ""}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1">
                        {row && (
                          <input
                            value={row.name}
                            onChange={(e) => updateRow(globalIndex, "name", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1">
                        {row && (
                          <input
                            value={row.guardian}
                            onChange={(e) => updateRow(globalIndex, "guardian", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1 text-center">
                        {row && (
                          <input
                            value={row.gender}
                            onChange={(e) => updateRow(globalIndex, "gender", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-center text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1 text-center">
                        {row && (
                          <input
                            value={row.age}
                            onChange={(e) => updateRow(globalIndex, "age", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-center text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1">
                        {row && (
                          <input
                            value={row.aadhar}
                            onChange={(e) => updateRow(globalIndex, "aadhar", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1">
                        {row && (
                          <input
                            value={row.locality}
                            onChange={(e) => updateRow(globalIndex, "locality", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-r border-b border-slate-800 px-1">
                        {row && (
                          <input
                            value={row.mobile}
                            onChange={(e) => updateRow(globalIndex, "mobile", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                      <td className="border-b border-slate-800 px-1">
                        {row && (
                          <input
                            value={row.badgeId}
                            onChange={(e) => updateRow(globalIndex, "badgeId", e.target.value)}
                            className="w-full border-0 bg-transparent p-0 text-[10px] outline-none sm:text-[11px]"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="grid grid-cols-2 border-b border-slate-800">
              <div className="border-r border-slate-800 px-2 py-8 text-center">
                <div className="font-semibold">(Signature of Jathedar)</div>
              </div>
              <div className="px-2 py-8 text-center">
                <div className="font-semibold">(Signature of Functionary)</div>
                <div>(Affix Rubber Stamp)</div>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b border-slate-800">
              <div className="border-r border-slate-800 px-2 py-1">
                Date:{" "}
                <input
                  value={meta.leftDate}
                  onChange={(e) => setMeta((m) => ({ ...m, leftDate: e.target.value }))}
                  className="w-24 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-28 sm:text-[11px]"
                />
              </div>
              <div className="px-2 py-1">
                Date:{" "}
                <input
                  value={meta.rightDate}
                  onChange={(e) => setMeta((m) => ({ ...m, rightDate: e.target.value }))}
                  className="w-24 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-28 sm:text-[11px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2">
              <div className="border-r border-slate-800 px-2 py-1">
                Contact No.:{" "}
                <input
                  value={meta.leftContact}
                  onChange={(e) => setMeta((m) => ({ ...m, leftContact: e.target.value }))}
                  className="w-28 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-40 sm:text-[11px]"
                />
              </div>
              <div className="px-2 py-1">
                Contact No.:{" "}
                <input
                  value={meta.rightContact}
                  onChange={(e) => setMeta((m) => ({ ...m, rightContact: e.target.value }))}
                  className="w-28 border-0 bg-transparent p-0 text-[10px] outline-none sm:w-40 sm:text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="print:hidden mt-2 text-right text-xs text-slate-500">
            Page {currentPage + 1} of {safePages.length}
          </div>
          </section>
        ))}
    </div>
  )
}

export default NominalRollSheet
