"use client";

import { ApprovalStatus } from "@/lib/types";

const statusConfig: Record<
  ApprovalStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  brief: { label: "Brief", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  production: { label: "In Production", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  review: { label: "In Review", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  revision: { label: "Revision", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  approved: { label: "Approved", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  delivered: { label: "Delivered", bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
};

export default function StatusBadge({ status }: { status: ApprovalStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
