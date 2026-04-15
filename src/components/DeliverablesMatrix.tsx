"use client";

import { deliverables } from "@/lib/mock-data";
import {
  Plus,
  Download,
  RefreshCw,
  CheckCircle,
  Clock,
  Loader2,
  Truck,
  ExternalLink,
} from "lucide-react";

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-slate-500", bg: "bg-slate-50", label: "Pending" },
  rendering: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "Rendering" },
  ready: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", label: "Ready" },
  delivered: { icon: Truck, color: "text-violet-600", bg: "bg-violet-50", label: "Delivered" },
};

export default function DeliverablesMatrix() {
  const readyCount = deliverables.filter((d) => d.status === "ready").length;
  const totalCount = deliverables.length;

  return (
    <div className="h-full flex flex-col bg-subtle/50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Deliverables Matrix</h2>
            <p className="text-sm text-muted mt-0.5">Summer Refresh 2026 — {readyCount}/{totalCount} formats ready</p>
          </div>
          <div className="flex gap-2.5">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <RefreshCw className="w-4 h-4" />
              Render All Pending
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
              <Download className="w-4 h-4" />
              Export All Ready
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20">
              <Plus className="w-4 h-4" />
              Add Format
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-[1400px]">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {(["pending", "rendering", "ready", "delivered"] as const).map((status) => {
            const config = statusConfig[status];
            const count = deliverables.filter((d) => d.status === status).length;
            const Icon = config.icon;
            return (
              <div key={status} className="bg-white rounded-2xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${config.color} ${status === "rendering" ? "animate-spin" : ""}`} />
                </div>
                <p className="text-3xl font-bold text-foreground">{count}</p>
                <p className="text-sm text-muted mt-1">{config.label}</p>
              </div>
            );
          })}
        </div>

        {/* Matrix table */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50/80">
                {["Platform", "Format", "Dimensions", "Duration", "Status", "Actions"].map((h, i) => (
                  <th key={h} className={`${i === 5 ? 'text-right' : 'text-left'} px-5 py-3.5 text-[11px] font-semibold text-muted uppercase tracking-wider`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliverables.map((del) => {
                const config = statusConfig[del.status];
                const Icon = config.icon;
                return (
                  <tr key={del.id} className="border-b border-border/50 hover:bg-accent-light/30 transition-colors last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-border flex items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-500">{del.platform.split(" ")[0].slice(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{del.platform}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted">{del.format}</td>
                    <td className="px-5 py-4 font-mono text-sm text-muted">{del.dimensions}</td>
                    <td className="px-5 py-4 text-sm text-muted">{del.duration}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        <Icon className={`w-3 h-3 ${del.status === "rendering" ? "animate-spin" : ""}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {del.status === "ready" && (
                          <>
                            <button className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent-light transition-colors"><Download className="w-4 h-4" /></button>
                            <button className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent-light transition-colors"><ExternalLink className="w-4 h-4" /></button>
                          </>
                        )}
                        {del.status === "pending" && (
                          <button className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent-light transition-colors"><RefreshCw className="w-4 h-4" /></button>
                        )}
                        {del.assetId && del.status !== "ready" && (
                          <button className="p-2 rounded-lg text-muted hover:text-accent hover:bg-accent-light transition-colors"><ExternalLink className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
