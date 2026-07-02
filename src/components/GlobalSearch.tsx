"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Film,
  Image as ImageIcon,
  Music,
  FileText,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useWorkspace } from "@/lib/workspace-context";
import { collectionGroup, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asset } from "@/lib/schema";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenCampaign: (id: string) => void;
  onOpenAsset: (campaignId: string, assetId: string) => void;
}

export default function GlobalSearch({
  open,
  onClose,
  onOpenCampaign,
  onOpenAsset,
}: Props) {
  const { activeWorkspace } = useWorkspace();
  const { campaigns } = useCampaigns(activeWorkspace?.id ?? null);
  const [q, setQ] = useState("");
  const [assetHits, setAssetHits] = useState<Asset[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setAssetHits([]);
    }
  }, [open]);

  // Cross-campaign asset search via collectionGroup
  useEffect(() => {
    if (!open || !activeWorkspace || q.trim().length < 2) {
      setAssetHits([]);
      return;
    }
    setSearching(true);
    const term = q.trim().toLowerCase();
    const timer = setTimeout(async () => {
      try {
        // Firestore doesn't support substring — we filter client-side over recent assets
        const snap = await getDocs(
          query(
            collectionGroup(db, "assets"),
            where("workspaceId", "==", activeWorkspace.id),
            limit(200)
          )
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset));
        const filtered = all.filter(
          (a) =>
            a.name.toLowerCase().includes(term) ||
            (a.tags || []).some((t) => t.toLowerCase().includes(term))
        );
        setAssetHits(filtered.slice(0, 15));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, open, activeWorkspace]);

  const campaignHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return campaigns.slice(0, 5);
    return campaigns
      .filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.client?.toLowerCase().includes(term) ||
          c.brand?.toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [campaigns, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 backdrop-blur-sm p-4 pt-[12vh]">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search campaigns, assets, tags…"
            className="flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
          <kbd className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">Esc</kbd>
          <button onClick={onClose} className="text-[11px] text-muted hover:text-foreground">
            Close
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {campaignHits.length > 0 && (
            <div className="py-2">
              <h4 className="px-4 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-widest">
                Campaigns
              </h4>
              {campaignHits.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onClose();
                    onOpenCampaign(c.id);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                    <LayoutDashboard className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted truncate">
                      {c.client} · {c.brand}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {q.trim().length >= 2 && (
            <div className="py-2 border-t border-border">
              <h4 className="px-4 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-widest flex items-center gap-1.5">
                Assets
                {searching && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
              </h4>
              {assetHits.length === 0 && !searching && (
                <p className="px-4 py-3 text-xs text-muted">No asset matches</p>
              )}
              {assetHits.map((a) => {
                const Icon =
                  a.type === "video"
                    ? Film
                    : a.type === "image"
                      ? ImageIcon
                      : a.type === "audio"
                        ? Music
                        : FileText;
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      onClose();
                      onOpenAsset(a.campaignId, a.id);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                      <p className="text-[11px] text-muted truncate">
                        V{a.version} · {a.folder}
                        {a.tags && a.tags.length > 0 ? ` · ${a.tags.join(", ")}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {q.trim().length === 0 && (
            <div className="px-4 py-3 text-[11px] text-muted border-t border-border">
              Type at least 2 characters to search assets across all campaigns.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
