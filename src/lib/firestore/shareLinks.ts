import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ShareLink } from "@/lib/schema";

export function shareLinksRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "shareLinks");
}

export function shareLinkRef(workspaceId: string, linkId: string) {
  return doc(db, "workspaces", workspaceId, "shareLinks", linkId);
}

export function shareLinksQuery(workspaceId: string) {
  return query(shareLinksRef(workspaceId), orderBy("createdAt", "desc"));
}

function generateToken(): string {
  // URL-safe random token ~128 bits
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CreateShareLinkInput {
  name: string;
  campaignId?: string;
  assetIds?: string[];
  permissions: ShareLink["permissions"];
  expiresAt?: Date;
  allowedEmails?: string[];
  allowedDomains?: string[];
  createdBy: string;
}

export async function createShareLink(
  workspaceId: string,
  input: CreateShareLinkInput
): Promise<{ id: string; token: string }> {
  const token = generateToken();

  const docRef = await addDoc(shareLinksRef(workspaceId), {
    workspaceId,
    campaignId: input.campaignId ?? null,
    assetIds: input.assetIds ?? [],
    token,
    name: input.name,
    permissions: input.permissions,
    passwordHash: null,
    expiresAt: input.expiresAt ?? null,
    allowedEmails: input.allowedEmails ?? [],
    allowedDomains: input.allowedDomains ?? [],
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    viewCount: 0,
    lastViewedAt: null,
    revokedAt: null,
  });

  // Mirror to /publicShares/{token} so public (read-only) resolution is O(1)
  await setDoc(doc(db, "publicShares", token), {
    token,
    workspaceId,
    shareLinkId: docRef.id,
    campaignId: input.campaignId ?? null,
    assetIds: input.assetIds ?? [],
    permissions: input.permissions,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    createdAt: serverTimestamp(),
  });

  return { id: docRef.id, token };
}

export async function revokeShareLink(
  workspaceId: string,
  linkId: string,
  token: string
): Promise<void> {
  await updateDoc(shareLinkRef(workspaceId, linkId), {
    revokedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "publicShares", token), {
    revokedAt: serverTimestamp(),
  });
}

export async function recordShareLinkView(
  workspaceId: string,
  linkId: string
): Promise<void> {
  await updateDoc(shareLinkRef(workspaceId, linkId), {
    viewCount: increment(1),
    lastViewedAt: serverTimestamp(),
  });
}
