"use client";

import { useState } from "react";
import { X, Link as LinkIcon, Copy, Check, Shield, Loader2 } from "lucide-react";
import { createShareLink } from "@/lib/firestore/shareLinks";
import { logActivity } from "@/lib/firestore/activity";
import { createNotification } from "@/lib/firestore/notifications";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

interface Props {
  workspaceId: string;
  campaignId?: string;
  assetId?: string;
  assetName?: string;
  campaignName?: string;
  onClose: () => void;
}

export default function ShareLinkModal({
  workspaceId,
  campaignId,
  assetId,
  assetName,
  campaignName,
  onClose,
}: Props) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(
    assetName ? `Review: ${assetName}` : campaignName ? `Review: ${campaignName}` : "Client Review"
  );
  const [canComment, setCanComment] = useState(true);
  const [canApprove, setCanApprove] = useState(true);
  const [canDownload, setCanDownload] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(14);
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!user || !profile) return;
    setCreating(true);
    try {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;
      const { token } = await createShareLink(workspaceId, {
        name,
        campaignId,
        assetIds: assetId ? [assetId] : [],
        permissions: {
          canView: true,
          canComment,
          canApprove,
          canDownload,
        },
        expiresAt,
        createdBy: user.uid,
      });
      const url = `${window.location.origin}/s/${token}`;
      setShareUrl(url);

      await logActivity(workspaceId, {
        actorId: user.uid,
        actorName: profile.displayName,
        actorAvatar: profile.photoURL,
        action: "share_link.created",
        targetType: "share_link",
        targetId: token,
        targetName: name,
        campaignId,
        assetId,
        assetName,
      });
      await createNotification({
        uid: user.uid,
        workspaceId,
        kind: "invitation",
        title: "Share link ready",
        body: `"${name}" — anyone with the link can ${permissionsSummary()} until expiry.`,
        actorId: user.uid,
        actorName: profile.displayName,
        targetUrl: "/",
      }).catch(() => {});
      toast.success("Share link created", "Copy it and send to reviewers.");
    } catch (err) {
      console.error(err);
      toast.error(
        "Couldn't create link",
        err instanceof Error ? err.message : "Please try again"
      );
    } finally {
      setCreating(false);
    }
  };

  const permissionsSummary = () => {
    const parts: string[] = ["view"];
    if (canComment) parts.push("comment");
    if (canApprove) parts.push("approve");
    if (canDownload) parts.push("download");
    return parts.join(", ");
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center">
              <LinkIcon className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Share link</h3>
              <p className="text-[11px] text-muted">
                {assetName ? `For ${assetName}` : campaignName ? `For ${campaignName}` : "External review access"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!shareUrl ? (
            <>
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">
                  Link name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-border rounded-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 block">
                  Permissions
                </label>
                <div className="space-y-2">
                  <PermToggle
                    label="Can comment"
                    description="Reviewers can leave feedback"
                    checked={canComment}
                    onChange={setCanComment}
                  />
                  <PermToggle
                    label="Can approve"
                    description="Reviewers can approve or request changes"
                    checked={canApprove}
                    onChange={setCanApprove}
                  />
                  <PermToggle
                    label="Can download"
                    description="Reviewers can download the original file"
                    checked={canDownload}
                    onChange={setCanDownload}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">
                  Expires in
                </label>
                <div className="flex gap-1.5">
                  {[
                    { v: 1, l: "1 day" },
                    { v: 7, l: "7 days" },
                    { v: 14, l: "14 days" },
                    { v: 30, l: "30 days" },
                    { v: null, l: "Never" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      onClick={() => setExpiresInDays(o.v)}
                      className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors ${
                        expiresInDays === o.v
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-600 border-border hover:border-accent/30"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200/60">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Anyone with the link can access according to the permissions above.
                  Revoke at any time from the Share Links page.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="text-base font-semibold mb-1">Link created</h4>
                <p className="text-xs text-muted">
                  Share this URL with your client or reviewers
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onClick={(e) => e.currentTarget.select()}
                    className="flex-1 bg-white border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-700 outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-accent text-white hover:bg-accent-hover shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 flex gap-2">
          {!shareUrl ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
                Create link
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PermToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border hover:border-accent/30 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted">{description}</p>
      </div>
      <div
        className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${
          checked ? "bg-accent" : "bg-slate-300"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}
