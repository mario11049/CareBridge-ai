"use client";

// App-wide client state: current document, extraction, plan, validation report,
// language preference. Persisted to localStorage so navigation never loses the
// working document. No server storage of clinical text by design.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { extractFromText } from "@/lib/carebridge/extractor";
import { buildPlan } from "@/lib/carebridge/planner";
import { validatePlan } from "@/lib/carebridge/validator";
import type { CarePlan, Extraction, Lang, PipelineResult, ValidationReport } from "@/lib/carebridge/types";

const LS_KEY = "carebridge.state.v1";

export interface JudgeRun {
  id: string;
  challenge: string;
  ranAt: string;
  detectionPassed: boolean;
  mismatchCount: number;
  summary: string;
}

interface PersistedState {
  sourceText: string;
  sourceName: string;
  sampleId: string | null;
  mode: "demo" | "live";
  lang: Lang;
  updatedAt: string;
}

interface StoreValue {
  hydrated: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  result: PipelineResult | null;
  processDocument: (text: string, name: string, sampleId: string | null, mode?: "demo" | "live", providedExtraction?: Extraction) => PipelineResult;
  setPlan: (plan: CarePlan, report?: ValidationReport) => void;
  reset: () => void;
  judgeRuns: JudgeRun[];
  addJudgeRun: (r: JudgeRun) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function CareBridgeProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [judgeRuns, setJudgeRuns] = useState<JudgeRun[]>([]);

  // hydrate from localStorage (scheduled — avoids synchronous setState inside the effect body)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (raw) {
          const p = JSON.parse(raw) as PersistedState & { result?: PipelineResult; judgeRuns?: JudgeRun[] };
          setLangState(p.lang === "te" ? "te" : "en");
          if (p.result) setResult(p.result);
          if (Array.isArray(p.judgeRuns)) setJudgeRuns(p.judgeRuns.slice(0, 12));
        }
      } catch {
        /* corrupted state — start clean */
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const persist = useCallback((r: PipelineResult | null, l: Lang, runs: JudgeRun[]) => {
    try {
      const payload = {
        sourceText: r?.sourceText ?? "",
        sourceName: r?.sourceName ?? "",
        sampleId: r?.sampleId ?? null,
        mode: r?.mode ?? "demo",
        lang: l,
        updatedAt: new Date().toISOString(),
        result: r,
        judgeRuns: runs,
      };
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      /* storage full / unavailable — state stays in memory */
    }
  }, []);

  const processDocument = useCallback(
    (text: string, name: string, sampleId: string | null, mode: "demo" | "live" = "demo", providedExtraction?: Extraction): PipelineResult => {
      // When a server-validated AI extraction is supplied, the deterministic
      // pipeline still re-runs: the plan builder + faithfulness engine ALWAYS
      // check what the model produced — nothing is displayed unvalidated.
      const extraction: Extraction = providedExtraction ?? extractFromText(text);
      const plan: CarePlan = buildPlan(extraction);
      const report: ValidationReport = validatePlan(extraction, plan);
      const r: PipelineResult = {
        mode,
        extraction,
        plan,
        report,
        sourceText: text,
        sourceName: name,
        sampleId,
        processedAt: new Date().toISOString(),
      };
      setResult(r);
      setJudgeRuns((runs) => {
        persist(r, lang, runs);
        return runs;
      });
      return r;
    },
    [lang, persist],
  );

  const setPlan = useCallback(
    (plan: CarePlan, report?: ValidationReport) => {
      setResult((cur) => {
        if (!cur) return cur;
        const next: PipelineResult = {
          ...cur,
          plan,
          report: report ?? validatePlan(cur.extraction, plan),
        };
        setJudgeRuns((runs) => {
          persist(next, lang, runs);
          return runs;
        });
        return next;
      });
    },
    [lang, persist],
  );

  const reset = useCallback(() => {
    setResult(null);
    setJudgeRuns([]);
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      setResult((cur) => {
        setJudgeRuns((runs) => {
          persist(cur, l, runs);
          return runs;
        });
        return cur;
      });
    },
    [persist],
  );

  const addJudgeRun = useCallback(
    (run: JudgeRun) => {
      setJudgeRuns((runs) => {
        const next = [run, ...runs].slice(0, 12);
        setResult((cur) => {
          persist(cur, lang, next);
          return cur;
        });
        return next;
      });
    },
    [lang, persist],
  );

  const value = useMemo<StoreValue>(
    () => ({ hydrated, lang, setLang, result, processDocument, setPlan, reset, judgeRuns, addJudgeRun }),
    [hydrated, lang, setLang, result, processDocument, setPlan, reset, judgeRuns, addJudgeRun],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useCareBridge(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useCareBridge must be used inside CareBridgeProvider");
  return ctx;
}
