import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { resolveShare, ShareAuthError } from "@/lib/share-server";
import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";

// GET /api/share/[token]
// Resolve a public share for the (unauthenticated) reviewer. The share page CANNOT
// read the workspace's assets with the client SDK — Firestore rules correctly
// forbid anonymous reads (C2). So we resolve everything server-side via the Admin
// SDK after validating the token, and return only the shared assets.
// H5: guests never see the raw Vercel Blob URL (public + permanent + immune
// to link revocation). Media is served through the token-gated proxy route,
// which re-validates the share on every request.
function serializeAsset(d: DocumentSnapshot, token: string) {
  const a = d.data() || {};
  const hasMedia = !!(a.downloadURL ?? a.storagePath);
  return {
    id: d.id,
    name: a.name ?? "Untitled",
    type: a.type ?? "document",
    version: a.version ?? 1,
    folder: a.folder ?? null,
    status: a.status ?? null,
    downloadURL: hasMedia ? `/api/share/${token}/media/${d.id}` : null,
    storagePath: null,
    thumbnailURL: a.thumbnailURL
      ? `/api/share/${token}/media/${d.id}?thumb=1`
      : null,
    originalFileName: a.originalFileName ?? null,
    width: a.width ?? null,
    height: a.height ?? null,
    durationSeconds: a.durationSeconds ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const share = await resolveShare(token);
    const db = adminDb();

    // Make the view counter real — the production house should see whether
    // the client actually opened the link. Fire-and-forget.
    if (share.shareLinkId) {
      db.collection("workspaces")
        .doc(share.workspaceId)
        .collection("shareLinks")
        .doc(share.shareLinkId)
        .set(
          {
            viewCount: FieldValue.increment(1),
            lastViewedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        .catch(() => {});
    }

    let campaign: { id: string; name: string | null } | null = null;
    let assets: ReturnType<typeof serializeAsset>[] = [];

    if (share.campaignId) {
      const campRef = db
        .collection("workspaces")
        .doc(share.workspaceId)
        .collection("campaigns")
        .doc(share.campaignId);
      const campSnap = await campRef.get();
      if (campSnap.exists) {
        campaign = {
          id: campSnap.id,
          name: (campSnap.data()?.name as string) ?? null,
        };
      }
      const assetsCol = campRef.collection("assets");
      if (share.assetIds.length > 0) {
        const docs = await Promise.all(
          share.assetIds.map((id) => assetsCol.doc(id).get())
        );
        assets = docs
          .filter((d) => d.exists)
          .map((d) => serializeAsset(d, token));
      } else {
        // bounded — a campaign-wide share must not pull an unbounded set
        const snap = await assetsCol
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();
        assets = snap.docs.map((d) => serializeAsset(d, token));
      }
    }

    return NextResponse.json({
      share: {
        token,
        workspaceId: share.workspaceId,
        campaignId: share.campaignId,
        assetIds: share.assetIds,
        permissions: {
          canView: share.permissions.canView ?? true,
          canComment: share.permissions.canComment ?? false,
          canApprove: share.permissions.canApprove ?? false,
          canDownload: share.permissions.canDownload ?? false,
        },
      },
      campaign,
      assets,
    });
  } catch (error) {
    const status = error instanceof ShareAuthError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Unable to load share";
    return NextResponse.json({ error: message }, { status });
  }
}
