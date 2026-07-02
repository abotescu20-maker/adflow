import { adminDb } from "@/lib/firebase-admin";

// Server-side authorization for the public share flow. The Admin SDK bypasses
// Firestore rules, so this is the ONLY gate for guest (unauthenticated) writes —
// it must be strict. Resolves a share token to its scope + permissions, or throws
// a ShareAuthError carrying an HTTP status.

export class ShareAuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export interface ResolvedShare {
  token: string;
  workspaceId: string;
  campaignId: string | null;
  assetIds: string[];
  permissions: {
    canView?: boolean;
    canComment?: boolean;
    canApprove?: boolean;
    canDownload?: boolean;
  };
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
  const anyV = v as { toMillis?: () => number };
  if (typeof anyV.toMillis === "function") return anyV.toMillis();
  if (v instanceof Date) return v.getTime();
  return null;
}

export async function resolveShare(token: string): Promise<ResolvedShare> {
  if (!token || typeof token !== "string" || token.length < 8) {
    throw new ShareAuthError("Invalid share token", 400);
  }
  const snap = await adminDb().collection("publicShares").doc(token).get();
  if (!snap.exists) throw new ShareAuthError("Share not found", 404);
  const d = snap.data() as Record<string, unknown>;

  if (toMillis(d.revokedAt) != null) {
    throw new ShareAuthError("This link has been revoked", 410);
  }
  const exp = toMillis(d.expiresAt);
  if (exp != null && exp < Date.now()) {
    throw new ShareAuthError("This link has expired", 410);
  }

  return {
    token,
    workspaceId: String(d.workspaceId),
    campaignId: (d.campaignId as string) ?? null,
    assetIds: Array.isArray(d.assetIds) ? (d.assetIds as string[]) : [],
    permissions: (d.permissions as ResolvedShare["permissions"]) ?? {},
  };
}

// Verify the target asset is actually covered by this share (either explicitly
// listed, or — for a campaign-wide share with no asset list — under its campaign).
// Returns the campaignId to write under.
export function assertAssetInShare(share: ResolvedShare, assetId: string): string {
  if (!assetId || typeof assetId !== "string") {
    throw new ShareAuthError("Missing assetId", 400);
  }
  if (share.assetIds.length > 0 && !share.assetIds.includes(assetId)) {
    throw new ShareAuthError("Asset is not part of this share", 403);
  }
  if (!share.campaignId) {
    throw new ShareAuthError("Share has no campaign scope", 400);
  }
  return share.campaignId;
}

// Trim + cap guest-supplied strings, dropping ASCII control characters, before
// they touch the DB. (React escapes on render; this is defense-in-depth.)
export function cleanText(v: unknown, max: number): string {
  const s = String(v ?? "");
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.trim().slice(0, max);
}
