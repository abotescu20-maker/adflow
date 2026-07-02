"use client";

import { useState } from "react";
import {
  FolderKanban,
  Plus,
  Pin,
  Trash2,
  Loader2,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  Sparkles,
  Tag,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCollections } from "@/hooks/useCollections";
import { useWorkspace } from "@/lib/workspace-context";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "@/lib/firestore/collections";
import { logActivity } from "@/lib/firestore/activity";
import type { Collection, ApprovalStatus } from "@/lib/schema";

const PRESET_COLLECTIONS: Array<{
  name: string;
  icon: string;
  color?: string;
  filters: Collection["filters"];
  description: string;
}> = [
  {
    name: "Awaiting Approval",
    icon: "clock",
    color: "#f59e0b",
    filters: { status: ["review"] },
    description: "Assets sent for client review",
  },
  {
    name: "Approved Assets",
    icon: "check",
    color: "#10b981",
    filters: { status: ["approved"] },
    description: "Signed off by the client",
  },
  {
    name: "Changes Requested",
    icon: "alert",
    color: "#ef4444",
    filters: { status: ["revision"] },
    description: "Needs rework before next round",
  },
  {
    name: "Delivered",
    icon: "sparkles",
    color: "#8b5cf6",
    filters: { status: ["delivered"] },
    description: "Final deliverables shipped",
  },
];

const ICON_MAP: Record<string, React.ElementType> = {
  clock: Clock,
  check: CheckCircle,
  alert: AlertTriangle,
  sparkles: Sparkles,
  folder: FolderKanban,
  tag: Tag,
  user: User,
};

export default function CollectionsView() {
  const { user, profile } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { collections, loading } = useCollections(activeWorkspace?.id ?? null);
  const [newOpen, setNewOpen] = useState(false);

  const seed = async () => {
    if (!activeWorkspace || !user || !profile) return;
    for (const preset of PRESET_COLLECTIONS) {
      await createCollection(activeWorkspace.id, {
        name: preset.name,
        icon: preset.icon,
        color: preset.color,
        filters: preset.filters,
        description: preset.description,
        pinned: true,
        createdBy: user.uid,
        createdByName: profile.displayName,
      });
    }
  };

  if (!activeWorkspace) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Collections</h2>
          <p className="text-sm text-muted mt-0.5">
            Smart groups that auto-update when assets match your filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          {collections.length === 0 && !loading && (
            <button
              onClick={seed}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-accent/30 text-accent bg-accent-light hover:bg-accent hover:text-white transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Add presets
            </button>
          )}
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New Collection
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : collections.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No collections yet</h3>
            <p className="text-sm text-muted mb-4">
              Collections organize assets across campaigns by status, tags, assignee,
              and more. Start with presets or create your own.
            </p>
            <button
              onClick={seed}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover"
            >
              Add 4 starter collections
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((c) => (
              <CollectionCard
                key={c.id}
                collection={c}
                onDelete={async () => {
                  if (!confirm(`Delete collection "${c.name}"?`)) return;
                  await deleteCollection(activeWorkspace.id, c.id);
                  if (user && profile)
                    await logActivity(activeWorkspace.id, {
                      actorId: user.uid,
                      actorName: profile.displayName,
                      action: "collection.created",
                      targetType: "collection",
                      targetId: c.id,
                      targetName: c.name,
                    });
                }}
                onPin={async () => {
                  await updateCollection(activeWorkspace.id, c.id, {
                    pinned: !c.pinned,
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {newOpen && (
        <NewCollectionModal
          onClose={() => setNewOpen(false)}
          onCreate={async (input) => {
            if (!user || !profile) return;
            await createCollection(activeWorkspace.id, {
              ...input,
              createdBy: user.uid,
              createdByName: profile.displayName,
            });
            await logActivity(activeWorkspace.id, {
              actorId: user.uid,
              actorName: profile.displayName,
              action: "collection.created",
              targetType: "collection",
              targetId: "new",
              targetName: input.name,
            });
          }}
        />
      )}
    </div>
  );
}

function CollectionCard({
  collection,
  onDelete,
  onPin,
}: {
  collection: Collection;
  onDelete: () => void;
  onPin: () => void;
}) {
  const Icon = ICON_MAP[collection.icon] || FolderKanban;
  const chips = describeFilters(collection.filters);

  return (
    <div className="rounded-xl border border-border bg-white hover:border-accent/30 hover:shadow-sm transition-all p-4">
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `${collection.color || "#4f46e5"}15`,
            color: collection.color || "#4f46e5",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {collection.name}
          </h3>
          {collection.description && (
            <p className="text-[11px] text-muted mt-0.5 line-clamp-2">
              {collection.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onPin}
            className={`p-1.5 rounded-md transition-colors ${
              collection.pinned
                ? "text-accent bg-accent-light"
                : "text-muted hover:text-accent hover:bg-slate-50"
            }`}
            title={collection.pinned ? "Unpin" : "Pin"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-3 border-t border-border/60">
          {chips.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-medium rounded-md border border-border"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function describeFilters(f: Collection["filters"]): string[] {
  const out: string[] = [];
  if (f.status && f.status.length > 0) out.push(`status: ${f.status.join(", ")}`);
  if (f.folder && f.folder.length > 0) out.push(`folder: ${f.folder.join(", ")}`);
  if (f.tags && f.tags.length > 0) out.push(`tags: ${f.tags.join(", ")}`);
  if (f.assignedTo && f.assignedTo.length > 0)
    out.push(`assignees: ${f.assignedTo.length}`);
  if (f.rating) out.push(`rating ≥ ${f.rating}`);
  return out;
}

function NewCollectionModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    icon: string;
    color?: string;
    description?: string;
    filters: Collection["filters"];
    pinned?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<ApprovalStatus[]>([]);
  const [creating, setCreating] = useState(false);

  const toggleStatus = (s: ApprovalStatus) => {
    setSelectedStatuses((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    );
  };

  const STATUS_OPTIONS: ApprovalStatus[] = [
    "brief",
    "production",
    "review",
    "revision",
    "approved",
    "delivered",
  ];

  const submit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        icon: "folder",
        description: description.trim() || undefined,
        filters: {
          ...(selectedStatuses.length > 0 ? { status: selectedStatuses } : {}),
        },
        pinned: false,
      });
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">New Collection</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Awaiting approval…"
              className="w-full text-sm px-3 py-2 border border-border rounded-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 block">
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short explainer for your team"
              className="w-full text-sm px-3 py-2 border border-border rounded-lg outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 block">
              Filter: Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const on = selectedStatuses.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors capitalize ${
                      on
                        ? "bg-accent text-white border-accent"
                        : "bg-white text-slate-600 border-border hover:border-accent/40"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || creating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
