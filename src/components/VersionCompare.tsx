"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Asset, AssetVersion } from "@/lib/schema";

// Side-by-side comparison of the current asset against any earlier version.
export default function VersionCompare({
  asset,
  versions,
  onClose,
}: {
  asset: Asset;
  versions: AssetVersion[];
  onClose: () => void;
}) {
  // Earlier versions (lower version number than current), newest first.
  const earlier = versions
    .filter((v) => v.version < asset.version)
    .sort((a, b) => b.version - a.version);
  const [compareId, setCompareId] = useState<string>(earlier[0]?.id ?? "");
  const other = earlier.find((v) => v.id === compareId) ?? earlier[0];

  const currentUrl = asset.downloadURL || asset.storagePath;
  const otherUrl = other?.downloadURL || other?.storagePath || "";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Compare versions — {asset.name}</h2>
          {earlier.length > 1 && (
            <select
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="text-xs bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
            >
              {earlier.map((v) => (
                <option key={v.id} value={v.id} className="text-slate-900">
                  Compare against V{v.version}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 overflow-hidden">
        <Pane label={other ? `V${other.version} (previous)` : "No earlier version"} url={otherUrl} type={asset.type} />
        <Pane label={`V${asset.version} (current)`} url={currentUrl} type={asset.type} />
      </div>
    </div>
  );
}

function Pane({ label, url, type }: { label: string; url: string; type: Asset["type"] }) {
  return (
    <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
      <span className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-semibold">
        {label}
      </span>
      {!url ? (
        <p className="text-slate-500 text-sm">Nothing to show</p>
      ) : type === "video" ? (
        <video src={url} controls className="max-w-full max-h-full" />
      ) : type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-w-full max-h-full object-contain" />
      ) : type === "audio" ? (
        <audio src={url} controls className="w-3/4" />
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline text-sm">
          Open file
        </a>
      )}
    </div>
  );
}
