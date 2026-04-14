import { Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwriteClient";

/** Create a new call log (prospect call form submission) */
export async function createCallLog(data) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId) {
    throw new Error("Appwrite call logs collection is not configured.");
  }
  const docId = `calllog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = {
    prospectId: String(data.prospectId ?? "").trim() || "",
    prospectName: String(data.prospectName ?? "").trim() || "",
    submittedBy: String(data.submittedBy ?? "").trim() || "",
    select: String(data.select ?? "").trim() || "",
    callBack: String(data.callBack ?? "").trim() || "",
    notInterest: String(data.notInterest ?? "").trim() || "",
    needToWork: String(data.needToWork ?? "").trim() || "",
    notes1: String(data.notes1 ?? "").trim() || "",
    notes2: String(data.notes2 ?? "").trim() || "",
    notes3: String(data.notes3 ?? "").trim() || "",
    nominalListSelect: String(data.nominalListSelect ?? "").trim() || "",
    visitSelect: String(data.visitSelect ?? "").trim() || "",
    freeSewa: String(data.freeSewa ?? "").trim() || "",
    departmentOfSewa: String(data.departmentOfSewa ?? "").trim() || "",
    attendance: String(data.attendance ?? "").trim() || "",
    jathaRecord: String(data.jathaRecord ?? "").trim() || "",
    jathaDetails:
      typeof data.jathaDetails === "string"
        ? data.jathaDetails
        : JSON.stringify(data.jathaDetails || []),
  };
  const created = await databases.createDocument(
    databaseId,
    callLogsCollectionId,
    docId,
    payload,
  );
  return created;
}

/** List all call logs (for admin) */
export async function listCallLogs() {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId) {
    return { documents: [], total: 0 };
  }
  try {
    const response = await databases.listDocuments(
      databaseId,
      callLogsCollectionId,
      [Query.orderDesc("$createdAt")],
    );
    return response;
  } catch (error) {
    console.error("Failed to list call logs", error);
    return { documents: [], total: 0 };
  }
}

/** Fetch every call log (paginated). Use for admin export. */
export async function listAllCallLogs() {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId) {
    return [];
  }
  const limit = 100;
  const all = [];
  let offset = 0;
  try {
    while (true) {
      const response = await databases.listDocuments(
        databaseId,
        callLogsCollectionId,
        [
          Query.orderDesc("$createdAt"),
          Query.limit(limit),
          Query.offset(offset),
        ],
      );
      const batch = response.documents || [];
      all.push(...batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    return all;
  } catch (error) {
    console.error("Failed to list all call logs", error);
    return all;
  }
}

/** List call logs submitted by a specific user (for user dashboard) */
export async function listCallLogsForUser(submittedBy) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId || !submittedBy) {
    return { documents: [], total: 0 };
  }
  try {
    const response = await databases.listDocuments(
      databaseId,
      callLogsCollectionId,
      [Query.equal("submittedBy", submittedBy), Query.orderDesc("$createdAt")],
    );
    return response;
  } catch (error) {
    console.error("Failed to list call logs for user (indexed query):", error);
    // Fallback: fetch all and filter client-side (in case submittedBy index missing)
    try {
      const response = await databases.listDocuments(
        databaseId,
        callLogsCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(500)],
      );
      const filtered = (response.documents || []).filter(
        (d) =>
          String(d.submittedBy || "").trim() === String(submittedBy).trim(),
      );
      return { documents: filtered, total: filtered.length };
    } catch (fallbackError) {
      console.error("Fallback list call logs failed:", fallbackError);
      return { documents: [], total: 0 };
    }
  }
}

/** List call logs for a particular prospect (for admin view per prospect) */
export async function listCallLogsForProspect(prospectId) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId || !prospectId) {
    return { documents: [], total: 0 };
  }
  try {
    const response = await databases.listDocuments(
      databaseId,
      callLogsCollectionId,
      [Query.equal("prospectId", prospectId), Query.orderDesc("$createdAt")],
    );
    return response;
  } catch (error) {
    console.error(
      "Failed to list call logs for prospect (indexed query):",
      error,
    );
    // Fallback: fetch recent and filter client-side (in case prospectId index missing)
    try {
      const response = await databases.listDocuments(
        databaseId,
        callLogsCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(500)],
      );
      const filtered = (response.documents || []).filter(
        (d) => String(d.prospectId || "").trim() === String(prospectId).trim(),
      );
      return { documents: filtered, total: filtered.length };
    } catch (fallbackError) {
      console.error(
        "Fallback list call logs for prospect failed:",
        fallbackError,
      );
      return { documents: [], total: 0 };
    }
  }
}

/** List call logs with nominalListSelect = 'Yes' (for Nominal Roll) */
export async function listCallLogsWithNominalList() {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId) {
    return { documents: [], total: 0 };
  }
  try {
    const response = await databases.listDocuments(
      databaseId,
      callLogsCollectionId,
      [Query.equal("nominalListSelect", "Yes"), Query.orderDesc("$createdAt")],
    );
    return response;
  } catch (error) {
    console.error("Failed to list call logs with nominal list:", error);
    try {
      const response = await databases.listDocuments(
        databaseId,
        callLogsCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(500)],
      );
      const filtered = (response.documents || []).filter(
        (d) =>
          String(d.nominalListSelect || "")
            .trim()
            .toLowerCase() === "yes",
      );
      return { documents: filtered, total: filtered.length };
    } catch (fallbackError) {
      console.error("Fallback nominal list failed:", fallbackError);
      return { documents: [], total: 0 };
    }
  }
}

/** List call logs with visitSelect = 'Yes' (for Visit Data) */
export async function listCallLogsWithVisitYes() {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId) {
    return { documents: [], total: 0 };
  }
  try {
    const response = await databases.listDocuments(
      databaseId,
      callLogsCollectionId,
      [Query.equal("visitSelect", "Yes"), Query.orderDesc("$createdAt")],
    );
    return response;
  } catch (error) {
    console.error("Failed to list call logs with visitSelect = Yes:", error);
    try {
      const response = await databases.listDocuments(
        databaseId,
        callLogsCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(500)],
      );
      const filtered = (response.documents || []).filter(
        (d) =>
          String(d.visitSelect || "")
            .trim()
            .toLowerCase() === "yes",
      );
      return { documents: filtered, total: filtered.length };
    } catch (fallbackError) {
      console.error("Fallback visitSelect list failed:", fallbackError);
      return { documents: [], total: 0 };
    }
  }
}

/** List call logs where nominalListSelect = 'Yes' OR visitSelect = 'Yes' (for Jatha Record) */
export async function listCallLogsForJathaRecord() {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId) {
    return { documents: [], total: 0 };
  }
  try {
    const response = await databases.listDocuments(
      databaseId,
      callLogsCollectionId,
      [Query.orderDesc("$createdAt")],
    );
    const docs = response.documents || [];
    const filtered = docs.filter((d) => {
      const nominalYes =
        String(d.nominalListSelect || "")
          .trim()
          .toLowerCase() === "yes";
      const visitYes =
        String(d.visitSelect || "")
          .trim()
          .toLowerCase() === "yes";
      return nominalYes || visitYes;
    });
    return { documents: filtered, total: filtered.length };
  } catch (error) {
    console.error("Failed to list call logs for Jatha record:", error);
    return { documents: [], total: 0 };
  }
}

/** Update an existing call log by ID */
export async function updateCallLog(logId, data) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId || !logId) {
    throw new Error("Appwrite call logs collection is not configured.");
  }
  const updates = {
    select: String(data.select ?? "").trim() || "",
    callBack: String(data.callBack ?? "").trim() || "",
    notInterest: String(data.notInterest ?? "").trim() || "",
    needToWork: String(data.needToWork ?? "").trim() || "",
    notes1: String(data.notes1 ?? "").trim() || "",
    notes2: String(data.notes2 ?? "").trim() || "",
    notes3: String(data.notes3 ?? "").trim() || "",
    nominalListSelect: String(data.nominalListSelect ?? "").trim() || "",
    visitSelect: String(data.visitSelect ?? "").trim() || "",
    freeSewa: String(data.freeSewa ?? "").trim() || "",
    departmentOfSewa: String(data.departmentOfSewa ?? "").trim() || "",
    attendance: String(data.attendance ?? "").trim() || "",
    jathaRecord: String(data.jathaRecord ?? "").trim() || "",
    jathaDetails:
      typeof data.jathaDetails === "string"
        ? data.jathaDetails
        : JSON.stringify(data.jathaDetails || []),
  };
  const updated = await databases.updateDocument(
    databaseId,
    callLogsCollectionId,
    logId,
    updates,
  );
  return updated;
}

/** Delete a call log document */
export async function deleteCallLog(logId) {
  const { databaseId, callLogsCollectionId } = APPWRITE_CONFIG;
  if (!databaseId || !callLogsCollectionId || !logId) {
    throw new Error("Appwrite call logs collection is not configured.");
  }
  await databases.deleteDocument(databaseId, callLogsCollectionId, logId);
}

/**
 * Remove all call logs associated with a given prospect.
 * This is useful when a prospect record is deleted from the system;
 * any orphaned logs should be cleaned up so they don’t appear on
 * dashboards (even though most views already filter by existing
 * prospects).
 */
export async function deleteCallLogsForProspect(prospectId) {
  if (!prospectId) return;
  try {
    const res = await listCallLogsForProspect(prospectId);
    const docs = res.documents || [];
    for (const d of docs) {
      if (d.$id) {
        await deleteCallLog(d.$id);
      }
    }
  } catch (err) {
    console.error("Failed to delete call logs for prospect", prospectId, err);
  }
}

/**
 * Bulk version to remove logs for multiple prospects.  Loops serially
 * to avoid hammering Appwrite; the caller may await the promise.
 */
export async function deleteCallLogsForProspects(prospectIds) {
  if (!Array.isArray(prospectIds) || prospectIds.length === 0) return;
  for (const id of prospectIds) {
    // eslint-disable-next-line no-await-in-loop
    await deleteCallLogsForProspect(id);
  }
}
