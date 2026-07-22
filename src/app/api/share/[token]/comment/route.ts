import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  resolveShare,
  assertAssetInShare,
  cleanText,
  ShareAuthError,
} from "@/lib/share-server";
import { notifyTeamOfGuestFeedback } from "@/lib/share-notify";

// POST /api/share/[token]/comment
// Guest (unauthenticated) reviewer leaves a comment via a valid share link.
// All authorization is server-side (Admin SDK bypasses Firestore rules).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const share = await resolveShare(token);
    if (!share.permissions.canComment) {
      throw new ShareAuthError("Commenting is not allowed on this link", 403);
    }

    const body = (await request.json()) as {
      assetId?: string;
      text?: string;
      timecode?: number;
      guestName?: string;
      guestEmail?: string;
      targetCraft?: string;
    };

    const campaignId = assertAssetInShare(share, String(body.assetId ?? ""));
    const text = cleanText(body.text, 4000);
    if (!text) throw new ShareAuthError("Comment text is required", 400);
    const guestName = cleanText(body.guestName, 80) || "Guest reviewer";
    // Optional identity + routing key from the reviewer.
    const rawEmail = cleanText(body.guestEmail, 120);
    const guestEmail =
      rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
    const targetCraft = cleanText(body.targetCraft, 40) || null;
    const timecode =
      typeof body.timecode === "number" &&
      isFinite(body.timecode) &&
      body.timecode >= 0
        ? body.timecode
        : null;

    const assetRef = adminDb()
      .collection("workspaces")
      .doc(share.workspaceId)
      .collection("campaigns")
      .doc(campaignId)
      .collection("assets")
      .doc(String(body.assetId));

    const ref = await assetRef.collection("comments").add({
      workspaceId: share.workspaceId,
      campaignId,
      assetId: String(body.assetId),
      authorId: `guest:${token.slice(0, 12)}`,
      authorName: `${guestName} (Guest)`,
      authorAvatar: null,
      text,
      timecode,
      visibility: "public",
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
      parentCommentId: null,
      attachments: [],
      mentions: [],
      viaShareToken: token,
      guestEmail,
      targetCraft,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // In-app fan-out routed by the asset's folder → interested crafts.
    // A failure here must not fail the guest's comment.
    try {
      const assetData = (await assetRef.get()).data() ?? {};
      await notifyTeamOfGuestFeedback({
        workspaceId: share.workspaceId,
        campaignId,
        assetId: String(body.assetId),
        assetName: String(assetData.name ?? "Asset"),
        assetFolder: assetData.folder as string | undefined,
        guestName,
        kind: "comment",
        preview: targetCraft ? `[${targetCraft}] ${text}` : text,
        targetCraft,
      });
    } catch (e) {
      console.error("guest-feedback fan-out failed:", e);
    }

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const status = error instanceof ShareAuthError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Failed to post comment";
    return NextResponse.json({ error: message }, { status });
  }
}
