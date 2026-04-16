"use client";

import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assetsQuery, assetsByFolderQuery } from "@/lib/firestore/assets";
import type { Asset } from "@/lib/schema";

export function useAssets(
  workspaceId: string | null | undefined,
  campaignId: string | null | undefined,
  folder?: string | null
) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !campaignId) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = folder
      ? assetsByFolderQuery(workspaceId, campaignId, folder)
      : assetsQuery(workspaceId, campaignId);
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset));
      setAssets(list);
      setLoading(false);
    });
    return () => unsub();
  }, [workspaceId, campaignId, folder]);

  return { assets, loading };
}

export function useAsset(
  workspaceId: string | null | undefined,
  campaignId: string | null | undefined,
  assetId: string | null | undefined
) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !campaignId || !assetId) {
      setAsset(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "workspaces", workspaceId, "campaigns", campaignId, "assets", assetId),
      (snap) => {
        setAsset(snap.exists() ? ({ id: snap.id, ...snap.data() } as Asset) : null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [workspaceId, campaignId, assetId]);

  return { asset, loading };
}
