import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  increment,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asset, AssetType, ApprovalStatus, AssetProcessingStatus } from "@/lib/schema";

export function assetsRef(workspaceId: string, campaignId: string) {
  return collection(db, "workspaces", workspaceId, "campaigns", campaignId, "assets");
}

export function assetRef(workspaceId: string, campaignId: string, assetId: string) {
  return doc(db, "workspaces", workspaceId, "campaigns", campaignId, "assets", assetId);
}

export function assetsQuery(workspaceId: string, campaignId: string) {
  return query(assetsRef(workspaceId, campaignId), orderBy("createdAt", "desc"));
}

export function assetsByFolderQuery(
  workspaceId: string,
  campaignId: string,
  folder: string
) {
  return query(
    assetsRef(workspaceId, campaignId),
    where("folder", "==", folder),
    orderBy("createdAt", "desc")
  );
}

export interface CreateAssetInput {
  name: string;
  type: AssetType;
  folder: string;
  storagePath: string;
  originalFileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  uploadedByName: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  format?: string;
}

export async function createAsset(
  workspaceId: string,
  campaignId: string,
  input: CreateAssetInput
): Promise<string> {
  // Determine version by checking same-name existing assets
  const sameNameQuery = query(
    assetsRef(workspaceId, campaignId),
    where("name", "==", input.name)
  );
  const existing = await getDocs(sameNameQuery);
  const maxVersion = existing.docs.reduce(
    (max, d) => Math.max(max, (d.data().version as number) || 1),
    0
  );
  const nextVersion = maxVersion + 1;

  const docRef = await addDoc(assetsRef(workspaceId, campaignId), {
    workspaceId,
    campaignId,
    name: input.name,
    type: input.type,
    folder: input.folder,
    status: "brief" as ApprovalStatus,
    processingStatus: "uploading" as AssetProcessingStatus,
    version: nextVersion,
    storagePath: input.storagePath,
    originalFileName: input.originalFileName,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    width: input.width ?? null,
    height: input.height ?? null,
    durationSeconds: input.durationSeconds ?? null,
    format: input.format ?? null,
    thumbnailURL: null,
    hlsManifestURL: null,
    previewURL: null,
    uploadedBy: input.uploadedBy,
    uploadedByName: input.uploadedByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    commentsCount: 0,
    unresolvedCommentsCount: 0,
    approvedBy: null,
    approvedAt: null,
  });
  return docRef.id;
}

export async function updateAsset(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  patch: Partial<Omit<Asset, "id" | "workspaceId" | "campaignId" | "createdAt">>
): Promise<void> {
  await updateDoc(assetRef(workspaceId, campaignId, assetId), {
    ...(patch as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAssetStatus(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  status: ApprovalStatus,
  userId?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "approved" && userId) {
    patch.approvedBy = userId;
    patch.approvedAt = serverTimestamp();
  }
  await updateDoc(assetRef(workspaceId, campaignId, assetId), patch);
}

export async function deleteAsset(
  workspaceId: string,
  campaignId: string,
  assetId: string
): Promise<void> {
  await deleteDoc(assetRef(workspaceId, campaignId, assetId));
}

export async function incrementAssetCommentsCount(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  delta: number,
  unresolvedDelta = delta
): Promise<void> {
  await updateDoc(assetRef(workspaceId, campaignId, assetId), {
    commentsCount: increment(delta),
    unresolvedCommentsCount: increment(unresolvedDelta),
    updatedAt: serverTimestamp(),
  });
}
