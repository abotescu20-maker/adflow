"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import {
  activityByAssetQuery,
  activityByCampaignQuery,
  activityQuery,
} from "@/lib/firestore/activity";
import type { ActivityEntry } from "@/lib/schema";

export function useWorkspaceActivity(workspaceId: string | null, max = 30) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      activityQuery(workspaceId, max),
      (snap) => {
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityEntry))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId, max]);

  return { entries, loading };
}

export function useCampaignActivity(
  workspaceId: string | null,
  campaignId: string | null,
  max = 30
) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    if (!workspaceId || !campaignId) {
      setEntries([]);
      return;
    }
    const unsub = onSnapshot(
      activityByCampaignQuery(workspaceId, campaignId, max),
      (snap) =>
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityEntry))
        ),
      () => setEntries([])
    );
    return () => unsub();
  }, [workspaceId, campaignId, max]);
  return entries;
}

export function useAssetActivity(
  workspaceId: string | null,
  assetId: string | null,
  max = 20
) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    if (!workspaceId || !assetId) {
      setEntries([]);
      return;
    }
    const unsub = onSnapshot(
      activityByAssetQuery(workspaceId, assetId, max),
      (snap) =>
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityEntry))
        ),
      () => setEntries([])
    );
    return () => unsub();
  }, [workspaceId, assetId, max]);
  return entries;
}
