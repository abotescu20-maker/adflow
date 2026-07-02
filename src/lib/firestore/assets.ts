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
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Asset,
  AssetType,
  ApprovalStatus,
  AssetProcessingStatus,
  AssetVersion,
} from "@/lib/schema";

// ----------- refs / queries -----------

export function assetsRef(workspaceId: string, campaignId: string) {
  return collection(db, "workspaces", workspaceId, "campaigns", campaignId, "assets");
}

export function assetRef(workspaceId: string, campaignId: string, assetId: string) {
  return doc(db, "workspaces", workspaceId, "campaigns", campaignId, "assets", assetId);
}

export function assetVersionsRef(workspaceId: string, campaignId: string, assetId: string) {
  return collection(
    db,
    "workspaces",
    workspaceId,
    "campaigns",
    campaignId,
    "assets",
    assetId,
    "versions"
  );
}

export function assetVersionRef(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  versionId: string
) {
  return doc(
    db,
    "workspaces",
    workspaceId,
    "campaigns",
    campaignId,
    "assets",
    assetId,
    "versions",
    versionId
  );
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

export function assetVersionsQuery(
  workspaceId: string,
  campaignId: string,
  assetId: string
) {
  return query(
    assetVersionsRef(workspaceId, campaignId, assetId),
    orderBy("version", "desc")
  );
}

// ----------- create -----------

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
  downloadURL?: string;
  thumbnailURL?: string;
  tags?: string[];
  assignedTo?: string;
  assignedToName?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export async function createAsset(
  workspaceId: string,
  campaignId: string,
  input: CreateAssetInput
): Promise<string> {
  // Check if an asset with the same name exists → upload as new version
  const sameNameQuery = query(
    assetsRef(workspaceId, campaignId),
    where("name", "==", input.name)
  );
  const existing = await getDocs(sameNameQuery);

  if (existing.size > 0) {
    // Existing asset — add as new version
    const existingDoc = existing.docs[0];
    const existingData = existingDoc.data();
    const newVersion = ((existingData.versionCount as number) || 1) + 1;

    // Add version sub-doc
    const versionDocRef = doc(
      assetVersionsRef(workspaceId, campaignId, existingDoc.id)
    );
    await setDoc(versionDocRef, {
      assetId: existingDoc.id,
      workspaceId,
      campaignId,
      version: newVersion,
      storagePath: input.storagePath,
      downloadURL: input.downloadURL ?? null,
      originalFileName: input.originalFileName,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      thumbnailURL: input.thumbnailURL ?? null,
      durationSeconds: input.durationSeconds ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      notes: null,
      uploadedBy: input.uploadedBy,
      uploadedByName: input.uploadedByName,
      createdAt: serverTimestamp(),
    });

    // Update parent asset to point to new version
    await updateDoc(existingDoc.ref, {
      version: newVersion,
      versionCount: newVersion,
      storagePath: input.storagePath,
      downloadURL: input.downloadURL ?? null,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      thumbnailURL: input.thumbnailURL ?? existingData.thumbnailURL ?? null,
      width: input.width ?? existingData.width ?? null,
      height: input.height ?? existingData.height ?? null,
      durationSeconds: input.durationSeconds ?? existingData.durationSeconds ?? null,
      updatedAt: serverTimestamp(),
    });

    return existingDoc.id;
  }

  // First version
  const docRef = await addDoc(assetsRef(workspaceId, campaignId), {
    workspaceId,
    campaignId,
    name: input.name,
    type: input.type,
    folder: input.folder,
    status: "brief" as ApprovalStatus,
    processingStatus: "ready" as AssetProcessingStatus,
    version: 1,
    versionCount: 1,
    parentAssetId: null,
    storagePath: input.storagePath,
    originalFileName: input.originalFileName,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    width: input.width ?? null,
    height: input.height ?? null,
    durationSeconds: input.durationSeconds ?? null,
    format: input.format ?? null,
    thumbnailURL: input.thumbnailURL ?? null,
    hlsManifestURL: null,
    previewURL: null,
    downloadURL: input.downloadURL ?? null,
    tags: input.tags ?? [],
    rating: null,
    assignedTo: input.assignedTo ?? null,
    assignedToName: input.assignedToName ?? null,
    assignedToAvatar: null,
    deadline: null,
    priority: input.priority ?? "normal",
    customFields: null,
    uploadedBy: input.uploadedBy,
    uploadedByName: input.uploadedByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    commentsCount: 0,
    unresolvedCommentsCount: 0,
    approvedBy: null,
    approvedAt: null,
  });

  // Also write version #1 sub-doc for history
  const versionDocRef = doc(assetVersionsRef(workspaceId, campaignId, docRef.id));
  await setDoc(versionDocRef, {
    assetId: docRef.id,
    workspaceId,
    campaignId,
    version: 1,
    storagePath: input.storagePath,
    downloadURL: input.downloadURL ?? null,
    originalFileName: input.originalFileName,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    thumbnailURL: input.thumbnailURL ?? null,
    durationSeconds: input.durationSeconds ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    notes: null,
    uploadedBy: input.uploadedBy,
    uploadedByName: input.uploadedByName,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

// ----------- updates -----------

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

export async function assignAsset(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  member: { uid: string; name: string; avatar?: string } | null
): Promise<void> {
  await updateDoc(assetRef(workspaceId, campaignId, assetId), {
    assignedTo: member?.uid ?? null,
    assignedToName: member?.name ?? null,
    assignedToAvatar: member?.avatar ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function setAssetRating(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  rating: number | null
): Promise<void> {
  await updateDoc(assetRef(workspaceId, campaignId, assetId), {
    rating,
    updatedAt: serverTimestamp(),
  });
}

export async function setAssetTags(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  tags: string[]
): Promise<void> {
  await updateDoc(assetRef(workspaceId, campaignId, assetId), {
    tags,
    updatedAt: serverTimestamp(),
  });
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

// ----------- versions -----------

export async function listAssetVersions(
  workspaceId: string,
  campaignId: string,
  assetId: string
): Promise<AssetVersion[]> {
  const snap = await getDocs(assetVersionsQuery(workspaceId, campaignId, assetId));
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as AssetVersion)
  );
}

export async function switchActiveVersion(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  version: AssetVersion
): Promise<void> {
  await updateDoc(assetRef(workspaceId, campaignId, assetId), {
    version: version.version,
    storagePath: version.storagePath,
    downloadURL: version.downloadURL ?? null,
    sizeBytes: version.sizeBytes,
    mimeType: version.mimeType,
    thumbnailURL: version.thumbnailURL ?? null,
    durationSeconds: version.durationSeconds ?? null,
    width: version.width ?? null,
    height: version.height ?? null,
    updatedAt: serverTimestamp(),
  });
}
