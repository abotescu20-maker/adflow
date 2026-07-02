import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit as fsLimit,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NotificationKind } from "@/lib/schema";

export function notificationsRef(uid: string) {
  return collection(db, "users", uid, "notifications");
}

export function notificationRef(uid: string, id: string) {
  return doc(db, "users", uid, "notifications", id);
}

export function notificationsQuery(uid: string, max = 30) {
  return query(notificationsRef(uid), orderBy("createdAt", "desc"), fsLimit(max));
}

export function unreadNotificationsQuery(uid: string, max = 30) {
  return query(
    notificationsRef(uid),
    where("read", "==", false),
    orderBy("createdAt", "desc"),
    fsLimit(max)
  );
}

export interface CreateNotificationInput {
  uid: string;
  workspaceId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actorId?: string;
  actorName?: string;
  targetUrl: string;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<string> {
  const docRef = await addDoc(notificationsRef(input.uid), {
    uid: input.uid,
    workspaceId: input.workspaceId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    targetUrl: input.targetUrl,
    read: false,
    readAt: null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function markNotificationRead(uid: string, id: string): Promise<void> {
  await updateDoc(notificationRef(uid, id), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(unreadNotificationsQuery(uid, 200));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true, readAt: serverTimestamp() });
  });
  await batch.commit();
}
