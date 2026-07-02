import {
  collection,
  doc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit as fsLimit,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActivityAction, ActivityEntry } from "@/lib/schema";

export function activityRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "activity");
}

export function activityEntryRef(workspaceId: string, entryId: string) {
  return doc(db, "workspaces", workspaceId, "activity", entryId);
}

export function activityQuery(workspaceId: string, max = 50) {
  return query(activityRef(workspaceId), orderBy("createdAt", "desc"), fsLimit(max));
}

export function activityByCampaignQuery(
  workspaceId: string,
  campaignId: string,
  max = 30
) {
  return query(
    activityRef(workspaceId),
    where("campaignId", "==", campaignId),
    orderBy("createdAt", "desc"),
    fsLimit(max)
  );
}

export function activityByAssetQuery(
  workspaceId: string,
  assetId: string,
  max = 20
) {
  return query(
    activityRef(workspaceId),
    where("assetId", "==", assetId),
    orderBy("createdAt", "desc"),
    fsLimit(max)
  );
}

export interface LogActivityInput {
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  action: ActivityAction;
  targetType: ActivityEntry["targetType"];
  targetId: string;
  targetName: string;
  campaignId?: string;
  campaignName?: string;
  assetId?: string;
  assetName?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function logActivity(
  workspaceId: string,
  input: LogActivityInput
): Promise<string> {
  const docRef = await addDoc(activityRef(workspaceId), {
    workspaceId,
    actorId: input.actorId,
    actorName: input.actorName,
    actorAvatar: input.actorAvatar ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetName: input.targetName,
    campaignId: input.campaignId ?? null,
    campaignName: input.campaignName ?? null,
    assetId: input.assetId ?? null,
    assetName: input.assetName ?? null,
    metadata: input.metadata ?? null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
