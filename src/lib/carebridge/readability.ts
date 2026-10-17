// English readability metrics implemented locally (Flesch family).
// Telugu is intentionally NOT scored with these formulas — they are
// English-specific. The evaluation dashboard marks Telugu 'not applicable'.

export function countSyllablesWord(raw: string): number {
  const w = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let word = w.replace(/(?:[^laeiouy]e|ed|es)$/, "").replace(/^y/, "");
  const groups = word.match(/[aeiouy]{1,2}/g);
  const n = groups ? groups.length : 0;
  return Math.max(1, n);
}

export function splitSentences(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+/g) ?? [];
  const tail = text.replace(/\s+/g, " ").replace(/([^.!?]+[.!?]+)+/g, "");
  const all = tail.trim() ? [...parts, tail] : parts;
  return all.map((s) => s.trim()).filter((s) => /[a-zA-Z]/.test(s));
}

export function splitWords(text: string): string[] {
  const m = text.match(/[A-Za-z][A-Za-z'-]*/g);
  return m ? m : [];
}

export interface ReadabilityResult {
  sentences: number;
  words: number;
  syllables: number;
  wordsPerSentence: number;
  syllablesPerWord: number;
  fleschReadingEase: number; // higher = easier
  fleschKincaidGrade: number;
}

export function readability(text: string): ReadabilityResult {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  const syllables = words.reduce((acc, w) => acc + countSyllablesWord(w), 0);
  const ns = Math.max(1, sentences.length);
  const nw = Math.max(1, words.length);
  const wps = words.length / ns;
  const spw = syllables / nw;
  const fre = 206.835 - 1.015 * wps - 84.6 * spw;
  const grade = 0.39 * wps + 11.8 * spw - 15.59;
  return {
    sentences: sentences.length,
    words: words.length,
    syllables,
    wordsPerSentence: round1(wps),
    syllablesPerWord: round2(spw),
    fleschReadingEase: round1(fre),
    fleschKincaidGrade: round1(grade),
  };
}

export function fleschBand(score: number): string {
  if (score >= 90) return "Very easy (Class 5)";
  if (score >= 80) return "Easy (Class 6)";
  if (score >= 70) return "Fairly easy (Class 7)";
  if (score >= 60) return "Standard (Class 8–9)";
  if (score >= 50) return "Fairly difficult (Class 10–12)";
  if (score >= 30) return "Difficult (college)";
  return "Very difficult";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
