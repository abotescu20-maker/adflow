import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ReviewRound, ReviewRoundStatus } from "@/lib/schema";

export function reviewRoundsRef(
  workspaceId: string,
  campaignId: string,
  assetId: string
) {
  return collection(
    db,
    "workspaces",
    workspaceId,
    "campaigns",
    campaignId,
    "assets",
    assetId,
    "reviewRounds"
  );
}

export function reviewRoundRef(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  roundId: string
) {
  return doc(
    db,
    "workspaces",
    workspaceId,
    "campaigns",
    campaignId,
    "assets",
    assetId,
    "reviewRounds",
    roundId
  );
}

export function reviewRoundsQuery(
  workspaceId: string,
  campaignId: string,
  assetId: string
) {
  return query(
    reviewRoundsRef(workspaceId, campaignId, assetId),
    orderBy("roundNumber", "desc")
  );
}

export interface CreateReviewRoundInput {
  version: number;
  roundNumber: number;
  title: string;
  reviewers: string[];
  reviewerEmails?: string[];
  deadline?: Date;
  createdBy: string;
  shareLinkId?: string;
}

export async function createReviewRound(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  input: CreateReviewRoundInput
): Promise<string> {
  const docRef = await addDoc(
    reviewRoundsRef(workspaceId, campaignId, assetId),
    {
      workspaceId,
      campaignId,
      assetId,
      version: input.version,
      roundNumber: input.roundNumber,
      status: "open" as ReviewRoundStatus,
      title: input.title,
      reviewers: input.reviewers,
      reviewerEmails: input.reviewerEmails ?? [],
      deadline: input.deadline ?? null,
      approvals: {},
      rejections: {},
      commentsCount: 0,
      shareLinkId: input.shareLinkId ?? null,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      completedAt: null,
    }
  );
  return docRef.id;
}

export async function approveReviewRound(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  roundId: string,
  uid: string,
  note?: string
): Promise<void> {
  await updateDoc(reviewRoundRef(workspaceId, campaignId, assetId, roundId), {
    [`approvals.${uid}`]: {
      approvedAt: serverTimestamp(),
      note: note ?? null,
    },
  });
}

export async function rejectReviewRound(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  roundId: string,
  uid: string,
  reason: string
): Promise<void> {
  await updateDoc(reviewRoundRef(workspaceId, campaignId, assetId, roundId), {
    [`rejections.${uid}`]: {
      rejectedAt: serverTimestamp(),
      reason,
    },
  });
}

export async function closeReviewRound(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  roundId: string,
  status: "completed" | "canceled"
): Promise<void> {
  await updateDoc(reviewRoundRef(workspaceId, campaignId, assetId, roundId), {
    status,
    completedAt: serverTimestamp(),
  });
}

export type { ReviewRound };
