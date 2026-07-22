"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2 } from "lucide-react";
import { BlackMariaMark } from "@/components/BlackMariaLogo";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: wsLoading, createWorkspace } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    // If user already has workspace, redirect to app
    if (!wsLoading && workspaces.length > 0) {
      router.replace("/");
    }
  }, [workspaces, wsLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createWorkspace(name.trim(), brand.trim() || undefined);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create workspace"
      );
      setBusy(false);
    }
  };

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-subtle/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="text-foreground">
            <BlackMariaMark className="w-10 h-10" />
          </span>
          <h1 className="text-lg font-bold tracking-tight">Blackframe</h1>
        </div>

        {/* The Mihai path: invited people must NOT create their own empty
            workspace — that's how "I can't see the campaign" happens. */}
        <div className="bg-accent-light border border-accent/40 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-bold text-foreground mb-1">
            Ai fost invitat într-o echipă?
          </h2>
          <p className="text-[13px] text-muted leading-relaxed">
            Nu-ți crea un workspace nou — cere-i colegului{" "}
            <b className="text-foreground">link-ul de invitație</b> (el îl
            generează din Team → Invite member) și deschide-l logat cu contul
            ăsta. Intri direct în workspace-ul echipei, cu toate campaniile.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-7">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Sau creează un workspace nou
          </h2>
          <p className="text-sm text-muted mb-6">
            A workspace is where your team collaborates on campaigns. You can
            invite members later.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Workspace name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                placeholder="Acme Studios"
              />
              <p className="text-[11px] text-muted mt-1">
                Usually your agency or team name
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Primary brand <span className="text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                placeholder="e.g. Dryp Beverages"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Create workspace
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[11px] text-muted leading-relaxed">
              Your workspace starts on the{" "}
              <strong className="text-foreground">Free plan</strong> with 5
              members, 3 campaigns and 2 GB of storage. Upgrade anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
