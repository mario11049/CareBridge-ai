"use client";

import Link from "next/link";
import { FilePlus2 } from "lucide-react";

export default function EmptyState({
  title = "No document loaded yet",
  body = "Load one of the three synthetic sample summaries — or paste your own text — in the workspace first. Everything on this page builds on that document.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-lg animate-fade-up py-20 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-med-soft text-med-deep">
        <FilePlus2 size={28} aria-hidden="true" />
      </div>
      <h2 className="cb-h2 font-display">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-[0.95rem] leading-relaxed text-mist">{body}</p>
      <Link href="/workspace" className="cb-btn cb-btn-primary mt-7">
        Open the workspace
      </Link>
    </div>
  );
}
