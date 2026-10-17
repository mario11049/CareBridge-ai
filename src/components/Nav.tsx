"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Menu, RotateCcw, X } from "lucide-react";
import Logo from "./Logo";
import LangToggle from "./LangToggle";
import { useCareBridge } from "@/lib/store";
import { clsx } from "@/lib/carebridge/util";

const LINKS = [
  { href: "/workspace", label: "Workspace" },
  { href: "/review", label: "Extraction" },
  { href: "/plan", label: "Care Plan" },
  { href: "/audit", label: "Evidence Audit" },
  { href: "/judge", label: "Judge Mode" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/print", label: "Fridge Sheet" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { result, reset } = useCareBridge();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/85 backdrop-blur-md">
      <div className="bg-navy px-4 py-1.5 text-center text-[0.7rem] font-semibold tracking-[0.14em] text-white/85 uppercase">
        Hackathon prototype — synthetic data only — not medical advice
      </div>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6" aria-label="Primary">
        <Logo />
        <div className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "rounded-lg px-3 py-2 text-[0.84rem] font-semibold transition-colors",
                pathname === l.href ? "bg-navy text-white" : "text-ink/70 hover:bg-ivory-2 hover:text-navy",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {result?.sourceText ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-med-line bg-med-soft px-2.5 py-1 text-[0.7rem] font-bold text-med-deep md:inline-flex">
              <FlaskConical size={12} aria-hidden="true" />
              {result.mode === "demo" ? "Demo mode" : "Live mode"} · {result.sampleId ?? "custom doc"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="hidden items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[0.78rem] font-semibold text-mist transition-colors hover:border-alert/40 hover:text-alert md:inline-flex"
            title="Clear the current document and start over"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset
          </button>
          <LangToggle compact />
          <button
            type="button"
            className="rounded-lg border border-line bg-white p-2 text-navy lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>
      {open ? (
        <div className="border-t border-line bg-ivory px-4 pb-4 pt-2 lg:hidden">
          <div className="grid grid-cols-2 gap-1.5">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "rounded-lg px-3 py-2.5 text-sm font-semibold",
                  pathname === l.href ? "bg-navy text-white" : "bg-white text-ink/75 border border-line",
                )}
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-lg border border-alert/30 bg-alert-soft px-3 py-2.5 text-left text-sm font-semibold text-alert-deep"
            >
              Reset workspace
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
