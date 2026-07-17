"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { BlackMariaMark } from "@/components/BlackMariaLogo";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const { user, loading, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/onboarding");
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password, displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-subtle/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="text-foreground">
            <BlackMariaMark className="w-10 h-10" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Black Frame</h1>
            <p className="text-[11px] text-muted font-medium">
              Post-Production
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-7">
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Create your account
          </h2>
          <p className="text-sm text-muted mb-6">
            Start automating your post-production
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-border hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50 mb-4"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Full name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Work email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                  placeholder="you@agency.com"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                  placeholder="min. 6 characters"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Create account
            </button>
          </form>

          <p className="text-xs text-center text-muted mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-accent font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
