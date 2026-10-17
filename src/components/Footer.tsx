import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">
            Clear instructions. Safer recovery. A patient-education prototype that makes omissions and alterations visible instead
            of hiding them behind fluent language.
          </p>
        </div>
        <div className="text-sm">
          <p className="cb-eyebrow mb-3">Product</p>
          <ul className="space-y-2 text-ink/75">
            <li><Link className="hover:text-med-deep" href="/workspace">Care-plan workspace</Link></li>
            <li><Link className="hover:text-med-deep" href="/judge">Judge mode &amp; challenge tests</Link></li>
            <li><Link className="hover:text-med-deep" href="/evaluation">Evaluation dashboard</Link></li>
            <li><Link className="hover:text-med-deep" href="/print">Printable fridge sheet</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="cb-eyebrow mb-3">Honest by design</p>
          <ul className="space-y-2 text-ink/75">
            <li>Synthetic documents only — no real patient data.</li>
            <li>Automated checks are not a guarantee of clinical safety.</li>
            <li>Uploaded text is processed in memory and never stored.</li>
            <li><Link className="font-semibold text-med-deep underline-offset-2 hover:underline" href="/about">Limitations &amp; privacy →</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-mist">
        CareBridge AI · Built for a hackathon demonstration · Not a medical device · Not clinically validated
      </div>
    </footer>
  );
}
