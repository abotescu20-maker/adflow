"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2, CheckCircle, AlertTriangle, Zap } from "lucide-react";

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "joining" }
    | { kind: "done"; workspaceName: string | null }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (loading || !user || state.kind !== "idle") return;
    (async () => {
      setState({ kind: "joining" });
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/join/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to join");
        setState({ kind: "done", workspaceName: data.workspaceName ?? null });
        setTimeout(() => router.push("/"), 1500);
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Failed to join",
        });
      }
    })();
  }, [loading, user, state.kind, token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-border p-8 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-5">
          <Zap className="w-6 h-6 text-white" />
        </div>

        {loading && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm text-muted">Loading…</p>
          </>
        )}

        {!loading && !user && (
          <>
            <h1 className="text-lg font-semibold mb-2">
              You&apos;ve been invited to Black Frame
            </h1>
            <p className="text-sm text-muted mb-5">
              Sign in to accept your invitation and join the workspace.
            </p>
            <button
              onClick={() => signInWithGoogle()}
              className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in to continue
            </button>
          </>
        )}

        {!loading && user && state.kind === "joining" && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm text-muted">Joining the workspace…</p>
          </>
        )}

        {state.kind === "done" && (
          <>
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">You&apos;re in!</h1>
            <p className="text-sm text-muted">
              Joined {state.workspaceName || "the workspace"}. Redirecting…
            </p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Couldn&apos;t join</h1>
            <p className="text-sm text-muted mb-5">{state.message}</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm font-medium text-accent hover:underline"
            >
              Go to Black Frame
            </button>
          </>
        )}
      </div>
    </div>
  );
}
