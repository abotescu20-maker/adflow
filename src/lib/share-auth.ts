// Pure share-authorization helpers — NO firebase-admin import, so they are cheap
// to unit-test and safe to use anywhere. The DB-touching resolveShare() lives in
// share-server.ts and builds a ResolvedShare that these functions operate on.

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

export function toMillis(v: unknown): number | null {
  if (!v) return null;
  const anyV = v as { toMillis?: () => number };
  if (typeof anyV.toMillis === "function") return anyV.toMillis();
  if (v instanceof Date) return v.getTime();
  return null;
}

// Verify the target asset is actually covered by this share (either explicitly
// listed, or — for a campaign-wide share with no asset list — under its campaign).
// Returns the campaignId to write under, or throws ShareAuthError.
export function assertAssetInShare(
  share: ResolvedShare,
  assetId: string
): string {
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
