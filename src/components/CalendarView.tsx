"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import {
  calendarEventsMonthQuery,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/firestore/calendar";
import { useCampaigns } from "@/hooks/useCampaigns";
import type { CalendarEvent } from "@/lib/schema";

const DAY_NAMES = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
const MONTHS = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The planning calendar (spec P5): each user has their colour; draw a span
// "from here to here", type the label ("edit") and the period shows up in
// that user's colour.
export default function CalendarView({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const { activeWorkspace, currentMember } = useWorkspace();
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const wsId = activeWorkspace?.id ?? null;
  const { campaigns } = useCampaigns(wsId);

  // Bounds of the visible month, for the query + client-side endDate filter.
  const monthStart = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const monthEnd = ymd(
    new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
  );

  useEffect(() => {
    if (!wsId) return;
    const unsub = onSnapshot(
      calendarEventsMonthQuery(wsId, monthEnd),
      (snap) => {
        setEvents(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent)
            .filter((e) => e.endDate >= monthStart)
        );
      }
    );
    return () => unsub();
  }, [wsId, monthStart, monthEnd]);

  // Campaign deadlines painted as read-only markers.
  const deadlines = useMemo(() => {
    const map = new Map<string, string[]>();
    campaigns.forEach((c) => {
      if (!c.dueDate) return;
      try {
        const d = ymd(c.dueDate.toDate());
        map.set(d, [...(map.get(d) ?? []), c.name]);
      } catch {
        /* ignore malformed */
      }
    });
    return map;
  }, [campaigns]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      out.push(
        new Date(cursor.getFullYear(), cursor.getMonth(), 1 - startOffset + i)
      );
    }
    return out;
  }, [cursor]);

  if (!user || !profile || !wsId) return null;

  const todayStr = ymd(new Date());
  const inSelection = (d: string) =>
    selStart && selEnd ? d >= selStart && d <= selEnd : selStart === d;

  const clickDay = (d: string) => {
    if (!selStart || (selStart && selEnd)) {
      setSelStart(d);
      setSelEnd(null);
      setLabel("");
    } else {
      // second click completes the span (either direction)
      if (d < selStart) {
        setSelEnd(selStart);
        setSelStart(d);
      } else {
        setSelEnd(d);
      }
    }
  };

  const save = async () => {
    if (!selStart || !label.trim()) return;
    await createCalendarEvent(wsId, {
      uid: user.uid,
      userName: profile.displayName,
      color: currentMember?.color || "#6366f1",
      label: label.trim(),
      startDate: selStart,
      endDate: selEnd || selStart,
    });
    setSelStart(null);
    setSelEnd(null);
    setLabel("");
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
      // don't throw away an in-progress selection on a stray backdrop click
      onClick={() => !selStart && onClose()}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card-bg border border-border rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-[15px] font-bold flex-1">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
              )
            }
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
              )
            }
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selection form */}
        {selStart && (
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl border border-accent/40 bg-accent-light">
            <span className="text-[12px] font-medium">
              {selStart}
              {selEnd && selEnd !== selStart ? ` → ${selEnd}` : ""}
            </span>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder='ce faci în perioada asta? (ex. "edit")'
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-transparent text-[12px] focus:outline-none focus:border-accent"
            />
            <button
              onClick={save}
              disabled={!label.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium disabled:opacity-40"
            >
              Salvează
            </button>
            <button
              onClick={() => {
                setSelStart(null);
                setSelEnd(null);
              }}
              className="p-1.5 text-muted hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!selStart && (
          <p className="text-[11px] text-muted mb-3">
            Click pe ziua de start, apoi pe ziua de final → scrie ce faci în
            perioada aia. Apare pe culoarea ta.
          </p>
        )}

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="bg-subtle text-center text-[10px] font-semibold text-muted py-1.5"
            >
              {d}
            </div>
          ))}
          {days.map((d) => {
            const ds = ymd(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const dayEvents = events.filter(
              (e) => ds >= e.startDate && ds <= e.endDate
            );
            return (
              <button
                key={ds}
                onClick={() => clickDay(ds)}
                className={`bg-card-bg min-h-[72px] p-1 text-left align-top transition-colors hover:bg-card-hover ${
                  inMonth ? "" : "opacity-35"
                } ${inSelection(ds) ? "ring-2 ring-inset ring-accent" : ""}`}
              >
                <span
                  className={`text-[10px] font-semibold ${
                    ds === todayStr
                      ? "text-accent"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted"
                  }`}
                >
                  {d.getDate()}
                </span>
                {/* Campaign deadlines — read-only red markers */}
                {deadlines.has(ds) && (
                  <div
                    className="mt-0.5 rounded px-1 py-0.5 text-[9px] font-bold text-red-300 border border-red-500/60 truncate"
                    title={`Deadline: ${deadlines.get(ds)!.join(", ")}`}
                  >
                    ⏰ {deadlines.get(ds)!.join(", ")}
                  </div>
                )}
                <div className="mt-0.5 space-y-0.5">
                  {(expandedDay === ds ? dayEvents : dayEvents.slice(0, 3)).map(
                    (e) => (
                      <div
                        key={e.id}
                        className="group flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium text-white truncate"
                        style={{ background: e.color }}
                        title={`${e.label} — ${e.userName} (${e.startDate} → ${e.endDate})`}
                      >
                        <span className="truncate">
                          {ds === e.startDate
                            ? `${e.label} · ${e.userName}`
                            : e.label}
                        </span>
                        {e.uid === user.uid && (
                          <span
                            role="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              deleteCalendarEvent(wsId, e.id);
                            }}
                            className="hidden group-hover:block shrink-0"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    )
                  )}
                  {dayEvents.length > 3 && expandedDay !== ds && (
                    <span
                      role="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setExpandedDay(ds);
                      }}
                      className="block text-[9px] font-semibold text-accent hover:underline"
                    >
                      +{dayEvents.length - 3} vezi tot
                    </span>
                  )}
                  {expandedDay === ds && dayEvents.length > 3 && (
                    <span
                      role="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setExpandedDay(null);
                      }}
                      className="block text-[9px] text-muted hover:underline"
                    >
                      restrânge
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
