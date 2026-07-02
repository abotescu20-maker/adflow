"use client";

import { Loader2, Activity as ActivityIcon } from "lucide-react";
import { useWorkspaceActivity } from "@/hooks/useActivity";
import { useWorkspace } from "@/lib/workspace-context";
import type { ActivityEntry } from "@/lib/schema";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimeAgo(ts: ActivityEntry["createdAt"] | undefined): string {
  if (!ts) return "—";
  try {
    const d = ts.toDate();
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

function describeAction(a: ActivityEntry["action"]): string {
  const map: Record<string, string> = {
    "workspace.created": "created the workspace",
    "member.invited": "invited a team member",
    "member.joined": "joined the workspace",
    "member.removed": "removed a team member",
    "member.role_changed": "changed a member's role",
    "campaign.created": "created a campaign",
    "campaign.updated": "updated a campaign",
    "campaign.status_changed": "changed campaign status",
    "campaign.deleted": "deleted a campaign",
    "asset.uploaded": "uploaded an asset",
    "asset.version_uploaded": "uploaded a new version",
    "asset.status_changed": "changed asset status",
    "asset.approved": "approved an asset",
    "asset.rejected": "requested changes",
    "asset.assigned": "assigned an asset",
    "asset.deleted": "deleted an asset",
    "comment.posted": "left a comment",
    "comment.resolved": "resolved a comment",
    "comment.mentioned": "mentioned someone",
    "review.round_opened": "opened a review round",
    "review.round_completed": "completed a review round",
    "review.approval_given": "approved a review",
    "review.changes_requested": "requested changes on a review",
    "share_link.created": "created a share link",
    "share_link.revoked": "revoked a share link",
    "share_link.viewed": "viewed via a share link",
    "deliverable.rendered": "rendered a deliverable",
    "deliverable.delivered": "delivered a deliverable",
    "collection.created": "created a collection",
  };
  return map[a] || a.replace(/\./g, " ");
}

export default function ActivityView() {
  const { activeWorkspace } = useWorkspace();
  const { entries, loading } = useWorkspaceActivity(activeWorkspace?.id ?? null, 100);

  if (!activeWorkspace) return null;

  // Group by day
  const groups: Array<{ day: string; items: ActivityEntry[] }> = [];
  for (const e of entries) {
    const d = e.createdAt?.toDate?.() || new Date();
    const day = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-xl font-bold text-foreground">Activity</h2>
        <p className="text-sm text-muted mt-0.5">
          Everything that happens in {activeWorkspace.name} — audit-trail, not just a feed
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
              <ActivityIcon className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
            <p className="text-sm text-muted">
              Upload an asset, leave a comment or create a share link to see activity here.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-6">
            {groups.map((g) => (
              <div key={g.day} className="mb-6">
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3 px-1">
                  {g.day}
                </h3>
                <div className="bg-white border border-border rounded-xl divide-y divide-border">
                  {g.items.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {getInitials(e.actorName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold">{e.actorName}</span>{" "}
                          <span className="text-muted">{describeAction(e.action)}</span>
                          {e.targetName && (
                            <>
                              {" "}
                              <span className="font-medium text-foreground">
                                &ldquo;{e.targetName}&rdquo;
                              </span>
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                          <span>{formatTimeAgo(e.createdAt)}</span>
                          {e.campaignName && (
                            <>
                              <span>·</span>
                              <span>{e.campaignName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
