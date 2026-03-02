"use client";

import { Link } from "@/i18n/navigation";

type HeaderProfile = {
  name?: string | null;
  email: string;
  image?: string | null;
};

type QuickAction = {
  href: string;
  label: string;
};

type StatItem = {
  label: string;
  value: string;
};

type ProfileHeaderCardProps = {
  profile: HeaderProfile;
  title: string;
  subtitle: string;
  roleLabels: string[];
  quickActions: QuickAction[];
  stats: StatItem[];
  error?: string | null;
};

export default function ProfileHeaderCard({
  profile,
  title,
  subtitle,
  roleLabels,
  quickActions,
  stats,
  error,
}: ProfileHeaderCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-zinc-300">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/60 px-3 py-2">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-zinc-900">
            {profile.image ? (
              <img src={profile.image} alt={profile.name ?? profile.email} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-300">
                {(profile.name ?? profile.email ?? "?")
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-xs text-zinc-300">
            <p className="text-sm font-semibold text-white">{profile.name ?? "-"}</p>
            <p className="text-zinc-400">{profile.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roleLabels.map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-100"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-3 text-xs font-medium text-zinc-100 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-zinc-900"
          >
            {action.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-zinc-950/55 px-4 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-cyan-300/40"
          >
            <p className="text-[11px] text-zinc-400">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
