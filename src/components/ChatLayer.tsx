"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { onSnapshot } from "firebase/firestore";
import { upload } from "@vercel/blob/client";
import {
  MessageCircle,
  X,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  Loader2,
  ChevronLeft,
  AtSign,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useMembers } from "@/hooks/useMembers";
import {
  GENERAL_THREAD_ID,
  threadRef,
  ensureGeneralThread,
  ensureDmThread,
  ensureGodThread,
  godThreadId,
  dmThreadId,
  involvedThreadsQuery,
  messagesQuery,
  sendMessage,
  markMessageRead,
  markMessagesRead,
  notifyChatRecipient,
  godGreeting,
  godChildWord,
  monthsSinceConfession,
} from "@/lib/firestore/chat";
import type { ChatMessage, ChatThread, WorkspaceMember } from "@/lib/schema";
import { BlackMariaMark } from "@/components/BlackMariaLogo";

type Attachment = { url: string; name: string; contentType?: string };

function lastOpenedKey(wsId: string, threadId: string) {
  return `bf:lastOpened:${wsId}:${threadId}`;
}

function isImage(ct?: string) {
  return !!ct && ct.startsWith("image/");
}
function isVideo(ct?: string) {
  return !!ct && ct.startsWith("video/");
}

// Turn bare links into anchors (attachments "links" requirement).
function renderText(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-accent break-all"
      >
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

// rightSlot: the DASHBOARD | CALENDAR | NOTES nav — it lives IN this bar (one
// top band, per the client's mockup), never absolutely positioned over content.
export default function ChatLayer({
  rightSlot,
}: {
  rightSlot?: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const { activeWorkspace, currentMember } = useWorkspace();
  const { members } = useMembers(activeWorkspace?.id ?? null);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [generalThread, setGeneralThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [pendingMentions, setPendingMentions] = useState<WorkspaceMember[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [, bumpDots] = useState(0); // re-render after lastOpened writes
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const reportedErrors = useRef<Set<string>>(new Set());

  const wsId = activeWorkspace?.id ?? null;
  const myUid = user?.uid ?? null;
  const ownerUid = activeWorkspace?.ownerUid ?? null;
  const membersByUid = useMemo(() => {
    const m = new Map<string, WorkspaceMember>();
    members.forEach((x) => m.set(x.uid, x));
    return m;
  }, [members]);

  // Ensure the shared threads exist, subscribe to involved + general.
  useEffect(() => {
    if (!wsId || !myUid || !ownerUid) return;
    ensureGeneralThread(wsId, myUid).catch(() => {});
    ensureGodThread(wsId, myUid, ownerUid).catch(() => {});
    const unsubs = [
      onSnapshot(involvedThreadsQuery(wsId, myUid), (snap) => {
        setThreads(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChatThread)
        );
      }),
      // general has empty participants, so the array-contains query misses it
      onSnapshot(threadRef(wsId, GENERAL_THREAD_ID), (snap) => {
        if (snap.exists())
          setGeneralThread({
            id: snap.id,
            ...(snap.data() as object),
          } as ChatThread);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [wsId, myUid, ownerUid]);

  // Subscribe to the active conversation. The query is newest-first (so a busy
  // thread always shows the latest window) — reverse for display.
  useEffect(() => {
    if (!wsId || !activeThreadId || !myUid) {
      setMessages([]);
      return;
    }
    const unsub = onSnapshot(messagesQuery(wsId, activeThreadId), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ChatMessage)
        .reverse();
      setMessages(list);
      // Auto-read on view: everything you're shown gets ticked, EXCEPT
      // messages that @mention you — those stay red until you tick them
      // yourself (the explicit confirmation the workflow wants).
      const autoIds = list
        .filter(
          (m) =>
            m.authorId !== myUid &&
            !m.readBy.includes(myUid) &&
            !m.mentions?.includes(myUid)
        )
        .map((m) => m.id);
      if (autoIds.length)
        markMessagesRead(wsId, activeThreadId, autoIds, myUid).catch(() => {});
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    });
    // Remember when we opened it (thread-level red dot in the bar).
    localStorage.setItem(
      lastOpenedKey(wsId, activeThreadId),
      String(Date.now())
    );
    bumpDots((n) => n + 1);
    return () => unsub();
  }, [wsId, activeThreadId, myUid]);

  // Deep-link: /?thread=<id> (from notifications) opens that conversation.
  useEffect(() => {
    if (!wsId) return;
    const params = new URLSearchParams(window.location.search);
    const tid = params.get("thread");
    if (tid) {
      setActiveThreadId(tid);
      setOpen(true);
      window.history.replaceState(null, "", "/");
    }
  }, [wsId]);

  // App breaks → tell the superadmin directly on chat (Talk to God, system msg).
  useEffect(() => {
    if (!wsId || !myUid || !ownerUid || !profile) return;
    const report = (raw: string) => {
      const msg = raw.slice(0, 200);
      if (reportedErrors.current.has(msg) || reportedErrors.current.size >= 3)
        return;
      reportedErrors.current.add(msg);
      const tid = godThreadId(myUid);
      sendMessage(wsId, tid, {
        authorId: myUid,
        authorName: profile.displayName,
        text: `⚠️ Ceva nu merge în aplicație: ${msg}`,
        system: true,
      })
        .then(() => {
          if (ownerUid !== myUid)
            notifyChatRecipient({
              recipientUid: ownerUid,
              workspaceId: wsId,
              threadId: tid,
              kind: "god_message",
              actorId: myUid,
              actorName: profile.displayName,
              preview: `⚠️ ${msg}`,
            });
        })
        .catch(() => {});
    };
    const onErr = (e: ErrorEvent) => report(e.message || "eroare necunoscută");
    const onRej = (e: PromiseRejectionEvent) =>
      report(String(e.reason?.message || e.reason || "promise rejection"));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, [wsId, myUid, ownerUid, profile]);

  const openThread = useCallback((id: string) => {
    setActiveThreadId(id);
    setOpen(true);
    setPendingMentions([]);
    setMentionOpen(false);
  }, []);

  if (!user || !profile || !activeWorkspace || !wsId || !myUid || !ownerUid)
    return null;

  const activeThread =
    threads.find((t) => t.id === activeThreadId) ||
    (activeThreadId === GENERAL_THREAD_ID ? generalThread : null);

  // For a DM the stored title is one-sided; compute the other person's name.
  const threadTitle = (t: ChatThread): string => {
    if (t.type === "dm") {
      const other = t.participants.find((p) => p !== myUid);
      return membersByUid.get(other ?? "")?.displayName || t.title;
    }
    if (t.type === "god")
      return t.participants[0] === myUid || t.createdBy === myUid
        ? "Talk to God"
        : `Confesional · ${membersByUid.get(t.createdBy)?.displayName ?? "?"}`;
    return t.title;
  };

  const hasNewDot = (t: ChatThread): boolean => {
    if (!t.lastMessageAt) return false;
    // uid comparison — two people can share a display name
    const isMine = t.lastMessageByUid
      ? t.lastMessageByUid === myUid
      : t.lastMessageBy === profile.displayName;
    if (isMine) return false;
    const seen = Number(localStorage.getItem(lastOpenedKey(wsId, t.id)) || 0);
    return t.lastMessageAt.toDate().getTime() > seen;
  };

  const myGodThread = threads.find((t) => t.id === godThreadId(myUid));
  const godMonths = monthsSinceConfession(myGodThread?.lastMessageAt ?? null);
  const barThreads: ChatThread[] = [
    ...(generalThread ? [generalThread] : []),
    ...threads.filter((t) => t.id !== GENERAL_THREAD_ID),
  ];

  // Conversation background: the person you're writing to (their profile photo
  // + the mark), so you're sure you're writing to the right one.
  let bgPhoto: string | undefined;
  if (activeThread?.type === "dm") {
    const other = activeThread.participants.find((p) => p !== myUid);
    bgPhoto = membersByUid.get(other ?? "")?.photoURL || undefined;
  } else if (pendingMentions.length) {
    bgPhoto = pendingMentions[pendingMentions.length - 1].photoURL || undefined;
  }

  const handleAttach = async (files: FileList | null) => {
    if (!files || !files.length || !activeThreadId) return;
    setUploading(true);
    try {
      const idToken = await user.getIdToken();
      for (const file of Array.from(files)) {
        const path = `workspaces/${wsId}/chat/${activeThreadId}/${Date.now()}-${file.name}`;
        const blob = await upload(path, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: idToken,
        });
        setAttachments((a) => [
          ...a,
          { url: blob.url, name: file.name, contentType: file.type },
        ]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!activeThread || (!text.trim() && !attachments.length) || sending)
      return;
    setSending(true);
    try {
      // Prune ghost mentions: if the user deleted "@Name" from the text, the
      // mention (and its notification) must not go out.
      const liveMentions = pendingMentions.filter((m) =>
        text.includes(`@${m.displayName}`)
      );
      const mentions = liveMentions.map((m) => m.uid);
      await sendMessage(wsId, activeThread.id, {
        authorId: myUid,
        authorName: profile.displayName,
        authorAvatar: profile.photoURL ?? null,
        text: text.trim(),
        mentions,
        attachments,
      });
      // Notify: DM partner / mentioned people / superadmin for god threads.
      const preview =
        text.trim() || `📎 ${attachments[0]?.name ?? "atașament"}`;
      const recipients = new Set<string>();
      if (activeThread.type === "dm")
        activeThread.participants
          .filter((p) => p !== myUid)
          .forEach((p) => recipients.add(p));
      if (activeThread.type === "god" && ownerUid !== myUid)
        recipients.add(ownerUid);
      mentions.forEach((m) => m !== myUid && recipients.add(m));
      await Promise.all(
        [...recipients].map((uid) =>
          notifyChatRecipient({
            recipientUid: uid,
            workspaceId: wsId,
            threadId: activeThread.id,
            kind: activeThread.type === "god" ? "god_message" : "chat_message",
            actorId: myUid,
            actorName: profile.displayName,
            preview,
          })
        )
      );
      setText("");
      setAttachments([]);
      setPendingMentions([]);
    } finally {
      setSending(false);
    }
  };

  const insertMention = (m: WorkspaceMember) => {
    setPendingMentions((p) => (p.find((x) => x.uid === m.uid) ? p : [...p, m]));
    setText((t) => `${t.replace(/@[^@\n]*$/, "")}@${m.displayName} `);
    setMentionOpen(false);
  };

  // [^@\n] instead of \S so multi-word names ("Ana Maria") keep filtering.
  const mentionFilter = (text.match(/@([^@\n]*)$/)?.[1] || "").toLowerCase();
  const mentionMatches = members.filter(
    (m) =>
      m.uid !== myUid && m.displayName.toLowerCase().includes(mentionFilter)
  );

  return (
    <>
      {/* ── Top bar (client mockup: "USERS & MESSAGES") — every member is a
             tab in their department colour; click opens the conversation ── */}
      <div className="flex items-center h-10 px-4 border-b border-border bg-sidebar-bg shrink-0">
        {/* scrollable tabs; the nav on the right never scrolls away */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          <MessageCircle className="w-3.5 h-3.5 text-muted shrink-0 mr-1" />
          {generalThread && (
            <button
              onClick={() => openThread(GENERAL_THREAD_ID)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border-r border-border shrink-0 transition-colors ${
                activeThreadId === GENERAL_THREAD_ID && open
                  ? "text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {hasNewDot(generalThread) && (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              )}
              General
            </button>
          )}
          {members
            .filter((m) => m.uid !== myUid)
            .map((m) => {
              const dm = threads.find((t) => t.id === dmThreadId(myUid, m.uid));
              const active =
                open && activeThreadId === dmThreadId(myUid, m.uid);
              return (
                <button
                  key={m.uid}
                  onClick={async () => {
                    const id = await ensureDmThread(wsId, { uid: myUid }, m);
                    openThread(id);
                  }}
                  title={`${m.displayName}${m.craft ? ` · ${m.craft}` : ""}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold border-r border-border shrink-0 transition-opacity ${
                    active ? "opacity-100" : "opacity-75 hover:opacity-100"
                  }`}
                  style={{ color: m.color || "var(--muted)" }}
                >
                  {dm && hasNewDot(dm) && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  )}
                  {m.displayName.split(" ")[0]}
                </button>
              );
            })}
          {/* non-DM threads you're involved in (god, mentions) */}
          {barThreads
            .filter((t) => t.id !== GENERAL_THREAD_ID && t.type !== "dm")
            .map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium shrink-0 transition-colors ${
                  activeThreadId === t.id && open
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {hasNewDot(t) && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                )}
                {t.type === "god" && <Sparkles className="w-3 h-3" />}
                {threadTitle(t)}
              </button>
            ))}
        </div>
        {rightSlot && (
          <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-border">
            {rightSlot}
          </div>
        )}
      </div>

      {/* ── Corner chat (WhatsApp-style) ────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            if (!activeThreadId) setActiveThreadId(GENERAL_THREAD_ID);
          }}
          className="fixed bottom-5 right-5 z-[70] w-13 h-13 p-3.5 rounded-full bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-hover transition-colors"
          title="Chat"
        >
          <MessageCircle className="w-6 h-6" />
          {barThreads.some(hasNewDot) && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-black" />
          )}
        </button>
      )}

      {open && (
        <div
          className={`fixed bottom-5 right-5 z-[70] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] bg-card-bg border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
            expanded ? "w-[760px] h-[85vh]" : "w-[360px] h-[520px]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
            {activeThread ? (
              <>
                <button
                  onClick={() => setActiveThreadId(null)}
                  className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {activeThread.type === "god" && (
                  <Sparkles className="w-4 h-4 text-accent" />
                )}
                <span className="text-[13px] font-bold flex-1 truncate">
                  {threadTitle(activeThread)}
                </span>
                <button
                  onClick={() => {
                    const ids = messages
                      .filter(
                        (m) => m.authorId !== myUid && !m.readBy.includes(myUid)
                      )
                      .map((m) => m.id);
                    if (ids.length)
                      markMessagesRead(wsId, activeThread.id, ids, myUid);
                  }}
                  title="Marchează tot citit"
                  className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span className="text-[13px] font-bold flex-1">Chat</span>
            )}
            <button
              onClick={() => setExpanded((x) => !x)}
              title={expanded ? "Micșorează" : "Mărește (vezi media mare)"}
              className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
            >
              {expanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Thread list */}
          {!activeThread && (
            <div className="flex-1 overflow-y-auto">
              {/* Talk to God entry — the WhatsApp button from the spec */}
              <button
                onClick={() => openThread(godThreadId(myUid))}
                className="w-full flex items-start gap-2.5 px-3 py-3 border-b border-border text-left hover:bg-card-hover transition-colors"
              >
                <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">Talk to God</p>
                  <p className="text-[11px] text-muted truncate">
                    {godMonths
                      ? `${godChildWord(profile.displayName)}, a trecut ceva timp de la ultima confesiune…`
                      : "linia ta directă cu superadminul"}
                  </p>
                </div>
              </button>
              {barThreads
                .filter((t) => t.id !== godThreadId(myUid))
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openThread(t.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-3 border-b border-border text-left hover:bg-card-hover transition-colors"
                  >
                    {hasNewDot(t) && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">
                        {t.type === "god" && "✦ "}
                        {threadTitle(t)}
                      </p>
                      {t.lastMessageText && (
                        <p className="text-[11px] text-muted truncate">
                          {t.lastMessageBy}: {t.lastMessageText}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              {/* Start a DM */}
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted uppercase tracking-widest">
                Scrie cuiva
              </p>
              {members
                .filter((m) => m.uid !== myUid)
                .map((m) => (
                  <button
                    key={m.uid}
                    onClick={async () => {
                      const id = await ensureDmThread(wsId, { uid: myUid }, m);
                      openThread(id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-card-hover transition-colors"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: m.color || "var(--accent)" }}
                    >
                      {m.displayName[0]?.toUpperCase()}
                    </span>
                    <span className="text-[12px] truncate">
                      {m.displayName}
                    </span>
                  </button>
                ))}
            </div>
          )}

          {/* Conversation */}
          {activeThread && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
                {/* Recipient photo as background + the mark */}
                {bgPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bgPhoto}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
                  />
                ) : (
                  <span className="absolute bottom-3 right-3 text-foreground/5 pointer-events-none">
                    <BlackMariaMark className="w-28 h-28" />
                  </span>
                )}

                {/* God greeting (not stored — He speaks when you enter) */}
                {activeThread.type === "god" && (
                  <div className="relative rounded-xl border border-accent/40 bg-accent-light px-3 py-2 text-[12px]">
                    <p className="font-semibold">
                      {godGreeting(profile.displayName)}
                    </p>
                    {godMonths !== null && (
                      <p className="text-muted mt-0.5">
                        {godMonths === 1
                          ? "A trecut o lună de la ultima ta confesiune."
                          : `Au trecut ${godMonths} luni de la ultima ta confesiune.`}
                      </p>
                    )}
                  </div>
                )}

                {messages.map((m) => {
                  const mine = m.authorId === myUid;
                  // Auto-read covers ordinary messages; only an @mention of ME
                  // stays red until I explicitly tick it.
                  const unread =
                    !mine &&
                    !m.readBy.includes(myUid) &&
                    !!m.mentions?.includes(myUid);
                  const readerNames = m.readBy
                    .filter((r) => r !== m.authorId)
                    .map((r) => membersByUid.get(r)?.displayName ?? "…")
                    .join(", ");
                  return (
                    <div
                      key={m.id}
                      className={`relative max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed border ${
                        mine
                          ? "ml-auto bg-accent-light border-accent/30"
                          : unread
                            ? "bg-card-hover border-red-500/70"
                            : "bg-card-hover border-border"
                      } ${m.system ? "border-amber-500/60" : ""}`}
                    >
                      {!mine && (
                        <p className="text-[10px] font-bold text-muted mb-0.5">
                          {m.authorName}
                        </p>
                      )}
                      {m.text && <p>{renderText(m.text)}</p>}
                      {m.attachments?.map((a, i) =>
                        isImage(a.contentType) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={a.url}
                            alt={a.name}
                            className={`mt-1.5 rounded-lg w-auto ${
                              expanded ? "max-h-[28rem]" : "max-h-40"
                            }`}
                          />
                        ) : isVideo(a.contentType) ? (
                          <video
                            key={i}
                            src={a.url}
                            controls
                            className={`mt-1.5 rounded-lg w-full ${
                              expanded ? "max-h-[28rem]" : "max-h-40"
                            }`}
                          />
                        ) : (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 flex items-center gap-1.5 text-accent underline text-[11px]"
                          >
                            <Paperclip className="w-3 h-3" /> {a.name}
                          </a>
                        )
                      )}
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        {unread ? (
                          <button
                            onClick={() =>
                              markMessageRead(
                                wsId,
                                activeThread.id,
                                m.id,
                                myUid
                              )
                            }
                            className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300"
                            title="Marchează citit"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            citește <Check className="w-3 h-3" />
                          </button>
                        ) : (
                          <span
                            className="flex items-center text-[10px] text-muted"
                            title={
                              readerNames
                                ? `Citit de: ${readerNames}`
                                : "Necitit încă"
                            }
                          >
                            {m.readBy.length > 1 ? (
                              <>
                                <CheckCheck className="w-3 h-3 text-accent" />
                                {m.readBy.length - (mine ? 1 : 0) > 1 &&
                                  ` ${m.readBy.length - 1}`}
                              </>
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-border p-2.5 shrink-0 relative">
                {mentionOpen && mentionMatches.length > 0 && (
                  <div className="absolute bottom-full left-2.5 right-2.5 mb-1 bg-card-bg border border-border rounded-xl shadow-xl max-h-40 overflow-y-auto z-10">
                    {mentionMatches.map((m, i) => (
                      <button
                        key={m.uid}
                        onClick={() => insertMention(m)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-card-hover ${
                          i === 0 ? "bg-card-hover" : ""
                        }`}
                      >
                        <AtSign className="w-3 h-3 text-accent" />
                        {m.displayName}
                        {i === 0 && (
                          <span className="ml-auto text-[9px] text-muted">
                            Tab ↹
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {attachments.map((a, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 text-[10px] bg-card-hover border border-border rounded px-1.5 py-0.5"
                      >
                        <Paperclip className="w-3 h-3" />
                        {a.name.slice(0, 18)}
                        <button
                          onClick={() =>
                            setAttachments((x) => x.filter((_, j) => j !== i))
                          }
                          className="text-muted hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => handleAttach(e.target.files)}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover disabled:opacity-50"
                    title="Atașează (poze, video, PDF, docs)"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setMentionOpen(/@[^@\n]*$/.test(e.target.value));
                    }}
                    onKeyDown={(e) => {
                      // Tab completes the top mention match, keyboard-first.
                      if (
                        e.key === "Tab" &&
                        mentionOpen &&
                        mentionMatches.length > 0
                      ) {
                        e.preventDefault();
                        insertMention(mentionMatches[0]);
                        return;
                      }
                      if (e.key === "Escape") setMentionOpen(false);
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={
                      activeThread.type === "god"
                        ? "Confesează-te…"
                        : "Scrie… (@ pentru destinatar)"
                    }
                    className="flex-1 resize-none px-3 py-2 rounded-lg border border-border bg-transparent text-[12px] focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleSend}
                    disabled={
                      sending ||
                      uploading ||
                      (!text.trim() && !attachments.length)
                    }
                    className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
