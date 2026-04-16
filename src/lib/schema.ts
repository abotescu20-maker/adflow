// Multi-tenant SaaS Firestore schema
//
// Collections hierarchy:
//
// /users/{userId}                              — user profile, list of workspaces
// /workspaces/{workspaceId}                    — tenant (agency/team)
//   /members/{userId}                          — membership record (role)
//   /invitations/{inviteId}                    — pending email invitations
//   /campaigns/{campaignId}                    — advertising campaign
//     /assets/{assetId}                        — video/image/audio file
//       /comments/{commentId}                  — timecode comments
//     /deliverables/{deliverableId}            — format matrix entries
//   /shareLinks/{linkId}                       — external review links
// /publicShares/{token}                        — public-accessible share mirror (read-only)

import { Timestamp } from "firebase/firestore";

// ============================================================================
// USER
// ============================================================================
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  workspaces: string[]; // workspace IDs this user is a member of
  defaultWorkspaceId?: string;
}

// ============================================================================
// WORKSPACE (tenant)
// ============================================================================
export type WorkspacePlan = "free" | "team" | "business" | "enterprise";

export interface Workspace {
  id: string;
  name: string;
  slug: string; // URL-safe identifier, globally unique
  ownerUid: string;
  plan: WorkspacePlan;
  brandColor?: string;
  logoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Billing
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: "active" | "trialing" | "past_due" | "canceled";
  trialEndsAt?: Timestamp;
  // Usage limits
  limits: {
    members: number;
    campaigns: number;
    storageGb: number;
    transcodingMinutesPerMonth: number;
  };
  // Usage counters (updated by Cloud Functions)
  usage: {
    members: number;
    campaigns: number;
    storageBytes: number;
    transcodingMinutesThisMonth: number;
  };
}

export type WorkspaceRole = "owner" | "admin" | "editor" | "reviewer" | "client";

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: WorkspaceRole;
  addedAt: Timestamp;
  addedBy: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  invitedByName: string;
  workspaceId: string;
  workspaceName: string;
  token: string; // unique link token
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  acceptedByUid?: string;
}

// ============================================================================
// CAMPAIGN
// ============================================================================
export type ApprovalStatus =
  | "brief"
  | "production"
  | "review"
  | "revision"
  | "approved"
  | "delivered";

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  client: string;
  brand: string;
  description?: string;
  status: ApprovalStatus;
  dueDate: Timestamp;
  platforms: string[]; // TikTok, Instagram, YouTube, etc.
  thumbnailURL?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  // Counters
  assetsCount: number;
  commentsCount: number;
  progress: number; // 0-100
  // Access: members-only (no extra ACL)
}

// ============================================================================
// ASSET (video, image, audio, document)
// ============================================================================
export type AssetType = "video" | "image" | "audio" | "document";
export type AssetProcessingStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "failed";

export interface Asset {
  id: string;
  workspaceId: string;
  campaignId: string;
  name: string;
  type: AssetType;
  folder: string; // "footage" | "graphics" | "sound" | "edits" | "final" | "briefs"
  status: ApprovalStatus;
  processingStatus: AssetProcessingStatus;
  version: number;
  // Storage
  storagePath: string; // gs:// path
  originalFileName: string;
  sizeBytes: number;
  mimeType: string;
  // Video/image metadata
  width?: number;
  height?: number;
  durationSeconds?: number;
  format?: string; // e.g. "ProRes 422", "H.264"
  // Generated variants
  thumbnailURL?: string;
  hlsManifestURL?: string; // for video streaming
  previewURL?: string; // watermarked review version
  // Tracking
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentsCount: number;
  unresolvedCommentsCount: number;
  // Approval tracking
  approvedBy?: string;
  approvedAt?: Timestamp;
}

// ============================================================================
// COMMENT
// ============================================================================
export interface Comment {
  id: string;
  workspaceId: string;
  campaignId: string;
  assetId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  timecode?: number; // seconds into video, null for general comments
  visibility: "public" | "team"; // public = visible to clients via share links
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  parentCommentId?: string; // for threaded replies
  attachments?: string[]; // URLs
  mentions?: string[]; // user UIDs mentioned
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// DELIVERABLE (output format matrix)
// ============================================================================
export type DeliverableStatus = "pending" | "rendering" | "ready" | "delivered" | "failed";

export interface Deliverable {
  id: string;
  workspaceId: string;
  campaignId: string;
  platform: string; // "TikTok", "Instagram Reels", etc.
  format: string; // "MP4 / H.264"
  dimensions: string; // "1080x1920"
  durationSeconds: number;
  status: DeliverableStatus;
  sourceAssetId?: string; // input asset
  outputAssetId?: string; // generated asset
  renderingProgress?: number; // 0-100
  renderedAt?: Timestamp;
  deliveredAt?: Timestamp;
  errorMessage?: string;
  createdAt: Timestamp;
}

// ============================================================================
// SHARE LINK (external review access)
// ============================================================================
export interface ShareLink {
  id: string;
  workspaceId: string;
  campaignId?: string; // scope: whole campaign
  assetIds?: string[]; // scope: specific assets
  token: string; // unguessable URL token
  name: string; // "Client Review Round 2"
  permissions: {
    canView: boolean;
    canComment: boolean;
    canApprove: boolean;
    canDownload: boolean;
  };
  passwordHash?: string;
  expiresAt?: Timestamp;
  allowedEmails?: string[]; // email whitelist
  allowedDomains?: string[]; // domain whitelist
  createdBy: string;
  createdAt: Timestamp;
  viewCount: number;
  lastViewedAt?: Timestamp;
  revokedAt?: Timestamp;
}
