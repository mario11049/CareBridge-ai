"use client";

import { Quote } from "lucide-react";
import type { Evidence } from "@/lib/carebridge/types";

/** Expandable evidence chip — shows the exact source snippet backing an item. */
export default function EvidenceChip({ evidence }: { evidence: Evidence | null | undefined }) {
  if (!evidence) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-ivory-2 px-2 py-0.5 text-[0.7rem] font-semibold text-mist">
        no linked evidence
      </span>
    );
  }
  return (
    <details className="group inline-block align-middle">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md bg-navy/5 px-2 py-0.5 text-[0.7rem] font-semibold text-navy transition-colors hover:bg-med-soft hover:text-med-deep [&::-webkit-details-marker]:hidden">
        <Quote size={11} aria-hidden="true" />
        source: {evidence.section}
        {evidence.locationAvailable && evidence.line != null ? ` · line ${evidence.line}` : " · line n/a"}
      </summary>
      <div className="mt-1.5 max-w-md rounded-lg border border-line bg-ivory p-2.5 text-left text-[0.75rem] leading-relaxed text-ink/80 shadow-sm">
        <p className="doc-font whitespace-pre-wrap">“{evidence.snippet}”</p>
        {!evidence.locationAvailable ? (
          <p className="mt-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-warn-deep">
            Exact line tracking unavailable — snippet shown instead
          </p>
        ) : null}
      </div>
    </details>
  );
}
