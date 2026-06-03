import * as XLSX from "xlsx";
import { useJathaData } from "../hooks/useJathaData";
import { ActionMenu } from "../components/ActionMenu";
import { ProspectInfo } from "../components/ProspectInfo";
import { JathaDepartmentSelect } from "../components/JathaDepartmentSelect";
import { JathaAreaSelect } from "../components/JathaAreaSelect";

function toTelHref(phone) {
  const raw = String(phone || "").trim();
  if (!raw || raw === "-") return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  const cleaned = normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized.replace(/\+/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function JathaRecordPage() {
  const {
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filterDept,
    setFilterDept,
    filterArea,
    setFilterArea,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    viewEntry,
    setViewEntry,
    filteredEntries,
  } = useJathaData(false);

  const hasFilter = filterDept || filterArea || filterDateFrom || filterDateTo;

  const handleExport = () => {
    const headers = ["Name", "Badge ID", "Phone", "Nominal List", "Visit Select", "Attendance", "Jatha Record", "Jatha Details", "Submitted By", "Date"];
    const rows = filteredEntries.map(({ prospect, log }) => {
      let jathas = [];
      try { jathas = typeof log.jathaDetails === "string" ? JSON.parse(log.jathaDetails || "[]") : log.jathaDetails || []; } catch { jathas = []; }
      const jathaStr = jathas.map((j, i) => `[${i+1}] Area:${j.areaName||"-"} Dept:${j.departmentName||"-"} Days:${j.jathaTotalDay||"-"} ${j.dateFrom||"-"} to ${j.dateTo||"-"}`).join(" | ");
      return [prospect.name, prospect.badgeId, prospect.phoneNumber, log.nominalListSelect, log.visitSelect, log.attendance, log.jathaRecord, jathaStr, log.submittedBy, log.$createdAt ? new Date(log.$createdAt).toLocaleDateString() : ""];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [22, 12, 14, 12, 12, 12, 12, 50, 24, 12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jatha Record");
    XLSX.writeFile(wb, `jatha_record_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="flex flex-col space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Jatha Record</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your assigned prospects with Nominal List or Visit Select
            &quot;Yes&quot; — with attendance
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2 sm:mt-0">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, badge, phone…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredEntries.length === 0}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </header>

      {/* Jatha filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Department
            </label>
            <JathaDepartmentSelect
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[140px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Area
            </label>
            <JathaAreaSelect
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[120px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Date From
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          <div className="w-full sm:flex-1 sm:min-w-[120px]">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Date To
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setFilterDept("");
                setFilterArea("");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="overflow-visible rounded-lg bg-white p-4 shadow-sm flex flex-col flex-1">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Loading jatha record…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No jatha record entries yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Submit calling forms with &quot;Nominal List Select&quot; or
              &quot;Visit Select&quot; set to &quot;Yes&quot; for your assigned
              prospects to see them here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="flex flex-col gap-2 md:hidden">
              {filteredEntries.map(({ prospect, log }, i) => (
                <div
                  key={log.$id || i}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{prospect.name || "-"}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {toTelHref(prospect.phoneNumber) ? (
                        <a href={toTelHref(prospect.phoneNumber)} className="text-slate-700 hover:underline">
                          {prospect.phoneNumber}
                        </a>
                      ) : (prospect.phoneNumber || "-")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      ID: {prospect.badgeId || "-"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Nominal: {log.nominalListSelect || "-"} · Visit: {log.visitSelect || "-"} · Attendance: {log.attendance || "-"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {log.$createdAt ? new Date(log.$createdAt).toLocaleDateString() : "-"}
                    </p>
                  </div>
                  <ActionMenu
                    onView={() => setViewEntry({ prospect, log })}
                    showEditForm={false}
                    showDeleteProspect={false}
                  />
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Badge ID</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Phone</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Nominal</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Visit</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Attendance</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(({ prospect, log }, i) => (
                    <tr key={log.$id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">{prospect.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{prospect.badgeId || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {toTelHref(prospect.phoneNumber) ? (
                          <a href={toTelHref(prospect.phoneNumber)} className="text-slate-700 hover:underline">
                            {prospect.phoneNumber}
                          </a>
                        ) : (prospect.phoneNumber || "-")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.nominalListSelect || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{log.visitSelect || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{log.attendance || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.$createdAt ? new Date(log.$createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          onView={() => setViewEntry({ prospect, log })}
                          showEditForm={false}
                          showDeleteProspect={false}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* view call log / prospect modal */}
      {viewEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewEntry(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Calling Form – {viewEntry.prospect.name || "-"}
              </h2>
              <button
                type="button"
                onClick={() => setViewEntry(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              <ProspectInfo
                prospect={viewEntry.prospect}
                doc={viewEntry.prospect.raw}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Calling Data
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Select: </span>
                    <span className="font-medium">
                      {viewEntry.log.select || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Call Back: </span>
                    <span className="font-medium">
                      {viewEntry.log.callBack || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Not Interest:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.notInterest || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Department of Sewa:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.departmentOfSewa || "-"}
                    </span>
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                    Transfer Data
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Nominal List Select:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.nominalListSelect || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Visit Select:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.visitSelect || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Ferry Sewa: </span>
                    <span className="font-medium">
                      {viewEntry.log.freeSewa || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Attendance: </span>
                    <span className="font-medium">
                      {viewEntry.log.attendance || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">
                      Jatha Record:
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.jathaRecord || "-"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                  Need to Work
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {viewEntry.log.needToWork || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JathaRecordPage;
