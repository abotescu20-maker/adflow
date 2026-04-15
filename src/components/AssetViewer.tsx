"use client";

import { useState } from "react";
import { Asset, Comment } from "@/lib/types";
import { comments as mockComments } from "@/lib/mock-data";
import StatusBadge from "@/components/StatusBadge";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
  Send,
  Paperclip,
  Smile,
  AtSign,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  MoreHorizontal,
  Pencil,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  Film,
} from "lucide-react";

interface Props {
  asset: Asset;
  onBack: () => void;
}

export default function AssetViewer({ asset, onBack }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(32);
  const [activeTab, setActiveTab] = useState<"comments" | "details">("comments");
  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"public" | "team">("public");

  const currentTimecode = "00:08";

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{asset.name}</h3>
            <p className="text-[11px] text-muted">Summer Refresh 2026 / Raw Footage</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-sm text-muted bg-slate-50 rounded-lg px-2 py-1">
            <button className="p-0.5 hover:text-foreground transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-medium">1 of 19</span>
            <button className="p-0.5 hover:text-foreground transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="w-px h-5 bg-border" />
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-border bg-white hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video player area */}
        <div className="flex-1 flex flex-col">
          {/* Video viewport */}
          <div className="flex-1 bg-slate-900 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
              <div className="text-center">
                <Film className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">{asset.name}</p>
                <p className="text-slate-500 text-xs mt-1">{asset.width}×{asset.height} · {asset.format}</p>
              </div>
            </div>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="relative z-10 w-16 h-16 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors backdrop-blur-md border border-white/20"
            >
              {isPlaying ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white ml-1" />}
            </button>

            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-bold shadow-lg">V{asset.version}</div>
            <div className="absolute bottom-16 right-4 px-2.5 py-1 rounded-lg bg-black/50 text-white text-[11px] font-medium backdrop-blur-sm">HD</div>

            {/* Approval buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg">
                <CheckCircle className="w-3.5 h-3.5" />
                Approve
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 text-red-600 hover:bg-white transition-colors shadow-lg backdrop-blur-sm">
                <XCircle className="w-3.5 h-3.5" />
                Request Changes
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border-t border-border px-5 py-3">
            <div className="timeline-track mb-2.5" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setProgress(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
            }}>
              <div className="timeline-progress" style={{ width: `${progress}%` }} />
            </div>

            {/* Comment markers */}
            <div className="relative h-3 mb-2">
              {mockComments.map((comment) => {
                if (!comment.timecode) return null;
                const [, sec] = comment.timecode.split(":").map(Number);
                const pos = (sec / 26) * 100;
                return (
                  <div
                    key={comment.id}
                    className="absolute top-0 w-3 h-3 rounded-full bg-accent/50 hover:bg-accent cursor-pointer transition-all hover:scale-125 -translate-x-1/2 border-2 border-white shadow-sm"
                    style={{ left: `${pos}%` }}
                    title={`${comment.author}: ${comment.text.slice(0, 50)}...`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="p-1 text-muted hover:text-foreground transition-colors"><SkipBack className="w-4 h-4" /></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-1.5 rounded-full bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button className="p-1 text-muted hover:text-foreground transition-colors"><SkipForward className="w-4 h-4" /></button>
                <span className="text-xs text-muted font-medium ml-1">1.0x</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-accent">{currentTimecode}</span>
                <span className="text-xs text-slate-300">/</span>
                <span className="font-mono text-sm text-muted">{asset.duration || "00:26"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                <button className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors"><Volume2 className="w-4 h-4" /></button>
                <button className="p-1.5 text-muted hover:text-foreground hover:bg-slate-100 rounded-lg transition-colors"><Maximize2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[340px] border-l border-border flex flex-col bg-white shrink-0">
          <div className="flex border-b border-border">
            {(["comments", "details"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-semibold text-center transition-colors capitalize ${
                  activeTab === tab ? "text-accent border-b-2 border-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {tab === "comments" ? `Comments (${mockComments.length})` : "Details"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "comments" ? (
              <div className="p-4 space-y-3">
                {mockComments.map((comment) => <CommentCard key={comment.id} comment={comment} />)}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <DetailSection title="File Info" items={[
                  ["Name", asset.name],
                  ["Format", asset.format || "Unknown"],
                  ["Resolution", asset.width ? `${asset.width}×${asset.height}` : "N/A"],
                  ["Duration", asset.duration || "N/A"],
                  ["Size", asset.size],
                  ["Version", `V${asset.version}`],
                ]} />
                <DetailSection title="Workflow" items={[
                  ["Uploaded by", asset.uploadedBy],
                  ["Uploaded", asset.uploadedAt],
                ]} statusBadge={asset.status} />
                <div className="border-t border-border pt-4">
                  <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">Version History</h4>
                  {Array.from({ length: asset.version }, (_, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-1 ${i === 0 ? "bg-accent-light text-accent font-medium" : "text-muted hover:bg-slate-50"} transition-colors`}>
                      <span className="font-semibold">V{asset.version - i}</span>
                      <span className="flex-1">{i === 0 ? "Current" : `${i + 1} days ago`}</span>
                      {i === 0 && <Check className="w-3.5 h-3.5 text-accent" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comment input */}
          {activeTab === "comments" && (
            <div className="border-t border-border p-4 bg-slate-50/50">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="font-mono text-[11px] text-accent bg-accent-light px-2 py-0.5 rounded-md font-semibold">{currentTimecode}</span>
                <button
                  onClick={() => setCommentVisibility(commentVisibility === "public" ? "team" : "public")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                    commentVisibility === "public" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {commentVisibility === "public" ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {commentVisibility === "public" ? "Public" : "Team"}
                </button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-white rounded-xl border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 transition-all shadow-sm">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Leave your comment..."
                    className="w-full bg-transparent text-sm px-3.5 py-2.5 resize-none h-16 outline-none placeholder:text-muted/50"
                  />
                  <div className="flex items-center gap-0.5 px-2 pb-2">
                    {[Pencil, Paperclip, Smile, AtSign].map((Icon, i) => (
                      <button key={i} className="text-muted hover:text-accent transition-colors p-1.5 rounded-lg hover:bg-accent-light">
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <button className="p-3 rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, items, statusBadge }: { title: string; items: string[][]; statusBadge?: string }) {
  return (
    <div className="border-t border-border pt-4 first:border-0 first:pt-0">
      <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2.5">{title}</h4>
      <div className="space-y-2">
        {statusBadge && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted">Status</span>
            <StatusBadge status={statusBadge as import("@/lib/types").ApprovalStatus} />
          </div>
        )}
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-muted">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: Comment }) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${comment.resolved ? "border-border/50 opacity-50" : "border-border hover:border-accent/20 hover:shadow-sm"}`}>
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
          {comment.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">{comment.author}</span>
            {comment.timecode && (
              <span className="font-mono text-[10px] text-accent bg-accent-light px-1.5 py-0.5 rounded-md font-semibold">{comment.timecode}</span>
            )}
            {comment.visibility === "team" && <Lock className="w-3 h-3 text-amber-500" />}
            {comment.resolved && <Check className="w-3 h-3 text-emerald-500" />}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{comment.text}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-muted">{comment.timestamp.split(" ")[1]}</span>
            <button className="text-[11px] text-muted hover:text-accent font-medium transition-colors">Reply</button>
            {!comment.resolved && (
              <button className="text-[11px] text-muted hover:text-emerald-500 font-medium transition-colors">Resolve</button>
            )}
          </div>
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2.5 ml-2 pl-3 border-l-2 border-accent/20 space-y-2">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[9px] font-bold text-accent shrink-0">{reply.avatar}</div>
                  <div>
                    <span className="text-[11px] font-semibold text-foreground">{reply.author}</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{reply.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="text-muted hover:text-foreground transition-colors shrink-0"><MoreHorizontal className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
