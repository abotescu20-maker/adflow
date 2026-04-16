"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import CampaignDashboard from "@/components/CampaignDashboard";
import AssetBrowser from "@/components/AssetBrowser";
import AssetViewer from "@/components/AssetViewer";
import DeliverablesMatrix from "@/components/DeliverablesMatrix";
import { Asset } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";

type View = "dashboard" | "assets" | "viewer" | "deliverables";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [view, setView] = useState<View>("dashboard");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!wsLoading && workspaces.length === 0) {
      router.replace("/onboarding");
    }
  }, [user, authLoading, workspaces, wsLoading, router]);

  const handleAssetOpen = (asset: Asset) => {
    setSelectedAsset(asset);
    setView("viewer");
  };

  const handleBackFromViewer = () => {
    setView("assets");
    setSelectedAsset(null);
  };

  if (authLoading || wsLoading || !user || !activeWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-subtle/30">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentView={view}
        onNavigate={setView}
        selectedFolder={selectedFolder}
        onFolderSelect={(folderId) => {
          setSelectedFolder(folderId);
          setView("assets");
        }}
      />

      <main className="flex-1 overflow-hidden">
        {view === "dashboard" && (
          <CampaignDashboard
            onOpenCampaign={() => {
              setSelectedFolder(null);
              setView("assets");
            }}
          />
        )}
        {view === "assets" && (
          <AssetBrowser
            selectedFolder={selectedFolder}
            onAssetOpen={handleAssetOpen}
            onFolderSelect={setSelectedFolder}
          />
        )}
        {view === "viewer" && selectedAsset && (
          <AssetViewer asset={selectedAsset} onBack={handleBackFromViewer} />
        )}
        {view === "deliverables" && <DeliverablesMatrix />}
      </main>
    </div>
  );
}
