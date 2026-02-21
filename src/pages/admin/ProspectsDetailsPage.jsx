import { useRef, useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  uploadProspectExcel,
  listProspects,
  createProspect,
  createProspectsBulk,
  assignProspectsToUser,
  unassignProspects,
  deleteProspect,
  deleteProspectsBulk,
  docToDisplay,
} from "../../services/prospectsService";
import { listUsers } from "../../services/usersService";
import { listCallLogsForProspect } from "../../services/callLogsService";
import { jsPDF } from "jspdf";

const SEARCH_BY_OPTIONS = [
  "Name of Sewadar/Sewadarni",
  "Address",
  "Phone Number",
  "Badge ID",
  "Assigned To",
  "Blood Group",
];

// --- Excel → Appwrite schema mapping (do not change schema) ---
const SCHEMA_FIELDS = [
  "fullName",
  "address",
  "permanentAddress",
  "mobile",
  "bloodgroup",
  "aadhar",
  "dateOfBirth",
  "age",
  "guardian",
  "badgeId",
  "gender",
  "badgeStatus",
  "emergencyContact",
  "DeptFinalisedName",
  "maritalStatus",
  "locality",
  "assignedTo",
  "NamdaanDOI",
  "namdaanInitiated",
  "NamdaanInitiationBy",
  "NamdaanInitiationPlace",
];

const REQUIRED_IMPORT_FIELDS = ["fullName", "mobile"];

