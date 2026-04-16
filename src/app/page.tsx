"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import CampaignDashboard from "@/components/CampaignDashboard";
import AssetBrowser from "@/components/AssetBrowser";
import AssetViewer from "@/components/AssetViewer";
import DeliverablesMatrix from "@/components/DeliverablesMatrix";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";

type View = "dashboard" | "assets" | "viewer" | "deliverables";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [view, setView] = useState<View>("dashboard");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
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

  const handleOpenCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedFolder(null);
    setSelectedAssetId(null);
    setView("assets");
  };

  const handleOpenAsset = (assetId: string) => {
    setSelectedAssetId(assetId);
    setView("viewer");
  };

  const handleBackFromViewer = () => {
    setSelectedAssetId(null);
    setView("assets");
  };

  const handleNavigate = (newView: View) => {
    if (newView === "dashboard") {
      setSelectedCampaignId(null);
      setSelectedAssetId(null);
      setSelectedFolder(null);
    }
    setView(newView);
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
        onNavigate={handleNavigate}
        selectedFolder={selectedFolder}
        onFolderSelect={(folderId) => {
          setSelectedFolder(folderId);
          if (view !== "assets") setView("assets");
        }}
      />

      <main className="flex-1 overflow-hidden">
        {view === "dashboard" && (
          <CampaignDashboard onOpenCampaign={handleOpenCampaign} />
        )}
        {view === "assets" && selectedCampaignId && (
          <AssetBrowser
            workspaceId={activeWorkspace.id}
            campaignId={selectedCampaignId}
            selectedFolder={selectedFolder}
            onAssetOpen={handleOpenAsset}
            onFolderSelect={setSelectedFolder}
            onBack={() => {
              setSelectedCampaignId(null);
              setView("dashboard");
            }}
          />
        )}
        {view === "assets" && !selectedCampaignId && (
          <div className="h-full flex items-center justify-center bg-subtle/30">
            <div className="text-center">
              <p className="text-sm text-muted mb-3">Select a campaign to view assets</p>
              <button
                onClick={() => setView("dashboard")}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
              >
                Back to campaigns
              </button>
            </div>
          </div>
        )}
        {view === "viewer" && selectedCampaignId && selectedAssetId && (
          <AssetViewer
            workspaceId={activeWorkspace.id}
            campaignId={selectedCampaignId}
            assetId={selectedAssetId}
            onBack={handleBackFromViewer}
          />
        )}
        {view === "deliverables" && <DeliverablesMatrix />}
      </main>
    </div>
  );
}
