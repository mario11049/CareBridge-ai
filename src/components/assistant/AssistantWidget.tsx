"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BotMessageSquare,
  Check,
  ChevronDown,
  Copy,
  Eraser,
  Loader2,
  MessageSquareText,
  Minus,
  RotateCcw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCareBridge } from "@/lib/store";
import LangToggle from "@/components/LangToggle";
import { BridgeMark } from "@/components/Logo";
import {
  buildAssistantContext,
  computeDocKey,
  detectDocKeyFromResult,
  preflightGuard,
  GUARD_REPLIES,
  suggestedQuestions,
  type AssistantContext,
  type AssistantReply,
} from "@/lib/carebridge/assistant";
import { detectIntent, answerOffline } from "@/lib/carebridge/offline-assistant";
import { clsx } from "@/lib/carebridge/util";

type MsgKind = "user" | "assistant" | "notice";
type LiveMode = "checking" | "live" | "offline";

interface ChatMsg {
  id: string;
  kind: MsgKind;
  text: string;
  reply?: AssistantReply;
  mode?: "live" | "guard" | "review" | "offline";
  error?: string;
  retryPayload?: string;
  at: number;
}

const SS_KEY = "carebridge.assistant.v1";
let msgN = 0;
const nid = () => `m${Date.now().toString(36)}-${(msgN++).toString(36)}`;

