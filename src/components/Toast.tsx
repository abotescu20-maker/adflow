"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastContextValue {
  show: (kind: ToastKind, title: string, body?: string) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
  warn: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback when used outside provider
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warn: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, kind, title, body }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const api: ToastContextValue = {
    show,
    success: (t, b) => show("success", t, b),
    error: (t, b) => show("error", t, b),
    info: (t, b) => show("info", t, b),
    warn: (t, b) => show("warning", t, b),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const icons = {
    success: { Icon: CheckCircle, cls: "text-emerald-600 bg-emerald-50" },
    error: { Icon: XCircle, cls: "text-red-600 bg-red-50" },
    warning: { Icon: AlertTriangle, cls: "text-amber-600 bg-amber-50" },
    info: { Icon: Info, cls: "text-accent bg-accent-light" },
  } as const;
  const { Icon, cls } = icons[item.kind];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 bg-white rounded-xl border border-border shadow-xl px-4 py-3 min-w-[300px] max-w-[400px] transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        {item.body && <p className="text-[12px] text-muted mt-0.5">{item.body}</p>}
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-md text-muted hover:text-foreground hover:bg-slate-50 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
