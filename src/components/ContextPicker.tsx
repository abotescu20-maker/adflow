"use client";

import { useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { setMemberContext } from "@/lib/firestore/members";
import {
  ActorType,
  ACTOR_TYPE_LABELS,
  DEFAULT_CRAFTS,
  MEMBER_COLORS,
} from "@/lib/schema";
import { BlackMariaMark } from "@/components/BlackMariaLogo";

const ACTOR_ORDER: ActorType[] = [
  "client",
  "agency",
  "production_house",
  "post_production",
];

const ACTOR_HINT: Record<ActorType, string> = {
  client: "Comanzi lucrarea și dai feedback.",
  agency: "Faci legătura între client și producție.",
  production_house: "Filmezi și coordonezi producția.",
  post_production: "Montaj, color, VFX, sunet, grafică.",
};

// A craft only makes sense for the houses that actually do the work.
function needsCraft(actor: ActorType | null): boolean {
  return actor === "production_house" || actor === "post_production";
}

function colorForUid(uid: string): string {
  const sum = uid.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return MEMBER_COLORS[sum % MEMBER_COLORS.length];
}

// The "why are you here + your role" picker (Black Frame P2). Rendered by the
// dashboard when the active membership has no production context yet. Writing
// the context updates the member doc; the realtime listener then hides this.
export function ContextPicker() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [actor, setActor] = useState<ActorType | null>(null);
  const [craft, setCraft] = useState<string | null>(null);
  const [customCraft, setCustomCraft] = useState("");
  const [color, setColor] = useState<string>(
    user ? colorForUid(user.uid) : MEMBER_COLORS[0]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !activeWorkspace) return null;

  const canSave = actor !== null && (!needsCraft(actor) || !!craft);

  const handleSave = async () => {
    if (!actor) return;
    setBusy(true);
    setError(null);
    try {
      await setMemberContext(activeWorkspace.id, user.uid, {
        actorType: actor,
        craft: needsCraft(actor) ? craft : null,
        color,
      });
      // The workspace listener will pick up the change and unmount us.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut salva.");
      setBusy(false);
    }
  };

  const addCustomCraft = () => {
    const c = customCraft.trim();
    if (!c) return;
    setCraft(c);
    setCustomCraft("");
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-card-bg border border-border rounded-2xl p-7 my-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-foreground shrink-0">
            <BlackMariaMark className="w-9 h-9" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              De ce ești aici?
            </h2>
            <p className="text-[12px] text-muted">
              {activeWorkspace.name} · alege-ți locul în lanț și rolul tău
            </p>
          </div>
        </div>

        {/* Actor type */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {ACTOR_ORDER.map((a) => {
            const active = actor === a;
            return (
              <button
                key={a}
                onClick={() => {
                  setActor(a);
                  if (!needsCraft(a)) setCraft(null);
                }}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  active
                    ? "border-accent bg-accent-light"
                    : "border-border hover:bg-card-hover"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-foreground">
                    {ACTOR_TYPE_LABELS[a]}
                  </span>
                  {active && <Check className="w-4 h-4 text-accent" />}
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  {ACTOR_HINT[a]}
                </p>
              </button>
            );
          })}
        </div>

        {/* Craft (only for the houses that do the work) */}
        {needsCraft(actor) && (
          <div className="mb-5">
            <p className="text-[12px] font-medium text-foreground mb-2">
              Care e meseria ta?
            </p>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {DEFAULT_CRAFTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCraft(c)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                    craft === c
                      ? "border-accent bg-accent-light text-foreground"
                      : "border-border text-muted hover:bg-card-hover"
                  }`}
                >
                  {c}
                </button>
              ))}
              {craft && !DEFAULT_CRAFTS.includes(craft as never) && (
                <span className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-accent bg-accent-light text-foreground">
                  {craft}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={customCraft}
                onChange={(e) => setCustomCraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomCraft()}
                placeholder="Altă meserie…"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent text-[13px] text-foreground focus:outline-none focus:border-accent"
              />
              <button
                onClick={addCustomCraft}
                disabled={!customCraft.trim()}
                className="p-2 rounded-lg border border-border text-muted hover:bg-card-hover disabled:opacity-40"
                title="Adaugă meseria"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Identity color */}
        <div className="mb-6">
          <p className="text-[12px] font-medium text-foreground mb-2">
            Culoarea ta (calendar & chat)
          </p>
          <div className="flex flex-wrap gap-2">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Culoare ${c}`}
                className={`w-7 h-7 rounded-full transition-transform ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-offset-card-bg ring-foreground scale-110"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!canSave || busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Intru în proiect
        </button>
      </div>
    </div>
  );
}
