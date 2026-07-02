"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { reviewRoundsQuery } from "@/lib/firestore/reviewRounds";
import type { ReviewRound } from "@/lib/schema";

export function useReviewRounds(
  workspaceId: string | null,
  campaignId: string | null,
  assetId: string | null
) {
  const [rounds, setRounds] = useState<ReviewRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !campaignId || !assetId) {
      setRounds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      reviewRoundsQuery(workspaceId, campaignId, assetId),
      (snap) => {
        setRounds(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewRound))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId, campaignId, assetId]);

  return { rounds, loading };
}
