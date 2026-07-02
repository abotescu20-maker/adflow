"use client";

import { use, useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { recordShareLinkView } from "@/lib/firestore/shareLinks";
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
  Play,
  Pause,
  Zap,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shareDoc = await getDoc(doc(db, "publicShares", token));
        if (!shareDoc.exists()) {
          if (!cancelled) setState({ kind: "error", message: "Link not found" });
          return;
        }
        const share = { token, ...shareDoc.data() } as unknown as PublicShare;
        if (share.revokedAt) {
          if (!cancelled) setState({ kind: "error", message: "This link has been revoked" });
          return;
        }
        if (share.expiresAt) {
          const ms =
            typeof share.expiresAt.toMillis === "function"
              ? share.expiresAt.toMillis()
              : 0;
          if (ms < Date.now()) {
            if (!cancelled) setState({ kind: "error", message: "This link has expired" });
            return;
          }
        }

        let campaign: Campaign | null = null;
        let assets: Asset[] = [];

        if (share.assetIds && share.assetIds.length > 0 && share.campaignId) {
          const arr: Asset[] = [];
          for (const aid of share.assetIds) {
            const aDoc = await getDoc(
              doc(
                db,
                "workspaces",
                share.workspaceId,
                "campaigns",
                share.campaignId,
                "assets",
                aid
              )
            );
            if (aDoc.exists()) arr.push({ id: aDoc.id, ...aDoc.data() } as Asset);
          }
          assets = arr;
        } else if (share.campaignId) {
          const cDoc = await getDoc(
            doc(db, "workspaces", share.workspaceId, "campaigns", share.campaignId)
          );
          if (cDoc.exists()) campaign = { id: cDoc.id, ...cDoc.data() } as Campaign;
          const aSnap = await getDocs(
            query(
              collection(
                db,
                "workspaces",
                share.workspaceId,
                "campaigns",
                share.campaignId,
                "assets"
              ),
              orderBy("createdAt", "desc")
            )
          );
          assets = aSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset));
        }

        if (!cancelled) {
          setState({ kind: "ready", share, campaign, assets });
          // Fire-and-forget view recording (may silently fail due to rules)
          recordShareLinkView(share.workspaceId, share.shareLinkId).catch(() => {});
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
      <div className="flex-1 flex">
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
                <MediaPreview asset={asset} />
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

              {/* Footer actions */}
              <div className="bg-white border-t border-border px-6 py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{asset.name}</h4>
                  <p className="text-[11px] text-muted">
                    {asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}
                    {asset.durationSeconds
                      ? ` · ${Math.round(asset.durationSeconds)}s`
                      : ""}
                  </p>
                </div>
                {share.permissions.canApprove && (
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-border text-red-600 hover:bg-red-50 transition-colors">
                      <XCircle className="w-3.5 h-3.5" />
                      Request Changes
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted">No assets in this share</p>
            </div>
          )}
        </main>
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

function MediaPreview({ asset }: { asset: Asset }) {
  const [isPlaying, setIsPlaying] = useState(false);
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
        src={src}
        controls
        className="max-w-full max-h-full"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      >
        {isPlaying ? <Pause /> : <Play />}
      </video>
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
