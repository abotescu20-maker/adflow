"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Black Maria mark — square frame + overlapping filled circle, drawn in currentColor
// (so it inverts to white on the black theme). A faithful stand-in for the real
// vector logo the client will provide; the "BLACK MARIA" wordmark is omitted at
// small sizes and shown big in the easter-egg modal.
export function BlackMariaMark({
  className = "w-8 h-8",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 128 112"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="16"
        width="74"
        height="84"
        stroke="currentColor"
        strokeWidth="6"
      />
      <circle cx="86" cy="52" r="36" fill="currentColor" />
    </svg>
  );
}

// The horizontal film-strip mark the client sent on 17.07: five circles cut by
// vertical lines inside a rectangular strip (like sprocketed film). Used where
// there's horizontal room (login, FAQ, wide headers).
export function BlackMariaStrip({
  className = "h-8 w-auto",
}: {
  className?: string;
}) {
  const cells = [0, 1, 2, 3, 4];
  return (
    <svg
      viewBox="0 0 640 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* strip frame — starts/ends mid-circle, like the client's mark */}
      <rect
        x="60"
        y="16"
        width="520"
        height="128"
        stroke="currentColor"
        strokeWidth="10"
      />
      {cells.map((i) => {
        const cx = 60 + i * 130;
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy="80"
              r="56"
              stroke="currentColor"
              strokeWidth="10"
            />
            <line
              x1={cx}
              y1="8"
              x2={cx}
              y2="152"
              stroke="currentColor"
              strokeWidth="10"
            />
          </g>
        );
      })}
    </svg>
  );
}

// The logo is clickable → opens Stefan's easter-egg. Until the client provides the
// actual video, we show the line as text (swap `videoUrl` when the file exists).
export function LogoButton({
  wordmark = "Blackframe",
  videoUrl,
  markClassName = "w-7 h-7",
}: {
  wordmark?: string;
  videoUrl?: string;
  markClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 group"
        title="Black Maria"
      >
        <span className="text-foreground transition-transform group-hover:scale-105">
          <BlackMariaMark className={markClassName} />
        </span>
        <span className="text-sm font-bold tracking-tight">{wordmark}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-w-lg w-full bg-card-bg border border-border rounded-2xl p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-foreground mx-auto mb-5 flex justify-center">
              <BlackMariaMark className="w-16 h-16" />
            </div>
            {videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            ) : (
              <p className="text-sm text-foreground leading-relaxed">
                „Dacă într-un app atât de simplu ai ajuns să apeși pe logo, ești
                bolnăvior… dar te iubesc, te apreciez și îți mulțumesc că ești
                aproape de noi."
                <span className="block mt-3 text-[11px] text-muted">
                  — Stefan · [filmulețul se va încărca aici]
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
