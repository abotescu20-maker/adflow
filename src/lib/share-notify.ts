import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, feedbackEmailHtml } from "@/lib/email";

// Server-side fan-out for guest feedback (Blackframe P4, in-app leg).
// Client/agency feedback used to land silently in Firestore — nobody on the
// team was told. This routes it: members whose craft matches the asset's
// folder, plus the uploader and the workspace owner, get a notification.
// (The email leg comes later; this is the delivery channel that exists today.)

// folder → crafts that care about it. Every label here MUST exist in
// DEFAULT_CRAFTS (schema.ts) — a router that routes to labels nobody can pick
// is dead code.
const FOLDER_CRAFTS: Record<string, string[]> = {
  graphics: ["2D", "3D", "Motion", "VFX", "AI"],
  sound: ["Sunet"],
  edits: ["Montaj", "Regie"],
  final: ["Color", "Montaj", "Producție"],
  footage: ["Producție", "Regie"],
  briefs: ["Producție", "Regie"],
};

export interface GuestFeedbackEvent {
  workspaceId: string;
  campaignId: string;
  assetId: string;
  assetName: string;
  assetFolder?: string;
  guestName: string;
  kind: "comment" | "approved" | "changes_requested";
  preview: string;
  // When the reviewer says WHO the note is for ("Pentru: Color"), that beats
  // the folder heuristic — this is the routing key P4 was designed around.
  targetCraft?: string | null;
}

export async function notifyTeamOfGuestFeedback(
  ev: GuestFeedbackEvent
): Promise<number> {
  const db = adminDb();
  const wsRef = db.collection("workspaces").doc(ev.workspaceId);

  const [wsSnap, membersSnap, assetSnap] = await Promise.all([
    wsRef.get(),
    wsRef.collection("members").get(),
    wsRef
      .collection("campaigns")
      .doc(ev.campaignId)
      .collection("assets")
      .doc(ev.assetId)
      .get(),
  ]);

  const ownerUid = wsSnap.data()?.ownerUid as string | undefined;
  const uploadedBy = assetSnap.data()?.uploadedBy as string | undefined;
  const crafts = ev.targetCraft
    ? [ev.targetCraft]
    : (FOLDER_CRAFTS[ev.assetFolder ?? ""] ?? []);

  const recipients = new Set<string>();
  const emailByUid = new Map<string, string>();
  if (ownerUid) recipients.add(ownerUid);
  if (uploadedBy) recipients.add(uploadedBy);
  membersSnap.docs.forEach((d) => {
    const m = d.data() as {
      uid?: string;
      craft?: string | null;
      email?: string;
    };
    if (m.uid && m.email) emailByUid.set(m.uid, m.email);
    if (m.uid && m.craft && crafts.includes(m.craft)) recipients.add(m.uid);
  });

  const titles: Record<GuestFeedbackEvent["kind"], string> = {
    comment: `Feedback nou de la ${ev.guestName}`,
    approved: `✅ ${ev.guestName} a aprobat`,
    changes_requested: `🔴 ${ev.guestName} cere modificări`,
  };
  const kindMap: Record<GuestFeedbackEvent["kind"], string> = {
    comment: "comment_reply",
    approved: "approval_granted",
    changes_requested: "changes_requested",
  };

  const batch = db.batch();
  recipients.forEach((uid) => {
    const ref = db
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .doc();
    batch.set(ref, {
      uid,
      workspaceId: ev.workspaceId,
      kind: kindMap[ev.kind],
      title: `${titles[ev.kind]} · ${ev.assetName}`,
      body: ev.preview.slice(0, 120),
      actorId: null,
      actorName: ev.guestName,
      targetUrl: `/?campaign=${ev.campaignId}&asset=${ev.assetId}`,
      read: false,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  // P4 email leg: the SAME craft-routed recipients also get an email. No-op
  // until RESEND_API_KEY is configured; in-app notifications never depend on it.
  const emails = [...recipients]
    .map((uid) => emailByUid.get(uid))
    .filter((e): e is string => !!e);
  if (emails.length) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://adflow-theta-plum.vercel.app";
    const html = feedbackEmailHtml({
      title: titles[ev.kind],
      guestName: ev.guestName,
      assetName: ev.assetName,
      body: ev.preview,
      linkUrl: `${appUrl}/?campaign=${ev.campaignId}&asset=${ev.assetId}`,
    });
    // One send per recipient: Resend rejects a whole batch if ANY address is
    // disallowed (pre-domain-verification only the account owner can receive),
    // so batching would silence everyone because of one bad address.
    await Promise.allSettled(
      emails.slice(0, 20).map((to) =>
        sendEmail({
          to: [to],
          subject: `${titles[ev.kind]} · ${ev.assetName}`,
          html,
        })
      )
    );
  }

  return recipients.size;
}
