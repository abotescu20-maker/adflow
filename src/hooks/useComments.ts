"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { rootCommentsQuery } from "@/lib/firestore/comments";
import type { Comment } from "@/lib/schema";

export function useComments(
  workspaceId: string | null | undefined,
  campaignId: string | null | undefined,
  assetId: string | null | undefined
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !campaignId || !assetId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      rootCommentsQuery(workspaceId, campaignId, assetId),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
        setComments(list);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [workspaceId, campaignId, assetId]);

  return { comments, loading };
}
