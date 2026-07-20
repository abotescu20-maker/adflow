"use client";

import { useMemo, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import UploadDialog from "@/components/UploadDialog";
import ShareLinkModal from "@/components/ShareLinkModal";
import {
  Film,
  Image as ImageIcon,
  Music,
  FileText,
  MessageSquare,
  Upload,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FolderOpen,
  X,
  Trash2,
  Tag,
  Share2,
  CheckCircle,
  CheckSquare,
  Square,
} from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useCampaign } from "@/hooks/useCampaigns";
import { useAuth } from "@/lib/auth-context";
import {
  updateAssetStatus,
  setAssetTags,
  updateAsset,
} from "@/lib/firestore/assets";
import { decrementCampaignAssetsCount } from "@/lib/firestore/campaigns";
import { logActivity } from "@/lib/firestore/activity";
import { useToast } from "@/components/Toast";
import { upload } from "@vercel/blob/client";
import { thumbnailFromVideoUrl, thumbnailFromImageUrl } from "@/lib/thumbnails";
import type { Asset, ApprovalStatus } from "@/lib/schema";

const FOLDERS = [
  { id: "footage", name: "Raw Footage" },
  { id: "graphics", name: "Graphics" },
  { id: "sound", name: "Sound & Music" },
  { id: "edits", name: "Edits" },
  { id: "final", name: "Final Renders" },
  { id: "briefs", name: "Client Briefs" },
];

const typeIcons: Record<string, React.ElementType> = {
  video: Film,
  image: ImageIcon,
  audio: Music,
  document: FileText,
};

const typeColors: Record<string, { bg: string; icon: string }> = {
  video: { bg: "bg-blue-50", icon: "text-blue-500" },
  image: { bg: "bg-emerald-50", icon: "text-emerald-500" },
  audio: { bg: "bg-violet-50", icon: "text-violet-500" },
  document: { bg: "bg-amber-50", icon: "text-amber-500" },
};

