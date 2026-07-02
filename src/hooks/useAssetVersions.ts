"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { assetVersionsQuery } from "@/lib/firestore/assets";
import type { AssetVersion } from "@/lib/schema";

export function useAssetVersions(
  workspaceId: string | null,
  campaignId: string | null,
  assetId: string | null
) {
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !campaignId || !assetId) {
      setVersions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      assetVersionsQuery(workspaceId, campaignId, assetId),
      (snap) => {
        setVersions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssetVersion))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId, campaignId, assetId]);

  return { versions, loading };
}
