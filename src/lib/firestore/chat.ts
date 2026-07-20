import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit as fsLimit,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createNotification } from "@/lib/firestore/notifications";
import type { ChatThread, ChatThreadType } from "@/lib/schema";

export function threadsRef(workspaceId: string) {
  return collection(db, "workspaces", workspaceId, "threads");
}

export function threadRef(workspaceId: string, threadId: string) {
  return doc(db, "workspaces", workspaceId, "threads", threadId);
}

export function messagesRef(workspaceId: string, threadId: string) {
  return collection(
    db,
    "workspaces",
    workspaceId,
    "threads",
    threadId,
    "messages"
  );
}

export function messageRef(
  workspaceId: string,
  threadId: string,
  msgId: string
) {
  return doc(
    db,
    "workspaces",
    workspaceId,
    "threads",
    threadId,
    "messages",
    msgId
  );
}

// Threads the user is involved in (the top bar). General is fetched separately
// since its participants list is empty (= everyone).
export function involvedThreadsQuery(workspaceId: string, uid: string) {
  return query(
    threadsRef(workspaceId),
    where("participants", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
    fsLimit(20)
  );
}

export function messagesQuery(
  workspaceId: string,
  threadId: string,
  max = 100
) {
  return query(
    messagesRef(workspaceId, threadId),
    orderBy("createdAt", "asc"),
    fsLimit(max)
  );
}

// --- deterministic thread ids so we never create duplicates ---

export const GENERAL_THREAD_ID = "general";

export function dmThreadId(uidA: string, uidB: string): string {
  return `dm_${[uidA, uidB].sort().join("_")}`;
}

export function godThreadId(uid: string): string {
  return `god_${uid}`;
}

async function ensureThread(
  workspaceId: string,
  threadId: string,
  data: {
    type: ChatThreadType;
    title: string;
    participants: string[];
    createdBy: string;
  }
): Promise<void> {
  const ref = threadRef(workspaceId, threadId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Keep participants in sync (e.g. a new mention joins the thread).
    if (data.participants.length)
      await updateDoc(ref, { participants: arrayUnion(...data.participants) });
    return;
  }
  await setDoc(ref, {
    workspaceId,
    type: data.type,
    title: data.title,
    participants: data.participants,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageText: "",
    lastMessageBy: "",
  });
}

export async function ensureGeneralThread(workspaceId: string, uid: string) {
  await ensureThread(workspaceId, GENERAL_THREAD_ID, {
    type: "general",
    title: "General",
    participants: [],
    createdBy: uid,
  });
}

export async function ensureDmThread(
  workspaceId: string,
  me: { uid: string },
  other: { uid: string; displayName: string }
): Promise<string> {
  const id = dmThreadId(me.uid, other.uid);
  await ensureThread(workspaceId, id, {
    type: "dm",
    title: other.displayName,
    participants: [me.uid, other.uid],
    createdBy: me.uid,
  });
  return id;
}

export async function ensureGodThread(
  workspaceId: string,
  uid: string,
  ownerUid: string
): Promise<string> {
  const id = godThreadId(uid);
  await ensureThread(workspaceId, id, {
    type: "god",
    title: "Talk to God",
    participants: uid === ownerUid ? [uid] : [uid, ownerUid],
    createdBy: uid,
  });
  return id;
}

// --- messages ---

export interface SendMessageInput {
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  text: string;
  mentions?: string[];
  attachments?: { url: string; name: string; contentType?: string }[];
  system?: boolean;
}

export async function sendMessage(
  workspaceId: string,
  threadId: string,
  input: SendMessageInput
): Promise<string> {
  const msg = await addDoc(messagesRef(workspaceId, threadId), {
    threadId,
    authorId: input.authorId,
    authorName: input.authorName,
    authorAvatar: input.authorAvatar ?? null,
    text: input.text,
    mentions: input.mentions ?? [],
    attachments: input.attachments ?? [],
    readBy: [input.authorId], // your own message isn't red for you
    system: input.system ?? false,
    createdAt: serverTimestamp(),
  });
  const patch: Record<string, unknown> = {
    lastMessageAt: serverTimestamp(),
    lastMessageText: input.text.slice(0, 80),
    lastMessageBy: input.authorName,
  };
  // Mentioned people become participants → the thread shows up in their bar.
  if (input.mentions?.length)
    patch.participants = arrayUnion(...input.mentions);
  await updateDoc(threadRef(workspaceId, threadId), patch);
  return msg.id;
}

export async function markMessageRead(
  workspaceId: string,
  threadId: string,
  msgId: string,
  uid: string
): Promise<void> {
  await updateDoc(messageRef(workspaceId, threadId, msgId), {
    readBy: arrayUnion(uid),
  });
}

// Notify a recipient that they have something to read.
export async function notifyChatRecipient(opts: {
  recipientUid: string;
  workspaceId: string;
  kind: "chat_message" | "god_message";
  actorId: string;
  actorName: string;
  preview: string;
}): Promise<void> {
  await createNotification({
    uid: opts.recipientUid,
    workspaceId: opts.workspaceId,
    kind: opts.kind,
    title:
      opts.kind === "god_message"
        ? "Confesiune nouă"
        : `Mesaj nou de la ${opts.actorName}`,
    body: opts.preview.slice(0, 120),
    actorId: opts.actorId,
    actorName: opts.actorName,
    targetUrl: "/",
  });
}

// ============================================================================
// Talk to God — greeting logic (client decision 17.07.2026: small name lists,
// "-a ending ⇒ female" as backup, default "fiule" when unsure)
// ============================================================================

const FEMALE_NAMES = new Set([
  "maria",
  "ioana",
  "elena",
  "ana",
  "andreea",
  "alexandra",
  "cristina",
  "diana",
  "gabriela",
  "mihaela",
  "roxana",
  "raluca",
  "simona",
  "laura",
  "larisa",
  "bianca",
  "daniela",
  "adriana",
  "monica",
  "irina",
  "oana",
  "corina",
  "camelia",
  "carmen",
  "georgiana",
  "alina",
  "iulia",
  "anca",
  "teodora",
  "sorina",
  "luana",
  "rita",
  "codruta",
  "denisa",
  "ramona",
  "florentina",
  "valentina",
  "nicoleta",
  "loredana",
  "madalina",
  "ancuta",
]);

const MALE_NAMES = new Set([
  "andrei",
  "mihai",
  "alexandru",
  "ion",
  "george",
  "stefan",
  "cristian",
  "florin",
  "adrian",
  "daniel",
  "marius",
  "ionut",
  "bogdan",
  "radu",
  "vlad",
  "catalin",
  "gabriel",
  "victor",
  "paul",
  "dan",
  "sorin",
  "lucian",
  "ovidiu",
  "cosmin",
  "dragos",
  "tudor",
  "horia",
  "sebastian",
  "eduard",
  "iulian",
  "nicolae",
  "vasile",
  "petre",
  "doru",
  "liviu",
  "karsten",
  "angelo",
  "oliver",
]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export type InferredGender = "female" | "male" | "unknown";

export function inferGenderFromName(displayName: string): InferredGender {
  const first = stripDiacritics(
    (displayName.trim().split(/\s+/)[0] || "").toLowerCase()
  );
  if (!first) return "unknown";
  if (FEMALE_NAMES.has(first)) return "female";
  if (MALE_NAMES.has(first)) return "male";
  if (first.endsWith("a")) return "female"; // backup heuristic
  return "unknown";
}

export function godGreeting(displayName: string): string {
  switch (inferGenderFromName(displayName)) {
    case "female":
      return "Spune, fiica mea.";
    case "male":
      return "Spune, fiul meu.";
    default:
      return "Spune, fiule."; // "dacă nu poți, nu contează, zi fiule"
  }
}

export function godChildWord(displayName: string): string {
  return inferGenderFromName(displayName) === "female" ? "fiica mea" : "fiule";
}

// "au trecut X luni de la ultima ta confesiune" — null when recent or never.
export function monthsSinceConfession(
  lastMessageAt: Timestamp | undefined | null
): number | null {
  if (!lastMessageAt) return null;
  const then = lastMessageAt.toDate().getTime();
  const months = Math.floor((Date.now() - then) / (30 * 24 * 3600 * 1000));
  return months >= 1 ? months : null;
}
