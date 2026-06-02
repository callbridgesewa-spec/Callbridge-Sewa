import { useEffect, useMemo, useState } from "react";
import {
  loadNominalRollMeta,
  saveNominalRollMeta,
} from "../services/nominalRollStorage";

const CELL_INPUT =
  "w-full h-full border-0 bg-transparent px-1.5 py-1 text-[10px] outline-none transition-colors hover:bg-white/60 focus:bg-sky-50/80 sm:text-[11px] print:py-0 print:leading-tight";
const META_INPUT =
  "inline-block min-w-[3rem] flex-1 border-0 border-b border-slate-400 bg-transparent px-1 pb-0.5 text-[10px] font-medium text-slate-900 outline-none transition-colors focus:border-slate-800 sm:text-[11px]";
const FOOTER_FIELD =
  "min-w-0 flex-1 border-0 border-b border-slate-400 bg-transparent px-0 pb-0.5 text-[10px] outline-none focus:border-slate-800 sm:text-[11px]";

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

function mapEntryToRow(entry, index) {
  const { prospect, log } = entry;
  const raw = prospect?.raw || {};
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
  };
}

function SignatureBlock({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-end min-h-[6.5rem] px-3 py-3 sm:min-h-[7rem] print:min-h-[52px] print:py-2">
      <div
        className="w-full border-b-2 border-slate-800 mb-3"
        aria-hidden="true"
      />
      <div className="text-center">
        <p className="text-[10px] font-semibold leading-tight text-slate-800 sm:text-[11px]">
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[9px] leading-tight text-slate-600">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function FooterFieldRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 print:py-1">
      <span className="w-28 text-right text-[10px] font-medium text-slate-700 sm:text-[11px]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`${FOOTER_FIELD} w-full`}
      />
    </div>
  );
}

