import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwriteClient";

const { databaseId, attendanceCollectionId } = APPWRITE_CONFIG;

function toDateTime(date) {
  if (!date) return "";
  if (date.includes("T")) return date;
  return `${date}T00:00:00.000Z`;
}

export function toDateOnly(date) {
  return String(date || "").slice(0, 10);
}

function assertConfigured() {
  if (!databaseId || !attendanceCollectionId) {
    throw new Error("Appwrite attendance collection is not configured.");
  }
}

async function listAllAttendance(queries = []) {
  assertConfigured();
  const limit = 100;
  const documents = [];
  let offset = 0;

  while (true) {
    const result = await databases.listDocuments(
      databaseId,
      attendanceCollectionId,
      [...queries, Query.limit(limit), Query.offset(offset)],
    );
    const batch = result.documents || [];
    documents.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return documents;
}

export async function recordAttendance(prospectId, date, status) {
  assertConfigured();
  if (!prospectId || !date || !["Present", "Absent"].includes(status)) {
    throw new Error("Prospect, date, and a valid attendance status are required.");
  }
  const dateTime = toDateTime(date);

  try {
    const existing = await databases.listDocuments(
      databaseId,
      attendanceCollectionId,
      [
        Query.equal("prospectId", prospectId),
        Query.equal("date", dateTime),
        Query.limit(1),
      ],
    );

    if (existing.documents.length > 0) {
      return databases.updateDocument(
        databaseId,
        attendanceCollectionId,
        existing.documents[0].$id,
        { status },
      );
    }

    return databases.createDocument(
      databaseId,
      attendanceCollectionId,
      ID.unique(),
      { prospectId, date: dateTime, status },
    );
  } catch (err) {
    console.error("Error recording attendance", err);
    throw err;
  }
}

export async function getAttendanceForDate(date) {
  if (!date) return [];
  return listAllAttendance([Query.equal("date", toDateTime(date))]);
}

export async function getAllAttendance() {
  return listAllAttendance([Query.orderAsc("date")]);
}

export async function getAttendanceByProspect(prospectId) {
  if (!prospectId) return [];
  return listAllAttendance([
    Query.equal("prospectId", prospectId),
    Query.orderDesc("date"),
  ]);
}
