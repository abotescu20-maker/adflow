"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { notificationsQuery } from "@/lib/firestore/notifications";
import type { Notification } from "@/lib/schema";

export function useNotifications(uid: string | null, max = 30) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      notificationsQuery(uid, max),
      (snap) => {
        const items = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Notification)
        );
        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.read).length);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid, max]);

  return { notifications, unreadCount, loading };
}
