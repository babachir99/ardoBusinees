import type { LegalDocument } from "@/lib/legal";

export default function LegalDocumentView({
  locale,
  document,
}: {
  locale: string;
  document: LegalDocument;
}) {
  const isFr = locale === "fr";

  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-zinc-900/70 p-6 md:p-8">
      {!isFr ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
          The detailed legal version is currently published in French. The French version prevails until the full English legal pack is validated.
        </div>
      ) : null}

      {document.intro?.length ? (
        <div className="space-y-3">
          {document.intro.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-7 text-zinc-300">
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      <div className="space-y-5">
        {document.sections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-white/8 bg-zinc-950/45 p-5"
          >
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>

            {section.paragraphs?.length ? (
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-zinc-300">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}

            {section.bullets?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-300">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {section.note ? (
              <p className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm leading-7 text-sky-100">
                {section.note}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