export default function AssistantWidget() {
  const { result, lang, hydrated } = useCareBridge();
  const [open, setOpen] = useState(false);
  const [minHint, setMinHint] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<LiveMode>("checking");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const docKeyRef = useRef<string | null>(null);

  const ctx = useMemo<AssistantContext | null>(() => buildAssistantContext(result), [result]);
  const docKey = useMemo(() => detectDocKeyFromResult(result), [result]);

  // capability probe — tells us whether live mode is available without exposing anything
  useEffect(() => {
    let alive = true;
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => alive && setMode(d.configured ? "live" : "offline"))
      .catch(() => alive && setMode("offline"));
    return () => {
      alive = false;
    };
  }, []);

  // ---- document-change isolation + hydration (scheduled to avoid synchronous setState in the effect body) ----
  useEffect(() => {
    if (!hydrated) return;
    const id = requestAnimationFrame(() => {
      if (docKeyRef.current === null) {
        // first hydration — try to restore a session matching current doc
        try {
          const raw = sessionStorage.getItem(SS_KEY);
          if (raw) {
            const saved = JSON.parse(raw) as { docKey: string | null; msgs: ChatMsg[] };
            if (saved.docKey === docKey && Array.isArray(saved.msgs) && saved.msgs.length) {
              setMsgs(saved.msgs.slice(-50));
              docKeyRef.current = docKey;
              return;
            }
          }
        } catch {
          /* fresh start */
        }
        docKeyRef.current = docKey;
        setMsgs([]);
        return;
      }
      if (docKeyRef.current !== docKey) {
        // document changed — isolate context, never mix two documents
        docKeyRef.current = docKey;
        setMsgs([]);
        try {
          sessionStorage.removeItem(SS_KEY);
        } catch {
          /* noop */
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [docKey, hydrated]);

  // persist conversation (size-capped; medical content stays in sessionStorage only)
  useEffect(() => {
    if (!msgs.length || !hydrated) return;
    try {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ docKey, msgs: msgs.slice(-50) }));
    } catch {
      /* storage full — conversation still works in memory */
    }
  }, [msgs, docKey, hydrated]);

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, open]);

  // focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // escape closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const clearChat = () => {
    setMsgs([]);
    try {
      sessionStorage.removeItem(SS_KEY);
    } catch {
      /* noop */
    }
  };

  interface ApiSuccess {
    ok: true;
    mode: "live" | "guard" | "review";
    reply: AssistantReply;
  }
  interface ApiError {
    ok: false;
    code: string;
    message: string;
  }

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setInput("");
      setBusy(true);
      setMinHint(false);
      setMsgs((m) => [...m, { id: nid(), kind: "user", text: question, at: Date.now() }]);

      const push = (msg: Omit<ChatMsg, "id" | "at">) => setMsgs((m) => [...m, { ...msg, id: nid(), at: Date.now() }]);

      // 1. deterministic safety guard — never asks the model
      const guard = preflightGuard(question);
      if (guard.triggered && guard.reason) {
        const g = GUARD_REPLIES[guard.reason];
        push({
          kind: "assistant",
          text: lang === "te" ? g.te : g.en,
          mode: "guard",
          reply: {
            answer: lang === "te" ? g.te : g.en,
            language: lang,
            supportingSourceExcerpt: null,
            uncertaintyStatus: "confident",
            needsHumanReview: true,
            responseType: "safety_refusal",
          },
        });
        setBusy(false);
        return;
      }

      // 2. ask the secure backend
      let offlineReason: string | null = null;
      try {
        const history = msgs
          .filter((m) => m.kind !== "notice")
          .slice(-10)
          .map((m) => ({ role: m.kind === "user" ? "user" : "assistant", text: m.text.slice(0, 800) }));
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, lang, context: ctx, history }),
        });
        const data = (await res.json()) as ApiSuccess | ApiError;
        if (res.ok && data.ok) {
          push({
            kind: "assistant",
            text: data.reply.answer,
            mode: data.mode,
            reply: data.reply,
          });
        } else if (!data.ok) {
          // honest failure — offline assistant takes over ONLY if it has a real, fact-grounded answer
          offlineReason = data.message;
          const intent = detectIntent(question);
          if (intent !== "unknown") {
            const off = answerOffline(question, ctx, lang);
            push({
              kind: "assistant",
              text: off.answer,
              mode: "offline",
              reply: off,
              error: offlineReason,
              retryPayload: question,
            });
          } else {
            push({ kind: "notice", text: offlineReason, retryPayload: question });
          }
        }
      } catch {
        offlineReason = "Could not reach the assistant service (network). The offline assistant answer below is built from your validated plan data, not a language model.";
        const intent = detectIntent(question);
        if (intent !== "unknown") {
          const off = answerOffline(question, ctx, lang);
          push({ kind: "assistant", text: off.answer, mode: "offline", reply: off, error: offlineReason, retryPayload: question });
        } else {
          push({ kind: "notice", text: offlineReason, retryPayload: question });
        }
      }
      setBusy(false);
    },
    [busy, msgs, lang, ctx],
  );

  const copyMsg = async (m: ChatMsg) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (!hydrated) return null;

  const suggestions = suggestedQuestions(Boolean(ctx), lang);
  const showSuggestions = msgs.filter((m) => m.kind === "user").length === 0;

  return (
    <>
      {/* ---- floating launcher ---- */}
      <div className={clsx("no-print fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6", open && "hidden sm:flex")}>
        {!open && !minHint ? (
          <div className="mr-1 max-w-[210px] animate-fade-up rounded-2xl rounded-br-md border border-line bg-white px-3.5 py-2.5 shadow-lift" role="tooltip">
            <p className="text-[0.8rem] font-semibold leading-snug text-navy">Have a question? Ask CareBridge.</p>
            <button type="button" onClick={() => setMinHint(true)} className="mt-1 text-[0.68rem] font-bold text-mist hover:text-navy">
              Dismiss
            </button>
          </div>
        ) : null}
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ask CareBridge Assistant"
            aria-expanded={open}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-med text-white shadow-lift transition-all hover:scale-105 hover:bg-med-deep focus-visible:outline-med-deep sm:h-16 sm:w-16 animate-fade-up"
          >
            <span className="absolute inset-0 rounded-full bg-med opacity-40 [animation:pulse-ring_2.4s_ease-out_infinite]" aria-hidden="true" />
            <MessageSquareText size={26} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Minimise CareBridge Assistant"
            className="hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-navy shadow-lift transition-transform hover:scale-105 sm:flex"
          >
            <ChevronDown size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ---- chat panel ---- */}
      {open ? (
        <section
          role="dialog"
          aria-label="CareBridge Assistant chat"
          className={clsx(
            "no-print fixed z-50 flex animate-fade-up flex-col overflow-hidden bg-white shadow-lift",
            // mobile: near full-screen sheet
            "inset-0 rounded-none",
            // desktop: floating panel
            "sm:inset-auto sm:bottom-[calc(5rem+0.75rem)] sm:right-6 sm:h-[min(600px,calc(100dvh-9rem))] sm:w-[404px] sm:rounded-[22px] sm:border sm:border-line",
          )}
        >
          {/* header */}
          <header className="flex items-center gap-2.5 border-b border-line bg-navy px-4 py-3 text-white">
            <BridgeMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-extrabold leading-tight tracking-tight">CareBridge Assistant</p>
              <p className="truncate text-[0.64rem] font-medium tracking-wide text-white/65">
                Understand your care plan, one question at a time.
              </p>
            </div>
            <span
              className={clsx(
                "cb-pill shrink-0",
                mode === "live" && "bg-med/25 text-med-soft",
                mode === "offline" && "bg-warn/25 text-warn",
                mode === "checking" && "bg-white/15 text-white/80",
              )}
            >
              {mode === "live" ? "AI · live" : mode === "offline" ? "offline demo" : "checking…"}
            </span>
            <LangToggle compact />
            <button type="button" onClick={clearChat} aria-label="Clear conversation" title="Clear conversation" className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <Eraser size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:hidden">
              <X size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimise assistant" className="hidden rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:block">
              <Minus size={18} aria-hidden="true" />
            </button>
          </header>

          {/* context strip */}
          <div className="flex items-center gap-2 border-b border-line bg-ivory px-4 py-2 text-[0.68rem] font-semibold text-mist">
            <span className={clsx("h-1.5 w-1.5 rounded-full", ctx ? "bg-med" : "bg-warn")} aria-hidden="true" />
            {ctx ? (
              <span className="truncate">
                Answering from: {result?.sourceName} {result?.report.verified ? "· checks passed" : "· has review flags"}
              </span>
            ) : (
              <span className="truncate">No document loaded — load a sample for document-specific answers</span>
            )}
          </div>

          {/* messages */}
          <div ref={scrollRef} className="cb-scroll flex-1 space-y-3.5 overflow-y-auto bg-ivory/60 px-3.5 py-4" aria-live="polite">
            {msgs.length === 0 ? (
              <div className="animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <AssistantAvatar />
                  <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-line bg-white px-3.5 py-3 text-[0.88rem] leading-relaxed text-ink/90 shadow-sm">
                    {lang === "te" ? (
                      <span className="te">
                        నమస్తే! నేను కేర్‌బ్రిడ్జ్ అసిస్టెంట్‌ని. మీ డిశ్చార్జ్ సూచనలను సరళంగా వివరిస్తాను — మందులు, ఫాలో-అప్,
                        ప్రమాద సంకేతాల గురించి అడగండి. నేను మందుల వివరాలను ఊహించను.
                      </span>
                    ) : (
                      "Hello! I explain your discharge instructions in simple language — medicines, follow-ups, warning signs and terms. I never guess values your document does not state."
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {msgs.map((m) =>
              m.kind === "user" ? (
                <div key={m.id} className="flex justify-end animate-fade-in">
                  <div className="max-w-[86%] rounded-2xl rounded-tr-md bg-med-soft px-3.5 py-2.5 text-[0.88rem] leading-relaxed text-navy shadow-sm">
                    {m.text}
                  </div>
                </div>
              ) : m.kind === "notice" ? (
                <div key={m.id} className="animate-fade-in rounded-2xl border border-alert/30 bg-alert-soft px-3.5 py-3 text-[0.84rem] leading-relaxed text-alert-deep">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      {m.text}
                      {m.retryPayload ? (
                        <button
                          type="button"
                          onClick={() => void send(m.retryPayload as string)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[0.74rem] font-bold text-navy shadow-sm transition-colors hover:bg-ivory"
                        >
                          <RotateCcw size={12} aria-hidden="true" />
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5 animate-fade-in">
                  <AssistantAvatar />
                  <div
                    className={clsx(
                      "max-w-[86%] rounded-2xl rounded-tl-md border px-3.5 py-3 text-[0.88rem] leading-relaxed shadow-sm",
                      m.mode === "guard"
                        ? "border-alert/35 bg-alert-soft/70 text-alert-deep"
                        : m.mode === "review"
                          ? "border-warn/60 bg-warn-soft text-warn-deep"
                          : "border-line bg-white text-ink/90",
                    )}
                  >
                    {/* mode tags */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {m.mode === "live" ? (
                        <span className="cb-pill !px-2 !py-0.5 !text-[0.58rem] bg-med-soft text-med-deep">AI · faithfulness-checked</span>
                      ) : null}
                      {m.mode === "offline" ? (
                        <span className="cb-pill !px-2 !py-0.5 !text-[0.58rem] bg-ivory-2 text-mist">Offline answer · from validated plan data, not AI</span>
                      ) : null}
                      {m.mode === "guard" ? (
                        <span className="cb-pill !px-2 !py-0.5 !text-[0.58rem] bg-alert text-white">
                          <ShieldAlert size={9} aria-hidden="true" /> Safety rule
                        </span>
                      ) : null}
                      {m.mode === "review" ? (
                        <span className="cb-pill !px-2 !py-0.5 !text-[0.58rem] bg-warn text-navy">Withheld for review</span>
                      ) : null}
                    </div>

                    <p className={clsx("whitespace-pre-wrap", m.reply?.language === "te" && "te")}>{m.text}</p>

                    {m.reply?.supportingSourceExcerpt ? (
                      <details className="group mt-2">
                        <summary className="cursor-pointer list-none text-[0.7rem] font-bold text-med-deep hover:underline [&::-webkit-details-marker]:hidden">
                          ▸ View source excerpt
                        </summary>
                        <blockquote className="doc-font mt-1.5 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-ivory p-2.5 text-[0.7rem] leading-relaxed text-ink/75 cb-scroll">
                          “{m.reply.supportingSourceExcerpt}”
                        </blockquote>
                      </details>
                    ) : null}

                    {m.reply?.needsHumanReview || m.reply?.uncertaintyStatus === "uncertain" ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warn/50 bg-warn-soft/80 px-2.5 py-1.5 text-[0.72rem] font-semibold leading-snug text-warn-deep">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {m.reply.needsHumanReview
                          ? lang === "te"
                            ? "ఇది నిపుణుడి (డాక్టర్/ఫార్మసిస్ట్) నిర్ధారణ అవసరం."
                            : "This needs confirmation from a professional (doctor/pharmacist)."
                          : lang === "te"
                            ? "మూలంలో స్పష్టత లేదు — నిర్ధారించుకోండి."
                            : "Some source details are unclear — please confirm."}
                      </p>
                    ) : null}

                    {m.error ? (
                      <div className="mt-2 rounded-lg bg-ivory-2/80 px-2.5 py-1.5 text-[0.7rem] leading-snug text-mist">
                        {m.error}
                        {m.retryPayload ? (
                          <button type="button" onClick={() => void send(m.retryPayload as string)} className="ml-2 inline-flex items-center gap-1 font-bold text-navy underline underline-offset-2">
                            <RotateCcw size={10} aria-hidden="true" />
                            Retry live
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2 border-t border-line/70 pt-1.5">
                      <button
                        type="button"
                        onClick={() => void copyMsg(m)}
                        aria-label="Copy this answer"
                        className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-mist transition-colors hover:text-med-deep"
                      >
                        {copiedId === m.id ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                        {copiedId === m.id ? "Copied" : "Copy"}
                      </button>
                      <span className="text-[0.62rem] text-mist/70">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              ),
            )}

            {busy ? (
              <div className="flex items-start gap-2.5 animate-fade-in" aria-label="Assistant is typing">
                <AssistantAvatar />
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 shadow-sm">
                  <span className="typing-dot" />
                  <span className="typing-dot" style={{ animationDelay: "0.18s" }} />
                  <span className="typing-dot" style={{ animationDelay: "0.36s" }} />
                </div>
              </div>
            ) : null}
          </div>

          {/* suggestions */}
          {showSuggestions ? (
            <div className="cb-scroll flex gap-1.5 overflow-x-auto border-t border-line bg-white px-3.5 py-2.5" role="group" aria-label="Suggested questions">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="shrink-0 rounded-full border border-med-line bg-med-soft/60 px-3 py-1.5 text-[0.74rem] font-semibold text-med-deep transition-colors hover:bg-med hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : null}

          {/* input */}
          <form
            className="border-t border-line bg-white px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor="cb-assistant-input" className="sr-only">
                Ask a question about your care plan
              </label>
              <textarea
                id="cb-assistant-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder={lang === "te" ? "మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి…(Enter పంపు, Shift+Enter కొత్త పంక్తి)" : "Ask about your medicines, follow-up, warning signs…"}
                className="cb-input max-h-32 min-h-[44px] flex-1 resize-none !rounded-2xl text-[0.9rem]"
                maxLength={1000}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send question"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-med text-white shadow transition-all hover:bg-med-deep disabled:opacity-45"
              >
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[0.62rem] leading-snug text-mist/90">
              Prototype with synthetic data — not medical advice, not a clinician. Answers process your loaded summary;
              conversations stay in this session only.
              {lang === "te" ? " (తెలుగులో కూడా అడగవచ్చు.)" : ""}
            </p>
          </form>
        </section>
      ) : null}
    </>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy text-white shadow-sm" aria-hidden="true">
      <BotMessageSquare size={16} />
    </div>
  );
}
