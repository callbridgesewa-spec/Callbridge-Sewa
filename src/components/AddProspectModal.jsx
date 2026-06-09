import { useState } from "react";
import { createProspect } from "../services/prospectsService";

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

/**
 * Reusable "Add Sewadar" form modal.
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {() => (void|Promise<void>)} onCreated - called after a successful create
 * @param {string} [assignedTo] - if set, the new sewadar is assigned to this email
 */
export function AddProspectModal({ open, onClose, onCreated, assignedTo = "" }) {
  const [addForm, setAddForm] = useState(INITIAL_ADD_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateAddForm = (field) => (e) =>
    setAddForm((f) => ({ ...f, [field]: e.target.value }));
  const updateAddFormRadio = (field) => (e) =>
    setAddForm((f) => ({ ...f, [field]: e.target.value }));

  const close = () => {
    setAddForm(INITIAL_ADD_FORM);
    setError("");
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.mobileNumber.trim()) {
      setError("Name and Mobile Number are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createProspect({ ...addForm, assignedTo: assignedTo || "" });
      setAddForm(INITIAL_ADD_FORM);
      if (onCreated) await onCreated();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add sewadar.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-prospect-title"
      onClick={close}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="add-prospect-title" className="text-lg font-semibold text-slate-900">
              Add Sewadar Details
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Fill in the details for the new sewadar.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Badge & Profile Details */}
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-600">
            Badge Status
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Badge Status</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Badge ID</label>
              <input
                type="text"
                value={addForm.badgeId}
                onChange={updateAddForm("badgeId")}
                placeholder="Enter badge ID"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Mobile Number *</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Gender (M/F)</label>
              <div className="flex gap-4 pt-2">
                {["Male", "Female", "Other"].map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2">
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Age</label>
              <input
                type="text"
                value={addForm.age}
                readOnly
                placeholder="Age (auto-calculated)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Aadhar No</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Date of Birth</label>
              <input
                type="date"
                value={addForm.dateOfBirth}
                onChange={({ target: { value } }) =>
                  setAddForm((f) => ({ ...f, dateOfBirth: value, age: calculateAgeFromDob(value) }))
                }
                max={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Emergency Contact</label>
              <input
                type="text"
                value={addForm.emergencyContact}
                onChange={updateAddForm("emergencyContact")}
                placeholder="Emergency contact"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Blood Group</label>
              <input
                type="text"
                value={addForm.bloodgroup}
                onChange={updateAddForm("bloodgroup")}
                placeholder="e.g., A+, B-, O+, AB+"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Marital Status</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-600">Permanent Address</label>
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
                  Has the sewadar been initiated?
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Indicate if Naam Dan has been received.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={addForm.initiated}
                onClick={() => setAddForm((f) => ({ ...f, initiated: !f.initiated }))}
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">Initiation By</label>
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
              onClick={close}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Sewadar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddProspectModal;
