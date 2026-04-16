"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Workspace, WorkspaceMember, WorkspaceRole } from "@/lib/schema";
import { useAuth } from "@/lib/auth-context";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  currentRole: WorkspaceRole | null;
  loading: boolean;
  setActiveWorkspaceId: (id: string) => void;
  createWorkspace: (name: string, brand?: string) => Promise<string>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const DEFAULT_LIMITS = {
  free: { members: 5, campaigns: 3, storageGb: 2, transcodingMinutesPerMonth: 60 },
  team: { members: 15, campaigns: 20, storageGb: 100, transcodingMinutesPerMonth: 600 },
  business: { members: 50, campaigns: 100, storageGb: 500, transcodingMinutesPerMonth: 3000 },
  enterprise: { members: 9999, campaigns: 9999, storageGb: 9999, transcodingMinutesPerMonth: 99999 },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40) || "workspace";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [currentRole, setCurrentRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user's workspaces
  useEffect(() => {
    if (!user || !profile) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    if (profile.workspaces.length === 0) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "workspaces"),
      where("__name__", "in", profile.workspaces.slice(0, 10))
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workspace));
      setWorkspaces(list);
      // Auto-select default or first
      const wantedId =
        activeWorkspaceId ||
        profile.defaultWorkspaceId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("adflow:activeWorkspaceId") || list[0]?.id
          : list[0]?.id);
      if (wantedId && list.find((w) => w.id === wantedId)) {
        setActiveWorkspaceIdState(wantedId);
      } else if (list[0]) {
        setActiveWorkspaceIdState(list[0].id);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile, activeWorkspaceId]);

  // Track active workspace + role
  useEffect(() => {
    if (!activeWorkspaceId || !user) {
      setActiveWorkspace(null);
      setCurrentRole(null);
      return;
    }
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    if (ws) setActiveWorkspace(ws);

    // Load role
    const memberRef = doc(db, "workspaces", activeWorkspaceId, "members", user.uid);
    const unsub = onSnapshot(memberRef, (snap) => {
      if (snap.exists()) {
        setCurrentRole((snap.data() as WorkspaceMember).role);
      }
    });
    return () => unsub();
  }, [activeWorkspaceId, workspaces, user]);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("adflow:activeWorkspaceId", id);
    }
  };

  const createWorkspace = async (name: string, brand?: string): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    // 1. Create workspace document first (rule only requires auth + ownerUid match)
    const workspaceRef = doc(collection(db, "workspaces"));
    const workspace: Omit<Workspace, "id" | "createdAt" | "updatedAt"> = {
      name,
      slug: `${slugify(name)}-${workspaceRef.id.slice(0, 6)}`,
      ownerUid: user.uid,
      plan: "free",
      brandColor: "#4f46e5",
      limits: DEFAULT_LIMITS.free,
      usage: { members: 1, campaigns: 0, storageBytes: 0, transcodingMinutesThisMonth: 0 },
    };
    await setDoc(workspaceRef, {
      ...workspace,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Now workspace exists, so member creation rule can verify ownerUid via get()
    const memberRef = doc(db, "workspaces", workspaceRef.id, "members", user.uid);
    await setDoc(memberRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "User",
      photoURL: user.photoURL || null,
      role: "owner" as WorkspaceRole,
      addedAt: serverTimestamp(),
      addedBy: user.uid,
    });

    // 3. Add workspace to user's profile
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, {
      workspaces: arrayUnion(workspaceRef.id),
      defaultWorkspaceId: workspaceRef.id,
      lastActiveAt: serverTimestamp(),
    });

    setActiveWorkspaceId(workspaceRef.id);
    return workspaceRef.id;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        currentRole,
        loading,
        setActiveWorkspaceId,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
