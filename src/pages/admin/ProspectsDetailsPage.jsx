import { useRef, useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  uploadProspectExcel,
  listProspects,
  listAllProspects,
  createProspect,
  createProspectsBulk,
  assignProspectsToUser,
  unassignProspects,
  deleteProspect,
  deleteProspectsBulk,
  docToDisplay,
} from "../../services/prospectsService";
import { listUsers } from "../../services/usersService";
import {
  listCallLogs,
  listAllCallLogs,
  listCallLogsForProspect,
  createCallLog,
  updateCallLog,
  deleteCallLogsForProspect,
  deleteCallLogsForProspects,
} from "../../services/callLogsService";
import { generateCallingFormPDF } from "../../utils/callingFormPdf";
import { ActionMenu } from "../../components/ActionMenu";
import { JathaAreaSelect } from "../../components/JathaAreaSelect";
import { JathaDepartmentSelect } from "../../components/JathaDepartmentSelect";
import { ProspectInfo } from "../../components/ProspectInfo";

const SEARCH_BY_OPTIONS = [
  "Name of Sewadar/Sewadarni",
  "Address",
  "Phone Number",
  "Badge ID",
  "Assigned To",
  "Blood Group",
];



/** Parse Excel file using the fixed template — exact header match, case-insensitive trim */
function parseExcelWithTemplate(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!raw.length) {
          resolve({ prospects: [], skipped: 0 });
          return;
        }

        const fileHeaders = raw[0].map((h) =>
          String(h ?? "")
            .trim()
            .toLowerCase(),
        );

        // Map each template column to the index it sits at in the uploaded file
        const colIndex = {};
        TEMPLATE_COLUMNS.forEach(({ header, field }) => {
          const idx = fileHeaders.indexOf(header.toLowerCase());
          if (idx !== -1) colIndex[field] = idx;
        });

        // Check required columns are present
        const missing = TEMPLATE_COLUMNS.filter(
          (c) => c.required && colIndex[c.field] === undefined,
        ).map((c) => c.header);
        if (missing.length) {
          reject(
            new Error(
              `Missing required columns: ${missing.join(", ")}. Please use the provided template.`,
            ),
          );
          return;
        }

        const dataRows = raw
          .slice(1)
          .filter((row) =>
            row.some((cell) => cell != null && String(cell).trim()),
          );

        let skipped = 0;
        const prospects = dataRows
          .map((row) => {
            const p = {};
            TEMPLATE_COLUMNS.forEach(({ field }) => {
              const idx = colIndex[field];
              p[field] =
                idx !== undefined && row[idx] != null
                  ? String(row[idx]).trim()
                  : "";
            });
            return p;
          })
          .filter((p) => {
            const hasName = p.fullName?.trim();
            const hasMobile = p.mobile?.trim();
            if (!hasName || !hasMobile) {
              skipped++;
              return false;
            }
            return true;
          });

        resolve({ prospects, skipped });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// --- Export: call log fields (compact headers, no redundant prospect name) ---
const CALL_LOG_EXPORT_FIELDS = [
  ["submittedBy", "Submitted By"],
  ["select", "Select"],
  ["callBack", "Call Back"],
  ["notInterest", "Not Interest"],
  ["departmentOfSewa", "Dept of Sewa"],
  ["needToWork", "Need to Work"],
  ["notes1", "Notes 1"],
  ["notes2", "Notes 2"],
  ["notes3", "Notes 3"],
  ["nominalListSelect", "Nominal List"],
  ["visitSelect", "Visit Select"],
  ["freeSewa", "Ferry Sewa"],
  ["attendance", "Attendance"],
  ["jathaRecord", "Jatha Record"],
  ["jathaDetails", "Jatha Details"],
];

// --- Export: visit assignment fields added to prospects ---
const VISIT_EXPORT_FIELDS = [
  ["visitName", "Visit Name"],
  ["assignDuty", "Assign Duty"],
  ["departmentName", "Visit Dept"],
  ["inchargeName", "Incharge"],
];

function excelCellValue(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatJathaDetails(raw) {
  let parsed = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return excelCellValue(raw);
    }
  }
  if (!Array.isArray(parsed) || !parsed.length) return excelCellValue(raw);
  return parsed
    .map((row, i) => {
      const parts = Object.entries(row || {})
        .filter(([, v]) => v != null && String(v).trim())
        .map(([k, v]) => `${k}: ${v}`);
      return parts.length ? `[${i + 1}] ${parts.join("; ")}` : "";
    })
    .filter(Boolean)
    .join(" | ");
}

