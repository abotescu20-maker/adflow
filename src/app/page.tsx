"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar, { type View } from "@/components/Sidebar";
import CampaignDashboard from "@/components/CampaignDashboard";
import AssetBrowser from "@/components/AssetBrowser";
import AssetViewer from "@/components/AssetViewer";
import DeliverablesMatrix from "@/components/DeliverablesMatrix";
import CollectionsView from "@/components/CollectionsView";
import CollectionResults from "@/components/CollectionResults";
import type { Collection } from "@/lib/schema";
import ActivityView from "@/components/ActivityView";
import TeamView from "@/components/TeamView";
import ShareLinksView from "@/components/ShareLinksView";
import NotificationsBell from "@/components/NotificationsBell";
import GlobalSearch from "@/components/GlobalSearch";
import { ContextPicker } from "@/components/ContextPicker";
import ChatLayer from "@/components/ChatLayer";
import CalendarView from "@/components/CalendarView";
import NotesPanel from "@/components/NotesPanel";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { updateMemberColor } from "@/lib/firestore/members";
import { departmentColor } from "@/lib/schema";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    currentMember,
    loading: wsLoading,
  } = useWorkspace();
  const router = useRouter();

  const [view, setView] = useState<View>("dashboard");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

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

  // Colors are derived from the department (client feedback 17.07). Members
  // who picked a color before the change get silently realigned on open.
  useEffect(() => {
    if (!user || !activeWorkspace || !currentMember?.actorType) return;
    const should = departmentColor(
      currentMember.actorType,
      currentMember.craft
    );
    if (currentMember.color !== should) {
      updateMemberColor(activeWorkspace.id, user.uid, should).catch(() => {});
    }
  }, [user, activeWorkspace, currentMember]);

  // Deep-link: open a specific asset from a notification link (/?campaign=..&asset=..)
  useEffect(() => {
    if (authLoading || wsLoading || !user) return;
    const params = new URLSearchParams(window.location.search);
    const camp = params.get("campaign");
    const asset = params.get("asset");
    if (camp && asset) {
      setSelectedCampaignId(camp);
      setSelectedAssetId(asset);
      setView("viewer");
      window.history.replaceState(null, "", "/");
    }
  }, [authLoading, wsLoading, user]);

  // ⌘K / Ctrl+K global search shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const handleOpenAssetCross = (campaignId: string, assetId: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedAssetId(assetId);
    setView("viewer");
  };

  const handleBackFromViewer = () => {
    setSelectedAssetId(null);
    setView("assets");
  };

  const handleNavigate = (newView: View) => {
    setOpenCollection(null);
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
        onOpenSearch={() => setSearchOpen(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* One top band (client mockup): users & messages left, nav right —
            in flow, so it can never sit on top of page content. */}
        <ChatLayer
          rightSlot={
            <>
              <button
                onClick={() => handleNavigate("dashboard")}
                className={`text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  view === "dashboard"
                    ? "text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Dashboard
              </button>
              <span className="text-muted/40 text-[10px]">|</span>
              <button
                onClick={() => setCalendarOpen(true)}
                className="text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-foreground transition-colors"
              >
                Calendar
              </button>
              <span className="text-muted/40 text-[10px]">|</span>
              <button
                onClick={() => setNotesOpen(true)}
                className="text-[10px] font-semibold uppercase tracking-widest text-muted hover:text-foreground transition-colors"
              >
                Notes
              </button>
              <NotificationsBell />
            </>
          }
        />

        <div className="flex-1 overflow-hidden">
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
                <p className="text-sm text-muted mb-3">
                  Select a campaign to view assets
                </p>
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
          {view === "collections" &&
            (openCollection ? (
              <CollectionResults
                workspaceId={activeWorkspace.id}
                collection={openCollection}
                onBack={() => setOpenCollection(null)}
                onOpenAsset={(campaignId, assetId) => {
                  setOpenCollection(null);
                  handleOpenAssetCross(campaignId, assetId);
                }}
              />
            ) : (
              <CollectionsView onOpen={(c) => setOpenCollection(c)} />
            ))}
          {view === "activity" && <ActivityView />}
          {view === "team" && <TeamView />}
          {view === "shareLinks" && <ShareLinksView />}
        </div>
      </main>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenCampaign={handleOpenCampaign}
        onOpenAsset={handleOpenAssetCross}
      />

      {calendarOpen && <CalendarView onClose={() => setCalendarOpen(false)} />}
      {notesOpen && <NotesPanel onClose={() => setNotesOpen(false)} />}

      {/* Blackframe P2: on first entry into a workspace, ask why you're here
          and what your craft is before showing the project. */}
      {currentMember && !currentMember.actorType && <ContextPicker />}
    </div>
  );
}
