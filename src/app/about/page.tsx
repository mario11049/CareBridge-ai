"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Database, Eye, KeyRound, Lock, Server, ShieldQuestion, XCircle } from "lucide-react";
import { PageShell, SectionHeading } from "@/components/ui";
import { BridgeMark } from "@/components/Logo";

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="Transparency"
      title="About, limitations & privacy"
      body="CareBridge AI is a hackathon prototype. This page says exactly what it is, what it is not, and how it handles data."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {/* what it is */}
        <section className="cb-card p-6">
          <div className="flex items-center gap-3">
            <BridgeMark size={40} />
            <h2 className="font-display text-xl font-semibold text-navy">What CareBridge AI is</h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-[0.92rem] leading-relaxed text-ink/85">
            {[
              "A patient-education and document-transformation prototype with the tagline “Clear instructions. Safer recovery.”",
              "A demonstration that a care plan can be traceable: every instruction links back to a source line, and every critical value is machine-checked.",
              "A bilingual (English / తెలుగు) rendering pipeline where unverified translations are preserved in English and flagged — never guessed.",
              "A judge-able system: the faithfulness engine runs in application code and catches injected errors in front of you.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckCircle2 size={16} className="mt-1 shrink-0 text-med" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* what it is not */}
        <section className="cb-card border-alert/30 p-6">
          <div className="flex items-center gap-3">
            <ShieldQuestion size={26} className="text-alert" aria-hidden="true" />
            <h2 className="font-display text-xl font-semibold text-navy">What it is not</h2>
          </div>
          <ul className="mt-4 space-y-2.5 text-[0.92rem] leading-relaxed text-ink/85">
            {[
              "Not a diagnostic tool, prescriber, or replacement for a clinician.",
              "Not clinically validated, not a medical device, and not approved by any regulator.",
              "Not connected to any hospital EHR or real patient database — synthetic documents only.",
              "Not “100% safe”: a passing automated check means field-level consistency, not clinical correctness.",
              "Not production-ready: it is a hackathon demonstration with openly stated limitations.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <XCircle size={16} className="mt-1 shrink-0 text-alert" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* architecture */}
      <section className="cb-card mt-5 p-6">
        <SectionHeading eyebrow="How it works" title="Deterministic core, optional live AI" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Server, t: "Extract", d: "A rule-based parser reads sections (medicines, follow-ups, warning signs, diet, activity). Unparseable content is preserved verbatim and flagged — never dropped, never guessed. Missing fields become explicit nulls." },
            { icon: Eye, t: "Simplify & translate", d: "Template-grounded plain language copies values verbatim. Telugu rendering uses a verified phrase dictionary; gaps are preserved in English and flagged for review." },
            { icon: CheckCircle2, t: "Validate", d: "The faithfulness engine compares every critical field between source and plan exactly (meaning-safe normalisation only). Mismatches, omissions and unsupported additions block the verified state." },
            { icon: KeyRound, t: "Live mode (optional)", d: "When a server-side GEMINI_API_KEY is configured, Gemini can propose structured JSON extraction — always re-validated by the deterministic engine. No key in the browser, ever." },
          ].map((s) => (
            <div key={s.t} className="rounded-2xl bg-ivory p-4">
              <s.icon size={18} className="text-med" aria-hidden="true" />
              <p className="mt-2 font-bold text-navy">{s.t}</p>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-mist">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* privacy */}
      <section className="cb-card mt-5 p-6">
        <div className="flex items-center gap-2.5">
          <Lock size={18} className="text-med" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold text-navy">Privacy & data handling</h2>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-ivory p-4">
            <Database size={16} className="text-navy" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-navy">Nothing stored on a server</p>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-mist">
              Uploaded files are parsed in memory and discarded. No database writes, no document logging. Your processed plan lives only in your browser&apos;s localStorage until you press Reset.
            </p>
          </div>
          <div className="rounded-2xl bg-ivory p-4">
            <KeyRound size={16} className="text-navy" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-navy">Keys stay server-side</p>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-mist">
              GEMINI_API_KEY is read only inside the server route, never bundled to the browser, never logged. Users are never asked to paste a key into the UI.
            </p>
          </div>
          <div className="rounded-2xl bg-ivory p-4">
            <AlertTriangle size={16} className="text-navy" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-navy">Document text is untrusted</p>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-mist">
              In live mode the document is sent to the model inside a data delimiter with an instruction to ignore embedded commands (prompt-injection containment). In demo mode nothing leaves your device at all.
            </p>
          </div>
        </div>
      </section>

      {/* known limitations */}
      <section className="mt-5 rounded-2xl border border-warn/50 bg-warn-soft/70 p-6">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={18} className="text-warn-deep" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold text-warn-deep">Known limitations, stated plainly</h2>
        </div>
        <ul className="mt-4 grid gap-x-8 gap-y-2 text-[0.9rem] leading-relaxed text-ink/85 md:grid-cols-2">
          <li>· The deterministic parser understands the standard section layout used by the samples and many hospitals; free-form doctor prose may parse partially and will be flagged rather than guessed.</li>
          <li>· Telugu coverage is complete for the synthetic corpus and phrase pool; novel sentences are preserved in English with a review flag instead of a machine guess.</li>
          <li>· Scanned PDFs have no extractable text and are rejected with a clear message (no OCR in this demo).</li>
          <li>· Evaluation scores describe synthetic text only — they are not a clinical accuracy claim.</li>
          <li>· Audio playback depends on browser voices; Telugu voice availability varies by device.</li>
          <li>· The seven-day view is suppressed unless the source states both frequency and duration, and it never shows invented clock times.</li>
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/workspace" className="cb-btn cb-btn-primary">
          Try the workspace
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link href="/judge" className="cb-btn cb-btn-ghost">
          See the validator work
        </Link>
      </div>
    </PageShell>
  );
}
