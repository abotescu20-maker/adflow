import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";

// POST /api/join/[token]
// An invited user accepts a workspace invitation. Invitations live under
// /workspaces/{ws}/invitations and a non-member cannot read them or add
// themselves via client rules, so acceptance runs on the trusted server tier:
// verify the caller's ID token, look up the invite by token, validate it, then
// create the member doc + add the workspace to the user's profile.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const body = (await request.json().catch(() => ({}))) as { idToken?: string };

    const decoded = await verifyIdToken(body.idToken);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase();
    const displayName =
      (decoded.name as string) || (decoded.email as string) || "Member";
    const photoURL = (decoded.picture as string) || null;

    if (!token || token.length < 8) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
    }

    // Find the invitation by token across all workspaces.
    const snap = await adminDb()
      .collectionGroup("invitations")
      .where("token", "==", token)
      .limit(1)
      .get();
    if (snap.empty) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    const inviteDoc = snap.docs[0];
    const invite = inviteDoc.data() as {
      workspaceId: string;
      workspaceName?: string;
      email?: string;
      role?: string;
      expiresAt?: { toMillis?: () => number } | null;
      acceptedAt?: unknown;
    };

    if (invite.acceptedAt) {
      // Already accepted — if it's this same user, treat as success (idempotent).
      // Otherwise reject.
    }
    const exp = invite.expiresAt?.toMillis?.();
    if (typeof exp === "number" && exp < Date.now()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }
    if (invite.email && email && invite.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: `This invite is for ${invite.email}. Sign in with that account to join.` },
        { status: 403 }
      );
    }

    const workspaceId = invite.workspaceId;
    const role = invite.role || "reviewer";

    const db = adminDb();
    const batch = db.batch();
    // Member doc
    batch.set(
      db.collection("workspaces").doc(workspaceId).collection("members").doc(uid),
      {
        uid,
        email: email || null,
        displayName,
        photoURL,
        role,
        addedAt: FieldValue.serverTimestamp(),
        addedBy: "invite",
      },
      { merge: true }
    );
    // Add workspace to the user's profile so it shows in their switcher.
    batch.set(
      db.collection("users").doc(uid),
      { workspaces: FieldValue.arrayUnion(workspaceId) },
      { merge: true }
    );
    // Mark the invitation accepted.
    batch.set(
      inviteDoc.ref,
      { acceptedAt: FieldValue.serverTimestamp(), acceptedByUid: uid },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({
      ok: true,
      workspaceId,
      workspaceName: invite.workspaceName || null,
      role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join";
    const status = /token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
