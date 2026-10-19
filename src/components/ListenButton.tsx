"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Square, Volume2 } from "lucide-react";
import { useCareBridge } from "@/lib/store";

/**
 * Text-to-speech for the VALIDATED plan text (not a separate summary).
 *
 * Telugu correctness notes:
 * - window.speechSynthesis.getVoices() populates ASYNCHRONOUSLY. Calling it
 *   too early returns [] and the browser then speaks with its default
 *   (English) voice — which is exactly the "Telugu sounds like English" bug.
 *   We therefore await the voices list before speaking.
 * - If the device genuinely has no Telugu voice, we say so honestly instead of
 *   pretending playback is correct.
 */
export default function ListenButton({ getText }: { getText: () => string }) {
  const { lang } = useCareBridge();
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    });
    return () => {
      cancelAnimationFrame(id);
      stopRef.current = true;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  const getVoices = useCallback(async (): Promise<SpeechSynthesisVoice[]> => {
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();
    if (voices.length) return voices;
    // voices load asynchronously — wait for the event (with a timeout)
    voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve(synth.getVoices());
        }
      };
      synth.addEventListener("voiceschanged", done, { once: true });
      setTimeout(done, 1200);
    });
    return voices;
  }, []);

  const pickVoice = (voices: SpeechSynthesisVoice[], target: "en" | "te"): SpeechSynthesisVoice | null => {
    if (target === "te") {
      return (
        voices.find((v) => /^te([-_]|$)/i.test(v.lang)) ??
        voices.find((v) => /telugu|తెలుగు/i.test(v.name)) ??
        null
      );
    }
    return (
      voices.find((v) => /^en[-_]IN/i.test(v.lang)) ??
      voices.find((v) => /^en[-_]GB/i.test(v.lang)) ??
      voices.find((v) => /^en/i.test(v.lang)) ??
      null
    );
  };

  /** Split long text at sentence/punctuation boundaries — very long single utterances get truncated by some engines. */
  const chunk = (text: string, max = 220): string[] => {
    const out: string[] = [];
    let rest = text.replace(/\s+/g, " ").trim();
    while (rest.length > max) {
      let cut = Math.max(rest.lastIndexOf(". ", max), rest.lastIndexOf("? ", max), rest.lastIndexOf("! ", max), rest.lastIndexOf("। ", max), rest.lastIndexOf(", ", max));
      if (cut < Math.floor(max * 0.4)) cut = rest.lastIndexOf(" ", max);
      if (cut <= 0) cut = max;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
    return out.filter(Boolean);
  };

  if (!supported) {
    return (
      <span className="text-xs font-semibold text-mist" role="note">
        Audio playback is not supported in this browser.
      </span>
    );
  }

  const stop = () => {
    stopRef.current = true;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setPlaying(false);
  };

  const play = async () => {
    stopRef.current = false;
    window.speechSynthesis.cancel();
    setNotice(null);
    const voices = await getVoices();
    const wantTe = lang === "te";
    const voice = pickVoice(voices, wantTe ? "te" : "en");

    if (wantTe && !voice) {
      setNotice(
        "Ii device lo Telugu voice ledu (no Telugu voice is installed on this device/browser). Playing is blocked so the wrong language is not spoken. Try Chrome or Android, or install a Telugu voice in system settings — the plan text below is already Telugu.",
      );
      setPlaying(false);
      return;
    }

    const text = getText();
    const parts = chunk(text);
    let i = 0;
    setPlaying(true);

    const speakNext = () => {
      if (stopRef.current || i >= parts.length) {
        setPlaying(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i]);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? (wantTe ? "te-IN" : "en-IN");
      u.rate = wantTe ? 0.92 : 0.97;
      u.onend = () => {
        i += 1;
        speakNext();
      };
      u.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(u);
    };
    speakNext();
  };

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={playing ? stop : () => void play()}
        className={`cb-btn cb-btn-sm ${playing ? "cb-btn-dark" : "cb-btn-ghost"}`}
        aria-pressed={playing}
        aria-label={playing ? "Stop audio playback" : lang === "te" ? "Listen to the care plan in Telugu" : "Listen to the care plan in English"}
      >
        {playing ? <Square size={13} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
        {playing ? "Stop" : lang === "te" ? "వినండి" : "Listen"}
      </button>
      {notice ? (
        <span className="flex max-w-sm items-start gap-1.5 rounded-lg border border-warn/50 bg-warn-soft px-2.5 py-1.5 text-[0.72rem] leading-snug text-warn-deep" role="status">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {notice}
        </span>
      ) : null}
    </span>
  );
}
