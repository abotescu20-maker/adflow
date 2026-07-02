"use client";

import { useState, useRef, useCallback } from "react";
import { upload } from "@vercel/blob/client";
import { X, Upload as UploadIcon, Loader2, CheckCircle, AlertCircle, FileText, Film, Image as ImageIcon, Music } from "lucide-react";
import { createAsset } from "@/lib/firestore/assets";
import { incrementCampaignAssetsCount } from "@/lib/firestore/campaigns";
import { useAuth } from "@/lib/auth-context";
import type { AssetType } from "@/lib/schema";

interface Props {
  open?: boolean;
  onClose: () => void;
  workspaceId: string;
  campaignId: string;
  folder?: string;
  /** If set, uploaded file will be saved with this name, creating a new version of the existing asset */
  forcedName?: string;
  /** Force a folder regardless of detection */
  forcedFolder?: string;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "saving" | "done" | "error";
  error?: string;
}

function detectType(mime: string): AssetType {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

function detectFolder(mime: string): string {
  if (mime.startsWith("video/")) return "footage";
  if (mime.startsWith("image/")) return "graphics";
  if (mime.startsWith("audio/")) return "sound";
  return "briefs";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function extractVideoMetadata(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: video.duration,
      });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve({});
    video.src = URL.createObjectURL(file);
  });
}

async function extractImageMetadata(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({});
    img.src = URL.createObjectURL(file);
  });
}

async function extractAudioDuration(file: File): Promise<{ durationSeconds?: number }> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve({ durationSeconds: audio.duration });
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve({});
    audio.src = URL.createObjectURL(file);
  });
}

export default function UploadDialog({
  open = true,
  onClose,
  workspaceId,
  campaignId,
  folder = "all",
  forcedName,
  forcedFolder,
}: Props) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    setItems((cur) => [
      ...cur,
      ...arr.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        file: f,
        progress: 0,
        status: "pending" as const,
      })),
    ]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  const removeItem = (id: string) => {
    setItems((cur) => cur.filter((it) => it.id !== id));
  };

  const uploadOne = async (item: UploadItem): Promise<void> => {
    if (!user || !profile) return;
    const update = (patch: Partial<UploadItem>) =>
      setItems((cur) => cur.map((it) => (it.id === item.id ? { ...it, ...patch } : it)));

    try {
      update({ status: "uploading", progress: 0 });
      const targetFolder =
        forcedFolder ||
        (folder && folder !== "all" ? folder : detectFolder(item.file.type));
      const assetName = forcedName || item.file.name;
      const pathname = `workspaces/${workspaceId}/campaigns/${campaignId}/${targetFolder}/${Date.now()}-${item.file.name}`;

      // Send the Firebase ID token so the server can authenticate the upload
      // (see src/app/api/upload/route.ts). Without this the server rejects the
      // request — the route no longer mints blob tokens for anonymous callers.
      const idToken = await user.getIdToken();
      const blob = await upload(pathname, item.file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        clientPayload: idToken,
        onUploadProgress: ({ percentage }) => update({ progress: percentage }),
      });

      update({ status: "saving", progress: 100 });

      // Extract metadata before saving
      const type = detectType(item.file.type);
      let meta: { width?: number; height?: number; durationSeconds?: number } = {};
      if (type === "video") meta = await extractVideoMetadata(item.file);
      else if (type === "image") meta = await extractImageMetadata(item.file);
      else if (type === "audio") meta = await extractAudioDuration(item.file);

      // createAsset auto-detects same-name existing assets and creates a new version
      const isNewAsset = !forcedName;
      await createAsset(workspaceId, campaignId, {
        name: assetName,
        type,
        folder: targetFolder,
        storagePath: blob.url,
        downloadURL: blob.url,
        originalFileName: item.file.name,
        sizeBytes: item.file.size,
        mimeType: item.file.type,
        uploadedBy: user.uid,
        uploadedByName: profile.displayName,
        width: meta.width,
        height: meta.height,
        durationSeconds: meta.durationSeconds,
        format: item.file.type.split("/")[1]?.toUpperCase(),
      });

      // Only increment asset count for a genuinely new asset (not a version upload)
      if (isNewAsset) {
        await incrementCampaignAssetsCount(workspaceId, campaignId, 1);
      }
      update({ status: "done" });
    } catch (err) {
      update({ status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    }
  };

  const startUpload = async () => {
    // Upload in parallel (max 3 concurrent)
    const pending = items.filter((it) => it.status === "pending");
    const concurrency = 3;
    for (let i = 0; i < pending.length; i += concurrency) {
      const batch = pending.slice(i, i + concurrency);
      await Promise.all(batch.map((it) => uploadOne(it)));
    }
  };

  if (!open) return null;

  const hasPending = items.some((it) => it.status === "pending");
  const allDone = items.length > 0 && items.every((it) => it.status === "done" || it.status === "error");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Upload files</h3>
            <p className="text-xs text-muted mt-0.5">
              {folder && folder !== "all" ? `Adding to ${folder}` : "Auto-organized by type"} · Max 500 MB per file
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragging ? "border-accent bg-accent-light" : "border-border hover:border-accent/40 hover:bg-slate-50"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-accent-light mx-auto mb-4 flex items-center justify-center">
                <UploadIcon className="w-7 h-7 text-accent" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">
                Drop files here
              </h4>
              <p className="text-sm text-muted">or click to browse — videos, images, audio, PDFs</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg py-3 text-center text-sm text-muted cursor-pointer transition-colors ${
                  isDragging ? "border-accent bg-accent-light text-accent" : "border-border hover:border-accent/40"
                }`}
              >
                + Add more files
              </div>

              {items.map((it) => {
                const type = detectType(it.file.type);
                const Icon = { video: Film, image: ImageIcon, audio: Music, document: FileText }[type];
                return (
                  <div key={it.id} className="bg-slate-50 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{it.file.name}</p>
                        <p className="text-[11px] text-muted">{formatSize(it.file.size)}</p>
                      </div>
                      <div className="shrink-0">
                        {it.status === "pending" && (
                          <button onClick={() => removeItem(it.id)} className="p-1 text-muted hover:text-red-500 rounded transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {it.status === "uploading" && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                        {it.status === "saving" && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                        {it.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {it.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                    {(it.status === "uploading" || it.status === "saving") && (
                      <div className="mt-2 h-1 bg-white rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${it.status === "saving" ? 100 : it.progress}%` }}
                        />
                      </div>
                    )}
                    {it.status === "error" && it.error && (
                      <p className="text-[11px] text-red-600 mt-1.5">{it.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="video/*,image/*,audio/*,application/pdf,.ai,.psd,.eps"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="border-t border-border px-6 py-3 flex gap-2 bg-white">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {allDone ? "Close" : "Cancel"}
            </button>
            <button
              onClick={startUpload}
              disabled={!hasPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 disabled:opacity-50"
            >
              <UploadIcon className="w-4 h-4" />
              {allDone ? "Uploaded" : hasPending ? `Upload ${items.filter(i => i.status === "pending").length} file${items.filter(i => i.status === "pending").length !== 1 ? "s" : ""}` : "Processing..."}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
