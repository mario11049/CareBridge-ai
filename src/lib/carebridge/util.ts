// Shared helpers: seeded RNG, normalisation that cannot change clinical meaning,
// and small formatting utilities.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickN<T>(rng: () => number, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

/**
 * Meaning-preserving normalisation ONLY:
 * lowercase, collapse whitespace, unify trivial punctuation variants.
 * Never rewrites numbers, units, or tokens.
 */
export function normalize(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Numeric-string aware equality (650 vs 650.0 etc. are NOT treated equal — strings must match after trim). */
export function exactValue(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return normalize(a) === normalize(b);
}

export function isBlank(v: string | null | undefined): boolean {
  return v == null || normalize(v) === "";
}

export const NOT_STATED = "Not stated in source";
export const NOT_STATED_TE = "మూల పత్రంలో పేర్కొనలేదు";

export function displayValue(v: string | null | undefined): string {
  return isBlank(v) ? NOT_STATED : (v as string);
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(2, "0")}`;
}
