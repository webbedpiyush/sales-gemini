interface ParticipantCardProps {
  name: string;
  subtitle: string;
  badgeLabel: string;
  initials: string;
  isActive?: boolean;
}

export function ParticipantCard({
  name,
  subtitle,
  badgeLabel,
  initials,
  isActive = false,
}: ParticipantCardProps) {
  return (
    <article
      className={`w-full rounded-3xl border border-white/30 bg-white/85 p-8 text-slate-800 shadow-2xl backdrop-blur ${
        isActive ? "ring-2 ring-emerald-300/90" : ""
      }`}
    >
      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-white bg-slate-300 text-3xl font-semibold text-slate-700">
        {initials}
      </div>
      <h2 className="mt-6 text-center text-2xl font-semibold">{name}</h2>
      <p className="mt-2 text-center text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 flex justify-center">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold tracking-wide text-white">
          {badgeLabel}
        </span>
      </div>
    </article>
  );
}
