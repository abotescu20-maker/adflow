import { adminDb } from "@/lib/firebase-admin";
import { ShareAuthError, toMillis, type ResolvedShare } from "@/lib/share-auth";

// Re-export the pure helpers so existing route imports keep working.
export {
  ShareAuthError,
  assertAssetInShare,
  cleanText,
  type ResolvedShare,
} from "@/lib/share-auth";

// Resolve a share token to its scope + permissions (touches Firestore via the
// Admin SDK). The pure authorization helpers live in share-auth.ts. This is the
// ONLY gate for guest (unauthenticated) writes, so it must be strict.
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
