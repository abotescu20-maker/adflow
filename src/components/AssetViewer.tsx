"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
  Send,
  Paperclip,
  Smile,
  AtSign,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  MoreHorizontal,
  Pencil,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  Film,
  Music,
  Loader2,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { useAsset } from "@/hooks/useAssets";
import { useComments } from "@/hooks/useComments";
import { useAuth } from "@/lib/auth-context";
import {
  createComment,
  resolveComment,
  unresolveComment,
} from "@/lib/firestore/comments";
import { updateAssetStatus } from "@/lib/firestore/assets";
import {
  incrementAssetCommentsCount,
} from "@/lib/firestore/assets";
import type {
  Asset,
  Comment as CommentType,
  ApprovalStatus,
} from "@/lib/schema";

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTimeAgo(ts: CommentType["createdAt"]): string {
  try {
    const d = ts.toDate();
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface Props {
  workspaceId: string;
  campaignId: string;
  assetId: string;
  onBack: () => void;
}

export default function AssetViewer({ workspaceId, campaignId, assetId, onBack }: Props) {
  const { user, profile } = useAuth();
  const { asset, loading: assetLoading } = useAsset(workspaceId, campaignId, assetId);
  const { comments, loading: commentsLoading } = useComments(
    workspaceId,
    campaignId,
    assetId
  );

  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<"comments" | "details">("comments");
  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"public" | "team">("public");
  const [sendingComment, setSendingComment] = useState(false);
  const [approving, setApproving] = useState(false);

  const duration = asset?.durationSeconds || 0;
  const currentTimecode = formatTimecode(currentTime);

  const handleSendComment = async () => {
    if (!user || !profile || !asset || !commentText.trim()) return;
    setSendingComment(true);
    try {
      const videoDuration = videoEl?.duration || duration;
      const videoTime = videoEl?.currentTime ?? currentTime;
      await createComment(workspaceId, campaignId, assetId, {
        text: commentText.trim(),
        timecode: videoDuration > 0 ? videoTime : undefined,
        visibility: commentVisibility,
        authorId: user.uid,
        authorName: profile.displayName,
        authorAvatar: profile.photoURL,
      });
      await incrementAssetCommentsCount(workspaceId, campaignId, assetId, 1);
      setCommentText("");
    } catch (err) {
      console.error(err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleApprove = async (status: ApprovalStatus) => {
    if (!user || !asset) return;
    setApproving(true);
    try {
      await updateAssetStatus(workspaceId, campaignId, assetId, status, user.uid);
    } finally {
      setApproving(false);
    }
  };

  const handleResolve = async (comment: CommentType) => {
    if (!user) return;
    if (comment.resolved) {
      await unresolveComment(workspaceId, campaignId, assetId, comment.id);
      await incrementAssetCommentsCount(workspaceId, campaignId, assetId, 0, 1);
    } else {
      await resolveComment(workspaceId, campaignId, assetId, comment.id, user.uid);
      await incrementAssetCommentsCount(workspaceId, campaignId, assetId, 0, -1);
    }
  };

  if (assetLoading || !asset) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{asset.name}</h3>
            <p className="text-[11px] text-muted capitalize">{asset.folder}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-sm text-muted bg-slate-50 rounded-lg px-2 py-1">
            <button className="p-0.5 hover:text-foreground transition-colors" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium">V{asset.version}</span>
            <button className="p-0.5 hover:text-foreground transition-colors" disabled>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-5 bg-border" />
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video player area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden">
            {asset.type === "video" && asset.storagePath ? (
              <video
                ref={setVideoEl}
                src={asset.storagePath}
                className="max-w-full max-h-full"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setCurrentTime(t);
                  if (e.currentTarget.duration > 0) setProgress((t / e.currentTarget.duration) * 100);
                }}
                controls={false}
                playsInline
              />
            ) : asset.type === "image" && asset.storagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.storagePath} alt={asset.name} className="max-w-full max-h-full object-contain" />
            ) : asset.type === "audio" && asset.storagePath ? (
              <div className="flex flex-col items-center gap-4">
                <Music className="w-20 h-20 text-slate-500" />
                <p className="text-slate-400 text-sm">{asset.name}</p>
                <audio src={asset.storagePath} controls className="w-80" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                  <Film className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">{asset.name}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
                    {asset.format && ` · ${asset.format}`}
                  </p>
                </div>
              </div>
            )}

            {asset.type === "video" && asset.storagePath && !isPlaying && (
              <button
                onClick={() => videoEl?.play()}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-md border border-white/30"
              >
                <Play className="w-7 h-7 text-white ml-1" />
              </button>
            )}

            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-bold shadow-lg z-20">V{asset.version}</div>

            {/* Approval buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => handleApprove("approved")}
                disabled={approving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button
                onClick={() => handleApprove("revision")}
                disabled={approving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 text-red-600 hover:bg-white transition-colors shadow-lg backdrop-blur-sm disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Request Changes
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border-t border-border px-5 py-3">
            <div
              className="timeline-track mb-2.5"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                const d = videoEl?.duration || duration;
                if (videoEl && d > 0) {
                  videoEl.currentTime = (pct / 100) * d;
                } else {
                  setProgress(pct);
                  if (d > 0) setCurrentTime((pct / 100) * d);
                }
              }}
            >
              <div className="timeline-progress" style={{ width: `${progress}%` }} />
            </div>

            {/* Comment markers */}
            <div className="relative h-3 mb-2">
              {comments.map((comment) => {
                const d = videoEl?.duration || duration;
                if (typeof comment.timecode !== "number" || d === 0) return null;
                const pos = (comment.timecode / d) * 100;
                return (
                  <button
                    key={comment.id}
                    onClick={() => {
                      if (videoEl) videoEl.currentTime = comment.timecode!;
                      else {
                        setCurrentTime(comment.timecode!);
                        setProgress((comment.timecode! / d) * 100);
                      }
                    }}
                    className="absolute top-0 w-3 h-3 rounded-full bg-accent/50 hover:bg-accent cursor-pointer transition-all hover:scale-125 -translate-x-1/2 border-2 border-white shadow-sm"
                    style={{ left: `${pos}%` }}
                    title={`${comment.authorName}: ${comment.text.slice(0, 50)}...`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => videoEl && (videoEl.currentTime = Math.max(0, videoEl.currentTime - 5))}
                  disabled={!videoEl}
                  className="p-1 text-muted hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (!videoEl) return;
                    if (videoEl.paused) videoEl.play();
                    else videoEl.pause();
                  }}
                  disabled={!videoEl}
                  className="p-1.5 rounded-full bg-accent text-white shadow-sm hover:bg-accent-hover transition-colors disabled:opacity-40"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => videoEl && (videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 5))}
                  disabled={!videoEl}
                  className="p-1 text-muted hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted font-medium ml-1">1.0x</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-accent">{currentTimecode}</span>
                <span className="text-xs text-slate-300">/</span>
                <span className="font-mono text-sm text-muted">{formatTimecode(videoEl?.duration || duration)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                <button
                  onClick={() => videoEl && (videoEl.muted = !videoEl.muted)}
                  className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => videoEl?.requestFullscreen()}
                  className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[340px] border-l border-border flex flex-col bg-white shrink-0">
          <div className="flex border-b border-border">
            {(["comments", "details"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-semibold text-center transition-colors capitalize ${
                  activeTab === tab ? "text-accent border-b-2 border-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {tab === "comments" ? `Comments (${comments.length})` : "Details"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "comments" ? (
              <div className="p-4 space-y-3">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted">No comments yet</p>
                    <p className="text-xs text-muted mt-1">Be the first to leave feedback</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      canResolve={!!user}
                      onResolve={() => handleResolve(comment)}
                      onSeek={(t) => {
                        if (videoEl) videoEl.currentTime = t;
                        else {
                          setCurrentTime(t);
                          if (duration > 0) setProgress((t / duration) * 100);
                        }
                      }}
                    />
                  ))
                )}
              </div>
            ) : (
              <DetailsTab asset={asset} />
            )}
          </div>

          {/* Comment input */}
          {activeTab === "comments" && (
            <div className="border-t border-border p-4 bg-slate-50/50">
              <div className="flex items-center gap-1.5 mb-2">
                {duration > 0 && (
                  <span className="font-mono text-[11px] text-accent bg-accent-light px-2 py-0.5 rounded-md font-semibold">
                    {currentTimecode}
                  </span>
                )}
                <button
                  onClick={() => setCommentVisibility(commentVisibility === "public" ? "team" : "public")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    commentVisibility === "public" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {commentVisibility === "public" ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {commentVisibility === "public" ? "Public" : "Team"}
                </button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-white rounded-xl border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 transition-all shadow-sm">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSendComment();
                      }
                    }}
                    placeholder="Leave your comment…"
                    className="w-full bg-transparent text-sm px-3.5 py-2.5 resize-none h-16 outline-none placeholder:text-muted/50"
                  />
                  <div className="flex items-center gap-0.5 px-2 pb-2">
                    {[Pencil, Paperclip, Smile, AtSign].map((Icon, i) => (
                      <button key={i} className="text-muted hover:text-accent transition-colors p-1.5 rounded-lg hover:bg-accent-light" disabled>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleSendComment}
                  disabled={sendingComment || !commentText.trim()}
                  className="p-3 rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 shrink-0 disabled:opacity-50"
                >
                  {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ asset }: { asset: Asset }) {
  const rows: [string, string][] = [
    ["Name", asset.name],
    ["Type", asset.type],
    ["Folder", asset.folder],
    ["Format", asset.format || "—"],
    ["Resolution", asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"],
    ["Duration", asset.durationSeconds ? formatTimecode(asset.durationSeconds) : "—"],
    ["Size", asset.sizeBytes ? `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : "—"],
    ["Version", `V${asset.version}`],
    ["Uploaded by", asset.uploadedByName],
    ["Processing", asset.processingStatus],
  ];
  return (
    <div className="p-4 space-y-4">
      <div>
        <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">File info</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted">Status</span>
            <StatusBadge status={asset.status} />
          </div>
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted">{label}</span>
              <span className="font-medium text-foreground truncate ml-2 max-w-[180px] text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  canResolve,
  onResolve,
  onSeek,
}: {
  comment: CommentType;
  canResolve: boolean;
  onResolve: () => void;
  onSeek: (t: number) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        comment.resolved
          ? "border-border/50 opacity-50"
          : "border-border hover:border-accent/20 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
          {getInitials(comment.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">{comment.authorName}</span>
            {typeof comment.timecode === "number" && (
              <button
                onClick={() => onSeek(comment.timecode!)}
                className="font-mono text-[10px] text-accent bg-accent-light px-1.5 py-0.5 rounded-md font-semibold hover:bg-accent hover:text-white transition-colors"
              >
                {formatTimecode(comment.timecode)}
              </button>
            )}
            {comment.visibility === "team" && <Lock className="w-3 h-3 text-amber-500" />}
            {comment.resolved && <Check className="w-3 h-3 text-emerald-500" />}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-muted">{formatTimeAgo(comment.createdAt)}</span>
            {canResolve && (
              <button
                onClick={onResolve}
                className={`text-[11px] font-medium transition-colors ${
                  comment.resolved
                    ? "text-muted hover:text-accent"
                    : "text-muted hover:text-emerald-500"
                }`}
              >
                {comment.resolved ? "Reopen" : "Resolve"}
              </button>
            )}
          </div>
        </div>
        <button className="text-muted hover:text-foreground transition-colors shrink-0">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
