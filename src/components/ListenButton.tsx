"use client";

import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { useCareBridge } from "@/lib/store";

/**
 * Text-to-speech for the VALIDATED plan text (not a separate summary).
 * Uses the browser SpeechSynthesis API; picked voice prefers Telugu when the
 * interface language is Telugu. Clearly hidden when unsupported.
 */
export default function ListenButton({ getText }: { getText: () => string }) {
  const { lang } = useCareBridge();
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  if (!supported) {
    return (
      <span className="text-xs font-semibold text-mist" role="note">
        Audio playback is not supported in this browser.
      </span>
    );
  }

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  const play = () => {
    stop();
    const text = getText();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const want = lang === "te" ? ["te-IN", "te"] : ["en-IN", "en-GB", "en-US", "en"];
    const voice =
      voices.find((v) => want.includes(v.lang)) ?? voices.find((v) => v.lang.startsWith(lang === "te" ? "te" : "en"));
    if (voice) utter.voice = voice;
    utter.lang = voice?.lang ?? (lang === "te" ? "te-IN" : "en-IN");
    utter.rate = 0.95;
    utter.onend = () => setPlaying(false);
    utter.onerror = () => setPlaying(false);
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setPlaying(true);
  };

  return (
    <button
      type="button"
      onClick={playing ? stop : play}
      className={`cb-btn cb-btn-sm ${playing ? "cb-btn-dark" : "cb-btn-ghost"}`}
      aria-pressed={playing}
      aria-label={playing ? "Stop audio playback" : lang === "te" ? "Listen to the care plan in Telugu" : "Listen to the care plan in English"}
    >
      {playing ? <Square size={13} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
      {playing ? "Stop" : lang === "te" ? "వినండి" : "Listen"}
    </button>
  );
}
