import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

// Server-side fan-out for guest feedback (Blackframe P4, in-app leg).
// Client/agency feedback used to land silently in Firestore — nobody on the
// team was told. This routes it: members whose craft matches the asset's
// folder, plus the uploader and the workspace owner, get a notification.
// (The email leg comes later; this is the delivery channel that exists today.)

// folder → crafts that care about it (matches DEFAULT_CRAFTS labels)
const FOLDER_CRAFTS: Record<string, string[]> = {
  graphics: ["2D", "3D", "Motion", "VFX", "AI"],
  sound: ["Sunet"],
  edits: ["Montaj", "Edit", "Regie"],
  final: ["Color", "Montaj", "Producție"],
  footage: ["Producție", "Regie"],
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
  const crafts = FOLDER_CRAFTS[ev.assetFolder ?? ""] ?? [];

  const recipients = new Set<string>();
  if (ownerUid) recipients.add(ownerUid);
  if (uploadedBy) recipients.add(uploadedBy);
  membersSnap.docs.forEach((d) => {
    const m = d.data() as { uid?: string; craft?: string | null };
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
  return recipients.size;
}
