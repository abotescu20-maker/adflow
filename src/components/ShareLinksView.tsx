"use client";

import { useState } from "react";
import {
  Link as LinkIcon,
  Copy,
  Check,
  Eye,
  Clock,
  Trash2,
  Shield,
  Loader2,
} from "lucide-react";
import { useShareLinks } from "@/hooks/useShareLinks";
import { useWorkspace } from "@/lib/workspace-context";
import { revokeShareLink } from "@/lib/firestore/shareLinks";
import type { ShareLink } from "@/lib/schema";

function formatTimeAgo(ts: ShareLink["createdAt"] | undefined | null): string {
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
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

function formatExpiry(ts: ShareLink["expiresAt"] | undefined | null): string {
  if (!ts) return "Never";
  try {
    const d = ts.toDate();
    const diff = d.getTime() - Date.now();
    if (diff < 0) return "Expired";
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
    if (days <= 1) return "Today";
    return `in ${days}d`;
  } catch {
    return "—";
  }
}

export default function ShareLinksView() {
  const { activeWorkspace } = useWorkspace();
  const { links, loading } = useShareLinks(activeWorkspace?.id ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!activeWorkspace) return null;

  const copy = async (link: ShareLink) => {
    const url = `${window.location.origin}/s/${link.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-xl font-bold text-foreground">Share Links</h2>
        <p className="text-sm text-muted mt-0.5">
          External review access with granular permissions, expiration, and audit
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : links.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No share links yet</h3>
            <p className="text-sm text-muted">
              Open any asset or campaign and click <b>Share</b> to create a link for clients or reviewers.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-2">
            {links.map((link) => {
              const isRevoked = !!link.revokedAt;
              return (
                <div
                  key={link.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isRevoked
                      ? "border-border bg-slate-50 opacity-60"
                      : "border-border bg-white hover:border-accent/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                      <LinkIcon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {link.name}
                        </h3>
                        {isRevoked && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted flex-wrap">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {link.viewCount || 0} view{link.viewCount !== 1 ? "s" : ""}
                        </span>
                        <span>·</span>
                        <span>Created {formatTimeAgo(link.createdAt)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expires {formatExpiry(link.expiresAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {link.permissions.canView && <Perm label="View" />}
                        {link.permissions.canComment && <Perm label="Comment" />}
                        {link.permissions.canApprove && <Perm label="Approve" />}
                        {link.permissions.canDownload && <Perm label="Download" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isRevoked && (
                        <>
                          <button
                            onClick={() => copy(link)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border border-border bg-white hover:border-accent/40 hover:text-accent"
                          >
                            {copiedId === link.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedId === link.id ? "Copied" : "Copy link"}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Revoke "${link.name}"?`)) return;
                              await revokeShareLink(activeWorkspace.id, link.id, link.token);
                            }}
                            className="p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Perm({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-md">
      <Shield className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
