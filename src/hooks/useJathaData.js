import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../services/AuthContext";
import {
  listProspectsAssignedTo,
  listProspects,
  docToDisplay,
} from "../services/prospectsService";
import {
  listCallLogsForJathaRecord,
  updateCallLog,
  deleteCallLog,
} from "../services/callLogsService";

const EMPTY_FORM = {
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
  freeSewa: "",
  attendance: "",
  jathaRecord: "",
};

export function useJathaData(isAdmin = false) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewEntry, setViewEntry] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState(null);

  const loadData = useCallback(async () => {
    if (!isAdmin && !user?.email) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const prospectRes = isAdmin
        ? await listProspects()
        : await listProspectsAssignedTo(user.email);

      const callLogsRes = await listCallLogsForJathaRecord();

      const prospectDocs = prospectRes.documents || [];
      const prospectById = {};
      prospectDocs.forEach((d) => {
        prospectById[d.$id] = docToDisplay(d);
      });

      const logs = callLogsRes.documents || [];

      let list;
      if (isAdmin) {
        list = logs.map((log) => {
          const id = log.prospectId;
          const prospect = prospectById[id] || {
            id,
            name: log.prospectName || "-",
            address: "-",
            phoneNumber: "-",
            badgeId: "-",
            assignedTo: "-",
            bloodGroup: "-",
          };
          return { prospect, log };
        });
      } else {
        const assignedIds = new Set(prospectDocs.map((d) => d.$id));
        list = logs
          .filter((log) => assignedIds.has(log.prospectId))
          .map((log) => {
            const id = log.prospectId;
            const prospect = prospectById[id] || {
              id,
              name: log.prospectName || "-",
              address: "-",
              phoneNumber: "-",
              badgeId: "-",
              assignedTo: "-",
              bloodGroup: "-",
            };
            return { prospect, log };
          });
      }

      setEntries(list);
    } catch (err) {
      setError(err.message || "Failed to load jatha record.");
    } finally {
      setLoading(false);
    }
  }, [user?.email, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEntries = entries.filter(({ prospect, log }) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const fields = [
      prospect.name,
      prospect.badgeId,
      prospect.phoneNumber,
      prospect.address,
      log.submittedBy,
      log.attendance,
    ];
    return fields.some((f) =>
      String(f || "")
        .toLowerCase()
        .includes(q),
    );
  });

  const openEdit = (entry) => {
    const { log } = entry;
    setEditEntry(entry);
    setEditForm({
      select: log.select || "",
      callBack: log.callBack || "",
      notInterest: log.notInterest || "",
      departmentOfSewa: log.departmentOfSewa || "",
      needToWork: log.needToWork || "",
      notes1: log.notes1 || "",
      notes2: log.notes2 || "",
      notes3: log.notes3 || "",
      nominalListSelect: log.nominalListSelect || "",
      visitSelect: log.visitSelect || "",
      freeSewa: log.freeSewa || "",
      attendance: log.attendance || "",
      jathaRecord: log.jathaRecord || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);
    setError("");
    try {
      await updateCallLog(editEntry.log.$id, editForm);
      await loadData();
      setEditEntry(null);
      setEditForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || "Failed to update form.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteEntry) return;
    setSaving(true);
    setError("");
    try {
      await deleteCallLog(deleteEntry.log.$id);
      await loadData();
      setDeleteEntry(null);
    } catch (err) {
      setError(err.message || "Failed to delete form.");
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    error,
    entries,
    searchQuery,
    setSearchQuery,
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
  };
}
