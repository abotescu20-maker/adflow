"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createCampaign } from "@/lib/firestore/campaigns";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";

const AVAILABLE_PLATFORMS = [
  "TikTok",
  "Instagram",
  "YouTube",
  "Facebook",
  "TV",
  "Cinema",
  "Google Ads",
  "Meta",
  "LinkedIn",
  "Email",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (campaignId: string) => void;
}

export default function NewCampaignModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [brand, setBrand] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const togglePlatform = (p: string) => {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspace) return;
    setError(null);
    setBusy(true);
    try {
      const id = await createCampaign(activeWorkspace.id, {
        name: name.trim(),
        client: client.trim(),
        brand: brand.trim(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000),
        platforms,
        createdBy: user.uid,
      });
      setName("");
      setClient("");
      setBrand("");
      setDueDate("");
      setPlatforms([]);
      onCreated?.(id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-foreground">New Campaign</h3>
            <p className="text-xs text-muted mt-0.5">
              Set up a new advertising campaign workspace
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Campaign name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Refresh 2026"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Client
              </label>
              <input
                required
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Dryp Beverages"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Brand
              </label>
              <input
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Dryp"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    platforms.includes(p)
                      ? "bg-accent text-white border-accent shadow-sm shadow-accent/20"
                      : "bg-white text-slate-600 border-border hover:border-accent/30"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim() || !client.trim() || !brand.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Create campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
