"use client";

import { useEffect, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { X, StickyNote, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { noteRef, saveNote } from "@/lib/firestore/calendar";

// Personal notes drawer (spec P5) — one private scratchpad per user per
// workspace, autosaved as you type.
export default function NotesPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsId = activeWorkspace?.id ?? null;

  useEffect(() => {
    if (!wsId || !user) return;
    const unsub = onSnapshot(noteRef(wsId, user.uid), (snap) => {
      if (!loaded) {
        setText((snap.data()?.text as string) || "");
        setLoaded(true);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, user]);

  const onChange = (v: string) => {
    setText(v);
    setSaving("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (wsId && user) {
        await saveNote(wsId, user.uid, v);
        setSaving("saved");
      }
    }, 700);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[80] w-[380px] max-w-[calc(100vw-2rem)] bg-card-bg border-l border-border shadow-2xl flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <StickyNote className="w-4 h-4 text-accent" />
        <span className="text-[13px] font-bold flex-1">Notițele mele</span>
        {saving === "saving" && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
        )}
        {saving === "saved" && <Check className="w-3.5 h-3.5 text-green-500" />}
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Scrie ce nu vrei să uiți… (doar tu vezi asta)"
        className="flex-1 p-4 bg-transparent text-[13px] leading-relaxed resize-none focus:outline-none"
      />
    </div>
  );
}
