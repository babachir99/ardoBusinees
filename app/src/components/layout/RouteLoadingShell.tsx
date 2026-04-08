type RouteLoadingShellProps = {
  title: string;
  subtitle: string;
  showGrid?: boolean;
};

export default function RouteLoadingShell({
  title,
  subtitle,
  showGrid = true,
}: RouteLoadingShellProps) {
  return (
    <div className="min-h-screen bg-jonta text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pb-24 pt-8">
        <section className="rounded-3xl border border-white/10 bg-zinc-900/55 p-6 shadow-[0_16px_44px_rgba(0,0,0,0.25)]">
          <div className="animate-pulse">
            <div className="h-3 w-28 rounded-full bg-emerald-400/20" />
            <div className="mt-4 h-10 w-full max-w-xl rounded-2xl bg-white/10" />
            <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-white/5" />
            <div className="mt-2 h-4 w-full max-w-xl rounded-full bg-white/5" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="h-11 w-36 animate-pulse rounded-full bg-emerald-400/20" />
            <div className="h-11 w-32 animate-pulse rounded-full bg-white/8" />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-900/45 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{title}</p>
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
          <div className="mt-4 animate-pulse rounded-2xl border border-white/10 bg-zinc-950/55 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
        </section>

        {showGrid ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <article
                key={item}
                className="animate-pulse rounded-3xl border border-white/10 bg-zinc-900/55 p-5"
              >
                <div className="h-32 rounded-2xl bg-zinc-950/70" />
                <div className="mt-4 h-4 w-20 rounded-full bg-white/5" />
                <div className="mt-3 h-6 w-4/5 rounded-full bg-white/10" />
                <div className="mt-3 h-4 w-2/5 rounded-full bg-emerald-400/20" />
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
