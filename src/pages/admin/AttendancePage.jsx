import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { useJathaData } from "../../hooks/useJathaData";
import {
  getAllAttendance,
  getAttendanceForDate,
  recordAttendance,
  toDateOnly,
} from "../../services/attendanceService";

function getLocalISODate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatExcelDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function downloadWorkbook(buffer, filename) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeStatus(status) {
  if (status === "Absent") return "Leave";
  return status || "Unmarked";
}

// Group entries by badge ID (fallback to prospect ID when badge is absent/dash)
function buildGroups(filteredEntries) {
  const groups = new Map();
  filteredEntries.forEach(({ prospect }) => {
    if (!prospect?.id) return;
    const badge = String(prospect.badgeId || "").trim();
    const key = badge && badge !== "-" ? `badge:${badge}` : `id:${prospect.id}`;
    if (!groups.has(key)) groups.set(key, { key, prospect, ids: [] });
    const g = groups.get(key);
    if (!g.ids.includes(prospect.id)) g.ids.push(prospect.id);
  });
  return [...groups.values()];
}

// Present beats Leave beats Unmarked across all IDs in a group
function groupStatus(group, attendance) {
  for (const id of group.ids) if (attendance[id] === "Present") return "Present";
  for (const id of group.ids) if (attendance[id] === "Leave")   return "Leave";
  return "Unmarked";
}

