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
  History,
  Activity as ActivityIcon,
  Upload,
  Star,
  UserCircle2,
  Tag,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { useAsset } from "@/hooks/useAssets";
import { useComments } from "@/hooks/useComments";
import { useAssetVersions } from "@/hooks/useAssetVersions";
import { useAssetActivity } from "@/hooks/useActivity";
import { useAuth } from "@/lib/auth-context";
import {
  createComment,
  resolveComment,
  unresolveComment,
} from "@/lib/firestore/comments";
import {
  updateAssetStatus,
  switchActiveVersion,
  setAssetRating,
  setAssetTags,
  incrementAssetCommentsCount,
} from "@/lib/firestore/assets";
import { logActivity } from "@/lib/firestore/activity";
import { createNotification } from "@/lib/firestore/notifications";
import type {
  Asset,
  AssetVersion,
  Comment as CommentType,
  ApprovalStatus,
  ActivityEntry,
} from "@/lib/schema";
import ShareLinkModal from "@/components/ShareLinkModal";
import UploadDialog from "@/components/UploadDialog";
import { useToast } from "@/components/Toast";

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTimeAgo(ts: CommentType["createdAt"] | undefined): string {
  if (!ts) return "—";
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

function formatBytes(b?: number): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type Tab = "comments" | "details" | "versions" | "activity";

interface Props {
  workspaceId: string;
  campaignId: string;
  assetId: string;
  onBack: () => void;
}

export default function AssetViewer({ workspaceId, campaignId, assetId, onBack }: Props) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { asset, loading: assetLoading } = useAsset(workspaceId, campaignId, assetId);
  const { comments, loading: commentsLoading } = useComments(workspaceId, campaignId, assetId);
  const { versions } = useAssetVersions(workspaceId, campaignId, assetId);
  const activity = useAssetActivity(workspaceId, assetId, 30);

  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("comments");
  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"public" | "team">("public");
  const [sendingComment, setSendingComment] = useState(false);
  const [approving, setApproving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);

  const duration = asset?.durationSeconds || 0;
  const currentTimecode = formatTimecode(currentTime);
  const mediaSrc = asset?.downloadURL || asset?.storagePath || "";

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
      await logActivity(workspaceId, {
        actorId: user.uid,
        actorName: profile.displayName,
        actorAvatar: profile.photoURL,
        action: "comment.posted",
        targetType: "comment",
        targetId: "new",
        targetName: commentText.slice(0, 60),
        campaignId,
        assetId,
        assetName: asset.name,
      });
      setCommentText("");
      toast.success("Comment posted", "Your feedback was saved.");
      // Notify the asset uploader when someone else comments
      if (asset.uploadedBy && asset.uploadedBy !== user.uid) {
        await createNotification({
          uid: asset.uploadedBy,
          workspaceId,
          kind: "comment_reply",
          title: `${profile.displayName} commented on your asset`,
          body: `${asset.name} — "${commentText.trim().slice(0, 80)}"`,
          actorId: user.uid,
          actorName: profile.displayName,
          targetUrl: "/",
        }).catch(() => {});
      }
    } catch (err) {
      toast.error(
        "Couldn't post comment",
        err instanceof Error ? err.message : "Please try again"
      );
    } finally {
      setSendingComment(false);
    }
  };

  const handleApprove = async (status: ApprovalStatus) => {
    if (!user || !profile || !asset) return;
    setApproving(true);
    try {
      await updateAssetStatus(workspaceId, campaignId, assetId, status, user.uid);
      await logActivity(workspaceId, {
        actorId: user.uid,
        actorName: profile.displayName,
        actorAvatar: profile.photoURL,
        action: status === "approved" ? "asset.approved" : "asset.rejected",
        targetType: "asset",
        targetId: assetId,
        targetName: asset.name,
        campaignId,
        assetId,
        assetName: asset.name,
        metadata: { version: asset.version, status },
      });
      if (status === "approved") {
        toast.success("Asset approved", `${asset.name} was marked as approved.`);
      } else if (status === "revision") {
        toast.warn("Changes requested", `${asset.name} is now awaiting a new revision.`);
      } else {
        toast.info("Status updated", `Asset status set to ${status}.`);
      }
      // Also create an in-app notification (demo: to the uploader of the asset, if different)
      const notifyUid = asset.uploadedBy !== user.uid ? asset.uploadedBy : user.uid;
      await createNotification({
        uid: notifyUid,
        workspaceId,
        kind: status === "approved" ? "approval_granted" : "changes_requested",
        title:
          status === "approved"
            ? `${profile.displayName} approved your asset`
            : `${profile.displayName} requested changes`,
        body: `${asset.name} — V${asset.version}`,
        actorId: user.uid,
        actorName: profile.displayName,
        targetUrl: "/",
      }).catch(() => {});
    } catch (err) {
      toast.error(
        "Action failed",
        err instanceof Error ? err.message : "Unable to update status"
      );
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

  const handleSwitchVersion = async (v: AssetVersion) => {
    if (!asset || !user || !profile) return;
    try {
      await switchActiveVersion(workspaceId, campaignId, assetId, v);
      await logActivity(workspaceId, {
        actorId: user.uid,
        actorName: profile.displayName,
        actorAvatar: profile.photoURL,
        action: "asset.version_uploaded",
        targetType: "asset",
        targetId: assetId,
        targetName: asset.name,
        campaignId,
        assetId,
        assetName: asset.name,
        metadata: { switchedTo: v.version },
      });
      toast.success(`Switched to V${v.version}`, "The viewer now shows this version.");
    } catch (err) {
      toast.error(
        "Couldn't switch version",
        err instanceof Error ? err.message : "Please try again"
      );
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
            <p className="text-[11px] text-muted capitalize">
              {asset.folder} · V{asset.version} of {asset.versionCount || 1}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setNewVersionOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            New Version
          </button>
          {mediaSrc && (
            <a
              href={mediaSrc}
              download={asset.originalFileName}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Media area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-slate-900 relative flex items-center justify-center overflow-hidden">
            {asset.type === "video" && mediaSrc ? (
              <video
                ref={setVideoEl}
                src={mediaSrc}
                className="max-w-full max-h-full"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setCurrentTime(t);
                  if (e.currentTarget.duration > 0)
                    setProgress((t / e.currentTarget.duration) * 100);
                }}
                controls={false}
                playsInline
              />
            ) : asset.type === "image" && mediaSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaSrc} alt={asset.name} className="max-w-full max-h-full object-contain" />
            ) : asset.type === "audio" && mediaSrc ? (
              <div className="flex flex-col items-center gap-4">
                <Music className="w-20 h-20 text-slate-500" />
                <p className="text-slate-400 text-sm">{asset.name}</p>
                <audio src={mediaSrc} controls className="w-80" />
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

            {asset.type === "video" && mediaSrc && !isPlaying && (
              <button
                onClick={() => videoEl?.play()}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-md border border-white/30"
              >
                <Play className="w-7 h-7 text-white ml-1" />
              </button>
            )}

            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-bold shadow-lg z-20">
              V{asset.version}
            </div>

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
                <span className="font-mono text-sm text-muted">
                  {formatTimecode(videoEl?.duration || duration)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
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
        <div className="w-[360px] border-l border-border flex flex-col bg-white shrink-0">
          <div className="flex border-b border-border">
            {([
              { k: "comments", label: `Comments (${comments.length})` },
              { k: "details", label: "Details" },
              { k: "versions", label: `Versions (${versions.length || 1})` },
              { k: "activity", label: "Activity" },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                className={`flex-1 py-3 text-[11px] font-semibold text-center transition-colors ${
                  activeTab === t.k
                    ? "text-accent border-b-2 border-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "comments" && (
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
            )}
            {activeTab === "details" && (
              <DetailsTab
                asset={asset}
                workspaceId={workspaceId}
                campaignId={campaignId}
                assetId={assetId}
              />
            )}
            {activeTab === "versions" && (
              <VersionsTab
                asset={asset}
                versions={versions}
                onSwitch={handleSwitchVersion}
              />
            )}
            {activeTab === "activity" && <ActivityTab entries={activity} />}
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
                  onClick={() =>
                    setCommentVisibility(commentVisibility === "public" ? "team" : "public")
                  }
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    commentVisibility === "public"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
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
                      <button
                        key={i}
                        className="text-muted hover:text-accent transition-colors p-1.5 rounded-lg hover:bg-accent-light"
                        disabled
                      >
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
                  {sendingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareLinkModal
          workspaceId={workspaceId}
          campaignId={campaignId}
          assetId={assetId}
          assetName={asset.name}
          onClose={() => setShareOpen(false)}
        />
      )}
      {newVersionOpen && (
        <UploadDialog
          workspaceId={workspaceId}
          campaignId={campaignId}
          onClose={() => setNewVersionOpen(false)}
          forcedName={asset.name}
          forcedFolder={asset.folder}
        />
      )}
    </div>
  );
}

// =========================================================================
// DETAILS TAB — edit metadata (rating, tags)
// =========================================================================
function DetailsTab({
  asset,
  workspaceId,
  campaignId,
  assetId,
}: {
  asset: Asset;
  workspaceId: string;
  campaignId: string;
  assetId: string;
}) {
  const [tagInput, setTagInput] = useState("");
  const rows: [string, string][] = [
    ["Type", asset.type],
    ["Folder", asset.folder],
    ["Format", asset.format || "—"],
    [
      "Resolution",
      asset.width && asset.height ? `${asset.width}×${asset.height}` : "—",
    ],
    [
      "Duration",
      asset.durationSeconds ? formatTimecode(asset.durationSeconds) : "—",
    ],
    ["Size", formatBytes(asset.sizeBytes)],
    ["Priority", asset.priority || "normal"],
    ["Uploaded by", asset.uploadedByName],
  ];

  async function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    const next = Array.from(new Set([...(asset.tags || []), t]));
    await setAssetTags(workspaceId, campaignId, assetId, next);
    setTagInput("");
  }
  async function removeTag(t: string) {
    const next = (asset.tags || []).filter((x) => x !== t);
    await setAssetTags(workspaceId, campaignId, assetId, next);
  }

  return (
    <div className="p-4 space-y-5">
      {/* Status */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted font-medium">Status</span>
        <StatusBadge status={asset.status} />
      </div>

      {/* Rating */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Star className="w-3 h-3" /> Rating
        </h4>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() =>
                setAssetRating(
                  workspaceId,
                  campaignId,
                  assetId,
                  asset.rating === n ? null : n
                )
              }
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-5 h-5 ${
                  n <= (asset.rating || 0)
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Tag className="w-3 h-3" /> Tags
        </h4>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(asset.tags || []).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-light text-accent text-[11px] font-medium rounded-md"
            >
              {t}
              <button onClick={() => removeTag(t)} className="hover:text-red-500">
                ×
              </button>
            </span>
          ))}
          {(asset.tags || []).length === 0 && (
            <span className="text-[11px] text-muted italic">No tags</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
            }}
            placeholder="Add tag…"
            className="flex-1 text-xs px-2 py-1.5 border border-border rounded-md outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
          />
          <button
            onClick={addTag}
            className="text-xs px-2.5 py-1.5 bg-accent text-white rounded-md hover:bg-accent-hover"
          >
            Add
          </button>
        </div>
      </div>

      {/* Assignee */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <UserCircle2 className="w-3 h-3" /> Assignee
        </h4>
        {asset.assignedToName ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-[9px] font-bold text-white">
              {getInitials(asset.assignedToName)}
            </div>
            <span className="font-medium text-foreground">{asset.assignedToName}</span>
          </div>
        ) : (
          <p className="text-[11px] text-muted italic">Unassigned</p>
        )}
      </div>

      {/* File info */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
          File info
        </h4>
        <div className="space-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-muted">{label}</span>
              <span className="font-medium text-foreground truncate ml-2 max-w-[200px] text-right">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// VERSIONS TAB
// =========================================================================
function VersionsTab({
  asset,
  versions,
  onSwitch,
}: {
  asset: Asset;
  versions: AssetVersion[];
  onSwitch: (v: AssetVersion) => Promise<void>;
}) {
  if (versions.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-border p-4 text-center">
          <History className="w-6 h-6 text-muted mx-auto mb-2" />
          <p className="text-xs text-muted">Only one version exists</p>
          <p className="text-[11px] text-muted mt-1">
            Upload a new file with the same name to create V2
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-2">
      {versions.map((v) => {
        const isActive = v.version === asset.version;
        return (
          <div
            key={v.id}
            className={`rounded-xl border p-3 ${
              isActive ? "border-accent bg-accent-light/40" : "border-border hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    isActive ? "bg-accent text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  V{v.version}
                </span>
                {isActive && (
                  <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">
                    Current
                  </span>
                )}
              </div>
              {!isActive && (
                <button
                  onClick={() => onSwitch(v)}
                  className="text-[11px] text-accent hover:text-accent-hover font-medium"
                >
                  Switch to this
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-600 truncate">{v.originalFileName}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted">
              <span>{formatBytes(v.sizeBytes)}</span>
              <span>{formatTimeAgo(v.createdAt)}</span>
              <span className="truncate">by {v.uploadedByName}</span>
            </div>
            {v.notes && (
              <p className="mt-1.5 text-[11px] text-slate-600 italic">&ldquo;{v.notes}&rdquo;</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =========================================================================
// ACTIVITY TAB
// =========================================================================
function ActivityTab({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="p-6 text-center">
        <ActivityIcon className="w-6 h-6 text-muted mx-auto mb-2" />
        <p className="text-xs text-muted">No activity yet</p>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-2.5">
      {entries.map((e) => (
        <div key={e.id} className="flex items-start gap-2.5 text-xs">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
            {getInitials(e.actorName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-700 leading-tight">
              <span className="font-semibold">{e.actorName}</span>{" "}
              <span className="text-muted">{describeAction(e.action)}</span>
            </p>
            {e.targetName && (
              <p className="text-[11px] text-muted truncate mt-0.5">&ldquo;{e.targetName}&rdquo;</p>
            )}
            <p className="text-[10px] text-muted mt-0.5">{formatTimeAgo(e.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function describeAction(a: ActivityEntry["action"]): string {
  const map: Record<string, string> = {
    "asset.uploaded": "uploaded the asset",
    "asset.version_uploaded": "uploaded a new version",
    "asset.approved": "approved the asset",
    "asset.rejected": "requested changes",
    "asset.status_changed": "changed the status",
    "asset.assigned": "assigned the asset",
    "comment.posted": "commented",
    "comment.resolved": "resolved a comment",
    "review.round_opened": "opened a review round",
    "review.round_completed": "completed a review round",
    "share_link.created": "created a share link",
    "share_link.viewed": "viewed via share link",
  };
  return map[a] || a.replace(/\./g, " ");
}

// =========================================================================
// COMMENT CARD
// =========================================================================
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
            <span className="text-xs font-semibold text-foreground truncate">
              {comment.authorName}
            </span>
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
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {comment.text}
          </p>
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
