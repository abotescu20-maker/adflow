"use client";

import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { campaignsQuery } from "@/lib/firestore/campaigns";
import type { Campaign } from "@/lib/schema";

export function useCampaigns(workspaceId: string | null | undefined) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      campaignsQuery(workspaceId),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign));
        setCampaigns(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  return { campaigns, loading, error };
}

export function useCampaign(
  workspaceId: string | null | undefined,
  campaignId: string | null | undefined
) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !campaignId) {
      setCampaign(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "workspaces", workspaceId, "campaigns", campaignId),
      (snap) => {
        setCampaign(snap.exists() ? ({ id: snap.id, ...snap.data() } as Campaign) : null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [workspaceId, campaignId]);

  return { campaign, loading };
}
