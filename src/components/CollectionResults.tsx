"use client";

import { useEffect, useState } from "react";
import { collectionGroup, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asset, Collection } from "@/lib/schema";
import { ArrowLeft, Film, Image as ImageIcon, Music, FileText, Loader2 } from "lucide-react";

// Renders the assets matching a Collection's saved filters, across all campaigns
// in the workspace (collectionGroup query, requires the assets.workspaceId
// COLLECTION_GROUP index). Clicking an asset opens it in the viewer.
export default function CollectionResults({
  workspaceId,
  collection,
  onBack,
  onOpenAsset,
}: {
  workspaceId: string;
  collection: Collection;
  onBack: () => void;
  onOpenAsset: (campaignId: string, assetId: string) => void;
}) {
  const [assets, setAssets] = useState<Asset[] | null>(null);

  useEffect(() => {
    const q = query(
      collectionGroup(db, "assets"),
      where("workspaceId", "==", workspaceId),
      limit(500)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset))),
      () => setAssets([])
    );
    return () => unsub();
  }, [workspaceId]);

  const f = collection.filters;
  const filtered = (assets || []).filter((a) => {
    if (f.status?.length && !f.status.includes(a.status)) return false;
    if (f.folder?.length && !f.folder.includes(a.folder)) return false;
    if (f.type?.length && !f.type.includes(a.type)) return false;
    if (f.tags?.length && !(a.tags || []).some((t) => f.tags!.includes(t))) return false;
    if (f.assignedTo?.length && !(a.assignedTo && f.assignedTo.includes(a.assignedTo))) return false;
    if (typeof f.rating === "number" && (a.rating || 0) < f.rating) return false;
    if (f.campaignIds?.length && !f.campaignIds.includes(a.campaignId)) return false;
    return true;
  });

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Collections
      </button>
      <div className="flex items-baseline gap-2 mb-5">
        <h1 className="text-xl font-bold text-foreground">{collection.name}</h1>
        <span className="text-sm text-muted">
          {assets === null ? "…" : `${filtered.length} asset${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {assets === null ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted">No assets match this collection yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => onOpenAsset(a.campaignId, a.id)}
              className="text-left rounded-xl border border-border bg-white overflow-hidden hover:border-accent/30 hover:shadow-sm transition-all"
            >
              <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                {a.thumbnailURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.thumbnailURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <TypeIcon type={a.type} />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                <p className="text-[10px] text-muted mt-0.5">
                  V{a.version} · {a.status}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeIcon({ type }: { type: Asset["type"] }) {
  const cls = "w-8 h-8 text-slate-300";
  if (type === "video") return <Film className={cls} />;
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "audio") return <Music className={cls} />;
  return <FileText className={cls} />;
}
