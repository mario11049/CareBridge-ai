"use client";

import { useCareBridge } from "@/lib/store";

export default function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useCareBridge();
  return (
    <div
      role="group"
      aria-label="Plan language"
      className="inline-flex items-center rounded-full border border-line bg-white p-1 shadow-sm"
    >
      {(
        [
          { code: "en", label: "English", short: "EN" },
          { code: "te", label: "తెలుగు", short: "తె" },
        ] as const
      ).map((l) => (
        <button
          key={l.code}
          type="button"
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-full transition-all ${compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} font-semibold ${
            lang === l.code ? "bg-med text-white shadow" : "text-mist hover:text-navy"
          }`}
        >
          {compact ? l.short : l.label}
        </button>
      ))}
    </div>
  );
}