const STATUSES: ApprovalStatus[] = [
  "brief",
  "production",
  "review",
  "revision",
  "approved",
  "delivered",
];

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds?: number): string | undefined {
  if (!seconds) return undefined;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatDate(ts: Asset["createdAt"]): string {
  try {
    return ts
      .toDate()
      .toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

interface Props {
  workspaceId: string;
  campaignId: string;
  selectedFolder: string | null;
  onAssetOpen: (assetId: string) => void;
  onFolderSelect: (folderId: string | null) => void;
  onBack: () => void;
}

export default function AssetBrowser({
  workspaceId,
  campaignId,
  selectedFolder,
  onAssetOpen,
  onFolderSelect,
  onBack,
}: Props) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { campaign } = useCampaign(workspaceId, campaignId);
  const { assets, loading } = useAssets(
    workspaceId,
    campaignId,
    selectedFolder
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const missingThumbs = useMemo(
    () =>
      assets.filter(
        (a) =>
          !a.thumbnailURL &&
          (a.type === "video" || a.type === "image") &&
          (a.downloadURL || a.storagePath)
      ),
    [assets]
  );

  const backfillThumbnails = async () => {
    if (!user || backfilling || missingThumbs.length === 0) return;
    setBackfilling(true);
    let done = 0;
    try {
      for (const a of missingThumbs) {
        const url = a.downloadURL || a.storagePath;
        const blob =
          a.type === "video"
            ? await thumbnailFromVideoUrl(url)
            : await thumbnailFromImageUrl(url);
        if (!blob || blob.size === 0) continue;
        const idToken = await user.getIdToken();
        const path = `workspaces/${workspaceId}/campaigns/${campaignId}/${a.folder}/thumbnails/backfill-${a.id}.jpg`;
        const res = await upload(
          path,
          new File([blob], `thumb-${a.id}.jpg`, { type: "image/jpeg" }),
          {
            access: "public",
            handleUploadUrl: "/api/upload",
            clientPayload: idToken,
          }
        );
        await updateAsset(workspaceId, campaignId, a.id, {
          thumbnailURL: res.url,
        });
        done++;
      }
      toast.success(
        `Generated ${done} thumbnail${done !== 1 ? "s" : ""}`,
        done < missingThumbs.length
          ? `${missingThumbs.length - done} could not be generated.`
          : undefined
      );
    } catch {
      toast.error(
        "Thumbnail backfill failed",
        "Some thumbnails may not have generated."
      );
    } finally {
      setBackfilling(false);
    }
  };

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const currentFolder = FOLDERS.find((f) => f.id === selectedFolder);

  // Filtered assets
  const visibleAssets = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter.length > 0 && !statusFilter.includes(a.status))
        return false;
      if (tagFilter && !(a.tags || []).includes(tagFilter)) return false;
      return true;
    });
  }, [assets, statusFilter, tagFilter]);

  // All tags across visible assets
  const allTags = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => (a.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [assets]);

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === visibleAssets.length) setSelected(new Set());
    else setSelected(new Set(visibleAssets.map((a) => a.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const selectedAssets = useMemo(
    () => visibleAssets.filter((a) => selected.has(a.id)),
    [visibleAssets, selected]
  );

  // Bulk actions
  const bulkChangeStatus = async (status: ApprovalStatus) => {
    if (!user || !profile || selected.size === 0) return;
    setWorking(true);
    try {
      for (const a of selectedAssets) {
        await updateAssetStatus(
          workspaceId,
          campaignId,
          a.id,
          status,
          user.uid
        );
        await logActivity(workspaceId, {
          actorId: user.uid,
          actorName: profile.displayName,
          actorAvatar: profile.photoURL,
          action:
            status === "approved"
              ? "asset.approved"
              : status === "revision"
                ? "asset.rejected"
                : "asset.status_changed",
          targetType: "asset",
          targetId: a.id,
          targetName: a.name,
          campaignId,
          assetId: a.id,
          assetName: a.name,
          metadata: { bulk: true, newStatus: status },
        });
      }
      clearSelection();
      toast.success(
        `Status updated`,
        `${selectedAssets.length} asset${selectedAssets.length !== 1 ? "s" : ""} set to ${status}.`
      );
    } finally {
      setWorking(false);
    }
  };

  const bulkAddTag = async (tag: string) => {
    if (!tag.trim() || selected.size === 0) return;
    setWorking(true);
    try {
      for (const a of selectedAssets) {
        const next = Array.from(new Set([...(a.tags || []), tag.trim()]));
        await setAssetTags(workspaceId, campaignId, a.id, next);
      }
      clearSelection();
      toast.success(
        `Tag added`,
        `"${tag.trim()}" applied to ${selectedAssets.length} asset${selectedAssets.length !== 1 ? "s" : ""}.`
      );
    } finally {
      setWorking(false);
    }
  };

  const bulkDelete = async () => {
    if (!user || !profile || selected.size === 0) return;
    if (
      !confirm(
        `Delete ${selected.size} asset${selected.size !== 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;
    setWorking(true);
    try {
      // Cascade delete via the server route — client deleteDoc left comments/
      // versions/rounds orphaned under the deleted asset (#34).
      const idToken = await user.getIdToken();
      for (const a of selectedAssets) {
        const res = await fetch("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            workspaceId,
            campaignId,
            assetId: a.id,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(err?.error || "Delete failed");
        }
        await logActivity(workspaceId, {
          actorId: user.uid,
          actorName: profile.displayName,
          actorAvatar: profile.photoURL,
          action: "asset.deleted",
          targetType: "asset",
          targetId: a.id,
          targetName: a.name,
          campaignId,
          assetId: a.id,
          assetName: a.name,
        });
      }
      await decrementCampaignAssetsCount(
        workspaceId,
        campaignId,
        selected.size
      );
      const n = selected.size;
      clearSelection();
      toast.success(
        `Deleted ${n} asset${n !== 1 ? "s" : ""}`,
        "The assets and their versions were removed."
      );
    } catch (err) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Please try again"
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-subtle/50">
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        workspaceId={workspaceId}
        campaignId={campaignId}
        folder={selectedFolder || "all"}
      />
      {shareOpen && (
        <ShareLinkModal
          workspaceId={workspaceId}
          campaignId={campaignId}
          campaignName={campaign?.name}
          assetId={selected.size === 1 ? Array.from(selected)[0] : undefined}
          assetName={selected.size === 1 ? selectedAssets[0]?.name : undefined}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={onBack}
              className="p-1 rounded text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFolderSelect(null)}
              className="text-muted hover:text-accent font-medium transition-colors"
            >
              {campaign?.name || "Campaign"}
            </button>
            {currentFolder && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-semibold text-foreground">
                  {currentFolder.name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white border border-border rounded-lg overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors shadow-sm ${
                showFilters || statusFilter.length > 0 || tagFilter
                  ? "bg-accent text-white border-accent"
                  : "text-slate-600 border-border bg-white hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
              {(statusFilter.length > 0 || tagFilter) && (
                <span className="bg-white text-accent text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {statusFilter.length + (tagFilter ? 1 : 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            {missingThumbs.length > 0 && (
              <button
                onClick={backfillThumbnails}
                disabled={backfilling}
                title={`Generate previews for ${missingThumbs.length} asset(s) without a thumbnail`}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
              >
                {backfilling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                {backfilling
                  ? "Generating…"
                  : `Thumbnails (${missingThumbs.length})`}
              </button>
            )}
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="px-8 pb-3 space-y-2.5">
            <div>
              <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                Status
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => {
                  const on = statusFilter.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        setStatusFilter((cur) =>
                          cur.includes(s)
                            ? cur.filter((x) => x !== s)
                            : [...cur, s]
                        )
                      }
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors capitalize ${
                        on
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-600 border-border hover:border-accent/40"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
                {statusFilter.length > 0 && (
                  <button
                    onClick={() => setStatusFilter([])}
                    className="text-[11px] text-muted hover:text-red-500 px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {allTags.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1.5">
                  Tag
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(tagFilter === t ? null : t)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                        tagFilter === t
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-600 border-border hover:border-accent/40"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  {tagFilter && (
                    <button
                      onClick={() => setTagFilter(null)}
                      className="text-[11px] text-muted hover:text-red-500 px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick folder chips */}
        {!selectedFolder && !showFilters && (
          <div className="px-8 pb-3 flex gap-2 overflow-x-auto">
            {FOLDERS.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFolderSelect(folder.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-500 bg-white border border-border hover:border-accent/30 hover:text-accent transition-all whitespace-nowrap shadow-sm"
              >
                {folder.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Asset count + select all */}
      <div className="px-8 py-3 flex items-center justify-between text-xs font-medium text-muted">
        <span>
          {loading
            ? "Loading…"
            : `${visibleAssets.length} Asset${visibleAssets.length !== 1 ? "s" : ""}${
                statusFilter.length > 0 || tagFilter ? ` (filtered)` : ""
              }`}
        </span>
        {visibleAssets.length > 0 && (
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 hover:text-accent transition-colors"
          >
            {selected.size === visibleAssets.length ? (
              <CheckSquare className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {selected.size === visibleAssets.length
              ? "Deselect all"
              : "Select all"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : visibleAssets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-border p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent-light mx-auto mb-4 flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-accent" />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">
              {statusFilter.length > 0 || tagFilter
                ? "No assets match these filters"
                : `No assets ${currentFolder ? `in ${currentFolder.name}` : "yet"}`}
            </h4>
            <p className="text-sm text-muted max-w-sm mx-auto mb-4">
              {statusFilter.length > 0 || tagFilter
                ? "Try adjusting or clearing your filters above."
                : "Upload footage, graphics, audio and editing drafts to start collaborating with your team and clients."}
            </p>
            {statusFilter.length === 0 && !tagFilter && (
              <button
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
              >
                <Upload className="w-4 h-4" />
                Upload files
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visibleAssets.map((asset) => {
              const Icon = typeIcons[asset.type] || FileText;
              const colors = typeColors[asset.type] || typeColors.document;
              const duration = formatDuration(asset.durationSeconds);
              const isSelected = selected.has(asset.id);
              return (
                <div
                  key={asset.id}
                  className={`group bg-white rounded-xl border hover:shadow-lg transition-all overflow-hidden shadow-sm relative cursor-pointer ${
                    isSelected
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-border hover:border-accent/30"
                  }`}
                  onClick={() =>
                    selected.size > 0
                      ? toggleSelect(asset.id)
                      : onAssetOpen(asset.id)
                  }
                >
                  {/* Select checkbox */}
                  <button
                    onClick={(e) => toggleSelect(asset.id, e)}
                    className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all shadow-sm ${
                      isSelected
                        ? "bg-accent text-white scale-100"
                        : "bg-white/80 text-slate-400 scale-0 group-hover:scale-100 hover:text-accent border border-border"
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <div className="aspect-video bg-slate-50 relative flex items-center justify-center">
                    {asset.thumbnailURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailURL}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : asset.type === "image" && asset.downloadURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.downloadURL}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}
                      >
                        <Icon className={`w-6 h-6 ${colors.icon}`} />
                      </div>
                    )}
                    {duration && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-foreground/80 text-white backdrop-blur-sm">
                        {duration}
                      </span>
                    )}
                    {asset.version > 1 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent text-white shadow-sm">
                        V{asset.version}
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-xs font-semibold text-foreground truncate mb-1 group-hover:text-accent transition-colors">
                      {asset.name}
                    </p>
                    {(asset.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {(asset.tags || []).slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] bg-accent-light text-accent px-1.5 py-0.5 rounded-md font-medium"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-muted truncate">
                        {asset.uploadedByName} · {formatSize(asset.sizeBytes)}
                      </span>
                      {asset.commentsCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted shrink-0">
                          <MessageSquare className="w-3 h-3" />
                          {asset.commentsCount}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] text-muted uppercase tracking-wider font-semibold border-b border-border bg-slate-50">
              <div className="col-span-1 flex items-center">
                <button onClick={selectAll} className="p-0.5">
                  {selected.size === visibleAssets.length &&
                  visibleAssets.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-accent" />
                  ) : (
                    <Square className="w-4 h-4 text-muted" />
                  )}
                </button>
              </div>
              <div className="col-span-3">Name</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Version</div>
              <div className="col-span-1">Size</div>
              <div className="col-span-2">Uploaded</div>
              <div className="col-span-1 text-right">Comments</div>
            </div>
            {visibleAssets.map((asset) => {
              const Icon = typeIcons[asset.type] || FileText;
              const colors = typeColors[asset.type] || typeColors.document;
              const isSelected = selected.has(asset.id);
              return (
                <div
                  key={asset.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm transition-colors items-center cursor-pointer border-b border-border/50 last:border-0 ${
                    isSelected
                      ? "bg-accent-light/70"
                      : "hover:bg-accent-light/30"
                  }`}
                  onClick={() =>
                    selected.size > 0
                      ? toggleSelect(asset.id)
                      : onAssetOpen(asset.id)
                  }
                >
                  <div className="col-span-1">
                    <button
                      onClick={(e) => toggleSelect(asset.id, e)}
                      className="p-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-muted" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}
                    >
                      <Icon className={`w-4 h-4 ${colors.icon}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {asset.name}
                      </p>
                      {(asset.tags || []).length > 0 && (
                        <p className="text-[10px] text-muted truncate">
                          {(asset.tags || []).slice(0, 4).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-1 text-xs text-muted capitalize">
                    {asset.type}
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={asset.status} />
                  </div>
                  <div className="col-span-1 text-xs font-medium text-muted">
                    V{asset.version}
                  </div>
                  <div className="col-span-1 text-xs text-muted">
                    {formatSize(asset.sizeBytes)}
                  </div>
                  <div className="col-span-2 text-xs text-muted truncate">
                    {asset.uploadedByName} · {formatDate(asset.createdAt)}
                  </div>
                  <div className="col-span-1 text-xs text-muted text-right flex items-center justify-end gap-1">
                    {asset.commentsCount > 0 && (
                      <>
                        <MessageSquare className="w-3 h-3" />
                        {asset.commentsCount}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          working={working}
          onClear={clearSelection}
          onChangeStatus={bulkChangeStatus}
          onAddTag={bulkAddTag}
          onDelete={bulkDelete}
          onShare={selected.size === 1 ? () => setShareOpen(true) : undefined}
        />
      )}
    </div>
  );
}

// =========================================================================
// BULK ACTION BAR
// =========================================================================
function BulkBar({
  count,
  working,
  onClear,
  onChangeStatus,
  onAddTag,
  onDelete,
  onShare,
}: {
  count: number;
  working: boolean;
  onClear: () => void;
  onChangeStatus: (s: ApprovalStatus) => Promise<void>;
  onAddTag: (t: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onShare?: () => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState("");

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl border border-border shadow-2xl shadow-foreground/10 flex items-center gap-1 px-2 py-1.5">
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-foreground">
        <span className="bg-accent text-white rounded-md px-1.5 py-0.5 text-[11px]">
          {count}
        </span>
        selected
      </div>
      <div className="w-px h-5 bg-border mx-1" />

      <div className="relative">
        <button
          onClick={() => {
            setStatusOpen((o) => !o);
            setTagOpen(false);
          }}
          disabled={working}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Set status
        </button>
        {statusOpen && (
          <div className="absolute bottom-full left-0 mb-1.5 bg-white rounded-lg border border-border shadow-lg overflow-hidden w-36">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={async () => {
                  setStatusOpen(false);
                  await onChangeStatus(s);
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-medium capitalize hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => {
            setTagOpen((o) => !o);
            setStatusOpen(false);
          }}
          disabled={working}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <Tag className="w-3.5 h-3.5" />
          Add tag
        </button>
        {tagOpen && (
          <div className="absolute bottom-full left-0 mb-1.5 bg-white rounded-lg border border-border shadow-lg p-2 w-56">
            <input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && tagValue.trim()) {
                  const t = tagValue.trim();
                  setTagValue("");
                  setTagOpen(false);
                  await onAddTag(t);
                }
              }}
              placeholder="Tag name, Enter to apply"
              autoFocus
              className="w-full text-xs px-2 py-1.5 border border-border rounded-md outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
            />
          </div>
        )}
      </div>

      {onShare && (
        <button
          onClick={onShare}
          disabled={working}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      )}

      <button
        onClick={onDelete}
        disabled={working}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {working ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        Delete
      </button>

      <div className="w-px h-5 bg-border mx-1" />
      <button
        onClick={onClear}
        className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-slate-100"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
