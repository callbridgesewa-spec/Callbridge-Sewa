import { useState } from "react";
import * as XLSX from "xlsx";
import { useJathaData } from "../../hooks/useJathaData";
import { ActionMenu } from "../../components/ActionMenu";
import { ProspectInfo } from "../../components/ProspectInfo";
import { JathaDepartmentSelect } from "../../components/JathaDepartmentSelect";
import { JathaAreaSelect } from "../../components/JathaAreaSelect";
import { computeVisitStats } from "../../services/visitStatsService";

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
    entries,
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
    editEntry,
    setEditEntry,
    editForm,
    setEditForm,
    saving,
    deleteEntry,
    setDeleteEntry,
    filteredEntries,
    openEdit,
    handleSaveEdit,
    handleConfirmDelete,
    EMPTY_FORM,
  } = useJathaData(true);

  const hasFilter = filterDept || filterArea || filterDateFrom || filterDateTo;



  const handleExport = () => {
    const headers = [
      "S.NO",
      "Name OF SEWADAR / SEWADARNI",
      "FATHER'S / HUSBAND'S NAME",
      "GENDER",
      "AGE",
      "ADDHAR NO",
      "Badge ID",
      "Phone",
      "BHATI ATTENDANCE COUNT",
      "BHATI ATTENDANCE PERCENT",
      "BEAS ATTENDANCE COUNT",
      "BEAS ATTENDANCE PERCENT",
      "OTHER MAJOR CENTER ATTENDANCE COUNT",
      "OTHER MAJOR CENTER ATTENDANCE PERCENT",
      "ATTENDANCE COUNT",
      "ATTENDANCE PERCENT",
      "Address",
      "Nominal List",
      "Visit Select",
      "Attendance",
      "Jatha Record",
      "Jatha Details",
      "Submitted By",
      "Date",
    ];

    // Aggregate Bhati/Beas/Other visit counts per badge ID across all jatha entries.
    const statsByBadgeId = new Map();
    computeVisitStats(entries).forEach((s) => statsByBadgeId.set(s.badgeId, s));

    const clean = (v) => (v == null || v === "-" ? "" : v);

    // Group entries into one row per sewadar, keyed by badge ID
    // (falling back to prospect ID when a badge is missing).
    const groups = new Map();
    filteredEntries.forEach(({ prospect, log }) => {
      const badge = String(prospect.badgeId || "").trim();
      const key = badge && badge !== "-" ? `badge:${badge}` : `id:${prospect.id || ""}`;
      if (!groups.has(key)) groups.set(key, { prospect, logs: [] });
      groups.get(key).logs.push(log);
    });

    // "Yes" if any submission says Yes; else "No" if any says No; else blank.
    const rollUpYesNo = (logs, field) => {
      let sawNo = false;
      for (const l of logs) {
        const v = String(l[field] || "").trim().toLowerCase();
        if (v === "yes") return "Yes";
        if (v === "no") sawNo = true;
      }
      return sawNo ? "No" : "";
    };

    const rows = [...groups.values()].map(({ prospect, logs }, idx) => {
      // Combine jatha details across all of this sewadar's submissions.
      const allJathas = [];
      logs.forEach((log) => {
        let jathas = [];
        try { jathas = typeof log.jathaDetails === "string" ? JSON.parse(log.jathaDetails || "[]") : log.jathaDetails || []; } catch { jathas = []; }
        if (Array.isArray(jathas)) allJathas.push(...jathas);
      });
      const jathaStr = allJathas.map((j, i) => `[${i+1}] Area:${j.areaName||"-"} Dept:${j.departmentName||"-"} Days:${j.jathaTotalDay||"-"} ${j.dateFrom||"-"} to ${j.dateTo||"-"}`).join(" | ");

      const submitters = [...new Set(logs.map((l) => String(l.submittedBy || "").trim()).filter(Boolean))].join(", ");
      const latestTs = logs.reduce((max, l) => {
        const t = l.$createdAt ? new Date(l.$createdAt).getTime() : 0;
        return t > max ? t : max;
      }, 0);

      const stat = statsByBadgeId.get(String(prospect.badgeId || "").trim());
      return [
        idx + 1,
        clean(prospect.name),
        clean(prospect.fatherHusbandName || prospect.guardian),
        clean(prospect.gender),
        clean(prospect.age),
        clean(prospect.aadhar),
        clean(prospect.badgeId),
        clean(prospect.phoneNumber),
        stat ? stat.bhatiCount : "",
        stat ? stat.bhatiPercentage : "",
        stat ? stat.beasCount : "",
        stat ? stat.beasPercentage : "",
        stat ? stat.otherCount : "",
        stat ? stat.otherPercentage : "",
        stat ? stat.totalVisits : "",
        stat ? 100 : "",
        clean(prospect.address),
        rollUpYesNo(logs, "nominalListSelect"),
        rollUpYesNo(logs, "visitSelect"),
        rollUpYesNo(logs, "attendance"),
        rollUpYesNo(logs, "jathaRecord"),
        jathaStr,
        submitters,
        latestTs ? new Date(latestTs).toLocaleDateString() : "",
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [6, 24, 24, 10, 8, 16, 12, 14, 14, 14, 14, 14, 18, 18, 14, 14, 22, 12, 12, 12, 12, 50, 24, 12].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jatha Record");
    XLSX.writeFile(wb, `jatha_record_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const parseJathaDetails = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Jatha Record</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sewadars with Nominal List or Visit Select &quot;Yes&quot; —
            combined nominal and visit data with attendance
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
              When users submit calling forms with &quot;Nominal List
              Select&quot; or &quot;Visit Select&quot; set to &quot;Yes&quot;,
              they will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="flex flex-col gap-2 md:hidden">
              {filteredEntries.map((entry, idx) => {
                const { prospect, log } = entry;
                return (
                  <div
                    key={log.$id || prospect.id || idx}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        {prospect.name || "-"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        F/H: {prospect.fatherHusbandName || prospect.guardian || "-"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {prospect.address || "-"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {toTelHref(prospect.phoneNumber) ? (
                          <a
                            href={toTelHref(prospect.phoneNumber)}
                            className="text-slate-700 hover:underline"
                          >
                            {prospect.phoneNumber}
                          </a>
                        ) : (
                          prospect.phoneNumber || "-"
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Nominal: {log.nominalListSelect || "-"} · Visit:{" "}
                        {log.visitSelect || "-"} · Attendance:{" "}
                        {log.attendance || "-"}
                      </p>
                    </div>
                    <ActionMenu
                      onView={() => setViewEntry(entry)}
                      onEdit={() => openEdit(entry)}
                      onDelete={() => setDeleteEntry(entry)}
                      isSaving={saving}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div
              className="hidden md:block overflow-x-auto overflow-y-visible"
              style={{ clipPath: "none" }}
            >
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Name
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Father&apos;s/Husband Name
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Gender
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Age
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Badge ID
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Phone
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Nominal
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Visit
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Attendance
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Submitted By
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, i) => {
                    const { prospect, log } = entry;
                    return (
                      <tr
                        key={log.$id || prospect.id || i}
                        className="border-b border-slate-100 hover:bg-slate-50/50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {prospect.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {prospect.fatherHusbandName || prospect.guardian || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {prospect.gender || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {prospect.age || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {prospect.badgeId || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {toTelHref(prospect.phoneNumber) ? (
                            <a
                              href={toTelHref(prospect.phoneNumber)}
                              className="text-slate-700 hover:underline"
                            >
                              {prospect.phoneNumber}
                            </a>
                          ) : (
                            prospect.phoneNumber || "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.nominalListSelect || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.visitSelect || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.attendance || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.submittedBy || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {log.$createdAt
                            ? new Date(log.$createdAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <ActionMenu
                            onView={() => setViewEntry(entry)}
                            onEdit={() => openEdit(entry)}
                            onDelete={() => setDeleteEntry(entry)}
                            isSaving={saving}
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
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                  Jatha Details
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="text-xs text-slate-500">
                      Jatha Record:{" "}
                    </span>
                    <span className="font-medium">
                      {viewEntry.log.jathaRecord || "-"}
                    </span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">Attendance: </span>
                    <span className="font-medium">
                      {viewEntry.log.attendance || "-"}
                    </span>
                  </p>
                </div>
                {parseJathaDetails(viewEntry.log.jathaDetails).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-2 py-2 font-semibold text-slate-700">
                            Area Name
                          </th>
                          <th className="px-2 py-2 font-semibold text-slate-700">
                            Department Name
                          </th>
                          <th className="px-2 py-2 font-semibold text-slate-700">
                            Total Day
                          </th>
                          <th className="px-2 py-2 font-semibold text-slate-700">
                            Date From
                          </th>
                          <th className="px-2 py-2 font-semibold text-slate-700">
                            Date To
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseJathaDetails(viewEntry.log.jathaDetails).map(
                          (row, i) => (
                            <tr
                              key={`${row.areaName || "jatha"}-${i}`}
                              className="border-b border-slate-100"
                            >
                              <td className="px-2 py-2 text-slate-700">
                                {row.areaName || "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-700">
                                {row.departmentName || "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-700">
                                {row.jathaTotalDay || "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-700">
                                {row.dateFrom || "-"}
                              </td>
                              <td className="px-2 py-2 text-slate-700">
                                {row.dateTo || "-"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No jatha details added.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditEntry(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Edit Calling Form – {editEntry.prospect.name || "-"}
              </h2>
              <button
                type="button"
                onClick={() => setEditEntry(null)}
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm"
            >
              <ProspectInfo
                prospect={editEntry.prospect}
                doc={editEntry.prospect.raw}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Select
                  </label>
                  <select
                    value={editForm.select}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, select: e.target.value }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Call Back
                  </label>
                  <select
                    value={editForm.callBack}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, callBack: e.target.value }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Not Interest
                  </label>
                  <select
                    value={editForm.notInterest}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        notInterest: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Department of Sewa
                  </label>
                  <input
                    type="text"
                    value={editForm.departmentOfSewa}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        departmentOfSewa: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Nominal List Select
                  </label>
                  <select
                    value={editForm.nominalListSelect}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        nominalListSelect: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Visit Select
                  </label>
                  <select
                    value={editForm.visitSelect}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        visitSelect: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Ferry Sewa
                  </label>
                  <select
                    value={editForm.freeSewa}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, freeSewa: e.target.value }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Attendance
                  </label>
                  <select
                    value={editForm.attendance}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, attendance: e.target.value }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Jatha Record
                  </label>
                  <select
                    value={editForm.jathaRecord}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        jathaRecord: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Need to Work
                </label>
                <textarea
                  value={editForm.needToWork}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, needToWork: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditEntry(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteEntry(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Delete calling form?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove the submitted calling form for{" "}
              <span className="font-semibold">
                {deleteEntry.prospect.name || "-"}
              </span>
              . This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteEntry(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JathaRecordPage;
