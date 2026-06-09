import { jsPDF } from "jspdf";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  headerBg:   [15,  23,  42],   // slate-900
  accent:     [8,  145, 178],   // cyan-600
  accentDark: [6,  103, 133],
  white:      [255, 255, 255],
  label:      [100, 116, 139],  // slate-500
  value:      [15,  23,  42],   // slate-900
  border:     [203, 213, 225],  // slate-300
  rowAlt:     [248, 250, 252],  // slate-50
  rowWhite:   [255, 255, 255],
  divider:    [226, 232, 240],  // slate-200
};

const rgb  = (arr)   => arr;
const fill = (pdf, c) => pdf.setFillColor(...rgb(c));
const draw = (pdf, c) => pdf.setDrawColor(...rgb(c));
const text = (pdf, c) => pdf.setTextColor(...rgb(c));

// ── Page constants ────────────────────────────────────────────────────────────
const MX = 12;   // horizontal margin mm

// ── Low-level helpers ─────────────────────────────────────────────────────────
function checkPage(pdf, y, needed, pageH) {
  if (y + needed > pageH - 14) {
    pdf.addPage();
    return 15;
  }
  return y;
}

function sectionHeader(pdf, title, y, pageW, pageH) {
  y = checkPage(pdf, y, 10, pageH);
  const MW = pageW - MX * 2;
  fill(pdf, C.accent);
  draw(pdf, C.accent);
  pdf.rect(MX, y, MW, 6.5, "F");
  text(pdf, C.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(title.toUpperCase(), MX + 3, y + 4.5);
  return y + 8;
}

/** Draw a labelled field cell at (x, y) with given width and height. */
function fieldCell(pdf, x, y, w, h, label, value) {
  fill(pdf, C.rowAlt);
  draw(pdf, C.border);
  pdf.rect(x, y, w, h, "FD");
  text(pdf, C.label);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text(String(label), x + 2, y + 3.5);
  text(pdf, C.value);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const val    = String(value || "-");
  const fitted = pdf.splitTextToSize(val, w - 4)[0] ?? val;
  pdf.text(fitted, x + 2, y + 8.5);
}

/** Render a group of [label, value] pairs in an n-column grid. Returns new y. */
function fieldGrid(pdf, fields, y, pageW, pageH, cols = 4) {
  const MW   = pageW - MX * 2;
  const colW = MW / cols;
  const rowH = 11;
  let   col  = 0;
  let   rowY = y;

  for (const item of fields) {
    const span  = item.span  ?? 1;
    const label = item.label ?? item[0];
    const value = item.value ?? item[1];
    const w     = colW * span - 0.5;
    const x     = MX + col * colW;

    rowY = checkPage(pdf, rowY, rowH, pageH);
    fieldCell(pdf, x, rowY, w, rowH, label, value);

    col += span;
    if (col >= cols) { col = 0; rowY += rowH + 0.5; }
  }
  if (col > 0) rowY += rowH + 0.5;
  return rowY + 2;
}

/** Key-value list inside a bordered box (2-column label: value layout). Returns new y. */
function kvList(pdf, items, y, x, w, pageH) {
  const rowH = 7;
  draw(pdf, C.border);
  for (let i = 0; i < items.length; i++) {
    const [label, value] = items[i];
    y = checkPage(pdf, y, rowH, pageH);
    fill(pdf, i % 2 === 0 ? C.rowWhite : C.rowAlt);
    pdf.rect(x, y, w, rowH, "FD");
    text(pdf, C.label);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(String(label) + ":", x + 2, y + 4.8);
    text(pdf, C.value);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const val     = String(value || "-");
    const fitted  = pdf.splitTextToSize(val, w - 42)[0] ?? val;
    pdf.text(fitted, x + 38, y + 4.8);
    y += rowH;
  }
  return y + 3;
}

/** Wrapping text block inside a bordered box. Returns new y. */
function textBox(pdf, content, y, pageW, pageH) {
  const MW  = pageW - MX * 2;
  const str = String(content || "-");
  const lines = pdf.splitTextToSize(str, MW - 6);
  const h   = Math.max(lines.length * 5 + 6, 12);
  y = checkPage(pdf, y, h + 4, pageH);
  fill(pdf, C.rowAlt);
  draw(pdf, C.border);
  pdf.rect(MX, y, MW, h, "FD");
  text(pdf, C.value);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  lines.forEach((line, i) => pdf.text(line, MX + 3, y + 5 + i * 5));
  return y + h + 3;
}

/** Jatha details table. Returns new y. */
function jathaTable(pdf, jathas, y, pageW, pageH) {
  const MW = pageW - MX * 2;
  const cols = [
    { label: "#",           w: 8  },
    { label: "Area",        w: 40 },
    { label: "Department",  w: 45 },
    { label: "Days",        w: 16 },
    { label: "From",        w: 35.5 },
    { label: "To",          w: 35.5 },
  ];
  const rowH = 7.5;
  const headH = 8;

  // Header row
  y = checkPage(pdf, y, headH + rowH, pageH);
  let cx = MX;
  fill(pdf, C.accentDark);
  draw(pdf, C.accentDark);
  pdf.rect(MX, y, MW, headH, "F");
  text(pdf, C.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  cols.forEach(({ label, w }) => {
    pdf.text(label, cx + 2, y + 5.5);
    cx += w;
  });
  y += headH;

  // Data rows
  jathas.forEach((j, i) => {
    y = checkPage(pdf, y, rowH, pageH);
    cx = MX;
    fill(pdf, i % 2 === 0 ? C.rowWhite : C.rowAlt);
    draw(pdf, C.border);
    pdf.rect(MX, y, MW, rowH, "FD");
    text(pdf, C.value);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    const cells = [
      String(i + 1),
      j.areaName       || "-",
      j.departmentName || "-",
      j.jathaTotalDay  || "-",
      j.dateFrom       || "-",
      j.dateTo         || "-",
    ];
    cols.forEach(({ w }, ci) => {
      const fitted = pdf.splitTextToSize(cells[ci], w - 3)[0] ?? cells[ci];
      pdf.text(fitted, cx + 2, y + 5);
      cx += w;
    });
    y += rowH;
  });
  return y + 3;
}

/** Add footer to every page (page number + submitter). */
function addFooters(pdf, submittedBy, pageW, pageH) {
  const total = pdf.internal.pages.length - 1;
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    fill(pdf, C.headerBg);
    pdf.rect(0, pageH - 10, pageW, 10, "F");
    text(pdf, [148, 163, 184]); // slate-400
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(
      `Submitted by: ${submittedBy || "—"}  |  ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      MX, pageH - 4.5,
    );
    pdf.text(`Page ${i} / ${total}`, pageW - MX, pageH - 4.5, { align: "right" });
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Generate and download a calling-form PDF.
 *
 * @param {object} opts
 * @param {object} opts.prospect  - docToDisplay object (has .name, .badgeId, etc.)
 * @param {object} opts.doc       - raw Appwrite prospect document (optional, for extra fields)
 * @param {object} opts.form      - call log fields (select, callBack, jathaDetails, …)
 * @param {string} opts.submittedBy
 * @param {string} opts.fileName
 */
export function generateCallingFormPDF({ prospect = {}, doc = {}, form = {}, submittedBy = "", fileName }) {
  const pdf   = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Helpers that close over pdf/pageW/pageH
  const pg  = (n)         => checkPage(pdf, n, 10, pageH);
  const sec = (title, y)  => sectionHeader(pdf, title, y, pageW, pageH);
  const grid = (fields, y, cols) => fieldGrid(pdf, fields, y, pageW, pageH, cols);
  const kv   = (items, y, x, w)  => kvList(pdf, items, y, x, w, pageH);
  const box  = (content, y)      => textBox(pdf, content, y, pageW, pageH);

  // Helper to pull a field from doc OR prospect display object
  const get = (field, ...fallbacks) => {
    const sources = [doc, prospect];
    for (const src of sources) {
      for (const f of [field, ...fallbacks]) {
        const v = src?.[f];
        if (v != null && String(v).trim() && String(v).trim() !== "-") return String(v).trim();
      }
    }
    return "";
  };

  let y = 0;
  const MW = pageW - MX * 2;

  // ── HEADER BAR ──────────────────────────────────────────────────────────────
  fill(pdf, C.headerBg);
  pdf.rect(0, 0, pageW, 22, "F");
  fill(pdf, C.accent);
  pdf.rect(0, 22, pageW, 2, "F");

  text(pdf, C.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("CALLING FORM", pageW / 2, 13, { align: "center" });

  text(pdf, [148, 163, 184]);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`Badge: ${get("badgeId", "batchNumber") || "-"}`, MX, 19);
  pdf.text(
    new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    pageW - MX, 19, { align: "right" },
  );
  y = 28;

  // ── SEWADAR INFORMATION ─────────────────────────────────────────────────────
  y = sec("Sewadar Information", y);
  y = grid([
    { label: "Name",            value: get("name", "fullName"),             span: 2 },
    { label: "Badge ID",        value: get("badgeId", "batchNumber"),        span: 1 },
    { label: "Badge Status",    value: get("badgeStatus"),                   span: 1 },
    { label: "Mobile",          value: get("phoneNumber", "mobile"),         span: 1 },
    { label: "Blood Group",     value: get("bloodGroup", "bloodgroup"),      span: 1 },
    { label: "Gender",          value: get("gender"),                        span: 1 },
    { label: "Age",             value: get("age"),                           span: 1 },
    { label: "Date of Birth",   value: get("dateOfBirth"),                   span: 1 },
    { label: "Marital Status",  value: get("maritalStatus"),                 span: 1 },
    { label: "Aadhaar",         value: get("aadhar"),                        span: 1 },
    { label: "Guardian",        value: get("guardian"),                      span: 1 },
    { label: "Emergency",       value: get("emergencyContact"),              span: 1 },
    { label: "Dept Finalised",  value: get("DeptFinalisedName"),             span: 1 },
    { label: "Permanent Address",   value: get("permanentAddress"),          span: 4 },
    { label: "Locality",            value: get("locality"),                  span: 4 },
  ], y, 4);

  // ── NAMDAAN DETAILS ─────────────────────────────────────────────────────────
  const hasDOI = get("NamdaanDOI") || get("namdaanInitiated") || get("NamdaanInitiationBy") || get("NamdaanInitiationPlace");
  if (hasDOI) {
    y = sec("Namdaan Details", y);
    y = grid([
      { label: "DOI",             value: get("NamdaanDOI"),             span: 1 },
      { label: "Initiated",       value: get("namdaanInitiated"),        span: 1 },
      { label: "Initiation By",   value: get("NamdaanInitiationBy"),     span: 1 },
      { label: "Initiation Place",value: get("NamdaanInitiationPlace"),  span: 1 },
    ], y, 4);
  }

  // ── CALLING DATA + TRANSFER DATA (side by side) ─────────────────────────────
  y = pg(y);
  const halfW = (MW - 4) / 2;

  // Left: Calling Data header
  fill(pdf, C.accent);
  draw(pdf, C.accent);
  pdf.rect(MX, y, halfW, 6.5, "F");
  text(pdf, C.white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("CALLING DATA", MX + 3, y + 4.5);

  // Right: Transfer Data header
  fill(pdf, C.accent);
  pdf.rect(MX + halfW + 4, y, halfW, 6.5, "F");
  pdf.text("TRANSFER DATA", MX + halfW + 7, y + 4.5);
  y += 8;

  const callingItems = [
    ["Select",       form.select        || "-"],
    ["Call Back",    form.callBack      || "-"],
    ["Not Interest", form.notInterest   || "-"],
    ["Dept of Sewa", form.departmentOfSewa || "-"],
  ];
  const transferItems = [
    ["Nominal List", form.nominalListSelect || "-"],
    ["Visit Select", form.visitSelect  || "-"],
    ["Ferry Sewa",   form.freeSewa     || "-"],
    ["Attendance",   form.attendance   || "-"],
    ["Jatha Record", form.jathaRecord  || "-"],
  ];

  const leftY  = kv(callingItems,  y, MX,               halfW);
  const rightY = kv(transferItems, y, MX + halfW + 4,   halfW);
  y = Math.max(leftY, rightY) + 2;

  // ── NEED TO WORK ─────────────────────────────────────────────────────────────
  y = sec("Need to Work", y);
  y = box(form.needToWork, y);

  // ── NOTES ───────────────────────────────────────────────────────────────────
  y = sec("Notes", y);
  y = grid([
    { label: "Good Participation", value: form.notes1, span: 2 },
    { label: "Positive",           value: form.notes2, span: 1 },
    { label: "VIP Prospect",       value: form.notes3, span: 1 },
  ], y, 4);

  // ── JATHA DETAILS ───────────────────────────────────────────────────────────
  let jathas = [];
  try {
    jathas = typeof form.jathaDetails === "string"
      ? JSON.parse(form.jathaDetails || "[]")
      : form.jathaDetails || [];
  } catch { jathas = []; }

  if (Array.isArray(jathas) && jathas.length > 0) {
    y = sec("Jatha Details", y);
    y = jathaTable(pdf, jathas, y, pageW, pageH);
  }

  // ── FOOTERS ─────────────────────────────────────────────────────────────────
  addFooters(pdf, submittedBy, pageW, pageH);

  pdf.save(fileName || `calling_form_${get("badgeId", "batchNumber") || "unknown"}.pdf`);
}
