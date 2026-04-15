"use client";

import { campaigns } from "@/lib/mock-data";
import StatusBadge from "@/components/StatusBadge";
import {
  Plus,
  ArrowUpRight,
  Clock,
  Package,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";
import { ApprovalStatus } from "@/lib/types";

interface Props {
  onOpenCampaign: () => void;
}

const workflowStages: { key: ApprovalStatus; label: string; color: string }[] = [
  { key: "brief", label: "Brief", color: "bg-slate-400" },
  { key: "production", label: "Production", color: "bg-blue-500" },
  { key: "review", label: "Review", color: "bg-amber-500" },
  { key: "approved", label: "Approved", color: "bg-emerald-500" },
  { key: "delivered", label: "Delivered", color: "bg-violet-500" },
];

export default function CampaignDashboard({ onOpenCampaign }: Props) {
  const stats = {
    active: campaigns.filter((c) => !["delivered"].includes(c.status)).length,
    inReview: campaigns.filter((c) => c.status === "review").length,
    dueThisWeek: campaigns.filter((c) => {
      const due = new Date(c.dueDate);
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return due >= now && due <= weekEnd;
    }).length,
    totalAssets: campaigns.reduce((sum, c) => sum + c.assetsCount, 0),
  };

  return (
    <div className="h-full overflow-y-auto bg-subtle/50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Campaigns</h2>
            <p className="text-sm text-muted mt-0.5">
              Manage your advertising post-production projects
            </p>
          </div>
          <div className="flex gap-2.5">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <Users className="w-4 h-4" />
              Invite
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={onOpenCampaign}
                className="group bg-white rounded-2xl border border-border hover:border-accent/30 hover:shadow-lg transition-all text-left overflow-hidden shadow-sm"
              >
                {/* Thumbnail placeholder */}
                <div className="h-36 bg-gradient-to-br from-slate-50 via-accent-light to-violet-50 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl font-black text-accent/15">
                      {campaign.brand[0]}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1.5 shadow-sm">
                    <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
                  </div>
                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
                    <div
                      className="h-full bg-accent rounded-r-full transition-all"
                      style={{ width: `${campaign.progress}%` }}
                    />
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="text-sm font-semibold text-foreground mb-0.5 group-hover:text-accent transition-colors">
                    {campaign.name}
                  </h4>
                  <p className="text-xs text-muted mb-3">{campaign.client}</p>

                  <div className="flex items-center justify-between mb-3">
                    <StatusBadge status={campaign.status} />
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Package className="w-3 h-3" />
                      <span>{campaign.assetsCount}</span>
                      <span className="text-slate-300">·</span>
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(campaign.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Platform tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.platforms.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-100">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