/** Normalize for matching: lowercase, remove spaces and non-alphanumeric */
function normalizeHeader(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Excel column names (and truncated variants) → schema field.
 * Keys are normalized (lowercase, no spaces/special chars).
 * Includes short forms so "Blood Grou", "Aadhaar C", "Date of Bir", "Batch Num", "Dept Finali", "Marita" etc. match.
 */
const EXCEL_HEADER_TO_SCHEMA = {
  name: "fullName",
  nam: "fullName",
  fullname: "fullName",
  prospect: "fullName",
  nameofsewadarsewadarni: "fullName",
  address: "address",
  residentialaddress: "address",
  residentialaddr: "address",
  location: "address",
  addr: "address",
  phone: "mobile",
  mobile: "mobile",
  phoneno: "mobile",
  contact: "mobile",
  bloodgroup: "bloodgroup",
  bloodgrou: "bloodgroup",
  blood: "bloodgroup",
  bg: "bloodgroup",
  aadhaarcard: "aadhar",
  aadhaarc: "aadhar",
  aadhar: "aadhar",
  dateofbirth: "dateOfBirth",
  dateofbir: "dateOfBirth",
  dob: "dateOfBirth",
  age: "age",
  guardianname: "guardian",
  guardian: "guardian",
  fathersname: "guardian",
  batchnumber: "badgeId",
  batchnum: "badgeId",
  batch: "badgeId",
  badgeid: "badgeId",
  badge: "badgeId",
  gender: "gender",
  badgestatus: "badgeStatus",
  badgestat: "badgeStatus",
  emergencycontact: "emergencyContact",
  emergency: "emergencyContact",
  emerg: "emergencyContact",
  deptfinalisedname: "DeptFinalisedName",
  deptfinali: "DeptFinalisedName",
  department: "DeptFinalisedName",
  maritalstatus: "maritalStatus",
  marita: "maritalStatus",
  marital: "maritalStatus",
  rovillagetownlocalitydistrict: "locality",
  locality: "locality",
  village: "locality",
  namdaandoi: "NamdaanDOI",
  namdaaninitiated: "namdaanInitiated",
  namdaaninitiationby: "NamdaanInitiationBy",
  namdaaninitiationplace: "NamdaanInitiationPlace",
  permanentaddress: "permanentAddress",
  permaddr: "permanentAddress",
  permanantaddress: "permanentAddress",
  // assignedTo is never set from import; admin assigns later
};

/** Also match headers that contain these keywords (after normalization) to handle variants like "Namadan Date of Initialisation" */
const KEYWORD_TO_SCHEMA = [
  ["dateofinitialisation", "NamdaanDOI"],
  ["dateofinitiation", "NamdaanDOI"],
  ["namadan", "NamdaanDOI"],
  ["namdaan", "NamdaanDOI"],
  ["doi", "NamdaanDOI"],
  ["initiationby", "NamdaanInitiationBy"],
  ["initiationplace", "NamdaanInitiationPlace"],
  ["initiated", "namdaanInitiated"],
];

function matchExcelHeaderToSchemaField(excelHeader) {
  const normalized = normalizeHeader(excelHeader);
  if (!normalized) return null;

  // 1. Exact normalized match
  if (EXCEL_HEADER_TO_SCHEMA[normalized])
    return EXCEL_HEADER_TO_SCHEMA[normalized];

  // 2. Prefix match: truncated header (e.g. "bloodgrou") is prefix of a known key, or key is prefix of header
  if (normalized.length >= 2) {
    for (const key of Object.keys(EXCEL_HEADER_TO_SCHEMA)) {
      if (key.startsWith(normalized) || normalized.startsWith(key))
        return EXCEL_HEADER_TO_SCHEMA[key];
    }
  }

  // 3. Normalized schema field name equals header
  for (const field of SCHEMA_FIELDS) {
    if (normalizeHeader(field) === normalized) return field;
  }

  // 4. Header contains keyword from KEYWORD_TO_SCHEMA
  for (const [keyword, schemaField] of KEYWORD_TO_SCHEMA) {
    if (normalized.includes(keyword)) return schemaField;
  }

  // 5. Header contains normalized schema field name
  for (const field of SCHEMA_FIELDS) {
    const nf = normalizeHeader(field);
    if (nf && normalized.includes(nf)) return field;
  }

  return null;
}

/** Build auto-mapping: array of length headers.length, each element is schemaField string or null (unmapped) */
function buildAutoMapping(excelHeaders) {
  return excelHeaders.map((h) => matchExcelHeaderToSchemaField(h));
}

/** Parse Excel to raw headers and rows (no schema applied yet) */
function parseExcelFileRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        if (!json.length) {
          resolve({ headers: [], rows: [] });
          return;
        }
        const headers = json[0].map((h) => String(h ?? "").trim());
        const rows = json
          .slice(1)
          .filter((row) =>
            row.some((cell) => cell != null && String(cell).trim()),
          );
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Build prospect objects from raw rows using columnIndex → schemaField mapping. Unmapped columns are skipped. */
function buildProspectsFromMapping(rows, columnMapping) {
  return rows.map((row) => {
    const prospect = {};
    columnMapping.forEach((schemaField, colIndex) => {
      if (!schemaField || schemaField === "__skip__") return;
      const raw = row[colIndex];
      const value = raw == null || raw === "" ? "" : String(raw).trim();
      prospect[schemaField] = value;
    });
    return prospect;
  });
}

function getImportSignature(prospects) {
  const rows = prospects
    .map((p) =>
      [
        p.fullName ?? p.name,
        p.address,
        p.mobile,
        p.badgeId,
        p.assignedTo,
        p.bloodgroup,
      ].join("|"),
    )
    .sort();
  return rows.join("\n");
}

/** Full DB export: all prospect fields (no Appwrite system fields) */
const FULL_EXPORT_COLUMNS = [
  "fullName",
  "address",
  "permanentAddress",
  "mobile",
  "bloodgroup",
  "aadhar",
  "dateOfBirth",
  "age",
  "guardian",
  "badgeId",
  "gender",
  "badgeStatus",
  "emergencyContact",
  "DeptFinalisedName",
  "maritalStatus",
  "locality",
  "assignedTo",
  "NamdaanDOI",
  "namdaanInitiated",
  "NamdaanInitiationBy",
  "NamdaanInitiationPlace",
];

const FULL_EXPORT_HEADERS = {
  fullName: "Name of Sewadar/Sewadarni",
  address: "Residential Address",
  permanentAddress: "Permanent Address",
  mobile: "Phone Number",
  bloodgroup: "Blood Group",
  aadhar: "Aadhar Number",
  dateOfBirth: "Date of Birth",
  age: "Age",
  guardian: "Father's/Husband's Name",
  badgeId: "Badge ID",
  gender: "Gender",
  badgeStatus: "Badge Status",
  emergencyContact: "Emergency Contact Number",
  DeptFinalisedName: "Department Finalised Name",
  maritalStatus: "Marital Status",
  locality: "R/O Village/Town/Locality/District",
  assignedTo: "Assigned To",
  NamdaanDOI: "Date of Initiation (DOI)",
  namdaanInitiated: "Initiated",
  NamdaanInitiationBy: "Initiation By",
  NamdaanInitiationPlace: "Initiation Place",
};

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

function exportToExcelFull(documents) {
  const headers = FULL_EXPORT_COLUMNS.map(
    (key) => FULL_EXPORT_HEADERS[key] || key,
  );
  const rows = documents.map((doc) =>
    FULL_EXPORT_COLUMNS.map((key) => {
      const v = doc[key];
      if (v === undefined || v === null) return "";
      if (typeof v === "string") return v;
      if (v instanceof Date) return v.toISOString();
      return String(v);
    }),
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Prospects");
  XLSX.writeFile(
    wb,
    `prospects_full_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
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
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [callLogAvailability, setCallLogAvailability] = useState({}); // { [prospectId]: boolean }

  const loadProspects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProspects();
      const display = (res.documents || []).map(docToDisplay);
      setProspects(display);
    } catch (err) {
      setError(err.message || "Failed to load prospects.");
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

  useEffect(() => {
    loadProspects();
    loadUsers();
  }, [loadProspects, loadUsers]);

  // Close action menus when clicking outside or pressing Escape
  useEffect(() => {
    const onPointerDown = (e) => {
      if (!e.target.closest("[data-action-menu]")) setMenuOpenId(null);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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

  // Preload call-log availability for visible prospects to make menu responsive
  useEffect(() => {
    const visible = (filteredProspects || [])
      .slice(0, 50)
      .map((p) => p.id)
      .filter(Boolean);
    visible.forEach((id) => {
      // fire-and-forget; checkCallLogAvailability will bail if cached
      checkCallLogAvailability(id);
    });
  }, [filteredProspects]);

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
      setError("Select at least one prospect.");
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
      setError(err.message || "Failed to assign/unassign prospects.");
    } finally {
      setAssigning(false);
    }
  };

  const openDeleteConfirm = (id) => setDeleteConfirm({ type: "single", id });
  const openBulkDeleteConfirm = () => {
    if (selectedIds.size === 0) {
      setError("Select at least one prospect to delete.");
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
        await deleteProspect(deleteConfirm.id);
      } else {
        await deleteProspectsBulk([...selectedIds]);
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
        setError("No submitted calling form found for this prospect.");
        return;
      }
      setViewCallLog({ prospect, log: docs[0] });
    } catch (err) {
      setError(err.message || "Failed to load calling form.");
    }
  };

  const checkCallLogAvailability = async (prospectId) => {
    if (callLogAvailability[prospectId] !== undefined)
      return callLogAvailability[prospectId];
    try {
      const res = await listCallLogsForProspect(prospectId);
      const has = Array.isArray(res.documents) && res.documents.length > 0;
      setCallLogAvailability((s) => ({ ...s, [prospectId]: has }));
      return has;
    } catch (err) {
      setCallLogAvailability((s) => ({ ...s, [prospectId]: false }));
      return false;
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const { headers, rows } = await parseExcelFileRaw(file);
      if (!headers.length || !rows.length) {
        setError("Excel file has no headers or data rows.");
        e.target.value = "";
        return;
      }
      const columnMapping = buildAutoMapping(headers);
      const mappedFields = new Set(columnMapping.filter(Boolean));
      const missingRequired = REQUIRED_IMPORT_FIELDS.filter(
        (r) => !mappedFields.has(r),
      );
      if (missingRequired.length) {
        setError(
          `Required columns not found: ${missingRequired.join(
            ", ",
          )}. Please add columns named "Name of Sewadar/Sewadarni" (prospect name) and "Phone" (or "Mobile") in your Excel.`,
        );
        e.target.value = "";
        return;
      }
      const prospects = buildProspectsFromMapping(rows, columnMapping).map(
        (p) => ({
          ...p,
          assignedTo: "", // leave unassigned; admin will assign later
        }),
      );
      const signature = getImportSignature(prospects);
      if (importedSignatures.has(signature)) {
        setError(
          "This Excel file has already been imported. No duplicate data added.",
        );
        e.target.value = "";
        return;
      }
      await createProspectsBulk(prospects);
      setImportedSignatures((prev) => new Set(prev).add(signature));
      await loadProspects();
    } catch (err) {
      setError(err.message || "Failed to import prospects.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleExportExcel = async () => {
    setError("");
    try {
      const res = await listProspects();
      const docs = res.documents || [];
      if (docs.length === 0) {
        setError("No prospects to export.");
        return;
      }
      exportToExcelFull(docs);
    } catch (err) {
      setError(err.message || "Failed to export prospects.");
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
      setError(err.message || "Failed to add prospect.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setAddForm(INITIAL_ADD_FORM);
  };

  return (
    <div className="space-y-3 px-2 py-3 sm:space-y-5 sm:px-0 sm:py-0">
      <header>
        <h1 className="text-base font-semibold text-slate-900 sm:text-xl">
          Prospects Details
        </h1>
      </header>

      <div className="overflow-hidden rounded-lg bg-white p-2.5 shadow-sm sm:rounded-xl sm:p-4">
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
              Add Prospect
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
              {importing ? "Importing…" : "Import Excel"}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:flex-initial sm:px-4 sm:text-sm"
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
              Export Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

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
                <span className="truncate">All Prospects</span>
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
                  <option value="">All assigned prospects</option>
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
                    Add Prospect Details
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Fill in the details for the new prospect.
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
                      <option value="New Prospects">New Prospects</option>
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
                      onChange={(e) => {
                        const value = e.target.value;
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
                      Residential Address
                    </label>
                    <textarea
                      value={addForm.fullAddress}
                      onChange={updateAddForm("fullAddress")}
                      placeholder="Complete residential address"
                      rows={3}
                      className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
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
              docPdf.text(`Name: ${prospect.name || "-"}`, marginX + 5, y + 15);
              docPdf.text(
                `Badge ID: ${prospect.badgeId || "-"}`,
                marginX + 5,
                y + 21,
              );
              docPdf.text(
                `Phone: ${prospect.phoneNumber || "-"}`,
                marginX + 100,
                y + 15,
              );
              docPdf.text(
                `Address: ${prospect.address || "-"}`,
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
                ["Select", log.select || "-"],
                ["Call Back", log.callBack || "-"],
                ["Not Interest", log.notInterest || "-"],
              ];
              callingData.forEach(([label, value]) => {
                checkNewPage(8);
                docPdf.setFontSize(10);
                docPdf.setFont("helvetica", "normal");
                docPdf.text(`${label}:`, marginX + 5, y);
                docPdf.setFont("helvetica", "bold");
                docPdf.text(value, marginX + 45, y);
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
                ["Nominal List Select", log.nominalListSelect || "-"],
                ["Visit Select", log.visitSelect || "-"],
                ["Free Sewa", log.freeSewa || "-"],
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

              const needToWork = [
                ["Good participation", log.notes1 || "-"],
                ["Positive", log.notes2 || "-"],
                ["VIP prospect", log.notes3 || "-"],
              ];
              needToWork.forEach(([label, value]) => {
                checkNewPage(12);
                docPdf.setFontSize(10);
                docPdf.setFont("helvetica", "bold");
                docPdf.text(`${label}:`, marginX + 5, y);
                docPdf.setFont("helvetica", "normal");
                const valueX = marginX + 45;
                const chunks = docPdf.splitTextToSize(
                  value || "-",
                  maxWidth - (valueX - marginX) - 5,
                );
                // print value chunks starting at an offset so they don't overlap the label
                chunks.forEach((chunk) => {
                  checkNewPage(8);
                  docPdf.text(chunk, valueX, y);
                  y += 7;
                });
                y += 4;
              });
              y += 3;

              // Jatha Details Section
              if (Array.isArray(jathas) && jathas.length > 0) {
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
                jathas.forEach((j, i) => {
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
                  `Submitted by: ${log.submittedBy} | Date: ${new Date(log.$createdAt).toLocaleDateString()}`,
                  pageWidth / 2,
                  pageHeight - 8,
                  { align: "center" },
                );
                docPdf.text(
                  `Page ${i} of ${totalPages}`,
                  pageWidth / 2,
                  pageHeight - 5,
                  { align: "center" },
                );
              }

              docPdf.save(`call_form_${prospect.badgeId || prospect.id}.pdf`);
            };

            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="view-calllog-title"
                onClick={() => setViewCallLog(null)}
              >
                <div
                  className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-red-600 bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                    <div>
                      <h2
                        id="view-calllog-title"
                        className="text-xl font-bold text-white"
                      >
                        Calling Form
                      </h2>
                      <p className="mt-1 text-xs text-red-100">
                        Submitted by{" "}
                        <span className="font-medium">{log.submittedBy}</span> ·{" "}
                        {new Date(log.$createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 rounded-lg border-2 border-white bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:shadow-lg"
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
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewCallLog(null)}
                        className="rounded-lg p-2 text-white transition hover:bg-white/20"
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
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    {/* Prospect Info Card */}
                    <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="rounded-lg bg-red-100 p-2">
                          <svg
                            className="h-5 w-5 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          Prospect Information
                        </h3>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Name
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {prospect.name || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Badge ID
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {prospect.badgeId || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Phone Number
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {prospect.phoneNumber || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Address
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {prospect.address || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Calling Data & Transfer Data Side by Side */}
                    <div className="grid gap-5 md:grid-cols-2">
                      {/* Calling Data Card */}
                      <div className="rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                          <div className="rounded-lg bg-red-600 p-1.5">
                            <svg
                              className="h-4 w-4 text-white"
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
                          </div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-red-600">
                            Calling Data Select Option
                          </h3>
                        </div>
                        <div className="space-y-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              Select
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {log.select || "-"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              Call Back
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {log.callBack || "-"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              Not Interest
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {log.notInterest || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Transfer Data Card */}
                      <div className="rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                          <div className="rounded-lg bg-red-600 p-1.5">
                            <svg
                              className="h-4 w-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                              />
                            </svg>
                          </div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-red-600">
                            Transfer Data
                          </h3>
                        </div>
                        <div className="space-y-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              Nominal List Select
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {log.nominalListSelect || "-"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              Visit Select
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {log.visitSelect || "-"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              Free Sewa
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {log.freeSewa || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Need to Work Card */}
                    <div className="rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="rounded-lg bg-red-600 p-1.5">
                          <svg
                            className="h-4 w-4 text-white"
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
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-red-600">
                          Need to Work
                        </h3>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Good participation
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            {log.notes1 || "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                            Positive
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            {log.notes2 || "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-purple-50 to-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                            VIP prospect
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            {log.notes3 || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Jatha Details Card */}
                    {Array.isArray(jathas) && jathas.length > 0 && (
                      <div className="rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                          <div className="rounded-lg bg-red-600 p-1.5">
                            <svg
                              className="h-4 w-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                          </div>
                          <h3 className="text-sm font-bold uppercase tracking-wider text-red-600">
                            Jatha Details
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b-2 border-red-200 bg-red-50">
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-red-700">
                                  Area Name
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-red-700">
                                  Department
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-red-700">
                                  Days
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-red-700">
                                  Date From
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-red-700">
                                  Date To
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {jathas.map((j, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-slate-100 hover:bg-slate-50"
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                    {j.areaName || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">
                                    {j.departmentName || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">
                                    {j.jathaTotalDay || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">
                                    {j.dateFrom || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">
                                    {j.dateTo || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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
                  ? "Delete prospect?"
                  : `Delete ${deleteConfirm.count} prospect(s)?`}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {deleteConfirm.type === "single"
                  ? "This prospect will be removed permanently. This cannot be undone."
                  : "These prospects will be removed permanently. This cannot be undone."}
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
                {filteredProspects.map((p) => (
                  <div
                    key={p.id}
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
                        {p.phoneNumber || "-"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                        <span>ID:{p.badgeId || "-"}</span>
                        <span>•</span>
                        <span>{p.assignedTo || "-"}</span>
                        <span>•</span>
                        <span>{p.bloodGroup || "-"}</span>
                      </div>
                    </div>
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        data-action-menu="button"
                        onClick={async () => {
                          const next = menuOpenId === p.id ? null : p.id;
                          setMenuOpenId(next);
                          if (next) await checkCallLogAvailability(p.id);
                        }}
                        aria-haspopup="true"
                        aria-expanded={menuOpenId === p.id}
                        className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                        title="Actions"
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {menuOpenId === p.id && (
                        <div
                          data-action-menu="menu"
                          className="absolute right-0 top-full z-20 mt-2 w-40 rounded border bg-white shadow-lg"
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              const has = await checkCallLogAvailability(p.id);
                              setMenuOpenId(null);
                              if (has) openCallLogForProspect(p);
                              else
                                setError(
                                  "No submitted calling form for this prospect.",
                                );
                            }}
                            disabled={!callLogAvailability[p.id]}
                            className={`w-full text-left px-3 py-2 text-sm ${callLogAvailability[p.id] ? "hover:bg-slate-50" : "text-slate-400 cursor-not-allowed"}`}
                          >
                            View Form
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              openDeleteConfirm(p.id);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-slate-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
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
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProspects.map((p) => (
                      <tr
                        key={p.id}
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
                            {p.phoneNumber || "-"}
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
                          <div className="relative">
                            <button
                              type="button"
                              data-action-menu="button"
                              onClick={async () => {
                                const next = menuOpenId === p.id ? null : p.id;
                                setMenuOpenId(next);
                                if (next) await checkCallLogAvailability(p.id);
                              }}
                              aria-haspopup="true"
                              aria-expanded={menuOpenId === p.id}
                              className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                              title="Actions"
                            >
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            {menuOpenId === p.id && (
                              <div
                                data-action-menu="menu"
                                className="absolute right-0 top-full z-20 mt-2 w-40 rounded border bg-white shadow-lg"
                              >
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const has = await checkCallLogAvailability(
                                      p.id,
                                    );
                                    setMenuOpenId(null);
                                    if (has) openCallLogForProspect(p);
                                    else
                                      setError(
                                        "No submitted calling form for this prospect.",
                                      );
                                  }}
                                  disabled={!callLogAvailability[p.id]}
                                  className={`w-full text-left px-3 py-2 text-sm ${callLogAvailability[p.id] ? "hover:bg-slate-50" : "text-slate-400 cursor-not-allowed"}`}
                                >
                                  View Form
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    openDeleteConfirm(p.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-slate-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
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