function NominalRollSheet({ entries = [], title = "Nominal Roll Sewa Jatha" }) {
  const baseRows = useMemo(() => entries.map(mapEntryToRow), [entries]);

  // Track the last-seen baseRows so we can sync rows when the prop changes
  // without using setState-in-effect (React derived-state pattern)
  const [prevBaseRows, setPrevBaseRows] = useState(baseRows);
  const [rows, setRows] = useState(baseRows);
  const [meta, setMeta] = useState(() => {
    const saved = loadNominalRollMeta();
    const firstSubmitter = baseRows[0]?.submittedBy;
    return {
      ...saved,
      jathedar: saved.jathedar || firstSubmitter || "",
    };
  });

  // Derived-state sync: runs during render when baseRows reference changes
  if (prevBaseRows !== baseRows) {
    setPrevBaseRows(baseRows);
    setRows(baseRows);
    if (baseRows[0]?.submittedBy) {
      setMeta((prev) => ({
        ...prev,
        jathedar: prev.jathedar || baseRows[0].submittedBy,
      }));
    }
  }

  useEffect(() => {
    saveNominalRollMeta(meta);
  }, [meta]);

  const pages = chunkRows(rows, 5);
  const safePages = pages.length ? pages : [[]];
  const totalRows = rows.length;
  const [currentPage, setCurrentPage] = useState(0);

  // Clamp currentPage to valid range during render instead of in an effect
  const maxPage = Math.max(0, safePages.length - 1);
  const safePage = Math.min(currentPage, maxPage);

  const updateRow = (rowIndex, field, value) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIndex
          ? { ...r, [field]: value, srNo: i + 1 }
          : { ...r, srNo: i + 1 },
      ),
    );
  };

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
      ];
      setCurrentPage(Math.floor((nextRows.length - 1) / 5));
      return nextRows;
    });
  };

  const removeLastEntry = () => {
    setRows((prev) => {
      if (!prev.length) return prev;
      const pageStart = safePage * 5;
      const pageEnd = pageStart + 4;
      const pageLastFilled = Math.min(pageEnd, prev.length - 1);
      const removeIndex =
        pageLastFilled >= pageStart ? pageLastFilled : prev.length - 1;
      const nextRows = prev
        .filter((_, idx) => idx !== removeIndex)
        .map((r, i) => ({ ...r, srNo: i + 1 }));
      const newMax = Math.max(0, Math.ceil(nextRows.length / 5) - 1);
      if (safePage > newMax) setCurrentPage(newMax);
      return nextRows;
    });
  };

  const setMetaField = (field) => (e) =>
    setMeta((m) => ({ ...m, [field]: e.target.value }));

  return (
    <div
      className="space-y-4 printable"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
    >
      {/* ── Screen-only toolbar ── */}
      <div className="print:hidden flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">
            Nominal roll sheet
          </p>
          <p className="text-xs text-slate-500">
            {totalRows} {totalRows === 1 ? "entry" : "entries"} · Page{" "}
            {safePage + 1} of {safePages.length}
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

      {/* ── Screen-only pagination ── */}
      <div className="print:hidden flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={safePage === 0}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-xs font-semibold tracking-wide text-slate-600">
          PAGE {safePage + 1} / {safePages.length}
        </span>
        <button
          type="button"
          onClick={() =>
            setCurrentPage((p) => Math.min(safePages.length - 1, p + 1))
          }
          disabled={safePage >= safePages.length - 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      {safePages.map((page, idx) => (
        <section
          key={idx}
          className={[
            "overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-md",
            "print:overflow-visible print:rounded-none print:border-0 print:shadow-none print:w-full print:m-0 print:p-0",
            idx !== safePage ? "hidden print:block" : "",
            idx < safePages.length - 1 ? "print-break-after" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* ── Inner scroll wrapper (screen only min-width) ── */}
          <div className="min-w-[960px] text-[10px] text-slate-900 sm:min-w-[1000px] sm:text-[11px] print:min-w-0 print:w-full print:text-[10px] flex-1 flex flex-col print:flex print:flex-col">

            {/* ══ HEADER — first page only ══ */}
            {idx === 0 && (
              <>
                <div className="relative border-b border-slate-800 bg-slate-100 py-2 flex items-center justify-center">
                  <span className="text-xs font-bold tracking-[0.2em] text-slate-800 sm:text-sm">
                    SATSANG CENTRES IN INDIA
                  </span>
                  <img
                    src="/nominal_logo.jpeg"
                    alt="Nominal Logo"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-auto sm:h-12 object-contain"
                    style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                  />
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
                    <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2 print:py-1.5 print:py-1.5">
                      <span className="shrink-0 text-slate-700">
                        Name of Satsang Place:
                      </span>
                      <input
                        value={meta.satsangPlace}
                        onChange={setMetaField("satsangPlace")}
                        className={META_INPUT}
                      />
                    </div>
                    <div className="col-span-3 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">Area:</span>
                      <input
                        value={meta.area}
                        onChange={setMetaField("area")}
                        className={META_INPUT}
                      />
                    </div>
                    <div className="col-span-2 flex items-baseline gap-1 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">ZONE:</span>
                      <input
                        value={meta.zone}
                        onChange={setMetaField("zone")}
                        className={META_INPUT}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-12">
                    <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">
                        Name of Jathedar:
                      </span>
                      <input
                        value={meta.jathedar}
                        onChange={setMetaField("jathedar")}
                        className={META_INPUT}
                      />
                    </div>
                    <div className="col-span-5 flex items-baseline gap-1 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">
                        Name of Driver:
                      </span>
                      <input
                        value={meta.driverName}
                        onChange={setMetaField("driverName")}
                        className={META_INPUT}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-12">
                    <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">
                        Type of Vehicle:
                      </span>
                      <input
                        value={meta.vehicleType}
                        onChange={setMetaField("vehicleType")}
                        className={META_INPUT}
                      />
                    </div>
                    <div className="col-span-5 flex items-baseline gap-1 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">
                        Vehicle No.:
                      </span>
                      <input
                        value={meta.vehicleNo}
                        onChange={setMetaField("vehicleNo")}
                        className={META_INPUT}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-12">
                    <div className="col-span-7 flex items-baseline gap-1 border-r border-slate-800 px-3 py-2 print:py-1.5">
                      <span className="shrink-0 text-slate-700">
                        Place of Sewa:
                      </span>
                      <input
                        value={meta.placeOfSewa}
                        onChange={setMetaField("placeOfSewa")}
                        className={META_INPUT}
                      />
                    </div>
                    <div className="col-span-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 print:py-1.5">
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
              </>
            )}

            {/* ══ Continuation header — pages 2+ only ══ */}
            {idx > 0 && (
              <div className="border-b border-slate-800 bg-slate-50 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {title} — continued (Page {idx + 1})
              </div>
            )}

            {/* ══ Data table ══ */}
            <table className="w-full border-collapse flex-1 print:table-fixed">
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
                      className="border-b border-r border-slate-800 px-1.5 py-2 print:py-1.5 text-center text-[9px] font-bold uppercase leading-tight last:border-r-0 sm:text-[10px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.map((row, i) => {
                  const stripe = i % 2 === 1 ? "bg-slate-50/80" : "bg-white";
                  return (
                    <tr key={i} className={`h-12 print:h-[68px] ${stripe}`}>
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
                          className={`border-r border-b border-slate-800 px-0.5 last:border-r-0 ${
                            field === "gender" || field === "age"
                              ? "text-center"
                              : ""
                          }`}
                        >
                          {row && (
                            <input
                              value={row[field]}
                              onChange={(e) =>
                                updateRow(idx * 5 + i, field, e.target.value)
                              }
                              className={`${CELL_INPUT} ${
                                field === "gender" || field === "age"
                                  ? "text-center"
                                  : ""
                              }`}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>{/* end min-w wrapper */}

          {/* ══ FOOTER / SIGNATURES — last page only, outside the min-w wrapper ══ */}
          {idx === safePages.length - 1 && (
            <div className="w-full border-t border-slate-800 text-[10px] text-slate-900 sm:text-[11px]">
              {/* Signature row */}
              <div className="grid grid-cols-2 border-b border-slate-800">
                <div className="border-r border-slate-800">
                  <SignatureBlock title="(Signature of Jathedar)" />
                </div>
                <SignatureBlock
                  title="(Signature of Functionary)"
                  subtitle="(Affix Rubber Stamp)"
                />
              </div>
              {/* Date / Contact row */}
              <div className="grid grid-cols-2">
                <div className="border-r border-slate-800">
                  <FooterFieldRow
                    label="Date :"
                    value={meta.leftDate}
                    onChange={setMetaField("leftDate")}
                  />
                  <FooterFieldRow
                    label="Contact No. :"
                    value={meta.leftContact}
                    onChange={setMetaField("leftContact")}
                  />
                </div>
                <div>
                  <FooterFieldRow
                    label="Date :"
                    value={meta.rightDate}
                    onChange={setMetaField("rightDate")}
                  />
                  <FooterFieldRow
                    label="Contact No. :"
                    value={meta.rightContact}
                    onChange={setMetaField("rightContact")}
                  />
                </div>
              </div>
            </div>
          )}

          <p className="print:hidden mt-2 text-right text-[10px] text-slate-400 px-2 pb-1">
            Sheet page {idx + 1} of {safePages.length}
          </p>
        </section>
      ))}
    </div>
  );
}

export default NominalRollSheet;
