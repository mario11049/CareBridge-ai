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
  processDocument: (text: string, name: string, sampleId: string | null, mode?: "demo" | "live") => PipelineResult;
  setPlan: (plan: CarePlan, report?: ValidationReport) => void;
  reset: () => void;
  judgeRuns: JudgeRun[];
  addJudgeRun: (r: JudgeRun) => void;
  liveStatus: { kind: "idle" | "ok" | "unavailable" | "error"; message: string };
  setLiveStatus: (s: { kind: "idle" | "ok" | "unavailable" | "error"; message: string }) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function CareBridgeProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [judgeRuns, setJudgeRuns] = useState<JudgeRun[]>([]);
  const [liveStatus, setLiveStatus] = useState<StoreValue["liveStatus"]>({ kind: "idle", message: "" });

  // hydrate from localStorage
  useEffect(() => {
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
    (text: string, name: string, sampleId: string | null, mode: "demo" | "live" = "demo"): PipelineResult => {
      const extraction: Extraction = extractFromText(text);
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
    setLiveStatus({ kind: "idle", message: "" });
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
    () => ({ hydrated, lang, setLang, result, processDocument, setPlan, reset, judgeRuns, addJudgeRun, liveStatus, setLiveStatus }),
    [hydrated, lang, setLang, result, processDocument, setPlan, reset, judgeRuns, addJudgeRun, liveStatus],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useCareBridge(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useCareBridge must be used inside CareBridgeProvider");
  return ctx;
}
