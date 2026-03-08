import React from "react";
import { getAttr } from "../services/prospectsService";

// a reusable snippet showing all the prospect's stored fields in a
// two-column grid.  We sprinkle fallback values from `prospect` (a
// normalized display object) so even if the raw document isn't
// available the UI still has something to render.
export function ProspectInfo({ prospect = {}, doc = {} }) {
  const get = (...keys) => getAttr(doc, ...keys) || "-";
  const name = prospect.name || get("fullName", "name");
  const badgeId =
    prospect.badgeId || get("badgeId", "batchNumber", "batchnumber");
  const phone =
    prospect.phoneNumber || get("mobile", "phoneNumber", "mobileNumber");
  const address = prospect.address || get("address");

  return (
    <>
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
        Prospect Information
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Name
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {name}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Badge ID
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {badgeId}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Badge Status
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("badgeStatus")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Mobile
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {phone}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Blood Group
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("bloodgroup", "bloodGroup")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Gender
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("gender")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Date of Birth
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("dateOfBirth", "dob")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Age
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("age")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Guardian/Father Name
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("guardian", "fatherHusbandName")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Aadhaar
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("aadhar")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Emergency Contact
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("emergencyContact")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
            Dept Finalised Name
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("DeptFinalisedName", "departmentName")}
          </p>
        </div>
      </div>

      {/* address blocks */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-wide">
          Residential Address
        </label>
        <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
          {address}
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-wide">
          Permanent Address
        </label>
        <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
          {get("permanentAddress")}
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-wide">
          R/O Village/Town/Locality/District
        </label>
        <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
          {get("locality")}
        </p>
      </div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-bold text-slate-900 uppercase tracking-wide">
          Marital Status
        </label>
        <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
          {get("maritalStatus")}
        </p>
      </div>

      {/* namdaan details */}
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-red-600">
        Namdaan Details
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">
            DOI
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("NamdaanDOI")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">
            Is Initiated
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("namdaanInitiated", "namdaanInitiated")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">
            Initiation By
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("NamdaanInitiationBy", "initiationBy")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">
            Initiation Place
          </label>
          <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm">
            {get("NamdaanInitiationPlace", "initiationPlace")}
          </p>
        </div>
      </div>
    </>
  );
}
