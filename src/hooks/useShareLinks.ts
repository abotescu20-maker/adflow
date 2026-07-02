"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { shareLinksQuery } from "@/lib/firestore/shareLinks";
import type { ShareLink } from "@/lib/schema";

export function useShareLinks(workspaceId: string | null) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      shareLinksQuery(workspaceId),
      (snap) => {
        setLinks(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShareLink))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId]);

  return { links, loading };
}
