import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../services/AuthContext";
import {
  listProspectsAssignedTo,
  docToDisplay,
} from "../services/prospectsService";
import {
  createCallLog,
  updateCallLog,
  listCallLogsForUser,
  deleteCallLog,
} from "../services/callLogsService";
import { ActionMenu } from "../components/ActionMenu";
import { ProspectInfo } from "../components/ProspectInfo";
import { jsPDF } from "jspdf";

const SEARCH_BY_OPTIONS = [
  "Name of Sewadar/Sewadarni",
  "Address",
  "Phone Number",
  "Badge ID",
  "Blood Group",
];

const INITIAL_FORM = {
  select: "",
  callBack: "",
  notInterest: "",
  departmentOfSewa: "",
  needToWork: "",
  notes1: "",
  notes2: "",
  notes3: "",
  nominalListSelect: "",
  visitSelect: "",
  freeSewa: "N/A",
  attendance: "",
  jathaRecord: "",
  jathaDetails: [],
};

const INITIAL_JATHA = {
  areaName: "",
  departmentName: "",
  jathaTotalDay: "",
  dateFrom: "",
  dateTo: "",
};

function toTelHref(phone) {
  const raw = String(phone || "").trim();
  if (!raw || raw === "-") return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  const cleaned = normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized.replace(/\+/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function UserDashboard() {
  const { user } = useAuth();
  const [prospects, setProspects] = useState([]);
  const [prospectDocs, setProspectDocs] = useState({});
  const [searchBy, setSearchBy] = useState("Name of Sewadar/Sewadarni");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [userCallLogsByProspect, setUserCallLogsByProspect] = useState({});
  const [editingLogId, setEditingLogId] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const handleConfirmDelete = async () => {
    if (!deleteEntry) return;
    setSubmitting(true);
    try {
      await deleteCallLog(deleteEntry.log.$id);
      await loadAssigned();
      setDeleteEntry(null);
    } catch (err) {
      setError(err.message || "Failed to delete form.");
    } finally {
      setSubmitting(false);
    }
  };

  const loadAssigned = useCallback(async () => {
    const email = user?.email;
    if (!email) {
      setProspects([]);
      setProspectDocs({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await listProspectsAssignedTo(email);
      const docs = res.documents || [];
      const display = docs.map(docToDisplay);
      const byId = {};
      docs.forEach((d) => {
        byId[d.$id] = d;
      });
      setProspects(display);
      setProspectDocs(byId);
    } catch (err) {
      setError(err.message || "Failed to load assigned prospects.");
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  useEffect(() => {
    async function loadUserCallLogs() {
      const email = user?.email;
      if (!email) {
        setUserCallLogsByProspect({});
        return;
      }
      try {
        const res = await listCallLogsForUser(email);
        const docs = res.documents || [];
        const byProspect = {};
        docs.forEach((d) => {
          if (!d.prospectId) return;
          if (!byProspect[d.prospectId]) byProspect[d.prospectId] = d;
        });
        setUserCallLogsByProspect(byProspect);
      } catch {
        // ignore; user can still submit forms
      }
    }
    loadUserCallLogs();
  }, [user?.email]);

  const baseFiltered = prospects.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const field = {
      "Name of Sewadar/Sewadarni": p.name,
      Address: p.address,
      "Phone Number": p.phoneNumber,
      "Badge ID": p.badgeId,
      "Blood Group": p.bloodGroup,
    }[searchBy];
    return String(field || "")
      .toLowerCase()
      .includes(q);
  });

  const updateForm = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function openForm(prospect, options = {}) {
    const mode = options.mode || "edit";
    setSelectedProspect(prospect);
    setSelectedDoc(prospectDocs[prospect.id] || null);
    const existingLog = userCallLogsByProspect[prospect.id];
    if ((mode === "view" || mode === "edit") && existingLog) {
      let jatha = [];
      try {
        jatha =
          typeof existingLog.jathaDetails === "string"
            ? JSON.parse(existingLog.jathaDetails || "[]")
            : existingLog.jathaDetails || [];
      } catch {
        jatha = [];
      }
      setForm({
        select: existingLog.select || "",
        callBack: existingLog.callBack || "",
        notInterest: existingLog.notInterest || "",
        departmentOfSewa: existingLog.departmentOfSewa || "",
        needToWork: existingLog.needToWork || "",
        notes1: existingLog.notes1 || "",
        notes2: existingLog.notes2 || "",
        notes3: existingLog.notes3 || "",
        nominalListSelect: existingLog.nominalListSelect || "",
        visitSelect: existingLog.visitSelect || "",
        freeSewa: existingLog.freeSewa || "N/A",
        attendance: existingLog.attendance || "",
        jathaRecord: existingLog.jathaRecord || "",
        jathaDetails: Array.isArray(jatha) ? jatha : [],
      });
      setViewOnly(mode === "view");
      setEditingLogId(mode === "edit" ? existingLog.$id : null);
    } else {
      setForm(INITIAL_FORM);
      setViewOnly(false);
      setEditingLogId(null);
    }
    setSuccess("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setSelectedProspect(null);
    setSelectedDoc(null);
    setForm(INITIAL_FORM);
    setViewOnly(false);
    setEditingLogId(null);
  }

  function addJatha() {
    setForm((f) => ({
      ...f,
      jathaDetails: [...f.jathaDetails, { ...INITIAL_JATHA }],
    }));
  }

  function updateJatha(index, field, value) {
    setForm((f) => ({
      ...f,
      jathaDetails: f.jathaDetails.map((j, i) =>
        i === index ? { ...j, [field]: value } : j,
      ),
    }));
  }

  function removeJatha(index) {
    setForm((f) => ({
      ...f,
      jathaDetails: f.jathaDetails.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (viewOnly) return;
    if (!selectedProspect || !user?.email) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (editingLogId) {
        await updateCallLog(editingLogId, {
          select: form.select,
          callBack: form.callBack,
          notInterest: form.notInterest,
          departmentOfSewa: form.departmentOfSewa,
          needToWork: form.needToWork,
          notes1: form.notes1,
          notes2: form.notes2,
          notes3: form.notes3,
          nominalListSelect: form.nominalListSelect,
          visitSelect: form.visitSelect,
          freeSewa: form.freeSewa,
          attendance: form.attendance,
          jathaRecord: form.jathaRecord,
          jathaDetails: form.jathaDetails,
        });
        setSuccess("Form updated successfully.");
      } else {
        await createCallLog({
          prospectId: selectedProspect.id,
          prospectName: selectedProspect.name,
          submittedBy: user.email,
          select: form.select,
          callBack: form.callBack,
          notInterest: form.notInterest,
          departmentOfSewa: form.departmentOfSewa,
          needToWork: form.needToWork,
          notes1: form.notes1,
          notes2: form.notes2,
          notes3: form.notes3,
          nominalListSelect: form.nominalListSelect,
          visitSelect: form.visitSelect,
          freeSewa: form.freeSewa,
          attendance: form.attendance,
          jathaRecord: form.jathaRecord,
          jathaDetails: form.jathaDetails,
        });
        setSuccess("Form submitted successfully.");
      }
      // Refresh call logs so buttons switch to View/Edit
      try {
        const res = await listCallLogsForUser(user.email);
        const docs = res.documents || [];
        const byProspect = {};
        docs.forEach((d) => {
          if (!d.prospectId) return;
          if (!byProspect[d.prospectId]) byProspect[d.prospectId] = d;
        });
        setUserCallLogsByProspect(byProspect);
      } catch {
        // ignore
      }
      setTimeout(() => closeForm(), 1500);
    } catch (err) {
      setError(err.message || "Failed to submit form.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleDownload = () => {
    if (!selectedProspect || !form) return;

    const docPdf = new jsPDF();
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const pageHeight = docPdf.internal.pageSize.getHeight();
    const marginX = 15;
    const marginY = 15;
    const maxWidth = pageWidth - marginX * 2;
    let y = marginY;

    // Helper to add a new page if needed
    const checkNewPage = (requiredSpace = 10) => {
      if (y + requiredSpace > pageHeight - marginY) {
        docPdf.addPage();
        y = marginY;
        return true;
      }
      return false;
    };

    // Header with title
    docPdf.setFillColor(220, 38, 38); // Red background
    docPdf.rect(0, 0, pageWidth, 25, "F");
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(18);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("CALLING FORM", pageWidth / 2, 18, {
      align: "center",
    });
    docPdf.setTextColor(0, 0, 0);
    y = 35;

    // Prospect Information Box
    docPdf.setFillColor(241, 245, 249); // Light slate
    docPdf.roundedRect(marginX, y, maxWidth, 30, 3, 3, "F");
    docPdf.setFontSize(12);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("PROSPECT INFORMATION", marginX + 5, y + 8);
    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    docPdf.text(`Name: ${selectedProspect.name || "-"}`, marginX + 5, y + 15);
    docPdf.text(
      `Badge ID: ${selectedProspect.badgeId || "-"}`,
      marginX + 5,
      y + 21,
    );
    docPdf.text(
      `Phone: ${selectedProspect.phoneNumber || "-"}`,
      marginX + 100,
      y + 15,
    );
    docPdf.text(
      `Address: ${selectedProspect.address || "-"}`,
      marginX + 100,
      y + 21,
    );
    y += 35;

    // Calling Data Select Option Section
    checkNewPage(25);
    docPdf.setFillColor(220, 38, 38);
    docPdf.rect(marginX, y, maxWidth, 8, "F");
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(11);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("CALLING DATA SELECT OPTION", marginX + 5, y + 6);
    docPdf.setTextColor(0, 0, 0);
    y += 12;

    const callingData = [
      ["Select", form.select || "-"],
      ["Call Back", form.callBack || "-"],
      ["Not Interest", form.notInterest || "-"],
      ["Department of Sewa", form.departmentOfSewa || "-"],
    ];
    callingData.forEach(([label, value]) => {
      checkNewPage(8);
      docPdf.setFontSize(10);
      docPdf.setFont("helvetica", "normal");
      docPdf.text(`${label}:`, marginX + 5, y);
      docPdf.setFont("helvetica", "bold");
      docPdf.text(value, marginX + 60, y);
      y += 7;
    });
    y += 3;

    // Transfer Data Section
    checkNewPage(25);
    docPdf.setFillColor(220, 38, 38);
    docPdf.rect(marginX, y, maxWidth, 8, "F");
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(11);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("TRANSFER DATA", marginX + 5, y + 6);
    docPdf.setTextColor(0, 0, 0);
    y += 12;

    const transferData = [
      ["Nominal List Select", form.nominalListSelect || "-"],
      ["Visit Select", form.visitSelect || "-"],
      ["Free Sewa", form.freeSewa || "-"],
      ["Attendance", form.attendance || "-"],
      ["Jatha Record", form.jathaRecord || "-"],
    ];
    transferData.forEach(([label, value]) => {
      checkNewPage(8);
      docPdf.setFontSize(10);
      docPdf.setFont("helvetica", "normal");
      docPdf.text(`${label}:`, marginX + 5, y);
      docPdf.setFont("helvetica", "bold");
      docPdf.text(value, marginX + 60, y);
      y += 7;
    });
    y += 3;

    // Need to Work Section
    checkNewPage(30);
    docPdf.setFillColor(220, 38, 38);
    docPdf.rect(marginX, y, maxWidth, 8, "F");
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(11);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("NEED TO WORK", marginX + 5, y + 6);
    docPdf.setTextColor(0, 0, 0);
    y += 12;

    checkNewPage(15);
    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Need to Work:", marginX + 5, y);
    const needToWorkChunks = docPdf.splitTextToSize(
      form.needToWork || "-",
      maxWidth - 50,
    );
    needToWorkChunks.forEach((chunk) => {
      docPdf.text(chunk, marginX + 5, y);
      y += 5;
    });
    y += 3;

    // Notes Section
    if (form.notes1 || form.notes2 || form.notes3) {
      checkNewPage(30);
      docPdf.setFillColor(220, 38, 38);
      docPdf.rect(marginX, y, maxWidth, 8, "F");
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("NOTES", marginX + 5, y + 6);
      docPdf.setTextColor(0, 0, 0);
      y += 12;

      const notesData = [
        ["Good Participation", form.notes1 || "-"],
        ["Positive", form.notes2 || "-"],
        ["VIP Prospect", form.notes3 || "-"],
      ];
      notesData.forEach(([label, value]) => {
        checkNewPage(12);
        docPdf.setFontSize(10);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(`${label}:`, marginX + 5, y);
        docPdf.setFont("helvetica", "normal");
        const chunks = docPdf.splitTextToSize(value, maxWidth - 50);
        chunks.forEach((chunk) => {
          docPdf.text(chunk, marginX + 5, y);
          y += 5;
        });
        y += 2;
      });
    }
    y += 3;

    // Jatha Details Section
    if (Array.isArray(form.jathaDetails) && form.jathaDetails.length > 0) {
      checkNewPage(30);
      docPdf.setFillColor(220, 38, 38);
      docPdf.rect(marginX, y, maxWidth, 8, "F");
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("JATHA DETAILS", marginX + 5, y + 6);
      docPdf.setTextColor(0, 0, 0);
      y += 12;

      // Table header
      checkNewPage(15);
      docPdf.setFillColor(241, 245, 249);
      docPdf.rect(marginX, y, maxWidth, 8, "F");
      docPdf.setFontSize(9);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Area Name", marginX + 5, y + 5);
      docPdf.text("Department", marginX + 50, y + 5);
      docPdf.text("Days", marginX + 100, y + 5);
      docPdf.text("Date From", marginX + 120, y + 5);
      docPdf.text("Date To", marginX + 160, y + 5);
      y += 10;

      // Table rows
      form.jathaDetails.forEach((j, i) => {
        checkNewPage(10);
        docPdf.setFontSize(9);
        docPdf.setFont("helvetica", "normal");
        docPdf.text(`${i + 1}.`, marginX + 2, y);
        docPdf.text(j.areaName || "-", marginX + 8, y);
        docPdf.text(j.departmentName || "-", marginX + 50, y);
        docPdf.text(j.jathaTotalDay || "-", marginX + 100, y);
        docPdf.text(j.dateFrom || "-", marginX + 120, y);
        docPdf.text(j.dateTo || "-", marginX + 160, y);
        y += 7;
      });
    }

    // Footer
    const totalPages = docPdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      docPdf.setPage(i);
      docPdf.setFontSize(8);
      docPdf.setTextColor(128, 128, 128);
      docPdf.text(
        `Submitted by: ${user?.email || "N/A"} | Date: ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" },
      );
      docPdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, {
        align: "center",
      });
    }

    docPdf.save(
      `call_form_${selectedProspect.badgeId || selectedProspect.id}.pdf`,
    );
  };

  const doc = selectedDoc;

  return (
    <div className="flex flex-col">
      <header>
        <h1 className="text-base font-semibold text-slate-900 sm:text-xl">
          Prospects Details
        </h1>
      </header>

      <div className="overflow-visible rounded-lg bg-white p-2.5 shadow-sm sm:rounded-xl sm:p-4 flex flex-col flex-1">
        {/* Search */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm"
            >
              {SEARCH_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  Search by {opt}
                </option>
              ))}
            </select>
            <div className="relative w-full sm:min-w-[180px] sm:flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-slate-400 sm:rounded-lg sm:pl-9 sm:pr-3 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table / Cards */}
        <div className="mt-3 overflow-x-auto rounded-lg sm:mt-4 sm:rounded-xl">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                Loading your assigned prospects…
              </p>
            </div>
          ) : baseFiltered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-600">
                No prospects assigned to you yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                The admin will assign prospects from the Prospects Details page.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="flex flex-col gap-2 md:hidden">
                {baseFiltered.map((p, idx) => {
                  const existingLog = userCallLogsByProspect[p.id];
                  const hasLog = !!existingLog;
                  const idKey = String(p.id ?? idx);
                  return (
                    <div
                      key={idKey}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">
                          {p.name || "-"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-600">
                          {p.address || "-"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {toTelHref(p.phoneNumber) ? (
                            <a
                              href={toTelHref(p.phoneNumber)}
                              className="text-slate-700 hover:underline"
                            >
                              {p.phoneNumber}
                            </a>
                          ) : (
                            p.phoneNumber || "-"
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          ID:{p.badgeId || "-"} · {p.bloodGroup || "-"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {hasLog ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openForm(p, { mode: "view" })}
                              className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                            >
                              View Form
                            </button>
                            <button
                              type="button"
                              onClick={() => openForm(p, { mode: "edit" })}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              Edit Form
                            </button>
                            <button
                              type="button"
                              disabled={!hasLog}
                              onClick={() =>
                                hasLog &&
                                setDeleteEntry({
                                  prospect: p,
                                  log: existingLog,
                                })
                              }
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openForm(p, { mode: "edit" })}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Fill Form
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div
                className="hidden overflow-x-auto overflow-y-visible md:block"
                style={{ clipPath: "none" }}
              >
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Name of Sewadar/Sewadarni
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Address
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Phone Number
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Badge ID
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Blood Group
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseFiltered.map((p, idx) => {
                      const existingLog = userCallLogsByProspect[p.id];
                      const hasLog = !!existingLog;
                      const idKey = String(p.id ?? idx);
                      return (
                        <tr
                          key={idKey}
                          className="border-b border-slate-100 hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {p.name || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {p.address || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {toTelHref(p.phoneNumber) ? (
                              <a
                                href={toTelHref(p.phoneNumber)}
                                className="text-slate-700 hover:underline"
                              >
                                {p.phoneNumber}
                              </a>
                            ) : (
                              p.phoneNumber || "-"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {p.badgeId || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {p.bloodGroup || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <ActionMenu
                              onView={
                                hasLog
                                  ? () => openForm(p, { mode: "view" })
                                  : undefined
                              }
                              onEdit={() => openForm(p, { mode: "edit" })}
                              onDelete={
                                hasLog
                                  ? () =>
                                      setDeleteEntry({
                                        prospect: p,
                                        log: existingLog,
                                      })
                                  : undefined
                              }
                              showViewForm={hasLog}
                              showEditForm={true}
                              showDeleteProspect={hasLog}
                              isSaving={
                                submitting && deleteEntry?.prospect?.id === p.id
                              }
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

      {/* Call Form Modal - matches image layout */}
      {formOpen && selectedProspect && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="call-form-title"
          onClick={closeForm}
        >
          <div
            className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                ← Back
              </button>
              <h2
                id="call-form-title"
                className="text-lg font-semibold text-slate-900"
              >
                Prospect Details – {selectedProspect.name}
              </h2>
              {viewOnly && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"
                  title="Download as PDF"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  PDF
                </button>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto bg-sky-100/80 p-4 sm:p-6"
            >
              {/* Prospect info section (shared component) */}
              <ProspectInfo prospect={selectedProspect} doc={doc} />

              {/* Calling Data Select Option + Transfer Data - layout side by side */}
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                    Calling Data Select Option
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Select
                      </label>
                      <select
                        value={form.select}
                        onChange={updateForm("select")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
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
                        value={form.callBack}
                        onChange={updateForm("callBack")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
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
                        value={form.notInterest}
                        onChange={updateForm("notInterest")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Department of Sewa (optional)
                      </label>
                      <input
                        type="text"
                        value={form.departmentOfSewa}
                        onChange={updateForm("departmentOfSewa")}
                        disabled={viewOnly}
                        placeholder="e.g. Langar Seva, Main Kitchen"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                    Transfer Data
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Nominal List Select
                      </label>
                      <select
                        value={form.nominalListSelect}
                        onChange={updateForm("nominalListSelect")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
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
                        value={form.visitSelect}
                        onChange={updateForm("visitSelect")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Free Sewa
                      </label>
                      <select
                        value={form.freeSewa}
                        onChange={updateForm("freeSewa")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="N/A">N/A</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Attendance
                      </label>
                      <select
                        value={form.attendance}
                        onChange={updateForm("attendance")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
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
                        value={form.jathaRecord}
                        onChange={updateForm("jathaRecord")}
                        disabled={viewOnly}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Need to Work - single paragraph input */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                  Need to Work
                </p>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Need to Work
                </label>
                <textarea
                  value={form.needToWork}
                  onChange={updateForm("needToWork")}
                  disabled={viewOnly}
                  rows={4}
                  placeholder="Enter detailed notes about areas that need work..."
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                />
              </div>

              {/* Notes Section - 3 textareas */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                  Notes
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Good Participation
                    </label>
                    <textarea
                      value={form.notes1}
                      onChange={updateForm("notes1")}
                      disabled={viewOnly}
                      rows={3}
                      placeholder="Notes about good participation..."
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Positive
                    </label>
                    <textarea
                      value={form.notes2}
                      onChange={updateForm("notes2")}
                      disabled={viewOnly}
                      rows={3}
                      placeholder="Positive notes..."
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      VIP Prospect
                    </label>
                    <textarea
                      value={form.notes3}
                      onChange={updateForm("notes3")}
                      disabled={viewOnly}
                      rows={3}
                      placeholder="VIP prospect notes..."
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* Jatha Details - bold red header */}
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                Jatha Details
              </p>
              {!viewOnly && (
                <button
                  type="button"
                  onClick={addJatha}
                  className="mb-3 flex items-center gap-1.5 rounded-lg border border-sky-400 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  + Add Jatha
                </button>
              )}
              {form.jathaDetails.length > 0 && (
                <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-2 font-semibold text-slate-700">
                          Area Name
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700">
                          Department name
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700">
                          Jatha total Day
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700">
                          Date From..To..
                        </th>
                        <th className="w-10 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.jathaDetails.map((j, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={j.areaName}
                              onChange={(e) =>
                                updateJatha(i, "areaName", e.target.value)
                              }
                              placeholder="e.g. North Hall"
                              disabled={viewOnly}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={j.departmentName}
                              onChange={(e) =>
                                updateJatha(i, "departmentName", e.target.value)
                              }
                              placeholder="e.g. Langar Seva"
                              disabled={viewOnly}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={j.jathaTotalDay}
                              onChange={(e) =>
                                updateJatha(i, "jathaTotalDay", e.target.value)
                              }
                              placeholder="Days"
                              disabled={viewOnly}
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <input
                                type="date"
                                value={j.dateFrom}
                                onChange={(e) =>
                                  updateJatha(i, "dateFrom", e.target.value)
                                }
                                disabled={viewOnly}
                                className="rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                              />
                              <input
                                type="date"
                                value={j.dateTo}
                                onChange={(e) =>
                                  updateJatha(i, "dateTo", e.target.value)
                                }
                                disabled={viewOnly}
                                className="rounded border border-slate-200 px-2 py-1 text-xs disabled:bg-slate-50"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            {!viewOnly && (
                              <button
                                type="button"
                                onClick={() => removeJatha(i)}
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                                aria-label="Remove"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              {!viewOnly && (
                <div className="flex justify-center pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full max-w-xs rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "SUBMIT"}
                  </button>
                </div>
              )}
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
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Delete calling form?
              </h2>
              <button
                onClick={() => setDeleteEntry(null)}
                className="text-slate-400 hover:text-slate-600"
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
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete the calling form for{" "}
                <strong>{deleteEntry.prospect.name || "-"}</strong>?
              </p>
              <p className="mt-2 text-sm text-slate-500">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setDeleteEntry(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