/** Single-sheet export — prospect fields (matching import template) + visit fields + latest call log */
function exportProspectsWorkbook(prospectDocs, callLogDocs) {
  // Map latest call log per prospect
  const latestLog = new Map();
  for (const log of callLogDocs) {
    const pid = String(log.prospectId || "").trim();
    if (!pid) continue;
    const prev = latestLog.get(pid);
    if (!prev || new Date(log.$createdAt || 0) > new Date(prev.$createdAt || 0))
      latestLog.set(pid, log);
  }

  const headers = [
    ...TEMPLATE_COLUMNS.map((c) => c.header),
    ...CALL_LOG_EXPORT_FIELDS.map(([, h]) => h),
  ];

  const rows = prospectDocs.map((doc) => {
    const log = latestLog.get(String(doc.$id || "").trim());

    const prospectCells = TEMPLATE_COLUMNS.map(({ field }) => {
      if (field === "badgeId")
        return excelCellValue(doc.badgeId ?? doc.batchNumber);
      // DB stores this as `guardian`; the template field is fatherHusbandName
      if (field === "fatherHusbandName")
        return excelCellValue(doc.guardian ?? doc.fatherHusbandName);
      return excelCellValue(doc[field]);
    });

    const logCells = CALL_LOG_EXPORT_FIELDS.map(([field]) => {
      if (!log) return "";
      return field === "jathaDetails"
        ? formatJathaDetails(log[field])
        : excelCellValue(log[field]);
    });

    return [...prospectCells, ...logCells];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Prospects");
  XLSX.writeFile(
    wb,
    `sewadar_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

function calculateAgeFromDob(dateStr) {
  if (!dateStr) return "";
  const dob = new Date(dateStr);
  if (Number.isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : "";
}

function toTelHref(phone) {
  const raw = String(phone || "").trim();
  if (!raw || raw === "-") return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  const cleaned = normalized.startsWith("+")
    ? `+${normalized.slice(1).replace(/\+/g, "")}`
    : normalized.replace(/\+/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

const INITIAL_ADD_FORM = {
  name: "",
  fathersName: "",
  mobileNumber: "",
  age: "",
  departmentName: "",
  badgeStatus: "N/A",
  badgeId: "",
  gender: "Male",
  aadharNumber: "",
  dateOfBirth: "",
  emergencyContact: "",
  bloodgroup: "",
  locality: "",
  fullAddress: "",
  permanentAddress: "",
  maritalStatus: "N/A",
  initiated: false,
  dateOfInitiation: "",
  initiationBy: "",
  initiationPlace: "",
};

function ProspectsDetailsPage() {
  const [prospects, setProspects] = useState([]);
  const [searchBy, setSearchBy] = useState("Name of Sewadar/Sewadarni");
  const [searchQuery, setSearchQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importedSignatures, setImportedSignatures] = useState(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(INITIAL_ADD_FORM);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [assignToUser, setAssignToUser] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [assignedFilterUser, setAssignedFilterUser] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'single', id } | { type: 'bulk', count } | null
  const fileInputRef = useRef(null);
  const [viewCallLog, setViewCallLog] = useState(null); // { prospect, log } | null
  const [prospectsWithCallLog, setProspectsWithCallLog] = useState(new Set());
  const [editCallLog, setEditCallLog] = useState(null); // { prospect, log } | null
  const [callForm, setCallForm] = useState({
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
  });
  const [callFormSubmitting, setCallFormSubmitting] = useState(false);

  const loadProspects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProspects();
      const display = (res.documents || []).map(docToDisplay);
      setProspects(display);
    } catch (err) {
      setError(err.message || "Failed to load sewadars.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await listUsers();
      setUsers(res.documents || []);
    } catch {
      setUsers([]);
    }
  }, []);

  const loadCallLogSummary = useCallback(async () => {
    try {
      const res = await listCallLogs();
      const docs = res.documents || [];
      const withLog = new Set();
      docs.forEach((d) => {
        if (d.prospectId) {
          withLog.add(d.prospectId);
        }
      });
      setProspectsWithCallLog(withLog);
    } catch {
      setProspectsWithCallLog(new Set());
    }
  }, []);

  useEffect(() => {
    loadProspects();
    loadUsers();
    loadCallLogSummary();
  }, [loadProspects, loadUsers, loadCallLogSummary]);

  const updateAddForm = (field) => (e) =>
    setAddForm((f) => ({ ...f, [field]: e.target.value }));
  const updateAddFormRadio = (field) => (e) =>
    setAddForm((f) => ({ ...f, [field]: e.target.value }));

  const baseFiltered = prospects.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const field = {
      "Name of Sewadar/Sewadarni": p.name,
      Address: p.address,
      "Phone Number": p.phoneNumber,
      "Badge ID": p.badgeId,
      "Assigned To": p.assignedTo,
      "Blood Group": p.bloodGroup,
    }[searchBy];
    return String(field || "")
      .toLowerCase()
      .includes(q);
  });

  const filteredProspects =
    activeTab === "assigned"
      ? baseFiltered.filter(
          (p) =>
            p.assignedTo &&
            p.assignedTo !== "Unassigned" &&
            (!assignedFilterUser || p.assignedTo === assignedFilterUser),
        )
      : baseFiltered;

  const assignedUsers = [
    ...new Set(
      prospects.map((p) => p.assignedTo).filter((e) => e && e !== "Unassigned"),
    ),
  ];
  const assignableUsers = users.map((u) => u.email).filter(Boolean);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= filteredProspects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProspects.map((p) => p.id)));
    }
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) {
      setError("Select at least one sewadar.");
      return;
    }
    if (assignToUser === "") {
      setError('Please select a user or choose "Unassign".');
      return;
    }
    setAssigning(true);
    setError("");
    try {
      if (assignToUser === "__UNASSIGN__") {
        await unassignProspects([...selectedIds]);
      } else {
        await assignProspectsToUser([...selectedIds], assignToUser);
      }
      setSelectedIds(new Set());
      setAssignToUser("");
      await loadProspects();
    } catch (err) {
      setError(err.message || "Failed to assign/unassign sewadars.");
    } finally {
      setAssigning(false);
    }
  };

  const openDeleteConfirm = (id) => setDeleteConfirm({ type: "single", id });
  const openBulkDeleteConfirm = () => {
    if (selectedIds.size === 0) {
      setError("Select at least one sewadar to delete.");
      return;
    }
    setDeleteConfirm({ type: "bulk", count: selectedIds.size });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError("");
    try {
      if (deleteConfirm.type === "single") {
        // remove prospect itself first, then clean up any call logs
        await deleteProspect(deleteConfirm.id);
        await deleteCallLogsForProspect(deleteConfirm.id);
      } else {
        const ids = [...selectedIds];
        await deleteProspectsBulk(ids);
        // make sure associated logs vanish as well
        await deleteCallLogsForProspects(ids);
        setSelectedIds(new Set());
      }
      await loadProspects();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const openCallLogForProspect = async (prospect) => {
    try {
      const res = await listCallLogsForProspect(prospect.id);
      const docs = res.documents || [];
      if (!docs.length) {
        setError("No submitted calling form found for this sewadar.");
        return;
      }
      setViewCallLog({ prospect, log: docs[0] });
    } catch (err) {
      setError(err.message || "Failed to load calling form.");
    }
  };

  const openEditCallLogForProspect = async (prospect) => {
    try {
      const res = await listCallLogsForProspect(prospect.id);
      const docs = res.documents || [];
      const log = docs[0] || null;
      let jatha = [];
      if (log) {
        try {
          jatha =
            typeof log.jathaDetails === "string"
              ? JSON.parse(log.jathaDetails || "[]")
              : log.jathaDetails || [];
        } catch {
          jatha = [];
        }
      }
      setEditCallLog({ prospect, log });
      setCallForm({
        select: log?.select || "",
        callBack: log?.callBack || "",
        notInterest: log?.notInterest || "",
        departmentOfSewa: log?.departmentOfSewa || "",
        needToWork: log?.needToWork || "",
        notes1: log?.notes1 || "",
        notes2: log?.notes2 || "",
        notes3: log?.notes3 || "",
        nominalListSelect: log?.nominalListSelect || "",
        visitSelect: log?.visitSelect || "",
        freeSewa: log?.freeSewa || "N/A",
        attendance: log?.attendance || "",
        jathaRecord: log?.jathaRecord || "",
        jathaDetails: Array.isArray(jatha) ? jatha : [],
      });
    } catch (err) {
      setError(err.message || "Failed to load calling form for edit.");
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const { prospects, skipped } = await parseExcelWithTemplate(file);
      if (!prospects.length) {
        setError(
          skipped > 0
            ? `All ${skipped} rows were skipped (missing Name or Mobile). Please check the file.`
            : "No data rows found in the file.",
        );
        e.target.value = "";
        return;
      }
      await createProspectsBulk(
        prospects.map((p) => ({ ...p, assignedTo: "" })),
      );
      await loadProspects();
      if (skipped > 0) {
        setError(
          `Uploaded ${prospects.length} records. ${skipped} rows skipped (missing Name or Mobile).`,
        );
      }
    } catch (err) {
      setError(err.message || "Failed to upload sewadars.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleExportExcel = async () => {
    setError("");
    setExporting(true);
    try {
      const prospectDocs = await listAllProspects();
      if (prospectDocs.length === 0) {
        setError("No sewadars to export.");
        return;
      }
      const callLogDocs = await listAllCallLogs();
      exportProspectsWorkbook(prospectDocs, callLogDocs);
    } catch (err) {
      setError(err.message || "Failed to export sewadars.");
    } finally {
      setExporting(false);
    }
  };

  const handleSubmitProspect = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.mobileNumber.trim()) {
      setError("Name and Mobile Number are required.");
      return;
    }
    setAddSubmitting(true);
    setError("");
    const prospect = { ...addForm };
    try {
      await createProspect(prospect);
      setAddForm(INITIAL_ADD_FORM);
      setAddModalOpen(false);
      await loadProspects();
    } catch (err) {
      setError(err.message || "Failed to add sewadar.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setAddForm(INITIAL_ADD_FORM);
  };

  return (
    <div className="flex flex-col space-y-3 px-2 py-3 sm:space-y-5 sm:px-0 sm:py-0">
      <header>
        <h1 className="text-base font-semibold text-slate-900 sm:text-xl">
          Sewadar Details
        </h1>
      </header>

      <div className="overflow-visible rounded-lg bg-white p-2.5 shadow-sm sm:rounded-xl sm:p-4 flex flex-col flex-1">
        {/* Search and actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm"
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
                className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 sm:rounded-lg sm:pl-9 sm:pr-3 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-900 sm:flex-initial sm:px-4 sm:text-sm"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
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
              Add Sewadar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:flex-initial sm:px-4 sm:text-sm"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {importing ? "Uploading…" : "Upload Excel"}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 sm:flex-initial sm:px-4 sm:text-sm"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {exporting ? "Downloading…" : "Download Excel"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Edit Call Log (admin) – same layout as user form */}
        {editCallLog &&
          (() => {
            const { prospect } = editCallLog;

            const handleSubmitEditCall = async (e) => {
              e.preventDefault();
              setCallFormSubmitting(true);
              setError("");
              const formData = {
                select: callForm.select,
                callBack: callForm.callBack,
                notInterest: callForm.notInterest,
                departmentOfSewa: callForm.departmentOfSewa,
                needToWork: callForm.needToWork,
                notes1: callForm.notes1,
                notes2: callForm.notes2,
                notes3: callForm.notes3,
                nominalListSelect: callForm.nominalListSelect,
                visitSelect: callForm.visitSelect,
                freeSewa: callForm.freeSewa,
                attendance: callForm.attendance,
                jathaRecord: callForm.jathaRecord,
                jathaDetails: callForm.jathaDetails,
              };
              try {
                if (editCallLog?.log?.$id) {
                  await updateCallLog(editCallLog.log.$id, formData);
                } else {
                  await createCallLog({
                    ...formData,
                    prospectId: editCallLog.prospect.id,
                    prospectName: editCallLog.prospect.name || "",
                    submittedBy: "admin",
                  });
                  setProspectsWithCallLog(
                    (prev) => new Set([...prev, editCallLog.prospect.id]),
                  );
                }
                setEditCallLog(null);
              } catch (err) {
                setError(err.message || "Failed to save calling form.");
              } finally {
                setCallFormSubmitting(false);
              }
            };

            const addJatha = () => {
              setCallForm((f) => ({
                ...f,
                jathaDetails: [
                  ...f.jathaDetails,
                  {
                    areaName: "",
                    departmentName: "",
                    jathaTotalDay: "",
                    dateFrom: "",
                    dateTo: "",
                  },
                ],
              }));
            };

            const updateJatha = (index, field, value) => {
              setCallForm((f) => ({
                ...f,
                jathaDetails: f.jathaDetails.map((j, i) =>
                  i === index ? { ...j, [field]: value } : j,
                ),
              }));
            };

            const removeJatha = (index) => {
              setCallForm((f) => ({
                ...f,
                jathaDetails: f.jathaDetails.filter((_, i) => i !== index),
              }));
            };

            return (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
                role="dialog"
                aria-modal="true"
                onClick={() => setEditCallLog(null)}
              >
                <div
                  className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditCallLog(null)}
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
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
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Back
                    </button>
                    <div className="flex flex-col items-center">
                      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                        {prospect.name}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {editCallLog?.log
                          ? "Calling Form — Edit"
                          : "Calling Form — New (Admin)"}
                      </p>
                    </div>
                    <span className="w-16" />
                  </div>

                  <form
                    onSubmit={handleSubmitEditCall}
                    className="flex-1 overflow-y-auto bg-sky-50/60 p-4 sm:p-6"
                  >
                    <ProspectInfo prospect={prospect} />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                          Calling Data
                        </p>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Select
                          </label>
                          <select
                            value={callForm.select}
                            onChange={(e) =>
                              setCallForm((f) => ({
                                ...f,
                                select: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                          >
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Call Back
                            </label>
                            <select
                              value={callForm.callBack}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  callBack: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
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
                              value={callForm.notInterest}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  notInterest: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                            >
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Department of Sewa
                          </label>
                          <JathaDepartmentSelect
                            value={callForm.departmentOfSewa}
                            onChange={(e) =>
                              setCallForm((f) => ({
                                ...f,
                                departmentOfSewa: e.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                          Transfer Data
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Nominal List Select
                            </label>
                            <select
                              value={callForm.nominalListSelect}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  nominalListSelect: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
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
                              value={callForm.visitSelect}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  visitSelect: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
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
                              value={callForm.freeSewa}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  freeSewa: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
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
                              value={callForm.attendance}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  attendance: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
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
                              value={callForm.jathaRecord}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  jathaRecord: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                            >
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-red-600">
                        Need to Work
                      </label>
                      <textarea
                        value={callForm.needToWork}
                        onChange={(e) =>
                          setCallForm((f) => ({
                            ...f,
                            needToWork: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                      />
                    </div>

                    {/* Notes */}
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-600">
                        Notes
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          ["notes1", "Good Participation"],
                          ["notes2", "Positive"],
                          ["notes3", "VIP Prospect"],
                        ].map(([field, label]) => (
                          <div key={field}>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              {label}
                            </label>
                            <textarea
                              value={callForm[field]}
                              onChange={(e) =>
                                setCallForm((f) => ({
                                  ...f,
                                  [field]: e.target.value,
                                }))
                              }
                              rows={3}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                          Jatha Details
                        </p>
                        <button
                          type="button"
                          onClick={addJatha}
                          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                        >
                          Add Jatha
                        </button>
                      </div>
                      {callForm.jathaDetails.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No jatha details added yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {callForm.jathaDetails.map((j, index) => (
                            <div
                              key={index}
                              className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-5"
                            >
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">
                                  Area Name
                                </label>
                                <JathaAreaSelect
                                  value={j.areaName || ""}
                                  onChange={(e) =>
                                    updateJatha(
                                      index,
                                      "areaName",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">
                                  Department Name
                                </label>
                                <JathaDepartmentSelect
                                  value={j.departmentName || ""}
                                  onChange={(e) =>
                                    updateJatha(
                                      index,
                                      "departmentName",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">
                                  Total Days
                                </label>
                                <input
                                  type="text"
                                  value={j.jathaTotalDay || ""}
                                  onChange={(e) =>
                                    updateJatha(
                                      index,
                                      "jathaTotalDay",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">
                                  Date From
                                </label>
                                <input
                                  type="date"
                                  value={j.dateFrom || ""}
                                  onChange={(e) =>
                                    updateJatha(
                                      index,
                                      "dateFrom",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">
                                  Date To
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={j.dateTo || ""}
                                    onChange={(e) =>
                                      updateJatha(
                                        index,
                                        "dateTo",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeJatha(index)}
                                    className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditCallLog(null)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={callFormSubmitting}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {callFormSubmitting ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}
        {/* Tabs */}
        <div className="mt-3 flex flex-col gap-2 sm:mt-6 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/50 p-0.5 sm:w-auto sm:rounded-lg sm:p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("all");
                  setSelectedIds(new Set());
                }}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition sm:flex-initial sm:px-4 sm:py-2 sm:gap-2 sm:text-sm ${
                  activeTab === "all"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <span className="truncate">All Sewadars</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("assigned");
                  setSelectedIds(new Set());
                }}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition sm:flex-initial sm:px-4 sm:py-2 sm:gap-2 sm:text-sm ${
                  activeTab === "assigned"
                    ? "bg-sky-100 text-sky-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="truncate sm:hidden">Assigned</span>
                <span className="hidden truncate sm:inline">
                  Assigned to Users
                </span>
              </button>
            </div>
            {activeTab === "assigned" && assignedUsers.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <label className="text-sm font-medium text-sky-800">
                  Show:
                </label>
                <select
                  value={assignedFilterUser}
                  onChange={(e) => setAssignedFilterUser(e.target.value)}
                  className="rounded-md border border-sky-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                >
                  <option value="">All assigned sewadars</option>
                  {assignedUsers.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Assign bar — appears when one or more prospects are selected */}
        {selectedIds.size > 0 && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 sm:mt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4 sm:py-3">
            <span className="text-xs font-medium text-sky-900 sm:text-sm">
              {selectedIds.size} selected
            </span>
            <select
              value={assignToUser}
              onChange={(e) => setAssignToUser(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-400 sm:w-auto sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm"
              aria-label="Assign or unassign"
            >
              <option value="">Choose action…</option>
              <option value="__UNASSIGN__">Unassign</option>
              {assignableUsers.length > 0 ? (
                <optgroup label="Assign to user">
                  {assignableUsers.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </optgroup>
              ) : (
                <option value="" disabled>
                  No users — add users from Dashboard
                </option>
              )}
            </select>
            <div className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:gap-2">
              <button
                type="button"
                onClick={handleAssign}
                disabled={
                  !assignToUser ||
                  assigning ||
                  (assignToUser !== "__UNASSIGN__" &&
                    assignableUsers.length === 0)
                }
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition disabled:opacity-60 sm:flex-initial sm:rounded-lg sm:px-4 sm:py-2 sm:text-sm ${
                  assignToUser === "__UNASSIGN__"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-slate-800 hover:bg-slate-900"
                }`}
              >
                {assigning
                  ? assignToUser === "__UNASSIGN__"
                    ? "Unassigning…"
                    : "Assigning…"
                  : assignToUser === "__UNASSIGN__"
                    ? "Unassign"
                    : "Assign"}
              </button>
              <button
                type="button"
                onClick={openBulkDeleteConfirm}
                disabled={deleting}
                className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-700 disabled:opacity-60 sm:flex-initial sm:rounded-lg sm:px-4 sm:py-2 sm:text-sm"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setAssignToUser("");
                  setError("");
                }}
                className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 sm:flex-initial sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Add Prospect Modal */}
        {addModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-prospect-title"
            onClick={closeAddModal}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2
                    id="add-prospect-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    Add Sewadar Details
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Fill in the details for the new sewadar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
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
                onSubmit={handleSubmitProspect}
                className="flex-1 overflow-y-auto px-5 py-4"
              >
                {/* Badge & Profile Details */}
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-600">
                  Badge Status
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Badge Status
                    </label>
                    <select
                      value={addForm.badgeStatus}
                      onChange={updateAddForm("badgeStatus")}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="N/A">N/A</option>
                      <option value="Open">Open</option>
                      <option value="Permanent">Permanent</option>
                      <option value="Elderly">Elderly</option>
                      <option value="Sangat">Sangat</option>
                      <option value="New Prospects">Open New Sewadar</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-red-600">
                      Name of Sewadar/Sewadarni *
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.name}
                      onChange={updateAddForm("name")}
                      placeholder="Full name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Father&apos;s/Husband&apos;s Name
                    </label>
                    <input
                      type="text"
                      value={addForm.fathersName}
                      onChange={updateAddForm("fathersName")}
                      placeholder="Father's or Husband's name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Badge ID
                    </label>
                    <input
                      type="text"
                      value={addForm.badgeId}
                      onChange={updateAddForm("badgeId")}
                      placeholder="Enter badge ID"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Mobile Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={addForm.mobileNumber}
                      onChange={updateAddForm("mobileNumber")}
                      placeholder="e.g., 9876543210"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Gender (M/F)
                    </label>
                    <div className="flex gap-4 pt-2">
                      {["Male", "Female", "Other"].map((opt) => (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <input
                            type="radio"
                            name="gender"
                            value={opt}
                            checked={addForm.gender === opt}
                            onChange={updateAddFormRadio("gender")}
                            className="text-slate-700"
                          />
                          <span className="text-sm text-slate-600">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Age
                    </label>
                    <input
                      type="text"
                      value={addForm.age}
                      readOnly
                      placeholder="Age (auto-calculated)"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Aadhar No
                    </label>
                    <input
                      type="text"
                      value={addForm.aadharNumber}
                      onChange={updateAddForm("aadharNumber")}
                      placeholder="12-digit Aadhar number"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Department Finalised Name
                    </label>
                    <input
                      type="text"
                      value={addForm.departmentName}
                      onChange={updateAddForm("departmentName")}
                      placeholder="Department name"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={addForm.dateOfBirth}
                      onChange={({ target: { value } }) => {
                        setAddForm((f) => ({
                          ...f,
                          dateOfBirth: value,
                          age: calculateAgeFromDob(value),
                        }));
                      }}
                      max={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Emergency Contact
                    </label>
                    <input
                      type="text"
                      value={addForm.emergencyContact}
                      onChange={updateAddForm("emergencyContact")}
                      placeholder="Emergency contact"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Blood Group
                    </label>
                    <input
                      type="text"
                      value={addForm.bloodgroup}
                      onChange={updateAddForm("bloodgroup")}
                      placeholder="e.g., A+, B-, O+, AB+"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Marital Status
                    </label>
                    <select
                      value={addForm.maritalStatus}
                      onChange={updateAddForm("maritalStatus")}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="N/A">N/A</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      R/O Village/Town/Locality/District
                    </label>
                    <input
                      type="text"
                      value={addForm.locality}
                      onChange={updateAddForm("locality")}
                      placeholder="e.g., Model Town, Ludhiana"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                      Address
                    </p>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Permanent Address
                    </label>
                    <textarea
                      value={addForm.permanentAddress}
                      onChange={updateAddForm("permanentAddress")}
                      placeholder="Permanent address (if different from residential)"
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                </div>

                {/* Naam Dan Details */}
                <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Naam Dan Details
                </p>
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Has the prospect been initiated?
                      </label>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Indicate if Naam Dan has been received.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={addForm.initiated}
                      onClick={() =>
                        setAddForm((f) => ({ ...f, initiated: !f.initiated }))
                      }
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                        addForm.initiated ? "bg-sky-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          addForm.initiated ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                  {addForm.initiated && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Date of Initiation (DOI)
                        </label>
                        <input
                          type="date"
                          value={addForm.dateOfInitiation}
                          onChange={updateAddForm("dateOfInitiation")}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Initiation By
                        </label>
                        <input
                          type="text"
                          value={addForm.initiationBy}
                          onChange={updateAddForm("initiationBy")}
                          placeholder="Name of initiator"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Initiation Place
                        </label>
                        <input
                          type="text"
                          value={addForm.initiationPlace}
                          onChange={updateAddForm("initiationPlace")}
                          placeholder="Location of initiation"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSubmitting}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
                  >
                    Submit Prospect
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Call Log (filled calling form) */}
        {viewCallLog &&
          (() => {
            const { prospect, log } = viewCallLog;
            let jathas = [];
            try {
              jathas =
                typeof log.jathaDetails === "string"
                  ? JSON.parse(log.jathaDetails || "[]")
                  : log.jathaDetails || [];
            } catch {
              jathas = [];
            }

            const handleDownload = () => {
              generateCallingFormPDF({
                prospect,
                doc: prospect.raw || {},
                form: log,
                submittedBy: log.submittedBy || "",
                fileName: `call_form_${prospect.badgeId || prospect.id}.pdf`,
              });
            };

            const yesNoChip = (val) => {
              if (!val || val === "-")
                return <span className="text-slate-400">—</span>;
              if (val === "Yes")
                return (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Yes
                  </span>
                );
              if (val === "No")
                return (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    No
                  </span>
                );
              if (val === "N/A")
                return (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                    N/A
                  </span>
                );
              return <span className="text-sm text-slate-800">{val}</span>;
            };

            return (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
                role="dialog"
                aria-modal="true"
                onClick={() => setViewCallLog(null)}
              >
                <div
                  className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewCallLog(null)}
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
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
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      Back
                    </button>
                    <div className="flex flex-col items-center">
                      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                        {prospect.name}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Calling Form — View
                      </p>
                    </div>
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      PDF
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto bg-sky-50/60 p-4 sm:p-6">
                    {/* Sewadar info via shared component */}
                    <ProspectInfo prospect={prospect} />

                    {/* Calling Data + Transfer Data side by side */}
                    <div className="mb-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                          Calling Data Select Option
                        </p>
                        <dl className="space-y-2">
                          {[
                            ["Select", log.select],
                            ["Call Back", log.callBack],
                            ["Not Interest", log.notInterest],
                            ["Dept of Sewa", log.departmentOfSewa],
                          ].map(([label, val]) => (
                            <div
                              key={label}
                              className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                            >
                              <dt className="text-xs font-medium text-slate-500">
                                {label}
                              </dt>
                              <dd>{yesNoChip(val)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                          Transfer Data
                        </p>
                        <dl className="space-y-2">
                          {[
                            ["Nominal List", log.nominalListSelect],
                            ["Visit Select", log.visitSelect],
                            ["Ferry Sewa", log.freeSewa],
                            ["Attendance", log.attendance],
                            ["Jatha Record", log.jathaRecord],
                          ].map(([label, val]) => (
                            <div
                              key={label}
                              className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                            >
                              <dt className="text-xs font-medium text-slate-500">
                                {label}
                              </dt>
                              <dd>{yesNoChip(val)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>

                    {/* Need to Work */}
                    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-red-600">
                        Need to Work
                      </p>
                      <p className="whitespace-pre-line rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {log.needToWork || (
                          <span className="text-slate-400 italic">
                            Nothing noted
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Notes */}
                    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                        Notes
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          ["Good Participation", log.notes1],
                          ["Positive", log.notes2],
                          ["VIP Prospect", log.notes3],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {label}
                            </p>
                            <p className="min-h-[3rem] rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-sm text-slate-700">
                              {val || (
                                <span className="text-slate-300 italic">—</span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Jatha Details */}
                    {Array.isArray(jathas) && jathas.length > 0 && (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
                          Jatha Details
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                                <th className="px-3 py-2 font-semibold">#</th>
                                <th className="px-3 py-2 font-semibold">
                                  Area
                                </th>
                                <th className="px-3 py-2 font-semibold">
                                  Department
                                </th>
                                <th className="px-3 py-2 font-semibold">
                                  Days
                                </th>
                                <th className="px-3 py-2 font-semibold">
                                  From
                                </th>
                                <th className="px-3 py-2 font-semibold">To</th>
                              </tr>
                            </thead>
                            <tbody>
                              {jathas.map((j, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-slate-100 hover:bg-slate-50/50"
                                >
                                  <td className="px-3 py-2 text-xs text-slate-400">
                                    {i + 1}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    {j.areaName || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {j.departmentName || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {j.jathaTotalDay || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {j.dateFrom || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {j.dateTo || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Submitted-by footer */}
                    <div className="mt-2 rounded-lg border border-slate-100 bg-white px-4 py-3">
                      <p className="text-xs text-slate-500">
                        Submitted by{" "}
                        <span className="font-medium text-slate-700">
                          {log.submittedBy || "—"}
                        </span>
                        {log.$createdAt && (
                          <>
                            {" "}
                            ·{" "}
                            {new Date(log.$createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="delete-confirm-title"
                className="text-lg font-semibold text-slate-900"
              >
                {deleteConfirm.type === "single"
                  ? "Delete sewadar?"
                  : `Delete ${deleteConfirm.count} sewadar(s)?`}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {deleteConfirm.type === "single"
                  ? "This sewadar will be removed permanently. This cannot be undone."
                  : "These sewadars will be removed permanently. This cannot be undone."}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table / Cards */}
        <div
          className={`mt-3 overflow-x-auto rounded-lg sm:overflow-visible sm:rounded-xl sm:mt-4 ${activeTab === "assigned" ? "border-2 border-sky-200 bg-sky-50/30 p-2 sm:p-4" : ""}`}
          style={{ clipPath: "none" }}
        >
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
              <p className="text-sm text-slate-500">Loading prospects…</p>
            </div>
          ) : filteredProspects.length === 0 ? (
            <div
              className={`rounded-lg px-6 py-12 text-center ${activeTab === "assigned" ? "border-2 border-dashed border-sky-200 bg-sky-50/50" : "border border-dashed border-slate-200 bg-slate-50/50"}`}
            >
              <p className="text-sm font-medium text-slate-600">
                {activeTab === "assigned"
                  ? "No prospects assigned yet"
                  : "No prospects yet"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {activeTab === "assigned"
                  ? "Go to All Prospects, select prospects, choose a user, and click Assign. They will appear here."
                  : "Import an Excel file or add a prospect to get started."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="flex flex-col gap-2 md:hidden">
                {filteredProspects.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedIds.size >= filteredProspects.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                    />
                    Select all
                  </label>
                )}
                {filteredProspects.map((p, idx) => (
                  <div
                    key={String(p.id ?? idx)}
                    className={`flex items-start gap-2 rounded-lg border p-2 transition sm:gap-3 sm:p-3 ${
                      selectedIds.has(p.id)
                        ? "border-sky-300 bg-sky-50/50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-700 focus:ring-slate-400 sm:mt-1 sm:h-5 sm:w-5"
                      aria-label={`Select ${p.name || "prospect"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 sm:text-base">
                        {p.name || "-"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {p.address || "-"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                        <svg
                          className="h-3 w-3 shrink-0 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
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
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                        <span>ID:{p.badgeId || "-"}</span>
                        <span>•</span>
                        <span>{p.assignedTo || "-"}</span>
                        <span>•</span>
                        <span>{p.bloodGroup || "-"}</span>
                        <span>•</span>
                        {prospectsWithCallLog.has(p.id) ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            <svg
                              className="h-2.5 w-2.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Form Filled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <svg
                              className="h-2.5 w-2.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {prospectsWithCallLog.has(p.id) && (
                        <button
                          type="button"
                          onClick={() => openCallLogForProspect(p)}
                          className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                        >
                          View Form
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditCallLogForProspect(p)}
                        className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Edit Form
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteConfirm(p.id)}
                        disabled={deleting}
                        className="shrink-0 rounded p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Delete ${p.name || "prospect"}`}
                      >
                        <svg
                          className="h-4 w-4 sm:h-5 sm:w-5"
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
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div
                className="hidden overflow-x-auto overflow-y-visible md:block"
                style={{ clipPath: "none" }}
              >
                <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="w-10 px-2 py-3">
                        <input
                          type="checkbox"
                          checked={
                            filteredProspects.length > 0 &&
                            selectedIds.size >= filteredProspects.length
                          }
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Name of Sewadar/Sewadarni
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Father&apos;s/Husband&apos;s Name
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Gender
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Age
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
                        Assigned To
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Blood Group
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Form Status
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProspects.map((p, idx) => (
                      <tr
                        key={String(p.id ?? idx)}
                        className="border-b border-slate-100 hover:bg-slate-50/50"
                      >
                        <td className="w-10 px-2 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                            aria-label={`Select ${p.name || "prospect"}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {p.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.fatherHusbandName || p.guardian || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.gender || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.age || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.address || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <svg
                              className="h-3.5 w-3.5 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
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
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.badgeId || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.assignedTo || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.bloodGroup || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {prospectsWithCallLog.has(p.id) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <svg
                                className="h-3 w-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Filled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <svg
                                className="h-3 w-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ActionMenu
                            onView={
                              prospectsWithCallLog.has(p.id)
                                ? () => openCallLogForProspect(p)
                                : undefined
                            }
                            onEdit={() => openEditCallLogForProspect(p)}
                            onDelete={() => openDeleteConfirm(p.id)}
                            showViewForm={prospectsWithCallLog.has(p.id)}
                            showEditForm={true}
                            showDeleteProspect={true}
                            isSaving={deleting}
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
      </div>
    </div>
  );
}

export default ProspectsDetailsPage;
