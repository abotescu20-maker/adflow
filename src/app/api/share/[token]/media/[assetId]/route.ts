import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  resolveShare,
  assertAssetInShare,
  ShareAuthError,
} from "@/lib/share-server";

// GET /api/share/[token]/media/[assetId]
// Token-gated media streaming for the public share page (H5). Previously the
// share API handed guests the raw Vercel Blob URL — public, permanent, and
// unaffected by link revocation, so "view-only" links leaked downloadable
// masters. This route re-validates the token on EVERY request (revoked/expired
// → 410) and proxies the bytes, forwarding Range headers so video scrubbing
// keeps working. The blob URL itself never reaches the browser.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; assetId: string }> }
): Promise<Response> {
  try {
    const { token, assetId } = await params;
    const share = await resolveShare(token);
    if (share.permissions.canView === false) {
      throw new ShareAuthError("Viewing is not allowed on this link", 403);
    }
    const campaignId = assertAssetInShare(share, assetId);

    const assetSnap = await adminDb()
      .collection("workspaces")
      .doc(share.workspaceId)
      .collection("campaigns")
      .doc(campaignId)
      .collection("assets")
      .doc(assetId)
      .get();
    if (!assetSnap.exists) throw new ShareAuthError("Asset not found", 404);
    const a = assetSnap.data() ?? {};
    // ?thumb=1 serves the poster frame through the same gate — a raw public
    // thumbnail URL leaks a frame of the content, revocation-proof.
    const wantThumb = new URL(request.url).searchParams.get("thumb") === "1";
    const blobUrl = (
      wantThumb ? a.thumbnailURL : (a.downloadURL ?? a.storagePath)
    ) as string | undefined;
    if (!blobUrl || !/^https?:\/\//.test(blobUrl)) {
      throw new ShareAuthError("Media unavailable", 404);
    }

    // Forward the Range header so <video> seeking works through the proxy.
    const range = request.headers.get("range");
    const upstream = await fetch(blobUrl, {
      headers: range ? { Range: range } : undefined,
    });
    if (!upstream.ok && upstream.status !== 206) {
      throw new ShareAuthError("Media fetch failed", 502);
    }

    const headers = new Headers();
    for (const h of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    // Private: intermediaries must not cache a token-gated response.
    headers.set("cache-control", "private, max-age=0, must-revalidate");
    if (share.permissions.canDownload !== true) {
      headers.set("content-disposition", "inline");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const status = error instanceof ShareAuthError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Unable to load media";
    return NextResponse.json({ error: message }, { status });
  }
}
