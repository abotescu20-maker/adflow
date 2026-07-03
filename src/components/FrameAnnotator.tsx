"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser, Loader2, Check } from "lucide-react";
import type { Asset } from "@/lib/schema";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff", "#111827"];
const MAX_W = 960;

// Draw-on-frame annotation. Loads the current frame (video seeked to `time`, or the
// image) on a crossOrigin element so it can be composited, lets the user draw
// freehand on top, and exports the result as a JPEG Blob for attaching to a comment.
// If the media can't be read cross-origin (CORS taint), it gracefully falls back to
// exporting the drawing over a dark backdrop so the annotation is never lost.
export default function FrameAnnotator({
  asset,
  mediaSrc,
  time,
  onSave,
  onClose,
}: {
  asset: Asset;
  mediaSrc: string;
  time: number;
  onSave: (blob: Blob) => Promise<void> | void;
  onClose: () => void;
}) {
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Load the frame into the background canvas.
  useEffect(() => {
    let cancelled = false;
    const sizeAndDraw = (w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
      const scale = w ? Math.min(1, MAX_W / w) : 1;
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      for (const c of [bgRef.current, drawRef.current]) {
        if (!c) continue;
        c.width = cw;
        c.height = ch;
      }
      const bg = bgRef.current?.getContext("2d");
      if (bg) {
        bg.fillStyle = "#0f172a";
        bg.fillRect(0, 0, cw, ch);
        try {
          paint(bg);
        } catch {
          /* tainted or failed — keep the dark backdrop */
        }
      }
      if (!cancelled) setReady(true);
    };

    if (asset.type === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () =>
        sizeAndDraw(img.naturalWidth || MAX_W, img.naturalHeight || Math.round(MAX_W * 0.56), (ctx) =>
          ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height)
        );
      img.onerror = () => sizeAndDraw(MAX_W, Math.round(MAX_W * 0.56), () => {});
      img.src = mediaSrc;
    } else if (asset.type === "video") {
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.muted = true;
      v.preload = "metadata";
      let seeked = false;
      v.onloadeddata = () => {
        try {
          v.currentTime = time || 0;
        } catch {
          /* ignore */
        }
      };
      v.onseeked = () => {
        if (seeked) return;
        seeked = true;
        sizeAndDraw(v.videoWidth || MAX_W, v.videoHeight || Math.round(MAX_W * 0.56), (ctx) =>
          ctx.drawImage(v, 0, 0, ctx.canvas.width, ctx.canvas.height)
        );
      };
      v.onerror = () => sizeAndDraw(MAX_W, Math.round(MAX_W * 0.56), () => {});
      v.src = mediaSrc;
      // Fallback if seeked never fires.
      setTimeout(() => {
        if (!seeked && !cancelled) sizeAndDraw(MAX_W, Math.round(MAX_W * 0.56), () => {});
      }, 6000);
    } else {
      sizeAndDraw(MAX_W, Math.round(MAX_W * 0.56), () => {});
    }
    return () => {
      cancelled = true;
    };
  }, [asset.type, mediaSrc, time]);

  const pos = (e: React.PointerEvent) => {
    const c = drawRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = drawRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };
  const clearDraw = () => {
    const ctx = drawRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, drawRef.current!.width, drawRef.current!.height);
  };

  const save = async () => {
    const bg = bgRef.current;
    const draw = drawRef.current;
    if (!bg || !draw) return;
    setSaving(true);
    try {
      const out = document.createElement("canvas");
      out.width = bg.width;
      out.height = bg.height;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(bg, 0, 0);
      ctx.drawImage(draw, 0, 0);
      const blob: Blob | null = await new Promise((res) => out.toBlob((b) => res(b), "image/jpeg", 0.85));
      if (blob) await onSave(blob);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">
          Annotate frame {asset.type === "video" ? `@ ${formatT(time)}` : ""}
        </h2>
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 ${color === c ? "border-white" : "border-white/20"}`}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
          <button onClick={clearDraw} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10" title="Clear">
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={save}
            disabled={saving || !ready}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Attach to comment
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <div className="relative max-w-full max-h-full">
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white/70" />
            </div>
          )}
          <canvas ref={bgRef} className="max-w-full max-h-[80vh] block rounded-lg" />
          <canvas
            ref={drawRef}
            className="absolute inset-0 max-w-full max-h-[80vh] cursor-crosshair touch-none"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
        </div>
      </div>
    </div>
  );
}

function formatT(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
