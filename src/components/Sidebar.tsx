"use client";

import {
  LayoutDashboard,
  FolderOpen,
  Film,
  Image,
  Music,
  Scissors,
  CheckCircle,
  FileText,
  Grid3X3,
  Share2,
  Search,
  LogOut,
  ChevronDown,
  FolderKanban,
  Activity,
  Users,
} from "lucide-react";
import { BlackMariaMark } from "@/components/BlackMariaLogo";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useFolderCounts } from "@/hooks/useFolderCounts";
import { ACTOR_TYPE_LABELS } from "@/lib/schema";

const FOLDERS = [
  { id: "footage", name: "Raw Footage", icon: "film" },
  { id: "graphics", name: "Graphics", icon: "image" },
  { id: "sound", name: "Sound & Music", icon: "music" },
  { id: "edits", name: "Edits", icon: "scissors" },
  { id: "final", name: "Final Renders", icon: "check-circle" },
  { id: "briefs", name: "Client Briefs", icon: "file-text" },
] as const;

const iconMap: Record<string, React.ElementType> = {
  film: Film,
  image: Image,
  music: Music,
  scissors: Scissors,
  "check-circle": CheckCircle,
  "file-text": FileText,
};

export type View =
  | "dashboard"
  | "assets"
  | "viewer"
  | "deliverables"
  | "collections"
  | "activity"
  | "team"
  | "shareLinks";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: View) => void;
  selectedFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onOpenSearch?: () => void;
}

export default function Sidebar({
  currentView,
  onNavigate,
  selectedFolder,
  onFolderSelect,
  onOpenSearch,
}: SidebarProps) {
  const { profile, signOut } = useAuth();
  const {
    activeWorkspace,
    workspaces,
    setActiveWorkspaceId,
    currentRole,
    currentMember,
  } = useWorkspace();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const folderCounts = useFolderCounts(activeWorkspace?.id ?? null);

  const initials = (profile?.displayName || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="w-[240px] bg-sidebar-bg border-r border-border flex flex-col h-full shrink-0">
      {/* Logo + workspace switcher */}
      <div className="px-3 pt-3 pb-2 relative">
        <button
          onClick={() => setWsMenuOpen((o) => !o)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white transition-colors"
        >
          <span className="text-foreground shrink-0">
            <BlackMariaMark className="w-8 h-8" />
          </span>
          <div className="flex-1 min-w-0 text-left">
            <h1 className="text-[13px] font-bold tracking-tight text-foreground truncate">
              {activeWorkspace?.name || "Blackframe"}
            </h1>
            {currentRole && (
              <p className="text-[11px] text-muted font-medium truncate">
                {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
              </p>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted transition-transform ${
              wsMenuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {wsMenuOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg border border-border shadow-lg z-20 overflow-hidden">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setActiveWorkspaceId(ws.id);
                  setWsMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 transition-colors ${
                  ws.id === activeWorkspace?.id
                    ? "bg-accent-light text-accent font-medium"
                    : "text-foreground"
                }`}
              >
                <div className="w-6 h-6 rounded-md bg-accent-light flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                  {ws.name[0]?.toUpperCase()}
                </div>
                <span className="truncate">{ws.name}</span>
              </button>
            ))}
            <div className="border-t border-border py-1">
              <button
                onClick={() => {
                  setWsMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="px-3 mb-1">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted bg-white border border-border hover:border-accent/30 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-[13px]">Search...</span>
          <span className="ml-auto text-[10px] text-muted/60 border border-border rounded px-1.5 py-0.5">
            ⌘K
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-3 mt-3">
        <p className="px-2 py-1.5 text-[11px] font-semibold text-muted/70 uppercase tracking-widest">
          Navigate
        </p>
        {[
          { key: "dashboard", label: "Campaigns", icon: LayoutDashboard },
          { key: "assets", label: "All Assets", icon: FolderOpen },
          { key: "collections", label: "Collections", icon: FolderKanban },
          { key: "deliverables", label: "Deliverables", icon: Grid3X3 },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => {
              if (item.key === "assets") onFolderSelect(null);
              onNavigate(item.key as View);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
              currentView === item.key &&
              (item.key !== "assets" || !selectedFolder)
                ? "bg-accent text-white shadow-sm shadow-accent/25"
                : "text-slate-600 hover:text-foreground hover:bg-white"
            }`}
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Folders */}
      <nav className="px-3 mt-5 flex-1 overflow-y-auto">
        <p className="px-2 py-1.5 text-[11px] font-semibold text-muted/70 uppercase tracking-widest">
          Folders
        </p>
        {FOLDERS.map((folder) => {
          const Icon = iconMap[folder.icon] || FolderOpen;
          const isSelected =
            currentView === "assets" && selectedFolder === folder.id;
          const count = folderCounts[folder.id] || 0;
          return (
            <button
              key={folder.id}
              onClick={() => onFolderSelect(folder.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
                isSelected
                  ? "bg-accent-light text-accent font-medium"
                  : "text-slate-500 hover:text-foreground hover:bg-white"
              }`}
            >
              <Icon className="w-[16px] h-[16px]" />
              <span className="flex-1 text-left truncate">{folder.name}</span>
              {count > 0 && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                    isSelected
                      ? "bg-accent/10 text-accent"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Team / Share / Activity */}
      <div className="px-3 py-2 border-t border-border space-y-0.5">
        <button
          onClick={() => onNavigate("shareLinks")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
            currentView === "shareLinks"
              ? "bg-accent-light text-accent font-medium"
              : "text-slate-500 hover:text-foreground hover:bg-white"
          }`}
        >
          <Share2 className="w-[16px] h-[16px]" />
          Share Links
        </button>
        <button
          onClick={() => onNavigate("team")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
            currentView === "team"
              ? "bg-accent-light text-accent font-medium"
              : "text-slate-500 hover:text-foreground hover:bg-white"
          }`}
        >
          <Users className="w-[16px] h-[16px]" />
          Team
        </button>
        <button
          onClick={() => onNavigate("activity")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
            currentView === "activity"
              ? "bg-accent-light text-accent font-medium"
              : "text-slate-500 hover:text-foreground hover:bg-white"
          }`}
        >
          <Activity className="w-[16px] h-[16px]" />
          Activity
        </button>
      </div>

      {/* Quick actions + User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
            style={{
              background: currentMember?.color
                ? currentMember.color
                : "linear-gradient(to bottom right, var(--accent), #8b5cf6)",
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">
              {profile?.displayName || "User"}
            </p>
            <p className="text-[11px] text-muted truncate">
              {currentMember?.actorType
                ? `${ACTOR_TYPE_LABELS[currentMember.actorType]}${
                    currentMember.craft ? ` · ${currentMember.craft}` : ""
                  }`
                : profile?.email}
            </p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
