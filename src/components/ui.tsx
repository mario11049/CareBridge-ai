import { clsx } from "@/lib/carebridge/util";

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={clsx("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="cb-eyebrow">{eyebrow}</p>
      <h2 className="cb-h2 mt-2 font-display">{title}</h2>
      {body ? <p className="mt-3 text-[0.98rem] leading-relaxed text-mist">{body}</p> : null}
    </div>
  );
}

export function PageShell({
  eyebrow,
  title,
  body,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow={eyebrow} title={title} body={body} />
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
