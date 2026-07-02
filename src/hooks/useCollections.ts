"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { collectionsQuery } from "@/lib/firestore/collections";
import type { Collection } from "@/lib/schema";

export function useCollections(workspaceId: string | null) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setCollections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      collectionsQuery(workspaceId),
      (snap) => {
        setCollections(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Collection))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId]);

  return { collections, loading };
}
