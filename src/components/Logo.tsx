import Link from "next/link";

export function BridgeMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="13" fill="#101D32" />
      {/* bridge deck */}
      <path d="M8 31.5h32" stroke="#0F9D91" strokeWidth="3.2" strokeLinecap="round" />
      {/* piers */}
      <path d="M14 31.5v-5.5M24 31.5v-8M34 31.5v-5.5" stroke="#0F9D91" strokeWidth="3.2" strokeLinecap="round" />
      {/* arch */}
      <path d="M11 27c3.5-8.5 22.5-8.5 26 0" stroke="#F2B84B" strokeWidth="2.6" strokeLinecap="round" />
      {/* heartbeat riding the bridge */}
      <path d="M14 21.5h4l1.6-3.4 2.8 6 1.8-2.6H34" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="CareBridge AI home">
      <BridgeMark />
      <span className={`font-extrabold tracking-tight text-[1.12rem] ${dark ? "text-white" : "text-navy"}`}>
        CareBridge
        <span className="text-med"> AI</span>
      </span>
    </Link>
  );
}
