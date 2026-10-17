"use client";

import { AlertTriangle } from "lucide-react";
import { useCareBridge } from "@/lib/store";
import { clsx } from "@/lib/carebridge/util";

/**
 * Bilingual text: renders the Telugu rendering when the interface language is
 * Telugu. If no verified Telugu rendering exists, the English original is shown
 * with a subtle "preserved in English" marker — never a silent machine guess.
 */
export function T({
  en,
  te,
  teReview,
  className,
  markReview = true,
}: {
  en: string | null | undefined;
  te?: string | null;
  teReview?: boolean;
  className?: string;
  markReview?: boolean;
}) {
  const { lang } = useCareBridge();
  if (lang === "te" && te) {
    return <span className={clsx("te", className)}>{te}</span>;
  }
  if (lang === "te" && en && (teReview || !te)) {
    return (
      <span className={className}>
        {en}
        {markReview ? (
          <span
            className="ml-2 inline-flex items-center gap-1 rounded bg-warn-soft px-1.5 py-0.5 align-middle text-[0.62rem] font-bold uppercase tracking-wide text-warn-deep"
            title="No verified Telugu rendering exists for this phrase. The English original from the source is preserved."
          >
            <AlertTriangle size={10} aria-hidden="true" />
            EN preserved
          </span>
        ) : null}
      </span>
    );
  }
  return <span className={className}>{en ?? "—"}</span>;
}
