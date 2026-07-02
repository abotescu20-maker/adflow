import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  resolveShare,
  assertAssetInShare,
  cleanText,
  ShareAuthError,
} from "@/lib/share-server";

// POST /api/share/[token]/approve
// Guest (unauthenticated) reviewer approves or requests changes on an asset via a
// valid share link. Updates the asset's approval status and records the decision
// as a public comment so the team sees who decided what. Server-side auth only.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const share = await resolveShare(token);
    if (!share.permissions.canApprove) {
      throw new ShareAuthError("Approvals are not allowed on this link", 403);
    }

    const body = (await request.json()) as {
      assetId?: string;
      decision?: string;
      guestName?: string;
      note?: string;
    };

    const campaignId = assertAssetInShare(share, String(body.assetId ?? ""));
    const decision = body.decision === "approved" ? "approved" : "changes_requested";
    const guestName = cleanText(body.guestName, 80) || "Guest reviewer";
    const note = cleanText(body.note, 2000);

    const assetRef = adminDb()
      .collection("workspaces")
      .doc(share.workspaceId)
      .collection("campaigns")
      .doc(campaignId)
      .collection("assets")
      .doc(String(body.assetId));

    // Update approval status + stamp who/when.
    await assetRef.set(
      {
        status: decision,
        approvedBy: `guest:${token.slice(0, 12)}`,
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Record the decision as a visible comment for the team's audit trail.
    const label =
      decision === "approved" ? "✅ Approved" : "🔴 Requested changes";
    await assetRef.collection("comments").add({
      workspaceId: share.workspaceId,
      campaignId,
      assetId: String(body.assetId),
      authorId: `guest:${token.slice(0, 12)}`,
      authorName: `${guestName} (Guest)`,
      authorAvatar: null,
      text: note ? `${label}: ${note}` : label,
      timecode: null,
      visibility: "public",
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
      parentCommentId: null,
      attachments: [],
      mentions: [],
      viaShareToken: token,
      isDecision: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, decision });
  } catch (error) {
    const status = error instanceof ShareAuthError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Failed to record decision";
    return NextResponse.json({ error: message }, { status });
  }
}
