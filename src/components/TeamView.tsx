"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Loader2,
  Trash2,
  Clock,
  Copy,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useMembers, useInvitations } from "@/hooks/useMembers";
import {
  createInvitation,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from "@/lib/firestore/members";
import { logActivity } from "@/lib/firestore/activity";
import type { WorkspaceRole } from "@/lib/schema";

const ROLE_BADGE: Record<WorkspaceRole, { label: string; class: string }> = {
  owner: { label: "Owner", class: "bg-violet-100 text-violet-700" },
  admin: { label: "Admin", class: "bg-accent-light text-accent" },
  editor: { label: "Editor", class: "bg-blue-100 text-blue-700" },
  reviewer: { label: "Reviewer", class: "bg-amber-100 text-amber-700" },
  client: { label: "Client", class: "bg-emerald-100 text-emerald-700" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TeamView() {
  const { user, profile } = useAuth();
  const { activeWorkspace, currentRole } = useWorkspace();
  const { members, loading } = useMembers(activeWorkspace?.id ?? null);
  const invitations = useInvitations(activeWorkspace?.id ?? null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const canManage = currentRole === "owner" || currentRole === "admin";

  if (!activeWorkspace) return null;

  const pendingInvites = invitations.filter((i) => !i.acceptedAt);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Team</h2>
          <p className="text-sm text-muted mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""} in {activeWorkspace.name}
            {pendingInvites.length > 0 &&
              ` · ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite member
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            <section>
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2">
                Members
              </h3>
              <div className="bg-white border border-border rounded-xl divide-y divide-border">
                {members.map((m) => {
                  const badge = ROLE_BADGE[m.role];
                  return (
                    <div
                      key={m.uid}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {getInitials(m.displayName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {m.displayName}
                          </p>
                          {m.uid === user?.uid && (
                            <span className="text-[10px] text-accent font-semibold">
                              (you)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate">{m.email}</p>
                      </div>
                      {canManage && m.role !== "owner" && m.uid !== user?.uid ? (
                        <select
                          value={m.role}
                          onChange={async (e) => {
                            const newRole = e.target.value as WorkspaceRole;
                            await updateMemberRole(activeWorkspace.id, m.uid, newRole);
                            if (user && profile)
                              await logActivity(activeWorkspace.id, {
                                actorId: user.uid,
                                actorName: profile.displayName,
                                action: "member.role_changed",
                                targetType: "member",
                                targetId: m.uid,
                                targetName: m.displayName,
                                metadata: { newRole },
                              });
                          }}
                          className={`text-[11px] font-semibold rounded-md px-2 py-1 border-0 cursor-pointer ${badge.class}`}
                        >
                          {(["admin", "editor", "reviewer", "client"] as WorkspaceRole[]).map(
                            (r) => (
                              <option key={r} value={r}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold rounded-md px-2 py-1 ${badge.class}`}
                        >
                          {badge.label}
                        </span>
                      )}
                      {canManage && m.role !== "owner" && m.uid !== user?.uid && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove ${m.displayName} from the workspace?`)) return;
                            await removeMember(activeWorkspace.id, m.uid);
                            if (user && profile)
                              await logActivity(activeWorkspace.id, {
                                actorId: user.uid,
                                actorName: profile.displayName,
                                action: "member.removed",
                                targetType: "member",
                                targetId: m.uid,
                                targetName: m.displayName,
                              });
                          }}
                          className="p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {pendingInvites.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2">
                  Pending invitations
                </h3>
                <div className="bg-white border border-border rounded-xl divide-y divide-border">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {inv.email}
                        </p>
                        <p className="text-[11px] text-muted">
                          Invited as {ROLE_BADGE[inv.role].label} by {inv.invitedByName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="w-3 h-3" />
                        Pending
                      </div>
                      {canManage && (
                        <button
                          onClick={() => revokeInvitation(activeWorkspace.id, inv.id)}
                          className="p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-accent-light/40 border border-accent/20 rounded-xl p-4">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground mb-1">Role permissions</p>
                  <ul className="space-y-0.5 text-slate-600">
                    <li>
                      <b>Owner</b> — full control, billing, delete workspace
                    </li>
                    <li>
                      <b>Admin</b> — manage team, campaigns, assets
                    </li>
                    <li>
                      <b>Editor</b> — create/upload/approve assets
                    </li>
                    <li>
                      <b>Reviewer</b> — comment & approve
                    </li>
                    <li>
                      <b>Client</b> — external stakeholder, view-only
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {inviteOpen && (
        <InviteModal
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}

function InviteModal({
  workspaceId,
  workspaceName,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("editor");
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!user || !profile || !email.trim()) return;
    setCreating(true);
    try {
      const { token } = await createInvitation(workspaceId, {
        email,
        role,
        invitedBy: user.uid,
        invitedByName: profile.displayName,
        workspaceName,
      });
      const url = `${window.location.origin}/join/${token}`;
      setInviteUrl(url);
      await logActivity(workspaceId, {
        actorId: user.uid,
        actorName: profile.displayName,
        action: "member.invited",
        targetType: "member",
        targetId: email,
        targetName: email,
        metadata: { role },
      });
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">Invite team member</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {!inviteUrl ? (
            <>
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@agency.com"
                  className="w-full text-sm px-3 py-2 border border-border rounded-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["admin", "editor", "reviewer", "client"] as WorkspaceRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`text-xs font-medium px-3 py-2 rounded-md border transition-colors text-left ${
                        role === r
                          ? "bg-accent text-white border-accent"
                          : "bg-white text-slate-600 border-border hover:border-accent/40"
                      }`}
                    >
                      {ROLE_BADGE[r].label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="text-base font-semibold mb-1">Invite created</h4>
                <p className="text-xs text-muted">
                  Share this link with {email} — they can join with any account
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-border flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onClick={(e) => e.currentTarget.select()}
                  className="flex-1 bg-white border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-700 outline-none"
                />
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-accent text-white hover:bg-accent-hover shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="border-t border-border px-5 py-3 flex gap-2">
          {!inviteUrl ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={creating || !email.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Send invite
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
