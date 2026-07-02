"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, collectionGroup, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Asset } from "@/lib/schema";

/**
 * Returns counts of assets per folder across the entire workspace (all campaigns).
 * Uses a collectionGroup query scoped to workspaceId.
 */
export function useFolderCounts(workspaceId: string | null): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!workspaceId) {
      setCounts({});
      return;
    }
    const q = query(
      collectionGroup(db, "assets"),
      where("workspaceId", "==", workspaceId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const folder = (d.data() as Asset).folder;
          if (folder) next[folder] = (next[folder] || 0) + 1;
        });
        setCounts(next);
      },
      () => setCounts({})
    );
    return () => unsub();
  }, [workspaceId]);

  return counts;
}
