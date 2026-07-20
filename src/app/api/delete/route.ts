import { NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";

// POST /api/delete — cascade delete for assets and campaigns (#34).
// Client-side deleteDoc removed only the parent document, orphaning every
// subcollection (comments, versions, reviewRounds; assets under a campaign) as
// invisible-but-billed garbage. This route authenticates the caller, checks
// their workspace role, and uses the Admin SDK's recursiveDelete so the whole
// subtree actually goes away.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      workspaceId?: string;
      campaignId?: string;
      assetId?: string;
    };
    const { uid } = await verifyIdToken(body.idToken);
    const workspaceId = String(body.workspaceId ?? "");
    const campaignId = String(body.campaignId ?? "");
    if (!workspaceId || !campaignId) {
      return NextResponse.json({ error: "Missing scope" }, { status: 400 });
    }

    const db = adminDb();
    const member = await db
      .collection("workspaces")
      .doc(workspaceId)
      .collection("members")
      .doc(uid)
      .get();
    const role = member.data()?.role as string | undefined;
    if (!role || !["owner", "admin", "editor"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: role cannot delete" },
        { status: 403 }
      );
    }

    const campaignRef = db
      .collection("workspaces")
      .doc(workspaceId)
      .collection("campaigns")
      .doc(campaignId);

    if (body.assetId) {
      await db.recursiveDelete(
        campaignRef.collection("assets").doc(String(body.assetId))
      );
    } else {
      // whole campaign: only owner/admin
      if (!["owner", "admin"].includes(role)) {
        return NextResponse.json(
          { error: "Forbidden: only owner/admin can delete a campaign" },
          { status: 403 }
        );
      }
      await db.recursiveDelete(campaignRef);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    const status = /token|auth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
