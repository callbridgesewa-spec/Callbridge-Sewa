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

function AttendancePage() {
  const {
    filteredEntries,
    loading: entriesLoading,
    error: entriesError,
  } =
    useJathaData(true);
  const [selectedDate, setSelectedDate] = useState(getLocalISODate);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [savingProspectId, setSavingProspectId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const prospects = useMemo(() => {
    const byId = new Map();
    filteredEntries.forEach(({ prospect }) => {
      if (prospect?.id && !byId.has(prospect.id)) {
        byId.set(prospect.id, prospect);
      }
    });
    return [...byId.values()];
  }, [filteredEntries]);

  const visibleProspects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return prospects;
    return prospects.filter((prospect) =>
      [prospect.name, prospect.badgeId, prospect.phoneNumber]
        .some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [prospects, searchQuery]);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      setAttendanceLoading(true);
      setError("");
      setSuccess("");
      try {
        const records = await getAttendanceForDate(selectedDate);
        if (!active) return;
        const map = {};
        records.forEach((record) => {
          map[record.prospectId] = record.status;
        });
        setAttendance(map);
      } catch (err) {
        if (active) {
          setAttendance({});
          setError(err.message || "Failed to load attendance.");
        }
      } finally {
        if (active) setAttendanceLoading(false);
      }
    }

    loadAttendance();
    return () => {
      active = false;
    };
  }, [selectedDate]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    prospects.forEach((prospect) => {
      if (attendance[prospect.id] === "Present") present += 1;
      if (attendance[prospect.id] === "Absent") absent += 1;
    });
    return {
      present,
      absent,
      unmarked: prospects.length - present - absent,
    };
  }, [attendance, prospects]);

  const handleAttendance = async (prospectId, status) => {
    setSavingProspectId(prospectId);
    setError("");
    setSuccess("");
    try {
      await recordAttendance(prospectId, selectedDate, status);
      setAttendance((current) => ({ ...current, [prospectId]: status }));
      setSuccess(`Attendance saved for ${formatDate(selectedDate)}.`);
    } catch (err) {
      setError(err.message || "Failed to save attendance.");
    } finally {
      setSavingProspectId("");
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const records = await getAllAttendance();
      const dates = [
        ...new Set(records.map((record) => toDateOnly(record.date)).filter(Boolean)),
      ].sort();
      if (dates.length === 0) {
        throw new Error("No attendance history is available to export.");
      }

      const attendanceByProspectAndDate = new Map();
      records.forEach((record) => {
        attendanceByProspectAndDate.set(
          `${record.prospectId}:${toDateOnly(record.date)}`,
          record.status,
        );
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance Register", {
        views: [{ state: "frozen", xSplit: 3, ySplit: 1 }],
      });
      worksheet.properties.defaultRowHeight = 22;
      worksheet.columns = [
        { header: "SR. No.", key: "serial", width: 9 },
        { header: "Name", key: "name", width: 24 },
        { header: "Badge ID", key: "badgeId", width: 14 },
        ...dates.map((date) => ({
          header: formatExcelDate(date),
          key: date,
          width: 14,
        })),
      ];

      const thinBorder = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      const statusStyles = {
        PRESENT: { fill: "FFD9EAD3", font: "FF00864B" },
        ABSENT: { fill: "FFF4CCCC", font: "FFC9342F" },
      };

      worksheet.getRow(1).height = 24;
      worksheet.getRow(1).eachCell((cell, columnNumber) => {
        cell.font = { name: "Arial", size: 11, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: columnNumber <= 3 ? "FFD9EAD3" : "FFFFF2CC" },
        };
      });

      prospects.forEach((prospect, index) => {
        const row = worksheet.addRow({
          serial: index + 1,
          name: prospect.name || "-",
          badgeId: prospect.badgeId || "-",
        });
        row.height = 22;

        dates.forEach((date, dateIndex) => {
          const recordedStatus = attendanceByProspectAndDate.get(
            `${prospect.id}:${date}`,
          );
          let exportStatus = "";
          if (recordedStatus === "Present") {
            exportStatus = "PRESENT";
          } else if (recordedStatus === "Absent") {
            exportStatus = "ABSENT";
          }

          const cell = row.getCell(dateIndex + 4);
          cell.value = exportStatus;
          if (exportStatus) {
            const style = statusStyles[exportStatus];
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: style.fill },
            };
            cell.font = {
              name: "Arial",
              size: 11,
              bold: true,
              color: { argb: style.font },
            };
          }
        });

        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: columnNumber === 2 ? "left" : "center",
            vertical: "middle",
          };
          if (columnNumber <= 3 && !cell.font?.bold) {
            cell.font = { name: "Arial", size: 10 };
          }
        });
      });

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: dates.length + 3 },
      };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbook(buffer, `attendance_register_${selectedDate}.xlsx`);
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
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          />
          <button
            type="button"
            onClick={exportToExcel}
            disabled={loading || exporting || prospects.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export Register"}
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Present", counts.present, "border-emerald-200 bg-emerald-50 text-emerald-700"],
          ["Absent", counts.absent, "border-red-200 bg-red-50 text-red-700"],
          ["Unmarked", counts.unmarked, "border-slate-200 bg-white text-slate-700"],
        ].map(([label, value, className]) => (
          <div key={label} className={`rounded-xl border p-4 shadow-sm ${className}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-visible rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {formatDate(selectedDate)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {prospects.length} unique sewadar{prospects.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
          <div className="py-12 text-center text-sm text-slate-500">
            Loading attendance...
          </div>
        ) : visibleProspects.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No Jatha record sewadar found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Sewadar entries appear here after their calling form is added to
              the nominal list or visit list.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:hidden">
              {visibleProspects.map((prospect) => {
                const status = attendance[prospect.id] || "Unmarked";
                return (
                  <div key={prospect.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{prospect.name || "-"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {prospect.badgeId || "-"} · {prospect.phoneNumber || "-"}
                        </p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <AttendanceButtons
                      prospectId={prospect.id}
                      status={status}
                      saving={savingProspectId === prospect.id}
                      onChange={handleAttendance}
                    />
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">SR. No.</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Badge ID</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Phone</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProspects.map((prospect, index) => {
                    const status = attendance[prospect.id] || "Unmarked";
                    return (
                      <tr key={prospect.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{prospect.name || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{prospect.badgeId || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">{prospect.phoneNumber || "-"}</td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <AttendanceButtons
                            prospectId={prospect.id}
                            status={status}
                            saving={savingProspectId === prospect.id}
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
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Present: "bg-emerald-100 text-emerald-700",
    Absent: "bg-red-100 text-red-700",
    Unmarked: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function AttendanceButtons({ prospectId, status, saving, onChange, alignRight = false }) {
  return (
    <div className={`mt-3 flex gap-2 md:mt-0 ${alignRight ? "justify-end" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(prospectId, "Present")}
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
        onClick={() => onChange(prospectId, "Absent")}
        disabled={saving}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          status === "Absent"
            ? "bg-red-600 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700"
        }`}
      >
        Absent
      </button>
    </div>
  );
}

export default AttendancePage;
