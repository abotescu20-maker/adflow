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
  Bell,
  Upload,
  Settings,
  Zap,
} from "lucide-react";
import { folders } from "@/lib/mock-data";

const iconMap: Record<string, React.ElementType> = {
  film: Film,
  image: Image,
  music: Music,
  scissors: Scissors,
  "check-circle": CheckCircle,
  "file-text": FileText,
};

interface SidebarProps {
  currentView: string;
  onNavigate: (view: "dashboard" | "assets" | "viewer" | "deliverables") => void;
  selectedFolder: string | null;
  onFolderSelect: (folderId: string | null) => void;
}

export default function Sidebar({
  currentView,
  onNavigate,
  selectedFolder,
  onFolderSelect,
}: SidebarProps) {
  return (
    <aside className="w-[240px] bg-sidebar-bg border-r border-border flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-sm">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-[15px] font-bold tracking-tight text-foreground">AdFlow</h1>
          <p className="text-[11px] text-muted font-medium">Post-Production</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 mb-1">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted bg-white border border-border hover:border-accent/30 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span className="text-[13px]">Search...</span>
          <span className="ml-auto text-[10px] text-muted/60 border border-border rounded px-1.5 py-0.5">⌘K</span>
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
          { key: "deliverables", label: "Deliverables", icon: Grid3X3 },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => {
              if (item.key === "assets") onFolderSelect(null);
              onNavigate(item.key as "dashboard" | "assets" | "deliverables");
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
              (currentView === item.key && (item.key !== "assets" || !selectedFolder))
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
        {folders.map((folder) => {
          const Icon = iconMap[folder.icon] || FolderOpen;
          const isSelected = currentView === "assets" && selectedFolder === folder.id;
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
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-400'}`}>
                {folder.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Share links */}
      <div className="px-3 py-2 border-t border-border">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-slate-500 hover:text-foreground hover:bg-white transition-all">
          <Share2 className="w-[16px] h-[16px]" />
          Share Links
          <span className="ml-auto text-[11px] bg-accent-light text-accent px-1.5 py-0.5 rounded-md font-medium">2</span>
        </button>
      </div>

      {/* Quick actions + User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            AB
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">Andrei B.</p>
            <p className="text-[11px] text-muted">Admin</p>
          </div>
          <button className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
