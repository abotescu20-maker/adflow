import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export function calendarEventsRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "calendarEvents");
}

export function calendarEventsQuery(workspaceId: string) {
  return query(calendarEventsRef(workspaceId), orderBy("startDate", "asc"));
}

export interface CreateCalendarEventInput {
  uid: string;
  userName: string;
  color: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // inclusive
}

export async function createCalendarEvent(
  workspaceId: string,
  input: CreateCalendarEventInput
): Promise<string> {
  const ref = await addDoc(calendarEventsRef(workspaceId), {
    workspaceId,
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCalendarEvent(
  workspaceId: string,
  eventId: string
): Promise<void> {
  await deleteDoc(
    doc(db, "workspaces", workspaceId, "calendarEvents", eventId)
  );
}

// --- personal notes (one doc per user per workspace) ---

export function noteRef(workspaceId: string, uid: string) {
  return doc(db, "workspaces", workspaceId, "notes", uid);
}

export async function saveNote(
  workspaceId: string,
  uid: string,
  text: string
): Promise<void> {
  await setDoc(noteRef(workspaceId, uid), {
    uid,
    text,
    updatedAt: serverTimestamp(),
  });
}
