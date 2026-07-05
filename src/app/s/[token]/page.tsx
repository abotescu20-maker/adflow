"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import {
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Film,
  Music,
  FileText,
  Image as ImageIcon,
  Zap,
  MessageSquare,
  Clock,
} from "lucide-react";
import type { Asset, Campaign } from "@/lib/schema";

interface PublicShare {
  token: string;
  workspaceId: string;
  shareLinkId: string;
  campaignId: string | null;
  assetIds: string[];
  permissions: {
    canView: boolean;
    canComment: boolean;
    canApprove: boolean;
    canDownload: boolean;
  };
  expiresAt: { toMillis: () => number } | null;
  revokedAt: { toMillis: () => number } | null;
}

interface ShareComment {
  id: string;
  authorName: string;
  text: string;
  timecode: number | null;
  isDecision: boolean;
}

function formatTc(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | {
        kind: "ready";
        share: PublicShare;
        campaign: Campaign | null;
        assets: Asset[];
      }
  >({ kind: "loading" });
  const [activeIndex, setActiveIndex] = useState(0);
  // Guest review interaction (02.07.2026): name + comment + approve/request-changes,
  // all persisted server-side via /api/share/[token]/* (Firestore rules forbid
  // anonymous writes, so the trusted server tier does it after validating the token).
  const [guestName, setGuestName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [comments, setComments] = useState<ShareComment[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadComments = useCallback(
    async (assetId: string) => {
      try {
        const res = await fetch(
          `/api/share/${token}/comments?assetId=${encodeURIComponent(assetId)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const d = await res.json();
          setComments((d.comments as ShareComment[]) || []);
        }
      } catch {
        /* comments are non-essential to the page */
      }
    },
    [token]
  );

  function seekTo(seconds: number) {
    const v = videoRef.current;
    if (v && isFinite(seconds)) {
      v.currentTime = seconds;
      v.play().catch(() => {});
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("adflow_guest_name");
      if (saved) setGuestName(saved);
    } catch {}
  }, []);

  // Load the public comment thread whenever the resolved share/active asset changes.
  useEffect(() => {
    if (state.kind !== "ready") return;
    const a = state.assets[activeIndex];
    if (a) loadComments(a.id);
  }, [state, activeIndex, loadComments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve the share via the trusted server tier. The client SDK CANNOT read
        // the workspace's assets (Firestore rules forbid anonymous reads), so the
        // server (Admin SDK) validates the token and returns only the shared assets.
        const res = await fetch(`/api/share/${token}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            res.status === 410
              ? data.error || "This link has expired or was revoked"
              : res.status === 404
                ? "Link not found"
                : data.error || "Unable to load share";
          if (!cancelled) setState({ kind: "error", message: msg });
          return;
        }
        if (!cancelled) {
          setState({
            kind: "ready",
            share: data.share as PublicShare,
            campaign: (data.campaign as Campaign) ?? null,
            assets: (data.assets as Asset[]) ?? [],
          });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setState({ kind: "error", message: "Unable to load share" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold mb-2">{state.message}</h2>
          <p className="text-sm text-muted">
            This link may have been revoked or expired. Contact the sender for a new link.
          </p>
        </div>
      </div>
    );
  }

  const { share, campaign, assets } = state;
  const asset = assets[activeIndex];

  function rememberName() {
    try {
      if (guestName.trim()) localStorage.setItem("adflow_guest_name", guestName.trim());
    } catch {}
  }

  async function postComment() {
    if (!asset || !commentText.trim() || busy) return;
    setBusy(true);
    setFlash(null);
    try {
      rememberName();
      const tc =
        videoRef.current && isFinite(videoRef.current.currentTime)
          ? videoRef.current.currentTime
          : undefined;
      const res = await fetch(`/api/share/${token}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          text: commentText.trim(),
          guestName: guestName.trim(),
          timecode: tc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post comment");
      setCommentText("");
      setFlash({ kind: "ok", msg: "Comment sent to the team ✓" });
      loadComments(asset.id);
    } catch (e) {
      setFlash({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approved" | "changes_requested") {
    if (!asset || busy) return;
    setBusy(true);
    setFlash(null);
    try {
      rememberName();
      const res = await fetch(`/api/share/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          decision,
          guestName: guestName.trim(),
          note: commentText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record decision");
      setCommentText("");
      setFlash({
        kind: "ok",
        msg: decision === "approved" ? "Approved ✓ — the team was notified" : "Changes requested ✓",
      });
      loadComments(asset.id);
    } catch (e) {
      setFlash({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">AdFlow Review</h1>
            <p className="text-[11px] text-muted">
              {campaign?.name || asset?.name || "Client review"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <Lock className="w-3 h-3" />
          Public review link
        </div>
      </header>

      {/* Layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Asset list sidebar */}
        {assets.length > 1 && (
          <aside className="w-60 border-r border-border bg-white p-3 overflow-y-auto">
            <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2 px-1">
              {assets.length} items
            </h3>
            <div className="space-y-1">
              {assets.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setActiveIndex(i)}
                  className={`w-full text-left p-2 rounded-lg transition-colors flex items-center gap-2 ${
                    i === activeIndex
                      ? "bg-accent-light text-accent"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <AssetTypeIcon type={a.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.name}</p>
                    <p className="text-[10px] text-muted">V{a.version}</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Main viewer */}
        <main className="flex-1 flex flex-col">
          {asset ? (
            <>
              <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                <MediaPreview asset={asset} videoRef={videoRef} />
                <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-bold shadow-lg">
                  V{asset.version}
                </div>
                {share.permissions.canDownload && asset.downloadURL && (
                  <a
                    href={asset.downloadURL}
                    download={asset.originalFileName}
                    className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 text-slate-800 hover:bg-white transition-colors shadow-lg backdrop-blur-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}
              </div>

              {/* Footer: review actions (name + comment + approve/request changes) */}
              <div className="bg-white border-t border-border px-6 py-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{asset.name}</h4>
                    <p className="text-[11px] text-muted">
                      {asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}
                      {asset.durationSeconds ? ` · ${Math.round(asset.durationSeconds)}s` : ""}
                    </p>
                  </div>
                  {(share.permissions.canComment || share.permissions.canApprove) && (
                    <input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Your name"
                      className="w-40 shrink-0 px-3 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  )}
                </div>

                {(share.permissions.canComment || share.permissions.canApprove) && (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={
                        share.permissions.canComment
                          ? "Leave feedback for the team…"
                          : "Add a note (optional)…"
                      }
                      rows={2}
                      className="flex-1 px-3 py-2 rounded-lg border border-border text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <div className="flex flex-col gap-2">
                      {share.permissions.canComment && (
                        <button
                          onClick={postComment}
                          disabled={busy || !commentText.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-border text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          Send comment
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {share.permissions.canApprove && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decide("changes_requested")}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-border text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Request Changes
                    </button>
                    <button
                      onClick={() => decide("approved")}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-40"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </div>
                )}

                {flash && (
                  <p
                    className={`text-[11px] font-medium ${
                      flash.kind === "ok" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {flash.msg}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted">No assets in this share</p>
            </div>
          )}
        </main>

        {/* Comments thread — the reviewer sees feedback + decisions, with clickable
            timecodes that seek the video (frame.io-style). */}
        {asset && (share.permissions.canComment || comments.length > 0) && (
          <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border bg-white flex flex-col max-h-[40vh] md:max-h-none">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">
                Comments {comments.length > 0 ? `(${comments.length})` : ""}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted">No comments yet</p>
                  <p className="text-xs text-muted mt-1">
                    Be the first to leave feedback.
                  </p>
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-2.5 ${
                      c.isDecision ? "border-accent/30 bg-accent-light/40" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {c.authorName}
                      </span>
                      {c.timecode != null && (
                        <button
                          onClick={() => seekTo(c.timecode as number)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-light text-accent text-[10px] font-mono font-semibold hover:bg-accent hover:text-white transition-colors shrink-0"
                          title="Jump to this moment"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {formatTc(c.timecode)}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {c.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="bg-white border-t border-border px-6 py-2.5 flex items-center justify-between text-[11px] text-muted">
        <span>Powered by AdFlow</span>
        <span>Permissions: {permissionsSummary(share.permissions)}</span>
      </footer>
    </div>
  );
}

function permissionsSummary(p: PublicShare["permissions"]): string {
  const parts: string[] = [];
  if (p.canView) parts.push("View");
  if (p.canComment) parts.push("Comment");
  if (p.canApprove) parts.push("Approve");
  if (p.canDownload) parts.push("Download");
  return parts.join(" · ") || "View only";
}

function AssetTypeIcon({ type }: { type: Asset["type"] }) {
  const cls = "w-3.5 h-3.5 text-muted shrink-0";
  if (type === "video") return <Film className={cls} />;
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "audio") return <Music className={cls} />;
  return <FileText className={cls} />;
}

function MediaPreview({
  asset,
  videoRef,
}: {
  asset: Asset;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const src = asset.downloadURL || asset.storagePath;
  if (!src) {
    return (
      <div className="text-center">
        <Film className="w-16 h-16 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{asset.name}</p>
      </div>
    );
  }
  if (asset.type === "video") {
    return (
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        className="max-w-full max-h-full"
      />
    );
  }
  if (asset.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={asset.name} className="max-w-full max-h-full object-contain" />;
  }
  if (asset.type === "audio") {
    return (
      <div className="flex flex-col items-center gap-4">
        <Music className="w-16 h-16 text-slate-500" />
        <audio src={src} controls className="w-80" />
      </div>
    );
  }
  return (
    <div className="text-center">
      <FileText className="w-16 h-16 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-400 text-sm mb-2">{asset.name}</p>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent hover:text-accent-hover font-semibold"
      >
        Open file →
      </a>
    </div>
  );
}