function AttendancePage() {
  const {
    filteredEntries,
    loading: entriesLoading,
    error: entriesError,
  } = useJathaData(true);

  const [selectedDate, setSelectedDate] = useState(getLocalISODate);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [allRecords, setAllRecords] = useState([]);
  const [allRecordsLoading, setAllRecordsLoading] = useState(true);
  const [savingGroupKey, setSavingGroupKey] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // One entry per unique badge ID (or prospect ID as fallback)
  const prospectGroups = useMemo(() => buildGroups(filteredEntries), [filteredEntries]);

  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return prospectGroups;
    return prospectGroups.filter(({ prospect }) =>
      [prospect.name, prospect.badgeId, prospect.phoneNumber].some((v) =>
        String(v || "").toLowerCase().includes(query),
      ),
    );
  }, [prospectGroups, searchQuery]);

  // Load attendance for the selected date
  useEffect(() => {
    let active = true;
    async function load() {
      setAttendanceLoading(true);
      setError("");
      setSuccess("");
      try {
        const records = await getAttendanceForDate(selectedDate);
        if (!active) return;
        const map = {};
        records.forEach((r) => { map[r.prospectId] = normalizeStatus(r.status); });
        setAttendance(map);
      } catch (err) {
        if (active) { setAttendance({}); setError(err.message || "Failed to load attendance."); }
      } finally {
        if (active) setAttendanceLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [selectedDate]);

  // Load all records once for percentage calculation
  useEffect(() => {
    let active = true;
    getAllAttendance()
      .then((records) => { if (active) setAllRecords(records); })
      .catch(() => {})
      .finally(() => { if (active) setAllRecordsLoading(false); });
    return () => { active = false; };
  }, []);

  // byProspect: prospectId -> Set of dates marked Present (for exact union across badge group)
  const attendanceSummary = useMemo(() => {
    const allDates = new Set(allRecords.map((r) => toDateOnly(r.date)).filter(Boolean));
    const byProspect = {};
    allRecords.forEach((r) => {
      const date = toDateOnly(r.date);
      if (r.status === "Present" && date) {
        if (!byProspect[r.prospectId]) byProspect[r.prospectId] = new Set();
        byProspect[r.prospectId].add(date);
      }
    });
    return { totalDays: allDates.size, byProspect };
  }, [allRecords]);

  const getGroupPct = (group) => {
    if (attendanceSummary.totalDays === 0) return null;
    const presentDates = new Set();
    group.ids.forEach((id) => {
      (attendanceSummary.byProspect[id] || new Set()).forEach((d) => presentDates.add(d));
    });
    return Math.round((presentDates.size / attendanceSummary.totalDays) * 100);
  };

  const counts = useMemo(() => {
    let present = 0, leave = 0;
    prospectGroups.forEach((g) => {
      const s = groupStatus(g, attendance);
      if (s === "Present") present++;
      else if (s === "Leave") leave++;
    });
    return { present, leave, unmarked: prospectGroups.length - present - leave };
  }, [attendance, prospectGroups]);

  // Save attendance for every prospect ID in the badge group
  const handleAttendance = async (group, status) => {
    setSavingGroupKey(group.key);
    setError("");
    setSuccess("");
    try {
      await Promise.all(group.ids.map((id) => recordAttendance(id, selectedDate, status)));
      setAttendance((cur) => {
        const updated = { ...cur };
        group.ids.forEach((id) => { updated[id] = status; });
        return updated;
      });
      setAllRecords((prev) => {
        const filtered = prev.filter(
          (r) => !(group.ids.includes(r.prospectId) && toDateOnly(r.date) === selectedDate),
        );
        return [...filtered, ...group.ids.map((id) => ({ prospectId: id, date: selectedDate, status }))];
      });
      setSuccess(`Attendance saved for ${formatDate(selectedDate)}.`);
    } catch (err) {
      setError(err.message || "Failed to save attendance.");
    } finally {
      setSavingGroupKey("");
    }
  };

  const openExportModal = () => {
    setExportFromDate("");
    setExportToDate("");
    setExportModalOpen(true);
  };

  const exportToExcel = async (fromDate = exportFromDate, toDate = exportToDate) => {
    setExportModalOpen(false);
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const records = await getAllAttendance();
      let dates = [
        ...new Set(records.map((r) => toDateOnly(r.date)).filter(Boolean)),
      ].sort();
      if (fromDate) dates = dates.filter((d) => d >= fromDate);
      if (toDate)   dates = dates.filter((d) => d <= toDate);
      if (dates.length === 0) {
        throw new Error("No attendance records found for the selected date range.");
      }

      // Build lookup: prospectId:date -> status
      const lookup = new Map();
      records.forEach((r) => {
        lookup.set(`${r.prospectId}:${toDateOnly(r.date)}`, normalizeStatus(r.status));
      });

      // Helper: best status for a badge group on a given date
      const groupStatusOnDate = (group, date) => {
        for (const id of group.ids) if (lookup.get(`${id}:${date}`) === "Present") return "Present";
        for (const id of group.ids) if (lookup.get(`${id}:${date}`) === "Leave")   return "Leave";
        return "";
      };

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance Register", {
        views: [{ state: "frozen", xSplit: 7, ySplit: 1 }],
      });
      worksheet.properties.defaultRowHeight = 22;
      worksheet.columns = [
        { header: "SR. No.",             key: "serial",            width: 9  },
        { header: "Name",                key: "name",              width: 24 },
        { header: "Badge ID",            key: "badgeId",           width: 14 },
        { header: "Father/Husband Name", key: "fatherHusbandName", width: 22 },
        { header: "Phone",               key: "phoneNumber",       width: 14 },
        { header: "Address",             key: "address",           width: 28 },
        { header: "Attendance %",        key: "pct",               width: 14 },
        ...dates.map((date) => ({ header: formatExcelDate(date), key: date, width: 14 })),
      ];

      const thinBorder = {
        top:    { style: "thin", color: { argb: "FF000000" } },
        left:   { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right:  { style: "thin", color: { argb: "FF000000" } },
      };
      const statusStyles = {
        Present: { fill: "FFD9EAD3", font: "FF00864B" },
        Leave:   { fill: "FFF4CCCC", font: "FFC9342F" },
      };

      worksheet.getRow(1).height = 24;
      worksheet.getRow(1).eachCell((cell, colNum) => {
        cell.font = { name: "Arial", size: 11, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        cell.fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: colNum <= 7 ? "FFD9EAD3" : "FFFFF2CC" },
        };
      });

      // Rebuild groups from all entries (not filtered by search) for export
      const exportGroups = buildGroups(filteredEntries);

      exportGroups.forEach(({ prospect, ids }, index) => {
        // Present dates in range: union across all IDs
        const presentDates = new Set();
        ids.forEach((id) => {
          dates.forEach((d) => { if (lookup.get(`${id}:${d}`) === "Present") presentDates.add(d); });
        });
        const pct = `${Math.round((presentDates.size / dates.length) * 100)}%`;

        const row = worksheet.addRow({
          serial:            index + 1,
          name:              prospect.name              || "-",
          badgeId:           prospect.badgeId           || "-",
          fatherHusbandName: prospect.fatherHusbandName || "-",
          phoneNumber:       prospect.phoneNumber       || "-",
          address:           prospect.address           || "-",
          pct,
        });
        row.height = 22;

        dates.forEach((date, di) => {
          const status = groupStatusOnDate({ ids }, date);
          const cell = row.getCell(di + 8);
          cell.value = status === "Present" ? "PRESENT" : status === "Leave" ? "LEAVE" : "";
          const style = statusStyles[status];
          if (style) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
            cell.font = { name: "Arial", size: 11, bold: true, color: { argb: style.font } };
          }
        });

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: colNum === 1 || colNum === 7 ? "center" : colNum <= 7 ? "left" : "center",
            vertical: "middle",
          };
          if (colNum <= 7 && !cell.font?.bold) cell.font = { name: "Arial", size: 10 };
        });
      });

      worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: dates.length + 7 } };
      const buffer = await workbook.xlsx.writeBuffer();
      const fromLabel = fromDate || "all";
      const toLabel   = toDate   || "all";
      downloadWorkbook(buffer, `attendance_${fromLabel}_to_${toLabel}.xlsx`);
      setSuccess("Attendance register exported successfully.");
    } catch (err) {
      setError(err.message || "Failed to export attendance register.");
    } finally {
      setExporting(false);
    }
  };

  const loading = entriesLoading || attendanceLoading;
  const pageError = entriesError || error;

  return (
    <div className="flex flex-col space-y-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mark daily attendance for sewadar entries in the Jatha record
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="date"
            lang="en-GB"
            value={selectedDate}
            max={getLocalISODate()}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          />
          <button
            type="button"
            onClick={openExportModal}
            disabled={loading || exporting || prospectGroups.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export Register"}
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Present",  counts.present,  "border-emerald-200 bg-emerald-50 text-emerald-700"],
          ["Leave",    counts.leave,    "border-red-200 bg-red-50 text-red-700"],
          ["Unmarked", counts.unmarked, "border-slate-200 bg-white text-slate-700"],
        ].map(([label, value, cls]) => (
          <div key={label} className={`rounded-xl border p-4 shadow-sm ${cls}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-visible rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{formatDate(selectedDate)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {prospectGroups.length} unique sewadar{prospectGroups.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, badge, phone..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
            />
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {pageError}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading attendance...</div>
        ) : visibleGroups.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No Jatha record sewadar found</p>
            <p className="mt-1 text-sm text-slate-500">
              Sewadar entries appear here after their calling form is added to the nominal list or visit list.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="flex flex-col gap-2 md:hidden">
              {visibleGroups.map((group) => {
                const status = groupStatus(group, attendance);
                const pct = getGroupPct(group);
                return (
                  <div key={group.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{group.prospect.name || "-"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {group.prospect.badgeId || "-"} · {group.prospect.phoneNumber || "-"}
                        </p>
                        {!allRecordsLoading && pct !== null && (
                          <p className="mt-1 text-xs font-medium text-slate-600">
                            Attendance:{" "}
                            <span className={pct >= 75 ? "text-emerald-600" : "text-red-600"}>{pct}%</span>
                          </p>
                        )}
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <AttendanceButtons
                      group={group}
                      status={status}
                      saving={savingGroupKey === group.key}
                      onChange={handleAttendance}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">SR. No.</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Badge ID</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Phone</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Attendance %</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map((group, index) => {
                    const status = groupStatus(group, attendance);
                    const pct = getGroupPct(group);
                    return (
                      <tr key={group.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{group.prospect.name || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{group.prospect.badgeId || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{group.prospect.phoneNumber || "-"}</td>
                        <td className="px-4 py-3">
                          {allRecordsLoading || pct === null ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span className={`font-medium ${pct >= 75 ? "text-emerald-600" : "text-red-600"}`}>
                              {pct}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <AttendanceButtons
                            group={group}
                            status={status}
                            saving={savingGroupKey === group.key}
                            onChange={handleAttendance}
                            alignRight
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Export date range modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Export Attendance</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a date range. Leave blank to export all dates.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  From
                </label>
                <input
                  type="date"
                  lang="en-GB"
                  value={exportFromDate}
                  max={getLocalISODate()}
                  onChange={(e) => setExportFromDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  To
                </label>
                <input
                  type="date"
                  lang="en-GB"
                  value={exportToDate}
                  min={exportFromDate || undefined}
                  max={getLocalISODate()}
                  onChange={(e) => setExportToDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => exportToExcel("", "")}
                className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
              >
                Export All
              </button>
              <button
                type="button"
                onClick={() => exportToExcel(exportFromDate, exportToDate)}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Present:  "bg-emerald-100 text-emerald-700",
    Leave:    "bg-red-100 text-red-700",
    Unmarked: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.Unmarked}`}>
      {status}
    </span>
  );
}

function AttendanceButtons({ group, status, saving, onChange, alignRight = false }) {
  return (
    <div className={`mt-3 flex gap-2 md:mt-0 ${alignRight ? "justify-end" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(group, "Present")}
        disabled={saving}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          status === "Present"
            ? "bg-emerald-600 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
        }`}
      >
        {saving ? "Saving..." : "Present"}
      </button>
      <button
        type="button"
        onClick={() => onChange(group, "Leave")}
        disabled={saving}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          status === "Leave"
            ? "bg-red-600 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700"
        }`}
      >
        Leave
      </button>
    </div>
  );
}

export default AttendancePage;
