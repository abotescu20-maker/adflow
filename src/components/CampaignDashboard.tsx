"use client";

import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import NewCampaignModal from "@/components/NewCampaignModal";
import {
  Plus,
  ArrowUpRight,
  Clock,
  Package,
  TrendingUp,
  Users,
  Calendar,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { ApprovalStatus, Campaign } from "@/lib/schema";
import { useWorkspace } from "@/lib/workspace-context";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAuth } from "@/lib/auth-context";
import { seedDemoData } from "@/lib/seed";

interface Props {
  onOpenCampaign: (campaignId: string) => void;
}

const workflowStages: { key: ApprovalStatus; label: string; color: string }[] = [
  { key: "brief", label: "Brief", color: "bg-slate-400" },
  { key: "production", label: "Production", color: "bg-blue-500" },
  { key: "review", label: "Review", color: "bg-amber-500" },
  { key: "approved", label: "Approved", color: "bg-emerald-500" },
  { key: "delivered", label: "Delivered", color: "bg-violet-500" },
];

function formatDueDate(c: Campaign): string {
  try {
    const d = c.dueDate.toDate();
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function CampaignDashboard({ onOpenCampaign }: Props) {
  const { activeWorkspace } = useWorkspace();
  const { user, profile } = useAuth();
  const { campaigns, loading } = useCampaigns(activeWorkspace?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!activeWorkspace || !user || !profile) return;
    setSeeding(true);
    try {
      await seedDemoData({
        workspaceId: activeWorkspace.id,
        uid: user.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL ?? null,
      });
    } catch (err) {
      console.error("Seeding failed:", err);
      alert("Seeding failed — check console for details");
    } finally {
      setSeeding(false);
    }
  };

  const stats = {
    active: campaigns.filter((c) => c.status !== "delivered").length,
    inReview: campaigns.filter((c) => c.status === "review").length,
    dueThisWeek: campaigns.filter((c) => {
      try {
        const due = c.dueDate.toDate();
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return due >= now && due <= weekEnd;
      } catch {
        return false;
      }
    }).length,
    totalAssets: campaigns.reduce((sum, c) => sum + (c.assetsCount || 0), 0),
  };

  return (
    <div className="h-full overflow-y-auto bg-subtle/50">
      <NewCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => onOpenCampaign(id)}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
            <p className="text-sm text-muted mt-0.5">
              {activeWorkspace?.name} — {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={handleSeed}
              disabled={seeding}
              title="Create 4 demo campaigns with assets so you can see how it works"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-accent border border-accent/30 bg-accent-light/50 hover:bg-accent hover:text-white transition-colors shadow-sm disabled:opacity-50"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {seeding ? "Seeding…" : "Seed demo data"}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <Users className="w-4 h-4" />
              Invite
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-[1400px]">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Active Campaigns", value: stats.active, icon: TrendingUp, color: "text-accent", bg: "bg-accent-light" },
            { label: "In Review", value: stats.inReview, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Due This Week", value: stats.dueThisWeek, icon: Calendar, color: "text-red-500", bg: "bg-red-50" },
            { label: "Total Assets", value: stats.totalAssets, icon: Package, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Workflow pipeline */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">Workflow Pipeline</h3>
          <div className="flex items-center gap-2">
            {workflowStages.map((stage, i) => {
              const count = campaigns.filter((c) => c.status === stage.key).length;
              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className="flex-1 text-center">
                    <div className="relative h-2.5 rounded-full bg-slate-100 mb-3 overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${stage.color} transition-all`}
                        style={{ width: count > 0 ? '100%' : '0%', opacity: count > 0 ? 0.8 : 0.15 }}
                      />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted mt-0.5 font-medium">{stage.label}</p>
                  </div>
                  {i < workflowStages.length - 1 && (
                    <div className="w-8 flex items-center justify-center text-slate-300 mx-1">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Campaign cards */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">All Campaigns</h3>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-border p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent-light mx-auto mb-4 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-accent" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">
                No campaigns yet
              </h4>
              <p className="text-sm text-muted mb-5 max-w-sm mx-auto">
                Create your first campaign to start organizing footage, graphics and review cycles in one place.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
                >
                  <Plus className="w-4 h-4" />
                  Create first campaign
                </button>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-accent border border-accent/30 bg-accent-light/50 hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                >
                  {seeding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {seeding ? "Generating demo…" : "Or: load 4 demo campaigns"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => onOpenCampaign(campaign.id)}
                  className="group bg-white rounded-2xl border border-border hover:border-accent/30 hover:shadow-lg transition-all text-left overflow-hidden shadow-sm"
                >
                  <div className="h-36 bg-gradient-to-br from-slate-50 via-accent-light to-violet-50 relative overflow-hidden">
                    {campaign.thumbnailURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={campaign.thumbnailURL}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-5xl font-black text-accent/15">
                          {(campaign.brand || campaign.name)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1.5 shadow-sm">
                      <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
                      <div
                        className="h-full bg-accent rounded-r-full transition-all"
                        style={{ width: `${campaign.progress || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-0.5 group-hover:text-accent transition-colors truncate">
                      {campaign.name}
                    </h4>
                    <p className="text-xs text-muted mb-3 truncate">{campaign.client}</p>

                    <div className="flex items-center justify-between mb-3">
                      <StatusBadge status={campaign.status} />
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <Package className="w-3 h-3" />
                        <span>{campaign.assetsCount || 0}</span>
                        <span className="text-slate-300">·</span>
                        <Calendar className="w-3 h-3" />
                        <span>{formatDueDate(campaign)}</span>
                      </div>
                    </div>

                    {(campaign.platforms || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {campaign.platforms.slice(0, 5).map((p) => (
                          <span key={p} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-100">
                            {p}
                          </span>
                        ))}
                        {campaign.platforms.length > 5 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-400 border border-slate-100">
                            +{campaign.platforms.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
