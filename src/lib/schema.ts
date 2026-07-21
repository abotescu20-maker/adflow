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

export type WorkspaceRole =
  "owner" | "admin" | "editor" | "reviewer" | "client";

// Production context (Blackframe P2) — actor type + craft, orthogonal to the
// permission `role` above. The chain is client → agency → production house →
// post-production. Set on login via the context picker.
export type ActorType =
  "client" | "agency" | "production_house" | "post_production";

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  client: "Client",
  agency: "Agenție",
  production_house: "Casă de producție",
  post_production: "Post-producție",
};

// Craft / discipline inside a production or post house. Editable: users may add
// custom crafts, so `craft` is stored free-form. These are just the defaults
// the picker offers.
export const DEFAULT_CRAFTS = [
  "Regie",
  "Montaj",
  "Color",
  "2D",
  "3D",
  "AI",
  "Sunet",
  "VFX",
  "Motion",
  "Producție",
] as const;

// Per-user identity/calendar color, assigned when context is set (spec P5).
export const MEMBER_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
] as const;

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: WorkspaceRole;
  // Production context (Blackframe P2) — optional, set via the login picker.
  actorType?: ActorType;
  craft?: string | null; // free-form; defaults from DEFAULT_CRAFTS
  color?: string; // identity/calendar color from MEMBER_COLORS
  contextSetAt?: Timestamp;
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
  "brief" | "production" | "review" | "revision" | "approved" | "delivered";

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
  "uploading" | "processing" | "ready" | "failed";

