"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import CampaignDashboard from "@/components/CampaignDashboard";
import AssetBrowser from "@/components/AssetBrowser";
import AssetViewer from "@/components/AssetViewer";
import DeliverablesMatrix from "@/components/DeliverablesMatrix";
import { Asset } from "@/lib/types";

type View = "dashboard" | "assets" | "viewer" | "deliverables";

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const handleAssetOpen = (asset: Asset) => {
    setSelectedAsset(asset);
    setView("viewer");
  };

  const handleBackFromViewer = () => {
    setView("assets");
    setSelectedAsset(null);
  };

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
