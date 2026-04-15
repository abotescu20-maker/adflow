"use client";

import { useState } from "react";
import { assets, folders } from "@/lib/mock-data";
import { Asset } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import {
  Film,
  Image,
  Music,
  FileText,
  MessageSquare,
  Upload,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronRight,
} from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  video: Film,
  image: Image,
  audio: Music,
  document: FileText,
};

const typeColors: Record<string, { bg: string; icon: string }> = {
  video: { bg: "bg-blue-50", icon: "text-blue-500" },
  image: { bg: "bg-emerald-50", icon: "text-emerald-500" },
  audio: { bg: "bg-violet-50", icon: "text-violet-500" },
  document: { bg: "bg-amber-50", icon: "text-amber-500" },
};

interface Props {
  selectedFolder: string | null;
  onAssetOpen: (asset: Asset) => void;
  onFolderSelect: (folderId: string | null) => void;
}

export default function AssetBrowser({ selectedFolder, onAssetOpen, onFolderSelect }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredAssets = selectedFolder
    ? assets.filter((a) => a.folder === selectedFolder)
    : assets;

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="h-full flex flex-col bg-subtle/50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => onFolderSelect(null)} className="text-muted hover:text-accent font-medium transition-colors">
              Summer Refresh 2026
            </button>
            {currentFolder && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-semibold text-foreground">{currentFolder.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-white border border-border rounded-lg overflow-hidden shadow-sm">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </button>
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20">
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
        </div>

        {/* Quick folder chips */}
        {!selectedFolder && (
          <div className="px-8 pb-3 flex gap-2 overflow-x-auto">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onFolderSelect(folder.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-500 bg-white border border-border hover:border-accent/30 hover:text-accent transition-all whitespace-nowrap shadow-sm"
              >
                {folder.name}
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">{folder.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Asset count */}
      <div className="px-8 py-3 text-xs font-medium text-muted">
        {filteredAssets.length} Assets
      </div>

      {/* Assets grid / list */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type] || FileText;
              const colors = typeColors[asset.type] || typeColors.document;
              return (
                <button
                  key={asset.id}
                  onClick={() => onAssetOpen(asset)}
                  className="group bg-white rounded-xl border border-border hover:border-accent/30 hover:shadow-lg transition-all text-left overflow-hidden shadow-sm"
                >
                  <div className="aspect-video bg-slate-50 relative flex items-center justify-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                      <Icon className={`w-6 h-6 ${colors.icon}`} />
                    </div>
                    {asset.duration && (
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-foreground/80 text-white backdrop-blur-sm">
                        {asset.duration}
                      </span>
                    )}
                    {asset.version > 1 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent text-white shadow-sm">
                        V{asset.version}
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-xs font-semibold text-foreground truncate mb-1 group-hover:text-accent transition-colors">
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-muted">
                        {asset.uploadedBy} · {asset.size}
                      </span>
                      {asset.comments > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-muted">
                          <MessageSquare className="w-3 h-3" />
                          {asset.comments}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] text-muted uppercase tracking-wider font-semibold border-b border-border bg-slate-50">
              <div className="col-span-4">Name</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Version</div>
              <div className="col-span-1">Size</div>
              <div className="col-span-2">Uploaded</div>
              <div className="col-span-1 text-right">Comments</div>
            </div>
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type] || FileText;
              const colors = typeColors[asset.type] || typeColors.document;
              return (
                <button
                  key={asset.id}
                  onClick={() => onAssetOpen(asset)}
                  className="w-full grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-accent-light/50 transition-colors items-center text-left border-b border-border/50 last:border-0"
                >
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
                      <Icon className={`w-4 h-4 ${colors.icon}`} />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate">{asset.name}</span>
                  </div>
                  <div className="col-span-1 text-xs text-muted capitalize">{asset.type}</div>
                  <div className="col-span-2"><StatusBadge status={asset.status} /></div>
                  <div className="col-span-1 text-xs font-medium text-muted">V{asset.version}</div>
                  <div className="col-span-1 text-xs text-muted">{asset.size}</div>
                  <div className="col-span-2 text-xs text-muted">{asset.uploadedBy} · {asset.uploadedAt}</div>
                  <div className="col-span-1 text-xs text-muted text-right flex items-center justify-end gap-1">
                    {asset.comments > 0 && (
                      <>
                        <MessageSquare className="w-3 h-3" />
                        {asset.comments}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
