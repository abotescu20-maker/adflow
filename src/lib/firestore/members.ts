import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceInvitation,
  ActorType,
} from "@/lib/schema";

export function membersRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "members");
}

export function memberRef(workspaceId: string, uid: string) {
  return doc(db, "workspaces", workspaceId, "members", uid);
}

export function membersQuery(workspaceId: string) {
  return query(membersRef(workspaceId), orderBy("addedAt", "asc"));
}

export function invitationsRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "invitations");
}

export function invitationRef(workspaceId: string, inviteId: string) {
  return doc(db, "workspaces", workspaceId, "invitations", inviteId);
}

export function invitationsQuery(workspaceId: string) {
  return query(invitationsRef(workspaceId), orderBy("createdAt", "desc"));
}

// --- members ---

export async function addMember(
  workspaceId: string,
  member: Omit<WorkspaceMember, "addedAt"> & { addedBy: string }
): Promise<void> {
  await setDoc(memberRef(workspaceId, member.uid), {
    uid: member.uid,
    email: member.email,
    displayName: member.displayName,
    photoURL: member.photoURL ?? null,
    role: member.role,
    addedAt: serverTimestamp(),
    addedBy: member.addedBy,
  });
}

export async function updateMemberRole(
  workspaceId: string,
  uid: string,
  role: WorkspaceRole
): Promise<void> {
  await updateDoc(memberRef(workspaceId, uid), {
    role,
  });
}

export async function removeMember(
  workspaceId: string,
  uid: string
): Promise<void> {
  await deleteDoc(memberRef(workspaceId, uid));
}

// --- production context (Blackframe P2) ---

export interface MemberContextInput {
  actorType: ActorType;
  craft?: string | null;
  color: string;
}

// Silent re-color when the department palette changes (colors are derived
// from actorType/craft since 17.07, no longer user-picked).
export async function updateMemberColor(
  workspaceId: string,
  uid: string,
  color: string
): Promise<void> {
  await updateDoc(memberRef(workspaceId, uid), { color });
}

// Written by the login context picker: which house you're in + your craft +
// your identity color. Orthogonal to the permission role.
export async function setMemberContext(
  workspaceId: string,
  uid: string,
  input: MemberContextInput
): Promise<void> {
  await updateDoc(memberRef(workspaceId, uid), {
    actorType: input.actorType,
    craft: input.craft ?? null,
    color: input.color,
    contextSetAt: serverTimestamp(),
  });
}

// --- invitations ---

function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface CreateInvitationInput {
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  invitedByName: string;
  workspaceName: string;
  expiresInDays?: number;
}

export async function createInvitation(
  workspaceId: string,
  input: CreateInvitationInput
): Promise<{ id: string; token: string }> {
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));

  const docRef = await addDoc(invitationsRef(workspaceId), {
    email: input.email.toLowerCase().trim(),
    role: input.role,
    invitedBy: input.invitedBy,
    invitedByName: input.invitedByName,
    workspaceId,
    workspaceName: input.workspaceName,
    token,
    createdAt: serverTimestamp(),
    expiresAt,
    acceptedAt: null,
    acceptedByUid: null,
  });

  return { id: docRef.id, token };
}

export async function revokeInvitation(
  workspaceId: string,
  inviteId: string
): Promise<void> {
  await deleteDoc(invitationRef(workspaceId, inviteId));
}

export async function acceptInvitation(
  workspaceId: string,
  inviteId: string,
  uid: string
): Promise<void> {
  await updateDoc(invitationRef(workspaceId, inviteId), {
    acceptedAt: serverTimestamp(),
    acceptedByUid: uid,
  });
}

export type { WorkspaceMember, WorkspaceRole, WorkspaceInvitation };