export interface Asset {
  id: string;
  workspaceId: string;
  campaignId: string;
  name: string;
  type: AssetType;
  folder: string; // "footage" | "graphics" | "sound" | "edits" | "final" | "briefs"
  status: ApprovalStatus;
  processingStatus: AssetProcessingStatus;
  version: number; // current version number
  versionCount: number; // total number of versions uploaded
  parentAssetId?: string; // if this is a version of another asset
  // Storage
  storagePath: string; // gs:// path or blob URL
  originalFileName: string;
  sizeBytes: number;
  mimeType: string;
  // Video/image metadata
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number; // frame rate; auto-detected in the player, manually overridable
  format?: string; // e.g. "ProRes 422", "H.264"
  // Generated variants
  thumbnailURL?: string;
  hlsManifestURL?: string; // for video streaming
  previewURL?: string; // watermarked review version
  downloadURL?: string; // public direct download URL (blob)
  // Enterprise metadata
  tags: string[];
  rating?: number; // 0-5 stars
  assignedTo?: string; // member UID
  assignedToName?: string;
  assignedToAvatar?: string;
  deadline?: Timestamp;
  priority?: "low" | "normal" | "high" | "urgent";
  customFields?: Record<string, string>;
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

// Sub-collection: /assets/{assetId}/versions/{versionId}
export interface AssetVersion {
  id: string;
  assetId: string;
  workspaceId: string;
  campaignId: string;
  version: number;
  storagePath: string;
  downloadURL?: string;
  originalFileName: string;
  sizeBytes: number;
  mimeType: string;
  thumbnailURL?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  notes?: string; // changelog for this version
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Timestamp;
}

// ============================================================================
// COLLECTION (saved smart filter / group)
// ============================================================================
export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  icon: string; // emoji or lucide name
  color?: string; // hex
  filters: {
    status?: ApprovalStatus[];
    folder?: string[];
    tags?: string[];
    assignedTo?: string[];
    campaignIds?: string[];
    deadlineBefore?: Timestamp;
    rating?: number; // min rating
    type?: AssetType[];
  };
  pinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// REVIEW ROUND
// ============================================================================
export type ReviewRoundStatus = "open" | "completed" | "canceled";

export interface ReviewRound {
  id: string;
  workspaceId: string;
  campaignId: string;
  assetId: string;
  version: number; // which version of the asset is under review
  roundNumber: number; // 1, 2, 3, ...
  status: ReviewRoundStatus;
  title: string; // "Client Round 1", "Internal QA"
  reviewers: string[]; // UIDs expected to review
  reviewerEmails?: string[]; // external reviewers (no account)
  deadline?: Timestamp;
  approvals: Record<string, { approvedAt: Timestamp; note?: string }>; // uid -> approval
  rejections: Record<string, { rejectedAt: Timestamp; reason: string }>;
  commentsCount: number;
  shareLinkId?: string; // if a share link was created for this round
  createdBy: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// ============================================================================
// ACTIVITY LOG (audit trail + feed)
// ============================================================================
export type ActivityAction =
  | "workspace.created"
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "campaign.created"
  | "campaign.updated"
  | "campaign.status_changed"
  | "campaign.deleted"
  | "asset.uploaded"
  | "asset.version_uploaded"
  | "asset.status_changed"
  | "asset.approved"
  | "asset.rejected"
  | "asset.assigned"
  | "asset.deleted"
  | "comment.posted"
  | "comment.resolved"
  | "comment.mentioned"
  | "review.round_opened"
  | "review.round_completed"
  | "review.approval_given"
  | "review.changes_requested"
  | "share_link.created"
  | "share_link.revoked"
  | "share_link.viewed"
  | "deliverable.rendered"
  | "deliverable.delivered"
  | "collection.created";

export interface ActivityEntry {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  action: ActivityAction;
  // Target (what was acted on)
  targetType:
    | "workspace"
    | "campaign"
    | "asset"
    | "comment"
    | "member"
    | "review"
    | "share_link"
    | "deliverable"
    | "collection";
  targetId: string;
  targetName: string;
  // Context
  campaignId?: string;
  campaignName?: string;
  assetId?: string;
  assetName?: string;
  // Extra payload
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: Timestamp;
}

// ============================================================================
// NOTIFICATION (per-user inbox)
// ============================================================================
export type NotificationKind =
  | "chat_message"
  | "god_message"
  | "mention"
  | "assigned"
  | "review_requested"
  | "approval_granted"
  | "changes_requested"
  | "comment_reply"
  | "deadline_approaching"
  | "share_link_viewed"
  | "invitation";

export interface Notification {
  id: string;
  uid: string; // recipient
  workspaceId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actorId?: string;
  actorName?: string;
  targetUrl: string; // where clicking takes you
  read: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;
}

// ============================================================================
// CHAT (Blackframe P3) — /workspaces/{id}/threads/{threadId}/messages/{msgId}
// ============================================================================
// general = everyone in the workspace (WhatsApp-style small talk)
// dm      = conversation started by @mentioning someone
// god     = the member's confessional line to the superadmin (workspace owner)
export type ChatThreadType = "general" | "dm" | "god";

export interface ChatThread {
  id: string;
  workspaceId: string;
  type: ChatThreadType;
  title: string;
  participants: string[]; // uids involved; empty for general (= everyone)
  createdBy: string;
  createdAt: Timestamp;
  lastMessageAt?: Timestamp;
  lastMessageText?: string;
  lastMessageBy?: string;
  lastMessageByUid?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  mentions: string[]; // uids @mentioned
  attachments: { url: string; name: string; contentType?: string }[];
  readBy: string[]; // uids who ticked it read (red until you're in here)
  system?: boolean; // app-generated (error alerts, god greetings)
  createdAt: Timestamp;
}

// ============================================================================
// CALENDAR (Blackframe P5) — /workspaces/{id}/calendarEvents/{eventId}
// ============================================================================
export interface CalendarEvent {
  id: string;
  workspaceId: string;
  uid: string;
  userName: string;
  color: string; // the member's identity color
  label: string; // e.g. "edit"
  startDate: string; // YYYY-MM-DD (all-day spans)
  endDate: string; // inclusive
  createdAt: Timestamp;
}

// ============================================================================
// NOTES (Blackframe P5) — /workspaces/{id}/notes/{uid} — personal scratchpad
// ============================================================================
export interface UserNote {
  uid: string;
  text: string;
  updatedAt: Timestamp;
}

// ============================================================================
// COMMENT
// ============================================================================
export type CommentVisibility = "public" | "team";

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
  visibility: CommentVisibility; // public = visible to clients via share links
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  parentCommentId?: string; // for threaded replies
  attachments?: { url: string; name: string; contentType?: string }[];
  mentions?: string[]; // user UIDs mentioned
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// DELIVERABLE (output format matrix)
// ============================================================================
export type DeliverableStatus =
  "pending" | "rendering" | "ready" | "delivered" | "failed";

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
  expiresAt?: Timestamp;
  // Deliberately NO passwordHash/allowedEmails/allowedDomains: they were
  // stored but never enforced (security theater). Reintroduce only together
  // with enforcement in resolveShare.
  createdBy: string;
  createdAt: Timestamp;
  viewCount: number;
  lastViewedAt?: Timestamp;
  revokedAt?: Timestamp;
}
