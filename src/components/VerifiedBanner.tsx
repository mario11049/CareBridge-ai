"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { ValidationReport } from "@/lib/carebridge/types";

export default function VerifiedBanner({ report }: { report: ValidationReport }) {
  if (report.verified) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-med-line bg-med-soft px-4 py-3.5" role="status">
        <ShieldCheck className="mt-0.5 shrink-0 text-med-deep" size={20} aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-med-deep">Automated checks passed</p>
          <p className="text-[0.82rem] leading-relaxed text-med-deep/90">{report.verifiedReason}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warn/60 bg-warn-soft px-4 py-3.5" role="alert">
      <ShieldAlert className="mt-0.5 shrink-0 text-warn-deep" size={20} aria-hidden="true" />
      <div>
        <p className="text-sm font-bold text-warn-deep">Review required — verified state blocked</p>
        <p className="text-[0.82rem] leading-relaxed text-warn-deep/90">{report.verifiedReason}</p>
      </div>
    </div>
  );
}
