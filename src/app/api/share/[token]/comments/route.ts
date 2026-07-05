import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { resolveShare, assertAssetInShare, ShareAuthError } from "@/lib/share-server";

// GET /api/share/[token]/comments?assetId=...
// Return the PUBLIC comments for a shared asset so the guest reviewer can see the
// thread (they can't read Firestore directly — rules forbid anonymous reads).
// Only visibility === "public" comments are exposed; internal/team comments stay hidden.
function millis(v: unknown): number | null {
  const anyV = v as { toMillis?: () => number } | null;
  if (anyV && typeof anyV.toMillis === "function") return anyV.toMillis();
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const share = await resolveShare(token);
    const url = new URL(request.url);
    const assetId = url.searchParams.get("assetId") || "";
    const campaignId = assertAssetInShare(share, assetId);

    const snap = await adminDb()
      .collection("workspaces").doc(share.workspaceId)
      .collection("campaigns").doc(campaignId)
      .collection("assets").doc(assetId)
      .collection("comments")
      .where("visibility", "==", "public")
      .get();

    const comments = snap.docs
      .map((d) => {
        const c = d.data();
        return {
          id: d.id,
          authorName: (c.authorName as string) || "Reviewer",
          text: (c.text as string) || "",
          timecode: typeof c.timecode === "number" ? c.timecode : null,
          resolved: !!c.resolved,
          isDecision: !!c.isDecision,
          createdAtMs: millis(c.createdAt),
        };
      })
      .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));

    return NextResponse.json({ comments });
  } catch (error) {
    const status = error instanceof ShareAuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Failed to load comments";
    return NextResponse.json({ error: message }, { status });
  }
}
