"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { membersQuery, invitationsQuery } from "@/lib/firestore/members";
import type { WorkspaceMember, WorkspaceInvitation } from "@/lib/schema";

export function useMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      membersQuery(workspaceId),
      (snap) => {
        setMembers(
          snap.docs.map((d) => ({ ...d.data() } as WorkspaceMember))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [workspaceId]);

  return { members, loading };
}

export function useInvitations(workspaceId: string | null) {
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setInvitations([]);
      return;
    }
    const unsub = onSnapshot(
      invitationsQuery(workspaceId),
      (snap) => {
        setInvitations(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as WorkspaceInvitation)
          )
        );
      },
      () => setInvitations([])
    );
    return () => unsub();
  }, [workspaceId]);

  return invitations;
}
