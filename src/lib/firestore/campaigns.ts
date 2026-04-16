import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  where,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Campaign, ApprovalStatus } from "@/lib/schema";

export function campaignsRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "campaigns");
}

export function campaignRef(workspaceId: string, campaignId: string) {
  return doc(db, "workspaces", workspaceId, "campaigns", campaignId);
}

export function campaignsQuery(workspaceId: string) {
  return query(campaignsRef(workspaceId), orderBy("updatedAt", "desc"));
}

export function campaignsByStatusQuery(workspaceId: string, status: ApprovalStatus) {
  return query(
    campaignsRef(workspaceId),
    where("status", "==", status),
    orderBy("updatedAt", "desc")
  );
}

export interface CreateCampaignInput {
  name: string;
  client: string;
  brand: string;
  description?: string;
  dueDate: Date;
  platforms: string[];
  createdBy: string;
}

export async function createCampaign(
  workspaceId: string,
  input: CreateCampaignInput
): Promise<string> {
  const docRef = await addDoc(campaignsRef(workspaceId), {
    workspaceId,
    name: input.name,
    client: input.client,
    brand: input.brand,
    description: input.description ?? "",
    status: "brief" as ApprovalStatus,
    dueDate: Timestamp.fromDate(input.dueDate),
    platforms: input.platforms,
    thumbnailURL: null,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    updatedAt: serverTimestamp(),
    assetsCount: 0,
    commentsCount: 0,
    progress: 0,
  });
  return docRef.id;
}

export async function updateCampaign(
  workspaceId: string,
  campaignId: string,
  patch: Partial<Omit<Campaign, "id" | "workspaceId" | "createdAt" | "createdBy">>
): Promise<void> {
  const { ...rest } = patch as Record<string, unknown>;
  await updateDoc(campaignRef(workspaceId, campaignId), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
}

export async function updateCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: ApprovalStatus
): Promise<void> {
  const progressMap: Record<ApprovalStatus, number> = {
    brief: 5,
    production: 35,
    review: 65,
    revision: 55,
    approved: 90,
    delivered: 100,
  };
  await updateDoc(campaignRef(workspaceId, campaignId), {
    status,
    progress: progressMap[status],
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCampaign(
  workspaceId: string,
  campaignId: string
): Promise<void> {
  await deleteDoc(campaignRef(workspaceId, campaignId));
}

export async function incrementCampaignAssetsCount(
  workspaceId: string,
  campaignId: string,
  delta: number
): Promise<void> {
  await updateDoc(campaignRef(workspaceId, campaignId), {
    assetsCount: increment(delta),
    updatedAt: serverTimestamp(),
  });
}
