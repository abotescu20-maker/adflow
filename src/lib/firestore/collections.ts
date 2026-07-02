import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Collection } from "@/lib/schema";

export function collectionsRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "collections");
}

export function collectionRef(workspaceId: string, collectionId: string) {
  return doc(db, "workspaces", workspaceId, "collections", collectionId);
}

export function collectionsQuery(workspaceId: string) {
  return query(collectionsRef(workspaceId), orderBy("createdAt", "desc"));
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  icon: string;
  color?: string;
  filters: Collection["filters"];
  pinned?: boolean;
  createdBy: string;
  createdByName: string;
}

export async function createCollection(
  workspaceId: string,
  input: CreateCollectionInput
): Promise<string> {
  const docRef = await addDoc(collectionsRef(workspaceId), {
    workspaceId,
    name: input.name,
    description: input.description ?? null,
    icon: input.icon,
    color: input.color ?? null,
    filters: input.filters,
    pinned: input.pinned ?? false,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCollection(
  workspaceId: string,
  collectionId: string,
  patch: Partial<Omit<Collection, "id" | "workspaceId" | "createdAt">>
): Promise<void> {
  await updateDoc(collectionRef(workspaceId, collectionId), {
    ...(patch as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCollection(
  workspaceId: string,
  collectionId: string
): Promise<void> {
  await deleteDoc(collectionRef(workspaceId, collectionId));
}
