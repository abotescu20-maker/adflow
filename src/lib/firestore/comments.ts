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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Comment, CommentVisibility } from "@/lib/schema";

export function commentsRef(
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
    "comments"
  );
}

export function commentRef(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  commentId: string
) {
  return doc(
    db,
    "workspaces",
    workspaceId,
    "campaigns",
    campaignId,
    "assets",
    assetId,
    "comments",
    commentId
  );
}

export function rootCommentsQuery(
  workspaceId: string,
  campaignId: string,
  assetId: string
) {
  // Only top-level comments; replies are queried separately
  return query(
    commentsRef(workspaceId, campaignId, assetId),
    where("parentCommentId", "==", null),
    orderBy("createdAt", "asc")
  );
}

export function repliesQuery(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  parentId: string
) {
  return query(
    commentsRef(workspaceId, campaignId, assetId),
    where("parentCommentId", "==", parentId),
    orderBy("createdAt", "asc")
  );
}

export interface CreateCommentInput {
  text: string;
  timecode?: number;
  visibility: CommentVisibility;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  parentCommentId?: string;
  mentions?: string[];
}

export async function createComment(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  input: CreateCommentInput
): Promise<string> {
  const docRef = await addDoc(commentsRef(workspaceId, campaignId, assetId), {
    workspaceId,
    campaignId,
    assetId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorAvatar: input.authorAvatar ?? null,
    text: input.text,
    timecode: input.timecode ?? null,
    visibility: input.visibility,
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    parentCommentId: input.parentCommentId ?? null,
    attachments: [],
    mentions: input.mentions ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function resolveComment(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  commentId: string,
  userId: string
): Promise<void> {
  await updateDoc(commentRef(workspaceId, campaignId, assetId, commentId), {
    resolved: true,
    resolvedBy: userId,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function unresolveComment(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  commentId: string
): Promise<void> {
  await updateDoc(commentRef(workspaceId, campaignId, assetId, commentId), {
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function updateComment(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  commentId: string,
  patch: Partial<Pick<Comment, "text" | "visibility">>
): Promise<void> {
  await updateDoc(commentRef(workspaceId, campaignId, assetId, commentId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteComment(
  workspaceId: string,
  campaignId: string,
  assetId: string,
  commentId: string
): Promise<void> {
  await deleteDoc(commentRef(workspaceId, campaignId, assetId, commentId));
}
