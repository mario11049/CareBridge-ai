import { AlertTriangle, CheckCircle2, HelpCircle, MinusCircle } from "lucide-react";
import type { ReviewStatus } from "@/lib/carebridge/types";
import { clsx } from "@/lib/carebridge/util";

const META: Record<ReviewStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  matched: { label: "Matched", icon: CheckCircle2, cls: "bg-med-soft text-med-deep border border-med-line" },
  needs_review: { label: "Needs review", icon: AlertTriangle, cls: "bg-warn-soft text-warn-deep border border-warn/50" },
  mismatch: { label: "Mismatch detected", icon: AlertTriangle, cls: "bg-alert-soft text-alert-deep border border-alert/40" },
  not_evaluated: { label: "Not evaluated", icon: MinusCircle, cls: "bg-ivory-2 text-mist border border-line" },
};

export default function StatusPill({ status, className }: { status: ReviewStatus; className?: string }) {
  const m = META[status];
  const Icon = m.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-bold tracking-wide", m.cls, className)}>
      <Icon size={13} strokeWidth={2.6} aria-hidden="true" />
      {/* text label always accompanies color — colour is never the only signal */}
      {m.label}
      <HelpCircle size={0} className="hidden" aria-hidden="true" />
    </span>
  );
}
