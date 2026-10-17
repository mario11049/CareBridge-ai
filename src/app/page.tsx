"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Download,
  FlaskConical,
  Languages,
  Link2,
  ListChecks,
  Printer,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Upload,
  Wand2,
} from "lucide-react";
import { BridgeMark } from "@/components/Logo";
import { SectionHeading } from "@/components/ui";
import StatusPill from "@/components/StatusPill";

const fade = (i: number) => ({ animationDelay: `${i * 90}ms` });

export default function LandingPage() {
  return (
    <div className="hero-aurora bg-grain overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="cb-pill inline-flex border border-med-line bg-white text-med-deep animate-fade-up">
              <ShieldCheck size={13} aria-hidden="true" />
              Faithfulness before fluency — clinical AI prototype
            </p>
            <h1
              className="font-display mt-5 text-[clamp(2.6rem,6vw,4.6rem)] font-medium leading-[1.02] tracking-tight text-navy animate-fade-up"
              style={fade(1)}
            >
              Leave the hospital
              <br />
              with <em className="not-italic text-med-deep">clarity.</em>
            </h1>
            <p className="mt-5 max-w-xl text-[1.08rem] leading-relaxed text-mist animate-fade-up" style={fade(2)}>
              Turn complex discharge instructions into a clear recovery plan — in{" "}
              <strong className="font-semibold text-navy">English</strong> and{" "}
              <strong className="font-semibold text-navy te">తెలుగు</strong> — with evidence-linked checks for critical
              details.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-up" style={fade(3)}>
              <Link href="/workspace" className="cb-btn cb-btn-primary text-base">
                Create a Care Plan
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/judge" className="cb-btn cb-btn-ghost text-base">
                <FlaskConical size={16} aria-hidden="true" />
                Explore Live Demo
              </Link>
            </div>
            <p className="mt-6 flex max-w-lg items-start gap-2 text-[0.8rem] leading-relaxed text-mist animate-fade-up" style={fade(4)}>
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn-deep" aria-hidden="true" />
              Prototype using synthetic documents. Automated checks do not guarantee clinical correctness and never
              replace your care team.
            </p>
          </div>

          {/* Product preview mock */}
          <div className="relative animate-fade-up" style={fade(2)} aria-hidden="true">
            <div className="absolute -left-8 -top-6 hidden animate-float lg:block" style={{ animationDelay: "0.4s" }}>
              <div className="cb-card flex items-center gap-2 px-3.5 py-2.5 text-[0.78rem] font-bold text-navy">
                <Languages size={15} className="text-med" />
                English <span className="text-mist">⇄</span> <span className="te">తెలుగు</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1.15fr]">
              {/* source document */}
              <div className="cb-card relative overflow-hidden p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist">Source · Discharge summary</span>
                  <span className="rounded border border-warn/60 bg-warn-soft px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-warn-deep">
                    synthetic
                  </span>
                </div>
                <pre className="doc-font whitespace-pre-wrap text-ink/75">
{`MEDICATIONS
1. Tab. Paracetamol 650 mg,
   take 1 tablet by mouth,
   three times daily, for
   5 days. Take after food.
2. Cap. Amoxicillin 500 mg,
   ...`}
                </pre>
                <div className="mt-3 border-t border-dashed border-line pt-3">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist">Warning signs</p>
                  <p className="doc-font mt-1 text-[0.72rem] text-alert-deep">Fever above 100.4°F (38°C): contact the surgical unit…</p>
                </div>
              </div>
              {/* care plan + audit */}
              <div className="flex flex-col gap-4">
                <div className="cb-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-med-deep">Patient care plan</span>
                    <StatusPill status="matched" />
                  </div>
                  <div className="rounded-xl bg-ivory p-3">
                    <p className="text-sm font-bold text-navy">Paracetamol 650 mg</p>
                    <p className="mt-0.5 text-[0.82rem] leading-snug text-ink/80">
                      Take 1 tablet by mouth, three times daily, for 5 days. Take after food.
                    </p>
                    <p className="te mt-1.5 border-t border-dashed border-line pt-1.5 text-[0.8rem] text-ink/70">
                      1 టాబ్లెట్ నోటి ద్వారా తీసుకోండి — రోజుకు మూడుసార్లు, 5 రోజుల పాటు.
                    </p>
                  </div>
                </div>
                <div className="cb-card p-4">
                  <p className="mb-2.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-mist">Verification panel</p>
                  <div className="space-y-1.5 text-[0.78rem] font-medium">
                    {[
                      ["Strength · 650 mg → 650 mg", "matched"],
                      ["Warning signs · 3 of 3", "matched"],
                      ["Warfarin strength conflict", "needs_review"],
                    ].map(([label, s]) => (
                      <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-ivory px-2.5 py-1.5">
                        <span className="truncate text-ink/80">{label}</span>
                        <StatusPill status={s as "matched" | "needs_review"} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 right-6 hidden animate-float lg:block">
              <div className="cb-card flex items-center gap-2 px-3.5 py-2.5 text-[0.78rem] font-bold text-navy">
                <Printer size={15} className="text-med" />
                A4 fridge sheet · EN / తె
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ VALUE PROPS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: BookOpenText,
              title: "Understandable instructions",
              body: "Short sentences, familiar words, Class-8-level English — plus natural Telugu. Readability is measured, not assumed.",
            },
            {
              icon: Link2,
              title: "Source-linked medical details",
              body: "Every medicine, dose, date and warning is traceable to the exact line of the discharge summary it came from.",
            },
            {
              icon: ShieldCheck,
              title: "Transparent faithfulness checks",
              body: "Deterministic field-by-field comparison flags mismatches, omissions and unsupported additions — and blocks the verified state.",
            },
          ].map((v, i) => (
            <div key={v.title} className="cb-card group p-6 transition-all hover:-translate-y-1 hover:shadow-lift animate-fade-up" style={fade(i)}>
              <div className="mb-4 inline-flex rounded-xl bg-med-soft p-3 text-med-deep transition-colors group-hover:bg-med group-hover:text-white">
                <v.icon size={22} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-navy">{v.title}</h3>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-mist">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ WORKFLOW ============ */}
      <section className="border-y border-line bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Six honest stages"
            title="From a dense summary to a plan you can check"
            body="Extraction is deterministic. Rewriting is template-grounded. Validation runs in application code — never inside the same model call that produced the text."
          />
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              { icon: Upload, step: "Upload", body: "PDF, TXT, paste, or synthetic sample" },
              { icon: ScanSearch, step: "Extract", body: "Deterministic field parser with evidence lines" },
              { icon: Wand2, step: "Simplify", body: "Plain-language wording, values copied verbatim" },
              { icon: Languages, step: "Translate", body: "Telugu from verified phrase rendering; gaps flagged" },
              { icon: ListChecks, step: "Validate", body: "Field-level source↔plan comparison" },
              { icon: Download, step: "Export", body: "A4 fridge sheet, EN or తెలుగు, never over-claimed" },
            ].map((w, i) => (
              <li key={w.step} className="relative cb-card-flat p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-[0.72rem] font-extrabold text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <w.icon size={17} className="text-med" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-navy">{w.step}</p>
                <p className="mt-1 text-[0.78rem] leading-snug text-mist">{w.body}</p>
                {i < 5 ? (
                  <ArrowRight size={14} className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-med lg:block" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ HONESTY BAND ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="navy-panel relative overflow-hidden rounded-[28px] p-8 text-white sm:p-12">
          <div className="absolute right-8 top-8 opacity-20" aria-hidden="true">
            <BridgeMark size={120} />
          </div>
          <div className="relative max-w-2xl">
            <p className="cb-eyebrow !text-warn">Built to be doubted</p>
            <h2 className="font-display mt-2 text-3xl font-medium leading-tight sm:text-4xl">
              A plan is only shown as checked when the checks actually ran.
            </h2>
            <ul className="mt-6 space-y-3.5 text-[0.95rem] leading-relaxed text-white/80">
              <li className="flex gap-3">
                <Sparkles size={17} className="mt-1 shrink-0 text-med" aria-hidden="true" />
                <span>
                  <strong className="text-white">Synthetic data only.</strong> Three labelled sample cases and a 50-case
                  gold-standard set. No real patient data, anywhere.
                </span>
              </li>
              <li className="flex gap-3">
                <TriangleAlert size={17} className="mt-1 shrink-0 text-warn" aria-hidden="true" />
                <span>
                  <strong className="text-white">No invented confidence.</strong> Missing doses stay missing. Conflicts are
                  shown as conflicts. A passing check is field consistency — never a clinical safety guarantee.
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck size={17} className="mt-1 shrink-0 text-med" aria-hidden="true" />
                <span>
                  <strong className="text-white">Run the challenge test.</strong> Judge mode injects a known error — a
                  changed dose, a dropped follow-up date, an omitted warning — and shows the validator catching it.
                </span>
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/judge" className="cb-btn cb-btn-primary">
                Open Judge Mode
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link href="/about" className="cb-btn border-white/25 bg-transparent text-white hover:bg-white/10" style={{ borderWidth: 1 }}>
                Limitations &amp; privacy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
